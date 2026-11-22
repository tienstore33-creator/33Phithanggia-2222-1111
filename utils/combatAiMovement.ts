export interface CombatEntityPosition {
  x: number;
  y: number;
  attackType?: 'melee' | 'ranged';
  attackRange?: number;
  circleDir?: number;
}

export interface MovementVector {
  dx: number;
  dy: number;
}

/**
 * Tính toán vector di chuyển tối ưu cho AI theo từng chế độ chiến đấu (Chế độ Tấn Công / Đuổi địch)
 */
export function calculateNpcAiMovement(
  entity: CombatEntityPosition,
  nearestEnemy: { x: number; y: number },
  targetDist: number
): MovementVector {
  const isMelee = entity.attackType === 'melee';
  const effectiveRange = isMelee ? 200 : (entity.attackRange || 450);

  if (isMelee) {
    // -----------------------------------------------------------------
    // 1. AI CẬN CHIẾN: Tìm mọi cách áp sát mục tiêu bằng mọi giá
    // -----------------------------------------------------------------
    const stopDist = 90; // Khoảng cách va chạm cận chiến tối ưu

    if (targetDist > stopDist) {
      // Tiến thẳng tối đa tốc độ về phía kẻ địch
      return {
        dx: (nearestEnemy.x - entity.x) / targetDist,
        dy: (nearestEnemy.y - entity.y) / targetDist
      };
    } else {
      // Đã áp sát: Tiếp tục dấn tới/bám sát để ép góc và tung đòn liên tục
      return {
        dx: ((nearestEnemy.x - entity.x) / targetDist) * 0.8,
        dy: ((nearestEnemy.y - entity.y) / targetDist) * 0.8
      };
    }
  } else {
    // -----------------------------------------------------------------
    // 2. AI TẦM XA: Tìm mọi cách giữ khoảng cách an toàn (Kiting AI)
    // -----------------------------------------------------------------
    const minSafeDist = Math.max(180, effectiveRange * 0.45); // Ngưỡng bị áp sát nguy hiểm
    const idealDist = effectiveRange * 0.75;                  // Khoảng cách xả đòn lý tưởng (~330-550px)

    if (targetDist < minSafeDist) {
      // KẺ ĐỊCH ÁP SÁT -> LÙI LẠI NGƯỢC HƯỚNG KẺ ĐỊCH (KITE BACK)
      return {
        dx: (entity.x - nearestEnemy.x) / targetDist,
        dy: (entity.y - nearestEnemy.y) / targetDist
      };
    } else if (targetDist > idealDist) {
      // Quá xa ngoài tầm bắn lý tưởng -> Tiến lại gần cho tới cự ly chuẩn
      return {
        dx: (nearestEnemy.x - entity.x) / targetDist,
        dy: (nearestEnemy.y - entity.y) / targetDist
      };
    } else {
      // Đã ở cự ly vàng (trong tầm đánh & không bị áp sát):
      // Giữ vị trí, vừa di chuyển đảo hướng vòng tròn (Strafe) vừa xả đòn
      const dir = entity.circleDir || 1;
      return {
        dx: ((entity.y - nearestEnemy.y) / targetDist) * 0.35 * dir,
        dy: ((nearestEnemy.x - entity.x) / targetDist) * 0.35 * dir
      };
    }
  }
}

/**
 * Tính toán di chuyển và chọn mục tiêu cho NPC đồng minh trong chế độ PHÒNG THỦ (Defense Mode):
 * - Tụ tập quanh người chơi thay vì lao vào kẻ địch xa.
 * - NPC Cận chiến: Sẽ di chuyển và tấn công kẻ địch nào xuất hiện ở khoảng cách <= 600 tính từ người chơi.
 *   Nếu không có kẻ địch nào trong khoảng cách 600 từ người chơi thì quay lại tụ tập bảo vệ người chơi.
 * - NPC Tầm xa: Tụ tập bảo vệ quanh người chơi, tấn công kẻ địch trong tầm đánh hoặc xuất hiện trong phạm vi 600.
 */
