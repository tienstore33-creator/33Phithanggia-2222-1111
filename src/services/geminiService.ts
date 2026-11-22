import { GoogleGenAI, Type } from "@google/genai";
import { WorldSetupData, FanficAnalysis } from '../types/fanfic';
import { LocationCategory, Difficulty } from '../types/game';
import { DIFFICULTY_SETTINGS } from '../../constants';
import { getCurrentlyUsedApiKey, getApiSettings, getTaskModel, getCurrentlyUsedKeyDisplay } from '../../services/apiService';
import { getAiClient } from '../../services/aiClient';
import { apiRunningService } from '../../services/apiRunningService';
import { L0_ExtractionSchema, L05_FormattingSchema, L0_CharacterPlotSchema } from '../types/schemas/WorldGenSchemas';
import { FanficAnalyzerService } from './fanficAnalyzerService';
import { sanitizeSearchConfig } from '../../utils/searchGuard';

// 1. System Prompt tinh chỉnh:
const getSystemInstruction = (currentDifficulty: Difficulty) => `
  You are a Game Master (Strict Librarian Mode). Current Difficulty: ${currentDifficulty}.
  
  RULES FOR "STRICT LIBRARIAN" GROUNDING:
  - Bạn sẽ nhận được [NGỮ CẢNH TRUY XUẤT TỪ NGUYÊN TÁC] bao gồm [BẰNG CHỨNG CỨNG] và [BỐI CẢNH BỔ TRỢ].
  - ƯU TIÊN TUYỆT ĐỐI: Phải sử dụng thông tin trong [BẰNG CHỨNG CỨNG] để kể chuyện. Nếu bằng chứng cứng mâu thuẫn với kiến thức chung của AI, hãy chọn Bằng chứng cứng.
  - CẤM BỊA ĐẶT (Zero Hallucination): Nếu cả bằng chứng cứng và bối cảnh bổ trợ đều không đề cập đến một địa danh/nhân vật cụ thể mà người chơi nhắc tới, hãy trả lời rằng "Thông tin này hiện chưa rõ ràng trong nguyên tác" thay vì tự sáng tác.
  
  Gameplay Rules:
  - NPC Behavior: ${DIFFICULTY_SETTINGS[currentDifficulty].npcBehaviorPrompt}
  - Narrative Style: ${DIFFICULTY_SETTINGS[currentDifficulty].narrativeBias}
  - Affinity Limit: Do not allow affinity to increase more than ${DIFFICULTY_SETTINGS[currentDifficulty].maxAffinityGain} points per interaction.
  QUAN TRỌNG: 
  1. Nếu có địa điểm mới xuất hiện, BẮT BUỘC phân loại vào đúng một trong các category được cung cấp.
  2. Đánh giá trạng thái 'isSafe': CHỈ xét vị trí nhân vật đang đứng ở cuối đoạn kể.
  
  OUTPUT FORMAT (STRICTLY JSON):
  You MUST return a JSON object in this exact format:
  {
    "storyText": "<thinking>...suy nghĩ của bạn...</thinking><content>...lời kể chuyện...</content><update_data>...dữ liệu cần cập nhật...</update_data>",
    "choices": ["Lựa chọn 1", "Lựa chọn 2", ...],
    "currentLocationStatus": { "isSafe": boolean },
    "newDiscoveredLocations": [...]
  }
  Do not output anything else.
`;

// 2. Schema ép kiểu nghiêm ngặt:
const responseSchema = {
  type: Type.OBJECT,
  properties: {
    storyText: { type: Type.STRING },
    currentLocationStatus: {
      type: Type.OBJECT,
      properties: {
        isSafe: { type: Type.BOOLEAN } // Ép kiểu boolean
      },
      required: ["isSafe"]
    },
    newDiscoveredLocations: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          category: { 
            type: Type.STRING, 
            enum: Object.values(LocationCategory) // Ép AI chỉ được dùng các string này
          },
          isSafe: { type: Type.BOOLEAN }
        },
        required: ["name", "category", "isSafe"]
      }
    }
  }
};

