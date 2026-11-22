import fs from 'fs';

let content = fs.readFileSync('contexts/GameContext.tsx', 'utf8');

content = content.replace(/handleMatPhapContinue: \(\) => void;/g, `handleMatPhapContinue: () => void;\n  normalizeNpcRealms: (npcs: any[]) => Promise<void>;`);

content = content.replace(/handleMatPhapContinue: gameActions.handleMatPhapContinue,/g, `handleMatPhapContinue: gameActions.handleMatPhapContinue,\n      normalizeNpcRealms: gameActions.normalizeNpcRealms,`);

fs.writeFileSync('contexts/GameContext.tsx', content);
console.log("Patched GameContext.tsx");
