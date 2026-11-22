import { Difficulty } from '../src/types/game';
import { DIFFICULTY_SETTINGS } from '../constants/difficulty';
import { KnowledgeBase } from '../types';

/**
 * Rolls for custom input availability based on current difficulty.
 * @param difficulty The current game difficulty string.
 * @returns boolean True if custom input is allowed.
 */
export const rollCustomInputRestriction = (difficulty: string): boolean => {
  // Map string difficulty to enum
  const diffEnum = (difficulty.toUpperCase() === 'DỄ' ? Difficulty.EASY :
                    difficulty.toUpperCase() === 'THƯỜNG' ? Difficulty.NORMAL :
                    difficulty.toUpperCase() === 'KHÓ' ? Difficulty.HARD :
                    difficulty.toUpperCase() === 'ÁC MỘNG' ? Difficulty.NIGHTMARE :
                    Difficulty.NORMAL) as Difficulty;

  const settings = DIFFICULTY_SETTINGS[diffEnum] || DIFFICULTY_SETTINGS[Difficulty.NORMAL];
  const chance = settings.customInputChance;
  
  const roll = Math.random() * 100;
  console.log(`[DIFFICULTY-ROLL] Difficulty: ${difficulty}, Chance: ${chance}%, Roll: ${roll.toFixed(1)}`);
  
  return roll <= chance;
};

/**
 * Updates the knowledge base with a new roll for custom input restriction.
 */
export const updateKnowledgeBaseWithInputRoll = (kb: KnowledgeBase): KnowledgeBase => {
  const difficulty = kb.worldConfig?.difficulty || 'Thường';
  const isAllowed = rollCustomInputRestriction(difficulty);
  
  return {
    ...kb,
    isCustomInputAllowed: isAllowed
  };
};
