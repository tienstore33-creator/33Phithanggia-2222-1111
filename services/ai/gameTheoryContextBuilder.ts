import { KnowledgeBase, NPC, Slave, Prisoner, Wife } from '../../types';
import { calculatePayoffWeights } from '../../utils/gameTheoryAffinity';
import { GAME_THEORY_AFFINITY_PROMPT } from '../../prompts/gameTheoryRules';

type AnyNPC = NPC | Slave | Prisoner | Wife;

/**
 * Trích xuất danh sách các NPC liên quan đến bối cảnh hiện tại:
 * Bao gồm NPC trong bối cảnh, bạn đồng hành, nô lệ, tù nhân, thê thiếp, và các NPC xuất hiện trong lượt dẫn chuyện / hành động gần nhất.
 */
export function extractContextNpcs(
  knowledgeBase: KnowledgeBase,
  lastNarration?: string,
  userInput?: string
): AnyNPC[] {
  const npcPool: AnyNPC[] = [
    ...(knowledgeBase.discoveredNPCs || []),
    ...(knowledgeBase.companions || []),
    ...(knowledgeBase.wives || []),
    ...(knowledgeBase.slaves || []),
    ...(knowledgeBase.prisoners || [])
  ];

  if (npcPool.length === 0) return [];

  // Loại bỏ trùng lặp theo ID hoặc Tên
  const uniqueNpcMap = new Map<string, AnyNPC>();
  for (const npc of npcPool) {
    if (!npc || !npc.name) continue;
    const key = (npc.id || npc.name).trim().toLowerCase();
    if (!uniqueNpcMap.has(key)) {
      uniqueNpcMap.set(key, npc);
    }
  }

  const allUniqueNpcs = Array.from(uniqueNpcMap.values());
  const contextText = `${lastNarration || ''} ${userInput || ''}`.toLowerCase();

  // Ưu tiên các NPC có tên được nhắc tới trong lượt gần nhất hoặc input người dùng
  const mentionedNpcs: AnyNPC[] = [];
  const otherNpcs: AnyNPC[] = [];

  for (const npc of allUniqueNpcs) {
    const npcNameLower = npc.name.toLowerCase();
    if (contextText.includes(npcNameLower)) {
      mentionedNpcs.push(npc);
    } else {
      otherNpcs.push(npc);
    }
  }

  // Kết hợp: ưu tiên NPC được nhắc tên, sau đó lấp đầy danh sách (tối đa 6 NPC)
  const selectedNpcs = [...mentionedNpcs, ...otherNpcs].slice(0, 6);
  return selectedNpcs;
}

/**
 * Xây dựng khối Prompt định lượng Game Theory (Always-On)
 */
export function buildGameTheoryContextPrompt(
  knowledgeBase: KnowledgeBase,
  lastNarration?: string,
  userInput?: string
): string {
  const targetNpcs = extractContextNpcs(knowledgeBase, lastNarration, userInput);
  if (targetNpcs.length === 0) {
    return '';
  }

  let matrixBlock = `<game_theory_comprehensive_matrix_+qui_tac_game_theory>\n`;
  matrixBlock += `================\n`;
  matrixBlock += `[HỆ THỐNG ĐÁNH GIÁ MA TRẬN 5 MÔ HÌNH LÝ THUYẾT TRÒ CHƠI NÂNG CAO (ALWAYS-ON GAME THEORY)]\n`;
  matrixBlock += `Các NPC dưới đây đang tham gia ván cờ chiến lược đa tầng với MC. AI BẮT BUỘC phải đưa phân tích cả 5 mô hình này vào phần mở đầu của khối <thinking> (tại mục "=== PHÂN TÍCH LOGIC THIỆN CẢM & GAME THEORY ==="):\n\n`;

  for (const npc of targetNpcs) {
    const gt = calculatePayoffWeights(knowledgeBase, npc);
    const realmStr = (npc as any).realm || 'Phàm nhân';
    const affinityStr = (npc as any).affinity ?? 0;
    
    matrixBlock += `- Nhân vật "${npc.name}" (Cảnh giới: ${realmStr}, Hảo cảm: ${affinityStr}):\n`;
    matrixBlock += `  1. [Zero-Sum & Nash / Minimax]: Trust = ${gt.trust}/100, Fear = ${gt.fear}/100 | Coop = ${gt.payoffs.coop}, Exploit = ${gt.payoffs.exploit}, Flee = ${gt.payoffs.flee} -> Chiến lược tối ưu: [${gt.bestStrategy.toUpperCase()}]\n`;
    matrixBlock += `  2. [Signaling Game]: Tín hiệu thể hiện MC = "${gt.signaling.apparentPower}" (${gt.signaling.signalType}) | Độ nghi ngờ giả heo ăn hổ = ${gt.signaling.suspicionLevel}%\n`;
    matrixBlock += `  3. [Repeated Game & Tit-For-Tat]: Điểm Ân Oán Tích Lũy = ${gt.repeatedGame.gratitudeOrGrudgeScore} -> Trạng thái: [${gt.repeatedGame.titForTatState.toUpperCase()}]\n`;
    matrixBlock += `  4. [Credible Threat & Cheap Talk]: Độ uy tín lời đe dọa = ${gt.threatAssessment.credibilityScore}% | Đánh giá: ${gt.threatAssessment.isCheapTalk ? '[CHEAP TALK / HÙ DỌA SUÔNG]' : '[THREAT CREDIBLE / ĐE DỌA THẬT]'}\n`;
    matrixBlock += `  5. [Stackelberg & Auction]: Vai trò Stackelberg = [${gt.stackelberg.role.toUpperCase()}] (${gt.stackelberg.dominantMove}) | Định giá tài nguyên = ${gt.auctionStrategy.valuationRatio}x (${gt.auctionStrategy.biddingTactic})\n\n`;
  }

  matrixBlock += GAME_THEORY_AFFINITY_PROMPT + `\n`;
  matrixBlock += `================\n`;
  matrixBlock += `</game_theory_comprehensive_matrix_+qui_tac_game_theory>\n`;

  return matrixBlock;
}
