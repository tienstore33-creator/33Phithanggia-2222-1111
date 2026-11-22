import { GoogleGenAI } from "@google/genai";
import { WorldSettings, ParsedAiResponse } from '../types';
import { PROMPT_FUNCTIONS } from '../prompts';
import { 
  getTonePrompt, 
  getEnforcedSystemInstruction, 
  parseAiResponseText, 
  getApiSettings, 
  rotationIndices 
} from './geminiService';
import { getCurrentlyUsedApiKeyByCategory } from './apiService';
import { SystemRegexService } from './SystemRegexService';
import { getAiClient } from './aiClient';
import { getModelChainForTask, TaskCategory, setLastSuccessfulModel, createFallbackKeyRotator } from '../utils/modelFallback';
import { apiKeyManager } from '../utils/apiKeyManager';
import { apiRunningService } from './apiRunningService';
import { fallbackEventService } from './fallbackEventService';
import { fallbackPromptService } from './fallbackPromptService';
import { parseApiError } from '../utils/apiErrorParser';
import { sanitizeSearchConfig, isGoogleSearchSupported } from '../utils/searchGuard';
import { globalApiQueue } from './ai/globalApiQueue';
import { removeTuongThanTag } from '../utils/xmlSanitizerUtils';
import { PrefillPayloadBuilder } from './ai/PrefillPayloadBuilder';

/**
 * Service xử lý lượt kể chuyện mở đầu (Lượt 0 - Initial Turn)
 * Áp dụng chuẩn @google/genai TypeScript SDK mới nhất, Dual-Stage Google Search và Hàng đợi GlobalApiQueue.
 */
