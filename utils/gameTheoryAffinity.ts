import { KnowledgeBase, NPC, Wife, Slave, Prisoner } from '../types';
import { parseRealm } from './realmUtils';
import { getEffectiveRealmSystem } from '../services/realmManager';

export interface PayoffWeights {
    trust: number;
    fear: number;
    payoffs: {
        coop: number;     // Hợp tác
        exploit: number;  // Trục lợi/Phản bội
        flee: number;     // Phòng thủ/Né tránh
    };
    bestStrategy: 'coop' | 'exploit' | 'flee';
    // 5 Mô hình Game Theory nâng cao
    signaling: {
        apparentPower: string;
        signalType: 'authentic' | 'bluff_weakness' | 'bluff_strength'; // Giả yếu (giả heo ăn hổ) / Phô trương
        suspicionLevel: number; // 0 - 100%
    };
    repeatedGame: {
        titForTatState: 'cooperative' | 'retaliatory' | 'neutral';
        gratitudeOrGrudgeScore: number; // Ân oán tích lũy (-100 đến +100)
    };
    threatAssessment: {
        credibilityScore: number; // 0 - 100% (Rào cản đe dọa thật hay chỉ là Cheap Talk)
        isCheapTalk: boolean;
    };
    stackelberg: {
        role: 'leader' | 'follower'; // Cường giả áp đặt game hay kẻ tuân thủ
        dominantMove: string;
    };
    auctionStrategy: {
        valuationRatio: number; // Mức định giá tài nguyên so với thị trường (vd: 1.2 = sẵn sàng trả vọt 20%)
        biddingTactic: 'aggressor' | 'sniper' | 'cautious_abandon';
    };
}

/**
 * Tính toán ma trận lợi ích theo Lý thuyết trò chơi (Game Theory) nâng cao.
 * Phục vụ cho tư duy chiến lược ALWAYS-ON của mọi NPC/Bạn đồng hành với 5 mô hình chuyên sâu.
 */
