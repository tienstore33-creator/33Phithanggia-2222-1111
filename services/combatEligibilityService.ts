import { NPC } from '../types';

/**
 * Kiểm tra xem một NPC có đủ điều kiện để tham gia chiến đấu dựa trên trạng thái hiện tại hay không.
 * @param npc Đối tượng NPC cần kiểm tra.
 * @returns true nếu NPC đủ điều kiện, false nếu không.
 */
const isCombatReady = (npc: NPC): boolean => {
    // Trạng thái bị cấm tham chiến
    const forbiddenStatuses = ['exhausted', 'bound', 'unconscious', 'injured'];
    
    // Giả định npc.status là một trường trong NPC hoặc stats
    const status = (npc.stats as any)?.status || 'healthy';
    const isForbidden = forbiddenStatuses.includes(status.toLowerCase());

    if (isForbidden) {
        console.log(`NPC ${npc.name} (ID: ${npc.id}) is not combat ready due to status: ${status}`);
        return false;
    }
    return true;
};

/**
 * Hợp nhất danh sách NPC cố định (nô lệ, tù binh) và danh sách NPC theo ngữ cảnh,
 * đồng thời loại bỏ trùng lặp và lọc các NPC không đủ điều kiện.
 * @param fixedRoster Danh sách NPC luôn có trong đội hình (nô lệ, tù binh).
 * @param contextualRoster Danh sách NPC có mặt trong ngữ cảnh chiến đấu.
 * @returns Danh sách cuối cùng các NPC đủ điều kiện tham chiến.
 */
export const getFinalCombatRoster = (fixedRoster: NPC[], contextualRoster: NPC[]): NPC[] => {
    const rosterMap = new Map<string, NPC & { isFixed?: boolean }>();

    // 1. Thêm danh sách cố định (Ưu tiên cao nhất)
    fixedRoster.forEach(npc => {
        if (npc?.id) {
            if (isCombatReady(npc)) {
                rosterMap.set(npc.id, { ...npc, isFixed: true });
            } else {
                console.log(`Fixed roster NPC ${npc.name} (ID: ${npc.id}) is not combat ready and will be excluded.`);
            }
        }
    });

    // 2. Thêm danh sách ngữ cảnh (Nếu chưa tồn tại và đủ điều kiện)
    contextualRoster.forEach(npc => {
        if (npc?.id && !rosterMap.has(npc.id)) {
            // Kiểm tra thái độ: NPC thù địch sẽ bị loại bỏ khỏi danh sách phe ta
            // Giả định npc.attitude là một trường trong NPC hoặc stats
            const attitude = (npc as any).attitude || 'neutral';
            if (attitude === 'hostile') {
                console.log(`Contextual NPC ${npc.name} (ID: ${npc.id}) is hostile and will not be added to player's roster.`);
                return;
            }

            if (isCombatReady(npc)) {
                rosterMap.set(npc.id, { ...npc, isFixed: false });
            } else {
                console.log(`Contextual NPC ${npc.name} (ID: ${npc.id}) is not combat ready and will be excluded.`);
            }
        }
    });

    const finalRoster = Array.from(rosterMap.values());
    console.log(`Final combat roster generated with ${finalRoster.length} participants.`);
    return finalRoster;
};
