export const handleAuraFarmingBurst = (boss: any, spawnVfx: (msg: string, x: number, y: number, color: string) => void) => {
    if (boss.isBoss && !boss.auraFarmingModel && (boss.auraFarmingTimer || 0) <= 0) {
        boss.burstPoints = (boss.burstPoints || 0) + 1;
        if (boss.burstPoints >= 50) {
            boss.auraFarmingTimer = 10000; // 10s
            boss.auraFarmingModel = 'garou';
            boss.burstPoints = 0;
            spawnVfx(`AURA FARMING: GAROU`, boss.x, boss.y - 60, '#a855f7');
        }
    }
};

export const updateAuraFarmingTimer = (boss: any, dt: number, s: any, spawnVfx: (msg: string, x: number, y: number, color: string) => void) => {
    if (boss.auraFarmingModel === 'garou' && boss.auraFarmingTimer && boss.auraFarmingTimer > 0) {
        boss.auraFarmingTimer -= dt;
        if (boss.auraFarmingTimer <= 0) {
            boss.auraFarmingModel = undefined;
            spawnVfx(`AURA KHÔNG TRỌNG LỰC`, boss.x, boss.y - 40, '#a855f7');
            // Re-launch orbiting projectiles outward
            s.projectiles.forEach((p: any) => {
                if (p.isOrbiting && p.orbitingCenterId === boss.id) {
                    p.isOrbiting = false;
                    p.orbitingCenterId = undefined;
                    const angle = Math.random() * Math.PI * 2;
                    const speed = 200; // Was 400, slowed down by half
                    p.vx = Math.cos(angle) * speed;
                    p.vy = Math.sin(angle) * speed;
                    p.life = 7000;
                }
            });
        }
    }
};

export const handleAuraFarmingBossAttack = (boss: any, target: any, s: any, getMutableStats: any) => {
    boss.skillCooldown = 10000; // Disable normal skills
    if (boss.attackCooldown <= 0 && target) {
        boss.attackCooldown = 500; // 0.5s per attack as requested
        const dx = target.x - boss.x;
        const dy = target.y - boss.y;
        const dist = Math.hypot(dx, dy) || 1;
        s.projectiles.push({
            id: Math.random().toString(),
            x: boss.x, y: boss.y,
            startX: boss.x, startY: boss.y,
            vx: (dx / dist) * 1200, vy: (dy / dist) * 1200, // Extremely fast (Garou speed)
            targetId: '', sourceId: boss.id,
            damage: (getMutableStats(boss.combatant)?.sucTanCong || 10) * 0.4,
            isCrit: false,
            color: '#a855f7',
            life: 1500,
            isAuraFarmingAttack: true,
            baseSize: 10,
            distanceTraveled: 0
        });
    }
};

export const handleAuraFarmingProjectileUpdate = (p: any, s: any, dt: number, dts: number, isAlly: (id: string) => boolean, resolveHit: (e: any, p: any) => void, spawnVfx: (msg: string, x: number, y: number, color: string) => void) => {
    // 1. Event Horizon (150px) - Bend foreign projectiles
    if (!p.isAuraFarmingAttack && !p.isOrbiting && !p.isAuraFarmingExplosion && s.entities.some((e: any) => e.auraFarmingModel === 'garou')) {
        s.entities.forEach((boss: any) => {
            if (boss.auraFarmingModel === 'garou' && boss.id !== p.sourceId) {
                if (boss.isAlly !== isAlly(p.sourceId)) {
                    const dist = Math.hypot(boss.x - p.x, boss.y - p.y);
                    if (dist < boss.radius + 150) { // Increased to 150px
                        p.isOrbiting = true;
                        p.orbitingCenterId = boss.id;
                        p.orbitAngle = Math.atan2(p.y - boss.y, p.x - boss.x);
                        p.orbitRadius = dist;
                    }
                }
            }
        });
    }

    if (p.isOrbiting && p.orbitingCenterId) {
        const center = s.entities.find((e: any) => e.id === p.orbitingCenterId);
        if (center && center.auraFarmingModel === 'garou') {
            p.orbitAngle = (p.orbitAngle || 0) + 6 * dts; // Slowed down by half (was 12)
            p.x = center.x + Math.cos(p.orbitAngle) * (p.orbitRadius || 50);
            p.y = center.y + Math.sin(p.orbitAngle) * (p.orbitRadius || 50);
        } else {
            p.isOrbiting = false;
            const angle = Math.random() * Math.PI * 2;
            const speed = (Math.hypot(p.vx, p.vy) || 400) * 0.5; // Slowed down by half
            p.vx = Math.cos(angle) * speed;
            p.vy = Math.sin(angle) * speed;
        }
        return true; 
    }

    // 2. Limited Range (300px) for Aura Farming Attacks
    if (p.isAuraFarmingAttack) {
        p.distanceTraveled = (p.distanceTraveled || 0) + Math.hypot(p.vx * dts, p.vy * dts);
        if (p.distanceTraveled >= 300) { // Set to 300px
            p.life = -1; // Trigger explosion
            handleAuraFarmingExplosion(p, s, isAlly, resolveHit, spawnVfx);
            return true;
        }
    }
    
    return false;
};

export const handleAuraFarmingExplosion = (p: any, s: any, isAlly: (id: string) => boolean, resolveHit: (e: any, p: any) => void, spawnVfx: (msg: string, x: number, y: number, color: string) => void, excludeHitTargetId?: string) => {
    // 100px AOE damage
    s.entities.forEach((en: any) => {
        if (en.id !== p.sourceId && en.id !== excludeHitTargetId && Math.hypot(en.x - p.x, en.y - p.y) < 100 + en.radius && en.isAlly !== isAlly(p.sourceId)) {
            resolveHit(en, p);
        }
    });

    // Create a visual fading sphere projectile
    s.projectiles.push({
        id: Math.random().toString() + "_expl",
        x: p.x, y: p.y,
        vx: 0, vy: 0,
        sourceId: p.sourceId || '',
        damage: 0,
        color: '#facc15', // Yellow/Gold energy ball
        life: 1000, // 1 second duration
        maxLife: 1000,
        isAuraFarmingExplosion: true,
        size: 100
    });

    spawnVfx('✨', p.x, p.y, '#a855f7');
};
