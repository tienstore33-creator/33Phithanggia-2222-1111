// src/services/embeddingService.ts
import { GoogleGenAI, ContentEmbedding } from "@google/genai";
import { getApiSettings, getCurrentlyUsedApiKey } from './geminiService'; // Use the shared key getter
import { rotationIndices, updateRotationIndex, ensureRotationIndicesInitialized } from './apiService';
import { VIETNAMESE, DEFAULT_EMBEDDING_MODEL_ID } from '../constants';
import { getAiClient } from './aiClient';
import { ApiKeySource } from '../types';
import { pipeline, env } from '@xenova/transformers';
import { globalApiQueue } from './ai/globalApiQueue';
import { apiKeyManager } from '../utils/apiKeyManager';

// Configure Xenova environment for browser usage
(env as any).allowLocalModels = false;
(env as any).allowRemoteModels = true;
(env as any).useBrowserCache = true;
(env as any).useWorker = false;

let ai: GoogleGenAI | null = null;
let lastUsedApiKeyForEmbeddings: string | null = null;
let lastUsedProxyUrl: string | null = null;

// Local extractor instance
let localExtractor: any = null;
let isLocalModelLoading = false;

/**
 * Initializes the local embedding model.
 * @param onProgress Callback for download progress.
 */
export const initLocalEmbeddingModel = async (modelId: string, onProgress?: (progress: any) => void) => {
    // Force specific environment settings for browser/Vite context
    (env as any).allowLocalModels = false;
    (env as any).allowRemoteModels = true;
    (env as any).useBrowserCache = true;
    (env as any).useWorker = false;
    
    // Explicitly set wasm paths to a CDN to avoid local server fetching
    (env.backends.onnx.wasm as any).wasmPaths = 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/dist/';

    // If already loaded the same model, return it
    if (localExtractor && (localExtractor as any).modelId === modelId) return localExtractor;
    
    if (isLocalModelLoading) {
        // If another request is loading, we wait
        while(isLocalModelLoading) {
            await new Promise(resolve => setTimeout(resolve, 200));
            if (localExtractor && (localExtractor as any).modelId === modelId) return localExtractor;
        }
    }

    isLocalModelLoading = true;
    try {
        console.log(`[Embedding] Initializing local model: ${modelId}`);
        
        const extractor = await pipeline('feature-extraction', modelId, {
            progress_callback: (progress: any) => {
                if (onProgress) onProgress(progress);
                if (progress.status === 'progress') {
                    console.log(`[Embedding] Loading ${progress.file}: ${progress.progress?.toFixed(2)}%`);
                } else if (progress.status === 'error') {
                    console.error(`[Embedding] Error loading ${progress.file}:`, progress);
                }
            }
        });
        
        localExtractor = extractor;
        (localExtractor as any).modelId = modelId;
        console.log(`[Embedding] Local model ${modelId} initialized successfully.`);
        return extractor;
    } catch (error) {
        console.error("Failed to load local embedding model:", error);
        // Clear flag if error
        isLocalModelLoading = false;
        throw error;
    } finally {
        isLocalModelLoading = false;
    }
};

/**
 * Generates embeddings using a local model.
 */
const generateLocalEmbeddings = async (texts: string[], modelId: string): Promise<number[][]> => {
    const extractor = await initLocalEmbeddingModel(modelId);
    if (!extractor) throw new Error("Local embedding model is not initialized.");

    const results: number[][] = [];
    for (let text of texts) {
        // Fallback max string length to prevent ONNX Runtime from crashing on >512 tokens
        // bge-micro-v2 has max_position_embeddings=512. Vietnamese text with accents 
        // can have more tokens per word, so 1000 chars is a very safe limit (~250 words / ~350 tokens).
        if (text.length > 1000) {
            text = text.slice(0, 1000);
        }

        // Run sequentially to avoid WebAssembly concurrent execution crashes
        // truncation: true and max_length: 512 prevents exceeding max sequence length
        const output = await extractor(text, { 
            pooling: 'mean', 
            normalize: true, 
            truncation: true,
            max_length: 512
        });
        
        // Ensure it's a completely plain JS array to prevent postMessage cloning issues
        const numericArray = Array.from(output.data);
        results.push(numericArray as number[]);
    }
    
    console.log(`[Embedding] Đã tạo thành công vector (Local Model) cho ${texts.length} câu.`);
    return results;
};

