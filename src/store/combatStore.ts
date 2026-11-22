import { create } from 'zustand';
import { NPC } from '../../types';
import { getFinalCombatRoster } from '../../services/combatEligibilityService';
import { getContextualNpcs } from '../../services/contextualNpcService';

interface CombatState {
    combatants: NPC[];
    temporaryEntities?: NPC[]; // NEW: For mass-produced mobs
    isCombatActive: boolean;
    setCombatants: (combatants: NPC[]) => void;
    startCombat: (fixedRoster: NPC[], lastTwoTurns: any[], temporaryEntities?: NPC[]) => Promise<void>;
    endCombat: () => void;
}

export const useCombatStore = create<CombatState>((set) => ({
    combatants: [],
    temporaryEntities: [],
    isCombatActive: false,
    setCombatants: (combatants) => set({ combatants }),
    startCombat: async (fixedRoster, lastTwoTurns, temporaryEntities = []) => {
        const contextualNpcs = await getContextualNpcs(lastTwoTurns);
        const allContextNpcs = [...contextualNpcs, ...temporaryEntities];
        const finalRoster = getFinalCombatRoster(fixedRoster, allContextNpcs);
        set({ combatants: finalRoster, temporaryEntities, isCombatActive: true });
    },
    endCombat: () => set({ combatants: [], temporaryEntities: [], isCombatActive: false }),
}));
