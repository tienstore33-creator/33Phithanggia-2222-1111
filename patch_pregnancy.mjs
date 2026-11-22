import fs from 'fs';

const FILE_PATH = './services/PregnancyService.ts';
let content = fs.readFileSync(FILE_PATH, 'utf8');

content = content.replace(
    `public static checkConception(npc: any, fatherId: string = 'player'): boolean {`,
    `public static checkConception(npc: any, fatherId: string = 'player', fatherName: string = 'Người chơi'): boolean {`
);

content = content.replace(
    `fatherId: fatherId,`,
    `fatherId: fatherId,\n        fatherName: fatherName,`
);

content = content.replace(
    `description: \`Đứa con máu mủ của \${mother.name} và Người chơi. Vừa mới chào đời.\`,`,
    `description: \`Đứa con máu mủ của \${mother.name} và \${mother.pregnancy?.fatherName || 'Người chơi'}. Vừa mới chào đời.\`,`
);

fs.writeFileSync(FILE_PATH, content, 'utf8');
console.log("Patched PregnancyService.ts");

const TYPES_PATH = './src/types.ts';
let typesContent = fs.readFileSync(TYPES_PATH, 'utf8');
if (!typesContent.includes('fatherName?: string;')) {
    typesContent = typesContent.replace(
        `fatherId: string;       // ID người cha (thường là Player)`,
        `fatherId: string;       // ID người cha (thường là Player)\n  fatherName?: string;    // Tên người cha`
    );
    fs.writeFileSync(TYPES_PATH, typesContent, 'utf8');
    console.log("Patched src/types.ts");
}

const TAG_PROCESSOR_PATH = './utils/tagProcessors/interactionTagProcessor.ts';
let tpContent = fs.readFileSync(TAG_PROCESSOR_PATH, 'utf8');
tpContent = tpContent.replace(
    `const { partner, type } = params;`,
    `const { partner, type, malePartner } = params;`
);

tpContent = tpContent.replace(
    `const pregnantResult = PregnancyService.checkConception(targetNpc);`,
    `let fatherId = 'player';
        let fatherName = 'Người chơi';
        if (malePartner && malePartner.toLowerCase() !== 'mc' && malePartner.toLowerCase() !== 'player' && malePartner.toLowerCase() !== 'người chơi') {
            fatherId = \`npc-\${malePartner.replace(/\\s+/g, '-').toLowerCase()}\`;
            fatherName = malePartner;
        }
        const pregnantResult = PregnancyService.checkConception(targetNpc, fatherId, fatherName);`
);

fs.writeFileSync(TAG_PROCESSOR_PATH, tpContent, 'utf8');
console.log("Patched interactionTagProcessor.ts");

