import { KnowledgeBase, VectorStore } from '../types';
import { getApiSettings } from './geminiService';
import { saveApiSettings } from './apiService';
import { initLocalEmbeddingModel, generateEmbeddingsWithRetry } from './embeddingService';
import { getAllVectors, saveVector, clearAllVectors, getDb, VECTOR_STORE_NAME } from './indexedDBService';

export interface MigrationProgress {
    step: 'idle' | 'downloading' | 'embedding_rag' | 'embedding_works' | 'completed' | 'failed';
    percent: number;
    currentCount: number;
    totalCount: number;
    statusText: string;
}

export class VectorMigrationService {
    /**
     * Kiểm tra xem model local đã được cài đặt chưa
     */
    static async checkIsLocalModelInstalled(modelId: string): Promise<boolean> {
        const isInstalledFlag = localStorage.getItem(`installed_${modelId}`) === 'true';
        if (!isInstalledFlag) return false;

        // Có thể kiểm tra kỹ hơn bằng cách thử khởi tạo nhanh hoặc check Cache API nếu cần
        return true;
    }

    /**
     * Tải model local với tiến trình
     */
    static async downloadModel(modelId: string, onProgress: (p: number) => void): Promise<void> {
        await initLocalEmbeddingModel(modelId, (progress) => {
            if (progress.status === 'progress') {
                onProgress(progress.progress || 0);
            }
        });
        localStorage.setItem(`installed_${modelId}`, 'true');
    }

    /**
     * Chuyển đổi toàn bộ vector sang model mới
     */
    static async migrate(
        targetModel: string,
        knowledgeBase: KnowledgeBase,
        onProgress: (progress: MigrationProgress) => void
    ): Promise<{ updatedKb: KnowledgeBase }> {
        const settings = getApiSettings();
        const oldModel = settings.embeddingModel;

        if (oldModel === targetModel) {
            throw new Error("Model đích trùng với model hiện tại.");
        }

        // Bước 1: Lưu model mới vào settings trước để generateEmbeddingsWithRetry dùng đúng model
        const newSettings = { ...settings, embeddingModel: targetModel };
        saveApiSettings(newSettings);

        let currentKb = { ...knowledgeBase };

        // Bước 2: Xử lý RAG Vector Store trong KnowledgeBase (Ký ức hành trình)
        if (currentKb.ragVectorStore && currentKb.ragVectorStore.metadata.length > 0) {
            onProgress({
                step: 'embedding_rag',
                percent: 0,
                currentCount: 0,
                totalCount: currentKb.ragVectorStore.metadata.length,
                statusText: 'Đang tái vector hóa ký ức hành trình...'
            });

            const texts = currentKb.ragVectorStore.metadata.map(m => m.text);
            const BATCH_SIZE = 5;
            const newVectors: number[][] = [];

            for (let i = 0; i < texts.length; i += BATCH_SIZE) {
                const batch = texts.slice(i, i + BATCH_SIZE);
                const vectors = await generateEmbeddingsWithRetry(batch);
                newVectors.push(...vectors);
                
                const current = Math.min(i + BATCH_SIZE, texts.length);
                onProgress({
                    step: 'embedding_rag',
                    percent: Math.round((current / texts.length) * 100),
                    currentCount: current,
                    totalCount: texts.length,
                    statusText: `Đang xử lý ký ức: ${current}/${texts.length}`
                });
                
                // Nghỉ ngắn để tránh rate limit nếu dùng Gemini
                if (targetModel.includes('embedding')) {
                    await new Promise(r => setTimeout(r, 1000));
                }
            }

            currentKb.ragVectorStore = {
                vectors: newVectors,
                metadata: currentKb.ragVectorStore.metadata
            };
        }

        // Bước 3: Xử lý Original Works trong IndexedDB
        const allStoredVectors = await getAllVectors();
        if (allStoredVectors.length > 0) {
            onProgress({
                step: 'embedding_works',
                percent: 0,
                currentCount: 0,
                totalCount: allStoredVectors.length,
                statusText: 'Đang tái vector hóa dữ liệu truyện gốc...'
            });

            // Gom nhóm theo fileId để xóa và lưu lại cho sạch
            const groupedByFile: Record<string, any[]> = {};
            allStoredVectors.forEach(v => {
                if (!groupedByFile[v.fileId]) groupedByFile[v.fileId] = [];
                groupedByFile[v.fileId].push(v);
            });

            // Xóa sạch store cũ
            await clearAllVectors();

            const BATCH_SIZE = 5;
            let processedGlobal = 0;

            for (const [fileId, items] of Object.entries(groupedByFile)) {
                for (let i = 0; i < items.length; i += BATCH_SIZE) {
                    const batchItems = items.slice(i, i + BATCH_SIZE);
                    const batchTexts = batchItems.map(it => it.text);
                    
                    const vectors = await generateEmbeddingsWithRetry(batchTexts);
                    
                    for (let j = 0; j < batchItems.length; j++) {
                        await saveVector({
                            text: batchItems[j].text,
                            vector: vectors[j],
                            fileId: fileId
                        });
                    }

                    processedGlobal += batchItems.length;
                    onProgress({
                        step: 'embedding_works',
                        percent: Math.round((processedGlobal / allStoredVectors.length) * 100),
                        currentCount: processedGlobal,
                        totalCount: allStoredVectors.length,
                        statusText: `Đang xử lý truyện gốc: ${processedGlobal}/${allStoredVectors.length}`
                    });

                    if (targetModel.includes('embedding')) {
                        await new Promise(r => setTimeout(r, 1000));
                    }
                }
            }
        }

        onProgress({
            step: 'completed',
            percent: 100,
            currentCount: 0,
            totalCount: 0,
            statusText: 'Chuyển đổi hoàn tất!'
        });

        return { updatedKb: currentKb };
    }
}
