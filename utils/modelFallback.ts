import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";
import { DEFAULT_SAFETY_SETTINGS } from '../constants';
import { ApiConfig } from '../types';
import { generateMainFallbackChain } from './mainStoryFallback';
import { getAiClient } from '../services/aiClient';
import { fallbackEventService } from '../services/fallbackEventService';
import { apiRunningService } from '../services/apiRunningService';
import { RemoteCanonService } from '../services/RemoteCanonService';
import { getApiSettings, rotationIndices } from '../services/apiService';
import { sanitizeSearchConfig } from './searchGuard';
import { apiKeyManager } from './apiKeyManager';
import { fallbackPromptService } from '../services/fallbackPromptService';
import { parseApiError } from './apiErrorParser';
import { PrefillPayloadBuilder } from '../services/ai/PrefillPayloadBuilder';
import { removeTuongThanTag } from './xmlSanitizerUtils';
import { extractGroundingDataFromResponse } from '../services/chatbotGroundingExtractor';
import { GroundingData } from '../types/chatbot';

export const FLASH_LITE_FALLBACK_CHAIN = [
  'gemini-flash-lite-latest',
  'gemini-flash-latest',
];

export const FLASH_FALLBACK_CHAIN = [
  'gemini-flash-latest',
  'gemini-flash-lite-latest',
];

export const generateLoopFallbackChain = (
  chosenModel: string, 
  menuModelIds: string[], 
  ultimateFallback: string
): string[] => {
    const index = menuModelIds.indexOf(chosenModel);
    
    let chain: string[] = [];
    
    if (index === -1) {
        chain = [chosenModel, ...menuModelIds];
    } else {
        chain = menuModelIds.slice(index);
        chain = chain.concat(menuModelIds.slice(0, index));
    }
    
    if (!chain.includes(ultimateFallback)) {
        chain.push(ultimateFallback);
    }
    
    return Array.from(new Set(chain));
};

export type TaskCategory = 'main' | 'combat' | 'economy' | 'secondary';

const LAST_SUCCESSFUL_MODEL_KEY = 'api_last_successful_model_';

export const getLastSuccessfulModel = (category: TaskCategory): string | null => {
  return localStorage.getItem(LAST_SUCCESSFUL_MODEL_KEY + category);
};

export const setLastSuccessfulModel = (category: TaskCategory, modelId: string) => {
  localStorage.setItem(LAST_SUCCESSFUL_MODEL_KEY + category, modelId);
};

