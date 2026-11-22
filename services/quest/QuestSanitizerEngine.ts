import { KnowledgeBase } from '../../types';
import { isDotsOrEmpty } from '../../utils/sanitizeUtils';
import { QuestRewardEngine } from './QuestRewardEngine';

export class QuestSanitizerEngine {
    /**
     * Dọn dẹp cơ học toàn bộ nhiệm vụ bị rác (...)
     * và tự động bổ sung phần thưởng kinh nghiệm, tiền tệ nếu phát hiện nhiệm vụ thiếu.
     * Trả về danh sách nhiệm vụ đã được làm sạch và hoàn thiện phần thưởng.
     */
    static sanitizeAndAutoResolveQuests(kb: KnowledgeBase): { cleanedQuests: any[]; hasPurgedMainQuest: boolean } {
        if (!kb.allQuests || !Array.isArray(kb.allQuests)) {
            return { cleanedQuests: [], hasPurgedMainQuest: false };
        }

        let hasPurgedMainQuest = false;
        const playerRealm = kb.playerStats?.realm;
        const timelineEvents = kb.worldConfig?.timelineEvents || [];
        const currencyName = kb.worldConfig?.currencyName || 'Nguyên Thạch';

        const cleanedQuests = kb.allQuests.filter(quest => {
            const rawTitle = (quest as any).title || (quest as any).name || '';
            const cleanTitle = rawTitle.replace(/^\[Cốt Truyện\]\s*/i, '').trim();
            const rawDesc = (quest as any).description || (quest as any).objective || '';

            // Kiểm tra xem tiêu đề hoặc mô tả có phải là dấu ba chấm rác hay không
            const isCorrupted = isDotsOrEmpty(cleanTitle) || cleanTitle === '...' || isDotsOrEmpty(rawDesc) || rawDesc === '...';

            if (isCorrupted) {
                if (quest.id?.startsWith('mainsq-') || rawTitle.includes('[Cốt Truyện]')) {
                    hasPurgedMainQuest = true; // Đánh dấu đã xóa nhiệm vụ cốt truyện rác
                }
                return false; // Loại bỏ ngay lập tức khỏi danh sách active
            }

            return true;
        }).map(quest => {
            // Tự động kiểm tra và thêm phần thưởng cho nhiệm vụ nếu thiếu
            const isStory = QuestRewardEngine.isStoryQuest(quest.title, timelineEvents);
            if (!isStory) {
                const needsExp = !quest.rewardExp || quest.rewardExp <= 0;
                const needsCurrency = !quest.rewardCurrency || quest.rewardCurrency <= 0;
                const needsText = !quest.rewardText || !quest.rewardText.trim();

                if (needsExp || needsCurrency || needsText) {
                    const guaranteed = QuestRewardEngine.ensureQuestRewards(
                        {
                            title: quest.title,
                            rewardExp: quest.rewardExp,
                            rewardCurrency: quest.rewardCurrency,
                            rewardText: quest.rewardText,
                            rewardItem: quest.rewardItem,
                        },
                        playerRealm,
                        timelineEvents,
                        currencyName
                    );

                    return {
                        ...quest,
                        rewardExp: guaranteed.rewardExp,
                        rewardCurrency: guaranteed.rewardCurrency,
                        rewardText: guaranteed.rewardText,
                    };
                }
            }
            return quest;
        });

        return { cleanedQuests, hasPurgedMainQuest };
    }
}
