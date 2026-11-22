// Utility module handling specialized real-time animations, physics, and mechanics for:
// 1. Combat Lôi Long Giáng Thế (Vòng xoáy lôi triều bán kính 350px xoáy vào 200px rồi xoay quanh caster 2s)
// 2. Combat Băng Hoàng Phá (Xuyên mọi vật thể, giảm tốc 30% trong 3s)
// 3. Combat Liệt Hỏa Phần Thiên (Rơi từ 200px trên đầu kẻ địch, AoE 200px, DoT 5s mỗi giây 1/10 dmg kèm 🔥 dưới chân)
// 4. Cooldown 15s cho cả 3 chiêu thức.

export interface SkillLike {
    name?: string;
    coreSkillName?: string;
    cooldown?: number;
}

export function isLoiLongGiangThe(name?: string, coreName?: string): boolean {
    const n = (name || '').toLowerCase();
    const c = (coreName || '').toLowerCase();
    return n.includes('lôi long giáng thế') || n.includes('loi long giang the') ||
           c.includes('lôi long giáng thế') || c.includes('loi long giang the');
}

export function isBangHoangPha(name?: string, coreName?: string): boolean {
    const n = (name || '').toLowerCase();
    const c = (coreName || '').toLowerCase();
    return n.includes('băng hoàng phá') || n.includes('bang hoang pha') ||
           c.includes('băng hoàng phá') || c.includes('bang hoang pha');
}

export function isLietHoaPhanThien(name?: string, coreName?: string): boolean {
    const n = (name || '').toLowerCase();
    const c = (coreName || '').toLowerCase();
    return n.includes('liệt hỏa phần thiên') || n.includes('liet hoa phan thien') ||
           c.includes('liệt hỏa phần thiên') || c.includes('liet hoa phan thien');
}

export function isPhaGiapKich(name?: string, coreName?: string): boolean {
    const n = (name || '').toLowerCase();
    const c = (coreName || '').toLowerCase();
    return n.includes('phá giáp kích') || n.includes('pha giap kich') ||
           c.includes('phá giáp kích') || c.includes('pha giap kich');
}

export function isSpecialTrioSkill(skill?: SkillLike | null): boolean {
    if (!skill) return false;
    return isLoiLongGiangThe(skill.name, skill.coreSkillName) ||
           isBangHoangPha(skill.name, skill.coreSkillName) ||
           isLietHoaPhanThien(skill.name, skill.coreSkillName);
}

/**
 * Trả về thời gian hồi chiêu (ms). Với 3 skill đặc biệt luôn là 15.000ms (15s).
 */
export function getSkillCooldownMs(skill?: SkillLike | null): number {
    if (!skill) return 10000;
    if (isSpecialTrioSkill(skill)) return 15000;
    if (skill.cooldown && skill.cooldown > 0) return skill.cooldown * 1000;
    return 10000;
}

/**
 * Trả về thời gian hồi chiêu (giây) hiển thị giao diện.
 */
export function getSkillCooldownSeconds(skill?: SkillLike | null): number {
    if (!skill) return 10;
    if (isSpecialTrioSkill(skill)) return 15;
    if (skill.cooldown && skill.cooldown > 0) return skill.cooldown;
    return 10;
}

/**
 * Triển khai skill Lôi Long Giáng Thế:
 * Tạo vòng tròn các icon 🌊 đường kính 700px (bán kính 350px) xung quanh caster.
 * Xoáy vào trong bất quy tắc về phía caster, dừng lại ở khoảng cách 200px với caster.
 * Xoay quanh caster 2s rồi biến mất.
 */
