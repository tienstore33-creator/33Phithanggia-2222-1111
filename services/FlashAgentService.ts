import { callGeminiAPI } from './apiService';
import { generateEmbeddingsWithRetry } from './embeddingService';
import { KnowledgeBase, FlashState } from '../types';

export const runFlashAgentAsync = async (
  input: string,
  response: string,
  turnNumber: number,
  setKb: (updater: (kb: KnowledgeBase) => KnowledgeBase) => void,
  summaryText: string = "",
  existingKb?: KnowledgeBase, // Optional: Modify in-place for sync steps
  locationName: string = "Không rõ",
  timeString: string = "Không rõ"
) => {
  try {
    const instruction = `You are a text analysis expert (Flash Agent) simulating detailed memory.
Your task: Read the narration and player actions for turn ${turnNumber}, then extract information according to the following strict format:

1. Fast Summary: (Write 4-5 concise, pithy sentences about the entire plot development of this specific turn).
---
Current Location: ${locationName}
Time: ${timeString}
---
2. Core Developments: (List details for each character... do not write paragraphs, use bullet points).
3. Accurate Dialogue: (Extract 100% without missing a single word, including the speaker's name and the dialogue that follows, use bullet points).
4. Knowledge & Context: (New knowledge, locations, items... use bullet points).
5. Behind-the-scenes Data (If any): (Summarize conspiracies, hidden events, rumors from tags like <ENTITY_TRACKING>, <SECRET_ACTION> if present in the text).

[PLAYER INPUT]
${input}

[AI RESPONSE]
${response}

STRICT REQUIREMENTS:
- ALL OUTPUT MUST BE IN ENGLISH to ensure system-wide consistency and better AI reasoning.
- Do not analyze, do not comment, do not use JSON. 
- Return exactly the headings above. 
- Section 1 must be 4-5 sentences and must keep the provided Location/Time information (translated to English if necessary).`;

    const result = await callGeminiAPI(
      instruction,
      undefined,
      'combat', // Dùng model chiến đấu cho task đồng bộ thiên đạo
      undefined,
      undefined,
      false,
      undefined,
      undefined,
      undefined,
      "Đồng bộ Thiên Đạo & Phân tích trí nhớ NPC",
      2 // Priority 2 - Thấp/Chạy ngầm để không cản trở luồng chính
    );

    if (!result || !result.text) return false;

    const richSummary = result.text.trim();
    
    // Trích xuất tóm tắt nhanh từ mục 1
    let fastSummary = "";
    const fastSummaryMatch = richSummary.match(/1\. Fast Summary:([\s\S]*?)(?=2\.|$)/i);
    if (fastSummaryMatch && fastSummaryMatch[1]) {
        fastSummary = fastSummaryMatch[1].trim();
    } else {
        fastSummary = summaryText || "No summary available.";
    }

    const timestamp = new Date().toLocaleTimeString('vi-VN', { hour12: false });

    // TẠO NỘI DUNG VECTORIZED (BỘ NHỚ KÉP)
    const parts = [];
    parts.push(`Vị trí: ${locationName}`);
    parts.push(`Thời gian: ${timeString}`);
    if (fastSummary) parts.push(`- Tóm tắt nhanh: ${fastSummary}`);
    if (richSummary) parts.push(`- Chi tiết diễn biến:\n${richSummary}`);

    // Khai thác trực tiếp DỮ LIỆU HẬU TRƯỜNG để đưa vào RAG
    const backstageRegex = /<(ENTITY_TRACKING|SECRET_ACTION|ENIGMA_RECORD|SEED_PLANT|UPDATE_DATA|UPDATE|phân_đoạn_song_song|phan_doan_song_song)>([\s\S]*?)<\/\1>/gi;
    let match;
    let hasBackstage = false;
    let backstageContent = "\n- Dữ Liệu Hậu Trường:\n";
    while ((match = backstageRegex.exec(response)) !== null) {
      hasBackstage = true;
      backstageContent += `[${match[1]}]\n${match[2].trim()}\n`;
    }
    if (hasBackstage) {
      parts.push(backstageContent);
    }

    const dualMemoryContent = `[TURN ${turnNumber}] (${timestamp})\n${parts.join('\n')}`;

    // Tạo embedding cho nội dung chất lượng cao này
    const [turnVector] = await generateEmbeddingsWithRetry([dualMemoryContent]);

    const updater = (prevKb: KnowledgeBase) => {
      const newKb = { ...prevKb };
      
      // 1. Cập nhật Flash State
      newKb.flashState = {
        currentState: fastSummary || richSummary.substring(0, 500), 
        recentChanges: [], 
        lastUpdateTurn: turnNumber
      };

      // 2. Cập nhật RAG History Log
      if (!newKb.ragHistoryLog) newKb.ragHistoryLog = [];
      newKb.ragHistoryLog.push({
        turn: turnNumber,
        timestamp,
        content: `[FLASH AGENT MEMORY - TURN ${turnNumber}]\n${richSummary}`,
        richSummary: richSummary,
        summary: fastSummary,
        type: 'flash_agent',
        embeddingDim: turnVector?.length || 3072
      });

      // 3. ĐỒNG BỘ VECTOR STORE (THAY THẾ HOẶC THÊM MỚI)
      if (turnVector) {
        if (!newKb.ragVectorStore) {
          newKb.ragVectorStore = { vectors: [], metadata: [] };
        }

        // Tối ưu hóa dung lượng mảng số thực ngay khi nhận được
        const sanitizedTurnVector = turnVector.map((num: number) => Math.round(num * 10000) / 10000);

        const prefix = `turn-${turnNumber}-`;
        const metaIdx = newKb.ragVectorStore.metadata.findIndex((m: any) => m.entityId?.startsWith(prefix) || m.turn === turnNumber);
        
        if (metaIdx !== -1) {
          // Cập nhật vector và metadata hiện có
          newKb.ragVectorStore.vectors[metaIdx] = sanitizedTurnVector;
          newKb.ragVectorStore.metadata[metaIdx].text = dualMemoryContent;
          newKb.ragVectorStore.metadata[metaIdx].turn = turnNumber;
        } else {
          // Thêm mới hoàn toàn
          newKb.ragVectorStore.vectors.push(sanitizedTurnVector);
          newKb.ragVectorStore.metadata.push({
            entityId: `turn-${turnNumber}-${Date.now()}`,
            entityType: 'turn' as any,
            turn: turnNumber,
            text: dualMemoryContent
          });
        }
        console.log(`[RAG-DUAL-MEMORY] Vectorized turn ${turnNumber} with high quality richSummary!`);
      }

      return newKb;
    };

    if (existingKb) {
      const updated = updater(existingKb);
      Object.assign(existingKb, updated);
      setKb(updater);
    } else {
      setKb(updater);
    }

    return true;
  } catch (error) {
    console.error("FlashAgent error:", error);
    return false;
  }
};

