import { KnowledgeBase, PersonBase } from '../types';

export class NpcIntimacyDemandService {
  /**
   * Tính toán nhu cầu làm tình (số hiệp liên tiếp yêu cầu) của NPC dựa trên tổng số lần làm tình trong quá khứ.
   * Cứ 3 lượt làm tình trong lịch sử sẽ tăng thêm một lượt nhu cầu làm tình. Tối thiểu là 1 lượt.
   */
  static calculateSexDemand(totalSexCount: number): number {
    return Math.max(1, Math.floor((totalSexCount || 0) / 3));
  }

  /**
   * Tìm tất cả NPCs trong KnowledgeBase để có thể duyệt qua.
   */
  static getAllNpcs(kb: KnowledgeBase): PersonBase[] {
    return [
      ...(kb.discoveredNPCs || []),
      ...(kb.wives || []),
      ...(kb.slaves || []),
      ...(kb.prisoners || []),
      ...(kb.companions || [])
    ];
  }

  /**
   * Ghi nhận một hiệp làm tình mới cho NPC.
   */
  static recordSexRound(npc: PersonBase, turn: number): void {
    npc.totalSexCount = (npc.totalSexCount || 0) + 1;
    npc.currentSexStreak = (npc.currentSexStreak || 0) + 1;
    npc.lastSexTurn = turn;
    npc.isSexDissatisfied = false; // Khi đang làm tiếp thì hết giận dỗi
  }

  /**
   * Kiểm tra việc MC từ chối / dừng làm tình giữa chừng ở turn mới, gây giận dỗi và giảm thiện cảm.
   * Cần quét qua tất cả các NPC xem có NPC nào đang có `currentSexStreak > 0` (đang có hiệp dở dang)
   * mà ở turn hiện tại không được đáp ứng tiếp.
   *
   * @param kb KnowledgeBase
   * @param currentTurn Lượt hiện tại
   * @param activeSexPartnerName Tên NPC nữ có tag INTERACTION sex trong lượt này (nếu có)
   */
  static checkAndProcessInterruption(
    kb: KnowledgeBase,
    currentTurn: number,
    activeSexPartnerName?: string
  ): string[] {
    const systemMessages: string[] = [];
    const allNpcs = this.getAllNpcs(kb);

    const activePartnerLower = activeSexPartnerName?.toLowerCase().trim();

    for (const npc of allNpcs) {
      const npcNameLower = npc.name.toLowerCase().trim();
      const isSexWithThisNpcThisTurn = activePartnerLower === npcNameLower;

      // Nếu NPC này đang có tiến độ hiệp dở dang (currentSexStreak > 0)
      if (npc.currentSexStreak && npc.currentSexStreak > 0) {
        // Nếu ở turn mới này, MC KHÔNG làm tình tiếp với NPC này
        if (!isSexWithThisNpcThisTurn) {
          const demand = this.calculateSexDemand(npc.totalSexCount || 0);
          
          // Chỉ bị coi là đứt quãng nếu chưa đạt đủ số hiệp yêu cầu (demand)
          if (npc.currentSexStreak < demand) {
            npc.isSexDissatisfied = true;
            
            // Hạ điểm thiện cảm (giảm 10 điểm để phạt MC)
            const affinityLoss = 10;
            npc.affinity = Math.max(0, (npc.affinity || 0) - affinityLoss);

            // Ghi nhận vào lịch sử của NPC
            if (!npc.history) npc.history = [];
            npc.history.push(`[Lượt ${currentTurn}] MC từ bỏ giữa chừng khi mới chỉ đạt ${npc.currentSexStreak}/${demand} hiệp làm tình. Nàng giận dỗi mắng MC yếu sinh lý.`);

            systemMessages.push(
              `[Thiên đạo] ${npc.name} cực kỳ thất vọng và hậm hực vì bạn đã dừng lại đột ngột giữa chừng (Chỉ đạt ${npc.currentSexStreak}/${demand} hiệp nhu cầu). Điểm hảo cảm giảm ${affinityLoss}!`
            );
          } else {
            // Đã đạt đủ nhu cầu mây mưa và MC dừng lại hợp lý -> reset streak
            npc.isSexDissatisfied = false;
          }

          // Reset streak sau khi đã dừng mây mưa
          npc.currentSexStreak = 0;
        }
      } else {
        // Nếu NPC không có streak dở dang, nhưng lượt này có quan hệ mới
        if (isSexWithThisNpcThisTurn) {
          npc.isSexDissatisfied = false; // Bắt đầu hiệp mới thì hết giận dỗi
        }
      }
    }

    return systemMessages;
  }

