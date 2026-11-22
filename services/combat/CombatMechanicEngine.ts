/**
 * CombatMechanicEngine.ts
 * 
 * Động cơ tính toán cơ học chiến đấu thuần túy (Deterministic Math Engine).
 * Chịu trách nhiệm trích xuất chỉ số thực từ nhân vật/quái vật, áp dụng công thức 
 * toán học để tính sát thương, hồi máu và tiêu hao tài nguyên một cách chính xác.
 */

import { PlayerStats, NPC, YeuThu, KnowledgeBase } from '../../types';

export interface CombatActionIntent {
  source: string;       // ID hoặc Tên kẻ ra chiêu (vd: "player", "npc_01@@Huyết Ma")
  target: string;       // ID hoặc Tên kẻ chịu đòn (vd: "player", "enemy", "npc_02")
  action: 'attack' | 'heal' | 'buff' | string;
  skill?: string;
  hit_type?: 'crit' | 'normal' | 'glance' | string;
  intensity?: 'low' | 'medium' | 'high' | string;
  duration?: number;
}

export interface EngineExecutionResult {
  hpChange: number;     // Lượng HP thay đổi (Âm: mất máu, Dương: hồi máu)
  mpChange: number;     // Lượng MP thay đổi (Âm: tiêu hao linh lực)
  isCritical: boolean;
  isGlance: boolean;
  actualAmount: number; // Giá trị tuyệt đối của HP biến động
  logMessage: string;   // Dòng log tiếng Việt chuẩn cơ học
}

// Danh sách các đại cảnh giới để tính chênh lệch sức mạnh (Realm Tier Difference)
const REALM_ORDER = [
  "phàm nhân", 
  "luyện khí", 
  "trúc cơ", 
  "kim đan", 
  "nguyên anh", 
  "hóa thần", 
  "luyện hư", 
  "hợp thể", 
  "đại thừa", 
  "độ kiếp", 
  "chân tiên", 
  "kim tiên", 
  "thái ất"
];

/**
 * Ước lượng chỉ số cấp độ cảnh giới từ chuỗi mô tả cảnh giới
 */
function getRealmIndex(realmStr?: string): number {
  if (!realmStr) return 0;
  const lower = realmStr.toLowerCase();
  for (let i = REALM_ORDER.length - 1; i >= 0; i--) {
    if (lower.includes(REALM_ORDER[i])) {
      return i;
    }
  }
  return 0;
}

/**
 * Trích xuất các chỉ số thực tế của một thực thể trong combat
 */
