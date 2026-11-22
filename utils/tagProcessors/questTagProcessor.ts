



import { VIETNAMESE } from '../../constants'; // VIETNAMESE might be needed for quest related strings in the future
import { KnowledgeBase, GameMessage, QuestObjective, Quest, VectorMetadata } from '../../types';
import { formatQuestForEmbedding } from '../ragUtils'; // NEW: Import formatter
import { diceCoefficient, normalizeStringForComparison, formatObjectiveForSystemMessage, extractStatusEffectNameFromQuestText, isMainQuest } from '../questUtils';
import { QuestRewardEngine } from '../../services/quest/QuestRewardEngine';

const SIMILARITY_THRESHOLD = 0.75; // 75% similarity required to match an objective/quest

// Helper function to find a quest by fuzzy title matching
const findQuestByTitle = (quests: Quest[], title: string): Quest | null => {
    if (!title) return null;
    let bestMatch = { quest: null as Quest | null, score: 0 };
    const normalizedTitle = normalizeStringForComparison(title);

    quests.forEach(q => {
        if (q.status === 'active') {
            const score = diceCoefficient(normalizedTitle, normalizeStringForComparison(q.title));
            if (score > bestMatch.score) {
                bestMatch = { quest: q, score };
            }
        }
    });

    if (bestMatch.quest && bestMatch.score >= SIMILARITY_THRESHOLD) {
        return bestMatch.quest;
    }
    
    if(bestMatch.quest) {
        console.warn(`QUEST_PROCESSOR: Quest matching "${title}" found, but similarity score ${bestMatch.score.toFixed(2)} is below threshold ${SIMILARITY_THRESHOLD}. Best match: "${bestMatch.quest.title}"`);
    } else {
        console.warn(`QUEST_PROCESSOR: Active quest matching "${title}" not found.`);
    }

    return null;
}


