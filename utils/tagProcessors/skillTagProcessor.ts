import { KnowledgeBase, GameMessage, Skill, VectorMetadata, OfflineCombatEffect, OfflineCombatTarget, OfflineCombatEffectType, NPC, Wife, Slave, Prisoner } from '../../types';
import * as GameTemplates from '../../templates';
import { PROFICIENCY_EXP_THRESHOLDS, PROFICIENCY_TIERS } from '../../constants';
import { diceCoefficient, normalizeStringForComparison } from '../questUtils';
import { formatSkillForEmbedding } from '../ragUtils';
import { SkillSanitizer } from './SkillSanitizer';
import { SkillAutoFiller } from './SkillAutoFiller';

const SIMILARITY_THRESHOLD = 0.85;

// Helper function to find a skill by fuzzy name matching
const findSkillByName = (skills: Skill[], name: string): { skill: Skill, index: number } | null => {
    if (!name) return null;
    let bestMatch = { skill: null as Skill | null, index: -1, score: 0 };
    const normalizedName = normalizeStringForComparison(name);

    skills.forEach((skill, index) => {
        const score = diceCoefficient(normalizedName, normalizeStringForComparison(skill.name));
        if (score > bestMatch.score) {
            bestMatch = { skill, index, score };
        }
    });

    if (bestMatch.skill && bestMatch.score >= SIMILARITY_THRESHOLD) {
        return bestMatch;
    }

    if(bestMatch.skill) {
        console.warn(`SKILL_FIND: Skill matching "${name}" found, but similarity score ${bestMatch.score.toFixed(2)} is below threshold ${SIMILARITY_THRESHOLD}. Best match: "${bestMatch.skill.name}"`);
    } else {
        console.warn(`SKILL_FIND: Skill matching "${name}" not found.`);
    }

    return null;
}

