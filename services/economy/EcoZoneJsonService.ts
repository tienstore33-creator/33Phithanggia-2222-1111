import { KnowledgeBase, NPC, Item, Slave, Prisoner, GameLocation } from '../../types';

export interface EcoZoneGeneratedData {
    sublocation?: {
        name: string;
        locationType: string;
        description: string;
    };
    vendors: Array<{
        name: string;
        gender: 'Nam' | 'Nữ';
        race?: string;
        realm?: string;
        description: string;
        personalityTraits?: string[];
        affinity?: number;
        vendorType: 'MarketStall' | 'SpecializedShop' | 'SlaveTrader';
        vendorSlogan?: string;
        vendorBuysCategories?: string[];
        shopInventory?: Array<{
            name: string;
            description: string;
            category: string;
            rarity: string;
            value: number;
            quantity: number;
            itemRealm: string;
            potionType?: string;
            effects?: string[];
            slot?: string;
            statBonuses?: Record<string, number>;
            uniqueEffects?: string[];
            materialType?: string;
            skillToLearnJSON?: string;
        }>;
        slavesForSale?: Array<{
            name: string;
            gender: 'Nam' | 'Nữ' | 'Khác' | 'Không rõ';
            race?: string;
            description: string;
            personalityTraits?: string[];
            willpower?: number;
            obedience?: number;
            value?: number;
            tuChat?: string;
            spiritualRoot?: string;
            specialPhysique?: string;
            realm?: string;
        }>;
        prisonersForSale?: Array<{
            name: string;
            gender: 'Nam' | 'Nữ' | 'Khác' | 'Không rõ';
            race?: string;
            description: string;
            personalityTraits?: string[];
            willpower?: number;
            resistance?: number;
            value?: number;
            tuChat?: string;
            spiritualRoot?: string;
            specialPhysique?: string;
            realm?: string;
        }>;
    }>;
}

/**
 * Hàm phân tích an toàn để trích xuất JSON cấu trúc từ phản hồi AI.
 */
export const extractJsonFromAiResponse = (rawText: string): EcoZoneGeneratedData => {
    if (!rawText) {
        throw new Error("Phản hồi thô trống rỗng.");
    }

    let jsonString = rawText.trim();

    // 1. Tìm trong thẻ <update_data>...</update_data>
    const updateDataMatch = jsonString.match(/<update_data>([\s\S]*?)<\/update_data>/i);
    if (updateDataMatch && updateDataMatch[1]) {
        jsonString = updateDataMatch[1].trim();
    }

    // 2. Tìm trong khối ```json ... ```
    const codeBlockMatch = jsonString.match(/```json([\s\S]*?)```/i);
    if (codeBlockMatch && codeBlockMatch[1]) {
        jsonString = codeBlockMatch[1].trim();
    } else {
        const genericBlockMatch = jsonString.match(/```([\s\S]*?)```/i);
        if (genericBlockMatch && genericBlockMatch[1]) {
            jsonString = genericBlockMatch[1].trim();
        }
    }

    // 3. Nếu vẫn không thấy, quét từ ký tự { đầu tiên đến } cuối cùng
    const firstBrace = jsonString.indexOf('{');
    const lastBrace = jsonString.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        jsonString = jsonString.substring(firstBrace, lastBrace + 1);
    }

    try {
        const parsed = JSON.parse(jsonString) as EcoZoneGeneratedData;
        if (!parsed || !parsed.vendors) {
            throw new Error("Thiếu cấu trúc vendors trong JSON đã phân tích.");
        }
        return parsed;
    } catch (e) {
        console.error("Lỗi parse JSON kinh tế:", e, "Nội dung chuỗi:", jsonString);
        throw new Error("Phản hồi từ AI không đúng định dạng JSON cấu trúc mong muốn.");
    }
};

/**
 * Tích hợp trực tiếp dữ liệu JSON kinh tế đã phân tích vào trạng thái KnowledgeBase hiện tại.
 */
