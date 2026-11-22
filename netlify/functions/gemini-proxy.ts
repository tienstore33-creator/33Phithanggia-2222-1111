import { Context } from "@netlify/functions";

export default async (req: Request, context: Context) => {
  // CORS Headers
  const headers = new Headers({
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, x-goog-api-key, x-goog-api-client",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  });

  if (req.method === "OPTIONS") {
    return new Response(null, { headers });
  }

  const url = new URL(req.url);
  const path = url.pathname.replace('/.netlify/functions/gemini-proxy', '');

  // 1. Trích xuất API Key gửi từ phía Client trước (Key Cá Nhân từ LocalStorage gửi lên)
  let clientApiKey = req.headers.get("x-goog-api-key") || url.searchParams.get("key");

  if (!clientApiKey && req.headers.get("authorization")) {
    const authHeader = req.headers.get("authorization") || "";
    if (authHeader.startsWith("Bearer ")) {
      clientApiKey = authHeader.substring(7);
    }
  }

  // 2. Quyết định sử dụng khóa nào:
  // Nếu có khóa cá nhân hợp lệ (không phải khóa giữ chỗ hệ thống), ưu tiên sử dụng khóa cá nhân.
  // Ngược lại, dự phòng về khóa hệ thống trên máy chủ Netlify.
  let activeApiKey = clientApiKey;
  if (!activeApiKey || activeApiKey === "system-proxy-key" || activeApiKey === "dummy-key") {
    activeApiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  }

  // Cập nhật lại tham số `key` trong URL search params để tránh gửi key giả/dummy đến Google
  const searchParams = new URLSearchParams(url.search);
  if (activeApiKey) {
    searchParams.set("key", activeApiKey);
  }
  const searchString = searchParams.toString() ? `?${searchParams.toString()}` : "";
  const targetUrl = `https://generativelanguage.googleapis.com${path}${searchString}`;

  // 3. Nếu cả hai nguồn khóa đều không có, lúc này mới báo lỗi
  if (!activeApiKey) {
    return new Response(
      JSON.stringify({ 
        error: "Yêu cầu cấu hình API Key: Vui lòng nhập Key Cá Nhân trên thiết lập hoặc cấu hình GEMINI_API_KEY trên máy chủ." 
      }), 
      {
        status: 401,
        headers: { ...headers, "Content-Type": "application/json" }
      }
    );
  }

  const requestHeaders = new Headers(req.headers);
  // Thiết lập khóa hoạt động chính xác vào header yêu cầu gửi tới Google
  requestHeaders.set("x-goog-api-key", activeApiKey);
  requestHeaders.delete("host");

  try {
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: requestHeaders,
      body: req.body,
      // @ts-ignore
      duplex: 'half'
    });

    const responseHeaders = new Headers(response.headers);
    headers.forEach((value, key) => {
      responseHeaders.set(key, value);
    });

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error: any) {
    console.error("Proxy Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...headers, "Content-Type": "application/json" }
    });
  }
};