// 3. Hàm sửa lỗi JSON bị cắt cụt (truncated) hoặc sai cú pháp
export const repairJson = (jsonStr: string): string => {
  let s = jsonStr.trim();
  let inString = false;
  let isEscaped = false;
  const stack: string[] = [];
  let cleanStr = "";

  for (let i = 0; i < s.length; i++) {
    const char = s[i];
    
    if (inString) {
      if (isEscaped) {
        cleanStr += char;
        isEscaped = false;
      } else if (char === '\\') {
        cleanStr += char;
        isEscaped = true;
      } else if (char === '"') {
        cleanStr += char;
        inString = false;
      } else {
        if (char === '\n') {
          cleanStr += '\\n';
        } else if (char === '\r') {
          cleanStr += '\\r';
        } else if (char === '\t') {
          cleanStr += '\\t';
        } else {
          cleanStr += char;
        }
      }
    } else {
      if (char === '"') {
        cleanStr += char;
        inString = true;
      } else if (char === '{') {
        cleanStr += char;
        stack.push('}');
      } else if (char === '[') {
        cleanStr += char;
        stack.push(']');
      } else if (char === '}') {
        if (stack.length > 0 && stack[stack.length - 1] === '}') {
          stack.pop();
        }
        cleanStr += char;
      } else if (char === ']') {
        if (stack.length > 0 && stack[stack.length - 1] === ']') {
          stack.pop();
        }
        cleanStr += char;
      } else {
        cleanStr += char;
      }
    }
  }

  if (inString) {
    cleanStr += '"';
  }

  cleanStr = cleanStr.trim().replace(/,$/, '');

  while (stack.length > 0) {
    const closingChar = stack.pop();
    cleanStr += closingChar;
  }

  cleanStr = cleanStr.trim();
  cleanStr = cleanStr.replace(/,\s*([}\]])/g, '$1');

  return cleanStr;
};

// Hàm làm sạch JSON (Chống lỗi Run 20 và xử lý tag XML ngoài JSON):
export const cleanJsonResponse = (rawText: string): string => {
  // Tìm khối JSON trong markdown
  const match = rawText.match(/```json\n([\s\S]*?)\n```/) || rawText.match(/```\n([\s\S]*?)\n```/);
  let cleaned = match ? match[1] : rawText;
  
  // Trích xuất JSON từ văn bản, lấy từ cặp ngoặc nhọn đầu tiên đến hết chuỗi
  const firstBrace = cleaned.indexOf('{');
  if (firstBrace !== -1) {
    cleaned = cleaned.substring(firstBrace);
  } else {
    cleaned = '{' + cleaned + '}';
  }
  
  return repairJson(cleaned);
};

export class GeminiService {
  private static ai: GoogleGenAI | null = null;

  private static getClient(): GoogleGenAI {
    const apiKey = getCurrentlyUsedApiKey();
    if (!apiKey) {
      throw new Error("API Key chưa được thiết lập.");
    }
    return getAiClient(getApiSettings(), apiKey);
  }

  static async analyzeWithStrictGrounding(evidence: string[], prompt: string): Promise<string> {
    const aiClient = this.getClient();
    const settings = getApiSettings();
    
    // Nếu prompt chứa yêu cầu thêm (thường có từ khóa YÊU CẦU THÊM), dùng model economy (Pro)
    const isCustomRequest = prompt.includes("YÊU CẦU THÊM:") || prompt.includes("YÊU CẦU ĐẶC BIỆT");
    const modelName = isCustomRequest ? getTaskModel('economy') : getTaskModel('main');

    const strictSystemInstruction = `
        BẠN LÀ THỦ THƯ. NHIỆM VỤ: Trả lời dựa TRÊN CÁC ĐOẠN BẰNG CHỨNG ĐƯA KÈM.
        - CẤM bịa đặt.
        - Nếu BẰNG CHỨNG KHÔNG CÓ thông tin, trả về CHÍNH XÁC: "[NO_DATA_FOUND]".
        - KHÔNG ĐƯỢC NHẬN XÉT về địa danh, nhân vật không có trong bằng chứng.
    `;
    
    const contents = `
      [BẰNG CHỨNG TỪ NGUYÊN TÁC]:
      ${evidence.join('\n\n--- ĐOẠN TIẾP THEO ---\n\n')}

      [YÊU CẦU CỦA NGƯỜI DÙNG]:
      ${prompt}
    `;

    const taskId = apiRunningService.start(modelName, getCurrentlyUsedKeyDisplay(), "Thẩm định nguyên tác (Grounding)");
    try {
      const response = await aiClient.models.generateContent({
        model: modelName,
        contents: contents,
        config: {
          systemInstruction: strictSystemInstruction,
          temperature: 0.1
        }
      });
      apiRunningService.stop(taskId);
      return response.text || "[NO_DATA_FOUND]";
    } catch (error) {
      apiRunningService.stop(taskId);
      console.error("Strict grounding analysis failed:", error);
      return "[NO_DATA_FOUND]";
    }
  }

