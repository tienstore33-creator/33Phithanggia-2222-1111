import { Combatant, OfflineCombatEffect } from '../types';

// Helper để lấy stats của combatant (Player lưu trực tiếp, NPC lưu trong .stats)
const getStats = (c: Combatant) => {
    if (c.entityType === 'player') return c as any;
    if (!(c as any).stats) (c as any).stats = {};
    if (!(c as any).stats.activeStatusEffects) (c as any).stats.activeStatusEffects = [];
    return (c as any).stats;
};

export const handleStatusLogic = {
  // Áp dụng hiệu ứng mới
  apply: (target: Combatant, effect: OfflineCombatEffect) => {
    const stats = getStats(target);
    const effects: any[] = stats.activeStatusEffects || [];
    const statusName = effect.status || '';
    const isBuff = ['PROTECT', 'SHELL', 'HASTE'].includes(statusName);
    
    if (effect.type === 'APPLY_STATUS') {
        const existing = effects.find(e => e.specialEffects?.includes(statusName));
        if (existing) {
            existing.duration = effect.duration || 0;
            existing.durationTurns = effect.duration || 0;
            // Poison stacking logic
            if (statusName === 'POISON') {
                existing.stacks = (existing.stacks || 1) + 1;
            }
        } else {
            effects.push({ 
                id: `status-${Date.now()}-${Math.random()}`,
                type: isBuff ? 'buff' : 'debuff',
                name: statusName || 'Unknown',
                description: `Hiệu ứng ${statusName}`,
                duration: effect.duration || 0, 
                durationTurns: effect.duration || 0,
                specialEffects: [statusName],
                statModifiers: {},
                stacks: 1 // Default to 1 stack
            });
        }
    } else if (effect.type === 'STAT_DEBUFF') {
        const debuffType = `DEBUFF_${effect.stat}`;
        const existing = effects.find(e => e.specialEffects?.includes(debuffType));
        if (existing) {
            existing.duration = effect.duration || 0;
            existing.durationTurns = effect.duration || 0;
        } else {
            effects.push({ 
                id: `debuff-${Date.now()}-${Math.random()}`,
                type: 'debuff',
                name: `Giảm ${effect.stat}`,
                description: `Giảm ${effect.percentage}% ${effect.stat}`,
                duration: effect.duration || 0, 
                durationTurns: effect.duration || 0,
                specialEffects: [debuffType, `${effect.stat}:${effect.percentage}`],
                statModifiers: {}
            });
        }
    }
    stats.activeStatusEffects = effects;
  },
  
  // Xử lý sát thương độc mỗi lượt
  processPoison: (combatant: Combatant) => {
    const stats = getStats(combatant);
    const poisonEffect = stats.activeStatusEffects?.find((e: any) => e.specialEffects?.includes('POISON'));
    if (poisonEffect) {
      const stacks = poisonEffect.stacks || 1;
      const damage = Math.floor((stats.maxSinhLuc || 0) * 0.05 * stacks); // 5% HP per stack per turn
      if (stats.sinhLuc !== undefined) stats.sinhLuc = Math.max(0, stats.sinhLuc - damage);
      return { damage, stacks };
    }
    return { damage: 0, stacks: 0 };
  },

  // Tính toán sát thương thực tế dựa trên Buff/Debuff
  calculateFinalDamage: (baseDmg: number, source: Combatant, target: Combatant) => {
    let multiplier = 1.0;
    const sStats = getStats(source);

    // 1. Kiểm tra Tốc độ (HASTE/SLOW)
    if (hasStatus(source, 'HASTE')) multiplier *= 1.5;
    if (hasStatus(source, 'SLOW')) multiplier *= 0.5;

    // 2. Kiểm tra Phòng thủ (PROTECT/SHELL)
    if (hasStatus(target, 'PROTECT')) multiplier *= 0.5;
    if (hasStatus(target, 'SHELL')) multiplier *= 0.5;

    // 3. Kiểm tra Giảm công (STAT_DEBUFF)
    const atkDebuff = sStats.activeStatusEffects?.find((e: any) => e.specialEffects?.includes('DEBUFF_sucTanCong'));
    if (atkDebuff) {
        const detail = atkDebuff.specialEffects.find((s: string) => s.startsWith('sucTanCong:'));
        if (detail) {
            const percent = parseInt(detail.split(':')[1] || '0');
            multiplier *= (1 - percent / 100);
        }
    }

    // 4. Kiểm tra Giảm sát thương nhận vào (DAMAGE_REDUCTION:X)
    const tStats = getStats(target);
    const reductionEffect = tStats.activeStatusEffects?.find((e: any) => e.specialEffects?.some((s: string) => s.startsWith('DAMAGE_REDUCTION:')));
    if (reductionEffect) {
        const detail = reductionEffect.specialEffects.find((s: string) => s.startsWith('DAMAGE_REDUCTION:'));
        if (detail) {
            const percent = parseInt(detail.split(':')[1] || '0');
            multiplier *= (1 - percent / 100);
        }
    }

    // 5. Equipment Passives (Chí mạng, Xuyên giáp)
    const passives = sStats.equipmentPassives || {};
    
    // CRIT (Chí mạng)
    if (passives['chí mạng'] && Math.random() * 100 < passives['chí mạng']) {
        const critMult = 1.5 + (passives['sát thương chí mạng'] || 0) / 100;
        multiplier *= critMult;
        // In CombatScreen.tsx, we could detect this multiplier to show "CRIT" text
    }

    // XUYÊN GIÁP / BỎ QUA PHÒNG THỦ
    const pierce = (passives['xuyên giáp'] || 0) + (passives['bỏ qua phòng thủ'] || 0);
    if (pierce > 0) {
        // Nếu target đang có PROTECT (giảm 50% sát thương), xuyên giáp sẽ làm giảm hiệu quả đó
        if (hasStatus(target, 'PROTECT')) {
            // Thay vì nhân 0.5, ta nhân (0.5 + 0.5 * pierce/100)
            // Ví dụ xuyên 100% thì nhân 1 (bỏ qua hoàn toàn protect)
            multiplier /= 0.5; // Huỷ bỏ PROTECT tạm thời
            multiplier *= (0.5 + (0.5 * pierce / 100)); // Áp dụng lại PROTECT đã bị giảm hiệu quả
        }
    }

    return Math.floor(baseDmg * multiplier);
  },

  // Giảm thời gian hiệu lực sau mỗi lượt
  tickDurations: (combatant: Combatant) => {
    const stats = getStats(combatant);
    if (!stats.activeStatusEffects) return;
    stats.activeStatusEffects = stats.activeStatusEffects
      .map((e: any) => ({ ...e, duration: (e.duration || 0) - 1, durationTurns: (e.durationTurns || 0) - 1 }))
      .filter((e: any) => (e.duration || 0) > 0);
  }
};

export const hasStatus = (combatant: Combatant, status: string) => {
    const stats = getStats(combatant);
    return stats.activeStatusEffects?.some((e: any) => e.specialEffects?.includes(status));
};
