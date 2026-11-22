import { getAiClient } from '../aiClient';
import { getApiSettings, getCurrentlyUsedApiKeyByCategory } from '../apiService';
import { getModelChainForTask } from '../../utils/modelFallback';
import { apiKeyManager } from '../../utils/apiKeyManager';
import { apiRunningService } from '../apiRunningService';
import { applyThinkingConfig } from '../../utils/thinkingLevelUtils';

/**
 * Trích xuất mimeType và dữ liệu base64 từ data url hoặc chuỗi base64 thô.
 */
function prepareInlineData(imageDataOrUrl: string): { mimeType: string; data: string } {
  if (imageDataOrUrl.startsWith('data:')) {
    const matches = imageDataOrUrl.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
    if (matches && matches.length === 3) {
      return {
        mimeType: matches[1],
        data: matches[2]
      };
    }
    const commaIndex = imageDataOrUrl.indexOf(',');
    if (commaIndex !== -1) {
      return {
        mimeType: 'image/jpeg',
        data: imageDataOrUrl.slice(commaIndex + 1)
      };
    }
  }
  return {
    mimeType: 'image/jpeg',
    data: imageDataOrUrl
  };
}

/**
 * Xử lý nạp dữ liệu ảnh base64 từ Data URL hoặc URL mạng.
 */
async function resolveImageInlineData(imageDataOrUrl: string): Promise<{ mimeType: string; data: string }> {
  if (imageDataOrUrl.startsWith('data:')) {
    return prepareInlineData(imageDataOrUrl);
  }
  if (imageDataOrUrl.startsWith('http://') || imageDataOrUrl.startsWith('https://')) {
    try {
      const resp = await fetch(imageDataOrUrl);
      const blob = await resp.blob();
      const mimeType = blob.type || 'image/jpeg';
      const arrayBuffer = await blob.arrayBuffer();
      let binary = '';
      const bytes = new Uint8Array(arrayBuffer);
      const len = bytes.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const data = btoa(binary);
      return { mimeType, data };
    } catch (e) {
      console.warn("Could not fetch remote image URL directly, using fallback", e);
    }
  }
  return prepareInlineData(imageDataOrUrl);
}

/**
 * Phân tích thị giác diện mạo bên ngoài của nhân vật dựa trên ảnh đại diện bằng Gemini Vision.
 */
