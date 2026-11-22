import { getDb, PENDING_FILES_STORE, VECTOR_JOBS_STORE, PENDING_CHUNKS_STORE, saveVector } from './indexedDBService';
import { generateEmbeddingsWithRetry } from './embeddingService';

export interface VectorizationJob {
    id: string;
    fileName: string;
    totalChunks: number;
    currentChunk: number;
    status: 'initialized' | 'ready' | 'processing' | 'completed' | 'failed';
    logs: string[];
    timestamp: number;
}

export interface PendingChunk {
    id: string; // jobId_index
    jobId: string;
    index: number;
    text: string;
}

class VectorizationManager {
    private static instance: VectorizationManager;
    private isProcessing = false;
    private cancelledJobs = new Set<string>();

    private constructor() {}

    public static getInstance(): VectorizationManager {
        if (!VectorizationManager.instance) {
            VectorizationManager.instance = new VectorizationManager();
        }
        return VectorizationManager.instance;
    }

    private async addLog(jobId: string, message: string): Promise<void> {
        const db = await getDb();
        const timestamp = new Date().toLocaleTimeString();
        const logMessage = `> [${timestamp}] ${message}`;
        
        const tx = db.transaction(VECTOR_JOBS_STORE, 'readwrite');
        const store = tx.objectStore(VECTOR_JOBS_STORE);
        const job = await new Promise<VectorizationJob | null>((resolve) => {
            const req = store.get(jobId);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => resolve(null);
        });

        if (job) {
            job.logs = [...(job.logs || []), logMessage].slice(-50); // Keep last 50 logs
            store.put(job);
        }
    }

    /**
     * Bước 1: Khởi tạo Job và lưu file gốc
     */
    public async startJob(file: File): Promise<string> {
        const jobId = `job_${Date.now()}`;
        const db = await getDb();
        
        // Lưu file gốc
        const fileTx = db.transaction(PENDING_FILES_STORE, 'readwrite');
        await fileTx.objectStore(PENDING_FILES_STORE).put({ id: jobId, file });

        // Khởi tạo Job
        const job: VectorizationJob = {
            id: jobId,
            fileName: file.name,
            totalChunks: 0,
            currentChunk: 0,
            status: 'initialized',
            logs: [],
            timestamp: Date.now()
        };
        const jobTx = db.transaction(VECTOR_JOBS_STORE, 'readwrite');
        await jobTx.objectStore(VECTOR_JOBS_STORE).put(job);

        await this.addLog(jobId, `Đã lưu file gốc vào Storage an toàn: ${file.name}`);
        return jobId;
    }

    /**
     * Bước 2: Chia nhỏ tài liệu và lưu các chunks
     */
    public async prepareChunks(jobId: string, text: string, chunkSize = 1000): Promise<void> {
        const db = await getDb();
        
        // Chia nhỏ text (đơn giản theo ký tự, có thể cải tiến theo token sau)
        const chunks: string[] = [];
        for (let i = 0; i < text.length; i += chunkSize) {
            chunks.push(text.slice(i, i + chunkSize));
        }

        const tx = db.transaction([PENDING_CHUNKS_STORE, VECTOR_JOBS_STORE], 'readwrite');
        const chunkStore = tx.objectStore(PENDING_CHUNKS_STORE);
        const jobStore = tx.objectStore(VECTOR_JOBS_STORE);

        // Lưu từng chunk
        for (let i = 0; i < chunks.length; i++) {
            const pendingChunk: PendingChunk = {
                id: `${jobId}_${i}`,
                jobId,
                index: i,
                text: chunks[i]
            };
            await chunkStore.put(pendingChunk);
        }

        // Cập nhật Job
        const job = await new Promise<VectorizationJob | null>((resolve) => {
            const req = jobStore.get(jobId);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => resolve(null);
        });

        if (job) {
            job.totalChunks = chunks.length;
            job.status = 'ready';
            jobStore.put(job);
            await this.addLog(jobId, `Chia nhỏ tài liệu thành ${chunks.length} phần (mỗi phần ~${chunkSize} ký tự).`);
        }
    }

