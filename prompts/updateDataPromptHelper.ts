import { SUPER_MANUAL_TAG_DIRECTIVES } from './superManualTagDirectives';
import { STORY_QUEST_COMPLETION_RULES } from './storyQuestCompletionRules';

/**
 * Xây dựng chỉ thị cập nhật dữ liệu (update_data) dựa trên chế độ Siêu Mạt Pháp.
 * Tách biệt cơ học để tránh làm phình to các file prompt chính.
 */
export function buildUpdateDataInstruction(isSuperManualMode: boolean, isCultivationEnabled: boolean = true): string {
  if (isSuperManualMode) {
    return SUPER_MANUAL_TAG_DIRECTIVES;
  }

  // Chế độ thường: AI chính mô tả bằng ngôn ngữ tự nhiên để Fast Agent (Thiên Đạo Sync) bóc tách.
  return `
4. **Cập nhật dữ liệu:** Toàn bộ yêu cầu cập nhật dữ liệu PHẢI được viết bằng ngôn ngữ tự nhiên bên trong thẻ <update_data> ở cuối cùng. Bạn tuyệt đối KHÔNG tự viết các tag dạng ngoặc vuông \`[TAG_NAME: ...]\`. AI Thiên Đạo Sync đồng bộ dữ liệu sẽ tự động bóc tách các dòng chữ ngôn ngữ tự nhiên này của bạn để tạo ra tag dữ liệu chuẩn xác cho game.
   - QUY TẮC NÔ LỆ/TÙ NHÂN: Khi có tình tiết biến NPC thành nô lệ, tù nhân thì PHẢI thêm vào trong thẻ <update_data> nội dung về việc này (VD: "Cập nhật: NPC Rem thành nô lệ của người chơi", "Cập nhật: NPC Ram thành tù nhân của người chơi").
   - QUY TẮC ĐỔI TÊN NPC: Khi có tình tiết nhân vật đổi tên hoặc tiết lộ tên thật (ví dụ từ "Người áo xám" sang "Lộ Thư"), PHẢI ghi rõ yêu cầu đổi tên trong thẻ <update_data> (VD: "Cập nhật: Đổi tên nhân vật từ 'Người áo xám' thành 'Lộ Thư'").
   - QUY TẮC HOÀN THÀNH NHIỆM VỤ / SỰ KIỆN: Khi diễn biến cốt truyện đã giải quyết xong mục tiêu cốt lõi, PHẢI đề xuất xác nhận hoàn thành vào trong thẻ <update_data> (<quest_completed> hoặc <event_complete> hoặc dạng câu tự nhiên).
   
   <phan_chia_vai_tro_+instruction_18>
   ================
   - Hãy mô tả rõ các yêu cầu cập nhật dưới dạng ngôn ngữ tự nhiên cực kỳ dễ hiểu.
   Ví dụ:
   Cập nhật: tăng 5 độ thiện cảm cho Hình Hàm.
   Cập nhật: di chuyển Hình Hàm đến Luyện Khí Đường.
   ${isCultivationEnabled ? 'Cập nhật: Tăng 100 điểm kinh nghiệm luyện khí.' : ''}
   Cập nhật: hoàn thành nhiệm vụ [Tên nhiệm vụ] vì [bằng chứng cụ thể trong lời kể].
   Cập nhật: hoàn thành sự kiện cốt truyện [Tên sự kiện] vì [bằng chứng cụ thể trong lời kể].
   ================
   </phan_chia_vai_tro_+instruction_18>

   ${STORY_QUEST_COMPLETION_RULES}
`;
}
