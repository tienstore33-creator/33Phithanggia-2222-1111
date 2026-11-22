import fs from 'fs';

let content = fs.readFileSync('hooks/useGameActions.ts', 'utf8');

content = content.replace(/return \{\n(\s*)isSummarizingNextPageTransition:/, `return {\n$1normalizeNpcRealms,\n$1isSummarizingNextPageTransition:`);

fs.writeFileSync('hooks/useGameActions.ts', content);
console.log("Patched return statement in useGameActions.ts");
