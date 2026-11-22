import { AnalyzedParticipant, KnowledgeBase, AnalyzedCombatant } from '../types';

/**
 * Filters and resolves participants from combat analysis into active combatants.
 * Separates them into opponents, allies, and neutral bystanders.
 */
export const filterActiveCombatants = (
  participants: AnalyzedParticipant[],
  kb: KnowledgeBase
) => {
  const opponents: AnalyzedCombatant[] = [];
  const allies: AnalyzedCombatant[] = [];
  const neutral: AnalyzedCombatant[] = [];

  participants.forEach(p => {
    const combatant: AnalyzedCombatant = {
      name: p.name,
      isNew: p.isNew,
      description: p.description,
      powerLevel: p.powerLevel,
      quantity: 1 // Default to 1
    };

    if (p.side === 'enemy') {
      opponents.push(combatant);
    } else if (p.side === 'player') {
      allies.push(combatant);
    } else if (p.side === 'neutral') {
      neutral.push(combatant);
    }
  });

  return { opponents, allies, neutral };
};
