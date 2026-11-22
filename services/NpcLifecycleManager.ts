import { KnowledgeBase, NPC } from '../types';
import { MasterIntegrityService } from './MasterIntegrityService';

/**
 * HỆ THỐNG QUẢN LÝ VÒNG ĐỜI VÀ TÁI NGỘ NPC (NPC LIFECYCLE & REUNION MANAGER)
 * Kết hợp Cơ học chính xác (Turn Counter) và Trí tuệ nhân tạo (AI Prompt Injection).
 */
export class NpcLifecycleManager {
  private static COUNTER_THRESHOLD_SAP_QUEN = 20; // Ngưỡng số lượt không tương tác để đưa vào danh sách dự bị (20 < N < 60)
  private static COUNTER_THRESHOLD_QUEN_LANG = 60; // Ngưỡng số lượt để bị xóa khỏi bộ nhớ

  /**
   * Lấy danh sách tất cả NPC từ các nguồn trong Game State
   */
  public static getAllActiveNpcs(knowledgeBase: KnowledgeBase): NPC[] {
    const list: NPC[] = [];
    const seenIds = new Set<string>();

    const addIfNew = (npc: any) => {
      if (npc && npc.id && !seenIds.has(npc.id)) {
        seenIds.add(npc.id);
        list.push(npc);
      }
    };

    if (Array.isArray(knowledgeBase.discoveredNPCs)) {
      knowledgeBase.discoveredNPCs.forEach(addIfNew);
    }
    if (Array.isArray(knowledgeBase.companions)) {
      knowledgeBase.companions.forEach(addIfNew);
    }
    if (Array.isArray((knowledgeBase as any).wives)) {
      (knowledgeBase as any).wives.forEach(addIfNew);
    }
    if (Array.isArray((knowledgeBase as any).slaves)) {
      (knowledgeBase as any).slaves.forEach(addIfNew);
    }
    if (Array.isArray((knowledgeBase as any).prisoners)) {
      (knowledgeBase as any).prisoners.forEach(addIfNew);
    }

    return list;
  }

  private static isVendor(npc: any): boolean {
    const isV = !!(npc.vendorType || npc.shopInventory || npc.slavesForSale || npc.prisonersForSale || npc.vendorBuysCategories || npc.role === 'vendor' || npc.role === 'merchant' || npc.occupation === 'merchant' || npc.occupation === 'vendor' || npc.isMerchant || npc.isVendor);
    if (isV) return true;
    
    const name = (npc.name || "").toLowerCase();
    const vendorKeywords = ["thương nhân", "chủ tiệm", "chủ quán", "chủ cửa hàng", "tiệm", "quầy", "gian hàng", "vendor", "merchant", "shopkeeper", "shop owner", "đấu giá"];
    return vendorKeywords.some(kw => name.includes(kw));
  }

  private static isPrisonerOrSlave(npc: any, knowledgeBase: KnowledgeBase): boolean {
    // 1. Kiểm tra cơ học chính xác bằng cách tra cứu ID trong danh sách prisoners hoặc slaves
    if (Array.isArray((knowledgeBase as any).prisoners) && (knowledgeBase as any).prisoners.some((p: any) => p.id === npc.id)) {
      return true;
    }
    if (Array.isArray((knowledgeBase as any).slaves) && (knowledgeBase as any).slaves.some((s: any) => s.id === npc.id)) {
      return true;
    }

    // 2. Kiểm tra các trường thuộc tính/cờ cơ học trực tiếp trên đối tượng NPC
    const mechanicalCheck = !!(
      npc.isPrisoner || 
      npc.isSlave || 
      npc.role === 'prisoner' || 
      npc.role === 'slave' || 
      npc.occupation === 'prisoner' || 
      npc.occupation === 'slave' ||
      npc.prisonerType ||
      npc.slaveType
    );
    if (mechanicalCheck) return true;

    // 3. Kiểm tra từ khóa ngữ nghĩa trong tên NPC
    const name = (npc.name || "").toLowerCase();
    const excludeKeywords = ["tù nhân", "nô lệ", "tù binh", "khổ sai", "prisoner", "slave"];
    return excludeKeywords.some(kw => name.includes(kw));
  }

