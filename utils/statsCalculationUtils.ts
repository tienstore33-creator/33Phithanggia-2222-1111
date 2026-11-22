
import { PlayerStats, RealmBaseStatDefinition, Item, EquipmentSlotId, StatusEffect, GameMessage, KnowledgeBase, Slave, Prisoner, TuChatTier } from '../types';
import { 
    DEFAULT_PLAYER_STATS, 
    SUB_REALM_NAMES, 
    DEFAULT_TIERED_STATS, 
    VIETNAMESE, 
    DEFAULT_MORTAL_STATS,
    MORTAL_REALM_BASE_VALUE,
    FIRST_CULTIVATION_REALM_BASE_VALUE,
    REALM_MULTIPLIER_BASE,
    REALM_MULTIPLIER_DECAY,
    REALM_MULTIPLIER_MIN,
    STAT_POINT_VALUES,
    RARITY_MULTIPLIERS,
    CATEGORY_MULTIPLIERS,
    SPECIAL_EFFECT_KEYWORDS,
    UNKNOWN_EFFECT_MULTIPLIER,
    AUCTION_NPC_CURRENCY_BY_REALM_TIER,
    TU_CHAT_VALUE_MULTIPLIERS,
    SPIRIT_STONE_PRICES,
} from '../constants';
import * as GameTemplates from '../templates';
import { normalizeStringForComparison } from './questUtils';

import { getEffectiveRealmSystem, getRealmSystemByRace } from '../services/realmManager';
import { parseRealm } from './realmUtils';

import { parseEquipmentEffects } from './combatEffectUtils';
import { calculateMechanicalItemPrice } from './itemValuationUtils';

// Calculates base stats (maxHP, maxMP, baseATK, maxEXP) based on realm.
export const calculateRealmBaseStats = (
    realmString: string,
    mainRealmListOrKb: string[] | KnowledgeBase,
    currentRealmBaseStatsMap?: Record<string, RealmBaseStatDefinition>,
    minorRealmList?: string[]
): Pick<PlayerStats, 'baseMaxSinhLuc' | 'baseMaxLinhLuc' | 'baseSucTanCong' | 'baseMaxKinhNghiem'> => {
    
    let mainRealmList: string[];
    let subRealmList: string[];
    let statsMap: Record<string, RealmBaseStatDefinition>;

    if (Array.isArray(mainRealmListOrKb)) {
        mainRealmList = mainRealmListOrKb;
        subRealmList = minorRealmList || SUB_REALM_NAMES;
        statsMap = currentRealmBaseStatsMap || {};
    } else {
        const kb = mainRealmListOrKb;
        const realmSystem = getEffectiveRealmSystem(kb);
        mainRealmList = realmSystem.majorRealms;
        subRealmList = realmSystem.minorRealms;
        statsMap = kb.currentRealmBaseStats || {};
    }

    if (typeof realmString !== 'string' || !realmString) {
        console.error(`[calculateRealmBaseStats] realmString is invalid: ${JSON.stringify(realmString)}. Using fallback.`); // Keep critical error
        realmString = DEFAULT_PLAYER_STATS.realm;
    }

    if (realmString === VIETNAMESE.mortalRealmName || realmString === DEFAULT_MORTAL_STATS.realm || realmString === VIETNAMESE.noCultivationSystem) {
        return {
            baseMaxKinhNghiem: DEFAULT_MORTAL_STATS.baseMaxKinhNghiem,
            baseMaxSinhLuc: DEFAULT_MORTAL_STATS.baseMaxSinhLuc,
            baseMaxLinhLuc: DEFAULT_MORTAL_STATS.baseMaxLinhLuc,
            baseSucTanCong: DEFAULT_MORTAL_STATS.baseSucTanCong,
        };
    }

    let mainRealmName = "";
    let subRealmName = "";
    
    // Sort main realms by length descending to match longer names first (e.g., "Hợp Thể" before "Hợp")
    const sortedMainRealmList = [...mainRealmList].sort((a,b) => b.length - a.length);

    // Clean up realm string: "Major (Minor)" -> "Major Minor" or handle parentheses
    const cleanedRealmString = realmString.replace(/[()]/g, ' ').replace(/\s+/g, ' ').trim();

    for (const potentialMainRealm of sortedMainRealmList) {
        const trimmedMain = potentialMainRealm.trim();
        if (!trimmedMain) continue;
        
        // Try matching with cleaned string or original string
        if (cleanedRealmString.startsWith(trimmedMain) || realmString.startsWith(trimmedMain)) {
            mainRealmName = potentialMainRealm;
            
            // Determine remaining part for sub-realm matching
            let remainingPart = "";
            if (realmString.startsWith(trimmedMain)) {
                remainingPart = realmString.substring(trimmedMain.length).trim();
            } else {
                remainingPart = cleanedRealmString.substring(trimmedMain.length).trim();
            }
            
            // Case 1: Direct match to a main realm (e.g., "Luyện Khí") -> assume peak or first sub-realm
            if (remainingPart === '' || remainingPart === '()') {
                subRealmName = subRealmList[0]; // Default to first sub-realm instead of peak for starting
                break;
            }

            // Case 2: Find sub-realm within the remaining part
            const sortedSubRealms = [...subRealmList].sort((a, b) => b.length - a.length);
            for (const potentialSubRealm of sortedSubRealms) {
                if (remainingPart.includes(potentialSubRealm.trim()) || cleanedRealmString.includes(potentialSubRealm.trim())) {
                    subRealmName = potentialSubRealm;
                    break; 
                }
            }

            // Fallback if main realm matched but sub-realm didn't
            if (!subRealmName) {
                subRealmName = subRealmList[0];
            }

            if (subRealmName) break;
        }
    }
    
    const fallbackTierDefinition = DEFAULT_TIERED_STATS[0] || { hpBase: 10, hpInc: 1, mpBase: 10, mpInc: 1, atkBase: 1, atkInc: 0, expBase: 10, expInc: 1 };

    if (!mainRealmName || !subRealmName) {
        if (realmString !== "Không rõ") {
            // This warning is for non-standard NPC realms, which is fine, so we can mute it.
        }
        return {
            baseMaxKinhNghiem: fallbackTierDefinition.expBase,
            baseMaxSinhLuc: fallbackTierDefinition.hpBase,
            baseMaxLinhLuc: fallbackTierDefinition.mpBase,
            baseSucTanCong: fallbackTierDefinition.atkBase,
        };
    }
    
    const subRealmIndex = subRealmList.indexOf(subRealmName);
    
    if (subRealmIndex === -1) {
         let tierDefinitionForError = statsMap[mainRealmName] || fallbackTierDefinition;
         return {
            baseMaxKinhNghiem: tierDefinitionForError.expBase,
            baseMaxSinhLuc: tierDefinitionForError.hpBase,
            baseMaxLinhLuc: tierDefinitionForError.mpBase,
            baseSucTanCong: tierDefinitionForError.atkBase,
        };
    }
    
    let tierDefinition = statsMap[mainRealmName];
    if (!tierDefinition) {
      const mainRealmIndexInList = mainRealmList.findIndex(r => r.trim() === mainRealmName.trim());
      if (mainRealmIndexInList !== -1 && mainRealmIndexInList < DEFAULT_TIERED_STATS.length) {
          tierDefinition = DEFAULT_TIERED_STATS[mainRealmIndexInList];
      } else {
          tierDefinition = fallbackTierDefinition;
      }
    }
    
    const calculatedBaseMaxSinhLuc = tierDefinition.hpBase + (subRealmIndex * tierDefinition.hpInc);
    const calculatedBaseMaxLinhLuc = tierDefinition.mpBase + (subRealmIndex * tierDefinition.mpInc);
    const calculatedBaseSucTanCong = tierDefinition.atkBase + (subRealmIndex * tierDefinition.atkInc);
    
    // FORCE: baseMaxKinhNghiem MUST equal baseMaxSinhLuc as per strict requirement
    const calculatedBaseMaxKinhNghiem = calculatedBaseMaxSinhLuc;
    
    const calculatedStats = {
        baseMaxKinhNghiem: Math.max(10, calculatedBaseMaxKinhNghiem),
        baseMaxSinhLuc: Math.max(10, calculatedBaseMaxSinhLuc),
        baseMaxLinhLuc: Math.max(0, calculatedBaseMaxLinhLuc),
        baseSucTanCong: Math.max(1, calculatedBaseSucTanCong),
    };
    
    return calculatedStats;
};

