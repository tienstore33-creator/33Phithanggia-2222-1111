import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import https from "https";
import { URL } from "url";

// Khởi tạo Agent duy trì kết nối mạng (Keep-Alive) tối ưu kết nối
const geminiHttpsAgent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 30000,
  maxSockets: 100,
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  // 1. Cấu hình CORS toàn diện
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, x-goog-api-key, x-goog-api-client, Authorization');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // 2. Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // 3. API Proxy Gemini SDK (Hỗ trợ cả có slash và không có slash)
  app.all(["/api/gemini/proxy", "/api/gemini/proxy/*"], (req, res) => {
    let apiKeyRaw = req.headers["x-goog-api-key"] || req.query.key;
    let apiKey = typeof apiKeyRaw === 'string' ? apiKeyRaw : undefined;

    if (!apiKey && req.headers["authorization"]) {
      const authHeader = req.headers["authorization"] as string;
      if (authHeader.startsWith("Bearer ")) {
        apiKey = authHeader.substring(7);
      }
    }

    if (!apiKey || apiKey === "system-proxy-key" || apiKey === "dummy-key") {
      apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
    }

    if (!apiKey) {
      return res.status(401).json({ error: "API Key not configured. Please configure in settings." });
    }

    // Bóc tách đường dẫn con phía sau /api/gemini/proxy
    let subPath = req.params[0] || "";
    if (!subPath && req.originalUrl) {
      const parts = req.originalUrl.split('/api/gemini/proxy');
      if (parts.length > 1) {
        subPath = parts[1].split('?')[0];
      }
    }
    if (subPath.startsWith('/')) {
      subPath = subPath.substring(1);
    }

    const targetUrlStr = `https://generativelanguage.googleapis.com/${subPath}`;
    const urlObj = new URL(targetUrlStr);

    // Chuyển tiếp toàn bộ Query Params và chèn Key
    if (req.url.includes('?')) {
      const queryStr = req.url.substring(req.url.indexOf('?') + 1);
      const searchParams = new URLSearchParams(queryStr);
      searchParams.set('key', apiKey);
      urlObj.search = searchParams.toString();
    } else {
      urlObj.searchParams.set('key', apiKey);
    }

    // Lọc bỏ các Header xung đột
    const headers: Record<string, any> = {};
    Object.entries(req.headers).forEach(([key, value]) => {
      const lowerKey = key.toLowerCase();
      if (!['host', 'content-length', 'connection', 'accept-encoding', 'cookie'].includes(lowerKey)) {
        headers[key] = value;
      }
    });
    headers["x-goog-api-key"] = apiKey;
    headers["accept-encoding"] = "identity";

    const options = {
      method: req.method,
      headers: headers,
      agent: geminiHttpsAgent,
    };

    const proxyReq = https.request(urlObj, options, (proxyRes) => {
      res.setHeader('X-Accel-Buffering', 'no');
      res.setHeader('Cache-Control', 'no-cache, no-transform, no-store, must-revalidate');
      res.setHeader('Connection', 'keep-alive');

      const responseHeaders: Record<string, any> = {};
      Object.entries(proxyRes.headers).forEach(([key, value]) => {
        const lowerKey = key.toLowerCase();
        if (!['content-encoding', 'transfer-encoding', 'connection', 'content-length'].includes(lowerKey)) {
          responseHeaders[key] = value;
        }
      });

      res.writeHead(proxyRes.statusCode || 200, responseHeaders);
      proxyRes.pipe(res, { end: true });
    });

    proxyReq.on('error', (err) => {
      console.error("[PROXY ERROR]", err);
      if (!res.headersSent) {
        res.status(500).json({ error: "Lỗi kết nối Proxy máy chủ", details: err.message });
      } else {
        res.end();
      }
    });

    // Truyền dữ liệu Payload an toàn (Xử lý dứt điểm tình trạng mất buffer của express.json)
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      if (req.body && Object.keys(req.body).length > 0) {
        const bodyData = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
        proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
        proxyReq.setHeader('Content-Type', 'application/json');
        proxyReq.write(bodyData);
        proxyReq.end();
      } else {
        proxyReq.end();
      }
    } else {
      proxyReq.end();
    }
  });

  // 4. Vite middleware hoặc Static SPA Fallback
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    // Chỉ fallback index.html cho các route NON-API
    app.get('*', (req, res) => {
      if (req.path.startsWith('/api/')) {
        return res.status(404).json({ error: "API Endpoint Not Found" });
      }
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
