const fs = require('fs');
let content = fs.readFileSync('utils/tagProcessors/interactionTagProcessor.ts', 'utf-8');

content = content.replace(
    /\): \{\s*updatedKb: KnowledgeBase;\s*systemMessages: GameMessage\[\]\s*\} => \{/,
    `): { updatedKb: KnowledgeBase; systemMessages: GameMessage[]; errorReason?: string; } => {`
);

content = content.replace(
    /if \(!partner \|\| !type\) return \{ updatedKb, systemMessages \};/,
    `if (!partner || !type) return { updatedKb, systemMessages, errorReason: "[INTERACTION] Thiếu tham số partner hoặc type." };`
);

content = content.replace(
    /console\.warn\(`\[INTERACTION\] Không tìm thấy NPC: \$\{partner\}`\);\s*return \{ updatedKb, systemMessages \};/,
    `return { updatedKb, systemMessages, errorReason: \`[INTERACTION] Không tìm thấy NPC mang tên: "\${partner}".\` };`
);

content = content.replace(
    /console\.warn\(`\[INTERACTION\] Bỏ qua tag INTERACTION sex do thiếu tham số NPC Nữ hợp lệ cho nam partner: \$\{partner\}`\);\s*return \{ updatedKb, systemMessages \};/,
    `return { updatedKb, systemMessages, errorReason: \`[INTERACTION] Thiếu đối tượng nữ hợp lệ cho sự kiện sex với "\${partner}".\` };`
);

fs.writeFileSync('utils/tagProcessors/interactionTagProcessor.ts', content);