    /**
     * Bước 3: Tiến hành véc tơ hóa từng phần
     */
    public async processJob(jobId: string, onProgress?: (current: number, total: number) => void): Promise<void> {
        if (this.isProcessing) return;
        this.isProcessing = true;

        try {
            const db = await getDb();
            
            const getJob = (): Promise<VectorizationJob | null> => {
                return new Promise((resolve) => {
                    const req = db.transaction(VECTOR_JOBS_STORE, 'readonly').objectStore(VECTOR_JOBS_STORE).get(jobId);
                    req.onsuccess = () => resolve(req.result);
                    req.onerror = () => resolve(null);
                });
            };

            let job = await getJob();

            if (!job || job.status === 'completed') {
                this.isProcessing = false;
                return;
            }

            job.status = 'processing';
            await new Promise<void>((resolve) => {
                const req = db.transaction(VECTOR_JOBS_STORE, 'readwrite').objectStore(VECTOR_JOBS_STORE).put(job);
                req.onsuccess = () => resolve();
            });

            await this.addLog(jobId, `Bắt đầu tiến trình véc tơ hóa từ Chunk ${job.currentChunk + 1}.`);

            const BATCH_SIZE = 10;
            let batch: PendingChunk[] = [];
            let batchIndices: number[] = [];

            while (job.currentChunk < job.totalChunks) {
                // Kiểm tra xem job có bị hủy không
                if (this.cancelledJobs.has(jobId)) {
                    await this.addLog(jobId, "PHÁT HIỆN YÊU CẦU HỦY. Đang dừng tiến trình...");
                    this.cancelledJobs.delete(jobId);
                    return; // Thoát khỏi hàm xử lý
                }

                // Dùng một biến tạm để duyệt và gom batch bắt đầu từ currentChunk hiện tại
                let tempPointer = job.currentChunk;
                batch = [];
                batchIndices = [];

                while (batch.length < BATCH_SIZE && tempPointer < job.totalChunks) {
                    const chunkId = `${jobId}_${tempPointer}`;
                    const chunk = await new Promise<PendingChunk | null>((resolve) => {
                        const req = db.transaction(PENDING_CHUNKS_STORE, 'readonly').objectStore(PENDING_CHUNKS_STORE).get(chunkId);
                        req.onsuccess = () => resolve(req.result);
                        req.onerror = () => resolve(null);
                    });

                    if (chunk) {
                        batch.push(chunk);
                        batchIndices.push(tempPointer);
                    }
                    tempPointer++;
                }

                if (batch.length > 0) {
                    await this.addLog(jobId, `Đang xử lý Batch (${batch.length} chunks) từ #${batchIndices[0] + 1}...`);
                    
                    const texts = batch.map(c => c.text);
                    const vectors = await generateEmbeddingsWithRetry(texts);
                    
                    if (vectors && vectors.length === batch.length) {
                        // [PHASER 2]: Kiểm tra lại trước khi ghi Vector vào DB
                        if (this.cancelledJobs.has(jobId)) {
                            this.cancelledJobs.delete(jobId);
                            return;
                        }

                        for (let i = 0; i < vectors.length; i++) {
                            await saveVector({
                                text: batch[i].text,
                                vector: vectors[i],
                                fileId: job.fileName
                            });
                        }
                        await this.addLog(jobId, `Hoàn tất xử lý Batch đến Chunk #${batchIndices[batchIndices.length - 1] + 1}.`);
                    } else {
                        throw new Error("Không nhận được đủ vector từ API.");
                    }

                    // Cập nhật tiến độ tổng thể sau khi xong batch
                    job.currentChunk += batch.length;
                    if (onProgress) onProgress(job.currentChunk, job.totalChunks);

                    // [PHASER 3]: Kiểm tra lần cuối trước khi cập nhật tiến độ Job
                    if (this.cancelledJobs.has(jobId)) {
                        this.cancelledJobs.delete(jobId);
                        return; 
                    }

                    await new Promise<void>((resolve) => {
                        const req = db.transaction(VECTOR_JOBS_STORE, 'readwrite').objectStore(VECTOR_JOBS_STORE).put(job);
                        req.onsuccess = () => resolve();
                    });
                } else {
                    // Nếu không lấy được chunk nào mà vẫn chưa xong, có thể dữ liệu lỗi, tăng pointer để thoát
                    job.currentChunk++;
                }
            }

            // Bước 4: Hoàn tất và dọn dẹp
            job.status = 'completed';
            await new Promise<void>((resolve) => {
                const req = db.transaction(VECTOR_JOBS_STORE, 'readwrite').objectStore(VECTOR_JOBS_STORE).put(job);
                req.onsuccess = () => resolve();
            });
            
            await this.addLog(jobId, "Đã hoàn thành 100%. Tiến hành dọn dẹp dữ liệu tạm.");
            await this.cleanup(jobId, true);
            await this.addLog(jobId, "Tiến trình kết thúc an toàn.");

        } catch (error) {
            console.error("Lỗi trong quá trình véc tơ hóa:", error);
            const db = await getDb();
            const jobReq = db.transaction(VECTOR_JOBS_STORE, 'readonly').objectStore(VECTOR_JOBS_STORE).get(jobId);
            jobReq.onsuccess = () => {
                const job = jobReq.result as VectorizationJob;
                if (job) {
                    job.status = 'failed';
                    db.transaction(VECTOR_JOBS_STORE, 'readwrite').objectStore(VECTOR_JOBS_STORE).put(job);
                }
            };
            throw error;
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * Dọn dẹp dữ liệu tạm triệt để
     */
    public async cleanup(jobId: string, keepVectors = false): Promise<void> {
        // Nếu không giữ vector, đánh dấu hủy nếu đang chạy
        if (!keepVectors) {
            this.cancelledJobs.add(jobId);
        }
        
        const db = await getDb();
        
        // 1. Phục hồi tên file để xóa Véctơ đã lưu
        let fileNameToClean = "";
        try {
            const job = await new Promise<VectorizationJob | null>((resolve) => {
                const req = db.transaction(VECTOR_JOBS_STORE, 'readonly').objectStore(VECTOR_JOBS_STORE).get(jobId);
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => resolve(null);
            });
            if (job) fileNameToClean = job.fileName;
        } catch (e) {
            console.warn("Could not retrieve job info for cleanup:", e);
        }

        // 2 & 3. Xóa thông tin job và file gốc
        await new Promise<void>((resolve) => {
            const req = db.transaction(VECTOR_JOBS_STORE, 'readwrite').objectStore(VECTOR_JOBS_STORE).delete(jobId);
            req.onsuccess = () => resolve();
        });
        
        await new Promise<void>((resolve) => {
            const req = db.transaction(PENDING_FILES_STORE, 'readwrite').objectStore(PENDING_FILES_STORE).delete(jobId);
            req.onsuccess = () => resolve();
        });

        // 4. Xóa các chunks tạm
        const chunks: PendingChunk[] = await new Promise((resolve) => {
            const req = db.transaction(PENDING_CHUNKS_STORE, 'readonly').objectStore(PENDING_CHUNKS_STORE).getAll();
            req.onsuccess = () => resolve(req.result);
        });

        const tx = db.transaction(PENDING_CHUNKS_STORE, 'readwrite');
        const chunkStore = tx.objectStore(PENDING_CHUNKS_STORE);
        for (const chunk of chunks) {
            if (chunk.jobId === jobId) {
                chunkStore.delete(chunk.id);
            }
        }

        // 5. [QUAN TRỌNG] Xóa toàn bộ Véctơ đã lưu liên quan đến file này (Chỉ khi CHƯA hoàn thành hoặc chủ động hủy)
        if (!keepVectors && fileNameToClean) {
            const vectorStoreName = 'original_work_vectors'; // Đồng nhất từ indexedDBService
            const vectors: any[] = await new Promise((resolve) => {
                const req = db.transaction(vectorStoreName, 'readonly').objectStore(vectorStoreName).getAll();
                req.onsuccess = () => resolve(req.result);
            });
            
            const txVectors = db.transaction(vectorStoreName, 'readwrite');
            const vStore = txVectors.objectStore(vectorStoreName);
            for (const v of vectors) {
                if (v.fileId === fileNameToClean) {
                    vStore.delete(v.id);
                }
            }
        }
    }

    public async getActiveJobs(): Promise<VectorizationJob[]> {
        const db = await getDb();
        return new Promise((resolve) => {
            const req = db.transaction(VECTOR_JOBS_STORE, 'readonly').objectStore(VECTOR_JOBS_STORE).getAll();
            req.onsuccess = () => {
                const jobs = req.result as VectorizationJob[];
                resolve(jobs.filter(j => j.status !== 'completed'));
            };
            req.onerror = () => resolve([]);
        });
    }
}

export const vectorizationManager = VectorizationManager.getInstance();
