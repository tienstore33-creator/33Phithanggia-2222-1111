import { GoogleGenAI, Type } from "@google/genai";
import { getApiSettings, getCurrentlyUsedApiKey } from "../geminiService";
import { getAiClient } from "../aiClient";
import { apiRunningService } from "../apiRunningService";
import { applyThinkingConfig } from "../../utils/thinkingLevelUtils";

export const generateUnifiedCultivation = async (worldContext: string): Promise<string> => {
  const settings = getApiSettings();
  const apiKey = getCurrentlyUsedApiKey() || "";
  
  if (!apiKey && settings.apiKeySource !== 'proxy') {
    throw new Error("API Key không khả dụng. Vui lòng kiểm tra cấu hình trong Cài đặt.");
  }

  const ai = getAiClient(settings, apiKey);
  const modelName = settings.combatModel || "gemini-flash-latest";
  
  const prompt = `Dựa trên bối cảnh thế giới hoặc tác phẩm sau đây:
"${worldContext}"

Hãy thiết lập một hệ thống tu luyện/cảnh giới duy nhất và đồng nhất (MANDATORY UNIFIED) cho TẤT CẢ các chủng tộc (Nhân tộc, Yêu tộc, Ma tộc...). 
Tuyệt đối không sử dụng các danh từ riêng theo chủng tộc (như Yêu Đan, Ma Kết) làm tên cảnh giới chính.

Yêu cầu cụ thể:
1. Đại Cảnh Giới: Danh sách đúng 10 cấp độ tu luyện chính, phân cách bằng dấu ' - '. Ví dụ: "Luyện Khí - Trúc Cơ - Kim Đan - Nguyên Anh - Hóa Thần - Luyện Hư - Hợp Thể - Đại Thừa - Độ Kiếp - Chân Tiên". Cố gắng tìm kiếm thông tin từ tác phẩm gốc nếu bối cảnh là một tác phẩm cụ thể.
2. Tiểu Cảnh Giới: Định dạng phân cấp nhỏ bên trong mỗi đại cảnh giới. Chỉ chọn một trong hai định dạng sau:
   - "1 Tầng - 10 Tầng" (hoặc 1-9 Tầng, 1-12 Tầng tùy bối cảnh)
   - "Sơ Kỳ - Trung Kỳ - Hậu Kỳ" (có thể thêm Viên Mãn)

AI hãy cố gắng ghi đủ 10 đại cảnh giới.

Trả về kết quả dưới dạng JSON nghiêm ngặt với cấu trúc:
{
  "major": "Tên Cảnh Giới 1 - Tên Cảnh Giới 2 - ... - Tên Cảnh Giới 10",
  "minor": "Định dạng tiểu cảnh giới"
}`;

  let apiKeyLabel = '';
  if (settings.apiKeySource === 'system') {
      apiKeyLabel = 'Key Hệ Thống';
  } else if (settings.apiKeySource === 'proxy') {
      apiKeyLabel = 'Proxy API';
  } else {
      const keys = (settings.userApiKeys || []).filter(k => k && k.trim() !== '');
      const kIdx = keys.indexOf(apiKey);
      apiKeyLabel = kIdx !== -1 ? `API Key #${kIdx + 1}` : 'Key Cá Nhân';
  }

  const taskId = apiRunningService.start(modelName, apiKeyLabel, "Chuẩn hóa cảnh giới tu luyện");
  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: applyThinkingConfig(modelName, {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            major: { type: Type.STRING },
            minor: { type: Type.STRING }
          },
          required: ["major", "minor"]
        }
      }, settings)
    });
    
    apiRunningService.stop(taskId);
    return response.text || "";
  } catch (error) {
    apiRunningService.stop(taskId);
    console.error("Error generating unified cultivation:", error);
    throw error;
  }
};
