// @FIX: Updated to use the correct `GoogleGenAI` class as per guidelines.
import { GoogleGenAI } from "@google/genai";
import { getApiSettings, getCurrentlyUsedApiKey } from './geminiService';
import { getAiClient } from './aiClient';

const IMAGE_MODEL_NAME = 'imagen-4.0-generate-001';

function getAiInstance(): GoogleGenAI | null {
  const settings = getApiSettings();
  const apiKey = getCurrentlyUsedApiKey();

  if (!apiKey) {
      console.warn("Chưa có API Key nào được cài đặt. Bỏ qua việc tạo ảnh bằng Imagen 4.0.");
      return null;
  }
  
  return getAiClient(settings, apiKey);
}


/**
 * Generates an image from a text prompt using the specified Imagen model.
 * @param prompt The text prompt to generate the image from.
 * @returns A Promise that resolves to the base64 encoded string of the generated image (without data URI prefix), or null if no key is configured.
 * @throws An error if image generation fails or no image data is returned.
 */
export async function generateImageWithImagen3(prompt: string): Promise<string | null> {
  const geminiAi = getAiInstance();
  if (!geminiAi) {
      return null;
  }

  try {
    const response = await geminiAi.models.generateImages({
      model: IMAGE_MODEL_NAME,
      prompt: prompt,
      config: { 
        numberOfImages: 1, 
        outputMimeType: 'image/png' 
      },
    });

    if (response.generatedImages && response.generatedImages.length > 0 && response.generatedImages[0].image?.imageBytes) {
      const base64ImageBytes: string = response.generatedImages[0].image.imageBytes;
      return base64ImageBytes;
    } else {
      console.error("No image data found in API response. Response:", response);
      throw new Error("Không tìm thấy dữ liệu ảnh trong phản hồi từ API. Vui lòng thử lại hoặc kiểm tra mô tả của bạn.");
    }

  } catch (error) {
    console.error("Lỗi khi tạo ảnh bằng Gemini API (generateImages):", error);
    const errorContext = error as any;
    let userMessage = "Lỗi không xác định khi tạo ảnh.";

    if (errorContext?.message) {
        userMessage = errorContext.message;
        if (userMessage.includes("API key not valid") || userMessage.includes("PERMISSION_DENIED") || userMessage.includes("API_KEY_INVALID")) {
            userMessage = `Lỗi API: API key không hợp lệ hoặc không có quyền truy cập. Vui lòng kiểm tra lại API_KEY. Chi tiết: ${userMessage}`;
        } else if (userMessage.includes("Model not found") || userMessage.includes("does not exist") || userMessage.includes("model is not supported")) {
            userMessage = `Lỗi API: Model '${IMAGE_MODEL_NAME}' không được tìm thấy hoặc không được hỗ trợ. Chi tiết: ${userMessage}`;
        } else if (userMessage.toLowerCase().includes("quota") || errorContext?.status === 429) {
            userMessage = `Lỗi API: Đã vượt quá hạn ngạch sử dụng. Vui lòng thử lại sau. Chi tiết: ${userMessage}`;
        } else if (userMessage.includes("prompt was blocked")) {
            userMessage = `Lỗi API: Mô tả của bạn có thể đã vi phạm chính sách nội dung. Vui lòng thử mô tả khác. Chi tiết: ${userMessage}`;
        } else {
            userMessage = `Lỗi tạo ảnh: ${userMessage}`;
        }
    }
    throw new Error(userMessage);
  }
}