export const processSkillLearned = (
    currentKb: KnowledgeBase,
    tagParams: Record<string, string>,
    turnForSystemMessages: number
): { updatedKb: KnowledgeBase; systemMessages: GameMessage[]; newVectorMetadata?: VectorMetadata; } => {
    const newKb = currentKb;
    const systemMessages: GameMessage[] = [];
    let newVectorMetadata: VectorMetadata | undefined = undefined;
    
    // 1. Sanitize raw tag parameters
    const sanitizedData = SkillSanitizer.sanitize(tagParams);
    
    // 2. Auto-fill missing parameters based on player context
    const filledData = SkillAutoFiller.fill(sanitizedData, newKb);

    let skillName = filledData.name;
    const skillTypeRaw = filledData.type || filledData.skillType || filledData.category;
    const skillDescription = filledData.description || filledData.desc || filledData.text || "Kỹ năng không có mô tả.";
    const detailedEffectContent = filledData.otherEffects || filledData.effect || skillDescription;
    
    const manaCostStr = filledData.manaCost;
    const baseDamageStr = filledData.baseDamage;
    const healingAmountStr = filledData.healingAmount;
    const cooldownStr = filledData.cooldown;
    const damageMultiplierStr = filledData.damageMultiplier;
    const healingMultiplierStr = filledData.healingMultiplier;
    const levelRequirementStr = filledData.levelRequirement;
    const xpGainOnUseStr = filledData.xpGainOnUse;

    const skillType = (Object.values(GameTemplates.SkillType).includes(skillTypeRaw as GameTemplates.SkillTypeValues) 
                        ? skillTypeRaw 
                        : GameTemplates.SkillType.KHAC) as GameTemplates.SkillTypeValues;
    
    const newSkillId = filledData.id;
    
    const manaCost = parseInt(manaCostStr || "0", 10);
    const baseDamage = parseInt(baseDamageStr || "0", 10);
    const healingAmount = parseInt(healingAmountStr || "0", 10);
    const cooldown = parseInt(cooldownStr || "0", 10);
    const damageMultiplier = parseFloat(damageMultiplierStr || "0");
    const healingMultiplier = parseFloat(healingMultiplierStr || "0");
    const levelRequirement = levelRequirementStr ? parseInt(levelRequirementStr, 10) : undefined;
    const xpGainOnUse = xpGainOnUseStr ? parseInt(xpGainOnUseStr, 10) : undefined;

    // --- AUTOMATIC OFFLINE EFFECT GENERATION ---
    // If AI provides stats but not an explicit effect object (which it usually doesn't via tags),
    // construct one so the skill works in offline combat.
    let generatedOfflineEffect: OfflineCombatEffect | undefined = undefined;

    // Only generate for Linh Ki or Than Thong
    if (skillType === GameTemplates.SkillType.LINH_KI || skillType === GameTemplates.SkillType.THAN_THONG) {
        if (baseDamage > 0) {
            const targetStr = tagParams.targetType || 'Kẻ Địch Đơn Lẻ';
            let target: OfflineCombatTarget = 'single_enemy';
            if (targetStr.toLowerCase().includes('toàn bộ') || targetStr.toLowerCase().includes('khu vực')) target = 'all_enemies';
            
            generatedOfflineEffect = {
                type: 'DAMAGE_HP',
                basePower: baseDamage,
                target: target,
                element: 'fire' // Default element, could be parsed from description later
            };
        } else if (healingAmount > 0) {
            const targetStr = tagParams.targetType || 'Tự Thân';
            let target: OfflineCombatTarget = 'single_ally';
            if (targetStr.toLowerCase().includes('toàn bộ')) target = 'all_allies';
            else if (targetStr.toLowerCase().includes('tự thân')) target = 'self';

            generatedOfflineEffect = {
                type: 'HEAL_HP',
                basePower: healingAmount,
                target: target
            };
        }
    }
    // --- END AUTOMATIC GENERATION ---


    const newSkill: Skill = {
        id: newSkillId,
        name: skillName!, 
        description: skillDescription,
        skillType: skillType,
        detailedEffect: detailedEffectContent,
        icon: tagParams.icon,
        manaCost: isNaN(manaCost) ? 0 : manaCost,
        baseDamage: isNaN(baseDamage) ? 0 : baseDamage,
        healingAmount: isNaN(healingAmount) ? 0 : healingAmount,
        damageMultiplier: isNaN(damageMultiplier) ? 0 : damageMultiplier,
        healingMultiplier: isNaN(healingMultiplier) ? 0 : healingMultiplier,
        buffsApplied: undefined, 
        debuffsApplied: undefined,
        otherEffects: tagParams.otherEffects ? tagParams.otherEffects.split(';').map(s=>s.trim()).filter(s=>s) : (detailedEffectContent ? [detailedEffectContent] : undefined),
        targetType: tagParams.targetType as GameTemplates.SkillTargetType | undefined,
        cooldown: isNaN(cooldown) ? 0 : cooldown,
        currentCooldown: 0,
        levelRequirement: levelRequirement && !isNaN(levelRequirement) ? levelRequirement : undefined,
        requiredRealm: tagParams.requiredRealm,
        prerequisiteSkillId: tagParams.prerequisiteSkillId,
        isUltimate: tagParams.isUltimate?.toLowerCase() === 'true',
        xpGainOnUse: xpGainOnUse && !isNaN(xpGainOnUse) ? xpGainOnUse : undefined,
        proficiency: 0,
        maxProficiency: 100,
        proficiencyTier: "Sơ Nhập",
        congPhapDetails: undefined,
        linhKiDetails: undefined,
        professionDetails: undefined,
        camThuatDetails: undefined,
        thanThongDetails: undefined,
        effect: generatedOfflineEffect, // Assign the generated effect
    };

    // Add details based on skillType from tagParams
    if (skillType === GameTemplates.SkillType.CONG_PHAP_TU_LUYEN) {
        newSkill.congPhapDetails = {
            type: tagParams.congPhapType as GameTemplates.CongPhapType,
            grade: tagParams.congPhapGrade as GameTemplates.CongPhapGrade,
            weaponFocus: tagParams.weaponFocus,
        };
    } else if (skillType === GameTemplates.SkillType.LINH_KI) {
        newSkill.linhKiDetails = {
            category: tagParams.linhKiCategory as GameTemplates.LinhKiCategory,
            activation: tagParams.linhKiActivation as GameTemplates.LinhKiActivationType,
        };
    } else if (skillType === GameTemplates.SkillType.NGHE_NGHIEP) {
        newSkill.professionDetails = {
            type: tagParams.professionType as GameTemplates.ProfessionType,
            grade: tagParams.professionGrade as GameTemplates.ProfessionGrade,
            skillDescription: tagParams.skillDescription,
        };
    } else if (skillType === GameTemplates.SkillType.CAM_THUAT) {
        newSkill.camThuatDetails = {
            sideEffects: tagParams.sideEffects,
        };
    } else if (skillType === GameTemplates.SkillType.THAN_THONG) {
        newSkill.thanThongDetails = {};
    }

    const targetName = tagParams.targetName;
    if (targetName) {
        const allEntities: (NPC | Wife | Slave | Prisoner)[] = [
            ...newKb.discoveredNPCs,
            ...newKb.wives,
            ...newKb.slaves,
            ...newKb.prisoners,
        ];
        
        const targetEntity = allEntities.find(e => e.name === targetName);

        if (targetEntity) {
            if (!targetEntity.skills) {
                targetEntity.skills = [];
            }
            if (!targetEntity.skills.find(s => s.name.trim().toLowerCase() === newSkill.name.trim().toLowerCase())) {
                targetEntity.skills.push(newSkill);
                systemMessages.push({
                    id: `skill-learned-npc-${newSkill.id}`, type: 'system',
                    content: `${targetEntity.name} đã học được kỹ năng mới: ${newSkill.name}!`,
                    timestamp: Date.now(), turnNumber: turnForSystemMessages
                });
            } else {
                 console.warn(`SKILL_LEARNED: Target "${targetName}" already knows skill "${newSkill.name}".`);
            }
        } else {
             console.warn(`SKILL_LEARNED: Target NPC/Companion "${targetName}" not found.`);
             systemMessages.push({
                id: `skill-learn-error-notarget-${Date.now()}`, type: 'system',
                content: `[DEBUG] Lỗi học kỹ năng: Không tìm thấy mục tiêu "${targetName}".`,
                timestamp: Date.now(), turnNumber: turnForSystemMessages
            });
        }
    } else { // Default to player if no targetName
        const existingSkillByName = newKb.playerSkills.find(s => s.name.trim().toLowerCase() === skillName!.toLowerCase());

        if (!existingSkillByName) {
            newKb.playerSkills.push(newSkill);
            newVectorMetadata = { entityId: newSkill.id, entityType: 'skill', text: formatSkillForEmbedding(newSkill) };
            systemMessages.push({
                id: 'skill-learned-' + newSkill.id, type: 'system',
                content: `Học được kỹ năng mới: ${newSkill.name}!`,
                timestamp: Date.now(), turnNumber: turnForSystemMessages
            });
        } else {
            console.warn(`SKILL_LEARNED: Skill "${skillName}" already exists for player. Not adding duplicate.`);
        }
    }

    return { updatedKb: newKb, systemMessages, newVectorMetadata };
};

