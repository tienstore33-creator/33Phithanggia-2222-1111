
import { WorldSettings } from '../../types';
import { FanficWork } from '../../src/types/fanfic';
import { rewriteStartingElementsAI } from '../../services/geminiService';
import { GeminiService } from '../../src/services/geminiService';
import { processStartingItems } from '../../services/ItemStatService';

export const useStartingElementsActions = (
  settings: WorldSettings, 
  setSettings: (updater: (prev: WorldSettings) => WorldSettings) => void,
  selectedWork?: FanficWork | null,
  rawCanonData?: string | null
) => {
  const rewriteStartingElements = async (customPrompt?: string) => {
    try {
      let result;
      if (settings.isStrictGrounding && rawCanonData) {
        const { CanonExtractionService } = await import('../../src/services/CanonExtractionService');
        const extracted = await CanonExtractionService.extractRelevantContext(rawCanonData, 'STARTING_ELEMENTS');
        result = await GeminiService.generateAllStartingElementsFromExtractedContext(extracted, settings.playerName, customPrompt);
      } else {
        result = await rewriteStartingElementsAI(settings, selectedWork, undefined, customPrompt);
      }

      if (result) {
        const majorRealms = settings.cultivationSystem.majorRealmsRaw.split('\n').map(r => r.split('|')[0].trim()).filter(Boolean);
        const processedItems = processStartingItems(result.startingItems || [], majorRealms);

        setSettings(prev => ({
          ...prev,
          startingSkills: result.startingSkills || prev.startingSkills,
          startingItems: processedItems.length > 0 ? processedItems : prev.startingItems,
          startingNPCs: result.startingNPCs || prev.startingNPCs,
          startingYeuThu: result.startingYeuThu || prev.startingYeuThu,
          startingLore: result.startingLore || prev.startingLore,
          startingLocations: result.startingLocations || prev.startingLocations,
          startingFactions: result.startingFactions || prev.startingFactions,
        }));
      }
    } catch (error) {
      console.error("Failed to rewrite starting elements:", error);
      throw error;
    }
  };

  return { rewriteStartingElements };
};
