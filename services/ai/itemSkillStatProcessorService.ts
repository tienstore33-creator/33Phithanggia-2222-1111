import { getAiClient } from '../aiClient';
import { getApiSettings, getCurrentlyUsedApiKeyByCategory } from '../apiService';
import { getModelChainForTask } from '../../utils/modelFallback';
import { apiKeyManager } from '../../utils/apiKeyManager';
import { apiRunningService } from '../apiRunningService';
import { Item, Skill, PlayerStats, StatusEffect } from '../../types';
import { applyThinkingConfig } from '../../utils/thinkingLevelUtils';

export interface ProcessedStatChanges {
  systemLogs: string;
  statDeltas: {
    hp?: number;
    maxHp?: number;
    mana?: number;
    maxMana?: number;
    atk?: number;
    exp?: number;
    maxExp?: number;
    currency?: number;
    thoNguyen?: number;
  };
  status?: string;
  statusDuration?: number;
  skillsLearned?: Omit<Skill, 'id'>[];
  itemsConsumed?: { id: string; quantity: number }[];
}

/**
 * Sử dụng Gemini để phân tích tác dụng cơ học của việc dùng vật phẩm/kỹ năng lên chỉ số và trạng thái.
 */
export async function processItemSkillStats(
  selectedItems: Item[],
  selectedSkills: Skill[],
  playerStats: PlayerStats,
  playerName: string,
  playerGender: string
): Promise<ProcessedStatChanges> {
  const startTime = Date.now();
  const category = 'economy'; // Phân loại tài nguyên, túi đồ dùng economy làm model xử lý
  const settings = getApiSettings();
  const purpose = 'Phân tích cơ học sử dụng vật phẩm và kỹ năng lên chỉ số';
  const modelChain = getModelChainForTask(category, settings);
  const isProxy = settings.apiKeySource === 'proxy';

  const allUserKeys = (settings.userApiKeys || []).filter(k => k && k.trim() !== '');
  const validUserKeys = apiKeyManager.filterValidKeys(allUserKeys);
  const activeKey = getCurrentlyUsedApiKeyByCategory(category) || '';

  let keysToTry = isProxy ? ['proxy'] : (validUserKeys.length > 0 ? validUserKeys : ['system-key']);
  if (!isProxy && validUserKeys.length > 0 && activeKey && validUserKeys.includes(activeKey)) {
    keysToTry = [activeKey, ...validUserKeys.filter(k => k !== activeKey)];
  }

  const itemsPayload = selectedItems.map(item => ({
    id: item.id,
    name: item.name,
    description: item.description,
    quantity: item.quantity || 1,
    rarity: (item as any).rarity || 'Thường',
    type: (item as any).type || 'Khác'
  }));

  const skillsPayload = selectedSkills.map(skill => ({
    id: skill.id,
    name: skill.name,
    description: skill.description
  }));

  const statsPayload = {
    hp: playerStats.sinhLuc,
    maxHp: playerStats.maxSinhLuc,
    mana: playerStats.linhLuc,
    maxMana: playerStats.maxLinhLuc,
    atk: playerStats.sucTanCong,
    exp: playerStats.kinhNghiem,
    maxExp: playerStats.maxKinhNghiem,
    realm: playerStats.realm,
    currency: playerStats.currency,
    thoNguyen: playerStats.thoNguyen || 100
  };

  const promptText = `
<qui_tac_tinh_toan_chi_so_+dung_vat_pham_ky_nang>
================
Bạn là bộ máy tính toán chỉ số & trạng thái cơ học (Stat & State Calculator) cho game tu tiên "Phi Thăng Giả".
Hãy phân tích danh sách vật phẩm và kỹ năng mà nhân vật ${playerName} (Giới tính: ${playerGender}) lựa chọn sử dụng đồng thời, đối chiếu với trạng thái chỉ số hiện tại để sinh kết quả tính toán thay đổi dưới dạng JSON thuần túy.

BẮT BUỘC TUÂN THỦ NGUYÊN TẮC QUYẾT ĐỊNH (CRITICAL DECISION PRINCIPLES):
- Người chơi đang cố tình áp dụng/sử dụng tất cả các vật phẩm và kỹ năng đã chọn TRỰC TIẾP LÊN BẢN THÂN MC (như tư duy của một đứa trẻ 3 tuổi đầy tò mò, nghịch ngợm hoặc liều lĩnh).
- Số lượng (quantity) trong DANH SÁCH VẬT PHẨM ĐƯỢC CHỌN SỬ DỤNG là số lượng CỤ THỂ mà người chơi muốn sử dụng. Bạn phải tính toán tác động nhân lên dựa theo số lượng này và phải liệt kê tiêu hao chính xác số lượng này trong danh sách "itemsConsumed" trả về.
- TUYỆT ĐỐI KHÔNG ĐƯỢC BỎ QUA HOẶC TUYÊN BỐ "Giữ nguyên trong hành trang không kích hoạt hiệu ứng". Mọi vật phẩm được chọn dùng ĐỀU PHẢI có tác động vật lý/ma pháp cụ thể lên cơ thể MC và bị tiêu hao đúng số lượng đã chọn khỏi hành trang (đưa vào "itemsConsumed").

HƯỚNG DẪN TÁC ĐỘNG CHI TIẾT THEO TỪNG THỂ LOẠI VẬT PHẨM:
1. Kiếm, Đao, Binh khí, Thương, Ám khí sắt nhọn (Thanh Phong Kiếm, Cửu Thiên Đao,...):
   - MC tự đâm, tự chém vào tay/chân hoặc nghịch ngợm cắt trúng da thịt.
   - Hậu quả: Giảm Sinh Lực cực nặng (hp từ -50 đến -300 tùy cấp độ hiếm/tấn công của vũ khí), gán trạng thái xấu "Xuất Huyết" hoặc "Chấn Thương" kéo dài 3-5 lượt. Vũ khí bị gãy, mẻ hoặc mất sau khi tự đâm (đưa vào "itemsConsumed" với quantity: 1).
2. Chất độc, Độc dược, Túi độc, Độc trùng (Túi Độc Nhầy, Độc Đan...):
   - MC bóp vỡ, uống thử, hoặc bôi lên người vì tò mò.
   - Hậu quả: Giảm mạnh Sinh Lực (hp từ -150 đến -500), nhận trạng thái "Trúng Độc Kịch Liệt" giảm HP mỗi lượt (status, statusDuration: 3-6 lượt). Tiêu hao vật phẩm đó.
3. Cuộn giấy cổ, Ngọc giản, Cuộn da bí ẩn, Sách bí kíp:
   - MC tập trung đọc hiểu, chiêm nghiệm và hấp thu tri thức tinh hoa.
   - Hậu quả: Lĩnh hội thành công và nhận thêm ngẫu nhiên Linh khí/Kinh nghiệm (exp +30 đến +300), tăng thọ nguyên nhẹ, hoặc học được kỹ năng mới (thêm vào "skillsLearned" một kỹ năng hoàn chỉnh với level 1). Tuyệt đối không gây tổn hại sinh lực hay mất máu. Tiêu hao cuộn giấy/sách đó (đưa vào "itemsConsumed").
4. Bùa chú công kích, Bùa nổ, Sách bị nguyền rủa, Trận pháp bộc phá:
   - MC tò mò kích hoạt thử cự ly gần hoặc mở phong ấn sách bị ám mà không phòng vệ.
   - Hậu quả: Bùa phát nổ hoặc tà khí phản phệ dội thẳng vào người MC. Giảm mạnh Sinh Lực (hp từ -80 đến -300), tiêu hao Linh Lực (mana -20 đến -50), nhận trạng thái xấu như "Bỏng Nặng", "Nguyền Rủa" hoặc "Tâm Thần Hỗn Loạn" (status, statusDuration: 3-5 lượt). Tiêu hao bùa chú/vật phẩm đó.
5. Đan dược hằng ngày, Linh thạch, Thuốc bổ:
   - Nuốt trực tiếp -> Hồi HP (hp dương), hồi Linh lực (mana dương) hoặc tăng EXP (exp dương). Tiêu hao đan dược.
6. Áo choàng, Giáp trụ, Khăn trùm:
   - MC trùm lên đầu không thở được hoặc mặc ngược gây vướng víu.
   - Hậu quả: Giảm nhẹ HP (hp -10 đến -30), nhận trạng thái "Ngạt Thở" hoặc "Vướng Víu" (-Atk, -Phòng ngự). Tiêu hao giáp/áo đó.
7. Sử dụng kỹ năng chủ động (như chiêu thức chiến đấu, Chém Chém...):
   - MC tự vận công xuất chiêu vô định tại chỗ.
   - Hậu quả: Tiêu tốn Linh lực (mana âm từ -10 đến -50), nhận phản phệ nhẹ hoặc tăng tạm thời sức mạnh.

CHỈ SỐ HIỆN TẠI CỦA NGƯỜI CHƠI:
${JSON.stringify(statsPayload, null, 2)}

DANH SÁCH VẬT PHẨM ĐƯỢC CHỌN SỬ DỤNG:
${JSON.stringify(itemsPayload, null, 2)}

DANH SÁCH KỸ NĂNG ĐƯỢC CHỌN SỬ DỤNG:
${JSON.stringify(skillsPayload, null, 2)}

YÊU CẦU ĐỊNH DẠNG TRẢ VỀ:
Trả về duy nhất 1 khối JSON hợp lệ theo cấu trúc sau (không chứa bất kỳ dòng text giới thiệu hay giải thích nào ngoài khối JSON):
{
  "systemLogs": "Tóm tắt tác động cụ thể, chi tiết, hóm hỉnh và chân thực theo phong cách tu tiên (mỗi dòng là một đầu dòng) hiển thị chính xác chuyện gì xảy ra khi MC tự dùng những thứ này lên cơ thể mình. Nêu rõ thay đổi chỉ số.",
  "statDeltas": {
    "hp": -150, // Lượng thay đổi của Sinh Lực (âm nếu mất, dương nếu hồi)
    "maxHp": 0, // Thay đổi maxHP (nếu có)
    "mana": -20, // Lượng thay đổi của Linh Lực
    "maxMana": 0,
    "atk": 0, // Lượng thay đổi của Sức Tấn Công
    "exp": 100, // Lượng thay đổi Kinh Nghiệm
    "maxExp": 0,
    "currency": 0, // Thay đổi tiền bạc/linh thạch (nếu có)
    "thoNguyen": 0 // Thay đổi thọ nguyên
  },
  "status": "Xuất Huyết", // Trạng thái mới của người chơi (nếu có, để trống nếu không đổi)
  "statusDuration": 4, // Số lượt duy trì trạng thái (nếu có)
  "skillsLearned": [
    { "name": "Tên kỹ năng ngẫu nhiên học được từ cuộn giấy", "description": "Mô tả chi tiết kỹ năng dị thường học được" }
  ],
  "itemsConsumed": [
    { "id": "id-vật-phẩm-tiêu-hao", "quantity": 1 }
  ]
}
================
</qui_tac_tinh_toan_chi_so_+dung_vat_pham_ky_nang>
`.trim();

  let lastError: any = null;

  for (let i = 0; i < modelChain.length; i++) {
    const currentModel = modelChain[i];
    let keyIdx = 0;

    while (keyIdx < keysToTry.length) {
      const apiKeyToUse = keysToTry[keyIdx];
      const apiKeyLabelToUse = isProxy ? 'Proxy API' : (apiKeyToUse === 'system-key' ? 'Key Hệ Thống' : `API Key #${allUserKeys.indexOf(apiKeyToUse) + 1}`);

      const ai = getAiClient(settings, apiKeyToUse, category);
      const contents = [
        {
          role: 'user',
          parts: [{ text: promptText }]
        }
      ];

      const requestPayloadStr = JSON.stringify({ model: currentModel, purpose }, null, 2);
      const taskId = apiRunningService.start(currentModel, apiKeyLabelToUse, purpose, requestPayloadStr);

      try {
        const elapsedSeconds = ((Date.now() - startTime) / 1000).toFixed(1) + 's';
        console.log(`[API CALL INFO] Source: ${settings.apiKeySource} | ${apiKeyLabelToUse} : ${currentModel} : ${elapsedSeconds} : ${purpose} : services/ai/itemSkillStatProcessorService.ts`);

        const response = await ai.models.generateContent({
          model: currentModel,
          contents: contents,
          config: applyThinkingConfig(currentModel, {}, settings)
        });

        const text = response?.text?.trim();
        apiRunningService.stop(taskId, text);

        if (text) {
          // Parse JSON sạch sẽ
          let cleanJson = text;
          if (cleanJson.includes('```json')) {
            cleanJson = cleanJson.split('```json')[1].split('```')[0].trim();
          } else if (cleanJson.includes('```')) {
            cleanJson = cleanJson.split('```')[1].split('```')[0].trim();
          }
          
          try {
            const parsed: ProcessedStatChanges = JSON.parse(cleanJson);
            return parsed;
          } catch (jsonErr) {
            console.warn("[itemSkillStatProcessor] JSON Parse error, retrying custom cleanup", jsonErr);
            // Fallback parse simple regex-based or throw to try next model/key
            const firstBrace = cleanJson.indexOf('{');
            const lastBrace = cleanJson.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace !== -1) {
              const parsedFallback = JSON.parse(cleanJson.substring(firstBrace, lastBrace + 1));
              return parsedFallback;
            }
            throw jsonErr;
          }
        }
      } catch (err: any) {
        apiRunningService.stop(taskId, err?.message || String(err));
        lastError = err;
        console.warn(`[itemSkillStatProcessor] Error with model ${currentModel} on key ${apiKeyLabelToUse}:`, err);
        break; // Ưu tiên chuyển sang Model tiếp theo trong modelChain
      }
    }
  }

  throw lastError || new Error("Không thể xử lý chỉ số sử dụng vật phẩm và kỹ năng thông qua AI. Vui lòng kiểm tra cấu hình.");
}
