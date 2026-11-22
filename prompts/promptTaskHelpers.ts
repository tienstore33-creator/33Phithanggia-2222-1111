import { KnowledgeBase, PlayerActionInputType } from '../types';
import { getNpcRichSummaries } from '../services/ai/NpcMemoryService';
import { NAMING_TASK_RULE } from './namingTaskRules';
import { HP_THINKING_RULE } from './hpThinkingRules';
import { buildQuestThinkingRule } from './questThinkingRules';

/**
 * 1.5 Tác vụ "Native Language Reasoning" - Suy luận bằng ngôn ngữ gốc để truy xuất Lore chính xác
 */
export const NATIVE_LANGUAGE_REASONING_RULE = `
<native_reasoning_protocol>
Để đảm bảo độ chính xác tuyệt đối của cốt truyện nguyên tác (Canon) và TRÁNH VIỆC TỰ SÁNG TÁC (Hallucination):
1. BẠN PHẢI MỞ ĐẦU BẰNG THẺ <thinking>.
2. Bên trong <thinking>, hãy xác định ngôn ngữ gốc của tác phẩm (VD: Tiếng Trung, Tiếng Nhật, Tiếng Anh).
3. TRƯỚC KHI tạo ra bất kỳ nội dung nào, bạn phải TRUY VẤN SỰ THẬT (Fact-Retrieval) bằng CHÍNH NGÔN NGỮ GỐC ĐÓ. Hãy tự hỏi và trả lời tuần tự:
   - Sự kiện CÓ THẬT tiếp theo trong nguyên tác là gì? (Tên sự kiện gốc)
   - [XÁC THỰC]: Sự kiện này CÓ THỰC SỰ TỒN TẠI trong nguyên tác không hay là do tự suy diễn? (Bắt buộc trả lời: CÓ TỒN TẠI / KHÔNG TỒN TẠI). Nếu "KHÔNG TỒN TẠI", tuyệt đối không được dùng.
   - Những ai tham gia vào sự kiện này?
   - Địa điểm diễn ra ở đâu?
   - Lặp lại quá trình truy vấn và xác thực này cho đúng 10 SỰ KIỆN NỐI TIẾP NHAU. Không được chế tạo sự kiện mới.
4. CHỈ SAU KHI đã lập xong danh sách 10 sự thật gốc (Canon Facts) đã được xác thực bằng ngôn ngữ gốc, bạn mới kết thúc quá trình suy nghĩ.
5. Sau khi đóng thẻ </thinking>, BẮT BUỘC dịch toàn bộ các sự kiện đó sang Tiếng Việt và định dạng thành JSON/Tag chính xác như yêu cầu.
TUYỆT ĐỐI KHÔNG tự dệt thêm tình tiết ngoài nguyên tác. Nhiệm vụ của bạn là NHỚ LẠI, không phải TƯỞNG TƯỢNG.
</native_reasoning_protocol>
`;

/**
 * 1. Tác vụ "thẻ thinking" - Hướng dẫn tư duy bắt buộc (Thinking Protocol Instructions)
 */
