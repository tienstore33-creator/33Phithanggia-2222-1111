const fs = require('fs');
let content = fs.readFileSync('utils/tagProcessors/interactionTagProcessor.ts', 'utf-8');

// Fix 1: Add type casting or affinity for player mock
content = content.replace(
    /targetNpc = \{ \.\.\.updatedKb\.playerStats, id: 'player', gender: updatedKb\.playerStats\.gender \|\| 'Nam' \};/g,
    `targetNpc = { ...updatedKb.playerStats, id: 'player', gender: (updatedKb.playerStats as any).gender || 'Nam', affinity: 0 } as any;`
);

content = content.replace(
    /otherNpc = \{ \.\.\.updatedKb\.playerStats, id: 'player', gender: updatedKb\.playerStats\.gender \|\| 'Nam' \};/g,
    `otherNpc = { ...updatedKb.playerStats, id: 'player', gender: (updatedKb.playerStats as any).gender || 'Nam', affinity: 0 } as any;`
);

fs.writeFileSync('utils/tagProcessors/interactionTagProcessor.ts', content);
