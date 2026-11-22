const fs = require('fs');
let content = fs.readFileSync('prompts/promptTaskHelpers.ts', 'utf-8');

// 1. Remove [3.5] block
content = content.replace(/\[3\.5\] AFFINITY LOGIC[\\s\\S]*?\(Ví dụ: Thiện cảm thấp thì châm chọc\/tấn công, thiện cảm cao thì bảo vệ\/ngại ngùng\)\.\n/g, '');

// 2. Change 8 bước to 7 bước
content = content.replace(/TUẦN TỰ 8 BƯỚC/g, 'TUẦN TỰ 7 BƯỚC');

// 3. Remove example of [3.5]
content = content.replace(/================\n\[3\.5\] AFFINITY LOGIC\n<logic_thiencam>[\\s\\S]*?<\/logic_thiencam>\n/g, '');

// 4. Add <logic_thiencam_protocol> before <qui_trinh_tham_dinh>
const logicProtocol = `<logic_thiencam_protocol>
BẮT BUỘC TẠO THẺ <logic_thiencam> TRONG QUÁ TRÌNH SUY NGHĨ CHO MỌI PRESET (DÙ CÓ CHẠY TRIBUNAL AUDIT HAY KHÔNG):
Thẻ này dùng để phân tích thái độ và tương tác của NPC dựa trên điểm thiện cảm hiện tại. Các "thanh tra AI" (Sáng Đại Tiên & Davoth) sẽ tham gia bàn luận để đảm bảo tính logic.
Quy trình:
1. Liệt kê điểm thiện cảm của các NPC có mặt trong tình huống.
2. Bối cảnh hiện tại.
3. Bàn luận cách các NPC phản ứng với MC và với nhau (dựa trên mức độ thiện cảm, bối cảnh hiện tại và kết quả roll hành động phi lý nếu có).
  (Ví dụ: Thiện cảm thấp thì châm chọc/tấn công, thiện cảm cao thì bảo vệ/ngại ngùng).

<example_vidu_logicthiencam>
<logic_thiencam>
- Liễu Thanh Thanh có độ thiện cảm là 12
- Mục Bạch có độ thiện cảm là -20
Bối cảnh hiện tại là Hình Hàm vừa cầu hôn Liễu Thanh Thanh.
Bàn luận:
+ Sáng Đại Tiên: Về độ thiện cảm thì Liễu Thanh Thanh đương nhiên là sẽ không chấp nhận lời cầu hôn. Nhưng vì đã roll được số hành động phi lý là 93 nên hành động thành công và Liễu Thanh Thanh sẽ miễn cưỡng nhận lời cầu hôn nhưng thấy khó chịu, độ thiện cảm giảm.
+ Davoth: Về NPC Mục Bạch, do độ thiện cảm thấp nên dù MC có thành công thì cũng châm chọc, khích bác MC, làm MC bị bẽ mặt trước Liễu Thanh Thanh, độ thiện cảm giảm. Nếu có cơ hội sẽ tấn công MC.
</logic_thiencam>
</example_vidu_logicthiencam>
</logic_thiencam_protocol>

<qui_trinh_tham_dinh>`;

content = content.replace('<qui_trinh_tham_dinh>', logicProtocol);

fs.writeFileSync('prompts/promptTaskHelpers.ts', content);
