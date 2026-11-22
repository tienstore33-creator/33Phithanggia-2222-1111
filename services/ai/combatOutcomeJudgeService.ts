import { executeWithFallback } from '../../utils/modelFallback';
import { getCurrentlyUsedApiKeyByCategory, getApiSettings, getTaskModel } from '../apiService';
import { apiRunningService } from '../apiRunningService';

export interface JudgeOutcomeResult {
  outcome: 'victory' | 'defeat' | 'flee' | 'draw';
  summary: string;
}

/**
 * Phân tích nhật ký chiến đấu để xác định kết quả cuối cùng một cách chính xác.
 * Chặn lỗi phán thua oan khi kẻ địch đổi phe, đầu hàng, bỏ chạy hoặc hòa giải.
 */
export async function judgeCombatOutcome(
  combatMessages: string[],
  combatants: any[],
  playerName: string
): Promise<JudgeOutcomeResult> {
  const startTime = Date.now();
  const settings = getApiSettings();
  const apiKey = getCurrentlyUsedApiKeyByCategory('combat') || '';
  const modelName = getTaskModel('combat');

  // Xác định nhãn API Key đang dùng để ghi nhận log theo đúng quy tắc
  let apiKeyLabel = 'Key Hệ Thống';
  if (settings.apiKeySource === 'user') {
    const keys = (settings.userApiKeys || []).filter(k => k && k.trim() !== '');
    const idx = keys.indexOf(apiKey);
    apiKeyLabel = idx !== -1 ? `api key #${idx + 1}` : 'Key Cá Nhân';
  } else if (settings.apiKeySource === 'proxy') {
    apiKeyLabel = 'Proxy API';
  }

  const logPurpose = "Phán quyết kết quả trận đấu classic";
  const callerFile = "combatOutcomeJudgeService";

  const combatLogsText = combatMessages.join('\n');
  const combatantsSummary = combatants.map(c => 
    `- [${c.name}] (${c.id}): HP=${c.stats?.sinhLuc ?? 0}/${c.stats?.maxSinhLuc ?? 100}, Phe=${c.faction}`
  ).join('\n');

  const systemInstruction = `Bạn là một Trọng Tài Chiến Đấu vô tư và chuẩn xác. 
Nhiệm vụ của bạn là phân tích toàn bộ Nhật Ký Chiến Đấu và Danh Sách Nhân Vật bên dưới để đưa ra phán quyết về kết quả cuối cùng của trận đấu.

QUY TẮC PHÁN QUYẾT:
1. 'defeat': Chỉ phán 'defeat' khi Nhân vật chính (${playerName}) đã hết sạch sinh lực (HP <= 0), gục ngã hoặc bị tử vong.
2. 'flee': Phán 'flee' khi Nhân vật chính chủ động bỏ chạy thành công khỏi trận đấu.
3. 'draw': Phán 'draw' khi hai bên đình chiến, hòa hoãn, thỏa thuận dừng tay hoặc không thể tiếp tục phân thắng bại nhưng không bên nào thua cuộc.
4. 'victory': Phán 'victory' trong tất cả các trường hợp còn lại mà Nhân vật chính (${playerName}) vẫn còn sống (HP > 0):
   - Toàn bộ kẻ địch bị tiêu diệt (HP <= 0).
   - Kẻ địch bỏ chạy hoàn toàn hoặc đầu hàng.
   - Kẻ địch đổi phe gia nhập phe ta (chuyển sang phe 'ally').
   - Kẻ địch bị cảm hóa, quy phục hoặc không còn ý chí chiến đấu.

YÊU CẦU ĐẦU RA:
Trả về kết quả dưới định dạng JSON duy nhất như sau:
{
  "outcome": "victory" | "defeat" | "flee" | "draw",
  "summary": "Tóm tắt ngắn gọn lý do phân định kết quả (ví dụ: Kẻ địch đã quy phục và đổi sang phe ta, trận đấu kết thúc thắng lợi)."
}
TUYỆT ĐỐI KHÔNG viết thêm bất kỳ từ ngữ nào ngoài khối JSON.`;

  const prompt = `[NHẬT KÝ CHIẾN ĐẤU]
${combatLogsText}

[TRẠNG THÁI NHÂN VẬT CUỐI TRẬN]
${combatantsSummary}

Hãy phân tích và đưa ra kết quả JSON chính xác.`;

  try {
    const { text, modelUsed } = await executeWithFallback(
      prompt,
      apiKey,
      settings,
      'combat',
      systemInstruction,
      false,
      'application/json',
      [],
      logPurpose
    );

    const durationSeconds = ((Date.now() - startTime) / 1000).toFixed(1);
    
    // Ghi nhận dòng log bắt buộc theo đúng quy tắc của Luuyngudan5:
    // "api key #23 : gemini-3.6-flash : 6s : Tạo lời kể truyện : file sinh ra cuộc gọi api."
    console.log(`[API CALL] ${apiKeyLabel} : ${modelUsed} : ${durationSeconds}s : ${logPurpose} : ${callerFile}`);

    // Parse kết quả JSON một cách an toàn
    let cleanedText = text.trim();
    if (cleanedText.includes('```')) {
      cleanedText = cleanedText.replace(/```json/gi, '').replace(/```/gi, '').trim();
    }

    const parsed = JSON.parse(cleanedText);
    
    return {
      outcome: parsed.outcome || 'victory',
      summary: parsed.summary || 'Trận đấu kết thúc.'
    };
  } catch (error) {
    console.error("Lỗi khi gọi trọng tài AI phán định kết quả trận đấu:", error);
    const durationSeconds = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[API CALL FAILED] ${apiKeyLabel} : ${modelName} : ${durationSeconds}s : Lỗi phán quyết kết quả : ${callerFile}`);

    // Fallback cơ học cực kỳ an toàn nếu AI bị lỗi
    const isPlayerDefeated = combatants.find(c => c.id === 'player' || c.isPlayer)?.stats?.sinhLuc <= 0;
    if (isPlayerDefeated) {
      return { outcome: 'defeat', summary: 'Bạn đã bị đánh bại do cạn kiệt sinh lực.' };
    }

    // Nếu người chơi còn sống, kiểm tra xem kẻ địch phe 'enemy'/'neutral' còn ai sống hay không
    const enemyNpcs = combatants.filter(c => c.faction === 'enemy' || c.faction === 'neutral');
    const allEnemiesDefeated = enemyNpcs.length === 0 || enemyNpcs.every(c => (c.stats?.sinhLuc ?? 0) <= 0);
    
    if (allEnemiesDefeated) {
      return { outcome: 'victory', summary: 'Tất cả kẻ địch đã bị tiêu diệt hoặc thu phục.' };
    }

    // Mặc định cho phép thắng nếu người chơi còn sống (tránh ức chế khi đổi phe)
    return { outcome: 'victory', summary: 'Chiến thắng thuộc về bạn.' };
  }
}
