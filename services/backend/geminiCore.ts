import { GoogleGenAI } from "@google/genai";

export interface ProxyRequestPayload {
  contents?: any[];
  systemInstruction?: any;
  generationConfig?: any;
  apiKey?: string;
  model?: string;
  prompt?: string;
}

export async function handleGeminiProxyCore(payload: ProxyRequestPayload) {
  let activeApiKey = payload.apiKey;
  if (!activeApiKey || activeApiKey === "system-proxy-key" || activeApiKey === "dummy-key") {
    activeApiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  }

  if (!activeApiKey) {
    return { status: 400, body: { error: "API Key không tồn tại trên server." } };
  }

  try {
    const ai = new GoogleGenAI({ apiKey: activeApiKey });
    const modelName = payload.model || "gemini-2.5-flash";
    
    const contents = payload.contents || (payload.prompt ? [{ role: 'user', parts: [{ text: payload.prompt }] }] : []);

    const response = await ai.models.generateContent({
      model: modelName,
      contents,
      config: {
        systemInstruction: payload.systemInstruction,
        ...payload.generationConfig
      }
    });

    return { status: 200, body: { text: response.text } };
  } catch (error: any) {
    console.error("Gemini Core Error:", error);
    return { status: 500, body: { error: error.message || "Lỗi xử lý Gemini API trên server." } };
  }
}
