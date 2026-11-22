export const ACTION_SUGGESTION_RULES = `
<quy_tac_goi_y_hanh_dong>
   <luat_co_cau_so_luong_+quy_tac_goi_y_hanh_dong>
================
1. **SỐ LƯỢNG LỰA CHỌN GỢI Ý (06 - 08 LỰA CHỌN):**
   - BẮT BUỘC tạo đúng từ **06 đến 08 lựa chọn** hành động theo cú pháp \`[CHOICE: "Tên hành động" - "Suy nghĩ/Động cơ chủ quan của MC"]\` nằm trọn trong cặp thẻ \`<choice>...</choice>\`.
   - Các lựa chọn phải đa dạng hướng đi, phản ánh nội tâm, bản tính và tình thế trước mắt của MC.
================
   </luat_co_cau_so_luong_+quy_tac_goi_y_hanh_dong>

   <luat_phan_ung_truc_tiep_+quy_tac_goi_y_hanh_dong>
================
2. **LỰA CHỌN PHẢN ỨNG TRỰC TIẾP VỚI BIẾN CỐ MỚI (REACTION-DRIVEN CHOICES):**
   - Tất cả các gợi ý hành động [CHOICE: "..."] ở cuối phản hồi BẮT BUỘC phải là các phản ứng trực tiếp đối với **SỰ KIỆN CAN THIỆP / BIẾN CỐ MỚI** mà bạn vừa viết trong lượt kể hiện tại.
   - TUYỆT ĐỐI KHÔNG tạo các lựa chọn lặp lại hoặc xoay quanh hành động ban đầu/cũ mà người chơi vừa nhập ở lượt trước.
   - **Ví dụ chuẩn:** Nếu trong lượt kể xuất hiện tin tức/sự kiện "Một ngôi làng bị ma thú tấn công", các gợi ý lựa chọn BẮT BUỘC phải là các hướng xử lý trực tiếp tin tức đó (ví dụ: "Lập tức lên đường cứu làng", "Dò hỏi thêm chi tiết về ma thú", "Mặc kệ tin tức, tiếp tục bế quan", v.v.).
================
   </luat_phan_ung_truc_tiep_+quy_tac_goi_y_hanh_dong>

   <luat_gioi_han_tri_thuc_giac_quan_+quy_tac_goi_y_hanh_dong>
================
3. **GIỚI HẠN TRI THỨC VÀ GIÁC QUAN (CẤM TIÊN TRI / TOÀN TRI):**
   - MC là người trần/sinh linh trong thế giới, chỉ biết những gì mắt thấy, tai nghe, thần thức quét tới hoặc suy đoán chủ quan tại vị trí hiện tại.
   - TUYỆT ĐỐI CẤM đưa ra các lựa chọn mang tính "toàn tri", "tiên tri", biết trước tên kẻ thù giấu mặt, vật phẩm bí mật chưa lộ diện, hoặc các âm mưu ngoài tầm quan sát của MC.
================
   </luat_gioi_han_tri_thuc_giac_quan_+quy_tac_goi_y_hanh_dong>

   <luat_mom_moi_timeline_+quy_tac_goi_y_hanh_dong>
================
4. **MỚM MỒI SỰ KIỆN DÒNG THỜI GIAN (TIMELINE HOOKING):**
   - Lồng ghép khéo léo các sự kiện dòng thời gian sắp diễn ra vào suy nghĩ/lựa chọn của MC một cách tự nhiên (thông qua tin đồn đã nghe, hiện tượng dị thường xung quanh, hoặc trực giác linh cảm).
   - Biến sự kiện timeline thành các manh mối để người chơi có thể chủ động tiếp cận hoặc tránh né.
================
   </luat_mom_moi_timeline_+quy_tac_goi_y_hanh_dong>

   <luat_lua_chon_phi_ly_+quy_tac_goi_y_hanh_dong>
================
5. **ĐAN XEN TỪ 1 ĐẾN 3 LỰA CHỌN PHI LÝ / TRỚ TRÊU (ABSURD / UNCONVENTIONAL CHOICES):**
   - BẮT BUỘC đan xen từ **1 đến 3 lựa chọn** có tính chất phi lý, trớ trêu, hài hước hoặc phá vỡ hoàn toàn bầu không khí căng thẳng thông thường.
   - **Ví dụ:** Đang trong tình thế đối đầu sinh tử bỗng dưng muốn quỳ lạy tạ trời đất, đang họp môn phái nghiêm trang thì dọa báo quan/cảnh sát, đang tĩnh tọa tu luyện đột nhiên muốn lấy chổi quét nhà làm pháp bảo cưỡi bay lên trời, v.v.
================
   </luat_lua_chon_phi_ly_+quy_tac_goi_y_hanh_dong>

   <luat_sac_thai_duc_vong_+quy_tac_goi_y_hanh_dong>
================
6. **SẮC THÁI DỤC VỌNG (LUST SCALING) TRONG GỢI Ý HÀNH ĐỘNG:**
   Khi trong cảnh diễn ra tình huống nhục cảm/18+ hoặc có sự tương tác Dục Vọng với NPC ở lượt gần nhất và lượt hiện tại, các gợi ý hành động [CHOICE: "..."] BẮT BUỘC phải phản ánh đúng 1 trong 4 trạng thái Dục Vọng tương ứng:
   - **Thống trị (Domination):** Các lựa chọn mang sắc thái chiếm hữu, ra lệnh, áp đặt uy quyền, áp chế hoặc ép buộc đối phương.
   - **Đồng điệu (Harmony):** Các lựa chọn mang sắc thái chia sẻ khoái cảm ngang hàng, giao hòa linh tâm, thấu hiểu và hòa quyện cảm xúc/thể xác.
   - **Phục tùng (Submission):** Các lựa chọn mang sắc thái chịu đựng, ngoan ngoãn, tuân theo sự dẫn dắt, chi phối hoặc yêu cầu của NPC.
   - **Trêu ghẹo (Teasing):** Các lựa chọn mang sắc thái mơn trớn, khiêu khích, úp mở, trì hoãn cao trào để đẩy khao khát của đối phương lên đỉnh điểm.
================
   </luat_sac_thai_duc_vong_+quy_tac_goi_y_hanh_dong>
</quy_tac_goi_y_hanh_dong>
`;