  /**
   * Sinh các chỉ thị prompt dán chặt vào phần bối cảnh mây mưa dựa trên trạng thái sinh lý hiện tại của các NPC xung quanh.
   */
  static buildPromptLayers(kb: KnowledgeBase): string {
    const allNpcs = this.getAllNpcs(kb);
    let promptBlock = "";

    for (const npc of allNpcs) {
      const hasStreak = npc.currentSexStreak && npc.currentSexStreak > 0;
      const isDissatisfied = npc.isSexDissatisfied;

      if (hasStreak || isDissatisfied) {
        const total = npc.totalSexCount || 0;
        const demand = this.calculateSexDemand(total);
        const streak = npc.currentSexStreak || 0;

        promptBlock += `\n<nhu_cau_sinh_ly_${npc.id || npc.name.replace(/\s+/g, '')}>\n`;
        promptBlock += `================\n`;
        promptBlock += `THÔNG TIN SINH LÝ NPC NỮ: ${npc.name}\n`;
        promptBlock += `- Tổng số lần đã làm tình trong lịch sử: ${total} lần.\n`;
        promptBlock += `- Chỉ số nhu cầu làm tình hiện tại: ${demand} hiệp liên tiếp.\n`;

        if (hasStreak) {
          promptBlock += `- Tiến độ hiện tại: Đã thực hiện ${streak} hiệp liên tiếp trên tổng số ${demand} hiệp yêu cầu.\n`;
          promptBlock += `- HƯỚNG DẪN BIỂU CẢM VÀ HÀNH ĐỘNG (BẮT BUỘC): Do chưa đạt đủ ${demand} hiệp nhu cầu, ${npc.name} tuyệt đối KHÔNG thỏa mãn. Nàng đang cực kỳ khao khát, dâm đãng, thở dốc và liên tục ôm ghì lấy MC, thúc ép, dùng mọi hành động quyến rũ, khêu gợi để bắt MC phải làm tiếp hiệp sau. Lời thoại của nàng phải nũng nịu nhưng mang tính ép buộc mây mưa dồn dập.\n`;
        }

        if (isDissatisfied) {
          promptBlock += `- TRẠNG THÁI HIỆN TẠI: GIẬN DỖI / KHÓ CHỊU (MC đã dừng lại đột ngột giữa chừng ở hiệp thứ ${streak} trước khi đạt đủ ${demand} hiệp).\n`;
          promptBlock += `- HƯỚNG DẪN BIỂU CẢM VÀ HÀNH ĐỘNG (BẮT BUỘC): ${npc.name} đang vô cùng khó chịu, bực dọc, liên tục ve vãn quấy rầy và dùng những từ ngữ sắc sảo, châm biếm, chế giễu sâu cay mắng mỏ MC là 'yếu sinh lý', 'kém cỏi', 'nhanh ra', 'vô dụng'. Nàng tỏ thái độ giận dỗi ra mặt, từ chối phối hợp vui vẻ thông thường và liên tục sỉ nhục nam tính của MC để khơi gợi sự tự ái.\n`;
        }

        promptBlock += `================\n`;
        promptBlock += `</nhu_cau_sinh_ly_${npc.id || npc.name.replace(/\s+/g, '')}>\n`;
      }
    }

    return promptBlock;
  }
}