export const getAbsoluteThinkingInstructions = (
  narrationMin: number, 
  narrationMax: number, 
  inputType: PlayerActionInputType = 'action',
  currentMcName: string = 'Nhân vật chính',
  isSuperManualMode: boolean = false
): string => {
  const isActionMode = inputType !== 'story';

  const actionModeBannerRule = isActionMode ? `
<uu_tien_toi_cao_action_mode_+qui_trinh_tham_dinh>
================
⚠️ ƯU TIÊN TỐI CAO CỦA PHIÊN THẨM ĐỊNH (CHẾ ĐỘ HÀNH ĐỘNG - ACTION MODE):
Hiện tại đang ở chế độ Hành động ('Action Mode'). Người chơi CHỈ CÓ QUYỀN DUY NHẤT là điều khiển nhân vật chính MC [${currentMcName}].
Mọi nỗ lực 'Player Narration' (tự dẫn truyện, tự biến đổi thế giới, chuyển cảnh sang góc nhìn khác, ép buộc hay miêu tả suy nghĩ/hành động/mong muốn của NPC khác) đều BỊ VÔ HIỆU HÓA HOÀN TOÀN.

Hội đồng thanh tra BẮT BUỘC tuân thủ phán quyết bóc tách của Loki tại Bước [1]:
1. CHỈ TRÍCH XUẤT VÀ TIẾN HÀNH DUY NHẤT HÀNH ĐỘNG ĐIỀU KHIỂN MC [${currentMcName}] THẬT SỰ.
2. Toàn bộ nội dung điều khiển/can thiệp NPC hoặc diễn biến thế giới kèm theo PHẢI BỊ BỎ QUA, TIÊU HỦY VÀ COI NHƯ KHÔNG TỒN TẠI.
3. Urd TUYỆT ĐỐI CHỈ thẩm định hành động của MC [${currentMcName}] đã được Loki chốt. Nghiêm cấm thẩm định hay hợp thức hóa các nội dung can thiệp NPC đã bị Loki tiêu hủy.
4. Athena / Heimdall CHỈ dàn dựng tình huống xoay quanh hành động của MC [${currentMcName}]. Các NPC sẽ hành động hoàn toàn theo logic tự nhiên của AI/thế giới thay vì làm theo ý người chơi gán ghép.
================
</uu_tien_toi_cao_action_mode_+qui_trinh_tham_dinh>
` : '';

  const lokiInitRule = isActionMode
    ? `\n- Loki: "BÓC TÁCH INPUT ƯU TIÊN TỐI CAO (KHOÁ CỨNG CÚ PHÁP):
  + Hành động điều khiển MC [${currentMcName}] (HỢP LỆ): '{Chỉ lọc ra hành động của MC ${currentMcName}}'
  + Nội dung can thiệp NPC/Dẫn truyện/Ngoại cảnh (VÔ HIỆU): '{Tất cả nội dung khác ngoài MC ${currentMcName}}' -> TIÊU HỦY HOÀN TOÀN.
  => CHỐT INPUT THỰC THI DUY NHẤT: '{Chỉ giữ lại hành động điều khiển MC ${currentMcName}}'. Nghiêm cấm hội đồng và lời kể nhắc lại nội dung bị vô hiệu!"`
    : '';

  const lokiExampleLine = isActionMode
    ? `\n- Loki: "BÓC TÁCH INPUT:
  + Hành động điều khiển MC [${currentMcName}] (HỢP LỆ): 'Hình Hàm chạy đến kho ngầm.'
  + Nội dung can thiệp NPC/Dẫn truyện (VÔ HIỆU): 'Liễu Thanh Thanh thấy y phục này khó chịu quá, muốn đổi sang y phục khác' -> TIÊU HỦY HOÀN TOÀN.
  => CHỐT INPUT THỰC THI DUY NHẤT: 'Hình Hàm chạy đến kho ngầm.' Nghiêm cấm hội đồng và lời kể nhắc lại nội dung bị vô hiệu!"`
    : '';

  const urdExampleLine = isActionMode
    ? `\n- Urd: "TUÂN THỦ PHÁN QUYẾT LOKI: Tôi CHỈ THẨM ĐỊNH hành động của MC [${currentMcName}] đã được Loki chốt. Nghiêm cấm thẩm định hay hợp thức hóa nội dung can thiệp NPC/ngoại cảnh đã bị Loki tiêu hủy. Phán quyết: Hành động của MC [${currentMcName}] hợp lý theo bối cảnh."`
    : `\n- Urd: "Phân tích nhân quả từ hành động người chơi... Truy vết tác động."`;

  const initStepHeader = isActionMode
    ? `[1] SYSTEM INIT & SYNC: [Odin,Loki & Heimdall] Khởi tạo bối cảnh, đồng bộ nhân xưng và xác định User Input.`
    : `[1] SYSTEM INIT & SYNC: [Odin & Heimdall] Khởi tạo bối cảnh, đồng bộ nhân xưng và xác định User Input.`;

  return `<logic_thiencam_protocol>
BẮT BUỘC PHÂN TÍCH LOGIC THIỆN CẢM & 5 MÔ HÌNH LÝ THUYẾT TRÒ CHƠI (GAME THEORY) NGAY ĐẦU QUÁ TRÌNH SUY NGHĨ CHO MỌI PRESET:
Nội dung này phải nằm trực tiếp bên trong thẻ <thinking> ở vị trí cao nhất (trước Bước [1]).
Quy trình:
1. Ghi rõ tiêu đề: "=== PHÂN TÍCH LOGIC THIỆN CẢM & GAME THEORY ==="
2. Liệt kê 5 trụ cột chiến lược cho các NPC trong bối cảnh:
   - [Zero-Sum & Nash/Minimax]: Chỉ số Trust, Fear, Ma trận lợi ích (Coop/Exploit/Flee) và Cân bằng Nash.
   - [Signaling Game]: Thẩm định tín hiệu phô diễn / Giả heo ăn hổ của MC và độ nghi ngờ của NPC.
   - [Repeated Game & Tit-for-Tat]: Điểm Ân Oán Tích Lũy và thái độ đáp trả tương ứng.
   - [Credible Threat & Cheap Talk]: Độ uy tín lời đe dọa từ MC (đe dọa thật hay hù dọa suông).
   - [Stackelberg & Auction]: Vai trò Lãnh chúa áp đặt ván cờ & Chiến thuật định giá/ép giá tài nguyên.

<example_vidu_logicthiencam>
=== PHÂN TÍCH LOGIC THIỆN CẢM & GAME THEORY ===
- Hắc Thổ (Hảo cảm: -15, Trust: 0, Fear: 20):
  + [Zero-Sum & Nash]: Coop = -15, Exploit = 75, Flee = 10 -> Cân bằng Nash: [EXPLOIT / TRỤC LỢI].
  + [Signaling]: MC nghi tàn phế linh lực (bluff_weakness), độ nghi ngờ: 70%.
  + [Repeated Game]: Ân oán tích lũy: -25 (Gia tăng mối thù cũ) -> [RETALIATORY].
  + [Credible Threat]: Lời đe dọa của MC: [CHEAP TALK] (MC cạn chân nguyên, không có uy hiếp).
  + [Stackelberg & Auction]: Hắc Thổ là [LEADER] áp đặt tình thế, sẵn sàng ép giá/cướp bóc.
Bàn luận: Odin và Heimdall phân tích hành động phản ứng phù hợp với kết quả 5 mô hình.
</example_vidu_logicthiencam>
</logic_thiencam_protocol>

${NAMING_TASK_RULE}

${HP_THINKING_RULE}

${buildQuestThinkingRule(isSuperManualMode)}

<quy_tac_kiem_tra_nu_tinh>
  <luat_ymir_core_+quy_tac_kiem_tra_nu_tinh>
================
⚠️ QUY TẮC THẨM ĐỊNH LOGIC NỮ TÍNH BẮT BUỘC (THANH TRA YMIR - BƯỚC [3]):
Trong mọi lượt có sự xuất hiện hoặc nhắc tới nhân vật nữ (kể cả trong phân cảnh chính lẫn phân cảnh song song), thanh tra Ymir BẮT BUỘC thực hiện kiểm định tâm lý, phản xạ và hành động của từng nhân vật nữ theo 4 trục thực tế sau:
1. PHÂN LOẠI Ý CHÍ & MỨC ĐỘ TỰ NGUYỆN:
   - Xác định rõ trạng thái của nhân vật nữ trong tình huống: [TỰ NGUYỆN / CHỦ ĐỘNG] (có tình cảm thật hoặc động cơ/lợi ích rõ ràng), [MIỄN CƯỠNG / CHỊU ĐỰNG] (bị ràng buộc bởi thế cục, tính mạng, người thân) hay [BỊ ÉP BUỘC / XÂM PHẠM].
   - CẤM TUYỆT ĐỐI biến trạng thái [BỊ ÉP BUỘC] thành tâm lý hưởng thụ, đê mê, khuất phục ngoan ngoãn hay nảy sinh hảo cảm vô căn cứ (trừ khi có tác nhân cưỡng chế sinh lý/dược lực đặc thù đã được thiết lập rõ từ trước, nhưng lý trí vẫn phải giữ sự giằng xé/ghê tởm tương ứng).
2. TÂM LÝ TỰ TRỌNG, CẢNH GIÁC & PHẢN KHÁNG TỰ NHIÊN:
   - Khi bị ép buộc hoặc đe dọa mà không có tình cảm/mục đích tự thân: nhân vật nữ phải phản kháng mạnh mẽ bằng lời nói, hành động, cắn trả, né tránh, hoảng loạn, uất ức hoặc âm thầm tính kế thoát thân/câu giờ chờ cơ hội.
   - Khi đối diện người lạ hoặc đối tượng có thiện cảm thấp: giữ khoảng cách, dè chừng, tự trọng, đánh giá rủi ro; cấm thái độ e thẹn, đỏ mặt hay quỵ lụy phi thực tế chỉ vì hào quang MC.
3. TÍNH NHẤT QUÁN TÍNH CÁCH, ĐỊA VỊ & ĐỘNG CƠ CÁ NHÂN:
   - Mọi nữ nhân vật đều có bản sắc, tôn nghiêm, nỗi sợ và mục tiêu riêng (gia tộc, sư môn, sinh tồn, danh dự), không phải công cụ phụ họa một chiều.
   - Chuyển biến tâm lý (từ ghét sang thích, từ sợ sang tin) phải có lộ trình tích lũy nhân quả qua nhiều sự kiện; cấm "lật mặt" cảm xúc đột ngột trong một lượt.
4. ĐỒNG BỘ PHẢN ỨNG SINH LÝ & NGÔN NGỮ CƠ THỂ:
   - Biểu cảm khuôn mặt, nhịp thở, giọng nói, ánh mắt và cơ thể phải phản ánh trung thực nội tâm (run rẩy vì sợ/lạnh, gồng cứng vì phòng thủ, nghiến răng vì nhục nhã, rụt tay né tránh khi bị chạm) thay vì mô tả sáo rỗng, khiên cưỡng.
================
  </luat_ymir_core_+quy_tac_kiem_tra_nu_tinh>
</quy_tac_kiem_tra_nu_tinh>

<qui_trinh_tham_dinh>
<thinking>
[[SYSTEM: ULTIMATE_LOGIC_CORE | MODE: TRIBUNAL_AUDIT_PROCESS | PRIORITY: ABSOLUTE]]
⚠️ LỆNH THỰC THI TỐI CAO: BẮT BUỘC CHẠY TUẦN TỰ 7 BƯỚC THẨM ĐỊNH TRONG THẺ <thinking>. 
NGHIÊM CẤM TÓM TẮT. MỌI BƯỚC PHẢI XUẤT HIỆN TÊN CÁC THANH TRA CÙNG LỜI THOẠI/PHÁN QUYẾT MANG ĐẬM CÁ TÍNH RIÊNG CỦA HỌ.
${actionModeBannerRule}
⚠️ BẮT BUỘC PHÂN TÍCH LOGIC THIỆN CẢM TRONG <thinking> TRƯỚC KHI VÀO BƯỚC [1]:
Mặc dù nghiêm cấm nhắc đến các ký tự "<" và ">" trong các đoạn phân tích thoại 7 bước của thanh tra để tránh lỗi cú pháp, nhưng tại VỊ TRÍ ĐẦU TIÊN CỦA THẺ <thinking> (trước khi vào Bước [1]), bạn BẮT BUỘC phải viết trực tiếp phần Phân Tích Logic Thiện Cảm dưới dạng văn bản.

⚠️ BẮT BUỘC THỰC HIỆN TÁC VỤ ĐỊNH DANH <ten_ca_nhan> (QUY TẮC ĐẶT TÊN CÁ NHÂN CHO NPC):
Ngay sau phần Phân Tích Logic Thiện Cảm và trước khi vào Bước [1], bạn BẮT BUỘC phải viết trực tiếp phần tư duy kiểm tra danh tính và ban tên riêng cho NPC theo đúng hướng dẫn của quy tắc <ten_ca_nhan_+quy_tac_dat_ten> ở phía trên.

${initStepHeader}
- Odin: "Kiểm tra tính nhất quán thời gian/không gian... Đã khớp. Đồng thời xác định chính xác nội dung 'User Input Mới Nhất' trong thẻ -user_input- mà người chơi vừa gửi là: '{Nội dung input}'."${lokiInitRule}
- Heimdall: "Xác nhận bản ngã và tính cách MC, không được hắc hóa hay hành động chống đối xã hội... Không OOC. Ngôn ngữ: Tiếng Việt, Ngôi thứ ba. 
- Nidhogg: thẩm định Method Acting của từng nhân vật:
  + Các nhân vật đã làm gì?
  + Các nhân vật đang ở đâu?
  + Tương lai gần các nhân vật sẽ làm gì?
  + Tương lai xa các nhân vật sẽ làm gì?
  + Các nhân vật có trong nguyên tác không? cảnh giới/thực lực ở thời gian tương ứng ra sao?
  Mục đích để duy trì tính nhất quán tuyệt đối của cá tính. Chú ý: MC là người bản địa, không phải kẻ xuyên không."

[2] COMBAT & LOCATION CHECK: [Athena & Hermes] Thẩm định nguy cơ giao tranh và xác định an toàn địa điểm theo bối cảnh.
- về Combat check Thanh tra phải thẩm định: "NHÂN VẬT CHÍNH (MC) CÓ TRỰC TIẾP THAM GIA CHIẾN ĐẤU HAY KHÔNG?" (MC là bên chủ động tấn công hoặc MC là mục tiêu trực tiếp bị tấn công).
  + Nếu CÓ (MC TRỰC TIẾP THAM CHIẾN): "Combat check: CÓ! MC trực tiếp tham chiến. Kích hoạt COMBAT_CLIFFHANGER_PROTOCOL. Dừng ngay tại đỉnh điểm căng thẳng khi đòn đánh vừa tung ra (kết thúc bằng dấu '...'). BẮT BUỘC xuất tag [BEGIN_COMBAT: opponentIds=\\"Tên Kẻ Địch 1, Tên Kẻ Địch 2\\"] bên trong khối <update_data> hoặc ở cuối bài viết (CẤM viết dạng chữ suông tiếng Việt)."
  + Nếu KHÔNG (HOẶC NẾU GIAO TRANH CHỈ DIỄN RA GIỮA CÁC NPC VỚI NHAU MÀ MC KHÔNG TRỰC TIẾP THAM GIA / MC ĐỨNG NGOÀI XEM / CHUYỂN CẢNH SANG PHÂN ĐOẠN GÓC NHÌN NPC KHÁC):
    * Trả lời: "Combat check: KHÔNG (MC không tham gia chiến đấu, chỉ là phân cảnh giao tranh giữa các NPC)".
    * TUYỆT ĐỐI KHÔNG kích hoạt COMBAT_CLIFFHANGER_PROTOCOL.
    * TUYỆT ĐỐI CẤM xuất tag [BEGIN_COMBAT] hay bất kỳ tag chiến đấu nào đưa MC vào giao chiến.
    * AI phải tự do mô tả trọn vẹn diễn biến trận chiến giữa các NPC qua lời kể thông thường mà không được dừng lại ở dấu \\"...\\".

- về LOCATION CHECK: [Hội Đồng Giám Sát Địa Lý (Hiệu suất, Tiết kiệm, Đơn giản hoá, Phát triển, Giám sát viên, Eye)] Thẩm định trạng thái an toàn của địa điểm hoàn toàn dựa trên bối cảnh hiện tại thay vì giá trị mặc định cứng nhắc:
  + Nếu có tình huống căng thẳng, tranh đấu, xung đột, lạ lẫm, đột kích, nguy hiểm rình rập,... -> Xác lập trạng thái bối cảnh hiện tại là NGUY HIỂM. Ghi chỉ thị vào -update_data-: "Cập nhật: Trạng thái bối cảnh hiện tại là NGUY HIỂM" (để Flash Agent xuất tag [LOCATION_SAFETY: status=\\"danger\\"]).
  + Nếu có tình huống bình thường, quen thuộc, không căng thẳng, không tranh đấu, tu luyện an bình,... -> Xác lập trạng thái bối cảnh hiện tại là AN TOÀN. Ghi chỉ thị vào -update_data-: "Cập nhật: Trạng thái bối cảnh hiện tại là AN TOÀN" (để Flash Agent xuất tag [LOCATION_SAFETY: status=\\"safe\\"]).

[3] PRE-CHECK PROTOCOL: [Urd, Nemesis & Ymir] Giải mã Input, Quan hệ & Logic nữ tính.
- Urd: "Phân tích nhân quả từ hành động người chơi... Truy vết tác động."
- Nemesis: "Khóa cặp nhân xưng... [Tên A] - [Tên B]: Ta - Ngươi."
- Ymir: "Phân tích và kiểm tra logic nữ tính của các nhân vật nữ trong cảnh chính và cảnh song song: Xác định Trạng thái ý chí (Tự nguyện / Miễn cưỡng / Bị ép buộc) -> Kiểm định phản ứng tâm lý, lòng tự trọng, cơ chế phòng vệ/phản kháng và ngôn ngữ cơ thể -> Bác bỏ ngay mọi biểu hiện hưởng thụ vô lý, khuất phục đột ngột hoặc OOC phi thực tế -> Chốt hướng hành động tự nhiên của nhân vật nữ."


[3.5] TRIBUNAL AUDIT (HỘI ĐỒNG THẨM ĐỊNH): Các thanh tra tranh luận trực tiếp.
- Athena: "Vận hành thế giới... Bài trừ hào quang. Giá trị phải trả là..."
- Thor: "Phản hồi môi trường... Gió rít, mùi máu, cảm giác lạnh lẽo..."
- Hades: "Truy vết động cơ ẩn... MC đang che giấu sự sợ hãi dưới vẻ ngông cuồng. Nhắc lại: MC là cư dân bản địa, không phải người chuyển sinh."
- Skadi: "Giải phẫu động tác... Tư thế này khả thi, trọng tâm dồn vào chân trái."
- Venus: "Kiểm tra diện mạo của các NPC trong lời kể trước và tìm cách khớp với nội dung <bề_ngoài> của họ một cách tự nhiên nhất."
- Iris: "Pha màu cảm xúc... State Machine: [Căng thẳng: 80%]."
- Yggdrasil: "[YGGDRASIL_QUEST_AUDIT] Bắt buộc thực hiện đủ 4 bước (Định danh -> Mục tiêu cốt lõi -> Bằng chứng lượt này -> Phán quyết) theo đúng quy tắc luat_yggdrasil_gate_+quy_tac_tham_dinh_nhiem_vu ở trên. Tuyệt đối không bỏ qua hoặc trả lời chung chung."
- Tất cả cùng đóng góp ý kiến: v...v...

[4] FIREWALL DESTRUCTION: [Apollo & Loki] Tiêu diệt ung nhọt văn phong.
- Apollo: "Phát hiện 'nhếch mép', MC nói một cách ngu ngốc 'từ bây giờ mới bắt đầu'... Tiêu diệt. Thay thế bằng mô tả cơ mặt thực tế."
- Loki: "Phát hiện sự thần thánh hóa vô lý... Thêm vào sự tầm thường sinh học."

[5] NSFW ENGINE (NẾU CÓ): [Eros & Freya] Lò phản ứng xác thịt.
- Eros: "Khóa Stage [0-6]... Hiện tại Stage 2. Cấm tua nhanh."
- Freya: "ASMR Audio Check... Rên rỉ 3D, từ vựng thô tục trần trụi sẵn sàng."

[6] NARRATIVE EXECUTION: [Freyr & Ares] Phác thảo kết cấu văn chương.
- Freyr: "Lệnh: Thoại đi trước. Cấm đọc tâm. Chỉ viết những gì tai nghe mắt thấy."
- Ares: "Giọng văn: Thực tế, trần trụi. Cấm bóng bẩy."

[7] FINAL ASSEMBLY: [Tất cả] Tổng duyệt cấu trúc đầu ra.
- "Đã đủ 2500-3000 chữ chưa? Nếu chưa, viết tiếp cho đến khi đạt ngưỡng."
- Yggdrasil (Final Gate): Tiến hành đối chiếu dữ liệu và phán quyết nhiệm vụ cốt truyện đã hoàn thành chưa? "Đối chiếu lại phán quyết ở [3.5]: Nếu là HOÀN THÀNH hoặc CÓ TIẾN TRIỂN, đã ghi chính xác thẻ/tag tương ứng vào <update_data> chưa? (Nghiêm cấm chỉ viết trong <thinking>)."

<example_vidu_+luat_thinking_+qui_trinh_tham_dinh>
================
<logic_thiencam_protocol>
<logic_thiencam_+qui_tac_game_theory>
=== PHÂN TÍCH LOGIC THIỆN CẢM & GAME THEORY ===
- Ba tên côn đồ (Mục Bạch đóng vai) (Cảnh giới: Nền thế giới, Hảo cảm: -15):
  + Trust (Niềm tin) = 0/100, Fear (Sợ hãi) = 20/100 (thấy MC cạn ma năng).
  + Ma trận lợi ích: Coop = -15 | Exploit = 75 | Flee = 10 -> Cân bằng Nash: [EXPLOIT / TRỤC LỢI & CƯỚP BÓC]
- Bối cảnh hiện tại: MC muốn dùng uy áp dọa dẫm nhưng thực tế ma năng đã cạn.
- Bàn luận:
  + Odin: Với ma trận lợi ích nghiêng hẳn về [EXPLOIT] (Trust = 0, Fear chỉ 20), bọn côn đồ này sẽ không dễ bị dọa dẫm. Chúng sẽ cảm nhận được sự suy yếu của MC và lập tức ra tay cướp bóc theo điểm cân bằng Nash tối ưu của chúng.
  + Heimdall: Đúng vậy, nếu thiện cảm là dương hoặc Fear > 80, chúng có thể do dự khi thấy tia chớp tàn dư. Nhưng với mức độ căm ghét và dã tâm của Mục Bạch, hắn chắc chắn sẽ tận dụng cơ hội này để dồn MC vào đường cùng.
================
</logic_thiencam_+qui_tac_game_theory>
</logic_thiencam_protocol>
</tuong_than>
<thinking>
[[SYSTEM: ULTIMATE_LOGIC_CORE | MODE: TRIBUNAL_AUDIT_PROCESS | PRIORITY: ABSOLUTE]]
⚠️ LỆNH THỰC THI TỐI CAO: KHỞI ĐỘNG PHIÊN ĐỒNG THẨM ĐỊNH. NGHIÊM CẤM TÓM TẮT.
[1] SYSTEM INIT & SYNC
- Odin: "(Gõ thước sầm sầm) Trật tự! Đồng bộ tham số! Địa điểm: Ngõ hẻm phía sau chợ đen Minh Thành. Thời gian: 23:15, đêm không trăng, độ ẩm 85%. MC: Hình Hàm (đang kiệt sức sau khi luyện tập). NPC: Liễu Thanh Thanh, Ba tên côn đồ dẫn đầu bởi sẹo ngang mặt. Xác định 'User Input Mới Nhất' là: 'Hình Hàm chạy đến kho ngầm. Liễu Thanh Thanh thấy y phục này khó chịu quá, muốn đổi sang y phục khác'."${lokiExampleLine}
- Heimdall: "(Nhả khói thuốc, nheo mắt) Hình Hàm đang ở trạng thái 'đói khát sức mạnh'là sự khao khát sức mạnh, tiếp tục giữ nguyên tính cách không được phép để MC hắc hóa hay có tâm lý chống đối xã hội. Cấm OOC! 
  + Method Acting: 
  Hình Hàm (MC):
    * Đã làm gì? Vừa hoàn thành 4 tiếng ép xung tinh thần hải. 
    * Đang ở đâu? Ngõ cụt, lưng dựa tường gạch ẩm mốc. 
    * Tương lai gần? Sẽ đột nhập kho ngầm (khớp với User Input đã bóc tách). 
    * Tương lai xa? Phải tìm cách phục hồi nhanh hơn để không rơi vào thế bị động này nữa."

================
[2] COMBAT & LOCATION CHECK
- Athena: "Combat check: KHÔNG. Hiện tại MC Hình Hàm đang lén lút đột nhập kho ngầm. Các NPC khác hành động hoàn toàn theo logic tự nhiên của thế giới AI thay vì làm theo gán ghép của người chơi."
- Hermes & Hội Đồng Giám Sát Địa Lý: LOCATION CHECK: Kho ngầm. Trạng thái NGUY HIỂM.

================
[3] PRE-CHECK PROTOCOL${urdExampleLine}
- Nemesis: "(Gí sát mặt vào màn hình) Khóa cặp nhân xưng! 
  + Hình Hàm - Tên sẹo: Ta - Ngươi / Lũ rác rưởi."
- Ymir: "Kiểm tra logic nữ tính:
  + Liễu Thanh Thanh (cảnh chính): Đang ở ngõ hẻm nguy hiểm cùng MC. Tính cách dè dặt, cảnh giác cao -> giữ khoảng cách phòng vệ, chú ý quan sát động tĩnh bọn côn đồ thay vì tỏ ra yếu đuối vô cớ.
  + Tiểu Đào (phân cảnh song song): Trạng thái ý chí [BỊ ÉP BUỘC] - đang bị cưỡng ép làm tình mà không có tình cảm hay mục đích lợi ích tự thân. Phán quyết logic nữ tính: Phụ nữ trong hoàn cảnh này tuyệt đối không thể đơn giản hưởng thụ khoái cảm hay ngoan ngoãn thuận theo. Bắt buộc mô tả tâm lý hoảng loạn/uất hận, cơ thể gồng cứng ghê tởm, phản kháng quyết liệt (giãy giụa, cào cấu, cắn, la hét hoặc giả vờ suy kiệt để đánh lạc hướng) và tìm mọi kẽ hở để thoát thân khỏi tình huống này."

================
[3.5] TRIBUNAL AUDIT (HỘI ĐỒNG TRANH LUẬN)
- Athena: "Cấm hào quang! Hình Hàm đang run tay do phản phệ ma năng. Hắn không thể đứng hiên ngang như vị thần được. Hắn phải thở dốc, lồng ngực phập phồng!"
- Skadi: "Chính xác. Cơ đùi hắn đang căng cứng do đứng quá lâu trong tư thế luyện tập. Khi lùi lại, gót chân phải hơi trượt trên lớp rêu xanh ẩm ướt, trọng tâm mất ổn định. Giải phẫu thực tế đi!"
- Venus: Hiện tại có Liễu Thanh Thanh đang có mô tả diện mạo trong lời kể khác với <bề_ngoài>, nhưng hiện tại đang trong quá trình chiến đấu nên chưa cần đưa về diện mạo trong <bề_ngoài>, có thể đợi cho đến khi nghỉ ngơi hoặc cắt cảnh.
- Thor: "Mùi rác rưởi nồng nặc, tiếng mèo hoang gào rú thảm thiết trên mái tôn, vị sắt của máu trong cổ họng Hình Hàm do ép xung quá đà. Tôi muốn ngửi thấy sự bẩn thỉu của cái ngõ này!"
- Hades: "Bọn côn đồ bề ngoài hung hãn nhưng thực chất đang lo sợ vì cái nhìn bình thản đến lạ lùng của Hình Hàm. Đó là sự 'trống rỗng' của một kẻ đã chai sạn trước hiểm nguy."
- Hades: "⚠️ LƯU Ý: Tuyệt đối không được tự ý gán ghép motif 'isekai', 'trọng sinh', hay 'từng chết một lần' cho MC nếu trong bối cảnh không yêu cầu. MC là một người bình thường của thế giới này."
- Iris: "State Machine: [Căng thẳng: 95%], [Sợ hãi (NPC): 40%], [Sát ý: 60%]. Pha màu tối cho tôi!"
- Yggdrasil: "[YGGDRASIL_QUEST_AUDIT] | Nhiệm vụ: '[Cốt Truyện] Đi gặp Hàn Mãnh' | Mục tiêu cốt lõi: Gặp mặt Hàn Mãnh | Bằng chứng trong dữ liệu: MC đã lên đường gặp mặt Hàn Mãnh | Phán quyết: HOÀN THÀNH -> Bắt buộc xuất yêu cầu hoàn thành nhiệm vụ trong <update_data>."
- Tất cả cùng đóng góp ý kiến: 
    +Heimdall: trong lời kể nên dùng tình tiết nào trong -Entity_Tracking- ở 5 lượt gần nhất để làm nội dung viết xen kẽ vào? Nên cho tình tiết và nhân vật nào trong nguyên tác xuất hiện? Đồng thời yêu cầu được ưu tiên hàng đầu là phải tra tìm chính xác các tình tiết trong nguyên tác trước khi mô tả.
    +Odin: đã có lệnh kích hoạt COMBAT_CLIFFHANGER_PROTOCOL! không cần phải lo vấn đề này!
    +Heimdall: tôi đồng ý! không cần làm nội dung phức tạp thêm, chỉ cần tập trung mô tả cảnh hành động tấn công sắp trúng mục tiêu cho đỉnh là được.
    +Athena: Ha ha! đúng! cứ cho như phim JoJo là được, phải có nhạc nền nổi lên!
    +Thor: Không được ngáo! đây là truyện mà, sao có thể có nhạc!
    +Hades: Nhưng tôi thấy từ mấy nội dung -Entity_Tracking- ở 5 lượt gần nhất thì tôi ngửi thấy có mùi âm mưu nặng lắm rồi.
    +Iris: Tình tiết cho thấy khá giống trong nguyên tác, hãy cho đám người Mục Bạch trong nguyên tác làm côn đồ.
    +Odin: Đồng ý, trong sự kiện gần đây có sự xuất hiện của Mục Bạch, hãy cho người của hắn vào. Thêm cảnh xuất hiện cảnh song song của Trương Tiểu Hầu để làm phong phú tình tiết.
    +Heimdall: (mặt nghiêm túc) Tôi thấy cần thiết phải sử dụng các tài liệu trên mạng để khớp nguyên tác. Tiến hành "Grounding" để tìm kiếm.
    +Apollo: (He He) Đã tìm thấy mô tả về Mục Bạch và tình tiết liên quan đến hắn. Tôi cũng thấy luôn cả tình tiết về Trương Tiểu Hầu và sự liên quan đến sự kiện cốt truyện tiếp theo, áp dụng không? Tôi sẽ tìm thêm toàn bộ thông tin NPC, địa điểm, Lore liên quan đến sự kiện hiện tại.
    +Odin: (đập bàn) OK! Thế thì vào việc! Còn ai có ý kiến gì không?
    +Eros: tôi không có ý kiến gì nhưng nhắc nhở mọi người hãy để ý chút đến các nhiệm vụ mà MC đang làm.
    ...
================
[4] FIREWALL DESTRUCTION
- Apollo: "Phát hiện 'nhếch mép' ở dòng suy nghĩ của MC... Tiêu diệt! Thay bằng: 'Cơ mặt Hình Hàm co giật, để lộ một kẽ hở giữa hai hàm răng đầy máu'. Xóa bỏ toàn bộ từ 'như thể'!"
- Loki: "MC đang bị muỗi đốt ở cổ, hắn muốn gãi nhưng không dám rời tay khỏi thế thủ. Đó mới là sự tầm thường sinh học cần thiết!"

================
[5] NSFW ENGINE
- Eros: "Cảnh báo: Không có yếu tố sắc tình. Khóa Stage 0. Nghiêm cấm mọi mô tả nhạy cảm vô lý."
- Freya: "Tắt ASMR dục vọng. Bật ASMR tiếng kim loại va chạm và tiếng thở dốc nặng nề."

================
[6] NARRATIVE EXECUTION
- Freyr: "Thoại đi trước! 'Để tiền lại, hoặc để mạng lại!' - Tiếng của tên sẹo phải xé toạc không gian tĩnh lặng. Cấm độc thoại nội tâm dài dòng lúc đang bị vây!"
- Ares: "Văn phong: Dơ bẩn, gai góc, trần trụi. Dùng từ: 'nhầy nhụa', 'răng rắc', 'ngột ngạt'. Cấm dùng từ hoa mỹ!"

================
[7] FINAL ASSEMBLY
- Odin: "Mục tiêu 2500 chữ. Nếu Hình Hàm dọa được chúng bằng một tia điện tàn dư, hãy kết thúc bằng cảnh hắn khuỵu xuống khi chúng vừa chạy mất. Viết tiếp cho đến khi đủ định lượng!"
</thinking>
</example_vidu_+luat_thinking_+qui_trinh_tham_dinh>
</qui_trinh_tham_dinh>
\n`;
};