export const processQuestAssigned = (
    currentKb: KnowledgeBase,
    tagParams: Record<string, string>,
    turnForSystemMessages: number
): { updatedKb: KnowledgeBase; systemMessages: GameMessage[]; newVectorMetadata?: VectorMetadata; } => {
    const newKb = currentKb;
    const systemMessages: GameMessage[] = [];
    let newVectorMetadata: VectorMetadata | undefined = undefined;

    const questTitle = tagParams.title;
    const questDescription = tagParams.description;
    let objectivesStr = tagParams.objectives || tagParams.mucTieu || "Hoàn thành nhiệm vụ"; // Added default and alias
    const rewardText = tagParams.rewardText;
    const punishmentText = tagParams.punishmentText;
    const durationTurns = tagParams.durationTurns ? parseInt(tagParams.durationTurns, 10) : undefined;
    const status = (tagParams.status === 'pending' || tagParams.isPending === 'true') ? 'pending' : 'active';

    // Cơ chế dọn dẹp cơ học các tiêu đề/mục tiêu lỗi (Ví dụ AI tạo dạng mảng JSON thành chuỗi: '["Mối thù"]')
    let cleanedTitle = questTitle || tagParams.name || "";
    if (cleanedTitle.startsWith('["')) {
        try {
            const arr = JSON.parse(cleanedTitle);
            if (Array.isArray(arr) && arr.length > 0) { cleanedTitle = arr[0]; }
        } catch(e) {
            cleanedTitle = cleanedTitle.replace(/^\["?\\?"?|\\?"?"?\]$/g, '').trim();
        }
    }
    cleanedTitle = cleanedTitle.replace(/^"|"$/g, '').replace(/^\\"/g, '').replace(/\\"/g, '').trim();
    
    if (objectivesStr.startsWith('["')) {
        try {
            const arr = JSON.parse(objectivesStr);
            if (Array.isArray(arr) && arr.length > 0) { objectivesStr = arr.join('|'); }
        } catch(e) {
            objectivesStr = objectivesStr.replace(/^\["?\\?"?|\\?"?"?\]$/g, '').trim();
        }
    }

    let cleanedDescription = questDescription || "";
    if (cleanedDescription.startsWith('["')) {
        try {
            const arr = JSON.parse(cleanedDescription);
            if (Array.isArray(arr) && arr.length > 0) { cleanedDescription = arr[0]; }
        } catch(e) {
            cleanedDescription = cleanedDescription.replace(/^\["?\\?"?|\\?"?"?\]$/g, '').trim();
        }
    }
    cleanedDescription = cleanedDescription.replace(/^"|"$/g, '').replace(/^\\"/g, '').replace(/\\"/g, '').trim();

    if (cleanedTitle && cleanedDescription) {
        // Chỉ hệ thống có quyền tạo nhiệm vụ cốt truyện. Chặn hoàn toàn AI tự tạo nhiệm vụ có chứa chữ "cốt truyện" hoặc trùng tên sự kiện trong Dòng thời gian.
        const titleLower = cleanedTitle.toLowerCase();
        const isStoryQuest = titleLower.includes("cốt truyện") || 
            (newKb.worldConfig?.timelineEvents || []).some(evt => {
                const cleanEvtName = evt.eventName.trim().toLowerCase();
                if (!cleanEvtName) return false;
                const cleanTitle2 = cleanedTitle.replace(/^\[cốt\s+truyện\]\s*/i, '').trim().toLowerCase();
                return cleanTitle2 === cleanEvtName || cleanTitle2.includes(cleanEvtName) || cleanEvtName.includes(cleanTitle2);
            });

        if (isStoryQuest || cleanedTitle.length < 3 || cleanedDescription.length < 5) {
            console.warn(`QUEST_ASSIGNED: Blocked invalid quest - Title: "${cleanedTitle}" | Description: "${cleanedDescription}"`);
            return { updatedKb: currentKb, systemMessages };
        }

        if (!newKb.allQuests.find(q => q.title === cleanedTitle)) {
            const newQuestObjectives: QuestObjective[] = objectivesStr.split('|').map((objText, index) => ({
                id: `obj-${cleanedTitle.replace(/\s+/g, '-')}-${index}-${Date.now()}`,
                text: objText.trim(),
                completed: false,
            }));

            // Support aliases for rewards
            const rawRewardExp = tagParams.rewardExp || tagParams.kinhNghiem || tagParams.exp;
            const rawRewardCurrency = tagParams.rewardCurrency || tagParams.linhThach || tagParams.tien;
            const parsedExp = rawRewardExp ? parseInt(rawRewardExp, 10) : undefined;
            const parsedCurrency = rawRewardCurrency ? parseInt(rawRewardCurrency, 10) : undefined;

            // Đảm bảo mọi nhiệm vụ ngoại trừ cốt truyện đều có phần thưởng Tu Vi và Linh Thạch
            const guaranteedRewards = QuestRewardEngine.ensureQuestRewards(
                {
                    title: cleanedTitle,
                    rewardExp: parsedExp,
                    rewardCurrency: parsedCurrency,
                    rewardText: rewardText,
                    rewardItem: tagParams.rewardItem,
                },
                newKb.playerStats?.realm,
                newKb.worldConfig?.timelineEvents || []
            );

            const newQuest: Quest = {
                id: `quest-${cleanedTitle.replace(/\s+/g, '-')}-${Date.now()}`,
                title: cleanedTitle,
                description: cleanedDescription,
                status: status,
                objectives: newQuestObjectives,
                rewardText: guaranteedRewards.rewardText,
                punishmentText: punishmentText,
                rewardExp: guaranteedRewards.rewardExp,
                rewardCurrency: guaranteedRewards.rewardCurrency,
                rewardItem: tagParams.rewardItem,
                duration: durationTurns, // Store the original duration
                deadlineTurn: durationTurns !== undefined && !isNaN(durationTurns) ? turnForSystemMessages + durationTurns : undefined,
                turnsPending: status === 'pending' ? 0 : undefined,
            };
            
            newKb.allQuests.push(newQuest);
            newVectorMetadata = { entityId: newQuest.id, entityType: 'quest', text: formatQuestForEmbedding(newQuest) };

            const rewardSummaryStr = (guaranteedRewards.rewardExp || guaranteedRewards.rewardCurrency)
                ? ` (Thưởng: ${guaranteedRewards.rewardExp ? guaranteedRewards.rewardExp + ' Tu Vi' : ''}${guaranteedRewards.rewardExp && guaranteedRewards.rewardCurrency ? ', ' : ''}${guaranteedRewards.rewardCurrency ? guaranteedRewards.rewardCurrency + ' Linh Thạch' : ''})`
                : '';

            systemMessages.push({
                id: 'quest-assigned-' + Date.now(), type: 'system',
                content: status === 'pending' ? `📜 Bạn nhận được một lời đề nghị nhiệm vụ: ${questTitle}${rewardSummaryStr}. Hãy kiểm tra bảng nhiệm vụ để xác nhận!` : `📜 Nhiệm vụ mới: ${questTitle}${rewardSummaryStr}!`,
                timestamp: Date.now(), turnNumber: turnForSystemMessages
            });
        } else {
            console.warn(`QUEST_ASSIGNED: Quest with title "${questTitle}" already exists. Not adding duplicate.`);
        }
    } else {
        console.warn("QUEST_ASSIGNED: Missing title or description.", tagParams);
    }
    return { updatedKb: newKb, systemMessages, newVectorMetadata };
};

