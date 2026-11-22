import { getAiClient } from './aiClient';
import { getApiSettings, getCurrentlyUsedApiKeyByCategory, rotationIndices } from './apiService';
import { TaskCategory, getModelChainForTask, setLastSuccessfulModel, createFallbackKeyRotator } from '../utils/modelFallback';
import { removeTuongThanTag } from '../utils/xmlSanitizerUtils';
import { GroundingData } from '../types/chatbot';
import { extractGroundingDataFromResponse } from './chatbotGroundingExtractor';
import { apiKeyManager } from '../utils/apiKeyManager';
import { apiRunningService } from './apiRunningService';
import { fallbackEventService } from './fallbackEventService';
import { fallbackPromptService } from './fallbackPromptService';
import { parseApiError } from '../utils/apiErrorParser';
import { sanitizeSearchConfig, isGoogleSearchSupported } from '../utils/searchGuard';
import { globalApiQueue } from './ai/globalApiQueue';

export interface StreamCallbacks {
  onChunk: (chunk: string) => void;
  onFullText?: (fullText: string, grounding?: GroundingData) => void;
  onGrounding?: (grounding: GroundingData) => void;
  onError?: (error: any) => void;
  onReset?: () => void;
  onMetadata?: (metadata: {
    apiKeyIndex: number;
    model: string;
    duration: string;
    purpose: string;
  }) => void;
}

