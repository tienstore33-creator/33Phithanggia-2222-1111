import { KnowledgeBase } from '../types';
import { normalizeStringForComparison, diceCoefficient } from './questUtils';

const SIMILARITY_THRESHOLD = 0.65;

export interface ResolvedNpcResult {
  npc: any;
  list: any[];
  index: number;
  listType: 'npc' | 'wife' | 'slave' | 'prisoner' | 'companion' | 'master';
}

/**
 * Tách chuỗi kết hợp target có dạng "id@@name" hoặc "id|#|name" hoặc giá trị đơn lẻ.
 */
export function parseNpcTargetToken(token?: string): { id?: string; name?: string } {
  if (!token) return {};
  const cleaned = token.trim();

  if (cleaned.includes('@@')) {
    const [rawId, rawName] = cleaned.split('@@').map(s => s.trim());
    return { id: rawId || undefined, name: rawName || undefined };
  }

  if (cleaned.includes('|#|')) {
    const [rawId, rawName] = cleaned.split('|#|').map(s => s.trim());
    return { id: rawId || undefined, name: rawName || undefined };
  }

  return { id: cleaned };
}

/**
 * Bộ phân giải thực thể NPC kiểm tra chéo (Cross-Validation) giữa ID và Tên.
 */
export function resolveNpcEntity(
  kb: KnowledgeBase,
  options: {
    target?: string;
    id?: string;
    name?: string;
    targetId?: string;
    targetName?: string;
    description?: string;
  }
): ResolvedNpcResult | null {
  if (!kb) return null;

  let providedId = options.id || options.targetId;
  let providedName = options.name || options.targetName;

  let finalTarget = options.target || "";
  if (!finalTarget) {
    if (providedId && providedName) {
      finalTarget = `${providedId}@@${providedName}`;
    } else if (providedId) {
      finalTarget = providedId;
    } else if (providedName) {
      finalTarget = providedName;
    }
  }

  // 1. Phân rã từ target token nếu có cú pháp id@@name
  if (finalTarget) {
    const parsed = parseNpcTargetToken(finalTarget);
    if (parsed.id) providedId = parsed.id;
    if (parsed.name) providedName = parsed.name;
  }

  // Nếu providedId chứa @@ thì phân rã tiếp
  if (providedId && providedId.includes('@@')) {
    const parsed = parseNpcTargetToken(providedId);
    providedId = parsed.id;
    if (parsed.name && !providedName) providedName = parsed.name;
  }

  const searchLists: Array<{ list: any[]; type: ResolvedNpcResult['listType'] }> = [
    { list: kb.discoveredNPCs || [], type: 'npc' },
    { list: kb.wives || [], type: 'wife' },
    { list: kb.slaves || [], type: 'slave' },
    { list: kb.prisoners || [], type: 'prisoner' },
    { list: kb.companions || [], type: 'companion' }
  ];

  // Kiểm tra master
  if (kb.master) {
    const isMasterMatch =
      (providedId && kb.master.id === providedId) ||
      (providedName && kb.master.name === providedName) ||
      (providedId && kb.master.name === providedId);
    if (isMasterMatch) {
      return {
        npc: kb.master,
        list: [kb.master],
        index: 0,
        listType: 'master'
      };
    }
  }

  // Bước 1: Ưu tiên khớp chính xác theo Tên (Name)
  if (providedName) {
    const normalizedName = normalizeStringForComparison(providedName);
    for (const { list, type } of searchLists) {
      const exactIndex = list.findIndex(
        n => n && normalizeStringForComparison(n.name) === normalizedName
      );
      if (exactIndex > -1) {
        return { npc: list[exactIndex], list, index: exactIndex, listType: type };
      }
    }
  }

  // Bước 2: Khớp theo ID trực tiếp trong các danh sách
  if (providedId) {
    for (const { list, type } of searchLists) {
      const idx = list.findIndex(n => n && (n.id === providedId || n.name === providedId));
      if (idx > -1) {
        return { npc: list[idx], list, index: idx, listType: type };
      }
    }
  }

  // Bước 3: Fuzzy matching theo Tên nếu có tên
  if (providedName) {
    const normalizedInputName = normalizeStringForComparison(providedName);
    let bestScore = 0;
    let bestMatch: ResolvedNpcResult | null = null;

    for (const { list, type } of searchLists) {
      list.forEach((npc, index) => {
        if (!npc || !npc.name) return;
        const score = diceCoefficient(normalizedInputName, normalizeStringForComparison(npc.name));
        if (score > bestScore) {
          bestScore = score;
          bestMatch = { npc, list, index, listType: type };
        }
      });
    }

    if (bestScore >= SIMILARITY_THRESHOLD && bestMatch) {
      return bestMatch;
    }
  }

  // Bước 4: Fallback giải mã index XML nếu AI trả về token kiểu "npc-13_2_10" hoặc "npc_10"
  if (providedId) {
    const indexMatch = providedId.match(/(?:npc|prisoner|p)[-_]*(?:13[-_]*2[-_]*)?(\d+)/i);
    if (indexMatch && indexMatch[1]) {
      const targetPos = parseInt(indexMatch[1], 10) - 1;
      const allCombinedNpcs = [
        ...(kb.discoveredNPCs || []),
        ...(kb.wives || []),
        ...(kb.slaves || []),
        ...(kb.prisoners || []),
        ...(kb.companions || [])
      ];
      if (targetPos >= 0 && targetPos < allCombinedNpcs.length) {
        const matchedNpc = allCombinedNpcs[targetPos];
        for (const { list, type } of searchLists) {
          const idx = list.findIndex(n => n && n.id === matchedNpc.id);
          if (idx > -1) {
            return { npc: list[idx], list, index: idx, listType: type };
          }
        }
      }
    }
  }

  return null;
}
