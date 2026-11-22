import fs from 'fs';

const FILE_PATH = './services/dataExtractionService.ts';
let content = fs.readFileSync(FILE_PATH, 'utf8');

// The original tag was modified in patch 1. Let's make sure it handles malePartner parameter properly.
const regexFunc4 = `
    const renameRegex = /Cập nhật:\\s+([A-ZÀ-Ỹa-zà-ỹ\\s]+)\\s+đã đổi tên thành\\s+([A-ZÀ-Ỹa-zà-ỹ\\s]+)/gi;
    let renameMatch;
    while ((renameMatch = renameRegex.exec(narrative)) !== null) {
        let oldName = renameMatch[1].trim();
        let newName = renameMatch[2].trim();
        newName = newName.split(/[\\,\\.\\;\\:\\(\\)]/)[0].trim();
        
        if (oldName && newName) {
            const tag = \`[NPC_RENAME: oldName="\${oldName}", newName="\${newName}"]\`;
            if(!Array.from(tagsSet).some(t => t.includes('NPC_RENAME') && t.includes(oldName))) {
                tagsSet.add(tag);
                console.log(\`[CƠ CHẾ TỰ ĐỘNG - THIÊN ĐẠO] Tự động phát hiện đổi tên: \${oldName} -> \${newName}\`);
            }
        }
    }
`;

if (!content.includes('Tự động phát hiện đổi tên')) {
    content = content.replace(
        `return Array.from(tagsSet);`,
        `${regexFunc4}\n    return Array.from(tagsSet);`
    );
    fs.writeFileSync(FILE_PATH, content, 'utf8');
    console.log("Patched dataExtractionService.ts with rename regex");
}
