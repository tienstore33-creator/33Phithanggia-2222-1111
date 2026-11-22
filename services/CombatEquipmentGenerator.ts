import { EquipmentSlotId, NPC, Wife, Slave, Prisoner, PlayerStats } from '../types';
import * as GameTemplates from '../templates';
import { SPECIAL_EFFECT_KEYWORDS } from '../constants/economy';
import { calculateEffectiveStats } from '../utils/statsCalculationUtils';
import { calculateMechanicalStats } from './ItemStatService';
import { generateBonusPercentageStats } from './EquipmentBonusService';
import { getEffectiveRealmSystem } from './realmManager';

/**
 * Service specifically for generating and assigning equipment to NPCs for combat.
 * Focuses on Battle 3.0 requirements.
 */
export class CombatEquipmentGenerator {
    /**
     * Generates a random piece of equipment for a specific slot and type.
     * Logic is inspired by the debug combat player generation but expanded for generic use.
     */
    static generateRandomEquipment(
        slot: EquipmentSlotId, 
        typeLabel: string, 
        realm: string = 'Luyện Khí',
        majorRealms: string[] = []
    ): GameTemplates.EquipmentTemplate {
        const keywords = Object.keys(SPECIAL_EFFECT_KEYWORDS);
        const effects: string[] = [];
        
        // Randomly pick 1-3 effects based on "quality" (higher realms might get more, but let's keep it simple)
        const numEffects = Math.floor(Math.random() * 2) + 1; 
        for (let i = 0; i < numEffects; i++) {
            const kw = keywords[Math.floor(Math.random() * keywords.length)];
            const val = Math.floor(Math.random() * 15) + 5; // 5-20%
            
            // Avoid duplicate keywords in one item (case insensitive check)
            if (!effects.some(e => e.toLowerCase().includes(kw.toLowerCase()))) {
                effects.push(`${kw.charAt(0).toUpperCase() + kw.slice(1)} ${val}%`);
            }
        }

        const realmIndex = this.getRealmPowerIndex(realm);
        const rarity = realmIndex > 2 ? GameTemplates.ItemRarity.CUC_PHAM : GameTemplates.ItemRarity.HIEM;

        // NEW: Calculate stats mechanically using the standard formula!
        const statBonuses = calculateMechanicalStats(
            rarity,
            realm,
            slot,
            majorRealms
        );

        // NEW: Generate percentage stats (dòng ẩn) mechanically!
        const bonusPercentageStats = generateBonusPercentageStats(
            rarity,
            realm,
            majorRealms
        );

        return {
            id: `npc-equip-${slot.toLowerCase()}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            name: `Trang Bị ${typeLabel} (${realm})`,
            description: `Trang bị ngẫu nhiên được tối ưu hóa cho cảnh giới ${realm}.`,
            category: GameTemplates.ItemCategory.EQUIPMENT,
            slot: slot,
            rarity: rarity,
            itemRealm: realm,
            statBonuses: statBonuses,
            bonusPercentageStats: bonusPercentageStats,
            uniqueEffects: effects,
            quantity: 1,
            value: 1000 * (realmIndex + 1),
        } as GameTemplates.EquipmentTemplate;
    }

    /**
     * Equips an NPC (or any combatant) with a basic set of gear (Weapon + Armor).
     * Returns the generated items and the slot mapping.
     */
    static generateEquipmentForNPC(npc: any, majorRealms: string[] = []): { 
        items: GameTemplates.InventoryItem[], 
        equipped: Record<string, string | null> 
    } {
        const realm = npc.realm || 'Luyện Khí';
        const items: GameTemplates.InventoryItem[] = [];
        const equipped: Record<string, string | null> = {
            mainWeapon: null, offHandWeapon: null, head: null, body: null,
            hands: null, legs: null, artifact: null, pet: null, accessory1: null, accessory2: null
        };

        // Standard loadout: Main Weapon and Body Armor
        const weapon = this.generateRandomEquipment('mainWeapon', 'Vũ Khí', realm, majorRealms);
        const armor = this.generateRandomEquipment('body', 'Giáp Thân', realm, majorRealms);

        items.push(weapon as any);
        items.push(armor as any);
        
        equipped.mainWeapon = weapon.id;
        equipped.body = armor.id;

        return { items, equipped };
    }

    /**
     * Prepares participants before battle by auto-generating equipment for those who don't have it.
     * Equipment count scales based on the player's current equipment count (min 1).
     */
    static equipNPCsBeforeBattle(participants: any[], kb: any): void {
        const playerEquipCount = Object.values(kb.equippedItems).filter(item => item !== null).length;
        
        // Công thức mới: Phụ thuộc hoàn toàn vào số trang bị hiện tại của người chơi (playerEquipCount).
        // Nếu playerEquipCount là 5-6 món, targetCount sẽ dao động ngẫu nhiên từ 1 đến 7.
        const maxCount = Math.min(7, Math.max(1, playerEquipCount + 1));
        const targetCount = Math.floor(Math.random() * maxCount) + 1;

        const realmSystem = getEffectiveRealmSystem(kb);
        const majorRealms = realmSystem?.majorRealms || [];

        participants.forEach(npc => {
            // Skip non-humanoids (like monsters)
            if ('species' in npc) {
                if (npc.stats) {
                    // Full recovery for monsters
                    npc.stats.sinhLuc = npc.stats.maxSinhLuc || 1000;
                    npc.stats.linhLuc = npc.stats.maxLinhLuc || 1000;
                }
                return;
            }
            
            // Ensure necessary structures exist
            if (!npc.equippedItems) {
                npc.equippedItems = {
                    mainWeapon: null, offHandWeapon: null, head: null, body: null,
                    hands: null, legs: null, artifact: null, pet: null, accessory1: null, accessory2: null
                };
            }
            if (!npc.inventoryIds) npc.inventoryIds = [];

            // CHECK: If NPC already has any equipment, skip the auto-generation logic
            // This satisfies the requirement: "npc chỉ được cấp trang bị cho trận chiến đầu tiên của họ"
            const alreadyHasGear = Object.values(npc.equippedItems).some(val => val !== null);
            if (alreadyHasGear) {
                console.log(`NPC ${npc.name} already has equipment. Skipping auto-generation for this battle.`);
            } else {
                // 1. Tạo Pool Slot khả dụng
                const allSlots: { slot: EquipmentSlotId, label: string }[] = [
                    { slot: 'mainWeapon', label: 'Vũ Khí' },
                    { slot: 'body', label: 'Giáp Thân' },
                    { slot: 'head', label: 'Giáp Đầu' },
                    { slot: 'hands', label: 'Giáp Tay' },
                    { slot: 'legs', label: 'Giáp Chân' },
                    { slot: 'accessory1', label: 'Trang Sức' },
                    { slot: 'artifact', label: 'Pháp Bảo' },
                ];

                // 2. XÁO TRỘN SLOT (Fisher-Yates Shuffle) - Đạt mục tiêu ngẫu nhiên vị trí
                for (let i = allSlots.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [allSlots[i], allSlots[j]] = [allSlots[j], allSlots[i]];
                }

                // 3. Tiến hành trang bị dựa trên TargetCount
                let equippedCount = 0;
                const realm = npc.realm || 'Luyện Khí';

                for (const config of allSlots) {
                    if (equippedCount >= targetCount) break;
                    
                    if (!npc.equippedItems[config.slot]) {
                        const item = this.generateRandomEquipment(config.slot, config.label, realm, majorRealms);
                        item.ownerId = npc.id; // Mark as NPC owned
                        
                        // Add to NPC treasury instead of player inventory
                        if (!kb.npcInventory) kb.npcInventory = [];
                        kb.npcInventory.push(item);
                        
                        if (!npc.inventory) npc.inventory = [];
                        npc.inventory.push(item);
                        
                        npc.inventoryIds.push(item.id);
                        npc.equippedItems[config.slot] = item.id;
                        equippedCount++;
                    } else {
                        equippedCount++; // Đã có sẵn món này rồi
                    }
                }
            }

            // Sync stats based on new equipment and REFILL HP/MP
            if (npc.stats) {
                // Use the combined inventory (Player + NPC Treasury) to ensure all items are found
                const combinedInventory = [...(kb.inventory || []), ...(kb.npcInventory || [])];
                const effective = calculateEffectiveStats(npc.stats, npc.equippedItems as any, combinedInventory);
                
                // Update bounds
                npc.stats.maxSinhLuc = effective.maxSinhLuc;
                npc.stats.maxLinhLuc = effective.maxLinhLuc;
                npc.stats.sucTanCong = effective.sucTanCong;
                
                // FULL RECOVERY
                npc.stats.sinhLuc = effective.maxSinhLuc;
                npc.stats.linhLuc = effective.maxLinhLuc;
            }
        });
    }

    /**
     * Helper to determine power level of a realm string for scaling.
     */
    private static getRealmPowerIndex(realm: string): number {
        const realms = [
            'Phàm Nhân', 'Luyện Khí', 'Trúc Cơ', 'Kim Đan', 'Nguyên Anh', 
            'Hóa Thần', 'Luyện Hư', 'Hợp Thể', 'Đại Thừa', 'Độ Kiếp',
            'Luyện Nhục', 'Ngưng Khí', 'Huyết Linh', 'Chân Tiên'
        ];
        
        const index = realms.findIndex(r => realm.includes(r));
        return index === -1 ? 1 : index; // Default to 1 (Luyện Khí) if not found
    }
}
