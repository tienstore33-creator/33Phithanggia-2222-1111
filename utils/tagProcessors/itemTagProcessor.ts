
import { KnowledgeBase, Item, PlayerStats, GameMessage, VectorMetadata, EquipmentSlotId } from '../../types';
import * as GameTemplates from '../../templates';
import { calculateEffectiveStats, calculateItemValue } from '../statsCalculationUtils'; 
import { diceCoefficient, normalizeStringForComparison } from '../questUtils';
import { formatItemForEmbedding } from '../ragUtils';

import { normalizeSlotId, parseStatBonuses } from '../itemUtils';
import { calculateMechanicalStats } from '../../services/ItemStatService';
import { generateBonusPercentageStats } from '../../services/EquipmentBonusService';
import { SPECIAL_EFFECT_KEYWORDS } from '../../constants/economy';

const SIMILARITY_THRESHOLD = 0.8;

// Helper function to find an item by fuzzy name matching
const findItemByName = (inventory: Item[], name: string): { item: Item, index: number } | null => {
    if (!name) return null;
    let bestMatch = { item: null as Item | null, index: -1, score: 0 };
    const normalizedName = normalizeStringForComparison(name);

    inventory.forEach((item, index) => {
        const score = diceCoefficient(normalizedName, normalizeStringForComparison(item.name));
        if (score > bestMatch.score) {
            bestMatch = { item, index, score };
        }
    });

    if (bestMatch.item && bestMatch.score >= SIMILARITY_THRESHOLD) {
        return { item: bestMatch.item, index: bestMatch.index };
    }
    
    if(bestMatch.item) {
        console.warn(`ITEM_FIND: Item matching "${name}" found, but similarity score ${bestMatch.score.toFixed(2)} is below threshold ${SIMILARITY_THRESHOLD}. Best match: "${bestMatch.item.name}"`);
    } else {
        console.warn(`ITEM_FIND: Item matching "${name}" not found.`);
    }

    return null;
}