export function calculatePayoffWeights(
    kb: KnowledgeBase,
    targetNpc: NPC | Wife | Slave | Prisoner
): PayoffWeights {
    // 1. Phân tích Trust (Niềm tin) & Fear (Sợ hãi)
    let trust = (targetNpc as any).trust !== undefined ? (targetNpc as any).trust : (targetNpc.affinity || 0);
    trust = Math.max(0, Math.min(100, trust));

    let fear = (targetNpc as any).fear !== undefined ? (targetNpc as any).fear : Math.max(0, 100 - (targetNpc.affinity || 0));

    // So sánh thực lực Cảnh giới (Bất cân xứng thông tin)
    const realmSystem = getEffectiveRealmSystem(kb);
    const mcRealm = kb.playerStats.realm || 'Phàm Nhân';
    const npcRealm = targetNpc.realm || 'Phàm Nhân';

    const mcRealmParsed = parseRealm(mcRealm, realmSystem);
    const npcRealmParsed = parseRealm(npcRealm, realmSystem);

    const realmDiff = mcRealmParsed.majorIndex - npcRealmParsed.majorIndex;
    
    if (realmDiff > 0) {
        fear += realmDiff * 20;
    } else if (realmDiff < 0) {
        fear -= Math.abs(realmDiff) * 15;
    }

    // Điều chỉnh dựa trên Tính cách (Personality Traits)
    const traits = targetNpc.personalityTraits || [];
    const isCowardly = traits.some(t => t.includes('Nhát') || t.includes('Né tránh') || t.includes('Hèn') || t.includes('Cẩn trọng'));
    const isBrave = traits.some(t => t.includes('Dũng') || t.includes('Kiên') || t.includes('Ngạo') || t.includes('Tự phụ'));
    const isClever = traits.some(t => t.includes('Xảo') || t.includes('Trí') || t.includes('Cáo') || t.includes('Thâm'));

    if (isCowardly) fear += 15;
    if (isBrave) fear -= 15;

    fear = Math.max(0, Math.min(100, fear));

    // 2. Tính toán Lợi ích (Payoffs) & Zero-Sum
    const powerAsymmetry = (npcRealmParsed.majorIndex - mcRealmParsed.majorIndex) * 10;
    let zeroSumPayoff = (trust - 50) * 0.6 - (fear - 50) * 0.6 + powerAsymmetry;

    let coopPayoff = (trust * 0.8) - (fear * 0.2) + (zeroSumPayoff * 0.4);
    if ((targetNpc as any).faction === 'ally') coopPayoff += 20;
    if ((targetNpc as any).faction === 'enemy') coopPayoff -= 25;

    let exploitPayoff = ((100 - trust) * 0.7) - (fear * 0.9) - (zeroSumPayoff * 0.8);
    const isEvil = traits.some(t => t.includes('Tà') || t.includes('Độc') || t.includes('Xảo') || t.includes('Tham') || t.includes('Tàn nhẫn') || t.includes('Kiêu ngạo'));
    const isGood = traits.some(t => t.includes('Chính') || t.includes('Thiện') || t.includes('Hiền') || t.includes('Thẳng thắn'));
    
    if (isEvil) exploitPayoff += 25;
    if (isGood) exploitPayoff -= 35;
    if ((targetNpc as any).faction === 'enemy') exploitPayoff += 15;

    let fleePayoff = (fear * 1.1) - (trust * 0.3) - (zeroSumPayoff * 0.2);
    if (isCowardly) fleePayoff += 20;
    if (isBrave) fleePayoff -= 20;

    let bestStrategy: 'coop' | 'exploit' | 'flee' = 'coop';
    const maxPayoff = Math.max(coopPayoff, exploitPayoff, fleePayoff);
    if (maxPayoff === exploitPayoff) {
        bestStrategy = 'exploit';
    } else if (maxPayoff === fleePayoff) {
        bestStrategy = 'flee';
    }

    // 3. Phân tích 5 Mô hình Game Theory Nâng Cao:

    // A. Signaling Game (Thẩm định Tín hiệu & Giả heo ăn hổ)
    let signalType: 'authentic' | 'bluff_weakness' | 'bluff_strength' = 'authentic';
    let suspicionLevel = 10;
    if (realmDiff < 0 && (kb.playerStats as any).hiddenRealm) {
        signalType = 'bluff_weakness'; // MC giấu thực lực
        suspicionLevel = isClever ? 80 : 35;
    } else if (realmDiff > 0 && isCowardly) {
        signalType = 'bluff_strength';
        suspicionLevel = 60;
    }

    // B. Repeated Game (Tit-for-Tat & Nợ Ân Oán)
    const gratitudeOrGrudgeScore = (targetNpc.affinity || 0) - (fear > 60 ? 30 : 0);
    let titForTatState: 'cooperative' | 'retaliatory' | 'neutral' = 'neutral';
    if (gratitudeOrGrudgeScore > 20) titForTatState = 'cooperative';
    else if (gratitudeOrGrudgeScore < -20) titForTatState = 'retaliatory';

    // C. Credible Threat & Cheap Talk (Đánh giá Đe dọa)
    let credibilityScore = 50;
    if (realmDiff >= 0) credibilityScore += 35; // MC bằng hoặc hơn cảnh giới
    if ((kb.playerStats as any).reputation && (kb.playerStats as any).reputation > 50) credibilityScore += 20;
    if (realmDiff < -1) credibilityScore -= 40; // MC yếu hơn nhiều cảnh giới
    credibilityScore = Math.max(0, Math.min(100, credibilityScore));
    const isCheapTalk = credibilityScore < 40;

    // D. Stackelberg Game (Lãnh chúa - Kẻ đi trước)
    const isLeader = realmDiff < 0 || (targetNpc as any).isMaster || (targetNpc as any).isBoss;
    const dominantMove = isLeader 
        ? (isEvil ? 'Bố trí thiên la địa võng / Ép giá' : 'Thượng đài phán quyết / Chiêu an')
        : 'Phản ứng theo tình thế / Chờ cơ hội';

    // E. Auction Theory (Đấu giá & Định giá tài nguyên)
    const valuationRatio = isEvil ? 1.3 : (isCowardly ? 0.8 : 1.0);
    let biddingTactic: 'aggressor' | 'sniper' | 'cautious_abandon' = 'cautious_abandon';
    if (valuationRatio > 1.1 && !isCowardly) biddingTactic = 'aggressor';
    else if (isClever) biddingTactic = 'sniper';

    return {
        trust,
        fear,
        payoffs: {
            coop: Math.round(coopPayoff),
            exploit: Math.round(exploitPayoff),
            flee: Math.round(fleePayoff)
        },
        bestStrategy,
        signaling: {
            apparentPower: mcRealm,
            signalType,
            suspicionLevel
        },
        repeatedGame: {
            titForTatState,
            gratitudeOrGrudgeScore
        },
        threatAssessment: {
            credibilityScore,
            isCheapTalk
        },
        stackelberg: {
            role: isLeader ? 'leader' : 'follower',
            dominantMove
        },
        auctionStrategy: {
            valuationRatio,
            biddingTactic
        }
    };
}

