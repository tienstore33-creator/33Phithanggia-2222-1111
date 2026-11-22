import { NPCUpdate, StatChanges, StatType } from '../../types';

/**
 * Xử lý các thay đổi chỉ số sau một cảnh Release (Dư âm).
 */
export function generateAftermathUpdates(npcId: string, npcName: string, isConsensual: boolean): NPCUpdate {
    const statsToUpdate: any[] = [
        {
            name: "Thỏa Mãn Nhục Dục",
            description: "Vừa trải qua một cuộc mây mưa nồng cháy.",
            effect: "Giảm toàn bộ Lust hiện có về trạng thái cân bằng. NPC cảm thấy lười biếng và thư giãn.",
            source: "Aftermath của Giao thức Erythrite",
            cure: "Tự hết sau 3 lượt.",
            type: StatType.GOOD,
            duration: 3
        },
        {
            name: "Dấu Ấn Tha Hóa",
            description: "Tâm trí đã lún sâu hơn vào vũng bùn dục vọng.",
            effect: "Tăng vĩnh viễn chỉ số Corruption ngầm. Lăng kính nhìn thế giới của NPC trở nên mờ đục hơn.",
            source: "Sự thăng hoa thể xác",
            cure: "Không có",
            type: StatType.NSFW
        }
    ];

    const statsToDelete = ["Lust", "Dục Vọng", "Arousal", "Khao khát"];

    return {
        action: 'UPDATE',
        id: npcId,
        payload: {
            statsChanges: {
                statsToUpdate,
                statsToDelete
            }
        }
    };
}
