import { generateEmbeddingsWithRetry } from "./embeddingService";
import { getAllVectors, saveVector, clearAllVectors } from "./indexedDBService";
import { RagContextExtractor } from "./ragContextExtractor";

export class RAGService {
  static async getEmbedding(text: string) {
    const embeddings = await generateEmbeddingsWithRetry([text]);
    return embeddings[0];
  }

  static async clearKnowledgeBase() {
    await clearAllVectors();
  }

  static async batchEmbedAndSave(chunks: string[], fileId: string, onProgress: (p: number) => void) {
    const BATCH_SIZE = 10; // Giảm kích thước lô để an toàn hơn
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);
      
      // Gọi API một lần cho cả lô thay vì gọi lẻ tẻ từng cái
      const vectors = await generateEmbeddingsWithRetry(batch);
      
      for (let j = 0; j < batch.length; j++) {
        await saveVector({ text: batch[j], vector: vectors[j], fileId });
      }
      
      onProgress(Math.round(((i + batch.length) / chunks.length) * 100));
      // Nghỉ 2 giây giữa mỗi lô để tránh Rate Limit (429)
      await new Promise(r => setTimeout(r, 2000)); 
    }
  }

  static async findRelevantContext(query: string, limit: number = 3, currentTurn?: number) {
    const queryVector = await this.getEmbedding(query);
    
    // SEMANTIC ROUTING: Tìm phòng phù hợp nhất
    let expandedQuery = query;
    let roomContext = "";
    
    try {
      const { KnowledgeMapService } = await import("./KnowledgeMapService");
      const bestRoomData = await KnowledgeMapService.getBestRoom(queryVector);
      
      if (bestRoomData && bestRoomData.score > 0.75) {
        const { room } = bestRoomData;
        // Mở rộng truy vấn với từ khóa của phòng
        expandedQuery = `${query} [Bối cảnh: ${room.name}, Chủ đề: ${room.keyTopics.slice(0, 5).join(', ')}]`;
        roomContext = `[NGỮ CẢNH TỪ PHÒNG: ${room.name.toUpperCase()}]\n`;
        console.log(`Semantic Routing: Đã định tuyến câu hỏi vào phòng "${room.name}" (Score: ${bestRoomData.score.toFixed(2)})`);
      }
    } catch (e) {
      console.warn("Semantic Routing failed, falling back to standard RAG", e);
    }

    // Nếu có expandedQuery, ta cần lấy embedding mới cho nó để tìm kiếm chính xác hơn
    const searchVector = expandedQuery !== query ? await this.getEmbedding(expandedQuery) : queryVector;
    
    const vectors = await getAllVectors();
    
    const results = vectors
      .map(v => {
        if (!v || !v.vector || !Array.isArray(v.vector)) {
          return { text: v?.text || '', score: 0 };
        }
        return { text: v.text, score: this.cosineSimilarity(searchVector, v.vector) };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    const formattedResult = RagContextExtractor.formatRagWithTurnTag(
      results,
      currentTurn || 0
    );

    return roomContext ? `${roomContext}\n${formattedResult}` : formattedResult;
  }

  private static cosineSimilarity(v1: number[], v2: number[]) {
    if (!v1 || !v2 || !Array.isArray(v1) || !Array.isArray(v2)) {
      return 0;
    }
    const len = Math.min(v1.length, v2.length);
    let dot = 0;
    let sum1 = 0;
    let sum2 = 0;
    for (let i = 0; i < len; i++) {
      if (typeof v1[i] !== 'number' || typeof v2[i] !== 'number') continue;
      dot += v1[i] * v2[i];
      sum1 += v1[i] * v1[i];
      sum2 += v2[i] * v2[i];
    }
    const m1 = Math.sqrt(sum1);
    const m2 = Math.sqrt(sum2);
    if (m1 === 0 || m2 === 0) {
      return 0;
    }
    return dot / (m1 * m2);
  }
}
