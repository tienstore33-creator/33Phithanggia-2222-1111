
import { CULTIVATION_FORMAT_RULES } from "../constants/cultivationRules";

/**
 * Generates a prompt for the AI to describe the character's exit from cultivation.
 * @param duration The number of days cultivated.
 * @param history The last 10 turns of game history.
 * @param ragContext Relevant RAG context for the current location and situation.
 * @returns A formatted prompt string.
 */
export const generateCultivationExitPrompt = (
    duration: number,
    history: string,
    ragContext: string,
    genre: string = "Tu Tiên"
): string => {
    return `
Bạn là một AI Game Master (GM) chuyên nghiệp, linh hoạt biến hóa theo thể loại bối cảnh bách khoa toàn thư của câu chuyện.
Thể loại hiện đại/kiếm hiệp/huyền huyễn/khoa huyễn/tu tiên đang chơi là: **${genre}**.
Người chơi vừa hoàn thành quá trình bế quan tu luyện/thiền định/nghiên cứu trong **${duration} ngày**.

Dựa trên bối cảnh lịch sử gần đây và thông tin thế giới, hãy viết một lời kể (narration) chi tiết về sự kiện "Xuất Quan" này.

### BỐI CẢNH LỊCH SỬ (10 LƯỢT GẦN NHẤT):
${history}

### THÔNG TIN THẾ GIỚI (RAG CONTEXT):
${ragContext}

### YÊU CẦU NỘI DUNG LỜI KỂ:
1. **Trạng thái MC:** Mô tả cảm giác nội tại của nhân vật chính sau khi bế quan (sự thay đổi về linh lực, tâm cảnh, hoặc một ngộ tính mới).
2. **Sự thay đổi môi trường:** Mô tả cảnh vật xung quanh đã thay đổi thế nào sau ${duration} ngày (ví dụ: rêu phong, bụi bặm, hoặc linh khí xung quanh bị hút cạn).
3. **NPC & Thế giới:** Nhắc đến việc các NPC xung quanh đã làm gì hoặc thế giới bên ngoài đã có biến động nhỏ nào trong thời gian MC vắng mặt.
4. **Sự kiện tức thì:** Kết thúc lời kể bằng một cuộc gặp gỡ hoặc một phản ứng tức thì từ một NPC gần đó khi thấy MC xuất quan.

### QUY TẮC ĐỊNH DẠNG:
${CULTIVATION_FORMAT_RULES}

### CẤU TRÚC PHẢN HỒI:
Phản hồi của bạn phải bao gồm:
1. Lời kể (Narration) giàu hình ảnh, đậm chất và giữ vững văn phong đặc trưng của thể loại **${genre}**.

LƯU Ý QUAN TRỌNG:
- Tuyệt đối KHÔNG viết bất kỳ tag hệ thống nào (như [STATS_UPDATE]) vào phản hồi. Việc cập nhật dữ liệu sẽ do một hệ thống khác xử lý dựa trên lời kể của bạn.
`;
};
