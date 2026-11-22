import { GoogleGenAI } from "@google/genai";
import { ApiConfig } from "../types";

// Khai báo một bộ headers chuẩn chống buffer proxy
// Cảnh báo: Không được gửi các header này tự động từ trình duyệt (client)
// vì các hệ thống API (như của Google) sẽ từ chối qua preflight CORS.
const isBrowser = typeof window !== 'undefined';
const streamingBypassHeaders: Record<string, string> = isBrowser ? {} : {
    'Accept': 'text/event-stream',      // Báo là luồng dữ liệu sự kiện
    'Cache-Control': 'no-cache',        // Cấm cache trên đường truyền
    'Connection': 'keep-alive',         // Giữ HTTP alive
    'X-Accel-Buffering': 'no'           // Chống buffer NGINX đặc thù
};

/**
 * Hàm khởi tạo GoogleGenAI client, tự động xử lý logic Reverse Proxy nếu được cấu hình.
 */
export const getAiClient = (settings: ApiConfig, defaultApiKey: string, category?: string): GoogleGenAI => {
    // Check if secondary proxy is configured and category is eligible (combat or economy)
    if ((category === 'combat' || category === 'economy') && settings.proxyUrl2 && settings.proxyUrl2.trim() !== '') {
        let baseUrl = settings.proxyUrl2.trim();
        if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);
        if (baseUrl.endsWith('/v1beta')) baseUrl = baseUrl.slice(0, -7);

        const proxyKey = settings.proxyKey2 || '';

        const aiOptions: any = {
            apiKey: proxyKey || 'dummy-key', // SDK requests apiKey, use dummy if proxy doesn't need
            httpOptions: {
                baseUrl: baseUrl,
                headers: { ...streamingBypassHeaders }
            }
        };

        if (proxyKey) {
            aiOptions.httpOptions.headers = {
                ...aiOptions.httpOptions.headers,
                'Authorization': `Bearer ${proxyKey}`,
                'x-goog-api-key': proxyKey,
            };
        }

        return new GoogleGenAI(aiOptions);
    }

    const isProxy = settings.apiKeySource === 'proxy';
    const isSystem = settings.apiKeySource === 'system';
    
    // Nếu dùng system key trên môi trường client, chúng ta sử dụng proxy nội bộ
    // để bảo vệ API key và tránh lộ bí mật.
    const hasServerKey = typeof process !== 'undefined' && (process.env?.GEMINI_API_KEY || process.env?.API_KEY);
    
    if (isSystem && !hasServerKey) {
        let internalProxyUrl = '/api/gemini/proxy';
        
        // Ensure relative URLs are fully qualified if we are on browser client
        if (typeof window !== 'undefined') {
             // Hỗ trợ trường hợp triển khai trên Netlify và dùng proxy netlify function
             if (window.location.hostname.includes('netlify.app')) {
                 internalProxyUrl = '/.netlify/functions/gemini-proxy';
             }
             internalProxyUrl = window.location.origin + internalProxyUrl;
        }

        return new GoogleGenAI({
            apiKey: 'system-proxy-key', // Dummy key since proxy provides the real one
            httpOptions: {
                baseUrl: internalProxyUrl,
                headers: { ...streamingBypassHeaders }
            }
        });
    }

    // Nếu không dùng proxy riêng ngoài, khởi tạo với Server Proxy nội bộ
    if (!isProxy || !settings.proxyUrl) {
        if (typeof window !== 'undefined') {
            const isNetlifyEnv = window.location.hostname.includes('netlify.app') || window.location.hostname.includes('netlify');
            const proxyEndpoint = isNetlifyEnv ? '/.netlify/functions/gemini-proxy' : '/api/gemini/proxy';
            const internalProxyUrl = window.location.origin + proxyEndpoint;

            // Chuyển toàn bộ các cuộc gọi từ trình duyệt qua server proxy để bất kỳ ai mở app cũng hoạt động
            return new GoogleGenAI({
                apiKey: defaultApiKey || 'system-proxy-key',
                httpOptions: {
                    baseUrl: internalProxyUrl,
                    headers: { ...streamingBypassHeaders }
                }
            });
        }

        return new GoogleGenAI({ 
            apiKey: defaultApiKey || process.env.GEMINI_API_KEY || process.env.API_KEY || '',
            httpOptions: {
                headers: { ...streamingBypassHeaders }
            }
        });
    }

    // Xử lý làm sạch URL proxy
    let baseUrl = settings.proxyUrl.trim();
    if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);
    if (baseUrl.endsWith('/v1beta')) baseUrl = baseUrl.slice(0, -7);

    const proxyKey = settings.proxyKey || '';

    const aiOptions: any = {
        apiKey: proxyKey || 'dummy-key', // SDK yêu cầu phải có apiKey, dùng dummy nếu proxy không cần
        httpOptions: {
            baseUrl: baseUrl,
            headers: { ...streamingBypassHeaders }
        }
    };

    return new GoogleGenAI(aiOptions);
};