// Helper function to create an item object from tag parameters
// This can be shared by processItemAcquired and processShopItem
export const createItemFromParams = (tagParams: Record<string, string>, kb: KnowledgeBase): Item | null => {
    const itemName = tagParams.name || tagParams.text;
    let itemTypeCombined = tagParams.type || tagParams.itemType;
    const itemDescription = tagParams.description || tagParams.desc || tagParams.text;
    const quantity = parseInt(tagParams.quantity || "1", 10);
    const rarity = (tagParams.rarity || GameTemplates.ItemRarity.PHO_THONG) as GameTemplates.EquipmentRarity;
    const valueFromAI = parseInt(tagParams.value || "0", 10); // Keep AI value as a potential fallback
    
    // --- NEW LOGIC FOR ITEM REALM VALIDATION AND REMAPPING ---
    let itemRealm = tagParams.itemRealm || kb.playerStats.realm; // Use player's realm as a default if not specified

    if (kb.worldConfig && kb.worldConfig.raceCultivationSystems && kb.worldConfig.raceCultivationSystems.length > 0) {
        const playerRace = kb.worldConfig.playerRace || 'Nhân Tộc';
        const playerRealmSystemDef = kb.worldConfig.raceCultivationSystems.find(s => s.raceName === playerRace);
        const playerRealms = (playerRealmSystemDef?.realmSystem || kb.realmProgressionList.join(' - ')).split(' - ').map(s => s.trim());

        // Check if the provided realm is already a valid player race realm (case-insensitive)
        const isAlreadyValid = playerRealms.some(r => r.toLowerCase() === itemRealm.toLowerCase());

        if (!isAlreadyValid) {
            let foundTierIndex = -1;
            // Iterate through ALL race systems to find a tier match
            for (const system of kb.worldConfig.raceCultivationSystems) {
                const systemRealms = system.realmSystem.split(' - ').map(s => s.trim());
                const tierIndex = systemRealms.findIndex(r => r.toLowerCase() === itemRealm.toLowerCase());
                if (tierIndex !== -1) {
                    foundTierIndex = tierIndex;
                    break; // Found a match in some system, stop searching
                }
            }

            // If we found a tier index in another system, map it back to the player's race system
            if (foundTierIndex !== -1 && foundTierIndex < playerRealms.length) {
                const remappedRealm = playerRealms[foundTierIndex];
                console.log(`[ITEM_REALM_REMAP] Remapped item realm "${itemRealm}" to player race realm "${remappedRealm}" at tier ${foundTierIndex}.`);
                itemRealm = remappedRealm;
            } else {
                 console.warn(`[ITEM_REALM_REMAP] Could not remap item realm "${itemRealm}". It does not exist in any known cultivation system or the tier index is out of bounds for the player's race. Falling back to player's current realm.`);
                 itemRealm = kb.playerStats.realm; // Fallback
            }
        }
    }
    // --- END NEW LOGIC FOR ITEM REALM ---


    // --- Fallback logic to construct `type` if it's missing ---
    const itemCategoryFromTag = tagParams.category as GameTemplates.ItemCategoryValues;
    if (!itemTypeCombined && itemCategoryFromTag) {
        const itemEquipmentTypeFromTag = tagParams.equipmentType || tagParams.slot;
        const itemPotionTypeFromTag = tagParams.potionType as GameTemplates.PotionTypeValues;
        const itemMaterialTypeFromTag = tagParams.materialType as GameTemplates.MaterialTypeValues;

        if (itemCategoryFromTag === GameTemplates.ItemCategory.EQUIPMENT && itemEquipmentTypeFromTag) {
            itemTypeCombined = `${itemCategoryFromTag} ${itemEquipmentTypeFromTag}`;
        } else if (itemCategoryFromTag === GameTemplates.ItemCategory.POTION && itemPotionTypeFromTag) {
            itemTypeCombined = `${itemCategoryFromTag} ${itemPotionTypeFromTag}`;
        } else if (itemCategoryFromTag === GameTemplates.ItemCategory.MATERIAL && itemMaterialTypeFromTag) {
            itemTypeCombined = `${itemCategoryFromTag} ${itemMaterialTypeFromTag}`;
        } else {
            // For categories that don't have a specific sub-type, or if the sub-type is missing
            itemTypeCombined = itemCategoryFromTag;
        }
    }
    // --- End of Fallback Logic ---

    if (!itemName || !itemTypeCombined || !itemDescription) {
        console.warn("createItemFromParams: Missing name, type, or description.", tagParams);
        return null;
    }
    
    const typeParts = itemTypeCombined.split(" ");
    const category = typeParts[0] as GameTemplates.ItemCategoryValues;
    const subType = typeParts.length > 1 ? typeParts.slice(1).join(" ") : undefined;

    if (!Object.values(GameTemplates.ItemCategory).includes(category)) {
        console.warn(`createItemFromParams: Invalid item category "${category}" for item "${itemName}". Skipping.`);
        return null;
    }

    let newItem: Item | null = null;
    const baseItemData: Omit<Item, 'category'> & {category: GameTemplates.ItemCategoryValues} = { 
        id: `item-${itemName.replace(/\s+/g, '-')}-${Date.now()}-${Math.random().toString(36).substring(2,7)}`,
        name: itemName,
        description: itemDescription,
        quantity: isNaN(quantity) ? 1 : Math.max(1, quantity),
        rarity: Object.values(GameTemplates.ItemRarity).includes(rarity) ? rarity : GameTemplates.ItemRarity.PHO_THONG,
        value: valueFromAI, // Start with AI's value, will be overridden
        category: category,
        itemRealm: itemRealm, 
    };
    
    switch (category) {
        case GameTemplates.ItemCategory.EQUIPMENT:
            const rawSlot = tagParams.slot || tagParams.equipmentType || subType;
            const slotId = normalizeSlotId(rawSlot);
            let statBonuses = parseStatBonuses(tagParams.statBonusesJSON);
            let bonusPercentageStats: Record<string, number> = {};
            if (tagParams.bonusPercentageStatsJSON) {
                try {
                    bonusPercentageStats = JSON.parse(tagParams.bonusPercentageStatsJSON);
                } catch (e) {
                    console.error("Failed to parse bonusPercentageStatsJSON in itemTagProcessor:", e);
                }
            } else if ((tagParams as any).bonusPercentageStats) {
                bonusPercentageStats = (tagParams as any).bonusPercentageStats;
            }

            // Mechanical Engine: Auto-calculate basic and percentage stats if not provided or empty
            const majorRealms = kb.realmProgressionList || [];
            if (!statBonuses || Object.keys(statBonuses).length === 0) {
                statBonuses = calculateMechanicalStats(
                    rarity,
                    itemRealm,
                    slotId as EquipmentSlotId,
                    majorRealms
                );
            }

            if (!bonusPercentageStats || Object.keys(bonusPercentageStats).length === 0) {
                bonusPercentageStats = generateBonusPercentageStats(
                    rarity,
                    itemRealm,
                    majorRealms
                );
            }

            let uniqueEffects: string[] = tagParams.uniqueEffectsList ? tagParams.uniqueEffectsList.split(';').map(s => s.trim()).filter(s => s) : [];
            if (uniqueEffects.length === 0 && (rarity === GameTemplates.ItemRarity.HIEM || rarity === GameTemplates.ItemRarity.QUY_BAU || rarity === GameTemplates.ItemRarity.CUC_PHAM || rarity === GameTemplates.ItemRarity.THAN_THOAI || rarity === GameTemplates.ItemRarity.CHI_TON)) {
                const keywords = Object.keys(SPECIAL_EFFECT_KEYWORDS);
                const numEffects = rarity === GameTemplates.ItemRarity.HIEM ? 1 : Math.floor(Math.random() * 2) + 1;
                for (let i = 0; i < numEffects; i++) {
                    const kw = keywords[Math.floor(Math.random() * keywords.length)];
                    const val = Math.floor(Math.random() * 10) + 5; // 5-15%
                    if (!uniqueEffects.some(e => e.toLowerCase().includes(kw.toLowerCase()))) {
                        uniqueEffects.push(`${kw.charAt(0).toUpperCase() + kw.slice(1)} ${val}%`);
                    }
                }
            }
            
            newItem = {
                ...baseItemData,
                category: GameTemplates.ItemCategory.EQUIPMENT,
                slot: slotId,
                statBonuses: statBonuses,
                bonusPercentageStats: bonusPercentageStats,
                uniqueEffects: uniqueEffects
            } as GameTemplates.EquipmentTemplate;
            break;
        case GameTemplates.ItemCategory.POTION:
             const potionType = tagParams.potionType as GameTemplates.PotionTypeValues || subType as GameTemplates.PotionTypeValues;
             if (!potionType || !Object.values(GameTemplates.PotionType).includes(potionType)) {
                 console.warn(`createItemFromParams: Potion item "${itemName}" has invalid/missing potionType: "${potionType}". Skipping.`);
                 break;
            }
            newItem = {
                ...baseItemData,
                category: GameTemplates.ItemCategory.POTION,
                potionType: potionType,
                effects: tagParams.effectsList ? tagParams.effectsList.split(';').map(s => s.trim()).filter(s => s) : [],
                statBonuses: parseStatBonuses(tagParams.statBonusesJSON),
                durationTurns: tagParams.durationTurns ? parseInt(tagParams.durationTurns) : undefined,
                cooldownTurns: tagParams.cooldownTurns ? parseInt(tagParams.cooldownTurns) : undefined,
                isConsumedOnUse: true, usable: true, consumable: true,
            } as GameTemplates.PotionTemplate;
            break;
        case GameTemplates.ItemCategory.MATERIAL:
            const materialType = tagParams.materialType as GameTemplates.MaterialTypeValues || subType as GameTemplates.MaterialTypeValues;
            if (!materialType || !Object.values(GameTemplates.MaterialType).includes(materialType)) {
                console.warn(`createItemFromParams: Material item "${itemName}" has invalid/missing materialType: "${materialType}". Skipping.`);
                break;
            }
            newItem = {
                ...baseItemData,
                category: GameTemplates.ItemCategory.MATERIAL,
                materialType: materialType,
                usable: false,
                consumable: false,
            } as GameTemplates.MaterialTemplate;
            break;
        case GameTemplates.ItemCategory.CONG_PHAP:
            const congPhapType = tagParams.congPhapType as GameTemplates.CongPhapType;
            const expBonusPercentage = parseInt(tagParams.expBonusPercentage, 10);
            if (congPhapType && Object.values(GameTemplates.CongPhapType).includes(congPhapType) && !isNaN(expBonusPercentage)) {
                newItem = {
                    ...baseItemData,
                    category: GameTemplates.ItemCategory.CONG_PHAP,
                    congPhapType,
                    expBonusPercentage
                } as GameTemplates.CongPhapTemplate;
            }
            break;
        case GameTemplates.ItemCategory.LINH_KI:
            if (tagParams.skillToLearnJSON) {
                newItem = {
                    ...baseItemData,
                    category: GameTemplates.ItemCategory.LINH_KI,
                    skillToLearnJSON: tagParams.skillToLearnJSON
                } as GameTemplates.LinhKiTemplate;
            }
            break;
        case GameTemplates.ItemCategory.PROFESSION_SKILL_BOOK:
            const professionToLearn = tagParams.professionToLearn as GameTemplates.ProfessionType;
            if (professionToLearn && Object.values(GameTemplates.ProfessionType).includes(professionToLearn)) {
                newItem = {
                    ...baseItemData,
                    category: GameTemplates.ItemCategory.PROFESSION_SKILL_BOOK,
                    professionToLearn
                } as GameTemplates.ProfessionSkillBookTemplate;
            }
            break;
        case GameTemplates.ItemCategory.PROFESSION_TOOL:
            const professionRequired = tagParams.professionRequired as GameTemplates.ProfessionType;
            if (professionRequired && Object.values(GameTemplates.ProfessionType).includes(professionRequired)) {
                newItem = {
                    ...baseItemData,
                    category: GameTemplates.ItemCategory.PROFESSION_TOOL,
                    professionRequired
                } as GameTemplates.ProfessionToolTemplate;
            }
            break;
        default: // Covers QUEST_ITEM, MISCELLANEOUS
             newItem = {
                ...baseItemData,
                category: category, 
             } as Item; 
             if (category === GameTemplates.ItemCategory.QUEST_ITEM && tagParams.questIdAssociated) {
                 (newItem as GameTemplates.QuestItemTemplate).questIdAssociated = tagParams.questIdAssociated;
             }
             if (category === GameTemplates.ItemCategory.MISCELLANEOUS) {
                 if (tagParams.usable) (newItem as GameTemplates.MiscellaneousItemTemplate).usable = tagParams.usable.toLowerCase() === 'true';
                 if (tagParams.consumable) (newItem as GameTemplates.MiscellaneousItemTemplate).consumable = tagParams.consumable.toLowerCase() === 'true';
             }
    }
    
    // Override value with system calculation
    if (newItem) {
        const calculatedValue = calculateItemValue(newItem, kb.realmProgressionList);
        newItem.value = calculatedValue;
    }

    return newItem;
};