  /**
   * Phân tích tác phẩm fanfic để trích xuất thông tin chi tiết.
   */
  static async analyzeFanfic(
    content: string, 
    title?: string, 
    charPlotData?: any,
    onChunk?: (text: string) => void, 
    useDeepGrounding: boolean = false
  ): Promise<FanficAnalysis> {
    const settings = getApiSettings();
    const aiClient = this.getClient();
    const modelName = getTaskModel('main');
    
    const basePrompt = (content.trim().length > 0 
      ? `Phân tích nội dung sau để trích xuất thông tin bối cảnh, nhân vật (ít nhất 10), địa điểm (ít nhất 5), vật phẩm (ít nhất 4) và phe phái: ${content}`
      : `Dựa trên tên tác phẩm: ${title}, hãy trích xuất thông tin chi tiết về bối cảnh thế giới, ít nhất 10 nhân vật quan trọng, 5 địa điểm nổi bật, 4 vật phẩm quan trọng và các phe phái chính.`);

    const prompt = charPlotData 
      ? `THÔNG TIN NHÂN VẬT & CỐT TRUYỆN ĐÃ ĐƯỢC XÁC NHẬN:\n${JSON.stringify(charPlotData, null, 2)}\n\nDựa trên thông tin gốc phía trên, hãy tiến hành: ${basePrompt}`
      : basePrompt;

    const taskId = apiRunningService.start(modelName, getCurrentlyUsedKeyDisplay(), "Phân tích nội dung Fanfic");
    try {
      let responseText = "";
      const config: any = {
        tools: useDeepGrounding || (title && content.trim().length === 0) ? [{ googleSearch: {} }] : [], // Dùng search nếu bật useDeepGrounding hoặc chỉ có title
        responseMimeType: "application/json",
        responseSchema: L0_ExtractionSchema,
        temperature: 0.1
      };

      if (onChunk) {
        let thinkingData = "";
        let contentData = "";
        responseText = await FanficAnalyzerService.executeStreamWithFallback(prompt, config, (contentChunk, thinkingChunk) => {
          if (thinkingChunk) thinkingData += thinkingChunk;
          if (contentChunk) contentData += contentChunk;
          
          let combined = "";
          if (thinkingData) combined += `<thinking>\n${thinkingData}\n</thinking>\n\n`;
          combined += contentData;
          
          onChunk(combined);
        });
      } else {
        responseText = await FanficAnalyzerService.executeStreamWithFallback(prompt, config);
      }

      apiRunningService.stop(taskId);
      const cleaned = cleanJsonResponse(responseText || "{}");
      return JSON.parse(cleaned) as FanficAnalysis;
    } catch (error) {
      apiRunningService.stop(taskId);
      console.error("Analyze fanfic failed:", error);
      throw error;
    }
  }

