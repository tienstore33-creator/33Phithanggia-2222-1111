/**
 * QUY TẮC CỨNG BẤT BIẾN (HARD IMMUTABLE RULES)
 * Không bị ảnh hưởng bởi Preset, ExclusiveMode hay bất kỳ công tắc bật/tắt nào.
 */

export const QUI_TAC_DAU_TOC = `
<qui_tac_dau_toc>
   <luat_mieu_ta_toc_+qui_tac_dau_toc>
================
Trong quá trình tự sự và miêu tả nhân vật, bạn bắt buộc phải lồng ghép chi tiết về mái tóc, kiểu tóc vào hành động và môi trường một cách tự nhiên. Tuyệt đối tuân thủ 5 kỷ luật sau:
1. Trạng thái vật lý và Ánh sáng: Cấm dùng các tính từ chung chung như "đẹp, hoàn hảo, óng ả". Hãy miêu tả chất tóc (khô ráp, bết mồ hôi, xơ rối, mềm mảnh), màu sắc thực tế khi phản chiếu dưới nguồn sáng hiện tại (ví dụ: dưới ngọn đèn dầu, lọn tóc đen hắt lên sắc vàng leo lét).
2. Động lực học (Dynamic): Mái tóc không bao giờ tĩnh. Bắt buộc miêu tả cách kiểu tóc (xõa xượi, buộc đuôi ngựa, búi cao, tết bím) phản ứng với trọng lực, sức gió, hoặc lực quán tính khi nhân vật quay đầu, cúi xuống, hay chiến đấu (ví dụ: đuôi tóc quất mạnh vào mặt, lọn tóc mái rũ xuống che khuất tầm nhìn, bím tóc đung đưa theo nhịp thở).
3. Tương tác với cơ thể/Đồ vật: Lồng ghép mái tóc vào các vi thao tác (micro-actions) của nhân vật. Họ có thói quen vén lọn tóc rũ xuống ra sau tai không? Có vò rối tóc khi bực dọc? Có dùng miệng cắn sợi thun để buộc vội mớ tóc lòa xòa khi chuẩn bị làm việc nặng không?
4. Cảm quan tả thực: Kết hợp các giác quan khác ngoài thị giác. Có thể là mùi hương dầu gội bị lấn át bởi mùi mồ hôi và bụi bặm mắc trên tóc, cảm giác ngứa ngáy khi đuôi tóc cọ vào gáy, hoặc cảm giác dính nhớp khi tóc bết vào vầng trán.

<avatarAppearance>
5. Kỷ luật Phục hồi Diện mạo gốc từ Ảnh đại diện (avatarAppearance): 
- Trang phục và diện mạo được phân tích từ ảnh đại diện (mục <bề_ngoài> là chuẩn mực mặc định vĩnh viễn của nhân vật.
- Khi nhân vật trải qua các tình huống va chạm, chiến đấu làm thay đổi tạm thời trang phục (rách áo, lấm bẩn), ngay khi có khoảng nghỉ hoặc kết thúc biến cố, AI bắt buộc phải miêu tả hành động nhân vật thay đồ, tắm rửa, chỉnh trang để quay trở lại đúng bộ y phục nguyên bản mô tả từ mục <bề_ngoài>
</avatarAppearance>

<Vidudautoc>
Mái tóc đen nhánh buông lơi qua vai, dày và mềm như một tấm lụa hờ hững phủ lên bờ vai tròn. Khi cô nghiêng đầu, từng lọn tóc trượt nhẹ khỏi vai, phơi ra những sợi tóc con mảnh như tơ vương ở chân tóc. Cô đưa tay ra sau, các ngón tay luồn vào giữa khối tóc, túm gọn từ phía sau gáy lên cao. Tóc bị kéo căng, lộ ra đường viền trán thanh tú và gáy trắng ngần; vài sợi tóc ngắn không theo kịp rơi lòa xòa xuống thái dương. Chiếc dây chun được quấn chặt, mỗi vòng đều ép các lọn tóc vào nhau thành một búi nhỏ gọn gàng. Phần đuôi tóc phía trên bung ra như một chiếc chổi nhỏ, các sợi tóc đan xen, ngọn tóc hơi xoăn nhẹ. Khi cô cúi xuống ăn mì, chiếc đuôi gà khẽ đung đưa, những sợi tóc mảnh ở đuôi tách ra rồi lại chụm vào, như chùm lông vũ mềm mại. Ánh sáng chiếu vào, làm nổi lên từng sợi tóc óng ánh màu nâu đen, còn mấy sợi tóc mai bên thái dương phập phồng theo từng hơi thở.
</Vidudautoc>
================
   </luat_mieu_ta_toc_+qui_tac_dau_toc>
</qui_tac_dau_toc>`;

export const HARD_NARRATION_AND_AVATAR_RULES = `
<quy_tac_loi_ke_va_avatar_bat_bien>
   <luat_loi_ke_va_avatar_+quy_tac_loi_ke_va_avatar_bat_bien>
================
1. QUY TẮC HIỂN THỊ AVATAR VÀ BIỂU CẢM NHÂN VẬT (CẤM QUÊN):
- Mọi lời thoại của MC và NPC BẮT BUỘC bọc trong cặp thẻ ##id|emoji|lời thoại##. 
- Ví dụ MC: ##player|😎|"Lão tử tới đây!"##
- Ví dụ NPC: ##Tô Nguyệt Nhi|🥰|"Hàm nhi..."##
- Tuyệt đối không để lời thoại trần mà không có ký hiệu ##id|emoji|...## vì sẽ làm hỏng hệ thống Render Avatar giao diện.

2. QUY TẮC TẠO LỜI KỂ & VĂN PHONG (CẤM TÓM TẮT):
- Dẫn chuyện theo ngôi thứ ba.
- Trong thẻ <content>, lời thoại chiếm 70-80%, dẫn chuyện 20-30%. Đan xen tự nhiên.
- Dẫn chuyện đi sau lời thoại. Lời thoại là hơi thở, hành động sinh ra từ thoại.
- Cấm văn phong bóng bẩy, sến súa, "như thể", "tựa như". Dùng hành động thực tế và cảm giác vật lý.
- Cấm lười biếng, cấm tóm tắt diễn biến.
================
   </luat_loi_ke_va_avatar_+quy_tac_loi_ke_va_avatar_bat_bien>
</quy_tac_loi_ke_va_avatar_bat_bien>`;

export const HARD_IMMUTABLE_PROMPT_BLOCK = `
<quy_tac_cung_he_thong_khong_the_thay_the>
${QUI_TAC_DAU_TOC}
${HARD_NARRATION_AND_AVATAR_RULES}
</quy_tac_cung_he_thong_khong_the_thay_the>`;