export const processItemAcquired = (
    currentKb: KnowledgeBase,
    tagParams: Record<string, string>,
    turnForSystemMessages: number
): { updatedKb: KnowledgeBase; systemMessages: GameMessage[]; newVectorMetadata?: VectorMetadata; } => {
    const newKb = currentKb;
    const systemMessages: GameMessage[] = [];
    let newVectorMetadata: VectorMetadata | undefined = undefined;

    const newItem = createItemFromParams(tagParams, currentKb);
    const ownerId = tagParams.ownerId || tagParams.entityId || 'player';

    if (newItem) {
        if (ownerId === 'player') {
            const existingItemIndex = newKb.inventory.findIndex(i => i.name === newItem!.name && i.category === newItem!.category);
            if (existingItemIndex > -1 && newItem.stackable !== false) {
                newKb.inventory[existingItemIndex].quantity += newItem.quantity;
            } else {
                newKb.inventory.push(newItem);
                // This is a new, unique item added to the inventory, so we vectorize it.
                newVectorMetadata = { entityId: newItem.id, entityType: 'item', text: formatItemForEmbedding(newItem) };
            }
            systemMessages.push({
                id: 'item-acquired-' + newItem.id, type: 'system',
                content: `📦 Nhận được: ${newItem.name} (x${newItem.quantity})`,
                timestamp: Date.now(), turnNumber: turnForSystemMessages
            });
        } else {
            // Add to NPC Treasury
            if (!newKb.npcInventory) newKb.npcInventory = [];
            newKb.npcInventory.push(newItem);
            console.log(`[NPC_TREASURY] Item "${newItem.name}" added to NPC Treasury for owner "${ownerId}".`);
        }
    }
    return { updatedKb: newKb, systemMessages, newVectorMetadata };
};

