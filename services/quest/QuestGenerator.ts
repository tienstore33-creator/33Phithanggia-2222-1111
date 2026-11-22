
import { KnowledgeBase, Quest } from '../../types';
import { LocationType } from '../../templates';
import { QuestRewardEngine } from './QuestRewardEngine';

export const QuestGenerator = {
    /**
     * Suggests new quests based on the current world state.
     */
    suggestNewQuests(kb: KnowledgeBase): { newQuests: Quest[], systemMessages: string[] } {
        const newQuests: Quest[] = [];
        const systemMessages: string[] = [];

        // Threshold for suggesting new quests
        const activeQuestsCount = kb.allQuests.filter(q => q.status === 'active').length;
        if (activeQuestsCount >= 6) {
            systemMessages.push("Bạn đã nhận tối đa 6 nhiệm vụ. Cần hoàn thành nhiệm vụ mới có thể được thiên đạo đưa thêm nhiệm vụ.");
            return { newQuests, systemMessages };
        }

        const currentLocation = kb.discoveredLocations.find(l => l.id === kb.currentLocationId);
        
        // Simple logic: If player is in a new town and has few quests, suggest one
        if (currentLocation && (currentLocation.locationType === LocationType.TOWN || currentLocation.locationType === LocationType.CITY)) {
            const potentialQuestName = `Khám phá ${currentLocation.name}`;
            if (!kb.allQuests.find(q => q.title === potentialQuestName)) {
                const currencyName = kb.worldConfig?.currencyName || 'Nguyên Thạch';
                const guaranteedRewards = QuestRewardEngine.ensureQuestRewards(
                    {
                        title: potentialQuestName,
                    },
                    kb.playerStats?.realm,
                    kb.worldConfig?.timelineEvents || []
                );

                const rewardText = `${guaranteedRewards.rewardCurrency} ${currencyName}, +${guaranteedRewards.rewardExp} Tu Vi (EXP)`;

                const newQuest: Quest = {
                    id: `quest-${Date.now()}-${Math.random()}`,
                    title: potentialQuestName,
                    description: `Thiên đạo nhận thấy bạn đang ở ${currentLocation.name}. Hãy tìm hiểu về những bí mật nơi đây.`,
                    status: 'active',
                    updatedAt: Date.now(),
                    rewardExp: guaranteedRewards.rewardExp,
                    rewardCurrency: guaranteedRewards.rewardCurrency,
                    rewardText: rewardText,
                    objectives: [
                        { id: 'obj-1', text: `Gặp gỡ ít nhất 3 NPC tại ${currentLocation.name}`, completed: false }
                    ]
                };
                newQuests.push(newQuest);
                systemMessages.push(`Thiên đạo nhắc nhở: Bạn có nhiệm vụ mới tại ${currentLocation.name}.`);
            }
        }



        // 3. Generate Timeline Event Quest (Nhiệm vụ cốt truyện)
        if (kb.arcState && kb.arcState.originalTimelineIndex != null && kb.worldConfig?.timelineEvents) {
            const idx = kb.arcState.originalTimelineIndex;
            const evt = kb.worldConfig.timelineEvents[idx];
            if (evt && !kb.arcState.originalEventResolved) {
                const questId = `mainsq-${idx}`;
                const existingQuest = kb.allQuests.find(q => q.id === questId);
                
                if (!existingQuest) {
                    const mainQuest: Quest = {
                        id: questId,
                        title: `[Cốt Truyện] ${evt.eventName}`,
                        description: evt.description || "Tham gia vào dòng chảy lịch sử nguyên tác.",
                        status: 'active',
                        updatedAt: Date.now(),
                        objectives: [
                            { 
                                id: 'obj-main', 
                                text: evt.requiredAction || "Đẩy nhanh tiến trình sự kiện để hệ thống chuyển sang mốc tiếp theo.", 
                                completed: false 
                            }
                        ]
                    };
                    newQuests.push(mainQuest);
                    systemMessages.push(`Thiên đạo mở ra Nhiệm vụ Cốt truyện mới: ${evt.eventName}`);
                }
            }
        }

        return { newQuests, systemMessages };
    }
};
