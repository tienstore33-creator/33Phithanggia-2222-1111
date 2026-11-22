/**
 * Xử lý và vô hiệu hóa các thẻ XML mồ côi trong văn bản phản hồi của AI
 * 
 * Quy tắc:
 * 1. Nếu có đủ cả thẻ mở và thẻ đóng: Ghép cặp từ thẻ đóng ngược lên thẻ mở gần nhất trước nó.
 * 2. Các thẻ mở/đóng thừa thãi, mồ côi bên ngoài: Đổi < > thành - (ví dụ: -thinking-, -/thinking-)
 */
export function sanitizeOrphanXmlTags(rawText: string): string {
  if (!rawText || typeof rawText !== 'string') return '';

  // Regex tìm tất cả các thẻ dạng <tag> hoặc </tag>
  const tagRegex = /<\/?([a-zA-Z0-9_\-]+)[^>]*>/g;
  
  interface TagMatch {
    full: string;
    tagName: string;
    isClosing: boolean;
    index: number;
    length: number;
  }

  const matches: TagMatch[] = [];
  let match: RegExpExecArray | null;
  while ((match = tagRegex.exec(rawText)) !== null) {
    const isClosing = match[0].startsWith('</');
    matches.push({
      full: match[0],
      tagName: match[1].toLowerCase(),
      isClosing,
      index: match.index,
      length: match[0].length,
    });
  }

  if (matches.length === 0) return rawText;

  // Tìm các cặp hợp lệ: duyệt từ trái sang phải, khi gặp thẻ đóng, tìm thẻ mở cùng tên gần nhất trước nó chưa được ghép cặp
  const matchedOpenIndices = new Set<number>();
  const matchedCloseIndices = new Set<number>();

  for (let i = 0; i < matches.length; i++) {
    if (matches[i].isClosing) {
      // Quét ngược lại để tìm thẻ mở gần nhất chưa ghép cặp
      for (let j = i - 1; j >= 0; j--) {
        if (!matches[j].isClosing && matches[j].tagName === matches[i].tagName && !matchedOpenIndices.has(j)) {
          matchedOpenIndices.add(j);
          matchedCloseIndices.add(i);
          break;
        }
      }
    }
  }

  // Xây dựng lại chuỗi: biến đổi các thẻ mồ côi thành dạng -tag-
  let result = '';
  let lastIndex = 0;

  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    // Thêm đoạn văn bản giữa các thẻ
    result += rawText.slice(lastIndex, m.index);

    const isMatched = m.isClosing ? matchedCloseIndices.has(i) : matchedOpenIndices.has(i);
    if (isMatched) {
      // Giữ nguyên thẻ XML hợp lệ
      result += m.full;
    } else {
      // Thẻ mồ côi: Đổi < > thành +
      const sanitized = '+' + m.full.slice(1, -1) + '+';
      result += sanitized;
    }
    lastIndex = m.index + m.length;
  }
  result += rawText.slice(lastIndex);

  return result;
}

/**
 * Cơ chế cơ học loại bỏ hoàn toàn các thẻ <tuong_than>, </tuong_than> hoặc khối <tuong_than>...</tuong_than>
 * Áp dụng cho mọi tác vụ gọi API
 */
export function removeTuongThanTag(text: string): string {
  if (!text || typeof text !== 'string') return '';
  // Chỉ xóa các thẻ nhãn <tuong_than> hoặc </tuong_than>, bảo vệ tuyệt đối ruột XML bên trong
  return text.replace(/<\/?tuong_than[^>]*>/gi, '');
}

/**
 * Làm sạch văn bản: Loại bỏ hoàn toàn các cặp thẻ <thinking>...</thinking> hợp lệ
 * sau khi đã xử lý thẻ mồ côi
 */
export function removeThinkingBlocks(text: string): string {
  const sanitized = sanitizeOrphanXmlTags(text);
  return sanitized
    .replace(/<(thinking|think|phan_tich|tu_tuong|tư_tưởng|thought)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .trim();
}