export const processItemBought = (
    currentKb: KnowledgeBase,
    tagParams: Record<string, string>,
    turnForSystemMessages: number
): { updatedKb: KnowledgeBase; systemMessages: GameMessage[] } => {
    const newKb = currentKb;
    const systemMessages: GameMessage[] = [];

    const newItem = createItemFromParams(tagParams, currentKb);
    
    if (newItem) {
        const cost = newItem.value * newItem.quantity;
        
        if (newKb.playerStats.currency >= cost) {
            newKb.playerStats.currency -= cost;
            
            const existingItemIndex = newKb.inventory.findIndex(i => i.name === newItem!.name && i.category === newItem!.category);
            if (existingItemIndex > -1 && newItem.stackable !== false) {
                newKb.inventory[existingItemIndex].quantity += newItem.quantity;
            } else {
                newKb.inventory.push(newItem);
            }
            systemMessages.push({
                id: 'item-bought-' + newItem.id, type: 'system',
                content: `💰 Đã mua: ${newItem.name} (x${newItem.quantity}). Tiêu tốn ${cost} Linh Thạch.`,
                timestamp: Date.now(), turnNumber: turnForSystemMessages
            });
        } else {
            console.warn(`[PROCESS ITEM BOUGHT] Player tried to buy ${newItem.name} but did not have enough currency. Falling back to simple acquisition with warning.`);
            const existingItemIndex = newKb.inventory.findIndex(i => i.name === newItem!.name && i.category === newItem!.category);
            if (existingItemIndex > -1 && newItem.stackable !== false) {
                newKb.inventory[existingItemIndex].quantity += newItem.quantity;
            } else {
                newKb.inventory.push(newItem);
            }
            systemMessages.push({
                id: 'item-bought-debt-' + newItem.id, type: 'system',
                content: `💰 Nhận được qua mua bán: ${newItem.name} (x${newItem.quantity}) nhưng thiếu phí thanh toán! (Hệ thống tính nợ).`,
                timestamp: Date.now(), turnNumber: turnForSystemMessages
            });
        }
    }
    return { updatedKb: newKb, systemMessages };
};

