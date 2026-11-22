import { calculateMechanicalStats } from '../services/ItemStatService';
import { generateBonusPercentageStats } from '../services/EquipmentBonusService';

export const OFFENSIVE_PASSIVES = ['xuyên giáp', 'chí mạng', 'sát thương chí mạng', 'hút máu', 'tăng tốc', 'chính xác', 'giảm hồi chiêu', 'giảm tiêu hao linh lực'];
export const DEFENSIVE_PASSIVES = ['né tránh', 'kháng tất cả', 'phản đòn', 'hồi phục sinh lực', 'hồi phục linh lực', 'miễn nhiễm', 'hấp thụ sát thương'];
export const REWARD_PASSIVES = ['tăng kinh nghiệm', 'tăng vàng'];

const RARITY_MULTIPLIERS: Record<string, number> = {
    'Phổ Thông': 1.0,
    'Hiếm': 1.5,
    'Quý Báu': 2.0,
    'Cực Phẩm': 3.0,
    'Thần Thoại': 5.0,
    'Truyền Thuyết': 10.0
};

const RARITY_PASSIVE_COUNT: Record<string, number> = {
    'Phổ Thông': 0,
    'Hiếm': 1,
    'Quý Báu': 2,
    'Cực Phẩm': 3,
    'Thần Thoại': 4,
    'Truyền Thuyết': 5
};

export const generateEquipment = (
    name: string,
    levelStr: string,
    rarity: string,
    equipmentType: string,
    majorRealms: string[] = [],
    playerRealm: string = 'Luyện Khí'
) => {
    const level = parseInt(levelStr) || 1;
    
    // Normalize rarity name to match templates/mappings
    let normalizedRarity = rarity;
    if (rarity === 'Thường' || rarity === 'Phổ thông') normalizedRarity = 'Phổ Thông';
    if (rarity === 'Thần Khí') normalizedRarity = 'Thần Thoại';

    const multiplier = RARITY_MULTIPLIERS[normalizedRarity] || RARITY_MULTIPLIERS['Phổ Thông'] || 1.0;
    
    // 1. Gán Slot tùy theo equipmentType
    const equipmentTypeLower = equipmentType.toLowerCase();
    
    let slot = 'mainWeapon';
    if (equipmentTypeLower.includes('vũ khí chính') || equipmentTypeLower.includes('vũ khí') || equipmentTypeLower.includes('kiếm') || equipmentTypeLower.includes('đao') || equipmentTypeLower === 'mainweapon') slot = 'mainWeapon';
    else if (equipmentTypeLower.includes('vũ khí phụ') || equipmentTypeLower.includes('khiên') || equipmentTypeLower.includes('đỡ đòn') || equipmentTypeLower === 'offhandweapon') slot = 'offHandWeapon';
    else if (equipmentTypeLower.includes('giáp đầu') || equipmentTypeLower.includes('mũ') || equipmentTypeLower.includes('nón') || equipmentTypeLower === 'head') slot = 'head';
    else if (equipmentTypeLower.includes('giáp thân') || equipmentTypeLower.includes('áo') || equipmentTypeLower.includes('y phục') || equipmentTypeLower === 'body') slot = 'body';
    else if (equipmentTypeLower.includes('giáp tay') || equipmentTypeLower.includes('bao tay') || equipmentTypeLower.includes('găng') || equipmentTypeLower === 'hands') slot = 'hands';
    else if (equipmentTypeLower.includes('giáp chân') || equipmentTypeLower.includes('giày') || equipmentTypeLower.includes('ủng') || equipmentTypeLower === 'legs') slot = 'legs';
    else if (equipmentTypeLower.includes('pháp bảo') || equipmentTypeLower.includes('linh bảo') || equipmentTypeLower === 'artifact') slot = 'artifact';
    else if (equipmentTypeLower.includes('thú cưng') || equipmentTypeLower.includes('linh thú') || equipmentTypeLower.includes('sủng vật') || equipmentTypeLower === 'pet') slot = 'pet';
    else if (equipmentTypeLower.includes('trang sức 2') || equipmentTypeLower.includes('nhẫn 2') || equipmentTypeLower === 'accessory2') slot = 'accessory2';
    else if (equipmentTypeLower.includes('trang sức') || equipmentTypeLower.includes('nhẫn') || equipmentTypeLower.includes('dây chuyền') || equipmentTypeLower === 'accessory1') slot = 'accessory1';

    // Calculate mechanical stats and percentage stats using standard services
    const statBonuses = calculateMechanicalStats(normalizedRarity, playerRealm, slot, majorRealms);
    const bonusPercentageStats = generateBonusPercentageStats(normalizedRarity, playerRealm, majorRealms);

    // 2. Roll Passives
    const passiveCount = RARITY_PASSIVE_COUNT[normalizedRarity] || 0;
    const passives: string[] = [];
    const usedPassives = new Set<string>();

    let isOffensive = slot === 'mainWeapon' || slot === 'offHandWeapon';
    let isDefensive = slot === 'body' || slot === 'head' || slot === 'hands' || slot === 'legs';

    for (let i = 0; i < passiveCount; i++) {
        let pool = [...OFFENSIVE_PASSIVES, ...DEFENSIVE_PASSIVES, ...REWARD_PASSIVES];
        
        // Có xu hướng chọn dòng hợp với loại trang bị hơn
        if (isOffensive && Math.random() < 0.6) {
            pool = OFFENSIVE_PASSIVES;
        } else if (isDefensive && Math.random() < 0.6) {
            pool = DEFENSIVE_PASSIVES;
        }

        const available = pool.filter(p => !usedPassives.has(p));
        if (available.length === 0) break;

        const selected = available[Math.floor(Math.random() * available.length)];
        usedPassives.add(selected);

        // Sinh chỉ số cho passive
        let value = 1;
        if (['hút máu', 'chí mạng', 'né tránh', 'phản đòn'].includes(selected)) {
            value = Math.floor(3 + (level / 15) * Math.min(2.0, multiplier) + Math.random() * 5); // 3-10% cơ bản, capped multiplier to prevent scaling issues
            // Capping
            if (value > 30) value = 30; 
        } else if (['sát thương chí mạng'].includes(selected)) {
            value = Math.floor(10 + (level / 8) * Math.min(2.0, multiplier) + Math.random() * 15);
            if (value > 60) value = 60;
        } else {
            value = Math.floor(5 + (level / 15) * Math.min(2.0, multiplier) + Math.random() * 8);
            if (value > 40) value = 40;
        }

        passives.push(`${selected} ${value}%`);
    }

    const itemData = {
        name: name,
        category: 'Equipment',
        slot: slot,
        rarity: normalizedRarity,
        description: `Một món trang bị ${normalizedRarity} hệ thống tạo ngẫu nhiên cho cấp ${level}.`,
        statBonusesJSON: JSON.stringify(statBonuses),
        bonusPercentageStatsJSON: JSON.stringify(bonusPercentageStats), // Added to convey percentage stats
        uniqueEffectsList: passives.join(';')
    };
    
    return itemData;
};
