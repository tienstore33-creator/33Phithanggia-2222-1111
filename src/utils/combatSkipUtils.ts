
import { KnowledgeBase, StatusEffect } from '../../types';

/**
 * Logic for skipping combat with penalties.
 * Deducts half of current XP, half of current currency, and adds "Verbal Coward" status.
 */
export const applyCombatSkipPenalties = (kb: KnowledgeBase): KnowledgeBase => {
    const newKb = JSON.parse(JSON.stringify(kb)) as KnowledgeBase;
    const stats = newKb.playerStats;

    // 1. Deduct half of current XP
    const xpDeduction = Math.floor(stats.kinhNghiem / 2);
    stats.kinhNghiem = Math.max(0, stats.kinhNghiem - xpDeduction);

    // 2. Deduct half of current currency
    const currencyDeduction = Math.floor(stats.currency / 2);
    stats.currency = Math.max(0, stats.currency - currencyDeduction);

    // 3. Add "Verbal Coward" status
    const COWARD_STATUS_ID = 'status-verbal-coward';
    
    // Check if status already exists to avoid duplication (though the request says "does not accumulate")
    const existingIndex = stats.activeStatusEffects.findIndex(s => s.id === COWARD_STATUS_ID);
    
    const cowardStatus: StatusEffect = {
        id: COWARD_STATUS_ID,
        name: 'Kẻ Hèn Nhát (Verbal Coward)',
        description: 'Bạn đã bỏ chạy khỏi cuộc chiến. NPC sẽ coi thường và sỉ nhục bạn bất kể độ hảo cảm.',
        type: 'debuff',
        durationTurns: 10,
        statModifiers: {}, // No direct stat changes, just narrative effect
        specialEffects: ['VERBAL_COWARD'],
        source: 'Hệ thống'
    };

    if (existingIndex > -1) {
        // Refresh duration if it already exists
        stats.activeStatusEffects[existingIndex].durationTurns = 10;
    } else {
        stats.activeStatusEffects.push(cowardStatus);
    }

    // 4. Clear pending combat
    newKb.pendingCombat = null;

    return newKb;
};
