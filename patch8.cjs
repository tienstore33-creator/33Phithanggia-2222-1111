const fs = require('fs');
let content = fs.readFileSync('utils/tagProcessors/npcTagProcessor.ts', 'utf-8');

content = content.replace(
    /if \(newKb\.master && \(newKb\.master\.id === providedId \|\| newKb\.master\.name === npcName\)\) \{\s*npcToProcess = newKb\.master;\s*\}/,
    `if (newKb.master && (newKb.master.id === providedId || newKb.master.name === npcName)) {\n    npcToProcess = newKb.master;\n  } else if (newKb.playerStats && (providedId === 'player' || newKb.playerStats.name === npcName)) {\n    npcToProcess = newKb.playerStats;\n  }`
);

fs.writeFileSync('utils/tagProcessors/npcTagProcessor.ts', content);
