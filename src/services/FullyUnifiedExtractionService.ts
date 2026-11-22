import { FanficAnalyzerService } from './fanficAnalyzerService';
import { FullyUnifiedWorldSchema } from '../types/schemas/FullyUnifiedWorldSchema';
import { cleanJsonResponse } from './geminiService';

export class FullyUnifiedExtractionService {
  static async extractAndFormatAllInOne(
    userInput: string,
    rawContent: string = "",
    onChunk?: (accumulatedText: string) => void,
    useDeepGrounding: boolean = false
  ): Promise<any> {
    
    const prompt = `Hãy đóng vai trò là một Chuyên gia thiết kế trò chơi nhập vai (RPG Game Designer) kiêm Nhà biên kịch Đồng Nhân/Fanfic xuất sắc. 
Nhiệm vụ của bạn là đọc thông tin đầu vào của người chơi và trích xuất/thiết kế ra một bộ thiết lập thế giới hoàn chỉnh theo định dạng JSON.

ĐẦU VÀO CỦA NGƯỜI CHƠI:
"${userInput}"

DỮ LIỆU NGUYÊN TÁC THAM KHẢO (NẾU CÓ):
"${rawContent}"

YÊU CẦU THIẾT KẾ & TÍNH TOÁN (HỢP NHẤT):
1. Phân tích cốt truyện chính, mục tiêu của nhân vật chính, tông giọng bối cảnh thế giới.
2. Thiết kế danh sách Địa điểm khởi đầu (gồm tên, mô tả chuẩn hóa).
3. Thiết kế danh sách Vật phẩm đặc trưng (gồm tên, phân loại, độ hiếm, chỉ số cộng thêm: maxSinhLuc, maxLinhLuc, sucTanCong, phongNgu).
   - TÍNH TOÁN chỉ số cơ học (equipmentDetails.statBonusesJSON) dạng chuỗi JSON chứa tối đa 4 thuộc tính: maxSinhLuc, maxLinhLuc, sucTanCong, phongNgu dựa trên: Base 10. Mỗi đại cảnh giới x1.8. Rarity mult: Phổ thông (x1), Hiếm (x1.5), Quý Báu (x2.5), Cực Phẩm (x4), Thần Thoại (x7), Chí Tôn (x12). KHÔNG tự bịa ra các khóa khác ngoài 4 khóa này.
4. Thiết kế ít nhất 4 NPC quan trọng khởi đầu:
   - Tính toán chỉ số sức mạnh kỹ thuật (Sinh lực, Linh lực, Sức tấn công, Sức phòng thủ) phù hợp với xuất thân, cảnh giới và bối cảnh truyện của họ.
5. Thiết kế các kỹ năng võ công, yêu thú linh thú khởi đầu, truyền thuyết ghi chép, phe phái chính tương ứng.

Hãy trả về kết quả dưới dạng JSON khớp chính xác với cấu trúc yêu cầu.`;

    const config: any = {
      responseMimeType: "application/json",
      responseSchema: FullyUnifiedWorldSchema,
      temperature: 0.15
    };

    if (useDeepGrounding) {
      config.tools = [{ googleSearch: {} }];
    }

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