/**
 * Cập nhật chỉ số cho một thực thể (NPC hoặc Yêu Thú) dựa trên cảnh giới của họ.
 * Đảm bảo logic tính toán chỉ số đồng bộ với người chơi.
 */
export const updateEntityStatsFromRealm = (
    entity: { realm?: string; stats?: Partial<PlayerStats> },
    kb: KnowledgeBase
): void => {
    if (!kb.worldConfig?.isCultivationEnabled) {
        // FORCE 100/50 when cultivation is disabled but KEEP REALM
        entity.stats = {
            ...entity.stats,
            baseMaxSinhLuc: 100,
            baseMaxLinhLuc: 50,
            maxSinhLuc: 100,
            maxLinhLuc: 50,
            sucTanCong: Math.max(entity.stats?.sucTanCong ?? 10, 10),
            maxKinhNghiem: 100,
            sinhLuc: Math.min(entity.stats?.sinhLuc ?? 100, 100),
            linhLuc: Math.min(entity.stats?.linhLuc ?? 50, 50),
        };
        return;
    }

    if (!entity.realm) {
        if (!entity.stats || Object.keys(entity.stats).length === 0) {
            entity.stats = { ...DEFAULT_MORTAL_STATS };
        }
        return;
    }

    const baseStats = calculateRealmBaseStats(entity.realm, kb);
    
    entity.stats = {
        ...entity.stats,
        ...baseStats,
        maxSinhLuc: baseStats.baseMaxSinhLuc,
        maxLinhLuc: baseStats.baseMaxLinhLuc,
        sucTanCong: baseStats.baseSucTanCong,
        maxKinhNghiem: baseStats.baseMaxKinhNghiem,
        sinhLuc: entity.stats?.sinhLuc !== undefined ? Math.min(entity.stats.sinhLuc, baseStats.baseMaxSinhLuc) : baseStats.baseMaxSinhLuc,
        linhLuc: entity.stats?.linhLuc !== undefined ? Math.min(entity.stats.linhLuc, baseStats.baseMaxLinhLuc) : baseStats.baseMaxLinhLuc,
        kinhNghiem: entity.stats?.kinhNghiem || 0
    };

    // NEW: Recalculate effective stats including equipment if data is available
    if ((entity as any).equippedItems) {
        const combinedInventory = [...kb.inventory, ...kb.npcInventory];
        entity.stats = calculateEffectiveStats(
            entity.stats as PlayerStats,
            (entity as any).equippedItems,
            combinedInventory
        );
    }
};

/**
 * Cập nhật chỉ số cho một thực thể (NPC hoặc Yêu Thú) dựa trên cảnh giới và thiên phú.
 * Thêm logic biến thiên và ảnh hưởng của Tu chất (Aptitude).
 */
