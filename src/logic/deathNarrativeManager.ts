import { KnowledgeBase, NPC } from '../../types';

/**
 * Quét toàn bộ danh sách NPC trong KnowledgeBase để phát hiện các NPC có HP <= 0
 * và chưa được miêu tả cái chết (deathNarrated !== true).
 * Trả về chuỗi thông báo hệ thống được định dạng chuẩn nếu tìm thấy.
 */
export function getDeathNarrativeWarning(kb: KnowledgeBase): string {
    if (!kb) return "";

    const npcList: NPC[] = [
        ...(kb.discoveredNPCs || []),
        ...(kb.wives || []).map(w => w as unknown as NPC),
        ...(kb.slaves || []).map(s => s as unknown as NPC),
        ...(kb.prisoners || []).map(p => p as unknown as NPC)
    ];

    // Lọc trùng ID
    const uniqueNpcs: NPC[] = [];
    const seenIds = new Set<string>();
    for (const npc of npcList) {
        if (npc && npc.id && !seenIds.has(npc.id)) {
            seenIds.add(npc.id);
            uniqueNpcs.push(npc);
        }
    }

    const deadNpcsWithNoNarration = uniqueNpcs.filter(npc => {
        const hp = npc.stats?.sinhLuc ?? (npc as any).hp ?? 100;
        return hp <= 0 && npc.deathNarrated !== true;
    });

    if (deadNpcsWithNoNarration.length === 0) {
        return "";
    }

    const names = deadNpcsWithNoNarration.map(npc => npc.name).join(", ");

    return `
[HỆ THỐNG CƠ HỌC TỰ ĐỘNG THÔNG BÁO]
Phát hiện NPC có HP = 0 ở lượt này: ${names}.
-> YÊU CẦU: Hãy miêu tả chi tiết cái chết hoặc sự gục ngã của họ trong lời kể truyện lần này!
`;
}

/**
 * Trả về danh sách các NPC có HP <= 0 và chưa được miêu tả cái chết.
 */
export function getNPCsNeedingDeathNarrative(kb: KnowledgeBase): NPC[] {
    if (!kb) return [];

    const npcList: NPC[] = [
        ...(kb.discoveredNPCs || []),
        ...(kb.wives || []).map(w => w as unknown as NPC),
        ...(kb.slaves || []).map(s => s as unknown as NPC),
        ...(kb.prisoners || []).map(p => p as unknown as NPC)
    ];

    const uniqueNpcs: NPC[] = [];
    const seenIds = new Set<string>();
    for (const npc of npcList) {
        if (npc && npc.id && !seenIds.has(npc.id)) {
            seenIds.add(npc.id);
            uniqueNpcs.push(npc);
        }
    }

    return uniqueNpcs.filter(npc => {
        const hp = npc.stats?.sinhLuc ?? (npc as any).hp ?? 100;
        return hp <= 0 && npc.deathNarrated !== true;
    });
}
