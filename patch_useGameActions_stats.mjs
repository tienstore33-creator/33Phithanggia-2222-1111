import fs from 'fs';

let content = fs.readFileSync('hooks/useGameActions.ts', 'utf8');

const replacement = `
                              // We need to calculate base stats and effective stats
                              const baseStats = calculateRealmBaseStats(
                                  npc.realm, // use realm string here
                                  realmSystem.majorRealms,
                                  newKb.currentRealmBaseStats,
                                  realmSystem.minorRealms
                              );
`;
content = content.replace(/\/\/ We need to calculate base stats and effective stats[\s\S]*?realmSystem\.majorRealms\n\s*\);/, replacement);

if (!content.includes(`import { calculateRealmBaseStats, calculateEffectiveStats } from '../utils/statsCalculationUtils';`)) {
    // If it's imported from gameLogicUtils, we might need to remove it or ensure the correct one is used.
    // However, looking at useGameActions.ts, it imports them from gameLogicUtils currently.
    // gameLogicUtils might export them from statsCalculationUtils.
}

fs.writeFileSync('hooks/useGameActions.ts', content);
console.log("Patched useGameActions.ts for stats calculation");
