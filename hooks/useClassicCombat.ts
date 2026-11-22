import { useState, useEffect, useRef, useCallback } from 'react';
import { KnowledgeBase, NPC, YeuThu, CombatEndPayload } from '../types';
import { streamClassicCombatTurn, CombatMessage } from '../services/combatClassicStreamService';
import { parseCombatResponse } from '../src/utils/combatscreenoldtag';
import { parseCombatChoices } from '../src/utils/combatChoiceParser';
import { parseFactionChanges } from '../src/utils/combatFactionParser';
import { useGame } from './useGame';
import { extractNarrationContent } from '../utils/combatTextFilter';

export interface UseClassicCombatParams {
  knowledgeBase: KnowledgeBase;
  onCombatEnd: (payload: CombatEndPayload) => void;
  currentPageMessagesLog?: any[];
  previousPageSummaries?: string[];
  lastNarrationFromPreviousPage?: string;
}

export function useClassicCombat({
  knowledgeBase,
  onCombatEnd,
}: UseClassicCombatParams) {
  const { gameMessages, setKnowledgeBase } = useGame();
  const [combatMessages, setCombatMessages] = useState<CombatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentStreamText, setCurrentStreamText] = useState('');
  const [isEnded, setIsEnded] = useState(false);
  const [choices, setChoices] = useState<string[]>([]);
  const [lastRawPrompt, setLastRawPrompt] = useState<string>('');
  const [lastRawResponse, setLastRawResponse] = useState<string>('');

  const abortControllerRef = useRef<AbortController | null>(null);

  // Khởi tạo danh sách đối thủ & đồng minh
  const playerName = knowledgeBase.worldConfig?.playerName || knowledgeBase.playerStats?.name || 'Người Chơi';
  const altPlayerName = knowledgeBase.playerStats?.name || knowledgeBase.worldConfig?.playerName;

  const pendingCombat = knowledgeBase.pendingCombat;
  const rawOpponentIds = pendingCombat?.opponentIds || [];
  const rawAllyIds = pendingCombat?.allyIds || [];
  const allyCount = Math.max(1, rawAllyIds.length + 1);
  const maxAllowedOpponents = allyCount * 3;
  const opponentIds = rawOpponentIds.slice(0, maxAllowedOpponents);
  const npcs = knowledgeBase.discoveredNPCs || [];
  const yeuThus = knowledgeBase.discoveredYeuThu || [];
  const companions = knowledgeBase.companions || [];
  const prisoners = knowledgeBase.prisoners || (knowledgeBase as any).capturedPrisoners || [];
  const slaves = knowledgeBase.slaves || [];
  const wives = knowledgeBase.wives || [];
  const people = (knowledgeBase as any).people || [];
  const temporaryEntities = pendingCombat?.temporaryEntities || [];

  const COMBAT_ATK_MULTIPLIER = 4;

  const getNpcHp = (c: any) => {
    if (!c) return 0;
    const stats = c.stats || c;
    return Math.max(
      stats.maxSinhLuc ?? 0,
      stats.sinhLuc ?? 0,
      stats.sinhLucToiDa ?? 0,
      stats.maxHp ?? 0,
      stats.hp ?? 0,
      c.maxSinhLuc ?? 0,
      c.sinhLuc ?? 0,
      0
    );
  };

  const allMappedOpponents = rawOpponentIds
    .map(id => {
      const found = npcs.find(n => n.id === id) || 
                    yeuThus.find(yt => yt.id === id) ||
                    slaves.find(s => s.id === id) ||
                    prisoners.find(p => p.id === id) ||
                    companions.find(c => c.id === id) ||
                    wives.find(w => w.id === id) ||
                    people.find(p => p.id === id) ||
                    temporaryEntities.find(te => te.id === id);
      if (found) {
        const baseStats = found.stats || {};
        const sucTanCong = (baseStats.sucTanCong ?? (found as any).atk ?? 10) * COMBAT_ATK_MULTIPLIER;
        return { 
          ...found, 
          faction: ('faction' in found && found.faction) || 'enemy' as 'enemy' | 'ally' | 'neutral',
          stats: {
            ...baseStats,
            sucTanCong
          }
        };
      }
      return null;
    })
    .filter((c): c is any => !!c);

  // Tự động sắp xếp các NPC đối thủ có máu lớn nhất lên đầu
  allMappedOpponents.sort((a, b) => getNpcHp(b) - getNpcHp(a));
  const initialOpponents = allMappedOpponents.slice(0, maxAllowedOpponents);

  // Hợp nhất ID đồng minh từ cả pendingCombat.allyIds lẫn combatCompanionIds
  const combinedAllyIds = Array.from(new Set([
    ...(pendingCombat?.allyIds || []),
    ...(knowledgeBase.combatCompanionIds || [])
  ]));

  const initialCompanions = combinedAllyIds
    .map(id => {
      const found = companions.find(c => c.id === id) ||
                    npcs.find(n => n.id === id) ||
                    prisoners.find(p => p.id === id) ||
                    slaves.find(s => s.id === id) ||
                    wives.find(w => w.id === id) ||
                    people.find((p: any) => p.id === id) ||
                    temporaryEntities.find(te => te.id === id);
      if (found) {
        const stats = found.stats || {};
        const sinhLuc = stats.sinhLuc ?? (found as any).hp ?? 100;
        const maxSinhLuc = stats.maxSinhLuc ?? (found as any).maxHp ?? sinhLuc;
        const linhLuc = stats.linhLuc ?? (found as any).mana ?? 50;
        const maxLinhLuc = stats.maxLinhLuc ?? (found as any).maxMana ?? linhLuc;
        const sucTanCong = (stats.sucTanCong ?? (found as any).atk ?? 10) * COMBAT_ATK_MULTIPLIER;

        return {
          ...found,
          faction: ('faction' in found && found.faction) || 'ally' as 'enemy' | 'ally' | 'neutral',
          stats: {
            ...stats,
            sinhLuc,
            maxSinhLuc,
            sinhLucToiDa: maxSinhLuc,
            linhLuc,
            maxLinhLuc,
            linhLucToiDa: maxLinhLuc,
            sucTanCong
          }
        };
      }
      return null;
    })
    .filter((c): c is any => !!c);

  // Tự động sắp xếp các NPC đồng minh có máu lớn nhất lên đầu
  initialCompanions.sort((a, b) => getNpcHp(b) - getNpcHp(a));

  const [combatants, setCombatants] = useState<any[]>(() => {
    const list: any[] = [];
    
    // 1. Allies
    initialCompanions.forEach(c => {
      list.push({
        ...c,
        faction: 'ally',
        isSummoned: false,
        isFactionChanged: false
      });
    });

    // 2. Opponents (enemy / neutral)
    initialOpponents.forEach(o => {
      list.push({
        ...o,
        faction: o.faction || 'enemy',
        isSummoned: false,
        isFactionChanged: false
      });
    });

    return list;
  });

  // 1. Allies (phe ta): faction === 'ally'
  const allies = combatants.filter(c => c.faction === 'ally');
  const activeCompanions = (() => {
    const bypassed = allies.filter(c => (c.isSummoned || c.isFactionChanged || c.isFormationSwapped) && !c.isBenched);
    const standard = allies.filter(c => !c.isSummoned && !c.isFactionChanged && !c.isFormationSwapped && !c.isBenched);
    
    const sortedStandard = [...standard].sort((a, b) => getNpcHp(b) - getNpcHp(a));
    const activeStandard: any[] = [];
    for (const c of sortedStandard) {
      const isAlive = (c.stats?.sinhLuc ?? c.hp ?? 0) > 0;
      if (isAlive && activeStandard.length < 3) {
        activeStandard.push(c);
      }
    }
    return [...activeStandard, ...bypassed];
  })();

  // 2. Enemies (phe kẻ địch): faction === 'enemy'
  const enemies = combatants.filter(c => c.faction === 'enemy');
  const activeEnemiesList = (() => {
    const bypassed = enemies.filter(c => (c.isSummoned || c.isFactionChanged || c.isFormationSwapped) && !c.isBenched);
    const standard = enemies.filter(c => !c.isSummoned && !c.isFactionChanged && !c.isFormationSwapped && !c.isBenched);
    
    const sortedStandard = [...standard].sort((a, b) => getNpcHp(b) - getNpcHp(a));
    const activeStandard: any[] = [];
    for (const c of sortedStandard) {
      const isAlive = (c.stats?.sinhLuc ?? c.hp ?? 0) > 0;
      if (isAlive && activeStandard.length < 3) {
        activeStandard.push(c);
      }
    }
    return [...activeStandard, ...bypassed];
  })();

  // 3. Neutrals (phe trung lập): faction === 'neutral'
  const neutrals = combatants.filter(c => c.faction === 'neutral');
  const activeNeutralsList = (() => {
    const bypassed = neutrals.filter(c => (c.isSummoned || c.isFactionChanged || c.isFormationSwapped) && !c.isBenched);
    const standard = neutrals.filter(c => !c.isSummoned && !c.isFactionChanged && !c.isFormationSwapped && !c.isBenched);
    
    const sortedStandard = [...standard].sort((a, b) => getNpcHp(b) - getNpcHp(a));
    const activeStandard: any[] = [];
    for (const c of sortedStandard) {
      const isAlive = (c.stats?.sinhLuc ?? c.hp ?? 0) > 0;
      if (isAlive && activeStandard.length < 3) {
        activeStandard.push(c);
      }
    }
    return [...activeStandard, ...bypassed];
  })();

  const opponents = [...activeEnemiesList, ...activeNeutralsList];

  // Khởi tạo thông điệp mở đầu trận đánh
  useEffect(() => {
    if (combatMessages.length === 0) {
      const oppNames = initialOpponents.map(o => o.name).join(', ');
      const initText = `Trận chiến bắt đầu! ${playerName} đối đầu với ${oppNames || 'kẻ thù'}${
        activeCompanions.length > 0 ? ` cùng đồng minh ${activeCompanions.map(c => c.name).join(', ')}` : ''
      }!`;
      setCombatMessages([
        {
          id: `msg-${Date.now()}`,
          text: initText,
          type: 'system',
          timestamp: Date.now()
        }
      ]);
    }
  }, []);

  const sendAction = useCallback(async (actionText: string) => {
    if (!actionText.trim() || isStreaming) return;

    // Hủy request cũ nếu có
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    // 1. Optimistic Update: Thêm hành động / lời thoại của người chơi ngay lập tức
    const userMsg: CombatMessage = {
      id: `user-${Date.now()}`,
      text: `${playerName}: "${actionText.trim()}"`,
      type: 'player_action',
      timestamp: Date.now()
    };

    setCombatMessages(prev => [...prev, userMsg]);
    setIsStreaming(true);
    setCurrentStreamText('');

    try {
      let accumulatedText = '';

      const recentStoryTurns = (gameMessages || [])
        .filter(m => m.type === 'narration')
        .slice(-4)
        .map(m => extractNarrationContent(m.content))
        .filter(Boolean);

      const { narrationText, combatDataJson } = await streamClassicCombatTurn(
        knowledgeBase,
        actionText,
        [...combatMessages, userMsg],
        (chunk) => {
          accumulatedText += chunk;
          setCurrentStreamText(accumulatedText);
        },
        controller.signal,
        recentStoryTurns,
        {
          onPromptGenerated: (prompt) => setLastRawPrompt(prompt),
          onRawResponseComplete: (res) => setLastRawResponse(res)
        },
        [...activeCompanions, ...opponents]
      );

      // Quét và lọc tag chiến đấu bằng combatscreenoldtag và combatFactionParser
      const rawFullText = narrationText || accumulatedText;
      const { cleanText: textWithoutFaction, changes: factionChanges, summons } = parseFactionChanges(rawFullText);
      
      const pStats = knowledgeBase.playerStats;
      const currentHpForParser = pStats?.sinhLuc || 0;
      const maxHpForParser = pStats?.maxSinhLuc || currentHpForParser || 100;

      const parsedTagResult = parseCombatResponse(
        textWithoutFaction, 
        playerName, 
        altPlayerName, 
        factionChanges,
        currentHpForParser,
        maxHpForParser,
        knowledgeBase,
        combatants
      );
      const parsedChoiceResult = parseCombatChoices(parsedTagResult.cleanNarrative);

      // Cập nhật sinh lực/man lực người chơi nếu có biến động
      if (parsedTagResult.playerHpChange !== 0 || parsedTagResult.playerMpChange !== 0) {
        setKnowledgeBase(prevKb => {
          if (!prevKb.playerStats) return prevKb;
          const currentHp = prevKb.playerStats.sinhLuc || 0;
          const maxHp = prevKb.playerStats.maxSinhLuc || currentHp || 100;
          
          // Sử dụng finalPlayerHp từ parser nếu có (đã được tính toán tuần tự và ghim ở 0)
          // Nếu không có, fallback về cách tính tổng cũ
          const newHp = parsedTagResult.finalPlayerHp !== undefined 
            ? parsedTagResult.finalPlayerHp 
            : Math.max(0, Math.min(maxHp, currentHp + parsedTagResult.playerHpChange));

          const currentMp = prevKb.playerStats.manLuc || 0;
          const maxMp = prevKb.playerStats.maxManLuc || currentMp || 100;
          const newMp = Math.max(0, Math.min(maxMp, currentMp + parsedTagResult.playerMpChange));

          return {
            ...prevKb,
            playerStats: {
              ...prevKb.playerStats,
              sinhLuc: newHp,
              manLuc: newMp
            }
          };
        });
      }

      if (summons.length > 0) {
        setCombatants(prev => [
          ...prev,
          ...summons.map(s => ({
            id: s.id,
            name: s.name,
            realm: s.realm || (s as any).canhGioi || 'Chưa rõ',
            species: s.species || 'Chưa rõ',
            faction: s.faction || 'enemy',
            isSummoned: true,
            isFactionChanged: false,
            stats: {
              sinhLuc: s.sinhLuc,
              maxSinhLuc: s.maxSinhLuc,
              linhLuc: s.linhLuc,
              maxLinhLuc: s.maxLinhLuc,
              sucTanCong: s.sucTanCong
            }
          }))
        ]);

        for (const s of summons) {
          const summonMsg: CombatMessage = {
            id: `summon-${Date.now()}-${Math.random()}`,
            text: `✨ Đã triệu hồi thành công [${s.name}] tham gia chiến đấu!`,
            type: 'system',
            timestamp: Date.now()
          };
          setCombatMessages(p => [...p, summonMsg]);
        }
      }

      if (factionChanges.length > 0) {
        setCombatants(prev => prev.map(c => {
          const match = factionChanges.find(fc => 
            fc.target.toLowerCase() === c.id.toLowerCase() ||
            c.name.toLowerCase().includes(fc.target.toLowerCase()) ||
            fc.target.toLowerCase().includes(c.name.toLowerCase()) ||
            (fc.target.toLowerCase() === 'enemy' && c.faction === 'enemy')
          );
          if (match) {
            return { 
              ...c, 
              faction: match.newFaction,
              isFactionChanged: true
            };
          }
          return c;
        }));

        // Thêm thông báo chuyển phe vào chat / hệ thống
        for (const fc of factionChanges) {
          const factionName = fc.newFaction === 'ally' ? 'Đồng Minh' : fc.newFaction === 'enemy' ? 'Kẻ Địch' : 'Trung Lập';
          const factionMsg: CombatMessage = {
            id: `faction-${Date.now()}-${Math.random()}`,
            text: `🌀 [${fc.target}] đã chuyển phe thành ${factionName}!`,
            type: 'system',
            timestamp: Date.now()
          };
          setCombatMessages(p => [...p, factionMsg]);
        }
      }

      if (parsedTagResult.formationChanges && parsedTagResult.formationChanges.length > 0) {
        setCombatants(prevCombatants => {
          return prevCombatants.map(c => {
            const outMatch = parsedTagResult.formationChanges.find(fc =>
              c.id.toLowerCase() === fc.outEntity.toLowerCase() ||
              c.name.toLowerCase().includes(fc.outEntity.toLowerCase()) ||
              fc.outEntity.toLowerCase().includes(c.name.toLowerCase())
            );
            if (outMatch) {
              const currentHp = c.stats?.sinhLuc ?? c.hp ?? 0;
              const maxHp = c.stats?.maxSinhLuc ?? c.stats?.sinhLucToiDa ?? c.maxHp ?? (currentHp || 100);
              if (currentHp < maxHp * 0.2 || currentHp === 0) {
                return {
                  ...c,
                  isBenched: true,
                  isFormationSwapped: false
                };
              }
            }

            const inMatch = parsedTagResult.formationChanges.find(fc =>
              c.id.toLowerCase() === fc.inEntity.toLowerCase() ||
              c.name.toLowerCase().includes(fc.inEntity.toLowerCase()) ||
              fc.inEntity.toLowerCase().includes(c.name.toLowerCase())
            );
            if (inMatch) {
              return {
                ...c,
                isBenched: false,
                isFormationSwapped: true
              };
            }

            return c;
          });
        });

        for (const fc of parsedTagResult.formationChanges) {
          const formationMsg: CombatMessage = {
            id: `formation-${Date.now()}-${Math.random()}`,
            text: `🔄 [${fc.outEntity}] lùi về dự bị, [${fc.inEntity}] xuất trận thay thế!`,
            type: 'system',
            timestamp: Date.now()
          };
          setCombatMessages(p => [...p, formationMsg]);
        }
      }

      // Thêm thông điệp đã lọc sạch tag vào nhật ký
      const aiMsg: CombatMessage = {
        id: `ai-${Date.now()}`,
        text: parsedChoiceResult.cleanText || parsedTagResult.cleanNarrative || rawFullText,
        type: 'narration',
        timestamp: Date.now()
      };

      setCombatMessages(prev => [...prev, aiMsg]);

      if (parsedChoiceResult.choices.length > 0) {
        setChoices(parsedChoiceResult.choices);
      }

      // Cập nhật sinh lực/man lực đối thủ từ tag
      if (Object.keys(parsedTagResult.enemyHpChanges).length > 0 || Object.keys(parsedTagResult.enemyMpChanges || {}).length > 0) {
        setCombatants(prevCombatants => {
          return prevCombatants.map(c => {
            let hpDelta = 0;
            let mpDelta = 0;
            
            // Khớp theo ID hoặc Tên cho HP
            for (const [key, delta] of Object.entries(parsedTagResult.enemyHpChanges)) {
              let matchId = '';
              let matchName = '';
              if (key.includes('@@')) {
                const parts = key.split('@@');
                matchId = parts[0].trim().toLowerCase();
                matchName = parts[1].trim().toLowerCase();
              } else {
                matchId = key.toLowerCase();
                matchName = key.toLowerCase();
              }

              const targetId = (c.id || '').toLowerCase();
              const targetName = (c.name || '').toLowerCase();

              if (
                targetId === matchId ||
                targetName === matchName ||
                targetName.includes(matchName) ||
                (matchId === 'enemy' && c.faction === 'enemy')
              ) {
                hpDelta += delta;
              }
            }

            // Khớp theo ID hoặc Tên cho MP
            for (const [key, delta] of Object.entries(parsedTagResult.enemyMpChanges || {})) {
              let matchId = '';
              let matchName = '';
              if (key.includes('@@')) {
                const parts = key.split('@@');
                matchId = parts[0].trim().toLowerCase();
                matchName = parts[1].trim().toLowerCase();
              } else {
                matchId = key.toLowerCase();
                matchName = key.toLowerCase();
              }

              const targetId = (c.id || '').toLowerCase();
              const targetName = (c.name || '').toLowerCase();

              if (
                targetId === matchId ||
                targetName === matchName ||
                targetName.includes(matchName) ||
                (matchId === 'enemy' && c.faction === 'enemy')
              ) {
                mpDelta += delta;
              }
            }

            if ((hpDelta !== 0 || mpDelta !== 0) && c.stats) {
              const currentHp = c.stats.sinhLuc || 0;
              const newHp = hpDelta !== 0 ? Math.max(0, currentHp + hpDelta) : currentHp;
              
              const currentMp = c.stats.linhLuc || 0;
              const maxMp = c.stats.maxLinhLuc || currentMp || 100;
              const newMp = mpDelta !== 0 ? Math.max(0, Math.min(maxMp, currentMp + mpDelta)) : currentMp;
              
              return {
                ...c,
                stats: {
                  ...c.stats,
                  sinhLuc: newHp,
                  linhLuc: newMp
                }
              };
            }
            return c;
          });
        });
      }

      // Xử lý JSON cập nhật nếu có
      if (combatDataJson) {
        if (combatDataJson.updatedOpponents && Array.isArray(combatDataJson.updatedOpponents)) {
          setCombatants(prevCombatants => {
            return prevCombatants.map(c => {
              const update = combatDataJson.updatedOpponents.find((u: any) => u.id === c.id || u.name === c.name);
              if (update && c.stats && update.damageTaken) {
                const newHp = Math.max(0, (c.stats.sinhLuc || 0) - (update.damageTaken || 0));
                return {
                  ...c,
                  stats: {
                    ...c.stats,
                    sinhLuc: newHp
                  }
                };
              }
              return c;
            });
          });
        }

        if (combatDataJson.isCombatEnded) {
          setIsEnded(true);
          const endMsg: CombatMessage = {
            id: `end-${Date.now()}`,
            text: combatDataJson.victory ? 'Trận đánh kết thúc! Bạn đã giành chiến thắng!' : 'Trận đánh kết thúc!',
            type: 'system',
            timestamp: Date.now()
          };
          setCombatMessages(prev => [...prev, endMsg]);
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('Lỗi khi thực hiện lượt đấu classic stream:', err);
        const errorMsg: CombatMessage = {
          id: `err-${Date.now()}`,
          text: `[Lỗi phản hồi AI]: ${err.message || 'Không thể kết nối API.'}`,
          type: 'system',
          timestamp: Date.now()
        };
        setCombatMessages(prev => [...prev, errorMsg]);
      }
    } finally {
      setIsStreaming(false);
      setCurrentStreamText('');
    }
  }, [knowledgeBase, combatMessages, isStreaming, playerName]);

  return {
    combatMessages,
    isStreaming,
    currentStreamText,
    opponents,
    activeCompanions,
    isEnded,
    choices,
    sendAction,
    combatants,
    lastRawPrompt,
    lastRawResponse
  };
}
