
import { KnowledgeBase, GameMessage } from '../../types';

/**
 * Process the [LOCATION_SAFETY: safe|danger] tag.
 * This tag is used by the AI to dynamically override the safety status of the current location.
 */
export const processLocationSafety = (
    currentKb: KnowledgeBase,
    tagParams: Record<string, string>,
    turnNumber: number
): { updatedKb: KnowledgeBase; systemMessages: GameMessage[] } => {
    const newKb = currentKb;
    const systemMessages: GameMessage[] = [];

    const status = tagParams.status?.toLowerCase();

    if (status === 'safe' || status === 'danger') {
        newKb.currentLocationSafetyOverride = status as 'safe' | 'danger';
        newKb.lastSafetyAssessmentTurn = turnNumber;
        
        console.log(`[SAFETY-ASSESSMENT] AI assessed current location as: ${status.toUpperCase()} (Turn ${turnNumber})`);
    } else {
        console.warn("LOCATION_SAFETY: Invalid status provided. Expected 'safe' or 'danger'.", tagParams);
    }

    return { updatedKb: newKb, systemMessages };
};
