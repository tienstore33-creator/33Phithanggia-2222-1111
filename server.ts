import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import https from "https";
import { URL } from "url";
import { handleGeminiProxyCore } from './services/backend/geminiCore.js';
import { generateCloudinarySignatureCore } from './services/backend/cloudinaryCore.js';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Cấu hình CORS để tránh lỗi Failed to fetch từ trình duyệt
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, x-goog-api-key, Authorization');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  app.use(express.json({ limit: '50mb' })); // Increased limit for larger payloads
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  app.post("/api/gemini-proxy", async (req, res) => {
    const result = await handleGeminiProxyCore(req.body || {});
    res.status(result.status).json(result.body);
  });

  app.post("/api/generate-cloudinary-signature", async (req, res) => {
    const result = generateCloudinarySignatureCore(req.body?.paramsToSign || {});
    res.status(result.status).json(result.body);
  });

  app.post("/api/gemini/generate-image", async (req, res) => {
    const { prompt, model, aspectRatio, apiKey: clientApiKey } = req.body;
    
    let apiKey = clientApiKey;
    if (!apiKey || apiKey === "system-proxy-key" || apiKey === "dummy-key") {
      apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
    }
    
    if (!apiKey) {
      return res.status(401).json({ error: "Server API Key not configured. Please set GEMINI_API_KEY in secrets." });
    }

    try {
      const ai = new GoogleGenAI({ 
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });
      
      const isImagen = model && model.includes('imagen');
      const modelsToTry = isImagen 
        ? [model, 'imagen-3.0-generate-002', 'imagen-3.0-fast-generate-001', 'imagen-3.0-generate-001', 'imagen-4.0-generate-001'] 
        : [model || 'gemini-2.5-flash-image', 'imagen-3.0-generate-002', 'imagen-3.0-fast-generate-001', 'imagen-3.0-generate-001', 'imagen-4.0-generate-001'];

      let lastError = null;

      for (const modelId of modelsToTry) {
        try {
          console.log(`Attempting image generation with model: ${modelId}`);
          const currentIsImagen = modelId.includes('imagen');
          
          if (currentIsImagen) {
            const result = await ai.models.generateImages({
              model: modelId,
              prompt: prompt,
              config: {
                numberOfImages: 1,
                aspectRatio: aspectRatio || '1:1',
              },
            });
            
            const imagePart = result.generatedImages?.[0]?.image;
            if (imagePart?.imageBytes) {
               return res.json({ 
                 imageData: `data:image/png;base64,${imagePart.imageBytes}`,
                 modelUsed: modelId
               });
            }
          } else {
            const result = await ai.models.generateContent({
              model: modelId,
              contents: [{ role: 'user', parts: [{ text: prompt }] }],
              config: {
                imageConfig: {
                  aspectRatio: aspectRatio || '1:1',
                }
              }
            });
            
            const contentPart = result.candidates?.[0]?.content?.parts;
            const imageFound = contentPart?.find(p => p.inlineData);
            
            if (imageFound?.inlineData) {
              const mimeType = imageFound.inlineData.mimeType || 'image/png';
              return res.json({ 
                imageData: `data:${mimeType};base64,${imageFound.inlineData.data}`,
                modelUsed: modelId
              });
            }
          }
        } catch (err: any) {
          console.warn(`Model ${modelId} failed:`, err.message || err);
          lastError = err;
          // Continue to next model if it is not an authentication failure (401)
          if (err.status === 401) {
            break;
          }
          continue;
        }
      }
      
      // If we reach here, all tried models failed or no image was generated
      if (lastError && (lastError.status === 429 || lastError.message?.includes("Quota"))) {
         return res.status(429).json({ 
            error: "Tất cả các model tạo ảnh đều đã hết hạn mức. Vui lòng thử lại sau 1-5 phút.",
            details: lastError.message
         });
      }

      res.status(404).json({ error: "Không thể tạo được ảnh sau khi thử nhiều model." });
    } catch (error: any) {
      console.error("Server-side image gen failed:", error);
      
      // Handle Quota Exceeded (429) specifically
      if (error.status === 429 || (error.message && error.message.includes("429")) || (error.message && error.message.includes("Quota exceeded"))) {
        return res.status(429).json({ 
          error: "Hết hạn mức (Quota exceeded) cho tạo ảnh AI. Vui lòng thử lại sau khoảng 1 phút hoặc kiểm tra cấu hình API Key của bạn.",
          retryAfter: 60
        });
      }

      res.status(500).json({ error: error.message || "Internal Server Error during image generation" });
    }
  });

  app.post("/api/gemini/generate-content", async (req, res) => {
    const { prompt, model, systemInstruction, config, apiKey: clientApiKey } = req.body;
    
    let apiKey = clientApiKey;
    if (!apiKey || apiKey === "system-proxy-key" || apiKey === "dummy-key") {
      apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
    }

    if (!apiKey) {
      return res.status(401).json({ error: "Server API Key not configured." });
    }

    try {
      const ai = new GoogleGenAI({ 
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const result = await ai.models.generateContent({
        model: model || 'gemini-flash-latest',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          systemInstruction,
          ...config
        }
      });

      res.json({ text: result.text });
    } catch (error: any) {
      console.error("Server-side text gen failed:", error);
      res.status(500).json({ error: error.message || "Internal Server Error during text generation" });
    }
  });

  // API endpoint to analyze presets using Gemini AI
  app.post("/api/analyze-preset", async (req, res) => {
    const { content, model, apiKey: clientApiKey } = req.body;
    
    let apiKey = clientApiKey;
    if (!apiKey || apiKey === "system-proxy-key" || apiKey === "dummy-key") {
      apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
    }

    if (!apiKey) {
      return res.status(401).json({ error: "Chưa cấu hình API Key trên Server. Vui lòng thiết lập GEMINI_API_KEY." });
    }

    if (!content) {
      return res.status(400).json({ error: "Nội dung preset không được để trống." });
    }

    try {
      const { analyzePresetWithAI } = await import("./services/presetAnalysisService.js");
      const sections = await analyzePresetWithAI(apiKey, content, model);
      res.json(sections);
    } catch (error: any) {
      console.error("Error analyzing preset:", error);
      res.status(500).json({ error: error.message || "Lỗi bất ngờ xảy ra khi phân tích preset." });
    }
  });

  // Generic Proxy for Gemini SDK (alternative to direct API endpoints)
  app.all("/api/gemini/proxy/*", async (req, res) => {
    let clientApiKey = req.headers["x-goog-api-key"] as string || req.query.key as string;
    
    if (!clientApiKey && req.headers.authorization) {
        const authHeader = req.headers.authorization;
        if (authHeader.startsWith("Bearer ")) {
            clientApiKey = authHeader.substring(7);
        }
    }

    let apiKey = clientApiKey;
    if (!apiKey || apiKey === "system-proxy-key" || apiKey === "dummy-key") {
      apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
    }

    if (!apiKey) {
      console.warn("[PROXY] API Key missing in environment");
      return res.status(401).json({ error: "Server API Key not configured. Please set GEMINI_API_KEY in secrets." });
    }

    const apiPath = req.params[0] || "";
    let targetUrl = `https://generativelanguage.googleapis.com/${apiPath}`;
    
    // Xử lý query params
    const urlObj = new URL(targetUrl);
    if (req.url.includes('?')) {
      const queryStr = req.url.substring(req.url.indexOf('?') + 1);
      const searchParams = new URLSearchParams(queryStr);
      searchParams.set('key', apiKey);
      urlObj.search = searchParams.toString();
    } else {
      urlObj.searchParams.set('key', apiKey);
    }

    console.log(`[PROXY] ${req.method} ${apiPath}`);

    // 1. Ưu tiên xử lý trực tiếp bằng Native Node.js SDK (@google/genai) trên Server
    const modelMatch = apiPath.match(/models\/([^:]+)/);
    const modelName = modelMatch ? modelMatch[1] : "gemini-flash-latest";
    let parsedBody: any = req.body;
    if (typeof parsedBody === 'string') {
      try { parsedBody = JSON.parse(parsedBody); } catch (_) {}
    }
    parsedBody = parsedBody || {};

    const nativeAi = new GoogleGenAI({ apiKey });
    const extractHttpStatus = (err: any): number => {
      const directStatus = Number(err?.status || err?.statusCode || err?.code || err?.error?.code);
      if (directStatus >= 400 && directStatus < 600) return directStatus;
      const msg = typeof err?.message === 'string' ? err.message : '';
      const codeMatch = msg.match(/"code"\s*:\s*(\d{3})/) || msg.match(/\b(400|401|403|404|429|500|502|503|504)\b/);
      if (codeMatch && codeMatch[1]) {
        const parsed = Number(codeMatch[1]);
        if (parsed >= 400 && parsed < 600) return parsed;
      }
      if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('Too Many Requests')) return 429;
      if (msg.includes('API_KEY_INVALID') || msg.includes('INVALID_ARGUMENT')) return 400;
      if (msg.includes('NOT_FOUND')) return 404;
      return 500;
    };

    const proxyConfig: any = {
      systemInstruction: parsedBody.systemInstruction,
      ...(parsedBody.generationConfig || {}),
      tools: parsedBody.tools
    };
    if (parsedBody.safetySettings) proxyConfig.safetySettings = parsedBody.safetySettings;
    if (parsedBody.toolConfig) proxyConfig.toolConfig = parsedBody.toolConfig;
    if (parsedBody.thinkingConfig && !proxyConfig.thinkingConfig) proxyConfig.thinkingConfig = parsedBody.thinkingConfig;

    // A. Xử lý Server-Side Streaming (streamGenerateContent)
    if (apiPath.includes(':streamGenerateContent')) {
      try {
        const streamResult = await nativeAi.models.generateContentStream({
          model: modelName,
          contents: parsedBody.contents || (parsedBody.prompt ? [{ role: 'user', parts: [{ text: parsedBody.prompt }] }] : []),
          config: proxyConfig
        });

        res.status(200);
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');

        for await (const chunk of streamResult) {
          res.write(`data: ${JSON.stringify(chunk)}\n\n`);
        }
        res.end();
        return;
      } catch (streamError: any) {
        const errStatus = extractHttpStatus(streamError);
        const errMsg = streamError?.message || String(streamError || "Lỗi tạo nội dung trên server.");
        if (errStatus === 429 || (errStatus >= 400 && errStatus < 500)) {
          console.warn(`[SERVER Gemini Stream Warning (${errStatus})]:`, errMsg);
        } else {
          console.error("[SERVER Gemini Stream Error]:", errMsg);
        }

        // Không gọi lặp lại generateContent với lỗi 429/400/401/403/404 hoặc khi header đã gửi để tránh nhân đôi lỗi quota
        const shouldSkipNonStreamFallback =
          res.headersSent ||
          [400, 401, 403, 404, 429].includes(errStatus);

        if (shouldSkipNonStreamFallback) {
          if (!res.headersSent) {
            return res.status(errStatus).json({ error: errMsg });
          }
          res.end();
          return;
        }

        // Chỉ fallback sang generateContent nếu lỗi là do stream không được hỗ trợ
        try {
          const singleRes = await nativeAi.models.generateContent({
            model: modelName,
            contents: parsedBody.contents || (parsedBody.prompt ? [{ role: 'user', parts: [{ text: parsedBody.prompt }] }] : []),
            config: proxyConfig
          });
          res.status(200);
          res.setHeader('Content-Type', 'text/event-stream');
          res.setHeader('Cache-Control', 'no-cache, no-transform');
          res.setHeader('Connection', 'keep-alive');
          res.setHeader('X-Accel-Buffering', 'no');
          res.write(`data: ${JSON.stringify(singleRes)}\n\n`);
          res.end();
          return;
        } catch (fallbackErr: any) {
          const fallbackStatus = extractHttpStatus(fallbackErr);
          if (!res.headersSent) {
            return res.status(fallbackStatus).json({ error: fallbackErr?.message || "Lỗi tạo nội dung trên server." });
          }
          res.end();
          return;
        }
      }
    }

    // B. Xử lý Server-Side GenerateContent đơn lẻ
    if (apiPath.includes(':generateContent')) {
      try {
        const generateRes = await nativeAi.models.generateContent({
          model: modelName,
          contents: parsedBody.contents || (parsedBody.prompt ? [{ role: 'user', parts: [{ text: parsedBody.prompt }] }] : []),
          config: proxyConfig
        });
        return res.status(200).json(generateRes);
      } catch (generateErr: any) {
        const errStatus = extractHttpStatus(generateErr);
        const errMsg = generateErr?.message || String(generateErr || "Lỗi xử lý Gemini generateContent trên server.");
        if (errStatus === 429 || (errStatus >= 400 && errStatus < 500)) {
          console.warn(`[SERVER Gemini Generate Warning (${errStatus})]:`, errMsg);
        } else {
          console.error("[SERVER Gemini Generate Error]:", errMsg);
        }
        return res.status(errStatus).json({ error: errMsg });
      }
    }

    // C. Xử lý Server-Side EmbedContent / BatchEmbedContents
    if (apiPath.includes(':embedContent') || apiPath.includes(':batchEmbedContents')) {
      try {
        let contentsToEmbed: any[] = [];
        if (parsedBody.requests && Array.isArray(parsedBody.requests)) {
          contentsToEmbed = parsedBody.requests.map((r: any) => r.content || { parts: [{ text: '' }] });
        } else if (parsedBody.contents) {
          contentsToEmbed = Array.isArray(parsedBody.contents) ? parsedBody.contents : [parsedBody.contents];
        } else if (parsedBody.content) {
          contentsToEmbed = [parsedBody.content];
        }

        const embedRes = await nativeAi.models.embedContent({
          model: modelName.startsWith('models/') ? modelName : `models/${modelName}`,
          contents: contentsToEmbed
        });
        return res.status(200).json(embedRes);
      } catch (embedErr: any) {
        const errStatus = extractHttpStatus(embedErr);
        const errMsg = embedErr?.message || String(embedErr || "Lỗi tạo vector embedding trên server.");
        if (errStatus === 429 || (errStatus >= 400 && errStatus < 500)) {
          console.warn(`[SERVER Gemini Embed Warning (${errStatus})]:`, errMsg);
        } else {
          console.error("[SERVER Gemini Embed Error]:", errMsg);
        }
        return res.status(errStatus).json({ error: errMsg });
      }
    }

    // D. Đối với các endpoint khác (ví dụ lấy danh sách model): dùng fetch an toàn
    try {
      const requestHeaders = new Headers();
      Object.entries(req.headers).forEach(([key, value]) => {
        const lowerKey = key.toLowerCase();
        if (typeof value === 'string' && !['host', 'content-length', 'connection', 'accept-encoding', 'cookie'].includes(lowerKey)) {
          requestHeaders.set(key, value);
        }
      });
      requestHeaders.set("x-goog-api-key", apiKey);
      requestHeaders.set("accept-encoding", "identity");

      const fetchOptions: RequestInit = {
        method: req.method,
        headers: requestHeaders,
        // @ts-ignore
        duplex: 'half'
      };

      if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
        fetchOptions.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      }

      let response = await fetch(urlObj.toString(), fetchOptions);
      res.status(response.status);
      response.headers.forEach((value, name) => {
        const lowerName = name.toLowerCase();
        if (!['content-encoding', 'transfer-encoding', 'connection', 'content-length'].includes(lowerName)) {
          res.setHeader(name, value);
        }
      });
      res.setHeader('X-Accel-Buffering', 'no');
      res.setHeader('Cache-Control', 'no-cache, no-transform, no-store, must-revalidate');
      res.setHeader('Connection', 'keep-alive');

      if (response.body) {
        if (typeof (response.body as any).getReader === 'function') {
          // @ts-ignore
          const reader = response.body.getReader();
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              res.write(value);
            }
          } catch (streamErr) {
            console.error("[PROXY] Streaming error:", streamErr);
          } finally {
            reader.releaseLock();
          }
        } else {
          try {
            for await (const chunk of (response.body as any)) {
              res.write(chunk);
            }
          } catch (streamErr) {
            console.error("[PROXY] Stream iteration error:", streamErr);
          }
        }
      }
      res.end();
      return;
    } catch (fetchErr: any) {
      console.error("[PROXY] Other endpoint fetch error:", fetchErr);
      if (!res.headersSent) {
        return res.status(500).json({ error: fetchErr.message || "Lỗi proxy server." });
      }
      res.end();
      return;
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