export const getModelChainForTask = (category: TaskCategory, settings: ApiConfig, customOverrideModel?: string): string[] => {
  // BỘ LỌC AN TOÀN: Loại bỏ các từ khóa danh mục bị truyền nhầm vào tên model
  const invalidModelKeywords = ['main', 'combat', 'economy', 'secondary', 'lite', 'fast'];
  const sanitizedOverrideModel = (customOverrideModel && !invalidModelKeywords.includes(customOverrideModel.trim().toLowerCase()))
    ? customOverrideModel
    : undefined;

  // Helper to filter chain by availability in the current source
  const filterByAvailability = (chain: string[]) => {
    // Only filter if availableModels is present and not empty
    if (settings.availableModels && settings.availableModels.length > 0) {
      // Keep models that are in the available list
      const filtered = chain.filter(m => settings.availableModels?.includes(m));
      // If we filtered out everything, keep at least the first one as a safety fallback
      return filtered.length > 0 ? filtered : [chain[0]];
    }
    return chain;
  };

  const getCustomChain = (chosenModel: string, fallback?: any) => {
    // Nếu fallback config tồn tại, bất kể mode là 'custom' hay 'auto', 
    // nếu customList rỗng (hoặc khi tắt fallback), chỉ chạy DUY NHẤT chosenModel.
    if (fallback) {
      if (!fallback.customList || fallback.customList.length === 0) {
        console.log(`[ModelFallback] Category: ${category} - Custom list is empty. Fallback disabled. Running ONLY chosen model: [${chosenModel}]`);
        return [chosenModel];
      }
        
      let list: string[];

      if (fallback.recoveryStrategy === 'last_successful') {
        // Lấy danh sách nền tảng bảo toàn thứ tự được thiết lập trong customList
        const baseList = fallback.customList.includes(chosenModel)
          ? [...fallback.customList]
          : [chosenModel, ...fallback.customList.filter((m: any) => m !== chosenModel)];

        const lastWin = getLastSuccessfulModel(category);
        const startModel = (lastWin && baseList.includes(lastWin)) ? lastWin : chosenModel;
        const startIndex = baseList.indexOf(startModel);

        if (startIndex !== -1) {
          // Xoay vòng tròn: bắt đầu từ model thành công gần nhất, tiếp tục các model bên dưới rồi vòng lại đầu danh sách
          list = [...baseList.slice(startIndex), ...baseList.slice(0, startIndex)];
          console.log(`[ModelFallback] Strategy: Last Successful (Loop) - Starting at ${startModel}, cyclic chain:`, list);
        } else {
          list = [startModel, ...baseList.filter(m => m !== startModel)];
        }
      } else {
        // Chế độ 'sequential' (chạy lần lượt): Luôn thử từ chosenModel, sau đó lần lượt duyệt các model còn lại
        list = [chosenModel, ...fallback.customList.filter((m: any) => m !== chosenModel)];
      }

      const uniqueChain = Array.from(new Set(list)) as string[];
      
      // CRITICAL: Filter against available models to prevent phantom models from other sources appearing
      const filteredChain = filterByAvailability(uniqueChain);
      
      console.log(`[ModelFallback] Category: ${category} - Using CUSTOM chain:`, filteredChain);
      return filteredChain;
    }
    return [chosenModel];
  };

  switch (category) {
    case 'secondary':
    case 'combat': {
      const chosen = sanitizedOverrideModel || settings.combatModel || (settings.apiKeySource === 'proxy' && settings.proxyModel ? settings.proxyModel : 'gemini-flash-lite-latest');
      const custom = getCustomChain(chosen, settings.combatFallback);
      const chain = custom || [chosen];
      return filterByAvailability(chain);
    }
    case 'economy': {
      const chosen = sanitizedOverrideModel || settings.economyModel || (settings.economyModel ? settings.economyModel : (settings.apiKeySource === 'proxy' && settings.proxyModel ? settings.proxyModel : 'gemini-flash-lite-latest'));
      const custom = getCustomChain(chosen, settings.economyFallback);
      const chain = custom || [chosen];
      return filterByAvailability(chain);
    }
    case 'main':
    default: {
      const chosen = sanitizedOverrideModel || settings.model || (settings.apiKeySource === 'proxy' && settings.proxyModel ? settings.proxyModel : 'gemini-flash-latest');
      const custom = getCustomChain(chosen, settings.storyFallback);
      const chain = custom || [chosen];
      return filterByAvailability(chain);
    }
  }
};

export interface FallbackKeyRotator {
    getCurrentKey: () => { apiKey: string; apiKeyLabel: string } | null;
    onSuccess: (usedKey: string) => void;
    onError: (usedKey: string, isInvalidKey400: boolean) => boolean;
}

