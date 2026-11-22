import { KnowledgeBase, ParsedAiResponse } from '../../types';
import { getApiSettings, callGeminiAPI } from '../apiService';
import { parseAiResponseText, getEnforcedSystemInstruction } from '../geminiService';
import { generateGameResponseStream } from '../geminiStreamService';
import { AutoCombatResult, FleeCombatResult } from '../../src/logic/pendingCombatManager';

/**
 * Xây dựng prompt cho AI tạo lời kể hậu quả sau khi Tự Động Chiến Đấu.
 */
export function buildAutoCombatOutcomePrompt(
    kb: KnowledgeBase,
    autoResult: AutoCombatResult,
    currentPageMessagesLog: string = "",
    previousPageSummaries: string[] = [],
    lastNarration?: string
): string {
    const { summary } = autoResult;
    const playerName = kb.worldConfig?.playerName || "Người chơi";
    const playerRealm = kb.playerStats?.realm || "Phàm Nhân";
    const isVictory = summary.isVictory;

    const userInput = `<user_input>
User Input Mới Nhất: "Hệ thống vừa thực hiện Tự Động Chiến Đấu. Kết quả trận chiến: ${isVictory ? 'CHIẾN THẮNG VANG DỘI' : 'BẠI TRẬN NẶNG NỀ'}."
</user_input>`;

    const contextSection = `<ket_qua_tu_dong_chien_dau_+boi_canh_su_kien>
================
- TÌNH TRẠNG KẾT QUẢ: ${isVictory ? 'Phe ta toàn thắng, tiêu diệt hoặc đánh đuổi kẻ thù' : 'Phe ta thảm bại, bị thương tích nghiêm trọng'}
- THỰC LỰC CHIẾN ĐẤU:
  + Phe Người Chơi & Đồng Minh: ${summary.allyPower.toLocaleString()} lực chiến
  + Phe Địch Thủ: ${summary.enemyPower.toLocaleString()} lực chiến
  + Tỉ lệ thắng ước tính: ${(summary.winProbability * 100).toFixed(1)}%
- CHI TIẾT THƯƠNG VONG:
  + Kẻ địch tử trận: ${summary.deadOpponents.length > 0 ? summary.deadOpponents.join(', ') : 'Không có'}
  + Kẻ địch tẩu thoát / sống sót: ${summary.survivingOpponents.length > 0 ? summary.survivingOpponents.join(', ') : 'Không có'}
  + Đồng minh tử trận: ${summary.deadAllies.length > 0 ? summary.deadAllies.join(', ') : 'Không có'}
- TÌNH TRẠNG NHÂN VẬT CHÍNH (${playerName} - ${playerRealm}):
  + Tổn thất Sinh Lực: -${summary.playerHpLoss.toLocaleString()} HP
  + Sinh Lực hiện tại: ${summary.playerRemainingHp.toLocaleString()} HP
- CHIẾN LỢI PHẨM / KINH NGHIỆM THU ĐƯỢC:
  + Linh Thạch: +${summary.lootedMoney.toLocaleString()}
  + Kinh Nghiệm Tu Vi: +${summary.gainedExp.toLocaleString()} EXP
================
</ket_qua_tu_dong_chien_dau_+boi_canh_su_kien>`;

    const instructionSection = `<yeu_cau_ke_chuyen_+qui_trinh_hau_qua>
================
1. Hãy viết một đoạn văn kể chuyện (150-300 từ) miêu tả kịch tính, sống động khoảnh khắc tàn cuộc của trận chiến này:
   - Nếu Thắng Lợi: Miêu tả uy thế xuất chiêu dứt điểm của ${playerName}, sự kinh hoàng của kẻ địch khi tử trận hoặc tháo chạy, cảm giác thu hoạch chiến lợi phẩm và ổn định khí tức.
   - Nếu Thất Bại: Miêu tả sức ép khủng khiếp từ đối thủ, khoảnh khắc ${playerName} bị trọng thương gục ngã, sự rút lui đầy chật vật hoặc tình cảnh nguy nan trước khi tạm thời thoát khỏi móng vuốt quân thù.
2. Giữ vững văn phong tiên hiệp, huyền huyễn, kiếm hiệp cổ phong, giàu hình tượng và cảm xúc.
3. Xuất đúng 3 lựa chọn hành động tiếp theo trong thẻ <choices> để người chơi tiếp tục khám phá thế giới.
4. Có thể bổ sung các tag trạng thái cơ học nếu cần thiết (ví dụ: [HP_CHANGE], [EXP_ADD]...), tuy nhiên kết quả cơ học chính đã được hệ thống cập nhật.
================
</yeu_cau_ke_chuyen_+qui_trinh_hau_qua>`;

    let logsHistory = "";
    if (lastNarration) {
        logsHistory += `\n<dien_bien_truoc_+boi_canh_su_kien>\n================\n${lastNarration}\n================\n</dien_bien_truoc_+boi_canh_su_kien>\n`;
    }

    return `${userInput}\n\n${contextSection}\n\n${instructionSection}${logsHistory}`;
}

/**
 * Xây dựng prompt cho AI tạo lời kể hậu quả sau khi Bỏ Chạy (Flee Combat).
 */