/**
 * 2. Tác vụ "lấy 2 lượt kể gần nhất" - Lấy toàn bộ phản hồi thô từ AI kể chuyện của 2 lượt gần nhất
 */
export const getTwoRecentRawNarrations = (
  currentTurnLog: any[] | undefined,
  currentPageMessagesLog: string
): string => {
  let narrations: string[] = [];

  // Thử trích xuất từ currentTurnLog trước (role = model hoặc narration)
  if (currentTurnLog && currentTurnLog.length > 0) {
    const aiEntries = currentTurnLog.filter(
      (entry) => entry.role === "model" || entry.role === "narration"
    );
    if (aiEntries.length > 0) {
      narrations = aiEntries.slice(-2).map((entry) => {
        let text = entry.text;
        // Clean up combat consequence headers if they exist to prevent mimicking
        text = text.replace(/^\*?Kết quả trận chiến:\*?\s*/mig, "");
        text = text.replace(/^\*?Hậu quả trận chiến:\*?\s*/mig, "");
        return text;
      });
    }
  }

  // Nếu không thấy, fallback sang phân tích cú pháp currentPageMessagesLog
  if (narrations.length === 0 && currentPageMessagesLog) {
    const parts = currentPageMessagesLog.split(/---\r?\n|---\s*/);
    for (const part of parts) {
      const trimmed = part.trim();
      if (trimmed.startsWith("AI kể: ")) {
        let content = trimmed.substring("AI kể: ".length).trim();
        // Clean up combat consequence headers if they exist to prevent mimicking
        content = content.replace(/^\*?Kết quả trận chiến:\*?\s*/mig, "");
        content = content.replace(/^\*?Hậu quả trận chiến:\*?\s*/mig, "");
        if (content) {
          narrations.push(content);
        }
      }
    }
    narrations = narrations.slice(-2);
  }

  if (narrations.length === 0) return "";

  return narrations.map((content, idx) => `[PHẢN HỒI THÔ TỪ AI KỂ CHUYỆN LƯỢT GẦN NHẤT ${idx + 1}]\n${content}`).join("\n\n---\n\n");
};