  private static removeNpcFromState(knowledgeBase: KnowledgeBase, npcId: string) {
    if (Array.isArray(knowledgeBase.discoveredNPCs)) {
      knowledgeBase.discoveredNPCs = knowledgeBase.discoveredNPCs.filter(n => n.id !== npcId);
    }
    if (Array.isArray(knowledgeBase.companions)) {
      knowledgeBase.companions = knowledgeBase.companions.filter(n => n.id !== npcId);
    }
    if (Array.isArray((knowledgeBase as any).wives)) {
      (knowledgeBase as any).wives = (knowledgeBase as any).wives.filter((n: any) => n.id !== npcId);
    }
    if (Array.isArray((knowledgeBase as any).slaves)) {
      (knowledgeBase as any).slaves = (knowledgeBase as any).slaves.filter((n: any) => n.id !== npcId);
    }
    if (Array.isArray((knowledgeBase as any).prisoners)) {
      (knowledgeBase as any).prisoners = (knowledgeBase as any).prisoners.filter((n: any) => n.id !== npcId);
    }
    // Tự động kiểm tra giải phóng MC nếu NPC bị xoá chính là chủ nhân
    MasterIntegrityService.validateAndEnforceMasterIntegrity(knowledgeBase);
  }

  /**
   * [GIAI ĐOẠN 1: CẬP NHẬT CƠ HỌC] (Chạy ngầm sau mỗi lượt lời kể)
   * Phân tích lời kể vừa sinh ra để tăng bộ đếm hoặc reset bộ đếm về 0. Đồng thời xóa các NPC bị quên lãng.
   */
  public static async updateNpcCounters(knowledgeBase: KnowledgeBase, newlyGeneratedStoryText: string): Promise<void> {
    if (!newlyGeneratedStoryText) return;

    if (!knowledgeBase.forgottenNPCs) {
      knowledgeBase.forgottenNPCs = [];
    }

    // Lấy danh sách NPC thực tế từ state
    const activeNpcs = this.getAllActiveNpcs(knowledgeBase);
    const currentTurn = (knowledgeBase.turnHistory?.length || 0) + 1;
    const lowerStoryText = newlyGeneratedStoryText.toLowerCase();

    let processedCount = 0;
    const npcsToRemove: { id: string, name: string, isVendorNpc: boolean }[] = [];

    for (const npc of activeNpcs) {
      if (!npc.name) continue;
      
      const npcNameLower = npc.name.toLowerCase();
      
      const quickCheck = lowerStoryText.includes(npcNameLower);
      let isMentioned = false;

      if (quickCheck) {
        const escapedName = npc.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const nameRegex = new RegExp(`\\b${escapedName}\\b`, 'i');
        isMentioned = nameRegex.test(newlyGeneratedStoryText);
      }

      if (isMentioned) {
        // AI vừa nhắc tên hoặc NPC có thoại => Reset bộ đếm = 0
        npc.reunionCounter = 0;
        npc.lastInteractionTurn = currentTurn;
      } else {
        // Không nhắc đến => Tăng bộ đếm lượt
        npc.reunionCounter = (npc.reunionCounter || 0) + 1;

        // KIỂM TRA QUÊN LÃNG (N >= 60 lượt liên tiếp không được nhắc tới)
        if (npc.reunionCounter >= this.COUNTER_THRESHOLD_QUEN_LANG) {
          npcsToRemove.push({ id: npc.id, name: npc.name, isVendorNpc: this.isVendor(npc) });
        }
      }

      processedCount++;
      if (processedCount % 100 === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    // Xử lý Xóa NPC
    for (const npc of npcsToRemove) {
      this.removeNpcFromState(knowledgeBase, npc.id);
      if (!npc.isVendorNpc) {
        if (!knowledgeBase.forgottenNPCs.includes(npc.name)) {
          knowledgeBase.forgottenNPCs.push(npc.name);
        }
        console.log(`[NPC Lifecycle] Đã QUÊN LÃNG và xóa NPC ${npc.name} khỏi hệ thống (lưu vào mảng forgottenNPCs).`);
      } else {
        console.log(`[NPC Lifecycle] Đã TIÊU HUỶ hoàn toàn NPC chủ tiệm ${npc.name} khỏi hệ thống (Không lưu vào forgottenNPCs).`);
      }
    }

    // Cập nhật tỉ lệ roll thất bại nếu chưa có
    if (knowledgeBase.reunionChancePercent === undefined) {
      knowledgeBase.reunionChancePercent = 10;
    }
  }

  /**
   * [GIAI ĐOẠN 2 & 3: LỌC DANH SÁCH DỰ BỊ VÀ LỰA CHỌN NGẪU NHIÊN THEO PERCENT LŨY TIẾN]
   */
  public static selectReunionCandidates(knowledgeBase: KnowledgeBase): { 
    npcs: NPC[]; 
    isForgottenReunion: boolean;
    isNsfwParallelSex?: boolean;
    nsfwStyle?: string;
  } {
    if (knowledgeBase.reunionChancePercent === undefined) {
      knowledgeBase.reunionChancePercent = 10;
    }

    const currentChance = knowledgeBase.reunionChancePercent;
    const roll = Math.random() * 100;
    const isEventTriggered = roll < currentChance;

    if (isEventTriggered) {
      knowledgeBase.reunionChancePercent = 10;
      console.log(`[NPC Lifecycle] KÍCH HOẠT EVENT TÁI NGỘ! Roll: ${roll.toFixed(2)}% < ${currentChance}%.`);

      const rollBranch = Math.random();
      const isForgottenBranch = rollBranch >= 0.5;

      if (isForgottenBranch && knowledgeBase.forgottenNPCs && knowledgeBase.forgottenNPCs.length > 0) {
        // 50% -> NHÓM ĐÃ QUÊN LÃNG
        const pool = knowledgeBase.forgottenNPCs;
        const randomIndex = Math.floor(Math.random() * pool.length);
        const forgottenName = pool[randomIndex];
        console.log(`[NPC Lifecycle] Chọn nhánh QUÊN LÃNG: Gọi về NPC ${forgottenName}.`);

        // Xóa khỏi mảng forgottenNPCs vì chuẩn bị được hồi sinh
        knowledgeBase.forgottenNPCs.splice(randomIndex, 1);

        // Tạo 1 NPC giả để truyền vào Prompt Injection (Giai đoạn 4)
        const mockForgottenNpc: any = {
          id: `forgotten_${Date.now()}`,
          name: forgottenName,
          description: "NPC từng bị quên lãng. Cần được hệ thống (AI) khôi phục và làm mới toàn bộ tiểu sử dựa trên RAG.",
          reunionCounter: 999
        };

        return { npcs: [mockForgottenNpc as NPC], isForgottenReunion: true };
      } else {
        // 50% -> NHÓM SẮP QUÊN (Hoặc nhánh Quên lãng trống => fallback về đây)
        const activeNpcs = this.getAllActiveNpcs(knowledgeBase);
        
        const candidatePool = activeNpcs.filter(npc => {
          const counter = npc.reunionCounter || 0;
          return counter > this.COUNTER_THRESHOLD_SAP_QUEN && 
                 counter < this.COUNTER_THRESHOLD_QUEN_LANG && 
                 !this.isVendor(npc) &&
                 !this.isPrisonerOrSlave(npc, knowledgeBase);
        });

        if (candidatePool.length === 0) {
          console.log(`[NPC Lifecycle] Event được kích hoạt nhưng chưa có NPC nào đủ điều kiện tái hợp (20 < Counter < 60).`);
          return { npcs: [], isForgottenReunion: false };
        }

        const selected: NPC[] = [];
        const numToSelect = Math.min(candidatePool.length, Math.floor(Math.random() * 2) + 1); 
        const shuffled = [...candidatePool].sort(() => 0.5 - Math.random());
        
        for (let i = 0; i < numToSelect; i++) {
          selected.push(shuffled[i]);
        }

        console.log(`[NPC Lifecycle] Chọn nhánh SẮP QUÊN: ${selected.map(n => n.name).join(', ')}`);

        // Tính toán cơ học xác suất 50% cho phân đoạn 18+ nếu bật chế độ người lớn
        const isNsfw = !!(knowledgeBase.worldConfig?.nsfwMode || (knowledgeBase as any).isAdultMode);
        const isNsfwParallelSex = isNsfw && (Math.random() < 0.5);
        const nsfwStyle = knowledgeBase.worldConfig?.nsfwDescriptionStyle || 'Hoa Mỹ (Văn chương, ẩn dụ, nghệ thuật)';

        if (isNsfwParallelSex) {
          console.log(`[NPC Lifecycle] KÍCH HOẠT PHÂN ĐOẠN 18+ (50% cơ học) cho NPC: ${selected.map(n => n.name).join(', ')}`);
        }

        return { 
          npcs: selected, 
          isForgottenReunion: false,
          isNsfwParallelSex,
          nsfwStyle
        };
      }

    } else {
      knowledgeBase.reunionChancePercent = currentChance + 5;
      return { npcs: [], isForgottenReunion: false };
    }
  }

  /**
   * [GIAI ĐOẠN 4: CHỈ THỊ CHO AI - SYSTEM PROMPT INJECTION]
   */
  public static injectReunionPrompt(
    finalPrompt: string, 
    reunionData?: { 
      npcs: NPC[]; 
      isForgottenReunion: boolean;
      isNsfwParallelSex?: boolean;
      nsfwStyle?: string;
    } | NPC[]
  ): string {
    // Tương thích ngược: Nếu gọi kiểu cũ truyền mảng NPC[] 
    let selectedNpcs: NPC[] = [];
    let isForgottenReunion = false;
    let isNsfwParallelSex = false;
    let nsfwStyle = 'Hoa Mỹ (Văn chương, ẩn dụ, nghệ thuật)';
    
    if (Array.isArray(reunionData)) {
      selectedNpcs = reunionData;
    } else if (reunionData && reunionData.npcs) {
      selectedNpcs = reunionData.npcs;
      isForgottenReunion = !!reunionData.isForgottenReunion;
      isNsfwParallelSex = !!reunionData.isNsfwParallelSex;
      if (reunionData.nsfwStyle) {
        nsfwStyle = reunionData.nsfwStyle;
      }
    }

    if (!selectedNpcs || selectedNpcs.length === 0) return finalPrompt;

    if (isForgottenReunion) {
      // PROMPT CHO NHÁNH ĐÃ QUÊN LÃNG (TẠI TẠO MỚI)
      let injectionBlock = `
========================================================================
[HỆ THỐNG KHẨN CẤP: PHỤC SINH CỐT TRUYỆN - TÁI NGỘ NGƯỜI CŨ]
========================================================================
Nhân vật [ ${selectedNpcs[0].name} ] từng tồn tại trong quá khứ của nhân vật chính (MC) nhưng đã bị gạt ra khỏi dữ liệu hiện tại do thời gian dài không gặp gỡ.
Yêu cầu AI:
- Tạo một kịch bản bất ngờ để [ ${selectedNpcs[0].name} ] xuất hiện ngay TRƯỚC MẶT MC lúc này.
- AI phải "regenerate" (tạo mới hoàn toàn) diện mạo, thái độ, sức mạnh, và mục đích của ${selectedNpcs[0].name} dựa trên thông tin (RAG) quá khứ (nếu có), hoặc diễn giải rằng sau một thời gian dài không gặp, họ đã phát triển theo một khuynh hướng hoàn toàn mới bất ngờ.
========================================================================
\n`;
      return injectionBlock + finalPrompt;
    }

    // PROMPT CHO NHÁNH SẮP QUÊN (20 < N < 60)
    let injectionBlock = `
========================================================================
[HỆ THỐNG KHẨN CẤP: KÉO LẠI MẠCH TRUYỆN NGƯỜI SẮP QUÊN]
========================================================================
Các nhân vật dưới đây đang mờ nhạt dần. Yêu cầu AI đưa họ trở lại câu chuyện:

[DANH SÁCH NPC DỰ BỊ ĐƯỢC CHỌN]:
`;

    selectedNpcs.forEach((npc, index) => {
      const npcAny = npc as any;
      const relationship = npcAny.relationshipToPlayer || npcAny.relationship || "Chưa rõ mối quan hệ";
      const status = npcAny.status || "Bình thường / Chưa rõ";
      const personality = npcAny.personality || (npcAny.personalityTraits ? npcAny.personalityTraits.join(", ") : "") || npcAny.description || "Chưa rõ";
      const lastSummary = npcAny.lastInteractionSummary || npcAny.description || "Chưa rõ";
      const rCounter = npcAny.reunionCounter || 30;

      injectionBlock += `
NPC #${index + 1}:
- Họ và Tên: ${npc.name}
- Số lượt vắng mặt: ${rCounter} lượt truyện liên tục
- Quan hệ: ${relationship}
- Tính cách & trạng thái: ${personality} | ${status}
- Tóm tắt cũ: ${lastSummary}
`;
    });

    const step2Directive = isNsfwParallelSex ? `
BƯỚC 2: [PHÂN ĐOẠN SONG SONG 18+] (Nếu không thể bắt gặp trực tiếp)
<he_thong_tai_ngo>
  <phan_doan_song_song_+he_thong_tai_ngo>
    <tinh_huong_18_cong_+phan_doan_song_song>
================
[CHỈ THỊ BẮT BUỘC: PHÂN ĐOẠN SONG SONG 18+ (CƠ HỌC XÁC SUẤT 50% ĐÃ KÍCH HOẠT)]:
Ở BƯỚC 2 (Phân đoạn song song / Gián tiếp), NPC [ ${selectedNpcs.map(n => n.name).join(", ")} ] đang ở phương xa và BẮT BUỘC ĐANG TRONG TÌNH HUỐNG LÀM TÌNH (QUAN HỆ TÌNH DỤC) VỚI NGƯỜI KHÁC.
- Đối tượng quan hệ cùng: Có thể là nhân tình mới, đạo lữ bí mật, bạn tình thoáng qua, hoặc đối tác tu luyện song tu tùy theo bối cảnh phương xa của NPC.
- Phong cách miêu tả 18+: Bắt buộc tuân thủ phong cách người lớn đã thiết lập: "${nsfwStyle}". Miêu tả chân thực, trần thuật rõ nét những va chạm da thịt, dục vọng, khoái cảm và sự hưởng thụ ái ân của NPC.
- Quy tắc trần thuật tuyệt đối: Đây là "Phân đoạn song song" độc lập chuyển cảnh từ xa, MC hoàn toàn KHÔNG biết và KHÔNG nhận thức được việc này để tránh phá vỡ logic truyện.
================
    </tinh_huong_18_cong_+phan_doan_song_song>
  </phan_doan_song_song_+he_thong_tai_ngo>
</he_thong_tai_ngo>
` : `
BƯỚC 2: [PHÂN ĐOẠN SONG SONG] HOẶC GIÁN TIẾP (Nếu không thể bắt gặp)
- AI Kể một đoạn "chuyển cảnh" độc lập, diễn tả hành tung của (các) NPC này từ phương xa ngay lúc này HOẶC một lời đồn, thư tín mà MC bất ngờ chú ý tới. 
- Yêu cầu nghiêm ngặt: Lồng ghép khéo léo, tự nhiên, không gượng ép. Nếu là "Phân đoạn song song", MC tuyệt đối không nhận thức được việc này để tránh phá vỡ logic truyện.
`;

    injectionBlock += `
========================================================================
QUY TRÌNH QUYẾT ĐỊNH CỦA AI (BẮT BUỘC):
BƯỚC 1: ĐÁNH GIÁ BỐI CẢNH (GẶP KHẢ THI HAY KHÔNG)
- Nếu bối cảnh hiện tại hợp lý (MC đang ở nơi tự do, có thể tùy ý chạm trán), hãy viết tình huống tái ngộ/chạm trán trực tiếp NPC này (Ví dụ: đụng mặt trên đường, gặp ở nơi nhiệm vụ, v.v.).
- Nếu bối cảnh KHÔNG hợp lý (MC đang kẹt trong hầm ngục, đang bế quan, hoặc chiến đấu sinh tử không thể xen ngang ai đó vào), bắt buộc chuyển sang BƯỚC 2.
${step2Directive}
========================================================================
\n`;

    return injectionBlock + finalPrompt;
  }

  /**
   * Kỷ luật Thiên Đạo Sync: Đồng bộ và xóa bỏ NPC trùng lặp tên.
   * Ưu tiên giữ lại NPC có chỉ số cao hơn hoặc thuộc danh sách đặc biệt (vợ, nô lệ, tù nhân).
   */
  public static deduplicateNpcs(kb: KnowledgeBase): KnowledgeBase {
    if (!kb || !Array.isArray(kb.discoveredNPCs)) return kb;

    const nameMap = new Map<string, NPC>();
    const toRemoveIndices: number[] = [];
    
    // Thu thập tên các NPC trong danh sách đặc biệt để tránh tạo trùng trong discoveredNPCs
    const specialNpcNames = new Set<string>();
    const specialLists = ['wives', 'slaves', 'prisoners', 'companions'];
    specialLists.forEach(listName => {
        const list = (kb as any)[listName];
        if (Array.isArray(list)) {
            list.forEach((n: any) => {
                if (n.name) specialNpcNames.add(n.name.trim().toLowerCase());
            });
        }
    });

    // Quét discoveredNPCs để tìm trùng lặp
    kb.discoveredNPCs.forEach((npc, index) => {
        const normName = npc.name.trim().toLowerCase();
        
        // Nếu đã có trong danh sách đặc biệt, đánh dấu để xóa khỏi discoveredNPCs
        if (specialNpcNames.has(normName)) {
            toRemoveIndices.push(index);
            return;
        }

        if (nameMap.has(normName)) {
            const existing = nameMap.get(normName)!;
            // So sánh độ ưu tiên (giữ lại cái có cảnh giới/affinity cao hơn)
            const existingScore = (existing.affinity || 0) + (existing.realm ? 10 : 0);
            const currentScore = (npc.affinity || 0) + (npc.realm ? 10 : 0);
            
            if (currentScore > existingScore) {
                // Thay thế cái cũ bằng cái mới
                const oldIndex = kb.discoveredNPCs.indexOf(existing);
                if (oldIndex > -1) toRemoveIndices.push(oldIndex);
                nameMap.set(normName, npc);
            } else {
                toRemoveIndices.push(index);
            }
        } else {
            nameMap.set(normName, npc);
        }
    });

    // Xóa các phần tử trùng lặp (từ dưới lên để tránh lệch index)
    if (toRemoveIndices.length > 0) {
        console.log(`[THIÊN ĐẠO SYNC] Đã phát hiện và xóa ${toRemoveIndices.length} NPC trùng lặp tên.`);
        toRemoveIndices.sort((a, b) => b - a);
        toRemoveIndices.forEach(idx => {
            kb.discoveredNPCs.splice(idx, 1);
        });
    }

    return kb;
  }
}
