import { KnowledgeBase, GameMessage, MainQuest, Chapter } from '../../types';

export const processMainQuestSetup = (
    currentKb: KnowledgeBase,
    tagParams: Record<string, string>,
    turnForSystemMessages: number
): { updatedKb: KnowledgeBase; systemMessages: GameMessage[] } => {
    const newKb = currentKb;
    const systemMessages: GameMessage[] = [];

    const title = tagParams.title;
    const chaptersJSON = tagParams.chaptersJSON;

    if (!title || !chaptersJSON) {
        console.warn("MAIN_QUEST_SETUP: Missing title or chaptersJSON.", tagParams);
        return { updatedKb: newKb, systemMessages };
    }

    try {
        const chapters = JSON.parse(chaptersJSON) as Chapter[];
        if (!Array.isArray(chapters) || chapters.length === 0) {
            throw new Error("chaptersJSON is not a valid, non-empty array.");
        }
        
        // Validate chapters structure
        for(const chap of chapters) {
            if (typeof chap.id !== 'string' || typeof chap.title !== 'string' || typeof chap.objective !== 'string') {
                throw new Error(`Invalid chapter structure found: ${JSON.stringify(chap)}`);
            }
        }

        const mainQuest: MainQuest = {
            title,
            chapters,
            currentChapterId: chapters[0].id,
        };

        newKb.mainQuest = mainQuest;

        systemMessages.push({
            id: `main-quest-setup-${Date.now()}`,
            type: 'system',
            content: `Mạch truyện chính "${title}" đã bắt đầu! Mục tiêu chương 1: ${chapters[0].objective}`,
            timestamp: Date.now(),
            turnNumber: turnForSystemMessages
        });

    } catch (e) {
        console.error("MAIN_QUEST_SETUP: Failed to parse chaptersJSON.", chaptersJSON, e);
        systemMessages.push({
            id: `main-quest-error-${Date.now()}`,
            type: 'error',
            content: `Lỗi thiết lập Mạch Truyện Chính: ${e instanceof Error ? e.message : 'Unknown error'}`,
            timestamp: Date.now(),
            turnNumber: turnForSystemMessages
        });
    }

    return { updatedKb: newKb, systemMessages };
};

export const processProgressMainQuest = (
    currentKb: KnowledgeBase,
    tagParams: Record<string, string>,
    turnForSystemMessages: number
): { updatedKb: KnowledgeBase; systemMessages: GameMessage[] } => {
    const newKb = currentKb;
    const systemMessages: GameMessage[] = [];

    const nextChapterId = tagParams.chapterId;

    if (!newKb.mainQuest) {
        console.warn("PROGRESS_MAIN_QUEST: No main quest is active.");
        return { updatedKb: newKb, systemMessages };
    }

    if (!nextChapterId) {
        console.warn("PROGRESS_MAIN_QUEST: Missing chapterId parameter.", tagParams);
        return { updatedKb: newKb, systemMessages };
    }

    const currentChapterIndex = newKb.mainQuest.chapters.findIndex(c => c.id === newKb.mainQuest!.currentChapterId);
    const nextChapter = newKb.mainQuest.chapters.find(c => c.id === nextChapterId);

    if (nextChapter) {
        newKb.mainQuest.currentChapterId = nextChapterId;
        systemMessages.push({
            id: `main-quest-progress-${Date.now()}`,
            type: 'system',
            content: `Mạch truyện chính đã tiến triển! Bắt đầu "${nextChapter.title}". Mục tiêu mới: ${nextChapter.objective}`,
            timestamp: Date.now(),
            turnNumber: turnForSystemMessages
        });
    } else {
        // Handle quest completion if there's no next chapter
        if (currentChapterIndex === newKb.mainQuest.chapters.length - 1) {
             systemMessages.push({
                id: `main-quest-complete-${Date.now()}`,
                type: 'system',
                content: `Chúc mừng! Bạn đã hoàn thành Mạch Truyện Chính "${newKb.mainQuest.title}"!`,
                timestamp: Date.now(),
                turnNumber: turnForSystemMessages
            });
            // Optionally clear the main quest object or mark as complete
            // newKb.mainQuest = null; 
        } else {
            console.warn(`PROGRESS_MAIN_QUEST: Chapter with id "${nextChapterId}" not found.`);
             systemMessages.push({
                id: `main-quest-progress-error-${Date.now()}`,
                type: 'error',
                content: `Lỗi tiến triển Mạch Truyện Chính: Không tìm thấy chương tiếp theo.`,
                timestamp: Date.now(),
                turnNumber: turnForSystemMessages
            });
        }
    }

    return { updatedKb: newKb, systemMessages };
};