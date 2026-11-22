

import { KnowledgeBase, GameMessage, NPC, Wife, Slave, PersonBase, Prisoner } from '../types';
import { TU_CHAT_MULTIPLIERS, NPC_BASE_EXP_PERCENTAGE, NPC_BOTTLENECK_DURATION_TURNS, VIETNAMESE } from '../constants';
import { calculateRealmBaseStats, calculateEffectiveStats } from './statsCalculationUtils';
import { getEffectiveRealmSystem, getRealmSystemByRace } from '../services/realmManager';
import { parseRealm } from './realmUtils';
import { fastCloneKb } from './cloneKb';

export const progressNpcCultivation = (currentKb: KnowledgeBase): { updatedKb: KnowledgeBase; systemMessages: GameMessage[]; progressedNpcIds: string[] } => {
    const newKb = fastCloneKb(currentKb);
    const progressedNpcIds: string[] = [];
    
    if (!newKb.worldConfig?.isCultivationEnabled || !newKb.worldConfig.raceCultivationSystems || newKb.worldConfig.raceCultivationSystems.length === 0) {
        return { updatedKb: newKb, systemMessages: [], progressedNpcIds };
    }
    
    // Build inventory map once for performance
    const combinedInventory = [...(newKb.inventory || []), ...(newKb.npcInventory || [])];
    const inventoryMap = new Map<string, any>();
    combinedInventory.forEach(item => {
        if (item.id) inventoryMap.set(item.id, item);
    });

    // --- Get Player's Major Realm Index (once before loop) ---
    const playerSystem = getEffectiveRealmSystem(newKb);
    const { majorIndex: playerMainRealmIndex } = parseRealm(newKb.playerStats.realm, playerSystem);


    // 1. Get all NPCs that can potentially progress.
    const allNpcs = newKb.discoveredNPCs;

    // 2. Sort to find the 10 with the lowest affinity.
    const sortedByLowestAffinity = [...allNpcs].sort((a, b) => a.affinity - b.affinity);
    const lowestAffinityNpcs = sortedByLowestAffinity.slice(0, 10);

    // 3. Sort to find the 10 with the highest affinity.
    const sortedByHighestAffinity = [...allNpcs].sort((a, b) => b.affinity - a.affinity);
    const highestAffinityNpcs = sortedByHighestAffinity.slice(0, 10);

    // 4. Combine and remove duplicates.
    const progressingNpcMap = new Map<string, NPC>();
    lowestAffinityNpcs.forEach(npc => progressingNpcMap.set(npc.id, npc));
    highestAffinityNpcs.forEach(npc => progressingNpcMap.set(npc.id, npc));
    // Always include Player Zero in progressing NPCs
    allNpcs.forEach(npc => {
        if (npc.isPlayerZero) {
            progressingNpcMap.set(npc.id, npc);
        }
    });
    const progressingNpcs = Array.from(progressingNpcMap.values());

    // 5. Combine with Wives, Slaves, and Prisoners who always progress/regenerate.
    const allCharactersToProgress: (NPC | Wife | Slave | Prisoner)[] = [
        ...progressingNpcs,
        ...newKb.wives,
        ...newKb.slaves,
        ...newKb.prisoners, // Added prisoners
    ];
    
    allCharactersToProgress.forEach(character => {
        // Assign default aptitude if missing to prevent skipping
        if (newKb.worldConfig?.isCultivationEnabled && character.realm && character.realm !== VIETNAMESE.mortalRealmName && !character.tuChat) {
            character.tuChat = "Trung Phẩm";
        }

        if (!character.stats) {
            character.stats = {};
        }

        let isProgressionHappened = false;

        // HP & MP Regeneration (10% HP, 5% MP per turn)
        if (character.stats.maxSinhLuc && (character.stats.sinhLuc || 0) < character.stats.maxSinhLuc) {
            const hpRegenAmount = Math.floor(character.stats.maxSinhLuc * 0.10); 
            character.stats.sinhLuc = Math.min(character.stats.maxSinhLuc, (character.stats.sinhLuc || 0) + hpRegenAmount);
            isProgressionHappened = true;
        }
        if (character.stats.maxLinhLuc && (character.stats.linhLuc || 0) < character.stats.maxLinhLuc) {
            const mpRegenAmount = Math.floor(character.stats.maxLinhLuc * 0.05);
            character.stats.linhLuc = Math.min(character.stats.maxLinhLuc, (character.stats.linhLuc || 0) + mpRegenAmount);
            isProgressionHappened = true;
        }

        if (isProgressionHappened) progressedNpcIds.push(character.id);

        if (!character.realm || character.realm === VIETNAMESE.mortalRealmName || !character.tuChat) {
            return; // Skip cultivation for characters without a realm or aptitude
        }
        

        // Determine the correct realm progression list for the character's race
        const characterRace = character.race || 'Nhân Tộc'; // Default to human race
        const system = getRealmSystemByRace(newKb, characterRace);
        
        if (!system.majorRealms.length) {
            console.warn(`No realm system found for race: ${characterRace}. Skipping progression for ${character.name}.`);
            return; // Skip if no valid system found
        }
        
        const { majorIndex: currentMainRealmIndex, minorIndex: currentSubRealmIndex } = parseRealm(character.realm, system);

        // Handle Bottleneck
        if (character.isBinhCanh) {
            character.binhCanhCounter = (character.binhCanhCounter || 0) + 1;
            if (character.binhCanhCounter >= NPC_BOTTLENECK_DURATION_TURNS) {
                if (currentMainRealmIndex !== -1 && currentMainRealmIndex < system.majorRealms.length - 1) {
                    const nextMainRealm = system.majorRealms[currentMainRealmIndex + 1];
                    character.realm = `${nextMainRealm} ${system.minorRealms[0]}`;
                    
                    // Reset state
                    character.isBinhCanh = false;
                    character.binhCanhCounter = 0;
                    if(character.stats) character.stats.kinhNghiem = 0;

                    // IMPORTANT: Pass the correct realm list to the calculation function
                    const newBaseStats = calculateRealmBaseStats(character.realm, newKb, newKb.currentRealmBaseStats);
                    character.stats = {
                        ...character.stats,
                        ...newBaseStats,
                        maxSinhLuc: newBaseStats.baseMaxSinhLuc,
                        maxLinhLuc: newBaseStats.baseMaxLinhLuc,
                        sucTanCong: newBaseStats.baseSucTanCong,
                        maxKinhNghiem: newBaseStats.baseMaxKinhNghiem,
                        sinhLuc: newBaseStats.baseMaxSinhLuc, // Full heal
                        linhLuc: newBaseStats.baseMaxLinhLuc,   // Full heal
                    };

                    // NEW: Recalculate effective stats including equipment
                    if (character.equippedItems) {
                        character.stats = calculateEffectiveStats(
                            character.stats as any,
                            character.equippedItems as any,
                            combinedInventory,
                            inventoryMap
                        );
                    }

                    // Grant lifespan bonus on major breakthrough
                    const lifespanBonus = 100 * Math.pow(1.5, currentMainRealmIndex);
                    if (character.stats) {
                        if (character.stats.maxThoNguyen) {
                            character.stats.maxThoNguyen += lifespanBonus;
                        } else {
                            character.stats.maxThoNguyen = 120 + lifespanBonus;
                        }
                        if (character.stats.thoNguyen) {
                            character.stats.thoNguyen += lifespanBonus;
                        } else {
                            character.stats.thoNguyen = character.stats.maxThoNguyen;
                        }
                    }
                    progressedNpcIds.push(character.id);
                }
            }
            return; // No EXP gain during bottleneck
        }

        // --- NEW: Check if NPC's realm is higher than player's before EXP Gain ---
        // If the NPC's major realm index is greater than the player's, they are too far ahead.
        // Skip EXP gain for this turn.
        if (playerMainRealmIndex !== -1 && currentMainRealmIndex > playerMainRealmIndex) {
            return; // Skips the rest of the logic for this character in the forEach loop.
        }
        // --- END NEW LOGIC ---

        // EXP Gain
        if (typeof character.stats.kinhNghiem !== 'number' || isNaN(character.stats.kinhNghiem)) {
            character.stats.kinhNghiem = 0;
        }
        const tuChatMultiplier = TU_CHAT_MULTIPLIERS[character.tuChat] || 1.0;
        const maxExpForCurrentLevel = character.stats.maxKinhNghiem || 100;
        const expGain = Math.round(NPC_BASE_EXP_PERCENTAGE * tuChatMultiplier * maxExpForCurrentLevel);
        character.stats.kinhNghiem += expGain;

        // Level Up Logic
        while (character.stats.kinhNghiem >= (character.stats.maxKinhNghiem || Infinity)) {
            character.stats.kinhNghiem -= character.stats.maxKinhNghiem!;

            const { majorIndex: loopMainIndex, minorIndex: loopSubIndex } = parseRealm(character.realm, system);

            if (loopMainIndex === -1 || loopSubIndex === -1) {
                character.stats.kinhNghiem = character.stats.maxKinhNghiem! - 1;
                break;
            }

            if (loopSubIndex === system.minorRealms.length - 1) {
                character.isBinhCanh = true;
                character.binhCanhCounter = 1;
                character.stats.kinhNghiem = character.stats.maxKinhNghiem!;
                break;
            }

            const nextSubRealmName = system.minorRealms[loopSubIndex + 1];
            character.realm = `${system.majorRealms[loopMainIndex]} ${nextSubRealmName}`;
            
            // IMPORTANT: Pass the correct realm list to the calculation function
            const newBaseStats = calculateRealmBaseStats(character.realm, newKb, newKb.currentRealmBaseStats);
            character.stats = {
                ...character.stats,
                ...newBaseStats,
                maxSinhLuc: newBaseStats.baseMaxSinhLuc,
                maxLinhLuc: newBaseStats.baseMaxLinhLuc,
                sucTanCong: newBaseStats.baseSucTanCong,
                maxKinhNghiem: newBaseStats.baseMaxKinhNghiem,
            };

            // NEW: Recalculate effective stats including equipment
            if (character.equippedItems) {
                character.stats = calculateEffectiveStats(
                    character.stats as any,
                    character.equippedItems as any,
                    combinedInventory,
                    inventoryMap
                );
            }
            progressedNpcIds.push(character.id);
        }
    });

    return { updatedKb: newKb, systemMessages: [], progressedNpcIds };
};

