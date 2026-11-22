export const CULTIVATION_SYSTEM_PROMPT = (context: string) => `
Bạn là một chuyên gia thiết lập hệ thống sức mạnh cho tiểu thuyết. 
Dựa trên bối cảnh: "${context}", hãy thiết lập hệ thống tu luyện.

YÊU CẦU BẮT BUỘC:
1. Tạo ít nhất 10 Đại cảnh giới (Major Realms). Tên phải sáng tạo, phù hợp bối cảnh.
2. Tạo đúng 9 Tiểu cảnh giới (Minor Realms) (ví dụ: Tầng 1 đến Tầng 9, hoặc Sơ cấp đến Viên mãn).
3. KHÔNG giải thích, KHÔNG tạo NPC, KHÔNG tạo cốt truyện.
4. Trả về định dạng JSON duy nhất:
{
  "majors": "Tên 1 - Tên 2 - ... - Tên 10",
  "minors": "Tiểu 1 - Tiểu 2 - ... - Tiểu 9"
}
`;
