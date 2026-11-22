import { GoogleGenAI } from '@google/genai';
import { WorldCreationState, GameState, GameTurn, NPCUpdate, CharacterStatUpdate, NPC, Skill, LustModeFlavor, NpcMindset, DestinyCompassMode, StatChanges, CharacterStats, EntityTarget } from '../types';
import * as client from './gemini/client';
import * as prompts from './prompt-engineering/corePrompts';
import { getPerspectiveRules } from './prompt-engineering/perspectiveRules';
import { getSituationalRules } from './prompt-engineering/situationalRules';
import { generateAftermathUpdates } from './erythrite/aftermathModule';
import { ERYTHRITE_THINKING_INSTRUCTIONS } from './erythrite/corePrompts';

export async function continueStory(
    gameState: GameState, 
    choice: string, 
    geminiService: GoogleGenAI, 
    isLogicModeOn: boolean, 
    lustModeFlavor: LustModeFlavor | null, 
    npcMindset: NpcMindset, 
    isConscienceModeOn: boolean, 
    isRewrite: boolean,
    isCorrection: boolean
): Promise<{
    newTurn: GameTurn;
    playerStatChanges: StatChanges;
    npcUpdates: NPCUpdate[];
    summaryText: string;
}> {
    const { narrativePerspective, isNsfw } = gameState.worldContext;
    const perspectiveRules = getPerspectiveRules(narrativePerspective);
    
    // Tìm NPC mục tiêu
    const targetNpc = gameState.npcs[0]; 

    const situationalRules = getSituationalRules(
        choice,
        isConscienceModeOn,
        lustModeFlavor,
        npcMindset,
        targetNpc?.stats,
        isCorrection
    );

    const fullPrompt = `${prompts.CORE_LOGIC_SYSTEM_PROMPT}\n${perspectiveRules}\n${situationalRules}\n\n${ERYTHRITE_THINKING_INSTRUCTIONS}\n\nHành động: ${choice}`;

    const coreResult = await client.callJsonAI(fullPrompt, {}, geminiService, isNsfw);
    const coreResponse = client.parseAndValidateJsonResponse(coreResult.text || "{}");

    // AFTERMATH: Tự động cập nhật chỉ số sau RELEASE
    let npcUpdates = coreResponse.npcUpdates || [];
    if (situationalRules.includes('RELEASE') && targetNpc) {
        const aftermath = generateAftermathUpdates(targetNpc.id, targetNpc.name, true);
        npcUpdates.push(aftermath);
    }

    return {
        newTurn: { 
            playerAction: choice, 
            storyText: coreResponse.storyText || "AI không tạo lời kể.", 
            characterExpressionId: coreResponse.characterExpressionId,
            choices: coreResponse.choices || []
        },
        playerStatChanges: coreResponse.playerStatChanges || { statsToUpdate: [], statsToDelete: [] },
        npcUpdates,
        summaryText: coreResponse.summaryText || ""
    };
}
