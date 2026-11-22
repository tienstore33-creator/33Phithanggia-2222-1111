import { GoogleGenAI } from "@google/genai";

export const GOOGLE_GEMINI_BASE_ENDPOINT = "https://generativelanguage.googleapis.com";

/**
 * Service quản lý kết nối trực tiếp đến Google Gemini API.
 * Đảm bảo mọi luồng gọi AI đều đi trực tiếp đến hạ tầng chính thức của Google AI Studio.
 */
export class GeminiDirectConnectionService {
  private static instance: GeminiDirectConnectionService;

  private constructor() {}

  public static getInstance(): GeminiDirectConnectionService {
    if (!GeminiDirectConnectionService.instance) {
      GeminiDirectConnectionService.instance = new GeminiDirectConnectionService();
    }
    return GeminiDirectConnectionService.instance;
  }

  /**
   * Tạo instance GoogleGenAI cấu hình trực tiếp với Google AI Studio.
   */
  public createClient(apiKey: string): GoogleGenAI {
    if (!apiKey) {
      throw new Error("API Key không được để trống.");
    }

    return new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build'
        }
      }
    });
  }

  /**
   * Kiểm tra sức khỏe kết nối đường truyền trực tiếp tới Google API.
   */
  public async checkHealth(apiKey: string): Promise<{ ok: boolean; message: string }> {
    try {
      const client = this.createClient(apiKey);
      const response = await client.models.generateContent({
        model: 'gemini-flash-lite-latest',
        contents: 'ping',
      });
      if (response && response.text) {
        return { ok: true, message: "Kết nối Google Gemini API trực tiếp thành công." };
      }
      return { ok: false, message: "Phản hồi không hợp lệ từ Google Gemini API." };
    } catch (error: any) {
      return {
        ok: false,
        message: `Lỗi kết nối trực tiếp Google Gemini: ${error?.message || String(error)}`
      };
    }
  }
}

export const geminiDirectConnectionService = GeminiDirectConnectionService.getInstance();
