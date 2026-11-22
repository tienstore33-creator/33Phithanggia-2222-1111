import fs from 'fs';

let content = fs.readFileSync('hooks/useGameActions.ts', 'utf8');
content = content.replace(
    /npc\.stats = calculateEffectiveStats\(baseStats, npc\.tuChatTier \|\| 'Thường', newKb\);/g,
    `npc.stats = { 
                                  ...(npc.stats || {}),
                                  ...baseStats,
                                  sinhLuc: baseStats.baseMaxSinhLuc,
                                  maxSinhLuc: baseStats.baseMaxSinhLuc,
                                  linhLuc: baseStats.baseMaxLinhLuc,
                                  maxLinhLuc: baseStats.baseMaxLinhLuc,
                                  sucTanCong: baseStats.baseSucTanCong
                              };`
);
fs.writeFileSync('hooks/useGameActions.ts', content);
console.log("Patched stats");
