import { callGeminiAPI, getTaskModel } from './apiService';
import { GroundingData } from '../types/chatbot';

export interface VerificationResult {
  status: 'verifying' | 'verified' | 'error';
  isFabricated: boolean;
  verdict: string;
  details: string;
  verifiedAt: string;
  modelUsed?: string;
  grounding?: GroundingData;
}

/**
 * Thực hiện kiểm chứng độc lập tính chân thực của phản hồi AI bằng model category 'combat'
 */
export async function verifyChatbotResponse(textToVerify: string): Promise<VerificationResult> {
  const startTime = Date.now();
  const combatModelName = getTaskModel('combat');

  try {
    const systemInstruction = `
<quy_tac_kiem_chung_+tham_dinh_ai>
================
1. Bạn là chuyên gia Giám định & Thẩm định Độc lập (Verifier). Nhiệm vụ TỐI CAO và BẮT BUỘC của bạn là TRUNG THỰC TUYỆT ĐỐI, KHÁCH QUAN, KHÔNG BA PHẢI, KHÔNG BAO CHE.
2. Hãy soi xét kỹ lưỡng từng dòng, từng chi tiết trong phản hồi của AI được cung cấp:
   - Kiểm tra xem thông tin có bất kỳ chi tiết nào bịa đặt (hallucination), ngụy tạo, sai sự thật, tự biên tự diễn hoặc thiếu căn cứ hay không.
   - Đánh giá xem nội dung có chuẩn xác, trung thực, đáng tin cậy hay không.
3. BẮT BUỘC trả về thẻ kết luận ở ngay dòng đầu tiên (chỉ chọn 1 trong 2 thẻ):
   - <ket_luan>BIA_DAT</ket_luan> : Nếu phát hiện bất kỳ chi tiết nào sai sự thật, ngụy tạo, bịa đặt, hoang tưởng.
   - <ket_luan>CHINH_XAC</ket_luan> : Nếu toàn bộ nội dung hoàn toàn chuẩn xác, trung thực, đúng thực tế và không có chi tiết bịa đặt.
4. Phần giải trình thẩm định chi tiết phía sau:
   - Nếu có chi tiết BỊA ĐẶT / SAI SỰ THẬT: Phải lập tức chỉ rõ ĐÍCH DANH từng câu/chi tiết bịa đặt đó, giải thích vì sao sai và sự thật chính xác là gì.
   - Nếu CHÍNH XÁC: Nêu ngắn gọn các cơ sở xác nhận tính đúng đắn, trung thực và tin cậy của phản hồi.
================
</quy_tac_kiem_chung_+tham_dinh_ai>
`.trim();

    const verifyPrompt = `
<noi_dung_can_kiem_chung_+phan_hoi_ai>
================
${textToVerify}
================
</noi_dung_can_kiem_chung_+phan_hoi_ai>

Hãy chủ động tra cứu Google Search để đối chiếu chéo các sự kiện, tên gọi, dữ liệu thực tế và tiến hành thẩm định độc lập tính chân thực của toàn bộ nội dung phản hồi trên theo đúng quy tắc thẩm định.
`.trim();

    const res = await callGeminiAPI(
      verifyPrompt,
      undefined,
      'combat',
      undefined,
      systemInstruction,
      true, // Bật Google Search Grounding để Verifier tra cứu sự kiện thực tế mới nhất
      undefined,
      undefined,
      undefined,
      'Kiểm chứng tính xác thực phản hồi AI Sandbox',
      0,
      false
    );

    const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[API Verification] combat : ${res.modelUsed || combatModelName} : ${elapsedSec}s : Kiểm chứng phản hồi AI : chatbotVerifierService.ts`);

    const rawText = res.text.trim();
    let isFabricated = false;

    // Phân tích kết luận dựa trên thẻ chính thức hoặc dòng mở đầu
    if (rawText.includes('<ket_luan>BIA_DAT</ket_luan>') || rawText.includes('[KET_LUAN: BIA_DAT]')) {
      isFabricated = true;
    } else if (rawText.includes('<ket_luan>CHINH_XAC</ket_luan>') || rawText.includes('[KET_LUAN: CHINH_XAC]')) {
      isFabricated = false;
    } else {
      // Fallback: Kiểm tra phân tích ở 150 ký tự đầu tiên
      const headerSnippet = rawText.slice(0, 150).toUpperCase();
      if (headerSnippet.includes('BIA_DAT') || (headerSnippet.includes('KẾT LUẬN: BỊA ĐẶT') || headerSnippet.includes('KẾT LUẬN: SAI'))) {
        isFabricated = true;
      } else {
        isFabricated = false;
      }
    }
    
    const cleanDetails = rawText
      .replace(/<ket_luan>[\s\S]*?<\/ket_luan>/gi, '')
      .replace(/\[KET_LUAN:[\s\S]*?\]/gi, '')
      .trim();

    return {
      status: 'verified',
      isFabricated,
      verdict: isFabricated ? 'Phát hiện chi tiết BỊA ĐẶT / SAI LỆCH' : 'Đã kiểm chứng: CHÍNH XÁC / ĐÁNG TIN CẬY',
      details: cleanDetails,
      verifiedAt: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      modelUsed: res.modelUsed || combatModelName,
      grounding: res.grounding
    };
  } catch (err: any) {
    console.error('Lỗi khi kiểm chứng phản hồi:', err);
    return {
      status: 'error',
      isFabricated: false,
      verdict: 'Lỗi kiểm chứng',
      details: `Không thể hoàn tất kiểm chứng: ${err?.message || String(err)}`,
      verifiedAt: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    };
  }
}
