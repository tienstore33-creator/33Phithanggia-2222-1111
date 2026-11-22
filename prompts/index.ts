
import { generateInitialPrompt } from './initialPrompt';
// FIX: Corrected imported member name from generateNextTurnPrompt to generateContinuePrompt to match exports in continuePrompt.ts
import { generateContinuePrompt } from './continuePrompt'; 
import { generateWorldDetailsPrompt } from './generateWorldDetailsPrompt';
import { generateFanfictionWorldDetailsPrompt } from './generateFanfictionWorldDetailsPrompt';
import { generateCraftItemPrompt } from './craftItemPrompt';
import { generateCombatTurnPrompt } from './combatPrompt';
import { generateSummarizeCombatPrompt } from './summarizeCombatPrompt';
import { generateDefeatConsequencePrompt } from './defeatConsequencePrompt';
import { generateVictoryConsequencePrompt } from './victoryConsequencePrompt';
import { generateNonCombatDefeatConsequencePrompt } from './nonCombatDefeatConsequencePrompt';
import { generateAuctionDataPrompt } from './generateAuctionDataPrompt';
import { runAuctionTurnPrompt } from './runAuctionTurnPrompt';
import { generateEconomyLocationsPrompt } from './generateEconomyLocationsPrompt';
import { generateGeneralSubLocationsPrompt } from './generateGeneralSubLocationsPrompt';
import { runAuctioneerCallPrompt } from './runAuctioneerCallPrompt';
import { generateFindLocationPrompt } from './findLocationPrompt';
import { generateEcoZoneContentPrompt } from './generateEcoZoneContentPrompt';
import { generateCultivationSessionPrompt } from './cultivationPrompt';
import { generateCompanionInteractionPrompt } from './companionInteractionPrompt';
import { generatePrisonerInteractionPrompt } from './prisonerInteractionPrompt';
import { generateSummarizeCompanionInteractionPrompt } from './summarizeCompanionInteractionPrompt';
import { generateSummarizePrisonerInteractionPrompt } from './summarizePrisonerInteractionPrompt';
import { generateRestockVendorPrompt } from './restockVendorPrompt';
import { generateContinuePrisonPrompt } from './continueprisonPrompt';
import { generateSlaveAuctionDataPrompt } from './generateSlaveAuctionDataPrompt';
import { runSlaveAuctionTurnPrompt } from './runSlaveAuctionTurnPrompt';
import { runSlaveAuctioneerCallPrompt } from './runSlaveAuctioneerCallPrompt';
import { generateCompletionPrompt } from './completeWorldDetailsPrompt';
import { generateRewriteWorldSettingsPrompt } from './rewriteWorldSettingsPrompt';
import { generateTravelPrompt } from './travelPrompt'; 
import { generateChallengeContextPrompt } from './challengeContextPrompt';
import { assignNpcToFactionPrompt } from './assignNpcFactionPrompt';
import { generateFactionEventPrompt } from './generateFactionEventPrompt';
import { generateWorldEnvironmentEventPrompt } from './generateWorldEnvironmentEventPrompt';
import { generateWorldEventPrompt } from './generateWorldEventPrompt';
import { generateDungeonPrompt } from './dungeonPrompt';
import { generateTimeSkipSummaryPrompt } from './timeSkipSummaryPrompt';
import { generateSummarizeCultivationPrompt } from './summarizeCultivationPrompt';
import { analyzeCombatantsPrompt } from './analyzeCombatantsPrompt';
import { generateTagExtractionPrompt, generateTagAndMemoryExtractionPrompt } from './tagExtractionPrompt';
import { generateTimelineEventsPrompt } from './generateTimelineEventsPrompt';
import { appendTimelineEventsPrompt } from './appendTimelineEventsPrompt';
import { reorganizeMapPrompt } from './reorganizeMapPrompt';

// Export Constants
export * from './loinhacprompt';
export * from './loinhacprompt2'; // NEW EXPORT
export * from './skillTagPrompt';
export * from './postCombatIdentityPrompt';
export * from './userPromptsHelper';

