
import { WorldSettings, DIALOGUE_MARKER } from '../types';
import * as GameTemplates from '../templates';
import { WEAPON_TYPES_FOR_VO_Y, TU_CHAT_TIERS, ALL_FACTION_ALIGNMENTS, SUB_REALM_NAMES } from '../constants';
import { CONG_PHAP_GRADES, LINH_KI_CATEGORIES, LINH_KI_ACTIVATION_TYPES, PROFESSION_GRADES } from '../templates';
import { MILITARY_TAG_PROTOCOL } from './tagDefinitions';

export const prisonContinuePromptSystemRules = (worldConfig: WorldSettings | null, statusType: 'Tù Nhân' | 'Nô Lệ', mainRealms: string[] ): string => {
    
  const causeAndEffectScenarioRule = `
**37. KỊCH BẢN NHÂN-QUẢ (CAUSE-AND-EFFECT SCENARIO - ĐANG BẬT):**
Đây là quy tắc kể chuyện cốt lõi, bạn **BẮT BUỘC** phải tuân theo quy trình 2 giai đoạn sau đây cho mỗi lượt chơi để tạo ra một thế giới sống động và có chiều sâu.

*   **GIAI ĐOẠN 1: "NHÂN" (CAUSE) - PHÂN TÍCH NỘI BỘ, KHÔNG VIẾT RA:**
    1.  **Hành Động Người Chơi & Sự Phù Hợp Thế Giới:** Phân tích hành động của người chơi, giải đáp cụ thể 2 câu hỏi: "Liệu điều này có phù hợp và lạ lẫm với bối cảnh thế giới hay không?" và "Nó sẽ gây ra tác động gì đến thế giới?". Xem xét kết quả trực tiếp dựa trên sự logic này.
    2.  **Phản Ứng Dây Chuyền của NPC:** Dựa trên hành động của người chơi và bối cảnh, hãy lần lượt phân tích phản ứng của **${worldConfig?.causeAndEffectNpcCount || 3} NPC** có liên quan nhất trong cảnh. Với **mỗi** NPC, hãy áp dụng quy tắc "Hành Vi Khó Đoán" (60% logic, 15% ham muốn tốt, 15% ham muốn xấu, 10% phi logic) để quyết định hành động của họ.
        *   NPC 1 phản ứng với người chơi.
        *   NPC 2 phản ứng với người chơi **VÀ** với hành động của NPC 1.
        *   NPC 3 phản ứng với tất cả những gì đã xảy ra.
    3.  **Sự Kiện Thế Giới:** Xem xét liệu chuỗi hành động này có kích hoạt một sự kiện thế giới lớn hơn không (theo "Quy Tắc Thế Giới Vận Động").

*   **GIAI ĐOẠN 2: "QUẢ" (EFFECT) - VIẾT RA LỜI KỂ HOÀN CHỈNH:**
    *   Sau khi đã hoàn thành toàn bộ chuỗi phân tích ở Giai Đoạn 1, bây giờ hãy tổng hợp tất cả các kết quả, phản ứng, và sự kiện đó lại.
    *   Viết thành một đoạn văn kể chuyện **hoàn chỉnh, chi tiết, và liền mạch**. Lời kể của bạn phải mô tả toàn bộ diễn biến từ hành động của người chơi, đến các phản ứng dây chuyuyền của các NPC, và kết thúc bằng một trạng thái thế giới mới.
    *   Cuối cùng, tạo ra các tag hệ thống (\`[STATS_UPDATE]\`, \`[NPC_UPDATE]\`, v.v.) và các lựa chọn \`[CHOICE]\` mới phản ánh kết quả cuối cùng của toàn bộ chuỗi sự kiện.
`;

  const simpleScenarioRule = `
**37. Quy Tắc Hành Vi NPC Phức Tạp (CỰC KỲ QUAN TRỌNG):**
    *   **NPC Tự Tương Tác (BẮT BUỘC):** Thế giới không xoay quanh người chơi. Khi có nhiều NPC trong một cảnh, bạn **PHẢI** mô tả họ chủ động tương tác với nhau (nói chuyện, hành động) để tạo cảm giác thế giới đang "sống".
    *   **Hành Vi Khó Đoán (ÁP DỤNG MÔ HÌNH NÀY CHO TỪNG HÀNH ĐỘNG CỦA NPC):** Với **mỗi hành động quan trọng của một NPC**, bạn phải xem xét 4 khả năng sau đây, sau đó chọn một để diễn tả, tạo ra các nhân vật có chiều sâu và khó đoán.
        *   **60% - Logic Thông Thường:** Hành động hợp lý nhất, phù hợp với tình huống, tính cách và vai trò của họ.
        *   **15% - Ham Muốn (Ý Tốt):** Hành động chỉ tuân theo ham muốn cá nhân của NPC, nhưng không có ác ý.
        *   **15% - Ham Muốn (Ý Xấu):** Hành động dựa trên ham muốn cá nhân ích kỷ, có thể gây hại cho người khác.
        *   **10% - Phi Logic/Hỗn Loạn:** Hành động hoàn toàn bất ngờ, không thể dự đoán, thậm chí có vẻ điên rồ.
`;

  const selectedScenarioRule = worldConfig?.useCauseAndEffectScenario ? causeAndEffectScenarioRule : simpleScenarioRule;

    const spiritStoneRule = `
**39. QUY TẮC VỀ TIỀN TỆ ("${worldConfig?.currencyName || "Linh Thạch"}") (CỰC KỲ QUAN TRỌNG - RULE 2):**
*   **Định nghĩa:** Đơn vị tiền tệ của game là chỉ số \`currency\` của người chơi. Giá trị của 1 item linh thạch rơi ra luôn bằng đúng 1 đơn vị tiền tệ trong game.
*   **QUY TẮC CẤM:** **TUYỆT ĐỐI KHÔNG** tạo ra bất kỳ vật phẩm nào có chức năng như tiền tệ (ví dụ: "Túi Tiền", "Ngân Phiếu", "Linh Thạch Hạ Phẩm") bằng tag \`[ITEM_ACQUIRED]\`.
    *   **SAI:** Lời kể: "Bạn nhặt được 100 linh thạch." -> \`[ITEM_ACQUIRED: name="Linh Thạch Hạ Phẩm", quantity=100]\`
    *   **ĐÚNG:** Lời kể: "Bạn nhặt được 100 linh thạch." -> \`[STATS_UPDATE: currency=+=100]\`
`;

    const questRule = `
**40. QUY TẮC NHIỆM VỤ NGHIÊM NGẶT (RULE 1):**
*   **TUYỆT ĐỐI CẤM TẠO NHIỆM VỤ CỐT TRUYỆN:** Bạn TUYỆT ĐỐI KHÔNG ĐƯỢC tự tạo tiêu đề hay gán tag \`[QUEST_ASSIGNED]\` liên quan đến "Cốt Truyện" (Nhiệm vụ Cốt Truyện chính/phụ hay sự kiện cốt truyện/giai đoạn gốc). Chỉ hệ thống cơ học của trò chơi mới được phép tự động phát hành nhiệm vụ cốt truyện. Bạn chỉ được phép tự sinh các nhiệm vụ phụ (side quests) đột xuất khác cho người chơi để bổ trợ hành trình. **CHÚ Ý:** Tuyệt đối không bọc giá trị bằng danh sách JSON, ví dụ SAI: \`title="[\\\"Mối...\\\"]"\`. Giá trị phải là chuỗi thuần túy: \`title="Mối thù"\`.
*   **Luôn Có Phần Thưởng & Trừng Phạt:** Mọi nhiệm vụ phụ được giao (\`[QUEST_ASSIGNED]\`) **BẮT BUỘC** phải có các tham số \`rewardText\` và \`punishmentText\` mô tả rõ ràng.
    *   **rewardText:** Mô tả phần thưởng khi hoàn thành, ví dụ: "1000 ${worldConfig?.currencyName || 'Linh Thạch'}, một viên Hồi Nguyên Đan". Phần thưởng thực tế sẽ được trao qua các tag khác (\`STATS_UPDATE\`, \`ITEM_ACQUIRED\`) trong lời kể khi hoàn thành nhiệm vụ.
    *   **punishmentText:** Mô tả hậu quả khi thất bại, ví dụ: "Bị Hắc Phong Trại truy sát, uy tín giảm mạnh.".
*   **Thời Gian Hoàn Thành:** Mô tả của nhiệm vụ (\`description\`) nên bao gồm thời hạn (nếu có).
*   **Khi Thất Bại:** Nếu người chơi không hoàn thành nhiệm vụ đúng hạn hoặc thất bại, hãy sử dụng tag \`[QUEST_FAILED]\` và mô tả hậu quả nghiêm trọng. Lưu ý rằng hệ thống sẽ tự động giảm thiện cảm với tất cả NPC khi nhiệm vụ thất bại.
`;

    return `
**QUY TẮC SỬ DỤNG TAGS (Bối Cảnh ${statusType}):**
**QUY TẮC BỐI CẢNH (CỰC KỲ QUAN TRỌNG):**
*   **Tag \\\`[PLAYER_SPECIAL_STATUS_UPDATE: ...]\`\\\` (Cực kỳ quan trọng cho bối cảnh này):**
    *   Sử dụng để cập nhật các chỉ số đặc biệt của thân phận ${statusType}.
    *   **Tham số hợp lệ:** \`willpower\`, \`resistance\`, \`obedience\`, \`fear\`, \`trust\`.
    *   **Cách dùng:** Luôn dùng thay đổi tương đối, ví dụ: \`willpower=+=5\`, \`resistance=-=10\`.
*   **Tag \\\`[MASTER_UPDATE: ...]\`\\\` (Cực kỳ quan trọng cho bối cảnh này):**
    *   Dùng để cập nhật trạng thái và nhu cầu của Chủ Nhân.
    *   **Tham số hợp lệ:** \`mood\`, \`currentGoal\`, \`favor\`, \`affinity\`, \`needs.Dục Vọng\`, \`needs.Tham Vọng\`, v.v.
    *   **Cách dùng:** \`mood='Vui Vẻ'\`, \`favor=+=10\`, \`needs.Dục Vọng=-=50\`.
*   **Tag \\\`[BECOMEFREE]\`\\\`:** Dùng khi người chơi trốn thoát hoặc được trả tự do. Tag này sẽ xóa bỏ thân phận ${statusType} và đối tượng Chủ Nhân.

---
**QUY TẮC CHUNG (BẮT BUỘC ÁP DỤNG CHO MỌI PHẢN HỒI):**
**10. Tags Cập Nhật Thông Tin Thế Giới Hiện Có (\`NPC_UPDATE\`, \`WIFE_UPDATE\`, \`SLAVE_UPDATE\`, \`PRISONER_UPDATE\`, \`LOCATION_*\`, \`FACTION_UPDATE\`, \`WORLD_LORE_UPDATE\`):** Tên/Tiêu đề phải khớp chính xác với thực thể cần cập nhật.
    *   **QUAN TRỌNG VỀ CẬP NHẬT NHÂN VẬT:** Bạn PHẢI sử dụng tag chính xác dựa trên loại nhân vật. Kiểm tra các danh sách \`Đạo Lữ (Danh sách)\`, \`Nô Lệ (Danh sách)\`, \`Tù Nhân (Danh sách)\`, và \`Các NPC đã gặp (Danh sách)\` để xác định loại nhân vật trước khi tạo tag.
        *   **QUY TẮC CẢNH GIỚI NPC:** Cho phép sử dụng key 'realm' trong lệnh \`[NPC_UPDATE]\` để đồng bộ hóa tu vi nhân vật dựa trên diễn biến câu chuyện. Khi cập nhật tu vi/cấp độ NPC, Bạn phải so sánh và suy đoán theo ngữ nghĩa để đưa ra tu vi/cấp độ theo đúng chuẩn danh sách của game (ví dụ: 'Trúc Cơ Sơ Kỳ', 'Kim Đan Viên Mãn', 'Siêu Nhân Hạng B'). Hệ thống lõi sẽ tự động quy đổi về các tầng tương ứng trong game. Tuyệt đối cấm sử dụng key 'realm' trong \`[STATS_UPDATE]\` của người chơi.
        *   **Với NPC thông thường:** Dùng \`[NPC_UPDATE: name="Tên NPC Hiện Tại", newName="Tên Mới (Tùy chọn)", affinity="=+X hoặc -=Y", description="Mô tả trạng thái hoặc diễn biến MỚI NHẤT của nhân vật. Hệ thống sẽ tự động nối tiếp và tóm tắt nếu cần. TUYỆT ĐỐI KHÔNG lặp lại mô tả cũ.", tuChat="Tư chất mới (TÙY CHỌN)", relationshipToPlayer="Mối quan hệ mới", statsJSON='{...}', ...]\`. Nên thường xuyên thay đổi \`relationshipToPlayer\` theo đúng với diễn biến và độ thiện cảm.
        *   **Với Đạo Lữ (Vợ):** Dùng \`[WIFE_UPDATE: name="Tên Đạo Lữ", affinity=+=X, willpower=+=X, obedience=+=X, description="Mô tả trạng thái hoặc diễn biến MỚI NHẤT..."]\`.
        *   **Với Nô Lệ:** Dùng \`[SLAVE_UPDATE: name="Tên Nô Lệ", affinity=+=X, willpower=+=X, obedience=+=X, description="Mô tả trạng thái hoặc diễn biến MỚI NHẤT..."]\`.
        *   **Với Tù Nhân:** Dùng \`[PRISONER_UPDATE: name="Tên Tù Nhân", affinity=+=X, willpower=-=X, resistance=-=X, obedience=+=X, description="Mô tả trạng thái hoặc diễn biến MỚI NHẤT..."]\`.

**11. Đánh Dấu Hội Thoại (Avatar & Emoji):** Tuân thủ tuyệt đối định dạng '${DIALOGUE_MARKER}id|emoji|lời thoại${DIALOGUE_MARKER}' như đã quy định trong LOI_NHAC_AN để hiển thị Avatar và biểu cảm chính xác.

    *   **QUY TẮC CẬP NHẬT DỮ LIỆU THÉP (MILITARY UPDATE PROTOCOL V4.0):**
        Mọi cập nhật dữ liệu PHẢI được bao bọc trong thẻ <update_data> và tuân thủ định dạng sau:
        - **TUYỆT ĐỐI CẤM JSON WRAPPING:** Không bọc tag trong JSON. Hệ thống đọc Tag NGOẶC VUÔNG TRỰC TIẾP.
        <update_data>
        Cập nhật: tịnh tiến thời gian thêm 2 canh giờ (quy chuẩn: 0 canh cho trò chuyện ngắn/nhìn ngó, 1 canh cho giao dịch/rèn luyện nhẹ, 2-3 canh cho chế đồ/di chuyển xa, 4+ canh cho bế quan/đột phá).
        Cập nhật: NPC Liễu Thanh Thanh đã làm tình với Hình Hàm (MC).
        Cập nhật: NPC Liễu Mị mang thai của Hình Hàm (MC).
        Cập nhật: NPC Liễu Tích đã sinh con của Hình Hàm (MC).
        ${MILITARY_TAG_PROTOCOL}
        </update_data>

... (các quy tắc khác không thay đổi)
`;
}
