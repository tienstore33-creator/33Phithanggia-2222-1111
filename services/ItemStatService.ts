
import { ItemRarity, ItemCategory } from '../templates';
import { PlayerStats, StartingItem } from '../types';
import { parseStatBonuses } from '../utils/itemUtils';
import { generateBonusPercentageStats } from './EquipmentBonusService';
import { DEFAULT_TIERED_STATS } from '../constants/character';

export const RARITY_MULTIPLIERS: Record<string, number> = {
  'phổ thông': 1,
  'common': 1,
  'hiếm': 1.8,
  'rare': 1.8,
  'quý báu': 2.5,
  'epic': 2.5,
  'cực phẩm': 4.5,
  'heroic': 4.5,
  'thần thoại': 8,
  'legendary': 8,
  'chí tôn': 15,
  'mythic': 15,
  'thông dụng': 1,
  'vô phẩm': 0.5
};

export const REALM_BASE_POWER = 10;
export const REALM_MULTIPLIER = 1.0;

/**
 * Calculates mechanical stats for an item based on its rarity, realm, and slot.
 * @param rarity The rarity of the item
 * @param realm The realm/cultivation level (e.g., "Luyện Khí Tầng 1")
 * @param slot The equipment slot
 * @param majorRealms List of all major realms to determine the realm index
 */
export function calculateMechanicalStats(
  rarity: string,
  realm: string,
  slot: string,
  majorRealms: string[] = []
): Record<string, number> {
  const normRarity = rarity?.toLowerCase() || 'phổ thông';
  
  // Find realm index
  let realmIndex = 0;
  if (realm && majorRealms.length > 0) {
    const realmLower = realm.toLowerCase();
    // Sort majorRealms by length descending to match longest names first
    const sortedMajors = [...majorRealms].sort((a, b) => b.length - a.length);
    
    for (const majorName of sortedMajors) {
      if (realmLower.includes(majorName.toLowerCase())) {
        const originalIndex = majorRealms.indexOf(majorName);
        if (originalIndex !== -1) {
          realmIndex = originalIndex;
          break;
        }
      }
    }
    
    // Fallback to first word split if no inclusion match found
    if (realmIndex === 0) {
      const majorPart = realm.split(' ')[0].toLowerCase();
      const foundIndex = majorRealms.findIndex(r => r.toLowerCase().includes(majorPart));
      if (foundIndex !== -1) realmIndex = foundIndex;
    }
  }

  const maxHpGoc = DEFAULT_TIERED_STATS[realmIndex]?.hpBase || 100;
  const baseValue = maxHpGoc / 10;
  const tierMultiplier = Math.pow(REALM_MULTIPLIER, realmIndex);
  const basePower = baseValue * tierMultiplier;
  const rarityMult = RARITY_MULTIPLIERS[normRarity] || 1;
  const totalPoints = Math.round(basePower * rarityMult);

  const stats: Record<string, number> = {};

  // Assign stats based on slot
  const slotLower = slot?.toLowerCase() || "";
  
  if (slotLower.includes("weapon") || slotLower.includes("vũ khí")) {
    stats.sucTanCong = Math.floor(totalPoints / 4);
    // Add lifesteal or crit as unique effect if rarity is high
    // But for stats, let's stick to base ones
  } else if (slotLower.includes("body") || slotLower.includes("giáp thân") || slotLower.includes("giáp")) {
    stats.phongNgu = Math.round(totalPoints * 0.1);
    stats.maxSinhLuc = totalPoints * 2;
  } else if (slotLower.includes("head") || slotLower.includes("giáp đầu")) {
    stats.maxSinhLuc = totalPoints;
    stats.phongNgu = Math.round(totalPoints * 0.1);
  } else if (slotLower.includes("accessory") || slotLower.includes("trang sức") || slotLower.includes("pháp bảo")) {
    stats.maxSinhLuc = totalPoints;
    stats.maxLinhLuc = totalPoints;
  } else {
    // Default fallback
    stats.sucTanCong = Math.round(totalPoints * 0.5);
    stats.maxSinhLuc = totalPoints * 2;
  }

  return stats;
}

