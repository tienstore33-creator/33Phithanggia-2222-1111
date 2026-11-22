
import { KnowledgeBase, NPC, Wife, Slave, Prisoner } from '../types';
import { VIETNAMESE } from '../constants';

export const generateChallengeContextPrompt = (
    kb: KnowledgeBase,
    target: NPC | Wife | Slave | Prisoner
): string => {
    const player = kb.worldConfig?.playerName || 'Người Chơi';
    const currentLocation = kb.discoveredLocations.find(l => l.id === kb.currentLocationId);

    const bystanders: (NPC | Wife | Slave | Prisoner)[] = [
        ...kb.discoveredNPCs,
        ...kb.wives,
        ...kb.slaves,
        ...kb.prisoners,
    ].filter(p => p.id !== target.id && p.locationId === kb.currentLocationId);

    const targetFaction = 'factionId' in target ? kb.discoveredFactions.find(f => f.id === (target as NPC).factionId) : null;
    const targetFactionName = targetFaction?.name || 'Vô phái';
    const playerReputationWithTargetFaction = targetFaction?.playerReputation || 0;

    const bystandersString = bystanders.length > 0
        ? `**Những người khác có mặt tại hiện trường:**\n` + bystanders.map(b => {
            const bFaction = 'factionId' in b ? kb.discoveredFactions.find(f => f.id === (b as NPC).factionId) : null;
            const bFactionName = bFaction?.name || 'Vô phái';
            return `- ${b.name} (Phe: ${bFactionName}, Thiện cảm với người chơi: ${b.affinity})`;
        }).join('\n')
        : "Không có ai khác ở hiện trường.";

    return `
Bạn là một AI Quản Trò chuyên nghiệp, có vai trò là một "Thẩm Phán Bối Cảnh" trong một game nhập vai. Nhiệm vụ của bạn là phân tích một hành động khiêu chiến và quyết định hậu quả một cách logic và hợp lý.

**BÁO CÁO TÌNH HÌNH:**

*   **Hành Động:** Người chơi "${player}" đã tuyên bố ý định tấn công "${target.name}".
*   **Địa điểm:** ${currentLocation?.name || 'Không rõ'}.
*   **Thông Tin Mục Tiêu (${target.name}):**
    *   Thân phận: ${'entityType' in target ? (target as any).entityType : 'NPC'}
    *   Mô tả: ${target.description}
    *   Lịch sử: ${(target.history || []).join(' | ')}
    *   Phe phái: ${targetFactionName} (Uy tín của người chơi với phe này: ${playerReputationWithTargetFaction})
    *   Thiện cảm với người chơi: ${target.affinity}
    *   Cảnh giới: ${target.realm || 'Không rõ'}

*   **Bối Cảnh Xung Quanh:**
    ${bystandersString}

**NHIỆM VỤ CỦA BẠN (AI THẨM PHÁN):**
Dựa vào TOÀN BỘ thông tin trên, hãy phân tích và đưa ra phán quyết. **KHÔNG** viết lời kể. Chỉ trả về các tag hệ thống.

1.  **Phân Tích Bối Cảnh (Nội bộ, không viết ra):**
    *   **Mối quan hệ:** Người chơi và mục tiêu là bạn hay thù? (Dựa vào \`affinity\`).
    *   **Bối cảnh xã hội:** Tấn công một thành viên của phe phái thân thiện (\`playerReputation\` cao) sẽ có hậu quả khác với tấn công kẻ thù.
    *   **Tình trạng mục tiêu:** Mục tiêu có phải là kẻ phản đồ, tội phạm bị truy nã không? (Dựa vào \`description\` và \`history\`). Tấn công một kẻ phản đồ có thể sẽ được phe phái của hắn ủng hộ.
    *   **Phản ứng của người ngoài:** Những người xung quanh sẽ phản ứng thế nào? Họ sẽ bênh vực ai? (Dựa vào phe phái và thiện cảm của họ với người chơi và mục tiêu).

2.  **Đưa Ra Phán Quyết (Trả về bằng TAGS):**

    *   **a. Quyết Định Phe Chiến Đấu (BẮT BUỘC):**
        *   Sử dụng tag \`[BEGIN_COMBAT: opponentIds="ID_1,ID_2,..."]\`.
        *   \`opponentIds\`: Liệt kê tên của tất cả những ai sẽ tham gia chiến đấu chống lại người chơi.
        *   **Ví dụ 1 (Tấn công kẻ thù):** \`[BEGIN_COMBAT: opponentIds="${target.name}, Đồng bọn A, Đồng bọn B"]\`
        *   **Ví dụ 2 (Tấn công tên phản đồ của phe thân thiện):** \`[BEGIN_COMBAT: opponentIds="${target.name}"]\` (Chỉ có tên phản đồ là kẻ địch).
        *   **Ví dụ 3 (Tấn công người vô tội):** \`[BEGIN_COMBAT: opponentIds="${target.name}, Lính gác C, Lính gác D"]\` (Lính gác can thiệp).

    *   **b. Cập Nhật Trạng Thái Xã Hội (Rất khuyến khích):**
        *   Sử dụng tag \`[NPC_UPDATE: ...]\` (hoặc \`WIFE_UPDATE\`, \`SLAVE_UPDATE\`) để thay đổi thiện cảm của những người xung quanh.
        *   **Ví dụ (Tấn công tên phản đồ):**
            \`[NPC_UPDATE: name="Trưởng Lão Vương", affinity=+=15, description="Trưởng Lão Vương tỏ ra hài lòng khi bạn ra tay trừ hại."]\`
            \`[NPC_UPDATE: name="Đệ Tử Trần", affinity=-=10, description="Đệ Tử Trần tỏ ra sợ hãi và bối rối."]\`
            \`[FACTION_UPDATE: name="${targetFactionName}", playerReputation=+=20]\` (Uy tín với phe tăng lên).

    *   **c. Tạo Lời Kể Bối Cảnh (Tùy chọn):**
        *   Sử dụng tag \`[MESSAGE: text="..."]\` để đưa ra một thông báo ngắn gọn về phản ứng của đám đông.
        *   **Ví dụ:** \`[MESSAGE: text="Những người xung quanh vội vã lùi lại, tạo thành một vòng vây quan sát, không ai có ý định can thiệp."]\`

**QUY TẮC TUYỆT ĐỐI:**
- **KHÔNG VIẾT LỜI KỂ.**
- Phản hồi của bạn chỉ được chứa các tag \`[BEGIN_COMBAT]\`, \`[NPC_UPDATE]\`, \`[WIFE_UPDATE]\`, \`[SLAVE_UPDATE]\`, \`[FACTION_UPDATE]\`, \`[MESSAGE]\`.
- Mỗi tag trên một dòng riêng.
`;
};
