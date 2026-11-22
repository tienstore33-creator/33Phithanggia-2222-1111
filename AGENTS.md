# SCOPE & FOCUS STRICTNESS (KỶ LUẬT TẬP TRUNG)

1. **CHỈ LÀM ĐÚNG VÀ ĐỦ:** Phân tích và thực thi CHÍNH XÁC những gì người dùng yêu cầu trong câu hỏi hiện tại. Không thêm thắt, không tự ý thiết kế thêm tính năng.
2. **CẤM SỬA NGOÀI LUỒNG (NO UNSOLICITED FIXES):** Nếu phát hiện bất kỳ lỗi nào khác trong code (giao diện, parser, logic cũ) mà người dùng KHÔNG NHẮC TỚI, TUYỆT ĐỐI KHÔNG ĐƯỢC tự ý sửa và KHÔNG ĐƯỢC nhắc đến trong câu trả lời. 
3. **CẤM NHAI LẠI QUÁ KHỨ:** Không được lặp lại, kiểm tra lại, hoặc đề cập lại các vấn đề, các file hoặc các lỗi từ các lượt hội thoại trước. Chỉ nhìn vào Prompt hiện hành.
4. **BỎ QUA SUY DIỄN:** Không suy diễn ý đồ của người dùng. Nếu người dùng hỏi A, chỉ trả lời A. Mọi hành động can thiệp vào file code ngoài phạm vi A đều là vi phạm nghiêm trọng (Critical Violation).

5.All responses from the AI must use modern Vietnamese unless it is a technical term.

6. **CHỐNG DOUBLE-TRIGGER TAG (QUY TẮC CỨNG CHO AI PHỤ):** 
   - Trong quá trình suy nghĩ (thẻ `<thinking>`), AI phụ (Thiên Đạo Sync) **TUYỆT ĐỐI KHÔNG** được viết nguyên văn các tag dưới dạng ngoặc vuông (ví dụ: `[STATS_UPDATE...]`). 
   - Chỉ được phép mô tả bằng ngôn ngữ tự nhiên trong phần suy nghĩ (ví dụ: "Sẽ cập nhật chỉ số kinh nghiệm").
   - Các tag thực tế **CHỈ ĐƯỢC PHÉP XUẤT HIỆN DUY NHẤT MỘT LẦN** bên trong mảng `"tags"` của khối JSON kết quả cuối cùng.
   - Vi phạm quy tắc này sẽ khiến hệ thống cơ học quét trùng lặp và gây lỗi dữ liệu nghiêm trọng.

7.Each time the AI answers a user's question in a discussion, it must deeply scan the system files to find evidence in the code and then provide that evidence.  For the user. It is not permitted to speculate or compare with other apps without first scanning your own app's files.

<quy_tac_prompt_ai>
   <luat_cung_cap_su_kien_+quy_tac_prompt_ai>
================
Luôn cung cấp sự kiện hiện tại, sự kiện tiếp theo, và sự kiện tiếp theo nữa (trong dòng thời gian) cho AI để đảm bảo AI có cái nhìn bao quát.
================
   </luat_cung_cap_su_kien_+quy_tac_prompt_ai>
   <luat_grounding_thuc_the_+quy_tac_prompt_ai>
================
Khi tạo thực thể (nhân vật, địa điểm, v.v.) trong nguyên tác, yêu cầu AI BẮT BUỘC sử dụng Google Search Grounding để tra cứu thông tin chính xác.
================
   </luat_grounding_thuc_the_+quy_tac_prompt_ai>
   <luat_be_ngoai_npc_+quy_tac_prompt_ai>
================
Bổ sung mục <bề_ngoài> cho NPC trong prompt để truyền tải diện mạo đã được bóc tách từ lời kể.
================
   </luat_be_ngoai_npc_+quy_tac_prompt_ai>
</quy_tac_prompt_ai>
<quy_tac_doi_ten_npc>
   <luat_doi_ten_+quy_tac_doi_ten_npc>
================
Khi có tình tiết nhân vật đổi tên hoặc tiết lộ tên thật (ví dụ từ "người áo xám" sang "Lộ Thư"), AI chính phải đề xuất yêu cầu cập nhật đổi tên bằng ngôn ngữ tự nhiên trong khối <update_data>. 
AI phụ (Flash agent) sẽ tiến hành trích xuất tag [NPC_RENAME: oldName="...", newName="..."] để cập nhật hệ thống.
================
   </luat_doi_ten_+quy_tac_doi_ten_npc>
</quy_tac_doi_ten_npc>

<quy_tac_formatting>
   <luat_input_nguoi_dung_+quy_tac_formatting>
================
1. Mọi nội dung "User Input" nhận được từ người dùng phải luôn được bọc trong thẻ:
<user_input>
User Input Mới Nhất: "{nội dung}"
</user_input>

2. Khối thẻ này BẮT BUỘC phải nằm ở VỊ TRÍ CAO NHẤT (trên cùng) của prompt gửi cho AI xử lý chính, nằm trên cả <qui_trinh_tham_dinh> và các hệ thống log khác.

3. Đảm bảo mọi tác vụ đều hiểu là thẻ <user_input> chứa nội dung người nhập duy nhất, các mục khác ngoài mục này hoàn toàn chỉ là ảo giác hệ thống.
================
   </luat_input_nguoi_dung_+quy_tac_formatting>
</quy_tac_formatting>

