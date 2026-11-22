import fs from 'fs';

let contentCompanion = fs.readFileSync('components/CompanionManagementScreen.tsx', 'utf8');
const defCodeCompanion = `
    const handleNormalizeRealms = () => {
        const realmSystem = getEffectiveRealmSystem(game.knowledgeBase);
        const validRealms = new Set<string>();
        realmSystem.majorRealms.forEach(major => {
            validRealms.add(major);
            realmSystem.minorRealms.forEach(minor => {
                validRealms.add(major + ' ' + minor);
            });
        });
        
        const wrongNpcs = allCompanions.filter(c => !validRealms.has(c.realm));
        
        if (wrongNpcs.length === 0) {
            game.showNotification("Tất cả hậu cung đều có cảnh giới chuẩn xác.", "info");
            return;
        }
        
        if (window.confirm(\`Tìm thấy \${wrongNpcs.length} nhân vật có cảnh giới không chuẩn. Tiến hành chuẩn hoá bằng AI?\`)) {
            game.normalizeNpcRealms(wrongNpcs as any[]);
        }
    };
`;
contentCompanion = contentCompanion.replace(/const companionFullStats = /, defCodeCompanion + '\n    const companionFullStats = ');
fs.writeFileSync('components/CompanionManagementScreen.tsx', contentCompanion);

let contentPrisoner = fs.readFileSync('components/PrisonerManagementScreen.tsx', 'utf8');
const defCodePrisoner = `
    const handleNormalizeRealms = () => {
        const realmSystem = getEffectiveRealmSystem(game.knowledgeBase);
        const validRealms = new Set<string>();
        realmSystem.majorRealms.forEach(major => {
            validRealms.add(major);
            realmSystem.minorRealms.forEach(minor => {
                validRealms.add(major + ' ' + minor);
            });
        });
        
        const wrongNpcs = game.knowledgeBase.prisoners.filter(c => !validRealms.has(c.realm));
        
        if (wrongNpcs.length === 0) {
            game.showNotification("Tất cả tù binh đều có cảnh giới chuẩn xác.", "info");
            return;
        }
        
        if (window.confirm(\`Tìm thấy \${wrongNpcs.length} nhân vật có cảnh giới không chuẩn. Tiến hành chuẩn hoá bằng AI?\`)) {
            game.normalizeNpcRealms(wrongNpcs as any[]);
        }
    };
`;
contentPrisoner = contentPrisoner.replace(/const handleUseItemOrSkill = /, defCodePrisoner + '\n    const handleUseItemOrSkill = ');
fs.writeFileSync('components/PrisonerManagementScreen.tsx', contentPrisoner);
console.log("Patched both screens");
