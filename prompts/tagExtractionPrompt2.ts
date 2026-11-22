export const TAG_EXTRACTOR_QUEST_SYNC_RULES = `
<quy_tac_dong_bo_hoan_thanh_tu_ai_chinh_+analysis_rules_9>
   <luat_tham_dinh_de_xuat_+quy_tac_dong_bo_hoan_thanh_tu_ai_chinh>
================
- CƠ CHẾ PHỐI HỢP 2 TẦNG (PROPOSE & VERIFY):
  1. ĐỌC TÍN HIỆU TỪ <update_data>: Trước tiên, hãy quét kỹ thẻ <update_data> của AI chính xem có xuất hiện yêu cầu hoàn thành nhiệm vụ (<quest_completed ... /> hoặc "Cập nhật: hoàn thành nhiệm vụ...") hay sự kiện cốt truyện (<event_complete ... /> hoặc "Cập nhật: hoàn thành sự kiện...") hay không.
  2. THẨM ĐỊNH CHÉO BẰNG CHỨNG (GATEKEEPER):
     - Nếu AI chính CÓ gửi yêu cầu hoàn thành trong <update_data>: Hãy đối chiếu lý do (reasoning) với nội dung lời kể thực tế (<content>) và mục tiêu trong <active_quests> / <original_timeline_event>.
     - Nếu ĐÚNG SỰ THẬT (lời kể thực sự đã hoàn tất hành động/sự kiện cốt lõi): Lập tức CHỐT trạng thái bằng cách xuất tag "[QUEST_COMPLETED: title=\"...\", isCompleted=\"true\", reasoning=\"...\"]" hoặc "[EVENT_COMPLETE: name=\"...\", isCompleted=\"true\", reasoning=\"...\"]" vào mảng "tags".
     - Nếu AI chính ĐỀ XUẤT SAI / CHƯA ĐỦ BẰNG CHỨNG (MC mới dự định, chưa tương tác thực tế): BÁC BỎ yêu cầu hoàn thành, chỉ xuất "[QUEST_CHECK]" hoặc "[EVENT_CHECK]" / "[QUEST_UPDATED]" tương ứng.
  3. TRƯỜNG HỢP AI CHÍNH QUÊN ĐỀ XUẤT (FALLBACK AN TOÀN):
     - Nếu AI chính không ghi vào <update_data> nhưng trong <content> và lịch sử cho thấy mục tiêu cốt lõi (hoặc hoàn thành hồi tố) rõ ràng đã thỏa mãn 100%, Tag Extractor vẫn giữ quyền chủ động xuất "[QUEST_COMPLETED]" hoặc "[EVENT_COMPLETE]" để không làm kẹt cốt truyện của người chơi.
================
   </luat_tham_dinh_de_xuat_+quy_tac_dong_bo_hoan_thanh_tu_ai_chinh>
</quy_tac_dong_bo_hoan_thanh_tu_ai_chinh>
`;
