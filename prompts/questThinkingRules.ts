/**
 * Quy tắc thẩm định tiến độ nhiệm vụ cốt truyện và sự kiện timeline dành cho Thanh tra Yggdrasil trong <thinking>.
 * Tách riêng thành module độc lập để tái sử dụng cho cả promptTaskHelpers và promptManager.
 */
export const buildQuestThinkingRule = (isSuperManualMode: boolean = false): string => {
  const outputFormatInstruction = isSuperManualMode
    ? `xuất trực tiếp tag '[QUEST_COMPLETED: title="Tên chính xác nhiệm vụ", isCompleted="true", reasoning="Bằng chứng thực tế trong lời kể"]' (hoặc '[EVENT_COMPLETE: name="Tên chính xác sự kiện", isCompleted="true", reasoning="Bằng chứng thực tế trong lời kể"]') vào trong thẻ <update_data>`
    : `xuất thẻ XML '<quest_completed title="Tên chính xác nhiệm vụ" reasoning="Bằng chứng thực tế trong lời kể" />' (hoặc '<event_complete name="Tên chính xác sự kiện" reasoning="Bằng chứng thực tế trong lời kể" />') vào trong thẻ <update_data>`;

  const exampleActionOutput = isSuperManualMode
    ? `[QUEST_COMPLETED: title="[Cốt Truyện] Đi gặp Hàn Mãnh", isCompleted="true", reasoning="MC đã tiến hành hành động đi đến gặp Hàn Mãnh."]`
    : `<quest_completed title="[Cốt Truyện] Đi gặp Hàn Mãnh" reasoning="MC đã tiến hành hành động đi đến gặp Hàn Mãnh." />`;

  return `
<quy_tac_tham_dinh_nhiem_vu>
  <luat_yggdrasil_gate_+quy_tac_tham_dinh_nhiem_vu>
================
⚠️ CỔNG THẨM ĐỊNH NHIỆM VỤ BẮT BUỘC (YGGDRASIL QUEST AUDIT GATE):
Trong mọi lượt phản hồi có <thinking>, thanh tra Yggdrasil BẮT BUỘC phải đọc nội dung và phán đoán tiến độ nhiệm vụ cốt truyện & sự kiện timeline:

1. QUY TẮC ĐÁNH GIÁ (QUAN TRỌNG):
   - Nếu nhiệm vụ **chưa hoàn thành**, Yggdrasil chỉ cần kết luận đơn giản: **"Phán quyết: Nhiệm vụ chưa hoàn thành."** (Không suy diễn, không tự bịa mốc tiến triển).
   - **ĐẶC BIỆT ĐỐI VỚI CÁC NHIỆM VỤ MƠ HỒ (NHƯ 'HỌC', 'ĐI ĐẾN', 'ĐÁNH',...):** 
     Chỉ cần Nhân vật chính (MC) **đã tiến hành hành động** đó (ví dụ: bắt đầu ngồi xuống học, bắt đầu di chuyển đi đến địa điểm, hoặc tung đòn đánh), Yggdrasil PHẢI xác nhận nhiệm vụ thành công (**HOÀN THÀNH**), **TUYỆT ĐỐI KHÔNG** bắt buộc phải chờ đến khi có kết quả hoàn thành hay kết cục mỹ mãn. Ngay khi MC bắt tay vào hành động là đủ điều kiện chốt.

2. MẪU ĐỊNH DẠNG 1 DÒNG CHUẨN (FEW-SHOT ĐỐI XỨNG - BẮT BUỘC DÙNG TIỀN TỐ [YGGDRASIL_QUEST_AUDIT]):
   - Mẫu 1 (Khi MC đã tiến hành hành động đối với nhiệm vụ mơ hồ hoặc đạt mốc):
     - Yggdrasil: "[YGGDRASIL_QUEST_AUDIT] | Nhiệm vụ: '[Cốt Truyện] Đi gặp Hàn Mãnh' | Bằng chứng: MC đã tiến hành di chuyển đến ngõ khuất để gặp Hàn Mãnh | Phán quyết: HOÀN THÀNH -> Bắt buộc xuất ${exampleActionOutput} trong <update_data>."
   - Mẫu 2 (Khi chưa hoàn thành):
     - Yggdrasil: "[YGGDRASIL_QUEST_AUDIT] | Nhiệm vụ: '[Cốt Truyện] Đột phá Trúc Cơ Kỳ' | Bằng chứng: MC chưa thực hiện bế quan hay hấp thu đan dược | Phán quyết: Nhiệm vụ chưa hoàn thành."
================
  </luat_yggdrasil_gate_+quy_tac_tham_dinh_nhiem_vu>
</quy_tac_tham_dinh_nhiem_vu>
`;
};
