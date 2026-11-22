import { KnowledgeBase, StatusEffect, PlayerStats } from '../../types';

/**
 * List of insults for the "Verbal Coward" status.
 */
const COWARD_INSULTS = [
  "Ngươi đúng là một kẻ hèn nhát! Ngay cả một trận chiến cũng không dám đối mặt sao?",
  "Nhìn kìa, 'anh hùng' của chúng ta đang bỏ chạy với cái đuôi kẹp giữa hai chân.",
  "Thật đáng xấu hổ! Tu hành bao nhiêu năm mà lại nhát gan đến thế.",
  "Kẻ hèn nhát như ngươi không xứng đáng được tôn trọng, dù ngươi có mạnh đến đâu.",
  "Ngươi nghĩ bỏ chạy là xong sao? Danh tiếng của ngươi đã bị hủy hoại hoàn toàn rồi!",
  "Đứng lại đó và chịu đựng sự sỉ nhục này đi, đồ nhát chết!",
  "Ta chưa từng thấy ai vô liêm sỉ như ngươi, chạy trốn trước cả khi bắt đầu.",
  "Ngươi chỉ là một tên nhát gan núp sau bóng lưng kẻ khác mà thôi."
];

export const getRandomInsult = (): string => {
  return COWARD_INSULTS[Math.floor(Math.random() * COWARD_INSULTS.length)];
};

/**
 * Applies the penalty for skipping a battle.
 * Deducts half of current experience and currency, and adds/refreshes the "Verbal Coward" status.
 */
export const applySkipPenalty = (kb: KnowledgeBase): KnowledgeBase => {
  // 1. Deduct Half XP and Currency
  const newXP = Math.floor(kb.playerStats.kinhNghiem / 2);
  const newCurrency = Math.floor(kb.playerStats.currency / 2);

  // 2. Handle "Verbal Coward" Status
  const existingStatusIndex = kb.playerStats.activeStatusEffects.findIndex(s => s.id === 'verbal_coward');
  let newStatusEffects = [...kb.playerStats.activeStatusEffects];

  if (existingStatusIndex > -1) {
    // Refresh duration to 10, do not accumulate
    newStatusEffects[existingStatusIndex] = { 
      ...newStatusEffects[existingStatusIndex], 
      durationTurns: 10 
    };
  } else {
    // Add new status
    newStatusEffects.push({
      id: 'verbal_coward',
      name: 'Kẻ Hèn Nhát (Verbal Coward)',
      description: 'Bạn đã bỏ chạy khỏi trận chiến. NPC sẽ sỉ nhục bạn bất kể độ thiện cảm.',
      type: 'debuff',
      durationTurns: 10,
      statModifiers: {},
      specialEffects: ['NPC_INSULT_OVERRIDE']
    });
  }

  return {
    ...kb,
    playerStats: {
      ...kb.playerStats,
      kinhNghiem: newXP,
      currency: newCurrency,
      activeStatusEffects: newStatusEffects
    }
  };
};

/**
 * ============================================================================
 * CƠ CHẾ HỒI MÃ THƯƠNG (BACKFIRE / PHẢN PHỆ) KHI CƯỠNG ÉP HOẶC KIỆT SỨC
 * ============================================================================
 */

/**
 * Tính toán sát thương của cơ chế Hồi Mã Thương dựa trên trạng thái của player.
 * Công thức: sát thương phản phệ dựa trên tỷ lệ % nhất định của sinh lực tối đa (maxSinhLuc),
 * lũy tiến tăng mạnh theo số lần quan hệ liên tiếp mà bất chấp linh lực hiện tại dồi dào ra sao.
 */
