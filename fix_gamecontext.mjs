import fs from 'fs';

let content = fs.readFileSync('contexts/GameContext.tsx', 'utf8');

if (!content.includes('normalizeNpcRealms: (npcsToNormalize')) {
    content = content.replace(
        '  onUpdatePlayerAvatar: (newAvatarUrl: string) => void;',
        '  onUpdatePlayerAvatar: (newAvatarUrl: string) => void;\n  normalizeNpcRealms: (npcsToNormalize: any[]) => Promise<void>;'
    );
}

if (!content.includes('normalizeNpcRealms,')) {
    content = content.replace(
        '    onUpdatePlayerAvatar,',
        '    onUpdatePlayerAvatar,\n    normalizeNpcRealms,'
    );
}

fs.writeFileSync('contexts/GameContext.tsx', content);
console.log("Patched gamecontext");
