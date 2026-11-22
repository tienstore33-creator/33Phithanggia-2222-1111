import { Item } from '../../types';
import { generateEquipment } from '../../utils/equipmentGenerator';
import { calculateMechanicalItemPrice } from '../../utils/itemValuationUtils';

const WEAPON_NAMES = [
    'Thanh Phong Kiếm', 'Hàn Băng Thần Đao', 'Xích Viêm Thương', 'Thiên Cung Cung', 'Chấn Thiên Thùy',
    'Tử Điện Kiếm', 'U Hồn Đản', 'Bạch Ngọc Trảo', 'Phược Long Thừng', 'Cửu Nhai Bổng'
];

const ARMOR_NAMES = [
    'Huyền Thiết Mão', 'Lưu Vân Pháp Bào', 'Bạch Hổ Y', 'Cửu Long Khái', 'Hải Nạp Bào',
    'Chân Vũ Khái', 'Phượng Vũ Sương Bào', 'Thiên Cực Giáp', 'Thái Cực Đạo Y', 'Vân Hạc Mão'
];

const ACCESSORY_NAMES = [
    'Bình An Ngọc Bội', 'Mộc Chuyển', 'Thần Long Nhẫn', 'Bích Ngọc Hoàn', 'Linh Nhược Giới',
    'Lạc Nguyệt Trâm', 'Thiên Yêu Giới Chỉ', 'Trầm Hương Bội', 'Long Phượng Bội', 'Thái Ất Nhẫn'
];

const BOOTS_HANDS_NAMES = [
    'Đạp Vân Ngoa', 'Bạch Sương Tý', 'Tụ Linh Thủ Táo', 'Hư Không Ngoa', 'Lôi Đình Thủ Táo',
    'Phi Yến Ngoa', 'Cửu Xà Bì Tý', 'Nhật Nguyệt Ngoa', 'Kim Cang Thủ Táo', 'Tinh Cầu Ngoa'
];

const RARITIES = ['Phổ Thông', 'Ưu Tú', 'Hiếm', 'Cực Phẩm', 'Truyền Thuyết'];

function getRandomRarity(): string {
    const roll = Math.random();
    if (roll < 0.45) return 'Phổ Thông';
    if (roll < 0.75) return 'Ưu Tú';
    if (roll < 0.90) return 'Hiếm';
    if (roll < 0.98) return 'Cực Phẩm';
    return 'Truyền Thuyết';
}

function getRandomChoice<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}

export function rollMechanicalShopEquipments(
    playerRealm: string = 'Luyện Khí',
    majorRealms: string[] = [],
    count: number = 4
): Item[] {
    const result: Item[] = [];

    const categoriesPool = [
        { namePool: WEAPON_NAMES, type: 'Vũ Khí Chính' },
        { namePool: ARMOR_NAMES, type: 'Giáp Thân' },
        { namePool: BOOTS_HANDS_NAMES, type: 'Giáp Chân' },
        { namePool: ACCESSORY_NAMES, type: 'Trang Sức' }
    ];

    for (let i = 0; i < count; i++) {
        const cat = categoriesPool[i % categoriesPool.length];
        const name = getRandomChoice(cat.namePool);
        const rarity = getRandomRarity();
        const rawEq = generateEquipment(name, '1', rarity, cat.type, majorRealms, playerRealm);

        let statBonuses: Record<string, number> = {};
        let bonusPercentageStats: Record<string, number> = {};
        let uniqueEffects: string[] = [];

        try {
            if (rawEq.statBonusesJSON) statBonuses = JSON.parse(rawEq.statBonusesJSON);
        } catch (e) {
            statBonuses = {};
        }

        try {
            if (rawEq.bonusPercentageStatsJSON) bonusPercentageStats = JSON.parse(rawEq.bonusPercentageStatsJSON);
        } catch (e) {
            bonusPercentageStats = {};
        }

        if (rawEq.uniqueEffectsList) {
            uniqueEffects = rawEq.uniqueEffectsList.split(';').map(s => s.trim()).filter(Boolean);
        }

        const itemObj: Item = {
            id: `shop_eq_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
            name: rawEq.name,
            description: rawEq.description || `Một món trang bị ${rarity} quý giá xuất hiện trong tiệm.`,
            category: 'Equipment' as any,
            slot: (rawEq.slot || 'mainWeapon') as any,
            rarity: (rawEq.rarity || rarity) as any,
            quantity: 1,
            itemRealm: playerRealm || 'Luyện Khí',
            statBonuses,
            bonusPercentageStats,
            uniqueEffects,
            value: 0
        };

        // Tính toán giá trị mua/bán chuẩn xác theo cơ học
        itemObj.value = calculateMechanicalItemPrice(itemObj, majorRealms);

        result.push(itemObj);
    }

    return result;
}
