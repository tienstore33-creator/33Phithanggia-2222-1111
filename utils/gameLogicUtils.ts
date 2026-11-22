import {
  KnowledgeBase,
  VectorStore,
  VectorMetadata,
  GameLocation,
  YeuThu,
  PlayerStats,
  NPC,
  Wife,
  Slave,
  Prisoner,
  Master,
} from "../types";
import { generateEmbeddingsWithRetry } from "../services/embeddingService";
import {
  formatPersonForEmbedding,
  formatItemForEmbedding,
  formatSkillForEmbedding,
  formatQuestForEmbedding,
  formatLocationForEmbedding,
  formatFactionForEmbedding,
  formatLoreForEmbedding,
  formatYeuThuForEmbedding,
} from "./ragUtils";
import { normalizeStringForComparison } from "./questUtils";
import * as GameTemplates from "../templates";

export * from "./questUtils";
export * from "./statsCalculationUtils";
export * from "./tagProcessingUtils";
export * from "./turnHistoryUtils";
export * from "./paginationUtils";
export * from "./parseTagValue";
export * from "./vectorStore";
export * from "./ragUtils";
export * from "./yeuThuUtils";
export * from "./itemUtils";

// NPC, YeuThu, and World Info Tag Processors
export * from "./tagProcessors/npcTagProcessor";
export * from "./tagProcessors/yeuThuTagProcessor";
export * from "./tagProcessors/locationTagProcessor";
export * from "./tagProcessors/factionTagProcessor";
export * from "./tagProcessors/worldLoreTagProcessor";
export * from "./tagProcessors/dungeonTagProcessor";
export * from "./tagProcessors/memoryTagProcessor";
export * from "./tagProcessors/fugitiveTagProcessor";

// Other Tag Processors
export * from "./tagProcessors/statusEffectTagProcessor";
export * from "./tagProcessors/professionTagProcessor";
export * from "./npcProgressionUtils";
export * from "./tagProcessors/auctionTagProcessor";
export * from "./tagProcessors/timeTagProcessor";
export * from "./locationEvents";
export * from "./tagProcessors/slaveTagProcessor";
export * from "./avatarUtils";
export * from "./tagProcessors/mainQuestTagProcessor";
export * from "./tagProcessors/milestoneTagProcessor";
export * from "./tagProcessors/relationshipTagProcessor";

// Explicitly re-export to ensure availability
export {
  addTurnHistoryEntryRaw,
  reconstructSnapshotsForExport,
} from "./turnHistoryUtils";
export { performTagProcessing } from "./tagProcessingUtils";
export { processRemoveBinhCanhEffect } from "./tagProcessors/statsTagProcessor";
export { checkFollowerStatus } from "./npcProgressionUtils";

/**
 * Extracts entity names from a string and returns their descriptive contexts.
 */
export const extractEntityContextsFromString = (
  text: string,
  kb: KnowledgeBase,
): string[] => {
  const contexts: string[] = [];
  if (!kb) return contexts;
  const lowerText = text.toLowerCase();

  // Optimized: Filter entities that have higher probability of appearing
  // Priority: Companions, DiscoverdNPCs, Locations, Quests
  const entityCategories = [
    kb.wives,
    kb.slaves,
    kb.prisoners,
    kb.discoveredNPCs,
    kb.allQuests,
    kb.discoveredLocations,
    kb.discoveredFactions,
    kb.worldLore,
    kb.discoveredYeuThu,
    kb.inventory,
    kb.playerSkills
  ];

  if (kb.master) entityCategories.unshift([kb.master]);

  // Use a more efficient approach: only check entities that have at least one word from their name in the text
  // This is a rough heuristic to avoid full check if possible
  for (const list of entityCategories) {
      if (!list) continue;
      for (const entity of list) {
          const entityName = (entity as any).name || (entity as any).title;
          if (!entityName) continue;
          
          const lowerName = entityName.toLowerCase();
          // Fast check: length and simple includes
          if (lowerName.length > 2 && lowerText.includes(lowerName)) {
              let context = "";
              if ("affinity" in entity) {
                context = formatPersonForEmbedding(entity as any);
                if ("lastInteractionTurn" in entity || "affinity" in entity) {
                  (entity as any).lastInteractionTurn = kb.playerStats?.turn || 0;
                }
              } else if ("category" in entity)
                context = formatItemForEmbedding(entity as any);
              else if ("skillType" in entity)
                context = formatSkillForEmbedding(entity as any);
              else if ("status" in entity)
                context = formatQuestForEmbedding(entity as any);
              else if ("locationType" in entity)
                context = formatLocationForEmbedding(entity as any);
              else if ("alignment" in entity)
                context = formatFactionForEmbedding(entity as any);
              else if ("content" in entity)
                context = formatLoreForEmbedding(entity as any);
              else if ("species" in entity)
                context = formatYeuThuForEmbedding(entity as any);

              if (context) contexts.push(context);
              
              // Prevent too many contexts slowing down the AI prompt
              if (contexts.length > 15) return contexts;
          }
      }
  }

  return contexts;
};

