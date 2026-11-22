import { KnowledgeBase, GameMessage, Quest } from '../../types';

export const SandboxTimelineProgressionService = {
  /**
   * Generates custom roleplaying rumor/narrative about the canon protagonist completing the timeline event.
   */
  generateCanonEventRumor(kb: KnowledgeBase, eventName: string, isDirect: boolean): string {
    const protagonistName = kb.worldConfig?.originalPlayerName || 'Nhân vật chính nguyên tác';
    
    const directRumors = [
      `[Biến Cố Nguyên Tác Diễn Ra Trước Mắt]: Ngay tại đây, bạn bất ngờ tận mắt chứng kiến ${protagonistName} đã xuất sắc hoàn tất sự kiện "${eventName}". Số mệnh đang xoay vần theo quỹ đạo nguyên tác của nó!`,
      `[Khách Quan Chứng Kiến]: Ngay tại phân cảnh này, bạn thoáng thấy bóng dáng quen thuộc của ${protagonistName} đang hoàn thành những bước cuối cùng của sự kiện "${eventName}". Mọi chuyện diễn ra chân thực ngay trước mắt bạn!`,
      `[Thời Khắc Nguyên Tác]: Sát bên cạnh bạn, ${protagonistName} vừa đột phá và giải quyết xong sự kiện "${eventName}". Bạn trực tiếp chứng kiến hào quang khí vận của nhân vật chính tỏa sáng!`
    ];

    const indirectRumors = [
      `[Tin Đồn Giang Hồ]: Khi ghé qua một tửu quán ven đường, bạn nghe thấy đám tu sĩ bàn bên đang râm ran truyền tai nhau tin tức chấn động: Tên tiểu tử ${protagonistName} vừa một tay giải quyết xong đại sự "${eventName}", chấn động cả một vùng!`,
      `[Tiếng Thì Thầm]: Đi ngang qua quảng trường tông môn, bạn tình cờ nghe được tiếng xì xào bàn tán giữa các đệ tử: "Nghe nói ${protagonistName} đã thuận lợi vượt qua khảo nghiệm và hoàn tất "${eventName}" rồi. Khí vận thật là đáng sợ!"`,
      `[Mật Thư Truyền Tin]: Bạn tình cờ nhận được một mật thư truyền tin từ bằng hữu phương xa/phố thị cổ, trong thư nhắc tới tin đồn rầm rộ khắp tu chân giới rằng ${protagonistName} đã lặng lẽ hoàn thành sự kiện trọng đại "${eventName}".`,
      `[Lời Đồn Tu Chân]: Khắp các ngõ ngách phố thị rộ lên lời bàn tán của đám đông thị dân: "${protagonistName} cuối cùng cũng đã vượt qua sóng gió và vượt qua biến cố "${eventName}" một cách không tưởng!"`,
      `[Phong Thanh Phương Xa]: Tin tức phong thanh từ phương xa đưa tới: Nhân vật chính nguyên tác ${protagonistName} đã thuận lợi dẹp yên biến cố "${eventName}" và đang bước tiếp trên con đường định mệnh.`
    ];

    if (isDirect) {
      const idx = Math.floor(Math.random() * directRumors.length);
      return directRumors[idx];
    } else {
      const idx = Math.floor(Math.random() * indirectRumors.length);
      return indirectRumors[idx];
    }
  },

  /**
   * Processes the sandbox auto-progression.
   * If game is sandbox (worldSimulator) and a main story quest has been active for 30 turns or more,
   * it gets auto-resolved by the canon protagonist, and we advance to the next timeline event.
   */
  processSandboxTimelineProgression(kb: KnowledgeBase): { updatedKb: KnowledgeBase, systemMessages: GameMessage[] } {
    const newKb = kb;
    const systemMessages: GameMessage[] = [];
    const turnNumber = kb.playerStats.turn;

    // Only applicable for Sandbox mode
    if (newKb.worldConfig?.storyMode !== 'worldSimulator') {
      return { updatedKb: newKb, systemMessages };
    }

    const events = newKb.worldConfig?.timelineEvents;
    if (!events || events.length === 0) {
      return { updatedKb: newKb, systemMessages };
    }

    if (!newKb.arcState) {
      return { updatedKb: newKb, systemMessages };
    }

    const currentIndex = newKb.arcState.originalTimelineIndex ?? 0;
    if (currentIndex >= events.length) {
      return { updatedKb: newKb, systemMessages };
    }

    const currentEvent = events[currentIndex];
    const currentQuestId = `mainsq-${currentIndex}`;

    if (!newKb.allQuests) {
      newKb.allQuests = [];
    }

    // Find our active main story quest for this timeline index
    const mainQuest = newKb.allQuests.find(q => q.id === currentQuestId && q.status === 'active');

    if (!mainQuest) {
      // If there is no active quest for this index, initialize or update its start turn to current turn
      newKb.arcState.timelineEventStartTurn = turnNumber;
      return { updatedKb: newKb, systemMessages };
    }

    // Initialize createdTurn if missing
    if (mainQuest.createdTurn == null) {
      mainQuest.createdTurn = turnNumber;
    }

    // Sync timelineEventStartTurn with the quest's actual createdTurn
    newKb.arcState.timelineEventStartTurn = mainQuest.createdTurn;

    const startTurn = mainQuest.createdTurn;
    const elapsedTurns = turnNumber - startTurn;

    // If active for 30 turns or more, auto-complete it and advance!
    if (elapsedTurns >= 30) {
      // Complete the active quest
      mainQuest.status = 'completed';
      mainQuest.completedByCanonProtagonist = true;
      mainQuest.resolvedAtTurn = turnNumber;
      mainQuest.updatedAt = Date.now();
      mainQuest.objectives.forEach(obj => {
        obj.completed = true;
        obj.updatedAt = Date.now();
      });

      // Advance arcState
      newKb.arcState.originalEventResolved = true;
      
      // Determine if protagonist is present in the same location
      const protagonistName = newKb.worldConfig?.originalPlayerName;
      let isProtagonistPresent = false;
      if (protagonistName && newKb.currentLocationId) {
        isProtagonistPresent = newKb.discoveredNPCs?.some(
          npc => npc.name === protagonistName && npc.locationId === newKb.currentLocationId
        ) || false;
      }

      // Generate immersive in-universe rumor text
      const eventName = currentEvent?.eventName || 'Biến cố cốt truyện';
      const rumorText = this.generateCanonEventRumor(newKb, eventName, isProtagonistPresent);

      // Save to lastCanonNews for narrative flow
      newKb.arcState.lastCanonNews = rumorText;

      // Add as system story message to currentTurnLog
      if (!newKb.currentTurnLog) {
        newKb.currentTurnLog = [];
      }
      newKb.currentTurnLog.push({
        role: 'system',
        text: rumorText
      });

      // Advance to next index
      const nextIndex = currentIndex + 1;
      newKb.arcState.originalTimelineIndex = nextIndex;
      newKb.arcState.originalEventResolved = false;
      newKb.arcState.timelineEventStartTurn = turnNumber; // Reset timer for the next event

      if (nextIndex < events.length) {
        newKb.arcState.targetEvent = events[nextIndex]?.eventName || null;

        // Create the next active main quest
        const nextEvent = events[nextIndex];
        const nextQuestId = `mainsq-${nextIndex}`;
        const nextQuest: Quest = {
          id: nextQuestId,
          title: `[Cốt Truyện] ${nextEvent.eventName}`,
          description: nextEvent.description || 'Tham gia vào dòng chảy lịch sử nguyên tác.',
          status: 'active',
          objectives: [
            {
              id: 'obj-main',
              text: nextEvent.requiredAction || 'Đẩy nhanh tiến trình sự kiện để hệ thống chuyển sang mốc tiếp theo.',
              completed: false
            }
          ],
          createdTurn: turnNumber,
          updatedAt: Date.now()
        };

        // Filter old matching ID just in case and push next
        newKb.allQuests = newKb.allQuests.filter(q => q.id !== nextQuestId);
        newKb.allQuests.push(nextQuest);

        systemMessages.push({
          id: `quest-sync-sandbox-auto-${Date.now()}`,
          type: 'system',
          content: rumorText,
          timestamp: Date.now(),
          turnNumber
        });
      } else {
        newKb.arcState.targetEvent = null;
        systemMessages.push({
          id: `quest-sync-sandbox-end-${Date.now()}`,
          type: 'system',
          content: `Dòng thời gian nguyên tác đã hoàn tất chặng đường cuối cùng của Sandbox.`,
          timestamp: Date.now(),
          turnNumber
        });
      }
    }

    return { updatedKb: newKb, systemMessages };
  }
};
