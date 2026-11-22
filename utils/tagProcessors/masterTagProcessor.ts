
import { KnowledgeBase, GameMessage, Master, VectorMetadata, BatchSummaryRequestItem } from '../../types';
import { formatPersonForEmbedding } from '../ragUtils';
import { summarizeEndOfDescription } from '../../services/geminiService';

export const processMasterUpdate = async (
    currentKb: KnowledgeBase,
    tagParams: Record<string, string>,
    turnForSystemMessages: number,
    summaryQueue?: BatchSummaryRequestItem[]
): Promise<{ updatedKb: KnowledgeBase; systemMessages: GameMessage[]; updatedVectorMetadata?: VectorMetadata; affinityChange?: { name: string, delta: number } }> => {
    const newKb = currentKb;
    const systemMessages: GameMessage[] = [];
    let updatedVectorMetadata: VectorMetadata | undefined = undefined;
    let affinityChange: { name: string, delta: number } | undefined = undefined;

    if (!newKb.master) {
        console.warn("MASTER_UPDATE: Cannot update master, no master object exists.");
        return { updatedKb: newKb, systemMessages };
    }

    const masterToUpdate = newKb.master;
    const oldDescription = masterToUpdate.description || "";

    // NEW: Update last interaction turn
    masterToUpdate.lastInteractionTurn = turnForSystemMessages;

    // Handle description update with "Append and Rolling Summary" logic
    if (tagParams.description) {
        const newDescriptionPart = tagParams.description;
        const combinedDescription = (oldDescription ? oldDescription + " " : "") + newDescriptionPart;
        const words = combinedDescription.split(/\s+/);
        const WORD_LIMIT = 1600;
        const SUMMARY_KEEP_WORDS = 600;
        let finalDescription = combinedDescription;
        
        if (words.length > WORD_LIMIT) {
            const firstPart = words.slice(0, SUMMARY_KEEP_WORDS).join(' ');
            const restToSummarize = words.slice(SUMMARY_KEEP_WORDS).join(' ');
            const summarizedEnd = await summarizeEndOfDescription(restToSummarize);
            finalDescription = `${firstPart}\n\n[Tóm tắt các sự kiện gần đây:]\n${summarizedEnd}`;
            
            console.log(`[Summarizer] Description for Master ${masterToUpdate.name} was summarized.`);
            systemMessages.push({
                id: `master-desc-summarized-${masterToUpdate.id}`,
                type: 'system',
                content: `Hệ thống: Mô tả của Chủ nhân ${masterToUpdate.name} đã được tóm tắt tự động.`,
                timestamp: Date.now(),
                turnNumber: turnForSystemMessages
            });
        }

        if (summaryQueue) {
            summaryQueue.push({
                id: masterToUpdate.id,
                name: masterToUpdate.name,
                oldDesc: oldDescription,
                newDesc: finalDescription,
                type: 'master'
            });
        }
        masterToUpdate.description = finalDescription;
    }


    for (const [key, value] of Object.entries(tagParams)) {
        if (key === 'description') continue;
        const paramValue = value.trim();

        if (key === 'mood') {
            const validMoods: Master['mood'][] = ['Vui Vẻ', 'Hài Lòng', 'Bình Thường', 'Bực Bội', 'Giận Dữ', 'Nghi Ngờ'];
            if (validMoods.includes(paramValue as any)) {
                masterToUpdate.mood = paramValue as Master['mood'];
            } else {
                console.warn(`MASTER_UPDATE: Invalid mood value "${paramValue}".`);
            }
        } else if (key === 'currentGoal') {
            masterToUpdate.currentGoal = paramValue;
        } else if (key === 'favor') {
            if (paramValue.startsWith('+=')) {
                const change = parseInt(paramValue.substring(2), 10);
                if (!isNaN(change)) {
                    masterToUpdate.favor = Math.max(0, Math.min(100, (masterToUpdate.favor || 0) + change));
                }
            } else if (paramValue.startsWith('-=')) {
                const change = parseInt(paramValue.substring(2), 10);
                if (!isNaN(change)) {
                    masterToUpdate.favor = Math.max(0, Math.min(100, (masterToUpdate.favor || 0) - change));
                }
            } else {
                 const val = parseInt(paramValue, 10);
                 if(!isNaN(val)) masterToUpdate.favor = Math.max(0, Math.min(100, val));
            }
        } else if (key === 'affinity') {
            let change = 0;
            let newValue: number | null = null;
            const currentValue = masterToUpdate.affinity || 0;
            let delta = 0;

            if (paramValue.startsWith('+=')) {
                delta = parseInt(paramValue.substring(2), 10);
            } else if (paramValue.startsWith('-=')) {
                delta = -parseInt(paramValue.substring(2), 10);
            } else if (paramValue.startsWith('=')) {
                delta = parseInt(paramValue.substring(1), 10) - currentValue;
            } else {
                const parsedNum = parseInt(paramValue, 10);
                if (!isNaN(parsedNum)) {
                    if (paramValue.startsWith('+') || paramValue.startsWith('-')) {
                        delta = parsedNum;
                    } else {
                        delta = parsedNum - currentValue;
                    }
                }
            }

            if (!isNaN(delta)) {
                // Apply mechanical constraints: increase max 15, decrease max 50
                if (delta > 15) delta = 15;
                if (delta < -50) delta = -50;
                if (delta !== 0) {
                    newValue = currentValue + delta;
                    affinityChange = { name: masterToUpdate.name, delta };
                }
            }
            
            if (newValue !== null) {
                masterToUpdate.affinity = Math.max(-100, Math.min(100, newValue));
            }
        } else if (key.startsWith('needs.')) {
            const needType = key.split('.')[1] as keyof Master['needs'];
            if (!masterToUpdate.needs) masterToUpdate.needs = {};

            if (paramValue.startsWith('+=')) {
                const change = parseInt(paramValue.substring(2), 10);
                if (!isNaN(change)) {
                    const currentNeed = masterToUpdate.needs[needType] || 0;
                    masterToUpdate.needs[needType] = Math.max(0, Math.min(100, currentNeed + change));
                }
            } else if (paramValue.startsWith('-=')) {
                const change = parseInt(paramValue.substring(2), 10);
                if (!isNaN(change)) {
                    const currentNeed = masterToUpdate.needs[needType] || 0;
                    masterToUpdate.needs[needType] = Math.max(0, Math.min(100, currentNeed - change));
                }
            } else {
                const val = parseInt(paramValue, 10);
                if(!isNaN(val)) masterToUpdate.needs[needType] = Math.max(0, Math.min(100, val));
            }
        }
    }

    updatedVectorMetadata = {
        entityId: masterToUpdate.id,
        entityType: 'master',
        text: formatPersonForEmbedding(masterToUpdate)
    };
    
    return { updatedKb: newKb, systemMessages, updatedVectorMetadata, affinityChange };
};
