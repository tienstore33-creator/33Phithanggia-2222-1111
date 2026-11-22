import { KnowledgeBase, NPC, PlayerStats } from "../types";
import { resolveDynamicLevel } from "./levelUtils";
import { realmManager, getEffectiveRealmSystem } from "../services/realmManager";
import { calculateRealmBaseStats, calculateEffectiveStats } from "./statsCalculationUtils";

const TALENT_MODIFIERS: Record<string, number> = {
    "Phế Phẩm": 0.5,
    "Phế Vật": 0.5,
    "Hạ Phẩm": 1.0,
    "Bình Thường": 1.0,
    "Trung Phẩm": 1.2,
    "Thượng Phẩm": 1.5,
    "Cực Phẩm": 2.0,
    "Thiên Tài": 2.0,
    "Tiên Phẩm": 2.5,
    "Thần Phẩm": 3.0,
    "Yêu Nghiệt": 3.0,
};

const getTalentModifier = (tuChat?: string): number => {
    if (!tuChat) return 1.0;
    const lowerTuChat = tuChat.toLowerCase();
    for (const [key, value] of Object.entries(TALENT_MODIFIERS)) {
        if (lowerTuChat.includes(key.toLowerCase())) return value;
    }
    return 1.0;
};

const getRealmModifier = (realm?: string, majorRealmsConfig?: any[]): number => {
    if (!realm || typeof realm !== 'string' || !majorRealmsConfig || !Array.isArray(majorRealmsConfig) || majorRealmsConfig.length === 0) return 1.0;
    const lowerRealm = realm.toLowerCase();
    let majorIndex = majorRealmsConfig.findIndex(r => {
        const namePart = (typeof r === 'string') ? r : (r && typeof r === 'object' && 'name' in r ? r.name : "");
        return namePart && lowerRealm.includes(namePart.toLowerCase());
    });
    if (majorIndex === -1) majorIndex = 0;
    return Math.pow(0.9, majorIndex);
};

// Function to handle passive experience gain for all NPCs (companions, scattered, etc.)
export const grantPassiveExp = (kb: KnowledgeBase, turnDelta: number, daysDelta: number): { updatedKb: KnowledgeBase; systemMessages: any[] } => {
    const updatedKb = JSON.parse(JSON.stringify(kb)) as KnowledgeBase;
    const systemMessages: any[] = [];
    
    if (!updatedKb.worldConfig?.isCultivationEnabled || (turnDelta === 0 && daysDelta === 0)) {
        return { updatedKb, systemMessages };
    }

    const totalPercent = (turnDelta * 2) + (daysDelta * 0.1);
    if (totalPercent <= 0) return { updatedKb, systemMessages };

    const realmSystem = getEffectiveRealmSystem(updatedKb);
    const majorRealms = realmSystem.majorRealms;

    const processProgression = (entities: any[], collectionName: string) => {
        if (!entities || !Array.isArray(entities)) return;
        entities.forEach(entity => {
            if (!entity.stats) entity.stats = {};
            if (typeof entity.stats.kinhNghiem !== 'number') entity.stats.kinhNghiem = 0;
            if (typeof entity.stats.maxKinhNghiem !== 'number') entity.stats.maxKinhNghiem = 100; // default generic fallback

            const talentMod = getTalentModifier(entity.tuChat);
            const realmMod = getRealmModifier(entity.realm, majorRealms);
            
            const finalPercent = totalPercent * talentMod * realmMod;
            const expGained = Math.floor(entity.stats.maxKinhNghiem * (finalPercent / 100));

            if (expGained > 0) {
                entity.stats.kinhNghiem += expGained;
                checkAndProcessLevelUp(entity, updatedKb, systemMessages);
            }
        });
    };

    processProgression(updatedKb.discoveredNPCs, "NPCs");
    processProgression(updatedKb.companions, "Companions");
    processProgression(updatedKb.wives, "Wives");
    processProgression(updatedKb.slaves, "Slaves");
    processProgression(updatedKb.prisoners, "Prisoners");
    
    return { updatedKb, systemMessages };
};

