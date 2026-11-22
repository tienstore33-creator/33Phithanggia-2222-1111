
import { KnowledgeBase, GameMessage, NPC, YeuThu, Skill, PlayerStats, AnalyzedCombatant } from '../../types';
import { diceCoefficient, normalizeStringForComparison } from '../questUtils';
import { calculateRealmBaseStats, updateEntityStatsFromRealm } from '../statsCalculationUtils';
import { parseRealm } from '../realmUtils';
import { getEffectiveRealmSystem } from '../../services/realmManager';
import * as GameTemplates from '../../templates';
import { DEFAULT_PLAYER_STATS, VIETNAMESE } from '../../constants';
import { limitCombatParticipants } from '../combatLimiter';

const SIMILARITY_THRESHOLD = 0.8; // Match if 80% similar

export const processSetCombatStatus = (
    currentKb: KnowledgeBase,
    tagParams: Record<string, string>
): { updatedKb: KnowledgeBase; systemMessages: GameMessage[] } => {
    const newKb = currentKb;
    const status = tagParams.status?.toLowerCase();
    if (status === 'start' || tagParams.value?.toLowerCase() === 'true') { // Added check for legacy "value"
        newKb.playerStats.isInCombat = true;
    } else if (status === 'end' || tagParams.value?.toLowerCase() === 'false') {
        newKb.playerStats.isInCombat = false;
    }
    return { updatedKb: newKb, systemMessages: [] };
};

