import { KnowledgeBase, Skill } from '../types';
import { INITIAL_KNOWLEDGE_BASE, MAX_AUTO_SAVE_SLOTS } from '../constants';
import { COMBAT_MODE_SKILLS } from '../templates';

/**
 * Cập nhật lại logic/chỉ số của các kỹ năng đã chuyển hóa dựa trên template mới nhất.
 * Giúp các file save cũ luôn được cập nhật các cơ chế chiến đấu mới.
 */
export const refreshTransformedSkills = (skills: Skill[]): Skill[] => {
    if (!skills || !Array.isArray(skills)) return [];
    
    return skills.map(skill => {
        // Nếu kỹ năng đã chuyển hóa và có coreSkillName, hoặc tên bắt đầu bằng "combat "
        const nameLower = (skill.name || '').toLowerCase();
        const coreName = skill.coreSkillName || (nameLower.startsWith('combat ') ? skill.name : null);
        
        if (coreName) {
            const template = COMBAT_MODE_SKILLS.find(s => s.name === coreName);
            if (template) {
                // Giữ lại các trường meta của skill cũ, nhưng cập nhật effect và mpCost từ template mới
                return {
                    ...skill,
                    ...template,
                    id: skill.id, // Giữ nguyên ID
                    name: skill.name, // Giữ nguyên tên hiển thị (trường hợp người chơi đã đổi tên)
                    coreSkillName: template.name,
                    isTransformed: true
                };
            }
        }
        return skill;
    });
};

/**
 * Gộp dữ liệu KnowledgeBase từ file save cũ với cấu trúc mặc định hiện tại.
 * Đảm bảo các mảng/object mới thêm vào game không bị undefined.
 */
export const mergeKnowledgeBase = (savedKb: Partial<KnowledgeBase>): KnowledgeBase => {
    // Clone cấu trúc mặc định để làm nền tảng
    const mergedKb = JSON.parse(JSON.stringify(INITIAL_KNOWLEDGE_BASE)) as KnowledgeBase;

    // Hàm đệ quy để gộp sâu (deep merge) các object, nhưng giữ nguyên mảng của file save nếu có
    const deepMerge = (target: any, source: any) => {
        for (const key in source) {
            if (source[key] === undefined || source[key] === null) continue;
            
            if (Array.isArray(source[key])) {
                // Nếu là mảng, lấy mảng từ file save (không merge từng phần tử)
                target[key] = source[key];
            } else if (typeof source[key] === 'object') {
                // Nếu là object, đệ quy để merge các thuộc tính con (ví dụ: playerStats)
                if (!target[key]) target[key] = {};
                deepMerge(target[key], source[key]);
            } else {
                // Primitive values
                target[key] = source[key];
            }
        }
    };

    deepMerge(mergedKb, savedKb);

    // Refresh skills logic from latest templates
    if (mergedKb.playerSkills) {
        mergedKb.playerSkills = refreshTransformedSkills(mergedKb.playerSkills);
    }

    // Ensure autoSaveSlotIds has the correct length (e.g. when loading old saves with fewer slots)
    if (mergedKb.autoSaveSlotIds.length < MAX_AUTO_SAVE_SLOTS) {
        const padding = Array(MAX_AUTO_SAVE_SLOTS - mergedKb.autoSaveSlotIds.length).fill(null);
        mergedKb.autoSaveSlotIds = [...mergedKb.autoSaveSlotIds, ...padding];
    }

    return mergedKb;
};
