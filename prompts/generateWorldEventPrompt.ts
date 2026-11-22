
import { KnowledgeBase } from '../types';
import * as GameTemplates from '../templates';

export const generateWorldEventPrompt = (kb: KnowledgeBase): string => {
    const factionsOverview = kb.discoveredFactions.map(f => `- ${f.name} (${f.alignment})`).join('\n');
    const locationsOverview = kb.discoveredLocations.filter(l => !l.parentLocationId).map(l => `- ${l.name} (${l.locationType})`).join('\n');

    return `
Bạn là một AI quản trò, có nhiệm vụ tạo ra một sự kiện thế giới trọng đại (World Event) để làm cho thế giới game trở nên sống động và khó lường. Đây là lượt thứ ${kb.playerStats.turn}, một thời điểm thích hợp cho biến cố lớn.

**BỐI CẢNH THẾ GIỚI HIỆN TẠI:**
- **Thế giới:** Chủ đề "${kb.worldConfig?.theme}", thể loại "${kb.worldConfig?.genre}".
- **Người chơi:** ${kb.worldConfig?.playerName}, cảnh giới ${kb.playerStats.realm}.
- **Các phe phái đã biết:**
${factionsOverview || 'Chưa có'}
- **Các địa điểm chính đã biết:**
${locationsOverview || 'Chưa có'}

**NHIỆM VỤ:**
Hãy thực hiện kịch bản sau và mô tả nó một cách chi tiết, hoành tráng.

**KỊCH BẢN BẮT BUỘC:**
**Bí Cảnh/Di Tích Xuất Hiện:** Một bí cảnh cổ xưa, động phủ Tiên nhân, hoặc một vùng đất cấm kỵ vừa mở ra. Nơi này chứa đầy cơ duyên nhưng cũng cực kỳ nguy hiểm.

**YÊU CẦU PHẢN HỒI:**
1.  **VIẾT LỜI KỂ (NARRATION):**
    *   Mô tả sự kiện dưới dạng một hiện tượng thiên văn (bầu trời nứt ra, ánh sáng lạ), một tin tức chấn động lan truyền khắp tu chân giới, hoặc một rung chấn mà người chơi cảm nhận được.
    *   Tạo cảm giác gấp rút, thôi thúc người chơi phải hành động (đi thám hiểm, đi bảo vệ, v.v.).

2.  **TẠO TAGS HỆ THỐNG (BẮT BUỘC ĐỂ NGƯỜI CHƠI TƯƠNG TÁC):**
    *   **BẮT BUỘC** dùng tag \`[MAINLOCATION: ...]\` để tạo địa điểm đó trên bản đồ.
        *   \`locationType\` PHẢI LÀ \`"${GameTemplates.LocationType.DUNGEON}"\`, \`"${GameTemplates.LocationType.RUIN}"\`, hoặc \`"${GameTemplates.LocationType.CAVE}"\`.
        *   Đặt \`isSafeZone=false\`.
        *   Tạo tọa độ \`mapX\`, \`mapY\` ngẫu nhiên (0-1000) nhưng khác biệt với các vị trí cũ.

**ĐỊNH DẠNG:** Chỉ trả về lời kể và các tag. KHÔNG thêm bất kỳ lời dẫn nào khác.

**VÍ DỤ:**
Bầu trời phía Đông bỗng nhiên nhuộm đỏ như máu. Một tiếng nổ kinh thiên động địa vang lên, chấn động cả đại lục. Từ trong hư không, một ngọn núi lơ lửng ẩn hiện trong sương mù dày đặc dần lộ diện. Tin đồn lập tức lan ra: "Huyết Ma Cung" - nơi chôn cất Ma Tôn đời trước đã tái xuất thế gian! Vô số tu sĩ đang điên cuồng đổ về đó tìm kiếm cơ duyên.
[MAINLOCATION: name="Huyết Ma Cung", description="Di tích của Ma Tôn cổ đại, nơi chứa đầy cạm bẫy và ma bảo. Sát khí ngút trời.", locationType="${GameTemplates.LocationType.DUNGEON}", isSafeZone=false, mapX=850, mapY=200]
`;
};
