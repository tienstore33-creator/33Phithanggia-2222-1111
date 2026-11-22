
import { EquipmentSlotId } from '../types';

/**
 * Normalizes a natural language slot name (Vietnamese or English) 
 * into a standardized EquipmentSlotId used by the game system.
 */
export const normalizeSlotId = (slotStr?: string): EquipmentSlotId => {
    if (!slotStr) return 'mainWeapon';
    const clean = slotStr.toLowerCase().trim();
    
    // Main Weapon
    if (
        clean.includes('vũ khí chính') || 
        clean.includes('vũ khí') || 
        clean.includes('kiếm') || 
        clean.includes('đao') || 
        clean.includes('thương') || 
        clean.includes('cung') || 
        clean.includes('trượng') || 
        clean === 'mainweapon' ||
        clean === 'weapon'
    ) return 'mainWeapon';
    
    // Off-hand / Shield
    if (
        clean.includes('vũ khí phụ') || 
        clean.includes('khiên') || 
        clean.includes('đỡ đòn') || 
        clean.includes('tay trái') ||
        clean === 'offhandweapon' ||
        clean === 'shield'
    ) return 'offHandWeapon';
    
    // Head
    if (
        clean.includes('giáp đầu') || 
        clean.includes('mũ') || 
        clean.includes('nón') || 
        clean.includes('phần đầu') ||
        clean === 'head' ||
        clean === 'helmet'
    ) return 'head';
    
    // Body
    if (
        clean.includes('giáp thân') || 
        clean.includes('áo') || 
        clean.includes('y phục') || 
        clean.includes('giáp trụ') ||
        clean === 'body' ||
        clean === 'armor'
    ) return 'body';
    
    // Hands
    if (
        clean.includes('giáp tay') || 
        clean.includes('bao tay') || 
        clean.includes('găng') || 
        clean.includes('hộ thủ') ||
        clean === 'hands' ||
        clean === 'gloves'
    ) return 'hands';
    
    // Legs
    if (
        clean.includes('giáp chân') || 
        clean.includes('giày') || 
        clean.includes('ủng') || 
        clean.includes('hộ túc') ||
        clean === 'legs' ||
        clean === 'boots'
    ) return 'legs';
    
    // Artifact
    if (
        clean.includes('pháp bảo') || 
        clean.includes('linh bảo') || 
        clean.includes('bảo vật') ||
        clean === 'artifact'
    ) return 'artifact';
    
    // Pet
    if (
        clean.includes('thú cưng') || 
        clean.includes('linh thú') || 
        clean.includes('sủng vật') || 
        clean.includes('linh vật') ||
        clean === 'pet'
    ) return 'pet';
    
    // Accessories
    if (
        clean.includes('trang sức 2') || 
        clean.includes('nhẫn 2') || 
        clean === 'accessory2'
    ) return 'accessory2';
    
    if (
        clean.includes('trang sức') || 
        clean.includes('nhẫn') || 
        clean.includes('dây chuyền') || 
        clean.includes('ngọc bội') ||
        clean.includes('vòng cổ') ||
        clean === 'accessory1' ||
        clean === 'accessory'
    ) return 'accessory1';
    
    return 'mainWeapon';
};

/**
 * Parses a stat bonuses string into a Partial<PlayerStats> object.
 * Handles both JSON and simple list formats (e.g., "Attack: 10, HP: 50").
 */
export const parseStatBonuses = (statStr?: string): Record<string, number> => {
    if (!statStr || statStr === '{}' || statStr === '""') return {};
    
    // 1. Try JSON
    try {
        const parsed = JSON.parse(statStr);
        if (typeof parsed === 'object' && parsed !== null) {
            // Normalize keys to camelCase if they match standard stats
            const normalized: Record<string, number> = {};
            const keyMap: Record<string, string> = {
                'sinhLuc': 'sinhLuc',
                'maxsinhluc': 'maxSinhLuc',
                'maxSinhLuc': 'maxSinhLuc',
                'linhLuc': 'linhLuc',
                'maxlinhluc': 'maxLinhLuc',
                'maxLinhLuc': 'maxLinhLuc',
                'suctancong': 'sucTanCong',
                'sucTanCong': 'sucTanCong',
                'phongngu': 'phongNgu',
                'phongNgu': 'phongNgu',
                'hp': 'maxSinhLuc',
                'mp': 'maxLinhLuc',
                'attack': 'sucTanCong',
                'atk': 'sucTanCong',
                'defense': 'phongNgu',
                'def': 'phongNgu',
                'sát thương': 'sucTanCong',
                'tấn công': 'sucTanCong',
                'máu': 'maxSinhLuc',
                'năng lượng': 'maxLinhLuc',
                'phòng thủ': 'phongNgu'
            };

            for (const [key, value] of Object.entries(parsed)) {
                const normalizedKey = keyMap[key] || keyMap[key.toLowerCase()] || key;
                const numValue = typeof value === 'number' ? value : parseInt(String(value));
                if (!isNaN(numValue)) {
                    normalized[normalizedKey] = numValue;
                }
            }
            return normalized;
        }
    } catch (e) {
        // Not JSON, continue to manual parsing
    }
    
    // 2. Try Manual parsing for strings like "Attack: 10, HP: 50"
    const stats: Record<string, number> = {};
    const pairs = statStr.split(/[,;]/);
    
    const keyMap: Record<string, string> = {
        'hp': 'maxSinhLuc',
        'máu': 'maxSinhLuc',
        'sinh lực': 'maxSinhLuc',
        'max sinh lực': 'maxSinhLuc',
        'mp': 'maxLinhLuc',
        'linh lực': 'maxLinhLuc',
        'max linh lực': 'maxLinhLuc',
        'năng lượng': 'maxLinhLuc',
        'attack': 'sucTanCong',
        'atk': 'sucTanCong',
        'tấn công': 'sucTanCong',
        'sát thương': 'sucTanCong',
        'suc tan cong': 'sucTanCong',
        'defense': 'phongNgu',
        'def': 'phongNgu',
        'phòng thủ': 'phongNgu',
        'phong ngu': 'phongNgu'
    };

    pairs.forEach(pair => {
        const [keyRaw, valueRaw] = pair.split(':');
        if (keyRaw && valueRaw) {
            const key = keyRaw.trim().toLowerCase();
            const value = parseInt(valueRaw.trim());
            const normalizedKey = keyMap[key] || key;
            if (!isNaN(value)) {
                stats[normalizedKey] = value;
            }
        }
    });

    return stats;
};
