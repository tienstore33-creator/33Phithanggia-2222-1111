const fs = require('fs');
let content = fs.readFileSync('utils/tagProcessors/interactionTagProcessor.ts', 'utf-8');

content = content.replace(
    /const targetNpc = findNpc\(partner\);/,
    `let targetNpc = findNpc(partner);\n    if (!targetNpc && updatedKb.playerStats && updatedKb.playerStats.name.toLowerCase().trim() === partner.toLowerCase().trim()) {\n        targetNpc = { ...updatedKb.playerStats, id: 'player', gender: updatedKb.playerStats.gender || 'Nam' };\n    }`
);

content = content.replace(
    /otherNpc = findNpc\(malePartner\);/,
    `otherNpc = findNpc(malePartner);\n            if (!otherNpc && updatedKb.playerStats && updatedKb.playerStats.name.toLowerCase().trim() === malePartner.toLowerCase().trim()) {\n                otherNpc = { ...updatedKb.playerStats, id: 'player', gender: updatedKb.playerStats.gender || 'Nam' };\n            }`
);

fs.writeFileSync('utils/tagProcessors/interactionTagProcessor.ts', content);
