import fs from 'fs';

let contextContent = fs.readFileSync('contexts/GameContext.tsx', 'utf8');
contextContent = contextContent.replace('    handleInitializeEconomicZones,\n    normalizeNpcRealms,', '    handleInitializeEconomicZones,');
fs.writeFileSync('contexts/GameContext.tsx', contextContent);


let actionsContent = fs.readFileSync('hooks/useGameActions.ts', 'utf8');
// Remove the incorrectly inserted normalizeNpcRealms
actionsContent = actionsContent.replace('    normalizeNpcRealms,\n      handleNonCombatDefeat,', '      handleNonCombatDefeat,');
// Add to the bottom return block
actionsContent = actionsContent.replace('    logReceivedResponseCallback,\n  };\n};', '    logReceivedResponseCallback,\n    normalizeNpcRealms,\n  };\n};');
fs.writeFileSync('hooks/useGameActions.ts', actionsContent);

console.log("Fixed all");