export const processSkillUsed = (
    currentKb: KnowledgeBase,
    tagParams: Record<string, string>,
    turnForSystemMessages: number
): { updatedKb: KnowledgeBase; systemMessages: GameMessage[] } => {
    const newKb = currentKb;
    const systemMessages: GameMessage[] = [];
    const skillName = tagParams.name;

    if (!skillName) {
        console.warn("SKILL_USED: Missing name.", tagParams);
        return { updatedKb: newKb, systemMessages };
    }

    const match = findSkillByName(newKb.playerSkills, skillName);
    if (match) {
        const skill = match.skill;
        if (skill.manaCost && skill.manaCost > 0) {
            if (newKb.playerStats.linhLuc >= skill.manaCost) {
                newKb.playerStats.linhLuc -= skill.manaCost;
            } else {
                newKb.playerStats.linhLuc = 0; // Prevent negative mana
                console.warn(`SKILL_USED: Overdraft on Linh Luc when using ${skill.name}.`);
            }
        }
        
        // Auto-gain proficiency (default 10)
        const xpGain = skill.xpGainOnUse || 10;
        skill.proficiency += xpGain;
        if (skill.proficiency > skill.maxProficiency) {
            skill.proficiency = skill.maxProficiency;
        }

        systemMessages.push({
            id: 'skill-used-' + Date.now(), 
            type: 'system',
            content: `Đã thi triển kỹ năng: ${skill.name} (Linh lực: -${skill.manaCost || 0}). \nĐộ thuần thục: +${xpGain}`,
            timestamp: Date.now(), turnNumber: turnForSystemMessages
        });
    } else {
        console.warn(`SKILL_USED: Skil "${skillName}" not found.`);
    }

    return { updatedKb: newKb, systemMessages };
};

