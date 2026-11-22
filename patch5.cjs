const fs = require('fs');
let content = fs.readFileSync('utils/tagProcessors/npcTagProcessor.ts', 'utf-8');

content = content.replace(
    /console\.warn\(`APPEARANCE_UPDATE: Could not find NPC with ID "\$\{providedId\}" or Name "\$\{npcName\}"`\);\s*\}\s*return \{ updatedKb: newKb, systemMessages \};/,
    `return { updatedKb: newKb, systemMessages, errorReason: \`[APPEARANCE_UPDATE] Không tìm thấy thực thể mang tên/id: "\${npcName || providedId}".\` };\n  }\n\n  return { updatedKb: newKb, systemMessages };`
);

content = content.replace(
    /console\.warn\(`NPC_RENAME: Could not find NPC with ID "\$\{providedId\}" or oldName "\$\{npcName\}" in any list\.`\);\s*return \{ updatedKb: newKb, systemMessages \};/,
    `return { updatedKb: newKb, systemMessages, errorReason: \`[NPC_RENAME] Không tìm thấy NPC mang tên/id: "\${npcName || providedId}".\` };`
);

fs.writeFileSync('utils/tagProcessors/npcTagProcessor.ts', content);
