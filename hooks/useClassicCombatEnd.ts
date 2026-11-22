import { useCallback } from 'react';
import { useGame } from './useGame';
import { CombatEndPayload, KnowledgeBase, GameMessage, Wife, Slave, Prisoner, NPC, YeuThu, GameScreen } from '../types';
import { grantCombatExp } from '../utils/npcProgressionService';
import { calculateRealmBaseStats, calculateEffectiveStats } from '../utils/statsCalculationUtils';
import { SUB_REALM_NAMES } from '../constants';
import { buildPostCombatFormattedAction } from '../services/combat/PostCombatNarrationService';
import { extractLootFromDefeatedEntities } from '../utils/postCombatLootService';

export function useClassicCombatEnd() {
    const { 
        knowledgeBase, 
        setKnowledgeBase, 
        handlePlayerAction, 
        addMessageAndUpdateState, 
        showNotification,
        handleSuccession,
        setCurrentScreen,
        setUiState
    } = useGame();

    const handleClassicCombatSequence = useCallback(async (
        result: CombatEndPayload, 
        last4Logs: string[]
    ) => {
        const { turnHistory: _history, ...kbSnapshot } = knowledgeBase;
        let workingKb = JSON.parse(JSON.stringify(kbSnapshot)) as KnowledgeBase;
        workingKb.turnHistory = _history || [];
        workingKb.battlePlusOneTurn = workingKb.playerStats.turn;

        let systemMessages: GameMessage[] = [];

        // Special handling for defeat while being hunted
        if (result.outcome === 'defeat' && workingKb.huntedState?.isActive) {
            showNotification("Bạn đã bị hành quyết! Luân hồi chuyển kiếp...", 'error');

            if (handleSuccession) {
                const successionMsg = await handleSuccession(workingKb); 
                
                const executionMessage: GameMessage = {
                    id: `hunted-execution-${Date.now()}`,
                    type: 'system',
                    content: `Bạn đã bị đánh bại trong khi bị truy nã. Bạn bị áp giải đến trước mặt một thế lực tối cao và bị phán quyết tử hình. Cuộc đời này của bạn đã kết thúc.`,
                    timestamp: Date.now(),
                    turnNumber: workingKb.playerStats.turn
                };

                addMessageAndUpdateState([executionMessage, successionMsg], workingKb);
                setKnowledgeBase({
                    ...workingKb,
                    pendingCombat: null,
                    postCombatState: null
                });
                setCurrentScreen(GameScreen.Gameplay);
            }
            return; 
        }
        
        // Dungeon Boss Fight Logic
        if (workingKb.pendingCombat?.isDungeonBossFight) {
            if (result.outcome === 'defeat') {
                if (handleSuccession) {
                    const successionMsg = await handleSuccession(workingKb);
                    systemMessages.push(successionMsg);
                    systemMessages.push({
                        id: `dungeon-fail-${Date.now()}`,
                        type: 'system',
                        content: `Bạn đã gục ngã trước trùm cuối. Bí cảnh sụp đổ và bạn đã bỏ mạng tại đây...`,
                        timestamp: Date.now(),
                        turnNumber: workingKb.playerStats.turn
                    });
                    workingKb.dungeonCrawlState = null; // Also clear dungeon state
                    addMessageAndUpdateState(systemMessages, workingKb);
                    setKnowledgeBase({
                        ...workingKb,
                        pendingCombat: null,
                        postCombatState: null
                    });
                    setCurrentScreen(GameScreen.Gameplay);
                }
                return;
            } else if (result.outcome === 'victory') {
                if (workingKb.dungeonCrawlState) {
                    workingKb.dungeonCrawlState.stage = 'report';
                    workingKb.dungeonCrawlState.objective = 'Báo cáo lại cho lãnh đội về kết quả cuộc thám hiểm.';
                }
                workingKb.playerStats = result.finalPlayerState;
                if (result.finalInventory) workingKb.inventory = result.finalInventory;
                workingKb.pendingCombat = null;
                workingKb.postCombatState = null;

                const summaryMessage: GameMessage = {
                    id: `dungeon-boss-victory-${Date.now()}`,
                    type: 'system',
                    content: `Bạn đã đánh bại trùm cuối của hầm ngục! Hãy nhanh chóng thoát ra ngoài và báo cáo cho lãnh đội.`,
                    timestamp: Date.now(),
                    turnNumber: workingKb.playerStats.turn
                };
                
                addMessageAndUpdateState([summaryMessage], workingKb);
                setKnowledgeBase(workingKb);
                setCurrentScreen(GameScreen.Gameplay);
                return;
            }
        }
        
        workingKb.playerStats = result.finalPlayerState;

        // --- EXP REWARDS ---
        const enemies = result.finalOpponentsStatus || [];
        const allies = result.finalAlliesStatus || [];
        
        if (enemies.length > 0 && allies.length > 0) {
            const fullEnemies = enemies.map(e => {
                const ent = [...knowledgeBase.discoveredNPCs, ...knowledgeBase.discoveredYeuThu].find(x => x.id === e.id);
                return { id: e.id, maxHp: ent?.stats?.maxSinhLuc || 100 };
            });
            const fullAllies = allies.map(a => ({ id: a.id }));
            
            const progResult = grantCombatExp(workingKb, fullEnemies, fullAllies);
            Object.assign(workingKb, progResult.updatedKb);
            systemMessages.push(...progResult.systemMessages);
        }

        // --- ALLY HP/MP & PERMADEATH ---
        if (result.finalAlliesStatus) {
            result.finalAlliesStatus.forEach(status => {
                const wife = workingKb.wives.find((w: Wife) => w.id === status.id);
                if (wife) { 
                    if (!wife.stats) wife.stats = {}; 
                    wife.stats.sinhLuc = status.hp; 
                    wife.stats.linhLuc = status.mp; 
                }

                const slave = workingKb.slaves.find((s: Slave) => s.id === status.id);
                if (slave) { 
                    if (!slave.stats) slave.stats = {}; 
                    slave.stats.sinhLuc = status.hp; 
                    slave.stats.linhLuc = status.mp; 
                }
                
                const prisoner = workingKb.prisoners.find((p: Prisoner) => p.id === status.id);
                if (prisoner) { 
                    if (!prisoner.stats) prisoner.stats = {}; 
                    prisoner.stats.sinhLuc = status.hp; 
                    prisoner.stats.linhLuc = status.mp; 
                }

                const npc = workingKb.discoveredNPCs.find((n: NPC) => n.id === status.id);
                if (npc) { 
                    if (!npc.stats) npc.stats = {}; 
                    npc.stats.sinhLuc = status.hp; 
                    npc.stats.linhLuc = status.mp; 
                }

                if (status.hp <= 0 && status.id !== 'player') {
                    const deadAlly = [
                        ...workingKb.wives,
                        ...workingKb.slaves,
                        ...workingKb.prisoners,
                        ...workingKb.discoveredNPCs
                    ].find(a => a.id === status.id);

                    workingKb.wives = workingKb.wives.filter(w => w.id !== status.id);
                    workingKb.slaves = workingKb.slaves.filter(s => s.id !== status.id);
                    workingKb.prisoners = workingKb.prisoners.filter(p => p.id !== status.id);
                    workingKb.discoveredNPCs = workingKb.discoveredNPCs.filter(n => n.id !== status.id);
                    workingKb.companions = workingKb.companions.filter(c => c.id !== status.id);
                    workingKb.combatCompanionIds = workingKb.combatCompanionIds.filter(id => id !== status.id);

                    systemMessages.push({
                        id: `ally-death-${status.id}-${Date.now()}`,
                        type: 'system',
                        content: `${deadAlly?.name || 'Đồng minh'} đã gục ngã và không thể hồi sinh. Họ đã vĩnh viễn rời xa thế giới này.`,
                        timestamp: Date.now(),
                        turnNumber: workingKb.playerStats.turn
                    });
                }
            });
        }

        // --- OPPONENT STATUS ---
        if (result.finalOpponentsStatus) {
            result.finalOpponentsStatus.forEach(status => {
                const isKilled = result.outcome === 'victory' && Object.entries(result.dispositions || {}).some(([k, v]) => {
                    const realId = k.replace(/^enemy_\d+_/, '');
                    return (realId === status.id || k === status.id) && v === 'kill';
                });

                let finalHp = status.hp;
                if (result.outcome === 'victory' && !isKilled) {
                    finalHp = Math.max(1, (status.hp || 0) + 1);
                }

                const npc = workingKb.discoveredNPCs.find((n: NPC) => n.id === status.id);
                if (npc) { 
                    if (!npc.stats) npc.stats = {}; 
                    npc.stats.sinhLuc = finalHp; 
                    npc.stats.linhLuc = status.mp; 
                    npc.isDead = finalHp <= 0;
                }
                
                const yeuThu = workingKb.discoveredYeuThu.find((y: YeuThu) => y.id === status.id);
                if (yeuThu) { 
                    if (!yeuThu.stats) yeuThu.stats = {}; 
                    yeuThu.stats.sinhLuc = finalHp; 
                    yeuThu.stats.linhLuc = status.mp; 
                    yeuThu.isDead = finalHp <= 0;
                }
            });
        }

        if (result.finalInventory) {
            workingKb.inventory = result.finalInventory;
        }
        
        if (result.finalNpcInventory) {
            workingKb.npcInventory = result.finalNpcInventory;
        }

        // --- MECHANICAL EXP REWARD (10% of Enemy Max HP) ---
        if (result.outcome === 'victory' && result.opponentIds && result.opponentIds.length > 0) {
            let totalEnemyMaxHp = 0;
            result.opponentIds.forEach(opponentId => {
                const opponent = [
                    ...workingKb.discoveredNPCs,
                    ...workingKb.discoveredYeuThu
                ].find(o => o.id === opponentId);
                if (opponent && opponent.stats && opponent.stats.maxSinhLuc) {
                    totalEnemyMaxHp += opponent.stats.maxSinhLuc;
                }
            });

            if (totalEnemyMaxHp > 0) {
                const rewardExp = Math.floor(totalEnemyMaxHp * 0.1);
                if (rewardExp > 0) {
                    workingKb.playerStats.kinhNghiem = (workingKb.playerStats.kinhNghiem || 0) + rewardExp;
                    systemMessages.push({
                        id: `exp-gain-battle-${Date.now()}`,
                        type: 'system',
                        content: `Bạn nhận được ${rewardExp} điểm kinh nghiệm từ việc đánh bại kẻ địch (10% tổng HP của chúng).`,
                        timestamp: Date.now(),
                        turnNumber: workingKb.playerStats.turn
                    });
                }
            }
        }

        workingKb.pendingCombat = null;
        workingKb.postCombatState = null;
        if (workingKb.playerStats) {
            workingKb.playerStats.isInCombat = false;
        }

        // --- BREAKTHROUGH HANDLING ---
        const hasTribulationBoss = result.opponentIds.some(id => {
            const npc = knowledgeBase.discoveredNPCs.find(n => n.id === id); 
            if (!npc) return false;
            const name = npc.name ? npc.name.normalize("NFC") : "";
            return name.includes("Lôi Kiếp") || name.includes("Thiên Kiếp") || name.includes("Hóa Thân"); 
        });

        const wasBreakthroughCombat = knowledgeBase.pendingBreakthrough || hasTribulationBoss;

        if (wasBreakthroughCombat) {
            const opponentIdsToDelete = result.opponentIds;
            workingKb.discoveredNPCs = workingKb.discoveredNPCs.filter((npc: NPC) => !opponentIdsToDelete.includes(npc.id));

            workingKb.pendingBreakthrough = null;
            workingKb.playerStats.hieuUngBinhCanh = false;
            workingKb.pendingCombat = null;
            workingKb.postCombatState = null;
            if (workingKb.playerStats) {
                workingKb.playerStats.isInCombat = false;
            }

            if (result.outcome === 'victory') {
                const playerRealmBeforeBreakthrough = knowledgeBase.playerStats.realm;
                let progressionList = workingKb.realmProgressionList || [];
                
                if (progressionList.length === 0 && workingKb.worldConfig?.raceCultivationSystems) {
                    const playerRace = workingKb.worldConfig.playerRace || 'Nhân Tộc';
                    const raceSystem = workingKb.worldConfig.raceCultivationSystems.find(s => s.raceName === playerRace);
                    if (raceSystem) {
                        progressionList = raceSystem.realmSystem.split(' - ').map(s => s.trim()).filter(Boolean);
                        workingKb.realmProgressionList = progressionList;
                    }
                }

                const sortedRealms = [...progressionList].sort((a, b) => b.length - a.length);
                const matchedMainRealm = sortedRealms.find(r => playerRealmBeforeBreakthrough.startsWith(r));
                const mainRealmIndex = progressionList.indexOf(matchedMainRealm || '');

                if (mainRealmIndex !== -1 && mainRealmIndex < progressionList.length - 1) {
                    const nextMainRealmName = progressionList[mainRealmIndex + 1];
                    const firstMinor = workingKb.minorRealmProgressionList && workingKb.minorRealmProgressionList.length > 0 
                        ? workingKb.minorRealmProgressionList[0] 
                        : SUB_REALM_NAMES[0];
                    workingKb.playerStats.realm = `${nextMainRealmName} ${firstMinor}`;
                    workingKb.playerStats.kinhNghiem = 0;
                    
                    const lifespanBonus = 100 * Math.pow(1.5, mainRealmIndex);
                    if(workingKb.playerStats.maxThoNguyen) workingKb.playerStats.maxThoNguyen += lifespanBonus;
                    if(workingKb.playerStats.thoNguyen) workingKb.playerStats.thoNguyen += lifespanBonus;
                    
                    const newBaseStats = calculateRealmBaseStats(workingKb.playerStats.realm, progressionList, workingKb.currentRealmBaseStats);
                    workingKb.playerStats = { ...workingKb.playerStats, ...newBaseStats };
                    
                    workingKb.playerStats = calculateEffectiveStats(workingKb.playerStats, workingKb.equippedItems, workingKb.inventory);
                    
                    workingKb.playerStats.sinhLuc = workingKb.playerStats.maxSinhLuc;
                    workingKb.playerStats.linhLuc = workingKb.playerStats.maxLinhLuc;

                    systemMessages.push({ id: `breakthrough-success-${Date.now()}`, type: 'system', content: `Chúc mừng bạn đã độ kiếp thành công, từ ${playerRealmBeforeBreakthrough} đột phá đến ${workingKb.playerStats.realm}!`, timestamp: Date.now(), turnNumber: workingKb.playerStats.turn });
                    systemMessages.push({ id: `lifespan-bonus-${Date.now()}`, type: 'system', content: `Thọ nguyên tăng thêm ${Math.floor(lifespanBonus)} năm!`, timestamp: Date.now(), turnNumber: workingKb.playerStats.turn });
                    
                    showNotification("Đột phá thành công!", 'success');
                } else {
                     showNotification("Đã chiến thắng nhưng không tìm thấy cảnh giới tiếp theo! (Lỗi dữ liệu hệ thống tu luyện)", 'warning');
                }
                workingKb.pendingCombat = null;
                workingKb.postCombatState = null;
                if (workingKb.playerStats) {
                    workingKb.playerStats.isInCombat = false;
                }
                addMessageAndUpdateState(systemMessages, workingKb);
                setKnowledgeBase(workingKb);
                setCurrentScreen(GameScreen.Cultivation);
            } else { // Defeat in breakthrough combat
                workingKb.pendingCombat = null;
                workingKb.postCombatState = null;
                if (workingKb.playerStats) {
                    workingKb.playerStats.isInCombat = false;
                }
                addMessageAndUpdateState([], workingKb);
                setKnowledgeBase(workingKb);
                setCurrentScreen(GameScreen.Gameplay);
                showNotification("Độ kiếp thất bại! Cảnh giới đang bất ổn...", 'warning');

                setTimeout(() => {
                    setKnowledgeBase(prev => {
                        const { turnHistory, ...rest } = prev;
                        const kbAfterRealmDrop = JSON.parse(JSON.stringify(rest)) as KnowledgeBase;
                        const realmBefore = kbAfterRealmDrop.playerStats.realm;
                    
                        let mainRealmName = "";
                        let subRealmName = "";
                        const realmProgressionList = kbAfterRealmDrop.realmProgressionList;
                        const sortedMainRealms = [...realmProgressionList].sort((a: string, b: string) => b.length - a.length);
                    
                        for (const r of sortedMainRealms) {
                            if (realmBefore.startsWith(r)) {
                                mainRealmName = r;
                                subRealmName = realmBefore.substring(r.length).trim();
                                break;
                            }
                        }
                    
                        let realmHasBeenDropped = false;
                        let newRealm = realmBefore;
                    
                        if (mainRealmName && subRealmName) {
                            const currentSubRealmIndex = SUB_REALM_NAMES.indexOf(subRealmName as any);
                    
                            if (currentSubRealmIndex > 0) { 
                                const prevSubRealmName = SUB_REALM_NAMES[currentSubRealmIndex - 1];
                                newRealm = `${mainRealmName} ${prevSubRealmName}`;
                                kbAfterRealmDrop.playerStats.realm = newRealm;
                                realmHasBeenDropped = true;
                            }
                        }
                    
                        kbAfterRealmDrop.playerStats.kinhNghiem = 0;
                    
                        if (realmHasBeenDropped) {
                            const newBaseStats = calculateRealmBaseStats(newRealm, kbAfterRealmDrop.realmProgressionList, kbAfterRealmDrop.currentRealmBaseStats);
                            kbAfterRealmDrop.playerStats = { ...kbAfterRealmDrop.playerStats, ...newBaseStats };
                    
                            kbAfterRealmDrop.playerStats = calculateEffectiveStats(kbAfterRealmDrop.playerStats, kbAfterRealmDrop.equippedItems, kbAfterRealmDrop.inventory);
                    
                            showNotification(`Cảnh giới của bạn đã bị lùi từ ${realmBefore} xuống ${newRealm}!`, 'error');
                            addMessageAndUpdateState([
                                { id: `breakthrough-fail-${Date.now()}`, type: 'system', content: `Độ kiếp thất bại! Cảnh giới của bạn bị lùi từ ${realmBefore} xuống ${newRealm} và kinh nghiệm bị xóa sạch.`, timestamp: Date.now(), turnNumber: kbAfterRealmDrop.playerStats.turn }
                            ], kbAfterRealmDrop);
                    
                        } else {
                            showNotification(`Độ kiếp thất bại! May mắn là cảnh giới của bạn không bị lùi, nhưng kinh nghiệm đã bị xóa sạch!`, 'warning');
                            addMessageAndUpdateState([
                                { id: `breakthrough-fail-nodrop-${Date.now()}`, type: 'system', content: `Độ kiếp thất bại! May mắn là cảnh giới của bạn không bị lùi, nhưng kinh nghiệm đã bị xóa sạch.`, timestamp: Date.now(), turnNumber: kbAfterRealmDrop.playerStats.turn }
                            ], kbAfterRealmDrop);
                        }
                        
                        return { ...kbAfterRealmDrop, turnHistory };
                    });

                    setTimeout(() => {
                        setKnowledgeBase(prev => {
                            const { turnHistory, ...rest } = prev;
                            const kbAfterHpChange = JSON.parse(JSON.stringify(rest)) as KnowledgeBase;
                            const hpBonus = Math.floor(kbAfterHpChange.playerStats.baseMaxSinhLuc * 0.05);
                            kbAfterHpChange.playerStats.permanentSinhLucBonus = (kbAfterHpChange.playerStats.permanentSinhLucBonus || 0) + hpBonus;
                            
                            kbAfterHpChange.playerStats = calculateEffectiveStats(kbAfterHpChange.playerStats, kbAfterHpChange.equippedItems, kbAfterHpChange.inventory);
                            
                            kbAfterHpChange.playerStats.sinhLuc = Math.floor(kbAfterHpChange.playerStats.maxSinhLuc * 0.05);

                            showNotification(`Lôi kiếp tôi thể! Sinh Lực tối đa vĩnh viễn tăng ${hpBonus} điểm!`, 'success');
                            addMessageAndUpdateState([
                                { id: `hp-bonus-${Date.now()}`, type: 'system', content: `Tuy nhiên, nhờ được lôi kiếp tôi luyện, Sinh Lực tối đa của bạn vĩnh viễn tăng ${hpBonus} điểm! Bạn đang trong trạng thái suy yếu.`, timestamp: Date.now(), turnNumber: kbAfterHpChange.playerStats.turn }
                            ], kbAfterHpChange);
                            
                            return { ...kbAfterHpChange, turnHistory };
                        });
                    }, 2000);

                }, 2000);
            }
            return;
        }

        // --- NON-BREAKTHROUGH DEFEAT ---
        if (result.outcome === 'defeat') {
            const isPlayerSuicide = result.dispositions?.player === 'suicide';
            if (isPlayerSuicide) {
                workingKb.playerStats.sinhLuc = 0;
                workingKb.playerStats.forcedHardcoreRebirth = false;
                workingKb.playerStats.isDead = true;
                workingKb.playerStats.reincarnationPhase = undefined;
                systemMessages.push({
                    id: `suicide-notice-${Date.now()}`,
                    type: 'system',
                    content: `💀 **CHUNG CỰC TỬ VONG: TỰ SÁT HOÁ ĐẠO**\nBạn đã tự kết liễu nhục thân. Sinh lực trở về 0, tàn hồn tiến vào quy trình Chung Cực Tử Vong để chuẩn bị Luân Hồi Tái Sinh.`,
                    timestamp: Date.now(),
                    turnNumber: workingKb.playerStats.turn
                });
            } else {
                const lostCurrency = Math.floor(workingKb.playerStats.currency / 2);
                workingKb.playerStats.currency -= lostCurrency;
                systemMessages.push({
                    id: `defeat-penalty-${Date.now()}`,
                    type: 'system',
                    content: `Thất bại trong chiến đấu! Bạn đã bị cướp/mất ${lostCurrency} tiền tệ.`,
                    timestamp: Date.now(),
                    turnNumber: workingKb.playerStats.turn
                });

                workingKb.playerStats.defeatCount = (workingKb.playerStats.defeatCount || 0) + 1;
                
                if (workingKb.playerStats.defeatCount > 10) {
                    if (handleSuccession) {
                        const successionMsg = await handleSuccession(workingKb);
                        systemMessages.push(successionMsg);
                    }
                }
            }
        }

        // --- DEAD ALLY REMOVAL FROM COMBAT LISTS ---
        if (result.finalAlliesStatus) {
            const deadAllies = result.finalAlliesStatus.filter(a => a.hp <= 0);
            deadAllies.forEach(deadAlly => {
                const realId = deadAlly.id;
                let allyName = realId;
                let foundType = "";

                if (workingKb.wives) {
                    const idx = workingKb.wives.findIndex(w => w.id === realId);
                    if (idx !== -1) {
                        allyName = workingKb.wives[idx].name || allyName;
                        workingKb.wives.splice(idx, 1);
                        foundType = "Thê thiếp / Bạn đời";
                    }
                }
                
                if (workingKb.slaves) {
                    const idx = workingKb.slaves.findIndex(s => s.id === realId);
                    if (idx !== -1) {
                        allyName = workingKb.slaves[idx].name || allyName;
                        workingKb.slaves.splice(idx, 1);
                        foundType = "Nô bộc / Tháp tùng";
                    }
                }

                if (workingKb.discoveredNPCs) {
                    const idx = workingKb.discoveredNPCs.findIndex(n => n.id === realId);
                    if (idx !== -1) {
                        if (allyName === realId) {
                            allyName = workingKb.discoveredNPCs[idx].name || allyName;
                        }
                        workingKb.discoveredNPCs.splice(idx, 1);
                        if (!foundType) foundType = "Đồng hành NPC";
                    }
                }

                systemMessages.push({
                    id: `sys-ally-dead-${realId}-${Date.now()}`,
                    type: 'system',
                    content: `[Tử Trận] ${foundType ? `${foundType} - ` : ''}${allyName} đã cạn kiệt sinh lực và hy sinh vĩnh viễn trong trận chiến dũng cảm này.`,
                    timestamp: Date.now(),
                    turnNumber: workingKb.playerStats.turn
                });
            });
        }

        // --- NPC DISPOSITIONS & LOOT EXTRACTION ---
        if (result.outcome === 'victory' && result.dispositions) {
            // 1. Thu thập danh sách các thực thể đối thủ để trích xuất 50% trang bị từ kẻ bị 'kill'
            const candidateLists = [
                ...(workingKb.discoveredNPCs || []),
                ...(workingKb.discoveredYeuThu || []),
                ...(workingKb.prisoners || []),
                ...(workingKb.wives || []),
                ...(workingKb.slaves || []),
                ...((workingKb.pendingCombat as any)?.temporaryEntities || [])
            ];

            const allOpponentKeys = Array.from(new Set([
                ...(result.opponentIds || []),
                ...Object.keys(result.dispositions)
            ]));

            const allDefeatedEnemies: any[] = [];
            const checkedEntityIds = new Set<string>();

            allOpponentKeys.forEach(rawKey => {
                const normKey = rawKey.replace(/^enemy_\d+_/, '');
                const matched = candidateLists.find(e => e && (e.id === rawKey || e.id === normKey || e.name === rawKey || e.name === normKey));
                if (matched && !checkedEntityIds.has(matched.id)) {
                    checkedEntityIds.add(matched.id);
                    allDefeatedEnemies.push(matched);
                }
            });

            // 2. Trích xuất 50% trang bị từ kẻ địch bị kết liễu
            const lootExtraction = extractLootFromDefeatedEntities(allDefeatedEnemies, result.dispositions, workingKb);
            if (lootExtraction.lootedItems.length > 0) {
                workingKb.inventory = [...(workingKb.inventory || []), ...lootExtraction.lootedItems];
                lootExtraction.systemLogMessages.forEach(msg => {
                    systemMessages.push({
                        id: `sys-loot-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                        type: 'system',
                        content: msg,
                        timestamp: Date.now(),
                        turnNumber: workingKb.playerStats.turn
                    });
                });
            }

            Object.entries(result.dispositions).forEach(([entityId, disposition]) => {
                const realId = entityId.replace(/^enemy_\d+_/, '');
                
                let capturedEntity: any = null;
                let entityName = entityId;
                let foundArray: string | null = null;
                let foundIndex = -1;

                const arraysToCheck = [
                    { name: 'discoveredNPCs', arr: workingKb.discoveredNPCs },
                    { name: 'discoveredYeuThu', arr: workingKb.discoveredYeuThu },
                    { name: 'wives', arr: workingKb.wives },
                    { name: 'slaves', arr: workingKb.slaves },
                    { name: 'prisoners', arr: workingKb.prisoners }
                ];

                const targetSearchKey = realId.trim();
                const rawEntityKey = entityId.trim();

                for (const arrInfo of arraysToCheck) {
                    if (arrInfo.arr) {
                        const idx = arrInfo.arr.findIndex((e: any) => {
                            if (!e) return false;
                            if (e.id === targetSearchKey || e.id === rawEntityKey) return true;
                            if (e.name && (e.name === targetSearchKey || e.name === rawEntityKey)) return true;
                            if (e.name && targetSearchKey && e.name.trim().toLowerCase() === targetSearchKey.toLowerCase()) return true;
                            return false;
                        });
                        if (idx !== -1) {
                            foundArray = arrInfo.name;
                            foundIndex = idx;
                            capturedEntity = { ...arrInfo.arr[idx] };
                            entityName = capturedEntity.name || targetSearchKey;
                            break;
                        }
                    }
                }

                if (foundArray && foundIndex !== -1) {
                    if (disposition === 'kill') {
                        (workingKb as any)[foundArray].splice(foundIndex, 1);
                    } else if (disposition === 'capture' && foundArray !== 'prisoners') {
                        (workingKb as any)[foundArray].splice(foundIndex, 1);
                    }
                }

                if (disposition === 'kill') {
                     systemMessages.push({
                        id: `sys-kill-${realId}-${Date.now()}`,
                        type: 'system',
                        content: `[Hệ thống] Đã kết liễu và xóa dữ liệu của ${entityName}.`,
                        timestamp: Date.now(),
                        turnNumber: workingKb.playerStats.turn
                     });
                } else if (disposition === 'capture' && capturedEntity) {
                    if (foundArray !== 'prisoners') {
                        const updatedStats = { ...(capturedEntity.stats || {}) };
                        updatedStats.sinhLuc = 1;

                        workingKb.prisoners.push({
                            ...capturedEntity,
                            stats: updatedStats,
                            entityType: 'prisoner',
                            satisfaction: 100,
                            captureReason: "Bị bắt sau trận đấu",
                        });
                    }
                    systemMessages.push({
                        id: `sys-capture-${realId}-${Date.now()}`,
                        type: 'system',
                        content: `[Hệ thống] Đã bắt giam ${entityName} vào danh sách Tù Binh.`,
                        timestamp: Date.now(),
                        turnNumber: workingKb.playerStats.turn
                    });
                } else if (disposition === 'release') {
                     let targetObj = (foundArray && foundIndex !== -1) ? (workingKb as any)[foundArray]?.[foundIndex] : null;
                     if (!targetObj) {
                         for (const arrName of ['discoveredNPCs', 'discoveredYeuThu', 'wives', 'slaves', 'prisoners']) {
                             const arr = (workingKb as any)[arrName];
                             if (Array.isArray(arr)) {
                                 targetObj = arr.find((item: any) => item && (item.id === realId || item.id === entityId || item.name === entityName));
                                 if (targetObj) break;
                             }
                         }
                     }

                     if (targetObj) {
                         if (!targetObj.stats) targetObj.stats = {};
                         const currentHp = typeof targetObj.stats.sinhLuc === 'number' ? targetObj.stats.sinhLuc : 0;
                         targetObj.stats.sinhLuc = Math.max(1, currentHp + 1);
                         targetObj.isDead = false;
                         if (targetObj.status === 'Đã tử vong (Tọa hóa)' || targetObj.status === 'Tử vong' || targetObj.status === '[ĐÃ CHẾT]') {
                             targetObj.status = 'Tự do';
                         }
                     }

                     systemMessages.push({
                        id: `sys-release-${realId}-${Date.now()}`,
                        type: 'system',
                        content: `[Hệ thống] Đã thả ${entityName} (Cộng 1 Sinh Lực hồi phục). Dữ liệu của người/yêu thú này vẫn được giữ nguyên.`,
                        timestamp: Date.now(),
                        turnNumber: workingKb.playerStats.turn
                     });
                }
            });
        }

        // --- FORMAT STORYTELLING TURN TRIGGER MESSAGE ---
        const originalInventory = knowledgeBase.inventory || [];
        const finalInventory = workingKb.inventory || result.finalInventory || originalInventory;
        const lootList: string[] = [];
        finalInventory.forEach(item => {
            const orig = originalInventory.find(i => i.id === item.id || i.name === item.name);
            if (!orig) {
                lootList.push(`${item.name} (x${item.quantity})`);
            } else if (item.quantity > orig.quantity) {
                lootList.push(`${item.name} (x${item.quantity - orig.quantity})`);
            }
        });
        const lootText = lootList.length > 0 ? lootList.join(', ') : 'Không có';

        const dispositionsList: string[] = [];
        if (result.outcome === 'victory' && result.dispositions) {
            Object.entries(result.dispositions).forEach(([entityId, disposition]) => {
                const realId = entityId.replace(/^enemy_\d+_/, '');
                const npc = [
                    ...workingKb.discoveredNPCs,
                    ...workingKb.discoveredYeuThu,
                    ...workingKb.prisoners,
                    ...workingKb.wives,
                    ...workingKb.slaves
                ].find(n => n.id === realId || n.id === entityId || n.name === realId);
                const npcName = npc ? npc.name : realId;
                const dispViet = disposition === 'kill' ? 'Kết Liễu' : disposition === 'capture' ? 'Bắt Giữ' : 'Thả Đi';
                dispositionsList.push(`${npcName} (${dispViet})`);
            });
        } else if (result.outcome === 'defeat') {
            const isPlayerSuicide = result.dispositions?.player === 'suicide';
            const isPlayerSurrender = result.dispositions?.player === 'surrender';
            if (isPlayerSuicide) {
                dispositionsList.push('Bản thân: Tự sát');
            } else if (isPlayerSurrender) {
                dispositionsList.push('Bản thân: Đầu hàng (Trở thành tù binh)');
            } else {
                dispositionsList.push('Bản thân: Gục ngã');
            }
        } else if (result.outcome === 'escaped') {
            dispositionsList.push('Bản thân: Bỏ chạy thành công');
        } else if (result.outcome === 'surrendered') {
            dispositionsList.push('Bản thân: Đầu hàng');
        }
        const npcFateText = dispositionsList.length > 0 ? dispositionsList.join(', ') : 'Không rõ';

        const outcomeText = result.outcome === 'victory' ? 'Thắng' : 
                            result.outcome === 'escaped' ? 'Bỏ Chạy' : 
                            result.outcome === 'surrendered' ? 'Đầu Hàng' : 'Thua';

        const isPlayerSuicide = result.outcome === 'defeat' && result.dispositions?.player === 'suicide';
        const mcName = workingKb.worldConfig?.playerName || 'Nhân vật chính';

        const formattedAction = buildPostCombatFormattedAction({
            outcomeText,
            npcFateText,
            lootText,
            last4Logs,
            isPlayerSuicide,
            mcName,
        });

        if (systemMessages.length > 0) {
            addMessageAndUpdateState(systemMessages, workingKb);
        } else {
            addMessageAndUpdateState([], workingKb);
        }

        // Transition to storytelling view
        setKnowledgeBase(workingKb);
        setCurrentScreen(GameScreen.Gameplay);

        // Reset cờ ẩn thông báo chiến đấu để không bị kẹt ẩn giao diện
        if (setUiState) {
            setUiState(prev => ({ ...prev, pendingCombatNoticeHidden: false }));
        }

        // Trigger normal turn narration flow
        await handlePlayerAction(formattedAction, false, 'action', 'default', undefined, workingKb);

    }, [knowledgeBase, setKnowledgeBase, handlePlayerAction, addMessageAndUpdateState, showNotification, handleSuccession, setCurrentScreen, setUiState]);

    return { handleClassicCombatSequence };
}
