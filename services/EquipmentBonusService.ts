import { ItemRarity } from '../templates';

/**
 * Calculates mechanical percentage bonus stats (dòng ẩn) for an item based on its rarity and tier (realm).
 * 
 * Probabilities (handled by rarity mapping here):
 * Phổ thông (Common)    ~60%    0 dòng
 * Hiếm (Rare)          ~25%    2 dòng
 * Quý Báu (Precious)   ~10%    4 dòng
 * Cực Phẩm (Epic)      ~4%     6 dòng
 * Thần Thoại (Legendary) ~0.9%   8 dòng
 * Chí Tôn (Supreme)    ~0.1%   10 dòng
 */

export const BONUS_LINES_BY_RARITY: Record<string, number> = {
    [ItemRarity.PHO_THONG]: 0,
    'common': 0,
    [ItemRarity.HIEM]: 2,
    'rare': 2,
    [ItemRarity.QUY_BAU]: 4,
    'precious': 4,
    'epic': 6,
    [ItemRarity.CUC_PHAM]: 6,
    'heroic': 6,
    [ItemRarity.THAN_THOAI]: 8,
    'legendary': 8,
    [ItemRarity.CHI_TON]: 10,
    'mythic': 10,
};

export const AVAILABLE_BONUS_STATS = [
    'sucTanCong',
    'maxSinhLuc',
    'maxLinhLuc',
    'phongNgu'
];

/**
 * Generate bonus percentage stats mechanically
 * @param rarity String rarity of the item
 * @param realmString The realm of the item to determine Tier
 * @param majorRealms Array of major realms to determine Tier index
 * @returns Record of stats with their percentage value
 */
export function generateBonusPercentageStats(
    rarity: string,
    realmString: string,
    majorRealms: string[] = []
): Record<string, number> {
    const normRarity = rarity || ItemRarity.PHO_THONG;
    
    // Fallback if rarity doesn't match directly
    let linesToGenerate = 0;
    for (const [key, value] of Object.entries(BONUS_LINES_BY_RARITY)) {
        if (normRarity.toLowerCase() === key.toLowerCase()) {
            linesToGenerate = value;
            break;
        }
    }

    if (linesToGenerate === 0) {
        return {};
    }

    // Determine Tier (1-based index for math)
    let tier = 1;
    if (realmString && majorRealms.length > 0) {
        const realmLower = realmString.toLowerCase();
        // Sort majorRealms by length descending to match longest names first
        const sortedMajors = [...majorRealms].sort((a, b) => b.length - a.length);
        
        let foundIndex = -1;
        for (const majorName of sortedMajors) {
            if (realmLower.includes(majorName.toLowerCase())) {
                foundIndex = majorRealms.indexOf(majorName);
                break;
            }
        }
        
        if (foundIndex === -1) {
            // Fallback to first word split if no inclusion match found
            const majorPart = realmString.split(' ')[0].toLowerCase();
            foundIndex = majorRealms.findIndex(r => r.toLowerCase().includes(majorPart));
        }

        if (foundIndex !== -1) {
            tier = foundIndex + 1; // e.g. Luyện Khí (index 0) -> Tier 1
        }
    }

    // Calculate Min and Max % based on Tier
    // Tier 1: 1% - 3%
    // Tier 3: 4% - 6%
    // Tier 5: 7% - 9%
    // Tier 8: 11.5% - 13.5% (close to 10-15%)
    const minPercent = 1 + (tier - 1) * 1.5;
    const maxPercent = 3 + (tier - 1) * 1.5;

    const bonuses: Record<string, number> = {};
    const pool = [...AVAILABLE_BONUS_STATS];
    
    for (let i = 0; i < linesToGenerate; i++) {
        // Pick a random stat from the pool
        const statIndex = Math.floor(Math.random() * pool.length);
        const selectedStat = pool[statIndex];
        
        // Calculate the random % value within range
        // e.g. Math.random() * (3 - 1) + 1 = 1 to 3
        const randomValue = Math.random() * (maxPercent - minPercent) + minPercent;
        
        // Round to 2 decimal places
        const finalValue = Math.round(randomValue * 100) / 100;
        
        // If stat already has a bonus, add to it (stacking same stat if we run out of unique stats)
        if (bonuses[selectedStat]) {
            bonuses[selectedStat] += finalValue;
        } else {
            bonuses[selectedStat] = finalValue;
        }
    }

    return bonuses;
}
