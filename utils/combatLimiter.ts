export interface CombatLimitResult {
    limitedOpponentIds: string[];
    trimmedCount: number;
    maxAllowed: number;
}

/**
 * Hạn chế số lượng NPC phe địch không vượt quá 3 lần số lượng phe ta (Tối thiểu là 3 đối thủ cho 1 người chơi).
 */
export function limitCombatParticipants(
    allyIds: string[] = [],
    opponentIds: string[] = []
): CombatLimitResult {
    // Phe ta gồm 1 người chơi chính + các đồng minh
    const allyCount = Math.max(1, allyIds.length + 1); 
    const maxAllowed = allyCount * 3;

    if (opponentIds.length <= maxAllowed) {
        return {
            limitedOpponentIds: opponentIds,
            trimmedCount: 0,
            maxAllowed
        };
    }

    const limitedOpponentIds = opponentIds.slice(0, maxAllowed);
    const trimmedCount = opponentIds.length - maxAllowed;

    console.log(
        `[CombatLimiter] Giới hạn số lượng kẻ địch: Phe ta = ${allyCount}, Giới hạn địch = ${maxAllowed}. ` +
        `Đã cắt giảm ${trimmedCount} cá thể dư thừa (Từ ${opponentIds.length} xuống ${limitedOpponentIds.length}).`
    );

    return {
        limitedOpponentIds,
        trimmedCount,
        maxAllowed
    };
}
