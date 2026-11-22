/**
 * combatPromptBuilder.ts
 * Module chuyên trách đóng gói và bọc XML toàn bộ các khối nội dung của Prompt Combat
 */
import { NPC_COMBAT_ASSESSMENT_XML_RULES } from '../../prompts/npcCombatAssessmentRules';

export interface BuildCombatPromptParams {
  playerName: string;
  userAction: string;
  combatContextXml: string;
  storyContext: string;
  betrayalInstruction: string;
  recentLogs: string;
}

export function buildFullCombatPrompt(params: BuildCombatPromptParams): string {
  const {
    playerName,
    userAction,
    combatContextXml,
    storyContext,
    betrayalInstruction,
    recentLogs
  } = params;

  // 1. Khối sự kiện lật mặt (nếu có)
  const betrayalSection = betrayalInstruction 
    ? `<su_kien_lat_mat>\n${betrayalInstruction.trim()}\n</su_kien_lat_mat>\n\n` 
    : '';

  // 2. Khối hành động người chơi
  const mcActionSection = `<mc_action>\n[HÀNH ĐỘNG / LỜI THOẠI MỚI NHẤT CỦA MC (${playerName})]:\n"${userAction}"\n</mc_action>`;

  // 3. Khối hướng dẫn nhiệm vụ hệ thống
  const systemInstructionsSection = `<huong_dan_system>
  <qui_tac_luc_chien>
    <luat_phan_chia_+qui_tac_luc_chien>================
    1. Bạn phải phân chia rõ ràng phần suy nghĩ chiến thuật trong <thinking>...</thinking> hoặc <tuong_than>...</tuong_than> và diễn biến lời kể trong <noi_dung>...</noi_dung>.
    ================</luat_phan_chia_+qui_tac_luc_chien>

${NPC_COMBAT_ASSESSMENT_XML_RULES}

    <luat_prethinking_structure_+qui_tac_luc_chien>================
    Bên trong thẻ suy nghĩ (ví dụ <tuong_than> hoặc <thinking>), bạn BẮT BUỘC phải thực hiện phân tích sâu sắc theo đúng cấu trúc 5 bước sau đây:
    
    1. Phân tích bối cảnh: Xác định địa điểm, nhân vật tham gia (MC, đồng minh, kẻ thù), trạng thái hiện tại và ý đồ hành động cụ thể của MC.
    2. Phân tích chỉ số và kỹ năng: Xác định HP, MP, ATK, DEF và kỹ năng của từng bên từ dữ liệu bối cảnh để làm căn cứ.
    3. Tính toán chiến đấu:
       - Đánh giá tính logic vật lý/phép thuật của đòn đánh, tính toán lượng HP/MP tiêu hao và biến động dựa trên chỉ số công/thủ thực tế.
       - **MỤC THẨM ĐỊNH 3 CÂU HỎI VỚI TẤT CẢ NPC CHIẾN ĐẤU (BẮT BUỘC DUYỆT 100% CÁC NPC KHÔNG BỎ SÓT)**: Đối với MỖI VÀ MỌI NPC đang tham chiến (toàn bộ đồng minh và kẻ địch), bạn BẮT BUỘC phải duyêt qua từng nhân vật và trả lời đủ 3 câu hỏi:
         • NPC là ai?
         • Phản ứng thái độ của NPC trước hành động của MC?
         • NPC sẽ thực hiện hành động TÁC ĐỘNG THỰC TẾ nào trong lượt này? (BẮT BUỘC tấn công, hồi phục, xuất chiêu, đỡ đòn... CẤM biểu cảm hò hét suông).
         
         *Ví dụ mẫu cho mục 3 câu hỏi này*:
         Hành động của MC: "Vén váy của Liễu Thanh Thanh (đồng minh) nhằm dụ dỗ Cổ Nguyệt Lôi (kẻ địch)"
         
         - Liễu Thanh Thanh:
           + Là ai? Là bạn cùng lớp của MC, tính tình chua ngoa, đanh đá.
           + Phản ứng? Bị tốc váy: Thật xấu hổ, không thể chịu được, phải đích thân đánh cho tên ngốc này một trận.
           + Hành động? Ngay lập tức chuyển phe, dùng tay tát thẳng vào mặt MC.
           
         - Cổ Nguyệt Lôi:
           + Là ai? Là một học sinh cùng lớp đang tức tối vì bị MC khiêu khích.
           + Phản ứng? Vô cùng tức giận trước thái độ cợt nhả của MC.
           + Hành động? Lập tức tụ khí tung chiêu Hỏa Cầu Thuật nhắm thẳng vào đầu MC. (TUYỆT ĐỐI CẤM chỉ đứng trơ mắt ra nhìn).
           
    4. Diễn biến kể chuyện: Lập kịch bản chi tiết cho lời kể lượt này (đảm bảo 100% các NPC đều xuất hiện hành động/động thái).
    5. Cập nhật chỉ số: Chốt hạ mức HP, MP tiêu hao và còn lại, kèm trạng thái mới của tất cả các bên tham chiến.
    ================</luat_prethinking_structure_+qui_tac_luc_chien>
    
    <luat_chong_cuop_loi_va_godmode_+qui_tac_luc_chien>================
    1. NGUYÊN TẮC "HÀNH ĐỘNG LÀ Ý ĐỊNH" (CHỐNG GOD-MODE):
       - Mọi nội dung người chơi nhập vào ô hành động CHỈ ĐƯỢC XEM LÀ "DỰ ĐỊNH", "NỖ LỰC" hoặc "MONG MUỐN" của nhân vật chính, KHÔNG PHẢI là diễn biến bắt buộc phải xảy ra hay sự thật đã rồi.
       - Bạn TUYỆT ĐỐI KHÔNG được chấp nhận các kết quả có lợi do người chơi tự ý viết sẵn trong câu lệnh (ví dụ: tự viết mình đánh trúng, tự viết đối phương đầu hàng, tự viết đối phương yêu thương/sợ hãi, tự viết mình né được hoàn toàn).
       - Bạn phải dựa vào chỉ số ATK, DEF, tốc độ và tính cách thật sự của NPC để quyết định hành động đó thành công, thất bại hay bị phản tác dụng.

    2. NGUYÊN TẮC "DIỄN BIẾN TOÀN VẸN" (CHỐNG CƯỚP LỜI / NHẢY CƠ HỌC):
       - Bạn KHÔNG ĐƯỢC PHÉP nhảy cóc thời gian (ví dụ: Người chơi nói "chạy đến đấm", bạn không được viết ngay "Sau cú đấm của Hình Hàm, đối phương ngã quỵ").
       - Bạn BẮT BUỘC phải mô tả đầy đủ hành động của MC từ lúc chưa hành động cho đến lúc MC đã hành động, không được nhảy tắt đến bối cảnh sau khi hành động xong. Cụ thể phải có 3 giai đoạn:
         + Giai đoạn 1 (Khởi động): MC vận sức thế nào, di chuyển ra sao, biểu cảm của các bên khi MC bắt đầu lao lên.
         + Giai đoạn 2 (Thực thi): MC tiếp cận, tung chiêu thức, vung tay/chân cụ thể như thế nào.
         + Giai đoạn 3 (Va chạm & Hệ quả): Phản ứng thực tế của mục tiêu (né tránh, đỡ đòn, phản công, chịu đòn) dựa trên logic thực lực thực tế.

    *Ví dụ mẫu để AI học tập*:
    - Người chơi nhập hành động của MC: "Chạy đến tốc váy Mộ Dung (đồng minh), được nàng ta vuốt ve má, kẻ địch sợ hãi đầu hàng xin tha".
    - Phân tích và xử lý của AI:
      + Ý định của MC: Chạy đến tốc váy Mộ Dung với hy vọng kỳ quặc là được vuốt ve và dọa kẻ địch.
      + Thực tế bối cảnh: Mộ Dung có tính cách kiêu ngạo, lạnh lùng, sức mạnh vượt trội MC. Kẻ địch đang áp đảo và muốn tiêu diệt MC.
    - Kết quả mô tả của AI: 
      + Tả cảnh MC bắt đầu lén lút vận lực xuống đôi chân, lao vụt tới vạt áo của Mộ Dung.
      + Vừa tốc váy lên, thay vì được vuốt ve nũng nịu, Mộ Dung lập tức đỏ bừng mặt vì xấu hổ và tức giận, tung một bạt tai trời giáng "CHÁT!" làm MC bay xa 3 mét.
      + Kẻ địch chứng kiến trò cười này thì cười nhạo báng, tăng thêm sự khinh bỉ và cảnh giác tấn công quyết liệt hơn chứ không hề sợ hãi hay đầu hàng.
    ================</luat_chong_cuop_loi_va_godmode_+qui_tac_luc_chien>
    
    <luat_tu_tuong_+qui_tac_luc_chien>================
    2. Hãy miêu tả sinh động, giật gân, bám sát các chỉ số HP/MP và kỹ năng của thực thể.
    ================</luat_tu_tuong_+qui_tac_luc_chien>
    
    <luat_chi_so_tac_dong_+qui_tac_luc_chien>================
    3. RÀNG BUỘC TAG BIẾN ĐỘNG CHỈ SỐ CƠ HỌC (BẮT BUỘC):
       - Mỗi khi có nhân vật (MC hoặc NPC) xuất chiêu tốn linh lực, gây sát thương, hoặc trị liệu trong đoạn văn <noi_dung>, bạn BẮT BUỘC phải xuất đầy đủ các tag ý đồ hành động COMBAT_ACTION để hệ thống tự động tính toán sát thương cơ học chuẩn xác. TUYỆT ĐỐI không tự nhẩm hay điền số lượng sát thương (amount) tự bịa.
       - Cú pháp chuẩn hóa:
         + Đối với người chơi: source="player" hoặc target="player"
         + Đối với NPC (Kẻ địch/Đồng minh): source/target="phe|id@@Tên Nhân Vật"
         + Tag hành động chiến đấu: [COMBAT_ACTION: source="...", target="...", action="attack", skill="Tên_Chiêu_Thức", hit_type="crit|normal|glance"]
         + Tag trị liệu hồi phục: [COMBAT_ACTION: source="...", target="...", action="heal", skill="Tên_Trị_Liệu", intensity="high|medium|low"]
         + Tag dùng/tiêu hao MP (nếu có chiêu thức tốn nhiều mana): [MP_CHANGE: target="...", amount="-500", skill="..."]
         + Tag hiệu ứng/trạng thái: [STATUS: target="...", effect="Bị thương|Choáng|Trúng độc|Tử trận", duration="1", source="..."]
     ================</luat_chi_so_tac_dong_+qui_tac_luc_chien>

    <vi_du_mau_mot_luot_dau_hoan_chinh_+qui_tac_luc_chien>================
    [VÍ DỤ MẪU CHUẨN MỰC CHO MỘT LƯỢT ĐẤU HOÀN CHỈNH (END-TO-END TURN EXAMPLE)]:
    
    Giả sử bối cảnh:
    - Phe ta: MC (Tô Triệt), Đồng minh: Liễu Như Yên (ally|npc_01@@Liễu Như Yên)
    - Phe địch: Hắc Y Kiếm Khách (enemy|npc_02@@Hắc Y Kiếm Khách), Xích Diễm Hổ (enemy|npc_03@@Xích Diễm Hổ)
    - Hành động của MC: "Ta vung kiếm chém vào sườn của Hắc Y Kiếm Khách, đồng thời nhắc Liễu Như Yên cẩn thận con hổ!"

    KẾT QUẢ PHẢN HỒI MẪU CỦA BẠN SẼ CÓ DẠNG:
    <thinking>
    1. Phân tích bối cảnh: Tô Triệt cùng Liễu Như Yên giao chiến với Hắc Y Kiếm Khách và Xích Diễm Hổ. Tô Triệt tấn công Kiếm Khách và cảnh báo đồng minh.
    2. Chỉ số: Tô Triệt (ATK: 400), Hắc Y Kiếm Khách (DEF: 150), Liễu Như Yên (MP: 300), Xích Diễm Hổ (ATK: 350).
    3. Thẩm định 100% NPC trên sân:
       • Liễu Như Yên:
         - Là ai? Đồng minh tu vi Luyện Khí tầng 5, dùng pháp trượng băng sương.
         - Phản ứng? Nghe MC cảnh báo, lập tức cảnh giác trước cú vồ của Xích Diễm Hổ.
         - Hành động? Lập tức tụ khí MP tung ra kỹ năng "Băng Thuẫn Thuật" dựng khiên chắn phía trước chặn móng vuốt của hổ.
       • Hắc Y Kiếm Khách:
         - Là ai? Kẻ địch kiếm thuật hung tàn.
         - Phản ứng? Thấy kiếm của MC chém tới sườn, cười lạnh xoay kiếm đón đỡ nhưng vẫn bị trúng sát thương nhẹ.
         - Hành động? Vận kình phản kích, tung chiêu "Hắc Vân Trảm" chém ngược vào vai MC.
       • Xích Diễm Hổ:
         - Là ai? Yêu thú hoang dã hung hãn.
         - Phản ứng? Gầm thét dữ dội lao vào Liễu Như Yên.
         - Hành động? Tung cú vồ móng lửa đập mạnh vào khiên băng của Liễu Như Yên.
    4. Kịch bản lời kể: Mô tả chi tiết va chạm của tất cả 4 nhân vật, không ai đứng yên.
    5. Cập nhật chỉ số: Hắc Y Kiếm Khách (-250 HP), MC (-180 HP), Liễu Như Yên (-60 MP).
    </thinking>
    
    <noi_dung>
    Tô Triệt hít sâu một hơi, chân đạp hư bộ lao vút sang sườn trái, thanh trường kiếm trong tay xé gió chém thẳng vào hông Hắc Y Kiếm Khách. Hắc Y Kiếm Khách đồng tử co rút, vội nghiêng người rút kiếm đón đỡ. Một tiếng "KENG!" chói tai vang lên tóe lửa, dù cản được hiểm chiêu nhưng kình lực mạnh mẽ vẫn rạch một đường máu trên vai áo y.
    
    "Muốn chết!" Hắc Y Kiếm Khách gầm lên, cổ tay xoay chuyển tung ra *Hắc Vân Trảm*, luồng kiếm khí đen đặc chém sượt qua bả vai Tô Triệt khiến máu tươi rỉ qua lớp áo.
    
    Cùng lúc đó, con Xích Diễm Hổ gầm thét như sấm, chồm người lao thẳng về phía Liễu Như Yên. Nhận được tiếng hô cảnh báo của Tô Triệt, Liễu Như Yên không hề hoảng loạn. Nàng nhanh chóng giơ cao pháp trượng, kết ấn cấp tốc: "Băng Bích Hộ Thân, hiện!" Một bức tường băng dày dựng đứng chắn ngang, đón trọn cú vồ kinh hồn của mãnh thú. Liễu Như Yên thở gấp, cất tiếng nhắc nhở: "Tô huynh đệ, tên kiếm khách có hộ thể cương khí, nhắm vào hạ bàn của hắn!"
    </noi_dung>

    [COMBAT_ACTION: source="player", target="enemy|npc_02@@Hắc Y Kiếm Khách", action="attack", skill="Trường kiếm trảm", hit_type="normal"]
    [COMBAT_ACTION: source="enemy|npc_02@@Hắc Y Kiếm Khách", target="player", action="attack", skill="Hắc Vân Trảm", hit_type="normal"]
    [MP_CHANGE: target="ally|npc_01@@Liễu Như Yên", amount="-60", skill="Băng Bích Hộ Thân"]
    [STATUS: target="enemy|npc_02@@Hắc Y Kiếm Khách", effect="Thương thế nhẹ", duration="1", source="player"]

    <choice>
      [CHOICE: "Lắng nghe Liễu Như Yên, tập trung kiếm chiêu công phá hạ bàn của Hắc Y Kiếm Khách"]
      [CHOICE: "Lùi lại phòng thủ, phối hợp cùng Liễu Như Yên dồn sát thương tiêu diệt Xích Diễm Hổ trước"]
      [CHOICE: "Vận chuyển linh lực tung ra tuyệt kỹ bản thân đè bẹp Hắc Y Kiếm Khách"]
      [CHOICE: "Ném phù chú mê hồn hòng làm tê liệt cả hai kẻ địch"]
      [CHOICE: "Đề nghị đàm phán đình chiến khi thế trận giằng co"]
      [CHOICE: "Tung chướng khí yểm trợ rồi cùng Liễu Như Yên rút lui"]
    </choice>
    ================</vi_du_mau_mot_luot_dau_hoan_chinh_+qui_tac_luc_chien>

    <luat_bien_dong_phe_phai_+qui_tac_luc_chien>================
    4. Khi cốt truyện hoặc hành động chiến đấu dẫn đến việc một thực thể phản bội, quy thuận hoặc triệu hồi trợ thủ, bạn được phép dùng các tag sau ở cuối phản hồi:
       - [CHUYEN_PHE: target="TÊN_MỤC_TIÊU", to="ally|enemy|neutral"] (Khi có nhân vật chuyển phe, ví dụ 'to="ally"' là sang phe ta).
       - [SUMMON_ALLY: name="TÊN_TRỢ_THỦ", hp="CHỈ_SỐ_HP", mp="CHỈ_SỐ_MP", atk="CHỈ_SỐ_ATK", faction="ally"] (Khi triệu hồi thêm đồng minh trợ chiến).
    ================</luat_bien_dong_phe_phai_+qui_tac_luc_chien>

    <quy_tac_doi_doi_hinh_+qui_tac_luc_chien>================
    1. QUYỀN HẠN ĐỔI ĐỘI HÌNH:
       - NPC Tự Động: Khi một NPC (Phe Ta hoặc Địch) đang chiến đấu có HP < 20%, có 40% xác suất NPC đó sẽ chủ động lùi về sau và gọi một NPC ở trạng thái "dự bị" lên thay thế.
       - Người Chơi Ra Lệnh: Người chơi hoàn toàn có quyền chủ động đưa ra yêu cầu đổi đội hình (ví dụ: "Đổi [NPC A] lui về, [NPC B] lên thay"). Khi người chơi yêu cầu, AI BẮT BUỘC thực thi việc đổi người.
    2. Cú pháp bắt buộc: Xuất ra tag [change_formation: out="Tên NPC lùi về", in="Tên NPC dự bị lên thay"] bên trong mảng "tags" hoặc ở cuối phản hồi.
    3. LƯU Ý QUAN TRỌNG: NPC vừa được gọi lên thay thế (in) sẽ ở trạng thái phòng thủ/chuẩn bị và KHÔNG ĐƯỢC PHÉP thực hiện bất kỳ hành động tấn công hay hỗ trợ nào khác trong chính block turn này.
    4. TÍNH MINH BẠCH QUA ĐỐI THOẠI & LỜI KỂ:
       - Tuyệt đối KHÔNG thay đổi trong yên lặng. Khi có sự hoán đổi thành viên, AI BẮT BUỘC phải mô tả rõ ràng qua hành động và lời thoại đối thoại trực tiếp:
         + NPC lùi về: Thốt lên lời báo hiệu thương thế, xin chi viện hoặc tuân lệnh lùi về tuyến sau.
         + NPC xuất chiến: Cất tiếng đáp lời/nhận lệnh, lao lên chắn trước, vận chuyển công pháp thủ thế sẵn sàng nghênh địch.
         + Phản ứng của kẻ địch: Nhận biết đối phương vừa thay người và có thái độ/phản ứng tương ứng.
    ================</quy_tac_doi_doi_hinh_+qui_tac_luc_chien>

    <quy_tac_co_van_chien_thuat_+qui_tac_luc_chien>================
    1. VAI TRÒ CỐ VẤN CHIẾN THUẬT:
       - Trong đoạn văn kể chuyện <noi_dung>, NPC đồng minh, trợ thủ hoặc trực giác chiến đấu của nhân vật BẮT BUỘC phải đóng vai trò CỐ VẤN CHIẾN THUẬT đưa ra lời gợi ý/đề xuất tối ưu nhất.
       - Các đề xuất chiến thuật bao gồm:
         + Chỉ ra sơ hở/thuộc tính tương khắc của địch và đề xuất dùng chiêu thức/kỹ năng khắc chế.
         + Nhắc nhở khi đồng minh có HP thấp và đề xuất đổi thành viên dự bị lên thay thế.
         + Đề xuất ngừng chiến, đàm phán, uy hiếp hoặc rút lui khi cán cân lực lượng quá chênh lệch.
    2. GỢI Ý HÀNH ĐỘNG <choice>:
       - Trong các lựa chọn ở thẻ <choice>, BẮT BUỘC phải có lựa chọn bám sát lời đề xuất của cố vấn chiến thuật (ví dụ: [Làm theo đề xuất của cố vấn], [Thay đổi đội hình theo đề nghị], [Đề xuất ngừng chiến], v.v.).
    ================</quy_tac_co_van_chien_thuat_+qui_tac_luc_chien>

    <quy_tac_chon_muc_tieu_thong_minh_+qui_tac_luc_chien>================
    1. Nếu hành động của người chơi hoặc NPC mô tả công kích/hỗ trợ nhưng không nói rõ mục tiêu là gì: BẠN BẮT BUỘC PHẢI tự động chọn mục tiêu là các thực thể đang có trạng thái "đang chiến đấu" (active).
    2. TUYỆT ĐỐI KHÔNG chọn mục tiêu là các thực thể đã "gục ngã" (HP = 0) hoặc đang ở trạng thái "dự bị" (reserve/benched) trừ khi người chơi chỉ đích danh tên nhân vật đó trong câu lệnh.
    ================</quy_tac_chon_muc_tieu_thong_minh_+qui_tac_luc_chien>
    
    <luat_choice_+qui_tac_luc_chien>================
    5. Bạn BẮT BUỘC phải tạo ĐÚNG 6 lựa chọn phản ứng phong phú của người chơi nằm gọn trong cặp thẻ <choice> (bao gồm các lựa chọn: tấn công, phòng thủ, sử dụng pháp bảo/linh đan/kỹ năng, đổi đội hình/gọi viện trợ, đàm phán/ngừng chiến theo đề xuất của cố vấn, và cuối cùng là rút lui):
       <choice>
         [CHOICE: "Nội dung lựa chọn 1"]
         [CHOICE: "Nội dung lựa chọn 2"]
         [CHOICE: "Nội dung lựa chọn 3"]
         [CHOICE: "Nội dung lựa chọn 4"]
         [CHOICE: "Nội dung lựa chọn 5"]
         [CHOICE: "Nội dung lựa chọn 6"]
       </choice>
    ================</luat_choice_+qui_tac_luc_chien>
    
    <luat_data_sync_+qui_tac_luc_chien>================
    6. Cập nhật chính xác các chỉ số sau lượt đấu vào khối dữ liệu XML <ket_qua_giao_tranh> ở cuối cùng phản hồi.
    ================</luat_data_sync_+qui_tac_luc_chien>
  </qui_tac_luc_chien>
</huong_dan_system>`;

  // 4. Khối cấu trúc dữ liệu XML mẫu
  const outputSchemaSection = `<cau_truc_output>
<ket_qua_giao_tranh>
  <updatedOpponents>
    <opponent>
      <id>ID_Ke_Dich</id>
      <damageTaken>10</damageTaken>
      <statusEffect>Bình thường</statusEffect>
    </opponent>
  </updatedOpponents>
  <playerDamageTaken>0</playerDamageTaken>
  <playerMpUsed>0</playerMpUsed>
  <isCombatEnded>false</isCombatEnded>
  <victory>false</victory>
</ket_qua_giao_tranh>
</cau_truc_output>`;

  // Ghép nối toàn bộ cấu trúc XML chuẩn hóa
  return `${combatContextXml}

${storyContext}

${betrayalSection}<lich_su_giao_tranh_thoai_gan_nhat>
[LỊCH SỬ GIAO TRANH & THOẠI GẦN NHẤT]:
${recentLogs || '(Trận đánh vừa bắt đầu)'}
</lich_su_giao_tranh_thoai_gan_nhat>

${mcActionSection}

${systemInstructionsSection}

${outputSchemaSection}`;
}