export async function analyzeAvatarAppearance(
  imageDataOrUrl: string,
  characterName: string,
  gender: string
): Promise<string> {
  const startTime = Date.now();
  const category = 'main';
  const settings = getApiSettings();
  const purpose = 'Phân tích chi tiết diện mạo từ ảnh';
  const modelChain = getModelChainForTask(category, settings);
  const isProxy = settings.apiKeySource === 'proxy';

  const allUserKeys = (settings.userApiKeys || []).filter(k => k && k.trim() !== '');
  const validUserKeys = apiKeyManager.filterValidKeys(allUserKeys);
  const activeKey = getCurrentlyUsedApiKeyByCategory(category) || '';

  let keysToTry = isProxy ? ['proxy'] : (validUserKeys.length > 0 ? validUserKeys : ['system-key']);
  if (!isProxy && validUserKeys.length > 0 && activeKey && validUserKeys.includes(activeKey)) {
    keysToTry = [activeKey, ...validUserKeys.filter(k => k !== activeKey)];
  }

  const inlineData = await resolveImageInlineData(imageDataOrUrl);

  const promptText = `
<phan_tich_dien_mao>
  <quy_tac_+phan_tich_dien_mao>
================
Bạn là chuyên gia phân tích hình ảnh nhân vật. Hãy quan sát bức ảnh được cung cấp của nhân vật ${characterName} (${gender || 'Không rõ'}) và miêu tả chi tiết, chính xác diện mạo bên ngoài:
- Trang phục & Đường cong thân hình (TẬP TRUNG TĂNG CƯỜNG):
  + Mô tả tổng thể: Kiểu dáng tổng thể của bộ trang phục (y phục cổ phong, hiện đại, váy đầm, áo dài, áo quần ngủ...), phong cách và gam màu sắc chủ đạo.
  + Những điểm nổi bật: Các chi tiết thiết kế đặc trưng, điểm nhấn nổi bật trên trang phục (như đường viền, cổ áo, tay áo, vạt xẻ tà, hoa văn họa tiết thêu, nếp gấp, cúc cài, dây thắt hay phụ kiện đi kèm).
  + Chất liệu trang phục: Nhận diện rõ chất liệu vải (như lụa tơ tằm, phi bóng, satin, voan mềm mỏng, gấm, ren, nhung, vải dệt, thun ôm co giãn...), độ rủ, độ bắt sáng óng ả, độ mỏng nhẹ hoặc độ ôm của vải.
  + Đường cong thân hình khi mặc trang phục: Khắc họa rõ các đường cong vóc dáng và đường nét cơ thể của nhân vật được phô diễn hoặc ôm sát qua lớp y phục trong ảnh (như khuôn ngực đầy đặn hay thanh mảnh, đường thắt eo thon gọn, bờ hông cong mềm mại, vóc dáng nở nang quyến rũ hay mảnh mai thể hiện qua form dáng trang phục đang mặc).
- Mái tóc: Độ dài, kiểu tóc (xõa, búi, buộc đuôi ngựa...), màu tóc.
- Khuôn mặt & Biểu cảm: Đường nét khuôn mặt, ánh mắt, ngũ quan và biểu cảm cụ thể trên khuôn mặt (ví dụ: nụ cười mỉm, ánh mắt sắc lẹm/mệt mỏi/hoảng sợ, nét mặt thanh thản, nhíu mày, dịu dàng...).
- Tình trạng da & Dấu vết ngoại hình: Tình trạng cụ thể của làn da (màu da, độ mịn màng, hoặc các vết tích hiển thị thực tế trên ảnh như mồ hôi, vết sẹo, vết bẩn, vệt máu, độ nhợt nhạt hoặc ửng hồng...).
- YÊU CẦU BẮT BUỘC: Trả về một đoạn văn miêu tả khách quan, giàu hình tượng, chân thực và mạch lạc (khoảng 3 đến 5 câu), không thêm thắt bối cảnh hư cấu hay các thuật ngữ tu tiên.
================
  </quy_tac_+phan_tich_dien_mao>
  <luat_loai_bo_tu_the_+phan_tich_dien_mao>
================
TUYỆT ĐỐI KHÔNG miêu tả các tư thế hành động hay cử chỉ tức thời của tay chân trong ảnh (như giơ tay lên đầu, chống tay xuống giường, ngồi xổm, tạo dáng chụp ảnh...). Tập trung trọn vẹn vào diện mạo tĩnh, trang phục và đường nét vóc dáng/đường cong thân hình vì tư thế hành động sẽ liên tục thay đổi trong diễn biến câu chuyện.
================
  </luat_loai_bo_tu_the_+phan_tich_dien_mao>
</phan_tich_dien_mao>
`.trim();

  let lastError: any = null;

  for (let i = 0; i < modelChain.length; i++) {
    const currentModel = modelChain[i];
    let keyIdx = 0;

    while (keyIdx < keysToTry.length) {
      const apiKeyToUse = keysToTry[keyIdx];
      const apiKeyLabelToUse = isProxy ? 'Proxy API' : (apiKeyToUse === 'system-key' ? 'Key Hệ Thống' : `API Key #${allUserKeys.indexOf(apiKeyToUse) + 1}`);

      const ai = getAiClient(settings, apiKeyToUse, 'main');
      const contents = [
        {
          role: 'user',
          parts: [
            { text: promptText },
            {
              inlineData: {
                mimeType: inlineData.mimeType,
                data: inlineData.data
              }
            }
          ]
        }
      ];

      const requestPayloadStr = JSON.stringify({ model: currentModel, purpose }, null, 2);
      const taskId = apiRunningService.start(currentModel, apiKeyLabelToUse, purpose, requestPayloadStr);

      try {
        const elapsedSeconds = ((Date.now() - startTime) / 1000).toFixed(1) + 's';
        console.log(`[API CALL INFO] Source: ${settings.apiKeySource} | ${apiKeyLabelToUse} : ${currentModel} : ${elapsedSeconds} : ${purpose} : services/ai/avatarAnalysisService.ts`);

        const response = await ai.models.generateContent({
          model: currentModel,
          contents: contents,
          config: applyThinkingConfig(currentModel, {}, settings)
        });

        const text = response?.text?.trim();
        apiRunningService.stop(taskId, text);

        if (text) {
          return text;
        }
      } catch (err: any) {
        apiRunningService.stop(taskId, err?.message || String(err));
        lastError = err;
        console.warn(`[AvatarAnalysis] Error with model ${currentModel} on key ${apiKeyLabelToUse}:`, err);
        break; // Ưu tiên chuyển sang Model tiếp theo trong modelChain
      }
    }
  }

  throw lastError || new Error("Không thể phân tích ảnh đại diện. Vui lòng kiểm tra lại kết nối và cấu hình API.");
}