export const resolveAnalyzedCombatants = (
    analyzedCombatants: AnalyzedCombatant[],
    newKb: KnowledgeBase,
    systemMessages: GameMessage[],
    isAlly: boolean = false
): { resolvedIds: string[], temporaryNPCs: NPC[] } => {
    const resolvedIds: string[] = [];
    const temporaryNPCs: NPC[] = [];
    const allCombatants: any[] = [...newKb.discoveredNPCs, ...newKb.discoveredYeuThu, ...newKb.wives, ...newKb.slaves, ...newKb.prisoners];

    analyzedCombatants.forEach(combatant => {
        const quantity = combatant.quantity || 1;

        for (let i = 0; i < quantity; i++) {
            let opponent: any | undefined;
            
            // For the first entity, try to find an existing one
            if (i === 0) {
                opponent = allCombatants.find(c => c.id === combatant.id);
                if (!opponent) {
                    opponent = allCombatants.find(c => c.name.toLowerCase() === combatant.name.toLowerCase());
                }

                if (!opponent) {
                    let bestMatch: { entity: any | null; score: number } = { entity: null, score: 0 };
                    const nInput = normalizeStringForComparison(combatant.name);

                    allCombatants.forEach(potentialOpponent => {
                        const nEntity = normalizeStringForComparison(potentialOpponent.name);
                        let score = diceCoefficient(nInput, nEntity);
                        if (nEntity.startsWith(nInput) || nInput.startsWith(nEntity)) score += 0.2;
                        if (score > bestMatch.score) {
                            bestMatch = { entity: potentialOpponent, score: score };
                        }
                    });

                    if (bestMatch.entity && bestMatch.score >= 0.75) {
                        opponent = bestMatch.entity;
                    }
                }
            }

            // If not found OR it's a clone (i > 0), create a new one
            if (!opponent || i > 0) {
                const suffix = quantity > 1 ? ` #${i + 1}` : '';
                const displayName = `${combatant.name}${suffix}`;
                
                console.log(`[BEGIN_COMBAT_AUTOGEN] Creating NPC for "${displayName}" based on AI analysis`);
                
                const powerLevel = Number(combatant.powerLevel) || 1;
                const scale = (0.8 + Math.random() * 0.4) * powerLevel;

                const autoSkills: Skill[] = [];
                const skillTemplatesToadd = ['combat Chém Chém', 'combat Hỏa Cầu Thuật', 'combat Trị Liệu Thuật'];

                skillTemplatesToadd.forEach(templateName => {
                    const template = GameTemplates.COMBAT_MODE_SKILLS.find(s => s.name === templateName);
                    if (template) {
                        autoSkills.push({
                            id: `auto-skill-${Date.now()}-${Math.random().toString(36).substr(2, 5)}-${i}`,
                            name: template.name,
                            description: template.description,
                            skillType: GameTemplates.SkillType.LINH_KI,
                            manaCost: template.mpCost,
                            baseDamage: template.effect.type === 'DAMAGE_HP' ? (template.effect.basePower || 0) : 0,
                            healingAmount: template.effect.type === 'HEAL_HP' ? (template.effect.basePower || 0) : 0,
                            damageMultiplier: 0,
                            healingMultiplier: 0,
                            cooldown: 0,
                            currentCooldown: 0,
                            proficiency: 100,
                            maxProficiency: 100,
                            proficiencyTier: "Sơ Nhập",
                            effect: template.effect,
                            detailedEffect: JSON.stringify(template.effect)
                        });
                    }
                });

                if (autoSkills.length === 0) {
                    autoSkills.push({
                         id: `auto-skill-basic-${Date.now()}-${i}`,
                         name: "Tấn công thường",
                         description: "Đòn tấn công cơ bản",
                         skillType: GameTemplates.SkillType.KHAC,
                         manaCost: 0,
                         baseDamage: 10,
                         healingAmount: 0,
                         damageMultiplier: 0,
                         healingMultiplier: 0,
                         detailedEffect: "Gây sát thương nhỏ",
                         effect: { type: 'DAMAGE_HP', target: 'single_enemy', basePower: 10 }
                    });
                }

                const worldBase = newKb.worldRealmBase || (newKb.worldConfig?.canhGioiKhoiDau) || "Phàm Nhân Nhất Trọng";
                let npcRealm = worldBase;
                
                if (newKb.worldConfig?.isCultivationEnabled) {
                    const npcSystem = getEffectiveRealmSystem(newKb);
                    const { majorIndex: baseMajor, minorIndex: baseMinor } = parseRealm(worldBase, npcSystem);
                    
                    if (baseMajor !== -1) {
                        const subRealmsCount = npcSystem.minorRealms.length || 10;
                        const baseTotalIndex = (baseMajor * subRealmsCount) + baseMinor;
                        const randomOffset = Math.floor(Math.random() * 3) - 1;
                        const targetTotalIndex = Math.max(0, baseTotalIndex + randomOffset);
                        const finalMajor = Math.floor(targetTotalIndex / subRealmsCount);
                        const finalMinor = targetTotalIndex % subRealmsCount;
                        const majorName = npcSystem.majorRealms[Math.min(finalMajor, npcSystem.majorRealms.length - 1)];
                        const minorName = npcSystem.minorRealms[Math.min(finalMinor, npcSystem.minorRealms.length - 1)];
                        npcRealm = `${majorName} ${minorName}`;
                    }
                }

                const generatedNpc: NPC = {
                    id: (i === 0 && combatant.id) ? combatant.id : `auto-npc-${combatant.name.replace(/\s+/g, '-')}-${Date.now()}-${i}`,
                    name: displayName,
                    description: combatant.description || (isAlly ? `Đồng minh xuất hiện bất ngờ.` : `Kẻ địch xuất hiện bất ngờ.`),
                    gender: 'Không rõ',
                    race: 'Nhân Tộc',
                    realm: npcRealm,
                    affinity: isAlly ? 50 : -50,
                    tuChat: 'Trung Phẩm',
                    stats: {},
                    skills: autoSkills,
                    personalityTraits: isAlly ? ['Hữu hảo'] : ['Hung hăng'],
                    locationId: newKb.currentLocationId,
                    isNewlyGenerated: true
                };

                updateEntityStatsFromRealm(generatedNpc, newKb);
                // NOT PUSHING TO discoveredNPCs ANYMORE
                temporaryNPCs.push(generatedNpc);
                opponent = generatedNpc;
                
                if (i === 0) {
                    systemMessages.push({
                        id: `auto-gen-msg-${Date.now()}`,
                        type: 'system',
                        content: `Hệ thống: Đã phát hiện nhân vật quần chúng "${combatant.name}" (${quantity} đơn vị). Các nhân vật này sẽ được tạo tạm thời phục vụ chiến đấu.`,
                        timestamp: Date.now(),
                        turnNumber: newKb.playerStats.turn
                    });
                }
            }
            
            if (opponent) {
                resolvedIds.push(opponent.id);
            }
        }
    });

    return { resolvedIds, temporaryNPCs };
};

