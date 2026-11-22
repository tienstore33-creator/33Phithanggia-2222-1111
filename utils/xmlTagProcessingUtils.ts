import { KnowledgeBase, GameMessage } from '../types';
import { parseXmlUpdatesToLegacyTags } from './xmlUpdateParser';
import { performTagProcessing } from './tagProcessingUtils';

/**
 * Orchestrator for processing XML-based game updates.
 * Parses XML tags from raw narrative response and processes them via the legacy tag processing core.
 */
export const performXmlUpdateProcessing = async (
  currentKb: KnowledgeBase,
  rawText: string,
  turn: number,
  logNpcAvatarPromptCallback?: (prompt: string) => void
): Promise<{
  newKb: KnowledgeBase;
  turnIncrementedByTag: boolean;
  systemMessagesFromTags: GameMessage[];
  realmChangedByTag: boolean;
  appliedBinhCanhViaTag: boolean;
  removedBinhCanhViaTag: boolean;
  affinityChanges: { name: string, delta: number }[];
  mapNeedsLayout: boolean;
  tagErrors?: { originalTag: string; tagName: string; reason: string }[];
  unrecognizedTags: string[];
}> => {
  if (!currentKb) {
    console.error("performXmlUpdateProcessing called with null currentKb!");
    return {
      newKb: {} as KnowledgeBase,
      turnIncrementedByTag: false,
      systemMessagesFromTags: [],
      realmChangedByTag: false,
      appliedBinhCanhViaTag: false,
      removedBinhCanhViaTag: false,
      affinityChanges: [],
      mapNeedsLayout: false,
      tagErrors: [],
      unrecognizedTags: []
    };
  }

  // 1. Convert XML tags inside <update_data> to legacy [TAG] format
  const legacyTags = parseXmlUpdatesToLegacyTags(rawText);
  
  console.log(`[XML Processing] Parsed XML updates to ${legacyTags.length} legacy tags:`, legacyTags);

  // 2. Call the existing core tag processor with the translated tags
  return await performTagProcessing(
    currentKb,
    legacyTags,
    turn,
    logNpcAvatarPromptCallback
  );
};
