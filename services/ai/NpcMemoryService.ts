import { KnowledgeBase } from '../../types';

/**
 * Lấy rich summaries liên quan đến NPC từ ragHistoryLog theo quy tắc:
 * - Tìm tất cả các log trong ragHistoryLog có chứa tên NPC.
 * - Nếu tổng số log liên quan <= 20: chỉ lấy tối đa 20 lượt gần nhất.
 * - Nếu tổng số log > 20: lấy 20 lượt gần nhất, cộng thêm 10 lượt ngẫu nhiên từ các lượt còn lại.
 */
export const getNpcRichSummaries = (kb: KnowledgeBase, npcName: string): string[] => {
    if (!kb || !kb.ragHistoryLog || !npcName) return [];

    // Lọc các logs có richSummary và chứa tên NPC (không phân biệt hoa thường)
    const nameLower = npcName.toLowerCase();
    const relatedLogs = kb.ragHistoryLog
        .filter((log: any) => {
            if (!log || !log.richSummary) return false;
            const content = (log.content || log.richSummary || "").toLowerCase();
            return content.includes(nameLower);
        })
        // Sắp xếp theo thứ tự turn tăng dần (thời gian cũ đến mới)
        .sort((a: any, b: any) => (a.turn ?? 0) - (b.turn ?? 0));

    if (relatedLogs.length === 0) return [];

    if (relatedLogs.length <= 20) {
        // Nếu số lượt liên quan dưới hoặc bằng 20 thì lấy hết (đã sắp xếp từ cũ đến mới)
        return relatedLogs.map((log: any) => {
            const turn = log.turn ?? 0;
            return `<richsummary_${turn}>\n${log.richSummary.trim()}\n</richsummary_${turn}>`;
        });
    } else {
        // Có nhiều hơn 20 lượt.
        // 20 lượt gần nhất nằm ở cuối mảng
        const recent20 = relatedLogs.slice(-20);
        // Các lượt còn lại nằm ở đầu mảng
        const remainingLogs = relatedLogs.slice(0, relatedLogs.length - 20);

        // Lấy ngẫu nhiên 10 lượt từ các lượt còn lại
        const random10: any[] = [];
        const pool = [...remainingLogs];
        const countToSelect = Math.min(pool.length, 10);
        
        for (let i = 0; i < countToSelect; i++) {
            const randomIndex = Math.floor(Math.random() * pool.length);
            random10.push(pool[randomIndex]);
            pool.splice(randomIndex, 1);
        }

        // Sắp xếp lại các lượt ngẫu nhiên theo thứ tự thời gian tăng dần
        random10.sort((a: any, b: any) => (a.turn ?? 0) - (b.turn ?? 0));

        // Ghép 10 lượt ngẫu nhiên (xảy ra trước) và 20 lượt gần nhất (xảy ra sau)
        const combined = [...random10, ...recent20];
        return combined.map((log: any) => {
            const turn = log.turn ?? 0;
            return `<richsummary_${turn}>\n${log.richSummary.trim()}\n</richsummary_${turn}>`;
        });
    }
};

/**
 * Lấy rich summaries liên quan đến danh sách các NPC đang hoạt động:
 * - Chỉ đưa vào tối đa 10 lượt liên quan gần nhất (sắp xếp từ cũ đến mới để cốt truyện liên tục).
 * - Nếu có 2 thực thể cùng xuất hiện trong một rich summary thì chỉ lấy 1 lần duy nhất rich summary đó (de-duplicate theo turn).
 * - Bọc mỗi rich summary bằng thẻ XML <richsummary_X>
 */
export const getCombinedActiveNpcsRichSummaries = (kb: KnowledgeBase, npcNames: string[]): string => {
    if (!kb || !kb.ragHistoryLog || !npcNames || npcNames.length === 0) return "";

    const npcNamesLower = npcNames.map(name => name.toLowerCase());

    // 1. Lọc tất cả các log flash_agent có richSummary chứa ít nhất một trong các tên NPC hoạt động
    const relatedLogs = kb.ragHistoryLog.filter((log: any) => {
        if (!log || !log.richSummary) return false;
        const content = (log.content || log.richSummary || "").toLowerCase();
        return npcNamesLower.some(name => content.includes(name));
    });

    if (relatedLogs.length === 0) return "";

    // 2. Loại bỏ trùng lặp dựa trên turn để đảm bảo nếu 2 NPC cùng có mặt trong 1 log thì chỉ lấy log đó 1 lần
    const uniqueLogsMap = new Map<number, any>();
    for (const log of relatedLogs) {
        uniqueLogsMap.set(log.turn ?? 0, log);
    }

    // Chuyển lại thành mảng và sắp xếp theo thứ tự turn GIẢM DẦN (mới nhất đến cũ nhất) để lấy 10 lượt gần nhất
    const uniqueSortedLogs = Array.from(uniqueLogsMap.values())
        .sort((a: any, b: any) => (b.turn ?? 0) - (a.turn ?? 0));

    // 3. Chỉ lấy tối đa 10 lượt liên quan gần nhất
    const recent10Logs = uniqueSortedLogs.slice(0, 10);

    // Sắp xếp lại theo thứ tự thời gian TĂNG DẦN (từ cũ đến mới) để mạch truyện liên tục tự nhiên khi gửi vào prompt
    recent10Logs.sort((a: any, b: any) => (a.turn ?? 0) - (b.turn ?? 0));

    // 4. Bọc XML cho từng rich summary theo đúng định dạng yêu cầu
    const formattedSummaries = recent10Logs.map((log: any) => {
        const turn = log.turn ?? 0;
        return `<richsummary_${turn}>\n${log.richSummary.trim()}\n</richsummary_${turn}>`;
    });

    return formattedSummaries.join("\n\n");
};

