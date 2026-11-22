import { KnowledgeBase, GameMessage } from '../types';

/**
 * Service chuyên biệt đảm bảo tính toàn vẹn của Chủ Nhân (Master Integrity).
 * Nếu MC đang là tù nhân/nô lệ nhưng NPC chủ nhân không tồn tại trong discoveredNPCs,
 * đã chết, hoặc bị giam cầm, hệ thống cơ học sẽ tự động giải phóng MC ngay lập tức.
 */
export class MasterIntegrityService {
  /**
   * Kiểm tra tính toàn vẹn của trạng thái tù nhân / nô lệ đối với MC.
   * Nếu không hợp lệ -> Tự động giải phóng cơ học.
   */
  public static validateAndEnforceMasterIntegrity(
    kb: KnowledgeBase,
    turnNumber: number = 0
  ): { updatedKb: KnowledgeBase; freed: boolean; message?: GameMessage } {
    if (!kb || !kb.playerStats || !kb.playerStats.playerSpecialStatus) {
      // Nếu không có trạng thái tù nhân/nô lệ nhưng vẫn còn dữ liệu master thừa -> dọn dẹp sạch
      if (kb && kb.master) {
        kb.master = null as any;
      }
      return { updatedKb: kb, freed: false };
    }

    const specialStatus = kb.playerStats.playerSpecialStatus;
    const ownerName = (specialStatus.ownerName || '').trim();
    const statusType = specialStatus.type === 'prisoner' ? 'Tù Nhân' : 'Nô Lệ';

    // 1. Kiểm tra nếu ownerName rỗng hoặc là tên vô danh chung chung
    const isInvalidGenericName = !ownerName || 
      ownerName.toLowerCase() === 'kẻ địch' || 
      ownerName.toLowerCase() === 'không rõ' || 
      ownerName.toLowerCase() === 'unknown' ||
      ownerName.toLowerCase() === 'kẻ bắt giữ';

    if (isInvalidGenericName) {
      kb.playerStats.playerSpecialStatus = null;
      kb.master = null as any;

      const systemMessage: GameMessage = {
        id: `sys-freed-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        type: 'system',
        content: `🕊️ [GIẢI PHÓNG CƠ HỌC]: Chủ nhân không có danh tính thực thể cụ thể. Cơ chế tự động giải phóng bạn khỏi trạng thái ${statusType}!`,
        turnNumber: turnNumber,
        timestamp: Date.now()
      };

      return { updatedKb: kb, freed: true, message: systemMessage };
    }

    // 2. Tìm kiếm NPC chủ nhân trong danh sách discoveredNPCs
    const discoveredNPCs = kb.discoveredNPCs || [];
    const matchedNpc = discoveredNPCs.find(
      (npc) => npc && npc.name && (
        npc.name.trim() === ownerName ||
        npc.name.trim().toLowerCase() === ownerName.toLowerCase()
      )
    );

    // 3. Đánh giá tính hợp lệ của NPC chủ nhân
    let shouldRelease = false;
    let releaseReason = '';

    if (!matchedNpc) {
      shouldRelease = true;
      releaseReason = `Chủ nhân "${ownerName}" không còn tồn tại trong thế giới (đã bị xoá hoặc biến mất).`;
    } else if (matchedNpc.isDead || (typeof (matchedNpc as any).sinhLuc === 'number' && (matchedNpc as any).sinhLuc <= 0)) {
      shouldRelease = true;
      releaseReason = `Chủ nhân "${ownerName}" đã tử nạn. Không còn ai khống chế bạn.`;
    } else if (
      (matchedNpc as any).isPrisoner || 
      (matchedNpc as any).isSlave || 
      (matchedNpc as any).role === 'prisoner' || 
      (matchedNpc as any).role === 'slave' ||
      (kb.prisoners || []).some(p => p.name === matchedNpc.name) ||
      (kb.slaves || []).some(s => s.name === matchedNpc.name)
    ) {
      shouldRelease = true;
      releaseReason = `Chủ nhân "${ownerName}" đã bị bắt giữ/trở thành tù nhân. Bạn tự động được tự do!`;
    }

    // 4. Nếu không hợp lệ -> Giải phóng cơ học
    if (shouldRelease) {
      kb.playerStats.playerSpecialStatus = null;
      kb.master = null as any;

      const systemMessage: GameMessage = {
        id: `sys-freed-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        type: 'system',
        content: `🕊️ [GIẢI PHÓNG CƠ HỌC]: ${releaseReason} Bạn đã hoàn toàn thoát khỏi thân phận ${statusType}!`,
        turnNumber: turnNumber,
        timestamp: Date.now()
      };

      return { updatedKb: kb, freed: true, message: systemMessage };
    }

    // 5. Nếu NPC chủ nhân hợp lệ -> Đồng bộ dữ liệu master với NPC trong discoveredNPCs
    if (matchedNpc && !kb.master) {
      kb.master = {
        ...matchedNpc,
        mood: (matchedNpc as any).mood || 'Bình thường',
        needs: (matchedNpc as any).needs || 'Chưa rõ',
        currentGoal: (matchedNpc as any).currentGoal || 'Quan sát',
        favor: (matchedNpc as any).favor || 50
      };
    }

    return { updatedKb: kb, freed: false };
  }
}
