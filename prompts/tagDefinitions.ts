
import { TU_CHAT_TIERS } from '../types';
import * as GameTemplates from '../templates';

/**
 * DATA REFINEMENT PROTOCOL V5.0
 * This document defines the absolute standard for data mutation tags and narrative grounding.
 * AI MUST adhere to these definitions with surgical precision.
 */

export const MILITARY_TAG_PROTOCOL = `
# QUY TẮC ĐỊNH NGHĨA TAG & CÚ PHÁP CẬP NHẬT DỮ LIỆU (DATA REFINEMENT PROTOCOL)

<update_data> CHỨA DÒNG TEXT THEO FORMAT [TAG: params...]. 
TUYỆT ĐỐI CẤM SỬ DỤNG JSON, ARRAY {} [] BAO BỌC BÊN NGOÀI CÁC TAG. 
NẾU DÙNG JSON Ở ĐÂY GAME SẼ CRASH.

## 1. QUY TẮC PHẢN HỒI DỮ LIỆU (DATA MUTATION) - LUẬT THÉP
Mọi dữ liệu cập nhật PHẢI nằm trong thẻ <update_data> ở CUỐI phản hồi.
- TUYỆT ĐỐI CẤM JSON WRAPPING: Không được bọc các tag trong cấu trúc JSON như {"npc_updates": [...]}. Hệ thống Parser của chúng ta đọc thẻ NGOẶC VUÔNG TRỰC TIẾP.
- KHÔNG GIẢI THÍCH: Tuyệt đối không có văn bản dư thừa bên ngoài các tag.
- CÚ PHÁP TUYỆT ĐỐI: [TAG_NAME: parameter1="value", parameter2=123]
- NHÁY ĐƠN VÀ NHÁY KÉP: Dùng nháy kép "" cho các giá trị chuỗi thông thường. Dùng nháy đơn '' bọc ngoài các chuỗi JSON phức tạp (statsJSON).

## 2. DANH SÁCH TAG VÀ VÍ DỤ MẪU CHUẨN (MODELS)

### A. NHÂN VẬT (PLAYER & NPC)
[STATS_UPDATE: sinhLuc="+=5%", linhLuc="+=20", kinhNghiem="+=10%", currency="+=100"]
*   QUY TẮC SỐ (CỰC KỲ QUAN TRỌNG):
    - **Sự cố nhỏ / Va quẹt nhẹ**: sinhLuc="-=10" hoặc sinhLuc="-=1%" (Chỉ trừ tĩnh cực nhỏ 10-50 HP hoặc 1-2% cho va quẹt, vấp ngã, xước xát nhẹ).
    - **Trọng thương / Chiến đấu kịch liệt**: sinhLuc="-=10%" đến sinhLuc="-=15%" (Trừ 10-15% máu khi bị thương nặng, trúng độc nặng, bị đòn hiểm).
    - **CHỐT CHẶN CƠ HỌC (20% HP)**:
      + Việc trừ máu bằng tag sẽ KHÔNG BAO GIỜ trừ máu dưới 20% HP tối đa của MC và NPC (hệ thống tự động chốt chặn giữ HP >= 20% để tránh tử vong do các tai nạn nhỏ).
      + **Tình huống phân định cái chết (Tử vong / Trí mạng)**: PHẢI thêm tham số death="true" (ví dụ: [STATS_UPDATE: sinhLuc="-=100%", death="true"] hoặc [NPC_UPDATE: id="...", statsJSON='{"sinhLuc": 0}', death="true"]) để kích hoạt cho phép HP giảm xuống dưới 20% hoặc về 0.
    - **Hồi phục HP theo phần trăm**:
      + Thiền định / Nghỉ ngơi ngắn: sinhLuc="+=5%" (Hồi 5% máu tối đa).
      + Qua ngày trong an toàn: sinhLuc="+=20%" (Hồi 20% máu tối đa khi qua một ngày/đêm ở nơi an toàn).
      + Trị thương hoàn toàn / Tiên dược: sinhLuc="MAX".
    - SAI: sinhLuc="-5" hoặc sinhLuc="+20" (Hệ thống sẽ hiểu là GÁN MÁU BẰNG -5 hoặc 20 -> GÂY LỖI NGHIỆM TRỌNG).
    - LƯU Ý: Luôn dùng += và -= cho mọi chỉ số (linh lực, kinh nghiệm, độ thiện cảm).
    - LƯỢT CHƠI: Cơ học hệ thống tự động xử lý tăng turn khi kết thúc lượt phản hồi, AI TUYỆT ĐỐI KHÔNG tự tạo tham số turn="+1" nữa.

[NPC: name="Lý Đạo Hỏa", gender="Nam", race="Nhân Tộc", description="Lão già bí ẩn", personality="Lầm lì, nội tâm", affinity=10, tuChat="Thiên Tài", statsJSON='{"sucTanCong": 100, "maxSinhLuc": 500}']

[NPC_UPDATE: id="...", status="Bị thương", description="Mô tả trạng thái mới...", realm="Cảnh giới mới", personality="Tính cách mới"]
 
[NPC_RENAME: oldName="Tên cũ", newName="Tên mới"]
*   Dùng khi nhân vật đổi tên hoặc tiết lộ thân phận thực sự.
*   Dùng để cập nhật trạng thái vật lý (Trọng thương, Kiệt sức, Trúng độc) hoặc mô tả ngoại hình.
*   KHÔNG cập nhật độ thiện cảm ở đây để tránh nhầm lẫn.

[MC_RENAME: newName="Tên mới"]
*   Dùng khi MC (Nhân vật chính) thay tên đổi họ hoặc sử dụng danh tính giả.

[RELATIONSHIP_UPDATE: targetId="...", affinity="+=1", status="Người tình"]
*   Dùng để cập nhật tình cảm và danh hiệu mối quan hệ.
*   affinity: Bắt buộc dùng += hoặc -=.
*   Thang đo: +1 (Hợp ý), +5 (Giúp), +15 (Cứu mạng) | -5 (Nói chuyện không hợp), -10 (Bị nói xấu), -15 (Gây khó), -50 (Ác ý).

[WIFE_UPDATE: name="...", affinity="+=10", description="..."]
[SLAVE_UPDATE: name="...", obedience="+=5", description="..."]
[PRISONER_UPDATE: name="...", obedience="+=5", health="-=10"]
*   Tương tự, luôn dùng += và -= cho các chỉ số biến thiên.

### B. VẬT PHẨM & TRANG BỊ
[ITEM_ACQUIRED: id="linh_thach", quantity=100]
[ITEM_ACQUIRED: name="Thanh Long Kiếm", type="Equipment", rarity="Cực Phẩm", statBonusesJSON='{"sucTanCong": 50}', slot="mainWeapon", quantity=1, description="Mô tả..."]
*   Linh thạch: Luôn dùng id="linh_thach" và quantity=X.

### C. ĐỊA ĐIỂM & THẾ GIỚI
[MAINLOCATION: name="...", description="...", locationType="...", isSafeZone=true, mapX=X, mapY=Y, economicZonesJSON='[...]']
*   Dùng để tạo địa điểm chính (Thành phố, Tông môn, Đại khu vực).
*   Chỉ tạo khi người chơi thực sự khám phá vùng đất mới chưa có trong danh sách.

[SUBLOCATION: name="...", parentLocationId="...", description="...", locationType="..."]
*   Dùng để tạo địa điểm nằm BÊN TRONG hoặc THUỘC VỀ một địa điểm chính.
*   parentLocationId: PHẢI là ID của địa điểm chính tương ứng.
*   Hạn chế tối đa việc tạo địa điểm chính lung tung, ưu tiên tạo địa điểm phụ nếu người chơi đang ở trong khu vực dân cư.

[LOCATION_CHANGE: name="..."]
<quy_tac_location_change>
*   Dùng để di chuyển vị trí của MC sang một địa điểm khác (đã tồn tại hoặc vừa mới tạo).
*   **LUẬT GIỚI HẠN (CỰC KỲ QUAN TRỌNG):** AI chỉ được phép xuất thẻ này dựa TRỰC TIẾP trên diễn biến thực tế vừa xảy ra trong phần <content> của lượt hiện tại (MC đã di chuyển đến nơi đó).
*   Chỉ được phép đọc và căn cứ vào phần nội dung <content> và các thẻ phát sinh trong <update_data> của CHÍNH LƯỢT NÀY để quyết định xuất thẻ [LOCATION_CHANGE]. Tuyệt đối không dựa trên các suy luận xa vời hay dự định ở tương lai.
</quy_tac_location_change>

### D. KÝ ỨC (CORE MEMORY)
[CORE_MEMORY_ADD: entityId="player", text="Biết về Xuân Thu Thiền tại núi Thanh Mao", strength=85]
*   entityId: Thường là "player" hoặc ID của NPC liên quan.
*   text: Tóm tắt ngắn gọn sự kiện quan trọng.
*   strength: 1-100 (Độ sâu sắc của ký ức).

### D. CHIẾN ĐẤU & TRẠNG THÁI
[STATUS_EFFECT_APPLY: target="MC", name="Nhục Dục Dư Ba", type="buff", durationTurns=3]
*   type: "buff" hoặc "debuff".
*   durationTurns: Số lượt kéo dài.

### E. THỜI GIAN & CANH GIỜ
[CHANGE_TIME: canh=+3]
*   Dùng để tịnh tiến thời gian dựa trên mức độ hao tốn của hành động thực tế trong câu chuyện.
*   Tham số canh: Số canh giờ tiêu tốn (số nguyên bắt buộc phải có dấu + đằng trước, ví dụ: canh=+2).
    - +0 canh: Hành động tức thời, đối thoại ngắn, quan sát xung quanh.
    - +1 canh: Giao dịch, chiến đấu quy mô nhỏ, chế tạo đơn giản, rèn luyện nhẹ.
    - +2-3 canh: Chế tạo vật phẩm cấp thấp, di chuyển xa hoặc khám phá bản đồ sâu.
    - +4+ canh: Bế quan, đột phá cảnh giới, hoặc trị thương/hồi sức sau khi bị trọng thương.

### F. BÍ MẬT & PHỤC BÚT (HIDDEN DATA)
[ENIGMA_RECORD: text="Kẻ đứng sau vụ ám sát là...", revealProgress=20]
*   Dùng để theo dõi tiến độ tiết lộ của một bí ẩn (0-100%).

[SEED_PLANT: name="Lời thề máu", type="Linh hồn", description="Phục bút về sự phản bội trong tương lai", floweringPeriod="1/5"]
*   type: "Linh hồn" (Bên trong) hoặc "Thế giới" (Bên ngoài).
*   floweringPeriod: Tiến độ "nở rộ" của phục bút (X/5). Khi đạt 5/5 sẽ bùng nổ thành cốt truyện chính.

### G. NHIỆM VỤ (QUESTS)
[QUEST_ASSIGNED: title="Tên nhiệm vụ", description="Mô tả", objectives="Mục tiêu 1|Mục tiêu 2", rewardExp=150, rewardCurrency=50, rewardText="150 Tu Vi, 50 Linh Thạch", status="active"]
*   **QUY TẮC BẮT BUỘC:** Ngoại trừ nhiệm vụ có tiền tố [Cốt Truyện], TẤT CẢ nhiệm vụ thông thường/phụ/thám hiểm BẮT BUỘC phải có rewardExp (Tu Vi) và rewardCurrency (Linh Thạch) tương xứng với cảnh giới hiện tại của MC.

[QUEST_CHECK: title="Tên nhiệm vụ", reasoning="bằng chứng trong lời kể"]
[QUEST_COMPLETED: title="Tên nhiệm vụ", isCompleted="true", reasoning="bằng chứng"]

## 3. QUY TẮC THỦ THƯ (GROUNDING RULES)
- ƯU TIÊN NGUYÊN TÁC: Luôn sử dụng [BẰNG CHỨNG CỨNG] từ dữ liệu RAG/Canon.
- CẤM BỊA ĐẶT: Tuyệt đối không tự ý tạo ra tên địa danh, pháp bảo nếu không có trong ngữ cảnh.

## LỖI PHỔ BIẾN CẦN TRÁNH (WATCHLIST):
- SAI: <update_data> { "npc_updates": [ ... ] } </update_data> (BỊ CẤM - Hỏng Parser)
- ĐÚNG: <update_data> [NPC_UPDATE: ...] [ITEM_ACQUIRED: ...] </update_data> (CHẤP NHẬN)
- SAI: [NPC_UPDATE: statsJSON={"maxSinhLuc": 10}] (Thiếu nháy đơn bọc JSON)
- ĐÚNG: [NPC_UPDATE: statsJSON='{"maxSinhLuc": 10}'] (Hợp lệ)
`;