export const createFallbackKeyRotator = (settings: ApiConfig, primaryApiKey: string): FallbackKeyRotator => {
    const isProxy = settings.apiKeySource === 'proxy';
    const isSystem = settings.apiKeySource === 'system';

    if (isProxy) {
        const proxyKey = primaryApiKey || settings.proxyKey || 'dummy-key';
        return {
            getCurrentKey: () => ({ apiKey: proxyKey, apiKeyLabel: 'Proxy API' }),
            onSuccess: () => {},
            onError: () => true,
        };
    }

    if (isSystem) {
        const sysKey = primaryApiKey || 'system-proxy-key';
        return {
            getCurrentKey: () => ({ apiKey: sysKey, apiKeyLabel: 'Key Hệ Thống' }),
            onSuccess: () => {},
            onError: () => true,
        };
    }

    const allUserKeys = (settings.userApiKeys || []).filter(k => k && k.trim() !== '');
    const validUserKeys = apiKeyManager.filterValidKeys(allUserKeys);

    let remainingKeys: string[] = [];
    if (validUserKeys.length > 0) {
        const startPos = primaryApiKey ? validUserKeys.indexOf(primaryApiKey) : -1;
        remainingKeys = startPos !== -1
            ? [...validUserKeys.slice(startPos), ...validUserKeys.slice(0, startPos)]
            : [...validUserKeys];
    } else if (primaryApiKey && !apiKeyManager.isInvalid(primaryApiKey)) {
        remainingKeys = [primaryApiKey];
    }

    let cursor = 0;

    return {
        getCurrentKey: () => {
            if (remainingKeys.length === 0) return null;
            const key = remainingKeys[cursor % remainingKeys.length];
            const kIdx = allUserKeys.indexOf(key);
            const apiKeyLabel = kIdx !== -1 ? `API Key #${kIdx + 1}` : 'Key Cá Nhân';
            return { apiKey: key, apiKeyLabel };
        },
        onSuccess: (usedKey: string) => {
            const latestValid = apiKeyManager.filterValidKeys(allUserKeys);
            if (latestValid.length > 0) {
                const successKeyIdx = latestValid.indexOf(usedKey);
                if (successKeyIdx !== -1) {
                    rotationIndices.global = (successKeyIdx + 1) % latestValid.length;
                    console.log(`[Revolver API Key] Call Succeeded on Key #${successKeyIdx + 1}. Global key index updated to: ${rotationIndices.global} (Key #${rotationIndices.global + 1})`);
                }
            }
        },
        onError: (usedKey: string, isInvalidKey400: boolean): boolean => {
            if (isInvalidKey400) {
                const kIdx = allUserKeys.indexOf(usedKey);
                console.warn(`[Fallback] Lỗi 400 detected on Key #${kIdx !== -1 ? kIdx + 1 : '?'}. Blacklisting...`);
                apiKeyManager.markAsInvalid(usedKey);
                remainingKeys = remainingKeys.filter(k => k !== usedKey);
                if (remainingKeys.length === 0) {
                    return false;
                }
                cursor = cursor % remainingKeys.length;
            } else if (remainingKeys.length > 0) {
                cursor = (cursor + 1) % remainingKeys.length;
            }

            const latestValid = apiKeyManager.filterValidKeys(allUserKeys);
            if (latestValid.length > 0 && remainingKeys.length > 0) {
                const nextApiKey = remainingKeys[cursor % remainingKeys.length];
                const nextKeyIdx = latestValid.indexOf(nextApiKey);
                if (nextKeyIdx !== -1) {
                    rotationIndices.global = nextKeyIdx;
                    console.log(`[Revolver API Key] Call Failed. Failover global key index to: ${rotationIndices.global} (Key #${rotationIndices.global + 1})`);
                }
            }
            return remainingKeys.length > 0;
        },
    };
};

