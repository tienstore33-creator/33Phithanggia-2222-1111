import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // API routes
  app.post("/api/gemini/generate-image", async (req, res) => {
    const { prompt, model, aspectRatio } = req.body;
    
    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
    
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
    const { prompt, model, systemInstruction, config } = req.body;
    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;

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
        model: model || 'gemini-1.5-flash',
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

  // Generic Proxy for Gemini SDK (alternative to direct API endpoints)
  app.all("/api/gemini/proxy/*", async (req, res) => {
    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
    if (!apiKey) {
      return res.status(401).json({ error: "Server API Key not configured." });
    }

    const path = req.params[0] || "";
    
    // Parse the incoming request's query string and enforce the real server apiKey
    let targetUrl = `https://generativelanguage.googleapis.com/${path}`;
    if (req.url.includes('?')) {
      const queryStr = req.url.split('?')[1];
      const searchParams = new URLSearchParams(queryStr);
      // Replace or set the 'key' param with our real, authenticated server-side key
      searchParams.set('key', apiKey);
      targetUrl += `?${searchParams.toString()}`;
    } else {
      targetUrl += `?key=${apiKey}`;
    }

    const requestHeaders = new Headers();
    Object.entries(req.headers).forEach(([key, value]) => {
      if (typeof value === 'string' && !['host', 'content-length', 'connection'].includes(key.toLowerCase())) {
        requestHeaders.set(key, value);
      }
    });
    requestHeaders.set("x-goog-api-key", apiKey);

    try {
      const response = await fetch(targetUrl, {
        method: req.method,
        headers: requestHeaders,
        body: req.method !== 'GET' && req.method !== 'HEAD' ? JSON.stringify(req.body) : undefined,
      });

      res.status(response.status);
      response.headers.forEach((value, name) => {
        if (!['content-encoding', 'transfer-encoding', 'connection'].includes(name.toLowerCase())) {
          res.setHeader(name, value);
        }
      });
      res.setHeader('X-Accel-Buffering', 'no');
      res.setHeader('Cache-Control', 'no-cache');

      if (response.body) {
        // @ts-ignore
        for await (const chunk of response.body) {
          res.write(chunk);
        }
      }
      res.end();
    } catch (error: any) {
      console.error("Proxy Error:", error);
      res.status(500).json({ error: error.message });
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