export const applyEcoZoneJsonDataToKb = (
    kb: KnowledgeBase,
    data: EcoZoneGeneratedData,
    zoneStubName: string,
    parentLocationId: string
): KnowledgeBase => {
    const updatedKb = JSON.parse(JSON.stringify(kb)) as KnowledgeBase;
    const currentNPCs = updatedKb.discoveredNPCs || [];
    const currentLocations = updatedKb.discoveredLocations || [];

    // 1. Tạo SubLocation con nếu có thông tin địa danh
    if (data.sublocation) {
        const existingSub = currentLocations.find(l => l.name === data.sublocation!.name && l.parentLocationId === parentLocationId);
        if (!existingSub) {
            const newSub: GameLocation = {
                id: data.sublocation.name,
                name: data.sublocation.name,
                description: data.sublocation.description,
                parentLocationId: parentLocationId,
                locationType: data.sublocation.locationType as any,
                discoveredAtTurn: kb.playerStats?.turn || 1,
                economicZones: []
            } as any;
            currentLocations.push(newSub);
        }
    }

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

    const generateId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    // 2. Chuyển đổi và nạp NPC từ danh sách vendors
    const addedNPCs: NPC[] = [];
    (data.vendors || []).forEach(v => {
        // Kiểm tra xem NPC này đã tồn tại trong zone chưa
        const isDuplicate = currentNPCs.some(npc => npc.name === v.name && npc.locationId === zoneStubName);
        if (isDuplicate) return;

        // Xử lý kho đồ hàng hóa (Inventory) của NPC thương nhân
        const shopInventory: Item[] = (v.shopInventory || []).map(item => {
            return {
                id: generateId('item'),
                name: item.name,
                description: item.description,
                category: item.category as any,
                rarity: item.rarity,
                value: item.value,
                quantity: item.quantity,
                itemRealm: item.itemRealm,
                potionType: item.potionType as any,
                effects: item.effects || [],
                slot: item.slot as any,
                statBonuses: item.statBonuses || {},
                uniqueEffects: item.uniqueEffects || [],
                materialType: item.materialType as any,
                skillToLearnJSON: item.skillToLearnJSON
            } as any;
        });

        // Xử lý danh sách nô lệ bày bán
        const slavesForSale: Slave[] = (v.slavesForSale || []).map(s => {
            return {
                id: generateId('slave'),
                name: s.name,
                gender: s.gender,
                race: s.race || 'Nhân Tộc',
                description: s.description,
                personalityTraits: s.personalityTraits || [],
                affinity: -10,
                willpower: s.willpower ?? 40,
                obedience: s.obedience ?? 60,
                value: s.value ?? 500,
                tuChat: s.tuChat as any,
                spiritualRoot: s.spiritualRoot,
                specialPhysique: s.specialPhysique,
                realm: s.realm || 'Phàm Nhân Nhất Trọng',
                entityType: 'slave',
                skills: [],
                equippedItems: defaultEquippedItems
            };
        });

        // Xử lý danh sách tù nhân bày bán
        const prisonersForSale: Prisoner[] = (v.prisonersForSale || []).map(p => {
            return {
                id: generateId('prisoner'),
                name: p.name,
                gender: p.gender,
                race: p.race || 'Nhân Tộc',
                description: p.description,
                personalityTraits: p.personalityTraits || [],
                affinity: -15,
                willpower: p.willpower ?? 50,
                resistance: p.resistance ?? 50,
                value: p.value ?? 600,
                tuChat: p.tuChat as any,
                spiritualRoot: p.spiritualRoot,
                specialPhysique: p.specialPhysique,
                realm: p.realm || 'Phàm Nhân Nhất Trọng',
                entityType: 'prisoner',
                skills: [],
                equippedItems: defaultEquippedItems
            } as any;
        });

        const newNpc: NPC = {
            id: generateId('vendor'),
            name: v.name,
            gender: v.gender,
            race: v.race || 'Nhân Tộc',
            description: v.description,
            personalityTraits: v.personalityTraits || [],
            affinity: v.affinity ?? 5,
            realm: v.realm || kb.playerStats?.realm || 'Phàm Nhân',
            locationId: zoneStubName,
            vendorType: v.vendorType,
            vendorSlogan: v.vendorSlogan,
            vendorBuysCategories: (v.vendorBuysCategories as any[]) || [],
            shopInventory,
            slavesForSale: slavesForSale.length > 0 ? slavesForSale : undefined,
            prisonersForSale: prisonersForSale.length > 0 ? prisonersForSale : undefined
        };

        addedNPCs.push(newNpc);
    });

    updatedKb.discoveredNPCs = [...currentNPCs, ...addedNPCs];
    updatedKb.discoveredLocations = currentLocations;

    return updatedKb;
};
