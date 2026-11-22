// @FIX: Updated to use the correct `GoogleGenAI` class as per guidelines.
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { getApiSettings, getCurrentlyUsedApiKey } from './geminiService';
import { getAiClient } from './aiClient';

const IMAGE_MODEL_NAME = 'gemini-2.5-flash-image';

function getAiInstance(): GoogleGenAI | null {
  const settings = getApiSettings();
  const apiKey = getCurrentlyUsedApiKey();

  if (!apiKey) {
      console.warn("Chưa có API Key nào được cài đặt. Bỏ qua việc tạo ảnh bằng Gemini Flash Image.");
      return null;
  }
  
  return getAiClient(settings, apiKey);
}

export async function generateImageWithGemini2Flash(prompt: string): Promise<string | null> {
  const geminiAi = getAiInstance();
  if (!geminiAi) {
      return null;
  }
  
  try {
    const response: GenerateContentResponse = await geminiAi.models.generateContent({
      model: IMAGE_MODEL_NAME,
      contents: {
        parts: [
          { text: prompt },
        ],
      },
      config: {
          imageConfig: {
              aspectRatio: "1:1"
          },
      },
    });

    if (response.candidates && response.candidates.length > 0) {
        const part = response.candidates[0].content.parts[0];
        if (part.inlineData && part.inlineData.data) {
          const mimeType = part.inlineData.mimeType || 'image/png';
          return `data:${mimeType};base64,${part.inlineData.data}`;
        }
    }

    console.error("No image data found in API response stream. Full response:", response);
    throw new Error("Không tìm thấy dữ liệu ảnh trong phản hồi từ API. Prompt có thể đã bị từ chối hoặc có lỗi xảy ra.");

  } catch (error) {
    console.error("Lỗi khi tạo ảnh bằng Gemini API:", error);
    if (error instanceof Error) {
      const errorMessage = (error as any).message || ''; 
      const errorDetails = (error as any).details || (error as any).error?.message || '';

      if (errorMessage.includes("API key not valid") || 
          errorMessage.includes("PERMISSION_DENIED") ||
          errorMessage.includes("API_KEY_INVALID") ||
          errorDetails.includes("API_KEY_INVALID")) {
        throw new Error(`Lỗi API: API key không hợp lệ hoặc không có quyền truy cập. Vui lòng kiểm tra lại API_KEY.`);
      }
      if (errorMessage.includes("Model not found") || 
          errorMessage.includes("does not exist") || 
          errorMessage.includes("model is not supported") ||
          errorDetails.includes("Model not found")) {
        throw new Error(`Lỗi API: Model '${IMAGE_MODEL_NAME}' không được tìm thấy hoặc không được hỗ trợ. Vui lòng kiểm tra lại.`);
      }
      if (errorMessage.toLowerCase().includes("quota") || (error as any).status === 429 || errorDetails.toLowerCase().includes("quota")) {
        throw new Error("Lỗi API: Đã vượt quá hạn ngạch sử dụng. Vui lòng thử lại sau.");
      }
      if (errorMessage.includes("response modalities") || errorDetails.includes("response modalities")) {
         throw new Error(`Lỗi cấu hình API: Model '${IMAGE_MODEL_NAME}' không hỗ trợ cấu hình modalities hiện tại. Lỗi chi tiết: ${errorMessage || errorDetails}`);
      }
      
      throw new Error(`Lỗi API: ${errorMessage || errorDetails || "Một lỗi không xác định đã xảy ra với API."}`);
    }
    throw new Error("Đã xảy ra lỗi không xác định khi tạo ảnh.");
  }
}