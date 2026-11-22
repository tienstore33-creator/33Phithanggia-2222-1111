import { KnowledgeBase } from '../../types';

export type HardcoreDeathResult = 
    | { type: 'samsara' }
    | { type: 'none' };

export function processFatality(kb: KnowledgeBase, isFromCombat: boolean): HardcoreDeathResult {
    // TH 1: Tử vong trong CHIẾN ĐẤU (Có tính lũy số lần chết)
    if (isFromCombat) {
        if (!kb.playerStats.deathCount) kb.playerStats.deathCount = 0;
        kb.playerStats.deathCount += 1;

        // Chưa chết quá 2 lần -> cho phép AI dã ngoại sinh sự kiện giải cứu bình thường
        if (kb.playerStats.deathCount <= 2) {
            return { type: 'none' };
        }
    }

    // Luôn luôn Luân Hồi Tái Sinh khi chết hoặc tự sát
    return { type: 'samsara' };
}

