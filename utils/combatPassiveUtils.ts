
import { Combatant, PlayerStats, TuChatTier } from '../types';
import { TU_CHAT_MULTIPLIERS } from '../constants/npc';

export interface ParsedPassives {
    damageBoost: number;      // Nhóm A: Xuyên giáp + Tăng tốc + Chính xác + Giảm hồi chiêu + Giảm tiêu hao
    damageReduction: number;  // Nhóm B: Né tránh + Kháng tất cả + Hồi phục + Miễn nhiễm + Hấp thụ
    lifesteal: number;        // Nhóm C
    reflect: number;          // Nhóm C
    critChance: number;       // Nhóm C
    critDamage: number;       // Nhóm C
    expGoldBonus: number;     // Nhóm E
    boostBreakdown: string[]; // Danh sách các hiệu ứng tăng damage để hiển thị log
    reductionBreakdown: string[]; // Danh sách các hiệu ứng giảm damage để hiển thị log
}

/**
 * Phân loại và tổng hợp các hiệu ứng bị động từ trang bị
 */
export const parseCombatPassives = (equipmentPassives: Record<string, number> = {}): ParsedPassives => {
    const p: ParsedPassives = {
        damageBoost: 0,
        damageReduction: 0,
        lifesteal: 0,
        reflect: 0,
        critChance: 0,
        critDamage: 0,
        expGoldBonus: 0,
        boostBreakdown: [],
        reductionBreakdown: []
    };

    if (!equipmentPassives) return p;

    Object.entries(equipmentPassives).forEach(([key, value]) => {
        const k = key.toLowerCase().trim();
        if (value <= 0) return;

        // Nhóm A - Tăng Sát Thương (Additive Damage Boost)
        if (['xuyên giáp', 'tăng tốc', 'chính xác', 'giảm hồi chiêu', 'giảm tiêu hao linh lực'].includes(k)) {
            p.damageBoost += value / 100;
            p.boostBreakdown.push(`${key} +${value}%`);
        }
        // Nhóm B - Giảm Sát Thương (Additive Damage Reduction)
        else if (['né tránh', 'kháng tất cả', 'hồi phục sinh lực', 'hồi phục linh lực', 'miễn nhiễm', 'hấp thụ sát thương'].includes(k)) {
            p.damageReduction += value / 100;
            p.reductionBreakdown.push(`${key} ${value}%`);
        }
        // Nhóm C - Cơ chế đặc biệt
        else if (k === 'hút máu') {
            p.lifesteal += value / 100;
        }
        else if (k === 'phản sát thương' || k === 'phản đòn') {
            p.reflect += value / 100;
        }
        else if (k === 'chí mạng') {
            p.critChance += value / 100;
        }
        else if (k === 'sát thương chí mạng') {
            p.critDamage += value / 100;
        }
        // Nhóm E - Gia tăng phần thưởng
        else if (k === 'tăng kinh nghiệm' || k === 'tăng vàng') {
            p.expGoldBonus += value / 100;
        }
    });

    return p;
};

/**
 * Tính toán sát thương cuối cùng dựa trên các chỉ số passive
 * Công thức: DMG = Base * (1 + Sum_A) * (1 - Sum_B)
 */
export const calculateFinalDamage = (baseDmg: number, attackerPassives: ParsedPassives, defenderPassives: ParsedPassives): number => {
    // Áp dụng tăng sát thương từ người đánh
    const boostedDmg = baseDmg * (1 + attackerPassives.damageBoost);
    
    // Áp dụng giảm sát thương từ người thủ
    // Giới hạn giảm tối đa 90% để tránh bất tử hoàn toàn
    const finalDmgPercentage = Math.max(0.1, 1 - defenderPassives.damageReduction);
    const finalDmg = boostedDmg * finalDmgPercentage;
    
    return Math.floor(Math.max(1, finalDmg));
};

/**
 * Tính toán kinh nghiệm thưởng thêm
 * Công thức: Bonus = (targetMaxHp * 0.1) * (1 + attackerPassives.expGoldBonus) * tuChatMultiplier
 */
export const calculateExpBonus = (targetMaxHp: number, attackerPassives: ParsedPassives, tuChat?: TuChatTier): number => {
    const baseBonus = targetMaxHp * 0.1;
    const tuChatMultiplier = tuChat ? (TU_CHAT_MULTIPLIERS[tuChat] || 1.0) : 1.0;
    const finalBonus = baseBonus * (1 + attackerPassives.expGoldBonus) * tuChatMultiplier;
    return Math.floor(finalBonus);
};
