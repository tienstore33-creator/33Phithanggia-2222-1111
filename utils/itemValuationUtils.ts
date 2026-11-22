import { Item, KnowledgeBase } from '../types';
import { SPIRIT_STONE_PRICES, MORTAL_REALM_BASE_VALUE, FIRST_CULTIVATION_REALM_BASE_VALUE } from '../constants';

const BASE_REALM_TIER_PRICES = [
    100,      // Luyện Khí / Tier 0
    500,      // Trúc Cơ / Tier 1
    2500,     // Kim Đan / Tier 2
    12500,    // Nguyên Anh / Tier 3
    60000,    // Hóa Thần / Tier 4
    300000,   // Luyện Hư / Tier 5
    1500000,  // Hợp Thể / Tier 6
    7500000,  // Đại Thừa / Tier 7
    35000000  // Độ Kiếp / Tier 8
];

/**
 * Tính toán giá trị cơ học cho vật phẩm dựa trên Cảnh giới, Độ hiếm, Số dòng thuộc tính và Độ lớn các chỉ số.
 * Bỏ qua các chỉ số thiếu, không hợp lệ hoặc lỗi để tránh NaN tuyệt đối.
 */
export function calculateMechanicalItemPrice(item: any, kbOrProgression?: KnowledgeBase | string[]): number {
    if (!item) return 10;

    // 1. Kiểm tra linh thạch hoặc tiền tệ cố định
    const name = typeof item.name === 'string' ? item.name.trim() : '';
    if (name && (SPIRIT_STONE_PRICES as Record<string, number>)[name]) {
        return (SPIRIT_STONE_PRICES as Record<string, number>)[name];
    }

    // 2. Xác định cảnh giới cơ bản (Base Realm Price)
    let baseRealmValue = 100;
    const itemRealm = typeof item.itemRealm === 'string' ? item.itemRealm.trim() : '';

    if (itemRealm) {
        if (itemRealm.includes('Phàm Nhân')) {
            baseRealmValue = MORTAL_REALM_BASE_VALUE || 20;
        } else if (itemRealm.includes('Luyện Khí')) {
            baseRealmValue = 100;
        } else if (itemRealm.includes('Trúc Cơ')) {
            baseRealmValue = 500;
        } else if (itemRealm.includes('Kim Đan')) {
            baseRealmValue = 2500;
        } else if (itemRealm.includes('Nguyên Anh')) {
            baseRealmValue = 12500;
        } else if (itemRealm.includes('Hóa Thần')) {
            baseRealmValue = 60000;
        } else if (itemRealm.includes('Luyện Hư')) {
            baseRealmValue = 300000;
        } else if (itemRealm.includes('Hợp Thể')) {
            baseRealmValue = 1500000;
        } else if (itemRealm.includes('Đại Thừa')) {
            baseRealmValue = 7500000;
        } else if (itemRealm.includes('Độ Kiếp')) {
            baseRealmValue = 35000000;
        }
    } else if (typeof item.value === 'number' && Number.isFinite(item.value) && item.value > 0 && item.category !== 'Equipment') {
        // Nếu không có itemRealm và không phải trang bị, giữ nguyên giá trị đã có nếu hợp lệ
        return Math.round(item.value);
    }

    if (!Number.isFinite(baseRealmValue) || isNaN(baseRealmValue) || baseRealmValue <= 0) {
        baseRealmValue = 50;
    }

    // 3. Hệ số độ hiếm (Rarity Multiplier)
    const rarityStr = typeof item.rarity === 'string' ? item.rarity.trim().toLowerCase() : '';
    let rarityMultiplier = 1.0;

    if (rarityStr.includes('ưu tú') || rarityStr.includes('uncommon') || rarityStr.includes('lục')) {
        rarityMultiplier = 1.5;
    } else if (rarityStr.includes('hiếm') || rarityStr.includes('rare') || rarityStr.includes('lam')) {
        rarityMultiplier = 2.5;
    } else if (rarityStr.includes('cực phẩm') || rarityStr.includes('epic') || rarityStr.includes('tím')) {
        rarityMultiplier = 4.5;
    } else if (rarityStr.includes('truyền thuyết') || rarityStr.includes('legendary') || rarityStr.includes('cam')) {
        rarityMultiplier = 8.0;
    } else if (rarityStr.includes('thần thoại') || rarityStr.includes('mythic') || rarityStr.includes('đỏ')) {
        rarityMultiplier = 15.0;
    }

    // 4. Tính toán độ lớn các chỉ số thuộc tính (Stat Values)
    let statValuePoints = 0;
    let validStatLines = 0;

    if (item.statBonuses && typeof item.statBonuses === 'object') {
        for (const [rawKey, rawVal] of Object.entries(item.statBonuses)) {
            // An toàn tuyệt đối tránh NaN: ép kiểu số và kiểm tra tính hợp lệ
            const val = typeof rawVal === 'number' ? rawVal : (typeof rawVal === 'string' ? parseFloat(rawVal) : NaN);
            if (!Number.isFinite(val) || isNaN(val) || val <= 0) {
                // Bỏ qua nếu giá trị không phù hợp hoặc NaN
                continue;
            }

            const key = rawKey.toLowerCase().trim();
            validStatLines++;

            if (['maxsinhluc', 'sinhluc', 'máu', 'hp', 'health', 'sinh lực'].includes(key)) {
                statValuePoints += val * 0.2; // Ví dụ: +5000 sinh lực = 1000 điểm giá trị
            } else if (['maxlinhluc', 'linhluc', 'mana', 'mp', 'năng lượng', 'linh lực'].includes(key)) {
                statValuePoints += val * 0.5;
            } else if (['suctancong', 'công', 'tấn công', 'công kích', 'atk', 'attack', 'sức mạnh', 'sát thương'].includes(key)) {
                statValuePoints += val * 8.0;
            } else if (['phongngu', 'thủ', 'phòng ngự', 'phòng thủ', 'def', 'defense', 'giáp', 'armor'].includes(key)) {
                statValuePoints += val * 6.0;
            } else if (['tocdo', 'thanphap', 'tốc độ', 'thân pháp', 'speed', 'agility'].includes(key)) {
                statValuePoints += val * 10.0;
            } else if (['chimang', 'chí mạng', 'crit', 'critical'].includes(key)) {
                statValuePoints += val * 12.0;
            } else if (['thonguyen', 'tuổi thọ', 'tuoitho', 'maxthonguyen'].includes(key)) {
                statValuePoints += val * 10.0;
            } else {
                statValuePoints += val * 2.0;
            }
        }
    }

    // 5. Cộng thêm giá trị cho thuộc tính phần trăm (bonusPercentageStats)
    if (item.bonusPercentageStats && typeof item.bonusPercentageStats === 'object') {
        for (const [rawKey, rawVal] of Object.entries(item.bonusPercentageStats)) {
            const val = typeof rawVal === 'number' ? rawVal : (typeof rawVal === 'string' ? parseFloat(rawVal) : NaN);
            if (!Number.isFinite(val) || isNaN(val) || val <= 0) {
                continue;
            }
            validStatLines++;
            statValuePoints += baseRealmValue * (val / 100) * 2.5;
        }
    }

    // 6. Hệ số thưởng theo số lượng dòng thuộc tính (Number of Stat Lines Multiplier)
    let lineCountMultiplier = 1.0;
    if (validStatLines === 2) {
        lineCountMultiplier = 1.15;
    } else if (validStatLines === 3) {
        lineCountMultiplier = 1.35;
    } else if (validStatLines === 4) {
        lineCountMultiplier = 1.60;
    } else if (validStatLines >= 5) {
        lineCountMultiplier = 2.00;
    }

    // 7. Thưởng hiệu ứng đặc biệt (Unique Effects Bonus)
    let uniqueEffectsBonus = 0;
    if (Array.isArray(item.uniqueEffects)) {
        const validEffects = item.uniqueEffects.filter((e: any) => typeof e === 'string' && e.trim().length > 0);
        uniqueEffectsBonus = validEffects.length * (baseRealmValue * 0.4);
    } else if (typeof item.uniqueEffects === 'string' && item.uniqueEffects.trim().length > 0) {
        uniqueEffectsBonus = baseRealmValue * 0.4;
    }

    // 8. Tổng hợp và phòng chống lỗi NaN tuyệt đối
    const subTotal = (baseRealmValue + statValuePoints) * rarityMultiplier * lineCountMultiplier + uniqueEffectsBonus;

    if (!Number.isFinite(subTotal) || isNaN(subTotal)) {
        return Math.max(10, Math.round(baseRealmValue));
    }

    return Math.max(10, Math.round(subTotal));
}
