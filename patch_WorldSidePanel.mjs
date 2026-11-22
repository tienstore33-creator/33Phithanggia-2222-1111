import fs from 'fs';

let content = fs.readFileSync('components/gameplay/WorldSidePanel.tsx', 'utf8');

const importRealm = `import { getEffectiveRealmSystem } from '../../services/realmManager';\n`;
if (!content.includes('import { getEffectiveRealmSystem }')) {
    content = content.replace(`import { getDeterministicAvatarSrc }`, importRealm + `import { getDeterministicAvatarSrc }`);
}

const importGame = `import { useGame } from '../../hooks/useGame';\n`;
if (!content.includes('useGame')) {
    content = content.replace(`import React, { useState } from "react";`, `import React, { useState } from "react";\n${importGame}`);
}

const hookInit = `  const game = useGame();`;
if (!content.includes('const game = useGame();')) {
    content = content.replace(/const toggleSection = /, hookInit + `\n  const toggleSection = `);
}

const buttonCode = `
    const handleNormalizeRealms = (e: React.MouseEvent) => {
        e.stopPropagation();
        const realmSystem = getEffectiveRealmSystem(knowledgeBase);
        const validRealms = new Set<string>();
        realmSystem.majorRealms.forEach(major => {
            validRealms.add(major);
            realmSystem.minorRealms.forEach(minor => {
                validRealms.add(major + ' ' + minor);
            });
        });
        
        const wrongNpcs = allVisibleNpcs.filter(c => !validRealms.has(c.realm));
        
        if (wrongNpcs.length === 0) {
            game.showNotification("Tất cả nhân vật đều có cảnh giới chuẩn xác.", "info");
            return;
        }
        
        if (window.confirm(\`Tìm thấy \${wrongNpcs.length} nhân vật có cảnh giới không chuẩn. Tiến hành chuẩn hoá bằng AI?\`)) {
            game.normalizeNpcRealms(wrongNpcs as any[]);
        }
    };
`;

if (!content.includes('handleNormalizeRealms')) {
    content = content.replace(/const currentRealm = /, buttonCode + `\n  const currentRealm = `);
}

const buttonHtml = `
      <AccordionItem
        title={VIETNAMESE.discoveredNPCsSection}
        count={allVisibleNpcs.length}
        isOpen={activeSection === "npc"}
        onClick={() => toggleSection("npc")}
      >
        {activeSection === "npc" && (
            <div className="px-3 pb-2 pt-1 border-b border-gray-800">
                <button 
                    onClick={handleNormalizeRealms}
                    className="w-full text-xs py-1.5 bg-blue-900/50 hover:bg-blue-800 text-blue-200 rounded border border-blue-700/50 transition-colors"
                >
                    Chuẩn Hoá Thực Lực 
                </button>
            </div>
        )}
        <WorldInfoList
`;

if (!content.includes('Chuẩn Hoá Thực Lực')) {
    content = content.replace(/<AccordionItem[\s\S]*?isOpen=\{activeSection === "npc"\}[\s\S]*?onClick=\{\(\) => toggleSection\("npc"\)\}[\s\S]*?>[\s\S]*?<WorldInfoList/, buttonHtml);
}

fs.writeFileSync('components/gameplay/WorldSidePanel.tsx', content);
console.log("Patched WorldSidePanel.tsx");
