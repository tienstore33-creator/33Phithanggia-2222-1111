import { KnowledgeBase, GameMessage } from '../../types';

export const processBeginDungeonCrawl = (
    currentKb: KnowledgeBase,
    tagParams: Record<string, string>,
    turnForSystemMessages: number
): { updatedKb: KnowledgeBase; systemMessages: GameMessage[] } => {
    const newKb = currentKb;
    const systemMessages: GameMessage[] = [];

    const dungeonName = tagParams.name;
    const locationId = tagParams.locationId;

    if (!dungeonName || !locationId) {
        console.warn("BEGIN_DUNGEON_CRAWL: Missing name or locationId.", tagParams);
        return { updatedKb: newKb, systemMessages };
    }

    if (newKb.dungeonCrawlState?.isActive) {
        console.warn("BEGIN_DUNGEON_CRAWL: Cannot start a new crawl while another is active.");
        return { updatedKb: newKb, systemMessages };
    }

    newKb.dungeonCrawlState = {
        isActive: true,
        dungeonLocationId: locationId,
        dungeonName: dungeonName,
        stage: 'setup',
        startTurn: turnForSystemMessages,
        objective: `Một bí cảnh tên là ${dungeonName} đã xuất hiện. Các thế lực đang tập hợp để chuẩn bị thám hiểm.`
    };

    systemMessages.push({
        id: `dungeon-begin-${Date.now()}`,
        type: 'system',
        content: `Sự kiện thế giới: Cuộc thám hiểm ${dungeonName} đã bắt đầu!`,
        timestamp: Date.now(),
        turnNumber: turnForSystemMessages
    });

    return { updatedKb: newKb, systemMessages };
};


export const processProgressDungeonStage = (
    currentKb: KnowledgeBase,
    tagParams: Record<string, string>,
    turnForSystemMessages: number
): { updatedKb: KnowledgeBase; systemMessages: GameMessage[] } => {
    const newKb = currentKb;
    const systemMessages: GameMessage[] = [];

    if (newKb.dungeonCrawlState && newKb.dungeonCrawlState.isActive) {
        const currentStage = newKb.dungeonCrawlState.stage;
        let nextStage: typeof currentStage | null = null;

        switch (currentStage) {
            case 'setup':
                nextStage = 'entry';
                break;
            case 'entry':
                nextStage = 'puzzle';
                break;
            case 'puzzle':
                nextStage = 'reunion';
                break;
            case 'reunion':
                nextStage = 'boss';
                break;
            case 'boss':
                // Cannot progress past boss, should use END_DUNGEON_CRAWL
                console.warn("PROGRESS_DUNGEON_STAGE: Already at the boss stage. Use END_DUNGEON_CRAWL to finish.");
                break;
        }

        if (nextStage) {
            newKb.dungeonCrawlState.stage = nextStage;
            systemMessages.push({
                id: `dungeon-stage-progress-${Date.now()}`,
                type: 'system',
                content: `Tiến vào giai đoạn tiếp theo của hầm ngục: ${nextStage}.`,
                timestamp: Date.now(),
                turnNumber: turnForSystemMessages
            });
        }
    } else {
        console.warn("PROGRESS_DUNGEON_STAGE: Tag used outside of an active dungeon crawl.");
    }

    return { updatedKb: newKb, systemMessages };
};

export const processEndDungeonCrawl = (
    currentKb: KnowledgeBase,
    tagParams: Record<string, string>,
    turnForSystemMessages: number
): { updatedKb: KnowledgeBase; systemMessages: GameMessage[] } => {
    const newKb = currentKb;
    const systemMessages: GameMessage[] = [];
    
    if (newKb.dungeonCrawlState && newKb.dungeonCrawlState.isActive) {
        const dungeonName = newKb.dungeonCrawlState.dungeonName || 'hầm ngục';
        newKb.dungeonCrawlState = null; // Reset the state
        systemMessages.push({
            id: `dungeon-end-${Date.now()}`,
            type: 'system',
            content: `Cuộc thám hiểm ${dungeonName} đã kết thúc!`,
            timestamp: Date.now(),
            turnNumber: turnForSystemMessages
        });
    } else {
        console.warn("END_DUNGEON_CRAWL: Tag used but not in an active dungeon crawl.");
    }

    return { updatedKb: newKb, systemMessages };
};