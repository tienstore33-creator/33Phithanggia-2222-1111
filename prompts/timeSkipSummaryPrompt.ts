import { KnowledgeBase, NPC, Wife, Slave, Prisoner } from '../types';

export const generateTimeSkipSummaryPrompt = (
    kb: KnowledgeBase,
    duration: { days: number, months: number, years: number },
    // FIX: Included Prisoner in the type definition to match the data being passed.
    allNpcs: (NPC | Wife | Slave | Prisoner)[],
    top3Npcs: (NPC | Wife | Slave | Prisoner)[]
): string => {
    const totalDays = duration.days + (duration.months * 30) + (duration.years * 360);
    const totalYears = totalDays / 360;

    const formatNpcForPrompt = (npc: NPC | Wife | Slave | Prisoner) => {
        return `- ${npc.name} (ID: ${npc.id}, Thọ nguyên còn lại: ${npc.stats?.thoNguyen || 'Không rõ'})`;
    };
    
    const formatTopNpcForPrompt = (npc: NPC | Wife | Slave | Prisoner) => {
        return `- ${npc.name} (Thiện cảm: ${npc.affinity}, Thân phận: ${'entityType' in npc ? (npc as any).entityType : 'NPC'}, Mô tả: ${npc.description})`;
    };

    return `
You are a professional storyteller AI, tasked with summarizing a long period of time that has passed in the game world.

**CONTEXT:**
- Protagonist "${kb.worldConfig?.playerName}" has been in secluded cultivation.
- **Total time elapsed:** ${totalDays} days (${duration.years} years, ${duration.months} months, ${duration.days} days).
- **World situation before seclusion:**
  - Theme: ${kb.worldConfig?.theme}
  - Summary of recent events: ${(Object.values(kb.pageSummaries).slice(-2).join('\n')) || 'None.'}

**LIST OF CHARACTERS AND THEIR REMAINING LONGEVITY:**
${allNpcs.map(formatNpcForPrompt).join('\n')}

**TOP 3 CHARACTERS CLOSEST TO THE PLAYER:**
${top3Npcs.map(formatTopNpcForPrompt).join('\n')}

**YOUR TASK:**
Write a complete narration describing what happened during the ${totalDays} days the player was absent. The paragraph must include the following 4 parts, woven together naturally:

1.  **Introductory Narrative:** Open by describing the passage of time, the changing landscape, and the player's feeling upon emerging.

2.  **Life and Death (MANDATORY CHECK):**
    *   For each NPC in the list above, check if their **"Remaining Longevity"** is less than **${totalYears.toFixed(2)} years**.
    *   If so, narrate a brief segment about their passing due to age.
    *   Also, create a tag **[NPC_REMOVE: name="NPC Name"]** for each deceased person.

3.  **Absence Affection (IMPORTANT):**
    *   For **each person** in the **TOP 3 CLOSEST CHARACTERS**, write a short segment (about 500 words for each) describing their life and emotions while the player was away.
    *   **Creative Freedom:** You can tell how they cultivated, if they faced difficulties, and how they felt missing, worried, or thinking about the player.
    *   Make their stories vivid and deep.

4.  **World Shifts:**
    *   Briefly narrate 1-2 major world events (e.g., a war between factions, a new secret realm appearing, a new important character rising).
    *   Create corresponding tags like \`[FACTION_UPDATE: ...]\`, \`[NPC_UPDATE: ...]\` to reflect these changes.

**FINAL RULES:**
- **DO NOT** create a \`[CHANGE_TIME]\` tag. The system handles it.
- **DO NOT** create a \`[CHOICE]\` tag.
- Combine all the above parts into a single, seamless narration. Start immediately with the narrative, no preamble.
- While the story itself should be in Vietnamese (to match the game style), ensure all technical instructions here are followed precisely.
`;
};