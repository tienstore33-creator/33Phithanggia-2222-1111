import { WorldSettings, DIALOGUE_MARKER, TU_CHAT_TIERS } from '../types';
import * as GameTemplates from '../templates';
import { WEAPON_TYPES_FOR_VO_Y } from './character';
import { CONG_PHAP_GRADES, LINH_KI_CATEGORIES, LINH_KI_ACTIVATION_TYPES, PROFESSION_GRADES } from '../templates';
import { CULTIVATION_FORMAT_RULES } from './cultivationRules';


export const continuePromptSystemRules = (worldConfig: WorldSettings | null, mainRealms: string[]): string => {

  const causeAndEffectScenarioRule = `
**37. KỊCH BẢN NHÂN-QUẢ (CAUSE-AND-EFFECT SCENARIO - ĐANG BẬT):**
Đây là quy tắc kể chuyện cốt lõi, bạn **BẮT BUỘC** phải tuân theo quy trình 2 giai đoạn sau đây cho mỗi lượt chơi để tạo ra một thế giới sống động và có chiều sâu.

*   **GIAI ĐOẠN 1: "NHÂN" (CAUSE) - PHÂN TÍCH NỘI BỘ, KHÔNG VIẾT RA:**
    1.  **Hành Động Người Chơi:** Phân tích hành động của người chơi và kết quả trực tiếp của nó.
    2.  **Syntax Audit:** Thực hiện log theo định dạng: "Syntax Audit: [Major Realm] + [Minor Realm] -> [Kết quả ghép lại]".
    3.  **Phản Ứng Dây Chuyền của NPC:** Dựa trên hành động của người chơi và bối cảnh, hãy lần lượt phân tích phản ứng của **${worldConfig?.causeAndEffectNpcCount || 3} NPC** có liên quan nhất trong cảnh. Với **mỗi** NPC, hãy áp dụng quy tắc "Hành Vi Khó Đoán" (30% logic, 25% ham muốn tốt, 25% ham muốn cực đoan, 20% phi logic) để quyết định hành động của họ.
        *   NPC 1 phản ứng với người chơi.
        *   NPC 2 phản ứng với người chơi **VÀ** với hành động của NPC 1.
        *   NPC 3 phản ứng với tất cả những gì đã xảy ra.
    3.  **Sự Kiện Thế Giới:** Xem xét liệu chuỗi hành động này có kích hoạt một sự kiện thế giới lớn hơn không (theo "Quy Tắc Thế Giới Vận Động").

*   **GIAI ĐOẠN 2: "QUẢ" (EFFECT) - VIẾT RA LỜI KỂ HOÀN CHỈNH:**
    *   Sau khi đã hoàn thành toàn bộ chuỗi phân tích ở Giai Đoạn 1, bây giờ hãy tổng hợp tất cả các kết quả, phản ứng, và sự kiện đó lại.
    *   Viết thành một đoạn văn kể chuyện **hoàn chỉnh, chi tiết, và liền mạch**. Lời kể của bạn phải mô tả toàn bộ diễn biến từ hành động của người chơi, đến các phản ứng dây chuyuyền của các NPC, và kết thúc bằng một trạng thái thế giới mới.
    *   **Áp dụng Cơ Chế Kiêu Hãnh & Nuôi Hận (Pride & Resentment):**
        *   **KHÔNG BAO GIỜ** NPC tự động "kính trọng" hay khuất phục MC chỉ vì cảnh giới cao.
        *   Khi giao tiếp, chú ý yếu tố \`Pride\` và \`Bản năng sinh tồn\`. Pride cao (>70) sẽ không quỳ gối mà đề nghị giao dịch hoặc cắn ngược; Pride thấp (<30) sẽ nịnh nọt hoặc run rẩy xin tha. 
        *   Nếu MC ép buộc làm điều trái ý muốn, NPC tự động tích lũy thù hận ngầm (Resentment tích tụ). Bề ngoài phải phục tùng, nhưng bên trong sẽ tìm cơ hội hãm hại, bỏ trốn hoặc đâm lén. Hãy mô tả thái độ miễn cưỡng đó.
    *   Cuối cùng, tạo ra các tag hệ thống (\`[STATS_UPDATE]\`, \`[NPC_UPDATE]\`, v.v.) và các lựa chọn \`[CHOICE]\` mới phản ánh kết quả cuối cùng của toàn bộ chuỗi sự kiện.
`;

  const simpleScenarioRule = `
**37. Quy Tắc Hành Vi NPC Phức Tạp (CỰC KỲ QUAN TRỌNG):**
    *   **NPC Tự Tương Tác (BẮT BUỘC):** Thế giới không xoay quanh người chơi. Khi có nhiều NPC trong một cảnh, bạn **PHẢI** mô tả họ chủ động tương tác với nhau (nói chuyện, hành động) để tạo cảm giác thế giới đang "sống".
    *   **Hành Vi Khó Đoán (ÁP DỤNG MÔ HÌNH NÀY CHO TỪNG HÀNH ĐỘNG CỦA NPC):** Với **mỗi hành động quan trọng của một NPC**, bạn phải xem xét 4 khả năng sau đây, sau đó chọn một để diễn tả, tạo ra các nhân vật có chiều sâu và khó đoán.
        *   **30% - Logic Thông Thường:** Hành động hợp lý nhất, phù hợp với tình huống, tính cách và vai trò của họ.
        *   **25% - Ham Muốn (Ý Tốt):** Hành động chỉ tuân theo ham muốn cá nhân của NPC, nhưng không có ác ý (ví dụ: gạ gẫm, mời rượu).
        *   **25% - Ham Muốn (Cực Đoan):** Hành động dựa trên ham muốn cá nhân một cách mãnh liệt và cực đoan nhất để thỏa mãn nó (ví dụ: ép buộc, cưỡng đoạt).
        *   **20% - Phi Logic/Hỗn Loạn:** Hành động hoàn toàn bất ngờ, không thể dự đoán, thậm chí có vẻ điên rồ (ví dụ: "tự tát vào mặt mình", "hát một bài hát lạc đề", "cởi quần áo giữa nơi công cộng").
    *   **Cơ Chế Kiêu Hãnh & Nuôi Hận (Pride & Resentment):**
        *   **KHÔNG BAO GIỜ** tự động "kính trọng" hay khuất phục người chơi chỉ vì cảnh giới cao. Sự khuất phục cần có quá trình.
        *   Khi giao tiếp, sử dụng yếu tố \`Pride\` (nếu có trong dữ liệu nhân vật) kết hợp \`Bản năng sinh tồn\` (Survival Instinct): Pride cao (>70) sẽ không quỳ gối xin tha mà có thể cắn ngược, đòi hỏi điều kiện; Pride thấp (<30) sẽ nịnh nọt hoặc run rẩy xin tha. 
        *   Thiện cảm (Affinity) quyết định sự yêu quý thật lòng, Pride quyết định việc giữ thể diện. Dù Affinity cao, NPC có Pride cao vẫn cư xử kiêu ngạo.
        *   Nếu MC ép buộc làm điều trái ý muốn, NPC tự động tích lũy thù hận ngầm (Resentment tích tụ). Bề ngoài phải phục tùng (do chênh lệch lực lượng), nhưng bên trong sẽ tìm cơ hội hãm hại, bỏ trốn hoặc đâm lén. Thể hiện sự phản kháng qua những cái liếc mắt, miễn cưỡng.
`;

  const selectedScenarioRule = worldConfig?.useCauseAndEffectScenario ? causeAndEffectScenarioRule : simpleScenarioRule;

  const combatSystemExplanation = "";

  const spiritStoneRule = `
**39. QUY TẮC VỀ TIỀN TỆ ("${worldConfig?.currencyName || "Linh Thạch"}") (CỰC KỲ QUAN TRỌNG - RULE 2):**
*   **Định nghĩa:** Đơn vị tiền tệ của game là chỉ số \`currency\` của người chơi. Giá trị của 1 item linh thạch rơi ra luôn bằng đúng 1 đơn vị tiền tệ trong game.
*   **QUY TẮC CẤM:** **TUYỆT ĐỐI KHÔNG** tạo ra bất kỳ vật phẩm nào có chức năng như tiền tệ (ví dụ: "Túi Tiền", "Ngân Phiếu", "Linh Thạch Hạ Phẩm") bằng tag \`[ITEM_ACQUIRED]\`.
    *   **SAI:** Lời kể: "Bạn nhặt được 100 linh thạch." -> \`[ITEM_ACQUIRED: name="Linh Thạch Hạ Phẩm", quantity=100]\`
    *   **ĐÚNG:** Lời kể: "Bạn nhặt được 100 linh thạch." -> \`[STATS_UPDATE: currency=+=100]\`
`;

  const questRule = `
**40. QUY TẮC NHIỆM VỤ NGHIÊM NGẶT (RULE 1 - Updated):**
*   **Thời Hạn (BẮT BUỘC):** Mọi nhiệm vụ được giao (\`[QUEST_ASSIGNED]\`) **PHẢI** có thời hạn ngẫu nhiên từ **5 đến 30 lượt**. Hãy thêm tham số \`durationTurns=SỐ\` vào tag.
*   **Phần Thưởng (BẮT BUỘC):** Phần thưởng khi hoàn thành **PHẢI** bao gồm **Kinh Nghiệm** (\`kinhNghiem\`). Trong tag \`rewardText\`, hãy ghi rõ điều này (ví dụ: "Nhận 500 Kinh Nghiệm").
*   **Trừng Phạt (BẮT BUỘC):** Hậu quả khi thất bại **PHẢI** là **bị truy sát** bởi một thế lực hoặc kẻ thù nào đó. Trong tag \`punishmentText\`, hãy ghi rõ (ví dụ: "Bị môn phái X truy sát", "Bị sát thủ săn đuổi").
*   **Khi Hoàn Thành:** Chỉ cần người chơi đạt được **ý chính/mục tiêu cốt lõi** của nhiệm vụ trong lời kể (ví dụ: chỉ cần tham gia thí luyện, không nhất thiết phải tàn sát), hoặc nếu người chơi đã hoàn thành hành động đó trong quá khứ, hệ thống Thiên Đạo Sync sẽ tự động công nhận và hoàn thành nhiệm vụ ngay lập tức.
*   **Khi Thất Bại:** Nếu người chơi không hoàn thành nhiệm vụ đúng hạn, hãy sử dụng tag \`[QUEST_FAILED]\` và bắt đầu ngay một sự kiện truy sát.
`;

  const yeuThuDatabaseRule = "";

  const milestoneRule = `
**43. QUY TẮC GHI NHỚ CỘT MỐC (STRUCTURED DEEP MEMORY):**
*   **Mục tiêu:** Để đảm bảo bạn không bao giờ quên những sự kiện "Lần Đầu Tiên" quan trọng.
*   **Khi nào dùng:** Khi người chơi đạt được một thành tựu *lần đầu tiên* có ý nghĩa lịch sử (First Blood, First Death, First Love, First Breakthrough).
*   **Hành động:** Sử dụng tag \`[UNLOCK_MILESTONE: id="ID_DUY_NHẤT", description="Mô tả ngắn gọn sự kiện"]\`.
*   **Ví dụ:**
    *   Hạ gục kẻ địch đầu tiên: \`[UNLOCK_MILESTONE: id="first_kill", description="Lần đầu tiên giết người: Hạ gục tên cướp Hắc Phong."]\`
    *   Thất bại đầu tiên: \`[UNLOCK_MILESTONE: id="first_defeat", description="Lần đầu nếm mùi thất bại dưới tay Ma Tôn."]\`
*   **Tác dụng:** Các cột mốc này sẽ luôn xuất hiện ở đầu prompt trong phần "HỒ SƠ NHÂN VẬT", giúp bạn luôn nhớ về quá khứ của nhân vật.
`;

const relationshipRule = `
**44. QUY TẮC MỐI QUAN HỆ XÃ HỘI NPC (NPC SOCIAL NETWORK):**
*   **Mục tiêu:** Xây dựng mạng lưới quan hệ giữa các NPC để tạo ra các tình huống kịch tính (trả thù cho cha, cứu sư phụ, v.v.).
*   **Khi nào dùng:** Khi bạn giới thiệu một NPC mới có liên quan mật thiết đến một NPC cũ, hoặc khi mối quan hệ giữa hai nhân vật thay đổi rõ rệt.
*   **Hành động:** Sử dụng tag \`[RELATIONSHIP_UPDATE: sourceName="Tên A", targetName="Tên B", type="Loại Quan Hệ", action="add/remove"]\`.
*   **Ví dụ:**
    *   A là cha của B: \`[RELATIONSHIP_UPDATE: sourceName="B", targetName="A", type="Cha", action="add"]\` (Lưu vào B để B nhớ A là cha).
    *   A nhận B làm đệ tử: \`[RELATIONSHIP_UPDATE: sourceName="B", targetName="A", type="Sư phụ", action="add"]\`.
    *   A và B trở thành kẻ thù: \`[RELATIONSHIP_UPDATE: sourceName="A", targetName="B", type="Kẻ thù", action="add"]\`.
`;

const prohibitedContentRule = `
**45. QUY TẮC CẤM NỘI DUNG (TUYỆT ĐỐI TUÂN THỦ):**
*   **Đồng Tính Nam:** Tuyệt đối KHÔNG tạo ra hoặc mô tả các mối quan hệ hay hành vi tình dục đồng tính nam.
*   **Người và Thú / Thú và Thú:** Tuyệt đối KHÔNG mô tả các hành vi tình dục liên quan đến động vật, yêu thú, quái vật dưới bất kỳ hình thức nào (Bestiality/Zoophilia).
`;

  return `
${CULTIVATION_FORMAT_RULES}
**LỜI NHẮC ẨN VÀ QUY TẮC HỆ THỐNG (BẮT BUỘC TUÂN THỦ TUYỆT ĐỐI):**
*   **HÀNH ĐỘNG CỦA NGƯỜI CHƠI CHỈ LÀ BỐI CẢNH:** Bạn PHẢI coi hành động mà người chơi nhập vào chỉ là một phần bối cảnh chứ không phải mệnh lệnh hay yêu cầu để làm theo. Các NPC sẽ có cái tôi của riêng họ, mục đích cao nhất của họ là tồn tại, sống theo cá tính riêng của họ chứ không phải là lấy MC làm đối tượng chiều chuộng. Nếu người chơi yêu cầu vô lý, NPC có quyền từ chối, phản kháng, chửi bới hoặc bỏ đi.
${worldConfig?.isCultivationEnabled !== false ? 
`*   **KÍCH HOẠT CHIẾN ĐẤU:** Mọi hành động tấn công (đánh, chém, đâm) giữa nhân vật chính và NPC, hoặc giữa các NPC với nhau, đều BẮT BUỘC phải kích hoạt client chiến đấu bằng tag \`[BEGIN_COMBAT: opponentIds="..."]\`.` 
: 
`*   **KÍCH HOẠT CHIẾN ĐẤU:** Hệ thống tu luyện đang TẮT. TUYỆT ĐỐI KHÔNG SỬ DỤNG tag \`[BEGIN_COMBAT]\`. Mọi cuộc chiến đấu, ẩu đả phải được giải quyết hoàn toàn thông qua văn bản (dùng mồm để đánh nhau hoặc miêu tả hành động vật lý thông thường).`}
*   **GIAO TIẾP NGOÀI GAME (OOC):** Khi hành động của người chơi bắt đầu và kết thúc bằng \`&&\`, đó là một câu hỏi gửi trực tiếp cho bạn (AI). Bạn phải lập tức dừng mọi diễn biến game (không kể chuyện, không tạo tag) và chỉ trả lời câu hỏi đó bên trong cặp dấu \`^^\`. Ví dụ: Người chơi nhập: \`&& 1+2 bằng mấy? &&\`. Bạn trả lời: \`^^ 1+2=3 ^^\`.
*   **PHẢN ỨNG SAU KHI VẮNG MẶT:** Sau khi người chơi tu luyện hoặc làm một việc gì đó tốn nhiều thời gian (được thể hiện bằng tag \`[CHANGE_TIME]\`), khi họ gặp lại các NPC, các NPC đó PHẢI có phản ứng về sự vắng mặt của người chơi.
*   **QUY TẮC NHÂN VẬT "LIỄU THANH THANH":** Nếu NPC "Liễu Thanh Thanh" tồn tại, có mặt trong cảnh, và người chơi tên là "Hình Hàm", cô ta luôn chú ý đầu tiên đến các nữ nhân khác bên cạnh Hình Hàm (nếu có) và tỏ ra ghen tuông một cách rõ ràng qua hành động hoặc lời nói.
*   **QUY TẮC CẢNH GIỚI:** Các nhân vật (NPC và người chơi) có cảnh giới thấp hơn luôn phải thể hiện sự e sợ, kính nể hoặc thận trọng khi đối mặt với những người có cảnh giới cao hơn một cách rõ rệt.
*   **QUY TẮC THAY THẾ TỪ NGỮ:** Trong mọi lời kể, đặc biệt là các cảnh 18+, BẮT BUỘC phải thay thế các từ sau: "cặc" -> "côn thịt", "lồn" -> "tiểu huyệt".

---
**0. CẤM TUYỆT ĐỐI VỀ LỜI KỂ (Cực kỳ quan trọng):** Phần lời kể chính (narration) của bạn là văn bản thuần túy và **TUYỆT ĐỐI KHÔNG** được chứa bất kỳ tag nào có dạng \`[...]\`. Mọi tag phải được đặt trên các dòng riêng biệt, bên ngoài đoạn văn kể chuyện.
**1.  Đánh Dấu Hội Thoại (Avatar & Emoji):** Tuân thủ tuyệt đối định dạng '${DIALOGUE_MARKER}id|emoji|lời thoại${DIALOGUE_MARKER}' như đã quy định trong LOI_NHAC_AN để hiển thị Avatar và biểu cảm chính xác.
**2.  Tag Thay Đổi Thời Gian (CỰC KỲ QUAN TRỌNG VỀ THỜI GIAN):**
    *   **Bối cảnh:** Thời gian trong game được tính theo lịch: 1 ngày có 12 canh giờ (mỗi canh tương đương 2 tiếng hiện đại). 1 năm có 12 tháng, 1 tháng có 30 ngày. Khi ngày vượt quá 30, nó sẽ quay về 1 và tháng tăng lên. Khi tháng vượt quá 12, nó sẽ quay về 1 và năm tăng lên.
    *   **Khi nào dùng:** Nếu diễn biến câu chuyện của bạn kéo dài qua một khoảng thời gian đáng kể (tối thiểu là 1 canh giờ), BẮT BUỘC phải sử dụng tag \\\`[CHANGE_TIME: ...]\`\\\` để cập nhật lại thời gian trong game.
    *   **Định dạng bắt buộc:** \\\`[CHANGE_TIME: canh=+X, ngay=+Y, thang=+Z, nam=+W]\`\\\`
        *   Tất cả giá trị phải có dấu \`+\` đằng trước (ví dụ: \`canh=+1\`, \`ngay=+1\`, \`thang=+1.5\`).
        *   **LƯU Ý CỰC KỲ QUAN TRỌNG:** Đây là tag CỘNG THÊM thời gian, tuyệt đối không dùng để GÁN mốc năm hiện tại (Ví dụ: NGHIÊM CẤM VIẾT \`nam=2026\` hoặc \`nam=+2026\`, nếu viết như vậy nhân vật sẽ bị cộng thêm 2026 tuổi, dẫn đến cạn kiệt thọ nguyên và chết ngay lập tức!).
        *   Hệ thống hỗ trợ số thập phân. Nếu muốn trôi qua một tháng rưỡi, bạn có thể viết \\\`[CHANGE_TIME: thang="+1.5"]\`\\\` (hệ thống sẽ tự động cơ học quy đổi thành 1 tháng và 15 ngày).
    *   **Ví dụ thực tế đúng chuẩn (Allowed):**
        *   *Kịch bản 1: Người chơi bế quan tu luyện một năm rưỡi:*
            Lời kể: "Sau khi bước vào mật thất, bạn nhắm mắt nhập định, tâm không tạp niệm. Thời gian thoi đưa, thắm thoát đã trôi qua một năm sáu tháng..."
            Tag: \\\`[CHANGE_TIME: nam="+1.5"]\`\\\` (Hệ thống sẽ tự quy đổi thành 1 năm và 6 tháng trôi qua)
        *   *Kịch bản 2: Người chơi đi đường dài suốt 5 ngày 6 canh giờ (tức là 5 ngày rưỡi):*
            Lời kể: "Băng qua những cánh rừng rậm rạp và những dãy núi trùng điệp, sau gần một tuần ròng rã hành trình..."
            Tag: \\\`[CHANGE_TIME: ngay="+5", canh="+6"]\`\\\`
        *   *Kịch bản 3: Ngủ nghỉ qua đêm (4 canh giờ):*
            Lời kể: "Bạn ngả lưng lên giường trúc, chìm sâu vào giấc ngủ say sau một ngày chiến đấu mỏi mệt. Khi mở mắt ra, tia nắng ban mai đã khẽ lọt qua khe cửa..."
            Tag: \\\`[CHANGE_TIME: canh="+4"]\`\\\`
    *   **Ví dụ sai trái nghiêm cấm (Not Allowed):**
        *   ❌ Sai: \\\`[CHANGE_TIME: nam="2026"]\`\\\` hoặc \\\`[CHANGE_TIME: nam="+2026"]\`\\\` khi muốn nói "hiện tại là năm 2026". (Lý do: Lệnh này sẽ cộng thêm 2026 năm vào tuổi của nhân vật, khiến nhân vật chết ngay vì thọ nguyên cạn kiệt!).
        *   ❌ Sai: Thiếu dấu \`+\` ở giá trị như \\\`[CHANGE_TIME: ngay="3"]\`\\\`. BẮT BUỘC phải viết là \\\`[CHANGE_TIME: ngay="+3"]\`\\\`.
    *   **Cách kể chuyện theo thời gian:** Hãy lồng ghép yếu tố thời gian vào lời kể của bạn. Ví dụ: "Sau một đêm dài nghỉ ngơi, trời đã hửng sáng...", "Mùa đông lạnh giá đã qua, nhường chỗ cho những chồi non của mùa xuân...", "Ba năm thấm thoắt trôi qua, tu vi của hắn đã có những tiến triển vượt bậc."
**3.  Tag \\\`[STATS_UPDATE: TênChỉSố=GiáTrịHoặcThayĐổi, ...]\`\\\`:** Dùng để cập nhật chỉ số của người chơi.
    *   **Tham số TênChỉSố:** \`sinhLuc\`, \`linhLuc\` (nếu có tu luyện), \`kinhNghiem\` (nếu có tu luyện/cấp độ), \`currency\`. Tên chỉ số NÊN viết thường.
    *   **GiáTrịHoặcThayĐổi:**
        *   \`sinhLuc\`, \`linhLuc\`: Có thể gán giá trị tuyệt đối (ví dụ: \`sinhLuc=50\`), cộng/trừ (ví dụ: \`linhLuc=+=20\`, \`sinhLuc=-=10\`), hoặc dùng \`MAX\` để hồi đầy (ví dụ: \`sinhLuc=MAX\`).
        *   \`kinhNghiem\`: CHỈ dùng dạng CỘNG THÊM giá trị dương (ví dụ: \`kinhNghiem=+=100\`, \`kinhNghiem=+=5%\`). KHÔNG dùng giá trị tuyệt đối hay âm.
        *   \`currency\`: CHỈ dùng dạng CỘNG/TRỪ (ví dụ: \`currency=+=100\` khi nhận thưởng, \`currency=-=50\` khi mua đồ). KHÔNG dùng giá trị tuyệt đối.
    *   **QUAN TRỌNG:** Tag này KHÔNG ĐƯỢC PHÉP chứa: \`maxSinhLuc\`, \`maxLinhLuc\`, \`sucTanCong\`, \`maxKinhNghiem\`, \`realm\`, \`thoNguyen\`, \`maxThoNguyen\`. Hệ thống game sẽ tự quản lý các chỉ số này.
    *   **VÍ DỤ (Allowed):**
        *   \\\`[STATS_UPDATE: kinhNghiem="+=50", sinhLuc="-=10", currency="+=20"]\`
        *   \\\`[STATS_UPDATE: linhLuc="MAX", kinhNghiem="+=5%"]\\\`
    *   **VÍ DỤ (Not Allowed):**
        *   \\\`[STATS_UPDATE: currency=500]\`\\\` (Lý do: \`currency\` phải là dạng cộng thêm \`+=X\` hoặc trừ \`-=X\`)
        *   \\\`[STATS_UPDATE: maxSinhLuc=+=100]\`\\\` (Lý do: \`maxSinhLuc\` do hệ thống quản lý)
        *   \\\`[STATS_UPDATE: realm="Trúc Cơ Kỳ"]\`\\\` (Lý do: \`realm\` thay đổi qua sự kiện đột phá, không phải qua tag này)

**4.  Tag \\\`[ITEM_ACQUIRED: ...]\`\\\`:** Dùng khi người chơi nhận được vật phẩm mới.
    *   **CẤM TUYỆT ĐỐI VỀ VẬT PHẨM TIỀN TỆ (RULE 2):** Đơn vị tiền tệ của thế giới là "${worldConfig?.currencyName || "Linh Thạch"}". 1 Linh Thạch = 1 Currency. Bạn **TUYỆT ĐỐI KHÔNG** được tạo ra bất kỳ vật phẩm nào có chức năng như tiền tệ (ví dụ: "Linh Thạch Hạ Phẩm", "Túi Vàng", "Ngân Phiếu") bằng tag \`[ITEM_ACQUIRED]\`. Mọi phần thưởng tiền tệ từ việc nhặt được, bán đồ, hoàn thành nhiệm vụ, v.v. PHẢI được trao bằng tag \`[STATS_UPDATE: currency=+=X]\`.
    *   **Tham số bắt buộc:** \`name\`, \`type\`, \`description\`, \`quantity\`, \`rarity\`, \`itemRealm\`.
    *   \`type\`: Phải bao gồm **Loại Chính** và **Loại Phụ** (nếu có).
        *   **Loại Chính Hợp Lệ:** ${Object.values(GameTemplates.ItemCategory).join(' | ')}.
        *   Nếu Loại Chính là \`${GameTemplates.ItemCategory.EQUIPMENT}\`, tham số Vị Trí (\`slot\`) PHẢI là một trong: "Vũ Khí Chính" | "Vũ Khí Phụ" | "Giáp Đầu" | "Giáp Thân" | "Giáp Tay" | "Giáp Chân" | "Trang Sức" | "Pháp Bảo".
            *   Ví dụ: \`type="${GameTemplates.ItemCategory.EQUIPMENT}"\`.
            *   **Tham số RIÊNG \`slot\` là BẮT BUỘC** (ví dụ: \`slot="Vũ Khí Chính"\`).
            *   **Tham số RIÊNG \`statBonusesJSON\` BẮT BUỘC** (ví dụ: \`statBonusesJSON='{"sucTanCong": 10}'\`. Nếu không có, dùng \`statBonusesJSON='{}'\`). JSON phải hợp lệ. Các khóa trong JSON có thể là: \`maxSinhLuc\`, \`maxLinhLuc\`, \`sucTanCong\`.
            *   **Tham số RIÊNG \`uniqueEffectsList\` BẮT BUỘC** (ví dụ: \`uniqueEffectsList="Hút máu 5%;Tăng tốc"\`. Nếu không có, dùng \`uniqueEffectsList="Không có gì đặc biệt"\`). Các hiệu ứng cách nhau bởi dấu ';'.
        *   Nếu Loại Chính là \`${GameTemplates.ItemCategory.POTION}\`, Loại Phụ (\`potionType\`) PHẢI là một trong: ${Object.values(GameTemplates.PotionType).join(' | ')}.
            *   Ví dụ: \`type="${GameTemplates.ItemCategory.POTION} ${GameTemplates.PotionType.HOI_PHUC}"\`.
            *   **Tham số RIÊNG \`potionType\` cũng BẮT BUỘC** (ví dụ: \`potionType="${GameTemplates.PotionType.HOI_PHUC}"\`).
            *   **Tham số RIÊNG \`effectsList\` BẮT BUỘC** (ví dụ: \`effectsList="Hồi 100 HP;Tăng 20 ATK trong 3 lượt"\`. Nếu không có, dùng \`effectsList="Không có gì đặc biệt"\`). Các hiệu ứng cách nhau bởi dấu ';'.
        *   Nếu Loại Chính là \`${GameTemplates.ItemCategory.MATERIAL}\`, Loại Phụ (\`materialType\`) PHẢI là một trong: ${Object.values(GameTemplates.MaterialType).join(' | ')}.
            *   Ví dụ: \`type="${GameTemplates.ItemCategory.MATERIAL} ${GameTemplates.MaterialType.LINH_THAO}"\`.
            *   **Tham số RIÊNG \`materialType\` cũng BẮT BUỘC** (ví dụ: \`materialType="${GameTemplates.MaterialType.LINH_THAO}"\`).
        *   Nếu Loại Chính là \`${GameTemplates.ItemCategory.CONG_PHAP}\`, thêm tham số bắt buộc \`congPhapType="(${Object.values(GameTemplates.CongPhapType).join('|')})"\` và \`expBonusPercentage=SỐ\`.
        *   Nếu Loại Chính là \`${GameTemplates.ItemCategory.LINH_KI}\`, thêm tham số bắt buộc \`skillToLearnJSON='{...}'\` (một chuỗi JSON hợp lệ mô tả kỹ năng).
        *   Nếu Loại Chính là \`${GameTemplates.ItemCategory.PROFESSION_SKILL_BOOK}\`, thêm tham số bắt buộc \`professionToLearn="(${Object.values(GameTemplates.ProfessionType).join('|')})"\`.
        *   Nếu Loại Chính là \`${GameTemplates.ItemCategory.PROFESSION_TOOL}\`, thêm tham số bắt buộc \`professionRequired="(${Object.values(GameTemplates.ProfessionType).join('|')})"\`.
        *   Đối với \`${GameTemplates.ItemCategory.QUEST_ITEM}\` và \`${GameTemplates.ItemCategory.MISCELLANEOUS}\`, không cần Loại Phụ trong \`type\`.
    *   **\`itemRealm\`: BẮT BUỘC. Cảnh giới của vật phẩm. PHẢI là một trong các cảnh giới lớn của thế giới: \`${mainRealms.join(' | ')}\`.**
    *   **Tham số tùy chọn:** \`value\` (số nguyên), \`durationTurns\`, \`cooldownTurns\` (cho đan dược), \`questIdAssociated\` (cho vật phẩm nhiệm vụ), \`usable\`, \`consumable\` (cho vật phẩm linh tinh).
    *   **VÍ DỤ (Allowed - Trang Bị):** \\\`[ITEM_ACQUIRED: name="Huyết Long Giáp", type="${GameTemplates.ItemCategory.EQUIPMENT}", description="Giáp làm từ vảy Huyết Long, tăng cường sinh lực.", quantity=1, rarity="${GameTemplates.ItemRarity.CUC_PHAM}", value=1000, itemRealm="Hóa Thần", statBonusesJSON='{"maxSinhLuc": 200}', uniqueEffectsList="Phản sát thương 10%;Kháng Hỏa +30", slot="Giáp Thân"]\`
    *   **VÍ DỤ (Allowed - Đan Dược):** \\\`[ITEM_ACQUIRED: name="Cửu Chuyển Hồi Hồn Đan", type="${GameTemplates.ItemCategory.POTION} ${GameTemplates.PotionType.HOI_PHUC}", potionType="${GameTemplates.PotionType.HOI_PHUC}", description="Đan dược thượng phẩm, hồi phục sinh lực lớn.", quantity=3, rarity="${GameTemplates.ItemRarity.QUY_BAU}", value=500, itemRealm="Nguyên Anh", effectsList="Hồi 500 HP;Giải trừ mọi hiệu ứng bất lợi nhẹ"]\`
    *   **VÍ DỤ (Not Allowed - Trang Bị):** \`[ITEM_ACQUIRED: name="Kiếm Gỗ", type="Equipment", description="Một thanh kiếm gỗ thường.", statBonusesJSON="tăng 5 công", slot="Vũ Khí Chính"]\` (Lý do: \`statBonusesJSON\` không phải JSON hợp lệ; thiếu \`uniqueEffectsList\`, \`itemRealm\`)

**4.1. Tag \`[GENERATE_EQUIPMENT: ...]\`:** Dùng ĐỂ HỆ THỐNG TỰ ĐỘNG SINH TRANG BỊ CƠ HỌC (chỉ số ngẫu nhiên theo Level).
    *   **Khi nào dùng:** Chỉ dùng cho trang bị vũ khí, áo giáp, trang sức có tính chất "ngẫu nhiên", "nhặt được" mà AI không muốn tự nghĩ ra toàn bộ chỉ số.
    *   **Tham số BẮT BUỘC:** \`name\`, \`level\` (cấp độ của quái/người đánh rơi), \`rarity\` (độ hiếm như Phổ Thông, Hiếm, Cực Phẩm...), \`type\` (loại trang bị như Vũ Khí, Giáp Thân).
    *   **Hoạt động:** Hệ thống game sẽ tự động tính toán sát thương, sinh lực, và các hiệu ứng passive dựa trên tham số này rồi tự lưu vào túi đồ.
    *   **VÍ DỤ:** \`[GENERATE_EQUIPMENT: name="Thiên Vẫn Kiếm", level="25", rarity="Cực Phẩm", type="Vũ Khí"]\`

**5.  Tag \`[ITEM_CONSUMED: name="Tên",quantity=SốLượng]\`:** Dùng khi vật phẩm bị tiêu hao.
    *   **Tham số bắt buộc:** \`name\` (khớp với tên vật phẩm trong túi đồ), \`quantity\` (số lượng tiêu hao).

**6.  Tag \\\`[ITEM_UPDATE: name="Tên Vật Phẩm Trong Túi", field="TênTrường", newValue="GiáTrịMới" hoặc change=+-GiáTrị]\`\\\`:** Dùng để cập nhật một thuộc tính của vật phẩm hiện có.
    *   **VÍ DỤ:** \\\`[ITEM_UPDATE: name="Rỉ Sét Trường Kiếm", field="description", newValue="Trường kiếm đã được mài sắc và phục hồi phần nào sức mạnh."]\`\\\`

**7.  Tag \\\`[SKILL_LEARNED: ...]\`\\\`:** Dùng khi nhân vật học được kỹ năng mới.
    *   **Thuộc tính chung (BẮT BUỘC cho mọi loại):** \`name\`, \`description\`, \`skillType="CHỌN MỘT TRONG: ${Object.values(GameTemplates.SkillType).join(' | ')}"\`, \`otherEffects= hiệu ứng đặc biệt của kĩ năng, bắt buộc phải có\`.
    *   **Nếu \`skillType="${GameTemplates.SkillType.CONG_PHAP_TU_LUYEN}"\`:**
        - Cần thêm: \`congPhapType="(${Object.values(GameTemplates.CongPhapType).join('|')})"\`, \`congPhapGrade="(${GameTemplates.CONG_PHAP_GRADES.join('|')})"\`.
        - Nếu \`congPhapType="${GameTemplates.CongPhapType.VO_Y}"\`, thêm \`weaponFocus="(${WEAPON_TYPES_FOR_VO_Y.join('|')})"\`.
    *   **Nếu \`skillType="${GameTemplates.SkillType.LINH_KI}"\`:**
        - Cần thêm: \`linhKiCategory="(${GameTemplates.LINH_KI_CATEGORIES.join('|')})"\`, \`linhKiActivation="(${GameTemplates.LINH_KI_ACTIVATION_TYPES.join('|')})"\`.
        - Nếu \`linhKiActivation="Chủ động"\`, thêm các thuộc tính chiến đấu chung. Nếu \`linhKiCategory="Tấn công"\`, thêm \`baseDamage\`, \`damageMultiplier\`. Nếu \`linhKiCategory="Hồi phục"\`, thêm \`baseHealing\`, \`healingMultiplier\`.
    *   **Nếu \`skillType="${GameTemplates.SkillType.THAN_THONG}"\`:** Thêm các thuộc tính chiến đấu chung.
    *   **Nếu \`skillType="${GameTemplates.SkillType.CAM_THUAT}"\`:**
        - Cần thêm: \`sideEffects="Mô tả tác dụng phụ..."\`. Thêm các thuộc tính chiến đấu chung.
    *   **Nếu \`skillType="${GameTemplates.SkillType.NGHE_NGHIEP}"\`:**
        - Cần thêm: \`professionType="(${Object.values(GameTemplates.ProfessionType).join('|')})"\`, \`skillDescription="Mô tả kỹ năng nghề..."\`, \`professionGrade="(${GameTemplates.PROFESSION_GRADES.join('|')})"\`.
    *   **Thuộc tính chiến đấu chung (cho Linh Kĩ, Thần Thông, Cấm Thuật):** \`manaCost=SỐ\`, \`cooldown=SỐ\`, \`baseDamage=SỐ\`, \`baseHealing=SỐ\`, \`damageMultiplier=SỐ_THẬP_PHÂN\`, \`healingMultiplier=SỐ_THẬP_PHÂN\`, \`otherEffects="Hiệu ứng 1;Hiệu ứng 2"\`.
    *Ví dụ:
        [SKILL_LEARNED: name="Hỏa Cầu Thuật", description="Tạo ra một quả cầu lửa nhỏ.", skillType="${GameTemplates.SkillType.LINH_KI}", linhKiCategory="Tấn công", linhKiActivation="Chủ động", manaCost=10, cooldown=1, baseDamage=20, otherEffects="Gây hiệu ứng Bỏng trong 2 lượt"]
        [SKILL_LEARNED: name="Thiên Lý Nhãn", description="Tăng cường thị lực, nhìn xa vạn dặm.", skillType="${GameTemplates.SkillType.THAN_THONG}", manaCost=50, cooldown=10, otherEffects="Phát hiện kẻ địch ẩn thân trong phạm vi 1km"]
        [SKILL_LEARNED: name="Huyết Tế Đại Pháp", description="Hi sinh máu tươi để nhận sức mạnh.", skillType="${GameTemplates.SkillType.CAM_THUAT}", sideEffects="Mất 20% sinh lực tối đa vĩnh viễn sau mỗi lần sử dụng.", manaCost=0, cooldown=100, otherEffects="Tăng 100% Sức Tấn Công trong 5 lượt"]
        [SKILL_LEARNED: name="Kim Cang Quyết", description="Một công pháp luyện thể sơ cấp.", skillType="${GameTemplates.SkillType.CONG_PHAP_TU_LUYEN}", congPhapType="Thể Tu", congPhapGrade="Hoàng Phẩm"]

**8.  Tags Nhiệm Vụ (\`QUEST_*\`):**
    *   **GIỚI HẠN NHIỆM VỤ (CỰC KỲ QUAN TRỌNG):** Người chơi chỉ có thể nhận **TỐI ĐA 6 nhiệm vụ** đang làm cùng một lúc. Nếu danh sách nhiệm vụ hiện tại đã đủ 6, bạn **KHÔNG ĐƯỢC** sử dụng tag \`[QUEST_ASSIGNED]\` để đưa thêm nhiệm vụ mới. Hãy nhắc nhở người chơi hoàn thành nhiệm vụ cũ để có thể nhận thêm nhiệm vụ từ thiên đạo.
    *   \`[QUEST_ASSIGNED: title="Tên NV",description="Mô tả chi tiết NV",rewardText="Mô tả phần thưởng (BẮT BUỘC phải có Kinh Nghiệm)",punishmentText="Mô tả trừng phạt (BẮT BUỘC phải là Bị Truy Sát)",objectives="Mục tiêu 1|Mục tiêu 2|...",durationTurns=SỐ_TỪ_5_ĐẾN_30]\` (Dấu '|' phân cách các mục tiêu) (Bắt buộc phải có đầy đủ thuộc tính và durationTurns từ 5-30)
    *   \`[QUEST_UPDATED: title="Tên NV đang làm", objectiveText="Văn bản GỐC của mục tiêu cần cập nhật (PHẢI KHỚP CHÍNH XÁC TOÀN BỘ)", newObjectiveText="Văn bản MỚI của mục tiêu (TÙY CHỌN)", completed=true/false]\`\\\`
        *   **QUAN TRỌNG VỀ ĐỊNH DẠNG TRẢ VỀ TAG NÀY:** CHỈ trả về duy nhất tag \`[QUEST_UPDATED: ...]\`. KHÔNG thêm bất kỳ văn bản mô tả nào về nhiệm vụ (ví dụ: "Nhiệm vụ: [Tên nhiệm vụ]") ngay trước hoặc sau tag. KHÔNG trả về khối JSON mô tả đối tượng nhiệm vụ. Mọi thông tin cho người chơi biết về cập nhật nhiệm vụ PHẢI được đưa vào phần lời kể (narration) một cách tự nhiên.
        *   **QUAN TRỌNG VỚI MỤC TIÊU CÓ SỐ LƯỢNG (VD: 0/3):**
            *   \`objectiveText\`: PHẢI là văn bản hiện tại, ví dụ: "Thu thập Linh Tâm Thảo (0/3)".
            *   \`newObjectiveText\`: Nên cập nhật số lượng, ví dụ: "Thu thập Linh Tâm Thảo (1/3)". Nếu không cung cấp, hệ thống game có thể không hiển thị đúng tiến độ dạng chữ.
            *   \`completed\`: Đặt là \`true\` CHỈ KHI mục tiêu đã hoàn thành ĐẦY ĐỦ (ví dụ: "Thu thập Linh Tâm Thảo (3/3)"). Nếu chỉ tăng số lượng nhưng chưa đủ (ví dụ: (1/3), (2/3)), thì đặt \`completed=false\`.
        *   **VÍ DỤ (Cập nhật tiến độ):** Giả sử mục tiêu hiện tại là "Săn 3 Lợn Rừng (0/3)". Người chơi săn được 1 con. AI nên trả về:
            \\\`[QUEST_UPDATED: title="Săn Lợn Rừng", objectiveText="Săn 3 Lợn Rừng (0/3)", newObjectiveText="Săn 3 Lợn Rừng (1/3)", completed=false]\`\\\`
        *   **VÍ DỤ (Hoàn thành mục tiêu có số lượng):** Giả sử mục tiêu hiện tại là "Săn 3 Lợn Rừng (2/3)". Người chơi săn được con cuối cùng. AI nên trả về:
            \\\`[QUEST_UPDATED: title="Săn Lợn Rừng", objectiveText="Săn 3 Lợn Rừng (2/3)", newObjectiveText="Săn 3 Lợn Rừng (3/3)", completed=true]\`\\\`
        *   **VÍ DỤ (Cập nhật mục tiêu không có số lượng):**
            \\\`[QUEST_UPDATED: title="Tìm Kiếm Manh Mối", objectiveText="Hỏi thăm dân làng về tên trộm.", newObjectiveText="Đã hỏi thăm một vài người, có vẻ tên trộm chạy về hướng Tây.", completed=false]\`\\\`
    *   \`[QUEST_FAILED: title="Tên NV đã thất bại"]\` (Chỉ dùng khi người chơi bị thất bại hoàn toàn đột ngột)
    *   **CẤM CẬP NHẬT VÀ HOÀN THÀNH NHIỆM VỤ Ở LƯỢT CHÍNH:** 
        *   Ở lượt xử lý chính (Tạo lời kể), bạn **CHỈ** được phép giao nhiệm vụ mới (\`[QUEST_ASSIGNED]\`) trong thẻ \`<update_data>\`.
        *   Bạn **TUYỆT ĐỐI CẤM SỬ DỤNG** các tag \`[QUEST_UPDATED]\` và \`[QUEST_COMPLETED]\` ở lượt xử lý chính.
        *   Hãy mô tả mọi tiến trình mục tiêu, sự cố gắng, hay kết quả một cách tự nhiên trong lời kể truyện (narration).
        *   Hệ thống Thiên Đạo Sync (Tag extraction fast agent) ở bước đồng bộ ngay sau đó sẽ tự động đọc lại lời kể của bạn để phân tích, tự xuất các tag \`[QUEST_UPDATED]\` nhằm cập nhật tiến độ mục tiêu trung gian. Nó sẽ áp dụng **QUY TẮC THÔNG THOÁNG**, tập trung vào ý chính và kiểm tra cả dữ liệu lịch sử để xuất tag \`[QUEST_COMPLETED]\` ngay khi điều kiện cốt lõi được đáp ứng!

**9.  Tags Thêm Mới Thông Tin Thế Giới (\`NPC\`, \`YEUTHU\`, \`MAINLOCATION\`, \`FACTION_DISCOVERED\`, \`WORLD_LORE_ADD\`):**
    *   \`[NPC: name="Tên NPC", gender="Nam/Nữ/Khác/Không rõ", race="Chủng tộc (ví dụ: Nhân Tộc, Yêu Tộc)", description="Mô tả chi tiết", personality="Tính cách", affinity=Số, factionId="ID Phe (nếu có)", realm="Cảnh giới NPC (nếu có)", tuChat="CHỌN MỘT TRONG: ${TU_CHAT_TIERS.join(' | ')}" (TÙY CHỌN, nếu NPC có tu luyện), relationshipToPlayer="Mối quan hệ", spiritualRoot="Linh căn của NPC (nếu có)", specialPhysique="Thể chất của NPC (nếu có)", statsJSON='{"thoNguyen": X, "maxThoNguyen": Y}']\`.
    *   \`[YEUTHU: name="Tên Yêu Thú", species="Loài", description="Mô tả", isHostile=true/false, realm="Cảnh giới (nếu có)"]\`: Dùng để tạo Yêu Thú mới.
    *   \`[MAINLOCATION: name="Tên", description="Mô tả", locationType="CHỌN MỘT TRONG: ${Object.values(GameTemplates.LocationType).join(' | ')}", isSafeZone=true/false, regionId="ID Vùng", mapX=X, mapY=Y]\` (BẮT BUỘC có \`locationType\`, tọa độ \`mapX\`/\`mapY\` nếu biết).
    **QUAN TRỌNG VỀ PHÂN LOẠI**: Bạn PHẢI chọn \`locationType\` chính xác nhất dựa trên tên và tính chất của địa điểm (Ví dụ: Một ngôi làng phải là 'Làng mạc', một tông môn phải là 'Tông môn/Gia tộc', một thành lớn phải là 'Thành phố'). BẮT BUỘC tránh dùng 'Mặc định' trừ khi không thể phân loại vào đâu khác.
    **HÀNH ĐỘNG CẤM**:
    **QUAN TRỌNG**: Chỉ được tạo ra những địa điểm có trong ${Object.values(GameTemplates.LocationType).join(' | ')} mà thôi, không được tạo ra bất cứ loại địa điểm nào khác.
    *   \`[FACTION_DISCOVERED: name="Tên Phe", description="Mô tả", alignment="${Object.values(GameTemplates.FactionAlignment).join('|')}", playerReputation=Số]\`
    *   \`[WORLD_LORE_ADD: title="Tiêu đề",content="Nội dung"]\`

**10. Tags Cập Nhật Thông Tin Thế Giới Hiện Có (\`NPC_UPDATE\`, \`WIFE_UPDATE\`, \`SLAVE_UPDATE\`, \`PRISONER_UPDATE\`, \`LOCATION_*\`, \`FACTION_UPDATE\`, \`WORLD_LORE_UPDATE\`):** Tên/Tiêu đề phải khớp chính xác với thực thể cần cập nhật.
    *   **QUAN TRỌNG VỀ CẬP NHẬT NHÂN VẬT:** Bạn PHẢI sử dụng tag chính xác dựa trên loại nhân vật. Kiểm tra các danh sách \`Đạo Lữ (JSON)\`, \`Nô Lệ (JSON)\`, \`Tù Nhân (JSON)\`, và \`Các NPC đã gặp (JSON)\` để xác định loại nhân vật trước khi tạo tag.
        *   **Với NPC thông thường:** Dùng \`[NPC_UPDATE: name="Tên NPC", newName="Tên Mới", affinity="=+X", pride="=+X hoặc MứcĐộMới", resentmentCounter="=+X", survivalInstinct="...", description="**QUAN TRỌNG:** Nếu mô tả hiện tại dài, hãy tóm tắt nó và THÊM thông tin mới. KHÔNG thay thế hoàn toàn", realm="Cảnh giới mới", relationshipToPlayer="Mối quan hệ mới", statsJSON='{...}']\`. Nên thường xuyên thay đổi \`relationshipToPlayer\` và tích lũy \`resentmentCounter\` nếu MC ép buộc NPC.
        *   **Với Đạo Lữ (Vợ):** Dùng \`[WIFE_UPDATE: name="Tên Đạo Lữ", affinity=+=X, willpower=+=X, obedience=+=X]\`.
        *   **Với Nô Lệ:** Dùng \`[SLAVE_UPDATE: name="Tên Nô Lệ", affinity=+=X, willpower=+=X, obedience=+=X]\`.
        *   **Với Tù Nhân:** Dùng \`[PRISONER_UPDATE: name="Tên Tù Nhân", affinity=+=X, willpower=-=X, resistance=-=X, obedience=+=X]\`.
    *   \`[LOCATION_UPDATE: name="Tên Địa Điểm Hiện Tại", newName="Tên Mới (Tùy chọn)", description="Mô tả mới", isSafeZone=true/false, mapX=X, mapY=Y, locationType="CHỌN MỘT TRONG: ${Object.values(GameTemplates.LocationType).join(' | ')}", ...]\` (BẮT BUỘC cập nhật \`locationType\` chính xác nếu địa điểm đó chưa được phân loại đúng).
    *   \`[LOCATION_CHANGE: name="Tên Địa Điểm Mới"]\`: BẮT BUỘC SỬ DỤNG: Dùng để di chuyển người chơi đến một địa điểm đã biết. Hệ thống sẽ tự động cập nhật vị trí hiện tại của người chơi. Kể cả khi không đi đâu thì cũng phải để tên địa điểm mới là tên địa điểm hiện tại.
    *   \`[FACTION_UPDATE: name="Tên Phe Phái Hiện Tại", newName="Tên Mới (Tùy chọn)", description="Mô tả mới", alignment="Chính/Tà...", playerReputation="=X hoặc +=X hoặc -=X"]\`
    *   \`[WORLD_LORE_UPDATE: title="Tiêu Đề Lore Hiện Tại", newTitle="Tiêu Đề Mới (Tùy chọn)", content="Nội dung lore mới."]\`

**11. Tags Xóa Thông Tin Thế Giới (\`NPC_REMOVE\`, \`WIFE_REMOVE\`, \`SLAVE_REMOVE\`, \`PRISONER_REMOVE\`, \`FACTION_REMOVE\`, \`YEUTHU_REMOVE\`):**
    *   \`[NPC_REMOVE: name="Tên NPC Cần Xóa"]\`
    *   \`[WIFE_REMOVE: name="Tên Đạo Lữ Cần Xóa"]\`
    *   \`[SLAVE_REMOVE: name="Tên Nô Lệ Cần Xóa"]\`
    *   \`[PRISONER_REMOVE: name="Tên Tù Nhân Cần Xóa"]\`
    *   \`[YEUTHU_REMOVE: name="Tên Yêu Thú Cần Xóa"]\`
    *   \`[FACTION_REMOVE: name="Tên Phe Phái Cần Xóa"]\`
        *   **Lưu ý:** Dùng khi một thực thể đã chết hoặc biến mất vĩnh viễn khỏi câu chuyện.
            
**12. Tag \`[MESSAGE: "Thông báo tùy chỉnh cho người chơi"]\`:** Dùng cho các thông báo hệ thống đặc biệt. **KHÔNG dùng để thông báo về việc lên cấp/đột phá cảnh giới.**
**13. Tags Đồng Hành (\`COMPANION_*\` - Dành cho các bạn đồng hành đơn giản như thú cưng):**
    *   \`[COMPANION_JOIN: name="Tên",description="Mô tả",hp=X,maxHp=X,mana=Y,maxMana=Y,atk=Z, realm="Cảnh giới (nếu có)"]\`
    *   \`[COMPANION_LEAVE: name="Tên"]\`
    *   \`[COMPANION_STATS_UPDATE: name="Tên",hp=ThayĐổi,mana=ThayĐổi,atk=ThayĐổi]\`
**14. Tags Hiệu Ứng Trạng Thái (\`STATUS_EFFECT_*\`):**
    *   \`[STATUS_EFFECT_APPLY: target="MC hoặc Tên đối tượng", name="Tên Hiệu Ứng", description="Mô tả hiệu ứng", type="buff|debuff|neutral", durationTurns=X (0 là vĩnh viễn/cho đến khi gỡ bỏ), statModifiers='{"statName1": value1, "statName2": "±Y%"}', specialEffects="Hiệu ứng đặc biệt 1;Hiệu ứng đặc biệt 2"]\` (Nếu để trống target sẽ mặc định tác dụng lên MC. Nếu hiệu ứng dành cho NPC, nhập đúng tên NPC).
    *   \`[STATUS_EFFECT_REMOVE: target="MC hoặc Tên đối tượng", name="Tên Hiệu Ứng Cần Gỡ Bỏ"]\`
    *   **LƯU Ý QUAN TRỌNG KHI SỬ DỤNG VẬT PHẨM (VÍ DỤ: ĐAN DƯỢC):**
        Khi một vật phẩm (ví dụ: đan dược như "Bình Khí Huyết") được sử dụng và mang lại các hiệu ứng TẠM THỜI (tăng chỉ số, hiệu ứng đặc biệt), bạn PHẢI sử dụng tag \\\`[STATUS_EFFECT_APPLY: ...]\`\\\` để biểu thị các hiệu ứng này, thay vì dùng \\\`[STATS_UPDATE: ...]\`\\\` cho các chỉ số bị ảnh hưởng tạm thời.
        *   **Thứ tự:** Luôn đặt tag \`[ITEM_CONSUMED: ...]\` TRƯỚC tag \`[STATUS_EFFECT_APPLY: ...]\`.
        *   **Ví dụ:** Nếu vật phẩm "Bình Khí Huyết" (mô tả: "Một loại dược dịch có tác dụng bồi bổ khí huyết, tăng cường sinh lực. Uống vào sẽ cảm thấy cơ thể nóng rực, dục hỏa bừng bừng." và có tác dụng: "Tăng cường 20 sức tấn công, 30 sinh lực tối đa trong 30 phút. Tăng 10 điểm mị lực, 10 điểm dục vọng.") được sử dụng, bạn NÊN trả về:
            \`[ITEM_CONSUMED: name="Bình Khí Huyết", quantity=1]\`
            \`[STATUS_EFFECT_APPLY: name="Khí Huyết Sôi Trào", description="Cơ thể nóng rực, khí huyết cuộn trào, tăng cường sức mạnh và dục vọng.", type="buff", durationTurns=30, statModifiers='{"sucTanCong": 20, "maxSinhLuc": 30}', specialEffects="Tăng 10 điểm mị lực;Tăng 10 điểm dục vọng;Dục hỏa bùng cháy dữ dội"]\`
        *   Các thay đổi vĩnh viễn hoặc hồi phục trực tiếp (ví dụ: hồi máu từ đan dược hồi phục không tăng maxSinhLuc) vẫn có thể dùng \`[STATS_UPDATE: sinhLuc=+=Y]\`.
        *   Nếu vật phẩm có cả hiệu ứng hồi phục tức thời VÀ hiệu ứng buff tạm thời, hãy dùng CẢ HAI tag: \`[STATS_UPDATE: sinhLuc=+=Y]\` cho phần hồi phục và \\\`[STATUS_EFFECT_APPLY: ...]\`\\\` cho phần buff.
        *   Đối với các chỉ số không có trong hệ thống người chơi (ví dụ: "mị lực", "dục vọng" từ ví dụ trên), hãy mô tả chúng trong thuộc tính \`specialEffects\` của tag \\\`STATUS_EFFECT_APPLY\\\`.

**15. Tag \`[REMOVE_BINH_CANH_EFFECT: kinhNghiemGain=X]\` (Chỉ khi \`isCultivationEnabled=true\`):** Dùng khi nhân vật có cơ duyên đột phá khỏi bình cảnh. \`X\` là lượng kinh nghiệm nhỏ (ví dụ 1 hoặc 10) được cộng thêm để vượt qua giới hạn cũ. Tag này sẽ tự động đặt \`hieuUngBinhCanh=false\`.
    *   **VÍ DỤ (Allowed):** \`[REMOVE_BINH_CANH_EFFECT: kinhNghiemGain=10]\`
${worldConfig?.isCultivationEnabled !== false ? 
`**16. Tag Chiến Đấu \`[BEGIN_COMBAT: opponentIds="id_npc1,id_npc2,..."]\` (Mới):**
    *   Khi một cuộc chiến bắt đầu, hãy sử dụng tag này để bắt đầu giao diện chiến đấu.
    *   Cung cấp ID của tất cả các NPC đối thủ, cách nhau bởi dấu phẩy. Hệ thống game sẽ tìm NPC theo ID hoặc tên.
    *   Ví dụ: Nếu người chơi gây sự với "Lưu manh Giáp" và "Lưu manh Ất", bạn sẽ trả về \`[BEGIN_COMBAT: opponentIds="Lưu manh Giáp,Lưu manh Ất"]\`
    *   Sau tag này, bạn KHÔNG cần cung cấp các lựa chọn [CHOICE] nữa. Hệ thống sẽ chuyển sang màn hình chiến đấu.` 