export const processQuestUpdated = (
    currentKb: KnowledgeBase,
    tagParams: Record<string, string>,
    turnForSystemMessages: number
): { updatedKb: KnowledgeBase; systemMessages: GameMessage[] } => {
    const newKb = currentKb;
    const systemMessages: GameMessage[] = [];
    const questTitle = tagParams.title;
    
    let cleanedTitle = questTitle || tagParams.name || "";
    if (cleanedTitle.startsWith('["')) {
        try {
            const arr = JSON.parse(cleanedTitle);
            if (Array.isArray(arr) && arr.length > 0) { cleanedTitle = arr[0]; }
        } catch(e) {
            cleanedTitle = cleanedTitle.replace(/^\["?\\?"?|\\?"?"?\]$/g, '').trim();
        }
    }
    cleanedTitle = cleanedTitle.replace(/^"|"$/g, '').replace(/^\\"/g, '').replace(/\\"/g, '').trim();

    const objectiveTextToUpdate = tagParams.objectiveText; 
    const newObjectiveText = tagParams.newObjectiveText; 
    const completed = (tagParams.completed?.toLowerCase() === 'true' || tagParams.isCompleted?.toLowerCase() === 'true');

    if (!cleanedTitle || !objectiveTextToUpdate) {
        console.warn("QUEST_UPDATED: Missing title or objectiveText.", tagParams);
        return { updatedKb: newKb, systemMessages };
    }

    const quest = findQuestByTitle(newKb.allQuests, cleanedTitle);
    
    if (quest) {
        if (isMainQuest(quest)) {
            console.warn(`QUEST_UPDATED: Blocked attempt to update main story quest "${cleanedTitle}" using QUEST_UPDATED. Use EVENT_CHECK instead.`);
            return { updatedKb: newKb, systemMessages };
        }
        let bestObjectiveMatch = { index: -1, score: 0 };
        const normalizedObjectiveTextToUpdate = normalizeStringForComparison(objectiveTextToUpdate);

        quest.objectives.forEach((obj, index) => {
            if (!obj.completed) { // Only match against uncompleted objectives
                const normalizedStoredText = normalizeStringForComparison(obj.text);
                const score = diceCoefficient(normalizedObjectiveTextToUpdate, normalizedStoredText);
                if (score > bestObjectiveMatch.score) {
                    bestObjectiveMatch = { index, score };
                }
            }
        });

        if (bestObjectiveMatch.index !== -1 && bestObjectiveMatch.score >= SIMILARITY_THRESHOLD) {
            const objectiveIndex = bestObjectiveMatch.index;
            const originalObjectiveTextForMessage = quest.objectives[objectiveIndex].text;

            quest.objectives[objectiveIndex].completed = completed;
            if (newObjectiveText) {
                quest.objectives[objectiveIndex].text = newObjectiveText;
            }
            
            const formattedObjective = formatObjectiveForSystemMessage(originalObjectiveTextForMessage, quest.title);
            systemMessages.push({
                id: 'quest-objective-updated-' + Date.now(), type: 'system',
                content: `🎯 Nhiệm vụ "${quest.title}": Mục tiêu "${formattedObjective}" đã được ${completed ? 'hoàn thành' : 'cập nhật'}.`,
                timestamp: Date.now(), turnNumber: turnForSystemMessages
            });

            const allObjectivesCompleted = quest.objectives.every(obj => obj.completed);
            if (allObjectivesCompleted) {
                quest.status = 'completed';
                
                // Add success buff if not a main quest
                if (!isMainQuest(quest)) {
                  if (!newKb.playerStats.activeStatusEffects) newKb.playerStats.activeStatusEffects = [];
                  const extractedName = extractStatusEffectNameFromQuestText(quest.rewardText || "");
                  const buffName = extractedName ? `${extractedName} (Hoàn thành)` : `Phúc lành: [${quest.title}] (Hoàn thành)`;
                  
                  const buffEffect = {
                    id: `quest-success-tag-${quest.id}-${Date.now()}`,
                    name: buffName,
                    description: quest.rewardText || `Nhận được sự công nhận và phúc trạch sau khi hoàn thành nhiệm vụ [${quest.title}].`,
                    type: 'buff' as const,
                    durationTurns: 20,
                    statModifiers: { sucTanCong: 2 },
                    specialEffects: ["QUEST_SUCCESS_BUFF"]
                  };
                  
                  newKb.playerStats.activeStatusEffects = [
                    ...newKb.playerStats.activeStatusEffects.filter((eff: any) => eff.name !== buffName),
                    buffEffect
                  ];
                }

                systemMessages.push({
                    id: 'quest-all-objectives-completed-' + Date.now(), type: 'system',
                    content: `✅ Nhiệm vụ "${quest.title}" đã hoàn thành tất cả mục tiêu!`,
                    timestamp: Date.now(), turnNumber: turnForSystemMessages
                });
            }
        } else {
            console.warn(`QUEST_UPDATED: Objective matching "${objectiveTextToUpdate}" not found or similarity too low in quest "${quest.title}". Best score: ${bestObjectiveMatch.score.toFixed(2)}.`);
        }
    }
    return { updatedKb: newKb, systemMessages };
};

