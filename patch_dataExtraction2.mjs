import fs from 'fs';

const FILE_PATH = './services/dataExtractionService.ts';
let content = fs.readFileSync(FILE_PATH, 'utf8');

const regexFunc2 = `
    const wombRegex = /tử cung|âm đạo|hoa tâm/gi;
    if (wombRegex.test(narrative)) {
       // Look for names near these words
       const sentences = narrative.split(/[\\.\\!\\?]/);
       for(const sentence of sentences) {
          if (wombRegex.test(sentence)) {
              if (knowledgeBase) {
                  const allNpcs = [
                      ...(knowledgeBase.discoveredNPCs || []),
                      ...(knowledgeBase.wives || []),
                      ...(knowledgeBase.slaves || []),
                      ...(knowledgeBase.prisoners || [])
                  ];
                  const femaleNpcs = allNpcs.filter(n => n.gender === 'Nữ');
                  for(const npc of femaleNpcs) {
                      if (sentence.includes(npc.name)) {
                          // Found a female NPC near womb words, try to find male
                          let malePartner = 'MC';
                          const maleNpcs = allNpcs.filter(n => n.gender === 'Nam');
                          for (const mNpc of maleNpcs) {
                              if (sentence.includes(mNpc.name)) {
                                  malePartner = mNpc.name;
                                  break;
                              }
                          }
                          const tag = \`[INTERACTION: type="sex", partner="\${npc.name}", malePartner="\${malePartner}"]\`;
                          if(!Array.from(tagsSet).some(t => t.includes('INTERACTION: type="sex"') && t.includes(npc.name))) {
                              tagsSet.add(tag);
                              console.log(\`[CƠ CHẾ TỰ ĐỘNG - THIÊN ĐẠO] Phát hiện từ khóa sinh sản, gán làm tình: \${npc.name} và \${malePartner}\`);
                          }
                      }
                  }
              }
          }
       }
    }
`;

if (!content.includes('Phát hiện từ khóa sinh sản')) {
    content = content.replace(
        `return Array.from(tagsSet);`,
        `${regexFunc2}\n    return Array.from(tagsSet);`
    );
    fs.writeFileSync(FILE_PATH, content, 'utf8');
    console.log("Patched dataExtractionService.ts with womb regex");
}
