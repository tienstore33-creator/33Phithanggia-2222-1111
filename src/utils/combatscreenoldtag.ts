/**
 * combatscreenoldtag.ts
 * 
 * Trung tâm quét và nhận diện Tag/Chỉ số chiến đấu trong log hội thoại & combat.
 * Tự động phân tích cú pháp, lọc sạch văn bản hiển thị và tính toán lượng thay đổi HP, MP.
 */

import {
  CombatTag,
  COMBAT_TAG_REGEX,
  NATURAL_HP_LOSS_REGEX,
  NATURAL_MP_LOSS_REGEX,
  NATURAL_HP_GAIN_REGEX
} from './satthuonglogcombatold';
import { FactionChangeRecord } from './combatFactionParser';
import { executeCombatAction } from '../../services/combat/CombatMechanicEngine';

export interface CombatParsedAction {
  type: 'HP_CHANGE' | 'MP_CHANGE' | 'STATUS';
  target: 'player' | 'enemy' | 'companion' | string;
  targetName?: string;
  amount: number;
  effect?: string;
  duration?: number;
  source?: string;
  skill?: string;
}

export interface FormationChangeInfo {
    outEntity: string;
    inEntity: string;
}

export interface ParseCombatResponseResult {
  cleanNarrative: string;
  combatActions: CombatParsedAction[];
  playerHpChange: number; // Tổng lượng HP thay đổi của Player (Âm: mất, Dương: hồi)
  playerMpChange: number; // Tổng lượng MP thay đổi của Player
  enemyHpChanges: Record<string, number>; // Mapping ID hoặc Tên kẻ thù -> Lượng HP thay đổi
  enemyMpChanges: Record<string, number>; // Mapping ID hoặc Tên kẻ thù -> Lượng MP thay đổi
  finalPlayerHp?: number; // Lượng HP cuối cùng sau khi tính toán tuần tự (nếu có currentHp/maxHp)
  formationChanges: FormationChangeInfo[];
}

/**
 * Hàm trung tâm nhận diện và trích xuất các tác động HP/MP/Trạng thái từ phản hồi AI
 */
