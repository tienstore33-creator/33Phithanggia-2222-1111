import { RTEntity } from '../../components/gameplay/RealTimeCombatScreen';

/**
 * Thực hiện đổi chỗ đồng minh đang chiến đấu sang dự bị và đưa đồng minh dự bị vào sân.
 * Đồng minh lùi về dự bị sẽ bật flag isRetreatingToReserve để chạy về mép trái bản đồ rồi ẩn đi.
 * Đồng minh dự bị xuất trận sẽ bật flag isEnteringBattle và di chuyển từ mép trái vào sân.
 */
export function performAllySwap(
    s: any,
    activeAllyId: string,
    reserveAllyId: string,
    spawnVfx: (text: string, x: number, y: number, color: string) => void
): boolean {
    if (!s || !s.entities) return false;

    const activeAlly = s.entities.find((e: RTEntity) => e.id === activeAllyId && e.isAlly);
    const reserveAlly = s.entities.find((e: RTEntity) => e.id === reserveAllyId && e.isAlly);

    if (!activeAlly || !reserveAlly) return false;
    if (activeAlly.isPlayer) return false; // Người chơi không rút lui về dự bị
    if (activeAlly.isDead || reserveAlly.isDead) return false;

    // Rút lui đồng minh đang tham chiến
    activeAlly.isRetreatingToReserve = true;
    activeAlly.isQueued = false; // Vẫn hiển thị trên màn hình trong lúc chạy về mép trái
    activeAlly.isEnteringBattle = false;

    // Xuất trận đồng minh dự bị
    reserveAlly.isQueued = false;
    reserveAlly.isRetreatingToReserve = false;
    reserveAlly.isEnteringBattle = true;
    reserveAlly.x = 20; // Xuất hiện từ mép trái
    reserveAlly.y = activeAlly.y + (Math.random() * 40 - 20);
    reserveAlly.targetX = (s.width || 1920) / 2 - 200 - Math.random() * 80;

    spawnVfx("RÚT LUI!", activeAlly.x, activeAlly.y - 20, '#f59e0b');
    spawnVfx("XUẤT TRẬN!", reserveAlly.x + 30, reserveAlly.y - 20, '#3b82f6');

    if (s.combatLogs) {
        s.combatLogs.unshift(`[ĐỔI ĐỘI HÌNH] ${activeAlly.combatant.name} lùi về dự bị, ${reserveAlly.combatant.name} xuất trận nghênh chiến!`);
    }

    return true;
}

/**
 * Xử lý di chuyển vật lý cho các nhân vật đang trong trạng thái "Rút về dự bị" hoặc "Xuất trận"
 */
export function updateRetreatingAndEnteringPhysics(
    entity: RTEntity,
    dt: number,
    s: any,
    spawnVfx: (text: string, x: number, y: number, color: string) => void,
    spawnAfterimage?: (e: RTEntity) => void
): void {
    const dts = dt / 1000;
    const speed = entity.speed || 150;

    // 1. Xử lý nhân vật lùi về dự bị -> Chạy sang mép trái bản đồ (x <= 20)
    if (entity.isRetreatingToReserve) {
        entity.x -= speed * 1.6 * dts;
        if (Math.random() < 0.25 && spawnAfterimage) {
            spawnAfterimage(entity);
        }

        // Đã đến mép trái bản đồ -> chính thức vào trạng thái dự bị (ẩn đi)
        if (entity.x <= 25) {
            entity.isRetreatingToReserve = false;
            entity.isQueued = true;
            entity.x = -1000;
            spawnVfx("DỰ BỊ", 30, entity.y - 20, '#9ca3af');
        }
        return;
    }

    // 2. Xử lý nhân vật dự bị mới xuất trận -> Chạy từ mép trái vào khu vực chiến đấu
    if (entity.isEnteringBattle) {
        const targetX = entity.targetX || ((s.width || 1920) / 2 - 200);
        if (entity.x < targetX) {
            entity.x += speed * 1.3 * dts;
            if (Math.random() < 0.25 && spawnAfterimage) {
                spawnAfterimage(entity);
            }
        } else {
            entity.isEnteringBattle = false;
        }
    }
}
