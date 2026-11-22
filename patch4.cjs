const fs = require('fs');
let content = fs.readFileSync('utils/tagProcessors/npcTagProcessor.ts', 'utf-8');

// processNpcUpdate
content = content.replace(
    /console\.warn\(`NPC_UPDATE: Could not find NPC with Target "\$\{tagParams\.target\}", ID "\$\{providedId\}" or Name "\$\{npcName\}" in any list\.`\);\s*return \{ updatedKb: newKb, systemMessages \};/,
    `return { updatedKb: newKb, systemMessages, errorReason: \`[NPC_UPDATE] Không tìm thấy thực thể mang tên/id: "\${npcName || providedId || tagParams.target}". (Lưu ý: Không dùng thẻ này cho MC)\` };`
);

// processAppearanceUpdate
content = content.replace(
    /console\.warn\(`APPEARANCE_UPDATE: Could not find NPC with name "\$\{npcName\}" or ID "\$\{providedId\}" in any list\.`\);\s*return \{ updatedKb: newKb, systemMessages \};/,
    `return { updatedKb: newKb, systemMessages, errorReason: \`[APPEARANCE_UPDATE] Không tìm thấy thực thể mang tên/id: "\${npcName || providedId}".\` };`
);

// processNpcRename
content = content.replace(
    /console\.warn\(`NPC_RENAME: Could not find NPC with name "\$\{npcName\}" or ID "\$\{providedId\}" in any list\.`\);\s*return \{ updatedKb: newKb, systemMessages \};/,
    `return { updatedKb: newKb, systemMessages, errorReason: \`[NPC_RENAME] Không tìm thấy NPC mang tên/id: "\${npcName || providedId}".\` };`
);

fs.writeFileSync('utils/tagProcessors/npcTagProcessor.ts', content);