export const processQuestCompleted = (
    currentKb: KnowledgeBase,
    tagParams: Record<string, string>,
    turnForSystemMessages: number
): { updatedKb: KnowledgeBase; systemMessages: GameMessage[] } => {
    const newKb = currentKb;
    const systemMessages: GameMessage[] = [];
    const questTitle = tagParams.title;
    const reasoning = tagParams.reasoning || tagParams.reason || tagParams.evidence || "";
    
    let cleanedTitle = questTitle || tagParams.name || "";
    
    // [STRICT VALIDATION] Bắt buộc phải có lý do hoàn thành và định danh nhiệm vụ
    if (!reasoning || !cleanedTitle) {
        console.log(`[STRICT PARSER] Bỏ qua QUEST_COMPLETED vì thiếu tiêu đề hoặc lý do hoàn thành cụ thể.`);
        return { updatedKb: newKb, systemMessages: [] };
    }

    if (cleanedTitle.startsWith('["')) {
        try {
            const arr = JSON.parse(cleanedTitle);
            if (Array.isArray(arr) && arr.length > 0) { cleanedTitle = arr[0]; }
        } catch(e) {
            cleanedTitle = cleanedTitle.replace(/^\["?\\?"?|\\?"?"?\]$/g, '').trim();
        }
    }
    cleanedTitle = cleanedTitle.replace(/^"|"$/g, '').replace(/^\\"/g, '').replace(/\\"/g, '').trim();

    if (!cleanedTitle) {
        console.warn("QUEST_COMPLETED: Missing title.", tagParams);
        return { updatedKb: newKb, systemMessages };
    }
    const quest = findQuestByTitle(newKb.allQuests, cleanedTitle);
    if (quest) {
        // Allow QUEST_COMPLETED for story quests to loosen completion logic as requested by user
        quest.status = 'completed';
        quest.objectives.forEach(obj => obj.completed = true); 
        
        let rewardExtraMsg = "";
        
        // Add success buff if not a main quest
        if (!isMainQuest(quest)) {
          if (!newKb.playerStats.activeStatusEffects) newKb.playerStats.activeStatusEffects = [];
          const extractedName = extractStatusEffectNameFromQuestText(quest.rewardText || "");
          const buffName = extractedName ? `${extractedName} (Hoàn thành)` : `Phúc lành: [${quest.title}] (Hoàn thành)`;
          
          const buffEffect = {
            id: `quest-success-tag-${quest.id}-${Date.now()}`,
            name: buffName,
            description: quest.rewardText || `Nhận được sự công nhận và phúc trạch sau khi hoàn thành nhiệm vụ [${quest.title}].`,
            type: 'buff' as const,
            durationTurns: 20,
            statModifiers: { sucTanCong: 2 },
            specialEffects: ["QUEST_SUCCESS_BUFF"]
          };
          
          newKb.playerStats.activeStatusEffects = [
            ...newKb.playerStats.activeStatusEffects.filter((eff: any) => eff.name !== buffName),
            buffEffect
          ];
          rewardExtraMsg = `. Đã thêm trạng thái có lợi "${buffName}" (20 lượt).`;
        }

        let rewardMsg = "";
        
        if (quest.rewardExp) {
            newKb.playerStats.kinhNghiem += quest.rewardExp;
            rewardMsg += ` Nhận ${quest.rewardExp} Tu Vi.`;
        }
        if (quest.rewardCurrency) {
            newKb.playerStats.currency += quest.rewardCurrency;
            rewardMsg += ` Nhận ${quest.rewardCurrency} Linh Thạch.`;
        }
        if (quest.rewardItem) {
            // Very basic item reward (assuming it is created similarly to ITEM_ACQUIRED)
            // If the item doesn't exist yet, we just add it to inventory as a basic item
            const newItemId = `quest-reward-${Date.now()}`;
            newKb.inventory.push({
                id: newItemId,
                name: quest.rewardItem,
                description: `Phần thưởng từ nhiệm vụ: ${quest.title}`,
                category: "Miscellaneous",
                rarity: "Phổ Thông",
                quantity: 1,
                usable: false,
                consumable: false
            } as any);
            rewardMsg += ` Nhận ${quest.rewardItem}.`;
        }

        systemMessages.push({
            id: 'quest-completed-' + Date.now(), type: 'system',
            content: `✅ Nhiệm vụ "${quest.title}" đã hoàn thành!${rewardMsg}${rewardExtraMsg}`,
            timestamp: Date.now(), turnNumber: turnForSystemMessages
        });
    }
    return { updatedKb: newKb, systemMessages };
};

