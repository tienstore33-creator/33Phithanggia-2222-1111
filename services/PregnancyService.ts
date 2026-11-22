import { NPC, KnowledgeBase } from '../types';

export class PregnancyService {
  private static readonly PREGNANCY_DURATION_TURNS = 20;
  private static readonly REVEAL_TURN = 5;
  private static readonly CONCEPTION_CHANCE = 0.2; // 20%

  // 1. Roll thụ thai khi có tương tác 'sex'
  public static checkConception(npc: any, fatherId: string = 'player', fatherName: string = 'Người chơi'): boolean {
    if (npc.gender !== 'Nữ' || (npc.pregnancy && npc.pregnancy.isPregnant)) {
      return false; // Không đủ điều kiện
    }
    
    const roll = Math.random();
    if (roll <= this.CONCEPTION_CHANCE) {
      npc.pregnancy = {
        isPregnant: true,
        fatherId: fatherId,
        fatherName: fatherName,
        currentTurn: 0,
        isRevealed: false,
        childGenerated: false
      };
      return true;
    }
    return false;
  }

  // 2. Cập nhật tiến độ thai kỳ sau mỗi lượt (gọi trong WorldProgressionService)
  public static progressPregnancies(kb: KnowledgeBase): string[] {
    const systemMessages: string[] = [];
    const allNpcLists = [
        'discoveredNPCs',
        'wives',
        'slaves',
        'prisoners'
    ];

    allNpcLists.forEach(listName => {
        const list = (kb as any)[listName] as NPC[];
        if (!list) return;

        list.forEach(npc => {
            if (npc.pregnancy && npc.pregnancy.isPregnant && !npc.pregnancy.childGenerated) {
                npc.pregnancy.currentTurn += 1;
                
                // Logic Reveal
                if (npc.pregnancy.currentTurn === this.REVEAL_TURN && !npc.pregnancy.isRevealed) {
                    npc.pregnancy.isRevealed = true;
                    systemMessages.push(`[HỆ THỐNG]: ${npc.name} dạo này thường xuyên thấy người mệt mỏi, nôn nghén. Có vẻ như mầm sống mới đã đâm chồi!`);
                }
                
                // Logic Sinh con
                if (npc.pregnancy.currentTurn >= this.PREGNANCY_DURATION_TURNS) {
                    this.handleBirth(npc, kb);
                    systemMessages.push(`[HỆ THỐNG]: TIN VUI! ${npc.name} đã hạ sinh một đứa trẻ hồng hào. Mẫu tử bình an!`);
                }
            }
        });
    });

    return systemMessages;
  }

  // 3. Logic sinh con & Sinh NPC mới
  private static handleBirth(mother: NPC, kb: KnowledgeBase) {
    mother.pregnancy!.childGenerated = true; // Kết thúc thai kỳ
    mother.pregnancy!.isPregnant = false;

    // Phân tích thuộc tính (logic gen di truyền đơn giản)
    const isMale = Math.random() > 0.5;
    
    const newChild: NPC = {
      id: `child-${mother.id}-${Date.now()}`,
      name: `Con của ${mother.name}`,
      gender: isMale ? 'Nam' : 'Nữ',
      race: mother.race || 'Người',
      personalityTraits: ['Ngây thơ', 'Phụ thuộc'],
      description: `Đứa con máu mủ của ${mother.name} và ${mother.pregnancy?.fatherName || 'Người chơi'}. Vừa mới chào đời.`,
      realm: 'Phàm Nhân', 
      affinity: 100, // Hảo cảm tuyệt đối
      relationshipToPlayer: 'Con cái'
    } as any;
    
    // Thêm đứa trẻ vào hệ thống
    if (!kb.discoveredNPCs) kb.discoveredNPCs = [];
    kb.discoveredNPCs.push(newChild);
  }
  
  // 4. Lấy dữ liệu bơm vào Prompt (Inject vào ai/promptBuilders.ts)
  public static getPregnancyContext(npc: any): string {
    if (!npc.pregnancy?.isPregnant) return '';
    
    const turn = npc.pregnancy.currentTurn;
    if (turn < this.REVEAL_TURN || !npc.pregnancy.isRevealed) {
        return `\n[DỮ LIỆU BÍ MẬT - Đừng nhắc trực tiếp]: ${npc.name} đang mang thai tháng đầu. Hãy thỉnh thoảng chèn chi tiết biểu hiện mệt mỏi, chán ăn hoặc nôn nghén nhẹ vào lời kể.`;
    } else if (turn < 18) {
        return `\n[BỐI CẢNH NGOÀI ĐỜI]: ${npc.name} bụng đã nhô cao, di chuyển cẩn trọng, là phụ nữ đang mang thai rõ rệt.`;
    } else {
        return `\n[BỐI CẢNH NGOÀI ĐỜI]: ${npc.name} bụng lớn vượt mặt, có thể lâm bồn sinh nở bất cứ lúc nào.`;
    }
  }
}
