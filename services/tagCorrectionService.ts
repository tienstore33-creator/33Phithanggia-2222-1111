
import { KnowledgeBase, TagCorrection } from "../types";
import { getCurrentlyUsedApiKey, getApiSettings } from "./apiService";
import { executeWithFallback } from "../utils/modelFallback";

export const requestTagFixFromAI = async (
    correction: TagCorrection,
    knowledgeBase: KnowledgeBase
): Promise<string> => {
    const apiKey = getCurrentlyUsedApiKey();
    const settings = getApiSettings();

    const prompt = `
[GIAO THỨC SỬA LỖI TAG - TAG CORRECTION PROTOCOL]
Bạn là một chuyên gia sửa lỗi cú pháp cho hệ thống AI RPG.
Người dùng vừa phát hiện một tag AI viết sai cú pháp hoặc sai tham số.

[THÔNG TIN LỖI]
- Tag gốc: "${correction.originalTag}"
- Tên tag: "${correction.tagName}"
- Lý do lỗi: "${correction.errorReason}"

[BỐI CẢNH HIỆN TẠI]
- Nhân vật chính: ${knowledgeBase.playerStats.name} (ID: player)
- Địa điểm: ${knowledgeBase.currentLocationId}
- Các NPC đã biết: ${knowledgeBase.discoveredNPCs.map(n => `${n.name} (ID: ${n.id})`).join(", ")}

[NHIỆM VỤ]
Hãy viết lại tag này cho ĐÚNG cấu trúc yêu cầu của hệ thống. 
CHỈ TRẢ VỀ TAG ĐÃ SỬA, KHÔNG GIẢI THÍCH GÌ THÊM.

VD: 
Sai: [RELATIONSHIP_UPDATE: id="npc-1", description="Bạn thân"]
Đúng: [RELATIONSHIP_UPDATE: targetId="npc-1", status="Bạn thân"]

Tag đã sửa:
`;

    const systemInstruction = "Bạn là một AI hỗ trợ sửa lỗi tag. Chỉ trả về tag đúng cú pháp.";

    const result = await executeWithFallback(
        prompt,
        apiKey,
        settings,
        'economy', // Use economy model as requested
        systemInstruction
    );

    // Extract tag from response if model added extra text
    const match = result.text.match(/\[[A-Z_]+:.*?\]/s);
    return match ? match[0] : result.text.trim();
};
