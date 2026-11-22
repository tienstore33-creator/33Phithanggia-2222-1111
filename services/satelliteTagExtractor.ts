import { extractTagsFromText } from '../utils/tagUtils';

/**
 * Trích xuất tag an toàn cho các tác vụ vệ tinh độc lập ngoài luồng Storyteller chính.
 * Giải quyết triệt để lỗi parseAiResponseText trả về tags: [].
 */
export const extractSatelliteTags = (rawText: string, fallbackTags?: string[]): string[] => {
  if (!rawText) {
    return Array.isArray(fallbackTags) ? fallbackTags : [];
  }
  const extracted = extractTagsFromText(rawText);
  if (extracted && extracted.length > 0) {
    return extracted;
  }
  if (Array.isArray(fallbackTags) && fallbackTags.length > 0) {
    return fallbackTags;
  }
  return [];
};

/**
 * Duyệt các tag đã trích xuất từ văn bản và map vào object dữ liệu thế giới / nhân vật.
 */
export const mapTagsToWorldData = (
  content: string,
  mapperFn: (tagName: string, params: string, targetObj: any) => void,
  targetObj: any
) => {
  const tags = extractSatelliteTags(content);
  tags.forEach(tag => {
    const match = tag.match(/\[([A-Z_]+)(?::\s*([\s\S]*?))?\]/);
    if (match) {
      mapperFn(match[1], match[2] || '', targetObj);
    }
  });
  return targetObj;
};
