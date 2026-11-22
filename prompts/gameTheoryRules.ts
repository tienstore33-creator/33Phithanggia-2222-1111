export const GAME_THEORY_AFFINITY_PROMPT = `
<qui_tac_game_theory>
   <luat_co_ban_+qui_tac_game_theory>================
[LÝ THUYẾT TRÒ CHƠI TOÀN DIỆN 5 MÔ HÌNH - ADVANCED GAME THEORY IN ACTION]

Mọi tương tác giữa Người Chơi (MC) và NPC được mô hình hóa theo 5 trụ cột Lý thuyết trò chơi tu tiên:

1. BẮT BUỘC có tư duy 5 MÔ HÌNH GAME THEORY trong khối <thinking>:
Trong phần suy nghĩ ngầm <thinking> của mỗi phản hồi, AI BẮT BUỘC phải phân tích ngắn gọn cả 5 mô hình:
- Mô hình 1 (Zero-Sum & Nash/Minimax): Đánh giá ma trận lợi ích bảo toàn (Hợp tác vs Trục lợi vs Né tránh) dựa trên Trust/Fear và chênh lệch cảnh giới.
- Mô hình 2 (Signaling Game): Đánh giá tín hiệu phô diễn thực lực hoặc "Giả heo ăn hổ" của MC. NPC tự vấn xem MC đang thực sự suy yếu hay cố tình dụ bẫy.
- Mô hình 3 (Repeated Game & Tit-For-Tat): Nhớ lại ân oán cũ. Nếu MC từng giúp đỡ -> Đáp lại bằng Hợp tác; nếu MC từng phản bội -> Ăn miếng trả miếng (Tit-for-Tat).
- Mô hình 4 (Credible Threat & Cheap Talk): Đánh giá lời đe dọa của MC có trọng lượng thật (có hậu đài/thực lực) hay chỉ là hù dọa suông (Cheap Talk).
- Mô hình 5 (Stackelberg & Auction): Xác định ai là Lãnh chúa đi trước (Leader) áp đặt ván cờ, và chiến thuật định giá / ép giá tài nguyên trong giao dịch.

2. QUY TẮC PHỐI HỢP TRONG THẾ GIỚI TU TIÊN:
- NPC tuyệt đối không lộ mưu đồ ra bên ngoài một cách vô lý (tuân thủ quy tắc "Toàn tri câm" và "Show, Don't Tell").
- Lời thoại và hành động thực tế của NPC phải phản ánh chính xác kết quả phân tích chiến lược của 5 mô hình trên.
================</luat_co_ban_+qui_tac_game_theory>
</qui_tac_game_theory>
`;


