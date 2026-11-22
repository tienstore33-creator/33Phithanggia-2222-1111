
import { KnowledgeBase, Quest, GameMessage } from '../../types';
import { isDotsOrEmpty } from '../../utils/sanitizeUtils';

export const QuestValidator = {
    /**
     * Checks all active quests for completion based on the current KnowledgeBase state.
     * returns an object with updated quests and any system messages.
     */
    checkProgress(kb: KnowledgeBase): { updatedQuests: Quest[], systemMessages: string[] } {
        const systemMessages: string[] = [];

        // Lọc bỏ ngay lập tức các nhiệm vụ rác chỉ chứa dấu ba chấm
        const validQuests = (kb.allQuests || []).filter(quest => {
            const rawTitle = ((quest as any).title || (quest as any).name || '').replace(/^\[Cốt Truyện\]\s*/i, '').trim();
            if (isDotsOrEmpty(rawTitle) || rawTitle === '...') {
                return false;
            }
            return true;
        });

        const updatedQuests = validQuests.map(quest => {
            if (quest.status !== 'active') return quest;

            let allObjectivesCompleted = true;
            const updatedObjectives = quest.objectives.map(obj => {
                if (obj.completed) return obj;

                // Example logic: if objective text mentions a location and player is there
                if (kb.currentLocationId) {
                    const location = kb.discoveredLocations.find(l => l.id === kb.currentLocationId);
                    if (location && obj.text.toLowerCase().includes(location.name.toLowerCase())) {
                        systemMessages.push(`Nhiệm vụ "${quest.title}": Hoàn thành mục tiêu "${obj.text}"`);
                        return { ...obj, completed: true, updatedAt: Date.now() };
                    }
                }

                // Example logic: check for realm requirements
                if (obj.text.includes("Đạt đến") && obj.text.includes(kb.playerStats.realm)) {
                     systemMessages.push(`Nhiệm vụ "${quest.title}": Hoàn thành mục tiêu "${obj.text}"`);
                     return { ...obj, completed: true, updatedAt: Date.now() };
                }

                allObjectivesCompleted = false;
                return obj;
            });

            // Auto-complete Main Story quests if the timeline has advanced or been resolved
            if (quest.id.startsWith('mainsq-') && kb.arcState) {
                const questIdx = parseInt(quest.id.split('-')[1]);
                if (
                    (kb.arcState.originalTimelineIndex > questIdx) ||
                    (kb.arcState.originalTimelineIndex === questIdx && kb.arcState.originalEventResolved)
                ) {
                    systemMessages.push(`Nhiệm vụ Cốt Truyện "${quest.title}": Đã hoàn thành!`);
                    const completedObjectives = updatedObjectives.map(o => ({ ...o, completed: true, updatedAt: Date.now() }));
                    return { ...quest, objectives: completedObjectives, status: 'completed' as const, updatedAt: Date.now(), resolvedAtTurn: kb.playerStats.turn };
                }
            }

            // Tự động dọn dẹp và hoàn thành các nhiệm vụ cốt truyện do AI tạo trùng lặp trước đó nếu dòng thời gian đã vượt qua
            if (!quest.id.startsWith('mainsq-') && kb.worldConfig?.timelineEvents && kb.arcState) {
                const titleClean = quest.title.replace(/^\[cốt\s+truyện\]\s*/i, '').trim().toLowerCase();
                const eventIdx = kb.worldConfig.timelineEvents.findIndex(evt => evt.eventName.trim().toLowerCase() === titleClean);
                if (eventIdx !== -1) {
                    if (
                        (kb.arcState.originalTimelineIndex > eventIdx) ||
                        (kb.arcState.originalTimelineIndex === eventIdx && kb.arcState.originalEventResolved)
                    ) {
                        systemMessages.push(`Hệ thống đồng bộ dọn dẹp nhiệm vụ cốt truyện từ AI: "${quest.title}" đã được hoàn thành.`);
                        const completedObjectives = updatedObjectives.map(o => ({ ...o, completed: true, updatedAt: Date.now() }));
                        return { ...quest, objectives: completedObjectives, status: 'completed' as const, updatedAt: Date.now(), resolvedAtTurn: kb.playerStats.turn };
                    }
                }
            }

            if (allObjectivesCompleted) {
                systemMessages.push(`Chúc mừng! Bạn đã hoàn thành nhiệm vụ: ${quest.title}`);
                return { ...quest, objectives: updatedObjectives, status: 'completed' as const, updatedAt: Date.now(), resolvedAtTurn: kb.playerStats.turn };
            }

            const hasUpdates = updatedObjectives.some((obj, idx) => obj.completed !== quest.objectives[idx].completed);
            return { ...quest, objectives: updatedObjectives, updatedAt: hasUpdates ? Date.now() : quest.updatedAt };
        });

        return { updatedQuests, systemMessages };
    }
};
