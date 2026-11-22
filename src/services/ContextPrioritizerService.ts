import { RemoteCanonService } from '../../services/RemoteCanonService';
import { RAGService } from '../../services/RAGService';

/**
 * FILE: src/services/ContextPrioritizerService.ts
 * Đảm nhận vai trò "Nhà điều phối ngữ cảnh":
 * Ưu tiên lấy dữ liệu thô từ link (Bằng chứng cứng) 
 * sau đó mới dùng RAG (Bối cảnh bổ trợ) nếu cần.
 */
export class ContextPrioritizerService {
  static async getMasterContext(playerAction: string, canonUrl: string): Promise<string> {
    // 1. Trích xuất từ khóa thô (Dùng Regex đơn giản để tìm các cụm từ quan trọng)
    const keywords = this.extractKeywords(playerAction); 
    const query = keywords.join(" ") || playerAction;
    
    console.log(`[Prioritizer] Đang tra cứu ngữ cảnh cho query: "${query}" (Ưu tiên Link -> RAG)`);

    // 2. ƯU TIÊN 1: Streaming Lookup từ Link (Nguồn tin cậy tuyệt đối)
    let hardEvidence = "";
    if (canonUrl) {
      try {
        hardEvidence = await RemoteCanonService.search(canonUrl, query);
        // Nếu RemoteCanonService trả về thông báo không tìm thấy, ta coi như rỗng
        if (hardEvidence.includes("Không tìm thấy thông tin liên quan")) {
          hardEvidence = "";
        }
      } catch (e) {
        console.error("[Prioritizer] Lỗi khi tra cứu Link:", e);
      }
    }

    // 3. ƯU TIÊN 2: Bổ sung context từ RAG (Vector DB)
    let softContext = "";
    try {
      // Chúng ta luôn lấy thêm RAG để làm phong phú bối cảnh, 
      // nhưng nhãn sẽ khác nhau để AI ưu tiên.
      softContext = await RAGService.findRelevantContext(playerAction, 3);
    } catch (e) {
      console.error("[Prioritizer] Lỗi khi tra cứu RAG:", e);
    }

    return `
[NGUỒN TRUY XUẤT TỐI CAO - BẰNG CHỨNG CỨNG TỪ NGUYÊN TÁC]:
${hardEvidence || "Không tìm thấy bằng chứng trực tiếp trong tệp link."}

[BỐI CẢNH BỔ TRỢ TỪ HỆ THỐNG GAI GÓC (RAG)]:
${softContext || "Không có bối cảnh bổ trợ nào thêm."}
    `.trim();
  }

  /**
   * Trích xuất các thực thể hoặc từ khóa chính từ câu lệnh người chơi.
   */
  private static extractKeywords(text: string): string[] {
    // Tìm các từ viết hoa (tên nhân vật, địa danh) hoặc từ trong dấu nháy
    const capitalized = text.match(/[A-ZÀ-Ỹ][a-zà-ỹ]*/g) || [];
    const quoted = text.match(/"([^"]+)"|'([^']+)'/g) || [];
    
    const combined = [...new Set([...capitalized, ...quoted.map(s => s.slice(1, -1))])];
    
    // Lọc bỏ các từ quá ngắn nếu có nhiều từ khóa
    if (combined.length > 2) {
      return combined.filter(k => k.length > 1);
    }
    
    return combined;
  }
}