export function autoEnrichItem(item: StartingItem, majorRealms: string[]): StartingItem {
  if (item.category !== ItemCategory.EQUIPMENT) return item;

  const newItem = { ...item };
  if (!newItem.equipmentDetails) {
    newItem.equipmentDetails = {
      slot: "Vũ Khí Chính",
      statBonusesString: "{}",
      uniqueEffectsString: ""
    };
  } else {
    // Deep clone equipmentDetails to avoid mutations
    newItem.equipmentDetails = { ...newItem.equipmentDetails };
  }

  // 1. Process statBonusesString into statBonuses if needed
  if (newItem.equipmentDetails.statBonusesString && newItem.equipmentDetails.statBonusesString !== "AUTO" && 
      (!newItem.equipmentDetails.statBonuses || Object.keys(newItem.equipmentDetails.statBonuses).length === 0)) {
    try {
      newItem.equipmentDetails.statBonuses = parseStatBonuses(newItem.equipmentDetails.statBonusesString);
    } catch (e) {
      console.error("Failed to parse statBonusesJSON in autoEnrichItem:", newItem.equipmentDetails.statBonusesString);
    }
  }

  // 2. Process uniqueEffectsString into uniqueEffects array if needed
  if (newItem.equipmentDetails.uniqueEffectsString && 
      (!newItem.equipmentDetails.uniqueEffects || newItem.equipmentDetails.uniqueEffects.length === 0)) {
    newItem.equipmentDetails.uniqueEffects = newItem.equipmentDetails.uniqueEffectsString
      .split(';')
      .map(s => s.trim())
      .filter(Boolean);
  }

  // 3. If stats are empty or marked as AUTO, calculate them
  const hasStats = newItem.equipmentDetails.statBonuses && Object.keys(newItem.equipmentDetails.statBonuses).length > 0;
  const isAuto = newItem.equipmentDetails.statBonusesString === "AUTO" || !newItem.equipmentDetails.statBonusesString;

  if (!hasStats || isAuto) {
    const mechanicalStats = calculateMechanicalStats(
      newItem.rarity || "Common",
      newItem.itemRealm || "Phàm Nhân",
      newItem.equipmentDetails.slot || "Vũ Khí Chính",
      majorRealms
    );
    newItem.equipmentDetails.statBonuses = mechanicalStats;
    newItem.equipmentDetails.statBonusesString = JSON.stringify(mechanicalStats);
  }

  // Ensure rarity and realm are set
  if (!newItem.rarity) newItem.rarity = ItemRarity.PHO_THONG;
  if (!newItem.itemRealm) newItem.itemRealm = "Phàm Nhân";
  
  if (!newItem.equipmentDetails.slot) {
    const slots = ["Vũ Khí Chính", "Giáp Thân", "Giáp Đầu", "Giáp Tay", "Giáp Chân", "Trang Sức", "Pháp Bảo"];
    newItem.equipmentDetails.slot = slots[Math.floor(Math.random() * slots.length)];
  }

  // Generate bonus percentage stats
  if (!newItem.equipmentDetails.bonusPercentageStats || Object.keys(newItem.equipmentDetails.bonusPercentageStats).length === 0) {
    newItem.equipmentDetails.bonusPercentageStats = generateBonusPercentageStats(
      newItem.rarity,
      newItem.itemRealm,
      majorRealms
    );
  }

  return newItem;
}

export function processStartingItems(items: StartingItem[], majorRealms: string[]): StartingItem[] {
  if (!items) return [];
  return items.map(item => {
    let newItem = { ...item };
    
    if (newItem.category === ItemCategory.EQUIPMENT) {
      newItem = autoEnrichItem(newItem, majorRealms);
    }

    if (!newItem.description || newItem.description.trim() === "") {
      newItem.description = `Một vật phẩm ${newItem.rarity || 'thông thường'} trong thế giới này.`;
    }

    return newItem;
  });
}
