import { getApiSettings, getCurrentlyUsedApiKey, getTaskModel } from '../apiService';
import { getAiClient } from '../aiClient';
import { Type } from '@google/genai';
import { sanitizeSearchConfig } from '../../utils/searchGuard';

export class CultivationCanonSearchService {
  /**
   * Tra cứu thuật ngữ gốc và suy luận hệ thống tu luyện/cấp bậc nguyên tác bằng Google Search Grounding hoặc AI
   */
  static async searchAndDeduceCanonRealms(worldContext: string): Promise<{ majors: string; minors: string }> {
    const settings = getApiSettings();
    const apiKey = getCurrentlyUsedApiKey() || "";
    const aiClient = getAiClient(settings, apiKey);
    const modelName = getTaskModel('main'); // Dùng danh sách model động 'main'

    const prompt = `Bạn là chuyên gia tra cứu văn học, manga, anime, tiểu thuyết, game (tiếng Trung, Nhật, Anh, Việt...).
Dựa trên bối cảnh/tác phẩm đồng nhân sau:
"${worldContext}"

Nhiệm vụ của bạn:
1. Xác định tên tác phẩm gốc (ví dụ: Black Clover -> ブラッククローバー, Kiếm Lai -> 剑来, Jujutsu Kaisen -> 呪術廻戦, Naruto, Solo Leveling, v.v.).
2. Tra cứu/suy luận chính xác hệ thống cấp bậc sức mạnh/cảnh giới chính thức trong nguyên tác bằng ngôn ngữ gốc và dịch chuẩn sang tiếng Việt.
3. Sắp xếp thứ tự từ thấp đến cao thành chuỗi Đại cảnh giới phân cách bằng " - ".
4. Trả về tiểu cảnh giới mặc định (ví dụ: "Tầng 1 - Tầng 2 - Tầng 3 - Tầng 4 - Tầng 5 - Tầng 6 - Tầng 7 - Tầng 8 - Tầng 9" hoặc cấp độ phù hợp).

Trả về định dạng JSON:
{
  "majors": "Chuỗi đại cảnh giới phân cách bằng ' - '",
  "minors": "Chuỗi tiểu cảnh giới phân cách bằng ' - '"
}`;

    try {
      const config = sanitizeSearchConfig(modelName, {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            majors: { type: Type.STRING },
            minors: { type: Type.STRING }
          },
          required: ["majors", "minors"]
        },
        // Thêm tools googleSearch nếu cần, hoặc để Gemini tra cứu tri thức sẵn có
        tools: [{ googleSearch: {} }]
      });

      const response = await aiClient.models.generateContent({
        model: modelName,
        contents: prompt,
        config: config
      });

      const parsed = JSON.parse(response.text || "{}");
      return {
        majors: parsed.majors || "Phàm Nhân - Nhập Môn - Tinh Anh - Cao Thủ - Đại Sư - Tông Sư - Hóa Thần - Thánh Cấp - Thần Cấp",
        minors: parsed.minors || "Tầng 1 - Tầng 2 - Tầng 3 - Tầng 4 - Tầng 5 - Tầng 6 - Tầng 7 - Tầng 8 - Tầng 9"
      };
    } catch (err) {
      console.warn("CultivationCanonSearchService Google Search error, retrying without grounding tools:", err);
      // Fallback không dùng googleSearch tool nếu API key/model không hỗ trợ tool này
      const fallbackResponse = await aiClient.models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              majors: { type: Type.STRING },
              minors: { type: Type.STRING }
            },
            required: ["majors", "minors"]
          }
        }
      });
      const parsed = JSON.parse(fallbackResponse.text || "{}");
      return {
        majors: parsed.majors || "Phàm Nhân - Nhập Môn - Tinh Anh - Cao Thủ - Đại Sư - Tông Sư - Hóa Thần - Thánh Cấp - Thần Cấp",
        minors: parsed.minors || "Tầng 1 - Tầng 2 - Tầng 3 - Tầng 4 - Tầng 5 - Tầng 6 - Tầng 7 - Tầng 8 - Tầng 9"
      };
    }
  }
}
