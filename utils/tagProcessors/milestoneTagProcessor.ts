import { KnowledgeBase, GameMessage } from '../../types';

export const processUnlockMilestone = (
    currentKb: KnowledgeBase,
    tagParams: Record<string, string>,
    turnForSystemMessages: number
): { updatedKb: KnowledgeBase; systemMessages: GameMessage[] } => {
    const newKb = currentKb;
    const systemMessages: GameMessage[] = [];

    const milestoneId = tagParams.id;
    const description = tagParams.description || tagParams.value; // Allow 'value' as fallback alias

    if (!milestoneId || !description) {
        console.warn("UNLOCK_MILESTONE: Missing id or description.", tagParams);
        return { updatedKb: newKb, systemMessages };
    }

    // Initialize if missing
    if (!newKb.milestones) {
        newKb.milestones = {};
    }

    // Check if already exists
    if (newKb.milestones[milestoneId]) {
        // Milestone already unlocked, do nothing or log debug
        console.log(`Milestone ${milestoneId} already unlocked.`);
        return { updatedKb: newKb, systemMessages };
    }

    // Record new milestone
    newKb.milestones[milestoneId] = {
        id: milestoneId,
        description: description,
        turn: turnForSystemMessages
    };

    systemMessages.push({
        id: `milestone-unlocked-${milestoneId}-${Date.now()}`,
        type: 'system',
        content: `[CỘT MỐC] Đã mở khóa: ${description}`,
        timestamp: Date.now(),
        turnNumber: turnForSystemMessages
    });

    return { updatedKb: newKb, systemMessages };
};
