import { useCallback, useState } from 'react';
import { useGame } from './useGame';
import { skillTransformationService } from '../services/skillTransformationService';
import { DataExtractionService } from '../services/dataExtractionService';
import { SKILL_TEMPLATES, COMBAT_MODE_SKILLS } from '../templates';
import { VIETNAMESE } from '../constants';

/**
 * Hook để thực hiện chuyển hóa kỹ năng trong UI
 */
export const useSkillTransformation = () => {
  const { knowledgeBase, setKnowledgeBase, showNotification } = useGame();
  const [isTransforming, setIsTransforming] = useState(false);

  /**
   * Chuyển hóa ngẫu nhiên (Legacy Fallback)
   */
  const runLegacyRandomTransformation = useCallback((eligibleSkills: any[]) => {
    const targetSkill = eligibleSkills[Math.floor(Math.random() * eligibleSkills.length)];
    const template = COMBAT_MODE_SKILLS[Math.floor(Math.random() * COMBAT_MODE_SKILLS.length)];
    const transformedSkill = skillTransformationService.applyTransformation(targetSkill, template);

    setKnowledgeBase(prev => ({
      ...prev,
      playerSkills: prev.playerSkills.map(s => 
        s.id === transformedSkill.id ? transformedSkill : s
      )
    }));

    showNotification(
      `${VIETNAMESE.SKILL_TRANSFORMED_SUCCESS || 'Chuyển hóa thành công'}: ${targetSkill.name} -> ${transformedSkill.name}`,
      'success'
    );
  }, [setKnowledgeBase, showNotification]);

  const triggerTransformation = useCallback(async (silent: boolean = false) => {
    const currentSkills = knowledgeBase.playerSkills;
    
    // Bước 1: Quét kỹ năng đủ điều kiện
    const eligibleSkills = skillTransformationService.scanEligibleSkills(currentSkills);

    if (eligibleSkills.length === 0) {
      if (!silent) {
        showNotification(VIETNAMESE.NO_ELIGIBLE_SKILLS || 'Không có kỹ năng nào đủ điều kiện chuyển hóa!', 'error');
      }
      return;
    }

    setIsTransforming(true);
    try {
      // Bước 2: Gọi AI để phân tích và mapping
      const aiResults = await DataExtractionService.transformSkills(eligibleSkills, COMBAT_MODE_SKILLS);
      
      if (!aiResults || Object.keys(aiResults).length === 0) {
        throw new Error("AI returned empty results");
      }

      // Bước 3: Áp dụng kết quả từ AI
      setKnowledgeBase(prev => {
        const updatedSkills = prev.playerSkills.map(skill => {
          const aiResult = aiResults[skill.id];
          if (aiResult) {
            const combatSkill = COMBAT_MODE_SKILLS.find(cs => cs.name === aiResult.matchedCombatSkillName);
            
            if (combatSkill) {
               return skillTransformationService.applyTransformation(skill, combatSkill, aiResult.customDescription);
            }
          }
          return skill;
        });

        return {
          ...prev,
          playerSkills: updatedSkills
        };
      });

      if (!silent) {
        showNotification("Thiên đạo đã thấu hiểu võ học của bạn! Toàn bộ kỹ năng đã được chuyển hóa.", "success");
      }
    } catch (error) {
      console.error("[useSkillTransformation] AI Error, falling back to random:", error);
      // Fallback về cơ chế ngẫu nhiên cũ nếu AI lỗi
      runLegacyRandomTransformation(eligibleSkills);
    } finally {
      setIsTransforming(false);
    }
  }, [knowledgeBase.playerSkills, setKnowledgeBase, showNotification, runLegacyRandomTransformation]);

  return {
    triggerTransformation,
    isTransforming,
    eligibleSkillsCount: skillTransformationService.scanEligibleSkills(knowledgeBase.playerSkills).length
  };
};