export function calculateAllyDefenseMovement<T extends { x: number; y: number; hp: number; isDead?: boolean }>(
  entity: CombatEntityPosition,
  player: { x: number; y: number },
  enemies: T[]
): {
  moveVec: MovementVector;
  targetEnemy: T | null;
} {
  const isMelee = entity.attackType === 'melee';
  const effectiveRange = isMelee ? 200 : (entity.attackRange || 450);
  const livingEnemies = enemies.filter(e => !e.isDead);

  // Lọc tất cả kẻ địch sống xuất hiện ở khoảng cách <= 600 tính từ người chơi
  const enemiesNearPlayer = livingEnemies.filter(
    e => Math.hypot(e.x - player.x, e.y - player.y) <= 600
  );

  const distToPlayer = Math.hypot(player.x - entity.x, player.y - entity.y);

  if (isMelee) {
    if (enemiesNearPlayer.length > 0) {
      // Có kẻ địch trong bán kính 600 từ người chơi: NPC cận chiến tiến tới áp sát và tấn công
      const targetEnemy = [...enemiesNearPlayer].sort(
        (a, b) => Math.hypot(a.x - entity.x, a.y - entity.y) - Math.hypot(b.x - entity.x, b.y - entity.y)
      )[0];
      const targetDist = Math.hypot(targetEnemy.x - entity.x, targetEnemy.y - entity.y) || 1;
      const moveVec = calculateNpcAiMovement(entity, targetEnemy, targetDist);
      return { moveVec, targetEnemy };
    } else {
      // Không có kẻ địch trong bán kính 600 từ người chơi: Tụ tập bảo vệ quanh người chơi
      if (distToPlayer > 130) {
        // Di chuyển lại gần người chơi
        return {
          moveVec: {
            dx: (player.x - entity.x) / (distToPlayer || 1),
            dy: (player.y - entity.y) / (distToPlayer || 1)
          },
          targetEnemy: null
        };
      } else {
        // Đang ở cự ly hộ vệ quanh người chơi: di chuyển xoay nhẹ giữ cự ly
        const dir = entity.circleDir || 1;
        return {
          moveVec: {
            dx: ((entity.y - player.y) / (distToPlayer || 1)) * 0.3 * dir,
            dy: ((player.x - entity.x) / (distToPlayer || 1)) * 0.3 * dir
          },
          targetEnemy: null
        };
      }
    }
  } else {
    // NPC Tầm xa:
    // Kiểm tra kẻ địch trong tầm đánh hoặc xuất hiện trong bán kính 600 từ người chơi
    const enemyInAttackRange = findEnemyInAttackRange(entity, livingEnemies);
    const targetEnemy = enemyInAttackRange || (enemiesNearPlayer.length > 0 ? [...enemiesNearPlayer].sort(
      (a, b) => Math.hypot(a.x - entity.x, a.y - entity.y) - Math.hypot(b.x - entity.x, b.y - entity.y)
    )[0] : null);

    const maxDistanceToPlayerForRanged = 200; // Cự ly tụ tập quanh người chơi của tầm xa (~100-200px)
    if (distToPlayer > maxDistanceToPlayerForRanged) {
      // Đang quá xa người chơi -> Di chuyển về phía người chơi
      return {
        moveVec: {
          dx: (player.x - entity.x) / (distToPlayer || 1),
          dy: (player.y - entity.y) / (distToPlayer || 1)
        },
        targetEnemy
      };
    } else {
      // Đã ở quanh người chơi:
      // Kiểm tra nếu có kẻ địch quá gần NPC (< 140px) và vẫn chưa bị rời quá xa người chơi (< 250px)
      const closestEnemy = [...livingEnemies].sort(
        (a, b) => Math.hypot(a.x - entity.x, a.y - entity.y) - Math.hypot(b.x - entity.x, b.y - entity.y)
      )[0];
      const distToClosestEnemy = closestEnemy ? Math.hypot(closestEnemy.x - entity.x, closestEnemy.y - entity.y) : Infinity;

      if (closestEnemy && distToClosestEnemy < 140 && distToPlayer < 250) {
        // Lùi nhẹ ngược hướng kẻ địch (Kite an toàn)
        return {
          moveVec: {
            dx: (entity.x - closestEnemy.x) / (distToClosestEnemy || 1),
            dy: (entity.y - closestEnemy.y) / (distToClosestEnemy || 1)
          },
          targetEnemy
        };
      } else {
        // Đảo nhẹ quanh người chơi
        const dir = entity.circleDir || 1;
        return {
          moveVec: {
            dx: ((entity.y - player.y) / (distToPlayer || 1)) * 0.25 * dir,
            dy: ((player.x - entity.x) / (distToPlayer || 1)) * 0.25 * dir
          },
          targetEnemy
        };
      }
    }
  }
}

/**
 * Tìm bất kỳ kẻ địch nào đang rơi vào tầm đánh hiệu dụng của NPC
 */
export function findEnemyInAttackRange<T extends { x: number; y: number; hp: number; isDead?: boolean }>(
  entity: CombatEntityPosition,
  enemies: T[]
): T | null {
  const isMelee = entity.attackType === 'melee';
  const effectiveRange = isMelee ? 200 : (entity.attackRange || 450);

  // Lọc tất cả kẻ địch sống đang nằm trong tầm đánh
  const enemiesInRange = enemies.filter(
    e => !e.isDead && Math.hypot(e.x - entity.x, e.y - entity.y) <= effectiveRange
  );

  if (enemiesInRange.length === 0) return null;

  // Ưu tiên tấn công kẻ địch gần nhất trong tầm đánh
  return enemiesInRange.sort(
    (a, b) => Math.hypot(a.x - entity.x, a.y - entity.y) - Math.hypot(b.x - entity.x, b.y - entity.y)
  )[0];
}

