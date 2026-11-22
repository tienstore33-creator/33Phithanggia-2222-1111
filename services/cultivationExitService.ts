
import { KnowledgeBase, GameMessage } from "../types";
import { generateCultivationExitPrompt } from "../prompts/cultivationExitPrompt";
import { callGeminiAPI } from "./apiService";
import { parseAiResponseText } from "./geminiService";
import { DataExtractionService } from "./dataExtractionService";

/**
 * Processes the narrative generation when a player exits cultivation.
 * @param duration The number of days cultivated.
 * @param knowledgeBase The current game state.
 * @param gameMessages The history of game messages.
 * @returns A parsed AI response containing the narrative and any update data.
 */
export const processExitCultivationNarrative = async (
    duration: number,
    knowledgeBase: KnowledgeBase,
    gameMessages: GameMessage[]
) => {
    // 1. Extract history (last 10 turns)
    const history = gameMessages
        .slice(-10)
        .map(m => `${m.type === 'player_action' ? (m.isPlayerInput ? 'Bạn đã làm' : 'Bạn đã chọn') : 'AI kể'}: ${m.content}`)
        .join("\n---\n");

    // 2. Contextual Information (RAG-like)
    const currentLocation = knowledgeBase.discoveredLocations.find(l => l.id === knowledgeBase.currentLocationId);
    const nearbyNpcs = knowledgeBase.discoveredNPCs.filter(n => n.locationId === knowledgeBase.currentLocationId);
    
    const ragContext = `
Địa điểm hiện tại: ${currentLocation?.name || "Không rõ"}
Mô tả địa điểm: ${currentLocation?.description || "Không rõ"}
NPC đang hiện diện tại đây: ${nearbyNpcs.length > 0 ? nearbyNpcs.map(n => n.name).join(", ") : "Không có NPC nào đáng chú ý."}
    `;

    // 3. Generate the specialized prompt
    const genre = knowledgeBase.worldConfig?.genre || "Tu Tiên (Mặc định)";
    const prompt = generateCultivationExitPrompt(duration, history, ragContext, genre);

    // 4. Call the AI service
    // We use 'primary' category for important narrative events to ensure higher quality models if configured.
    const { text: responseText } = await callGeminiAPI(prompt, undefined, 'main');

    // 5. V5: TWO-STEP GENERATION (TAG EXTRACTION)
    const extractedTags = await DataExtractionService.extractTags(responseText, knowledgeBase);

    // 6. Parse and return the response
    const parsed = parseAiResponseText(responseText);
    return { ...parsed, rawText: responseText, extractedTags };
};
