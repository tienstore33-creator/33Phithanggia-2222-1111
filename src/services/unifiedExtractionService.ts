import { FanficAnalyzerService } from './fanficAnalyzerService';
import { UnifiedWorldSchema } from '../types/schemas/UnifiedWorldSchema';
import { cleanJsonResponse } from './geminiService';

export class UnifiedExtractionService {
  /**
   * Gọi ĐÚNG 1 LỆNH API DUY NHẤT để trích xuất toàn bộ dữ liệu Nhân Vật & Thế Giới
   */
  static async extractAllInOne(
    userInput: string,
    rawContent?: string,
    onChunk?: (accumulatedText: string) => void,
    useDeepGrounding: boolean = false
  ): Promise<any> {
    
    // 1. Xây dựng Prompt gộp duy nhất
    const prompt = `Bạn là chuyên gia phân tích nguyên tác và thiết lập thế giới đồng nhân.
Hãy phân tích tác phẩm/ý tưởng: "${userInput}" ${rawContent ? `\n\nDỮ LIỆU NGUYÊN TÁC KÈM THEO:\n${rawContent}` : ''}

NGHĨA VỤ PHÂN TÍCH:
1. Xác định thông tin nhân vật chính & các chỉ số khởi đầu (Tên, giới tính, chủng tộc, tính cách, tiểu sử, bối cảnh, mục tiêu, địa điểm bắt đầu, đặc điểm, tiền tệ, số tiền, linh căn, thể chất, thọ nguyên).
2. Trích xuất đồng thời bối cảnh thế giới: Ít nhất 10 nhân vật phụ quan trọng, 5 địa điểm nổi bật, 4 vật phẩm quan trọng và các phe phái chính.

Hãy trả về kết quả dưới dạng JSON khớp chính xác với cấu trúc yêu cầu.`;

    // 2. Cấu hình Config (Nếu user bật useDeepGrounding thì thêm tools search)
    const config: any = {
      tools: useDeepGrounding ? [{ googleSearch: {} }] : [],
      responseMimeType: "application/json",
      responseSchema: UnifiedWorldSchema,
      temperature: 0.15
    };

    // 3. Thực thi qua FanficAnalyzerService (Tự động chạy qua sanitizeSearchConfig & Fallback Chain)
    // Nếu model không hỗ trợ Search, sanitizeSearchConfig sẽ TỰ ĐỘNG tước bỏ `tools: [{ googleSearch: {} }]`
    // và chạy thuần bằng trí nhớ nội tại như khi TẮT "Kích hoạt tra cứu sâu".
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
    return JSON.parse(cleanedText);
  }
}