export const processQuestFailed = (
    currentKb: KnowledgeBase,
    tagParams: Record<string, string>,
    turnForSystemMessages: number
): { updatedKb: KnowledgeBase; systemMessages: GameMessage[] } => {
    const newKb = currentKb;
    const systemMessages: GameMessage[] = [];
    const questTitle = tagParams.title;
    
    let cleanedTitle = questTitle || tagParams.name || "";
    if (cleanedTitle.startsWith('["')) {
        try {
            const arr = JSON.parse(cleanedTitle);
            if (Array.isArray(arr) && arr.length > 0) { cleanedTitle = arr[0]; }
        } catch(e) {
            cleanedTitle = cleanedTitle.replace(/^\["?\\?"?|\\?"?"?\]$/g, '').trim();
        }
    }
    cleanedTitle = cleanedTitle.replace(/^"|"$/g, '').replace(/^\\"/g, '').replace(/\\"/g, '').trim();

    if (!cleanedTitle) {
        console.warn("QUEST_FAILED: Missing title.", tagParams);
        return { updatedKb: newKb, systemMessages };
    }
    const quest = findQuestByTitle(newKb.allQuests, cleanedTitle);
    if (quest) {
        if (isMainQuest(quest)) {
            console.warn(`QUEST_FAILED: Blocked attempt to fail main story quest "${cleanedTitle}" using QUEST_FAILED.`);
            return { updatedKb: newKb, systemMessages };
        }
        quest.status = 'failed';
        
        let penaltyExtraMsg = "";
        // Add penalty debuff if not a main quest
        if (!isMainQuest(quest)) {
            if (!newKb.playerStats.activeStatusEffects) newKb.playerStats.activeStatusEffects = [];
            const extractedName = extractStatusEffectNameFromQuestText(quest.punishmentText || "");
            const debuffName = extractedName ? `${extractedName} (Thất bại)` : `Hậu họa: [${quest.title}] (Thất bại)`;
            
            const debuffEffect = {
                id: `quest-fail-tag-${quest.id}-${Date.now()}`,
                name: debuffName,
                description: quest.punishmentText || `Chịu hậu quả tiêu cực do thất bại hoặc chủ động hủy bỏ nhiệm vụ [${quest.title}].`,
                type: 'debuff' as const,
                durationTurns: 20,
                statModifiers: { sucTanCong: -2 },
                specialEffects: ["QUEST_FAIL_PENALTY"]
            };
            
            newKb.playerStats.activeStatusEffects = [
                ...newKb.playerStats.activeStatusEffects.filter((eff: any) => eff.name !== debuffName),
                debuffEffect
            ];
            penaltyExtraMsg = `. Đã thêm trạng thái có hại "${debuffName}" (20 lượt).`;
        }

        systemMessages.push({
            id: 'quest-failed-' + Date.now(), type: 'system',
            content: `❌ Nhiệm vụ "${quest.title}" đã thất bại!${penaltyExtraMsg}`,
            timestamp: Date.now(), turnNumber: turnForSystemMessages
        });
    }
    return { updatedKb: newKb, systemMessages };
};


export const processObjectiveUpdate = ( 
    currentKb: KnowledgeBase,
    tagParams: Record<string, string>,
    turnForSystemMessages: number
): { updatedKb: KnowledgeBase; systemMessages: GameMessage[] } => {
    console.warn("OBJECTIVE_UPDATE tag is being handled by processQuestUpdated. Consider consolidating tag usage if behavior is identical.");
    return processQuestUpdated(currentKb, tagParams, turnForSystemMessages);
};