export function getEntityCombatStats(
  entityIdOrName: string,
  knowledgeBase: KnowledgeBase,
  combatantsList: any[] = []
): {
  name: string;
  atk: number;
  def: number;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  realm: string;
  isPlayer: boolean;
} {
  const lowerName = entityIdOrName.toLowerCase().trim();
  const isPlayer = lowerName === 'player' || lowerName === 'mc' || lowerName === 'người chơi' || 
                   (knowledgeBase.playerStats?.name && lowerName.includes(knowledgeBase.playerStats.name.toLowerCase()));

  if (isPlayer && knowledgeBase.playerStats) {
    const p = knowledgeBase.playerStats;
    return {
      name: p.name || 'Người Chơi',
      atk: p.sucTanCong || 100,
      def: p.phongNgu || 50,
      hp: p.sinhLuc || 100,
      maxHp: p.maxSinhLuc || 100,
      mp: p.linhLuc || 50,
      maxMp: p.maxLinhLuc || 50,
      realm: p.realm || 'Phàm Nhân',
      isPlayer: true
    };
  }

  // Tìm trong danh sách combatants đang hoạt động trước
  const combatant = combatantsList.find(c => {
    const cId = (c.id || '').toLowerCase();
    const cName = (c.name || '').toLowerCase();
    return cId === lowerName || cName === lowerName || cName.includes(lowerName) || lowerName.includes(cName);
  });

  if (combatant) {
    const stats = combatant.stats || {};
    return {
      name: combatant.name || 'Đối Thủ',
      atk: stats.sucTanCong ?? combatant.atk ?? 100,
      def: stats.phongNgu ?? combatant.phongNgu ?? 30,
      hp: stats.sinhLuc ?? combatant.hp ?? 100,
      maxHp: stats.maxSinhLuc ?? stats.sinhLucToiDa ?? combatant.maxHp ?? 100,
      mp: stats.linhLuc ?? combatant.mp ?? 50,
      maxMp: stats.maxLinhLuc ?? stats.maxLinhLuc ?? combatant.maxMp ?? 50,
      realm: combatant.realm || 'Không rõ',
      isPlayer: false
    };
  }

  // Tìm trong discoveredNPCs hoặc các nguồn khác của KnowledgeBase làm dự phòng
  const allNpcs = [
    ...(knowledgeBase.discoveredNPCs || []),
    ...(knowledgeBase.discoveredYeuThu || []),
    ...(knowledgeBase.wives || []),
    ...(knowledgeBase.slaves || []),
    ...(knowledgeBase.prisoners || [])
  ];

  const backupNpc = allNpcs.find(n => {
    const nId = (n.id || '').toLowerCase();
    const nName = (n.name || '').toLowerCase();
    return nId === lowerName || nName === lowerName || nName.includes(lowerName) || lowerName.includes(nName);
  });

  if (backupNpc) {
    const stats = backupNpc.stats || {};
    return {
      name: backupNpc.name || 'NPC',
      atk: stats.sucTanCong ?? (backupNpc as any).atk ?? 80,
      def: stats.phongNgu ?? (backupNpc as any).phongNgu ?? 20,
      hp: stats.sinhLuc ?? (backupNpc as any).hp ?? 100,
      maxHp: stats.maxSinhLuc ?? (backupNpc as any).maxHp ?? 100,
      mp: stats.linhLuc ?? (backupNpc as any).mp ?? 40,
      maxMp: stats.maxLinhLuc ?? (backupNpc as any).maxHp ?? 40,
      realm: backupNpc.realm || 'Không rõ',
      isPlayer: false
    };
  }

  // Hoàn toàn dự phòng nếu không tìm thấy bất kỳ ai
  return {
    name: entityIdOrName.includes('@@') ? entityIdOrName.split('@@')[1] : entityIdOrName,
    atk: 100,
    def: 30,
    hp: 100,
    maxHp: 100,
    mp: 50,
    maxMp: 50,
    realm: 'Không rõ',
    isPlayer: false
  };
}

/**
 * Hàm trung tâm tính toán chính xác lượng thay đổi chỉ số từ Tag Ý đồ
 */