export function castLoiLongGiangThe(
    source: any,
    totalDmg: number,
    s: any,
    spawnVfx: (text: string, x: number, y: number, color: string) => void
) {
    const waveCount = 18; // 18 icon 🌊 phân bố đều trên vòng tròn
    const initialRadius = 350; // Vòng tròn rộng 700px xung quanh caster (bán kính 350px)
    const targetOrbitRadius = 100; // Dừng lại ở khoảng cách 100px
    const spiralDuration = 1200; // Thời gian xoáy vào (ms)
    const orbitDuration = 2000; // Thời gian xoay quanh caster (2s)
    const totalLife = spiralDuration + orbitDuration;

    spawnVfx("⚡ LÔI LONG GIÁNG THẾ (15s CD)!", source.x, source.y - 45, '#facc15');

    for (let i = 0; i < waveCount; i++) {
        const baseAngle = (i / waveCount) * Math.PI * 2;
        const wobblePhase = Math.random() * Math.PI * 2;
        const wobbleAmp = 12 + Math.random() * 16;
        const wobbleFreq = 0.008 + Math.random() * 0.006;
        const spinSpeed = 0.0035 + (Math.random() * 0.001 - 0.0005);

        const startX = source.x + Math.cos(baseAngle) * initialRadius;
        const startY = source.y + Math.sin(baseAngle) * initialRadius;

        s.projectiles.push({
            id: `loilong-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 4)}`,
            x: startX,
            y: startY,
            vx: 0,
            vy: 0,
            targetId: '',
            sourceId: source.id,
            damage: Math.max(1, Math.floor(totalDmg / 2)), // Sát thương va chạm mỗi đợt
            isHeal: false,
            isCrit: false,
            color: '#facc15',
            skillName: 'combat Lôi Long Giáng Thế',
            life: totalLife,
            maxLife: totalLife,
            emoji: '🌪️',
            baseSize: 78,
            isPiercing: true,
            isPierceAll: true, // Không biến mất khi chạm vật thể
            isLoiLongWave: true,
            casterId: source.id,
            baseAngle: baseAngle,
            wobblePhase: wobblePhase,
            wobbleAmp: wobbleAmp,
            wobbleFreq: wobbleFreq,
            spinSpeed: spinSpeed,
            spiralDuration: spiralDuration,
            orbitDuration: orbitDuration,
            initialRadius: initialRadius,
            targetOrbitRadius: targetOrbitRadius,
            lastHitTimes: {}, // Cooldown đánh trúng cùng một thực thể
            hitIds: []
        });
    }
}

/**
 * Triển khai skill Băng Hoàng Phá:
 * Giữ nguyên animation bắn 12 sóng 🌊 toả tròn,
 * nhưng sóng đi xuyên qua MỌI vật thể (không bị biến mất) và gây giảm tốc 30% trong 3s cho kẻ địch bị đi qua.
 */
export function castBangHoangPha(
    source: any,
    totalDmg: number,
    s: any,
    spawnSkillProjectile: (targetPos: {x: number, y: number}, isHeal: boolean, amount: number, useArcWave?: boolean, overrideAngle?: number, useExpandingCircle?: boolean, isLifesteal?: boolean, targetId?: string, emoji?: string, extraProps?: any) => void
) {
    const numArcs = 12;
    for (let i = 0; i < numArcs; i++) {
        const angle = (i / numArcs) * Math.PI * 2;
        spawnSkillProjectile(
            { x: 0, y: 0 },
            false,
            totalDmg,
            true, // useArcWave
            angle,
            false,
            false,
            undefined,
            '❄️',
            {
                isPierceAll: true, // Đi xuyên mọi vật thể
                isPiercing: true,
                isBangHoangWave: true,
                slowRate: 0.3, // Giảm tốc 30%
                slowDuration: 3000, // Trong 3s
                baseSize: 96
            }
        );
    }
}

/**
 * Triển khai skill Liệt Hỏa Phần Thiên:
 * 🌊 xuất hiện trên đầu kẻ địch (200px trên đầu) và rơi xuống vị trí kẻ địch,
 * gây sát thương AoE 200px và DoT cho kẻ địch dính phải trong 5s (1/10 damage cũ mỗi giây).
 * Mỗi lần có damage DoT sẽ xuất hiện icon 🔥 nhỏ dưới chân kẻ địch.
 */
