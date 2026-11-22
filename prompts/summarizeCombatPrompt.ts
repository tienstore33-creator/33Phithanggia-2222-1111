
import { VIETNAMESE } from '../constants';

export const generateSummarizeCombatPrompt = (
    combatLog: string[],
    outcome: 'victory' | 'defeat' | 'escaped' | 'surrendered',
    mvpDetails?: { name: string, damage: number, kills: number }
): string => {
  const outcomeText = 
    outcome === 'victory' ? "Thắng Lợi" :
    outcome === 'defeat' ? "Thất Bại" :
    outcome === 'escaped' ? "Bỏ Chạy" : "Đầu Hàng";
    
  const logString = combatLog.join('\n---\n');
  const mvpString = mvpDetails 
    ? `**MVP OF THE MATCH:** ${mvpDetails.name} (Kills: ${mvpDetails.kills}, Total Damage: ${mvpDetails.damage})`
    : "";

  return `
You are a master storyteller, specializing in summarizing epic battles in a role-playing game.
Below is the detailed log of a combat session that just concluded.

**FINAL OUTCOME:** ${outcomeText}
${mvpString}

**DETAILED COMBAT LOG:**
${logString}

**REQUIREMENTS:**
Based on the log above and the MVP information, write a **short paragraph (1-3 sentences) summarizing the final outcome** of the battle (who won, who lost, general condition). 
Make sure to mention the MVP and their contribution if they were particularly effective. 
DO NOT list details of every turn.

**IMPORTANT:**
- The summary MUST BE WRITTEN IN ENGLISH to ensure the AI understands the context perfectly in future turns.
- Write ONLY the short summary paragraph. DO NOT add any intros, outros, or other tags.
`;
};
