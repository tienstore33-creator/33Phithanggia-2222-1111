import { COMBAT_MODE_SKILLS, SkillTemplate, SkillType } from '../templates';
import { NPC, Wife, Slave, Prisoner } from '../types';

/**
 * Tự động gán kỹ năng cho các thực thể nếu chúng chưa có kỹ năng.
 * @param entities Mảng các thực thể (NPC, Wife, Slave, Prisoner)
 * @returns true nếu có ít nhất một thực thể được cập nhật
 */
export const autoAssignNpcSkills = (entities: any[]): boolean => {
    if (!entities || !Array.isArray(entities)) return false;
    let hasChanged = false;
    
    entities.forEach(entity => {
        // Kiểm tra nếu thực thể chưa có kỹ năng hoặc mảng kỹ năng rỗng
        if (!entity.skills || entity.skills.length === 0) {
            // Chọn ngẫu nhiên 2 kỹ năng từ danh sách mẫu
            const shuffled = [...COMBAT_MODE_SKILLS].sort(() => 0.5 - Math.random());
            const selectedSkills = shuffled.slice(0, 2).map((s, i) => {
                const skillId = `auto_${entity.id}_${i}_${Date.now()}`;
                
                // Chuyển đổi từ OfflineCombatSkill sang SkillTemplate
                const newSkill: SkillTemplate = {
                    id: skillId,
                    name: s.name,
                    description: s.description,
                    manaCost: s.mpCost,
                    effect: s.effect,
                    // Các giá trị mặc định cho SkillTemplate
                    skillType: SkillType.LINH_KI,
                    detailedEffect: s.description,
                    damageMultiplier: 1,
                    baseDamage: 0,
                    healingAmount: 0,
                    healingMultiplier: 0
                };
                return newSkill;
            });
            
            entity.skills = selectedSkills;
            hasChanged = true;
            console.log(`[Auto-Skill] Đã gán 2 kỹ năng cho: ${entity.name} (ID: ${entity.id})`);
        }
    });
    
    return hasChanged;
};
