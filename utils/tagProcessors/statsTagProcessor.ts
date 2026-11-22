import { KnowledgeBase, PlayerStats, GameMessage, RealmBaseStatDefinition, PlayerSpecialStatus, Master, PersonBase, VectorMetadata } from '../../types';
import { DEFAULT_PLAYER_STATS, VIETNAMESE, SUB_REALM_NAMES } from '../../constants';
import { calculateRealmBaseStats, calculateEffectiveStats } from '../statsCalculationUtils';
import { getEffectiveRealmSystem, realmManager } from '../../services/realmManager';
import { formatPersonForEmbedding } from '../ragUtils';
import { RealmValidatorService } from '../../services/RealmValidatorService';
import { ExpRegulator } from '../../services/cultivation/ExpRegulator';
import { calculateNumericValue } from '../numericLogic';
import { grantPassiveExp } from '../npcProgressionService';

export const processPlayerStatsInit = (
    currentKb: KnowledgeBase,
    tagParams: Record<string, string>
): { updatedKb: KnowledgeBase; systemMessages: GameMessage[]; realmChanged: boolean; turnIncremented: boolean } => {
    const newKb = currentKb;
    
    // Sanitize currency to prevent runtime string concatenation issues
    if (newKb.playerStats && typeof newKb.playerStats.currency !== 'number') {
        newKb.playerStats.currency = parseInt(newKb.playerStats.currency as any, 10) || 0;
    }

    const statsUpdates: Partial<PlayerStats> = {};
    let deferMaxSinhLuc = false;
    let deferMaxLinhLuc = false;
    let realmChanged = false;
    let turnIncremented = false;
    const oldRealm = newKb.playerStats.realm;

    Object.keys(tagParams).forEach(rawKey => {
        const key = rawKey.trim() as keyof PlayerStats;
        const valueStr = tagParams[rawKey].trim();

        if (key === 'turn') {
            // Không chấp nhận cập nhật hay khởi tạo turn từ tag, hệ thống cơ học tự động quản lý.
            console.log(`PLAYER_STATS_INIT: Bỏ qua tham số turn="${valueStr}" từ tag.`);
            return;
        }

        if (key === 'kinhNghiem' && !newKb.worldConfig?.isCultivationEnabled) {
            console.warn(`PLAYER_STATS_INIT: Cultivation is disabled. Ignoring kinhNghiem initialization from tag.`);
            return;
        }

        if (!(key in DEFAULT_PLAYER_STATS)) {
            console.warn(`PLAYER_STATS_INIT: Unknown stat key "${key}". Skipping value "${valueStr}".`);
            return;
        }

        const targetType = typeof DEFAULT_PLAYER_STATS[key];

        if (key === 'isInCombat' || key === 'hieuUngBinhCanh') {
            (statsUpdates as any)[key] = valueStr.toLowerCase() === 'true';



        } else if (targetType === 'number') {
            if (key === 'sinhLuc' && valueStr.toUpperCase() === 'MAX') {
                deferMaxSinhLuc = true;
            } else if (key === 'linhLuc' && valueStr.toUpperCase() === 'MAX') {
                deferMaxLinhLuc = true;
            } else {
                const numValue = parseInt(valueStr, 10);
                if (!isNaN(numValue)) {
                    (statsUpdates as any)[key] = numValue;
                } else {
                    console.warn(`PLAYER_STATS_INIT: Invalid number value "${valueStr}" for key "${key}". Using default.`);
                    const defaultVal = DEFAULT_PLAYER_STATS[key];
                    (statsUpdates as any)[key] = typeof defaultVal === 'number' ? defaultVal : 0;
                }
            }
        }
    });

    const initialRealmForCalc = statsUpdates.realm || newKb.playerStats.realm || DEFAULT_PLAYER_STATS.realm;
     if (typeof initialRealmForCalc !== 'string') {
        console.error(`PLAYER_STATS_INIT: initialRealmForCalc is not a string: ${initialRealmForCalc}. Fallback to default realm.`);
        statsUpdates.realm = DEFAULT_PLAYER_STATS.realm;
    }
    
    // Sử dụng hệ thống cảnh giới hiệu dụng
    const system = getEffectiveRealmSystem(newKb);
    const defaultRealm = `${system.majorRealms[0]} ${system.minorRealms[0]}`;
    
    const baseRealmStats = calculateRealmBaseStats(statsUpdates.realm || defaultRealm, newKb, newKb.currentRealmBaseStats);

    newKb.playerStats = {
        ...DEFAULT_PLAYER_STATS,
        ...baseRealmStats,
        ...statsUpdates
    } as PlayerStats;
     if (statsUpdates.realm) newKb.playerStats.realm = statsUpdates.realm;


    if (deferMaxSinhLuc) newKb.playerStats.sinhLuc = newKb.playerStats.maxSinhLuc;
    if (deferMaxLinhLuc) newKb.playerStats.linhLuc = newKb.playerStats.maxLinhLuc;
    
    // Calculate effective stats FIRST to ensure max stats are updated from base stats
    newKb.playerStats = calculateEffectiveStats(newKb.playerStats, newKb.equippedItems, newKb.inventory);
    
    // Then clamp current stats to the updated max stats
    newKb.playerStats.sinhLuc = Math.min(newKb.playerStats.sinhLuc, newKb.playerStats.maxSinhLuc);
    newKb.playerStats.linhLuc = Math.min(newKb.playerStats.linhLuc, newKb.playerStats.maxLinhLuc);
    newKb.playerStats.kinhNghiem = Math.min(newKb.playerStats.kinhNghiem, newKb.playerStats.maxKinhNghiem);
    
    const newTurn = typeof statsUpdates.turn === 'number' ? statsUpdates.turn : 1;
    if (newKb.playerStats.turn !== newTurn) {
        newKb.playerStats.turn = newTurn;
        turnIncremented = newTurn > (currentKb.playerStats.turn || 0);
    }


    if (newKb.currentPageHistory?.length === 1 && newKb.currentPageHistory[0] > newKb.playerStats.turn) {
        newKb.currentPageHistory = [newKb.playerStats.turn];
    } else if (!newKb.currentPageHistory || newKb.currentPageHistory.length === 0) {
        newKb.currentPageHistory = [newKb.playerStats.turn];
    }
    
    return { updatedKb: newKb, systemMessages: [], realmChanged, turnIncremented };
};

