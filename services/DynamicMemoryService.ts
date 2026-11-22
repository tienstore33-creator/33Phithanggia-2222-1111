import { KnowledgeBase, StoryBibleEntry, LorebookEntry, AiContextEntry } from '../types';
import { searchVectors } from '../utils/vectorStore';

/**
 * 1. REGEX INPUT CLEANING (Input Processing)
 */
export const cleanUserInput = (input: string): string => {
  if (!input) return "";
  
  let cleaned = input;

  // Bước 1: Loại bỏ thẻ HTML/Script nếu có (ngăn chặn Prompt Injection cơ bản)
  cleaned = cleaned.replace(/<[^>]*>?/gm, '');

  // Bước 2: Chuẩn hóa khoảng trắng (Nhiều dấu cách/tab/xuống dòng -> 1 dấu cách)
  cleaned = cleaned.replace(/\s+/g, ' ');

  // Bước 3: Loại bỏ các ký tự điều khiển (ASCII 0-31) và các ký tự "rác" không in được
  cleaned = cleaned.replace(/[\u0000-\u001F\u007F-\u009F]/g, "");

  // Bước 4: Trim khoảng trắng đầu cuối
  cleaned = cleaned.trim();

  // Bước 5: Chặn các chuỗi ký tự lặp lại vô nghĩa (ví dụ: "aaaaaaa", "!!!!!!!")
  cleaned = cleaned.replace(/(.)\1{10,}/g, '$1$1'); // Giới hạn lặp lại tối đa 2 lần cho chuỗi 10+ ký tự

  return cleaned;
};

/**
 * 2. RETRIEVAL LAYERS
 */

// Layer A: StoryBible (Priority & Sticky)
export const getStoryBibleContext = (kb: KnowledgeBase): string[] => {
  const bible = kb.storyBible || [];
  // Sort by priority (asc)
  const sorted = [...bible].sort((a, b) => a.priority - b.priority);
  // Filter for context
  return sorted
    .filter(entry => entry.sticky || entry.weight > 0.5)
    .map(entry => `[CORE LORE: ${entry.keyword}] ${entry.content}`);
};

// Layer B: Lorebook (Keyword triggers)
export const getLorebookContext = (input: string, kb: KnowledgeBase): string[] => {
  const lorebook = kb.lorebook || [];
  const triggered: string[] = [];
  const lowerInput = input.toLowerCase();

  lorebook.forEach(entry => {
    if (!entry.isActive) return;
    const isTriggered = entry.keywords.some(kw => lowerInput.includes(kw.toLowerCase()));
    if (isTriggered) {
      triggered.push(`[LORE: ${entry.keywords[0]}] ${entry.content}`);
    }
  });

  return triggered;
};

/**
 * 3. TOKEN BUDGETING & SLICING (String version)
 */
export const sliceHistoryString = (history: string, maxTokens: number = 2000): string => {
  if (!history) return "";
  
  // Split history into chunks (messages)
  const lines = history.split("\n---\n");
  let currentTokens = 0;
  const sliced: string[] = [];
  
  // Iterate backwards to keep recent context
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    const estimatedTokens = line.length * 0.25;
    if (currentTokens + estimatedTokens > maxTokens) break;
    sliced.unshift(line);
    currentTokens += estimatedTokens;
  }
  
  return sliced.join("\n---\n");
};

export const sliceHistory = (history: AiContextEntry[], maxTokens: number = 2000): AiContextEntry[] => {
  // Ưu tiên các lượt gần nhất
  // Giả sử trung bình 1 char = 0.25 token (đơn giản hóa)
  let currentTokens = 0;
  const sliced: AiContextEntry[] = [];
  
  for (let i = history.length - 1; i >= 0; i--) {
    const entry = history[i];
    const estimatedTokens = entry.text.length * 0.25;
    if (currentTokens + estimatedTokens > maxTokens) break;
    sliced.unshift(entry);
    currentTokens += estimatedTokens;
  }
  
  return sliced;
};

/**
 * ORCHESTRATOR
 */
export const prepareDynamicMemory = async (
  input: string,
  kb: KnowledgeBase,
  ragTopK: number = 3
): Promise<{
    processedInput: string;
    contextLayers: {
        priority: number;
        order: number;
        content: string;
    }[];
}> => {
  const processedInput = cleanUserInput(input);

  // Chạy song song các bộ lọc context
  const storyBible = getStoryBibleContext(kb);
  const lorebook = getLorebookContext(processedInput, kb);

  const result = {
    processedInput,
    contextLayers: [
      ...storyBible.map((c, i) => ({ priority: 1, order: i, content: c })),
      ...lorebook.map((c, i) => ({ priority: 2, order: i, content: c })),
    ]
  };

  // Sắp xếp theo priority trước, nếu bằng nhau thì theo order
  result.contextLayers.sort((a, b) => a.priority - b.priority || a.order - b.order);

  return result;
};
