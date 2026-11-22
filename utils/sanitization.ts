/**
 * Sanitizes narrative text by removing system tags and control sequences.
 * This acts as a safety net if the LLM leaks control tags into the content block.
 */
export const sanitizeNarrative = (text: string): string => {
  if (!text) return '';
  
  // 1. Remove system tags in format [TAG: ...] or [TAG]
  // This handles tags like [CHANGE_TIME: ngay=2], [STATS_UPDATE: ...], etc.
  const tagRegex = /\[[A-Z_]+(?::\s*((?:[^\[\]]|\[[^\[\]]*\])*))?\]/g;
  
  // 2. Remove malformed tag leftovers (e.g., "[CHANGE_TIME] +210d" or list items after [STATS_UPDATE])
  // This is a more aggressive cleanup for the specific leak shown in the user's image.
  const malformedLeakRegex = /\[[A-Z_]+\]\s*(?:[+-]\d+[a-z]?|(?:\n\s*-\s*.*)+)/gi;

  // 3. Remove XML-like tags if they leak (e.g., <content>, <update_data>, <memory>, <critical>)
  const xmlTagRegex = /<\/?(content|update_data|thinking|memory|critical|choice|choices|branches|system_message|cot_truyen)[^>]*>/gi;

  return text
    .replace(malformedLeakRegex, '')
    .replace(tagRegex, '')
    .replace(xmlTagRegex, '')
    .trim();
};
