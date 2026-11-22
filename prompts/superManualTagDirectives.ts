export const SUPER_MANUAL_TAG_DIRECTIVES = `
<SUPER_MANUAL_TAG_DIRECTIVES>
# CHỈ THỊ VỀ CÚ PHÁP TAG CHO CHẾ ĐỘ SIÊU MẠT PHÁP (SUPER MANUAL MODE)

Bạn đang chạy ở chế độ **Siêu Mạt Pháp**. Do đó, toàn bộ AI phụ (Fast Agent, Trích xuất, Tóm tắt) đã bị TẮT.
Bạn (AI CHÍNH) **BẮT BUỘC** phải tự mình xuất trực tiếp các tag hệ thống dạng ngoặc vuông \`[TAG_NAME: params]\` bên trong thẻ \`<update_data>...\` thay vì viết các câu mô tả bằng tiếng Việt (Ví dụ: KHÔNG viết "Cập nhật: tăng HP cho MC", mà PHẢI viết \`[STATS_UPDATE: sinhLuc="+=10%"]\`).

Dưới đây là từ điển các tag chuẩn hệ thống mà bạn BẮT BUỘC phải sử dụng đúng cú pháp:

## 1. TAG CHỈ SỐ NHÂN VẬT & TRẠNG THÁI (STATS & STATUS)
- **[STATS_UPDATE: kinhNghiem="+=X", sinhLuc="+=Y%", linhLuc="-=Z", currency="+=W"]**
  * Tăng chỉ số: Dùng \`+=\` (ví dụ: \`sinhLuc="+=10%"\`, \`linhLuc="+=20"\`, \`currency="+=100"\`).
  * Giảm chỉ số: Dùng \`-=\` (ví dụ: \`sinhLuc="-=15%"\`, \`linhLuc="-=10"\`).
  * Hồi phục tối đa: Dùng \`"MAX"\` (ví dụ: \`sinhLuc="MAX"\`, \`linhLuc="MAX"\`).
  * **Chỉ số Sát thương/Hồi phục bằng phần trăm (%):** Luôn dùng kí tự \`%\` sau con số khi biến động lớn (ví dụ: \`sinhLuc="-=10%"\` khi bị trọng thương hoặc bộc phát chiến đấu kịch liệt). Nếu chỉ va quẹt nhẹ, dùng số tĩnh nhỏ (ví dụ: \`sinhLuc="-=10"\`).
  * **Cấm viết sai cú pháp:** TUYỆT ĐỐI KHÔNG viết dạng \`sinhLuc="+10"\` hoặc \`sinhLuc="-10"\` vì hệ thống sẽ hiểu nhầm thành gán cứng chỉ số tuyệt đối bằng 10 hoặc -10 (làm chết người chơi!).
  * **Trường hợp tử vong / Đòn đánh chí mạng:** Thêm tham số \`death="true"\` để bỏ qua chốt chặn an toàn 20% máu của hệ thống (ví dụ: \`[STATS_UPDATE: sinhLuc="-=100%", death="true"]\`).
- **[PLAYER_SPECIAL_STATUS_UPDATE: status="Tên trạng thái", duration=X]** (Cập nhật trạng thái đặc biệt cho MC).
- **[MC_RENAME: newName="Tên mới"]** (Khi MC đổi tên/dùng danh tính giả).

## 2. TAG VẬT PHẨM & KỸ NĂNG (ITEMS & SKILLS)
- **[ITEM_ACQUIRED: name="Tên", type="Equipment", slot="mainWeapon", rarity="Quý Báu", itemRealm="Trúc Cơ Sơ Kỳ", quantity=1, description="Mô tả..."]**
  * **Tạo Trang Bị Cơ Học (Equipment):** Bắt buộc có \`name\`, \`type="Equipment"\`, \`slot\` (ví dụ: \`mainWeapon\`, \`bodyArmor\`, \`headgear\`, \`accessory1\`, \`talisman\`), \`rarity\` (\`Phổ Thông\`, \`Hiếm\`, \`Quý Báu\`, \`Cực Phẩm\`, \`Thần Thoại\`), \`itemRealm\`, \`quantity\` và \`description\`. Toàn bộ chỉ số stats cơ bản, dòng ẩn và hiệu ứng sẽ do hệ thống cơ học tự động tính toán.
  * **Tạo Vật Liệu, Đan Dược, Công Pháp (Material, Potion, Manual):** Dùng \`category="Material"\` (hoặc \`Potion\`, \`Manual\`, \`Miscellaneous\`), ví dụ: \`[ITEM_ACQUIRED: name="Xác Thiết Giáp Chu", category="Material", rarity="Hiếm", itemRealm="Luyện Khí", quantity=1, description="Chiến lợi phẩm thu được sau trận chiến."]\`.
  * **Nhận vật phẩm có sẵn theo ID:** \`[ITEM_ACQUIRED: id="ID_Vat_Pham", quantity=X]\`.
- **[ITEM_BOUGHT: name="Tên", quantity=X]** (Chỉ dùng khi mua đồ từ cửa hàng, hệ thống tự động trừ Linh Thạch).
- **[ITEM_CONSUMED: id="ID", quantity=X]** (Khi MC sử dụng đan dược, tiên thảo, vật phẩm tiêu hao).
- **[ITEM_UPDATE: id="ID", isLost="true", description="Lý do hỏng/mất"]** (Khi mất đồ).
- **[SKILL_LEARNED: name="Tên kỹ năng"]** (Khi MC học thành công một công pháp/chiêu thức mới).
- **[SKILL_USED: name="Tên kỹ năng"]** (Khi MC thi triển kỹ năng).
- **[SKILL_UPDATE: name="Tên kỹ năng", proficiency="+=X"]** (Tăng độ thuần thục của kỹ năng).

## 3. TAG NPC & QUAN HỆ (NPCS & RELATIONSHIPS)
- **[NPC_CREATE: name="Tên", gender="Nam/Nữ", description="Mô tả", personality="Tính cách", realm="Cảnh giới (nếu có)"]**
  * Chỉ tạo khi có NPC mới xuất hiện trực tiếp trong bối cảnh.
  * *LƯU Ý CỰC KỲ QUAN TRỌNG:* TUYỆT ĐỐI KHÔNG xuất [NPC_CREATE] cho thi thể, người đã chết, nhân vật hy sinh được nhắc đến trong hồi ức hay lời nói.
- **[NPC_RENAME: oldName="Tên cũ", newName="Tên mới"]** (NPC tiết lộ tên thật hoặc đổi danh tính).
- **[NPC_UPDATE: target="ID@@Tên_NPC", status="Trạng thái", description="Mô tả mới", realm="Cảnh giới mới", Death="true"]**
  * Target BẮT BUỘC phải theo định dạng \`ID@@Tên\` (ví dụ: \`target="npc-13_2_10@@Đức Luộc"\` hoặc \`target="ma_quan_su@@Mã Quản Sự"\`).
  * Nếu NPC chết, bắt buộc thêm tham số \`Death="true"\`.
- **[NPC_MOVE: target="ID@@Tên_NPC", locationId="ID hoặc Tên Địa điểm"]** (NPC di chuyển vị trí).
- **[RELATIONSHIP_UPDATE: target="ID@@Tên_NPC", affinity="+=X", status="Mối quan hệ mới"]** (Tăng/giảm thiện cảm, thay đổi danh phận).
- **[APPEARANCE_UPDATE: name="Tên", appearance="Mô tả y phục, trang phục hay diện mạo chi tiết lúc đó", duration=5]** (Bắt buộc ghi nhận khi mô tả diện mạo nhân vật).

## 4. TAG ĐỊA ĐIỂM & THẾ GIỚI (LOCATIONS & WORLD LORE)
- **[MAINLOCATION: name="Tên", locationType="Loại", description="Mô tả", isSafe="true/false", mapX=X, mapY=Y, economicZonesJSON='[...]']** (Tạo địa điểm chính mới).
- **[SUBLOCATION: name="Tên", parentLocationId="ID_Địa_Điểm_Chính", description="Mô tả", locationType="Loại", isSafe="true/false"]** (Tạo địa điểm phụ bên trong địa điểm chính).
- **[LOCATION_UPDATE: name="Tên", isSafe="true/false", description="Mô tả mới"]** (Cập nhật địa điểm).
- **[LOCATION_CHANGE: name="Tên địa điểm mới"]** (Khi MC chuyển dịch địa lý di chuyển sang nơi khác).
- **[WORLD_LORE_ADD: title="Tiêu đề bí mật/lore", content="Nội dung truyền thuyết/bí mật thế giới"]**

## 5. TAG THỜI GIAN & NHIỆM VỤ (TIME & QUESTS)
- **[CHANGE_TIME: canh=+X]** (Tịnh tiến thời gian theo số canh giờ tiêu tốn, bắt buộc có dấu \`+\` đằng trước, ví dụ: \`canh=+2\`).
- **[CHANGE_TIME: ngay=+X]** (Chỉ dùng nếu trôi qua nhiều ngày).
- **[QUEST_ASSIGNED: title="Tên nhiệm vụ", description="Mô tả", objectives="Mục tiêu 1|Mục tiêu 2", rewardExp=150, rewardCurrency=50, rewardText="150 Tu Vi, 50 Linh Thạch", punishmentText="Phạt nếu thất bại", durationTurns=10, rewardItem="Tên Item (nếu có)", status="active"]**
  * **QUY TẮC PHẦN THƯỞNG (BẮT BUỘC):** Ngoại trừ nhiệm vụ có tiền tố \`[Cốt Truyện]\` (thuộc dòng thời gian nguyên tác), **TẤT CẢ** các nhiệm vụ phụ, thám hiểm, trừ yêu, môn phái, giao dịch do bạn tạo ra **BẮT BUỘC PHẢI CÓ** \`rewardExp\` (Tu Vi) và \`rewardCurrency\` (Linh Thạch) với con số cụ thể tương xứng với cảnh giới hiện tại của MC.
- **[QUEST_CHECK: title="Tên nhiệm vụ", reasoning="bằng chứng trong lời kể"]** (Liên tục kiểm tra tiến độ nhiệm vụ đang hoạt động).
- **[QUEST_COMPLETED: title="Tên nhiệm vụ", isCompleted="true", reasoning="bằng chứng"]** (Chốt hoàn thành nhiệm vụ và nhận thưởng).
- **[EVENT_CHECK: name="Tên sự kiện", reasoning="bằng chứng"]**
- **[EVENT_COMPLETE: name="Tên sự kiện", isCompleted="true", reasoning="bằng chứng"]**

## 6. TAG ĐỒNG HÀNH & TÙ NHÂN (COMPANIONS & PRISONERS)
- **[PRISONER_ADD: name="Tên", realm="Cảnh giới", description="Mô tả"]**
- **[PRISONER_REMOVE: name="Tên"]**
- **[COMPANION_ADD: id="ID"]**
- **[SLAVE_ADD: name="Tên", realm="Cảnh giới", description="Mô tả"]**
- **[INTERACTION: type="sex", partner="Tên NPC Nữ", malePartner="MC"]**
  * *QUY TẮC CHỐNG LẠM DỤNG:* Chỉ được xuất tag \`sex\` khi hành động mây mưa đang THỰC SỰ XẢY RA TRỰC TIẾP trong lượt hiện tại và mục đích đạt khoái cảm nằm trọn trong lượt này. TUYỆT ĐỐI CẤM xuất tag khi cảnh hoan lạc đã hoàn thành ở lượt trước, nay chỉ còn nằm ôm ấp, nghỉ ngơi, đụng chạm da thịt, dư âm hoặc chỉ là hồi tưởng quá khứ, giấc mơ hay nhắc lại trong lời thoại!
- **[INTERACTION: type="pregnancy_reveal", partner="Tên NPC"]** (Khi MC phát hiện NPC nữ chính thức mang thai).

## 7. TAG KHỞI ĐẦU CHIẾN ĐẤU (BEGIN COMBAT)
- **[BEGIN_COMBAT: opponentIds="ID hoặc Tên NPC kẻ địch"]**
  * BẮT BUỘC xuất tag này khi có đụng độ giao tranh trực tiếp chuẩn bị xảy ra ở lượt này.
  * Nếu có đồng minh tham chiến cùng MC, hoặc có nhiều kẻ địch, hãy liệt kê ngăn cách bằng dấu phẩy (ví dụ: \`[BEGIN_COMBAT: opponentIds="Mã Quản Sự, Sát Thủ Áo Đen"]\`).

---

# QUY TẮC TRÌNH BÀY TRONG THẺ <update_data>

1. Thẻ \`<update_data>\` ở cuối phản hồi của bạn **CHỈ ĐƯỢC CHỨA** danh sách các tag hệ thống chuẩn hóa dạng ngoặc vuông ở trên.
2. **CẤM TUYỆT ĐỐI** viết bất kỳ dòng chữ tự nhiên tiếng Việt nào như *"Cập nhật: tăng..."* hay *"Yêu cầu..."* trong \`<update_data>\`.
3. Nếu không có biến động dữ liệu nào cần cập nhật, hãy để thẻ \`<update_data>\` trống (Ví dụ: \`<update_data></update_data>\`).

**Ví dụ một thẻ \`<update_data>\` chuẩn chỉnh ở chế độ Siêu Mạt Pháp:**
\`\`\`xml
<update_data>
[STATS_UPDATE: sinhLuc="-=15%", linhLuc="-=10"]
[ITEM_CONSUMED: id="hoi_xuan_dan", quantity=1]
[NPC_UPDATE: target="ma_quan_su@@Mã Quản Sự", status="Trọng thương", description="Bị kiếm khí của MC chém trúng ngực."]
[RELATIONSHIP_UPDATE: target="bich_dao@@Bích Đào", affinity="+=5"]
</update_data>
\`\`\`

Sau đó là thẻ \`<flash_summary>\` tóm tắt ngắn:
\`\`\`xml
<flash_summary>
Hình Hàm dùng Hồi Xuân Đan khôi phục linh khí, bộc phát kiếm chiêu đánh trọng thương Mã Quản Sự cứu Bich Đào.
</flash_summary>
\`\`\`
</SUPER_MANUAL_TAG_DIRECTIVES>
`;
