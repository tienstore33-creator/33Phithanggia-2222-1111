import { SPECIAL_EFFECT_KEYWORDS } from '../constants/economy';
import { Item, EquipmentSlotId } from '../types';
import * as GameTemplates from '../templates';

/**
 * Parses passive effects from absolute strings in equipped items.
 * Example of strings: "Hút máu 5%", "Phản đòn 10%", "Tăng 15% chí mạng"
 */
export const parseEquipmentEffects = (
    inventory: Item[],
    equippedItemIds: Record<EquipmentSlotId, string | null>,
    inventoryMap?: Map<string, Item>
): Record<string, number> => {
    const effects: Record<string, number> = {};
    
    // Initialize with all known keywords at 0 to ensure consistency if needed, 
    // but usually better to only return what exists.
    
    Object.values(equippedItemIds).forEach(itemId => {
        if (!itemId) return;
        
        const item = inventoryMap ? inventoryMap.get(itemId) : inventory.find(i => i.id === itemId);
        if (!item || item.category !== GameTemplates.ItemCategory.EQUIPMENT) return;
        
        // Cast to EquipmentTemplate safely
        const equipment = item as GameTemplates.EquipmentTemplate;
        if (!equipment.uniqueEffects) return;
        
        equipment.uniqueEffects.forEach(effectStr => {
            const lowerStr = effectStr.toLowerCase();
            
            Object.keys(SPECIAL_EFFECT_KEYWORDS).forEach(keyword => {
                if (lowerStr.includes(keyword)) {
                    // Regex strategy: find digits near the keyword
                    // Keyword could be "hút máu", string "Hút máu 5%"
                    // match digits that come after the keyword
                    const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const regex = new RegExp(`${escapedKeyword}.*?(\\d+(?:\\.\\d+)?)`);
                    const match = lowerStr.match(regex);
                    
                    const val = match ? parseFloat(match[1]) : 0; 
                    if (val > 0) {
                        effects[keyword] = (effects[keyword] || 0) + val;
                    }
                }
            });
        });
    });
    
    return effects;
};
