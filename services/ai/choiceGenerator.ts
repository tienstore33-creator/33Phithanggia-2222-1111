
import { KnowledgeBase } from '../../types';
import { CHOICE_SYSTEM_INSTRUCTION } from '../../prompts/choicePrompts';

/**
 * Xây dựng phần prompt hướng dẫn tạo lựa chọn dựa trên tính cách nhân vật.
 */
export const buildChoicePrompt = (kb: KnowledgeBase): string => {
  const personality = kb.worldConfig?.playerPersonality || "Bình thường";
  return CHOICE_SYSTEM_INSTRUCTION(personality);
};
