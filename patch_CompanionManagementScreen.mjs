import fs from 'fs';

let content = fs.readFileSync('components/CompanionManagementScreen.tsx', 'utf8');

const importRealm = `import { getEffectiveRealmSystem } from '../services/realmManager';\n`;
if (!content.includes('import { getEffectiveRealmSystem }')) {
    content = content.replace(`import { getDeterministicAvatarSrc }`, importRealm + `import { getDeterministicAvatarSrc }`);
}

const buttonCode = `
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

if (!content.includes('handleNormalizeRealms')) {
    content = content.replace(/const filteredCompanions = useMemo\(/, buttonCode + `\n  const filteredCompanions = useMemo(`);
}

const buttonHtml = `
                    <Button variant="secondary" onClick={handleNormalizeRealms} disabled={isLoadingApi} className="bg-blue-600 hover:bg-blue-700 border-none text-white">
                        Chuẩn Hoá Thực Lực
                    </Button>
`;

if (!content.includes('Chuẩn Hoá Thực Lực')) {
    content = content.replace(/<Button variant="ghost" onClick=\{.. => setShowDebug\(true\)\}/, buttonHtml + `                    <Button variant="ghost" onClick={() => setShowDebug(true)}`);
}

fs.writeFileSync('components/CompanionManagementScreen.tsx', content);
console.log("Patched CompanionManagementScreen.tsx");