export const resolveCombatantIds = (
    namesOrIds: string[],
    newKb: KnowledgeBase,
    systemMessages: GameMessage[],
    isAlly: boolean = false
): { resolvedIds: string[], temporaryNPCs: NPC[] } => {
    const resolvedIds: string[] = [];
    const temporaryNPCs: NPC[] = [];
    const allCombatants: any[] = [...newKb.discoveredNPCs, ...newKb.discoveredYeuThu, ...newKb.wives, ...newKb.slaves, ...newKb.prisoners];

    namesOrIds.forEach(rawInput => {
        const nameOrId = rawInput.trim().replace(/^(combat_|target_|npc_)/i, '');
        let opponent: any | undefined = allCombatants.find(c => c.id === nameOrId);
        
        if (!opponent) {
            opponent = allCombatants.find(c => c.name.toLowerCase() === nameOrId.toLowerCase());
        }

        if (!opponent) {
            let bestMatch: { entity: any | null; score: number } = { entity: null, score: 0 };
            const nInput = normalizeStringForComparison(nameOrId);

            allCombatants.forEach(potentialOpponent => {
                const nEntity = normalizeStringForComparison(potentialOpponent.name);
                let score = diceCoefficient(nInput, nEntity);
                
                // Gia cố: Thưởng điểm nếu chứa nhau hoặc bắt đầu bằng nhau
                if (nEntity.startsWith(nInput) || nInput.startsWith(nEntity)) score += 0.2;
                
                if (score > bestMatch.score) {
                    bestMatch = { entity: potentialOpponent, score: score };
                }
            });

            if (bestMatch.entity && bestMatch.score >= 0.75) {
                console.log(`[BEGIN_COMBAT_FUZZY] Matched "${nameOrId}" to "${bestMatch.entity.name}" with score ${bestMatch.score.toFixed(2)}`);
                opponent = bestMatch.entity;
            }
        }

        if (!opponent) {
            console.log(`[BEGIN_COMBAT_AUTOGEN] Creating temporary NPC for "${nameOrId}"`);
            
            const autoSkills: Skill[] = [];
            const skillTemplatesToadd = ['combat Chém Chém', 'combat Hỏa Cầu Thuật', 'combat Trị Liệu Thuật'];

            skillTemplatesToadd.forEach(templateName => {
                const template = GameTemplates.COMBAT_MODE_SKILLS.find(s => s.name === templateName);
                if (template) {
                    autoSkills.push({
                        id: `auto-skill-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                        name: template.name,
                        description: template.description,
                        skillType: GameTemplates.SkillType.LINH_KI,
                        manaCost: template.mpCost,
                        baseDamage: template.effect.type === 'DAMAGE_HP' ? (template.effect.basePower || 0) : 0,
                        healingAmount: template.effect.type === 'HEAL_HP' ? (template.effect.basePower || 0) : 0,
                        damageMultiplier: 0,
                        healingMultiplier: 0,
                        cooldown: 0,
                        currentCooldown: 0,
                        proficiency: 100,
                        maxProficiency: 100,
                        proficiencyTier: "Sơ Nhập",
                        effect: template.effect,
                        detailedEffect: JSON.stringify(template.effect)
                    });
                }
            });

            if (autoSkills.length === 0) {
                autoSkills.push({
                     id: `auto-skill-basic-${Date.now()}`,
                     name: "Tấn công thường",
                     description: "Đòn tấn công cơ bản",
                     skillType: GameTemplates.SkillType.KHAC,
                     manaCost: 0,
                     baseDamage: 10,
                     healingAmount: 0,
                     damageMultiplier: 0,
                     healingMultiplier: 0,
                     detailedEffect: "Gây sát thương nhỏ",
                     effect: { type: 'DAMAGE_HP', target: 'single_enemy', basePower: 10 }
                });
            }

            // --- NPC REALM SCALING LOGIC START ---
            const worldBase = newKb.worldRealmBase || (newKb.worldConfig?.canhGioiKhoiDau) || "Phàm Nhân Nhất Trọng";
            let npcRealm = worldBase;
            
            if (newKb.worldConfig?.isCultivationEnabled) {
                const npcSystem = getEffectiveRealmSystem(newKb);
                const { majorIndex: baseMajor, minorIndex: baseMinor } = parseRealm(worldBase, npcSystem);
                
                if (baseMajor !== -1) {
                    const subRealmsCount = npcSystem.minorRealms.length || 10;
                    const baseTotalIndex = (baseMajor * subRealmsCount) + baseMinor;
                    
                    // Randomly scale NPC realm around world base realm (-1 to +1 sub-realms)
                    const randomOffset = Math.floor(Math.random() * 3) - 1;
                    const targetTotalIndex = Math.max(0, baseTotalIndex + randomOffset);
                    
                    const finalMajor = Math.floor(targetTotalIndex / subRealmsCount);
                    const finalMinor = targetTotalIndex % subRealmsCount;
                    
                    const majorName = npcSystem.majorRealms[Math.min(finalMajor, npcSystem.majorRealms.length - 1)];
                    const minorName = npcSystem.minorRealms[Math.min(finalMinor, npcSystem.minorRealms.length - 1)];
                    npcRealm = `${majorName} ${minorName}`;
                }
            }
            // --- NPC REALM SCALING LOGIC END ---

            const generatedNpc: NPC = {
                id: `auto-npc-${nameOrId.replace(/\s+/g, '-')}-${Date.now()}`,
                name: nameOrId,
                description: isAlly ? `Đồng minh xuất hiện bất ngờ.` : `Kẻ địch xuất hiện bất ngờ.`,
                gender: 'Không rõ',
                race: 'Nhân Tộc',
                realm: npcRealm,
                affinity: isAlly ? 50 : -50,
                tuChat: 'Trung Phẩm',
                stats: {},
                skills: autoSkills,
                personalityTraits: isAlly ? ['Hữu hảo'] : ['Hung hăng'],
                locationId: newKb.currentLocationId,
                isNewlyGenerated: true // Mark as newly generated
            };

            updateEntityStatsFromRealm(generatedNpc, newKb);

            // NOT PUSHING TO discoveredNPCs ANYMORE
            temporaryNPCs.push(generatedNpc);
            opponent = generatedNpc;
            
            systemMessages.push({
                id: `auto-gen-msg-${Date.now()}`,
                type: 'system',
                content: `Hệ thống: Đã phát hiện nhân vật quần chúng "${nameOrId}" và khởi tạo tạm thời theo cảnh giới ${npcRealm}.`,
                timestamp: Date.now(),
                turnNumber: newKb.playerStats.turn
            });
        }
        
        if (opponent) {
            // Enforce affinity rules: >= 0 for allies, <= 0 for opponents
            // Skip check if newly generated
            if (!(opponent as any).isNewlyGenerated) {
                const affinity = (opponent as any).affinity || 0;
                if (isAlly && affinity < 0) {
                    console.warn(`[COMBAT_RESOLVE] NPC ${opponent.name} (Affinity: ${affinity}) cannot be an ally based on rules. Skipping.`);
                    return;
                }
                if (!isAlly && affinity > 0) {
                    console.warn(`[COMBAT_RESOLVE] NPC ${opponent.name} (Affinity: ${affinity}) cannot be an opponent based on rules. Skipping.`);
                    return;
                }
            }

            if ('personalityTraits' in opponent && opponent.realm) {
                const npc = opponent as NPC;
                const npcRace = npc.race || 'Nhân Tộc';
                const raceSystem = newKb.worldConfig?.raceCultivationSystems.find(rs => rs.raceName === npcRace);
                const progressionList = raceSystem?.realmSystem.split(' - ').map(s => s.trim()) || newKb.realmProgressionList;

                if (!npc.stats || !npc.stats.maxSinhLuc || npc.stats.maxSinhLuc < 10) {
                    const newBaseStats = calculateRealmBaseStats(
                        npc.realm,
                        progressionList,
                        newKb.currentRealmBaseStats
                    );
                    npc.stats = {
                        ...npc.stats,
                        ...newBaseStats,
                        maxSinhLuc: newBaseStats.baseMaxSinhLuc,
                        maxLinhLuc: newBaseStats.baseMaxLinhLuc,
                        sucTanCong: newBaseStats.baseSucTanCong,
                        maxKinhNghiem: newBaseStats.baseMaxKinhNghiem,
                    };
                }
                
                if (npc.stats) {
                    npc.stats.sinhLuc = npc.stats.maxSinhLuc;
                    npc.stats.linhLuc = npc.stats.maxLinhLuc;
                }
            }

            resolvedIds.push(opponent.id);
        }
    });

    return { resolvedIds, temporaryNPCs };
};

export const processBeginCombat = (
    currentKb: KnowledgeBase,
    tagParams: Record<string, string>
): { updatedKb: KnowledgeBase; systemMessages: GameMessage[] } => {
    const newKb = currentKb;
    const systemMessages: GameMessage[] = [];

    if (currentKb.worldConfig?.isCultivationEnabled === false) {
        console.log("BEGIN_COMBAT tag ignored because isCultivationEnabled is false.");
        newKb.pendingCombat = null;
        return { updatedKb: newKb, systemMessages };
    }

    const opponentIdsStr = tagParams.opponentIds;

    if (!opponentIdsStr) {
        console.warn("BEGIN_COMBAT: Missing opponentIds parameter.", tagParams);
        return { updatedKb: newKb, systemMessages };
    }

    const opponentNamesOrIds = opponentIdsStr.split(',').map(id => id.trim()).filter(id => id);
    const { resolvedIds: resolvedOpponentIds, temporaryNPCs: tempOpponents } = resolveCombatantIds(opponentNamesOrIds, newKb, systemMessages);
    
    const allyIdsStr = tagParams.allyIds;
    const allyNamesOrIds = allyIdsStr ? allyIdsStr.split(',').map(id => id.trim()).filter(id => id) : [];
    const { resolvedIds: resolvedAllyIds, temporaryNPCs: tempAllies } = resolveCombatantIds(allyNamesOrIds, newKb, systemMessages, true);

    const temporaryEntities = [...tempOpponents, ...tempAllies];

    const surrenderedNpcIds = tagParams.surrenderedNpcIds?.split(',').map(id => id.trim()).filter(id => id) || [];

    if (resolvedOpponentIds.length > 0) {
        const existingOpponentIds = currentKb.pendingCombat?.opponentIds || [];
        const combinedOpponentsRaw = Array.from(new Set([...existingOpponentIds, ...resolvedOpponentIds]));
        
        const existingAllyIds = currentKb.pendingCombat?.allyIds || [];
        const combinedAllies = Array.from(new Set([...existingAllyIds, ...resolvedAllyIds]));

        const { limitedOpponentIds } = limitCombatParticipants(combinedAllies, combinedOpponentsRaw);

        // Filter temporary entities to only include those that are actually in the limited list
        const finalTempEntities = temporaryEntities.filter(te => 
            limitedOpponentIds.includes(te.id) || combinedAllies.includes(te.id)
        );

        newKb.pendingCombat = {
            opponentIds: limitedOpponentIds,
            allyIds: combinedAllies,
            surrenderedNpcIds: surrenderedNpcIds,
            analyzed: false,
            enemy: { ids: limitedOpponentIds }, // Recovery hook compatibility
            analysis: null,
            temporaryEntities: finalTempEntities
        };
    } else {
        console.warn("BEGIN_COMBAT: No valid opponents found even after auto-generation attempt.");
    }
    
    return { updatedKb: newKb, systemMessages };
};

