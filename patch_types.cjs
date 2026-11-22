const fs = require('fs');
let content = fs.readFileSync('types.ts', 'utf-8');
content = content.replace(
    /export type CombatDisposition = 'kill' \| 'capture' \| 'release';/,
    "export type CombatDisposition = 'kill' | 'capture' | 'release' | 'suicide' | 'surrender';"
);
fs.writeFileSync('types.ts', content);
