import { getAiClient } from '../../services/aiClient';
import { getApiSettings, getCurrentlyUsedApiKeyByCategory } from '../../services/apiService';
import { getModelChainForTask, createFallbackKeyRotator } from '../../utils/modelFallback';
import { sanitizeSearchConfig } from '../../utils/searchGuard';
import { applyThinkingConfig } from '../../utils/thinkingLevelUtils';
import { StreamThinkingParser } from '../utils/streamThinkingParser';

export class FanficAnalyzerService {
  /**
   * Chạy request stream có tích hợp chuỗi Fallback Model cho nhiệm vụ tra cứu nguyên tác
   */
  static async executeStreamWithFallback(
    prompt: string,
    configOptions: any,
    onChunk?: (contentChunk: string, thinkingChunk?: string) => void
  ): Promise<string> {
    const settings = getApiSettings();
    const modelChain = getModelChainForTask('main', settings);
    const primaryApiKey = getCurrentlyUsedApiKeyByCategory('main') || '';
    const keyRotator = createFallbackKeyRotator(settings, primaryApiKey);
    
    let lastError: any = null;

    for (const modelName of modelChain) {
      const keyInfo = keyRotator.getCurrentKey();
      if (!keyInfo) {
        break;
      }

      try {
        if (onChunk && lastError) {
          onChunk(`\n⚠️ [Fallback Active] Đang chuyển sang model: ${modelName} (${keyInfo.apiKeyLabel})...\n`);
        }
        
        const aiClient = getAiClient(settings, keyInfo.apiKey, 'main');
        let fullText = "";

        // Kiểm tra xem cấu hình gốc có yêu cầu googleSearch hay không
        const isSearchRequested = !!(
          (Array.isArray(configOptions?.tools) && configOptions.tools.some((t: any) => t.googleSearch)) ||
          configOptions?.tools?.googleSearch
        );

        // Tự động tước bỏ googleSearch nếu model không hỗ trợ và áp dụng Thinking Level
        const sanitizedConfig = sanitizeSearchConfig(modelName, configOptions);
        const finalConfig = applyThinkingConfig(modelName, sanitizedConfig, settings);

        // Kiểm tra xem cấu hình sau khi tước bỏ còn googleSearch hay không
        const isSearchActiveAfterSanitization = !!(
          (Array.isArray(finalConfig?.tools) && finalConfig.tools.some((t: any) => t.googleSearch)) ||
          finalConfig?.tools?.googleSearch
        );

        // Nếu ban đầu có yêu cầu search mà sau khi sanitize lại bị tắt mất
        if (isSearchRequested && !isSearchActiveAfterSanitization && onChunk) {
          const cleanName = modelName.replace(/^models\//, '');
          onChunk('', `⚠️ Đã tắt google search do Model [${cleanName}] không hỗ trợ\n\n`);
        }

        const responseStream = await aiClient.models.generateContentStream({
          model: modelName,
          contents: prompt,
          config: finalConfig
        });

        const parser = new StreamThinkingParser();

        for await (const chunk of responseStream) {
          if (chunk.text) {
            fullText += chunk.text;
            if (onChunk) {
              const { contentChunk, thinkingChunk } = parser.parseChunk(chunk.text);
              onChunk(contentChunk, thinkingChunk);
            }
          }
        }

        if (fullText.trim().length > 0) {
          keyRotator.onSuccess(keyInfo.apiKey);
          return fullText; // Thành công -> Trả về kết quả
        }
        throw new Error(`Model ${modelName} trả về phản hồi rỗng.`);
      } catch (error: any) {
        console.warn(`[FanficAnalyzerService] Model ${modelName} (${keyInfo.apiKeyLabel}) thất bại:`, error?.message || error);
        lastError = error;
        const errMessage = error?.message || '';
        const is400 = error?.status === 400 || errMessage.includes('400') || errMessage.includes('API_KEY_INVALID') || errMessage.includes('INVALID_ARGUMENT');
        const hasMoreKeys = keyRotator.onError(keyInfo.apiKey, is400);
        if (!hasMoreKeys) {
          break;
        }
        // Tiếp tục vòng lặp nhảy sang model tiếp theo và api key tiếp theo
      }
    }

    throw new Error(`Tất cả ${modelChain.length} model fallback đều thất bại. Lỗi cuối: ${lastError?.message || 'Unknown'}`);
  }
}
