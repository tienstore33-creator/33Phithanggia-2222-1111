import fs from 'fs';

let content = fs.readFileSync('hooks/useGameActions.ts', 'utf8');

// 1. Remove the incorrectly placed normalizeNpcRealms
const normalizeStart = content.indexOf('  const normalizeNpcRealms = async (npcsToNormalize: NPC[]) => {');
const normalizeEnd = content.indexOf('  return {\n            updatedKb: kb, // no change');

if (normalizeStart > -1 && normalizeEnd > -1) {
    const normalizeCode = content.substring(normalizeStart, normalizeEnd);
    content = content.replace(normalizeCode, '');

    // 2. Insert it inside useGameActions
    const useGameActionsStart = content.indexOf('export const useGameActions = (props: UseGameActionsProps) => {');
    const insertPoint = content.indexOf('  const logSentPromptCallback', useGameActionsStart);
    
    content = content.substring(0, insertPoint) + normalizeCode + '\n' + content.substring(insertPoint);
}

fs.writeFileSync('hooks/useGameActions.ts', content);
