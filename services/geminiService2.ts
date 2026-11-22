import { KnowledgeBase, EconomicZoneStub } from '../types';
import { generateEcoZoneJsonPrompt } from '../prompts/generateEcoZoneJsonPrompt';
import { EcoZoneGeneratedData, extractJsonFromAiResponse } from './economy/EcoZoneJsonService';
import { callGeminiAPI } from './apiService';

/**
 * Gọi Gemini API sử dụng cấu trúc Prompt JSON để lấy thông tin chi tiết khu vực kinh tế.
 */
export const generateEcoZoneJsonData = async (
    knowledgeBase: KnowledgeBase,
    zoneStub: EconomicZoneStub,
    onPromptLog?: (p: string) => void
): Promise<{ response: EcoZoneGeneratedData; rawText: string }> => {
    const prompt = generateEcoZoneJsonPrompt(knowledgeBase, zoneStub);
    
    const systemInstruction = "Bạn là hệ thống thiết lập dữ liệu kinh tế (TAWA-JSON-ENGINE). Bạn BẮT BUỘC chỉ được phép trả về duy nhất một chuỗi JSON chuẩn xác nằm trong thẻ <update_data>...</update_data>.";
    
    // Gọi callGeminiAPI chỉ định danh mục 'economy' để tối ưu xoay vòng khóa API
    const { text: rawText } = await callGeminiAPI(
        prompt,
        onPromptLog,
        'economy',
        undefined,
        systemInstruction,
        false
    );

    try {
        const parsedData = extractJsonFromAiResponse(rawText);
        return {
            response: parsedData,
            rawText
        };
    } catch (e) {
        console.error("Lỗi parse JSON từ Gemini, kích hoạt bộ giải cứu:", e);
        throw e;
    }
};
