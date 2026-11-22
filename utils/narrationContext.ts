import { GameMessage } from '../types';
import { NARRATION_CONTEXT_HISTORY_LENGTH } from '../constants';

// Trích xuất bối cảnh lời kể gần nhất (Mặc định 20 lượt để khớp với TURNS_PER_PAGE)
export const getRecentNarrations = (messages: GameMessage[], limit: number = NARRATION_CONTEXT_HISTORY_LENGTH): string => {
  const narrations = messages
    .filter(m => m.type === 'narration')
    .slice(-limit);
    
  return narrations.map(m => `<narration>${m.content}</narration>`).join('\n');
};
