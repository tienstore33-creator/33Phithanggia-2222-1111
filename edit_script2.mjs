import fs from 'fs';
let content = fs.readFileSync('prompts/promptTaskHelpers.ts', 'utf-8');

content = content.replace(/\[4\] TRIBUNAL AUDIT/g, '[4] TRIBUNAL AUDIT');
content = content.replace(/\[5\] FIREWALL DESTRUCTION/g, '[5] FIREWALL DESTRUCTION');
content = content.replace(/\[6\] NSFW ENGINE/g, '[6] NSFW ENGINE');
content = content.replace(/\[7\] NARRATIVE EXECUTION/g, '[7] NARRATIVE EXECUTION');
content = content.replace(/\[8\] FINAL ASSEMBLY/g, '[8] FINAL ASSEMBLY');

content = content.replace(/TUẦN TỰ 7 BƯỚC/g, 'TUẦN TỰ 7 BƯỚC');
// Wait, if I want to renumber them:
content = content.replace(/\[4\] TRIBUNAL AUDIT/g, 'TMP_TRIBUNAL');
content = content.replace(/\[5\] FIREWALL DESTRUCTION/g, '[4] FIREWALL DESTRUCTION');
content = content.replace(/\[6\] NSFW ENGINE/g, '[5] NSFW ENGINE');
content = content.replace(/\[7\] NARRATIVE EXECUTION/g, '[6] NARRATIVE EXECUTION');
content = content.replace(/\[8\] FINAL ASSEMBLY/g, '[7] FINAL ASSEMBLY');
content = content.replace(/TMP_TRIBUNAL/g, '[3.5] TRIBUNAL AUDIT'); // Just rename it to [3.5] or leave it?
// Actually if it's just a number, the model doesn't care.

fs.writeFileSync('prompts/promptTaskHelpers.ts', content);