export function castLietHoaPhanThien(
    source: any,
    livingEnemies: any[],
    totalDmg: number,
    s: any,
    spawnVfx: (text: string, x: number, y: number, color: string) => void
) {
    spawnVfx("🔥 LIỆT HỎA PHẦN THIÊN (15s CD)!", source.x, source.y - 45, '#ef4444');

    const targets = livingEnemies.length > 0 ? livingEnemies : [source];

    targets.forEach((enemy, idx) => {
        const targetX = enemy.x;
        const targetY = enemy.y;
        const spawnX = targetX;
        const spawnY = targetY - 200; // 200px trên đầu kẻ địch

        const fallSpeed = 500; // Tốc độ rơi xuống (px/s)
        const fallTime = (200 / fallSpeed) * 1000; // ~400ms

        s.projectiles.push({
            id: `liethoa-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 4)}`,
            x: spawnX,
            y: spawnY,
            vx: 0,
            vy: fallSpeed,
            targetX: targetX,
            targetY: targetY,
            targetId: enemy.id,
            sourceId: source.id,
            damage: totalDmg,
            isHeal: false,
            isCrit: false,
            color: '#ef4444',
            skillName: 'combat Liệt Hỏa Phần Thiên',
            life: fallTime + 500, // Đủ thời gian chạm đất
            maxLife: fallTime + 500,
            emoji: '🔥',
            baseSize: 96,
            isPiercing: true,
            isPierceAll: true,
            isLietHoaFall: true,
            aoeRadius: 200, // Bán kính AoE 200px
            dotDamage: Math.max(1, Math.floor(totalDmg / 10)), // 1/10 damage cũ mỗi giây
            dotDuration: 5000, // 5s DoT
            hitIds: []
        });

        // Hiệu ứng cảnh báo rơi
        spawnVfx("⚠️ THIÊN GIÁNG THỦY HỎA!", spawnX, spawnY - 20, '#f97316');
    });
}

/**
 * Cập nhật tọa độ và logic chuyển động cho các đạn skill tùy biến:
 * - Lôi Long Giáng Thế (xoáy vào trong bất quy tắc -> quay quanh caster 2s)
 * - Liệt Hỏa Phần Thiên (rơi từ trên cao -> phát nổ AoE 200px và gán DoT)
 * Trả về true nếu projectile này đã được xử lý xong bởi hàm tùy biến.
 */
export function updateCustomSkillProjectiles(
    p: any,
    dt: number,
    s: any,
    spawnVfx: (text: string, x: number, y: number, color: string) => void,
    resolveHit: (target: any, proj: any) => void
): { handled: boolean; expired?: boolean } {
    // 1. Xử lý Lôi Long Giáng Thế
    if (p.isLoiLongWave) {
        p.life -= dt;
        if (p.life <= 0) return { handled: true, expired: true };

        const caster = s.entities.find((e: any) => e.id === p.casterId && !e.isDead);
        const centerX = caster ? caster.x : p.x;
        const centerY = caster ? caster.y : p.y;

        const elapsed = p.maxLife - p.life;
        const spiralDur = p.spiralDuration || 1200;

        let currentDist = p.targetOrbitRadius || 200;
        let currentAngle = p.baseAngle + elapsed * (p.spinSpeed || 0.0035);

        if (elapsed < spiralDur) {
            // Giai đoạn 1: Xoáy vào trong bất quy tắc từ 350px về 200px
            const progress = elapsed / spiralDur;
            const linearR = p.initialRadius - (p.initialRadius - p.targetOrbitRadius) * progress;
            // Độ lệch bất quy tắc
            const wobble = Math.sin(elapsed * p.wobbleFreq + p.wobblePhase) * p.wobbleAmp * (1 - progress * 0.5);
            currentDist = Math.max(p.targetOrbitRadius, linearR + wobble);
        } else {
            // Giai đoạn 2: Dừng lại ở khoảng cách 200px và xoay vòng quanh caster trong 2s
            const wobble = Math.sin(elapsed * 0.006 + p.wobblePhase) * 6;
            currentDist = (p.targetOrbitRadius || 200) + wobble;
        }

        p.x = centerX + Math.cos(currentAngle) * currentDist;
        p.y = centerY + Math.sin(currentAngle) * currentDist;
        p.vx = Math.cos(currentAngle + Math.PI / 2) * 200;
        p.vy = Math.sin(currentAngle + Math.PI / 2) * 200;

        // Va chạm gây sát thương cho đối phương khi chạm vào sóng xoáy
        const now = Date.now();
        p.lastHitTimes = p.lastHitTimes || {};

        s.entities.forEach((ent: any) => {
            if (ent.isDead || ent.isObstacle || ent.id === p.sourceId) return;
            const casterIsAlly = caster ? caster.isAlly : true;
            if (ent.isAlly === casterIsAlly) return;

            const dist = Math.hypot(ent.x - p.x, ent.y - p.y);
            const hitDist = (p.baseSize || 20) + (ent.radius || 20);

            if (dist <= hitDist) {
                const lastHit = p.lastHitTimes[ent.id] || 0;
                if (now - lastHit >= 500) { // Mỗi nửa giây gây sát thương một lần cho kẻ địch đứng trong lôi triều
                    p.lastHitTimes[ent.id] = now;
                    resolveHit(ent, p);
                    spawnVfx("⚡", ent.x, ent.y - 15, '#facc15');
                }
            }
        });

        return { handled: true, expired: false };
    }

    // 2. Xử lý Liệt Hỏa Phần Thiên
    if (p.isLietHoaFall) {
        p.y += p.vy * (dt / 1000);
        p.life -= dt;

        // Khi rơi xuống đến hoặc vượt quá vị trí chân mục tiêu
        if (p.y >= p.targetY || p.life <= 0) {
            p.life = -1; // Biến mất sau khi nổ
            const impactX = p.targetX;
            const impactY = p.targetY;

            // Hiệu ứng nổ lớn
            spawnVfx("💥", impactX, impactY, '#ef4444');
            spawnVfx("🌋 BÙNG NỔ 200PX!", impactX, impactY - 40, '#f97316');

            const aoeRange = p.aoeRadius || 200;
            const pSource = s.entities.find((e: any) => e.id === p.sourceId);
            const sourceIsAlly = pSource ? pSource.isAlly : true;

            // Gây sát thương AoE 200px và gán DoT 5s cho mọi kẻ địch dính phải
            s.entities.forEach((ent: any) => {
                if (ent.isDead || ent.isObstacle) return;
                if (ent.isAlly === sourceIsAlly) return;

                const dist = Math.hypot(ent.x - impactX, ent.y - impactY);
                if (dist <= aoeRange) {
                    // 1. Sát thương tức thì
                    resolveHit(ent, p);

                    // 2. Kích hoạt DoT thiêu đốt trong 5 giây (1/10 damage mỗi giây)
                    ent.burnDoTTimer = p.dotDuration || 5000;
                    ent.burnDoTTickTimer = 0;
                    ent.burnDoTDamage = p.dotDamage || Math.max(1, Math.floor(p.damage / 10));
                    ent.burnDoTSourceId = p.sourceId;

                    spawnVfx("🔥 THIÊU ĐỐT (5s)", ent.x, ent.y - 35, '#f97316');
                }
            });

            return { handled: true, expired: true };
        }

        return { handled: true, expired: false };
    }

    // 3. Xử lý Phá Giáp Kích (Búa gõ)
    if (p.isHammerAttack) {
        p.life -= dt;
        if (p.life <= 0) return { handled: true, expired: true };

        // Bám theo caster nếu caster còn sống
        const caster = s.entities.find((e: any) => e.id === p.sourceId && !e.isDead);
        if (caster) {
            p.x = caster.x;
            p.y = caster.y;
        }
        return { handled: true, expired: false };
    }

    return { handled: false };
}

