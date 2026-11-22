/**
 * Hàm làm sạch nội dung lời kể của lượt truyện (Narration Content)
 * Chỉ giữ lại nội dung bên trong thẻ <content>...</content> (nếu có),
 * hoặc văn bản thường nằm ngoài các thẻ bị loại bỏ hoàn toàn như <prethinking>, <tuong_than>, <thinking>, <update_data>, <choice>, <choices>,...
 */
export function extractNarrationContent(rawText: string): string {
  if (!rawText || typeof rawText !== 'string') return '';

  // 1. Tìm mốc phân chia nội dung thực sự dựa trên "Bắt đầu viết", </thinking>, hoặc <content>
  const anchors = ["Bắt đầu viết", "</thinking>", "<content>"];
  let lastAnchorIndex = -1;
  let anchorLength = 0;

  for (const anchor of anchors) {
    const index = rawText.lastIndexOf(anchor);
    if (index > lastAnchorIndex) {
      lastAnchorIndex = index;
      anchorLength = anchor.length;
    }
  }

  // Nếu tìm thấy mốc, lấy toàn bộ nội dung phía sau mốc đó
  if (lastAnchorIndex !== -1) {
    let contentAfterAnchor = rawText.substring(lastAnchorIndex + anchorLength).trim();
    
    // Loại bỏ thẻ đóng </content> nếu có ở cuối
    contentAfterAnchor = contentAfterAnchor.replace(/<\/content>\s*$/gi, '').trim();
    
    // Loại bỏ các thẻ hệ thống khác còn sót lại (update_data, choice, etc.)
    const tagsToRemove = [
      'update_data',
      'choice',
      'choices',
      'branches',
      'system_message',
      'cot_truyen',
      'flash_summary',
      'narrative_rules',
      'status_update',
      'quest_update'
    ];

    let cleaned = contentAfterAnchor;
    for (const tag of tagsToRemove) {
      const regex = new RegExp(`<${tag}[^>]*>[\\s\\S]*?<\\/${tag}>`, 'gi');
      cleaned = cleaned.replace(regex, '');
      const openRegex = new RegExp(`<${tag}[^>]*>`, 'gi');
      const closeRegex = new RegExp(`<\\/${tag}>`, 'gi');
      cleaned = cleaned.replace(openRegex, '').replace(closeRegex, '');
    }

    // Loại bỏ bất kỳ thẻ XML mồ côi nào khác
    cleaned = cleaned.replace(/<\/?[a-zA-Z0-9_\-]+[^>]*>/g, '');

    return cleaned.trim();
  }

  // Fallback nếu không tìm thấy mốc (trường hợp hiếm)
  // Bước 1: Kiểm tra xem có thẻ <content>...</content> hợp lệ không
  const contentRegex = /<content[^>]*>([\s\S]*?)<\/content>/gi;
  const matches: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = contentRegex.exec(rawText)) !== null) {
    if (match[1] && match[1].trim()) {
      matches.push(match[1].trim());
    }
  }

  // Nếu tìm thấy nội dung bọc trong thẻ <content>, trả về các khối nội dung đó ghép lại
  if (matches.length > 0) {
    return matches.join('\n\n').trim();
  }

  // Bước 2: Trường hợp không có thẻ <content> (text thường không tag hoặc bị thiếu thẻ)
  // Tiến hành loại bỏ hoàn toàn các thẻ đen và nội dung bên trong của chúng
  const unwantedTags = [
    'prethinking',
    'tuong_than',
    'thinking',
    'think',
    'update_data',
    'choice',
    'choices',
    'narrative_rules',
    'status_update',
    'quest_update'
  ];

  let cleaned = rawText;
  for (const tag of unwantedTags) {
    const regex = new RegExp(`<${tag}[^>]*>[\\s\\S]*?<\\/${tag}>`, 'gi');
    cleaned = cleaned.replace(regex, '');
  }

  // Xóa các thẻ XML mồ côi hoặc không đóng còn sót lại của các tag đen này (nếu có)
  for (const tag of unwantedTags) {
    const openRegex = new RegExp(`<${tag}[^>]*>`, 'gi');
    const closeRegex = new RegExp(`<\\/${tag}>`, 'gi');
    cleaned = cleaned.replace(openRegex, '').replace(closeRegex, '');
  }

  // Loại bỏ bất kỳ thẻ đóng/mở XML nào khác (nhưng giữ nội dung chữ) để tránh lỗi định dạng gửi cho AI
  cleaned = cleaned.replace(/<\/?[a-zA-Z0-9_\-]+[^>]*>/g, '');

  return cleaned.trim();
}