export const calculateBackfireDamage = (kb: KnowledgeBase): { damage: number; percentage: number; reason: string } => {
  const stats = kb.playerStats;
  const maxHp = stats.maxSinhLuc || 100;
  const sexCount = stats.consecutiveSexCount || 0;

  // Sát thương phản phệ = 20% Sinh lực tối đa * số lần vượt ngưỡng (sexCount - 1)
  const excessCount = Math.max(1, sexCount - 1);
  let percentage = 0.20 * excessCount;

  let reason = `Phản phệ do dâm sự quá độ liên tục (${sexCount} lần liên tiếp), nguyên khí sút kém (mất ${Math.round(percentage * 100)}% Sinh lực tối đa).`;

  // Chồng chất thêm sát thương nếu đang chịu sẵn debuff nguy hại
  const hasExhaustionDebuff = stats.activeStatusEffects.some(ef => 
    ef.id.includes('exhausted') || ef.id.includes('suy_kiet') || ef.id.includes('kiet_suc')
  );
  if (hasExhaustionDebuff) {
    percentage += 0.15;
    reason += " (Chồng chất thêm trọng thương từ trạng thái kiệt lực sẵn có)";
  }

  const finalPercentage = Math.min(0.95, percentage);
  const damage = Math.floor(maxHp * finalPercentage);

  return {
    damage,
    percentage: finalPercentage,
    reason
  };
};

/**
 * Kiểm tra xem người chơi có đủ điều kiện để kích hoạt phản phệ hay không.
 * Đã sửa đổi: kích hoạt bất kể linh lực dồi dào hay cạn kiệt, chỉ cần phạm quy dâm dục liên tiếp.
 * Kích hoạt khi:
 * - consecutiveSexCount >= 2 (Liên tiếp quan hệ cực hạn từ 2 lần trở lên mà không hồi phục).
 * - Hoặc đang mang debuff suy kiệt mà tiếp tục hành sự dâm dục (sexCount >= 1).
 */
export const shouldTriggerBackfire = (kb: KnowledgeBase): boolean => {
  // Loại bỏ hoàn toàn cơ chế phản phệ dâm dục (Hồi Mã Thương)
  return false;
};

/**
 * Hàm cơ học hệ thống xử lý trừ Sinh lực khi dính Hồi Mã Thương (Backfire).
 * Hoàn toàn do hệ thống cơ học trừ một cách tự động, không cần gọi API.
 */
export const applyBackfirePenalty = (kb: KnowledgeBase): { kb: KnowledgeBase; triggered: boolean; damage: number; finalHp: number; reason: string } => {
  if (!shouldTriggerBackfire(kb)) {
    return { kb, triggered: false, damage: 0, finalHp: kb.playerStats.sinhLuc, reason: "" };
  }

  const { damage, percentage, reason } = calculateBackfireDamage(kb);
  const currentHp = kb.playerStats.sinhLuc;
  
  // Tính toán sinh lực mới
  let newHp = Math.max(0, currentHp - damage);

  // Điểm nguy hiểm: Nếu sinh lực hiện tại thấp hơn lượng sát thương phản phệ tính toán, kết quả đưa HP thẳng về 0 để kích hoạt Defeat (Bị đánh bại)
  if (currentHp <= damage) {
    newHp = 0;
  }

  // Tạo và chồng thêm Debuff Phản Phệ
  const backfireStatusId = 'backfire_penalty';
  let newStatusEffects = [...kb.playerStats.activeStatusEffects];
  const existingIndex = newStatusEffects.findIndex(s => s.id === backfireStatusId);

  const backfireDebuff: StatusEffect = {
    id: backfireStatusId,
    name: 'Phản Phệ Cực Hạn (Backfire Penalty)',
    description: `Cơ thể bị tổn hai do bạo phát phản phệ (${Math.round(percentage * 100)}% Max HP). Sức tấn công giảm mạnh.`,
    type: 'debuff',
    durationTurns: 5,
    statModifiers: {}, // Sẽ được hệ thống tính toán giảm sức tấn công trực tiếp nếu cần
    specialEffects: ['BACKFIRE_DEBUFF_ACTIVE']
  };

  if (existingIndex > -1) {
    newStatusEffects[existingIndex] = { ...backfireDebuff, durationTurns: 5 };
  } else {
    newStatusEffects.push(backfireDebuff);
  }

  // Làm sạch số lần consecutiveSexCount về 0 khi đã dính phản phệ lớn để tránh vòng lặp chết liên tục vô lý
  const updatedPlayerStats: PlayerStats = {
    ...kb.playerStats,
    sinhLuc: newHp,
    consecutiveSexCount: 0, 
    activeStatusEffects: newStatusEffects
  };

  const updatedKb: KnowledgeBase = {
    ...kb,
    playerStats: updatedPlayerStats
  };

  return {
    kb: updatedKb,
    triggered: true,
    damage,
    finalHp: newHp,
    reason
  };
};

