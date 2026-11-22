export const STORY_QUEST_COMPLETION_RULES = `
<quy_tac_xac_nhan_nhiem_vu_cot_truyen>
   <luat_xac_nhan_hoan_thanh_+quy_tac_xac_nhan_nhiem_vu_cot_truyen>
================
1. TRÁCH NHIỆM XÁC NHẬN HOÀN THÀNH CỦA AI CHÍNH:
   - Trong quá trình dẫn truyện, bạn PHẢI liên tục theo dõi mục tiêu của Nhiệm vụ đang làm (activeQuest) và Sự kiện cốt truyện hiện tại (original_timeline) trong thẻ <world_state_11>.
   - Khi (và CHỈ KHI) diễn biến trong <content> của lượt hiện tại đã giải quyết trọn vẹn mục tiêu cốt lõi của Nhiệm vụ hoặc Sự kiện cốt truyện (bao gồm cả yếu tố tương đương hợp lý), bạn BẮT BUỘC phải xuất yêu cầu xác nhận hoàn thành vào bên trong thẻ <update_data> để AI Thiên Đạo Sync (Tag Extractor) kiểm duyệt và chốt trạng thái.
   - TUYỆT ĐỐI KHÔNG tự xuất tag ngoặc vuông [QUEST_COMPLETED] hay [EVENT_COMPLETE] ở chế độ thường (chỉ dùng thẻ XML mô tả hoặc ngôn ngữ tự nhiên rõ ràng trong <update_data>).

2. ĐỊNH DẠNG BẮT BUỘC TRONG <update_data>:
   - Đối với Nhiệm vụ (Quest):
     <quest_completed title="Tên chính xác của nhiệm vụ" reasoning="Tóm tắt bằng chứng cụ thể đã xảy ra trong lời kể" />
     (Hoặc ngôn ngữ tự nhiên: "Cập nhật: hoàn thành nhiệm vụ [Tên nhiệm vụ] vì [bằng chứng thực tế trong lời kể].")
   - Đối với Sự kiện cốt truyện (Timeline Event):
     <event_complete name="Tên chính xác của sự kiện" reasoning="Tóm tắt bằng chứng cụ thể đã xảy ra trong lời kể" />
     (Hoặc ngôn ngữ tự nhiên: "Cập nhật: hoàn thành sự kiện cốt truyện [Tên sự kiện] vì [bằng chứng thực tế trong lời kể].")

3. CHỐT CHẶN CHỐNG XÁC NHẬN ẢO:
   - Cấm đề xuất hoàn thành khi MC mới chỉ nghe đồn, mới lên kế hoạch, hoặc mới đang trên đường đi mà chưa thực sự tương tác/hoàn tất hành động cốt lõi.
   - Nếu nhiệm vụ gồm nhiều chặng dài và mới xong một phần, chỉ ghi tiến độ: "Cập nhật: tiến độ nhiệm vụ [Tên nhiệm vụ] đạt [X/Y] vì [chi tiết vừa làm]."
================
   </luat_xac_nhan_hoan_thanh_+quy_tac_xac_nhan_nhiem_vu_cot_truyen>
</quy_tac_xac_nhan_nhiem_vu_cot_truyen>
`;
