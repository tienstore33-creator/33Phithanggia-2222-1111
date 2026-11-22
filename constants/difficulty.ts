import { Difficulty, DifficultyConfig } from '../src/types/game';

export const DIFFICULTY_SETTINGS: Record<Difficulty, DifficultyConfig> = {
  [Difficulty.EASY]: {
    maxAffinityGain: 10,
    npcBehaviorPrompt: "NPCs are peaceful, cooperative, and view the MC as their primary partner.",
    narrativeBias: "Describe outcomes with a strong bias towards the MC's success and favorable conditions.",
    customInputChance: 100
  },
  [Difficulty.NORMAL]: {
    maxAffinityGain: 6,
    npcBehaviorPrompt: "NPCs act strictly according to the original work's canon. They view the MC as a temporary ally and will despise the MC like a 'mantis trying to stop a chariot' if the MC attempts to alter the original plot.",
    narrativeBias: "Ensure the game's story remains consistent with the original plot events. NPCs will actively resist any attempts by the MC to deviate from the canon.",
    customInputChance: 80
  },
  [Difficulty.HARD]: {
    maxAffinityGain: 3,
    npcBehaviorPrompt: "NPCs are selfish and conspire together to create difficulties for the MC. They openly show affection to each other to isolate the MC.",
    narrativeBias: "80% difficulty. NPCs must actively interfere with and sabotage the MC's actions.",
    customInputChance: 40
  },
  [Difficulty.NIGHTMARE]: {
    maxAffinityGain: 1,
    npcBehaviorPrompt: "NPCs are predators hunting the MC. They will abandon/betray the MC regardless of affinity. Include themes of betrayal and NTR.",
    narrativeBias: "Describe every MC action as an 'Impossible Mission'. The world is fundamentally hostile.",
    customInputChance: 20
  }
};
