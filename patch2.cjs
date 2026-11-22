const fs = require('fs');
let content = fs.readFileSync('utils/tagProcessors/npcTagProcessor.ts', 'utf-8');

// 1. processNpcUpdate
content = content.replace(
    /export const processNpcUpdate = async \(([\s\S]*?)\): Promise<\{\s*updatedKb: KnowledgeBase;\s*systemMessages: GameMessage\[\];\s*updatedVectorMetadata\?: VectorMetadata;\s*affinityChange\?: \{ name: string, delta: number \};\s*\}> => \{([\s\S]*?)if \(!npcToProcess\) \{\s*console\.warn\(`NPC_UPDATE: NPC with name "\$\{npcName\}" or ID "\$\{providedId\}" not found\.\`\);\s*return \{ updatedKb: newKb, systemMessages \};\s*\}/,
    `export const processNpcUpdate = async ($1): Promise<{ updatedKb: KnowledgeBase; systemMessages: GameMessage[]; updatedVectorMetadata?: VectorMetadata; affinityChange?: { name: string, delta: number }; errorReason?: string; }> => {$2if (!npcToProcess) {\n    return { updatedKb: newKb, systemMessages, errorReason: \`[NPC_UPDATE] Không tìm thấy thực thể mang tên/id: "\${npcName || providedId}".\` };\n  }`
);

// 2. processAppearanceUpdate
content = content.replace(
    /export const processAppearanceUpdate = \(([\s\S]*?)\): \{\s*updatedKb: KnowledgeBase;\s*systemMessages: GameMessage\[\]\s*\} => \{([\s\S]*?)if \(!appearanceText\) \{\s*console\.warn\("APPEARANCE_UPDATE: Missing appearance or content\.", tagParams\);\s*return \{ updatedKb: newKb, systemMessages \};\s*\}\s*if \(!npcName && !providedId\) \{\s*console\.warn\("APPEARANCE_UPDATE: Missing name and id\.", tagParams\);\s*return \{ updatedKb: newKb, systemMessages \};\s*\}/,
    `export const processAppearanceUpdate = ($1): { updatedKb: KnowledgeBase; systemMessages: GameMessage[]; errorReason?: string; } => {$2if (!appearanceText) {\n    return { updatedKb: newKb, systemMessages, errorReason: "[APPEARANCE_UPDATE] Thiếu tham số appearance hoặc content." };\n  }\n\n  if (!npcName && !providedId) {\n    return { updatedKb: newKb, systemMessages, errorReason: "[APPEARANCE_UPDATE] Thiếu tham số name và id." };\n  }`
);

content = content.replace(
    /if \(!npcToProcess\) \{\s*console\.warn\("APPEARANCE_UPDATE: NPC not found\.", tagParams\);\s*return \{ updatedKb: newKb, systemMessages \};\s*\}/,
    `if (!npcToProcess) {\n    return { updatedKb: newKb, systemMessages, errorReason: \`[APPEARANCE_UPDATE] Không tìm thấy thực thể mang tên/id: "\${npcName || providedId}".\` };\n  }`
);

// 3. processNpcRename
content = content.replace(
    /export const processNpcRename = \(([\s\S]*?)\): \{\s*updatedKb: KnowledgeBase;\s*systemMessages: GameMessage\[\];\s*updatedVectorMetadata\?: VectorMetadata\s*\} => \{([\s\S]*?)if \(\(!npcName && !providedId\) \|\| !newName\) \{\s*return \{ updatedKb: newKb, systemMessages \};\s*\}/,
    `export const processNpcRename = ($1): { updatedKb: KnowledgeBase; systemMessages: GameMessage[]; updatedVectorMetadata?: VectorMetadata; errorReason?: string; } => {$2if ((!npcName && !providedId) || !newName) {\n    return { updatedKb: newKb, systemMessages, errorReason: "[NPC_RENAME] Thiếu tham số oldName/name hoặc newName." };\n  }`
);

content = content.replace(
    /if \(!npcToProcess\) \{\s*console\.warn\(`NPC_RENAME: NPC with name "\$\{npcName\}" or ID "\$\{providedId\}" not found\.\`\);\s*return \{ updatedKb: newKb, systemMessages \};\s*\}/,
    `if (!npcToProcess) {\n    return { updatedKb: newKb, systemMessages, errorReason: \`[NPC_RENAME] Không tìm thấy NPC mang tên/id: "\${npcName || providedId}".\` };\n  }`
);

// Check if player stats can be matched for APPEARANCE_UPDATE and NPC_UPDATE
// In processAppearanceUpdate and processNpcUpdate, the target could be the player.
// Let's modify resolveNpcEntity to also check playerStats? But that might affect other parts.
// Instead, let's just let processAppearanceUpdate and processNpcUpdate check playerStats.
// For now, let's just run the regex replace.

fs.writeFileSync('utils/tagProcessors/npcTagProcessor.ts', content);
