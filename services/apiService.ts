import { ApiConfig } from '../types';
import { API_SETTINGS_STORAGE_KEY, DEFAULT_API_CONFIG } from '../constants';
import { executeWithFallback, TaskCategory, FLASH_LITE_FALLBACK_CHAIN } from '../utils/modelFallback';
import { getAiClient } from './aiClient';
import { apiKeyManager } from '../utils/apiKeyManager';
import { globalApiQueue } from './ai/globalApiQueue';
import { removeTuongThanTag } from '../utils/xmlSanitizerUtils';

/**
 * API Service
 * Handles API settings, key management, and core Gemini API calls.
 */

let globalIndex = -1;

export const rotationIndices = {
    get main(): number { return globalIndex; },
    set main(v: number) { globalIndex = v; },
    get economy(): number { return globalIndex; },
    set economy(v: number) { globalIndex = v; },
    get combat(): number { return globalIndex; },
    set combat(v: number) { globalIndex = v; },
    get global(): number { return globalIndex; },
    set global(v: number) { globalIndex = v; }
};

export const ensureRotationIndicesInitialized = (keysCount: number) => {
    if (keysCount <= 0) return;
    if (globalIndex === -1) {
        globalIndex = Math.floor(Math.random() * keysCount);
        console.log(`[Revolver API Key] Khởi tạo ngẫu nhiên API Key ban đầu: index ${globalIndex} (Key #${globalIndex + 1}/${keysCount})`);
    }
};

export const resetRotationIndices = (): void => {
    globalIndex = -1;
};

/**
 * Gets the current index for a specific category
 */
const getRotationIndex = (category: TaskCategory): number => {
    return globalIndex;
};

/**
 * Updates the rotation index for a specific category (Revolver style)
 */
export const updateRotationIndex = (category: TaskCategory, keysCount: number) => {
    if (keysCount <= 0) return;
    globalIndex = (globalIndex + 1) % keysCount;
    console.log(`[Revolver API Key] Global key index rotated to: ${globalIndex} (Key #${globalIndex + 1})`);
};

export const getApiSettings = (): ApiConfig => {
  let settings = DEFAULT_API_CONFIG;
  const stored = localStorage.getItem(API_SETTINGS_STORAGE_KEY);
  if (stored) {
    try {
      settings = { ...DEFAULT_API_CONFIG, ...JSON.parse(stored) };
    } catch (e) {
      console.error("Failed to parse API settings", e);
    }
  }

  // Ép buộc cố định Nền tảng AI về Google Gemini
  settings.aiProvider = 'google';

  if (!settings.model) {
    settings.model = DEFAULT_API_CONFIG.model || 'gemini-flash-latest';
  }
  if (!settings.economyModel) {
    settings.economyModel = DEFAULT_API_CONFIG.economyModel || settings.model;
  }
  if (!settings.combatModel) {
    settings.combatModel = DEFAULT_API_CONFIG.combatModel || settings.model;
  }
  if (!settings.modelThinkingLevels) {
    settings.modelThinkingLevels = {};
  }

  return settings;
};