// Function to get a shared GoogleGenAI instance for embeddings, supporting fallback.
const getAiInstanceForEmbeddings = (sourceOverride?: ApiKeySource): GoogleGenAI => {
    const settings = getApiSettings();
    const modelName = settings.embeddingModel || DEFAULT_EMBEDDING_MODEL_ID;
    
    let effectiveSource = sourceOverride || settings.apiKeySource;
    let effectiveApiKey = '';

    // Nếu là model embedding của Google (gemini-embedding-001)
    // vì proxy thường không hỗ trợ endpoint embedContent, ta tự động chuyển dùng key cá nhân (user), proxyKey hoặc system key để gọi trực tiếp Google API.
    if (modelName.includes('embedding')) {
        const userKeys = (settings.userApiKeys || []).filter(k => k && k.trim() !== '');
        const validUserKeys = apiKeyManager.filterValidKeys(userKeys);
        
        if (validUserKeys.length > 0) {
            ensureRotationIndicesInitialized(validUserKeys.length);
            const currentIndex = rotationIndices.main % validUserKeys.length;
            effectiveApiKey = validUserKeys[currentIndex]; // Áp dụng xoay key theo danh mục 'main'
            effectiveSource = 'user';
        } else if (settings.proxyKey && settings.proxyKey.trim() !== '' && settings.proxyKey !== 'dummy-key') {
            effectiveApiKey = settings.proxyKey.trim();
            effectiveSource = 'user';
        } else {
            effectiveApiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || 'system-dummy-key';
            effectiveSource = 'system';
        }

        if (settings.apiKeySource === 'proxy') {
            console.warn(`[Embedding] Phát hiện chọn Proxy nhưng model embedding '${modelName}' không được proxy hỗ trợ. Tự động chuyển hướng sang gọi trực tiếp Google API bằng nguồn '${effectiveSource}' (Key: ${effectiveApiKey === 'system-dummy-key' ? 'Chưa cấu hình/Dummy' : 'Đã có Key'}).`);
        }
    } else {
        const userKey = getCurrentlyUsedApiKey();
        if (userKey && userKey !== 'dummy-key' && userKey !== 'system-proxy-key') {
            effectiveApiKey = userKey;
        } else if (settings.proxyKey && settings.proxyKey.trim() !== '' && settings.proxyKey !== 'dummy-key') {
            effectiveApiKey = settings.proxyKey.trim();
        } else {
            effectiveApiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || 'system-dummy-key';
        }
    }

    // Create settings clone for client initialization
    // Bypass proxy URL completely for embeddings so it never routes through proxy server
    const effectiveSettings = { ...settings, apiKeySource: effectiveSource, proxyUrl: '' };

    if (!ai || lastUsedApiKeyForEmbeddings !== effectiveApiKey || lastUsedProxyUrl !== effectiveSettings.proxyUrl) {
        try {
            ai = getAiClient(effectiveSettings as any, effectiveApiKey);
            lastUsedApiKeyForEmbeddings = effectiveApiKey;
            lastUsedProxyUrl = effectiveSettings.proxyUrl || null;
        } catch (initError) {
            console.error("Failed to initialize GoogleGenAI client for embeddings:", initError);
            throw new Error(`Lỗi khởi tạo API Key cho dịch vụ embedding: ${initError instanceof Error ? initError.message : String(initError)}`);
        }
    }
    return ai;
};


const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Generates embeddings for an array of text strings.
 * @param texts An array of strings to embed.
 * @returns A Promise that resolves to an array of number arrays (vectors).
 */