export const processShopItem = (
    currentKb: KnowledgeBase,
    tagParams: Record<string, string>,
    turnForSystemMessages: number
): { updatedKb: KnowledgeBase; systemMessages: GameMessage[] } => {
    const newKb = currentKb;
    const parentId = tagParams.parentId;

    if (!parentId) {
        console.warn("SHOP_ITEM: Missing parentId. Cannot assign item to a vendor.", tagParams);
        return { updatedKb: newKb, systemMessages: [] };
    }

    const createdItemObject = createItemFromParams(tagParams, currentKb);
    
    if (createdItemObject) {
        const vendor = newKb.discoveredNPCs.find(npc => npc.name === parentId);
        if (vendor) {
            if (!vendor.shopInventory) {
                vendor.shopInventory = [];
            }
            vendor.shopInventory.push(createdItemObject);
        } else {
            console.warn(`SHOP_ITEM: Vendor with parent name "${parentId}" not found.`);
        }
    }
    
    // No system message needed for adding item to a shop inventory.
    return { updatedKb: newKb, systemMessages: [] };
};


export const processItemConsumed = (
    currentKb: KnowledgeBase,
    tagParams: Record<string, string>,
    turnForSystemMessages: number
): { updatedKb: KnowledgeBase; systemMessages: GameMessage[] } => {
    const newKb = currentKb;
    const systemMessages: GameMessage[] = [];
    const itemName = tagParams.name;
    const quantityConsumed = parseInt(tagParams.quantity || "1", 10);

    if (!itemName || isNaN(quantityConsumed) || quantityConsumed < 1) {
        console.warn("ITEM_CONSUMED: Missing or invalid name/quantity.", tagParams);
        return { updatedKb: newKb, systemMessages };
    }

    const foundMatch = findItemByName([...newKb.inventory, ...(newKb.npcInventory || [])], itemName);
    if (foundMatch) {
        const { item } = foundMatch;
        // Check where the item is
        let targetInventory = newKb.inventory;
        let itemIndexInTarget = newKb.inventory.findIndex(i => i.id === item.id);
        
        if (itemIndexInTarget === -1 && newKb.npcInventory) {
            targetInventory = newKb.npcInventory;
            itemIndexInTarget = newKb.npcInventory.findIndex(i => i.id === item.id);
        }

        if (itemIndexInTarget !== -1) {
            targetInventory[itemIndexInTarget].quantity -= quantityConsumed;
            let message = `Đã sử dụng: ${item.name} (x${quantityConsumed}). Còn lại: ${targetInventory[itemIndexInTarget].quantity}.`;
            
            // Check for stat bonuses if it's a Potion or anything with statBonuses
            const itemWithStats = item as any;
            let bonuses = itemWithStats.statBonuses as Record<string, number> || {};

            // Automatically parse stats from description if none are configured
            if (Object.keys(bonuses).length === 0 && item.description) {
                const parsed: Record<string, number> = {};
                const desc = item.description.toLowerCase();
                
                // Matches patterns like "Hồi 50 HP", "tăng 100 sinh lực", "+15 Linh lực", "tăng 10 Sát thương"
                const hpMatch = desc.match(/(?:\+|-)?\s*(\d+)\s*(?:sinh lực|máu|hp)/) || desc.match(/(?:hồi|tăng|cộng)\s*(\d+)\s*(?:sinh lực|máu|hp)/);
                const mpMatch = desc.match(/(?:\+|-)?\s*(\d+)\s*(?:linh lực|mp|năng lượng)/) || desc.match(/(?:hồi|tăng|cộng)\s*(\d+)\s*(?:linh lực|mp|năng lượng)/);
                const atkMatch = desc.match(/(?:\+|-)?\s*(\d+)\s*(?:sát thương|tấn công|atk)/) || desc.match(/(?:tăng|cộng)\s*(\d+)\s*(?:sát thương|tấn công|atk)/);
                const defMatch = desc.match(/(?:\+|-)?\s*(\d+)\s*(?:phòng thủ|def|giáp)/) || desc.match(/(?:tăng|cộng)\s*(\d+)\s*(?:phòng thủ|def|giáp)/);

                if (hpMatch) parsed['sinhLuc'] = parseInt(hpMatch[1], 10);
                if (mpMatch) parsed['linhLuc'] = parseInt(mpMatch[1], 10);
                if (atkMatch) parsed['sucTanCong'] = parseInt(atkMatch[1], 10);
                if (defMatch) parsed['phongNgu'] = parseInt(defMatch[1], 10);
                
                bonuses = parsed;
            }

            if (Object.keys(bonuses).length > 0) {
                const appliedStats: string[] = [];
                for (const stat in bonuses) {
                    const val = bonuses[stat];
                    if (typeof val === 'number') {
                        const currentVal = newKb.playerStats[stat as keyof PlayerStats] as number || 0;
                        let newVal = currentVal + (val * quantityConsumed);
                        
                        // Prevent overflowing current HP / MP beyond limits
                        if (stat === 'sinhLuc') {
                            const maxVal = newKb.playerStats.maxSinhLuc || 100;
                            newVal = Math.min(newVal, maxVal);
                        } else if (stat === 'linhLuc') {
                            const maxVal = newKb.playerStats.maxLinhLuc || 100;
                            newVal = Math.min(newVal, maxVal);
                        }

                        (newKb.playerStats as any)[stat] = newVal;
                        appliedStats.push(`${stat} +${val * quantityConsumed}`);
                    }
                }
                
                // Triggers full calculation for complex stats dependencies
                newKb.playerStats = calculateEffectiveStats(newKb.playerStats, newKb.equippedItems, newKb.inventory);
                
                if (appliedStats.length > 0) {
                    message += ` Áp dụng chỉ số: ${appliedStats.join(', ')}.`;
                }
            }

            if (targetInventory[itemIndexInTarget].quantity <= 0) {
                targetInventory.splice(itemIndexInTarget, 1);
            }
            systemMessages.push({
                id: 'item-consumed-' + Date.now(), type: 'system',
                content: `🧪 ${message}`,
                timestamp: Date.now(), turnNumber: turnForSystemMessages
            });
        }
    } else {
        console.warn(`ITEM_CONSUMED: Item "${itemName}" not found in inventory or NPC treasury.`);
    }
    return { updatedKb: newKb, systemMessages };
};

