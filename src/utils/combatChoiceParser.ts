/**
 * combatChoiceParser.ts
 * 
 * Bóc tách các tag [CHOICE: "..."] và thẻ <choice>...</choice> khỏi phản hồi AI
 */

export interface ParseChoicesResult {
  cleanText: string;
  choices: string[];
}

export function parseCombatChoices(rawText: string): ParseChoicesResult {
  if (!rawText) {
    return { cleanText: '', choices: [] };
  }

  const choices: string[] = [];

  // 1. Tìm khối <choice>...</choice>
  const choiceBlockRegex = /<choice>([\s\S]*?)<\/choice>/gi;
  let blockMatch: RegExpExecArray | null;

  while ((blockMatch = choiceBlockRegex.exec(rawText)) !== null) {
    const blockContent = blockMatch[1];
    const itemRegex = /\[CHOICE:\s*"([^"]+)"\]/gi;
    let itemMatch: RegExpExecArray | null;
    while ((itemMatch = itemRegex.exec(blockContent)) !== null) {
      if (itemMatch[1] && itemMatch[1].trim()) {
        choices.push(itemMatch[1].trim());
      }
    }
  }

  // 2. Nếu không nằm trong thẻ <choice>, quét trực tiếp tag [CHOICE: "..."]
  if (choices.length === 0) {
    const itemRegex = /\[CHOICE:\s*"([^"]+)"\]/gi;
    let itemMatch: RegExpExecArray | null;
    while ((itemMatch = itemRegex.exec(rawText)) !== null) {
      if (itemMatch[1] && itemMatch[1].trim()) {
        choices.push(itemMatch[1].trim());
      }
    }
  }

  // 3. Làm sạch văn bản: xóa bỏ thẻ <choice>...</choice> và tag [CHOICE: ...]
  let cleanText = rawText
    .replace(/<choice>[\s\S]*?<\/choice>/gi, '')
    .replace(/\[CHOICE:\s*"[^"]+"\]/gi, '')
    .trim();

  return {
    cleanText,
    choices
  };
}