  static async extractCharacterAndPlot(topic: string, onChunk?: (text: string) => void): Promise<any> {
    const aiClient = this.getClient();
    const modelName = getTaskModel('main');
    const taskId = apiRunningService.start(modelName, getCurrentlyUsedKeyDisplay(), "Bóc tách nhân vật & cốt truyện");

    const step1Prompt = `Bạn là chuyên gia phân tích tác phẩm. Sử dụng công cụ Google Search bằng ngôn ngữ gốc của nguyên tác "${topic}" để tìm hiểu. Hãy phân tích và trả lời chi tiết, chính xác các câu hỏi sau về tác phẩm "${topic}":
1. Tên Nhân Vật chính là gì?
2. Giới Tính của nhân vật chính là gì?
3. Chủng Tộc của nhân vật chính là gì?
4. Tính Cách của nhân vật chính như thế nào?
5. Tiểu Sử của nhân vật chính ra sao?
6. Bối cảnh ban đầu sẽ như thế nào?
7. Mục Tiêu là gì?
8. Loại Địa Điểm Bắt Đầu là gì?
9. Đặc Điểm Khởi Đầu Chung là gì?
10. Tên Tiền Tệ là gì?
11. Số Tiền Khởi Đầu bao nhiêu?
12. Linh Căn (ưu điểm sức mạnh) của nhân vật chính là gì?
13. Thể Chất Đặc Biệt của nhân vật chính là gì?
14. Thọ Nguyên Còn Lại trong nguyên tác bao nhiêu?
15. Thọ Nguyên Tối Đa nguyên tác bao nhiêu?`;

    try {
      if (onChunk) {
        onChunk("\n[Pha 1: Đang tìm kiếm và tra cứu nguyên tác từ Google...]\n");
      }

      const step1Config: any = {
        tools: [{ googleSearch: {} }],
        temperature: 0.2
      };

      let rawSearchText = "";
      if (onChunk) {
        let thinkingData = "";
        let contentData = "";
        rawSearchText = await FanficAnalyzerService.executeStreamWithFallback(step1Prompt, step1Config, (contentChunk, thinkingChunk) => {
          if (thinkingChunk) thinkingData += thinkingChunk;
          if (contentChunk) contentData += contentChunk;
          
          let combined = "";
          if (thinkingData) combined += `<thinking>\n${thinkingData}\n</thinking>\n\n`;
          combined += contentData;
          
          onChunk(combined);
        });
      } else {
        rawSearchText = await FanficAnalyzerService.executeStreamWithFallback(step1Prompt, step1Config);
      }

      if (onChunk) {
        onChunk("\n\n[Pha 2: Đang chuẩn hóa và đồng bộ dữ liệu nhân vật...]\n");
      }

      const step2Prompt = `Dưới đây là thông tin thô tìm kiếm được về tác phẩm/nhân vật "${topic}":\n\n${rawSearchText}\n\nHãy chuẩn hóa toàn bộ thông tin trên thành một đối tượng JSON khớp chính xác với cấu trúc yêu cầu. Hãy suy luận thông minh dựa trên bối cảnh nguyên tác nếu thông tin thô còn thiếu sót.`;

      const step2Config: any = {
        responseMimeType: "application/json",
        responseSchema: L0_CharacterPlotSchema,
        temperature: 0.1
      };

      const response2 = await aiClient.models.generateContent({
        model: modelName,
        contents: step2Prompt,
        config: step2Config
      });

      apiRunningService.stop(taskId);
      const finalJsonText = response2.text || "{}";
      return JSON.parse(cleanJsonResponse(finalJsonText));
    } catch (error) {
      apiRunningService.stop(taskId);
      console.error("Lỗi extractCharacterAndPlot:", error);
      throw error;
    }
  }

  /**
   * Giữ lại hàm cũ để tương thích ngược nếu cần, nhưng nâng cấp logic.
   */
  static async generateSetup(prompt: string): Promise<WorldSetupData> {
    const analysis = await this.analyzeFanfic("", prompt);
    return {
      topic: prompt,
      worldDescription: analysis.summary,
      mainPlot: "Hành trình khám phá thế giới " + prompt,
      characters: analysis.characters,
      locations: analysis.locations,
      factions: analysis.factions
    };
  }

