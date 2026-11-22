
import * as GameTemplates from '../templates';
import { WEAPON_TYPES_FOR_VO_Y } from '../constants';

/**
 * Generates the system rules for the [SKILL_LEARNED] tag.
 * This prompt is designed to ensure the AI provides complete and valid skill data.
 */
export const generateSkillTagPrompt = (): string => {
    return `
**QUY TẮC HỌC KỸ NĂNG [SKILL_LEARNED] (CẬP NHẬT V2.0):**
Khi nhân vật học được kỹ năng mới, bạn PHẢI sử dụng tag \`[SKILL_LEARNED: ...]\` với đầy đủ các tham số sau để đảm bảo hệ thống xử lý chính xác.

1. **THUỘC TÍNH CHUNG (BẮT BUỘC):**
   - \`name\`: Tên kỹ năng (VD: "Hỏa Cầu Thuật", "Kim Cang Quyền").
   - \`description\`: Mô tả ngắn gọn về kỹ năng.
   - \`skillType\`: Chọn một trong: ${Object.values(GameTemplates.SkillType).join(' | ')}.
   - \`otherEffects\`: Mô tả các hiệu ứng đặc biệt (VD: "Gây bỏng", "Tăng phòng thủ").

2. **THUỘC TÍNH CHIẾN ĐẤU (BẮT BUỘC nếu là kỹ năng chủ động/chiến đấu):**
   - \`manaCost\`: Lượng linh lực tiêu hao (Số nguyên).
   - \`baseDamage\`: Sát thương cơ bản (Số nguyên).
   - \`cooldown\`: Thời gian hồi chiêu (Số lượt).
   - \`damageMultiplier\`: Hệ số sát thương (Số thập phân, VD: 1.2).


`;
};
