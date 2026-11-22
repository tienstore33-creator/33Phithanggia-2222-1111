import fs from 'fs';

let content = fs.readFileSync('hooks/useGameActions.ts', 'utf8');

const importStatement = `import { normalizeNpcRealmsApi } from '../services/normalizeRealmService';\n`;

content = content.replace(`import { getEffectiveRealmSystem }`, importStatement + `import { getEffectiveRealmSystem }`);

const newAction = `
  const normalizeNpcRealms = async (npcsToNormalize: NPC[]) => {
      setIsLoadingApi(true);
      try {
          const results = await normalizeNpcRealmsApi(knowledgeBase, npcsToNormalize);
          if (results && results.length > 0) {
              setKnowledgeBase(prev => {
                  const newKb = { ...prev };
                  let isUpdated = false;
                  
                  const updateList = (list: any[]) => {
                      if (!list) return false;
                      let updated = false;
                      for (const npc of list) {
                          const updateObj = results.find(r => r.id === npc.id);
                          if (updateObj && updateObj.newRealm && updateObj.newRealm !== npc.realm) {
                              npc.realm = updateObj.newRealm;
                              
                              // Recalculate stats based on new realm
                              const realmSystem = getEffectiveRealmSystem(newKb);
                              const parsedRealm = parseRealm(npc.realm, realmSystem);
                              
                              // We need to calculate base stats and effective stats
                              const baseStats = calculateRealmBaseStats(
                                  parsedRealm.majorIndex,
                                  parsedRealm.minorIndex,
                                  newKb.currentRealmBaseStats,
                                  realmSystem.majorRealms
                              );
                              
                              npc.stats = calculateEffectiveStats(baseStats, npc.tuChatTier || 'Thường', newKb);
                              updated = true;
                          }
                      }
                      return updated;
                  };
                  
                  if (updateList(newKb.discoveredNPCs)) isUpdated = true;
                  if (updateList(newKb.wives)) isUpdated = true;
                  if (updateList(newKb.slaves)) isUpdated = true;
                  if (updateList(newKb.prisoners)) isUpdated = true;
                  
                  if (isUpdated) {
                      showNotification("Chuẩn hoá thực lực thành công!", "success");
                  } else {
                      showNotification("Không có thay đổi nào.", "info");
                  }
                  
                  return newKb;
              });
          } else {
             showNotification("AI không trả về kết quả chuẩn hoá hợp lệ.", "warning");
          }
      } catch (err) {
          console.error("Lỗi chuẩn hoá thực lực:", err);
          showNotification("Đã có lỗi xảy ra khi chuẩn hoá thực lực.", "error");
      } finally {
          setIsLoadingApi(false);
      }
  };
`;

content = content.replace(`return {`, newAction + `\n  return {`);

// ensure parseRealm is imported
if (!content.includes('import { parseRealm }')) {
    content = content.replace(`import { getEffectiveRealmSystem }`, `import { parseRealm } from '../utils/realmUtils';\nimport { getEffectiveRealmSystem }`);
}

fs.writeFileSync('hooks/useGameActions.ts', content);
console.log("Patched useGameActions.ts");