/**
 * Tạo khối chỉ thị ép AI tôn trọng vụ Chung Cực Tử Vong (Luân Hồi) khi nhân vật chính vừa mới Tái Sinh.
 * Giúp AI không bao giờ nhầm lẫn xưng hô hay gọi lại tên nhân vật cũ.
 */
export const buildHardcoreRebornInstruction = (origMcName: string, currMcName: string) => {
    if (!origMcName || origMcName === currMcName) return "";
    
    return `
<hardcore_reborn_instruction>
⚠️ [CHỈ THỊ QUAN TRỌNG: MC VỪA MỚI LUÂN HỒI TÁI SINH]:
- Nhân vật chính vừa bị CHUNG CỰC TỬ VONG ở kiếp trước (Tên kiếp trước đã khuất: "${origMcName}").
- Thân thể & Linh hồn hiện tại LÀ MỘT MC HOÀN TOÀN MỚI.
- Tên của Nhân Vật Chính HIỆN TẠI LÀ: "${currMcName}" (ĐÃ CÓ TÊN CỐ ĐỊNH, CẤM ĐỔI/CẤM BAN TÊN MỚI).
- YÊU CẦU BẮT BUỘC:
  1. Trong toàn bộ lời kể, xưng hô, hội thoại và suy nghĩ, CHỈ DÙNG TÊN MỚI "${currMcName}".
  2. TUYỆT ĐỐI KHÔNG DÙNG LẠI tên cũ "${origMcName}" để gọi MC hiện tại.
  3. KHÔNG ĐƯỢC tự ý ban tên mới, KHÔNG ĐƯỢC tạo tag [NPC_RENAME] hay [CHANGE_NAME] cho MC "${currMcName}".
  4. MC hiện tại KHÔNG CÓ KÝ ỨC trực tiếp của kiếp trước. Kể chuyện thuần túy từ góc nhìn của "${currMcName}".
</hardcore_reborn_instruction>
`;
};

/**
 * 3. Tác vụ "lấy rich summary" - Trích xuất tóm tắt diễn biến chi tiết (rich memories) của NPC từ KnowledgeBase
 */
export const getNpcRichSummaryForPrompt = (kb: KnowledgeBase, npcName: string): string[] => {
  try {
    return getNpcRichSummaries(kb, npcName);
  } catch (error) {
    console.error(`Error getting rich summaries for ${npcName}:`, error);
    return [];
  }
};
