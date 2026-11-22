import { NPC, KnowledgeBase } from '../types';
import { getEffectiveRealmSystem } from './realmManager';
import { callGeminiAPI } from './apiService';
import { parseXmlRealmNormalization } from '../utils/xmlDataParser';

export const normalizeNpcRealmsApi = async (
    kb: KnowledgeBase,
    wrongNpcs: NPC[]
): Promise<{ results: { id: string, newRealm: string }[], modelUsed: string, executionTimeMs: number }> => {
    const realmSystem = getEffectiveRealmSystem(kb);
    const majorRealms = realmSystem.majorRealms.join(', ');
    const minorRealms = realmSystem.minorRealms.join(', ');
    
    const npcListStr = wrongNpcs.map(n => `- ID: ${n.id}, Tên: ${n.name}, Cảnh giới sai: ${n.realm}`).join('\n');
    
    const prompt = `<he_thong_chuan_hoa_canh_gioi>
<nhiem_vu_+he_thong_chuan_hoa_canh_gioi>
================
Bạn là Trình điều phối Chuẩn hóa Cảnh giới. Nhiệm vụ của bạn là chuẩn hóa lại tên cảnh giới/thực lực của các nhân vật về đúng hệ thống cảnh giới chuẩn của thế giới hiện tại.
================
</nhiem_vu_+he_thong_chuan_hoa_canh_gioi>

<he_thong_canh_gioi_chuan_+he_thong_chuan_hoa_canh_gioi>
================
- Danh sách Đại cảnh giới (từ thấp đến cao): ${majorRealms}
- Danh sách Tiểu cảnh giới (từ thấp đến cao): ${minorRealms}
- Quy tắc cấu trúc chuẩn: '[Đại cảnh giới] [Tiểu cảnh giới]' (Ví dụ: 'Luyện Khí Tầng hai').
- Lưu ý: Nếu Đại cảnh giới là 'Phàm Nhân', thường chỉ ghi 'Phàm Nhân' không kèm tiểu cảnh giới.
================
</he_thong_canh_gioi_chuan_+he_thong_chuan_hoa_canh_gioi>

<quy_tac_quy_doi_+he_thong_chuan_hoa_canh_gioi>
================
1. Sửa lỗi định dạng tiểu cảnh giới (Ví dụ: "Luyện Khí Ngũ Trọng" -> "Luyện Khí Tầng năm" nếu tiểu cảnh giới chuẩn là Tầng năm).
2. NẾU TÊN CẢNH GIỚI THUỘC THỂ LOẠI KHÁC (như Ma Pháp/Tây Phương, Đô Thị/Cấp độ, Khoa Huyễn, Siêu Năng Lực, v.v.): Hãy phân tích cấp độ sức mạnh tương đối và SUY ĐOÁN QUY ĐỔI sang Đại cảnh giới + Tiểu cảnh giới tương đương trong hệ thống hiện tại.
================
</quy_tac_quy_doi_+he_thong_chuan_hoa_canh_gioi>

<danh_sach_nhan_vat_+he_thong_chuan_hoa_canh_gioi>
================
${npcListStr}
================
</danh_sach_nhan_vat_+he_thong_chuan_hoa_canh_gioi>

<dinh_dang_dau_ra_+he_thong_chuan_hoa_canh_gioi>
================
BẮT BUỘC chỉ trả về khối dữ liệu XML bọc bởi thẻ <ket_qua_chuan_hoa>...</ket_qua_chuan_hoa>.
Không được bọc thẻ markdown, không kèm suy nghĩ hay giải thích.

Cấu trúc XML yêu cầu:
<ket_qua_chuan_hoa>
  <nhan_vat>
    <id>character_id</id>
    <canh_gioi_chuan>standardized_realm</canh_gioi_chuan>
  </nhan_vat>
</ket_qua_chuan_hoa>
================
</dinh_dang_dau_ra_+he_thong_chuan_hoa_canh_gioi>
</he_thong_chuan_hoa_canh_gioi>`;

    const startTime = Date.now();
    const result = await callGeminiAPI(
        prompt,
        undefined,
        'combat',
        undefined,
        "Bạn là hệ thống xử lý logic game. BẮT BUỘC chỉ trả về duy nhất một khối dữ liệu XML bọc bởi thẻ <ket_qua_chuan_hoa>...</ket_qua_chuan_hoa>.",
        false,
        'text/plain',
        undefined,
        undefined,
        "Chuẩn hóa cảnh giới NPC",
        undefined,
        false
    );
    const executionTimeMs = Date.now() - startTime;
    
    let parsed: { id: string, newRealm: string }[] = [];
    try {
        parsed = parseXmlRealmNormalization(result.text || '');
    } catch (e) {
        console.error("Failed to parse normalize realms XML", e);
    }
    return {
        results: parsed,
        modelUsed: result.modelUsed || "Gemini AI",
        executionTimeMs
    };
};