export const saveFlashAgentMemoryOffline = async (
  turnNumber: number,
  setKb: (updater: (kb: KnowledgeBase) => KnowledgeBase) => void,
  fastSummary: string,
  richSummary: string,
  existingKb?: KnowledgeBase,
  locationName: string = "Không rõ",
  timeString: string = "Không rõ",
  aiResponseText: string = ""
) => {
  try {
    const timestamp = new Date().toLocaleTimeString('vi-VN', { hour12: false });

    // TẠO NỘI DUNG VECTORIZED (BỘ NHỚ KÉP)
    const parts = [];
    parts.push(`Vị trí: ${locationName}`);
    parts.push(`Thời gian: ${timeString}`);
    if (fastSummary) parts.push(`- Tóm tắt nhanh: ${fastSummary}`);
    if (richSummary) parts.push(`- Chi tiết diễn biến:\n${richSummary}`);

    // Khai thác trực tiếp DỮ LIỆU HẬU TRƯỜNG để đưa vào RAG
    if (aiResponseText) {
      const backstageRegex = /<(ENTITY_TRACKING|SECRET_ACTION|ENIGMA_RECORD|SEED_PLANT|UPDATE_DATA|UPDATE|phân_đoạn_song_song|phan_doan_song_song)>([\s\S]*?)<\/\1>/gi;
      let match;
      let hasBackstage = false;
      let backstageContent = "\n- Dữ Liệu Hậu Trường:\n";
      while ((match = backstageRegex.exec(aiResponseText)) !== null) {
        hasBackstage = true;
        backstageContent += `[${match[1]}]\n${match[2].trim()}\n`;
      }
      if (hasBackstage) {
        parts.push(backstageContent);
      }
    }

    const dualMemoryContent = `[TURN ${turnNumber}] (${timestamp})\n${parts.join('\n')}`;

    // Tạo embedding cho nội dung chất ngất này
    const [turnVector] = await generateEmbeddingsWithRetry([dualMemoryContent]);

    const updater = (prevKb: KnowledgeBase) => {
      const newKb = { ...prevKb };
      
      // 1. Cập nhật Flash State
      newKb.flashState = {
        currentState: fastSummary || richSummary.substring(0, 500), 
        recentChanges: [], 
        lastUpdateTurn: turnNumber
      };

      // 2. Cập nhật RAG History Log
      if (!newKb.ragHistoryLog) newKb.ragHistoryLog = [];
      newKb.ragHistoryLog.push({
        turn: turnNumber,
        timestamp,
        content: `[FLASH AGENT MEMORY - TURN ${turnNumber}]\n${richSummary}`,
        richSummary: richSummary,
        summary: fastSummary,
        type: 'flash_agent',
        embeddingDim: turnVector?.length || 3072
      });



      // 3. ĐỒNG BỘ VECTOR STORE
      if (turnVector) {
        if (!newKb.ragVectorStore) {
          newKb.ragVectorStore = { vectors: [], metadata: [] };
        }

        // Tối ưu hóa dung lượng mảng số thực ngay khi nhận được
        const sanitizedTurnVector = turnVector.map((num: number) => Math.round(num * 10000) / 10000);

        const prefix = `turn-${turnNumber}-`;
        const metaIdx = newKb.ragVectorStore.metadata.findIndex((m: any) => m.entityId?.startsWith(prefix) || m.turn === turnNumber);
        
        if (metaIdx !== -1) {
          newKb.ragVectorStore.vectors[metaIdx] = sanitizedTurnVector;
          newKb.ragVectorStore.metadata[metaIdx].text = dualMemoryContent;
          newKb.ragVectorStore.metadata[metaIdx].turn = turnNumber;
        } else {
          newKb.ragVectorStore.vectors.push(sanitizedTurnVector);
          newKb.ragVectorStore.metadata.push({
            entityId: `turn-${turnNumber}-${Date.now()}`,
            entityType: 'turn' as any,
            turn: turnNumber,
            text: dualMemoryContent
          });
        }
        console.log(`[RAG-DUAL-MEMORY-OFFLINE] Vectorized turn ${turnNumber} with combined API results!`);
      }

      return newKb;
    };

    if (existingKb) {
      const updated = updater(existingKb);
      Object.assign(existingKb, updated);
      setKb(updater);
    } else {
      setKb(updater);
    }

    return true;
  } catch (error) {
    console.error("saveFlashAgentMemoryOffline error:", error);
    return false;
  }
};