export const checkFollowerStatus = <T extends PersonBase>(
    person: T,
    oldAffinity: number,
    turnForSystemMessages: number
): { person: T; systemMessages: GameMessage[]; statusChanged: boolean } => {
    const systemMessages: GameMessage[] = [];
    const newAffinity = person.affinity;
    let statusChanged = false;

    if (newAffinity > 90 && (oldAffinity <= 90 || person.isFollowingPlayer === undefined) && !person.isFollowingPlayer) {
        person.isFollowingPlayer = true;
        systemMessages.push({
            id: `person-starts-following-${person.id}`,
            type: 'system',
            content: `Thiện cảm của ${person.name} với bạn đã đạt đến mức cực cao. Dường như họ đã bắt đầu âm thầm dõi theo để bảo vệ bạn.`,
            timestamp: Date.now(),
            turnNumber: turnForSystemMessages
        });
        statusChanged = true;
    } else if (newAffinity <= 90 && person.isFollowingPlayer) {
        person.isFollowingPlayer = false;
        systemMessages.push({
            id: `person-stops-following-${person.id}`,
            type: 'system',
            content: `Mối quan hệ của bạn và ${person.name} đã phai nhạt. Bạn không còn cảm thấy ánh mắt của họ dõi theo mình nữa.`,
            timestamp: Date.now(),
            turnNumber: turnForSystemMessages
        });
        statusChanged = true;
    }

    return { person, systemMessages, statusChanged };
}