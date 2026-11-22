/**
 * combatEntityFilter.ts
 * Bộ lọc cơ học chuyên trách chuẩn hóa và trích xuất danh sách thực thể thực sự đang tham chiến (Active)
 * Loại bỏ hoàn toàn các thực thể đã gục ngã (HP = 0) hoặc đang ở trạng thái dự bị (Benched).
 */

export interface FilteredCombatants {
  activeCompanions: any[];
  activeOpponents: any[];
}

export function getActiveCombatants(combatants: any[]): FilteredCombatants {
  if (!combatants || combatants.length === 0) {
    return { activeCompanions: [], activeOpponents: [] };
  }

  // 1. Đồng minh hoạt động: Phải thuộc phe 'ally', sinh lực > 0, và không ở trạng thái dự bị
  const activeCompanionsRaw = combatants.filter((c: any) => {
    const isAlly = c.faction === 'ally';
    const hp = c.stats?.sinhLuc ?? c.hp ?? 0;
    const isAlive = hp > 0;
    const isBenched = c.isBenched === true;
    return isAlly && isAlive && !isBenched;
  });
  const activeCompanions = activeCompanionsRaw.slice(0, 3);

  // 2. Kẻ địch/Đối thủ hoạt động: Phải thuộc phe 'enemy' hoặc 'neutral', sinh lực > 0, và không ở trạng thái dự bị
  const activeOpponentsRaw = combatants.filter((c: any) => {
    const isOpponent = c.faction === 'enemy' || c.faction === 'neutral';
    const hp = c.stats?.sinhLuc ?? c.hp ?? 0;
    const isAlive = hp > 0;
    const isBenched = c.isBenched === true;
    return isOpponent && isAlive && !isBenched;
  });
  const activeOpponents = activeOpponentsRaw.slice(0, 3);

  return { activeCompanions, activeOpponents };
}