export const processStatsUpdate = (
    currentKb: KnowledgeBase,
    tagParams: Record<string, string>,
    turnForSystemMessages: number,
    isQuest: boolean = false
): { updatedKb: KnowledgeBase; systemMessages: GameMessage[]; realmChanged: boolean; turnIncremented: boolean; removedBinhCanh: boolean } => {
    const newKb = currentKb;
    
    // Sanitize currency to prevent runtime string concatenation issues
    if (newKb.playerStats && typeof newKb.playerStats.currency !== 'number') {
        newKb.playerStats.currency = parseInt(newKb.playerStats.currency as any, 10) || 0;
    }

    const systemMessages: GameMessage[] = [];
    let realmChanged = false;
    let turnIncremented = false;
    let removedBinhCanh = false;
    const oldRealm = newKb.playerStats.realm;
    const oldTurnForThisTagProcessing = newKb.playerStats.turn;
    const statsBeforeThisTag = { ...newKb.playerStats };
    const statsUpdates: Partial<PlayerStats> = {};

    Object.keys(tagParams).forEach(rawKey => {
        const key = rawKey.trim() as keyof PlayerStats;
        const valueStr = tagParams[rawKey].trim();
        
        if (key === 'kinhNghiem' && !newKb.worldConfig?.isCultivationEnabled) {
            console.warn(`STATS_UPDATE: Cultivation is disabled. Skipping kinhNghiem gain from tag.`);
            return;
        }

        if (key === 'Tutienhiep') {
            const val = parseInt(valueStr, 10);
            if (!isNaN(val) && (val === 0 || val === 1)) {
                newKb.playerStats.Tutienhiep = val;
                if (newKb.worldConfig) newKb.worldConfig.Tutienhiep = val;
                newKb.Tutienhiep = val;
                console.log(`[TagExtractor] Gán chỉ số Tutienhiep=${val}`);
            }
            return;
        }

        if (key === 'isInCombat') {
            // This key is deprecated and should be ignored.
            return;
        }

        if (!(key in newKb.playerStats)) {
            console.warn(`STATS_UPDATE: Unknown stat key "${key}" in playerStats. Skipping value "${valueStr}".`);
            return;
        }

        if (key === 'hieuUngBinhCanh') {
            (statsUpdates as any)[key] = valueStr.toLowerCase() === 'true';
            if (!( (statsUpdates as any)[key])) removedBinhCanh = true;
        } else if (key === 'turn') {
            // Sửa lại hệ thống cơ học: Không chấp nhận code turn="+1".
            // Bỏ qua hoàn toàn tham số turn từ tag của AI truyền vào, làm nó hoàn toàn vô nghĩa trong game.
            console.log(`STATS_UPDATE: Bỏ qua hoàn toàn tham số turn="${valueStr}" từ tag.`);
            return;
        } else if ((key === 'kinhNghiem' || key === 'sinhLuc' || key === 'linhLuc') && valueStr.endsWith('%')) {
            const isSubtraction = valueStr.includes('-');
            const percentageValue = valueStr.replace('+=', '').replace('-=', '').replace('+', '').replace('-', '').slice(0, -1);
            const percentage = parseFloat(percentageValue);
            
            if (!isNaN(percentage)) {
                const maxVal = key === 'sinhLuc' ? (newKb.playerStats.maxSinhLuc || 100) : 
                               key === 'linhLuc' ? (newKb.playerStats.maxLinhLuc || 100) : 
                               (newKb.playerStats.maxKinhNghiem || 1000);
                
                let delta = Math.floor(maxVal * (percentage / 100));
                if (isSubtraction) delta = -delta;

                if (key === 'kinhNghiem') {
                    // APPLY REGULATOR for EXP
                    const { finalGain, isCapped } = ExpRegulator.calculateSafeGain(newKb.playerStats.maxKinhNghiem, delta, isQuest);
                    const actualGain = finalGain;
                    if (isCapped) {
                        systemMessages.push({
                            id: 'exp-cap-pct-' + Date.now(),
                            type: 'system',
                            content: isQuest 
                                ? `Phần thưởng nhiệm vụ đạt giới hạn tối đa: +${actualGain} EXP (50% thanh cảnh giới).`
                                : (VIETNAMESE as any).expCappedNotice(actualGain),
                            timestamp: Date.now(),
                            turnNumber: turnForSystemMessages
                        });
                    }
                    (statsUpdates as any)[key] = (newKb.playerStats.kinhNghiem || 0) + actualGain;
                } else {
                    const currentVal = (newKb.playerStats[key] as number) || 0;
                    (statsUpdates as any)[key] = currentVal + delta;
                }
            }
        } else if (typeof DEFAULT_PLAYER_STATS[key] === 'number') {
            const baseValue = typeof newKb.playerStats[key] === 'number' 
                ? (newKb.playerStats[key] as number) 
                : (parseInt(newKb.playerStats[key] as any, 10) || 0);
            let numericValueToAssign: number | undefined = undefined;
        
            if (key === 'kinhNghiem' && (valueStr.startsWith('+=') || valueStr.startsWith('-=') || valueStr.startsWith('+') || valueStr.startsWith('-'))) {
                // EXP Special Handling with Regulator
                const deltaInput = valueStr.startsWith('+') && !valueStr.startsWith('+=') ? `+=${valueStr.substring(1)}` : 
                                   valueStr.startsWith('-') && !valueStr.startsWith('-=') ? `-=${valueStr.substring(1)}` : valueStr;
                
                const pureDelta = calculateNumericValue(0, deltaInput);
                const { finalGain, isCapped } = ExpRegulator.calculateSafeGain(newKb.playerStats.maxKinhNghiem, pureDelta, isQuest);
                
                if (isCapped) systemMessages.push({
                    id: 'exp-cap-num-' + Date.now(),
                    type: 'system',
                    content: isQuest 
                        ? `Phần thưởng nhiệm vụ đạt giới hạn tối đa: +${finalGain} EXP (50% thanh cảnh giới).`
                        : (VIETNAMESE as any).expCappedNotice(finalGain),
                    timestamp: Date.now(),
                    turnNumber: turnForSystemMessages
                });
                numericValueToAssign = baseValue + finalGain;
            } else {
                // Standard numeric stats
                const contextMax = key === 'sinhLuc' ? newKb.playerStats.maxSinhLuc : 
                                   key === 'linhLuc' ? newKb.playerStats.maxLinhLuc : 999999999;
                
                // If input is MAX, use context max
                if (valueStr.toUpperCase() === 'MAX') {
                    numericValueToAssign = contextMax;
                } else if (key === 'currency' && !valueStr.includes('=') && !valueStr.startsWith('+') && !valueStr.startsWith('-')) {
                    // Currency must be relative
                    console.warn(`STATS_UPDATE: Currency update MUST be relative (e.g. +=100). Got: ${valueStr}`);
                } else {
                    numericValueToAssign = calculateNumericValue(baseValue, valueStr);
                }
            }
        
            if (numericValueToAssign !== undefined) {
                (statsUpdates as any)[key] = numericValueToAssign;
            }
        }
    });

    newKb.playerStats = { ...newKb.playerStats, ...statsUpdates };
    if (newKb.playerStats.realm && typeof newKb.playerStats.realm !== 'string') {
        console.warn(`STATS_UPDATE: Realm value is not a string: ${newKb.playerStats.realm}. Reverting to old realm "${oldRealm}".`);
        newKb.playerStats.realm = oldRealm; 
        realmChanged = false; 
    }

    if (realmChanged) {
        const baseRealmStats = calculateRealmBaseStats(newKb.playerStats.realm, newKb, newKb.currentRealmBaseStats);
        newKb.playerStats = { ...newKb.playerStats, ...baseRealmStats };
    }
    newKb.playerStats = calculateEffectiveStats(newKb.playerStats, newKb.equippedItems, newKb.inventory);

    // CHỐT CHẶN CƠ HỌC: Sinh lực không giảm xuống dưới 20% trừ khi có death="true"
    const isDeath = String(tagParams.death || tagParams.isDeath || '').toLowerCase() === 'true' || tagParams.death === '1';
    if (!isDeath && statsBeforeThisTag.sinhLuc !== undefined) {
        const oldHp = statsBeforeThisTag.sinhLuc;
        const newHp = newKb.playerStats.sinhLuc;
        if (newHp < oldHp) {
            const maxHp = newKb.playerStats.maxSinhLuc || 100;
            const minHpFloor = Math.floor(maxHp * 0.20);
            const targetFloor = Math.min(oldHp, minHpFloor);
            if (newHp < targetFloor) {
                newKb.playerStats.sinhLuc = targetFloor;
            }
        }
    }

    const statsAfterThisTag = newKb.playerStats;
    const playerName = newKb.worldConfig?.playerName || newKb.playerStats?.name || "Nhân vật";

    if ((tagParams.sinhLuc || (tagParams.sinhLuc?.toUpperCase() === 'MAX')) && statsAfterThisTag.sinhLuc !== statsBeforeThisTag.sinhLuc) {
        const change = statsAfterThisTag.sinhLuc - statsBeforeThisTag.sinhLuc;
        const maxHpAfter = statsAfterThisTag.maxSinhLuc || 100;
        const maxHpBefore = statsBeforeThisTag.maxSinhLuc || 100;
        const percentChange = Math.round((change / maxHpAfter) * 100);
        const sign = change > 0 ? '+' : '';
        const logContent = `💚 ${playerName}: ${statsBeforeThisTag.sinhLuc}/${maxHpBefore}HP ➔ ${statsAfterThisTag.sinhLuc}/${maxHpAfter}HP (${sign}${Math.round(change)} (${sign}${percentChange}%))`;
        systemMessages.push({ id: 'stat-change-sinhLuc-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7), type: 'system', content: logContent, timestamp: Date.now(), turnNumber: turnForSystemMessages });
    }

    if ((tagParams.linhLuc || (tagParams.linhLuc?.toUpperCase() === 'MAX')) && statsAfterThisTag.linhLuc !== statsBeforeThisTag.linhLuc) {
        const change = statsAfterThisTag.linhLuc - statsBeforeThisTag.linhLuc;
        const maxMpAfter = statsAfterThisTag.maxLinhLuc || 50;
        const maxMpBefore = statsBeforeThisTag.maxLinhLuc || 50;
        const sign = change > 0 ? '+' : '';
        const logContent = `🔷 ${playerName}: ${statsBeforeThisTag.linhLuc}/${maxMpBefore}MP ➔ ${statsAfterThisTag.linhLuc}/${maxMpAfter}MP (${sign}${Math.round(change)})`;
        systemMessages.push({ id: 'stat-change-linhLuc-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7), type: 'system', content: logContent, timestamp: Date.now(), turnNumber: turnForSystemMessages });
    }

    if (tagParams.kinhNghiem && statsAfterThisTag.kinhNghiem !== statsBeforeThisTag.kinhNghiem) {
        const change = statsAfterThisTag.kinhNghiem - statsBeforeThisTag.kinhNghiem;
        const sign = change > 0 ? '+' : '';
        const maxExp = statsAfterThisTag.maxKinhNghiem || 100;
        const logContent = `⭐ ${playerName}: ${statsBeforeThisTag.kinhNghiem}/${maxExp}EXP ➔ ${statsAfterThisTag.kinhNghiem}/${maxExp}EXP (${sign}${Math.round(change)})`;
        systemMessages.push({ id: 'stat-change-kinhNghiem-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7), type: 'system', content: logContent, timestamp: Date.now(), turnNumber: turnForSystemMessages });
    }

    if ((tagParams.currency || tagParams.linhThach) && statsAfterThisTag.currency !== statsBeforeThisTag.currency) {
        const change = (statsAfterThisTag.currency || 0) - (statsBeforeThisTag.currency || 0);
        const sign = change > 0 ? '+' : '';
        const currencyName = newKb.worldConfig?.currencyName || "tiền tệ";
        const logContent = `💰 ${playerName}: ${statsBeforeThisTag.currency || 0} ➔ ${statsAfterThisTag.currency || 0} ${currencyName} (${sign}${change.toLocaleString('vi-VN')} ${currencyName})`;
        systemMessages.push({
            id: 'stat-change-currency-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
            type: 'system',
            content: logContent,
            timestamp: Date.now(),
            turnNumber: turnForSystemMessages
        });
    }

    if (tagParams.permanentSinhLucBonus && statsAfterThisTag.permanentSinhLucBonus !== statsBeforeThisTag.permanentSinhLucBonus) {
        const change = (statsAfterThisTag.permanentSinhLucBonus || 0) - (statsBeforeThisTag.permanentSinhLucBonus || 0);
        systemMessages.push({ id: 'stat-change-permanentSinhLucBonus-' + Date.now(), type: 'system', content: `🧬 Sinh lực tối đa vĩnh viễn tăng thêm: ${change > 0 ? '+' : ''}${Math.round(change)} (Tổng cộng: ${statsAfterThisTag.permanentSinhLucBonus}).`, timestamp: Date.now(), turnNumber: turnForSystemMessages });
    }

    if (newKb.playerStats.kinhNghiem < 0) newKb.playerStats.kinhNghiem = 0;
    newKb.playerStats.sinhLuc = Math.min(newKb.playerStats.sinhLuc, newKb.playerStats.maxSinhLuc);
    newKb.playerStats.linhLuc = Math.min(newKb.playerStats.linhLuc, newKb.playerStats.maxLinhLuc);

    return { updatedKb: newKb, systemMessages, realmChanged, turnIncremented, removedBinhCanh };
};

export const processRemoveBinhCanhEffect = (
    currentKb: KnowledgeBase,
    tagParams: Record<string, string>,
    turnForSystemMessages: number
): { updatedKb: KnowledgeBase; systemMessages: GameMessage[]; removedBinhCanh: boolean } => {
    const newKb = currentKb;
    const systemMessages: GameMessage[] = [];
    let removedBinhCanh = false;

    if (!newKb.worldConfig?.isCultivationEnabled) {
        return { updatedKb: newKb, systemMessages, removedBinhCanh };
    }

    // Check if the character is actually in a bottleneck state
    if (newKb.playerStats.hieuUngBinhCanh) {
        const realmBeforeBreakthrough = newKb.playerStats.realm;
        let mainRealmBefore = "";

        // Find the current main realm based on the full realm string
        const sortedMainRealms = [...newKb.realmProgressionList].sort((a, b) => b.length - a.length);
        for (const r of sortedMainRealms) {
            if (realmBeforeBreakthrough.startsWith(r)) {
                mainRealmBefore = r;
                break;
            }
        }
        
        const mainRealmIndex = newKb.realmProgressionList.indexOf(mainRealmBefore);

        // Check if there is a next realm to advance to
        if (mainRealmBefore && mainRealmIndex < newKb.realmProgressionList.length - 1) {
            const nextMainRealmName = newKb.realmProgressionList[mainRealmIndex + 1];
            const nextMainRealmIndex = mainRealmIndex + 1;

            const isTutienhiep = newKb.Tutienhiep === 1 || newKb.worldConfig?.Tutienhiep === 1 || newKb.playerStats?.Tutienhiep === 1;

            // Cơ chế khóa tuổi thọ cho các game tiên hiệp/tu tiên (chỉ áp dụng khi Tutienhiep === 1 và từ cảnh giới thứ 3 trở lên)
            if (isTutienhiep && nextMainRealmIndex >= 2) {
                const requiredAge = (nextMainRealmIndex - 1) * 20;
                const currentAge = Math.floor((newKb.playerStats.maxThoNguyen || 120) - (newKb.playerStats.thoNguyen || (newKb.playerStats.maxThoNguyen || 120)));
                
                if (currentAge < requiredAge) {
                    systemMessages.push({
                        id: 'breakthrough-age-lock-' + Date.now(),
                        type: 'system',
                        content: `🛑 【ĐỘT PHÁ THẤT BẠI】 Cốt cách/Căn cơ chưa đủ chín sương nắng! Muốn độ kiếp lên ${nextMainRealmName} cần đạt tối thiểu ${requiredAge} tuổi (Hiện tại: ${currentAge} tuổi).`,
                        timestamp: Date.now(), 
                        turnNumber: turnForSystemMessages
                    });
                    // Giữ nguyên bình cảnh và không cho phép tiến hóa
                    newKb.playerStats.hieuUngBinhCanh = true;
                    return { updatedKb: newKb, systemMessages, removedBinhCanh: false };
                }
            }
            
            // 1. Immediately set realm to next major realm
            const firstMinor = newKb.minorRealmProgressionList && newKb.minorRealmProgressionList.length > 0 
                ? newKb.minorRealmProgressionList[0] 
                : SUB_REALM_NAMES[0];
            newKb.playerStats.realm = `${nextMainRealmName} ${firstMinor}`;
            
            // 2. Reset EXP to 0.
            newKb.playerStats.kinhNghiem = 0;
            
            // 3. Set hieuUngBinhCanh to false.
            newKb.playerStats.hieuUngBinhCanh = false;
            removedBinhCanh = true;

            // Recalculate base stats for the new realm
            const newBaseStats = calculateRealmBaseStats(newKb.playerStats.realm, newKb, newKb.currentRealmBaseStats);
            newKb.playerStats = { ...newKb.playerStats, ...newBaseStats };

            // Give lifespan bonus
            const lifespanBonus = 100 * Math.pow(1.5, mainRealmIndex);
            newKb.playerStats.maxThoNguyen += lifespanBonus;
            newKb.playerStats.thoNguyen += lifespanBonus;

            // Heal to full after major breakthrough
            newKb.playerStats.sinhLuc = newKb.playerStats.maxSinhLuc;
            newKb.playerStats.linhLuc = newKb.playerStats.maxLinhLuc;

            // Add system messages
            systemMessages.push({
                id: 'major-breakthrough-' + Date.now(), type: 'system',
                content: `⚡ 【ĐỘT PHÁ】 Chúc mừng ${newKb.worldConfig?.playerName || 'bạn'} đã thành công đột phá đại cảnh giới, từ ${realmBeforeBreakthrough} tiến vào ${newKb.playerStats.realm}!`,
                timestamp: Date.now(), turnNumber: turnForSystemMessages
            });
            systemMessages.push({
                id: 'lifespan-increase-' + Date.now(), type: 'system',
                content: `⏳ Thọ nguyên của bạn đã được tăng thêm ${Math.floor(lifespanBonus)} năm!`,
                timestamp: Date.now(), turnNumber: turnForSystemMessages
            });

        } else {
            // This case means they are at the absolute highest realm. Just remove bottleneck.
            newKb.playerStats.hieuUngBinhCanh = false;
            removedBinhCanh = true;
             systemMessages.push({
                id: 'binh-canh-removed-maxlevel-' + Date.now(), type: 'system',
                content: `Bình cảnh đã được gỡ bỏ, nhưng bạn đã ở cảnh giới cao nhất!`,
                timestamp: Date.now(), turnNumber: turnForSystemMessages
            });
        }
    } else {
        // Player was not in a bottleneck, so do nothing.
         systemMessages.push({
            id: 'binh-canh-remove-failed-notactive-' + Date.now(), type: 'system',
            content: `[DEBUG] Lệnh gỡ bình cảnh không có tác dụng vì bạn không ở trong trạng thái bình cảnh.`,
            timestamp: Date.now(), turnNumber: turnForSystemMessages
        });
    }

    return { updatedKb: newKb, systemMessages, removedBinhCanh };
};

export const processBecomeSpecialStatus = (
    currentKb: KnowledgeBase,
    tagParams: Record<string, string>,
    tagName: 'BECOMEPRISONER' | 'BECOMESLAVE',
    turnForSystemMessages: number
): { updatedKb: KnowledgeBase; systemMessages: GameMessage[]; newVectorMetadata?: VectorMetadata; } => {
    const newKb = currentKb;
    const systemMessages: GameMessage[] = [];
    let newVectorMetadata: VectorMetadata | undefined = undefined;
    const statusType = tagName === 'BECOMEPRISONER' ? 'prisoner' : 'slave';
    
    const ownerName = tagParams.name || 'Không rõ';
    
    const ownerNpcIndex = newKb.discoveredNPCs.findIndex(n => n.name === ownerName);
    if (ownerNpcIndex === -1) {
        console.warn(`${tagName}: Owner NPC "${ownerName}" not found.`);
        systemMessages.push({
            id: `error-owner-not-found-${Date.now()}`,
            type: 'error',
            content: `Lỗi: Không tìm thấy NPC có tên "${ownerName}" để trở thành chủ nhân.`,
            timestamp: Date.now(),
            turnNumber: turnForSystemMessages
        });
        return { updatedKb: newKb, systemMessages };
    }
    
    const ownerNpc = newKb.discoveredNPCs[ownerNpcIndex];
    
    // Create the new Master entity, explicitly copying all PersonBase properties
    const personBaseData: PersonBase = {
        id: ownerNpc.id,
        name: ownerNpc.name,
        title: ownerNpc.title,
        gender: ownerNpc.gender,
        description: ownerNpc.description,
        affinity: ownerNpc.affinity,
        avatarUrl: ownerNpc.avatarUrl,
        realm: ownerNpc.realm,
        tuChat: ownerNpc.tuChat,
        spiritualRoot: ownerNpc.spiritualRoot,
        specialPhysique: ownerNpc.specialPhysique,
        stats: ownerNpc.stats,
    };
    
    const newMaster: Master = {
        ...personBaseData,
        mood: 'Bình Thường',
        needs: { 'Dục Vọng': 50, 'Tham Vọng': 50, 'An Toàn': 50, 'Giải Trí': 50 },
        currentGoal: `Quan sát ${statusType} mới.`,
        favor: 0,
    };
    newKb.master = newMaster;

    // Create vector metadata for the new master
    newVectorMetadata = { entityId: newMaster.id, entityType: 'master', text: formatPersonForEmbedding(newMaster) };

    // Keep the NPC in the regular discovered list so they exist and can be referenced
    // (Do not splice from discoveredNPCs)

    const willpower = parseInt(tagParams.willpower || '55', 10);
    const resistance = parseInt(tagParams.resistance || '80', 10);
    const obedience = parseInt(tagParams.obedience || '15', 10);

    const newStatus: PlayerSpecialStatus = {
        type: statusType,
        ownerName,
        willpower: Math.max(0, Math.min(100, isNaN(willpower) ? 55 : willpower)),
        resistance: Math.max(0, Math.min(100, isNaN(resistance) ? 80 : resistance)),
        obedience: Math.max(0, Math.min(100, isNaN(obedience) ? 15 : obedience)),
        fear: Math.max(0, Math.min(100, parseInt(tagParams.fear || '30', 10))),
        trust: Math.max(0, Math.min(100, parseInt(tagParams.trust || '5', 10))),
    };

    newKb.playerStats.playerSpecialStatus = newStatus;

    systemMessages.push({
        id: `player-status-change-${statusType}-${Date.now()}`,
        type: 'system',
        content: `⛓️ Bạn đã trở thành ${statusType === 'prisoner' ? 'tù nhân' : 'nô lệ'} của ${ownerName}.`,
        timestamp: Date.now(),
        turnNumber: turnForSystemMessages
    });

    return { updatedKb: newKb, systemMessages, newVectorMetadata };
};

export const processPlayerSpecialStatusUpdate = (
    currentKb: KnowledgeBase,
    tagParams: Record<string, string>,
    turnForSystemMessages: number
): { updatedKb: KnowledgeBase; systemMessages: GameMessage[] } => {
    const newKb = currentKb;
    const systemMessages: GameMessage[] = [];

    if (!newKb.playerStats.playerSpecialStatus) {
        console.warn("PLAYER_SPECIAL_STATUS_UPDATE: Player does not have a special status to update.");
        return { updatedKb: newKb, systemMessages };
    }

    const updateNumericField = (field: keyof PlayerSpecialStatus) => {
        const paramValue = tagParams[field as string];
        if (paramValue) {
            const changeStr = paramValue.trim();
            const currentValue = (newKb.playerStats.playerSpecialStatus?.[field] as number) || 0;
            let newValue: number | null = null;
    
            if (changeStr.startsWith('+=')) {
                newValue = currentValue + parseInt(changeStr.substring(2), 10);
            } else if (changeStr.startsWith('-=')) {
                newValue = currentValue - parseInt(changeStr.substring(2), 10);
            } else if (changeStr.startsWith('=')) {
                newValue = parseInt(changeStr.substring(1), 10);
            } else {
                newValue = currentValue + parseInt(changeStr, 10);
            }
            
            if (newValue !== null && !isNaN(newValue)) {
                // Clamping values
                if (field === 'willpower' || field === 'resistance' || field === 'obedience' || field === 'fear' || field === 'trust') {
                    (newKb.playerStats.playerSpecialStatus as any)[field] = Math.max(0, Math.min(100, newValue));
                }
            }
        }
    };
    
    updateNumericField('willpower');
    updateNumericField('resistance');
    updateNumericField('obedience');
    updateNumericField('fear' as keyof PlayerSpecialStatus);
    updateNumericField('trust' as keyof PlayerSpecialStatus);

    return { updatedKb: newKb, systemMessages };
};

export const processMcRename = (
    currentKb: KnowledgeBase,
    tagParams: Record<string, string>,
    turnForSystemMessages: number
): { updatedKb: KnowledgeBase; systemMessages: GameMessage[] } => {
    const newKb = currentKb;
    const rawNewName = tagParams.newName || tagParams.name || tagParams.position_var_0 || tagParams.to;
    const oldName = newKb.worldConfig?.playerName || newKb.playerStats?.name || "MC";

    if (!rawNewName) {
        console.warn("MC_RENAME: No new name provided in tagParams:", tagParams);
        return { updatedKb: newKb, systemMessages: [] };
    }

    // Clean newName from any existing bracket formats
    let cleanNewName = rawNewName.trim();
    const bracketMatch = cleanNewName.match(/^([^\(\)]+)\s*\(/);
    if (bracketMatch) {
        cleanNewName = bracketMatch[1].trim();
    }

    // Ensure original name is tracked and clean
    let originalName = newKb.worldConfig?.originalPlayerName || newKb.playerStats?.originalPlayerName;
    if (!originalName) {
        const saveName = newKb.manualSaveName || newKb.worldConfig?.saveGameName || "";
        const match = saveName.match(/(?:của|của\s+)([\p{L}\p{M}\s\w]+)/iu);
        if (match && match[1].trim() && match[1].trim() !== "Người chơi" && match[1].trim() !== "Tân Đạo Hữu") {
            originalName = match[1].trim();
        } else {
            originalName = oldName;
        }
    }

    if (originalName) {
        const origBracketMatch = originalName.match(/^([^\(\)]+)\s*\(/);
        if (origBracketMatch) {
            originalName = origBracketMatch[1].trim();
        }
    }

    // Prevent originalName being exactly same as cleanNewName to avoid "Name (Name)"
    if (originalName === cleanNewName) {
        originalName = undefined;
    }

    if (newKb.worldConfig) {
        newKb.worldConfig.playerName = cleanNewName;
        newKb.worldConfig.originalPlayerName = originalName;
    } else {
        (newKb as any).worldConfig = { playerName: cleanNewName, originalPlayerName: originalName };
    }

    if (newKb.playerStats) {
        newKb.playerStats.name = cleanNewName;
        (newKb.playerStats as any).playerName = cleanNewName;
        newKb.playerStats.originalPlayerName = originalName;
    }

    // Update location names if they referenced old MC name
    if (oldName && oldName !== "MC" && oldName !== "Người chơi" && oldName !== cleanNewName) {
        const cleanOldName = oldName.replace(/\s*\(.*/, "").trim();
        if (newKb.discoveredLocations && Array.isArray(newKb.discoveredLocations)) {
            newKb.discoveredLocations = newKb.discoveredLocations.map(loc => {
                if (loc.name && loc.name.includes(cleanOldName)) {
                    return { ...loc, name: loc.name.replace(new RegExp(cleanOldName, 'g'), cleanNewName) };
                }
                return loc;
            });
        }
    }

    const systemMessages: GameMessage[] = [{
        id: `mc-rename-${Date.now()}`,
        type: 'system',
        content: `📝 Danh tính nhân vật chính đã được cập nhật: ${oldName} ➔ ${cleanNewName}.`,
        timestamp: Date.now(),
        turnNumber: turnForSystemMessages
    }];

    return { updatedKb: newKb, systemMessages };
};

export const processBecomeFree = (
    currentKb: KnowledgeBase,
    turnForSystemMessages: number
): { updatedKb: KnowledgeBase; systemMessages: GameMessage[] } => {
    const newKb = currentKb;
    
    newKb.playerStats.playerSpecialStatus = null;
    newKb.master = null; // Clear the master object
    
    const systemMessages: GameMessage[] = [{
        id: `player-become-free-${Date.now()}`,
        type: 'system',
        content: `🕊️ Bạn đã giành lại được tự do!`,
        timestamp: Date.now(),
        turnNumber: turnForSystemMessages
    }];
    
    return { updatedKb: newKb, systemMessages };
};