import { getAiClient } from './aiClient';
import { getApiSettings, getCurrentlyUsedApiKeyByCategory, rotationIndices } from './apiService';
import { constructStandardTurnPromptPayload, parseAiResponseText, getCurrentlyUsedApiKey } from './geminiService';
import { KnowledgeBase, PlayerActionInputType, ResponseLength } from '../types';
import { apiRunningService } from './apiRunningService';
import { fallbackPromptService } from './fallbackPromptService';
import { parseApiError } from '../utils/apiErrorParser';
import { removeTuongThanTag } from '../utils/xmlSanitizerUtils';
import { PrefillPayloadBuilder } from './ai/PrefillPayloadBuilder';
import { getModelChainForTask, setLastSuccessfulModel, createFallbackKeyRotator } from "../utils/modelFallback";
import { apiKeyManager } from "../utils/apiKeyManager";
import { fallbackEventService } from "./fallbackEventService";
import { replaceStoryKeywords } from '../utils/storyKeywordReplacer';
import { applyThinkingConfig } from '../utils/thinkingLevelUtils';

export interface StoryStreamCallbacks {
  onChunk: (chunk: string) => void;
  onMetadata?: (meta: { duration: string; model: string; apiKeyLabel: string; purpose: string }) => void;
  onError?: (err: any) => void;
}

