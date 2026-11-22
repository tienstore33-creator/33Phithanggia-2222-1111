/**
 * Quy tắc đặt tên cá nhân và xác định tu vi cho NPC dành cho AI Quản Trò trong thẻ <thinking>
 * Nằm ngoài <qui_trinh_tham_dinh> để luôn được duy trì dù bật/tắt Preset.
 */
export const NAMING_TASK_RULE = `
<qui_tac_dinh_danh>
   <luat_ban_ten_va_tu_vi_+qui_tac_dinh_danh>
      <ten_ca_nhan_+quy_tac_dat_ten>
================
⚠️ QUY TẮC BẮT BUỘC TRONG THẺ <thinking>: KIỂM TRA, BAN TÊN RIÊNG VÀ THIẾT LẬP TU VI CHO NPC (<ten_ca_nhan>)

Dù bạn đang áp dụng bất kỳ Preset hay quy trình thẩm định nào, ngay tại VỊ TRÍ ĐẦU TIÊN CỦA THẺ <thinking> (ngay sau phần Phân Tích Logic Thiện Cảm và trước khi bắt đầu Bước [1] hoặc bất kỳ phân tích nào khác), bạn BẮT BUỘC phải tự suy nghĩ, tra cứu bối cảnh để thực hiện bước kiểm tra định danh nhân vật + thiết lập tu vi/cảnh giới cho NPC và viết trực tiếp ra nội dung này bằng văn bản chuẩn xác.

⚠️ QUY TẮC TUYỆT ĐỐI: Mục Ban Tên Riêng NÀY CHỈ ÁP DỤNG CHO NPC VÔ DANH (nhân vật phụ chưa có tên). TUYỆT ĐỐI CẤM ban tên, đặt tên mới hoặc tạo thẻ đổi tên cho NHÂN VẬT CHÍNH (MC). MC đã có tên cố định từ hệ thống.

Các bước thực hiện tư duy định danh và thiết lập tu vi:
1. Liệt kê toàn bộ các nhân vật dự kiến sẽ xuất hiện hoặc được nhắc tới trong lời kể lượt này.
2. Kiểm tra tên gọi hiện tại và trạng thái tu vi của họ:
   - Nếu phát hiện nhân vật chỉ có danh xưng chung chung, danh xưng tập thể, chức danh hoặc mô tả ngoại hình (Ví dụ: "Tên cướp B", "Trưởng lão Hoàng Phong Cốc", "Gã mặt sẹo", "Nữ tu sĩ", "Đại hán áo xám"...):
   - Bạn PHẢI tự nhận thức: Đây chưa phải là một tên riêng chuẩn phong cách của bối cảnh game (Tiên Hiệp/Tu Tiên/Scifi/Fantasy/Phương Tây/Đô Thị/...).
   - Tiến hành tra cứu/sáng tạo một tên riêng mới phù hợp với bối cảnh game (Ví dụ: "Tên cướp B" -> "Tôn Lang"; "Trưởng lão Hoàng Phong Cốc" -> "Phù Trưởng Lão - Phù Thiên Đao").
3. BẮT BUỘC XÁC ĐỊNH TU VI/CẢNH GIỚI (MỘT LẦN DUY NHẤT KHI NPC ĐƯỢC TẠO RA HOẶC ĐỊNH DANH LẦN ĐẦU):
   - CẢNH GIỚI CHỈ ĐƯỢC THIẾT LẬP 1 LẦN DUY NHẤT khi NPC vừa xuất hiện/được khởi tạo định danh lần đầu. TUYỆT ĐỐI KHÔNG tự ý thay đổi, trồi sụt hoặc tái định danh lại tu vi của NPC đã có tên và tu vi trong bộ nhớ/bối cảnh lượt trước (trừ khi có sự kiện đột phá/trọng thương diễn ra trong cốt truyện).
   - Ánh xạ tu vi/cảnh giới dựa trên bối cảnh:
     + Nếu game có nguyên tác rõ ràng (Ví dụ: Phàm Nhân Tu Tiên thời kỳ đầu): Dựa vào nguyên tác để gán cảnh giới logic với vị thế. (Ví dụ: Bọn cướp đường tán tu thường dao động ở Luyện Khí/Trúc Cơ -> gán Luyện Khí 8 Tầng; Trưởng lão Hoàng Phong Cốc như Lôi Vạn Hạc, Lý Hóa Nguyên đều là Kết Đan Kỳ -> gán Kết Đan 4 Tầng).
     + Nếu game chưa xác định rõ nguyên tác: AI được toàn quyền suy đoán và quyết định tu vi của nhân vật cho phù hợp với danh sách đại cảnh giới, tiểu cảnh giới hiện có của thế giới game.
4. Lập kế hoạch lồng ghép tên mới và tu vi vào lời kể một cách tự nhiên (qua lời thoại tự xưng, lời khai báo, xưng danh giữa các NPC hoặc qua đoạn miêu tả ngắn về khí tức/tiểu sử).

Cấu trúc trình bày bắt buộc phải viết ra trong thẻ <thinking> (Mẫu chuẩn):
- Các nhân vật sẽ đưa vào lời kể: [Danh sách nhân vật]
+ Tra cứu bối cảnh nguyên tác & vị thế để định vị sức mạnh (VD: Phàm Nhân Tu Tiên - Cướp đường thường chỉ ở Luyện Khí/Trúc Cơ, Trưởng lão môn phái thường ở Kết Đan kỳ).
+ Dựa theo tra cứu/bối cảnh, tôi sẽ ban tên riêng và thiết lập tu vi (1 lần duy nhất cho NPC mới) như sau:
  - "[Tên cũ 1]": [Tên riêng mới 1] - Cảnh giới: [Tu vi tương ứng]
  - "[Tên cũ 2]": [Tên riêng mới 2] - Cảnh giới: [Tu vi tương ứng]
+ Kế hoạch đưa tên và tu vi vào lời kể tự nhiên:
  - "[Tên cũ 1]": [Mô tả ngắn gọn cách xuất hiện/tự xưng tên và thể hiện khí tức tu vi trong cốt truyện].
================
      </ten_ca_nhan_+quy_tac_dat_ten>

      <ten_ca_nhan_+example>
================
- Các nhân vật sẽ đưa vào lời kể: Hình Hàm, đệ tử A, Tên cướp B, Trưởng Lão Hoàng Phong Cốc
+ Tra cứu bối cảnh nguyên tác (Phàm Nhân Tu Tiên thời kỳ đầu): Đệ tử ngoại môn/tên cướp thường thuộc tầng thấp Luyện Khí, Trưởng lão môn phái thuộc Kết Đan Kỳ.
+ Phát hiện tên chung chung chưa có tên riêng và tu vi. Tiến hành ban tên & thiết lập tu vi (1 lần duy nhất):
  - "[đệ tử A]": [Phù Thung] - Cảnh giới: [Luyện Khí 5 Tầng]
  - "[Tên cướp B]": [Tôn Lang] - Cảnh giới: [Luyện Khí 8 Tầng]
  - "[Trưởng Lão Hoàng Phong Cốc]": [Phù Thiên Đao] - Cảnh giới: [Kết Đan 4 Tầng]
+ Kế hoạch đưa tên và tu vi vào lời kể tự nhiên:
  - "[đệ tử A]": [Đệ tử A tên thật là Phù Thung, tu vi Luyện Khí 5 Tầng. Tu sĩ trẻ tuổi dáng người mảnh khảnh thuộc đội Chấp pháp...].
  - "[Tên cướp B]": [Tên cướp B tự xưng Tôn Lang, bộc phát linh lực Luyện Khí 8 Tầng vung đao chặn đường...].
  - "[Trưởng Lão Hoàng Phong Cốc]": [Trưởng Lão Ngoại Môn tên Phù Thiên Đao, tu sĩ Kết Đan 4 Tầng uy áp trầm hùng, vuốt râu xưng danh...].
================
      </ten_ca_nhan_+example>
   </luat_ban_ten_va_tu_vi_+qui_tac_dinh_danh>
</qui_tac_dinh_danh>
`;
