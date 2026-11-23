import { GoogleGenAI } from "@google/genai";
import { getCurrentlyUsedApiKey, getApiSettings } from "./geminiService";
import { rotationIndices } from "./apiService";
import { DEFAULT_SAFETY_SETTINGS } from "../constants";
import { getModelChainForTask, TaskCategory, setLastSuccessfulModel, createFallbackKeyRotator } from "../utils/modelFallback";
import { getAiClient } from "./aiClient";
import { apiRunningService } from "./apiRunningService";
import { fallbackEventService } from "./fallbackEventService";
import { apiKeyManager } from "../utils/apiKeyManager";
import { fallbackPromptService } from "./fallbackPromptService";
import { parseApiError } from "../utils/apiErrorParser";
import { globalApiQueue } from "./ai/globalApiQueue";
import { PrefillPayloadBuilder } from "./ai/PrefillPayloadBuilder";
import { removeTuongThanTag } from "../utils/xmlSanitizerUtils";
import { applyThinkingConfig } from "../utils/thinkingLevelUtils";

export async function generateGameResponseStream(
  prompt: string,
  modelName: string,
  onChunk: (text: string) => void,
  signal?: AbortSignal,
  onModelUsed?: (model: string) => void,
  systemInstruction?: string,
  useGoogleSearch?: boolean,
  category: TaskCategory = 'main',
  onResetStream?: () => void,
  responseMimeType?: string,
  purpose: string = "Tạo lời kể truyện",
  enablePrefill: boolean = true,
  prefillModelText: string = PrefillPayloadBuilder.DEFAULT_PREFILL_TEXT
): Promise<string> {
  const settings = getApiSettings();
  let apiKey = '';
  let apiKeyLabel = '';
  
  if (settings.apiKeySource === 'system') {
      apiKeyLabel = 'Key Hệ Thống';
      apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY || "system-proxy-key";
  } else if (settings.apiKeySource === 'proxy') {
      apiKeyLabel = 'Proxy API';
      apiKey = settings.proxyKey || 'dummy-key';
  } else {
      apiKey = getCurrentlyUsedApiKey() || '';
      if (!apiKey) {
        throw new Error("API key is missing.");
      }
      const keys = (settings.userApiKeys || []).filter(k => k && k.trim() !== '');
      const kIdx = keys.indexOf(apiKey);
      apiKeyLabel = kIdx !== -1 ? `API Key #${kIdx + 1}` : 'Key Cá Nhân';
  }

  const modelChain = getModelChainForTask(category, settings, modelName);
  const keyRotator = createFallbackKeyRotator(settings, apiKey);
  let lastError: any = null;

  for (let i = 0; i < modelChain.length; i++) {
    let currentModel = modelChain[i];

    // Lớp bảo vệ 1 (PRE-CHECK): Chặn các model đòi Interactions API ngay từ đầu
    const interactionsOnlyModels = [
      "deep-research-pro-preview-12-2025",
      "deep-research-max-preview-04-2026",
      "deep-research-preview-04-2026",
      "antigravity-preview-05-2026",
      "gemini-omni-flash-preview"
    ];

    if (interactionsOnlyModels.includes(currentModel)) {
        console.warn(`Model ${currentModel} yêu cầu Interactions API. Hệ thống hiện chưa hỗ trợ endpoint này, tự động fallback về gemini-3.5-flash.`);
        currentModel = "gemini-3.5-flash";
        modelChain[i] = currentModel;
    }

    const keyInfo = keyRotator.getCurrentKey();
    if (!keyInfo) {
        break;
    }
    const { apiKey: activeKey, apiKeyLabel: activeKeyLabel } = keyInfo;
    let currentTaskId: string = '';

    try {
      const ai = getAiClient(settings, activeKey);

      const config: any = {
          safetySettings: settings.safetySettings || DEFAULT_SAFETY_SETTINGS,
      };

      if (settings.temperature !== undefined) config.temperature = settings.temperature;
      if (settings.maxOutputTokens !== undefined) config.maxOutputTokens = settings.maxOutputTokens;
      if (settings.topK !== undefined) config.topK = settings.topK;
      if (settings.topP !== undefined) config.topP = settings.topP;
      
      if (systemInstruction) {
          config.systemInstruction = systemInstruction;
      }

      const updatedConfig = applyThinkingConfig(currentModel, config, settings);
      Object.keys(config).forEach(k => delete config[k]);
      Object.assign(config, updatedConfig);

      if (useGoogleSearch) {
          config.tools = [{ googleSearch: {} }];
      } else {
          // Function calling isn't fully implemented here for streaming yet, but we allow tools
          config.tools = []; 
      }
      config.toolConfig = { includeServerSideToolInvocations: true };

      if (responseMimeType) {
          config.responseMimeType = responseMimeType;
      }
      
      // Xây dựng contents sử dụng PrefillPayloadBuilder
      const shouldUsePrefill = !!settings.useAiOath && enablePrefill && PrefillPayloadBuilder.isPrefillEligible(currentModel, responseMimeType);
      const finalPrefillText = prefillModelText;
      const contents = PrefillPayloadBuilder.buildContents({
          prompt,
          enablePrefill: shouldUsePrefill,
          enableUserAnchor: !!settings.useAiOath && enablePrefill,
          modelName: currentModel,
          responseMimeType,
          prefillModelText: finalPrefillText
      });

      const requestPayloadStr = JSON.stringify(contents, null, 2);
      currentTaskId = apiRunningService.start(currentModel, activeKeyLabel, purpose, requestPayloadStr);

      const responseStreamPromise = globalApiQueue.enqueue(async () => {
        try {
          return await ai.models.generateContentStream({
            model: currentModel,
            contents: contents,
            config: config
          });
        } catch (streamErr: any) {
          const errStr = typeof streamErr === 'string' ? streamErr : (streamErr?.message || JSON.stringify(streamErr));
          if (errStr.includes('PROXY_GENERATION_DISABLED') || errStr.includes('streamGenerateContent is not supported')) {
            console.warn('[geminiStreamService] streamGenerateContent disabled, falling back to generateContent');
            const singleRes = await ai.models.generateContent({
              model: currentModel,
              contents: contents,
              config: config
            });
            return (async function* () {
              yield singleRes;
            })();
          }
          throw streamErr;
        }
      }, 0); // Priority 0 - Cao nhất cho tương tác cốt truyện chính

      // Use apiTimeout from settings or default to 60s
      const apiTimeout = (getApiSettings().apiTimeout || 60) * 1000;
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error(`Timeout: Không nhận được phản hồi từ AI sau ${getApiSettings().apiTimeout || 60}s. Vui lòng thử lại hoặc đổi Model.`)), apiTimeout)
      );

      const responseStream = await Promise.race([responseStreamPromise, timeoutPromise]);

      return await new Promise((resolve, reject) => {
        let isSettled = false;
        let streamTimeoutId: NodeJS.Timeout | null = null;
        let contentTimeoutId: NodeJS.Timeout | null = null;

        const clearStreamTimeout = () => {
          if (streamTimeoutId) {
            clearTimeout(streamTimeoutId);
            streamTimeoutId = null;
          }
        };

        const clearContentTimeout = () => {
          if (contentTimeoutId) {
            clearTimeout(contentTimeoutId);
            contentTimeoutId = null;
          }
        };

        const safeResolve = (value: string) => {
          if (isSettled) return;
          isSettled = true;
          clearStreamTimeout();
          clearContentTimeout();
          if (signal) {
            signal.removeEventListener('abort', onAbort);
          }
          resolve(value);
        };

        const safeReject = (reason: any) => {
          if (isSettled) return;
          isSettled = true;
          clearStreamTimeout();
          clearContentTimeout();
          if (signal) {
            signal.removeEventListener('abort', onAbort);
          }
          reject(reason);
        };

        const resetStreamTimeout = (isFirstChunk = false) => {
          if (streamTimeoutId) clearTimeout(streamTimeoutId);
          // Cho phép thời gian chờ chunk đầu tiên dài hơn (45s hoặc apiTimeout) để hỗ trợ các model có thinking budget
          const timeoutMs = isFirstChunk ? Math.max(45000, apiTimeout) : 25000;
          streamTimeoutId = setTimeout(() => {
            console.warn(`[Stream Timeout] No chunk received for ${timeoutMs / 1000}s. Aborting stream of ${currentModel}...`);
            safeReject(new Error(`Timeout: Luồng stream từ AI bị treo quá ${timeoutMs / 1000}s không có dữ liệu mới.`));
          }, timeoutMs);
        };

        const startContentTimeout = () => {
          if (contentTimeoutId) clearTimeout(contentTimeoutId);
          contentTimeoutId = setTimeout(() => {
            console.warn(`[Content Timeout] AI không xuất hiện văn bản cốt truyện (🖋️) sau ${getApiSettings().apiTimeout || 60}s. Aborting stream of ${currentModel}...`);
            safeReject(new Error(`Timeout: AI không xuất hiện văn bản cốt truyện (🖋️) sau ${getApiSettings().apiTimeout || 60}s (quá thời gian suy nghĩ). Tự động chuyển sang model tiếp theo.`));
          }, apiTimeout);
        };

        if (signal?.aborted) {
          apiRunningService.stop(currentTaskId);
          fallbackEventService.stop();
          return safeReject(new Error("AbortError"));
        }

        const onAbort = () => {
          apiRunningService.stop(currentTaskId);
          fallbackEventService.stop();
          safeReject(new Error("AbortError"));
        };

        if (signal) {
          signal.addEventListener('abort', onAbort);
        }

        resetStreamTimeout(true); // Start initial stream response timeout (long timeout for thinking phase)
        startContentTimeout(); // Bắt đầu đếm ngược thời gian chờ xuất hiện chữ/cốt truyện (🖋️)

        (async () => {
          let fullText = (shouldUsePrefill && finalPrefillText) ? finalPrefillText : "";
          let startedThinking = (shouldUsePrefill && finalPrefillText && (finalPrefillText.includes('<thinking>') || finalPrefillText.includes('<think>'))) ? true : false;
          let endedThinking = false;
          const deduplicationState = { buffer: '', hasStripped: false };

          // Nếu có prefill, gửi trước chunk prefill đã làm sạch cho người nhận để đồng bộ UI
          if (shouldUsePrefill && finalPrefillText && onChunk) {
              const cleanPrefill = removeTuongThanTag(finalPrefillText);
              if (cleanPrefill) {
                  onChunk(cleanPrefill);
              }
          }

          try {
            let firstChunkReceived = false;
            for await (const chunk of responseStream) {
              if (signal?.aborted) {
                throw new Error("AbortError");
              }
              if (isSettled) {
                break;
              }
              resetStreamTimeout(false); // Reset timer on receiving each subsequent chunk

              if (!firstChunkReceived) {
                  firstChunkReceived = true;
                  if (onModelUsed) onModelUsed(currentModel);
              }

              let chunkThought = "";
              let chunkText = "";
              const parts = chunk.candidates?.[0]?.content?.parts || [];

              for (const p of parts as any[]) {
                  if (p.thought === true && p.text) {
                      chunkThought += p.text;
                  } else if (p.text) {
                      chunkText += p.text;
                  }
              }
              
              if (parts.length === 0) {
                  try {
                      const t = chunk.text;
                      if (t) {
                          chunkText = t;
                      }
                  } catch (e) {
                      // Safe ignore if text getter fails on empty/non-text chunks
                  }
              }

              let currentTextToSend = "";
              if (chunkThought) {
                  if (!startedThinking) {
                      startedThinking = true;
                      currentTextToSend += "<thinking>\n";
                  }
                  currentTextToSend += removeTuongThanTag(chunkThought);
              }

              if (chunkText) {
                  // If we were receiving native thought, and now we receive text, close it!
                  if (startedThinking && !endedThinking) {
                      endedThinking = true;
                      currentTextToSend += "\n</thinking>\n\n";
                  }
                  let cleaned = removeTuongThanTag(chunkText);
                  if (shouldUsePrefill) {
                      cleaned = PrefillPayloadBuilder.processDeduplicationChunk(cleaned, deduplicationState);
                  }
                  currentTextToSend += cleaned;
                  // Đã nhận được văn bản cốt truyện thực tế (🖋️) -> Hủy bộ đếm timeout chờ xuất chữ
                  clearContentTimeout();
              }

              if (currentTextToSend) {
                  fullText += currentTextToSend;
                  onChunk(currentTextToSend);
              }
            }

            if (isSettled) return;

            if (startedThinking && !endedThinking) {
                endedThinking = true;
                const closure = "\n</thinking>\n\n";
                fullText += closure;
                onChunk(closure);
            }

            // Cơ chế cơ học loại bỏ thẻ <tuong_than>
            let finalText = removeTuongThanTag(fullText);

            if (!finalText || finalText.trim() === "") {
               throw new Error("Phản hồi từ AI rỗng sau khi làm sạch.");
            }

            // Success! Stop both UI elements
            apiRunningService.stop(currentTaskId, finalText);
            fallbackEventService.stop();
            if (category) {
              setLastSuccessfulModel(category, currentModel);
            }
            keyRotator.onSuccess(activeKey);

            safeResolve(finalText);
          } catch (error: any) {
            // Error occurred during streaming
            apiRunningService.stop(currentTaskId, `Lỗi: ${error?.message || error}`);
            safeReject(error);
          }
        })();
      });
    } catch (error: any) {
        // Stop the small toast for this failed attempt
        apiRunningService.stop(currentTaskId, `Lỗi: ${error?.message || error}`);
        console.warn(`[Stream Fallback] Model ${currentModel} (${activeKeyLabel}) failed:`, error.message || error);
        lastError = error;
        
        // If it's an AbortError, don't fallback, just throw
        if (error.message === "AbortError" || signal?.aborted) {
            fallbackEventService.stop();
            throw error;
        }

        const errorMessage = error?.message || "";
        let errorString = "";
        try { errorString = JSON.stringify(error); } catch (_) {}
        const is400 = error?.status === 400 || errorMessage.includes("400") || errorMessage.includes("API_KEY_INVALID") || errorMessage.includes("INVALID_ARGUMENT");
        const is429 = error?.status === 429 || errorMessage.includes("429") || errorString.includes("429") || errorMessage.includes("RESOURCE_EXHAUSTED") || errorMessage.includes("Too Many Requests");

        const hasMoreKeys = keyRotator.onError(activeKey, is400);
        if (!hasMoreKeys) {
            break;
        }

        // Chuyển sang Model tiếp theo & API Key tiếp theo
        if (modelChain.length > 1 && i < modelChain.length - 1) {
            if (is429) {
                console.warn(`[Stream Fallback] Throttling 2.5s due to 429 rate limit before next model & key...`);
                await new Promise(resolve => setTimeout(resolve, 2500));
                if (signal?.aborted) {
                    fallbackEventService.stop();
                    throw new Error("AbortError");
                }
            }
            if (i === 0) {
                fallbackEventService.start(modelChain.length, currentModel);
            }
            fallbackEventService.nextAttempt(currentModel, modelChain[i + 1], error.message || "Unknown error");
            if (onResetStream) onResetStream();
        }
    }
  }

  apiRunningService.stop();
  fallbackEventService.stop();
  if (lastError && lastError.message !== "AbortError") {
      console.warn("All models in stream fallback chain failed:", lastError?.message || lastError);
  }

  // KHI FALLBACK TRỐNG/TẮT HOẶC TẤT CẢ MODEL ĐỀU LỖI -> HIỆN MODAL YÊU CẦU CHỌN MODEL CHẠY TIẾP
  if (lastError && lastError.message !== "AbortError") {
      let currentPromptModel = modelChain[modelChain.length - 1] || modelName;
      let promptAttempts = 0;

      while (promptAttempts < 3) {
          promptAttempts++;
          const availableList = (settings.availableModels && settings.availableModels.length > 0)
              ? settings.availableModels
              : ['gemini-flash-latest', 'gemini-flash-lite-latest', 'gemini-3.6-flash', 'gemini-3.5-flash'];

          const parsedErr = parseApiError(lastError, currentPromptModel);
          const selectedModel = await fallbackPromptService.requestModelSelection(
              parsedErr,
              availableList
          );

          if (!selectedModel) {
              // Người dùng chọn Hủy ("Không") -> Hủy bỏ cuộc gọi API
              break;
          }

          console.log(`[Stream Fallback Prompt] Người dùng chọn model chạy lại: ${selectedModel}`);
          currentPromptModel = selectedModel;

          try {
              if (onResetStream) {
                  onResetStream();
              }
              return await generateGameResponseStream(
                  prompt,
                  selectedModel,
                  onChunk,
                  signal,
                  onModelUsed,
                  systemInstruction,
                  useGoogleSearch,
                  category,
                  onResetStream,
                  responseMimeType,
                  purpose,
                  enablePrefill,
                  prefillModelText
              );
          } catch (retryErr: any) {
              lastError = retryErr;
          }
      }
  }

  let friendlyError = lastError;
  const errText = lastError instanceof Error ? lastError.message : String(lastError || "");
  if (errText.includes("暂无可用凭证") || (lastError && typeof lastError === 'object' && JSON.stringify(lastError).includes("暂无可用凭证"))) {
       friendlyError = new Error("Thông báo từ Proxy: 'Tài khoản/Key không khả dụng hoặc hết số dư' (暂无可用凭证). Vui lòng kiểm tra lại cấu hình Proxy URL, Proxy Key trong phần 'Cài đặt' hoặc đổi sang 'Key Hệ thống' / 'Key Cá nhân' hợp lệ.");
  } else if (lastError?.message?.includes("429") || lastError?.status === 429) {
       friendlyError = new Error("Hệ thống đang bận (429). Vui lòng thử lại sau giây lát.");
  }
  throw friendlyError || new Error("Tất cả model dự phòng đều thất bại.");
}
