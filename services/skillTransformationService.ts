import { Skill, OfflineCombatSkill } from '../types';

/**
 * Dịch vụ xử lý logic chuyển hóa kỹ năng
 */
export const skillTransformationService = {
  /**
   * Bước 1: Quét các kỹ năng đủ điều kiện
   */
  scanEligibleSkills: (currentSkills: Skill[]): Skill[] => {
    if (!currentSkills || !Array.isArray(currentSkills)) return [];
    return currentSkills.filter(skill => {
      if (!skill || !skill.name) return false;
      const nameLower = skill.name.trim().toLowerCase();
      
      const hasCombatPrefix = nameLower.startsWith('combat ') || 
                              nameLower.startsWith('combat_') || 
                              nameLower.startsWith('combat:') ||
                              nameLower === 'combat';
      
      return !hasCombatPrefix && !skill.isTransformed && skill.isTransformable !== false;
    });
  },

  /**
   * Bước 3: Thực hiện chuyển hóa (Merge dữ liệu với Combat Skill cốt lõi)
   */
  applyTransformation: (baseSkill: Skill, combatSkill: OfflineCombatSkill, customDescription?: string): Skill => {
    return {
      ...baseSkill,
      ...combatSkill, // Ghi đè chỉ số chiến đấu
      id: baseSkill.id, // Đảm bảo ID không đổi
      name: baseSkill.name, // Giữ nguyên tên gốc (do người chơi/AI tạo)
      description: customDescription || `${combatSkill.description} (Cốt lõi: ${combatSkill.name})`,
      isTransformed: true,
      transformedAt: Date.now(),
      // Lưu tên kỹ năng cốt lõi để nhận diện
      coreSkillName: combatSkill.name,
      // Giữ lại meta dữ liệu của baseSkill if needed
      level: baseSkill.level || 1,
      proficiency: baseSkill.proficiency || 0,
    };
  }
};