// Function to handle combat experience for NPCs based on enemy max HP
export const grantCombatExp = (kb: KnowledgeBase, enemies: any[], allies: any[]): { updatedKb: KnowledgeBase; systemMessages: any[] } => {
    const updatedKb = JSON.parse(JSON.stringify(kb)) as KnowledgeBase;
    const systemMessages: any[] = [];
    
    if (!updatedKb.worldConfig?.isCultivationEnabled || !enemies || enemies.length === 0 || !allies || allies.length === 0) {
        return { updatedKb, systemMessages };
    }

    let totalEnemyHp = 0;
    enemies.forEach(enemy => {
        totalEnemyHp += enemy.maxHp || 10;
    });

    const expPerAlly = Math.floor(totalEnemyHp * 0.1); 
    if (expPerAlly <= 0) return { updatedKb, systemMessages };

    const processProgression = (entities: any[]) => {
        if (!entities || !Array.isArray(entities)) return;
        entities.forEach(entity => {
            // Check if this entity was in the battle as an ally
            const wasInBattle = allies.some(ally => ally.id === entity.id || ally.name === entity.name);
            if (wasInBattle) {
                if (!entity.stats) entity.stats = {};
                if (typeof entity.stats.kinhNghiem !== 'number') entity.stats.kinhNghiem = 0;
                
                entity.stats.kinhNghiem += expPerAlly;
                checkAndProcessLevelUp(entity, updatedKb, systemMessages);
            }
        });
    };

    processProgression(updatedKb.discoveredNPCs);
    processProgression(updatedKb.companions);
    processProgression(updatedKb.wives);
    processProgression(updatedKb.slaves);
    processProgression(updatedKb.prisoners);

    return { updatedKb, systemMessages };
};

// Internal function to check level up logic
const checkAndProcessLevelUp = (entity: any, kb: KnowledgeBase, systemMessages: any[]) => {
    if (!entity.stats || !entity.stats.maxKinhNghiem) return;

    let leveledUp = false;
    let newRealm = entity.realm;

    while (entity.stats.maxKinhNghiem > 0 && entity.stats.kinhNghiem >= entity.stats.maxKinhNghiem) {
        entity.stats.kinhNghiem -= entity.stats.maxKinhNghiem;
        newRealm = realmManager.advanceRealm(newRealm || kb.worldRealmBase || "Phàm Nhân Nhất Trọng", 1, kb);
        leveledUp = true;
        
        // Temporarily recalculate maxKinhNghiem so the loop works correctly across multiple levels
        const realmSystem = getEffectiveRealmSystem(kb);
        const baseStats = calculateRealmBaseStats(
            newRealm,
            realmSystem.majorRealms,
            kb.currentRealmBaseStats,
            realmSystem.minorRealms
        );
        entity.stats.maxKinhNghiem = baseStats.baseMaxKinhNghiem || 100;
    }

    if (leveledUp && newRealm !== entity.realm) {
        entity.realm = newRealm;
        
        const realmSystem = getEffectiveRealmSystem(kb);
        const baseStats = calculateRealmBaseStats(
            entity.realm,
            realmSystem.majorRealms,
            kb.currentRealmBaseStats,
            realmSystem.minorRealms
        );

        entity.stats = {
            ...entity.stats,
            ...baseStats,
            maxSinhLuc: baseStats.baseMaxSinhLuc,
            maxLinhLuc: baseStats.baseMaxLinhLuc,
            sucTanCong: baseStats.baseSucTanCong,
            maxKinhNghiem: baseStats.baseMaxKinhNghiem,
        };

        // NEW: Recalculate effective stats including equipment
        if (entity.equippedItems && entity.inventory) {
            entity.stats = calculateEffectiveStats(
                entity.stats as PlayerStats,
                entity.equippedItems,
                entity.inventory
            );
        }

        // Option to heal them on level up
        entity.stats.sinhLuc = entity.stats.maxSinhLuc;
        entity.stats.linhLuc = entity.stats.maxLinhLuc;

        systemMessages.push({
            id: `npc-levelup-${entity.id || entity.name}-${Date.now()}`,
            type: 'system',
            content: `${entity.name} đã tu luyện và đột phá lên ${newRealm}!`,
            timestamp: Date.now(),
            turnNumber: kb.playerStats.turn
        });
    }
};
