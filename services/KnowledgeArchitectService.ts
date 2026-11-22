import { callGeminiAPI } from './apiService';
import { KnowledgeBase, StoryBibleEntry } from '../types';

/**
 * Background Task: Knowledge Architect
 * Phân tích lịch sử lượt và cập nhật StoryBible
 * Chạy mỗi khi lượt chơi đạt bội số của 10
 */
export const runKnowledgeArchitectAsync = async (
    kb: KnowledgeBase,
    setKb: (updater: (prev: KnowledgeBase) => KnowledgeBase) => void
) => {
    try {
        const historyText = kb.currentTurnLog.slice(-15).map(e => `${e.role}: ${e.text}`).join('\n');
        
        const prompt = `Bạn là Knowledge Architect. Hãy phân tích nội dung truyện gần đây để cập nhật StoryBible.

[LỊCH SỬ GẦN ĐÂY]
${historyText}

[STORY BIBLE HIỆN TẠI]
${JSON.stringify(kb.storyBible || [])}

NHIỆM VỤ:
1. Cập nhật hoặc thêm mới các mục vào StoryBible (các thiết lập lore quan trọng).
2. Gán priority, weight, sticky cho các mục StoryBible.

CHUẨN ĐẦU RA JSON:
{
  "newStoryBibleEntries": StoryBibleEntry[]
}
        `;

        const result = await callGeminiAPI(
            prompt,
            undefined,
            'economy',
            undefined,
            undefined,
            false,
            'application/json'
        );

        if (!result || !result.text) return;

        try {
            const cleanJson = result.text.replace(/^\`\`\`json/m, '').replace(/^\`\`\`/m, '').trim();
            const parsed = JSON.parse(cleanJson);

            setKb(prev => {
                const newKb = structuredClone(prev);
                
                // Merge StoryBible
                if (parsed.newStoryBibleEntries) {
                    parsed.newStoryBibleEntries.forEach((entry: StoryBibleEntry) => {
                        const idx = newKb.storyBible.findIndex(e => e.keyword === entry.keyword);
                        if (idx > -1) {
                            newKb.storyBible[idx] = { ...newKb.storyBible[idx], ...entry };
                        } else {
                            if (!entry.id) entry.id = `bible-${Date.now()}-${Math.random()}`;
                            newKb.storyBible.push(entry);
                        }
                    });
                }

                return newKb;
            });
        } catch (e) {
            console.error("KnowledgeArchitect: Parse error", e);
        }
    } catch (error) {
        console.error("KnowledgeArchitect error:", error);
    }
};
