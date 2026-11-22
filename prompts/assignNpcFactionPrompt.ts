import { NPC, Faction } from '../types';

export const assignNpcToFactionPrompt = (npc: Partial<NPC>, factions: Faction[]): string => {
    return `
Bạn là một nhà phân tích chính trị trong một thế giới game nhập vai. Nhiệm vụ của bạn là chỉ định một NPC mới gặp vào một phe phái hợp lý nhất dựa trên hồ sơ của họ và các phe phái hiện có.

**HỒ SƠ NPC:**
- Tên: ${npc.name}
- Mô tả: ${npc.description}
- Tính cách: ${(npc.personalityTraits || []).join(', ')}
- Cảnh giới/Cấp độ: ${npc.realm}
- Chủng tộc: ${npc.race}

**CÁC PHE PHÁI HIỆN CÓ:**
${factions.map(f => `- Tên: ${f.name}\n  - Chính/Tà: ${f.alignment}\n  - Mô tả: ${f.description}`).join('\n')}

**NHIỆM VỤ:**
Dựa vào hồ sơ của NPC và mô tả của các phe phái, phe phái nào là phù hợp nhất về mặt logic? Hãy xem xét tính cách, chủng tộc, cấp độ sức mạnh (cảnh giới), và mô tả của họ.

**ĐỊNH DẠNG PHẢN HỒI:**
Chỉ trả về **DUY NHẤT TÊN** của phe phái phù hợp nhất. Không thêm bất kỳ lời giải thích hay văn bản nào khác.

**VÍ DỤ:**
Nếu NPC là một kiếm sĩ chính trực và có phe "Chính Nghĩa Minh", bạn sẽ trả về:
Chính Nghĩa Minh
`;
};
