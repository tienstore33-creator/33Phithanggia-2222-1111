import fs from 'fs';
let content = fs.readFileSync('hooks/useMainGameLoop.ts', 'utf8');
content = content.replace('const mcBase = calculateRealmBaseStats(mcRealm, realmSystem.majorRealms, knowledgeBase.currentRealmBaseStats, realmSystem.minorRealms);', 'const mcBase = calculateRealmBaseStats(mcRealm || "Phàm Nhân", realmSystem.majorRealms, knowledgeBase.currentRealmBaseStats, realmSystem.minorRealms);');
fs.writeFileSync('hooks/useMainGameLoop.ts', content);
