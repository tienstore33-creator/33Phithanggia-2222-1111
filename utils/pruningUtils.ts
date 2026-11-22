import { KnowledgeBase, GameMessage } from '../types';

/**
 * Cắt tỉa dữ liệu lịch sử để đảm bảo hiệu suất game
 * @param kb KnowledgeBase cần cắt tỉa
 * @param messages Danh sách tin nhắn cần cắt tỉa
 * @returns Object chứa KB và Messages đã được tối ưu
 */
export const pruneHistoricalData = (
    kb: KnowledgeBase,
    messages: GameMessage[]
): { prunedKb: KnowledgeBase; prunedMessages: GameMessage[] } => {
    const MAX_MESSAGES = 100;
    const MAX_TURN_HISTORY = 9999;
    const MAX_RAG_LOGS = 50;

    // 1. Cắt tỉa Game Messages (Giữ lại MAX_MESSAGES tin nhắn gần nhất)
    let prunedMessages = messages;
    if (messages.length > MAX_MESSAGES) {
        // Luôn giữ lại tin nhắn đầu tiên (Initial Message) nếu cần bối cảnh khởi đầu? 
        // Thường thì game này không cần vì mọi thứ trong KB.
        prunedMessages = messages.slice(-MAX_MESSAGES);
    }

    const prunedKb = { ...kb };

    // 2. Cắt tỉa KnowledgeBase.turnHistory (Giữ lại MAX_TURN_HISTORY bản ghi delta/keyframe gần nhất)
    if (prunedKb.turnHistory && prunedKb.turnHistory.length > MAX_TURN_HISTORY) {
        prunedKb.turnHistory = prunedKb.turnHistory.slice(-MAX_TURN_HISTORY);
    }

    // 3. Cắt tỉa RAG history log (Giữ lại MAX_RAG_LOGS lượt truy xuất gần nhất)
    if (prunedKb.ragHistoryLog && prunedKb.ragHistoryLog.length > MAX_RAG_LOGS) {
        prunedKb.ragHistoryLog = prunedKb.ragHistoryLog.slice(-MAX_RAG_LOGS);
    }

    // 4. Cắt tỉa Turn History Entry: Mỗi entry trong turnHistory có thể chứa snapshots.
    // Tối ưu: Nếu snapshot quá cũ, ta có thể xóa snapshot và chỉ giữ lại tin nhắn hoặc meta.
    // Hiện tại slice(-MAX_TURN_HISTORY) đã xử lý phần lớn gánh nặng CPU/Memory.

    return { prunedKb, prunedMessages };
};