/**
 * Cập nhật hiệu ứng DoT thiêu đốt của Liệt Hỏa Phần Thiên theo mỗi frame/tick:
 * Kẻ địch bị DoT trong 5s, mỗi giây mất 1/10 damage cũ và xuất hiện icon 🔥 nhỏ dưới chân kẻ địch.
 */
export function updateEntityBurnDoT(
    entity: any,
    dt: number,
    s: any,
    spawnVfx: (text: string, x: number, y: number, color: string) => void,
    getMutableStats: (combatant: any) => any
) {
    if (entity.burnDoTTimer && entity.burnDoTTimer > 0) {
        entity.burnDoTTimer -= dt;
        entity.burnDoTTickTimer = (entity.burnDoTTickTimer || 0) + dt;

        if (entity.burnDoTTickTimer >= 1000) {
            entity.burnDoTTickTimer = 0;
            const dotDmg = entity.burnDoTDamage || 10;
            entity.hp -= dotDmg;
            if (entity.hp < 0) entity.hp = 0;

            // Icon 🔥 nhỏ dưới chân kẻ địch
            const footY = entity.y + (entity.radius || 20);
            spawnVfx("🔥", entity.x, footY, '#f97316');
            spawnVfx(`-${dotDmg}`, entity.x, entity.y - 20, '#f97316');

            const stats = getMutableStats(entity.combatant);
            if (stats) stats.sinhLuc = entity.hp;

            if (entity.hp <= 0 && !entity.isDead) {
                entity.isDead = true;
                if (!entity.isObstacle) {
                    s.combatLogs.push(`${entity.combatant?.name || "Kẻ địch"} đã bị thiêu rụi bởi Liệt Hỏa Phần Thiên.`);
                }
            }
        }
    }
}
