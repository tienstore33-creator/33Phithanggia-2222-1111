import { GoogleGenAI } from "@google/genai";
import { getTaskModel, getCurrentlyUsedApiKey, getApiSettings } from "../../services/apiService";
import { getAiClient } from "../../services/aiClient";
import { applyThinkingConfig } from "../../utils/thinkingLevelUtils";

/**
 * CanonExtractionService
 * Chịu trách nhiệm trích xuất dữ liệu thô liên quan đến mục tiêu từ link nguyên tác (RAG Step 1).
 */
export class CanonExtractionService {
  /**
   * Bước 1: Trích xuất dữ liệu thô liên quan đến mục tiêu từ văn bản nguyên tác.
   */
  static async extractRelevantContext(
    rawCanonText: string, 
    extractionTarget: 'CHARACTER' | 'CULTIVATION_SYSTEM' | 'STARTING_ELEMENTS',
    specificName?: string
  ): Promise<string> {
    
    // Nếu dữ liệu quá ngắn, trả về luôn để tiết kiệm lượt gọi AI lọc
    if (!rawCanonText || rawCanonText.length < 3000) return rawCanonText;

    // Sử dụng API key từ settings
    const apiKey = getCurrentlyUsedApiKey();
    if (!apiKey) {
      console.warn("API Key không được thiết lập.");
      return rawCanonText;
    }

    const genAI = getAiClient(getApiSettings(), apiKey);
    const modelName = getTaskModel('main');
    
    let queryPrompt = "";
    // ... (rest of switch)
    switch (extractionTarget) {
      case 'CHARACTER':
        queryPrompt = `Nhiệm vụ: Trình bày chi tiết về nhân vật "${specificName}".
        Hãy TÌM và TRÍCH DẪN các đoạn miêu tả:
        - Ngoại hình, tính cách, tiểu sử khởi đầu.
        - Mục tiêu, động lực của nhân vật.
        - Khả năng đặc biệt hoặc bối cảnh xuất thân cụ thể trong nguyên tác.`;
        break;
      case 'CULTIVATION_SYSTEM':
        queryPrompt = `Nhiệm vụ: Tìm dữ liệu về Hệ Thống SỨC MẠNH/TU LUYỆN trong văn bản.
        Hãy TÌM và LIỆT KÊ:
        - Tên các cấp bậc, cảnh giới (từ thấp đến cao).
        - Cách thức tu luyện đặc thù của thế giới này.
        - Các mức độ sức mạnh được văn bản nhắc tới (VD: Đấu Giả, Hồn Sư, Luyện Khí...).`;
        break;
      case 'STARTING_ELEMENTS':
        queryPrompt = `Nhiệm vụ: Tìm các yếu tố khởi đầu liên quan đến "${specificName}".
        Hãy TÌM và TRÍCH DẪN NGUYÊN VĂN:
        1. KỸ NĂNG/VẬT PHẨM: Các chiêu thức và vũ khí nhân vật này sở hữu lúc đầu truyện.
        2. DANH SÁCH NPC: Tên những người thân thiết, sư phụ, bạn bè hoặc đối thủ xuất hiện quanh nhân vật này. Trích dẫn miêu tả ngắn về họ.
        3. ĐỊA ĐIỂM: Nơi nhân vật này bắt đầu hành trình.
        4. TỔ CHỨC: Tông môn hoặc gia tộc mà nhân vật này thuộc về.`;
        break;
    }

    const systemInstruction = `BẠN LÀ MỘT CHIẾC MÁY PHOTOCOPY THÔNG MINH. 
    Nhiệm vụ duy nhất của bạn là TRÍCH ƯU VÀ TÓM LƯỢC dữ liệu có thực trong NGUỒN NGUYÊN TÁC.
    - TUYỆT ĐỐI CẤM tự bịa tên nhân vật, vật phẩm hay bất kỳ chi tiết nào không có trong văn bản. 
    - Nếu không thấy bất kỳ thông tin nào liên quan, hãy trả về CHÍNH XÁC chuỗi: "[NO_DATA_FOUND]". 
    - Giới hạn kết quả trích xuất dưới 2000 từ.`;

    try {
      const response = await genAI.models.generateContent({ 
        model: modelName, 
        contents: `[NGUỒN NGUYÊN TÁC]:\n${rawCanonText}\n\n[YÊU CẦU]: ${queryPrompt}`,
        config: applyThinkingConfig(modelName, {
            systemInstruction
        }, getApiSettings())
      });

      return response.text || "[NO_DATA_FOUND]";
    } catch (error) {
      console.error("Lỗi khi trích xuất dữ liệu nguyên tác:", error);
      return rawCanonText; // Trả về text gốc nếu lỗi
    }
  }
}
