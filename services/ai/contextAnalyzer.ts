import { NPC, KnowledgeBase } from "../../types";

/**
 * Core 1 (Analyzer): Filters relevant NPCs based on recent history locally
 * to guarantee no redundant external API calls are made.
 * It is now fully merged and performed locally.
 */
export const analyzeActiveContext = async (
    history: string,
    allNpcs: NPC[],
    kb: KnowledgeBase
): Promise<NPC[]> => {
    if (!allNpcs || allNpcs.length === 0) return [];
    
    console.log("[ContextAnalyzer] Filter NPC locally to eliminate extra API calls.");
    const historyLower = (history || "").toLowerCase();
    
    // Filter by same location, name mentioned, or high/low affinity
    return allNpcs.filter(n => {
        const isInSameLocation = n.locationId === kb.currentLocationId;
        const isMentioned = n.name && historyLower.includes(n.name.toLowerCase());
        const isSignificantAffinity = Math.abs(n.affinity || 0) >= 40;
        return isInSameLocation || isMentioned || isSignificantAffinity;
    }).slice(0, 10);
};
