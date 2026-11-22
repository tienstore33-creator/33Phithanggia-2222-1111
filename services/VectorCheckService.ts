import { generateEmbeddingsWithRetry } from './embeddingService';
import { getAllVectors } from './indexedDBService';
import { KnowledgeBase, RetrievalResult } from '../types';

export class VectorCheckService {
    /**
     * Tìm kiếm top K kết quả tương đồng nhất từ toàn bộ kho RAG
     */
    static async searchAll(query: string, knowledgeBase: KnowledgeBase, limit: number = 20): Promise<RetrievalResult[]> {
        if (!query.trim()) return [];

        try {
            // 1. Tạo embedding cho query
            const embeddings = await generateEmbeddingsWithRetry([query]);
            if (!embeddings || embeddings.length === 0) return [];
            const queryVector = embeddings[0];

            const results: RetrievalResult[] = [];

            // 2. Quét trong knowledgeBase.ragVectorStore (Ký ức hành trình & Thực thể)
            if (knowledgeBase.ragVectorStore && knowledgeBase.ragVectorStore.vectors.length > 0) {
                const kv = knowledgeBase.ragVectorStore;
                kv.vectors.forEach((v, i) => {
                    if (!v || v.length === 0) return;
                    const score = this.cosineSimilarity(queryVector, v);
                    results.push({
                        text: kv.metadata[i].text,
                        score: score,
                        metadata: kv.metadata[i]
                    });
                });
            }

            // 3. Quét trong IndexedDB (Truyện gốc)
            const dbVectors = await getAllVectors();
            dbVectors.forEach(v => {
                if (!v || !v.vector || v.vector.length === 0) return;
                const score = this.cosineSimilarity(queryVector, v.vector);
                results.push({
                    text: v.text,
                    score: score,
                    metadata: {
                        entityId: v.fileId || 'original_work',
                        entityType: 'turn', // Giả định turn cho chunk truyện
                        text: v.text
                    }
                });
            });

            // 4. Sắp xếp và lấy top K
            return results
                .sort((a, b) => b.score - a.score)
                .slice(0, limit);

        } catch (error) {
            console.error("Vector search failed:", error);
            return [];
        }
    }

    private static cosineSimilarity(v1: number[], v2: number[]): number {
        if (!v1 || !v2 || v1.length === 0 || v2.length === 0) return 0;
        
        // Hỗ trợ so sánh lệch chiều (lấy min) nhưng cảnh báo hoặc bỏ qua nếu cần
        // Tuy nhiên theo quy tắc trước đó, chúng ta nên đảm bảo đồng nhất chiều
        const len = Math.min(v1.length, v2.length);
        let dot = 0;
        let mag1 = 0;
        let mag2 = 0;

        for (let i = 0; i < len; i++) {
            dot += v1[i] * v2[i];
            mag1 += v1[i] * v1[i];
            mag2 += v2[i] * v2[i];
        }

        const m1 = Math.sqrt(mag1);
        const m2 = Math.sqrt(mag2);
        
        if (m1 === 0 || m2 === 0) return 0;
        return dot / (m1 * m2);
    }
}