export const generateEmbeddings = async (texts: string[]): Promise<number[][]> => {
    if (!texts || texts.length === 0) {
        return [];
    }

    const settings = getApiSettings();
    const modelName = settings.embeddingModel || DEFAULT_EMBEDDING_MODEL_ID;

    // Route to local embedding if TaylorAI model is selected
    if (modelName.startsWith('TaylorAI/')) {
        try {
            return await generateLocalEmbeddings(texts, modelName);
        } catch (localError) {
            console.error("Local embedding fallback error:", localError);
            throw new Error(`Lỗi tạo vector (Local Model): ${localError instanceof Error ? localError.message : String(localError)}`);
        }
    }

    // Bắt buộc lấy danh sách API Key cá nhân hợp lệ cho mô hình Gemini Embedding
    const userKeys = (settings.userApiKeys || []).filter(k => k && k.trim() !== '');
    const validUserKeys = apiKeyManager.filterValidKeys(userKeys);

    if (validUserKeys.length === 0) {
        throw new Error("Không tìm thấy API Key cá nhân hợp lệ. Vui lòng thêm ít nhất một API Key cá nhân trong Cài Đặt API để sử dụng mô hình Gemini Embedding.");
    }

    // Tập hợp danh sách các key ứng viên (sẽ loại dần key bị lỗi khi retry)
    const candidateKeys = [...validUserKeys];
    let lastError: any = null;

    while (candidateKeys.length > 0) {
        // Tự động chọn ngẫu nhiên 1 API key trong danh sách ứng viên còn lại
        const randomIndex = Math.floor(Math.random() * candidateKeys.length);
        const selectedApiKey = candidateKeys[randomIndex];
        // Loại bỏ key đã chọn khỏi mảng ứng viên của lượt thử hiện tại
        candidateKeys.splice(randomIndex, 1);

        const keyIndexInUserKeys = (settings.userApiKeys || []).findIndex(k => k === selectedApiKey);
        const keyLabel = keyIndexInUserKeys >= 0 ? `API Key cá nhân #${keyIndexInUserKeys + 1}` : 'API Key cá nhân';

        try {
            const startTime = Date.now();
            return await globalApiQueue.enqueue(async () => {
                const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
                console.log(`[Embedding] [${keyLabel}] : ${modelName} : ${durationSec}s : Tạo vector Embedding (RAG) : /services/embeddingService.ts`);

                const effectiveSettings = { ...settings, apiKeySource: 'user', proxyUrl: '' };
                const client = getAiClient(effectiveSettings as any, selectedApiKey);

                const response = await client.models.embedContent({
                    model: `models/${modelName}`,
                    contents: texts.map(text => ({ parts: [{ text }] }))
                });

                if (response.embeddings && response.embeddings.length > 0) {
                    return response.embeddings.map((emb: ContentEmbedding) => emb.values);
                } else {
                    console.error(`[Embedding] Không tìm thấy dữ liệu vector trong phản hồi từ API (${keyLabel}).`, response);
                    throw new Error(`Không tìm thấy dữ liệu vector trong phản hồi từ API embedding (${keyLabel}).`);
                }
            }, 2); // Priority 2 - Thấp/Chạy ngầm cho Vectorization
        } catch (error: any) {
            lastError = error;
            console.warn(`[Embedding] Lỗi khi tạo embeddings với ${keyLabel} (còn ${candidateKeys.length} key khác để thử lại):`, error);
        }
    }

    // Nếu thử tất cả các API Key cá nhân đều thất bại
    const lastMessage = lastError instanceof Error ? lastError.message : String(lastError);
    throw new Error(`Tất cả các API Key cá nhân (${validUserKeys.length} key) đều tạo vector thất bại: ${lastMessage}`);
};

export const generateEmbeddingsWithRetry = async (texts: string[], maxRetries = 3): Promise<number[][]> => {
    let attempt = 0;
    while (attempt < maxRetries) {
        try {
            return await generateEmbeddings(texts);
        } catch (error: any) {
            // Kiểm tra lỗi 429
            if (error.message.includes('429') && attempt < maxRetries - 1) {
                const waitTime = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
                console.warn(`Lỗi 429, thử lại sau ${waitTime}ms (lần ${attempt + 1})`);
                await sleep(waitTime);
                attempt++;
                continue;
            }
            console.warn("Lỗi tạo vector sau khi thử lại hoặc lỗi không thể phục hồi, bỏ qua tạo vector:", error);
            return []; // Fallback an toàn, trả về mảng rỗng thay vì throw
        }
    }
    return [];
};
