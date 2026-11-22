/**
 * Utility functions for extracting and processing system tags from text.
 */

/**
 * Extracts all system tags in the format [TAG_NAME: key="value"] or [TAG_NAME] from text.
 * Strictly limits extraction to "tags": [...] or <tags>...</tags> scope if available,
 * ignoring explanations/thinking content outside the designated area.
 * @param text The source text to scan for tags.
 * @returns An array of string tags.
 */
export const extractTagsFromText = (text: string): string[] => {
  if (!text) return [];
  
  let searchableText = text;

  // LƯU Ý MỚI BỔ SUNG: Chặn ngắt chuỗi, chỉ lấy phần đằng sau "tags": [ hoặc <tags> nếu có
  const jsonTagsIndex = searchableText.search(/"tags"\s*:\s*\[/i);
  const xmlTagsIndex = searchableText.search(/<tags>/i);

  // Nếu tìm thấy mảng tags trong JSON hoặc XML, ta cắt bỏ toàn bộ phần rác (tuong_than) đứng trước nó
  if (jsonTagsIndex !== -1) {
      searchableText = searchableText.substring(jsonTagsIndex);
  } else if (xmlTagsIndex !== -1) {
      searchableText = searchableText.substring(xmlTagsIndex);
  }

  // Isolate and exclude <phan_tich_+extraction_result>...</phan_tich_+extraction_result>
  // Also mechanically strip any thinking tags (<thinking>, <think>, unclosed thinking blocks)
  searchableText = searchableText
    .replace(/<phan_tich_\+extraction_result>[\s\S]*?<\/phan_tich_\+extraction_result>/gi, '')
    .replace(/<phan_tich_\+[\s\S]*?<\/phan_tich_\+[\s\S]*?>/gi, '')
    .replace(/<(thinking|think)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<(thinking|think)[^>]*>[\s\S]*?(?=(?:<(?:content|narration|update_data|choice|choices|branches|json_data|tags)|$))/gi, '')
    .replace(/<\/?(thinking|think)[^>]*>/gi, '');

  const tagRegex = /\[([A-Z_]+)(?::\s*((?:[^\[\]]|\[(?:[^\[\]]|\[[^\[\]]*\])*\])*))?\]/gi;
  const extractedTags = new Set<string>();
  let match;
  
  while ((match = tagRegex.exec(searchableText)) !== null) {
    const tagName = match[1];
    const tagParams = match[2] ? `: ${match[2].trim()}` : '';
    extractedTags.add(`[${tagName}${tagParams}]`);
  }
  
  return Array.from(extractedTags);
};

/**
 * Appends a biography/description segment by formatting it as a turn list entry.
 */
export const appendFormattedDescription = (
  oldDesc: string,
  newDescPart: string,
  turn: number,
  isNewMeet: boolean = false
): string => {
  if (!newDescPart) return oldDesc;
  
  const cleanedPart = newDescPart.trim();
  if (cleanedPart === "") return oldDesc;

  // Check if it already starts with a turn indicator [Lượt or [Luợt
  if (/^\[L[uự]ợt\s*\d+\s*:/i.test(cleanedPart)) {
    if (!oldDesc) return cleanedPart;
    const spacer = oldDesc.endsWith("\n") ? "" : "\n";
    return oldDesc + spacer + cleanedPart;
  }

  const typeStr = isNewMeet ? "Gặp mặt" : "cập nhật";
  const newBlock = `[Luợt ${turn}:${typeStr}] ${cleanedPart}`;

  if (!oldDesc) {
    return newBlock;
  }

  const spacer = oldDesc.endsWith("\n") ? "" : "\n";
  return oldDesc + spacer + newBlock;
};