export const updateEntityStatsFromRealmEnhanced = (
    entity: { 
        realm?: string; 
        stats?: Partial<PlayerStats>; 
        tuChat?: any;
        race?: string;
    },
    kb: KnowledgeBase
): void => {
    if (!kb.worldConfig?.isCultivationEnabled) {
        // FORCE 100/50 when cultivation is disabled but KEEP REALM
        entity.stats = {
            ...entity.stats,
            baseMaxSinhLuc: 100,
            baseMaxLinhLuc: 50,
            maxSinhLuc: 100,
            maxLinhLuc: 50,
            sucTanCong: Math.max(entity.stats?.sucTanCong ?? 10, 10),
            maxKinhNghiem: 100,
            sinhLuc: Math.min(entity.stats?.sinhLuc ?? 100, 100),
            linhLuc: Math.min(entity.stats?.linhLuc ?? 50, 50),
        };
        return;
    }

    if (!entity.realm) {
        if (!entity.stats || Object.keys(entity.stats).length === 0) {
            entity.stats = { ...DEFAULT_MORTAL_STATS };
        }
        return;
    }

    const base = calculateRealmBaseStats(
        entity.realm, 
        getRealmSystemByRace(kb, entity.race).majorRealms, 
        kb.currentRealmBaseStats, 
        getRealmSystemByRace(kb, entity.race).minorRealms
    );
    
    // Biến thiên ngẫu nhiên 5% để tạo sự khác biệt giữa các NPC
    const variance = 0.95 + Math.random() * 0.1; 

    const newStats: Partial<PlayerStats> = {
        ...entity.stats,
        baseMaxSinhLuc: Math.round(base.baseMaxSinhLuc * variance),
        baseMaxLinhLuc: Math.round(base.baseMaxLinhLuc * variance),
        baseSucTanCong: Math.round(base.baseSucTanCong * variance),
        baseMaxKinhNghiem: Math.round(base.baseMaxKinhNghiem * variance),
        maxSinhLuc: Math.round(base.baseMaxSinhLuc * variance),
        maxLinhLuc: Math.round(base.baseMaxLinhLuc * variance),
        sucTanCong: Math.round(base.baseSucTanCong * variance),
        maxKinhNghiem: Math.round(base.baseMaxKinhNghiem * variance),
    };

    // Sync current HP/MP
    newStats.sinhLuc = newStats.maxSinhLuc;
    newStats.linhLuc = newStats.maxLinhLuc;
    newStats.kinhNghiem = entity.stats?.kinhNghiem || 0;
    
    // For thọ nguyên, if not set, give a default based on realm?
    // For now keep existing or default to 120
    if (entity.stats?.thoNguyen === undefined) {
        newStats.thoNguyen = 120;
        newStats.maxThoNguyen = 120;
    } else {
        newStats.thoNguyen = entity.stats.thoNguyen;
        newStats.maxThoNguyen = entity.stats.maxThoNguyen || 120;
    }

    entity.stats = newStats as PlayerStats;

    // IMPORTANT: Recalculate effective stats including equipment if data is available
    if ((entity as any).equippedItems && (entity as any).inventory) {
        entity.stats = calculateEffectiveStats(
            entity.stats as PlayerStats,
            (entity as any).equippedItems,
            (entity as any).inventory
        );
    }
};

export interface LifespanDeductionResult {
    mcDied: boolean;
    deadNpcNames: string[];
    systemMessages: GameMessage[];
}

/**
 * Trừ thọ nguyên (stats.thoNguyen) của MC và tất cả NPC dựa trên số năm thời gian trôi qua.
 * Hỗ trợ số thập phân chính xác cho tất cả các đơn vị thời gian (phút, canh giờ, ngày, tháng, năm).
 * Nếu thọ nguyên của NPC hoặc MC giảm xuống dưới 1 (< 1 năm), đối tượng sẽ bị xác định là chết do tọa hóa.
 */
