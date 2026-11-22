import { KnowledgeBase } from "../../types";

/**
 * Executes a 2% chance roll to trigger an NPC danger event.
 * If triggered, returns a system prompt string that forces the AI to create a life-threatening situation
 * for one of the top 10 highest-affinity NPCs.
 * Returns null if the event is not triggered.
 */
export const rollNpcDangerEvent = (knowledgeBase: KnowledgeBase): string | null => {
    // Roll 1-100, trigger on 1-2 (2% chance)
    const roll = Math.floor(Math.random() * 100) + 1;
    if (roll > 2) {
        return null; // Not triggered
    }

    const allNpcs = [
        ...(knowledgeBase.discoveredNPCs || []),
        ...(knowledgeBase.wives || []),
        ...(knowledgeBase.slaves || []),
        ...(knowledgeBase.prisoners || []),
    ];

    if (allNpcs.length === 0) {
        return null;
    }

    // Sort by affinity descending and take top 10
    const sortedNpcs = allNpcs.sort((a, b) => (b.affinity || 0) - (a.affinity || 0));
    const top10 = sortedNpcs.slice(0, 10);

    // Pick a random NPC from the top 10
    const targetNpc = top10[Math.floor(Math.random() * top10.length)];

    return `[CƠ CHẾ ĐẶC BIỆT - KHẨN CẤP]: Bằng mọi giá, trong lượt kể chuyện này, bạn PHẢI tạo ra một tình huống nguy hiểm ảnh hưởng đến tính mạng/sự tồn tại của NPC "${targetNpc.name}". Tình huống này có thể là một phân cảnh trực tiếp đập vào mắt nhân vật chính, hoặc là một phân cảnh song song đang diễn ra ở nơi khác (tuỳ thuộc vào vị trí hiện tại của họ). Sự an nguy của NPC này phải là trọng tâm căng thẳng của cốt truyện hiện hành!`;
};
