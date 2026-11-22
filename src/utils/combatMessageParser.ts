/**
 * combatMessageParser.ts
 * 
 * Bộ bóc tách và chuẩn hóa phản hồi từ AI trong Combat Neon Classic.
 * Đảm bảo:
 * - Trích xuất đúng phần suy nghĩ (<thinking>).
 * - Bóc tách chính xác <noi_dung> (kể cả khi viết hoa <NOI_DUNG>).
 * - Fallback thông minh: nếu thiếu thẻ mở, thiếu thẻ đóng hoặc không có thẻ <noi_dung>,
 *   sẽ hiển thị toàn bộ nội dung không nằm trong bất kỳ thẻ XML nào khác.
 * - Loại bỏ hoàn toàn khối [COMBAT_DATA_JSON] khỏi phần hiển thị lời kể.
 */

import { sanitizeOrphanXmlTags } from '../../utils/xmlSanitizerUtils';

export interface ParsedCombatMessageResult {
  thinking: string;
  content: string;
  statNotice: string;
  choicesText: string;        // Thêm mới trường bóc tách lựa chọn
  combatDataRaw: string;      // Thêm mới trường chứa JSON thô
}

export function parseCombatMessage(text: string): ParsedCombatMessageResult {
  if (!text || typeof text !== 'string') {
    return { thinking: '', content: '', statNotice: '', choicesText: '', combatDataRaw: '' };
  }

  // Làm sạch và xử lý các thẻ XML mồ côi (thay <tag>, </tag> thiếu cặp bằng -tag-)
  const sanitizedText = sanitizeOrphanXmlTags(text);
  const normalized = sanitizedText.normalize('NFC');
  let remainingText = normalized;

  // Trích xuất JSON thô hoặc XML thô trước khi xóa nó khỏi phần chữ mô tả
  let combatDataRaw = '';
  const jsonMatch = remainingText.match(/(\[COMBAT_DATA_JSON\][\s\S]*?(?:\[\/COMBAT_DATA_JSON\]|$))/i);
  if (jsonMatch) {
    combatDataRaw = jsonMatch[1].trim();
  } else {
    const xmlMatch = remainingText.match(/(<ket_qua_giao_tranh>[\s\S]*?(?:<\/ket_qua_giao_tranh>|$))/i);
    if (xmlMatch) {
      combatDataRaw = xmlMatch[1].trim();
    }
  }

  // Trích xuất thẻ choice thô
  let choicesText = '';
  const choiceMatch = remainingText.match(/(<choice>[\s\S]*?(?:<\/choice>|$))/i);
  if (choiceMatch) {
    choicesText = choiceMatch[1].trim();
  }

  // 1. Loại bỏ khối [COMBAT_DATA_JSON] hoặc <ket_qua_giao_tranh>
  remainingText = remainingText
    .replace(/\[COMBAT_DATA_JSON\][\s\S]*?(?:\[\/COMBAT_DATA_JSON\]|$)/gi, '')
    .replace(/<ket_qua_giao_tranh>[\s\S]*?(?:<\/ket_qua_giao_tranh>|$)/gi, '')
    .trim();

  // 2. Trích xuất thông báo chỉ số <thong_bao_chi_so>...</thong_bao_chi_so>
  let statNotice = '';
  const noticeMatch = remainingText.match(/<thong_bao_chi_so>([\s\S]*?)(?:<\/thong_bao_chi_so>|$)/i);
  if (noticeMatch) {
    statNotice = noticeMatch[1].trim();
    remainingText = remainingText.replace(/<thong_bao_chi_so>[\s\S]*?(?:<\/thong_bao_chi_so>|$)/gi, '').trim();
  }

  // 3. Trích xuất suy nghĩ <thinking>, <think>, <prethinking>, <tuong_than>
  let thinking = '';
  const thinkRegex = /<(?:thinking|think|prethinking|tuong_than)>([\s\S]*?)(?:<\/(?:thinking|think|prethinking|tuong_than)>|$)/gi;
  const thinkParts: string[] = [];
  let thinkMatch: RegExpExecArray | null;

  while ((thinkMatch = thinkRegex.exec(remainingText)) !== null) {
    if (thinkMatch[1] && thinkMatch[1].trim()) {
      thinkParts.push(thinkMatch[1].trim());
    }
  }

  if (thinkParts.length > 0) {
    thinking = thinkParts.join('\n\n');
    // Xóa bỏ các khối thinking ra khỏi chuỗi văn bản còn lại
    remainingText = remainingText
      .replace(/<(?:thinking|think|prethinking|tuong_than)>[\s\S]*?(?:<\/(?:thinking|think|prethinking|tuong_than)>|$)/gi, '')
      .trim();
  } else {
    // Kiểm tra marker văn bản "chuyển sang nội dung"
    const markerLower = 'chuyển sang nội dung';
    const markerIdx = remainingText.toLowerCase().indexOf(markerLower);
    if (markerIdx !== -1) {
      thinking = remainingText.substring(0, markerIdx).trim();
      remainingText = remainingText.substring(markerIdx + markerLower.length).trim();
      if (remainingText.startsWith(':')) {
        remainingText = remainingText.substring(1).trim();
      }
    }
  }

  // 4. Trích xuất nội dung lời kể (<noi_dung> hoặc <content>)
  let content = '';

  // Kiểm tra xem có thẻ mở <noi_dung> hoặc <content> không (không phân biệt hoa thường)
  const noiDungOpenRegex = /<(?:noi_dung|content)>/i;
  const openMatch = noiDungOpenRegex.exec(remainingText);

  if (openMatch) {
    const startIndex = openMatch.index + openMatch[0].length;
    const afterOpenTag = remainingText.substring(startIndex);
    
    // Tìm thẻ đóng </noi_dung> hoặc </content>
    const closeMatch = /<\/(?:noi_dung|content)>/i.exec(afterOpenTag);
    if (closeMatch) {
      // Trường hợp A: Có đủ thẻ mở và thẻ đóng
      content = afterOpenTag.substring(0, closeMatch.index).trim();
    } else {
      // Trường hợp B: Có thẻ mở nhưng thiếu thẻ đóng (hoặc đang stream)
      content = afterOpenTag.trim();
    }
  } else {
    // Trường hợp C: Không có thẻ mở <noi_dung> hoặc chỉ có thẻ đóng mồ côi
    // Loại bỏ tất cả các thẻ hệ thống khác nếu còn sót lại (<update_data>, <choice>, <choices>,...)
    let cleaned = remainingText
      .replace(/<update_data>[\s\S]*?(?:<\/update_data>|$)/gi, '')
      .replace(/<choices?>[\s\S]*?(?:<\/choices?>|$)/gi, '')
      .replace(/<\/?(?:noi_dung|content)>/gi, '') // Xóa thẻ đóng mồ côi nếu có
      .replace(/<\/?[a-zA-Z0-9_\-]+[^>]*>/g, '')  // Xóa mọi thẻ XML lạ còn sót
      .trim();

    content = cleaned;
  }

  // 5. Làm sạch ký tự rác và định dạng cuối
  const cleanFinal = (t: string) => {
    return t
      .replace(/<\/?(?:noi_dung|content|prethinking|tuong_than|thinking|think|thong_bao_chi_so)>/gi, '')
      .trim();
  };

  return {
    thinking: cleanFinal(thinking),
    content: cleanFinal(content),
    statNotice: cleanFinal(statNotice),
    choicesText,
    combatDataRaw
  };
}
