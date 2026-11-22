// FIX: Add React import to resolve namespace errors.
import React from 'react';
import { KnowledgeBase, GameMessage, VectorMetadata, BatchSummaryRequestItem } from './../types';
import { parseTagValue } from './parseTagValue'; 
import { fastCloneKb } from './cloneKb';
import { extractMainStoryContent } from './journalParser';
import { processPlayerStatsInit, processStatsUpdate, processRemoveBinhCanhEffect, processBecomeSpecialStatus, processPlayerSpecialStatusUpdate, processBecomeFree, processMcRename } from './tagProcessors/statsTagProcessor';
import { processItemAcquired, processItemConsumed, processItemUpdate, processShopItem, processItemBought } from './tagProcessors/itemTagProcessor';
import { processSkillLearned, processSkillUpdate, processSkillUsed } from './tagProcessors/skillTagProcessor';
import { 
    processQuestAssigned, 
    processQuestUpdated, 
    processQuestCompleted, 
    processQuestFailed,   
    processObjectiveUpdate 
} from './tagProcessors/questTagProcessor';
import { 
    processNpc, 
    processNpcUpdate, 
    processNpcRemove,
    processAppearanceUpdate,
    processNpcMove,
    processNpcRename
} from './tagProcessors/npcTagProcessor';
import { 
    processYeuThu, 
    processYeuThuAppear,
    processYeuThuRemove 
} from './tagProcessors/yeuThuTagProcessor';
import { 
    processMainLocation, 
    processSubLocation, 
    processLocationUpdate, 
    processLocationChange,
    applyAutoLayout
} from './tagProcessors/locationTagProcessor';
import { processLocationSafety } from './tagProcessors/LocationSafetyProcessor';
import { 
    processFactionDiscovered, 
    processFactionUpdate, 
    processFactionRemove 
} from './tagProcessors/factionTagProcessor';
import { processWorldLoreAdd, 
    processWorldLoreUpdate 
} from './tagProcessors/worldLoreTagProcessor';
import { SacredTimelineService } from '../services/SacredTimelineService';
import { MasterIntegrityService } from '../services/MasterIntegrityService';
import { processSetCombatStatus, processBeginCombat } from './tagProcessors/combatTagProcessor';
import { 
    processCompanionAdd, 
    processCompanionLeave, 
    processCompanionStatsUpdate 
} from './tagProcessors/companionTagProcessor';
import { processMessage, processRealmList } from './tagProcessors/systemInfoTagProcessor';
import { processStatusEffectApply, processStatusEffectRemove } from './tagProcessors/statusEffectTagProcessor';
import { processProfessionLearned } from './tagProcessors/professionTagProcessor';
import { processAuctionItem, processNpcBid, processAuctionNpc } from './tagProcessors/auctionTagProcessor';
import { processChangeTime } from './tagProcessors/timeTagProcessor';
import { parseXmlUpdatesToLegacyTags } from './xmlUpdateParser';
import { processPrisonerAdd, processWifeAdd, processSlaveAdd, processWifeUpdate, processSlaveUpdate, processPrisonerUpdate, processWifeRemove, processSlaveRemove, processPrisonerRemove } from './tagProcessors/companionAndPrisonerTagProcessor';
import { processMasterUpdate } from './tagProcessors/masterTagProcessor';
import { processSlaveForSale, processAuctionSlave, processPrisonerForSale } from './tagProcessors/slaveTagProcessor';
import { generateEmbeddingsWithRetry } from './../services/embeddingService';
import { processBeginDungeonCrawl, processProgressDungeonStage, processEndDungeonCrawl } from './tagProcessors/dungeonTagProcessor';
import { processBecomeFugitive } from './tagProcessors/fugitiveTagProcessor';
import { processCoreMemoryAdd } from './tagProcessors/memoryTagProcessor';
import { processMainQuestSetup, processProgressMainQuest } from './tagProcessors/mainQuestTagProcessor';
import { processUnlockMilestone } from './tagProcessors/milestoneTagProcessor';
import { processEconomicZone } from './tagProcessors/economicZoneTagProcessor';
import { processRelationshipUpdate } from './tagProcessors/relationshipTagProcessor';
import { processLocationReparent } from './tagProcessors/locationReparentTagProcessor';
import { processInteraction } from './tagProcessors/interactionTagProcessor';
import { processGenerateEquipment } from './tagProcessors/generateEquipmentTagProcessor';
import { processMoneyChange } from './tagProcessors/currencyTagProcessor';
import { generateBatchDescriptionSummaries } from '../services/geminiService';
import { NpcIntimacyDemandService } from '../services/NpcIntimacyDemandService';
import { SexOverExertionService } from '../services/SexOverExertionService';
import { VALID_GAME_TAG_NAMES, IGNORED_SYSTEM_TAG_PREFIXES } from '../constants/validGameTags';
import { updateEntityStatsFromRealm } from './statsCalculationUtils';


export { parseTagValue }; 

const addOrUpdateVectorMetadata = (
    metadataQueue: VectorMetadata[],
    newMetadata: VectorMetadata
) => {
    const existingIndex = metadataQueue.findIndex(m => m.entityId === newMetadata.entityId);
    if (existingIndex > -1) {
        metadataQueue[existingIndex] = newMetadata;
    } else {
        metadataQueue.push(newMetadata);
    }
};

export const sanitizeKbBackslashes = (kb: KnowledgeBase): KnowledgeBase => {
    if (!kb) return kb;
    const cleanStr = (str: string | undefined) => str ? str.replace(/\\/g, '') : str;
    const cleanObj = (obj: any): any => {
        if (!obj || typeof obj !== 'object') return obj;
        if (Array.isArray(obj)) {
            return obj.map(item => cleanObj(item));
        }
        const newObj: any = {};
        for (const key of Object.keys(obj)) {
            const val = obj[key];
            if (typeof val === 'string') {
                newObj[key] = (key === 'id' || key === 'name' || key === 'title' || key === 'description') ? cleanStr(val) : val;
            } else {
                newObj[key] = cleanObj(val);
            }
        }
        return newObj;
    };
    return cleanObj(kb);
};