export function buildFleeOutcomePrompt(
    kb: KnowledgeBase,
    fleeResult: FleeCombatResult,
    currentPageMessagesLog: string = "",
    previousPageSummaries: string[] = [],
    lastNarration?: string
): string {
    const { penaltyDetails } = fleeResult;
    const playerName = kb.worldConfig?.playerName || "Người chơi";

    const userInput = `<user_input>
User Input Mới Nhất: "Nhận thấy thế trận bất lợi hiểm nghèo, nhân vật chính ${playerName} đã quyết định thi triển bí pháp liều mạng BỎ CHẠY khỏi chiến trường."
</user_input>`;

    const contextSection = `<ket_qua_dao_tau_+boi_canh_su_kien>
================
- KẾT QUẢ: Đào tẩu thành công 100% khỏi vòng vây trùng điệp của đối phương.
- HẬU QUẢ CƠ HỌC VÀ TỔN THẤT ĐÃ ÁP DỤNG:
  + Tụt 1 tiểu cảnh giới: Từ [${penaltyDetails.oldRealm}] rớt xuống [${penaltyDetails.newRealm}] (Toàn bộ EXP tích lũy bị xóa sạch do đứt gãy kinh mạch).
  + Thất lạc tài sản: Đánh rơi -${penaltyDetails.lostMoney.toLocaleString()} Linh Thạch trong lúc tháo chạy hỗn loạn (còn lại: ${penaltyDetails.remainingMoney.toLocaleString()} Linh Thạch).
  + Mối quan hệ rạn nứt: Toàn bộ đối tượng tham chiến (${penaltyDetails.affectedNpcNames.join(', ') || 'các NPC có mặt'}) đều bị giảm -50 điểm thiện cảm do thái độ hèn nhát bỏ chạy hoặc căm hận vì để vuột mất con mồi.
================
</ket_qua_dao_tau_+boi_canh_su_kien>`;

    const instructionSection = `<yeu_cau_ke_chuyen_+qui_trinh_hau_qua>
================
1. Hãy viết một đoạn văn kể chuyện (150-250 từ) miêu tả cuộc đào tẩu nghẹt thở:
   - Miêu tả nỗ lực liều mạng tháo chạy, cảm giác khí huyết cuộn trào, đan điền chấn động khi cảnh giới bị thụt lùi từ ${penaltyDetails.oldRealm} xuống ${penaltyDetails.newRealm}.
   - Cảm giác tiếc nuối khi đánh rơi túi trữ vật chứa linh thạch, cùng tiếng la ó, truy sát hoặc cười nhạo từ kẻ địch phía sau.
2. Giữ nguyên không khí cổ phong tiên hiệp u tối, kịch tính, lột tả sâu sắc cái giá đắt của việc giữ mạng.
3. Xuất đúng 3 lựa chọn hành động tiếp theo trong thẻ <choices> (ví dụ: tìm nơi ẩn nấp trị thương, kiểm tra túi đồ còn lại, âm thầm lập kế phục thù...).
================
</yeu_cau_ke_chuyen_+qui_trinh_hau_qua>`;

    let logsHistory = "";
    if (lastNarration) {
        logsHistory += `\n<dien_bien_truoc_+boi_canh_su_kien>\n================\n${lastNarration}\n================\n</dien_bien_truoc_+boi_canh_su_kien>\n`;
    }

    return `${userInput}\n\n${contextSection}\n\n${instructionSection}${logsHistory}`;
}

export interface PendingCombatNarrationOutput {
    response: ParsedAiResponse;
    rawText: string;
}

/**
 * Gọi AI sinh lời kể truyện và lựa chọn sau khi Tự Động Chiến Đấu hoặc Bỏ Chạy.
 */
export async function generatePendingCombatNarration(
    prompt: string,
    kb: KnowledgeBase,
    purpose: string = "Tạo lời kể hậu quả chiến đấu tự động",
    onChunk?: (chunk: string) => void,
    signal?: AbortSignal
): Promise<PendingCombatNarrationOutput> {
    const apiSettings = getApiSettings();
    const { useDeepReasoning, slowThinking, apiKeySource } = apiSettings;
    const isProxy = apiKeySource === 'proxy';

    const systemInstruction = getEnforcedSystemInstruction(
        true,
        1500,
        1800,
        kb.isNsfwSceneActive,
        kb,
        undefined,
        useDeepReasoning,
        slowThinking
    );

    let rawText = "";
    if (onChunk) {
        rawText = await generateGameResponseStream(
            prompt,
            'main',
            onChunk,
            signal,
            undefined,
            systemInstruction,
            false,
            'main',
            undefined,
            undefined,
            purpose,
            isProxy,
            isProxy ? "</tuong_than>\n<thinking>\n" : ""
        );
    } else {
        const res = await callGeminiAPI(
            prompt,
            undefined,
            'main',
            undefined,
            systemInstruction,
            undefined,
            undefined,
            undefined,
            undefined,
            purpose,
            undefined,
            isProxy,
            isProxy ? "</tuong_than>\n<thinking>\n" : ""
        );
        rawText = res.text;
    }

    return {
        response: parseAiResponseText(rawText),
        rawText
    };
}