export const applyLifespanDeduction = (
    kb: KnowledgeBase,
    yearsPassed: number,
    turnNumber: number
): LifespanDeductionResult => {
    const deadNpcNames: string[] = [];
    let mcDied = false;
    const systemMessages: GameMessage[] = [];

    if (yearsPassed <= 0 || isNaN(yearsPassed)) {
        return { mcDied, deadNpcNames, systemMessages };
    }

    // Giữ độ chính xác đến 7 chữ số thập phân cho số năm trôi qua
    const actualDeduct = parseFloat(yearsPassed.toFixed(7));

    if (actualDeduct <= 0) {
        return { mcDied, deadNpcNames, systemMessages };
    }

    // 1. Trừ thọ nguyên Nhân Vật Chính (MC)
    if (kb.playerStats) {
        const currentThoNguyen = typeof kb.playerStats.thoNguyen === 'number'
            ? kb.playerStats.thoNguyen
            : (kb.playerStats.maxThoNguyen || 120);
        
        const newThoNguyen = Math.max(0, currentThoNguyen - actualDeduct);
        kb.playerStats.thoNguyen = parseFloat(newThoNguyen.toFixed(7));

        if (kb.playerStats.thoNguyen < 1) {
            kb.playerStats.isDead = true;
            kb.playerStats.thoNguyen = 0;
            kb.playerStats.sinhLuc = 0;
            mcDied = true;
            systemMessages.push({
                id: `mc-death-lifespan-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                type: 'system',
                content: `⚠️ CẢNH BÁO: Thọ nguyên của bạn (${kb.playerStats.thoNguyen} năm) đã cạn kiệt (dưới 1 năm)! Bạn đã tọa hóa qua đời do cạn kiệt thọ nguyên.`,
                timestamp: Date.now(),
                turnNumber
            });
        } else {
            systemMessages.push({
                id: `mc-lifespan-deduct-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                type: 'system',
                content: `⏳ [THỜI GIAN TRÔI QUA ${actualDeduct} NĂM]: Thọ nguyên MC giảm ${actualDeduct} năm (Còn lại: ${kb.playerStats.thoNguyen}/${kb.playerStats.maxThoNguyen || 120} năm).`,
                timestamp: Date.now(),
                turnNumber
            });
        }
    }

    // Helper trừ thọ nguyên cho danh sách thực thể NPC và lọc bỏ đối tượng đã tọa hóa (< 1)
    const deductEntityListLifespan = <T extends { name: string; isDead?: boolean; status?: string; stats?: Partial<PlayerStats> }>(
        list: T[] | undefined
    ): T[] => {
        if (!Array.isArray(list)) return [];
        return list.filter(entity => {
            if (entity.isDead || entity.status === 'Đã tử vong (Tọa hóa)' || entity.status === 'Tử vong' || entity.status === '[ĐÃ CHẾT]') {
                return false;
            }

            if (!entity.stats) return true;

            const currentNpcThoNguyen = typeof entity.stats.thoNguyen === 'number'
                ? entity.stats.thoNguyen
                : (entity.stats.maxThoNguyen || 120);

            const newNpcThoNguyen = Math.max(0, currentNpcThoNguyen - actualDeduct);
            entity.stats.thoNguyen = parseFloat(newNpcThoNguyen.toFixed(7));

            if (entity.stats.thoNguyen < 1) {
                deadNpcNames.push(entity.name);
                return false;
            }
            return true;
        });
    };

    // 2. Trừ thọ nguyên đồng bộ cho tất cả NPC, Đạo Lữ/Thê Thiếp, Nô Lệ, Tù Nhân, Đồng Hành & Sư Phụ
    if (Array.isArray(kb.discoveredNPCs)) {
        kb.discoveredNPCs = deductEntityListLifespan(kb.discoveredNPCs);
    }
    if (Array.isArray(kb.wives)) {
        kb.wives = deductEntityListLifespan(kb.wives);
    }
    if (Array.isArray(kb.slaves)) {
        kb.slaves = deductEntityListLifespan(kb.slaves);
    }
    if (Array.isArray(kb.prisoners)) {
        kb.prisoners = deductEntityListLifespan(kb.prisoners);
    }
    if (Array.isArray(kb.companions)) {
        kb.companions = deductEntityListLifespan(kb.companions);
    }
    if (kb.master && kb.master.stats) {
        const curTho = typeof kb.master.stats.thoNguyen === 'number' ? kb.master.stats.thoNguyen : (kb.master.stats.maxThoNguyen || 120);
        const newTho = Math.max(0, curTho - actualDeduct);
        kb.master.stats.thoNguyen = parseFloat(newTho.toFixed(7));
        if (kb.master.stats.thoNguyen < 1) {
            deadNpcNames.push(kb.master.name);
            kb.master = null;
        }
    }

    if (deadNpcNames.length > 0) {
        systemMessages.push({
            id: `npc-death-lifespan-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            type: 'system',
            content: `🪦 [TỌA HÓA CẠN THỌ NGUYÊN]: ${deadNpcNames.length} NPC đã qua đời do thọ nguyên cạn kiệt (< 1 năm): ${deadNpcNames.join(', ')}.`,
            timestamp: Date.now(),
            turnNumber
        });
    }

    return { mcDied, deadNpcNames, systemMessages };
};

/**
 * Audits and updates effective stats for entities in the knowledge base.
 * Supports selective auditing for performance optimization.
 * @param kb The knowledge base to audit
 * @param activeEntityIds Optional set of entity IDs to audit. If not provided, audits everyone (default behavior).
 */
export const auditAllEntitiesStats = (kb: KnowledgeBase, activeEntityIds?: Set<string>): KnowledgeBase => {
    const newKb = { ...kb };
    
    // Combined inventory for item resolution
    const combinedInventory = [...(newKb.inventory || []), ...(newKb.npcInventory || [])];
    
    // Optimize performance: use a map for O(1) item lookup during stats auditing
    const inventoryMap = new Map<string, Item>();
    combinedInventory.forEach(item => {
        if (item.id) inventoryMap.set(item.id, item);
    });

    // 1. Audit Player (Always audit player)
    newKb.playerStats = calculateEffectiveStats(
        newKb.playerStats,
        newKb.equippedItems,
        combinedInventory,
        inventoryMap
    );
    
    // Helper to audit a list of entities with selective filtering
    const auditList = (list: any[]) => {
        if (!list) return;
        list.forEach(entity => {
            // Audit if activeEntityIds is not defined (full audit) OR if entity is in the active list
            const shouldAudit = !activeEntityIds || (entity.id && activeEntityIds.has(entity.id));
            
            if (shouldAudit && entity.stats && entity.equippedItems) {
                entity.stats = calculateEffectiveStats(
                    entity.stats as PlayerStats,
                    entity.equippedItems,
                    combinedInventory,
                    inventoryMap
                );
            }
        });
    };
    
    // 2. Audit all entity lists
    auditList(newKb.discoveredNPCs);
    auditList(newKb.wives);
    auditList(newKb.slaves);
    auditList(newKb.prisoners);
    auditList(newKb.companions);
    auditList(newKb.discoveredYeuThu);
    if (newKb.master) auditList([newKb.master]);
    
    return newKb;
};

export const calculateEffectiveStats = (
    currentStats: PlayerStats, 
    equippedItemIds: Record<EquipmentSlotId, Item['id'] | null>,
    inventory: Item[],
    inventoryMap?: Map<string, Item>
): PlayerStats => {
    const baseSinhLuc = typeof currentStats.baseMaxSinhLuc === 'number' ? currentStats.baseMaxSinhLuc : (typeof currentStats.maxSinhLuc === 'number' ? currentStats.maxSinhLuc : 100);
    const baseLinhLuc = typeof currentStats.baseMaxLinhLuc === 'number' ? currentStats.baseMaxLinhLuc : (typeof currentStats.maxLinhLuc === 'number' ? currentStats.maxLinhLuc : 50);
    const baseTanCong = typeof currentStats.baseSucTanCong === 'number' ? currentStats.baseSucTanCong : (typeof currentStats.sucTanCong === 'number' ? currentStats.sucTanCong : 10);
    const basePhongNgu = typeof (currentStats as any).basePhongNgu === 'number' ? (currentStats as any).basePhongNgu : (typeof currentStats.phongNgu === 'number' ? currentStats.phongNgu : 0);
    const baseKinhNghiem = typeof currentStats.baseMaxKinhNghiem === 'number' ? currentStats.baseMaxKinhNghiem : (typeof currentStats.maxKinhNghiem === 'number' ? currentStats.maxKinhNghiem : 100);

    const effectiveStats: PlayerStats = {
        ...currentStats, 
        baseMaxSinhLuc: baseSinhLuc,
        baseMaxLinhLuc: baseLinhLuc,
        baseSucTanCong: baseTanCong,
        baseMaxKinhNghiem: baseKinhNghiem,
        maxSinhLuc: baseSinhLuc + (currentStats.permanentSinhLucBonus || 0),
        maxLinhLuc: baseLinhLuc,
        sucTanCong: baseTanCong,
        phongNgu: basePhongNgu,
        maxKinhNghiem: baseKinhNghiem,
        thoNguyen: typeof currentStats.thoNguyen === 'number' ? parseFloat(currentStats.thoNguyen.toFixed(7)) : 120,
        maxThoNguyen: typeof currentStats.maxThoNguyen === 'number' ? parseFloat(currentStats.maxThoNguyen.toFixed(7)) : 120,
    };

    const accumulatedPercentages: Record<string, number> = {
        maxSinhLuc: 0,
        maxLinhLuc: 0,
        sucTanCong: 0,
        phongNgu: 0,
        chimang: 0,
        hutmau: 0,
        mayman: 0,
        hoiphuc: 0
    };

    for (const slotId in equippedItemIds) {
        const itemId = equippedItemIds[slotId as EquipmentSlotId];
        if (itemId) {
            const equippedItem = inventoryMap ? inventoryMap.get(itemId) : inventory.find(item => item.id === itemId);
            if (equippedItem && equippedItem.category === GameTemplates.ItemCategory.EQUIPMENT) {
                const equipment = equippedItem as GameTemplates.EquipmentTemplate;
                if (equipment.statBonuses) { 
                    for (const statKey in equipment.statBonuses) {
                        const key = statKey as keyof typeof equipment.statBonuses; 
                        const bonusValue = equipment.statBonuses[key];
                        let normalizedKey = key.toLowerCase();
                        if (['maxsinhluc', 'sinhluc', 'máu', 'hp', 'health', 'sinh lực'].includes(normalizedKey)) normalizedKey = 'maxSinhLuc';
                        else if (['maxlinhluc', 'linhluc', 'mana', 'mp', 'năng lượng', 'linh lực'].includes(normalizedKey)) normalizedKey = 'maxLinhLuc';
                        else if (['suctancong', 'công', 'tấn công', 'công kích', 'atk', 'attack', 'sức mạnh', 'sát thương'].includes(normalizedKey)) normalizedKey = 'sucTanCong';
                        else if (['phongngu', 'thủ', 'phòng ngự', 'phòng thủ', 'def', 'defense', 'giáp', 'armor'].includes(normalizedKey)) normalizedKey = 'phongNgu';
                        else if (['maxkinhnghiem', 'exp', 'kinh nghiệm', 'kinhnghiem'].includes(normalizedKey)) normalizedKey = 'maxKinhNghiem';
                        else if (['thonguyen', 'tuổi thọ', 'tuoitho'].includes(normalizedKey)) normalizedKey = 'maxThoNguyen';
                        
                        if (typeof bonusValue === 'number') {
                            if (normalizedKey === 'maxSinhLuc') effectiveStats.maxSinhLuc += bonusValue;
                            else if (normalizedKey === 'maxLinhLuc') effectiveStats.maxLinhLuc += bonusValue;
                            else if (normalizedKey === 'sucTanCong') effectiveStats.sucTanCong += bonusValue;
                            else if (normalizedKey === 'phongNgu') effectiveStats.phongNgu += bonusValue;
                            else if (normalizedKey === 'maxKinhNghiem') effectiveStats.maxKinhNghiem += bonusValue;
                            // mapping thoNguyen to maxThoNguyen for simplicity if it comes from equipment
                            else if (normalizedKey === 'maxThoNguyen') effectiveStats.maxThoNguyen += bonusValue;
                        }
                    }
                }
                
                // Add % bonus stats from bonusPercentageStats
                if (equipment.bonusPercentageStats) {
                    for (const statKey in equipment.bonusPercentageStats) {
                        const key = statKey as string;
                        const bonusValue = equipment.bonusPercentageStats[key];
                        let normalizedKey = key.toLowerCase();
                        if (['maxsinhluc', 'sinhluc', 'máu', 'hp', 'health', 'sinh lực'].includes(normalizedKey)) normalizedKey = 'maxSinhLuc';
                        else if (['maxlinhluc', 'linhluc', 'mana', 'mp', 'năng lượng', 'linh lực'].includes(normalizedKey)) normalizedKey = 'maxLinhLuc';
                        else if (['suctancong', 'công', 'tấn công', 'công kích', 'atk', 'attack', 'sức mạnh', 'sát thương'].includes(normalizedKey)) normalizedKey = 'sucTanCong';
                        else if (['phongngu', 'thủ', 'phòng ngự', 'phòng thủ', 'def', 'defense', 'giáp', 'armor'].includes(normalizedKey)) normalizedKey = 'phongNgu';
                        else if (['chimang', 'chí mạng', 'crit', 'critical'].includes(normalizedKey)) normalizedKey = 'chimang';
                        else if (['hutmau', 'hút máu', 'lifesteal'].includes(normalizedKey)) normalizedKey = 'hutmau';
                        else if (['mayman', 'may mắn', 'luck', 'mayman'].includes(normalizedKey)) normalizedKey = 'mayman';
                        else if (['hoiphuc', 'hồi phục', 'regen', 'regeneration'].includes(normalizedKey)) normalizedKey = 'hoiphuc';
                        
                        if (typeof bonusValue === 'number' && typeof accumulatedPercentages[normalizedKey] === 'number') {
                            accumulatedPercentages[normalizedKey] += bonusValue;
                        }
                    }
                }
            }
        }
    }

    // Apply accumulated percentages before status effects
    if (accumulatedPercentages.maxSinhLuc > 0) effectiveStats.maxSinhLuc *= (1 + accumulatedPercentages.maxSinhLuc / 100);
    if (accumulatedPercentages.maxLinhLuc > 0) effectiveStats.maxLinhLuc *= (1 + accumulatedPercentages.maxLinhLuc / 100);
    if (accumulatedPercentages.sucTanCong > 0) effectiveStats.sucTanCong *= (1 + accumulatedPercentages.sucTanCong / 100);
    if (accumulatedPercentages.phongNgu > 0) effectiveStats.phongNgu *= (1 + accumulatedPercentages.phongNgu / 100);

    if (currentStats.activeStatusEffects && currentStats.activeStatusEffects.length > 0) {
        currentStats.activeStatusEffects.forEach(effect => {
            for (const statKey in effect.statModifiers) {
                const key = statKey as string;
                let normalizedKey = key.toLowerCase();
                if (['maxsinhluc', 'sinhluc', 'máu', 'hp', 'health', 'sinh lực'].includes(normalizedKey)) normalizedKey = 'maxSinhLuc';
                else if (['maxlinhluc', 'linhluc', 'mana', 'mp', 'năng lượng', 'linh lực'].includes(normalizedKey)) normalizedKey = 'maxLinhLuc';
                else if (['suctancong', 'công', 'tấn công', 'công kích', 'atk', 'attack', 'sức mạnh', 'sát thương'].includes(normalizedKey)) normalizedKey = 'sucTanCong';
                else if (['phongngu', 'thủ', 'phòng ngự', 'phòng thủ', 'def', 'defense', 'giáp', 'armor'].includes(normalizedKey)) normalizedKey = 'phongNgu';
                else if (['maxkinhnghiem', 'exp', 'kinh nghiệm', 'kinhnghiem'].includes(normalizedKey)) normalizedKey = 'maxKinhNghiem';
                else if (['thonguyen', 'tuổi thọ', 'tuoitho'].includes(normalizedKey)) normalizedKey = 'maxThoNguyen';
                
                const validKey = normalizedKey as keyof PlayerStats;
                const modValue = effect.statModifiers[key as keyof typeof effect.statModifiers];

                if (typeof modValue === 'string') {
                    if (modValue.endsWith('%')) {
                        const percentage = parseFloat(modValue.slice(0, -1)) / 100;
                        if (!isNaN(percentage) && typeof effectiveStats[validKey] === 'number') {
                            (effectiveStats[validKey] as number) *= (1 + percentage);
                        }
                    } else {
                        const flatChange = parseInt(modValue, 10);
                        if (!isNaN(flatChange) && typeof effectiveStats[validKey] === 'number') {
                           (effectiveStats[validKey] as number) += flatChange;
                        }
                    }
                } else if (typeof modValue === 'number') {
                    if (typeof effectiveStats[validKey] === 'number') {
                        (effectiveStats[validKey] as number) += modValue;
                    }
                }
            }
        });
    }
    
    effectiveStats.maxSinhLuc = Math.round(effectiveStats.maxSinhLuc);
    effectiveStats.maxLinhLuc = Math.round(effectiveStats.maxLinhLuc);
    effectiveStats.sucTanCong = Math.round(effectiveStats.sucTanCong);
    effectiveStats.phongNgu = Math.round(effectiveStats.phongNgu || 0);
    effectiveStats.maxKinhNghiem = Math.round(effectiveStats.maxKinhNghiem);
    effectiveStats.thoNguyen = typeof effectiveStats.thoNguyen === 'number' ? parseFloat(effectiveStats.thoNguyen.toFixed(7)) : 120;
    effectiveStats.maxThoNguyen = typeof effectiveStats.maxThoNguyen === 'number' ? parseFloat(effectiveStats.maxThoNguyen.toFixed(7)) : 120;


    effectiveStats.sinhLuc = Math.max(0, Math.min(effectiveStats.sinhLuc, effectiveStats.maxSinhLuc));
    effectiveStats.linhLuc = Math.max(0, Math.min(effectiveStats.linhLuc, effectiveStats.maxLinhLuc));
    effectiveStats.kinhNghiem = Math.max(0, effectiveStats.kinhNghiem); 
    effectiveStats.thoNguyen = Math.max(0, Math.min(effectiveStats.thoNguyen, effectiveStats.maxThoNguyen));
    effectiveStats.thoNguyen = parseFloat(effectiveStats.thoNguyen.toFixed(7));
    
    effectiveStats.maxSinhLuc = Math.max(10, effectiveStats.maxSinhLuc);
    effectiveStats.maxLinhLuc = Math.max(0, effectiveStats.maxLinhLuc); 
    effectiveStats.sucTanCong = Math.max(1, effectiveStats.sucTanCong);
    effectiveStats.phongNgu = Math.max(0, effectiveStats.phongNgu);
    effectiveStats.maxKinhNghiem = effectiveStats.baseMaxKinhNghiem > 0 ? Math.max(10, effectiveStats.maxKinhNghiem) : Math.max(0, effectiveStats.maxKinhNghiem);

    // NEW: Parse and add passive effects from equipment
    effectiveStats.equipmentPassives = parseEquipmentEffects(inventory, equippedItemIds, inventoryMap);

    // Merge accumulated percentages into passives if they are not already there
    if (accumulatedPercentages.chimang > 0) effectiveStats.equipmentPassives['chí mạng'] = (effectiveStats.equipmentPassives['chí mạng'] || 0) + accumulatedPercentages.chimang;
    if (accumulatedPercentages.hutmau > 0) effectiveStats.equipmentPassives['hút máu'] = (effectiveStats.equipmentPassives['hút máu'] || 0) + accumulatedPercentages.hutmau;
    if (accumulatedPercentages.mayman > 0) effectiveStats.equipmentPassives['may mắn'] = (effectiveStats.equipmentPassives['may mắn'] || 0) + accumulatedPercentages.mayman;
    if (accumulatedPercentages.hoiphuc > 0) effectiveStats.equipmentPassives['hồi phục'] = (effectiveStats.equipmentPassives['hồi phục'] || 0) + accumulatedPercentages.hoiphuc;

    return effectiveStats;
};

// New function to handle all level-up logic
export const handleLevelUps = (currentKb: KnowledgeBase): { updatedKb: KnowledgeBase; systemMessages: GameMessage[] } => {
    const newKb = currentKb;
    const systemMessages: GameMessage[] = [];
    const turnNumber = newKb.playerStats.turn;

    if (!newKb.worldConfig?.isCultivationEnabled) {
        return { updatedKb: newKb, systemMessages };
    }

    // Determine correct realm progression for the player
    const realmSystem = getEffectiveRealmSystem(newKb);
    const realmProgressionList = realmSystem.majorRealms;
    const subRealms = realmSystem.minorRealms;

    let hasLeveledUpInLoop = true;
    while (hasLeveledUpInLoop) {
        hasLeveledUpInLoop = false;

        if (newKb.playerStats.kinhNghiem < newKb.playerStats.maxKinhNghiem) {
            break;
        }

        const realmBefore = newKb.playerStats.realm;
        
        let currentMainRealmName = "";
        let currentSubRealmName = "";

        const sortedMainRealms = [...realmProgressionList].sort((a, b) => b.length - a.length);
        for (const r of sortedMainRealms) {
            if (realmBefore.startsWith(r)) {
                currentMainRealmName = r;
                currentSubRealmName = realmBefore.substring(r.length).trim();
                break;
            }
        }

        if (!currentMainRealmName || !subRealms.includes(currentSubRealmName as any)) {
            break;
        }

        const currentSubRealmIndex = subRealms.indexOf(currentSubRealmName as any);
        const isAtPeakSubRealm = currentSubRealmIndex === subRealms.length - 1;

        if (isAtPeakSubRealm) {
            newKb.playerStats.hieuUngBinhCanh = true;
            newKb.playerStats.kinhNghiem = newKb.playerStats.maxKinhNghiem;
            systemMessages.push({
                id: 'binh-canh-applied-client-' + Date.now(), type: 'system',
                content: `Bạn đã đạt đến ${newKb.playerStats.realm}! 🏮Bạn đã đến bình cảnh, mời vào giao diện tu luyện để độ kiếp🏮`,
                timestamp: Date.now(), turnNumber: turnNumber
            });
            break;
        } else {
            newKb.playerStats.kinhNghiem -= newKb.playerStats.maxKinhNghiem;
            const nextRealmString = `${currentMainRealmName} ${subRealms[currentSubRealmIndex + 1]}`;
            newKb.playerStats.realm = nextRealmString;
            
            const newBaseStats = calculateRealmBaseStats(newKb.playerStats.realm, newKb);
            newKb.playerStats = { ...newKb.playerStats, ...newBaseStats };

            // Re-calculate effective stats including equipment and permanent bonuses
            newKb.playerStats = calculateEffectiveStats(newKb.playerStats, newKb.equippedItems, newKb.inventory);

            newKb.playerStats.sinhLuc = newKb.playerStats.maxSinhLuc;
            newKb.playerStats.linhLuc = newKb.playerStats.maxLinhLuc;

            systemMessages.push({
                id: `sublevel-up-${Date.now()}`, type: 'system',
                content: `Chúc mừng ${newKb.worldConfig?.playerName || 'bạn'} đã đột phá tiểu cảnh giới, từ ${realmBefore} lên ${newKb.playerStats.realm}!`,
                timestamp: Date.now(), turnNumber: turnNumber
            });
            hasLeveledUpInLoop = true;
        }
    }

    newKb.playerStats = calculateEffectiveStats(newKb.playerStats, newKb.equippedItems, newKb.inventory);
    return { updatedKb: newKb, systemMessages };
};

/**
 * Calculates the world base realm based on turns passed.
 * Progresses 1 sub-realm every 10 turns.
 */
export const calculateWorldRealmBase = (
    startRealm: string,
    currentTurn: number,
    realmProgressionList: string[],
    minorRealmProgressionList?: string[]
): string => {
    if (!startRealm || realmProgressionList.length === 0) return startRealm;

    const subRealms = minorRealmProgressionList || SUB_REALM_NAMES;

    // 1. Find initial indices
    let mainIndex = -1;
    let subIndex = -1;
    const sortedMainRealms = [...realmProgressionList].sort((a, b) => b.length - a.length);
    
    for (const r of sortedMainRealms) {
        if (startRealm.startsWith(r)) {
            mainIndex = realmProgressionList.indexOf(r);
            const subStr = startRealm.substring(r.length).trim();
            subIndex = subRealms.indexOf(subStr as any);
            if (subIndex === -1) subIndex = 0;
            break;
        }
    }

    if (mainIndex === -1) return startRealm;

    // 2. Calculate advancement
    const totalStepsToAdvance = Math.floor(currentTurn / 10);
    const stepsPerMajor = subRealms.length;
    const totalInitialSteps = (mainIndex * stepsPerMajor) + subIndex;
    const currentTotalSteps = totalInitialSteps + totalStepsToAdvance;

    // 3. Map back to realm string
    const currentMainIndex = Math.min(Math.floor(currentTotalSteps / stepsPerMajor), realmProgressionList.length - 1);
    const currentSubIndex = currentMainIndex === realmProgressionList.length - 1 
        ? Math.min(currentTotalSteps % stepsPerMajor, subRealms.length - 1) 
        : (currentTotalSteps % stepsPerMajor);

    return `${realmProgressionList[currentMainIndex]} ${subRealms[currentSubIndex]}`;
};

/**
 * Calculates the base value of a realm based on its position in the progression list.
 * Uses a formula with a decaying multiplier for exponential but controlled growth.
 * @param realmIndex The index of the realm in the `realmProgressionList`. -1 for mortal realm.
 * @returns The calculated base value for the realm.
 */
const calculateRealmValueByIndex = (realmIndex: number): number => {
    if (realmIndex < 0) {
        return MORTAL_REALM_BASE_VALUE;
    }
    if (realmIndex === 0) {
        return FIRST_CULTIVATION_REALM_BASE_VALUE;
    }

    let value = FIRST_CULTIVATION_REALM_BASE_VALUE;
    // Loop from the second realm (index 1) up to the target realm index
    for (let i = 1; i <= realmIndex; i++) {
        const multiplier = Math.max(REALM_MULTIPLIER_MIN, REALM_MULTIPLIER_BASE - (REALM_MULTIPLIER_DECAY * (i - 1)));
        value *= multiplier;
    }
    
    return Math.floor(value);
};

/**
 * Calculates the systemic value of an item based on its properties.
 * This overrides any value provided by the AI to ensure economic consistency.
 * @param item The item to be valued.
 * @param realmProgressionList The ordered list of main realms in the game.
 * @returns The calculated value of the item.
 */
/**
 * Calculates the systemic value of an item based purely on its Realm (majorIndex, minorIndex).
 * Excludes all secondary factors (rarity, stat bonuses, category multipliers, unique effects) as requested.
 * @param item The item to be valued.
 * @param realmProgressionListOrKb The ordered list of main realms or KnowledgeBase.
 * @returns The calculated value of the item.
 */
export const calculateItemValue = (item: Item, realmProgressionListOrKb?: string[] | KnowledgeBase): number => {
    return calculateMechanicalItemPrice(item, realmProgressionListOrKb);
};

/**
 * Calculates the systemic value of a slave based purely on their Realm (majorIndex, minorIndex).
 * Excludes all secondary factors (tuChat, spiritualRoot, specialPhysique) as requested.
 * @param slave The slave object to be valued.
 * @param kbOrProgression The KnowledgeBase object or realm progression array.
 * @returns The calculated value of the slave.
 */
export const calculateSlaveValue = (slave: Slave, kbOrProgression: KnowledgeBase | string[]): number => {
    if (!slave || !slave.realm) return 500; // Base value for a mortal/unranked slave

    let system: any;
    if (Array.isArray(kbOrProgression)) {
        system = { majorRealms: kbOrProgression, minorRealms: SUB_REALM_NAMES };
    } else if (kbOrProgression && typeof kbOrProgression === 'object') {
        system = getRealmSystemByRace(kbOrProgression, slave.race);
    } else {
        system = { majorRealms: [], minorRealms: SUB_REALM_NAMES };
    }

    const { majorIndex, minorIndex } = parseRealm(slave.realm, system);

    // 1. Find base value from realm tier
    let baseValue = majorIndex > -1 ? (AUCTION_NPC_CURRENCY_BY_REALM_TIER[majorIndex] || 500) : 500;

    // 2. Apply sub-realm modifier
    if (minorIndex > -1) {
        const subRealmMultiplier = 1.0 + (0.5 + (0.05 * minorIndex));
        baseValue *= subRealmMultiplier;
    }

    return Math.max(100, Math.round(baseValue)); // Ensure value is at least 100
};

// FIX: Add and export calculatePrisonerValue function
/**
 * Calculates the systemic value of a prisoner based purely on their Realm (majorIndex, minorIndex).
 * Excludes all secondary factors (willpower, resistance, tuChat, spiritualRoot, specialPhysique) as requested.
 * @param prisoner The prisoner object to be valued.
 * @param kbOrProgression The KnowledgeBase object or realm progression array.
 * @returns The calculated value of the prisoner.
 */
export const calculatePrisonerValue = (prisoner: Prisoner, kbOrProgression: KnowledgeBase | string[]): number => {
    if (!prisoner || !prisoner.realm) return 300; // Base value for a mortal/unranked prisoner

    let system: any;
    if (Array.isArray(kbOrProgression)) {
        system = { majorRealms: kbOrProgression, minorRealms: SUB_REALM_NAMES };
    } else if (kbOrProgression && typeof kbOrProgression === 'object') {
        system = getRealmSystemByRace(kbOrProgression, prisoner.race);
    } else {
        system = { majorRealms: [], minorRealms: SUB_REALM_NAMES };
    }

    const { majorIndex, minorIndex } = parseRealm(prisoner.realm, system);

    // 1. Find base value from realm tier
    let baseValue = majorIndex > -1 ? (AUCTION_NPC_CURRENCY_BY_REALM_TIER[majorIndex] || 300) : 300;

    // 2. Apply sub-realm modifier
    if (minorIndex > -1) {
        const subRealmMultiplier = 1.0 + (0.5 + (0.05 * minorIndex));
        baseValue *= subRealmMultiplier;
    }

    return Math.max(50, Math.round(baseValue)); // Ensure value is at least 50
};

/**
 * Giải thích chi tiết công thức tính sinh lực (HP) tối đa.
 */
export const getHpFormulaExplanation = (
    currentStats: PlayerStats,
    equippedItemIds?: Record<EquipmentSlotId, Item['id'] | null>,
    inventory?: Item[],
    kb?: KnowledgeBase
): { formulaText: string; breakdownText: string; steps: string[] } => {
    const baseSinhLuc = typeof currentStats.baseMaxSinhLuc === 'number' ? currentStats.baseMaxSinhLuc : (typeof currentStats.maxSinhLuc === 'number' ? currentStats.maxSinhLuc : 100);
    const permanentSinhLucBonus = currentStats.permanentSinhLucBonus || 0;
    
    let flatEquipmentBonus = 0;
    let pctEquipmentBonus = 0;
    
    if (equippedItemIds && inventory) {
        for (const slotId in equippedItemIds) {
            const itemId = equippedItemIds[slotId as EquipmentSlotId];
            if (itemId) {
                const equippedItem = inventory.find(item => item.id === itemId);
                if (equippedItem && equippedItem.category === 'Equipment') {
                    const equipment = equippedItem as any;
                    if (equipment.statBonuses) {
                        for (const statKey in equipment.statBonuses) {
                            const bonusValue = equipment.statBonuses[statKey];
                            let normalizedKey = statKey.toLowerCase();
                            if (['maxsinhluc', 'sinhluc', 'máu', 'hp', 'health', 'sinh lực'].includes(normalizedKey)) {
                                if (typeof bonusValue === 'number') {
                                    flatEquipmentBonus += bonusValue;
                                }
                            }
                        }
                    }
                    if (equipment.bonusPercentageStats) {
                        for (const statKey in equipment.bonusPercentageStats) {
                            const bonusValue = equipment.bonusPercentageStats[statKey];
                            let normalizedKey = statKey.toLowerCase();
                            if (['maxsinhluc', 'sinhluc', 'máu', 'hp', 'health', 'sinh lực'].includes(normalizedKey)) {
                                if (typeof bonusValue === 'number') {
                                    pctEquipmentBonus += bonusValue;
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    const steps: string[] = [];
    
    // 1. Realm Base
    let realmBaseHp = 0;
    let variance = 1.0;
    
    if (currentStats.realm && kb) {
        try {
            const { majorRealms, minorRealms } = getEffectiveRealmSystem(kb);
            const baseResult = calculateRealmBaseStats(
                currentStats.realm, 
                majorRealms, 
                kb.currentRealmBaseStats, 
                minorRealms
            );
            if (baseResult && baseResult.baseMaxSinhLuc) {
                realmBaseHp = baseResult.baseMaxSinhLuc;
            }
        } catch (e) {
            // fallback
        }
    }
    
    if (realmBaseHp > 0) {
        const expectedBase = realmBaseHp;
        if (expectedBase > 0) {
            variance = Math.round((baseSinhLuc / expectedBase) * 100) / 100;
        }
        steps.push(`Máu Cảnh Giới: ${realmBaseHp} HP`);
        if (variance !== 1.0) {
            steps.push(`Biến thiên: x${variance}`);
        }
        steps.push(`Máu cơ bản: ${baseSinhLuc} HP [= Tròn(${realmBaseHp}${variance !== 1.0 ? ` * ${variance}` : ''})]`);
    } else {
        steps.push(`Máu cơ bản: ${baseSinhLuc} HP`);
    }
    
    if (permanentSinhLucBonus > 0) {
        steps.push(`Thọ Nguyên/Lôi Kiếp cộng vĩnh viễn: +${permanentSinhLucBonus} HP`);
    }
    
    if (flatEquipmentBonus > 0) {
        steps.push(`Trang bị phẳng: +${flatEquipmentBonus} HP`);
    }
    
    if (pctEquipmentBonus > 0) {
        steps.push(`Trang bị phần trăm: +${pctEquipmentBonus}% HP`);
    }
    
    const baseAndFlat = baseSinhLuc + permanentSinhLucBonus + flatEquipmentBonus;
    const finalHp = Math.round(baseAndFlat * (1 + pctEquipmentBonus / 100));
    
    let formulaText = "";
    if (flatEquipmentBonus > 0 || pctEquipmentBonus > 0 || permanentSinhLucBonus > 0) {
        formulaText = `${finalHp} = (${baseSinhLuc}${permanentSinhLucBonus > 0 ? ` + ${permanentSinhLucBonus}` : ''}${flatEquipmentBonus > 0 ? ` + ${flatEquipmentBonus}` : ''})${pctEquipmentBonus > 0 ? ` * (1 + ${pctEquipmentBonus}%)` : ''}`;
    } else {
        formulaText = `${finalHp} = Máu cơ bản (${baseSinhLuc})`;
    }
    
    const breakdownText = steps.join(' ➔ ');
    
    return {
        formulaText,
        breakdownText,
        steps
    };
};


