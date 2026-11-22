import { Type } from '@google/genai';
import { FanficAnalyzerService } from './fanficAnalyzerService';
import { cleanJsonResponse } from './geminiService';

export class CultivationAutoFillerStreamService {
  private static FALLBACK_DATA = {
    majorRealmsRaw: "Cảnh giới 1 - Cảnh giới 2 - Cảnh giới 3 - Cảnh giới 4 - Cảnh giới 5 - Cảnh giới 6 - Cảnh giới 7 - Cảnh giới 8 - Cảnh giới 9 - Cảnh giới 10",
    minorRealmsRaw: "Tầng 1 - Tầng 2 - Tầng 3 - Tầng 4 - Tầng 5 - Tầng 6 - Tầng 7 - Tầng 8 - Tầng 9 - Tầng 10"
  };

  /**
   * Gọi AI phân tích hệ thống tu luyện dạng Stream, tự động xử lý Search và có Fallback an toàn
   */
  static async fillCultivationSystemStream(
    contextPrompt: string,
    onChunk?: (accumulatedText: string) => void
  ): Promise<{ majorRealmsRaw: string; minorRealmsRaw: string }> {
    try {
      const prompt = `Bạn là một chuyên gia nghiên cứu bối cảnh tu chân, huyền huyễn và khoa huyễn.
Dựa trên tóm tắt cốt truyện/bối cảnh thế giới sau đây:
"${contextPrompt}"

Hãy tự động thiết lập một Hệ Thống Tu Luyện phù hợp nhất gồm Đại Cảnh Giới và Tiểu Cảnh Giới.
Yêu cầu:
1. Đại Cảnh Giới (majorRealmsRaw): Phải có ít nhất 5 đến 10 cảnh giới nối tiếp từ thấp đến cao, phân tách nhau bằng dấu " - ".
2. Tiểu Cảnh Giới (minorRealmsRaw): Các tầng nhỏ tương ứng trong mỗi cảnh giới (ví dụ: "Tầng 1 - Tầng 2 - Tầng 3 - Tầng 4 - Tầng 5 - Tầng 6 - Tầng 7 - Tầng 8 - Tầng 9 - Tầng 10").

Hãy trả về kết quả dưới dạng JSON khớp chính xác với cấu trúc yêu cầu.`;

      const config: any = {
        tools: [{ googleSearch: {} }], // Mặc định bật search, FanficAnalyzerService sẽ tự động tước bỏ nếu model không hỗ trợ
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            majorRealmsRaw: { type: Type.STRING },
            minorRealmsRaw: { type: Type.STRING }
          },
          required: ["majorRealmsRaw", "minorRealmsRaw"]
        },
        temperature: 0.15
      };

      let accumulatedThinking = "";
      let accumulatedContent = "";

      const rawResponse = await FanficAnalyzerService.executeStreamWithFallback(
        prompt,
        config,
        (contentChunk, thinkingChunk) => {
          if (thinkingChunk) accumulatedThinking += thinkingChunk;
          if (contentChunk) accumulatedContent += contentChunk;

          if (onChunk) {
            let combined = "";
            if (accumulatedThinking) {
              combined += `<thinking>\n${accumulatedThinking}\n</thinking>\n\n`;
            }
            combined += accumulatedContent;
            onChunk(combined);
          }
        }
      );

      const cleanedText = cleanJsonResponse(rawResponse || "{}");
      const parsedData = JSON.parse(cleanedText);

      if (parsedData.majorRealmsRaw && parsedData.minorRealmsRaw) {
        return {
          majorRealmsRaw: parsedData.majorRealmsRaw,
          minorRealmsRaw: parsedData.minorRealmsRaw
        };
      }

      return this.FALLBACK_DATA;
    } catch (error) {
      console.warn("Lỗi khi tự động điền hệ thống tu luyện dạng Stream, kích hoạt Fallback:", error);
      return this.FALLBACK_DATA;
    }
  }
}
