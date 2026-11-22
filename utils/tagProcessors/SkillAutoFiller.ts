import { KnowledgeBase } from '../../types';
import * as GameTemplates from '../../templates';

/**
 * Fills in missing parameters for skills based on player level or world context.
 */
export const SkillAutoFiller = {
  fill: (skill: any, kb: KnowledgeBase): any => {
    const filled = { ...skill };
    const level = kb.playerStats.level || 1;

    // Auto-fill power/damage if missing or 0
    if (!filled.baseDamage || filled.baseDamage === '0' || filled.baseDamage === 0) {
      if (filled.skillType === GameTemplates.SkillType.LINH_KI) {
        filled.baseDamage = (10 + level * 5).toString();
      } else if (filled.skillType === GameTemplates.SkillType.THAN_THONG) {
        filled.baseDamage = (50 + level * 20).toString();
      } else {
        filled.baseDamage = (5 + level * 2).toString();
      }
    }

    // Auto-fill mana cost if missing or 0
    if (!filled.manaCost || filled.manaCost === '0' || filled.manaCost === 0) {
      filled.manaCost = (5 + Math.floor(level / 2)).toString();
    }

    // Auto-fill description if missing
    if (!filled.description) {
      filled.description = `Một kỹ năng thuộc loại ${filled.skillType} giúp gia tăng thực lực.`;
    }

    return filled;
  }
};
