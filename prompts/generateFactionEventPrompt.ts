import { KnowledgeBase } from '../types';

export const generateFactionEventPrompt = (kb: KnowledgeBase): string => {
    const factionsOverview = kb.discoveredFactions.map(f => `
- **Phe phái:** ${f.name}
  - **Chính/Tà:** ${f.alignment}
  - **Uy tín với người chơi:** ${f.playerReputation}
  - **Mô tả:** ${f.description}
  - **Đồng minh:** ${f.alliedFactionIds?.map(id => kb.discoveredFactions.find(f2 => f2.id === id)?.name).join(', ') || 'Không có'}
  - **Kẻ thù:** ${f.enemyFactionIds?.map(id => kb.discoveredFactions.find(f2 => f2.id === id)?.name).join(', ') || 'Không có'}
`).join('');

    const recentEvents = Object.values(kb.pageSummaries).slice(-2).join('\n---\n') || "Chưa có tóm tắt gần đây.";

    return `
Bạn là một AI tạo sự kiện thế giới cho một game nhập vai. Nhiệm vụ của bạn là tạo ra một sự kiện chính trị quan trọng dựa trên tình hình hiện tại của các phe phái trong thế giới.

**TÌNH HÌNH THẾ GIỚI HIỆN TẠI:**
- **Người chơi:** ${kb.worldConfig?.playerName}
- **Uy tín của người chơi với các phe phái được liệt kê bên dưới.**

**TỔNG QUAN CÁC PHE PHÁI:**
${factionsOverview}

**CÁC SỰ KIỆN GẦN ĐÂY (Để tham khảo):**
${recentEvents}

**NHIỆM VỤ:**
Tạo ra MỘT sự kiện chính trị quan trọng. Sự kiện này phải cảm thấy như một sự phát triển tự nhiên của thế giới.
Hãy xem xét khuynh hướng chính/tà, mô tả, và các mối quan hệ hiện có giữa các phe phái.

**CÁC SỰ KIỆN CÓ THỂ XẢY RA:**
- Một phe phái tuyên chiến với phe khác.
- Hai phe phái thành lập một liên minh.
- Một phe phái trải qua xung đột nội bộ hoặc một cuộc đảo chính.
- Một lãnh đạo mới, mạnh mẽ xuất hiện trong một phe phái.
- Một phe phái có một động thái lớn ảnh hưởng đến khu vực (ví dụ: xây dựng một pháo đài, khám phá một nguồn tài nguyên).

**ĐỊNH DẠNG PHẢN HỒI:**
Bạn PHẢI trả về hai thứ:
1.  Một tag **[MESSAGE: text="..."]** mô tả sự kiện dưới dạng một tin đồn hoặc tin tức mà người chơi nghe được. Đây phải là một đoạn văn ngắn gọn, súc tích.
2.  Tùy chọn, một hoặc nhiều tag **[FACTION_UPDATE: ...]** để phản ánh những thay đổi cơ học trong thế giới game. Ví dụ, thay đổi khuynh hướng, uy tín, hoặc khai báo liên minh/thù địch.

**VÍ DỤ 1 (Tuyên chiến):**
[MESSAGE: text="Tin đồn lan truyền khắp nơi: Ma Sát Tông đã chính thức tuyên chiến với Thanh Vân Môn! Căng thẳng giữa hai phe đã lên đến đỉnh điểm, chiến tranh có thể nổ ra bất cứ lúc nào."]
[FACTION_UPDATE: name="Ma Sát Tông", enemyFactionIds=+=Thanh Vân Môn]
[FACTION_UPDATE: name="Thanh Vân Môn", enemyFactionIds=+=Ma Sát Tông]

**VÍ DỤ 2 (Xung đột nội bộ):**
[MESSAGE: text="Thương Hội Vạn Kim đang rung chuyển bởi tin đồn trưởng lão Lý Tham đã cố gắng ám sát hội trưởng, nhưng thất bại và đang bị truy nã. Nội bộ thương hội đang vô cùng hỗn loạn."]
[NPC_UPDATE: name="Trưởng lão Lý Tham", description="Bị truy nã vì tội mưu sát hội trưởng Thương Hội Vạn Kim."]

**KHÔNG** viết bất kỳ lời kể nào bên ngoài các tag. Chỉ trả về các tag.
`;
};