export async function generateInitialStoryStream(
  worldConfig: WorldSettings,
  onPromptLog?: (p: string) => void,
  onChunk?: (text: string) => void,
  signal?: AbortSignal,
  onResetStream?: () => void
): Promise<{ response: ParsedAiResponse; rawText: string }> {
  const startTime = Date.now();
  const category: TaskCategory = 'main';
  const settings = getApiSettings();
  const purpose = 'Khởi tạo lời kể mở đầu (Lượt 0)';

  const { perspectiveMode, model, useDeepReasoning, slowThinking, useExclusiveAccessoryPrompt, isSuperManualMode } = settings;
  const prompt = PROMPT_FUNCTIONS.initial(worldConfig, perspectiveMode, useExclusiveAccessoryPrompt, isSuperManualMode) + getTonePrompt(worldConfig.storyTone || "");
  const systemInstruction = getEnforcedSystemInstruction(false, 1100, 1500, false, { worldConfig } as any, undefined, useDeepReasoning, slowThinking);

  if (onPromptLog) {
    onPromptLog(prompt);
  }

  const optimizedPrompt = SystemRegexService.processSystemPrompt(prompt);
  const useGoogleSearch = worldConfig?.useRemoteCanon ? false : true;

  // Lấy chuỗi Fallback Model Chain cho 'main'
  const modelChain = getModelChainForTask(category, settings, model);
  if (!modelChain || modelChain.length === 0) {
    throw new Error("Không có model nào khả dụng trong chuỗi fallback cho lượt khởi đầu.");
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

  const keyRotator = createFallbackKeyRotator(settings, primaryApiKey);
  let lastError: any = null;
  let successfulModel = '';
  let finalRawText = '';

  for (let i = 0; i < modelChain.length; i++) {
    const currentModel = modelChain[i];
    const keyInfo = keyRotator.getCurrentKey();
    if (!keyInfo) {
      break;
    }
    const { apiKey: currentApiKey, apiKeyLabel } = keyInfo;
    const enableSearch = useGoogleSearch && isGoogleSearchSupported(currentModel);

    const contents = PrefillPayloadBuilder.buildContents({
      prompt: optimizedPrompt,
      enablePrefill: !!settings.useAiOath && PrefillPayloadBuilder.isPrefillEligible(currentModel),
      prefillModelText: PrefillPayloadBuilder.DEFAULT_PREFILL_TEXT
    });

    const currentTaskId = apiRunningService.start(
      currentModel,
      apiKeyLabel,
      purpose,
      JSON.stringify({ promptPreview: optimizedPrompt.slice(0, 120), systemInstruction: !!systemInstruction, search: enableSearch })
    );

    try {
      if (i > 0) {
        onResetStream?.();
      }

      const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`${apiKeyLabel} : ${currentModel} : ${elapsedSec}s : ${purpose} (Search: ${enableSearch}) : /services/initialStoryStreamService.ts`);

      const ai = getAiClient(settings, currentApiKey, category);
          const baseConfig: any = {
            systemInstruction: systemInstruction || undefined
          };

          if (enableSearch) {
            baseConfig.tools = [{ googleSearch: {} }];
          }

          const isFlashLite = currentModel.includes('flash-lite');
          if (!isFlashLite && settings.thinkingBudget !== undefined && settings.thinkingBudget > 0 && (currentModel.includes('gemini-3') || currentModel.includes('gemini-2.5') || currentModel.includes('gemini-flash-latest') || currentModel.includes('gemini-pro-latest'))) {
            baseConfig.thinkingConfig = { thinkingBudget: settings.thinkingBudget };
          }

          const config = sanitizeSearchConfig(currentModel, baseConfig);

          // Đưa vào Global API Queue để điều tiết lưu lượng
          const resultStream = await globalApiQueue.enqueue(async () => {
            try {
              return await ai.models.generateContentStream({
                model: currentModel,
                contents,
                config
              });
            } catch (streamErr: any) {
              const errStr = typeof streamErr === 'string' ? streamErr : (streamErr?.message || JSON.stringify(streamErr));
              if (errStr.includes('PROXY_GENERATION_DISABLED') || errStr.includes('streamGenerateContent is not supported')) {
                console.warn('[initialStoryStreamService] streamGenerateContent disabled, falling back to generateContent');
                const singleRes = await ai.models.generateContent({
                  model: currentModel,
                  contents,
                  config
                });
                return (async function* () {
                  yield singleRes;
                })();
              }
              throw streamErr;
            }
          }, 0);

          let fullText = '';
          for await (const chunk of resultStream) {
            if (signal?.aborted) {
              throw new Error('Yêu cầu tạo lượt mở đầu đã bị hủy.');
            }
            const chunkText = removeTuongThanTag(chunk.text || '');
            fullText += chunkText;
            if (chunkText && onChunk) {
              onChunk(chunkText);
            }
          }

          const cleanFullText = removeTuongThanTag(fullText);
          if (!cleanFullText || cleanFullText.trim() === '') {
            throw new Error('Phản hồi từ AI rỗng sau khi hoàn tất stream lượt mở đầu.');
          }

          apiRunningService.stop(currentTaskId, cleanFullText);
          fallbackEventService.stop();
          setLastSuccessfulModel(category, currentModel);

      keyRotator.onSuccess(currentApiKey);

      successfulModel = currentModel;
      finalRawText = cleanFullText;
      break; // Thành công, thoát vòng lặp modelChain
    } catch (error: any) {
      apiRunningService.stop(currentTaskId, `Lỗi: ${error?.message || error}`);
      console.warn(`[Initial Turn Stream Fallback] Model ${currentModel} (${apiKeyLabel}, Search: ${enableSearch}) gặp lỗi:`, error?.message || error);
      lastError = error;

      const errMessage = error?.message || '';
      const is400 = error?.status === 400 || errMessage.includes('400') || errMessage.includes('API_KEY_INVALID') || errMessage.includes('INVALID_ARGUMENT');

      const hasMoreKeys = keyRotator.onError(currentApiKey, is400);
      if (!hasMoreKeys) {
        break;
      }

      if (modelChain.length > 1 && i < modelChain.length - 1) {
        if (i === 0) {
          fallbackEventService.start(modelChain.length, currentModel);
        }
        fallbackEventService.nextAttempt(currentModel, modelChain[i + 1], lastError?.message || 'Quá tải hoặc lỗi quota');
      }
    }
  }

  // Nếu duyệt hết chain mà vẫn lỗi, cho phép chọn model chạy lại
  if (!finalRawText && lastError) {
    fallbackEventService.stop();
    console.error('[Initial Turn Stream Fallback] Toàn bộ model và key trong fallback chain đều thất bại.', lastError);

    let promptAttempts = 0;
    while (promptAttempts < 2) {
      promptAttempts++;
      const availableList = (settings.availableModels && settings.availableModels.length > 0)
        ? settings.availableModels
        : ['gemini-flash-latest', 'gemini-flash-lite-latest'];

      const parsedErr = parseApiError(lastError, modelChain[modelChain.length - 1] || 'gemini-flash-latest');
      const selectedModel = await fallbackPromptService.requestModelSelection(parsedErr, availableList);

      if (!selectedModel) break;

      onResetStream?.();
      const manualApiKey = isProxy ? 'dummy-key' : (getCurrentlyUsedApiKeyByCategory(category) || '');
      const manualAi = getAiClient(settings, manualApiKey, category);
      const manualTaskId = apiRunningService.start(selectedModel, isProxy ? 'Proxy API' : 'Manual Selection', purpose, 'Manual Retry');

      try {
        const contents = PrefillPayloadBuilder.buildContents({
          prompt: optimizedPrompt,
          enablePrefill: !!settings.useAiOath && PrefillPayloadBuilder.isPrefillEligible(selectedModel),
          prefillModelText: PrefillPayloadBuilder.DEFAULT_PREFILL_TEXT
        });

        const resultStream = await globalApiQueue.enqueue(async () => {
          return await manualAi.models.generateContentStream({
            model: selectedModel,
            contents,
            config: {
              systemInstruction: systemInstruction || undefined
            }
          });
        }, 0);

        let fullText = '';
        for await (const chunk of resultStream) {
          const chunkText = removeTuongThanTag(chunk.text || '');
          fullText += chunkText;
          if (chunkText && onChunk) onChunk(chunkText);
        }

        const cleanFullText = removeTuongThanTag(fullText);
        apiRunningService.stop(manualTaskId, cleanFullText);
        successfulModel = selectedModel;
        finalRawText = cleanFullText;
        lastError = null;
        break;
      } catch (retryErr: any) {
        lastError = retryErr;
        apiRunningService.stop(manualTaskId, `Lỗi thử lại: ${retryErr.message}`);
      }
    }

    if (!finalRawText) {
      throw lastError;
    }
  }

  const parsedResponse = parseAiResponseText(finalRawText);
  const sanitizedNarration = SystemRegexService.sanitizeAiResponse(parsedResponse.narration);
  return {
    response: { ...parsedResponse, narration: sanitizedNarration, modelUsed: successfulModel },
    rawText: finalRawText
  };
}
