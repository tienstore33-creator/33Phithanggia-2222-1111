import { generateGameResponseStream } from './geminiStreamService';
import { TaskCategory } from '../utils/modelFallback';
import { getApiSettings } from './geminiService';
import { removeTuongThanTag } from '../utils/xmlSanitizerUtils';

/**
 * Helper thực hiện gọi Gemini Streaming kèm kỹ thuật Prefill mớm mồi
 */
export async function streamSetupTaskWithPrefill(
    prompt: string,
    prefillTag: string = "<tuong_than>",
    onChunk?: (accumulatedText: string, chunk: string) => void,
    onPromptLog?: (p: string) => void,
    category: TaskCategory = 'main',
    useGoogleSearch?: boolean
): Promise<{ rawText: string; cleanContent: string }> {
    const settings = getApiSettings();
    const isProxy = settings.apiKeySource === 'proxy';

    // 1. Kỹ thuật mớm mồi bằng cách gợi ý bắt đầu với thẻ prefillTag (CHỈ áp dụng cho system và user key, proxy dùng role model prefill trong geminiStreamService)
    const prefilledPrompt = isProxy ? prompt : `${prompt}\n\nHãy bắt đầu suy nghĩ và phân tích sâu sắc trong thẻ ${prefillTag}:`;
    
    let fullText = prefillTag + "\n";
    if (onPromptLog) onPromptLog(prefilledPrompt);

    // 2. Gọi streaming qua generateGameResponseStream
    const rawText = await generateGameResponseStream(
        prefilledPrompt,
        '', // model default
        (chunk: string) => {
            fullText += chunk;
            if (onChunk) {
                onChunk(fullText, chunk);
            }
        },
        undefined,
        undefined,
        undefined,
        useGoogleSearch,
        category
    );

    // 3. Giám sát viên: Tách bỏ khối <prethinking> hoặc <tuong_than> hoặc các thẻ thinking tương tự để lấy nội dung sạch
    let cleanContent = removeTuongThanTag(fullText)
        .replace(/<prethinking>[\s\S]*?<\/prethinking>/gi, '')
        .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
        .trim();

    return { rawText: removeTuongThanTag(fullText), cleanContent };
}