export const saveApiSettings = (settings: ApiConfig): void => {
    localStorage.setItem(API_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    resetRotationIndices();
};

export const getCurrentlyUsedApiKey = (): string | null => {
    const settings = getApiSettings();
    if (settings.apiKeySource === 'system') {
        const systemApiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
        return systemApiKey || "system-proxy-key";
    }
    if (settings.apiKeySource === 'proxy') {
        return settings.proxyKey || 'dummy-key';
    }
    const keys = (settings.userApiKeys || []).filter(k => k && k.trim() !== '');
    // Thanh lọc các key đã bị đánh dấu là không hợp lệ
    const validKeys = apiKeyManager.filterValidKeys(keys);
    
    if (validKeys.length === 0) return null;
    ensureRotationIndicesInitialized(validKeys.length);
    // Mặc định trả về key của Main nếu không truyền category (phương thức này ít dùng trực tiếp)
    const key = validKeys[rotationIndices.main % validKeys.length];
    
    // REVOLVER: Xoay sang key tiếp theo ngay lập tức
    updateRotationIndex('main', validKeys.length);
    
    return key;
};

export const getCurrentlyUsedApiKeyByCategory = (category: TaskCategory): string | null => {
    const settings = getApiSettings();
    if (settings.apiKeySource === 'system') {
        const systemApiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
        return systemApiKey || "system-proxy-key";
    }
    if (settings.apiKeySource === 'proxy') {
        return settings.proxyKey || 'dummy-key';
    }
    const keys = (settings.userApiKeys || []).filter(k => k && k.trim() !== '');
    const validKeys = apiKeyManager.filterValidKeys(keys);
    
    if (validKeys.length === 0) return null;
    ensureRotationIndicesInitialized(validKeys.length);
    
    const idx = getRotationIndex(category);
    const key = validKeys[idx % validKeys.length];
    
    // REVOLVER: Xoay sang key tiếp theo ngay lập tức
    updateRotationIndex(category, validKeys.length);
    
    return key;
};

export const getCurrentlyUsedKeyDisplay = (): string => {
    const settings = getApiSettings();
    if (settings.apiKeySource === 'system') {
        return "Key Hệ Thống";
    }
    const keys = (settings.userApiKeys || []).filter(k => k && k.trim() !== '');
    // Hiển thị trạng thái dựa trên các key hợp lệ
    const validKeys = apiKeyManager.filterValidKeys(keys);
    
    if (keys.length === 0) return "Chưa có Key";
    if (validKeys.length === 0 && keys.length > 0) return "Tất cả Key lỗi (400)";
    
    ensureRotationIndicesInitialized(validKeys.length);
    // Hiển thị key của Main làm đại diện
    const currentKey = validKeys[rotationIndices.main % validKeys.length];
    if (!currentKey) return "Lỗi Key";
    const last4 = currentKey.slice(-4);
    return `...${last4} (Main Key ${rotationIndices.main + 1})`;
};

export const getTaskModel = (task: 'main' | 'economy' | 'combat' | 'lite'): string => {
    const settings = getApiSettings();
    const liteChain = FLASH_LITE_FALLBACK_CHAIN;
    
    switch(task) {
      case 'main': return settings.model || 'gemini-flash-latest';
      case 'economy': return settings.economyModel || settings.model || 'gemini-flash-lite-latest';
      case 'combat': return settings.combatModel || settings.model || 'gemini-flash-lite-latest';
      case 'lite': return settings.combatModel || settings.model || 'gemini-flash-lite-latest';
    }
};

/**
 * Helper function to call an async function with exponential backoff retry logic.
 * Specifically handles 429 (Resource Exhausted) errors.
 */
const callWithRetry = async <T>(fn: () => Promise<T>, retries = 3, delay = 4000): Promise<T> => {
    try {
        return await fn();
    } catch (error: any) {
        // Check for 429 error status or message
        const isRateLimit = error.status === 429 || 
                           (error.message && error.message.includes('429')) ||
                           (error.message && error.message.includes('RESOURCE_EXHAUSTED'));
        
        if (isRateLimit && retries > 0) {
            console.warn(`[Gemini API] Quota exceeded (429). Retrying in ${delay}ms... (${retries} retries left)`);
            await new Promise(res => setTimeout(res, delay));
            return callWithRetry(fn, retries - 1, delay * 2); // Double the delay for next retry
        }
        throw error;
    }
};

export function cleanThinking(text: string): string {
    if (!text) return '';
    let cleaned = removeTuongThanTag(text);
    cleaned = cleaned.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '');
    cleaned = cleaned.replace(/<\/?(thinking|think|tuong_thuat)[^>]*>/gi, '');
    return cleaned.trim();
}

export { removeTuongThanTag };

/**
 * Core API Call to Gemini
 */
