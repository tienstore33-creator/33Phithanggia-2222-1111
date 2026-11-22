import { StartingSkill } from '../../types';
import * as GameTemplates from '../../templates';

/**
 * Sanitizes raw skill data from AI to ensure it follows the expected format.
 */
export const SkillSanitizer = {
  sanitize: (rawSkill: any): any => {
    const sanitized: any = {
      ...rawSkill,
      name: typeof rawSkill.name === 'string' ? rawSkill.name.trim() : (rawSkill.skillName || 'Kỹ năng vô danh'),
      description: typeof rawSkill.description === 'string' ? rawSkill.description.trim() : (rawSkill.desc || ''),
      skillType: rawSkill.skillType || rawSkill.type || rawSkill.category || GameTemplates.SkillType.LINH_KI,
      baseDamage: rawSkill.baseDamage || rawSkill.power || '0',
      manaCost: rawSkill.manaCost || rawSkill.mana || '0',
      id: rawSkill.id || `skill_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    };

    // Normalize skillType
    if (rawSkill.skillType === 'Võ kỹ' || rawSkill.type === 'Võ kỹ') sanitized.skillType = GameTemplates.SkillType.LINH_KI;
    else if (rawSkill.skillType === 'Công pháp' || rawSkill.type === 'Công pháp') sanitized.skillType = GameTemplates.SkillType.CONG_PHAP_TU_LUYEN;
    else if (rawSkill.skillType === 'Tâm pháp' || rawSkill.type === 'Tâm pháp') sanitized.skillType = GameTemplates.SkillType.CONG_PHAP_TU_LUYEN;
    else if (rawSkill.skillType === 'Thân pháp' || rawSkill.type === 'Thân pháp') sanitized.skillType = GameTemplates.SkillType.LINH_KI;
    else if (rawSkill.skillType === 'Công Pháp Tu Luyện' || rawSkill.type === 'Công Pháp Tu Luyện') sanitized.skillType = GameTemplates.SkillType.CONG_PHAP_TU_LUYEN;
    else if (rawSkill.skillType === 'Linh kĩ' || rawSkill.type === 'Linh kĩ') sanitized.skillType = GameTemplates.SkillType.LINH_KI;
    else if (rawSkill.skillType === 'Thần thông' || rawSkill.type === 'Thần thông') sanitized.skillType = GameTemplates.SkillType.THAN_THONG;
    else if (rawSkill.skillType === 'Cấm thuật' || rawSkill.type === 'Cấm thuật') sanitized.skillType = GameTemplates.SkillType.CAM_THUAT;
    else if (rawSkill.skillType === 'Nghề nghiệp' || rawSkill.type === 'Nghề nghiệp') sanitized.skillType = GameTemplates.SkillType.NGHE_NGHIEP;

    return sanitized;
  }
};