export function parseCombatResponse(
  rawText: string,
  playerName: string = 'Người Chơi',
  altPlayerName?: string,
  factionChanges?: FactionChangeRecord[],
  currentHp?: number,
  maxHp?: number,
  knowledgeBase?: any,
  combatants?: any[]
): ParseCombatResponseResult {
  if (!rawText) {
    return {
      cleanNarrative: '',
      combatActions: [],
      playerHpChange: 0,
      playerMpChange: 0,
      enemyHpChanges: {},
      enemyMpChanges: {},
      formationChanges: []
    };
  }

  const combatActions: CombatParsedAction[] = [];
  let playerHpChange = 0;
  let playerMpChange = 0;
  const enemyHpChanges: Record<string, number> = {};
  const enemyMpChanges: Record<string, number> = {};
  const formationChanges: FormationChangeInfo[] = [];

  // Quét tag [change_formation: out="A", in="B"]
  const formationRegex = /\[change_formation:\s*out="([^"]+)"\s*,\s*in="([^"]+)"\]/gi;
  let formationMatch: RegExpExecArray | null;
  while ((formationMatch = formationRegex.exec(rawText)) !== null) {
    formationChanges.push({
      outEntity: formationMatch[1].trim(),
      inEntity: formationMatch[2].trim()
    });
  }

  const isPlayerTarget = (targetStr: string) => {
    if (!targetStr) return false;
    const lower = targetStr.toLowerCase().trim();
    if (lower === 'player' || lower === 'mc' || lower === 'người chơi' || lower === 'phe ta') return true;
    if (playerName && lower.includes(playerName.toLowerCase())) return true;
    if (altPlayerName && lower.includes(altPlayerName.toLowerCase())) return true;
    return false;
  };

  // --- PHẦN 1: QUÉT TẤT CẢ CÁC TAG VÀ CÂU TRẦN THUẬT THEO THỨ TỰ XUẤT HIỆN ---
  
  // Chúng ta sẽ quét một lượt toàn bộ văn bản để tìm các khớp theo thứ tự
  const allMatches: { index: number; action: CombatParsedAction }[] = [];

  // 1.1. Quét Tag cấu trúc chuẩn [HP_CHANGE: ...] [MP_CHANGE: ...] [STATUS: ...] [COMBAT_ACTION: ...]
  const tagRegex = new RegExp(COMBAT_TAG_REGEX.source, 'gi');
  let tagMatch: RegExpExecArray | null;
  while ((tagMatch = tagRegex.exec(rawText)) !== null) {
    const typeStr = tagMatch[1].toUpperCase();
    const attrStr = tagMatch[2] || '';
    
    // Phân tích cú pháp động của các cặp key="value"
    const attrs: Record<string, string> = {};
    const attrRegex = /(\w+)="([^"]*)"/gi;
    let attrMatch: RegExpExecArray | null;
    while ((attrMatch = attrRegex.exec(attrStr)) !== null) {
      attrs[attrMatch[1].toLowerCase()] = attrMatch[2];
    }

    if (typeStr === 'COMBAT_ACTION') {
      const source = attrs['source'] || 'player';
      const target = attrs['target'] || 'enemy';
      const action = attrs['action'] || 'attack';
      const skill = attrs['skill'] || undefined;
      const hit_type = attrs['hit_type'] || undefined;
      const intensity = attrs['intensity'] || undefined;
      const durationVal = parseInt(attrs['duration'] || '0', 10);

      // Gọi Động cơ cơ học chiến đấu để tính toán chuẩn xác lượng HP/MP thay đổi thực tế
      const engineResult = executeCombatAction(
        { source, target, action, skill, hit_type, intensity, duration: durationVal },
        knowledgeBase || {},
        combatants || []
      );

      const normalizedTarget = (target.toLowerCase() === 'player' || target.toLowerCase() === 'mc' || target.toLowerCase() === 'self')
        ? 'player'
        : target;

      // Đẩy hành động thay đổi HP chuẩn cơ học
      allMatches.push({
        index: tagMatch.index,
        action: {
          type: 'HP_CHANGE',
          target: normalizedTarget,
          targetName: normalizedTarget === 'player' ? playerName : (target.includes('@@') ? target.split('@@')[1] : target),
          amount: engineResult.hpChange,
          source: source,
          skill: skill,
          customLogMessage: engineResult.logMessage
        } as any
      });

      // Nếu có biến động MP (Linh lực tiêu hao), đẩy thêm hành động thay đổi MP
      if (engineResult.mpChange !== 0) {
        const normalizedSource = (source.toLowerCase() === 'player' || source.toLowerCase() === 'mc')
          ? 'player'
          : source;
        allMatches.push({
          index: tagMatch.index,
          action: {
            type: 'MP_CHANGE',
            target: normalizedSource,
            amount: engineResult.mpChange,
            skill: skill
          }
        });
      }
    } else {
      const type = typeStr as 'HP_CHANGE' | 'MP_CHANGE' | 'STATUS';
      let target = (attrs['target'] || 'enemy').toLowerCase();
      
      // Nếu target có dạng faction|name (ví dụ: enemy|Hắc Phong Sát Thủ 1)
      if (target.includes('|')) {
        target = target.split('|')[1].trim();
      }

      let amountVal = parseInt(attrs['amount'] || '0', 10);
      const effectVal = attrs['effect'] || '';
      const durationVal = parseInt(attrs['duration'] || '0', 10);
      const sourceVal = attrs['source'] || undefined;
      const skillVal = attrs['skill'] || undefined;
      let customLogMessage = undefined;

      // Bảo vệ cơ học chủ động: Nếu là HP_CHANGE và có nguồn (source) cụ thể,
      // Hệ thống gạt bỏ con số amount thô do AI tự nhẩm và chuyển giao cho Động cơ tính toán lại chuẩn xác 100%!
      if (type === 'HP_CHANGE' && sourceVal && amountVal !== 0) {
        const actionType = amountVal < 0 ? 'attack' : 'heal';
        const hitType = (skillVal && (skillVal.toLowerCase().includes('lôi đình') || skillVal.toLowerCase().includes('chí mạng'))) ? 'crit' : 'normal';
        
        const engineResult = executeCombatAction(
          {
            source: sourceVal,
            target: target,
            action: actionType,
            skill: skillVal,
            hit_type: hitType
          },
          knowledgeBase || {},
          combatants || []
        );
        amountVal = engineResult.hpChange;
        customLogMessage = engineResult.logMessage;
      }

      allMatches.push({
        index: tagMatch.index,
        action: {
          type,
          target,
          amount: amountVal,
          effect: effectVal,
          duration: durationVal,
          source: sourceVal,
          skill: skillVal,
          customLogMessage
        } as any
      });
    }
  }

  // 1.2. Quét câu tiếng Việt tự nhiên (Fallback scanner)
  // Chỉ thực hiện nếu không có tag chuẩn (hoặc có thể kết hợp cả hai nếu muốn, nhưng ở đây ưu tiên thứ tự)
  
  // HP Mất
  const hpLossRegex = new RegExp(NATURAL_HP_LOSS_REGEX.source, 'gi');
  let hpLossMatch: RegExpExecArray | null;
  while ((hpLossMatch = hpLossRegex.exec(rawText)) !== null) {
    const subject = hpLossMatch[1].trim();
    const valStr = hpLossMatch[2].replace(/,/g, '');
    const val = parseInt(valStr, 10);
    if (!isNaN(val) && val > 0) {
      allMatches.push({
        index: hpLossMatch.index,
        action: {
          type: 'HP_CHANGE',
          target: isPlayerTarget(subject) ? 'player' : subject,
          targetName: subject,
          amount: -val
        }
      });
    }
  }

  // MP Tiêu hao
  const mpLossRegex = new RegExp(NATURAL_MP_LOSS_REGEX.source, 'gi');
  let mpLossMatch: RegExpExecArray | null;
  while ((mpLossMatch = mpLossRegex.exec(rawText)) !== null) {
    const subject = mpLossMatch[1].trim();
    const valStr = mpLossMatch[2].replace(/,/g, '');
    const val = parseInt(valStr, 10);
    if (!isNaN(val) && val > 0) {
      allMatches.push({
        index: mpLossMatch.index,
        action: {
          type: 'MP_CHANGE',
          target: isPlayerTarget(subject) ? 'player' : subject,
          amount: -val
        }
      });
    }
  }

  // HP Hồi phục
  const hpGainRegex = new RegExp(NATURAL_HP_GAIN_REGEX.source, 'gi');
  let hpGainMatch: RegExpExecArray | null;
  while ((hpGainMatch = hpGainRegex.exec(rawText)) !== null) {
    const subject = hpGainMatch[1].trim();
    const valStr = hpGainMatch[2].replace(/,/g, '');
    const val = parseInt(valStr, 10);
    if (!isNaN(val) && val > 0) {
      allMatches.push({
        index: hpGainMatch.index,
        action: {
          type: 'HP_CHANGE',
          target: isPlayerTarget(subject) ? 'player' : subject,
          amount: val
        }
      });
    }
  }

  // --- PHẦN 2: SẮP XẾP VÀ XỬ LÝ THEO THỨ TỰ TUẦN TỰ ---

  // Sắp xếp các hành động theo vị trí xuất hiện trong văn bản
  allMatches.sort((a, b) => a.index - b.index);

  let simulatedPlayerHp = currentHp;
  const actualMaxHp = maxHp || (currentHp ? currentHp * 2 : 100);

  allMatches.forEach(match => {
    const act = match.action;
    combatActions.push(act);

    if (act.type === 'HP_CHANGE') {
      if (isPlayerTarget(act.target)) {
        playerHpChange += act.amount;
        if (simulatedPlayerHp !== undefined) {
          if (act.amount < 0) {
            // Sát thương: Ghim ở 0 để không bị máu âm ngầm
            simulatedPlayerHp = Math.max(0, simulatedPlayerHp + act.amount);
          } else {
            // Hồi phục: Cộng vào từ mức hiện tại (có thể là 0 sau khi nhận sát thương lớn)
            simulatedPlayerHp = Math.min(actualMaxHp, simulatedPlayerHp + act.amount);
          }
        }
      } else {
        const targetKey = act.target;
        enemyHpChanges[targetKey] = (enemyHpChanges[targetKey] || 0) + act.amount;
      }
    } else if (act.type === 'MP_CHANGE') {
      if (isPlayerTarget(act.target)) {
        playerMpChange += act.amount;
      } else {
        const targetKey = act.target;
        enemyMpChanges[targetKey] = (enemyMpChanges[targetKey] || 0) + act.amount;
      }
    }
  });

  // 3. Làm sạch văn bản và tạo khối thông báo tác động chỉ số
  let cleanNarrative = rawText
    .replace(new RegExp(COMBAT_TAG_REGEX.source, 'gi'), '')
    .replace(/\[change_formation:\s*out="[^"]+"\s*,\s*in="[^"]+"\]/gi, '')
    .trim();

  // Tạo danh sách câu thông báo tác động HP/MP/Trạng thái
  const noticeLines: string[] = [];
  const lineSet = new Set<string>();

  combatActions.forEach(act => {
    let targetName = act.targetName || act.target;
    if (targetName.includes('@@')) {
      targetName = targetName.split('@@')[1].trim();
    }
    if (isPlayerTarget(act.target)) {
      targetName = playerName || 'Người Chơi';
    } else if (act.target === 'enemy' && !act.targetName) {
      targetName = 'Đối Thủ';
    }

    let sourceName = act.source;
    if (sourceName) {
      if (sourceName.includes('@@')) {
        sourceName = sourceName.split('@@')[1].trim();
      } else if (sourceName.includes('|')) {
        sourceName = sourceName.split('|')[1].trim();
      }
      if (isPlayerTarget(sourceName)) {
        sourceName = playerName || 'Người Chơi';
      }
    }

    let line = (act as any).customLogMessage || '';
    if (!line) {
      if (act.type === 'HP_CHANGE') {
        if (act.amount < 0) {
          if (sourceName && act.skill) {
            line = `💥 [${sourceName}] dùng "${act.skill}" gây ${Math.abs(act.amount).toLocaleString('vi-VN')} sát thương cho [${targetName}]`;
          } else if (sourceName) {
            line = `💥 [${sourceName}] gây ${Math.abs(act.amount).toLocaleString('vi-VN')} sát thương cho [${targetName}]`;
          } else {
            line = `💥 [${targetName}] mất ${Math.abs(act.amount).toLocaleString('vi-VN')} HP`;
          }
        } else if (act.amount > 0) {
          if (sourceName && act.skill) {
            line = `💚 [${sourceName}] thi triển "${act.skill}" hồi phục +${act.amount.toLocaleString('vi-VN')} HP cho [${targetName}]`;
          } else if (sourceName) {
            line = `💚 [${sourceName}] hồi phục +${act.amount.toLocaleString('vi-VN')} HP cho [${targetName}]`;
          } else {
            line = `💚 [${targetName}] hồi phục +${act.amount.toLocaleString('vi-VN')} HP`;
          }
        }
      } else if (act.type === 'MP_CHANGE') {
        if (act.amount < 0) {
          if (act.skill) {
            line = `💧 [${targetName}] tiêu tốn ${Math.abs(act.amount).toLocaleString('vi-VN')} MP để thi triển "${act.skill}"`;
          } else {
            line = `💧 [${targetName}] tiêu tốn ${Math.abs(act.amount).toLocaleString('vi-VN')} MP`;
          }
        } else if (act.amount > 0) {
          line = `⚡ [${targetName}] hồi phục +${act.amount.toLocaleString('vi-VN')} MP`;
        }
      } else if (act.type === 'STATUS') {
        if (sourceName) {
          line = `✨ [${targetName}] bị [${sourceName}] gán trạng thái "${act.effect}" (${act.duration} lượt)`;
        } else {
          line = `✨ [${targetName}] dính trạng thái "${act.effect}" (${act.duration} lượt)`;
        }
      }
    }

    if (line && !lineSet.has(line)) {
      lineSet.add(line);
      noticeLines.push(line);
    }
  });

  if (factionChanges && factionChanges.length > 0) {
    factionChanges.forEach(fc => {
      const factionText = fc.newFaction === 'ally' ? 'Đồng Minh (Phe Ta)' : fc.newFaction === 'enemy' ? 'Kẻ Địch' : 'Trung Lập';
      const line = `🌀 [${fc.target}] đã chuyển phe sang ${factionText}!`;
      if (!lineSet.has(line)) {
        lineSet.add(line);
        noticeLines.push(line);
      }
    });
  }

  if (formationChanges.length > 0) {
    formationChanges.forEach(fc => {
      const line = `🔄 [${fc.outEntity}] lùi về dự bị, [${fc.inEntity}] xuất trận thay thế!`;
      if (!lineSet.has(line)) {
        lineSet.add(line);
        noticeLines.push(line);
      }
    });
  }

  if (noticeLines.length > 0) {
    const noticeBlock = `\n\n<thong_bao_chi_so>\n${noticeLines.join('\n')}\n</thong_bao_chi_so>`;
    cleanNarrative += noticeBlock;
  }

  return {
    cleanNarrative,
    combatActions,
    playerHpChange,
    playerMpChange,
    enemyHpChanges,
    enemyMpChanges,
    finalPlayerHp: simulatedPlayerHp,
    formationChanges
  };
}
