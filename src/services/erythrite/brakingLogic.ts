import { CharacterStats } from '../../types';

/**
 * Quy trình "Hãm Phanh" (Narrative Braking) theo Giao thức Erythrite.
 * Ngăn chặn việc nhảy bổ vào giai đoạn 'RELEASE' khi các chỉ số chưa đủ ngưỡng.
 */
export function applyErythriteBraking(choice: string, npcStats: CharacterStats | undefined): 'TEASING' | 'RELEASE' | null {
    if (!npcStats) return null;

    // Tìm kiếm các chỉ số Lust và Corruption trong mảng stats của NPC
    const lustStat = parseFloat(npcStats['Dục Vọng']?.description.match(/\d+/)?.[0] || "0") || (npcStats['Lust'] ? 50 : 0); // Fallback logic
    const corruptionStat = parseFloat(npcStats['Tha Hóa']?.description.match(/\d+/)?.[0] || "0") || (npcStats['Corruption'] ? 50 : 0);

    const isExplicitlyNSFW = /địt|đụ|chịch|lồn|cặc|liếm|bú|nắc|giao hợp|quan hệ|làm tình/i.test(choice);

    if (isExplicitlyNSFW) {
        // Ngưỡng hãm phanh: Lust < 50 và Corruption < 30
        if (lustStat < 50 && corruptionStat < 30) {
            return 'TEASING';
        }
        return 'RELEASE';
    }

    return null;
}