export const processSkillUpdate = (
    currentKb: KnowledgeBase,
    tagParams: Record<string, string>,
    turnForSystemMessages: number
): { updatedKb: KnowledgeBase; systemMessages: GameMessage[]; updatedVectorMetadata?: VectorMetadata; } => {
    const newKb = currentKb;
    const systemMessages: GameMessage[] = [];
    let updatedVectorMetadata: VectorMetadata | undefined = undefined;
    
    const rawCurrentSkillName = tagParams.name;
    const currentSkillName = rawCurrentSkillName ? rawCurrentSkillName.trim() : undefined;


    if (!currentSkillName) {
        console.warn("SKILL_UPDATE: Missing current skill name (name parameter).", tagParams);
        systemMessages.push({
            id: `skill-update-error-noname-${Date.now()}`, type: 'system',
            content: `[DEBUG] Lỗi cập nhật kỹ năng: Thiếu tên kỹ năng hiện tại.`,
            timestamp: Date.now(), turnNumber: turnForSystemMessages
        });
        return { updatedKb: newKb, systemMessages };
    }

    const foundMatch = findSkillByName(newKb.playerSkills, currentSkillName);
    
    if (!foundMatch) {
        console.warn(`SKILL_UPDATE: Skill "${currentSkillName}" not found.`, tagParams);
        systemMessages.push({
            id: `skill-update-error-notfound-${Date.now()}`, type: 'system',
            content: `[DEBUG] Lỗi cập nhật kỹ năng: Không tìm thấy kỹ năng "${currentSkillName}".`,
            timestamp: Date.now(), turnNumber: turnForSystemMessages
        });
        return { updatedKb: newKb, systemMessages };
    }
    
    const { skill: skillToUpdate, index: skillIndex } = foundMatch;
    const originalNameToDisplay = skillToUpdate.name; 
    let updatedFieldsCount = 0;

    if (tagParams.newName) {
        const newTrimmedName = tagParams.newName.trim();
        if (newTrimmedName && newTrimmedName.toLowerCase() !== skillToUpdate.name.trim().toLowerCase()) {
            const collisionExists = newKb.playerSkills.some((s, idx) => 
                idx !== skillIndex && s.name.trim().toLowerCase() === newTrimmedName.toLowerCase()
            );
            if (!collisionExists) {
                skillToUpdate.name = newTrimmedName;
                updatedFieldsCount++;
            } else {
                 console.warn(`SKILL_UPDATE: New name "${newTrimmedName}" for skill "${originalNameToDisplay}" collides with an existing skill. Name not updated.`);
                 systemMessages.push({
                    id: `skill-update-error-namecollision-${Date.now()}`, type: 'system',
                    content: `[DEBUG] Lỗi cập nhật kỹ năng "${originalNameToDisplay}": Tên mới "${newTrimmedName}" đã tồn tại.`,
                    timestamp: Date.now(), turnNumber: turnForSystemMessages
                });
            }
        }
    }
    if (tagParams.description) {
        skillToUpdate.description = tagParams.description;
        updatedFieldsCount++;
    }
    if (tagParams.type || tagParams.skillType) {
        const newType = (tagParams.type || tagParams.skillType) as GameTemplates.SkillTypeValues;
        skillToUpdate.skillType = (Object.values(GameTemplates.SkillType).includes(newType) 
                                    ? newType 
                                    : GameTemplates.SkillType.KHAC) as GameTemplates.SkillTypeValues;
        updatedFieldsCount++;
    }
    if (tagParams.effect || tagParams.otherEffects) {
        const newEffect = tagParams.otherEffects || tagParams.effect;
        skillToUpdate.detailedEffect = newEffect!;
        skillToUpdate.otherEffects = newEffect!.split(';').map(s=>s.trim()).filter(s=>s);
        updatedFieldsCount++;
    }

    const parseAndUpdateNumericField = (paramKey: keyof Skill, fieldName: keyof Skill, parser: (val: string) => number | undefined) => {
        if (tagParams[paramKey as string]) {
            const parsedValue = parser(tagParams[paramKey as string]);
            if (parsedValue !== undefined && !isNaN(parsedValue)) {
                (skillToUpdate as any)[fieldName] = parsedValue;
                updatedFieldsCount++;
            } else {
                console.warn(`SKILL_UPDATE: Invalid numeric value for ${paramKey as string}: "${tagParams[paramKey as string]}"`);
            }
        }
    };
    
    if (tagParams.proficiency && tagParams.proficiency.startsWith("+=")) {
        const change = parseInt(tagParams.proficiency.substring(2), 10);
        if (!isNaN(change) && change > 0) {
            skillToUpdate.proficiency = (skillToUpdate.proficiency || 0) + change;
            let leveledUp = false;
    
            // Loop to handle multiple level-ups from a single EXP gain
            while (skillToUpdate.proficiencyTier !== "Xuất Thần Nhập Hóa" && skillToUpdate.proficiency >= (skillToUpdate.maxProficiency || 100)) {
                const currentTierIndex = PROFICIENCY_TIERS.indexOf(skillToUpdate.proficiencyTier || "Sơ Nhập");
                const nextTierIndex = currentTierIndex + 1;
    
                if (nextTierIndex < PROFICIENCY_TIERS.length) {
                    skillToUpdate.proficiency -= (skillToUpdate.maxProficiency || 100);
                    const nextTier = PROFICIENCY_TIERS[nextTierIndex];
                    skillToUpdate.proficiencyTier = nextTier;
                    const newMaxExp = PROFICIENCY_EXP_THRESHOLDS[nextTier];
                    skillToUpdate.maxProficiency = newMaxExp === null ? skillToUpdate.proficiency : newMaxExp; // If max level, cap exp
                    leveledUp = true;
                     systemMessages.push({
                        id: `skill-levelup-${skillToUpdate.id}-${nextTier}`,
                        type: 'system',
                        content: `Kỹ năng "${originalNameToDisplay}" đã đột phá đến cảnh giới "${nextTier}"!`,
                        timestamp: Date.now(),
                        turnNumber: turnForSystemMessages
                    });
                } else {
                    // Should be Xuất Thần Nhập Hóa, break loop
                    skillToUpdate.proficiency = skillToUpdate.maxProficiency; // Cap EXP
                    break;
                }
            }
            
            // This makes sure that if only proficiency changed, it's still considered an update.
            updatedFieldsCount++;
        }
    }


    parseAndUpdateNumericField('manaCost', 'manaCost', val => parseInt(val, 10));
    parseAndUpdateNumericField('baseDamage', 'baseDamage', val => parseInt(val, 10));
    parseAndUpdateNumericField('healingAmount', 'healingAmount', val => parseInt(val, 10));
    parseAndUpdateNumericField('cooldown', 'cooldown', val => parseInt(val, 10));
    parseAndUpdateNumericField('damageMultiplier', 'damageMultiplier', parseFloat);
    parseAndUpdateNumericField('healingMultiplier', 'healingMultiplier', parseFloat);
    parseAndUpdateNumericField('levelRequirement', 'levelRequirement', val => parseInt(val,10));
    parseAndUpdateNumericField('xpGainOnUse', 'xpGainOnUse', val => parseInt(val,10));

    if (tagParams.icon) { skillToUpdate.icon = tagParams.icon; updatedFieldsCount++; }
    if (tagParams.targetType) { skillToUpdate.targetType = tagParams.targetType as GameTemplates.SkillTargetType; updatedFieldsCount++; }
    if (tagParams.requiredRealm) { skillToUpdate.requiredRealm = tagParams.requiredRealm; updatedFieldsCount++; }
    if (tagParams.prerequisiteSkillId) { skillToUpdate.prerequisiteSkillId = tagParams.prerequisiteSkillId; updatedFieldsCount++; }
    if (tagParams.isUltimate) { skillToUpdate.isUltimate = tagParams.isUltimate.toLowerCase() === 'true'; updatedFieldsCount++; }

    // Update offline effect if base stats changed
    if (skillToUpdate.baseDamage > 0 || skillToUpdate.healingAmount > 0) {
        let target: OfflineCombatTarget = 'single_enemy';
        if (skillToUpdate.targetType?.toLowerCase().includes('toàn bộ')) target = skillToUpdate.baseDamage > 0 ? 'all_enemies' : 'all_allies';
        else if (skillToUpdate.targetType?.toLowerCase().includes('tự thân')) target = 'self';
        else if (skillToUpdate.healingAmount > 0) target = 'single_ally';

        skillToUpdate.effect = {
            type: skillToUpdate.baseDamage > 0 ? 'DAMAGE_HP' : 'HEAL_HP',
            basePower: skillToUpdate.baseDamage > 0 ? skillToUpdate.baseDamage : skillToUpdate.healingAmount,
            target: target
        };
    }

    if (updatedFieldsCount > 0) {
        if (!systemMessages.some(msg => msg.id.startsWith('skill-levelup'))) {
            systemMessages.push({
                id: `skill-updated-${skillToUpdate.id}-${Date.now()}`, type: 'system',
                content: `Kỹ năng "${originalNameToDisplay}" đã được cập nhật${skillToUpdate.name !== originalNameToDisplay ? ` thành "${skillToUpdate.name}"` : ""}.`,
                timestamp: Date.now(), turnNumber: turnForSystemMessages
            });
        }
        updatedVectorMetadata = {
            entityId: skillToUpdate.id,
            entityType: 'skill',
            text: formatSkillForEmbedding(skillToUpdate)
        };
    } else if (updatedFieldsCount === 0 && !systemMessages.some(msg => msg.id.includes('error'))) { 
         console.warn(`SKILL_UPDATE: Tag for "${originalNameToDisplay}" received, but no valid fields were updated.`);
         systemMessages.push({
            id: `skill-update-nochange-${skillToUpdate.id}-${Date.now()}`, type: 'system',
            content: `[DEBUG] Tag SKILL_UPDATE cho "${originalNameToDisplay}" không có thay đổi nào được áp dụng.`,
            timestamp: Date.now(), turnNumber: turnForSystemMessages
        });
    }

    return { updatedKb: newKb, systemMessages, updatedVectorMetadata };
};