/**
 * Trích xuất hàng loạt toàn bộ lịch sử các lượt có nhắc đến một thực thể
 * Lấy tối đa 50 lượt gần nhất và rút xuất toàn bộ chi tiết (Flash Agent memory)
 */
export const extractEntityBatchHistory = (
  text: string,
  kb: KnowledgeBase,
  maxTurns: number = 50
): { hasMentions: boolean; contexts: string[] } => {
  if (!kb) return { hasMentions: false, contexts: [] };
  const contexts: string[] = [];
  const lowerText = text.toLowerCase();
  let hasMentions = false;

  const allEntities = [
    ...kb.discoveredNPCs,
    ...kb.wives,
    ...kb.slaves,
    ...kb.prisoners,
    ...kb.inventory,
    ...(kb.npcInventory || []),
    ...kb.playerSkills,
    ...kb.allQuests,
    ...kb.discoveredLocations,
    ...kb.discoveredFactions,
    ...kb.worldLore,
    ...kb.discoveredYeuThu,
  ];

  if (kb.master) allEntities.push(kb.master);

  // Tìm các thực thể có trong text
  const mentionedEntities = new Map<string, string>();
  allEntities.forEach((entity) => {
    const entityName = (entity as any).name || (entity as any).title;
    if (entityName && lowerText.includes(entityName.toLowerCase())) {
        mentionedEntities.set((entity as any).id || entityName, entityName);
        hasMentions = true;
    }
  });

  if (!hasMentions) {
     return { hasMentions: false, contexts: [] };
  }

  // Quét vector store metadata (Flash agent memory của các lượt)
  if (!kb || !kb.ragVectorStore || !kb.ragVectorStore.metadata) {
      return { hasMentions, contexts };
  }

  const turnMetadatas = kb.ragVectorStore.metadata.filter((m: any) => m.entityType === 'turn' && m.text && m.turn !== undefined);
  // Sort descending by turn
  turnMetadatas.sort((a: any, b: any) => b.turn - a.turn);
  
  const selectedTurns = new Set<number>();
  const results: string[] = [];

  for (const meta of turnMetadatas) {
      if (selectedTurns.size >= maxTurns) break;
      
      const turnLowerText = meta.text.toLowerCase();
      let match = false;
      for (const [_, entityName] of mentionedEntities.entries()) {
          if (turnLowerText.includes(entityName.toLowerCase())) {
              match = true;
              break;
          }
      }

      if (match) {
          selectedTurns.add(meta.turn);
          results.push(meta.text);
      }
  }

  results.reverse(); // Đảo lại theo thứ tự thời gian (từ cũ đến mới)
  return { hasMentions, contexts: results };
};

/**
 * Detects if a text implies a combat situation.
 */
export const detectImplicitCombat = (
  text: string,
  kb: KnowledgeBase,
): { suspected: boolean; mentionedHostileIds: string[] } => {
  const combatKeywords = [
    "combat_trigger",
    "BEGIN_COMBAT",
    "tấn công",
    "chiến đấu",
    "vung kiếm",
    "đại đao",
    "xung phong",
    "ra đòn",
    "kẻ địch",
    "đối thủ",
    "giao chiến",
    "hỗn chiến",
    "sát khí",
    "rút kiếm",
    "vận công",
    "pháp thuật",
    "chiêu thức",
    "nhảy xổ vào",
    "ngăn cản",
    "bao vây",
    "khiêu khích",
    "thi đấu",
    "thách đấu",
    "so tài",
    "ra tay",
    "truy sát",
    "mai phục",
    "đột kích",
    "tung chiêu",
    "phóng",
    "chém",
    "đâm",
    "phát nổ",
    "thiên kiếp",
    "yêu thú xuất hiện",
    "ma thú",
    "quái vật",
    "quyết chiến",
    "tử chiến",
    "lôi đài",
    "đấu trường",
  ];
  const lowerText = text.toLowerCase();
  const suspected = combatKeywords.some((keyword) =>
    lowerText.includes(keyword.toLowerCase()),
  );

  const mentionedHostileIds: string[] = [];
  if (suspected) {
    // Simple logic: find mentioned NPCs/YeuThu that might be enemies
    [...kb.discoveredNPCs, ...kb.discoveredYeuThu].forEach((entity) => {
      if (lowerText.includes(entity.name.toLowerCase())) {
        mentionedHostileIds.push(entity.id);
      }
    });
  }

  return { suspected, mentionedHostileIds };
};

