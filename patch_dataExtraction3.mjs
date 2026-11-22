import fs from 'fs';

const FILE_PATH = './services/dataExtractionService.ts';
let content = fs.readFileSync(FILE_PATH, 'utf8');

// The original tag was modified in patch 1. Let's make sure it handles malePartner parameter properly.
const regexFunc3 = `
    const pregnancyRevealRegex = /([A-ZÀ-Ỹa-zà-ỹ\\s]+)\\s+(mang thai|có thai|nôn nghén|nghén|chửa)/gi;
    let pregnancyRevealMatch;
    while ((pregnancyRevealMatch = pregnancyRevealRegex.exec(narrative)) !== null) {
        let p1 = pregnancyRevealMatch[1].trim();
        p1 = p1.replace(/^(như|rằng|khi|lúc|sau đó|và|thì|nhưng|tuy nhiên|có vẻ)\\s+/i, "").trim();
        p1 = p1.split(/[\\,\\.\\;\\:\\(\\)]/)[0].trim();
        
        if (p1.length > 1) {
            const tag = \`[INTERACTION: type="pregnancy_reveal", partner="\${p1}"]\`;
            if(!Array.from(tagsSet).some(t => t.includes('INTERACTION: type="pregnancy_reveal"') && t.includes(p1))) {
                tagsSet.add(tag);
                console.log(\`[CƠ CHẾ TỰ ĐỘNG - THIÊN ĐẠO] Tự động phát hiện thông báo mang thai: \${p1}\`);
            }
        }
    }
`;

if (!content.includes('Tự động phát hiện thông báo mang thai')) {
    content = content.replace(
        `return Array.from(tagsSet);`,
        `${regexFunc3}\n    return Array.from(tagsSet);`
    );
    fs.writeFileSync(FILE_PATH, content, 'utf8');
    console.log("Patched dataExtractionService.ts with pregnancy reveal regex");
}
