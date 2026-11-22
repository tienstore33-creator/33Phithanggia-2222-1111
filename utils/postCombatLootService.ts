import { Item, KnowledgeBase, CombatDispositionMap, EquipmentSlotId } from '../types';
import { CombatEquipmentGenerator } from '../services/CombatEquipmentGenerator';
import { getEffectiveRealmSystem } from '../services/realmManager';

export interface LootExtractionResult {
    lootedItems: Item[];
    systemLogMessages: string[];
    lootSummaryText: string;
}

/**
 * Trích xuất 50% trang bị và vật phẩm từ thi thể của các đối thủ bị người chơi chọn "Kết Liễu" (kill).
 * Tự động tạo ID mới tránh xung đột dữ liệu, dọn sạch kho đồ NPC và sinh thông báo/chỉ thị cho AI kể chuyện.
 */
export function extractLootFromDefeatedEntities(
    defeatedEntities: any[],
    dispositions: CombatDispositionMap,
    kb: KnowledgeBase
): LootExtractionResult {
    const lootedItems: Item[] = [];
    const systemLogMessages: string[] = [];
    const combinedInventory: Item[] = [
        ...(kb.inventory || []),
        ...(kb.npcInventory || [])
    ];

    const processedItemIds = new Set<string>();
    const realmSystem = getEffectiveRealmSystem(kb);
    const majorRealms = realmSystem?.majorRealms || [];

    defeatedEntities.forEach((entity, idx) => {
        const eId = entity.id || `enemy_${idx}`;
        const normalizedId = eId.replace(/^enemy_\d+_/, '');
        const disposition = dispositions[eId] || dispositions[normalizedId];

        if (disposition !== 'kill') return;

        const combatant = entity.combatant || entity;
        if (!combatant) return;

        const entityName = combatant.name || entity.name || `Kẻ địch #${idx + 1}`;
        const entityRealm = combatant.realm || entity.realm || 'Luyện Khí';

        // Tìm NPC trong KnowledgeBase nếu có để quét thêm kho đồ
        const allNpcLists = [
            ...(kb.discoveredNPCs || []),
            ...(kb.discoveredYeuThu || []),
            ...(kb.wives || []),
            ...(kb.slaves || []),
            ...(kb.prisoners || []),
            ...((kb.pendingCombat as any)?.temporaryEntities || [])
        ];
        const matchedNpc = allNpcLists.find(n => n && (n.id === eId || n.id === normalizedId || n.name === entityName));

        // Gom toàn bộ kho đồ khả dụng của NPC để tra cứu item
        const npcPersonalInventory: Item[] = [
            ...(Array.isArray(combatant.inventory) ? combatant.inventory : []),
            ...(matchedNpc && Array.isArray(matchedNpc.inventory) ? matchedNpc.inventory : [])
        ];

        // 1. Quét từ equippedItems (kẻ địch đang mặc)
        const equippedMap = combatant.equippedItems || 
                            combatant.stats?.equippedItems || 
                            matchedNpc?.equippedItems || 
                            matchedNpc?.stats?.equippedItems;

        const equippedEntries: { slot: string; itemVal: any }[] = [];
        if (equippedMap && typeof equippedMap === 'object') {
            Object.entries(equippedMap).forEach(([slot, val]) => {
                if (val) {
                    equippedEntries.push({ slot, itemVal: val });
                }
            });
        }

        // --- QUY TẮC CƠ HỌC: NHẶT 50% TRANG BỊ KẺ ĐỊCH ĐANG MẶC ---
        const selectedEquippedEntries: { slot: string; itemVal: any }[] = [];
        if (equippedEntries.length === 1) {
            // Có đúng 1 món đang mặc: 50% xác suất nhặt được món đó
            if (Math.random() < 0.5) {
                selectedEquippedEntries.push(equippedEntries[0]);
            }
        } else if (equippedEntries.length > 1) {
            // Có từ 2 món trở lên: Lấy đúng 50% số lượng trang bị đang mặc (Math.round)
            const dropCount = Math.max(1, Math.round(equippedEntries.length * 0.5));
            // Xáo trộn ngẫu nhiên (Fisher-Yates) và chọn ra dropCount món
            const shuffled = [...equippedEntries];
            for (let i = shuffled.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
            }
            selectedEquippedEntries.push(...shuffled.slice(0, dropCount));
        }

        // 2. Quét thêm từ kho đồ cá nhân (túi đồ NPC) - tỷ lệ rơi 50% mỗi món
        const rawInventoryIds: string[] = [];
        if (Array.isArray(combatant.inventoryIds)) {
            rawInventoryIds.push(...combatant.inventoryIds);
        }
        if (matchedNpc && Array.isArray(matchedNpc.inventoryIds)) {
            rawInventoryIds.push(...matchedNpc.inventoryIds);
        }
        const selectedInventoryIds = rawInventoryIds.filter(id => {
            // Không trùng với trang bị đang mặc đã xử lý và 50% xác suất rơi
            const isEquipped = equippedEntries.some(e => e.itemVal === id || (typeof e.itemVal === 'object' && e.itemVal?.id === id));
            return !isEquipped && Math.random() < 0.5;
        });

        // 3. Trích xuất trang bị đã chọn từ equippedItems
        selectedEquippedEntries.forEach(({ slot, itemVal }) => {
            let foundItem: Item | null = null;

            if (typeof itemVal === 'object' && itemVal !== null && itemVal.name) {
                foundItem = itemVal as Item;
            } else if (typeof itemVal === 'string' && itemVal.trim() !== '') {
                const itemId = itemVal.trim();
                if (processedItemIds.has(itemId)) return;
                processedItemIds.add(itemId);

                foundItem = npcPersonalInventory.find(i => i && i.id === itemId) ||
                            combinedInventory.find(i => i && i.id === itemId) ||
                            combinedInventory.find(i => i && (i.id.startsWith(itemId) || itemId.startsWith(i.id))) ||
                            null;

                // Nếu không tìm thấy trong kho nhưng có ID hoặc Slot, tái tạo lại đúng chuẩn trang bị để người chơi không bị mất đồ
                if (!foundItem) {
                    const slotLabels: Record<string, string> = {
                        mainWeapon: 'Vũ Khí',
                        offHandWeapon: 'Vũ Khí Phụ',
                        head: 'Giáp Đầu',
                        body: 'Giáp Thân',
                        hands: 'Giáp Tay',
                        legs: 'Giáp Chân',
                        artifact: 'Pháp Bảo',
                        pet: 'Linh Thú',
                        accessory1: 'Trang Sức',
                        accessory2: 'Trang Sức'
                    };
                    const label = slotLabels[slot] || 'Trang Bị';
                    foundItem = CombatEquipmentGenerator.generateRandomEquipment(
                        slot as EquipmentSlotId,
                        label,
                        entityRealm,
                        majorRealms
                    ) as Item;
                }
            }

            if (foundItem) {
                const uniqueLootedId = `${foundItem.id}_looted_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
                const clonedItem: Item = {
                    ...JSON.parse(JSON.stringify(foundItem)),
                    id: uniqueLootedId,
                    ownerId: undefined
                };

                lootedItems.push(clonedItem);
                systemLogMessages.push(`📦 [Thu Hoạch] Nhặt được ${clonedItem.name} (Trang bị) từ thi thể ${entityName}.`);

                // Dọn sạch khỏi kho NPC nếu có tồn tại để tránh rò rỉ dữ liệu
                if (kb.npcInventory) {
                    kb.npcInventory = kb.npcInventory.filter(i => i.id !== foundItem!.id);
                }
            }
        });

        // 4. Trích xuất vật phẩm từ túi đồ cá nhân của NPC
        selectedInventoryIds.forEach(itemId => {
            if (processedItemIds.has(itemId)) return;
            processedItemIds.add(itemId);

            const foundItem = npcPersonalInventory.find(i => i && i.id === itemId) ||
                              combinedInventory.find(i => i && i.id === itemId);

            if (foundItem) {
                const uniqueLootedId = `${foundItem.id}_looted_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
                const clonedItem: Item = {
                    ...JSON.parse(JSON.stringify(foundItem)),
                    id: uniqueLootedId,
                    ownerId: undefined
                };

                lootedItems.push(clonedItem);
                systemLogMessages.push(`📦 [Thu Hoạch] Nhận được ${clonedItem.name} từ túi đồ ${entityName}.`);

                if (kb.npcInventory) {
                    kb.npcInventory = kb.npcInventory.filter(i => i.id !== foundItem.id);
                }
            }
        });
    });

    let lootSummaryText = "";
    if (lootedItems.length > 0) {
        const itemNames = lootedItems.map(i => i.name);
        const genericNames = itemNames.filter(name => name.startsWith('Trang Bị') || name.startsWith('Trang bị'));

        lootSummaryText += `\n\nBạn đã thu được các chiến lợi phẩm từ kẻ địch bị kết liễu: ${itemNames.join(', ')}.`;
        
        if (genericNames.length > 0) {
            lootSummaryText += `\n[HỆ THỐNG YÊU CẦU AI]: Trong số các chiến lợi phẩm thu được có những trang bị tên chung chung (${genericNames.join(', ')}). Trong phần lời kể, AI HÃY TỰ ĐẶT LẠI TÊN RIÊNG cho các trang bị này (ví dụ: Hắc Thiết Kiếm, Huyết Ảnh Giáp...) sao cho phù hợp với môn phái/đặc điểm của kẻ địch bị kết liễu, đồng thời miêu tả cảnh MC lột đồ/thu hoạch chiến lợi phẩm từ xác của chúng.`;
        } else {
            lootSummaryText += `\n[HỆ THỐNG YÊU CẦU AI]: Trong phần lời kể, AI hãy miêu tả cảnh MC thu hoạch các chiến lợi phẩm này từ xác của kẻ địch vừa bị kết liễu.`;
        }
    }

    return {
        lootedItems,
        systemLogMessages,
        lootSummaryText
    };
}
