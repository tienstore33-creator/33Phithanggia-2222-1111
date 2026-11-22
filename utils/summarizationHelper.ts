import { GameMessage } from '../types';

/**
 * Prepares and filters messages for summarization.
 * Implements "Hiệu suất" (Efficiency) by only keeping relevant message types
 * and "Tiết kiệm" (Token saving) by cleaning metadata.
 */
export const prepareMessagesForSummary = (
    messages: GameMessage[],
    startTurn: number,
    endTurn: number
): GameMessage[] => {
    return messages
        .filter(msg => (msg.turnNumber ?? 0) >= startTurn && (msg.turnNumber ?? 0) <= endTurn)
        .filter(msg => ['narration', 'player_action', 'event_summary'].includes(msg.type))
        .map(msg => ({
            id: msg.id,
            type: msg.type,
            content: msg.content,
            timestamp: msg.timestamp,
            turnNumber: msg.turnNumber,
            isPlayerInput: msg.isPlayerInput
        } as GameMessage));
};