export const performTagProcessing = async (
    currentKb: KnowledgeBase, 
    tagBatch: string[], 
    turnForSystemMessages: number,
    logNpcAvatarPromptCallback?: (prompt: string) => void 
): Promise<{ 
    newKb: KnowledgeBase;
    turnIncrementedByTag: boolean;
    systemMessagesFromTags: GameMessage[];
    realmChangedByTag: boolean;
    appliedBinhCanhViaTag: boolean;
    removedBinhCanhViaTag: boolean;
    affinityChanges: { name: string, delta: number }[];
    mapNeedsLayout: boolean;
    tagErrors?: { originalTag: string; tagName: string; reason: string }[];
    unrecognizedTags: string[];
}> => {
    if (!currentKb) {
        console.error("performTagProcessing called with null currentKb!");
        return {
            newKb: {} as KnowledgeBase,
            turnIncrementedByTag: false,
            systemMessagesFromTags: [],
            realmChangedByTag: false,
            appliedBinhCanhViaTag: false,
            removedBinhCanhViaTag: false,
            affinityChanges: [],
            mapNeedsLayout: false,
            tagErrors: [],
            unrecognizedTags: []
        };
    }
    let workingKb: KnowledgeBase = fastCloneKb(currentKb);
    let turnIncrementedByAnyTag = false;
    const allSystemMessages: GameMessage[] = [];
    let realmChangedByAnyTag = false;
    let removedBinhCanhByAnyTag = false;
    const metadataToVectorize: VectorMetadata[] = [];
    const affinityChanges: { name: string, delta: number }[] = [];
    const summaryQueue: BatchSummaryRequestItem[] = [];
    const tagErrors: { reason: string; originalTag: string; tagName: string }[] = [];
    const unrecognizedTags: string[] = [];
    let mapNeedsLayout = false;
    const processedQuestsThisBatch = new Set<string>();
    const processedEventsThisBatch = new Set<string>();

    // 1. Tự động chuẩn hóa các mục định dạng XML (nếu có) sang định dạng tag thực thi chuẩn
    const preProcessedTagBatch: string[] = [];
    (tagBatch || []).forEach(item => {
        if (!item || typeof item !== 'string') return;
        const trimmed = item.trim();
        if (trimmed.startsWith('<') && (trimmed.includes('>') || trimmed.endsWith('>'))) {
            const converted = parseXmlUpdatesToLegacyTags(trimmed);
            if (converted && converted.length > 0) {
                preProcessedTagBatch.push(...converted);
            } else {
                preProcessedTagBatch.push(trimmed);
            }
        } else {
            preProcessedTagBatch.push(trimmed);
        }
    });

    // Không khử trùng lặp toàn bộ nữa, dùng thẳng tagBatch nhưng chỉ giữ tối đa 1 thẻ CHANGE_TIME trong cùng lượt để tránh trùng lặp hiển thị/tăng hạn thọ nguyên
    let hasSeenChangeTime = false;
    const rawTagBatch = preProcessedTagBatch
        .map(tag => tag.trim())
        .filter(Boolean)
        .filter(tag => {
            const uTag = tag.toUpperCase();
            if (uTag.startsWith('[CHANGE_TIME') || uTag.startsWith('CHANGE_TIME')) {
                if (hasSeenChangeTime) {
                    console.log(`[CƠ CHẾ NGĂN LỖI - THỜI GIAN]: Bỏ qua thẻ CHANGE_TIME trùng lặp tiếp theo để tránh tăng thời gian quá độ.`);
                    return false;
                }
                hasSeenChangeTime = true;
            }
            return true;
        });
    // Count YEUTHU_APPEAR tags before processing to provide context for group encounters
    const yeuThuAppearCount = rawTagBatch.filter(tag => tag.toUpperCase().startsWith('[YEUTHU_APPEAR')).length;
    
    // Check if any quest is being completed/resolved in this batch to allow higher EXP cap
    const hasQuestCompletion = rawTagBatch.some(tag => {
        const uTag = tag.toUpperCase();
        return uTag.startsWith('[QUEST_COMPLETED') || uTag.startsWith('[QUEST_RESOLVED');
    });

    const isBattlePlusOne = workingKb.battlePlusOneTurn === turnForSystemMessages;

    // Định nghĩa mức độ ưu tiên xử lý tag hệ thống giúp NPC/Location cơ sở tạo trước, hàng hóa phụ thuộc tạo sau
    const getTagPriority = (tagName: string): number => {
        const name = tagName.toUpperCase();
        if ([
            'MAINLOCATION', 'SUBLOCATION', 'NPC', 'NPC_CREATE', 'NPC_RENAME', 
            'YEUTHU', 'YEUTHU_APPEAR', 'FACTION_DISCOVERED', 'WORLD_LORE_ADD', 
            'PLAYER_STATS_INIT', 'MC_RENAME'
        ].includes(name)) {
            return 1;
        }
        if ([
            'NPC_MOVE', 'NPC_UPDATE', 'WIFE_UPDATE', 'SLAVE_UPDATE', 'PRISONER_UPDATE', 
            'LOCATION_UPDATE', 'LOCATION_REPARENT', 'WORLD_LORE_UPDATE', 'FACTION_UPDATE', 
            'ECON_ZONE', 'QUEST_ASSIGNED', 'QUEST_UPDATED', 'SKILL_UPDATE', 'ITEM_UPDATE'
        ].includes(name)) {
            return 2;
        }
        if ([
            'SLAVE_FOR_SALE', 'PRISONER_FOR_SALE', 'SHOP_ITEM', 'ITEM_ACQUIRED', 
            'WIFE_ADD', 'SLAVE_ADD', 'PRISONER_ADD', 'WIFE_REMOVE', 'SLAVE_REMOVE', 
            'PRISONER_REMOVE', 'COMPANION_ADD', 'COMPANION_JOIN', 'COMPANION_LEAVE', 
            'BECOMESLAVE', 'BECOMEPRISONER', 'QUEST_COMPLETED', 'QUEST_FAILED'
        ].includes(name)) {
            return 3;
        }
        return 4;
    };

    // Sắp xếp tag để bảo đảm an toàn cho các thực thể phụ thuộc
    const sortedTagBatch = [...rawTagBatch].sort((a, b) => {
        const matchA = a.match(/^\[([A-Z_]+)/i);
        const matchB = b.match(/^\[([A-Z_]+)/i);
        const nameA = matchA ? matchA[1].toUpperCase() : '';
        const nameB = matchB ? matchB[1].toUpperCase() : '';
        return getTagPriority(nameA) - getTagPriority(nameB);
    });

    for (const originalTag of sortedTagBatch) {
        // Use the s flag for multiline tags content
        const mainMatch = originalTag.match(/^\[([A-Z_]+)(?::\s*([\s\S]*))?\]$/i);
        if (!mainMatch || !mainMatch[1]) {
             continue;
        }
        const tagName = mainMatch[1].trim().toUpperCase();
        
        // 1. Kiểm tra xem có thuộc danh sách bỏ qua im lặng không (Silent Ignore)
        const isIgnoredPrefix = IGNORED_SYSTEM_TAG_PREFIXES.some(prefix => tagName.startsWith(prefix));
        if (isIgnoredPrefix) {
            continue; // Bỏ qua trong im lặng
        }

        let rawTagParameterString = mainMatch[2]; // Có thể là undefined nếu không có dấu hai chấm
        
        // [STRICT VALIDATION] Bỏ qua các tag quan trọng nếu không có nội dung (thiếu dấu hai chấm)
        if (rawTagParameterString === undefined && (tagName === "QUEST_COMPLETED" || tagName === "EVENT_COMPLETE")) {
             console.log(`[STRICT PARSER] Bỏ qua tag ${tagName} vì thiếu cấu trúc ":" (chỉ là liệt kê hoặc kiểm tra).`);
             continue;
        }

        let tagValueStr = rawTagParameterString ? rawTagParameterString.trim() : '';
        
        // Remove trailing bracket if it escaped into the parameter string (shouldn't happen with improved regex but for safety)
        if (tagValueStr.endsWith(']')) {
            tagValueStr = tagValueStr.substring(0, tagValueStr.length - 1).trim();
        }

        const cleanedTagParameterString = tagValueStr;
        
        let tagParams: Record<string, string> = {};
         if (cleanedTagParameterString) {
            if (tagName === 'MESSAGE' && !cleanedTagParameterString.includes('=')) {
                tagParams = { message: cleanedTagParameterString.replace(/^"|"$/g, '') };
            } else {
                tagParams = parseTagValue(cleanedTagParameterString);
            }
        }

        if (isBattlePlusOne) {
            if (tagName === 'PRISONER_ADD' || tagName === 'NPC_CREATE' || tagName === 'NPC') {
                console.log(`[CƠ CHẾ NGĂN LỖI - BATTLE+1]: Đã bỏ qua thẻ ${tagName} của ${tagParams.name || 'NPC'} tại lượt battle+1 để tránh trùng lặp dữ liệu cơ học.`);
                continue; // Bỏ qua hoàn toàn, lờ tag này đi
            }
        }

        let isHandled = true;
        try {
            // Nhường luồng cho trình duyệt render để tránh đơ màn hình
            await new Promise(resolve => setTimeout(resolve, 0));

            switch (tagName) {
                case 'MONEY_CHANGE': {
                    const { updatedKb, systemMessages } = processMoneyChange(workingKb, tagParams, turnForSystemMessages);
                    workingKb = updatedKb;
                    allSystemMessages.push(...systemMessages);
                    break;
                }
                case 'BECOME_FUGITIVE': {
                    const { updatedKb, systemMessages } = processBecomeFugitive(workingKb, tagParams, turnForSystemMessages);
                    workingKb = updatedKb;
                    allSystemMessages.push(...systemMessages);
                    break;
                }
                case 'RELATIONSHIP_UPDATE': {
                    const { updatedKb, systemMessages, updatedVectorMetadata, affinityChange, error } = processRelationshipUpdate(workingKb, tagParams, turnForSystemMessages, originalTag);
                    if (error) {
                        tagErrors.push(error);
                    } else {
                        workingKb = updatedKb;
                        allSystemMessages.push(...systemMessages);
                        if (updatedVectorMetadata) addOrUpdateVectorMetadata(metadataToVectorize, updatedVectorMetadata);
                        if (affinityChange) affinityChanges.push(affinityChange);
                    }
                    break;
                }
                case 'UNLOCK_MILESTONE': {
                    const { updatedKb, systemMessages } = processUnlockMilestone(workingKb, tagParams, turnForSystemMessages);
                    workingKb = updatedKb;
                    allSystemMessages.push(...systemMessages);
                    break;
                }
                case 'MAIN_QUEST_SETUP': {
                    const { updatedKb, systemMessages } = processMainQuestSetup(workingKb, tagParams, turnForSystemMessages);
                    workingKb = updatedKb;
                    allSystemMessages.push(...systemMessages);
                    break;
                }
                case 'PROGRESS_MAIN_QUEST': {
                    const { updatedKb, systemMessages } = processProgressMainQuest(workingKb, tagParams, turnForSystemMessages);
                    workingKb = updatedKb;
                    allSystemMessages.push(...systemMessages);
                    break;
                }
                case 'CORE_MEMORY_ADD': {
                    const { updatedKb, systemMessages } = processCoreMemoryAdd(workingKb, tagParams, turnForSystemMessages);
                    workingKb = updatedKb;
                    allSystemMessages.push(...systemMessages);
                    break;
                }
                case 'ECON_ZONE': {
                    const { updatedKb, systemMessages } = processEconomicZone(workingKb, tagParams, turnForSystemMessages);
                    workingKb = updatedKb;
                    allSystemMessages.push(...systemMessages);
                    break;
                }
                case 'BEGIN_DUNGEON_CRAWL': {
                    const { updatedKb, systemMessages } = processBeginDungeonCrawl(workingKb, tagParams, turnForSystemMessages);
                    workingKb = updatedKb;
                    allSystemMessages.push(...systemMessages);
                    break;
                }
                case 'PROGRESS_DUNGEON_STAGE': {
                    const { updatedKb, systemMessages } = processProgressDungeonStage(workingKb, tagParams, turnForSystemMessages);
                    workingKb = updatedKb;
                    allSystemMessages.push(...systemMessages);
                    break;
                }
                case 'END_DUNGEON_CRAWL': {
                    const { updatedKb, systemMessages } = processEndDungeonCrawl(workingKb, tagParams, turnForSystemMessages);
                    workingKb = updatedKb;
                    allSystemMessages.push(...systemMessages);
                    break;
                }
                 case 'ITEM_UPDATE': {
                    const { updatedKb, systemMessages, updatedVectorMetadata } = processItemUpdate(workingKb, tagParams, turnForSystemMessages);
                    workingKb = updatedKb;
                    allSystemMessages.push(...systemMessages);
                    if (updatedVectorMetadata) addOrUpdateVectorMetadata(metadataToVectorize, updatedVectorMetadata);
                    break;
                }
                case 'SKILL_UPDATE': { 
                    const { updatedKb, systemMessages, updatedVectorMetadata } = processSkillUpdate(workingKb, tagParams, turnForSystemMessages);
                    workingKb = updatedKb;
                    allSystemMessages.push(...systemMessages);
                    if (updatedVectorMetadata) addOrUpdateVectorMetadata(metadataToVectorize, updatedVectorMetadata);
                    break;
                }
                 case 'NPC_MOVE': {
                    const result = processNpcMove(workingKb, tagParams, turnForSystemMessages);
                    workingKb = result.updatedKb;
                    allSystemMessages.push(...result.systemMessages);
                    break;
                }
                case 'NPC_RENAME': {
                    const result = processNpcRename(workingKb, tagParams, turnForSystemMessages);
                    workingKb = result.updatedKb;
                    allSystemMessages.push(...result.systemMessages);
                    if (result.updatedVectorMetadata) addOrUpdateVectorMetadata(metadataToVectorize, result.updatedVectorMetadata);
                    break;
                }
                case 'MC_RENAME': {
                    const result = processMcRename(workingKb, tagParams, turnForSystemMessages);
                    workingKb = result.updatedKb;
                    allSystemMessages.push(...result.systemMessages);
                    break;
                }
                case 'NPC_UPDATE': {
                    const result = await processNpcUpdate(workingKb, tagParams, turnForSystemMessages, logNpcAvatarPromptCallback, summaryQueue);
                    workingKb = result.updatedKb;
                    allSystemMessages.push(...result.systemMessages);
                    if (result.updatedVectorMetadata) addOrUpdateVectorMetadata(metadataToVectorize, result.updatedVectorMetadata);
                    if (result.affinityChange) affinityChanges.push(result.affinityChange);
                    break;
                }
                case 'APPEARANCE_UPDATE': {
                    const result = processAppearanceUpdate(workingKb, tagParams, turnForSystemMessages);
                    workingKb = result.updatedKb;
                    allSystemMessages.push(...result.systemMessages);
                    break;
                }
                case 'WIFE_UPDATE': {
                    const { updatedKb, systemMessages, updatedVectorMetadata, affinityChange } = await processWifeUpdate(workingKb, tagParams, turnForSystemMessages, summaryQueue);
                    workingKb = updatedKb;
                    allSystemMessages.push(...systemMessages);
                    if (updatedVectorMetadata) addOrUpdateVectorMetadata(metadataToVectorize, updatedVectorMetadata);
                    if (affinityChange) affinityChanges.push(affinityChange);
                    break;
                }
                case 'SLAVE_UPDATE': {
                    const { updatedKb, systemMessages, updatedVectorMetadata, affinityChange } = await processSlaveUpdate(workingKb, tagParams, turnForSystemMessages, summaryQueue);
                    workingKb = updatedKb;
                    allSystemMessages.push(...systemMessages);
                    if (updatedVectorMetadata) addOrUpdateVectorMetadata(metadataToVectorize, updatedVectorMetadata);
                    if (affinityChange) affinityChanges.push(affinityChange);
                    break;
                }
                case 'PRISONER_UPDATE': {
                    const { updatedKb, systemMessages, updatedVectorMetadata, affinityChange } = await processPrisonerUpdate(workingKb, tagParams, turnForSystemMessages, summaryQueue);
                    workingKb = updatedKb;
                    allSystemMessages.push(...systemMessages);
                    if (updatedVectorMetadata) addOrUpdateVectorMetadata(metadataToVectorize, updatedVectorMetadata);
                    if (affinityChange) affinityChanges.push(affinityChange);
                    break;
                }
                case 'LOCATION_UPDATE': { 
                    const { updatedKb, systemMessages, updatedVectorMetadata } = processLocationUpdate(workingKb, tagParams, turnForSystemMessages);
                    workingKb = updatedKb;
                    allSystemMessages.push(...systemMessages);
                    if (updatedVectorMetadata) addOrUpdateVectorMetadata(metadataToVectorize, updatedVectorMetadata);
                    mapNeedsLayout = true;
                    break;
                }
                case 'LOCATION_REPARENT': {
                    const { updatedKb, systemMessages } = processLocationReparent(workingKb, tagParams, turnForSystemMessages);
                    workingKb = updatedKb;
                    allSystemMessages.push(...systemMessages);
                    mapNeedsLayout = true;
                    break;
                }
                case 'WORLD_LORE_UPDATE': { 
                    const { updatedKb, systemMessages, updatedVectorMetadata } = processWorldLoreUpdate(workingKb, tagParams, turnForSystemMessages);
                    workingKb = updatedKb;
                    allSystemMessages.push(...systemMessages);
                    if (updatedVectorMetadata) addOrUpdateVectorMetadata(metadataToVectorize, updatedVectorMetadata);
                    break;
                }
                case 'FACTION_UPDATE': { 
                    const { updatedKb, systemMessages, updatedVectorMetadata } = processFactionUpdate(workingKb, tagParams, turnForSystemMessages);
                    workingKb = updatedKb;
                    allSystemMessages.push(...systemMessages);
                    if (updatedVectorMetadata) addOrUpdateVectorMetadata(metadataToVectorize, updatedVectorMetadata);
                    break;
                }
                case 'SLAVE_FOR_SALE': {
                    const { updatedKb, systemMessages } = processSlaveForSale(workingKb, tagParams, turnForSystemMessages);
                    workingKb = updatedKb;
                    allSystemMessages.push(...systemMessages);
                    break;
                }
                case 'PRISONER_FOR_SALE': {
                    const { updatedKb, systemMessages } = processPrisonerForSale(workingKb, tagParams, turnForSystemMessages);
                    workingKb = updatedKb;
                    allSystemMessages.push(...systemMessages);
                    break;
                }
                case 'AUCTION_SLAVE': {
                    const { updatedKb, systemMessages } = processAuctionSlave(workingKb, tagParams, turnForSystemMessages);
                    workingKb = updatedKb;
                    allSystemMessages.push(...systemMessages);
                    break;
                }
                case 'MASTER_UPDATE': {
                    const { updatedKb, systemMessages, updatedVectorMetadata, affinityChange } = await processMasterUpdate(workingKb, tagParams, turnForSystemMessages, summaryQueue);
                    workingKb = updatedKb;
                    allSystemMessages.push(...systemMessages);
                    if (updatedVectorMetadata) addOrUpdateVectorMetadata(metadataToVectorize, updatedVectorMetadata);
                    if (affinityChange) affinityChanges.push(affinityChange);
                    break;
                }
                case 'CHANGE_TIME': {
                    const { updatedKb, systemMessages } = processChangeTime(workingKb, tagParams, turnForSystemMessages);
                    workingKb = updatedKb;
                    allSystemMessages.push(...systemMessages);

                    // MECHANICAL AGING: Reduce lifespan based on days passed
                    const daysToPass = parseInt(tagParams.ngay || "0", 10);
                    if (daysToPass > 0) {
                        const currentThoNguyen = typeof workingKb.playerStats.thoNguyen === 'number' ? workingKb.playerStats.thoNguyen : (workingKb.playerStats.maxThoNguyen || 120);
                        const reduction = daysToPass / 360;
                        
                        // CẢI TIẾN V4: Làm tròn 4 chữ số thập phân để tránh sai số float
                        const newThoNguyen = Math.max(0, currentThoNguyen - reduction);
                        workingKb.playerStats.thoNguyen = parseFloat(newThoNguyen.toFixed(4));

                        if (workingKb.playerStats.thoNguyen < 1) {
                            workingKb.playerStats.isDead = true; // KHÓA TRẠNG THÁI
                            workingKb.playerStats.thoNguyen = 0;
                            workingKb.playerStats.sinhLuc = 0;
                            allSystemMessages.push({
                                id: `DEATH_EVENT_${Date.now()}`,
                                type: 'system',
                                content: "💀 【TỌA HÓA】Thọ nguyên đã cạn, đại hạn đã đến. Bạn đã tọa hóa quy tiên, kết thúc một đời tu hành.",
                                timestamp: Date.now(),
                                turnNumber: turnForSystemMessages
                            });
                        }
                    }
                    break;
                }

                case 'PLAYER_STATS_INIT': {
                    const { updatedKb, systemMessages, realmChanged, turnIncremented } = processPlayerStatsInit(workingKb, tagParams);
                    workingKb = updatedKb;
                    allSystemMessages.push(...systemMessages);
                    if (realmChanged) realmChangedByAnyTag = true;
                    if (turnIncremented) turnIncrementedByAnyTag = true;
                    break;
                }
                case 'STATS_UPDATE': {
                    const { updatedKb, systemMessages, realmChanged, turnIncremented, removedBinhCanh } = processStatsUpdate(workingKb, tagParams, turnForSystemMessages, hasQuestCompletion);
                    workingKb = updatedKb;
                    allSystemMessages.push(...systemMessages);
                    if (realmChanged) realmChangedByAnyTag = true;
                    if (turnIncremented) turnIncrementedByAnyTag = true;
                    if (removedBinhCanh) removedBinhCanhByAnyTag = true;

                    // BREAKTHROUGH LIFESPAN BONUS: Update max lifespan if thoNguyen is increased relatively
                    if (tagParams.thoNguyen) {
                        const val = tagParams.thoNguyen;
                        // CẢI TIẾN V4: Hỗ trợ cả "+50", "+=50", "50" (nếu AI viết sai)
                        if (val.includes('+')) {
                            const bonus = parseFloat(val.replace('+=', '').replace('+', ''));
                            if (!isNaN(bonus)) {
                                // processStatsUpdate already added bonus to thoNguyen, now update maxThoNguyen
                                const currentMax = workingKb.playerStats.maxThoNguyen || 0;
                                workingKb.playerStats.maxThoNguyen = parseFloat((currentMax + bonus).toFixed(4));
                                // Ensure current thoNguyen is also rounded
                                workingKb.playerStats.thoNguyen = parseFloat((workingKb.playerStats.thoNguyen).toFixed(4));
                            }
                        }
                    }
                    break;
                }
                case 'BECOMEPRISONER':
                case 'BECOMESLAVE': {
                    const { updatedKb, systemMessages, newVectorMetadata } = processBecomeSpecialStatus(workingKb, tagParams, tagName as 'BECOMEPRISONER' | 'BECOMESLAVE', turnForSystemMessages);
                    workingKb = updatedKb;
                    allSystemMessages.push(...systemMessages);
                    if (newVectorMetadata) addOrUpdateVectorMetadata(metadataToVectorize, newVectorMetadata);
                    break;
                }
                case 'PLAYER_SPECIAL_STATUS_UPDATE': {
                    const { updatedKb, systemMessages } = processPlayerSpecialStatusUpdate(workingKb, tagParams, turnForSystemMessages);
                    workingKb = updatedKb;
                    allSystemMessages.push(...systemMessages);
                    break;
                }
                case 'BECOMEFREE': {
                    if (tagParams.name) {
                        // Handle freeing an NPC
                        const slave = workingKb.slaves.find(s => s.name === tagParams.name);
                        const prisoner = workingKb.prisoners.find(p => p.name === tagParams.name);
                        
                        if (slave) {
                            const result = await processSlaveUpdate(workingKb, { name: tagParams.name, free: "true" }, turnForSystemMessages, summaryQueue);
                            workingKb = result.updatedKb;
                            allSystemMessages.push(...result.systemMessages);
                        } else if (prisoner) {
                            const result = await processPrisonerUpdate(workingKb, { name: tagParams.name, free: "true" }, turnForSystemMessages, summaryQueue);
                            workingKb = result.updatedKb;
                            allSystemMessages.push(...result.systemMessages);
                        } else {
                             allSystemMessages.push({
                                id: `free-not-found-${Date.now()}`,
                                type: "system",
                                content: `Lỗi: Không tìm thấy nô lệ hoặc tù nhân có tên "${tagParams.name}" để giải phóng.`,
                                timestamp: Date.now(),
                                turnNumber: turnForSystemMessages,
                            });
                        }
                    } else {
                        // Original behavior: Free the player
                        const { updatedKb, systemMessages } = processBecomeFree(workingKb, turnForSystemMessages);
                        workingKb = updatedKb;
                        allSystemMessages.push(...systemMessages);
                    }
                    break;
                }
                case 'ITEM_BOUGHT': {
                    const { updatedKb, systemMessages } = processItemBought(workingKb, tagParams, turnForSystemMessages);
                    workingKb = updatedKb;
                    allSystemMessages.push(...systemMessages);
                    break;
                }
                case 'ITEM_ACQUIRED': {
                    const { updatedKb, systemMessages, newVectorMetadata } = processItemAcquired(workingKb, tagParams, turnForSystemMessages);
                    workingKb = updatedKb;
                    allSystemMessages.push(...systemMessages);
                    if (newVectorMetadata) addOrUpdateVectorMetadata(metadataToVectorize, newVectorMetadata);
                    break;
                }
                case 'SHOP_ITEM': {
                    const { updatedKb, systemMessages } = processShopItem(workingKb, tagParams, turnForSystemMessages);
                    workingKb = updatedKb;
                    allSystemMessages.push(...systemMessages);
                    break;
                }
                case 'ITEM_CONSUMED': {
                    const { updatedKb, systemMessages } = processItemConsumed(workingKb, tagParams, turnForSystemMessages);
                    workingKb = updatedKb;
                    allSystemMessages.push(...systemMessages);
                    break;
                }
                case 'SKILL_LEARNED': {
                    const { updatedKb, systemMessages, newVectorMetadata } = processSkillLearned(workingKb, tagParams, turnForSystemMessages);
                    workingKb = updatedKb;
                    allSystemMessages.push(...systemMessages);
                    if (newVectorMetadata) addOrUpdateVectorMetadata(metadataToVectorize, newVectorMetadata);
                    break;
                }
                case 'SKILL_USED': {
                    const { updatedKb, systemMessages } = processSkillUsed(workingKb, tagParams, turnForSystemMessages);
                    workingKb = updatedKb;
                    allSystemMessages.push(...systemMessages);
                    break;
                }
                case 'PROFESSION_LEARNED': {
                    const { updatedKb, systemMessages } = processProfessionLearned(workingKb, tagParams, turnForSystemMessages);
                    workingKb = updatedKb;
                    allSystemMessages.push(...systemMessages);
                    break;
                }
                case 'QUEST_ASSIGNED': {
                    const { updatedKb, systemMessages, newVectorMetadata } = processQuestAssigned(workingKb, tagParams, turnForSystemMessages);
                    workingKb = updatedKb;
                    allSystemMessages.push(...systemMessages);
                    if (newVectorMetadata) addOrUpdateVectorMetadata(metadataToVectorize, newVectorMetadata);
                    break;
                }
                case 'QUEST_UPDATED': {
                    const { updatedKb, systemMessages } = processQuestUpdated(workingKb, tagParams, turnForSystemMessages);
                    workingKb = updatedKb;
                    allSystemMessages.push(...systemMessages);
                    break;
                }
                case 'QUEST_COMPLETED': {
                    const { updatedKb, systemMessages } = processQuestCompleted(workingKb, tagParams, turnForSystemMessages);
                    workingKb = updatedKb;
                    allSystemMessages.push(...systemMessages);
                    break;
                }
                case 'QUEST_FAILED': {
                    const { updatedKb, systemMessages } = processQuestFailed(workingKb, tagParams, turnForSystemMessages);
                    workingKb = updatedKb;
                    allSystemMessages.push(...systemMessages);
                    break;
                }
                case 'OBJECTIVE_UPDATE': {
                    const { updatedKb, systemMessages } = processObjectiveUpdate(workingKb, tagParams, turnForSystemMessages);
                    workingKb = updatedKb;
                    allSystemMessages.push(...systemMessages);
                    break;
                }
                case 'INTERACTION': {
                    const { updatedKb, systemMessages } = processInteraction(workingKb, tagParams, turnForSystemMessages);
                    workingKb = updatedKb;
                    allSystemMessages.push(...systemMessages);
                    break;
                }
                case 'GENERATE_EQUIPMENT': {
                    const { updatedKb, systemMessages, newVectorMetadata } = processGenerateEquipment(workingKb, tagParams, turnForSystemMessages);
                    workingKb = updatedKb;
                    allSystemMessages.push(...systemMessages);
                    if (newVectorMetadata) addOrUpdateVectorMetadata(metadataToVectorize, newVectorMetadata);
                    break;
                }
                case 'NPC_CREATE':
                case 'NPC': { 
                    const result = await processNpc(workingKb, tagParams, turnForSystemMessages, logNpcAvatarPromptCallback); 
                    workingKb = result.updatedKb;
                    allSystemMessages.push(...result.systemMessages);
                    if (result.newVectorMetadata) addOrUpdateVectorMetadata(metadataToVectorize, result.newVectorMetadata);
                    break;
                }
                case 'YEUTHU': {
                    const result = await processYeuThu(workingKb, tagParams, turnForSystemMessages, logNpcAvatarPromptCallback); 
                    workingKb = result.updatedKb;
                    allSystemMessages.push(...result.systemMessages);
                    if (result.newVectorMetadata) addOrUpdateVectorMetadata(metadataToVectorize, result.newVectorMetadata);
                    break;
                }
                case 'YEUTHU_APPEAR': {
                    const result = await processYeuThuAppear(workingKb, tagParams, turnForSystemMessages, logNpcAvatarPromptCallback, { groupSize: yeuThuAppearCount });
                    workingKb = result.updatedKb;
                    allSystemMessages.push(...result.systemMessages);
                    if (result.newVectorMetadata) addOrUpdateVectorMetadata(metadataToVectorize, result.newVectorMetadata);
                    break;
                }
                case 'MAINLOCATION': {
                    const { updatedKb, systemMessages, newVectorMetadata } = processMainLocation(workingKb, tagParams, turnForSystemMessages);
                    workingKb = updatedKb;
                    allSystemMessages.push(...systemMessages);
                    if (newVectorMetadata) addOrUpdateVectorMetadata(metadataToVectorize, newVectorMetadata);
                    mapNeedsLayout = true;
                    break;
                }
                case 'SUBLOCATION': {
                    const { updatedKb, systemMessages, newVectorMetadata } = processSubLocation(workingKb, tagParams, turnForSystemMessages);
                    workingKb = updatedKb;
                    allSystemMessages.push(...systemMessages);
                    if (newVectorMetadata) addOrUpdateVectorMetadata(metadataToVectorize, newVectorMetadata);
                    break;
                }
                case 'LOCATION_CHANGE': {
                    const { updatedKb, systemMessages } = await processLocationChange(workingKb, tagParams, turnForSystemMessages);
                    workingKb = updatedKb;
                    allSystemMessages.push(...systemMessages);
                    mapNeedsLayout = true;
                    break;
                }
                case 'LOCATION_SAFETY': {
                    const { updatedKb, systemMessages } = processLocationSafety(workingKb, tagParams, turnForSystemMessages);
                    workingKb = updatedKb;
                    allSystemMessages.push(...systemMessages);
                    break;
                }
                case 'WORLD_LORE_ADD': {
                    const { updatedKb, systemMessages, newVectorMetadata } = processWorldLoreAdd(workingKb, tagParams, turnForSystemMessages);
                    workingKb = updatedKb;
                    allSystemMessages.push(...systemMessages);
                    if (newVectorMetadata) addOrUpdateVectorMetadata(metadataToVectorize, newVectorMetadata);
                    break;
                }
                case 'FACTION_DISCOVERED': {
                    const { updatedKb, systemMessages, newVectorMetadata } = processFactionDiscovered(workingKb, tagParams, turnForSystemMessages);
                    workingKb = updatedKb;
                    allSystemMessages.push(...systemMessages);
                    if (newVectorMetadata) addOrUpdateVectorMetadata(metadataToVectorize, newVectorMetadata);
                    break;
                }
                 case 'FACTION_REMOVE': { 
                    const { updatedKb, systemMessages } = processFactionRemove(workingKb, tagParams, turnForSystemMessages);
                    workingKb = updatedKb;
                    allSystemMessages.push(...systemMessages);
                    break;
                }
                case 'NPC_REMOVE': {
                    const { updatedKb, systemMessages } = processNpcRemove(workingKb, tagParams, turnForSystemMessages);
                    workingKb = updatedKb;
                    allSystemMessages.push(...systemMessages);
                    break;
                }
                case 'YEUTHU_REMOVE': {
                    const { updatedKb, systemMessages } = processYeuThuRemove(workingKb, tagParams, turnForSystemMessages);
                    workingKb = updatedKb;
                    allSystemMessages.push(...systemMessages);
                    break;
                }
                case 'SET_COMBAT_STATUS': {
                    const { updatedKb } = processSetCombatStatus(workingKb, tagParams);
                    workingKb = updatedKb;
                    break;
                }
                case 'BEGIN_COMBAT': {
                    const { updatedKb, systemMessages } = processBeginCombat(workingKb, tagParams);
                    workingKb = updatedKb;
                    allSystemMessages.push(...systemMessages);
                    break;
                }
                case 'COMPANION_JOIN':
                case 'COMPANION_ADD': {
                    const { updatedKb, systemMessages } = processCompanionAdd(workingKb, tagParams);
                    workingKb = updatedKb;
                    allSystemMessages.push(...systemMessages);
                    break;
                }
                case 'COMPANION_LEAVE': {
                    const { updatedKb, systemMessages } = processCompanionLeave(workingKb, tagParams);
                    workingKb = updatedKb;
                    allSystemMessages.push(...systemMessages);
                    break;
                }
                case 'COMPANION_STATS_UPDATE': {
                    const { updatedKb, systemMessages } = processCompanionStatsUpdate(workingKb, tagParams);
                    workingKb = updatedKb;
                    allSystemMessages.push(...systemMessages);
                    break;
                }
                 case 'PRISONER_ADD': {
                    const { updatedKb, systemMessages, newVectorMetadata } = processPrisonerAdd(workingKb, tagParams, turnForSystemMessages);
                    workingKb = updatedKb;
                    allSystemMessages.push(...systemMessages);
                    if (newVectorMetadata) addOrUpdateVectorMetadata(metadataToVectorize, newVectorMetadata);
                    break;
                }
                case 'WIFE_ADD': {
                    const { updatedKb, systemMessages, newVectorMetadata } = processWifeAdd(workingKb, tagParams, turnForSystemMessages);
                    workingKb = updatedKb;
                    allSystemMessages.push(...systemMessages);
                    if (newVectorMetadata) addOrUpdateVectorMetadata(metadataToVectorize, newVectorMetadata);
                    break;
                }
                case 'SLAVE_ADD': {
                    const { updatedKb, systemMessages, newVectorMetadata } = processSlaveAdd(workingKb, tagParams, turnForSystemMessages);
                    workingKb = updatedKb;
                    allSystemMessages.push(...systemMessages);
                    if (newVectorMetadata) addOrUpdateVectorMetadata(metadataToVectorize, newVectorMetadata);
                    break;
                }
                case 'WIFE_REMOVE': {
                    const { updatedKb, systemMessages } = processWifeRemove(workingKb, tagParams, turnForSystemMessages);
                    workingKb = updatedKb;
                    allSystemMessages.push(...systemMessages);
                    break;
                }
                case 'SLAVE_REMOVE': {
                    const { updatedKb, systemMessages } = processSlaveRemove(workingKb, tagParams, turnForSystemMessages);
                    workingKb = updatedKb;
                    allSystemMessages.push(...systemMessages);
                    break;
                }
                case 'PRISONER_REMOVE': {
                    const { updatedKb, systemMessages } = processPrisonerRemove(workingKb, tagParams, turnForSystemMessages);
                    workingKb = updatedKb;
                    allSystemMessages.push(...systemMessages);
                    break;
                }
                case 'MESSAGE': {
                    const msg = processMessage(tagParams, turnForSystemMessages);
                    if (msg) allSystemMessages.push(msg);
                    break;
                }
                 case 'REALM_LIST': {
                    const { updatedKb } = processRealmList(workingKb, tagParams);
                    workingKb = updatedKb;
                    break;
                }
                case 'EVENT_CHECK': {
                    const eventName = tagParams.name || tagParams.position_var_0 || "Không rõ";
                    const cleanEventName = eventName.toLowerCase().trim();
                    if (cleanEventName === "không rõ" || processedEventsThisBatch.has(cleanEventName)) {
                        break;
                    }
                    processedEventsThisBatch.add(cleanEventName);

                    const reasoning = tagParams.reasoning || tagParams.reason || tagParams.evidence || "Đang kiểm tra tiến độ...";

                    allSystemMessages.push({
                         id: 'ai-message-' + Date.now() + Math.random(),
                         type: 'system',
                         content: `🔍 [Kiểm Tra Sự Kiện] "${eventName}"\n📌 Bằng chứng & Tiến độ: ${reasoning}`,
                         timestamp: Date.now(),
                         turnNumber: turnForSystemMessages
                    });
                    break;
                }
                case 'QUEST_CHECK': {
                    const questTitle = tagParams.title || tagParams.name || tagParams.position_var_0 || "Không rõ";
                    const cleanTitle = questTitle.toLowerCase().trim();
                    if (cleanTitle === "không rõ" || processedQuestsThisBatch.has(cleanTitle)) {
                        break;
                    }
                    processedQuestsThisBatch.add(cleanTitle);

                    const reasoning = tagParams.reasoning || tagParams.reason || tagParams.evidence || "Đang kiểm tra tiến độ...";

                    allSystemMessages.push({
                         id: 'ai-message-' + Date.now() + Math.random(),
                         type: 'system',
                         content: `🔍 [Kiểm Tra Nhiệm Vụ] "${questTitle}"\n📌 Bằng chứng & Tiến độ: ${reasoning}`,
                         timestamp: Date.now(),
                         turnNumber: turnForSystemMessages
                    });
                    break;
                }
                case 'EVENT_COMPLETE':
                case 'ORIGINAL_EVENT_RESOLVED': {
                    if (!workingKb.arcState) {
                       workingKb.arcState = { phase: 'cooldown', turnCount: 0, targetEvent: null, questIssued: false, originalTimelineIndex: 0 };
                    }
                    // 1. Xác định tên sự kiện cốt truyện hiện tại đang diễn ra trong game state
                    const idx = workingKb.arcState.originalTimelineIndex ?? 0;
                    const currentEvent = workingKb.worldConfig?.timelineEvents?.[idx];
                    const currentEventName = currentEvent ? currentEvent.eventName : "Không rõ";

                    // 2. Lấy tên sự kiện được truyền từ tagParams (hỗ trợ cả thuộc tính 'name' hoặc positional parameter thứ nhất)
                    const targetName = tagParams.name || tagParams.position_var_0 || "";

                    // 3. Nếu tag cung cấp tên cụ thể, tiến hành so khớp để tránh nhầm lẫn giữa các sự kiện
                    if (targetName && currentEventName !== "Không rõ") {
                        const cleanTarget = targetName.toLowerCase().replace(/['"“”]/g, "").trim();
                        const cleanCurrent = currentEventName.toLowerCase().replace(/['"“”]/g, "").trim();
                        
                        const isMatch = cleanCurrent.includes(cleanTarget) || cleanTarget.includes(cleanCurrent);
                        if (!isMatch) {
                            console.log(`[EVENT_COMPLETE GUARD] Bỏ qua tag vì tên sự kiện không khớp. Nhận được: "${targetName}", Hiện tại: "${currentEventName}"`);
                            allSystemMessages.push({
                                 id: 'ai-message-' + Date.now() + Math.random(), type: 'system',
                                 content: `⚙️ [Thiên Đạo Sync] Bỏ qua yêu cầu hoàn thành sự kiện "${targetName}" do không trùng khớp với sự kiện cốt truyện hiện tại ("${currentEventName}").`,
                                 timestamp: Date.now(), turnNumber: turnForSystemMessages
                            });
                            break;
                        }
                    }

                    // 4. Nếu khớp hoặc tag không chứa tên (fallback), tiến hành hoàn thành sự kiện cốt truyện
                    const reasoning = tagParams.reasoning || tagParams.reason || tagParams.evidence || "";
                    
                    // [STRICT VALIDATION] Phải có lý do và bằng chứng cụ thể
                    if (!reasoning) {
                        console.log(`[STRICT PARSER] Bỏ qua EVENT_COMPLETE vì không có lý do/bằng chứng hoàn thành.`);
                        allSystemMessages.push({
                             id: 'ai-message-' + Date.now() + Math.random(), type: 'system',
                             content: `⚙️ [Thiên Đạo Sync] Bỏ qua yêu cầu hoàn thành sự kiện "${currentEventName}" do thiếu bằng chứng xác thực (evidence/reasoning).`,
                             timestamp: Date.now(), turnNumber: turnForSystemMessages
                        });
                        break;
                    }

                    workingKb.arcState.originalEventResolved = true;
                    allSystemMessages.push({
                         id: 'ai-message-' + Date.now() + Math.random(), type: 'system',
                         content: `✅ [Hoàn Thành] Dòng thời gian nguyên tác: Sự kiện "${currentEventName}" đã hoàn thành!\n📌 Lý do & Bằng chứng: ${reasoning}`,
                         timestamp: Date.now(), turnNumber: turnForSystemMessages
                    });
                    break;
                }
                case 'REMOVE_BINH_CANH_EFFECT': {
                    const { updatedKb, systemMessages, removedBinhCanh } = processRemoveBinhCanhEffect(workingKb, tagParams, turnForSystemMessages);
                    workingKb = updatedKb;
                    allSystemMessages.push(...systemMessages);
                    if (removedBinhCanh) removedBinhCanhByAnyTag = true;
                    break;
                }
                case 'STATUS_EFFECT_APPLY': {
                    const { updatedKb, systemMessages } = processStatusEffectApply(workingKb, tagParams, turnForSystemMessages);
                    workingKb = updatedKb;
                    allSystemMessages.push(...systemMessages);
                    break;
                }
                case 'STATUS_EFFECT_REMOVE': {
                    const { updatedKb, systemMessages } = processStatusEffectRemove(workingKb, tagParams, turnForSystemMessages);
                    workingKb = updatedKb;
                    allSystemMessages.push(...systemMessages);
                    break;
                }
                case 'AUCTION_ITEM': {
                    const { updatedKb, systemMessages } = processAuctionItem(workingKb, tagParams, turnForSystemMessages);
                    workingKb = updatedKb;
                    allSystemMessages.push(...systemMessages);
                    break;
                }
                 case 'AUCTION_NPC': {
                    const { updatedKb, systemMessages } = processAuctionNpc(workingKb, tagParams, turnForSystemMessages);
                    workingKb = updatedKb;
                    allSystemMessages.push(...systemMessages);
                    break;
                }
                case 'NPC_BID': {
                    const { updatedKb, systemMessages } = processNpcBid(workingKb, tagParams, turnForSystemMessages);
                    workingKb = updatedKb;
                    allSystemMessages.push(...systemMessages);
                    break;
                }
                default:
                    // Bỏ qua tất cả các thẻ không thuộc danh sách hệ thống xử lý (như [THINKING], [NOTE],...)
                    // Không đưa vào tagErrors/unrecognizedTags để không bao giờ hiện Modal lỗi
                    isHandled = true;
                    break;
            }
        } catch (error: any) {
             console.error(`Error processing tag "${tagName}":`, error, "Original tag:", originalTag, "Params:", tagParams);
             isHandled = true;
        }
    } 

    // --- BATCH PROCESSING: THE SECRETARY ---
    if (summaryQueue.length > 0) {
        try {
            // Call the Secretary AI to summarize all changes in one go
            const summaries = await generateBatchDescriptionSummaries(summaryQueue);

            // Distribute summaries back to entities
            summaries.forEach(item => {
                let targetEntity: any = undefined;
                
                // Search in appropriate list based on type (for optimization) or just search all
                if (workingKb.master && workingKb.master.id === item.id) {
                    targetEntity = workingKb.master;
                } else {
                     targetEntity = [
                         ...workingKb.discoveredNPCs,
                         ...workingKb.wives,
                         ...workingKb.slaves,
                         ...workingKb.prisoners
                     ].find(e => e.id === item.id);
                }

                if (targetEntity) {
                    if (!targetEntity.history) targetEntity.history = [];
                    targetEntity.history.push(`[Lượt ${turnForSystemMessages}] ${item.summary}`);
                }
            });

        } catch (batchError) {
            console.error("Batch summary failed:", batchError);
            // Fail-safe: Append generic update message or raw diff if AI fails
            summaryQueue.forEach(req => {
                let targetEntity: any = undefined;
                 if (workingKb.master && workingKb.master.id === req.id) {
                    targetEntity = workingKb.master;
                } else {
                    targetEntity = [
                         ...workingKb.discoveredNPCs,
                         ...workingKb.wives,
                         ...workingKb.slaves,
                         ...workingKb.prisoners
                     ].find(e => e.id === req.id);
                }

                if (targetEntity) {
                     if (!targetEntity.history) targetEntity.history = [];
                     // Simple fallback logic
                     const delta = req.newDesc.length > req.oldDesc.length 
                        ? req.newDesc.substring(req.oldDesc.length).trim() 
                        : "Thông tin đã được cập nhật.";
                     targetEntity.history.push(`[Lượt ${turnForSystemMessages}] (Cập nhật tự động) ${delta.substring(0, 50)}...`);
                }
            });
        }
    }


    if (metadataToVectorize.length > 0) {
        try {
            console.log(`[RAG Update] Bắt đầu vector hóa ${metadataToVectorize.length} thực thể...`);
            const textChunks = metadataToVectorize.map(m => m.text);
            const newVectors = await generateEmbeddingsWithRetry(textChunks);
            
            if (!workingKb.ragVectorStore) {
                workingKb.ragVectorStore = { vectors: [], metadata: [] };
            }

            metadataToVectorize.forEach((metadata, index) => {
                const newVector = newVectors[index];
                if (!newVector) return;

                // Gắn số lượt cho metadata để hiển thị theo lượt trong UI
                metadata.turn = turnForSystemMessages;

                const existingIndex = workingKb.ragVectorStore!.metadata.findIndex(m => m.entityId === metadata.entityId);
                if (existingIndex > -1) {
                    workingKb.ragVectorStore!.vectors[existingIndex] = newVector;
                    workingKb.ragVectorStore!.metadata[existingIndex] = metadata;
                } else {
                    workingKb.ragVectorStore!.vectors.push(newVector);
                    workingKb.ragVectorStore!.metadata.push(metadata);
                }

                // LOG TO RAG HISTORY
                if (!workingKb.ragHistoryLog) workingKb.ragHistoryLog = [];
                workingKb.ragHistoryLog.push({
                    turn: turnForSystemMessages,
                    timestamp: new Date().toLocaleTimeString('vi-VN', { hour12: false }),
                    content: `[HỆ THỐNG GHI NHỚ THỰC THỂ]:\nID: ${metadata.entityId}\nLoại: ${metadata.entityType}\nNội dung: ${metadata.text}`,
                    type: 'vectorization'
                });
            });
            
            console.log(`[RAG Update] Vector hóa hoàn tất.`);
            const entityNames = metadataToVectorize.map(m => {
                const typeLabel = m.entityType.toUpperCase();
                // Try to extract name from tag-like text: name="Name"
                const nameMatch = m.text.match(/name="([^"]+)"/);
                const name = nameMatch ? nameMatch[1] : m.entityId;
                return `${typeLabel}: ${name}`;
            }).join(', ');

            allSystemMessages.push({
                id: `vector-entity-${Date.now()}`,
                type: 'system',
                content: `[Hệ thống] Đã cập nhật dữ liệu thực thể vào ký ức (RAG): ${entityNames}`,
                timestamp: Date.now(),
                turnNumber: turnForSystemMessages
            });
        } catch (embeddingError) {
            console.error("Failed to update RAG VectorStore during tag processing:", embeddingError);
        }
    }

    // --- PASSIVE SYSTEM: AFFINITY DECAY (THIỆN CẢM NGUỘI LẠNH) ---
    // Cơ chế: Nếu NPC có độ thiện cảm > 0, thì cứ 1 turn không gặp NPC thì sẽ trừ 1 điểm thiện cảm nhưng không được trừ thành số âm.
    // Việc xác định "gặp" hay không dựa trên lastInteractionTurn đã được cập nhật ở bước RAG extraction.
    const turnToApplyDecay = turnForSystemMessages;
    [
        ...workingKb.discoveredNPCs,
        ...workingKb.wives,
        ...workingKb.slaves,
        ...workingKb.prisoners
    ].forEach((npc: any) => {
        if (npc.affinity !== undefined && npc.affinity > 0) {
            const lastVisit = npc.lastInteractionTurn || 0;
            // Nếu lượt cuối cùng gặp NPC nhỏ hơn lượt hiện tại (tức là lượt này không nhắc đến NPC)
            if (lastVisit < turnToApplyDecay) {
                const oldAffinity = npc.affinity;
                npc.affinity = Math.max(0, npc.affinity - 1);
                if (npc.affinity !== oldAffinity) {
                    affinityChanges.push({ name: npc.name, delta: -1 });
                }
            }
        }
    });

    if (workingKb.master && workingKb.master.affinity !== undefined && workingKb.master.affinity > 0) {
        const lastVisit = (workingKb.master as any).lastInteractionTurn || 0;
        if (lastVisit < turnToApplyDecay) {
            workingKb.master.affinity = Math.max(0, workingKb.master.affinity - 1);
        }
    }

    // --- CƠ CHẾ LÀM TÌNH QUÁ ĐỘ (SEX OVER-EXERTION MECHANICS) ---
    SexOverExertionService.processSexOverExertion(workingKb, allSystemMessages, turnForSystemMessages);

    // --- PASSIVE SYSTEM: INTIMACY DEMAND & INTERRUPTION (HỆ THỐNG NHU CẦU LÀM TÌNH CHUYÊN SÂU) ---
    try {
        let activeSexPartnerName: string | undefined = undefined;
        allSystemMessages.forEach((msg) => {
            if (msg && msg.content && msg.content.includes('đã làm tình với')) {
                const match = msg.content.match(/(?:\[(?:HỆ THỐNG|Thiên đạo)\]\s+)?(.+?)\s+đã làm tình với\s+(.+)$/i);
                if (match) {
                    const maleName = match[1].trim();
                    const femaleName = match[2].trim();
                    const playerName = (workingKb.playerStats?.name || 'Người chơi').trim().toLowerCase();
                    if (maleName.toLowerCase() === playerName || maleName.toLowerCase() === 'mc' || maleName.toLowerCase() === 'player') {
                        activeSexPartnerName = femaleName;
                    }
                }
            }
        });

        const intimacyInterruptMessages = NpcIntimacyDemandService.checkAndProcessInterruption(
            workingKb,
            turnForSystemMessages,
            activeSexPartnerName
        );

        intimacyInterruptMessages.forEach(msgContent => {
            allSystemMessages.push({
                id: `intimacy-interrupt-${Date.now()}-${Math.random()}`,
                type: 'system',
                content: msgContent,
                timestamp: Date.now(),
                turnNumber: turnForSystemMessages
            });
        });
    } catch (intimacyError) {
        console.error("Lỗi xử lý nhu cầu làm tình / gián đoạn:", intimacyError);
    }

    if (mapNeedsLayout) {
        workingKb = applyAutoLayout(workingKb);
    }

    // Auto-mark deceased NPCs as deathNarrated = true once their death has been narrated
    const listsToUpdate = ['discoveredNPCs', 'wives', 'slaves', 'prisoners'];
    listsToUpdate.forEach(listName => {
        const list = (workingKb as any)[listName];
        if (list && Array.isArray(list)) {
            list.forEach((npc: any) => {
                const hp = npc.stats?.sinhLuc ?? npc.hp ?? 100;
                if (hp <= 0) {
                    npc.deathNarrated = true;
                }
            });
        }
    });

    // CƠ CHẾ ĐỒNG BỘ CẢNH GIỚI NỀN ĐÃ ĐƯỢC TẮT THEO YÊU CẦU:
    // Giữ nguyên 100% cảnh giới do AI/Fast Agent chỉ định, không tự ý gán cảnh giới nền hay ghi đè.

    if (workingKb.universeId && workingKb.playerStats?.turn !== undefined) {
        SacredTimelineService.updateHighestTurn(workingKb.universeId, workingKb.playerStats.turn);
    }

    // Tự động kiểm tra và giải phóng cơ học nếu NPC chủ nhân biến mất / không hợp lệ
    const masterValidation = MasterIntegrityService.validateAndEnforceMasterIntegrity(workingKb, turnForSystemMessages);
    workingKb = masterValidation.updatedKb;
    if (masterValidation.freed && masterValidation.message) {
        allSystemMessages.push(masterValidation.message);
    }

    // Tự động gộp khu vực kinh tế từ địa điểm phụ vào địa điểm chính gốc (root location)
    if (workingKb.discoveredLocations && Array.isArray(workingKb.discoveredLocations)) {
        // Hàm tìm địa điểm chính gốc (root location) không có parentLocationId
        const findRootLocation = (locId: string, locations: any[]): any | null => {
            let current = locations.find(l => l.id === locId);
            if (!current) return null;
            const visited = new Set<string>();
            while (current.parentLocationId && !visited.has(current.parentLocationId)) {
                visited.add(current.id);
                const parent = locations.find(l => l.id === current.parentLocationId);
                if (!parent) break;
                current = parent;
            }
            return current;
        };

        // Danh sách địa điểm phụ có economicZones cần gộp
        workingKb.discoveredLocations.forEach((subLoc: any) => {
            if (subLoc.parentLocationId && subLoc.economicZones && subLoc.economicZones.length > 0) {
                const rootLoc = findRootLocation(subLoc.id, workingKb.discoveredLocations);
                if (rootLoc && rootLoc.id !== subLoc.id) {
                    if (!rootLoc.economicZones) {
                        rootLoc.economicZones = [];
                    }
                    subLoc.economicZones.forEach((zone: any) => {
                        const exists = rootLoc.economicZones.some((z: any) => z.id === zone.id || z.name === zone.name);
                        if (!exists) {
                            rootLoc.economicZones.push({ ...zone });
                        }
                    });
                    // Xóa khu vực kinh tế ở địa điểm phụ để tránh hiển thị trùng lặp
                    subLoc.economicZones = [];
                }
            }
        });
    }

    return { 
        newKb: workingKb, 
        turnIncrementedByTag: turnIncrementedByAnyTag, 
        systemMessagesFromTags: allSystemMessages, 
        realmChangedByTag: realmChangedByAnyTag, 
        appliedBinhCanhViaTag: false, 
        removedBinhCanhViaTag: removedBinhCanhByAnyTag,
        affinityChanges,
        mapNeedsLayout,
        tagErrors,
        unrecognizedTags
    };
};

/**
 * Removes all technical tags, thinking blocks, and audit logs from the content.
 * Guarantees extraction of <content> or <narration> regardless of nesting or unclosed tags.
 */
export const stripThinkingTags = (text: string): string => {
    if (!text) return "";
    return extractMainStoryContent(text);
};

/**
 * Áp dụng cơ chế khớp thẻ (Counting & Matching)
 * - Xóa cặp thẻ đóng dư thừa biến thành nội dung trần.
 * - Xóa thẻ mở chưa đóng khi stream kết thúc (isFinal = true).
 */
export const matchAndFixTags = (text: string, isFinal: boolean = false): string => {
    if (!text || !isFinal) return text;
    
    const tagRegex = /<(\/)?([a-zA-Z0-9_]+)([^>]*)>/g;
    let result = "";
    let lastIndex = 0;
    
    const tags: Array<{
        fullMatch: string;
        isClosing: boolean;
        tagName: string;
        start: number;
        end: number;
        matched: boolean;
        shouldFix: boolean;
    }> = [];
    
    let match;
    while ((match = tagRegex.exec(text)) !== null) {
        tags.push({
            fullMatch: match[0],
            isClosing: match[1] === '/',
            tagName: match[2],
            start: match.index,
            end: match.index + match[0].length,
            matched: false,
            shouldFix: false
        });
    }
    
    const stack: typeof tags = [];
    for (let i = 0; i < tags.length; i++) {
        const tag = tags[i];
        if (!tag.isClosing) {
            stack.push(tag);
        } else {
            let foundIndex = -1;
            for (let j = stack.length - 1; j >= 0; j--) {
                if (stack[j].tagName === tag.tagName && !stack[j].matched) {
                    foundIndex = j;
                    break;
                }
            }
            if (foundIndex !== -1) {
                stack[foundIndex].matched = true;
                tag.matched = true;
                stack.splice(foundIndex, 1);
            } else {
                tag.shouldFix = true;
            }
        }
    }
    
    if (isFinal) {
        for (let i = 0; i < stack.length; i++) {
            stack[i].shouldFix = true;
        }
    }
    
    for (let i = 0; i < tags.length; i++) {
        const tag = tags[i];
        result += text.substring(lastIndex, tag.start);
        if (tag.shouldFix) {
            let fixed = tag.fullMatch.replace(/</g, '-').replace(/>/g, '-');
            if (tag.isClosing) {
                fixed = fixed.replace(/\//g, '');
            }
            result += fixed;
        } else {
            result += tag.fullMatch;
        }
        lastIndex = tag.end;
    }
    result += text.substring(lastIndex);
    return result;
};
