import { GeminiService } from './geminiService';
import { IntegrityManager } from '../logic/IntegrityManager';
import { GameStore, useGameStore } from '../store/gameStore';
import { ContextPrioritizerService } from './ContextPrioritizerService';
import { FanficSourceService } from './fanficSourceService';
import { WorldSetupData } from '../types/fanfic';
import { Difficulty } from '../types/game';

export class GameplayService {
  /**
   * Đồng bộ hóa NPC khi AI định tạo mới trong lúc chơi.
   */
  static async handleNpcCreation(npcName: string) {
    const currentSetup = GameStore.getSetup();
    const currentWorkTitle = currentSetup?.topic || "";

    // BƯỚC 1: Kiểm tra xem NPC có trong file nguồn không
    let npcData = IntegrityManager.syncNpcWithSource(npcName, currentWorkTitle);

    // BƯỚC 2: Nếu không có trong file nguồn, AI tự tạo
    if (!npcData) {
      console.log(`[Gameplay] NPC ${npcName} không có trong file nguồn. AI tự tạo...`);
      npcData = await GeminiService.generateNpc(npcName);
      npcData.isOfficial = false;
    } else {
      console.log(`[Gameplay] NPC ${npcName} được đồng bộ từ file nguồn.`);
    }

    // BƯỚC 3: Lưu vào Store
    GameStore.addNpc(npcData);
    
    return npcData;
  }

  static async processTurn(userInput: string, difficulty: Difficulty) {
    const state = useGameStore.getState();
    const playerLocation = state.character.currentLocation.name;
    
    // 1. LỌC NPC TỐI ƯU (Chỉ lấy người ở cùng khu vực hoặc đang đi theo)
    const relevantNpcs = state.npcs.filter(npc => 
      npc.currentLocation === playerLocation || npc.isFollowingPlayer
    );

    // 2. FORMAT DATA GỌN GÀNG (Xử lý undefined, thêm Cảnh giới, xử lý NPC chết)
    let npcContextString = "Không có NPC nào đáng chú ý xung quanh.";
    
    if (relevantNpcs.length > 0) {
      npcContextString = relevantNpcs.map(npc => {
        const isDead = npc.hp !== undefined && npc.hp <= 0;
        const status = isDead ? "[ĐÃ CHẾT]" : "";
        
        // Chỉ đưa vào các trường có dữ liệu để tiết kiệm token
        const details = [
          npc.hp !== undefined ? `HP:${npc.hp}` : null,
          npc.realm ? `Cảnh giới:${npc.realm}` : null,
          `Thiện cảm:${npc.affinity || 0}`
        ].filter(Boolean).join(', ');

        return `- ${npc.name} ${status}: ${details}`;
      }).join('\n');
    }

    // 3. XÂY DỰNG CONTEXT SẠCH (Dùng trim() để bỏ khoảng trắng thừa)
    const canonUrl = state.setup?.remoteCanonUrl || "";
    const masterContext = await ContextPrioritizerService.getMasterContext(userInput, canonUrl);

    const context = `
Vị trí hiện tại: ${playerLocation}
Cốt truyện chính: ${state.setup?.mainPlot || "Chưa có"}

[NGỮ CẢNH TRUY XUẤT TỪ NGUYÊN TÁC (QUAN TRỌNG)]
${masterContext}

[Danh sách NPC tại khu vực này]
${npcContextString}
    `.trim();
    
    const wrappedUserInput = `<user_input><nội_dung_chính>${userInput}</nội_dung_chính></user_input>`;
    
    const response = await GeminiService.generateStoryTurn(wrappedUserInput, context, difficulty);
    
    // Cập nhật store với phản hồi của AI
    state.handleAIResponse(response);
    
    return response;
  }
}