  static async generateNpc(npcName: string): Promise<any> {
    const aiClient = this.getClient();
    const modelName = getTaskModel('economy');
    const taskId = apiRunningService.start(modelName, getCurrentlyUsedKeyDisplay(), "Tạo thông tin NPC");
    try {
      const config = sanitizeSearchConfig(modelName, {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            gender: { type: Type.STRING },
            age: { type: Type.STRING },
            personality: { type: Type.STRING },
            background: { type: Type.STRING },
            appearance: { type: Type.STRING },
            skills: { type: Type.STRING },
            goal: { type: Type.STRING },
            role: { type: Type.STRING }
          },
          required: ["name", "gender", "age", "personality", "background", "appearance", "skills", "goal", "role"]
        }
      });
      const response = await aiClient.models.generateContent({
        model: modelName,
        contents: `Tạo thông tin chi tiết cho nhân vật tên là: ${npcName}`,
        config: config
      });
      apiRunningService.stop(taskId);
      return JSON.parse(response.text);
    } catch (error) {
      apiRunningService.stop(taskId);
      console.error("Generate NPC failed:", error);
      throw error;
    }
  }

  static async generateStoryTurn(userInput: string, context: string, difficulty: Difficulty): Promise<any> {
    const aiClient = this.getClient();
    const modelName = getTaskModel('main');
    const taskId = apiRunningService.start(modelName, getCurrentlyUsedKeyDisplay(), "Tạo lượt chơi cốt truyện");
    try {
      const config = sanitizeSearchConfig(modelName, {
        systemInstruction: getSystemInstruction(difficulty),
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        temperature: 0.7
      });
      const response = await aiClient.models.generateContent({
        model: modelName,
        contents: `User Input: ${userInput}\n\nContext: ${context}`,
        config: config
      });
      apiRunningService.stop(taskId);
      const cleaned = cleanJsonResponse(response.text || "{}");
      try {
        return JSON.parse(cleaned);
      } catch (parseError) {
        console.error("Error parsing JSON in generateStoryTurn:", parseError);
        return {
          storyText: "<content>Đã xảy ra lỗi khi tạo phản hồi. Vui lòng thử lại.</content>",
          choices: [],
          currentLocationStatus: { isSafe: true },
          newDiscoveredLocations: []
        };
      }
    } catch (error) {
      apiRunningService.stop(taskId);
      console.error("Generate story turn failed:", error);
      throw error;
    }
  }

  static async formatAndConfigWithLite(rawJsonString: string, onChunk?: (text: string) => void): Promise<any> {
    const settings = getApiSettings();
    const ai = this.getClient();
    const modelName = getTaskModel('economy');
    
    // Schema cho Lite để ép kiểu chặt chẽ
    const liteSchema = L05_FormattingSchema;

    const taskId = apiRunningService.start(modelName, getCurrentlyUsedKeyDisplay(), "Định dạng cấu trúc L0.5");
    try {
      let responseText = "";
      let thinkingText = "";
      let startedThinking = false;
      let endedThinking = false;

      const config: any = {
        responseMimeType: "application/json",
        responseSchema: liteSchema as any
      };

      if (onChunk) {
        const responseStream = await ai.models.generateContentStream({
          model: modelName,
          contents: `Định dạng và phân loại dữ liệu sau. KHÔNG TẠO THÊM DỮ LIỆU MỚI:\n${rawJsonString}`,
          config
        });

        for await (const chunk of responseStream) {
          let chunkThought = "";
          let chunkText = "";
          const parts = chunk.candidates?.[0]?.content?.parts || [];

          // Bóc tách thought (suy nghĩ ngầm) và text (JSON đầu ra) từ cấu trúc parts
          for (const p of parts as any[]) {
            if (p.thought === true && p.text) {
              chunkThought += p.text;
            } else if (p.text) {
              chunkText += p.text;
            }
          }

          // Phương án dự phòng nếu parts rỗng nhưng vẫn có trường text thô
          if (parts.length === 0) {
            try {
              const t = (chunk as any).text;
              if (t) chunkText = t;
            } catch (e) {}
          }

          let hasUpdated = false;

          if (chunkThought) {
            if (!startedThinking) {
              startedThinking = true;
            }
            thinkingText += chunkThought;
            hasUpdated = true;
          }

          if (chunkText) {
            if (startedThinking && !endedThinking) {
              endedThinking = true; // Kết thúc suy nghĩ khi bắt đầu xuất JSON
            }
            responseText += chunkText;
            hasUpdated = true;
          }

          // Đóng gói dữ liệu tích lũy thành chuỗi hoàn chỉnh để gửi lên UI cập nhật
          if (hasUpdated) {
            let accumulatedPayload = "";
            if (startedThinking) {
              accumulatedPayload += `<thinking>\n${thinkingText}`;
              if (endedThinking) {
                accumulatedPayload += `\n</thinking>\n\n${responseText}`;
              }
            } else {
              accumulatedPayload = responseText;
            }
            onChunk(accumulatedPayload);
          }
        }
      } else {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: `Định dạng và phân loại dữ liệu sau. KHÔNG TẠO THÊM DỮ LIỆU MỚI:\n${rawJsonString}`,
          config
        });
        responseText = response.text || "{}";
      }

      apiRunningService.stop(taskId);
      return JSON.parse(cleanJsonResponse(responseText || "{}"));
    } catch (error) {
      apiRunningService.stop(taskId);
      console.error("Format and config with Lite failed:", error);
      throw error;
    }
  }

  static async validateApiKey(apiKey: string): Promise<boolean> {
    const modelName = getTaskModel('lite');
    const taskId = apiRunningService.start(modelName, "Kiểm tra Key", "Xác thực API Key");
    try {
      const settings = getApiSettings();
      // Temporarily use the provided key for validation
      const aiClient = getAiClient(settings, apiKey);
      await aiClient.models.generateContent({
        model: modelName,
        contents: "Hi",
      });
      apiRunningService.stop(taskId);
      return true;
    } catch (error) {
      apiRunningService.stop(taskId);
      console.error("API Key validation failed:", error);
      return false;
    }
  }

  // Thêm phương thức xác thực nhanh
  static async validateCurrentKeyQuickly(): Promise<boolean> {
    const key = getCurrentlyUsedApiKey();
    if (!key) return false;
    const modelName = getTaskModel('lite');
    const taskId = apiRunningService.start(modelName, getCurrentlyUsedKeyDisplay(), "Xác thực nhanh API Key");
    try {
        const ai = getAiClient(getApiSettings(), key);
        await ai.models.generateContent({
            model: modelName,
            contents: "ok",
            config: { maxOutputTokens: 1 }
        });
        apiRunningService.stop(taskId);
        return true;
    } catch { 
        apiRunningService.stop(taskId);
        return false; 
    }
  }

  /**
   * NÚT 1: Tạo nhân vật chuẩn từ context đã lọc (RAG Step 2)
   */
  static async generateCharacterFromExtractedContext(context: string, name: string): Promise<any> {
    if (!context || context.includes("[NO_DATA_FOUND]")) {
      throw new Error(`Không tìm thấy dữ liệu chuẩn về nhân vật "${name}" trong nguyên tác.`);
    }

    const aiClient = this.getClient();
    const modelName = getTaskModel('main');
    
    const prompt = `DASHBOARD NGUYÊN TÁC XÁC THỰC:
    <CANON>
    ${context}
    </CANON>
    
    Nhiệm vụ: Điền vào cấu trúc dữ liệu nhân vật "${name}" DỰA TRÊN <CANON>.
    - TUYỆT ĐỐI KHÔNG được dùng kiến thức bên ngoài <CANON>.
    - Nếu <CANON> không đề cập đến một thông tin nào đó (ví dụ: Thể chất, Số tiền), hãy để trống "" hoặc giá trị mặc định. 
    - Cấm tự suy diễn hay bịa đặt.`;

    const taskId = apiRunningService.start(modelName, getCurrentlyUsedKeyDisplay(), "Tạo nhân vật chuẩn từ nguyên tác");
    try {
      const result = await aiClient.models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              playerGender: { type: Type.STRING },
              playerRace: { type: Type.STRING },
              playerPersonality: { type: Type.STRING },
              playerBackstory: { type: Type.STRING },
              initialContext: { type: Type.STRING },
              playerGoal: { type: Type.STRING },
              playerStartingTraits: { type: Type.STRING },
              currencyName: { type: Type.STRING },
              startingCurrency: { type: Type.NUMBER },
              playerSpiritualRoot: { type: Type.STRING }, // Linh Căn
              playerSpecialPhysique: { type: Type.STRING }, // Thể chất
              playerThoNguyen: { type: Type.NUMBER },
              playerMaxThoNguyen: { type: Type.NUMBER },
              playerStartingLocationType: { type: Type.STRING },
              canhGioiKhoiDau: { type: Type.STRING }
            }
          }
        }
      });
      apiRunningService.stop(taskId);
      const rawText = result.text || "{}";
      const response = JSON.parse(cleanJsonResponse(rawText));
      return {
          response,
          rawText,
          constructedPrompt: prompt
      };
    } catch (error) {
      apiRunningService.stop(taskId);
      throw error;
    }
  }

  /**
   * NÚT 2: Thiết lập hệ thống tu luyện từ context đã lọc (RAG Step 2)
   */
  static async generateCultivationFromExtractedContext(context: string): Promise<any> {
    const aiClient = this.getClient();
    const modelName = getTaskModel('main');
    
    const prompt = `DASHBOARD NGUYÊN TÁC XÁC THỰC:
    <CANON>
    ${context}
    </CANON>
    
    Nhiệm vụ: Trích xuất các Cảnh giới tu luyện chuẩn xác từ <CANON>.
    - Phải lấy đúng tên gọi trong truyện (VD: 'Đấu Giả' thay vì 'Luyện Khí').
    - Nếu là hệ thống phương tây (Cấp 1-100), hãy tuân thủ.
    - Trả về JSON chứa danh sách các cảnh giới.`;

    const taskId = apiRunningService.start(modelName, getCurrentlyUsedKeyDisplay(), "Thiết lập hệ thống tu luyện");
    try {
      const response = await aiClient.models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              realms: { type: Type.STRING, description: "Chuỗi các cảnh giới cách nhau bởi dấu gạch ngang, VD: 'Luyện Khí - Trúc Cơ - Kim Đan'" },
              subRealms: { type: Type.STRING, description: "Chuỗi các tiểu cảnh giới, VD: 'Sơ kỳ - Trung kỳ - Hậu kỳ' hoặc '1 Tầng - 9 Tầng'" }
            }
          }
        }
      });
      apiRunningService.stop(taskId);
      return JSON.parse(cleanJsonResponse(response.text || "{}"));
    } catch (error) {
      apiRunningService.stop(taskId);
      throw error;
    }
  }

  /**
   * NÚT 3: Thiết lập lại toàn bộ yếu tố khởi đầu (Gồm cả NPC) từ context (RAG Step 2)
   */
  static async generateAllStartingElementsFromExtractedContext(context: string, name: string, customPrompt?: string): Promise<any> {
    const aiClient = this.getClient();
    const modelName = getTaskModel('main');
    
    let prompt = `DASHBOARD NGUYÊN TÁC XÁC THỰC:
    <CANON>
    ${context}
    </CANON>
    
    Nhiệm vụ: Thiết lập lại mọi yếu tố khởi đầu cho nhân vật chính "${name}" DỰA TRÊN <CANON>.
    Yêu cầu TUYỆT ĐỐI KHÔNG bịa đặt details nếu context không nhắc tên cụ thể.

    YÊU CẦU CHỈ SỐ CƠ HỌC (Equipment):
    - Tính toán statBonusesJSON theo công thức: Base 10. Mỗi đại cảnh giới x1.8. Rarity mult: Phổ thông (x1), Hiếm (x1.5), Quý Báu (x2.5), Cực Phẩm (x4), Thần Thoại (x7), Chí Tôn (x12).
    - CÁC KHÓA HỢP LỆ TRONG statBonusesJSON (BẮT BUỘC CHỈ DÙNG 4 KHÓA NÀY):
      * maxSinhLuc: Sinh lực tối đa.
      * maxLinhLuc: Linh lực tối đa.
      * sucTanCong: Sức tấn công.
      * phongNgu: Phòng ngự.
    - KHÔNG ĐƯỢC TỰ BỊA RA KHÓA KHÁC.

    ${customPrompt ? `[YÊU CẦU ĐẶC BIỆT TỪ NGƯỜI DÙNG]: "${customPrompt}"` : ""}

    Trả về JSON:
    {
      "startingSkills": [{"name": "Tên kỹ năng", "description": "Mô tả chuẩn", "rarity": "Phẩm cấp"}],
      "startingItems": [{
        "name": "Tên vật phẩm", 
        "description": "Mô tả chuẩn", 
        "quantity": 1,
        "category": "Equipment/Potion/Material",
        "rarity": "Phổ Thông/Hiếm/Quý Báu/Cực Phẩm/Thần Thoại/Chí Tôn",
        "itemRealm": "Cảnh giới vật phẩm",
        "value": 100,
        "equipmentDetails": {
          "slot": "mainWeapon/body/head/artifact/necklace...",
          "statBonusesJSON": "{\"sucTanCong\": 20, \"maxSinhLuc\": 50, \"phongNgu\": 10}",
          "uniqueEffectsList": "Hiệu ứng 1; Hiệu ứng 2"
        },
        "potionDetails": {
          "type": "Hồi Phục/Tăng Cường/Đột Phá",
          "effectsString": "Mô tả hiệu ứng dược phẩm"
        }
      }],
      "startingNPCs": [{"name": "Tên NPC", "personality": "Tính cách", "details": "Quan hệ với ${name}", "gender": "Nam/Nữ", "realm": "Cảnh giới"}],
      "startingYeuThu": [{"name": "Tên Linh Thú", "species": "Loài", "description": "Mô tả", "realm": "Cảnh giới"}],
      "startingLocations": [{"name": "Tên địa điểm", "description": "Mô tả", "category": "Loại"}],
      "startingFactions": [{"name": "Tên thế lực", "description": "Mô tả", "alignment": "Thiên hướng"}],
      "startingLore": [{"title": "Tiêu đề", "content": "Nội dung kiến thức"}]
    }`;

    const taskId = apiRunningService.start(modelName, getCurrentlyUsedKeyDisplay(), "Thiết lập lại yếu tố khởi đầu");
    try {
      const response = await aiClient.models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              startingSkills: { type: Type.ARRAY, items: { type: Type.OBJECT } },
              startingItems: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    description: { type: Type.STRING },
                    category: { type: Type.STRING },
                    rarity: { type: Type.STRING },
                    itemRealm: { type: Type.STRING },
                    value: { type: Type.NUMBER },
                    equipmentDetails: {
                      type: Type.OBJECT,
                      properties: {
                        slot: { type: Type.STRING },
                        statBonusesJSON: { type: Type.STRING, description: "BẮT BUỘC CHỈ DÙNG 4 KHÓA: maxSinhLuc, maxLinhLuc, sucTanCong, phongNgu" },
                        uniqueEffectsList: { type: Type.STRING }
                      }
                    },
                    potionDetails: { type: Type.OBJECT }
                  }
                }
              },
              startingNPCs: { type: Type.ARRAY, items: { type: Type.OBJECT } },
              startingYeuThu: { type: Type.ARRAY, items: { type: Type.OBJECT } },
              startingLocations: { type: Type.ARRAY, items: { type: Type.OBJECT } },
              startingFactions: { type: Type.ARRAY, items: { type: Type.OBJECT } },
              startingLore: { type: Type.ARRAY, items: { type: Type.OBJECT } }
            }
          },
          temperature: 0.2
        }
      });
      apiRunningService.stop(taskId);
      return JSON.parse(cleanJsonResponse(response.text || "{}"));
    } catch (error) {
      apiRunningService.stop(taskId);
      throw error;
    }
  }
}
