import { KnowledgeBase, GameMessage, NPC, YeuThu, PlayerStats } from '../../types';
import { realmManager, getEffectiveRealmSystem } from '../../services/realmManager';
import { parseRealm } from '../../utils/realmUtils';

/**
 * Hạ 1 tiểu cảnh giới hiện có của nhân vật.
 */
export function regressOneMinorRealm(currentRealm: string, kb: KnowledgeBase): string {
    const progressionList = realmManager.getProgressionList(kb);
    if (!progressionList || progressionList.length === 0) {
        return currentRealm || "Phàm Nhân";
    }

    const cleanList = progressionList.map(r => r.trim());
    let trimmedCurrent = (currentRealm || "").trim();

    // Chuẩn hóa định dạng "Đại (Tiểu)" -> "Đại Tiểu"
    const match = trimmedCurrent.match(/^(.*)\s*\((.*)\)$/);
    if (match) {
        trimmedCurrent = `${match[1].trim()} ${match[2].trim()}`;
    }

    let currentIndex = cleanList.indexOf(trimmedCurrent);
    if (currentIndex === -1) {
        currentIndex = cleanList.findIndex(r => r.toLowerCase() === trimmedCurrent.toLowerCase());
    }

    if (currentIndex <= 0) {
        // Đã ở cảnh giới thấp nhất hoặc không tìm thấy -> đưa về cảnh giới nền
        return realmManager.getBaseRealm(kb);
    }

    return progressionList[currentIndex - 1];
}

/**
 * Tìm thực thể NPC hoặc Yêu Thú trong toàn bộ cơ sở tri thức dựa vào ID.
 */
function findEntityById(kb: KnowledgeBase, id: string): any | null {
    const allLists = [
        kb.discoveredNPCs || [],
        kb.discoveredYeuThu || [],
        kb.wives || [],
        kb.slaves || [],
        kb.prisoners || [],
        (kb as any).companions || [],
        kb.pendingCombat?.temporaryEntities || []
    ];
    for (const list of allLists) {
        const found = list.find((item: any) => item.id === id);
        if (found) return found;
    }
    return null;
}

/**
 * Ước tính lực chiến (Combat Power) của một thực thể (Player hoặc NPC/Yêu Thú).
 */
function calculateEntityPower(entity: any, isPlayer: boolean, kb: KnowledgeBase): number {
    const realmSystem = getEffectiveRealmSystem(kb);
    const realmStr = isPlayer ? entity.realm : (entity.realm || kb.worldRealmBase || "Phàm Nhân");
    const { majorIndex, minorIndex } = parseRealm(realmStr, realmSystem);

    const realmBonus = (majorIndex * 1500) + (minorIndex * 150);

    if (isPlayer) {
        const player = entity as PlayerStats;
        const hp = player.sinhLuc || player.maxSinhLuc || 1000;
        const atk = player.sucTanCong || 100;
        const def = player.phongNgu || 50;
        return Math.max(100, Math.round(hp * 0.5 + atk * 3.0 + def * 2.0 + realmBonus));
    }

    // Đối với NPC hoặc Yêu thú
    const hp = entity.stats?.maxSinhLuc || entity.maxSinhLuc || entity.sinhLuc || (1000 + majorIndex * 800 + minorIndex * 80);
    const atk = entity.stats?.sucTanCong || entity.sucTanCong || (100 + majorIndex * 150 + minorIndex * 20);
    const def = entity.stats?.phongNgu || entity.phongNgu || (50 + majorIndex * 80 + minorIndex * 10);

    return Math.max(100, Math.round(hp * 0.5 + atk * 3.0 + def * 2.0 + realmBonus));
}

export interface FleeCombatResult {
    updatedKb: KnowledgeBase;
    message: GameMessage;
    penaltyDetails: {
        oldRealm: string;
        newRealm: string;
        lostMoney: number;
        remainingMoney: number;
        affectedNpcNames: string[];
    };
}

