/**
 * Tiện ích thay thế các từ khóa "tu tiên", "quản trò", "game" trong nội dung thô gửi cho AI kể chuyện chính
 * thành "mô phỏng", "giả lập", "thế giới mô phỏng".
 */

export function replaceStoryKeywords(text: string): string {
  if (!text) return text;
  let result = text;

  // 1. Thay thế "tu tiên" -> "mô phỏng"
  result = result.replace(/tu\s+tiên/gi, (match) => {
    if (match === 'TU TIÊN') return 'MÔ PHỎNG';
    if (match.charAt(0) === 'T') return 'Mô phỏng';
    return 'mô phỏng';
  });

  // 2. Thay thế "quản trò" -> "giả lập"
  result = result.replace(/quản\s+trò/gi, (match) => {
    if (match === 'QUẢN TRÒ') return 'GIẢ LẬP';
    if (match.charAt(0) === 'Q') return 'Giả lập';
    return 'giả lập';
  });

  // 3. Thay thế "game" -> "thế giới mô phỏng"
  result = result.replace(/\bgame\b/gi, (match) => {
    if (match === 'GAME') return 'THẾ GIỚI MÔ PHỎNG';
    if (match.charAt(0) === 'G') return 'Thế giới mô phỏng';
    return 'thế giới mô phỏng';
  });

  return result;
}