export async function streamNextTurn(
  knowledgeBase: KnowledgeBase, 
  playerAction: string,
  inputType: PlayerActionInputType,
  responseLength: ResponseLength,
  currentPageMessagesLog: string = "",
  previousPageSummaries: string[] = [],
  lastNarrationFromPreviousPage?: string,
  retrievedContext?: string,
  callbacks?: StoryStreamCallbacks,
  onPromptConstructedForLog?: (prompt: string) => void,
  signal?: AbortSignal,
  dynamicContextLayers?: { priority: number; content: string }[],
  onResetStream?: () => void,
  customPromptOverride?: string,
  customModelOverride?: string
): Promise<{response: any, rawText: string}> {
  
  const startTime = Date.now();
  const settings = getApiSettings();
  let apiKey = '';
  let apiKeyLabel = '';
  const purpose = 'Tạo lời kể truyện';
    
  if (settings.apiKeySource === 'system') {
      apiKeyLabel = 'Key Hệ Thống';
      apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY || "system-proxy-key";
  } else if (settings.apiKeySource === 'proxy') {
      apiKeyLabel = 'Proxy API';
      apiKey = settings.proxyKey || 'dummy-key';
  } else {
      apiKey = getCurrentlyUsedApiKeyByCategory('main') || '';
      if (!apiKey) throw new Error("Chưa có API Key hợp lệ.");
      const keys = (settings.userApiKeys || []).filter(k => k && k.trim() !== '');
      const kIdx = keys.indexOf(apiKey);
      apiKeyLabel = kIdx !== -1 ? `API Key #${kIdx + 1}` : 'Key Cá Nhân';
  }

  // Update narrative arc state machine
  if (!knowledgeBase.arcState) {
      knowledgeBase.arcState = { phase: 'cooldown', turnCount: 0, targetEvent: null, questIssued: false, originalTimelineIndex: 0, originalEventResolved: false };
  }
  let arc = knowledgeBase.arcState;
  arc.turnCount += 1;
  if (arc.phase === 'cooldown' && arc.turnCount >= 3) {
      arc.phase = 'buildup';
      arc.turnCount = 1;
      arc.questIssued = false;
  } else if (arc.phase === 'buildup' && arc.turnCount >= 5) {
      arc.phase = 'active';
      arc.turnCount = 1;
  }

  // 1. Giữ nguyên hoàn toàn logic gen Prompt
  const payload = await constructStandardTurnPromptPayload(
    knowledgeBase, playerAction, inputType, responseLength,
    currentPageMessagesLog, previousPageSummaries, lastNarrationFromPreviousPage, retrievedContext,
    onPromptConstructedForLog, dynamicContextLayers
  );

  let finalPromptToSend = customPromptOverride || payload.optimizedPrompt;
  if (payload.systemInstruction) {
    payload.systemInstruction = replaceStoryKeywords(payload.systemInstruction);
  }

  let lastError: any = null;
  let fullText = '';
  const modelChain = getModelChainForTask('main', settings, customModelOverride);
  const keyRotator = createFallbackKeyRotator(settings, apiKey);
  const isProxy = settings.apiKeySource === 'proxy';
  const shouldUsePrefill = !!settings.useAiOath;
  const prefillModelText = PrefillPayloadBuilder.DEFAULT_PREFILL_TEXT;

  for (let i = 0; i < modelChain.length; i++) {
    const currentModel = modelChain[i];
    const keyInfo = keyRotator.getCurrentKey();
    if (!keyInfo) {
      break;
    }
    const { apiKey: apiKeyToUse, apiKeyLabel: apiKeyLabelToUse } = keyInfo;
    
    const ai = getAiClient(settings, apiKeyToUse, 'main');
    const isPrefillEligible = shouldUsePrefill && PrefillPayloadBuilder.isPrefillEligible(currentModel);
    let contents: any[];
    if (isPrefillEligible) {
      contents = PrefillPayloadBuilder.buildContents({
        prompt: finalPromptToSend,
        enablePrefill: true,
        prefillModelText: prefillModelText
      });
      fullText = prefillModelText;
    } else {
      contents = [{ role: 'user', parts: [{ text: finalPromptToSend }] }];
      fullText = '';
    }

    const requestPayloadStr = JSON.stringify(contents, null, 2);
    const currentTaskId = apiRunningService.start(currentModel, apiKeyLabelToUse, purpose, requestPayloadStr);

    try {
      if (onResetStream && i > 0) {
          onResetStream();
      }

        const elapsedSeconds = ((Date.now() - startTime) / 1000).toFixed(1) + 's';
        console.log(`[API CALL INFO] Source: ${settings.apiKeySource} | ${apiKeyLabelToUse} : ${currentModel} : ${elapsedSeconds} : ${purpose} : services/storyStreamService.ts`);

        if (isPrefillEligible) {
          const cleanPrefill = removeTuongThanTag(prefillModelText);
          if (cleanPrefill && callbacks?.onChunk) {
            callbacks.onChunk(cleanPrefill);
          }
        }

        const apiTimeout = (settings.apiTimeout || 60) * 1000;
        let contentTimeoutId: NodeJS.Timeout | null = null;
        const clearContentTimeout = () => {
          if (contentTimeoutId) {
            clearTimeout(contentTimeoutId);
            contentTimeoutId = null;
          }
        };

        const timeoutPromise = new Promise<never>((_, reject) => {
          contentTimeoutId = setTimeout(() => {
            reject(new Error(`Timeout: AI không xuất hiện văn bản cốt truyện (🖋️) sau ${settings.apiTimeout || 60}s. Tự động chuyển sang model tiếp theo.`));
          }, apiTimeout);
        });

        const streamPromise = (async () => {
          let result: any;
          const requestConfig = applyThinkingConfig(
            currentModel,
            payload.systemInstruction ? { systemInstruction: payload.systemInstruction } : {},
            settings
          );
          const hasConfig = Object.keys(requestConfig).length > 0;
          try {
            result = await ai.models.generateContentStream({
              model: currentModel,
              contents,
              config: hasConfig ? requestConfig : undefined,
            });
          } catch (streamErr: any) {
            const errStr = typeof streamErr === 'string' ? streamErr : (streamErr?.message || JSON.stringify(streamErr));
            if (errStr.includes('PROXY_GENERATION_DISABLED') || errStr.includes('streamGenerateContent is not supported')) {
              console.warn('[storyStreamService] streamGenerateContent disabled, falling back to generateContent');
              const singleRes = await ai.models.generateContent({
                model: currentModel,
                contents,
                config: hasConfig ? requestConfig : undefined,
              });
              const text = removeTuongThanTag(singleRes.text || '');
              fullText = isPrefillEligible && !text.includes('<thinking>') ? (prefillModelText + text) : text;
              fullText = removeTuongThanTag(fullText);
              clearContentTimeout();
              if (text && callbacks?.onChunk) {
                callbacks.onChunk(text);
              }
              if (!fullText || fullText.trim() === "") {
                throw new Error("Phản hồi kể truyện từ AI rỗng sau khi làm sạch.");
              }
              if (isFaultyThinkingOnlyResponse(fullText)) {
                throw new Error("Phản hồi AI bị kẹt ở khối suy nghĩ (Thinking-only / Lỗi 429 giả định). Chuyển sang model fallback.");
              }
              return fullText;
            }
            throw streamErr;
          }

          if (!isPrefillEligible) {
            fullText = '';
          } else {
            fullText = prefillModelText;
          }

          const deduplicationState = { buffer: '', hasStripped: false };

          for await (const chunk of result) {
            let chunkText = removeTuongThanTag(chunk.text || '');
            if (isPrefillEligible) {
              chunkText = PrefillPayloadBuilder.processDeduplicationChunk(chunkText, deduplicationState);
            }
            if (chunkText) {
              fullText += chunkText;
              clearContentTimeout();
              callbacks?.onChunk(chunkText);
            }
          }
          
          fullText = removeTuongThanTag(fullText);
          if (!fullText || fullText.trim() === "") {
            throw new Error("Phản hồi kể truyện từ AI rỗng sau khi làm sạch.");
          }
          if (isFaultyThinkingOnlyResponse(fullText)) {
            throw new Error("Phản hồi AI bị kẹt ở khối suy nghĩ (Thinking-only / Lỗi 429 giả định). Chuyển sang model fallback.");
          }
          return fullText;
        })();

        await Promise.race([streamPromise, timeoutPromise]);
        clearContentTimeout();
        apiRunningService.stop(currentTaskId, fullText);
        fallbackEventService.stop();
        setLastSuccessfulModel('main', currentModel);
        keyRotator.onSuccess(apiKeyToUse);
        
        callbacks?.onMetadata?.({
          duration: ((Date.now() - startTime) / 1000).toFixed(1) + 's',
          model: currentModel,
          apiKeyLabel: apiKeyLabelToUse,
          purpose: purpose
        });

        lastError = null;
        break; // Success! Exit modelChain loop

      } catch (error: any) {
        apiRunningService.stop(currentTaskId, `Lỗi: ${error?.message || error}`);
        console.warn(`[Story Stream] Model ${currentModel} (${apiKeyLabelToUse}) failed:`, error.message || error);
        lastError = error;

        if (error.message === "AbortError" || signal?.aborted) {
           break;
        }

        const errorMessage = error?.message || "";
        let errorString = "";
        try { errorString = JSON.stringify(error); } catch (_) {}
        const is400 = error?.status === 400 || errorMessage.includes("400") || errorMessage.includes("API_KEY_INVALID") || errorMessage.includes("INVALID_ARGUMENT");
        const is429 = error?.status === 429 || errorMessage.includes("429") || errorString.includes("429") || errorMessage.includes("RESOURCE_EXHAUSTED") || errorMessage.includes("Too Many Requests");

        const hasMoreKeys = keyRotator.onError(apiKeyToUse, is400);
        if (!hasMoreKeys) {
            break;
        }

        if (modelChain.length > 1 && i < modelChain.length - 1) {
            if (is429) {
                console.warn(`[Story Stream] Throttling 2.5s due to 429 rate limit before next model & key...`);
                await new Promise(resolve => setTimeout(resolve, 2500));
                if (signal?.aborted) {
                    break;
                }
            }
            if (i === 0) {
                fallbackEventService.start(modelChain.length, currentModel);
            }
            fallbackEventService.nextAttempt(currentModel, modelChain[i+1], error.message || "Unknown error");
        }
      }
  }

  // If we reach here and still have an error, all models in the chain failed
  if (lastError && lastError.message !== "AbortError") {
      fallbackEventService.stop();
      console.warn("All models in story stream fallback chain failed:", lastError?.message || lastError);

      let promptAttemptsManual = 0;
      while (promptAttemptsManual < 3) {
          promptAttemptsManual++;
          const availableList = (settings.availableModels && settings.availableModels.length > 0)
              ? settings.availableModels
              : ['gemini-flash-latest', 'gemini-flash-lite-latest', 'gemini-3.6-flash', 'gemini-3.5-flash'];

          const parsedErr = parseApiError(lastError, modelChain[modelChain.length - 1] || modelChain[0]);
          const selectedModel = await fallbackPromptService.requestModelSelection(parsedErr, availableList);

          if (!selectedModel) break;

          console.log(`[Story Stream Fallback Prompt] Người dùng chọn model chạy lại: ${selectedModel}`);
          
          const manualApiKey = isProxy ? 'dummy-key' : (getCurrentlyUsedApiKeyByCategory('main') || '');
          const manualApiKeyLabel = isProxy ? 'Proxy API' : 'Manual Selection';
          const manualAi = getAiClient(settings, manualApiKey, 'main');
          const manualTaskId = apiRunningService.start(selectedModel, manualApiKeyLabel, purpose, "Manual Retry");

          try {
              if (onResetStream) onResetStream();
              
              const isRetryPrefillEligible = shouldUsePrefill && PrefillPayloadBuilder.isPrefillEligible(selectedModel);
              const retryConfig = applyThinkingConfig(
                selectedModel,
                payload.systemInstruction ? { systemInstruction: payload.systemInstruction } : {},
                settings
              );
              const result = await manualAi.models.generateContentStream({
                  model: selectedModel,
                  contents: isRetryPrefillEligible ? PrefillPayloadBuilder.buildContents({ prompt: finalPromptToSend, enablePrefill: true, prefillModelText }) : [{ role: 'user', parts: [{ text: finalPromptToSend }] }],
                  config: Object.keys(retryConfig).length > 0 ? retryConfig : undefined,
              });

              fullText = isRetryPrefillEligible ? prefillModelText : '';
              if (isRetryPrefillEligible) {
                  const cleanPrefill = removeTuongThanTag(prefillModelText);
                  if (cleanPrefill && callbacks?.onChunk) {
                      callbacks.onChunk(cleanPrefill);
                  }
              }
              const retryDeduplicationState = { buffer: '', hasStripped: false };
              for await (const chunk of result) {
                  let chunkText = removeTuongThanTag(chunk.text || '');
                  if (isRetryPrefillEligible) {
                      chunkText = PrefillPayloadBuilder.processDeduplicationChunk(chunkText, retryDeduplicationState);
                  }
                  if (chunkText) {
                      fullText += chunkText;
                      callbacks?.onChunk?.(chunkText);
                  }
              }

              fullText = removeTuongThanTag(fullText);
              apiRunningService.stop(manualTaskId, fullText);
              fallbackEventService.stop();
              lastError = null;
              break;
          } catch (retryErr: any) {
              lastError = retryErr;
              apiRunningService.stop(manualTaskId, `Lỗi thử lại: ${retryErr.message}`);
          }
      }
  }

  if (lastError) {
    callbacks?.onError?.(lastError);
    throw lastError;
  }

  // Handle narrative arc state machine based on response
  if (fullText.includes('[ARC_RESOLVED]')) {
      knowledgeBase.arcState = {
          phase: 'cooldown',
          turnCount: 0,
          targetEvent: null,
          questIssued: false
      };
  } else if (arc.phase === 'buildup' && arc.turnCount === 1) {
      const eventMatch = fullText.match(/\[QUEST_ASSIGNED:\s*([^|\]]+)/);
      if (eventMatch && eventMatch[1]) {
          arc.targetEvent = eventMatch[1].trim();
          arc.questIssued = true;
      }
  } else if (arc.phase === 'active' && arc.turnCount >= 5 && fullText.includes('[COMBAT_END]')) {
      knowledgeBase.arcState = {
          phase: 'cooldown',
          turnCount: 0,
          targetEvent: null,
          questIssued: false
      };
  }

  // 3. Xử lý parse text cuối cùng cho Game Loop
  const parsedResponse = parseAiResponseText(fullText);
  return { response: parsedResponse, rawText: fullText };
}