/**
 * Xử lý bỏ chạy khỏi Pending Combat (100% thành công, phạt 1 tiểu cảnh giới, 70% tiền, -50 thiện cảm).
 */
export function executeFleeCombat(kb: KnowledgeBase): FleeCombatResult | null {
    if (!kb.pendingCombat) return null;

    const newKb: KnowledgeBase = JSON.parse(JSON.stringify(kb));
    const pending = newKb.pendingCombat!;

    // 1. Hạ 1 tiểu cảnh giới
    const oldRealm = newKb.playerStats.realm || "Phàm Nhân";
    const newRealm = regressOneMinorRealm(oldRealm, newKb);
    newKb.playerStats.realm = newRealm;
    newKb.playerStats.kinhNghiem = 0; // Reset exp trong cảnh giới hiện tại

    // 2. Mất 70% tiền
    const currentMoney = Math.max(0, Number(newKb.playerStats.currency) || 0);
    const lostMoney = Math.floor(currentMoney * 0.7);
    newKb.playerStats.currency = Math.max(0, currentMoney - lostMoney);

    // 3. Giảm 50 điểm thiện cảm với tất cả NPC liên quan trong pending combat
    const participantIds = new Set<string>([
        ...(pending.opponentIds || []),
        ...(pending.allyIds || [])
    ]);

    const affectedNpcNames: string[] = [];

    const updateAffinityInList = (list: any[]) => {
        if (!Array.isArray(list)) return;
        for (const item of list) {
            if (item && item.id && participantIds.has(item.id)) {
                item.affinity = (item.affinity ?? 0) - 50;
                if (item.name && !affectedNpcNames.includes(item.name)) {
                    affectedNpcNames.push(item.name);
                }
            }
        }
    };

    updateAffinityInList(newKb.discoveredNPCs);
    updateAffinityInList(newKb.discoveredYeuThu);
    updateAffinityInList(newKb.wives);
    updateAffinityInList(newKb.slaves);
    updateAffinityInList(newKb.prisoners);
    if ((newKb as any).companions) updateAffinityInList((newKb as any).companions);

    // 4. Dọn dẹp trạng thái pending combat
    newKb.pendingCombat = null;
    newKb.playerStats.isInCombat = false;

    const currentTurn = newKb.playerStats.turn || 1;
    const playerName = newKb.worldConfig?.playerName || "Bạn";

    const content = `🏃💨 **ĐÀO TẨU THÀNH CÔNG KHỎI VÒNG VÂY CHIẾN ĐẤU!**\n\n` +
        `Nhận thấy tình thế hiểm nghèo, **${playerName}** đã lập tức thi triển toàn bộ công pháp, liều mạng mở đường máu tháo chạy khỏi chiến trường!\n\n` +
        `📉 **TỔN THẤT & HẬU QUẢ NẶNG NỀ:**\n` +
        `• **Tu vi thụt lùi:** Tổn thương kinh mạch khiến cảnh giới tụt giảm **1 tiểu cảnh giới** từ [**${oldRealm}**] rớt xuống [**${newRealm}**] (EXP bị reset về 0).\n` +
        `• **Tài sản thất lạc:** Trong lúc hỗn loạn đã đánh rơi **${lostMoney.toLocaleString()}** Linh Thạch (70% tổng ngân lượng). Ngân quỹ còn lại: **${newKb.playerStats.currency.toLocaleString()}** Linh Thạch.\n` +
        `• **Mối quan hệ sứt mẻ:** Hành động bỏ chạy khiến thiện cảm giảm **-50 điểm** với các đối tượng liên quan: ${affectedNpcNames.length > 0 ? affectedNpcNames.map(n => `\`${n}\``).join(', ') : "Toàn bộ kẻ địch và đồng minh tham chiến"}.`;

    const fleeMessage: GameMessage = {
        id: `flee-${Date.now()}`,
        type: 'system',
        content,
        timestamp: Date.now(),
        turnNumber: currentTurn
    };

    return {
        updatedKb: newKb,
        message: fleeMessage,
        penaltyDetails: {
            oldRealm,
            newRealm,
            lostMoney,
            remainingMoney: newKb.playerStats.currency,
            affectedNpcNames
        }
    };
}

export interface AutoCombatResult {
    updatedKb: KnowledgeBase;
    message: GameMessage;
    summary: {
        isVictory: boolean;
        allyPower: number;
        enemyPower: number;
        winProbability: number;
        deadOpponents: string[];
        deadAllies: string[];
        survivingOpponents: string[];
        playerHpLoss: number;
        playerRemainingHp: number;
        lootedMoney: number;
        gainedExp: number;
    };
}

/**
 * Xử lý Tự động chiến đấu (Dựa vào chỉ số và cảnh giới để tính toán kết quả, thương vong, thiệt hại).
 */
export function executeAutoCombat(kb: KnowledgeBase): AutoCombatResult | null {
    if (!kb.pendingCombat) return null;

    const newKb: KnowledgeBase = JSON.parse(JSON.stringify(kb));
    const pending = newKb.pendingCombat!;

    const playerName = newKb.worldConfig?.playerName || "Người chơi";
    const currentTurn = newKb.playerStats.turn || 1;

    // 1. Thu thập danh sách Đồng minh & Kẻ địch
    const allyEntities: any[] = [];
    if (pending.allyIds && pending.allyIds.length > 0) {
        for (const id of pending.allyIds) {
            const found = findEntityById(newKb, id);
            if (found && !found.isDead) {
                allyEntities.push(found);
            }
        }
    }

    const opponentEntities: any[] = [];
    if (pending.opponentIds && pending.opponentIds.length > 0) {
        for (const id of pending.opponentIds) {
            const found = findEntityById(newKb, id);
            if (found && !found.isDead) {
                opponentEntities.push(found);
            }
        }
    }

    // Nếu không tìm thấy kẻ địch nào còn sống
    if (opponentEntities.length === 0) {
        newKb.pendingCombat = null;
        newKb.playerStats.isInCombat = false;
        const msg: GameMessage = {
            id: `autocombat-${Date.now()}`,
            type: 'system',
            content: `⚔️ **TỰ ĐỘNG KẾT THÚC CHIẾN ĐẤU:** Không tìm thấy đối thủ khả dụng trên chiến trường hoặc đối thủ đã bị tiêu diệt trước đó.`,
            timestamp: Date.now(),
            turnNumber: currentTurn
        };
        return {
            updatedKb: newKb,
            message: msg,
            summary: {
                isVictory: true,
                allyPower: 0,
                enemyPower: 0,
                winProbability: 1,
                deadOpponents: [],
                deadAllies: [],
                survivingOpponents: [],
                playerHpLoss: 0,
                playerRemainingHp: newKb.playerStats.sinhLuc,
                lootedMoney: 0,
                gainedExp: 0
            }
        };
    }

    // 2. Tính toán Lực chiến (Combat Power)
    const playerPower = calculateEntityPower(newKb.playerStats, true, newKb);
    const allyPowers = allyEntities.map(ally => calculateEntityPower(ally, false, newKb));
    const opponentPowers = opponentEntities.map(opp => calculateEntityPower(opp, false, newKb));

    const totalAllyPower = playerPower + allyPowers.reduce((a, b) => a + b, 0);
    const totalEnemyPower = opponentPowers.reduce((a, b) => a + b, 0);

    // Tỉ lệ thắng từ 5% đến 95%
    const winProbability = Math.max(0.05, Math.min(0.95, totalAllyPower / (totalAllyPower + totalEnemyPower)));
    const roll = Math.random();
    const isVictory = roll < winProbability;

    const deadOpponents: string[] = [];
    const survivingOpponents: string[] = [];
    const deadAllies: string[] = [];

    let playerHpLoss = 0;
    let lootedMoney = 0;
    let gainedExp = 0;

    const markDead = (entity: any) => {
        entity.isDead = true;
        entity.status = '[ĐÃ CHẾT]';
    };

    if (isVictory) {
        // --- CHIẾN THẮNG ---
        // Xác định thương vong kẻ địch
        const enemyFatalityRate = Math.max(0.4, Math.min(0.9, (totalAllyPower / (totalAllyPower + totalEnemyPower)) * 0.9));
        for (const opp of opponentEntities) {
            if (Math.random() < enemyFatalityRate) {
                markDead(opp);
                deadOpponents.push(opp.name || "Kẻ địch");
            } else {
                opp.status = 'Trọng thương tẩu thoát';
                survivingOpponents.push(opp.name || "Kẻ địch");
            }
        }

        // Thiệt hại Sinh lực người chơi
        const powerRatio = totalEnemyPower / totalAllyPower;
        const damagePercent = Math.max(0.05, Math.min(0.85, (powerRatio * 0.35) + (Math.random() * 0.15)));
        const currentHp = newKb.playerStats.sinhLuc || newKb.playerStats.maxSinhLuc || 1000;
        playerHpLoss = Math.floor(currentHp * damagePercent);
        newKb.playerStats.sinhLuc = Math.max(1, currentHp - playerHpLoss);

        // Thương vong đồng minh (xác suất thấp nếu tổn thất cao)
        if (damagePercent > 0.6) {
            for (const ally of allyEntities) {
                if (Math.random() < 0.25) {
                    markDead(ally);
                    deadAllies.push(ally.name || "Đồng minh");
                }
            }
        }

        // Chiến lợi phẩm
        lootedMoney = Math.floor(opponentEntities.length * 80 + Math.random() * 120);
        gainedExp = Math.floor(opponentEntities.length * 60 + Math.round(totalEnemyPower * 0.03));

        newKb.playerStats.currency = (newKb.playerStats.currency || 0) + lootedMoney;
        newKb.playerStats.kinhNghiem = (newKb.playerStats.kinhNghiem || 0) + gainedExp;
    } else {
        // --- THẤT BẠI ---
        // Người chơi bị trọng thương nặng
        const currentHp = newKb.playerStats.sinhLuc || 1000;
        playerHpLoss = Math.max(1, currentHp - 1);
        
        // CHỈ ép về 1 HP nếu không phải đang trong trạng thái tử vong/tự sát
        if (!newKb.playerStats.isDead) {
            newKb.playerStats.sinhLuc = 1; // Hấp hối
        }

        // Đánh rơi 30% tiền khi thất bại
        const currentMoney = newKb.playerStats.currency || 0;
        const lostMoney = Math.floor(currentMoney * 0.3);
        newKb.playerStats.currency = Math.max(0, currentMoney - lostMoney);

        // Thương vong đồng minh (tỉ lệ cao)
        for (const ally of allyEntities) {
            if (Math.random() < 0.5) {
                markDead(ally);
                deadAllies.push(ally.name || "Đồng minh");
            }
        }

        // Kẻ địch có thể có 1 số ít tử vong do phản kháng quyết liệt
        for (const opp of opponentEntities) {
            if (Math.random() < 0.2) {
                markDead(opp);
                deadOpponents.push(opp.name || "Kẻ địch");
            } else {
                survivingOpponents.push(opp.name || "Kẻ địch");
            }
        }
    }

    // Dọn dẹp trạng thái pending combat
    newKb.pendingCombat = null;
    newKb.playerStats.isInCombat = false;

    // Soạn thảo thông điệp báo cáo kết quả
    const winRateDisplay = Math.round(winProbability * 100);
    const title = isVictory
        ? `⚔️🏆 **TỰ ĐỘNG CHIẾN ĐẤU - CHIẾN THẮNG VANG DỘI!**`
        : `⚔️💥 **TỰ ĐỘNG CHIẾN ĐẤU - THẤT BẠI NẶNG NỀ!**`;

    const narration = isVictory
        ? `Trận chiến tự động diễn ra vô cùng kịch tính! Nhờ vào ưu thế lực chiến và mưu lược xuất thần, **${playerName}** cùng phe đồng minh đã quét sạch trận địa, đánh tan toàn bộ quân địch!`
        : `Lực lượng địch quá áp đảo khiến thế trận nhanh chóng rơi vào hỗn loạn! **${playerName}** cùng đồng minh đã chiến đấu kiên cường đến cùng trước khi bị đánh trọng thương gục ngã!`;

    const allyPowerInfo = `• **Phe Ta:** Lực chiến \`${totalAllyPower.toLocaleString()}\` (${playerName} [${newKb.playerStats.realm || "Phàm Nhân"}] ${allyEntities.length > 0 ? `+ ${allyEntities.length} đồng minh` : ''})`;
    const enemyPowerInfo = `• **Phe Địch:** Lực chiến \`${totalEnemyPower.toLocaleString()}\` (${opponentEntities.length} đối thủ)`;
    const matchAnalysis = `📊 **TƯƠNG QUAN LỰC LƯỢNG:**\n${allyPowerInfo}\n${enemyPowerInfo}\n• **Xác suất thắng ban đầu:** \`${winRateDisplay}%\``;

    let casualtyReport = `🩸 **BÁO CÁO THƯƠNG VONG & THIỆT HẠI:**\n`;
    casualtyReport += `• **Sinh lực ${playerName}:** Mất -${playerHpLoss.toLocaleString()} HP (Hiện còn: **${newKb.playerStats.sinhLuc.toLocaleString()}** / ${newKb.playerStats.maxSinhLuc || 1000} HP).\n`;

    if (deadOpponents.length > 0) {
        casualtyReport += `• **Kẻ địch tử vong (${deadOpponents.length}):** ${deadOpponents.map(n => `\`${n}\``).join(', ')}.\n`;
    }
    if (survivingOpponents.length > 0) {
        casualtyReport += `• **Kẻ địch tẩu thoát/bại trận (${survivingOpponents.length}):** ${survivingOpponents.map(n => `\`${n}\``).join(', ')}.\n`;
    }
    if (deadAllies.length > 0) {
        casualtyReport += `• **Đồng minh hy sinh (${deadAllies.length}):** ${deadAllies.map(n => `\`${n}\``).join(', ')}.\n`;
    }

    let rewardSection = "";
    if (isVictory) {
        rewardSection = `\n🎁 **CHIẾN LỢI PHẨM THU ĐƯỢC:**\n• **Linh Thạch:** +**${lootedMoney.toLocaleString()}** Linh Thạch.\n• **Kinh Nghiệm:** +**${gainedExp.toLocaleString()}** EXP.`;
    } else {
        rewardSection = `\n⚠️ **TỔN THẤT:** Đánh rơi Linh Thạch và bị trọng thương hấp hối. Cần trị thương khẩn cấp!`;
    }

    const fullContent = `${title}\n\n${narration}\n\n${matchAnalysis}\n\n${casualtyReport}${rewardSection}`;

    const combatMessage: GameMessage = {
        id: `autocombat-${Date.now()}`,
        type: 'system',
        content: fullContent,
        timestamp: Date.now(),
        turnNumber: currentTurn
    };

    return {
        updatedKb: newKb,
        message: combatMessage,
        summary: {
            isVictory,
            allyPower: totalAllyPower,
            enemyPower: totalEnemyPower,
            winProbability,
            deadOpponents,
            deadAllies,
            survivingOpponents,
            playerHpLoss,
            playerRemainingHp: newKb.playerStats.sinhLuc,
            lootedMoney,
            gainedExp
        }
    };
}
