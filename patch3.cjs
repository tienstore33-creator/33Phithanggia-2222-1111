const fs = require('fs');
let content = fs.readFileSync('utils/tagProcessors/npcTagProcessor.ts', 'utf-8');

// processNpcUpdate
content = content.replace(
    /export const processNpcUpdate = async \([\s\S]*?\): Promise<\{\s*updatedKb: KnowledgeBase;\s*systemMessages: GameMessage\[\];\s*updatedVectorMetadata\?: VectorMetadata;\s*affinityChange\?: \{ name: string; delta: number \};\s*\}> => \{/,
    `export const processNpcUpdate = async (\n  currentKb: KnowledgeBase,\n  tagParams: Record<string, string>,\n  turnForSystemMessages: number,\n  logNpcAvatarPromptCallback?: (prompt: string) => void,\n  summaryQueue?: BatchSummaryRequestItem[],\n): Promise<{\n  updatedKb: KnowledgeBase;\n  systemMessages: GameMessage[];\n  updatedVectorMetadata?: VectorMetadata;\n  affinityChange?: { name: string; delta: number };\n  errorReason?: string;\n}> => {`
);

content = content.replace(
    /if \(!npcToProcess\) \{\s*console\.warn\(`NPC_UPDATE: NPC with name "\$\{npcName\}" or ID "\$\{providedId\}" not found\.\`\);\s*return \{ updatedKb: newKb, systemMessages \};\s*\}/,
    `if (!npcToProcess) {\n    return { updatedKb: newKb, systemMessages, errorReason: \`[NPC_UPDATE] Không tìm thấy thực thể mang tên/id: "\${npcName || providedId}". (Lưu ý: Không dùng thẻ này cho MC)\` };\n  }`
);

fs.writeFileSync('utils/tagProcessors/npcTagProcessor.ts', content);