/**
 * Vectorizes the entire KnowledgeBase for RAG.
 */
export const vectorizeKnowledgeBase = async (
  kb: KnowledgeBase,
): Promise<VectorStore> => {
  const store: VectorStore = { vectors: [], metadata: [] };
  const itemsToVectorize: { text: string; metadata: any }[] = [];

  // 1. Entities
  kb.discoveredNPCs.forEach((npc) =>
    itemsToVectorize.push({
      text: formatPersonForEmbedding(npc),
      metadata: { entityId: npc.id, entityType: "npc" },
    }),
  );
  kb.wives.forEach((wife) =>
    itemsToVectorize.push({
      text: formatPersonForEmbedding(wife),
      metadata: { entityId: wife.id, entityType: "wife" },
    }),
  );
  kb.slaves.forEach((slave) =>
    itemsToVectorize.push({
      text: formatPersonForEmbedding(slave),
      metadata: { entityId: slave.id, entityType: "slave" },
    }),
  );
  kb.prisoners.forEach((prisoner) =>
    itemsToVectorize.push({
      text: formatPersonForEmbedding(prisoner),
      metadata: { entityId: prisoner.id, entityType: "prisoner" },
    }),
  );
  if (kb.master)
    itemsToVectorize.push({
      text: formatPersonForEmbedding(kb.master),
      metadata: { entityId: kb.master.id, entityType: "master" },
    });

  // 2. World
  kb.discoveredLocations.forEach((loc) =>
    itemsToVectorize.push({
      text: formatLocationForEmbedding(loc),
      metadata: { entityId: loc.id, entityType: "location" },
    }),
  );
  kb.discoveredFactions.forEach((fac) =>
    itemsToVectorize.push({
      text: formatFactionForEmbedding(fac),
      metadata: { entityId: fac.id, entityType: "faction" },
    }),
  );
  kb.worldLore.forEach((lore) =>
    itemsToVectorize.push({
      text: formatLoreForEmbedding(lore),
      metadata: { entityId: lore.id, entityType: "lore" },
    }),
  );
  kb.discoveredYeuThu.forEach((yt) =>
    itemsToVectorize.push({
      text: formatYeuThuForEmbedding(yt),
      metadata: { entityId: yt.id, entityType: "yeuthu" },
    }),
  );

  // 3. Player Assets
  kb.inventory.forEach((item) =>
    itemsToVectorize.push({
      text: formatItemForEmbedding(item),
      metadata: { entityId: item.id, entityType: "item" },
    }),
  );
  if (kb.npcInventory) {
    kb.npcInventory.forEach((item) =>
      itemsToVectorize.push({
        text: formatItemForEmbedding(item),
        metadata: { entityId: item.id, entityType: "item" },
      }),
    );
  }
  kb.playerSkills.forEach((skill) =>
    itemsToVectorize.push({
      text: formatSkillForEmbedding(skill),
      metadata: { entityId: skill.id, entityType: "skill" },
    }),
  );
  kb.allQuests.forEach((quest) =>
    itemsToVectorize.push({
      text: formatQuestForEmbedding(quest),
      metadata: { entityId: quest.id, entityType: "quest" },
    }),
  );

  if (itemsToVectorize.length === 0) return store;

  const texts = itemsToVectorize.map((i) => i.text);
  const vectors = await generateEmbeddingsWithRetry(texts);

  store.vectors = vectors;
  store.metadata = itemsToVectorize.map((item, idx) => ({
    ...item.metadata,
    text: item.text,
  }));

  return store;
};

import { GameMessage } from '../types';


