import fs from 'fs';

// 1. Add to hooks/useGameActions.ts
let useGameActionsContent = fs.readFileSync('hooks/useGameActions.ts', 'utf8');
useGameActionsContent = useGameActionsContent.replace(
    'logReceivedResponseCallback,',
    'logReceivedResponseCallback,\n    normalizeNpcRealms,'
);
fs.writeFileSync('hooks/useGameActions.ts', useGameActionsContent);

// 2. Add to contexts/GameContext.tsx GameContextType interface
let gameContextContent = fs.readFileSync('contexts/GameContext.tsx', 'utf8');
gameContextContent = gameContextContent.replace(
    '  onUpdateEntityAvatar: (entityId: string, type: "wife" | "slave" | "prisoner", newAvatarDataOrUrl: string) => Promise<void>;',
    '  onUpdateEntityAvatar: (entityId: string, type: "wife" | "slave" | "prisoner", newAvatarDataOrUrl: string) => Promise<void>;\n  normalizeNpcRealms: (npcsToNormalize: any[]) => Promise<void>;'
);

// 3. Add to GameProvider value
gameContextContent = gameContextContent.replace(
    '    handleInitializeEconomicZones,',
    '    handleInitializeEconomicZones,\n    normalizeNpcRealms,'
);

fs.writeFileSync('contexts/GameContext.tsx', gameContextContent);
console.log("Patched both files");