export const PROMPT_FUNCTIONS = {
  initial: (worldConfig: any, perspectiveMode: any, exclusiveMode: boolean = false, isSuperManualMode: boolean = false) => {
      return generateInitialPrompt(worldConfig, perspectiveMode, exclusiveMode, isSuperManualMode);
  },
  // FIX: Replaced 'require' with the correctly imported 'generateContinuePrompt' to resolve 'require' is not defined error and use the available export.
  continue: (knowledgeBase: any, playerAction: any, inputType: any, responseLength: any, currentPageMessagesLog: any, previousPageSummaries: any, narrationMin: number, narrationMax: number, lastNarrationFromPreviousPage: any, retrievedContext: any, perspectiveMode: any, exclusiveMode: boolean = false, exclusiveSections: any = undefined, isSuperManualMode: boolean = false) => {
      // Logic for selecting prompt function based on special status is handled in geminiService
      // but the base function is usually generateContinuePrompt.
      if (knowledgeBase.playerStats.playerSpecialStatus) {
        return generateContinuePrisonPrompt(knowledgeBase, playerAction, inputType, responseLength, currentPageMessagesLog, previousPageSummaries, narrationMin, narrationMax, lastNarrationFromPreviousPage, retrievedContext, perspectiveMode, exclusiveMode, exclusiveSections, isSuperManualMode);
      }
      return generateContinuePrompt(knowledgeBase, playerAction, inputType, responseLength, currentPageMessagesLog, previousPageSummaries, narrationMin, narrationMax, lastNarrationFromPreviousPage, retrievedContext, perspectiveMode, exclusiveMode, exclusiveSections, isSuperManualMode);
  },
  generateWorldDetails: generateWorldDetailsPrompt,
  generateFanfictionWorldDetails: generateFanfictionWorldDetailsPrompt,
  craftItem: generateCraftItemPrompt,
  combatTurn: generateCombatTurnPrompt,
  summarizeCombat: generateSummarizeCombatPrompt,
  generateDefeatConsequence: generateDefeatConsequencePrompt,
  generateVictoryConsequence: generateVictoryConsequencePrompt,
  generateNonCombatDefeatConsequence: generateNonCombatDefeatConsequencePrompt,
  generateAuctionData: generateAuctionDataPrompt,
  runAuctionTurn: runAuctionTurnPrompt,
  runAuctioneerCall: runAuctioneerCallPrompt,
  generateEconomyLocations: generateEconomyLocationsPrompt,
  generateGeneralSubLocations: generateGeneralSubLocationsPrompt,
  generateEcoZoneDetails: generateEcoZoneContentPrompt,
  findLocation: generateFindLocationPrompt,
  cultivationSession: (kb: any, type: any, duration: any, pageLog: any, summaries: any, lastNarration: any, skill?: any, method?: any, partner?: any, exclusiveMode: boolean = false) => {
      return generateCultivationSessionPrompt(kb, type, duration, pageLog, summaries, lastNarration, skill, method, partner, exclusiveMode);
  },
  summarizeCultivationSession: generateSummarizeCultivationPrompt,
  companionInteraction: (kb: any, companion: any, action: any, pageLog: any, summaries: any, lastNarration: any, perspectiveMode: any, exclusiveMode: boolean = false) => {
      return generateCompanionInteractionPrompt(kb, companion, action, pageLog, summaries, lastNarration, perspectiveMode, exclusiveMode);
  },
  prisonerInteraction: (kb: any, prisoner: any, action: any, pageLog: any, summaries: any, lastNarration: any, retrievedContext: any, perspectiveMode: any, exclusiveMode: boolean = false) => {
      return generatePrisonerInteractionPrompt(kb, prisoner, action, pageLog, summaries, lastNarration, retrievedContext, perspectiveMode, exclusiveMode);
  },
  summarizeCompanionInteraction: generateSummarizeCompanionInteractionPrompt,
  summarizePrisonerInteraction: generateSummarizePrisonerInteractionPrompt,
  restockVendor: generateRestockVendorPrompt,
  continuePrison: (knowledgeBase: any, playerAction: any, inputType: any, responseLength: any, currentPageMessagesLog: any, previousPageSummaries: any, narrationMin: number, narrationMax: number, lastNarrationFromPreviousPage: any, retrievedContext: any, perspectiveMode: any, exclusiveMode: boolean = false, exclusiveSections: any = undefined, isSuperManualMode: boolean = false) => {
      return generateContinuePrisonPrompt(knowledgeBase, playerAction, inputType, responseLength, currentPageMessagesLog, previousPageSummaries, narrationMin, narrationMax, lastNarrationFromPreviousPage, retrievedContext, perspectiveMode, exclusiveMode, exclusiveSections, isSuperManualMode);
  },
  generateSlaveAuctionData: generateSlaveAuctionDataPrompt, 
  runSlaveAuctionTurn: runSlaveAuctionTurnPrompt, 
  runSlaveAuctioneerCall: runSlaveAuctioneerCallPrompt, 
  completeWorldDetails: generateCompletionPrompt,
  rewriteWorldSettings: generateRewriteWorldSettingsPrompt,
  travel: generateTravelPrompt, 
  challengeContext: generateChallengeContextPrompt,
  assignNpcToFaction: assignNpcToFactionPrompt,
  generateFactionEvent: generateFactionEventPrompt,
  generateWorldEnvironmentEvent: generateWorldEnvironmentEventPrompt,
  generateWorldEvent: generateWorldEventPrompt,
  dungeon: generateDungeonPrompt,
  timeSkipSummary: generateTimeSkipSummaryPrompt,
  analyzeCombatants: analyzeCombatantsPrompt,
  tagExtraction: generateTagExtractionPrompt,
  tagAndMemoryExtraction: generateTagAndMemoryExtractionPrompt,
  generateTimelineEvents: generateTimelineEventsPrompt,
  appendTimelineEvents: appendTimelineEventsPrompt,
  reorganizeMap: reorganizeMapPrompt,
};

export type PromptFunctionsType = typeof PROMPT_FUNCTIONS;
