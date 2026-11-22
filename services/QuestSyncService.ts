
import { KnowledgeBase, GameMessage } from '../types';
import { QuestValidator } from './quest/QuestValidator';
import { QuestGenerator } from './quest/QuestGenerator';
import { sanitizeTimelineEvents, sanitizeQuests, isDotsOrEmpty } from '../utils/sanitizeUtils';
import { QuestSanitizerEngine } from './quest/QuestSanitizerEngine';
import { SandboxTimelineProgressionService } from './quest/SandboxTimelineProgressionService';

export const QuestSyncService = {
    /**
     * Synchronizes quests - both validating existing ones and suggesting new ones.
     * "Đồng bộ Thiên Đạo" step.
     */
    async sync(kb: KnowledgeBase): Promise<{ updatedKb: KnowledgeBase, systemMessages: GameMessage[] }> {
        let newKb = JSON.parse(JSON.stringify(kb)) as KnowledgeBase;
        const allSystemMessages: GameMessage[] = [];
        const turnNumber = kb.playerStats.turn;

        // --- CƠ CHẾ TỰ ĐỘNG TIẾN TRÌNH DÒNG THỜI GIAN SANDBOX (AUTO-PROGRESSION) ---
        const sandboxRes = SandboxTimelineProgressionService.processSandboxTimelineProgression(newKb);
        newKb = sandboxRes.updatedKb;
        allSystemMessages.push(...sandboxRes.systemMessages);

        // STEP 1: Dọn dẹp rác cơ học thông qua QuestSanitizerEngine
        if (newKb.allQuests) {
            const { cleanedQuests, hasPurgedMainQuest } = QuestSanitizerEngine.sanitizeAndAutoResolveQuests(newKb);
            newKb.allQuests = cleanedQuests;
            if (hasPurgedMainQuest) {
                allSystemMessages.push({
                    id: `quest-sync-purged-corrupted-${Date.now()}`,
                    type: 'system',
                    content: `[Thiên Đạo Sync - Cơ học]: Tự động dọn dẹp các nhiệm vụ cốt truyện rác bị lỗi (...)`,
                    timestamp: Date.now(),
                    turnNumber
                });
            }
        }
        if (newKb.worldConfig?.timelineEvents) {
            newKb.worldConfig.timelineEvents = sanitizeTimelineEvents(newKb.worldConfig.timelineEvents);
        }

        // --- CƠ CHẾ ĐỒNG BỘ CƠ HỌC CHO CỐT TRUYỆN (MECHANICAL TIMELINE HEALING) ---
        // Khi không thấy nhiệm vụ cốt truyện hoặc nhiệm vụ lệch với timeline thì lấy timeline làm mốc để đưa nhiệm vụ mới vào.
        if (newKb.worldConfig?.timelineEvents && newKb.worldConfig.timelineEvents.length > 0) {
            const events = newKb.worldConfig.timelineEvents;
            
            if (!newKb.arcState) {
                newKb.arcState = {
                    phase: 'active',
                    turnCount: 0,
                    targetEvent: events[0]?.eventName || null,
                    questIssued: true,
                    originalTimelineIndex: 0,
                    originalEventResolved: false
                };
            }
            if (newKb.arcState.originalTimelineIndex == null) {
                newKb.arcState.originalTimelineIndex = 0;
            }

            let iterations = 0;
            const maxIterations = 10;
            
            while (iterations < maxIterations) {
                iterations++;
                const currentIndex = newKb.arcState.originalTimelineIndex;
                
                if (currentIndex >= events.length) {
                    break;
                }

                const currentEvent = events[currentIndex];

                // Nếu event hiện tại bị thiếu hoặc tên rác/ba chấm, tự động nhảy sang mốc tiếp theo
                if (!currentEvent || isDotsOrEmpty(currentEvent.eventName)) {
                    if (currentIndex < events.length - 1) {
                        newKb.arcState.originalTimelineIndex = currentIndex + 1;
                        newKb.arcState.targetEvent = events[currentIndex + 1]?.eventName || null;
                        continue;
                    } else {
                        break;
                    }
                }

                const currentQuestId = `mainsq-${currentIndex}`;

                // Tìm tất cả nhiệm vụ cốt truyện hiện có
                if (!newKb.allQuests) {
                    newKb.allQuests = [];
                }
                const mainQuests = newKb.allQuests.filter(q => q.id.startsWith('mainsq-') || q.title.toLowerCase().startsWith('[cốt truyện]'));
                const currentQuestInList = newKb.allQuests.find(q => q.id === currentQuestId);

                // Nếu nhiệm vụ cốt truyện hiện tại đã kết thúc, tiến trình dòng thời gian tự động nâng mốc lên
                if (currentQuestInList && currentQuestInList.status === 'completed') {
                    if (currentIndex < events.length - 1) {
                        newKb.arcState.originalTimelineIndex = currentIndex + 1;
                        newKb.arcState.originalEventResolved = false;
                        newKb.arcState.targetEvent = events[currentIndex + 1]?.eventName || null;
                        allSystemMessages.push({
                            id: `quest-sync-heal-jump-${Date.now()}-${iterations}`,
                            type: 'system',
                            content: `[Thiên Đạo Sync - Cơ học]: Tự động tiến mốc dòng thời gian lên Giai đoạn #${currentIndex + 2} (${events[currentIndex + 1].eventName}) do nhiệm vụ trước đó đã hoàn thành.`,
                            timestamp: Date.now(),
                            turnNumber
                        });
                        continue; // Kiểm tra mốc mới vừa nâng lên
                    } else {
                        break; // Đã đến mốc cuối cùng
                    }
                }

                // Kiểm tra xem có nhiệm vụ cốt truyện nào đang hoạt động không
                const activeMainQuests = mainQuests.filter(q => q.status === 'active');

                if (activeMainQuests.length > 0) {
                    const matchingActiveQuest = activeMainQuests.find(q => q.id === currentQuestId);
                    
                    if (matchingActiveQuest) {
                        // Mốc hiện tại đã có nhiệm vụ hoạt động khớp hoàn hảo
                        break;
                    } else {
                        // Bị lệch timeline: Có nhiệm vụ cốt truyện hoạt động nhưng không phải của mốc hiện tại
                        activeMainQuests.forEach(q => {
                            q.status = 'completed';
                            q.objectives.forEach(obj => obj.completed = true);
                            q.updatedAt = Date.now();
                            allSystemMessages.push({
                                id: `quest-sync-heal-complete-old-${Date.now()}-${q.id}`,
                                type: 'system',
                                content: `[Thiên Đạo Sync - Cơ học]: Tự động dọn dẹp và hoàn thành nhiệm vụ cốt truyện bị lệch timeline cũ: "${q.title}"`,
                                timestamp: Date.now(),
                                turnNumber
                            });
                        });

                        // Thêm nhiệm vụ cốt truyện khớp với mốc hiện tại
                        const newQuest = {
                            id: currentQuestId,
                            title: `[Cốt Truyện] ${currentEvent.eventName}`,
                            description: currentEvent.description || "Tham gia vào dòng chảy lịch sử nguyên tác.",
                            status: 'active' as const,
                            objectives: [
                                {
                                    id: 'obj-main',
                                    text: currentEvent.requiredAction || "Đẩy nhanh tiến trình sự kiện để hệ thống chuyển sang mốc tiếp theo.",
                                    completed: false
                                }
                            ],
                            createdTurn: turnNumber,
                            updatedAt: Date.now()
                        };
                        newKb.arcState.timelineEventStartTurn = turnNumber;
                        newKb.allQuests.push(newQuest);
                        allSystemMessages.push({
                            id: `quest-sync-heal-add-${Date.now()}-${currentQuestId}`,
                            type: 'system',
                            content: `[Thiên Đạo Sync - Cơ học]: Đồng bộ mốc cốt truyện hiện tại Giai đoạn #${currentIndex + 1}. Kích hoạt nhiệm vụ: "${newQuest.title}"`,
                            timestamp: Date.now(),
                            turnNumber
                        });
                        break;
                    }
                } else {
                    // Không có nhiệm vụ cốt truyện nào đang hoạt động
                    const newQuest = {
                        id: currentQuestId,
                        title: `[Cốt Truyện] ${currentEvent.eventName}`,
                        description: currentEvent.description || "Tham gia vào dòng chảy lịch sử nguyên tác.",
                        status: 'active' as const,
                        objectives: [
                            {
                                id: 'obj-main',
                                text: currentEvent.requiredAction || "Đẩy nhanh tiến trình sự kiện để hệ thống chuyển sang mốc tiếp theo.",
                                completed: false
                            }
                        ],
                        createdTurn: turnNumber,
                        updatedAt: Date.now()
                    };

                    // Lọc bỏ bất kỳ nhiệm vụ cốt truyện trùng lặp ID nào cũ
                    newKb.allQuests = newKb.allQuests.filter(q => q.id !== currentQuestId);
                    newKb.arcState.timelineEventStartTurn = turnNumber;
                    newKb.allQuests.push(newQuest);
                    allSystemMessages.push({
                        id: `quest-sync-heal-recreate-${Date.now()}-${currentQuestId}`,
                        type: 'system',
                        content: `[Thiên Đạo Sync - Cơ học]: Không phát hiện nhiệm vụ cốt truyện hoạt động. Đã tự động kích hoạt nhiệm vụ cốt truyện mới cho mốc hiện tại Giai đoạn #${currentIndex + 1}: "${newQuest.title}"`,
                        timestamp: Date.now(),
                        turnNumber
                    });
                    break;
                }
            }
        }
        // --------------------------------------------------------------------------

        // 1. Validate progress
        const validationResult = QuestValidator.checkProgress(newKb);
        newKb.allQuests = validationResult.updatedQuests;
        
        validationResult.systemMessages.forEach(msg => {
            allSystemMessages.push({
                id: `quest-sync-val-${Date.now()}-${Math.random()}`,
                type: 'system',
                content: `[Thiên Đạo Sync]: ${msg}`,
                timestamp: Date.now(),
                turnNumber
            });
        });

        // 2. Suggest new quests
        const generationResult = QuestGenerator.suggestNewQuests(newKb);
        newKb.allQuests = [...newKb.allQuests, ...generationResult.newQuests];
        
        generationResult.systemMessages.forEach(msg => {
             allSystemMessages.push({
                id: `quest-sync-gen-${Date.now()}-${Math.random()}`,
                type: 'system',
                content: `[Thiên Đạo Sync]: ${msg}`,
                timestamp: Date.now(),
                turnNumber
            });
        });

        return { updatedKb: newKb, systemMessages: allSystemMessages };
    }
};
