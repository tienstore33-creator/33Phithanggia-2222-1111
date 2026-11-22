import { AnalyzedCombatant, KnowledgeBase, NPC } from '../types';
import { calculateRealmBaseStats } from '../utils/statsCalculationUtils';

export interface InferredCombatantProfile {
    inferredIdentity: string;     // Định danh / Lai lịch suy luận
    inferredRealm: string;        // Tu vi / Cảnh giới suy luận
    race: string;                 // Chủng tộc (Nhân Tộc, Yêu Tộc, Ma Tộc...)
    gender: string;               // Giới tính
    powerMultiplier: number;     // Hệ số nhân sức mạnh
}

export class CombatIdentityInferenceService {
    /**
     * Suy luận và chuẩn hóa tu vi/cảnh giới từ kết quả phân tích AI
     */
    public static resolveInferredRealm(analyzed: AnalyzedCombatant, kb: KnowledgeBase): string {
        if (analyzed.realm && analyzed.realm.trim() !== '') {
            return analyzed.realm.trim();
        }
        return kb.worldRealmBase || 'Phàm Nhân';
    }

    /**
     * Xây dựng hồ sơ định danh chi tiết cho NPC chiến đấu mới
     */
    public static createInferredProfile(analyzed: AnalyzedCombatant, kb: KnowledgeBase): InferredCombatantProfile {
        const realm = this.resolveInferredRealm(analyzed, kb);
        return {
            inferredIdentity: analyzed.identityReasoning || `Thực thể chiến đấu (${analyzed.name})`,
            inferredRealm: realm,
            race: analyzed.race || 'Nhân Tộc',
            gender: analyzed.gender || 'Không rõ',
            powerMultiplier: Number(analyzed.powerLevel) || 1.0
        };
    }

    /**
     * Áp dụng chỉ số chuẩn từ Tu vi suy luận vào NPC chiến đấu
     */
    public static applyInferredStatsToNPC(npc: NPC, profile: InferredCombatantProfile, kb: KnowledgeBase): void {
        const baseStats = calculateRealmBaseStats(profile.inferredRealm, kb);
        const scale = profile.powerMultiplier;

        npc.realm = profile.inferredRealm;
        npc.race = profile.race;
        npc.gender = profile.gender as any;
        npc.description = `${npc.description || ''}\n[Suy luận định danh]: ${profile.inferredIdentity}`.trim();

        npc.stats = {
            ...npc.stats,
            realm: profile.inferredRealm,
            baseMaxSinhLuc: Math.floor((baseStats.baseMaxSinhLuc || 100) * scale),
            maxSinhLuc: Math.floor((baseStats.baseMaxSinhLuc || 100) * scale),
            sinhLuc: Math.floor((baseStats.baseMaxSinhLuc || 100) * scale),
            baseMaxLinhLuc: Math.floor((baseStats.baseMaxLinhLuc || 50) * scale),
            maxLinhLuc: Math.floor((baseStats.baseMaxLinhLuc || 50) * scale),
            linhLuc: Math.floor((baseStats.baseMaxLinhLuc || 50) * scale),
            baseSucTanCong: Math.floor((baseStats.baseSucTanCong || 10) * scale),
            sucTanCong: Math.floor((baseStats.baseSucTanCong || 10) * scale)
        };
    }
}
