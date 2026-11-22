/**
 * npcCombatAssessmentRules.ts
 * Quy tắc thẩm định 3 câu hỏi bắt buộc áp dụng cho 100% tất cả NPC tham chiến.
 */

export const NPC_COMBAT_ASSESSMENT_XML_RULES = `
    <luat_tham_dinh_tat_ca_npc_+qui_tac_luc_chien>================
    1. NGUYÊN TẮC DUYỆT TOÀN BỘ NPC (100% KHÔNG BỎ SÓT - CHỈ DUYỆT NPC TRÊN SÂN):
       - Bạn BẮT BUỘC phải duyệt qua TOÀN BỘ VÀ TẤT CẢ các NPC đang tham chiến được cung cấp rõ ràng trong 2 khối XML: <phe_dong_minh_tham_chien> và <phe_ke_thu_doi_thu>.
       - TUYỆT ĐỐI CẤM nhắc đến, điều khiển hoặc đưa vào phần kể chuyện bất kỳ NPC dự bị nào không xuất hiện trong 2 thẻ XML trên. Bọn họ hoàn toàn không có mặt trên sân lúc này.
       - CẤM BỎ SÓT BẤT KỲ NPC NÀO: Dù trận đấu có 1, 2 hay nhiều NPC, bạn đều phải ghi tên và trình bày mục thẩm định cho từng NPC một bên trong thẻ suy nghĩ (<thinking> hoặc <tuong_than>).

    2. BẮT BUỘC THẨM ĐỊNH 3 CÂU HỎI CHO MỖI NPC:
       Đối với MỖI VÀ MỌI NPC trong danh sách tham chiến, bạn BẮT BUỘC phải trả lời chính xác 3 câu hỏi sau:
       • [1] NPC là ai? (Tên, xuất thân, tính cách, phe phái hiện tại).
       • [2] Phản ứng thái độ của NPC trước hành động/ý đồ của MC?
       • [3] Động thái & Hành động cụ thể của NPC trong lượt này? (BẮT BUỘC là hành động tác động thực tế: tấn công, phòng thủ, hỗ trợ, bọc lót, tung chiêu).

    3. NGUYÊN TẮC CẤM NPC ĐỨNG YÊN HOẶC HÀNH ĐỘNG HỜI HỢT:
       - Tất cả các NPC đang tham chiến BẮT BUỘC phải thực hiện một hành động mang tính tác động vật lý hoặc phép thuật thực sự (như tấn công, tung chiêu thức, buff máu/mana, thi triển khiên chắn, bọc lót, đổi phe).
       - TUYỆT ĐỐI CẤM thói quen hời hợt để NPC đứng nhìn, kinh ngạc, hò hét hay thể hiện tâm trạng suông mà không đóng góp diễn biến giao tranh.
       - CẤM TÌNH TRẠNG CHỈ CÓ 1 NPC RA ĐÒN DUY NHẤT. Mỗi lượt giao tranh là một đợt hỗn chiến, các bên đều có tương tác va chạm cụ thể.
       - RÀNG BUỘC 1:1 GIỮA HÀNH ĐỘNG VÀ TAG CHỈ SỐ CƠ HỌC: Mọi hành động công kích, dính đòn, tung kỹ năng, hoặc trị liệu hồi máu của từng NPC trong <noi_dung> BẮT BUỘC phải đi kèm Tag ý đồ [COMBAT_ACTION] tương ứng ở cuối phản hồi để Động cơ tự động tính toán chính xác lượng HP thay đổi. Tuyệt đối cấm tự bịa ra con số lượng mất/hồi máu (amount). Nếu tung kỹ năng tốn mana, có thể chèn thêm [MP_CHANGE]. Cấm tuyệt đối việc miêu tả chém trúng/bị thương trong văn kể mà không xuất tag hành động.
    ================</luat_tham_dinh_tat_ca_npc_+qui_tac_luc_chien>
`;
