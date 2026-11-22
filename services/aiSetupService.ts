import { GoogleGenAI, Type } from "@google/genai";
import { NPC } from "@/types";
import { getTaskModel, getApiSettings, getCurrentlyUsedApiKey } from "./apiService";
import { getAiClient } from "./aiClient";
import { applyThinkingConfig } from "../utils/thinkingLevelUtils";

export class AISetupService {
  private static getClient(): GoogleGenAI {
    const settings = getApiSettings();
    const apiKey = getCurrentlyUsedApiKey() || "";
    return getAiClient(settings, apiKey);
  }

  /**
   * Bước 1: Tạo hệ thống tu luyện dựa trên cốt truyện
   */
  static async generateCultivationSystem(story: string): Promise<{ majors: string[], minors: string[] }> {
    const aiClient = this.getClient();
    const modelName = getTaskModel('main');
    const prompt = `Dựa trên cốt truyện sau, hãy thiết kế một hệ thống tu luyện phù hợp (ví dụ: Tiên hiệp, Huyền huyễn, Võ hiệp...).
    Cốt truyện: ${story}
    
    Yêu cầu trả về JSON với:
    - majors: Danh sách các đại cảnh giới (ví dụ: ["Luyện Khí", "Trúc Cơ", "Kim Đan"...])
    - minors: Danh sách các tiểu cảnh giới/tầng (ví dụ: ["Sơ Kỳ", "Trung Kỳ", "Hậu Kỳ"] hoặc ["1 Tầng", "2 Tầng"...])`;

    const response = await aiClient.models.generateContent({
      model: modelName,
      contents: prompt,
      config: applyThinkingConfig(modelName, {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            majors: { type: Type.ARRAY, items: { type: Type.STRING } },
            minors: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["majors", "minors"]
        }
      }, getApiSettings())
    });

    return JSON.parse(response.text);
  }

  /**
   * Bước 2: Phân tích thực lực MC và NPC dựa trên hệ thống đã tạo
   */
  static async analyzeEntityRealms(
    story: string, 
    npcs: NPC[], 
    system: { majors: string[], minors: string[] }
  ): Promise<{ playerRealm: string, npcMap: Record<string, string> }> {
    const aiClient = this.getClient();
    const modelName = getTaskModel('main');
    
    const npcNames = npcs.map(n => n.name).join(", ");
    const prompt = `Dựa trên cốt truyện và hệ thống tu luyện dưới đây, hãy xác định cảnh giới khởi đầu hợp lý cho Người chơi (MC) và các NPC.
    
    Hệ thống tu luyện:
    - Đại cảnh giới: ${system.majors.join(", ")}
    - Tiểu cảnh giới: ${system.minors.join(", ")}
    
    Cốt truyện: ${story}
    
    Danh sách NPC cần gán cảnh giới: ${npcNames}
    
    Yêu cầu:
    1. Người chơi (MC) thường bắt đầu ở cảnh giới thấp nhất trừ khi cốt truyện mô tả khác.
    2. Đối với mỗi NPC, hãy tìm trong cốt truyện xem có mô tả sức mạnh không. Nếu có, hãy gán cảnh giới tương ứng trong hệ thống.
    3. Trả về JSON format: { "playerRealm": "Tên Đại Tên Tiểu", "npcMap": { "Tên NPC": "Tên Đại Tên Tiểu" } }
    Ví dụ: { "playerRealm": "Luyện Khí 1 Tầng", "npcMap": { "Lý Nam": "Trúc Cơ Sơ Kỳ" } }`;

    // Sử dụng Promise.race để khống chế 30s
    const aiPromise = aiClient.models.generateContent({
      model: modelName,
      contents: prompt,
      config: applyThinkingConfig(modelName, {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            playerRealm: { type: Type.STRING },
            npcMap: { type: Type.OBJECT, additionalProperties: { type: Type.STRING } }
          },
          required: ["playerRealm", "npcMap"]
        }
      }, getApiSettings())
    });

    const timeoutPromise = new Promise<null>((_, reject) => 
      setTimeout(() => reject(new Error("Timeout")), 90000)
    );

    try {
      const response = await Promise.race([aiPromise, timeoutPromise]);
      if (!response) throw new Error("No response");
      return JSON.parse(response.text);
    } catch (error) {
      console.warn("AI Analysis failed or timed out, applying fallback:", error);
      return this.applyFallback(npcs, system);
    }
  }

  static applyFallback(npcs: NPC[], system: { majors: string[], minors: string[] }): { playerRealm: string, npcMap: Record<string, string> } {
    const major1 = system.majors[0] || "Cảnh giới 1";
    const minor1 = system.minors[0] || "Tầng 1";
    
    // Fallback NPC: Đại 2 - Tiểu 3. Nếu không đủ thì lấy mức cao nhất của Đại 1
    const major2 = system.majors.length >= 2 ? system.majors[1] : major1;
    const minor3 = system.minors.length >= 3 ? system.minors[2] : (system.minors[system.minors.length - 1] || "Tầng 3");

    const npcMap: Record<string, string> = {};
    npcs.forEach(npc => {
      npcMap[npc.name] = `${major2} ${minor3}`;
    });

    return {
      playerRealm: `${major1} ${minor1}`,
      npcMap
    };
  }

  /**
   * Bước 1.5: Tạo hệ thống tu luyện thuần túy (10 đại, 9 tiểu)
   */
  static async generatePureCultivationSystem(context: string): Promise<{ majors: string, minors: string }> {
    const aiClient = this.getClient();
    const modelName = getTaskModel('main');
    const { CULTIVATION_SYSTEM_PROMPT } = await import('../prompts/cultivationSystemPrompt');
    
    const response = await aiClient.models.generateContent({
      model: modelName,
      contents: CULTIVATION_SYSTEM_PROMPT(context),
      config: applyThinkingConfig(modelName, {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            majors: { type: Type.STRING },
            minors: { type: Type.STRING }
          },
          required: ["majors", "minors"]
        }
      }, getApiSettings())
    });

    return JSON.parse(response.text);
  }
}