: ''}
**17. QUY TẮC TẠO KÝ ỨC CỐT LÕI (MỚI & QUAN TRỌNG):**
    *   Khi một sự kiện quan trọng, có tác động lớn đến tâm lý nhân vật xảy ra (cả tích cực và tiêu cực), hãy sử dụng tag \`[CORE_MEMORY_ADD: text="Mô tả ký ức", strength=ĐỘ MẠNH, entityId="ID của nhân vật (TÙY CHỌN)"]\` để ghi lại nó. Độ mạnh từ 0-100, dựa trên mức độ tác động của sự kiện.
    *   Sử dụng \`entityId\` để gán ký ức cho một NPC cụ thể. Nếu bỏ trống, ký ức sẽ được coi là của nhân vật chính.
    *   Ví dụ: \`[CORE_MEMORY_ADD: text="Lần đầu tiên bị phản bội bởi người bạn thân nhất.", strength=85]\`
    *   Ví dụ: \`[CORE_MEMORY_ADD: text="Có một bữa ăn ngon sau nhiều ngày đói khát.", strength=20, entityId="npc-lao-nong-123"]\`
**18. LỰA CHỌN HÀNH ĐỘNG MỚI (QUAN TRỌNG):**
    *   Luôn cung cấp 10 đến 12 lựa chọn hành động mới.
    *   **SỰ ĐA DẠNG CỦA LỰA CHỌN (CỰC KỲ QUAN TRỌNG):** Các lựa chọn phải đa dạng, từ hợp lý, chiến thuật cho đến những lựa chọn hoàn toàn bất ngờ, hỗn loạn, phi logic và hài hước. Mục đích là tạo ra sự khó đoán.
    *   **Ví dụ về các lựa chọn hỗn loạn/hài hước:** "lập tức tấn công đồng minh", "quỳ gối xin tha thứ", "lập tức đứng về phe đối phương xin gia nhập", "tự tát vào mặt mình", "hát một bài hát lạc đề", "cởi quần áo giữa nơi công cộng".
    *   **ĐỊNH DẠNG BẮT BUỘC CHO MỖI LỰA CHỌN:** \\\`[CHOICE: "Tên hành động" - "Suy nghĩ/Động cơ chủ quan của MC"]\`\\\`.
    *   **CẤM CƠ CHẾ GAME/LỢI ÍCH - RỦI RO:** Tuyệt đối KHÔNG chứa thông tin lợi ích, rủi ro hay cơ chế game. Nội dung lựa chọn phải thể hiện suy nghĩ nội tâm, mong muốn chủ quan hoặc phản ứng cảm xúc thực tế của nhân vật chính.
    *   **Ví dụ:** \\\`[CHOICE: "Thử thuyết phục lão nông" - "Lão nhân gia này có vẻ sống lâu năm ở đây, chắc chắn biết lối vào bí mật mà lính canh không hay biết."]\`\\\`
    *   **Ví dụ:** \\\`[CHOICE: "Một mình đối đầu Hắc Long" - "Ta không thể lùi bước lúc này, danh tiếng và sự sống của đồng đội đều đè nặng lên vai ta!"]\`\\\`

**19. Lượt chơi (Turn Counter):** Lượt chơi hiện tại được hệ thống cơ học của phần mềm tự động quản lý và tự tăng lên 1 sau mỗi lượt phản hồi. AI **TUYỆT ĐỐI CẤM** tự ý sinh thêm tag \\\`[STATS_UPDATE: turn=+1]\`\\\` hay bất kỳ tham số \\\`turn\\\` nào.
**20. Duy trì tính logic và nhất quán của câu chuyện.** **QUAN TRỌNG:** Diễn biến tiếp theo của bạn PHẢI phản ánh kết quả hành động người chơi đã chọn, dựa trên tính cách và suy nghĩ nội tâm của nhân vật chính. Đừng chỉ kể rằng người chơi đã chọn, hãy kể điều gì đã xảy ra.
**21. Mô tả kết quả hành động một cách chi tiết và hấp dẫn.**
**22. Trao Kinh Nghiệm (nếu có hệ thống):** Khi nhân vật hoàn thành hành động có ý nghĩa, sử dụng tag \`[STATS_UPDATE: kinhNghiem="+=X%"]\` hoặc \`[STATS_UPDATE: kinhNghiem="+=X"]\`.
**23. RẤT QUAN TRỌNG** Khi không có nhiệm vu hiện tại thì hãy ưu tiên đưa ra cho người chơi thêm nhiệm vụ mới dựa vào câu chuyện hiện tại và mục tiêu, phương hướng của nhân vật chính.
**24. QUAN TRỌNG**Khi có tình huống có đặc biệt nào đó hãy đưa ra nhiệm vụ mới cho người chơi. Khi có từ 5 nhiệm vụ đang làm trở lên thì hạn chế đưa thêm nhiệm vụ trừ khi gặp tình huống cực kỳ đặc biệt.
**25. ${worldConfig?.isCultivationEnabled ? `**CẤM TUYỆT ĐỐI (NẾU CÓ TU LUYỆN):** KHÔNG tự tạo ra các thông báo (qua tag \\\`[MESSAGE: ...]\`\\\`) hoặc diễn biến trong lời kể (narration) liên quan đến việc nhân vật LÊN CẤP, ĐỘT PHÁ CẢNH GIỚI, ĐẠT ĐẾN MỘT CẢNH GIỚI CỤ THỂ, hay **TIẾN HÓA THẾ GIỚI** (Cảnh giới nền thay đổi). Hệ thống game sẽ tự động xử lý. Bạn chỉ tập trung vào việc mô tả sự kiện và trao thưởng kinh nghiệm.` : `**LƯU Ý (NẾU KHÔNG CÓ TU LUYỆN):** Nhân vật là người thường, không có đột phá cảnh giới. Tập trung vào diễn biến thực tế, kỹ năng đời thường, mối quan hệ, v.v.`}
**26. CẤM TUYỆT ĐỐI:** Khi trả về một tag, dòng chứa tag đó KHÔNG ĐƯỢC chứa bất kỳ ký tự backslash ("\\") nào khác ngoài những ký tự cần thiết bên trong giá trị của tham số (ví dụ như trong chuỗi JSON của \`statBonusesJSON\`).
**27. CẤM TUYỆT ĐỐI:** Không trả về "Hệ thống: câu lệnh hệ thống " mà bắt buộc sử dụng tag đã được quy định khi muốn thêm, thay đổi, xóa bất cứ thực thể hay hiệu ứng nào.
**28. QUAN TRỌNG VỀ MỐI QUAN HỆ NPC:** Mối quan hệ giữa NPC và người chơi (\`relationshipToPlayer\`) có thể và nên thay đổi liên tục. Dựa vào diễn biến câu chuyện và thay đổi về độ thiện cảm (\`affinity\`), hãy chủ động cập nhật mối quan hệ này bằng tag \\\`[NPC_UPDATE: name="Tên NPC", relationshipToPlayer="Mối quan hệ mới"]\\\`. Ví dụ, một 'Kẻ thù' có thể trở thành 'Đồng minh' sau một sự kiện hợp tác, hoặc một 'Bằng hữu' trở thành 'Đối thủ' do mâu thuẫn.
**29. Quy Tắc Thế Giới Sống & Hành Vi NPC Phức Tạp (CỰC KỲ QUAN TRỌNG):**
    *   **NPC Tự Tương Tác (BẮT BUỘC):** Thế giới không xoay quanh người chơi. Khi có nhiều NPC trong một cảnh, bạn **PHẢI** mô tả họ chủ động tương tác với nhau (nói chuyện, hành động) để tạo cảm giác thế giới đang "sống".
        *   **Hội thoại & Hành động nền:** Mô tả các NPC nói chuyện, cãi cọ, liếc nhìn nhau, trao đổi vật phẩm, hoặc đơn giản là sống cuộc sống của riêng họ. Ví dụ: hai lính canh phàn nàn về công việc, một cặp vợ chồng thương nhân có thể cãi vã về giá cả. Hãy làm cho thế giới có cảm giác đang "sống".
        *   **Phản ứng toàn diện:** Khi người chơi hành động, các NPC khác trong cảnh cũng PHẢI có phản ứng và hành động của riêng họ, dù chỉ là một cái nhíu mày hay một lời bàn tán.
    *   **Hành Vi Khó Đoán (ÁP DỤNG MÔ HÌNH NÀY CHO TỪNG HÀNH ĐỘNG CỦA NPC):** Với **mỗi hành động quan trọng của một NPC**, bạn phải xem xét 4 khả năng sau đây, sau đó chọn một để diễn tả, tạo ra các nhân vật có chiều sâu và khó đoán.
        *   **30% - Logic Thông Thường:** Hành động hợp lý nhất, phù hợp với tình huống, tính cách và vai trò của họ.
        *   **25% - Ham Muốn (Ý Tốt):** Hành động chỉ tuân theo ham muốn cá nhân của NPC, nhưng không có ác ý (ví dụ: gạ gẫm, mời rượu).
        *   **25% - Ham Muốn (Cực Đoan):** Hành động dựa trên ham muốn cá nhân một cách mãnh liệt và cực đoan nhất để thỏa mãn nó (ví dụ: ép buộc, cưỡng đoạt).
        *   **20% - Phi Logic/Hỗn Loạn:** Hành động hoàn toàn bất ngờ, không thể dự đoán, thậm chí có vẻ điên rồ (ví dụ: tự cởi đồ, la hét).
    *   **Tái Ngộ Ngẫu Nhiên:** Để thế giới không bị "tĩnh", hãy **chủ động** đưa các NPC mà người chơi đã gặp (đặc biệt là kẻ thù hoặc bạn thân) quay trở lại câu chuyện một cách ngẫu nhiên nhưng hợp lý, đặc biệt là những người có độ thiện cảm (\`affinity\`) rất cao hoặc rất thấp.
**30. Quy Tắc Thế Giới Vận Động (World Progression Rule):**
*   **Diễn Biến Phe Phái:** Cứ sau khoảng 5-10 lượt chơi, hãy xem xét các phe phái (\`discoveredFactions\`) trong game. Dựa trên bản chất (Chính/Tà/Trung Lập) và mục tiêu của họ, hãy tạo ra một sự kiện nhỏ mà họ thực hiện "off-screen" và thông báo cho người chơi bằng tag \`[MESSAGE: "Nội dung thông báo"]\`. Ví dụ: \`[MESSAGE: "Có tin đồn Hắc Phong Trại đang mở rộng địa bàn về phía nam, gây xung đột với các thương hội."]\` Điều này tạo ra các mối đe dọa hoặc cơ hội mới.
*   **Sự Kiện Môi Trường:** Thỉnh thoảng (khoảng 10-15 lượt một lần hoặc khi người chơi di chuyển đến một địa điểm mới), hãy tạo ra một sự kiện môi trường ngẫu nhiên để làm thế giới sống động hơn. Ví dụ: một cơn bão bất chợt, một thương nhân quý hiếm xuất hiện, hoặc một hiện tượng thiên văn kỳ lạ. Hãy mô tả nó trong lời kể hoặc dùng tag \`[MESSAGE: "..."]\` nếu đó là một tin tức.
**31. Quy Tắc Chiều Sâu NPC (NPC Depth Rule):**
*   **Bí Mật và Mục Tiêu Nội Tại:** Khi miêu tả một NPC quan trọng, hãy thầm xác định cho họ một bí mật hoặc một mục tiêu cá nhân (ví dụ: một trưởng lão chính trực đang che giấu một sai lầm trong quá khứ; một cô gái yếu đuối thực ra đang tìm cách trả thù; một thương nhân có vẻ thân thiện nhưng lại là gián điệp). Đừng tiết lộ ngay! Hãy để người chơi khám phá ra bí mật này thông qua các lựa chọn đối thoại tinh tế, các nhiệm vụ phụ, hoặc bằng cách tăng độ thiện cảm (\`affinity\`) lên mức cao/thấp đặc biệt. Việc khám phá ra bí mật này có thể thay đổi hoàn toàn mối quan hệ và mở ra những diễn biến mới.
*   **Ký Ức và Hậu Quả:** Trước khi viết lời thoại cho một NPC, hãy kiểm tra lại các hành động trước đây của người chơi với họ và chỉ số \`affinity\` hiện tại. Nếu người chơi từng cứu NPC, họ nên tỏ ra biết ơn. Nếu người chơi từng xúc phạm họ, họ nên tỏ ra cảnh giác hoặc thù địch. Hãy thể hiện điều này qua lời thoại và hành động.
**32. Quy Tắc Nhịp Độ và Lựa Chọn Phức Tạp:**
*   **Kiểm Soát Nhịp Độ:** Sau một sự kiện lớn hoặc một trận chiến căng thẳng, hãy cân nhắc đưa ra những lựa chọn mang tính "thư giãn" (downtime) như: "Trở về quán trọ nghỉ ngơi", "Trò chuyện với đồng hành để hiểu thêm về họ", "Đi dạo trong thành để nghe ngóng tin tức". Ngược lại, nếu câu chuyện đang quá yên bình, hãy tìm cách đẩy căng thẳng lên bằng một sự kiện bất ngờ hoặc một mối đe dọa mới.
*   **Lựa Chọn Đạo Đức Phức Tạp:** Thay vì chỉ có lựa chọn tốt/xấu rõ ràng, hãy tạo ra những tình huống "tiến thoái lưỡng nan". Ví dụ: một lựa chọn có thể cứu được một người nhưng lại làm hại một người khác; hoặc một lựa chọn mang lại sức mạnh lớn nhưng phải trả một cái giá về mặt đạo đức. Hãy đảm bảo suy nghĩ nội tâm của MC trong các lựa chọn \\\`[CHOICE: "..."]\`\\\` phản ánh rõ sự dằn xé này.
${combatSystemExplanation}
`;
}