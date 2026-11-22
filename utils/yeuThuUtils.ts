
import { KnowledgeBase, YeuThu, PlayerStats } from '../types';
import { YEU_THU_TIERED_DATABASE, YeuThuDataEntry } from '../database/yeuThuTieredData';
import { calculateRealmBaseStats, updateEntityStatsFromRealm } from './statsCalculationUtils';
import { DEFAULT_MORTAL_STATS } from '../constants';
import { getEffectiveRealmSystem, getRealmSystemByRace } from '../services/realmManager';
import { parseRealm } from './realmUtils';
import * as GameTemplates from '../templates';

/**
 * Selects a few relevant YeuThu from the database based on location.
 */
export const getRelevantYeuThuForLocation = (
    locationType: string | undefined
): YeuThuDataEntry[] => {
    let relevantTypes: string[] = [];
    
    switch (locationType) {
        case GameTemplates.LocationType.FOREST:
            relevantTypes = ["Forest", "Mountain"];
            break;
        case GameTemplates.LocationType.MOUNTAIN:
            relevantTypes = ["Mountain", "Cave", "Sky"];
            break;
        case GameTemplates.LocationType.RIVER_LAKE:
            relevantTypes = ["Water", "Swamp"];
            break;
        case GameTemplates.LocationType.CAVE:
        case GameTemplates.LocationType.DUNGEON:
            relevantTypes = ["Cave", "Mountain", "Void"];
            break;
        case GameTemplates.LocationType.CAPITAL:
        case GameTemplates.LocationType.CITY:
            relevantTypes = ["Capital", "Palace"];
            break;
        default:
            relevantTypes = ["Forest", "Mountain"];
    }

    // Filter candidates
    const candidates = YEU_THU_TIERED_DATABASE.filter(yt => 
        yt.environments.some(env => relevantTypes.includes(env))
    );
    
    // Shuffle and pick 5
    const shuffled = [...candidates].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, 5);
};

/**
 * THE SECRETARY: Generates a full YeuThu object from DB with calculated stats.
 * NEW: Includes logic to scale the beast realm based on the player's realm.
 */
export const generateYeuThuFromDB = (
    name: string,
    kb: KnowledgeBase,
    context?: { groupSize?: number }
): YeuThu | null => {
    const dbEntry = YEU_THU_TIERED_DATABASE.find(
        entry => entry.name.toLowerCase() === name.toLowerCase()
    );

    if (!dbEntry) return null;

    const groupSize = context?.groupSize || 1;
    let rank = dbEntry.rank;
    let realm = "Yêu Quái"; // Default realm name if not cultivation
    let stats: Partial<PlayerStats> = { ...DEFAULT_MORTAL_STATS };

    if (kb.worldConfig?.isCultivationEnabled) {
        const yeuThuSystem = getRealmSystemByRace(kb, 'Yêu Thú');
        const playerSystem = getEffectiveRealmSystem(kb);
        
        // --- NEW SCALE LOGIC (Sub-realm based) START ---

        // 1. Get Base Realm details (major and sub-realm indices)
        const worldBase = kb.worldRealmBase || (kb.worldConfig?.canhGioiKhoiDau) || "Phàm Nhân Nhất Trọng";
        const { majorIndex: baseMajorRealmIndex, minorIndex: baseSubRealmIndex } = parseRealm(worldBase, playerSystem);

        // 2. Determine Beast's initial target realm from its rank
        let beastTargetMajorIndex = Math.min(rank - 1, yeuThuSystem.majorRealms.length - 1);
        const beastTargetSubIndex = Math.floor(Math.random() * 4); // 0 to 3 (Nhất Trọng to Tứ Trọng) for variety

        // 3. Apply group debuff (weaker by one major realm tier)
        if (groupSize > 1) {
            beastTargetMajorIndex = Math.max(0, beastTargetMajorIndex - 1);
        }

        // 4. Calculate Max Allowed Realm (+2 sub-realms from world base) and Cap the beast's realm
        // Note: we scale based on world base to ensure beasts match the world progression.
        let finalMajorIndex = beastTargetMajorIndex;
        let finalSubIndex = beastTargetSubIndex;

        if (baseMajorRealmIndex !== -1 && baseSubRealmIndex !== -1) {
            const subRealmsCount = playerSystem.minorRealms.length || 10;
            const maxAllowedTotalIndex = (baseMajorRealmIndex * subRealmsCount) + baseSubRealmIndex + 2;
            const beastTotalIndex = (beastTargetMajorIndex * subRealmsCount) + beastTargetSubIndex;

            if (beastTotalIndex > maxAllowedTotalIndex) {
                finalMajorIndex = Math.floor(maxAllowedTotalIndex / subRealmsCount);
                finalSubIndex = maxAllowedTotalIndex % subRealmsCount;
            }
        }

        // 5. Finalize beast realm string and calculate stats
        finalMajorIndex = Math.min(finalMajorIndex, yeuThuSystem.majorRealms.length - 1);
        finalSubIndex = Math.min(finalSubIndex, yeuThuSystem.minorRealms.length - 1);

        if (finalMajorIndex >= 0) {
            realm = `${yeuThuSystem.majorRealms[finalMajorIndex]} ${yeuThuSystem.minorRealms[finalSubIndex]}`;

            // Calculate stats based on the capped realm.
            // We map the YeuThu realm index back to the player's main realm list index for stat calculation.
            const statCalcMajorRealmIndex = Math.min(finalMajorIndex, playerSystem.majorRealms.length - 1);
            const statCalcMajorRealmName = playerSystem.majorRealms[statCalcMajorRealmIndex] || playerSystem.majorRealms[0];
            const statCalcFullRealmString = `${statCalcMajorRealmName} ${playerSystem.minorRealms[finalSubIndex]}`;
            
            const newYeuThu: YeuThu = {
                id: `yeuthu-db-${dbEntry.id}-${Date.now()}`,
                name: dbEntry.name,
                species: dbEntry.name,
                description: dbEntry.description,
                isHostile: true,
                realm: realm,
                stats: stats,
                skills: [],
                locationId: kb.currentLocationId,
            };

            updateEntityStatsFromRealm(newYeuThu, kb);
            return newYeuThu;
        }
        // --- NEW SCALE LOGIC END ---
    }

    return {
        id: `yeuthu-db-${dbEntry.id}-${Date.now()}`,
        name: dbEntry.name,
        species: dbEntry.name, // Species can be the same as name for DB entries
        description: dbEntry.description,
        isHostile: true, // DB monsters are hostile by default
        realm: realm,
        stats: stats,
        skills: [], // Can be expanded to include skills from DB
        locationId: kb.currentLocationId,
    };
};