export function executeCombatAction(
  intent: CombatActionIntent,
  knowledgeBase: KnowledgeBase,
  combatantsList: any[] = []
): EngineExecutionResult {
  const sourceStats = getEntityCombatStats(intent.source, knowledgeBase, combatantsList);
  const targetStats = getEntityCombatStats(intent.target, knowledgeBase, combatantsList);

  const isCritical = intent.hit_type === 'crit';
  const isGlance = intent.hit_type === 'glance';

  let hpChange = 0;
  let mpChange = 0;
  let logMessage = '';

  // 1. Phân cấp cảnh giới (Realm Tier Difference Bonus/Mitigation)
  const sourceRealmIdx = getRealmIndex(sourceStats.realm);
  const targetRealmIdx = getRealmIndex(targetStats.realm);
  const realmDiff = sourceRealmIdx - targetRealmIdx;
  
  // Mỗi cảnh giới chênh lệch tăng/giảm 20% sát thương, tối đa 300%, tối thiểu 10%
  const realmMult = Math.max(0.1, Math.min(3.0, 1.0 + realmDiff * 0.20));

  // 2. Hệ số chiêu thức (Skill multiplier - tính theo tỷ lệ cộng thêm vào đòn đánh cơ bản 100% ATK)
  let skillBonus = 0;
  let mpCost = 0;
  const skillName = (intent.skill || '').toLowerCase();

  if (skillName) {
    if (skillName.includes('cửu thiên lôi đình') || skillName.includes('lôi đình') || skillName.includes('lôi long giáng thế')) {
      skillBonus = 0.35; // +35% ATK (Tổng: 135% ATK)
      mpCost = 1500;
    } else if (skillName.includes('lôi đao') || skillName.includes('đao pháp') || skillName.includes('kiếm khí') || skillName.includes('kích')) {
      skillBonus = 0.22; // +22% ATK (Tổng: 122% ATK)
      mpCost = 500;
    } else if (skillName.includes('hoả cầu') || skillName.includes('hỏa cầu') || skillName.includes('châm')) {
      skillBonus = 0.14; // +14% ATK (Tổng: 114% ATK)
      mpCost = 200;
    } else if (skillName.includes('hồi xuân') || skillName.includes('trị liệu')) {
      skillBonus = 0.20; // +20% ATK (Tổng: 120% ATK)
      mpCost = 300;
    } else {
      skillBonus = 0.16; // +16% ATK (Tổng: 116% ATK)
      mpCost = 150;
    }
  }

  const skillScale = 1.0 + skillBonus;

  // Tiêu hao MP của người tấn công (nếu là người chơi ra chiêu, trả về MP âm)
  if (sourceStats.isPlayer) {
    mpChange = -mpCost;
  }

  // 3. Thực thi hành động cụ thể
  if (intent.action === 'attack') {
    // Sát thương chí mạng, sượt qua hoặc bình thường
    let hitMult = 1.0;
    if (isCritical) hitMult = 1.6;
    if (isGlance) hitMult = 0.5;

    // Công thức tính sát thương: ATK * Hệ số chiêu * Hệ số bạo kích * Hệ số cảnh giới - DEF kẻ phòng thủ
    const rawDamage = sourceStats.atk * skillScale * hitMult * realmMult;
    const damage = Math.max(1, Math.round(rawDamage - targetStats.def));

    hpChange = -damage;

    // Khởi tạo dòng log chiến đấu cơ học chuẩn xác
    const skillText = intent.skill ? ` bằng "${intent.skill}"` : '';
    const modifierText = isCritical ? ' (Chí mạng!)' : isGlance ? ' (Sượt qua)' : '';
    logMessage = `💥 [${sourceStats.name}] tấn công [${targetStats.name}]${skillText}, gây ${damage.toLocaleString('vi-VN')} sát thương${modifierText}`;

  } else if (intent.action === 'heal') {
    // Hồi phục sinh lực
    let intensityMult = 1.0;
    if (intent.intensity === 'high') intensityMult = 2.5;
    if (intent.intensity === 'medium') intensityMult = 1.5;
    if (intent.intensity === 'low') intensityMult = 0.8;

    const rawHeal = sourceStats.atk * skillScale * intensityMult;
    const healAmount = Math.max(1, Math.round(rawHeal));

    hpChange = healAmount;

    const skillText = intent.skill ? ` bằng "${intent.skill}"` : '';
    logMessage = `💚 [${sourceStats.name}] thi triển trị liệu${skillText}, hồi phục +${healAmount.toLocaleString('vi-VN')} HP cho [${targetStats.name}]`;

  } else {
    // Buff hoặc hiệu ứng khác
    const skillText = intent.skill ? ` "${intent.skill}"` : 'pháp thuật';
    logMessage = `✨ [${sourceStats.name}] kích hoạt hiệu ứng${skillText} lên [${targetStats.name}]`;
  }

  return {
    hpChange,
    mpChange,
    isCritical,
    isGlance,
    actualAmount: Math.abs(hpChange),
    logMessage
  };
}
