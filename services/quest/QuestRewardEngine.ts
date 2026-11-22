import { KnowledgeBase, Quest } from '../../types';

export class QuestRewardEngine {
    /**
     * Kiểm tra xem nhiệm vụ có phải là nhiệm vụ cốt truyện hay không
     */
    static isStoryQuest(title: string, timelineEvents: any[] = []): boolean {
        if (!title) return false;
        const titleLower = title.toLowerCase().trim();
        if (titleLower.includes('cốt truyện') || titleLower.includes('[cốt truyện]') || titleLower.includes('[trọng yếu]')) {
            return true;
        }

        return timelineEvents.some(evt => {
            const cleanEvtName = (evt.eventName || '').trim().toLowerCase();
            if (!cleanEvtName) return false;
            const cleanTitle2 = titleLower.replace(/^\[cốt\s+truyện\]\s*/i, '').trim();
            return cleanTitle2 === cleanEvtName || cleanTitle2.includes(cleanEvtName) || cleanEvtName.includes(cleanTitle2);
        });
    }

    /**
     * Tính toán phần thưởng kinh nghiệm và tiền tệ cơ bản theo cảnh giới của người chơi
     */
    static calculateBaselineRewards(realmName?: string): { exp: number; currency: number } {
        const realm = (realmName || '').toLowerCase();

        if (realm.includes('độ kiếp') || realm.includes('đại thừa')) {
            return { exp: 50000, currency: 15000 };
        }
        if (realm.includes('hợp thể') || realm.includes('luyện hư')) {
            return { exp: 25000, currency: 8000 };
        }
        if (realm.includes('hóa thần')) {
            return { exp: 12000, currency: 4000 };
        }
        if (realm.includes('nguyên anh')) {
            return { exp: 5000, currency: 1500 };
        }
        if (realm.includes('kim đan')) {
            return { exp: 2000, currency: 500 };
        }
        if (realm.includes('trúc cơ')) {
            return { exp: 600, currency: 150 };
        }
        if (realm.includes('luyện khí')) {
            return { exp: 200, currency: 50 };
        }

        // Mặc định cho Phàm Nhân / cảnh giới chưa xác định
        return { exp: 100, currency: 25 };
    }

    /**
     * Đảm bảo mọi nhiệm vụ phụ/thường (ngoại trừ cốt truyện) đều có rewardExp và rewardCurrency > 0
     */
    static ensureQuestRewards(
        questParams: {
            title: string;
            rewardExp?: number;
            rewardCurrency?: number;
            rewardText?: string;
            rewardItem?: string;
        },
        playerRealm?: string,
        timelineEvents: any[] = [],
        currencyName: string = 'Nguyên Thạch'
    ): { rewardExp?: number; rewardCurrency?: number; rewardText?: string } {
        const isStory = this.isStoryQuest(questParams.title, timelineEvents);

        // Nếu là nhiệm vụ cốt truyện, giữ nguyên không ép buộc gán thưởng số liệu
        if (isStory) {
            return {
                rewardExp: questParams.rewardExp,
                rewardCurrency: questParams.rewardCurrency,
                rewardText: questParams.rewardText,
            };
        }

        // Nếu là nhiệm vụ thông thường/phụ, bắt buộc phải có phần thưởng
        const baseline = this.calculateBaselineRewards(playerRealm);
        
        const finalExp = (questParams.rewardExp && questParams.rewardExp > 0) 
            ? questParams.rewardExp 
            : baseline.exp;

        const finalCurrency = (questParams.rewardCurrency && questParams.rewardCurrency > 0) 
            ? questParams.rewardCurrency 
            : baseline.currency;

        let finalRewardText = questParams.rewardText || '';
        if (!finalRewardText.trim()) {
            finalRewardText = `${finalCurrency} ${currencyName}, +${finalExp} Tu Vi (EXP)`;
            if (questParams.rewardItem) {
                finalRewardText += `, ${questParams.rewardItem}`;
            }
        }

        return {
            rewardExp: finalExp,
            rewardCurrency: finalCurrency,
            rewardText: finalRewardText,
        };
    }
}
