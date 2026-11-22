
import { callGeminiAPI } from './apiService';
import { getAllVectors, savePalace, getPalace } from './indexedDBService';
import { generateEmbeddingsWithRetry } from './embeddingService';

export interface KnowledgeRoom {
  name: string;
  description: string;
  keyTopics: string[];
}

export interface KnowledgeRoomWithVector extends KnowledgeRoom {
  vector: number[];
}

export interface MemoryPalace {
  name: string;
  rooms: KnowledgeRoomWithVector[];
  summary: string;
}

export class KnowledgeMapService {
  /**
   * Phân tích các chunks hiện có để tạo ra một "Cung điện ký ức" (Bản đồ tri thức)
   */
  static async generateMemoryPalace(): Promise<MemoryPalace> {
    const allVectors = await getAllVectors();
    if (allVectors.length === 0) {
      throw new Error("Chưa có dữ liệu tri thức. Hãy nạp file trước.");
    }

    // Lấy mẫu khoảng 20 chunks rải đều để AI có cái nhìn tổng quan mà không quá tải token
    const sampleSize = 20;
    const step = Math.max(1, Math.floor(allVectors.length / sampleSize));
    const sampledText = allVectors
      .filter((_, index) => index % step === 0)
      .slice(0, sampleSize)
      .map(v => v.text)
      .join("\n---\n");

    const prompt = `
      Bạn là một chuyên gia về "Memory Palace" (Cung điện ký ức) và Hệ thống quản lý tri thức.
      Dưới đây là các đoạn trích từ một tác phẩm nguyên tác:
      
      ${sampledText}
      
      Dựa trên các đoạn trích này, hãy xây dựng một "Cung điện ký ức" để cấu trúc hóa tri thức này.
      Hãy chia tri thức thành các "Phòng" (Rooms), mỗi phòng đại diện cho một chủ đề lớn (ví dụ: Hệ thống tu luyện, Nhân vật, Thế giới, Lịch sử, Vật phẩm...).
      
      YÊU CẦU PHẢN HỒI DƯỚI ĐỊNH DẠNG JSON CHUẨN:
      {
        "name": "Tên của Cung điện (ví dụ: Cung điện Tuyệt Thế Võ Thần)",
        "summary": "Tóm tắt ngắn gọn về toàn bộ tri thức này",
        "rooms": [
          {
            "name": "Tên phòng",
            "description": "Mô tả phòng này chứa loại tri thức gì",
            "keyTopics": ["Chủ đề 1", "Chủ đề 2", ...]
          }
        ]
      }
      
      Lưu ý: Chỉ phản hồi JSON, không thêm văn bản giải thích.
    `;

    const { text: response } = await callGeminiAPI(prompt, undefined, 'secondary', undefined, "Bạn là một AI chuyên gia phân tích dữ liệu và xuất JSON.");
    
    try {
      // Làm sạch response nếu AI có thêm markdown code blocks
      const cleanJson = response.replace(/```json/g, '').replace(/```/g, '').trim();
      const palaceData = JSON.parse(cleanJson);
      
      // Tạo vector cho từng phòng dựa trên tên và từ khóa
      const roomTexts = palaceData.rooms.map((room: any) => 
        `${room.name}: ${room.description}. Chủ đề: ${room.keyTopics.join(', ')}`
      );
      
      const vectors = await generateEmbeddingsWithRetry(roomTexts);
      
      const palace: MemoryPalace = {
        ...palaceData,
        rooms: palaceData.rooms.map((room: any, idx: number) => ({
          ...room,
          vector: vectors[idx]
        }))
      };
      
      // Lưu vào DB
      await savePalace(palace);
      return palace;
    } catch (e) {
      console.error("Failed to parse or vectorize Memory Palace", e, response);
      throw new Error("AI không tạo được cấu trúc tri thức chuẩn. Hãy thử lại.");
    }
  }

  /**
   * Tải bản đồ tri thức từ DB
   */
  static async loadFromDB(): Promise<MemoryPalace | null> {
    return await getPalace();
  }

  /**
   * Tìm phòng phù hợp nhất với câu hỏi dựa trên Cosine Similarity
   */
  static async getBestRoom(queryVector: number[]): Promise<{ room: KnowledgeRoomWithVector, score: number } | null> {
    const palace = await this.loadFromDB();
    if (!palace || palace.rooms.length === 0) return null;

    let bestRoom = null;
    let maxScore = -1;

    for (const room of palace.rooms) {
      const score = this.cosineSimilarity(queryVector, room.vector);
      if (score > maxScore) {
        maxScore = score;
        bestRoom = room;
      }
    }

    return bestRoom ? { room: bestRoom, score: maxScore } : null;
  }

  private static cosineSimilarity(v1: number[], v2: number[]) {
    const dot = v1.reduce((a, b, i) => a + b * v2[i], 0);
    const m1 = Math.sqrt(v1.reduce((a, b) => a + b * b, 0));
    const m2 = Math.sqrt(v2.reduce((a, b) => a + b * b, 0));
    return dot / (m1 * m2);
  }
}
