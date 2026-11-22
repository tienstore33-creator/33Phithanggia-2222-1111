import { Difficulty } from '../types/game';
import { DIFFICULTY_SETTINGS } from '../../constants/difficulty';

export const calculateAffinity = (currentGain: number, difficulty: Difficulty) => {
  const cap = DIFFICULTY_SETTINGS[difficulty].maxAffinityGain;
  return Math.min(currentGain, cap);
};
