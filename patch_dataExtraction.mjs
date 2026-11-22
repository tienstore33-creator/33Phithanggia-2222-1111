import fs from 'fs';

const FILE_PATH = './services/dataExtractionService.ts';
let content = fs.readFileSync(FILE_PATH, 'utf8');

const regexFunc = `
    const sexRegex = /([A-ZÀ-Ỹa-zà-ỹ\\s]+)\\s+(làm tình|quan hệ|ân ái|giao cấu|hoan ái)\\s+(với|cùng)\\s+([A-ZÀ-Ỹa-zà-ỹ\\s]+)/gi;
    let sexMatch;
    while ((sexMatch = sexRegex.exec(narrative)) !== null) {
        let p1 = sexMatch[1].trim();
        let p2 = sexMatch[4].trim();
        // Clean up common narrative words
        p1 = p1.replace(/^(như|rằng|khi|lúc|sau đó|và|thì|nhưng)\\s+/i, "");
        p2 = p2.replace(/^(như|rằng|khi|lúc|sau đó|và|thì|nhưng)\\s+/i, "");
        p2 = p2.split(/[\\,\\.\\;\\:\\(\\)]/)[0].trim();
        
        // Very basic gender inference by name presence in kb
        let femalePartner = "";
        let malePartner = "";
        
        const isFemale = (name) => {
            if(!knowledgeBase) return false;
            const npc = [
                ...(knowledgeBase.discoveredNPCs || []),
                ...(knowledgeBase.wives || []),
                ...(knowledgeBase.slaves || []),
                ...(knowledgeBase.prisoners || [])
            ].find(n => n.name.toLowerCase() === name.toLowerCase());
            return npc && npc.gender === 'Nữ';
        };
        
        if (isFemale(p1)) {
            femalePartner = p1;
            malePartner = p2;
        } else if (isFemale(p2)) {
            femalePartner = p2;
            malePartner = p1;
        } else {
             // Default assumption if not found, p2 is often the female in these sentences
             femalePartner = p2;
             malePartner = p1;
        }

        const tag = \`[INTERACTION: type="sex", partner="\${femalePartner}", malePartner="\${malePartner}"]\`;
        if(!Array.from(tagsSet).some(t => t.includes('INTERACTION: type="sex"') && t.includes(femalePartner))) {
            tagsSet.add(tag);
            console.log(\`[CƠ CHẾ TỰ ĐỘNG - THIÊN ĐẠO] Tự động phát hiện làm tình: \${femalePartner} và \${malePartner}\`);
        }
    }
`;

if (!content.includes('Tự động phát hiện làm tình')) {
    content = content.replace(
        `return Array.from(tagsSet);`,
        `${regexFunc}\n    return Array.from(tagsSet);`
    );
    fs.writeFileSync(FILE_PATH, content, 'utf8');
    console.log("Patched dataExtractionService.ts");
}
