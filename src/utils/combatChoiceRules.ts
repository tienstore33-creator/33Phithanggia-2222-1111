/**
 * combatChoiceRules.ts
 * 
 * Hướng dẫn AI tạo 10-12 lựa chọn hành động đa dạng trong trận đánh
 */

export const COMBAT_CHOICE_INSTRUCTIONS = `
[QUY TẮC BẮT BUỘC VỀ LỰA CHỌN HÀNH ĐỘNG (CHOICE) TRONG TRẬN ĐÁNH]
Ở cuối phản hồi, AI BẮT BUỘC phải cung cấp từ 10 đến 12 gợi ý lựa chọn hành động tiếp theo cho Người Chơi, bao bọc toàn bộ danh sách lựa chọn trong cặp thẻ <choice>...</choice>.

Mỗi lựa chọn phải dùng định dạng: [CHOICE: "Nội dung lựa chọn"]

Yêu cầu về nội dung 10-12 lựa chọn:
1. Đa dạng phong cách: từ hợp lý, chiến thuật, tấn công, phòng ngự, hỗ trợ, đến thương lượng, thuyết phục, tâm lý chiến, tẩu thoát.
2. Bao gồm các tùy chọn bất ngờ, hỗn loạn, phi logic và hài hước (ví dụ: "quỳ xuống xin tha", "hỏi đối phương về thời tiết", "ném đất cát vào mặt kẻ thù", "cố gắng thuyết phục đối phương kết bái huynh đệ").
3. Mỗi lựa chọn trên 1 dòng.

Ví dụ định dạng ở cuối phản hồi:
<choice>
[CHOICE: "Tận dụng cơ hội, tung chiêu Kiếm Tinh dồn toàn lực vào ngực đối thủ"]
[CHOICE: "Bật Hộ Thể Linh Lực lùi lại phòng ngự đòn phản công"]
[CHOICE: "Quỳ xuống giả vờ mệt mỏi kiệt sức để dụ đối phương lơ đễnh"]
[CHOICE: "Lớn tiếng hỏi: 'Thời tiết hôm nay thật đẹp, sao lại phải chém chém giết giết?'"]
[CHOICE: "Nhanh tay rút Hồi Xuân Đan ra nuốt chửng để hồi phục"]
[CHOICE: "Thi triển Thân Pháp tẩu thoát khỏi chiến trường"]
[CHOICE: "Tung ám khí chứa kịch độc vào vết thương đối thủ"]
[CHOICE: "Đề nghị: 'Nếu ngươi rút lui, ta chia đôi bảo vật thu được!'"]
[CHOICE: "Nhặt một nắm đất cát dưới chân ném thẳng vào mắt kẻ thù"]
[CHOICE: "Đọc thần chú triệu hồi Linh Thú trợ chiến"]
[CHOICE: "Dồn toàn bộ MP tạo cú Nổ Linh Lực sinh tử"]
[CHOICE: "Đăng nhập thần thức tra xét điểm yếu đối phương"]
</choice>
`;
