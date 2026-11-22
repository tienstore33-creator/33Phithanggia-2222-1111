import { GoogleGenAI, Type } from "@google/genai";
import { getApiSettings } from "./apiService";
import { applyThinkingConfig } from "../utils/thinkingLevelUtils";

export async function analyzePresetWithAI(apiKey: string, presetContent: string, model: string) {
  const ai = new GoogleGenAI({ 
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });

  const prompt = `
Hãy đóng vai một chuyên gia phân tích hệ thống và lập trình viên cao cấp. Nhiệm vụ của bạn là đọc và phân tích cấu hình Prompt (Preset) dưới đây, sau đó chia nó thành các đầu mục (sections) logic, liên tiếp, không bỏ sót bất kỳ phần nào của nội dung gốc.

Yêu cầu chi tiết:
1. Chia toàn bộ văn bản đầu vào thành các đoạn/đầu mục logic. Mỗi đầu mục phải đại diện cho một phần tính năng, quy tắc, cấu hình hoặc phân khu rõ rệt (ví dụ các phân khu bắt đầu bằng "===", hoặc các khối định nghĩa biến, các luật hành vi, v.v.).
2. KHÔNG bỏ sót bất kỳ nội dung hoặc ký tự nào trong preset gốc. Tất cả nội dung nguyên bản phải được phân bổ chính xác vào \`rawContent\` của các đầu mục tương ứng. Khi ghép tất cả \`rawContent\` lại theo thứ tự, chúng ta phải có lại một prompt hoàn chỉnh gần như tuyệt đối so với prompt gốc.
3. Đối với mỗi đầu mục, hãy cung cấp:
   - \`title\`: Tên đầu mục ngắn gọn, trực quan (ví dụ: lấy đúng tiêu đề dòng như "=== ✦ Phân khu 00 · Khởi động song sinh ✦ ===" hoặc tên của biến/tính năng như "Khởi tạo biến", "Tawa và AvarsiSkull").
   - \`description\`: Lời giải thích ngắn gọn bằng tiếng Việt, súc tích (khoảng 1-3 câu) về ý nghĩa, tác dụng hoặc cơ chế vận hành của đầu mục này trong hệ thống prompt.
   - \`rawContent\`: Giữ nguyên 100% nội dung gốc của khối văn bản thuộc về đầu mục này (không sửa đổi, không dịch nghĩa, không thêm thắt ký tự lạ, giữ nguyên định dạng để code của game còn chạy được chính xác).

Hãy trả về kết quả dưới dạng một JSON Array. Mỗi object trong array bắt buộc có cấu trúc sau:
{
  "title": "Tên đầu mục",
  "description": "Lời giải thích súc tích bằng tiếng Việt về tác dụng của đầu mục này",
  "rawContent": "Nội dung văn bản gốc nguyên bản 100% thuộc về đầu mục này"
}

Nội dung Prompt (Preset) cần phân tích:
\"\"\"
${presetContent}
\"\"\"
`;

  const targetModel = model || 'gemini-flash-latest';
  const response = await ai.models.generateContent({
    model: targetModel,
    contents: prompt,
    config: applyThinkingConfig(targetModel, {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: {
              type: Type.STRING,
              description: "Tên ngắn gọn của đầu mục prompt."
            },
            description: {
              type: Type.STRING,
              description: "Lời giải thích bằng tiếng Việt về ý nghĩa và tác dụng của đầu mục."
            },
            rawContent: {
              type: Type.STRING,
              description: "Đoạn text nguyên bản 100% không chỉnh sửa của đầu mục này."
            }
          },
          required: ["title", "description", "rawContent"]
        }
      }
    }, getApiSettings())
  });

  const responseText = response.text;
  if (!responseText) {
    throw new Error("Không nhận được phản hồi phân tích từ AI.");
  }

  try {
    return JSON.parse(responseText.trim());
  } catch (error: any) {
    console.error("Lỗi parse JSON từ AI:", responseText);
    throw new Error(`AI trả về định dạng không hợp lệ: ${error.message}`);
  }
}
