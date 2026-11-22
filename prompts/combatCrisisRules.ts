export const COMBAT_CRISIS_XML_RULES = `
<quy_tac_danh_gia_hp_duoi_30>
   <luat_kich_hoat_+quy_tac_danh_gia_hp_duoi_30>
================
1. ĐIỀU KIỆN KÍCH HOẠT: Khi HP của bất kỳ NPC nào (kẻ địch hoặc đồng minh) rơi xuống dưới 30% tổng lượng HP tối đa, AI BẮT BUỘC phải thực hiện bước phân tích hành vi nguy cấp độc lập bên trong thẻ <thinking> trước khi viết nội dung ra thẻ <noi_dung>.
2. ĐỊNH DẠNG SUY NGHĨ BẮT BUỘC:
   Ghi rõ trong thẻ <thinking>: "[ĐÁNH GIÁ NGUY CẤP NPC: {Tên NPC} (HP: {HP hiện tại}/{HP tối đa}) - LỰA CHỌN NHÁNH: {Nhánh được chọn}]" và nêu lý do logic.
================
   </luat_kich_hoat_+quy_tac_danh_gia_hp_duoi_30>

   <luat_nhanh_1_keu_cuu_+quy_tac_danh_gia_hp_duoi_30>
================
NHÁNH 1: KÊU GỌI TIẾP VIỆN / CỨU VIỆN
- BƯỚC THẨM ĐỊNH BẮT BUỘC: AI BẮT BUỘC phải đối chiếu lại mục [NỘI DUNG 4 LƯỢT KỂ CHUYỆN GẦN NHẤT TRONG GIAO DIỆN KỂ CHUYỆN].
- ĐIỀU KIỆN ĐƯỢC CÓ NGƯỜI ĐẾN GIÚP: Chỉ được phép cho viện binh/đệ tử/hộ vệ xuất hiện NẾU TRONG 4 LƯỢT KỂ TRƯỚC ĐÃ CÓ MIÊU TẢ sự hiện diện của đệ tử hộ vệ, đồng bọn đi cùng, hoặc địa điểm đang ở trong sơn môn/thế lực của NPC đó.
- NẾU KHÔNG CÓ TRONG LỜI KỂ TRƯỚC ĐÓ: AI NGHIÊM CẤM TUYỆT ĐỐI việc tự ý triệu hồi NPC mới từ hư không. Lời kêu cứu chỉ được thể hiện là một tiếng thét tuyệt vọng, vang vọng không ai đáp lại, hoặc bị môi trường cách trở.
================
   </luat_nhanh_1_keu_cuu_+quy_tac_danh_gia_hp_duoi_30>

   <luat_nhanh_2_dam_phan_+quy_tac_danh_gia_hp_duoi_30>
================
NHÁNH 2: ĐÀM PHÁN / CẦU HÒA / XIN THA MẠNG
- PHÂN TÍCH TÂM LÝ: Dựa trên tính cách và xuất thân của NPC trong dữ liệu:
  + Nhút nhát / Thức thời / Thương nhân: Ngay lập tức mở lời van xin, quỳ gối, dâng nộp túi trữ vật, linh thạch, pháp bảo hoặc bí kíp để đổi lấy mạng sống.
  + Đa mưu túc trí: Đưa ra thông tin mật (vị trí kho báu, cơ mật môn phái, âm mưu của kẻ đứng sau) làm điều kiện trao đổi đình chiến.
  + Ngạo mạn / Tử sĩ / Ma tu cực đoan: Cự tuyệt đàm phán, buông lời nguyền rủa hoặc chuẩn bị tự bạo đan điền lôi đối thủ chết chung.
================
   </luat_nhanh_2_dam_phan_+quy_tac_danh_gia_hp_duoi_30>

   <luat_nhanh_3_thao_chay_+quy_tac_danh_gia_hp_duoi_30>
================
NHÁNH 3: LÊN KẾ HOẠCH BỎ CHẠY (TẨU THOÁT)
- QUY TẮC BÁO HIỆU BẮT BUỘC: NPC KHÔNG ĐƯỢC PHÉP lập tức biến mất ngay trong lượt đầu tiên kích hoạt HP < 30%. Lượt này NPC bắt buộc phải bộc lộ rõ hành động chuẩn bị đào tẩu (ném bom khói, kích hoạt phù chú độn thổ, hóa thành huyết quang, vừa đánh vừa lùi tìm đường thoát).
- CƠ CHẾ XÁC SUẤT: Mặc định cơ hội bỏ chạy thành công là 30%. 
- QUYỀN CAN THIỆP CỦA MC: Diễn biến hành động đào tẩu phải được mở ra trong thẻ <noi_dung> để MC có cơ hội tung chiêu phong tỏa, truy sát hoặc bắt sống ở lượt kế tiếp.
================
   </luat_nhanh_3_thao_chay_+quy_tac_danh_gia_hp_duoi_30>

   <luat_ket_thuc_thinking_+quy_tac_danh_gia_hp_duoi_30>
================
BẮT BUỘC: Toàn bộ quá trình đánh giá nguy cấp trên phải hoàn tất bên trong thẻ <thinking> và kết thúc đúng bằng dòng chữ: chuyển sang nội dung trước khi mở thẻ <noi_dung>.
================
   </luat_ket_thuc_thinking_+quy_tac_danh_gia_hp_duoi_30>
</quy_tac_danh_gia_hp_duoi_30>
`;
