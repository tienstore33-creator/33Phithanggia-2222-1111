import fs from 'fs';
let content = fs.readFileSync('contexts/GameContext.tsx', 'utf8');
content = content.replace('    onUpdatePlayerAvatar,\n    normalizeNpcRealms,', '    onUpdatePlayerAvatar,');
fs.writeFileSync('contexts/GameContext.tsx', content);
