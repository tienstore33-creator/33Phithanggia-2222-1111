import { GameMessage, NPC } from '../types';

/**
 * Trích xuất NPC có mặt trong ngữ cảnh từ hai lượt lời kể gần nhất.
 * @param lastTwoTurns Mảng chứa dữ liệu của hai lượt lời kể cuối cùng.
 * @returns Một Promise trả về danh sách các NPC có thể tham chiến, kèm trạng thái và thái độ.
 */
export const getContextualNpcs = async (lastTwoTurns: GameMessage[]): Promise<NPC[]> => {
    console.log("Starting contextual NPC extraction...");
    
    // TODO: Implement actual API call to analyze context.
    // This might involve sending lastTwoTurns to a backend service or a dedicated AI model.
    // The analysis should identify NPCs explicitly mentioned as present or acting.
    
    // Placeholder for demonstration:
    const placeholderNpcs: NPC[] = [];

    // Example of how you might filter based on hypothetical analysis:
    // lastTwoTurns.forEach(turn => {
    //     // Logic to extract NPCs from turn.content
    // });

    console.log(`Contextual NPC extraction complete. Found ${placeholderNpcs.length} potential NPCs.`);
    return placeholderNpcs;
};