export async function streamChatbotResponse(
  prompt: string,
  systemInstruction: string,
  callbacks: StreamCallbacks,
  inlineParts: { mimeType: string; data: string }[] = [],
  signal?: AbortSignal
): Promise<void> {
  const startTime = Date.now();
  const category: TaskCategory = 'main';
  const settings = getApiSettings();
  const purpose = 'Trả lời Chatbot Sandbox';

  // Lấy chuỗi Fallback Model Chain đã được người dùng cấu hình cho 'main'
  const modelChain = getModelChainForTask(category, settings);
  if (!modelChain || modelChain.length === 0) {
    const err = new Error("Không có model nào khả dụng trong chuỗi fallback.");
    callbacks.onError?.(err);
    throw err;
  }

  const isProxy = settings.apiKeySource === 'proxy';
  let primaryApiKey = '';
  if (settings.apiKeySource === 'system') {
    primaryApiKey = process.env.API_KEY || process.env.GEMINI_API_KEY || "system-proxy-key";
  } else if (isProxy) {
    primaryApiKey = settings.proxyKey || 'dummy-key';
  } else {
    primaryApiKey = getCurrentlyUsedApiKeyByCategory(category) || '';
  }

  const allUserKeys = (settings.userApiKeys || []).filter(k => k && k.trim() !== '');
  const validUserKeys = apiKeyManager.filterValidKeys(allUserKeys);

  const contents = [
    {
      role: 'user',
      parts: [
        { text: prompt },
        ...inlineParts.map(p => ({ inlineData: p }))
      ]
    }
  ];

  const keyRotator = createFallbackKeyRotator(settings, primaryApiKey);
  let lastError: any = null;

  // Duyệt tuần tự qua chuỗi Fallback Chain của cốt truyện chính (main) - 1 vòng duy nhất
  for (let i = 0; i < modelChain.length; i++) {
    const currentModel = modelChain[i];
    const keyInfo = keyRotator.getCurrentKey();
    if (!keyInfo) {
      break;
    }
    const { apiKey: currentApiKey, apiKeyLabel } = keyInfo;
    const keyPosition = allUserKeys.indexOf(currentApiKey);
    const enableSearch = isGoogleSearchSupported(currentModel);

    const currentTaskId = apiRunningService.start(
      currentModel, 
      apiKeyLabel, 
      purpose, 
      JSON.stringify({ promptPreview: prompt.slice(0, 120), systemInstruction: !!systemInstruction, search: enableSearch })
    );

    try {
      if (i > 0) {
        callbacks.onReset?.();
      }

      const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`${apiKeyLabel} : ${currentModel} : ${elapsedSec}s : ${purpose} (Search: ${enableSearch}) : /services/chatbotStreamService.ts`);

      const ai = getAiClient(settings, currentApiKey, category);
          
          const baseConfig: any = {
            systemInstruction: systemInstruction || undefined
          };

          if (enableSearch) {
            baseConfig.tools = [{ googleSearch: {} }];
          }

          const config = sanitizeSearchConfig(currentModel, baseConfig);

          // Đưa vào Global API Queue để tránh tắc nghẽn hoặc xung đột traffic
          const resultStream = await globalApiQueue.enqueue(async () => {
            try {
              return await ai.models.generateContentStream({
                model: currentModel,
                contents,
                config,
              });
            } catch (streamErr: any) {
              const errStr = typeof streamErr === 'string' ? streamErr : (streamErr?.message || JSON.stringify(streamErr));
              if (errStr.includes('PROXY_GENERATION_DISABLED') || errStr.includes('streamGenerateContent is not supported')) {
                console.warn('[chatbotStreamService] streamGenerateContent disabled, falling back to generateContent');
                const singleRes = await ai.models.generateContent({
                  model: currentModel,
                  contents,
                  config,
                });
                return (async function* () {
                  yield singleRes;
                })();
              }
              throw streamErr;
            }
          }, 0);

          let fullText = '';
          let rawGroundingMetadata: any = null;

          for await (const chunk of resultStream) {
            if (signal?.aborted) {
              throw new Error('Yêu cầu đã bị hủy bởi người dùng.');
            }
            const chunkText = removeTuongThanTag(chunk.text || '');
            fullText += chunkText;
            if (chunkText) {
              callbacks.onChunk(chunkText);
            }

            const meta = chunk.candidates?.[0]?.groundingMetadata || (chunk as any).groundingMetadata;
            if (meta) {
              if (!rawGroundingMetadata) {
                rawGroundingMetadata = { ...meta };
              } else {
                if (meta.webSearchQueries?.length) {
                  rawGroundingMetadata.webSearchQueries = Array.from(new Set([
                    ...(rawGroundingMetadata.webSearchQueries || []),
                    ...meta.webSearchQueries
                  ]));
                }
                if (meta.groundingChunks?.length) {
                  rawGroundingMetadata.groundingChunks = [
                    ...(rawGroundingMetadata.groundingChunks || []),
                    ...meta.groundingChunks
                  ];
                }
                if (meta.searchEntryPoint) {
                  rawGroundingMetadata.searchEntryPoint = meta.searchEntryPoint;
                }
              }
            }
          }

          if (!rawGroundingMetadata && (resultStream as any).response?.candidates?.[0]?.groundingMetadata) {
            rawGroundingMetadata = (resultStream as any).response.candidates[0].groundingMetadata;
          }

          const cleanFullText = removeTuongThanTag(fullText);
          if (!cleanFullText || cleanFullText.trim() === '') {
            throw new Error('Phản hồi từ AI rỗng sau khi hoàn tất stream.');
          }

          const groundingData = extractGroundingDataFromResponse(rawGroundingMetadata);
          if (groundingData) {
            callbacks.onGrounding?.(groundingData);
          }

          // Thành công: dừng task, cập nhật model thành công
          apiRunningService.stop(currentTaskId, cleanFullText);
          fallbackEventService.stop();
          setLastSuccessfulModel(category, currentModel);

      // Xoay tua key kế tiếp nếu thành công
      keyRotator.onSuccess(currentApiKey);

      const duration = ((Date.now() - startTime) / 1000).toFixed(1) + 's';
      callbacks.onMetadata?.({
        apiKeyIndex: keyPosition !== -1 ? keyPosition + 1 : rotationIndices.main + 1,
        model: currentModel,
        duration,
        purpose
      });

      callbacks.onFullText?.(cleanFullText, groundingData);
      return; // Hoàn tất thành công, thoát toàn bộ hàm!
    } catch (error: any) {
      apiRunningService.stop(currentTaskId, `Lỗi: ${error?.message || error}`);
      console.warn(`[Chatbot Stream Fallback] Model ${currentModel} (${apiKeyLabel}, Search: ${enableSearch}) gặp lỗi:`, error?.message || error);
      lastError = error;

      const errMessage = error?.message || '';
      const is400 = error?.status === 400 || errMessage.includes('400') || errMessage.includes('API_KEY_INVALID') || errMessage.includes('INVALID_ARGUMENT');

      const hasMoreKeys = keyRotator.onError(currentApiKey, is400);
      if (!hasMoreKeys) {
        break;
      }

      // Chuyển sang model tiếp theo và API key tiếp theo
      if (modelChain.length > 1 && i < modelChain.length - 1) {
        if (i === 0) {
          fallbackEventService.start(modelChain.length, currentModel);
        }
        fallbackEventService.nextAttempt(currentModel, modelChain[i + 1], lastError?.message || 'Quá tải hoặc lỗi quota');
      }
    }
  }

  // Nếu duyệt hết chuỗi fallback mà vẫn lỗi, cho phép người dùng chọn model chạy lại
  if (lastError) {
    fallbackEventService.stop();
    console.error('[Chatbot Stream Fallback] Toàn bộ model và key trong fallback chain đều thất bại.', lastError);

    let promptAttempts = 0;
    while (promptAttempts < 2) {
      promptAttempts++;
      const availableList = (settings.availableModels && settings.availableModels.length > 0)
        ? settings.availableModels
        : ['gemini-flash-latest', 'gemini-flash-lite-latest'];

      const parsedErr = parseApiError(lastError, modelChain[modelChain.length - 1] || 'gemini-flash-latest');
      const selectedModel = await fallbackPromptService.requestModelSelection(parsedErr, availableList);

      if (!selectedModel) break;

      console.log(`[Chatbot Stream Fallback Prompt] Người dùng chọn model chạy lại: ${selectedModel}`);
      callbacks.onReset?.();

      const manualApiKey = isProxy ? 'dummy-key' : (getCurrentlyUsedApiKeyByCategory(category) || '');
      const manualAi = getAiClient(settings, manualApiKey, category);
      const manualTaskId = apiRunningService.start(selectedModel, isProxy ? 'Proxy API' : 'Manual Selection', purpose, 'Manual Retry');

      try {
        const resultStream = await globalApiQueue.enqueue(async () => {
          return await manualAi.models.generateContentStream({
            model: selectedModel,
            contents,
            config: {
              systemInstruction: systemInstruction || undefined
            },
          });
        }, 0);

        let fullText = '';
        for await (const chunk of resultStream) {
          const chunkText = removeTuongThanTag(chunk.text || '');
          fullText += chunkText;
          if (chunkText) callbacks.onChunk(chunkText);
        }

        const cleanFullText = removeTuongThanTag(fullText);
        apiRunningService.stop(manualTaskId, cleanFullText);
        lastError = null;
        callbacks.onFullText?.(cleanFullText);
        return;
      } catch (retryErr: any) {
        lastError = retryErr;
        apiRunningService.stop(manualTaskId, `Lỗi thử lại: ${retryErr.message}`);
      }
    }

    callbacks.onError?.(lastError);
    throw lastError;
  }
}
