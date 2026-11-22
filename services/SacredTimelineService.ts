import { KnowledgeBase, SacredTimelineRecord, DeadNPCDestiny, NPC } from '../types';

const TIMELINE_PREFIX = 'sacred_timeline_';

export const generateUniverseId = (): string => {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const randomLetter = letters[Math.floor(Math.random() * letters.length)];
  const randomNumbers = Math.floor(1000 + Math.random() * 9000);
  return `${randomLetter}-${randomNumbers}`;
};

export const extractLastQuote = (aiNarration: string, npcName: string): string => {
  if (!aiNarration || !npcName) return "Aaa...";
  try {
    const quoteRegex = new RegExp(`${npcName}[^"”]*["”]([^"”]+)["”]`, 'gi');
    const matches = [...aiNarration.matchAll(quoteRegex)];
    if (matches.length > 0) {
      return matches[matches.length - 1][1].trim();
    }
    const generalQuoteRegex = /["”]([^"”]+)["”]/g;
    const generalMatches = [...aiNarration.matchAll(generalQuoteRegex)];
    if (generalMatches.length > 0) {
      return generalMatches[generalMatches.length - 1][1].trim();
    }
  } catch (e) {
    console.error('Error extracting quote for Sacred Timeline:', e);
  }
  return "Aaa...";
};

export const SacredTimelineService = {
  getTimeline: (universeId?: string): SacredTimelineRecord => {
    if (!universeId) return { universeId: '', highestTurn: 0, destinedDeaths: {} };
    try {
      const data = localStorage.getItem(`${TIMELINE_PREFIX}${universeId}`);
      if (data) {
        return JSON.parse(data);
      }
    } catch (e) {
      console.error('Error reading Sacred Timeline record:', e);
    }
    return { universeId, highestTurn: 0, destinedDeaths: {} };
  },

  saveTimeline: (record: SacredTimelineRecord): void => {
    if (!record || !record.universeId) return;
    try {
      localStorage.setItem(`${TIMELINE_PREFIX}${record.universeId}`, JSON.stringify(record));
    } catch (e) {
      console.error('Error saving Sacred Timeline record:', e);
    }
  },

  updateHighestTurn: (universeId: string | undefined, currentTurn: number): void => {
    if (!universeId) return;
    const timeline = SacredTimelineService.getTimeline(universeId);
    if (currentTurn > timeline.highestTurn) {
      timeline.highestTurn = currentTurn;
      SacredTimelineService.saveTimeline(timeline);
    }
  },

  logDeath: (universeId: string | undefined, npcId: string, npcName: string, currentTurn: number, lastQuote: string): void => {
    if (!universeId) return;
    const timeline = SacredTimelineService.getTimeline(universeId);
    
    if (currentTurn >= timeline.highestTurn) {
      timeline.highestTurn = currentTurn;
    }

    timeline.destinedDeaths[npcId] = {
      npcId,
      npcName,
      deathTurn: currentTurn,
      lastQuote: lastQuote || "Aaa..."
    };

    SacredTimelineService.saveTimeline(timeline);
  },

  getDoomedNPCsForPrompt: (kb: KnowledgeBase): DeadNPCDestiny[] => {
    if (!kb || !kb.universeId) return [];
    const timeline = SacredTimelineService.getTimeline(kb.universeId);
    const currentTurn = kb.playerStats?.turn ?? 0;

    // Only apply Karma injection if current turn is earlier than the highest recorded turn in Sacred Timeline
    if (currentTurn >= timeline.highestTurn || !timeline.destinedDeaths || Object.keys(timeline.destinedDeaths).length === 0) {
      return [];
    }

    const doomedList: DeadNPCDestiny[] = [];
    const destinedMap = timeline.destinedDeaths;

    // Helper to check if an entity matches any destined death
    const checkEntityList = (entities: any[]) => {
      if (!entities) return;
      entities.forEach((entity) => {
        if (!entity) return;
        // Match by ID or Name
        for (const key of Object.keys(destinedMap)) {
          const destiny = destinedMap[key];
          if ((entity.id && entity.id === destiny.npcId) || (entity.name && entity.name.trim().toLowerCase() === destiny.npcName.trim().toLowerCase())) {
            // Check if not already added
            if (!doomedList.some(d => d.npcId === destiny.npcId || d.npcName === destiny.npcName)) {
              doomedList.push(destiny);
            }
          }
        }
      });
    };

    checkEntityList(kb.discoveredNPCs || []);
    checkEntityList(kb.wives || []);
    checkEntityList(kb.slaves || []);
    checkEntityList(kb.prisoners || []);
    checkEntityList(kb.companions || []);

    return doomedList;
  },

  buildKarmaPromptXML: (kb: KnowledgeBase): string => {
    if (!kb || !kb.universeId) return "";
    const doomedList = SacredTimelineService.getDoomedNPCsForPrompt(kb);
    if (doomedList.length === 0) return "";

    const timeline = SacredTimelineService.getTimeline(kb.universeId);
    const currentTurn = kb.playerStats?.turn ?? 0;

    const doomedNPCsText = doomedList.map(destiny => 
      `- NPC [${destiny.npcName}]: BẮT BUỘC phải nói lại nguyên văn câu thoại cũ trước khi qua đời: "${destiny.lastQuote}". Ngay lập tức sau câu thoại này, NPC này BẮT BUỘC PHẢI CHẾT ĐỘT NGỘT ngay trong lượt chơi này vì một tai nạn thảm khốc ngẫu nhiên (ví dụ: trâu húc, thiên thạch rơi, sấm sét đánh trúng, chậu cây rơi, xe tông, sặc nước,...).`
    ).join('\n');

    return `
<luat_nhan_qua_sacred_timeline>
   <cau_truc_dinh_menh_+luat_nhan_qua_sacred_timeline>
================
CẢNH BÁO TỪ DÒNG THỜI GIAN THIÊNG LIÊNG (SACRED TIMELINE):
Người chơi đang quay lại bối cảnh quá khứ (Lượt hiện tại: ${currentTurn} < Lượt kỷ lục: ${timeline.highestTurn}). Mã định danh Vũ trụ: [${kb.universeId}].
Định mệnh đã an bài kết cục sinh tử của các NPC sau đây, KHÔNG AI ĐƯỢC PHÉP THAY ĐỔI KẾT CỤC:

${doomedNPCsText}

QUY TẮC BẮT BUỘC KHI HỒI SINH/CỨU SỐNG:
Nếu người chơi cố tình sử dụng kỹ năng, linh dược, vật phẩm ma pháp hoặc quyền năng phép thuật để cứu sống hoặc hồi sinh NPC bị định mệnh an bài chết, NPC đó có thể tỉnh lại trong chốc lát, NHƯNG NGAY LẬP TỨC SAU ĐÓ NPC BẮT BUỘC PHẢI TỰ ĐỘNG CHẾT LẠI ngay trong lượt chơi bởi một tai nạn thảm khốc ngẫu nhiên khác. ĐỊNH MỆNH VÀ NHÂN QUẢ LÀ TUYỆT ĐỐI KHÔNG THỂ XOÁ BỎ TRONG VŨ TRỤ NÀY.
================
   </cau_truc_dinh_menh_+luat_nhan_qua_sacred_timeline>
</luat_nhan_qua_sacred_timeline>
`;
  }
};
