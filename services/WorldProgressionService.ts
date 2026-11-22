import { KnowledgeBase, GameMessage } from '../types';
import { realmManager } from './realmManager';
import { PregnancyService } from './PregnancyService';

export const WorldProgressionService = {
  /**
   * Tính toán và cập nhật sự tiến hóa của nền cảnh giới thế giới.
   */
  processWorldEvolution: (kb: KnowledgeBase): { updatedKb: KnowledgeBase, systemMessages: GameMessage[] } => {
    let { updatedKb, systemMessages } = WorldProgressionService.processWorldRealmEvolution(kb);
    const pregnancyResult = WorldProgressionService.processPregnancy(updatedKb);
    updatedKb = pregnancyResult.updatedKb;
    systemMessages.push(...pregnancyResult.systemMessages);
    return { updatedKb, systemMessages };
  },

  processWorldRealmEvolution: (kb: KnowledgeBase): { updatedKb: KnowledgeBase, systemMessages: GameMessage[] } => {
    const newKb = { ...kb };
    const systemMessages: GameMessage[] = [];
    const currentTurn = newKb.playerStats.turn;
    const INTERVAL = 10; 

    // Khởi tạo mốc tiến hóa nếu chưa có (cho các save cũ hoặc game mới)
    if (newKb.lastWorldEvolutionTurn === undefined) {
      // Nếu là game mới (turn 0), mốc là 0. 
      // Nếu save cũ, lấy mốc gần nhất đã qua.
      newKb.lastWorldEvolutionTurn = currentTurn - (currentTurn % INTERVAL);
    }

    // Điều kiện: Đã qua ít nhất INTERVAL lượt kể từ lần tiến hóa trước
    // VÀ không trong chiến đấu (để tránh gián đoạn trải nghiệm chiến đấu)
    if (currentTurn >= (newKb.lastWorldEvolutionTurn || 0) + INTERVAL) {
      if (!newKb.playerStats.isInCombat) {
        // Luôn chỉ tiến hóa lên ĐÚNG 1 tiểu cảnh giới (1 bước)
        const evolvedBase = realmManager.getBreakthroughRealm(newKb.worldRealmBase, newKb);
        
        if (evolvedBase !== newKb.worldRealmBase) {
          newKb.worldRealmBase = evolvedBase;
          newKb.lastWorldEvolutionTurn = currentTurn; // Cập nhật mốc lượt vừa tiến hóa
          
          systemMessages.push({
            id: `world-evo-${currentTurn}`,
            type: 'system',
            content: `🌍 **THẾ GIỚI TIẾN HÓA**: Nền cảnh giới đạt mức **${evolvedBase}**.`,
            timestamp: Date.now(),
            turnNumber: currentTurn
          });
        } else {
          // Nếu đã kịch trần cảnh giới, vẫn cập nhật mốc để không kiểm tra vô ích mỗi lượt
          newKb.lastWorldEvolutionTurn = currentTurn;
        }
      }
    }
    
    return { updatedKb: newKb, systemMessages };
  },

  processPregnancy: (kb: KnowledgeBase): { updatedKb: KnowledgeBase, systemMessages: GameMessage[] } => {
    const newKb = { ...kb };
    const messages = PregnancyService.progressPregnancies(newKb);
    
    const systemMessages: GameMessage[] = messages.map((content, index) => ({
        id: `pregnancy-event-${Date.now()}-${index}`,
        type: 'system',
        content,
        timestamp: Date.now(),
        turnNumber: newKb.playerStats.turn
    }));

    return { updatedKb: newKb, systemMessages };
  }
};