export async function callGeminiAPI(
    prompt: string, 
    onPromptConstructedForLog?: (prompt: string) => void, 
    category: TaskCategory = 'secondary', 
    onModelUsed?: (model: string) => void, 
    systemInstruction?: string, 
    useGoogleSearch?: boolean,
    responseMimeType?: string,
    overrideSettings?: ApiConfig,
    inlineParts?: { mimeType: string; data: string }[],
    purpose?: string,
    priority?: number,
    enablePrefill: boolean = true,
    prefillModelText: string = "</tuong_than>\n<thinking>\n"
): Promise<{ text: string, modelUsed: string, grounding?: any }> {
    if (onPromptConstructedForLog) {
        onPromptConstructedForLog(prompt);
    }

    const settings = overrideSettings || getApiSettings();
    let apiKey = '';

    if (settings.apiKeySource === 'system') {
        const systemApiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
        apiKey = systemApiKey || "system-proxy-key";
    } else if (settings.apiKeySource === 'proxy') {
        apiKey = settings.proxyKey || 'dummy-key';
    } else {
        const keys = (settings.userApiKeys || []).filter(k => k && k.trim() !== '');
        const validKeys = apiKeyManager.filterValidKeys(keys);

        if (validKeys.length === 0) {
            throw new Error("Chưa có API Key cá nhân. Vui lòng vào Cài đặt để thêm.");
        }

        ensureRotationIndicesInitialized(validKeys.length);

        // Chọn key dựa trên category (Main/Economy/Combat)
        const idx = getRotationIndex(category);
        apiKey = validKeys[idx % validKeys.length];
        // REVOLVER: Xoay sang key tiếp theo ngay lập tức
        updateRotationIndex(category, validKeys.length);
    }

    // Determine task priority if not explicitly provided
    let taskPriority = 1;
    if (priority !== undefined) {
        taskPriority = priority;
    } else if (category === 'main' || category === 'combat') {
        taskPriority = 0; // Highest priority for user/narrative actions and active combat
    } else if (category === 'economy') {
        taskPriority = 1; // Medium priority
    } else {
        taskPriority = 1; // Default medium priority
    }

    return globalApiQueue.enqueue(async () => {
        const rawRes = await executeWithFallback(prompt, apiKey, settings, category, systemInstruction, useGoogleSearch, responseMimeType, inlineParts, purpose, enablePrefill, prefillModelText);
        const text = cleanThinking(rawRes.text);
        const modelUsed = rawRes.modelUsed;
        if (onModelUsed) onModelUsed(modelUsed);
        
        // Log combat and economy requests
        if (category === 'economy' || category === 'combat') {
            try {
                const rawLogs = localStorage.getItem('ec_logs_store');
                let logsArray = [];
                if (rawLogs) {
                    logsArray = JSON.parse(rawLogs);
                }
                if (!Array.isArray(logsArray)) {
                    logsArray = [];
                }
                
                const newLog = {
                    id: Date.now().toString() + Math.random().toString().substring(2, 7),
                    timestamp: new Date().toLocaleTimeString('vi-VN'),
                    type: category,
                    prompt: prompt,
                    response: text
                };
                
                logsArray.unshift(newLog);
                
                // Lưu trữ nội dung 2 lượt chơi gần nhất và xoá đi các nội dung cũ hơn
                if (logsArray.length > 2) {
                    logsArray = logsArray.slice(0, 2);
                }
                
                localStorage.setItem('ec_logs_store', JSON.stringify(logsArray));
                window.dispatchEvent(new Event('ec-logs-change'));
            } catch (err) {
                console.error("Lỗi khi ghi log E&C:", err);
            }
        }
        
        // REVOLVER: Rotation is handled immediately upon key selection
        return { text, modelUsed, grounding: rawRes.grounding };
    }, taskPriority);
}

/**
 * Token Counting Utility
 */
export const countTokens = async (text: string): Promise<number> => {
    const settings = getApiSettings();
    const apiKey = getCurrentlyUsedApiKey();
    
    if (!apiKey) return text.length / 4;

    // Use currently active key
    const ai = getAiClient(settings, apiKey);
    const modelName = settings.apiKeySource === 'proxy' ? (settings.combatModel || 'gemini-flash-latest') : (settings.combatModel || 'gemini-flash-latest');
    
    try {
        const response = await ai.models.countTokens({
             model: modelName,
             contents: [{ parts: [{ text }] }]
        });
        return response.totalTokens || 0;
    } catch (e) {
        console.warn("Count tokens failed", e);
        return text.length / 4; // Crude fallback
    }
};

/**
 * Auto-recovery connection check wrapper.
 * Starts a 30s timer and reloads the page or runs onTimeout if the check takes too long.
 */
export const checkConnectionWithAutoReload = async (
    checkFn: () => Promise<any>, 
    onSuccess: () => void,
    onTimeout?: () => void
) => {
    const TIMEOUT_MS = 30000;
    
    localStorage.setItem('AUTO_RETRY_CONNECTION', 'true');
    const currentRetry = Number(localStorage.getItem('RETRY_COUNT') || 0);
    localStorage.setItem('RETRY_COUNT', (currentRetry + 1).toString());

    let isFinished = false;

    const timeoutId = setTimeout(() => {
        if (!isFinished) {
            console.warn("Kết nối quá 30s, đang tự động reload...");
            if (onTimeout) {
                onTimeout();
            } else {
                window.location.reload();
            }
        }
    }, TIMEOUT_MS);

    try {
        await checkFn();
        isFinished = true;
        clearTimeout(timeoutId);
        localStorage.removeItem('AUTO_RETRY_CONNECTION');
        localStorage.removeItem('RETRY_COUNT');
        onSuccess();
    } catch (error) {
        isFinished = true;
        clearTimeout(timeoutId);
        // On immediate error, we don't necessarily reload, 
        // the 7s timer is the primary trigger for "hanging" connections.
        throw error;
    }
};
