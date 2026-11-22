import { useMemo } from 'react';
import { GameMessage } from '../types';

export const useStoryPagination = (messages: GameMessage[], isCurrentlyActivePage: boolean, maxTurns: number = 5) => {
    return useMemo(() => {
        if (!isCurrentlyActivePage || !messages || messages.length === 0) {
            return { visibleMessages: messages || [], hiddenCount: 0 };
        }

        // Identify turn messages (narration or player_action)
        const turnIndices: number[] = [];
        messages.forEach((m, idx) => {
            if (m.type === 'narration' || m.type === 'player_action') {
                turnIndices.push(idx);
            }
        });

        // The user wants strictly the last 5 turns
        if (turnIndices.length <= maxTurns) {
            return { visibleMessages: messages, hiddenCount: 0 };
        }

        // Calculate how many turns to hide
        const hiddenTurnCount = turnIndices.length - maxTurns;
        // The index of the first turn to show
        const firstVisibleTurnId = turnIndices[hiddenTurnCount];
        const firstVisibleTurnNumber = messages[firstVisibleTurnId].turnNumber;

        // Filter messages: 
        // Keep only messages from the turn number of the oldest turn in our window onwards.
        // This ensures system messages associated with these 5 turns are kept.
        const visibleMessages = messages.filter((m) => {
            // If the message has no turnNumber (unlikely but safe), we might hide it if it's old.
            // But usually we filter by turnNumber to keep groups together.
            return m.turnNumber >= firstVisibleTurnNumber;
        });

        return { visibleMessages, hiddenCount: hiddenTurnCount };
    }, [messages, isCurrentlyActivePage, maxTurns]);
};