export async function executeWithFallback(
    prompt: string,
    apiKey: string,
    settings: ApiConfig,
    category: TaskCategory,
    systemInstruction?: string,
    useGoogleSearch?: boolean,
    responseMimeType?: string,
    inlineParts?: { mimeType: string; data: string }[],
    purpose: string = "Xử lý tác vụ AI",
    enablePrefill: boolean = true,
    prefillModelText: string = "</tuong_than>\n<thinking>\n"
): Promise<{ text: string; modelUsed: string; grounding?: GroundingData }> {
    const modelChain = getModelChainForTask(category, settings);
    const keyRotator = createFallbackKeyRotator(settings, apiKey);
    let lastError: any = null;

    for (let i = 0; i < modelChain.length; i++) {
        let modelName = modelChain[i];

        // Lớp bảo vệ 1 (PRE-CHECK): Chặn các model đòi Interactions API ngay từ đầu
        const interactionsOnlyModels = [
          "deep-research-pro-preview-12-2025",
          "deep-research-max-preview-04-2026",
          "deep-research-preview-04-2026",
          "antigravity-preview-05-2026",
          "gemini-omni-flash-preview"
        ];

        if (interactionsOnlyModels.includes(modelName)) {
            console.warn(`Model ${modelName} yêu cầu Interactions API. Hệ thống hiện chưa hỗ trợ endpoint này, tự động fallback về gemini-3.5-flash.`);
            modelName = "gemini-3.5-flash";
            modelChain[i] = modelName;
        }

        const keyInfo = keyRotator.getCurrentKey();
        if (!keyInfo) {
            break;
        }
        const { apiKey: currentApiKey, apiKeyLabel } = keyInfo;
        let currentTaskId = '';

        try {
            const ai = getAiClient(settings, currentApiKey, category);
            const config: any = {
                safetySettings: settings.safetySettings || DEFAULT_SAFETY_SETTINGS,
            };

            if (settings.temperature !== undefined) config.temperature = settings.temperature;
            if (settings.maxOutputTokens !== undefined) config.maxOutputTokens = settings.maxOutputTokens;
            if (settings.topK !== undefined) config.topK = settings.topK;
            if (settings.topP !== undefined) config.topP = settings.topP;
            if (responseMimeType) config.responseMimeType = responseMimeType;
            
            if (systemInstruction) {
                config.systemInstruction = systemInstruction;
            }

            const isFlashLite = modelName.includes('flash-lite');
            if (!isFlashLite && settings.thinkingBudget !== undefined && settings.thinkingBudget > 0 && (modelName.includes('gemini-3') || modelName.includes('gemini-2.5') || modelName.includes('gemini-2.0'))) {
                config.thinkingConfig = { thinkingBudget: settings.thinkingBudget };
            }

            if (responseMimeType === 'application/json') {
                // IMPORTANT: Gemini does not support combining Function Calling/Google Search
                // with response_mime_type: 'application/json' in many API versions.
                // We prioritize JSON output for extraction tasks.
            } else if (useGoogleSearch) {
                // BẮT BUỘC: Không được kết hợp googleSearch với function_declarations (lỗi 400)
                // Ưu tiên Google Search nếu được yêu cầu
                config.tools = [{ googleSearch: {} }];
            } else {
                // Nếu không dùng Google Search, có thể dùng các công cụ tùy chỉnh (Function Calling)
                config.tools = [{
                    functionDeclarations: [{
                        name: "read_online_canon",
                        description: "TRA CỨU CANON: Phải gọi công cụ này để trích xuất dữ liệu từ nguồn nguyên tác (GitHub/Cloud) khi gặp danh từ riêng hoặc bối cảnh thế giới lạ. Tuyệt đối không được đoán mò.",
                        parameters: {
                            type: Type.OBJECT,
                            properties: {
                                query: {
                                    type: Type.STRING,
                                    description: "Từ khóa hoặc danh từ riêng cần tra cứu."
                                }
                            },
                            required: ["query"]
                        }
                    }]
                }];
                config.toolConfig = { includeServerSideToolInvocations: true };
            }

            // Xây dựng contents sử dụng PrefillPayloadBuilder
            const isProxy = settings.apiKeySource === 'proxy';
            const shouldUsePrefill = isProxy && enablePrefill && responseMimeType !== 'application/json';
            const finalPrefillText = isProxy ? '<tuong_than>\n' : prefillModelText;
            const contents = PrefillPayloadBuilder.buildContents({
                prompt,
                enablePrefill: shouldUsePrefill,
                prefillModelText: finalPrefillText,
                inlineParts
            });

            const requestPayloadStr = JSON.stringify(contents, null, 2);
            currentTaskId = apiRunningService.start(modelName, apiKeyLabel, purpose, requestPayloadStr);
            let response: GenerateContentResponse | null = null;
            let loopCount = 0;
            const maxLoops = 3;

            while (loopCount < maxLoops) {
                // Tự động tước bỏ googleSearch nếu model không hỗ trợ
                const sanitizedConfig = sanitizeSearchConfig(modelName, config);

                const generatePromise = ai.models.generateContent({
                    model: modelName,
                    contents: contents,
                    config: sanitizedConfig
                });

                // Use apiTimeout from settings or default to 60s
                const apiTimeoutSeconds = (getApiSettings().apiTimeout || 60);
                const apiTimeoutMs = apiTimeoutSeconds * 1000;
                const timeoutPromise = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error(`Model ${modelName} timed out after ${apiTimeoutSeconds}s`)), apiTimeoutMs)
                );

                response = await Promise.race([
                    generatePromise,
                    timeoutPromise
                ]) as GenerateContentResponse;

                const functionCalls = response.functionCalls;
                if (functionCalls && functionCalls.length > 0) {
                    const parts: any[] = [];
                    
                    // Add the model's response (which contains the function calls) to the history
                    contents.push(response.candidates?.[0]?.content);

                    for (const call of functionCalls) {
                        if (call.name === "read_online_canon") {
                            const query = (call.args as any).query;
                            const url = settings.remoteCanonUrl || ""; // Get URL from settings
                            const result = await RemoteCanonService.search(url, query); // Search is async
                            parts.push({
                                functionResponse: {
                                    name: call.name,
                                    response: { content: result },
                                    id: call.id
                                }
                            });
                        }
                    }

                    if (parts.length > 0) {
                        contents.push({ parts });
                        loopCount++;
                        continue; // Call again with function responses
                    }
                }
                
                break; // No more function calls or max loops reached
            }

            if (response && response.text) {
                // Success! Stop both UI elements
                apiRunningService.stop(currentTaskId, response.text);
                fallbackEventService.stop();
                
                // Record the win for future last_successful recovery
                setLastSuccessfulModel(category, modelName);
                
                // REVOLVER SUCCESS ROTATION: Set global key index to the next key in line
                keyRotator.onSuccess(currentApiKey);
                
                let finalText = response.text;
                if (enablePrefill && finalPrefillText && !finalText.startsWith(finalPrefillText)) {
                    finalText = finalPrefillText + finalText;
                }
                
                // Extract native thought parts if they exist
                const parts = response.candidates?.[0]?.content?.parts || [];
                let thoughtText = '';
                for (const p of parts as any[]) {
                    if (p.thought === true && p.text) {
                        thoughtText += p.text + '\n';
                    }
                }
                if (thoughtText.trim() !== '') {
                    finalText = `<thinking>\n${thoughtText.trim()}\n</thinking>\n\n` + finalText;
                }
                
                finalText = removeTuongThanTag(finalText);
                
                if (!finalText || finalText.trim() === "") {
                    throw new Error("Phản hồi từ AI rỗng sau khi làm sạch.");
                }
                
                const rawGrounding = response.candidates?.[0]?.groundingMetadata || (response as any).groundingMetadata;
                const grounding = extractGroundingDataFromResponse(rawGrounding);
                
                return { text: finalText, modelUsed: modelName, grounding };
            } else {
                throw new Error("Phản hồi từ AI rỗng.");
            }
        } catch (error: any) {
            // Stop the small toast for this failed attempt
            apiRunningService.stop(currentTaskId, `Lỗi: ${error?.message || error}`);
            console.warn(`[Fallback] Model ${modelName} (${apiKeyLabel}) failed for category ${category}:`, error.message || error);
            lastError = error;
            
            const errorMessage = error?.message || "";
            const errorString = JSON.stringify(error);
            const is400 = error?.status === 400 || errorMessage.includes("400") || errorMessage.includes("API_KEY_INVALID") || errorMessage.includes("INVALID_ARGUMENT");
            const is429 = error?.status === 429 || errorMessage.includes("429") || errorString.includes("429") || errorMessage.includes("RESOURCE_EXHAUSTED");

            // REVOLVER FAILURE FAILOVER: Rotate to the next API key AND next model
            const hasMoreKeys = keyRotator.onError(currentApiKey, is400);
            if (!hasMoreKeys) {
                break;
            }

            // Update fallback overlay if there's a next model
            if (modelChain.length > 1 && i < modelChain.length - 1) {
                if (is429) {
                    console.warn(`[Fallback] Throttling for 3s due to 429 rate limit before trying next model & key...`);
                    await new Promise(resolve => setTimeout(resolve, 3000));
                }
                // Only start showing the fallback overlay if the first model fails
                if (i === 0) {
                    fallbackEventService.start(modelChain.length, modelName);
                }
                fallbackEventService.nextAttempt(modelName, modelChain[i + 1], error.message || "Unknown error");
            }
        }
    }

    apiRunningService.stop();
    fallbackEventService.stop();
    console.error("All models in fallback chain failed.", lastError);

    // KHI DANH SÁCH FALLBACK TRỐNG/TẮT HẶC TẤT CẢ MODEL ĐỀU LỖI -> NẾU CÓ THỂ, HIỆN MODAL HỎI NGƯỜI DÙNG CHỌN MODEL CHẠY TIẾP
    if (lastError) {
        let currentPromptModel = modelChain[modelChain.length - 1] || 'gemini-flash-latest';
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
                // Người dùng bấm "Không" (Hủy bỏ) -> Hủy bỏ cuộc gọi API
                break;
            }

            console.log(`[ModelFallback Prompt] Người dùng chọn model chạy lại: ${selectedModel}`);
            currentPromptModel = selectedModel;

            try {
                const singleModelSettings: ApiConfig = {
                    ...settings,
                    model: selectedModel,
                    combatModel: selectedModel,
                    economyModel: selectedModel,
                    storyFallback: { mode: 'custom', customList: [] },
                    combatFallback: { mode: 'custom', customList: [] },
                    economyFallback: { mode: 'custom', customList: [] }
                };
                return await executeWithFallback(
                    prompt,
                    apiKey,
                    singleModelSettings,
                    category,
                    systemInstruction,
                    useGoogleSearch,
                    responseMimeType,
                    inlineParts,
                    purpose
                );
            } catch (retryErr: any) {
                console.warn(`[ModelFallback Prompt Retry] Model ${selectedModel} failed:`, retryErr.message || retryErr);
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



