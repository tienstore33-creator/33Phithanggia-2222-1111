import { KnowledgeBase, NPC, Item, Slave, Prisoner } from '../../types';
import * as GameTemplates from '../../templates';
import { rollMechanicalShopEquipments } from './shopEquipmentRoller';
import { calculateMechanicalItemPrice } from '../../utils/itemValuationUtils';

/**
 * Tự động tạo và đổ đầy sạp hàng cho địa điểm nếu địa điểm chưa có thương nhân nào thuộc loại yêu cầu.
 */
export const seedVendorsForLocation = (
    kb: KnowledgeBase,
    locationId: string,
    modalType: 'marketplace' | 'shopping_center' | 'slave_market'
): KnowledgeBase => {
    if (!kb || !locationId) return kb;

    // Lấy tất cả NPC hiện có tại địa điểm này
    const currentNPCs = kb.discoveredNPCs || [];
    
    // Kiểm tra xem đã có thương nhân phù hợp chưa
    const hasMarketplaceVendors = currentNPCs.some(npc => 
        npc.locationId === locationId && 
        (npc.vendorType === 'MarketStall' || ['Blacksmith', 'Apothecary', 'Tavern', 'GeneralStore', 'Trader'].includes(npc.vendorType || ''))
    );

    const hasShoppingCenterVendors = currentNPCs.some(npc => 
        npc.locationId === locationId && npc.vendorType === 'SpecializedShop'
    );

    const hasSlaveMarketVendors = currentNPCs.some(npc => 
        npc.locationId === locationId && npc.vendorType === 'SlaveTrader'
    );

    let needsSeeding = false;
    if (modalType === 'marketplace' && !hasMarketplaceVendors) needsSeeding = true;
    if (modalType === 'shopping_center' && !hasShoppingCenterVendors) needsSeeding = true;
    if (modalType === 'slave_market' && !hasSlaveMarketVendors) needsSeeding = true;

    if (!needsSeeding) {
        return kb; // Đã có sẵn thương nhân, không cần seed tự động
    }

    const playerRealm = kb.playerStats?.realm || 'Luyện Khí Nhất Trọng';
    const newNPCs: NPC[] = [];

    // Danh sách tên mẫu ngẫu nhiên tiếng Việt
    const maleNames = ['Lão Trương', 'A Thiết', 'Cổ Đại Hải', 'Lý Đại Thúc', 'Chu Thông', 'Hạ Hầu Bá', 'Diệp Lân', 'Lâm Chưởng Quỹ', 'Triệu Vô Cực'];
    const femaleNames = ['Tần Nương', 'A Kiều', 'Tuyết Mai', 'Liễu Như Yên', 'Thủy Linh Nhi', 'Trần Hoa Nương', 'Bạch Tố Tố', 'Mộc Uyển Thanh'];

    const randomChoice = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
    const generateId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    const defaultEquippedItems = {
        mainWeapon: null,
        offHandWeapon: null,
        head: null,
        body: null,
        hands: null,
        legs: null,
        artifact: null,
        pet: null,
        accessory1: null,
        accessory2: null
    };

    if (modalType === 'marketplace') {
        // Tạo 2 thương nhân: Một người bán linh đan/thảo dược, một người bán trang bị/vật phẩm chiến đấu
        
        // 1. Thương Nhân Linh Đan (Apothecary / MarketStall)
        const name1 = randomChoice(femaleNames) + " Bán Linh Dược";
        const id1 = generateId('vendor');
        const shop1: Item[] = [
            {
                id: generateId('item'),
                name: 'Hồi Khí Đan Sơ Cấp',
                description: 'Linh đan phổ thông dùng để hồi phục 150 điểm sinh lực (HP).',
                category: "Potion" as any,
                rarity: "Phổ Thông",
                value: 40,
                quantity: 15,
                itemRealm: playerRealm,
                potionType: "Hồi Phục" as any,
                effects: ["Hồi phục 150 HP"],
                usable: true,
                consumable: true,
                isConsumedOnUse: true
            } as any,
            {
                id: generateId('item'),
                name: 'Bổ Linh Đan',
                description: 'Bồi bổ kinh mạch, hồi phục 80 điểm linh lực (MP).',
                category: "Potion" as any,
                rarity: "Phổ Thông",
                value: 60,
                quantity: 10,
                itemRealm: playerRealm,
                potionType: "Hồi Phục" as any,
                effects: ["Hồi phục 80 MP"],
                usable: true,
                consumable: true,
                isConsumedOnUse: true
            } as any,
            {
                id: generateId('item'),
                name: 'Ngưng Huyết Thảo',
                description: 'Loại linh thảo sơ cấp có tác dụng cầm máu nhanh chóng.',
                category: "Material" as any,
                rarity: "Phổ Thông",
                value: 15,
                quantity: 20,
                itemRealm: playerRealm,
                materialType: "Linh Thảo" as any,
                usable: false,
                consumable: false
            } as any
        ];

        newNPCs.push({
            id: id1,
            name: name1,
            gender: 'Nữ',
            race: 'Nhân Tộc',
            description: 'Một bà chủ nhiệt tình chuyên thu mua linh thảo ngoại vi và bán linh dược tự chế.',
            personalityTraits: ['Nhiệt tình', 'Cẩn thận'],
            affinity: 5,
            realm: playerRealm,
            locationId,
            vendorType: 'MarketStall',
            vendorSlogan: 'Linh dược gia truyền, cam kết dược hiệu đỉnh phong!',
            vendorBuysCategories: ["Potion", "Material"],
            shopInventory: shop1
        });

        // 2. Thương Nhân Binh Khí & Đồ Chiến Đấu (Blacksmith / MarketStall)
        const name2 = randomChoice(maleNames) + " Rèn Đao";
        const id2 = generateId('vendor');
        const shop2: Item[] = [
            {
                id: generateId('item'),
                name: 'combat Hồi Khí Đan',
                description: 'Hồi 200 HP cho một mục tiêu trong chế độ chiến đấu thử nghiệm.',
                category: "Potion" as any,
                rarity: "Phổ Thông",
                value: 50,
                quantity: 20,
                itemRealm: 'Phàm Nhân',
                potionType: "Hồi Phục" as any,
                effects: ["Hồi phục 200 HP trong chiến đấu thử"],
                usable: true,
                consumable: true,
                isConsumedOnUse: true
            } as any,
            {
                id: generateId('item'),
                name: 'combat Thiết Bì Tán',
                description: 'Tăng phòng thủ vật lý tạm thời trong trận đấu.',
                category: "Potion" as any,
                rarity: "Phổ Thông",
                value: 70,
                quantity: 10,
                itemRealm: 'Phàm Nhân',
                potionType: "Tăng Cường" as any,
                effects: ["Tăng phòng thủ vật lý tạm thời"],
                usable: true,
                consumable: true,
                isConsumedOnUse: true
            } as any,
            {
                id: generateId('item'),
                name: 'Thiết Kiếm Rỉ Sét',
                description: 'Thanh sắt cũ rèn thô sơ, lực sát thương cơ bản.',
                category: "Equipment" as any,
                rarity: "Phổ Thông",
                value: 120,
                quantity: 1,
                itemRealm: playerRealm,
                slot: 'mainWeapon',
                statBonuses: {},
                uniqueEffects: []
            } as any
        ];

        newNPCs.push({
            id: id2,
            name: name2,
            gender: 'Nam',
            race: 'Nhân Tộc',
            description: 'Gã thợ rèn thô kệch, cánh tay lực lưỡng đầy tàn lửa bám dính.',
            personalityTraits: ['Cộc cằn', 'Sòng phẳng'],
            affinity: 0,
            realm: playerRealm,
            locationId,
            vendorType: 'MarketStall',
            vendorSlogan: 'Vũ khí thô sơ nhưng cứng cáp, bia đỡ đạn cực tốt!',
            vendorBuysCategories: ["Equipment", "Material"],
            shopInventory: shop2
        });

    } else if (modalType === 'shopping_center') {
        // Tạo một SpecializedShop sang trọng
        const nameSpecial = "Đại Chưởng Quỹ " + randomChoice(maleNames);
        const idSpecial = generateId('vendor');
        const shopSpecial: Item[] = [
            {
                id: generateId('item'),
                name: 'Tẩy Tủy Đan Thượng Phẩm',
                description: 'Dược hoàn tẩy tinh phạt tủy cực tốt, tăng ngộ tính tạm thời.',
                category: "Potion" as any,
                rarity: "Quý Báu",
                value: 500,
                quantity: 2,
                itemRealm: playerRealm,
                potionType: "Tăng Cường" as any,
                effects: ["Tăng ngộ tính"],
                usable: true,
                consumable: true,
                isConsumedOnUse: true
            } as any,
            {
                id: generateId('item'),
                name: 'Ngọc Giản: Kim Quang Tráo',
                description: 'Kỹ năng phòng ngự tạo hộ thân khí cương màu vàng kim cực kỳ kiên cố.',
                category: "LinhKi" as any,
                rarity: "Hiếm",
                value: 800,
                quantity: 1,
                itemRealm: playerRealm,
                skillToLearnJSON: JSON.stringify({
                    name: "Kim Quang Tráo",
                    description: "Tạo khí cương phòng ngự giảm sát thương nhận vào.",
                    skillType: "Linh Kĩ",
                    manaCost: 15,
                    detailedEffect: "Tạo khiên hấp thụ sát thương tương đương 15% Max HP."
                })
            } as any,
            {
                id: generateId('item'),
                name: 'Huyền Thiết Trọng Giáp',
                description: 'Giáp thân rèn từ Huyền Thiết đầm chắc, chống đỡ tuyệt hảo các đòn thế hiểm hóc.',
                category: "Equipment" as any,
                rarity: "Hiếm",
                value: 1200,
                quantity: 1,
                itemRealm: playerRealm,
                slot: 'body',
                statBonuses: {},
                uniqueEffects: []
            } as any
        ];

        newNPCs.push({
            id: idSpecial,
            name: nameSpecial,
            gender: 'Nam',
            race: 'Nhân Tộc',
            description: 'Đại chưởng quỹ trang phục gấm vóc sang trọng, nụ cười bí hiểm sành sỏi.',
            personalityTraits: ['Sành sỏi', 'Kính nghiệp'],
            affinity: 10,
            realm: playerRealm,
            locationId,
            vendorType: 'SpecializedShop',
            vendorSlogan: 'Kỳ trân dị bảo, chỉ phục vụ duyên giả cư sĩ đỉnh cấp!',
            vendorBuysCategories: ["Equipment", "Potion", "LinhKi"],
            shopInventory: shopSpecial
        });

    } else if (modalType === 'slave_market') {
        // Tạo một SlaveTrader
        const nameSlave = "Lão Bản " + randomChoice(maleNames) + " Buôn Nô";
        const idSlave = generateId('vendor');
        
        // Tạo 2 nô lệ để bán
        const slavesForSale: Slave[] = [
            {
                id: generateId('slave'),
                name: 'Thúy Nhi',
                gender: 'Nữ',
                race: 'Nhân Tộc',
                description: 'Thiếu nữ nhu mì, có khả năng may vá dệt vải cơ bản.',
                personalityTraits: ['Cam chịu', 'Hiền lành'],
                affinity: -10,
                willpower: 30,
                obedience: 70,
                value: 400,
                tuChat: 'Hạ Phẩm',
                spiritualRoot: 'Phàm Căn',
                specialPhysique: 'Bình thường',
                realm: 'Phàm Nhân Nhị Trọng',
                entityType: 'slave',
                skills: [],
                equippedItems: defaultEquippedItems
            },
            {
                id: generateId('slave'),
                name: 'Chiến Nô A Long',
                gender: 'Nam',
                race: 'Yêu Tộc',
                description: 'Chiến nô dũng mãnh dính đầy sẹo võ đài, cơ thể vạm vỡ.',
                personalityTraits: ['Cứng cỏi', 'Trầm mặc'],
                affinity: -15,
                willpower: 60,
                obedience: 40,
                value: 900,
                tuChat: 'Trung Phẩm',
                spiritualRoot: 'Mộc Linh Căn',
                specialPhysique: 'Huyền Thiết Thể',
                realm: 'Luyện Khí Tứ Trọng',
                entityType: 'slave',
                skills: [],
                equippedItems: defaultEquippedItems
            }
        ];

        // Tạo 1 tù nhân để bán
        const prisonersForSale: Prisoner[] = [
            {
                id: generateId('prisoner'),
                name: 'Đạo Tặc Thọt Chân',
                gender: 'Nam',
                race: 'Nhân Tộc',
                description: 'Tên trộm lẻn vào hầm mỏ bị bắt quả tang, tuy chân thọt nhưng xảo quyệt.',
                personalityTraits: ['Láu cá', 'Hèn nhát'],
                affinity: -5,
                willpower: 20,
                resistance: 40,
                value: 300,
                tuChat: 'Hạ Phẩm',
                spiritualRoot: 'Thổ Căn',
                specialPhysique: 'Không',
                realm: 'Phàm Nhân Ngũ Trọng',
                entityType: 'prisoner',
                skills: [],
                equippedItems: defaultEquippedItems
            } as any
        ];

        newNPCs.push({
            id: idSlave,
            name: nameSlave,
            gender: 'Nam',
            race: 'Nhân Tộc',
            description: 'Gã lái buôn râu ria xồm xoàm, nắm chặt roi da kêu lách tách giòn giã.',
            personalityTraits: ['Tàn nhẫn', 'Thực dụng'],
            affinity: -10,
            realm: playerRealm,
            locationId,
            vendorType: 'SlaveTrader',
            vendorSlogan: 'Hàng sống tuyển chọn chất lượng, ngoan ngoãn biết phục dịch!',
            vendorBuysCategories: [],
            slavesForSale,
            prisonersForSale
        });
    }

    // Đảm bảo tất cả các trang bị trong sạp hàng thương nhân được tự động roll ngẫu nhiên và tính giá trị cơ học
    const majorRealms = (kb.worldConfig as any)?.majorRealms || kb.realmProgressionList || [];
    for (const npc of newNPCs) {
        if (npc.shopInventory && npc.shopInventory.length > 0) {
            // Tự động roll thêm các trang bị cơ học nếu thương nhân bán trang bị
            if (npc.vendorBuysCategories?.includes('Equipment') || npc.vendorType === 'MarketStall' || npc.vendorType === 'SpecializedShop') {
                const rolledEquips = rollMechanicalShopEquipments(playerRealm, majorRealms, 4);
                npc.shopInventory = [...npc.shopInventory, ...rolledEquips];
            }
            // Định giá cơ học lại cho tất cả vật phẩm
            npc.shopInventory = npc.shopInventory.map(item => {
                const itemVal = calculateMechanicalItemPrice(item, kb);
                return {
                    ...item,
                    value: itemVal
                };
            });
        }
    }

    // Trả về KnowledgeBase mới với thương nhân được bổ sung
    return {
        ...kb,
        discoveredNPCs: [...currentNPCs, ...newNPCs]
    };
};
