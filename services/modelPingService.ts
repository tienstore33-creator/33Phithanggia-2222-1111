import { getAiClient } from './aiClient';
import { getApiSettings, getCurrentlyUsedApiKey } from './apiService';
import { apiRunningService } from './apiRunningService';
import { apiKeyManager } from '../utils/apiKeyManager';

export interface ModelPingResult {
  modelId: string;
  modelName: string;
  status: 'idle' | 'testing' | 'success' | 'error';
  latencyMs?: number;
  errorMessage?: string;
  statusCode?: number | string;
  testedAt?: number;
}

/**
 * Kiếm tra (Ping/Test) một model đơn lẻ bằng prompt siêu ngắn 'ping'
 * Tuân thủ Luuyngudan5: Khai báo log API key source, model, latency, mục đích, file caller.
 */
export const pingSingleModel = async (
  modelId: string,
  modelName: string
): Promise<ModelPingResult> => {
  const startTime = Date.now();
  const settings = getApiSettings();
  
  // Xác định nhãn API Key & Key ngẫu nhiên để ghi log và gọi API
  let apiKeyLabel = "System Key";
  let apiKeyToUse: string | undefined = undefined;

  if (settings.apiKeySource === 'user') {
    const validKeys = apiKeyManager.filterValidKeys(settings.userApiKeys || []);
    if (validKeys.length > 0) {
      const randomIndex = Math.floor(Math.random() * validKeys.length);
      apiKeyToUse = validKeys[randomIndex];
      apiKeyLabel = `User Key #${randomIndex + 1}/${validKeys.length}`;
    } else {
      apiKeyLabel = 'User Key (Rỗng)';
    }
  } else if (settings.apiKeySource === 'proxy') {
    apiKeyLabel = "Proxy API";
  }

  // Khai báo task với apiRunningService (Tuân thủ Luuyngudan5)
  const taskId = apiRunningService.start(
    modelId,
    apiKeyLabel,
    "Kiểm tra Model (Ping Test)",
    "ping"
  );

  try {
    const defaultApiKey = apiKeyToUse !== undefined ? apiKeyToUse : (getCurrentlyUsedApiKey() || '');
    const ai = getAiClient(settings, defaultApiKey);

    // Timeout race 12 giây để phát hiện model treo hoặc không phản hồi
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Timeout (Quá thời gian chờ phản hồi 12s)")), 12000)
    );

    const apiPromise = ai.models.generateContent({
      model: modelId,
      contents: "ping",
      config: {
        maxOutputTokens: 10,
        temperature: 0.1
      }
    });

    const response: any = await Promise.race([apiPromise, timeoutPromise]);
    const durationMs = Date.now() - startTime;
    const durationSec = (durationMs / 1000).toFixed(1);

    const resText = response?.text?.trim() || "OK";
    console.log(`[Ping Test] ${apiKeyLabel} : ${modelId} : ${durationSec}s : Kiểm tra Model (Ping Test) : modelPingService.ts`);
    
    apiRunningService.stop(taskId, `OK (${durationSec}s): ${resText}`);

    return {
      modelId,
      modelName,
      status: 'success',
      latencyMs: durationMs,
      testedAt: Date.now()
    };
  } catch (err: any) {
    const durationMs = Date.now() - startTime;
    const durationSec = (durationMs / 1000).toFixed(1);
    const errorMsg = err?.message || String(err);
    
    console.warn(`[Ping Test Error] ${apiKeyLabel} : ${modelId} : ${durationSec}s : Lỗi ping: ${errorMsg} : modelPingService.ts`);
    apiRunningService.stop(taskId, `Lỗi (${durationSec}s): ${errorMsg}`);

    return {
      modelId,
      modelName,
      status: 'error',
      latencyMs: durationMs,
      errorMessage: errorMsg,
      testedAt: Date.now()
    };
  }
};

/**
 * Kiểm tra song song (Parallel) tối đa 2 model cùng lúc để tránh treo máy hoặc quá tải thiết bị.
 * Callback onProgress giúp cập nhật kết quả từng model lên giao diện theo thời gian thực.
 */
export const pingMultipleModels = async (
  models: { id: string; name: string }[],
  onProgress?: (result: ModelPingResult) => void,
  maxConcurrency: number = 2
): Promise<ModelPingResult[]> => {
  const results: ModelPingResult[] = [];
  const queue = [...models];

  // Giới hạn tối đa 2 luồng xử lý đồng thời (Worker pool)
  const workerCount = Math.min(maxConcurrency, models.length);
  const workers = Array.from({ length: workerCount }, async () => {
    while (queue.length > 0) {
      const model = queue.shift();
      if (!model) break;
      const res = await pingSingleModel(model.id, model.name);
      if (onProgress) onProgress(res);
      results.push(res);
    }
  });

  await Promise.all(workers);
  return results;
};