export const processItemUpdate = (
    currentKb: KnowledgeBase,
    tagParams: Record<string, string>,
    turnForSystemMessages: number
): { updatedKb: KnowledgeBase; systemMessages: GameMessage[]; updatedVectorMetadata?: VectorMetadata; } => {
    const newKb = currentKb;
    const systemMessages: GameMessage[] = [];
    const itemName = tagParams.name;
    const field = tagParams.field;
    const isLost = tagParams.isLost === 'true';
    const newValue = tagParams.newValue;
    const change = tagParams.change;
    let updatedVectorMetadata: VectorMetadata | undefined = undefined;

    if (!itemName || (!field && !isLost)) { 
        console.warn("ITEM_UPDATE: Missing item name or field.", tagParams); 
        return { updatedKb: newKb, systemMessages }; 
    }
    
    const foundMatch = findItemByName([...newKb.inventory, ...(newKb.npcInventory || [])], itemName);
    if (foundMatch) {
        // Check where the item is
        let targetInventory = newKb.inventory;
        const { item } = foundMatch;
        let itemIndexInTarget = newKb.inventory.findIndex(i => i.id === item.id);
        
        if (itemIndexInTarget === -1 && newKb.npcInventory) {
            targetInventory = newKb.npcInventory;
            itemIndexInTarget = newKb.npcInventory.findIndex(i => i.id === item.id);
        }

        if (itemIndexInTarget !== -1) {
            const itemToUpdate = targetInventory[itemIndexInTarget] as any; 
            
            if (isLost) {
                targetInventory.splice(itemIndexInTarget, 1);
                systemMessages.push({
                    id: 'item-lost-' + itemToUpdate.id, type: 'system',
                    content: `❌ Vật phẩm "${itemToUpdate.name}" đã bị mất hoặc hỏng vĩnh viễn.`,
                    timestamp: Date.now(), turnNumber: turnForSystemMessages
                });
                return { updatedKb: newKb, systemMessages };
            }

            let updateMessagePart = "";

            if (field.startsWith('statBonuses.')) {
                console.warn(`ITEM_UPDATE: Direct update to 'statBonuses' via tag is complex and not fully implemented. Field: ${field}. Consider re-acquiring item with new stats or updating description.`);
            } else { 
                if (newValue !== undefined) {
                    if (typeof itemToUpdate[field] === 'number') itemToUpdate[field] = parseInt(newValue, 10);
                    else if (typeof itemToUpdate[field] === 'boolean') itemToUpdate[field] = newValue.toLowerCase() === 'true';
                    else itemToUpdate[field] = newValue;
                    updateMessagePart = `trường ${field} thành "${newValue}"`;
                } else if (change !== undefined && typeof itemToUpdate[field] === 'number') {
                    const numChange = parseInt(change, 10);
                    if (!isNaN(numChange)) {
                        itemToUpdate[field] += numChange;
                        updateMessagePart = `trường ${field} ${change}`;
                    } else {
                        console.warn(`ITEM_UPDATE: Invalid numeric change value "${change}" for field "${field}".`);
                    }
                }
            }
            
            if (updateMessagePart) {
                newKb.playerStats = calculateEffectiveStats(newKb.playerStats, newKb.equippedItems, newKb.inventory); // Recalculate if item stats change could affect player
                systemMessages.push({
                    id: 'item-updated-' + itemToUpdate.id, type: 'system',
                    content: `🔧 Vật phẩm "${itemToUpdate.name}" đã được cập nhật ${updateMessagePart}.`,
                    timestamp: Date.now(), turnNumber: turnForSystemMessages
                });
                updatedVectorMetadata = {
                    entityId: itemToUpdate.id,
                    entityType: 'item',
                    text: formatItemForEmbedding(itemToUpdate)
                };
            }
        }
    } else {
        console.warn(`ITEM_UPDATE: Item "${itemName}" not found in inventory or NPC treasury.`);
    }
    return { updatedKb: newKb, systemMessages, updatedVectorMetadata };
};