/**
 * Kiểm tra xem phản hồi có phải là response lỗi chỉ có thinking header / bị treo (ví dụ chỉ có <thinking>[], [1] SYSTEM INIT & SYNC...)
 * và hoàn toàn không có phần narration hoặc content thực sự không.
 */
export const isFaultyThinkingOnlyResponse = (text: string): boolean => {
  if (!text) return false;
  const trimmed = text.trim();
  const hasThinking = trimmed.includes('<thinking>') || trimmed.includes('[1] SYSTEM INIT & SYNC');
  const hasContentTag = trimmed.includes('<content>') || trimmed.includes('</content>');
  
  const nonThinkingPart = trimmed
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
    .replace(/<\/?thinking>/gi, '')
    .replace(/\[\d+\][\s\S]*?(?=\[|$)/g, '')
    .trim();

  const isOnlyThinking = hasThinking && (!hasContentTag || nonThinkingPart.length < 30 || (trimmed.startsWith('<thinking>') && !trimmed.includes('</content>') && (trimmed.includes('[1] SYSTEM INIT & SYNC') || trimmed.includes('[]'))));
  return isOnlyThinking;
};

/**
 * Kiểm tra xem phản hồi thô có bị đứt đoạn hay không.
 * Tiêu chuẩn: Kiểm tra sự tồn tại của thẻ đóng </content>.
 * Nếu không có </content> (kể cả trường hợp có mở <content> mà chưa đóng,
 * hoặc trường hợp AI quên không xuất <content> từ đầu) -> coi là đứt đoạn.
 */
export const isNarrationTextIncomplete = (rawText: string): boolean => {
  if (!rawText || rawText.trim().length === 0) return true;
  return !rawText.includes('</content>');
};

/**
 * Gọi thêm một lượt API bù đắp để AI viết tiếp cho trọn vẹn lời kể bị đứt đoạn.
 */
export async function streamNarrationContinuation(
  currentPartialText: string,
  callbacks?: StoryStreamCallbacks,
  signal?: AbortSignal,
  customModelOverride?: string,
  turnContextParams?: {
    knowledgeBase?: KnowledgeBase;
    playerAction?: string;
    inputType?: PlayerActionInputType;
    responseLength?: ResponseLength;
    currentPageMessagesLog?: string;
    previousPageSummaries?: string[];
    lastNarrationFromPreviousPage?: string;
    retrievedContext?: string;
    dynamicContextLayers?: { priority: number; content: string }[];
  }
): Promise<{ text: string }> {
  const settings = getApiSettings();
  let apiKey = '';
  let apiKeyLabel = '';
  const purpose = 'Bù đắp lời kể bị đứt đoạn';

  if (settings.apiKeySource === 'system') {
    apiKeyLabel = 'Key Hệ Thống';
    apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY || "system-proxy-key";
  } else if (settings.apiKeySource === 'proxy') {
    apiKeyLabel = 'Proxy API';
    apiKey = settings.proxyKey || 'dummy-key';
  } else {
    apiKey = getCurrentlyUsedApiKeyByCategory('main') || '';
    if (!apiKey) throw new Error("Chưa có API Key hợp lệ để bù đắp lời kể.");
    const keys = (settings.userApiKeys || []).filter(k => k && k.trim() !== '');
    const kIdx = keys.indexOf(apiKey);
    apiKeyLabel = kIdx !== -1 ? `API Key #${kIdx + 1}` : 'Key Cá Nhân';
  }

  // Lấy đoạn đuôi tối đa 2500 ký tự để làm mốc tiếp nối
  const tailLength = Math.min(currentPartialText.length, 2500);
  const tailSnippet = currentPartialText.slice(-tailLength);

  const continuationNotice = `

[THÔNG BÁO TỰ ĐỘNG TỪ HỆ THỐNG - SỰ CỐ ĐỨT ĐOẠN PHẢN HỒI]:
Bạn đã gặp vấn đề không mong muốn nên bị đứt đoạn nội dung giữa chừng. 
Dưới đây là TOÀN BỘ NỘI DUNG BẠN ĐÃ VIẾT DỞ TRONG LƯỢT NÀY:
"""
...${tailSnippet}
"""

NHIỆM VỤ TIẾP NỐI BẮT BUỘC:
1. Hãy VIẾT TIẾP NỐI NGAY TỪ CÂU CUỐI CÙNG của nội dung đã viết ở trên cho đủ và trọn vẹn mạch truyện.
2. TUYỆT ĐỐI KHÔNG lặp lại bất kỳ câu chữ nào đã xuất hiện ở đoạn trên.
3. KHÔNG mở lại thẻ <thinking> hay thẻ <content> nữa. Tiếp tục văn cảnh lời kể ngay lập tức.
4. KHI HOÀN THÀNH LỜI KỂ, BẮT BUỘC PHẢI XUẤT THẺ ĐÓNG </content>.
5. Ngay sau thẻ đóng </content>, xuất tiếp khối thẻ <update_data>...</update_data> và các lựa chọn <choice>...</choice> theo đúng cấu trúc tiêu chuẩn.`;

  let finalPromptToSend = `[YÊU CẦU TIẾP TỤC HOÀN THÀNH LỜI KỂ]${continuationNotice}`;
  let systemInstruction: string | undefined = undefined;

  if (turnContextParams?.knowledgeBase) {
    const combinedAction = `${turnContextParams.playerAction || ""}${continuationNotice}`;
    const payload = await constructStandardTurnPromptPayload(
      turnContextParams.knowledgeBase,
      combinedAction,
      turnContextParams.inputType || 'action',
      turnContextParams.responseLength || 'short',
      turnContextParams.currentPageMessagesLog || "",
      turnContextParams.previousPageSummaries || [],
      turnContextParams.lastNarrationFromPreviousPage,
      turnContextParams.retrievedContext,
      undefined,
      turnContextParams.dynamicContextLayers
    );
    finalPromptToSend = payload.optimizedPrompt;
    if (payload.systemInstruction) {
      systemInstruction = replaceStoryKeywords(payload.systemInstruction);
    }
  }

  const modelChain = getModelChainForTask('main', settings, customModelOverride);
  const keyRotator = createFallbackKeyRotator(settings, apiKey);
  let continuationText = '';
  let lastError: any = null;

  for (let i = 0; i < modelChain.length; i++) {
    const currentModel = modelChain[i];
    const keyInfo = keyRotator.getCurrentKey();
    if (!keyInfo) {
      break;
    }
    const { apiKey: keyToUse, apiKeyLabel: activeKeyLabel } = keyInfo;
    const ai = getAiClient(settings, keyToUse, 'main');
    const contents = [{ role: 'user', parts: [{ text: finalPromptToSend }] }];
    const continuationConfig = applyThinkingConfig(
      currentModel,
      systemInstruction ? { systemInstruction } : {},
      settings
    );
    const config = Object.keys(continuationConfig).length > 0 ? continuationConfig : undefined;
    const taskId = apiRunningService.start(currentModel, activeKeyLabel, purpose, finalPromptToSend);

    try {
      let result: any;
      try {
        result = await ai.models.generateContentStream({
          model: currentModel,
          contents,
          config,
        });
      } catch (streamErr: any) {
        const errStr = typeof streamErr === 'string' ? streamErr : (streamErr?.message || JSON.stringify(streamErr));
        if (errStr.includes('PROXY_GENERATION_DISABLED') || errStr.includes('streamGenerateContent is not supported')) {
          const singleRes = await ai.models.generateContent({
            model: currentModel,
            contents,
            config,
          });
          const text = removeTuongThanTag(singleRes.text || '');
          continuationText = text;
          if (text && callbacks?.onChunk) {
            callbacks.onChunk(text);
          }
          apiRunningService.stop(taskId, continuationText);
          keyRotator.onSuccess(keyToUse);
          return { text: continuationText };
        }
        throw streamErr;
      }

      continuationText = '';
      for await (const chunk of result) {
        const chunkText = removeTuongThanTag(chunk.text || '');
        if (chunkText) {
          continuationText += chunkText;
          callbacks?.onChunk?.(chunkText);
        }
      }
      continuationText = removeTuongThanTag(continuationText);
      apiRunningService.stop(taskId, continuationText);
      keyRotator.onSuccess(keyToUse);
      return { text: continuationText };
    } catch (err: any) {
      lastError = err;
      apiRunningService.stop(taskId, `Lỗi: ${err?.message || err}`);
      console.warn(`[Story Continuation] Model ${currentModel} (${activeKeyLabel}) failed:`, err.message || err);
      if (err.message === "AbortError" || signal?.aborted) {
        throw err;
      }
      const errMsg = err?.message || '';
      const is400 = err?.status === 400 || errMsg.includes('400') || errMsg.includes('API_KEY_INVALID') || errMsg.includes('INVALID_ARGUMENT');
      const hasMoreKeys = keyRotator.onError(keyToUse, is400);
      if (!hasMoreKeys) {
        break;
      }
    }
  }

  if (lastError) {
    callbacks?.onError?.(lastError);
    throw lastError;
  }

  return { text: continuationText };
}

