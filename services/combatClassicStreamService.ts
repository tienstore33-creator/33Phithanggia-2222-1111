import { KnowledgeBase, NPC, YeuThu } from '../types';
import { generateGameResponseStream } from './geminiStreamService';
import { getApiSettings } from './geminiService';
import { COMBAT_TAG_INSTRUCTIONS } from '../src/utils/satthuonglogcombatold';
import { COMBAT_CHOICE_INSTRUCTIONS } from '../src/utils/combatChoiceRules';
import { buildCombatContextXml } from '../src/utils/combatContextFormatter';
import { getActiveCombatants } from '../src/utils/combatEntityFilter';
import { COMBAT_CRISIS_XML_RULES } from '../prompts/combatCrisisRules';
import { parseCombatMessage } from '../src/utils/combatMessageParser';
import { parseXmlCombatTurnResult } from '../utils/xmlDataParser';

import { buildFullCombatPrompt } from '../src/utils/combatPromptBuilder';

export interface CombatMessage {
  id: string;
  text: string;
  type: 'player_action' | 'narration' | 'system';
  timestamp: number;
}

export interface CombatStreamResult {
  narrationText: string;
  combatDataJson?: any;
}

export async function streamClassicCombatTurn(
  kb: KnowledgeBase,
  userAction: string,
  combatMessages: CombatMessage[],
  onChunk: (text: string) => void,
  signal?: AbortSignal,
  recentStoryTurns?: string[],
  callbacks?: {
    onPromptGenerated?: (prompt: string) => void;
    onRawResponseComplete?: (response: string) => void;
  },
  overrideCombatants?: any[]
): Promise<CombatStreamResult> {
  const settings = getApiSettings();
  const player = kb.playerStats;
  const playerName = kb.worldConfig?.playerName || 'Người Chơi';

  // Lấy thông tin đối thủ và đồng minh
  const pendingCombat = kb.pendingCombat;
  const opponentIds = pendingCombat?.opponentIds || [];
  const npcs = kb.discoveredNPCs || [];
  const yeuThus = kb.discoveredYeuThu || [];
  const companions = kb.companions || [];
  const prisoners = kb.prisoners || (kb as any).capturedPrisoners || [];
  const slaves = kb.slaves || [];
  const wives = kb.wives || [];
  const people = (kb as any).people || [];

  let activeOpponents: any[] = [];
  let activeCompanions: any[] = [];

  if (overrideCombatants && overrideCombatants.length > 0) {
    const filtered = getActiveCombatants(overrideCombatants);
    activeCompanions = filtered.activeCompanions;
    activeOpponents = filtered.activeOpponents;
  } else {
    // Tạo mảng combatants fallback từ KB
    const fallbackAllies = (Array.from(new Set([
      ...(kb.pendingCombat?.allyIds || []),
      ...(kb.combatCompanionIds || [])
    ]))).map(id => 
      companions.find(c => c.id === id) ||
      npcs.find(n => n.id === id) ||
      prisoners.find(p => p.id === id) ||
      slaves.find(s => s.id === id) ||
      wives.find(w => w.id === id) ||
      people.find((p: any) => p.id === id)
    ).filter(Boolean).map(c => ({ ...c, faction: 'ally' }));

    const fallbackEnemies = opponentIds
      .map(id => npcs.find(n => n.id === id) || yeuThus.find(yt => yt.id === id))
      .filter(Boolean)
      .map(c => ({ ...c, faction: 'enemy' }));

    const fallbackCombatants = [...fallbackAllies, ...fallbackEnemies];
    const filtered = getActiveCombatants(fallbackCombatants);
    activeCompanions = filtered.activeCompanions;
    activeOpponents = filtered.activeOpponents;
  }

  // Kiểm tra sự kiện lật mặt (Betrayal Event) ngầm định cơ học
  let betrayalInstruction = '';
  const hasBetrayalEvent = Math.random() < 0.3; // 30% tỷ lệ mỗi lượt xảy ra sự kiện lật mặt
  if (hasBetrayalEvent && activeCompanions.length > 0) {
    const eligibleDefectors = activeCompanions.filter(c => {
      const isSlave = c.entityType === 'slave' || slaves.some(s => s.id === c.id);
      const isPrisoner = c.entityType === 'prisoner' || prisoners.some(p => p.id === c.id);
      const satisfaction = c.satisfaction !== undefined ? c.satisfaction : (c as any).thoaMan;
      // Độ thỏa mãn là 0% hoặc <= 0
      return (isSlave || isPrisoner) && (satisfaction !== undefined && satisfaction <= 0);
    });

    if (eligibleDefectors.length > 0) {
      // 50% cơ hội mỗi NPC đủ điều kiện sẽ đổi phe
      const defectors = eligibleDefectors.filter(() => Math.random() < 0.5);
      if (defectors.length > 0) {
        const defectorNames = defectors.map(d => d.name).join(', ');
        betrayalInstruction = `
[HỆ THỐNG ÉP BUỘC - SỰ KIỆN LẬT MẶT (BETRAYAL EVENT)]
Trong lượt đấu này, một sự kiện "LẬT MẶT" bất ngờ bùng nổ!
Các NPC đồng minh sau đây đã hoàn toàn bất mãn, phản bội và chính thức chuyển sang phe địch: ${defectorNames}.

HƯỚNG DẪN AI MIÊU TẢ CHI TIẾT (<noi_dung>):
1. Kẻ địch chính hoặc một tên địch bất kỳ trong phe đối thủ đột ngột lớn tiếng cười lớn, sỉ nhục, chửi bới MC (${playerName}) là "tên bóc lột bẩn thỉu", đồng thời rủ rê, kích động đám nô lệ và tù binh (${defectorNames}) cùng nổi loạn, lật đổ và giết chết tên bóc lột này để tự giải thoát.
2. Các NPC phản bội (${defectorNames}) đáp trả đầy căm hận, oán thán thét lớn, vác vũ khí chuyển sang tư thế công kích MC. Hãy viết những câu thoại oán hận, dứt khoát của họ khi quyết định phản bội.
3. Bạn BẮT BUỘC phải chèn các thẻ chuyển phe sau đây vào văn bản để hệ thống cập nhật giao diện:
${defectors.map(d => `[FACTION_CHANGE: target="${d.id}", faction="enemy"]`).join('\n')}
(Nếu chuyển phe bằng tên, hãy chèn thêm: ${defectors.map(d => `[FACTION_CHANGE: target="${d.name}", faction="enemy"]`).join('\n')})
4. Hãy lồng ghép toàn bộ diễn biến lật mặt này vào dòng văn kể chuyện trong thẻ <noi_dung> một cách kịch tính nhất!
`;
      }
    }
  }

  // Xây dựng log hội thoại gần nhất (đã lọc sạch chỉ giữ lại nội dung lời kể thực tế)
  const recentLogs = combatMessages.slice(-8).map(m => {
    if (m.type === 'player_action') return `[HÀNH ĐỘNG/THOẠI CỦA MC ${playerName}]: ${m.text}`;
    if (m.type === 'narration') {
      const parsed = parseCombatMessage(m.text);
      const cleanContent = parsed.content || m.text;
      return `[DIỄN BIẾN/LỜI THOẠI TRẬN ĐÁNH]: ${cleanContent}`;
    }
    if (m.type === 'system') return `[HỆ THỐNG]: ${m.text}`;
    return `${m.text}`;
  }).join('\n');

  // Đóng gói bối cảnh XML chi tiết (Kỹ năng, Vật phẩm, Giới tính, Tiểu sử, Tài sản, Chỉ số...)
  const combatContextXml = buildCombatContextXml(kb, activeOpponents, activeCompanions);

  let storyContext = '';
  if (recentStoryTurns && recentStoryTurns.length > 0) {
    const recentStoryLogs = recentStoryTurns.slice(-4).map((turn, index) => {
      return `Lượt ${index + 1}: ${turn}`;
    }).join('\n');

    storyContext = `
<lich_su_ke_chuyen_4_luot_gan_nhat>
[NỘI DUNG 4 LƯỢT KỂ CHUYỆN GẦN NHẤT TRONG GIAO DIỆN KỂ CHUYỆN]:
${recentStoryLogs}
</lich_su_ke_chuyen_4_luot_gan_nhat>
`;
  }

  const prompt = buildFullCombatPrompt({
    playerName,
    userAction,
    combatContextXml,
    storyContext,
    betrayalInstruction,
    recentLogs
  });

  if (callbacks?.onPromptGenerated) {
    callbacks.onPromptGenerated(prompt);
  }

  let fullStreamedText = '';

  const modelToUse = settings.combatModel || settings.model || 'gemini-2.5-flash';

  fullStreamedText = await generateGameResponseStream(
    prompt,
    modelToUse,
    (chunkText) => {
      onChunk(chunkText);
    },
    signal,
    undefined,
    undefined,
    false,
    'combat'
  );

  if (callbacks?.onRawResponseComplete) {
    callbacks.onRawResponseComplete(fullStreamedText);
  }

  // Tách văn bản và dữ liệu nếu có
  let narrationText = fullStreamedText;
  let combatDataJson: any = undefined;

  // Thử parse theo XML mới trước
  if (fullStreamedText.includes('<ket_qua_giao_tranh>')) {
    try {
      combatDataJson = parseXmlCombatTurnResult(fullStreamedText);
      narrationText = fullStreamedText;
    } catch (e) {
      console.warn('Lỗi parse XML combat stream data:', e);
    }
  } else {
    // Fallback sang JSON cũ nếu không tìm thấy thẻ XML
    const jsonMatch = fullStreamedText.match(/\[COMBAT_DATA_JSON\]([\s\S]*?)\[\/COMBAT_DATA_JSON\]/);
    if (jsonMatch && jsonMatch[1]) {
      try {
        combatDataJson = JSON.parse(jsonMatch[1].trim());
        narrationText = fullStreamedText;
      } catch (e) {
        console.warn('Lỗi parse JSON combat stream data:', e);
      }
    }
  }

  return {
    narrationText,
    combatDataJson
  };
}
