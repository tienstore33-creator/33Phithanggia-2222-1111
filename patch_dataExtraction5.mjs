import fs from 'fs';

const FILE_PATH = './services/dataExtractionService.ts';
let content = fs.readFileSync(FILE_PATH, 'utf8');

const regexFunc5 = `
    const pregnancyUpdateRegex = /Cập nhật:\\s+([A-ZÀ-Ỹa-zà-ỹ\\s]+)\\s+(mang thai|đã sinh con)/gi;
    let pregnancyUpdateMatch;
    while ((pregnancyUpdateMatch = pregnancyUpdateRegex.exec(narrative)) !== null) {
        let name = pregnancyUpdateMatch[1].trim();
        let status = pregnancyUpdateMatch[2].trim().toLowerCase();
        name = name.replace(/^(như|rằng|khi|lúc|sau đó|và|thì|nhưng|tuy nhiên|có vẻ)\\s+/i, "").trim();
        name = name.split(/[\\,\\.\\;\\:\\(\\)]/)[0].trim();
        
        if (name.length > 1) {
            let desc = status.includes("mang thai") ? "Đang mang trong mình cốt nhục" : "Đã hạ sinh con";
            let statusText = status.includes("mang thai") ? "Mang thai" : "Bình thường";
            
            const tag = \`[NPC_UPDATE: id="\${name}", status="\${statusText}", description="\${desc}"]\`;
            if(!Array.from(tagsSet).some(t => t.includes('NPC_UPDATE') && t.includes(name) && t.includes(statusText))) {
                tagsSet.add(tag);
                console.log(\`[CƠ CHẾ TỰ ĐỘNG - THIÊN ĐẠO] Tự động phát hiện trạng thái thai sản: \${name} - \${statusText}\`);
            }
        }
    }
`;

if (!content.includes('Tự động phát hiện trạng thái thai sản')) {
    content = content.replace(
        `return Array.from(tagsSet);`,
        `${regexFunc5}\n    return Array.from(tagsSet);`
    );
    fs.writeFileSync(FILE_PATH, content, 'utf8');
    console.log("Patched dataExtractionService.ts with pregnancy update regex");
}
