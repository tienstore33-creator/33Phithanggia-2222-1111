import { KnowledgeBase } from '../types';

export const analyzeCombatantsPrompt = (kb: KnowledgeBase, currentNarration: string, previousNarration: string): string => {
    const allNPCs = [...kb.discoveredNPCs, ...kb.discoveredYeuThu, ...kb.wives, ...kb.slaves];
    const currentPlayerName = kb.worldConfig?.playerName || "Người chơi";
    const deceasedProtagonists = kb.worldConfig?.deceasedProtagonists || kb.deceasedProtagonists || [];

    const npcList = allNPCs.map(npc => {
        const affinity = (npc as any).affinity ?? ((npc as any).isHostile ? -50 : 0);
        const status = (npc as any).status || "Bình thường";
        return `- ${npc.name} (ID: ${npc.id}, Trạng thái: ${status}, Thiện cảm: ${affinity})`;
    }).join('\n');

    return `Bạn là hệ thống phân tích chiến đấu chuyên nghiệp. Nhiệm vụ của bạn là xác định ai THỰC SỰ đang có mặt tại hiện trường.

QUY TẮC PHÂN TÍCH BỐI CẢNH (CỰC KỲ QUAN TRỌNG):
1. Phân biệt Hiện diện vs Gián tiếp:
   - CHỈ liệt kê những nhân vật đang ở cùng địa điểm, trực tiếp tương tác hoặc tấn công người chơi.
   - BỎ QUA các nhân vật chỉ được nhắc tên, xuất hiện trong hồi tưởng, hoặc đang ở một nơi xa xôi.
   - **CẤM ĐƯA NGƯỜI CHƠI VÀO DANH SÁCH:** Nhân vật chính hiện tại của người chơi là "${currentPlayerName}". TUYỆT ĐỐI KHÔNG đưa "${currentPlayerName}" vào danh sách opponents hay allies!
   - **CẤM ĐƯA NHÂN VẬT ĐÃ CHẾT/TIỀN NHIỆM VÀO CHIẾN ĐẤU:** Các nhân vật chính tiền nhiệm đã chết: [${deceasedProtagonists.join(', ') || 'Không có'}] và các NPC có trạng thái "Đã chết" tuyệt đối KHÔNG được đưa vào opponents hay allies (xác chết hoặc tàn tích không thể tự chiến đấu).
2. ĐIỀU KIỆN KÍCH HOẠT CHIẾN ĐẤU (BẮT BUỘC):
   - Phải **THẬT SỰ GIAO TRANH TÁC ĐỘNG VẬT LÝ** đang nhắm đến mục tiêu ở cuối lượt (VD: thanh kiếm đâm tới, thanh đao đâm vào, túm cổ mạnh,...) hoặc ma thuật gây sát thương trong cuối lượt hiện tại hoặc tương lai gần thì mới được liệt kê đối thủ.
   - NẾU CHỈ LÀ CĂNG THẲNG, CÃI VÃ, GIAO HOAN, HOẶC THÙ HẰN QUA LỜI NÓI / TÂM LÝ, một phe đã chủ động bỏ đi thì tuyệt đối KHÔNG liệt kê họ vào opponents, và để danh sách opponents rỗng.
   - Khi danh sách opponents rỗng thì hủy bỏ pendingcombat.
3. Tuân thủ Bối cảnh & Logic (Context Adherence):
   - KHÔNG tự ý thêm kẻ địch nếu bối cảnh hiện tại không cho phép (ví dụ: đang ở nơi an toàn, đang nói chuyện hòa bình, hoặc chỉ là hiểu lầm).
   - Nếu người chơi chỉ đang "thử chiêu" hoặc "tập luyện" với đồng đội, hãy xác định họ là Allies (Đồng minh) thay vì Opponents (Kẻ địch).
   - Kiểm tra kỹ xem NPC có lý do chính đáng để tấn công không (Dựa trên Thiện cảm và Bối cảnh truyện).
4. Phân loại phe phái:
   - Opponents (Kẻ địch): Những kẻ đang trực tiếp đe dọa, có ý đồ xấu hoặc chuẩn bị tấn công vật lý/sát thương.
   - Allies (Đồng minh): Những người đang trực tiếp hỗ trợ chiến đấu hoặc cùng phe với người chơi.
5. [QUANTITATIVE AUDIT - ĐỊNH LƯỢNG CƯỠNG BÁCH]:
   - Quét văn bản tìm các từ chỉ số lượng: "đôi/cặp" (2), "tứ" (4), "chục" (10), "tá" (12), "toán/nhóm" (5-8), "đám/đội" (8-12), "vài" (3-4)...
   - Nếu gặp kẻ địch/đồng minh số lượng đông (>=2) và cùng loại (VD: 5 tên cướp), KHÔNG liệt kê 5 lần. Thay vào đó, trả về một đối tượng đại diện và điền số lượng vào thuộc tính "quantity".
   - Nếu văn bản ghi "Năm tên thích khách", danh sách PHẢI có thuộc tính quantity: 5.
   - CHỈ tách riêng khi các nhân vật có tên riêng hoặc vai trò khác biệt rõ rệt (VD: "Đại ca" và "10 tên lính").

NHÂN VẬT CHÍNH HIỆN TẠI: ${currentPlayerName}
NHÂN VẬT TIỀN NHIỆM ĐÃ CHẾT: ${deceasedProtagonists.join(', ') || 'Không có'}

NPC ĐÃ BIẾT:
${npcList}

TRUYỆN GẦN ĐÂY:
"${previousNarration}"
"${currentNarration}"

YÊU CẦU ĐẦU RA XML:
Bạn BẮT BUỘC chỉ trả về khối dữ liệu XML bọc bởi thẻ <ket_qua_phan_tich_chien_dau>...</ket_qua_phan_tich_chien_dau>.
Không bọc thẻ markdown, không kèm giải thích bên ngoài.

Cấu trúc XML yêu cầu:
<ket_qua_phan_tich_chien_dau>
  <reasoning>Mô tả ngắn gọn: [Lý do chiến đấu]. Phe địch: [Danh sách]. Phe ta: [Danh sách].</reasoning>
  <winProbability>Con số tỷ lệ thắng từ 0 đến 100</winProbability>
  <opponents>
    <combatant>
      <id>ID_nhan_vat_neu_la_NPC_da_biet</id>
      <name>tên_hoặc_id_neu_la_yeu_thu_hoac_npc_moi</name>
      <quantity>Số lượng thực thể (ví dụ: 1 hoặc nhiều hơn nếu xuất hiện theo đàn/nhóm)</quantity>
      <isNew>true nếu là NPC/Yêu thú mới chưa có trong danh sách NPC ĐÃ BIẾT, ngược lại là false</isNew>
      <realm>Cảnh giới / Tu vi suy luận từ văn bản (VD: "Trúc Cơ Tầng 3", "Luyện Khí Tầng 8")</realm>
      <identityReasoning>Suy luận định danh & thân phận (VD: "Nhân vật áo xám sử dụng Ma Công, nghi là đệ tử Ma Tông")</identityReasoning>
      <race>Nhân Tộc / Yêu Tộc / Ma Tộc</race>
      <gender>Nam / Nữ / Không rõ</gender>
      <powerLevel>Sức mạnh ước lượng (Ví dụ: 1.0)</powerLevel>
      <description>Mô tả ngoại hình, trạng thái hoặc hành vi thù địch</description>
    </combatant>
  </opponents>
  <allies>
    <combatant>
      <id>ID_nhan_vat_neu_da_biet</id>
      <name>tên_hoặc_id</name>
      <quantity>1</quantity>
      <isNew>false</isNew>
      <realm>Cảnh giới / Tu vi suy luận</realm>
      <identityReasoning>Suy luận định danh & thân phận</identityReasoning>
      <race>Nhân Tộc / Yêu Tộc / Ma Tộc</race>
      <gender>Nam / Nữ / Không rõ</gender>
      <powerLevel>1.0</powerLevel>
      <description>Mô tả ngắn</description>
    </combatant>
  </allies>
</ket_qua_phan_tich_chien_dau>`;
};

