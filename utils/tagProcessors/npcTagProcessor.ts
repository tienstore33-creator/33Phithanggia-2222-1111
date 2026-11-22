import React from "react";
import {
  KnowledgeBase,
  GameMessage,
  NPC,
  VectorMetadata,
  ItemCategoryValues,
  PlayerStats,
  Skill,
  BatchSummaryRequestItem,
} from "../../types";
import {
  TU_CHAT_TIERS,
  MALE_AVATAR_PLACEHOLDER_URL,
  FEMALE_AVATAR_BASE_URL,
  MAX_FEMALE_AVATAR_INDEX,
  DEFAULT_MORTAL_STATS,
  SUB_REALM_NAMES,
  VIETNAMESE,
} from "../../constants";
import {
  calculateRealmBaseStats,
  updateEntityStatsFromRealm,
} from "../statsCalculationUtils";
import {
  getEffectiveRealmSystem,
  realmManager,
} from "../../services/realmManager";
import {
  getApiSettings,
  generateImageUnified,
  summarizeEndOfDescription,
} from "../../services/geminiService";
import { RealmParserService } from "../../services/RealmParserService";
import { uploadImageToCloudinary } from "../../services/cloudinaryService";
import { diceCoefficient, normalizeStringForComparison } from "../questUtils";
import { sanitizeJson } from "../attributeParser";
import * as GameTemplates from "../../templates";
import { formatPersonForEmbedding } from "../ragUtils";
import { resolveDynamicLevel, getSystemConfig } from "../levelUtils";
import { NpcRealmMappingService } from "../../services/ai/NpcRealmMappingService";
import { generateWuxiaAvatarPrompt } from "../avatarPromptGen";
import { calculateNumericValue } from "../numericLogic";
import { calculateDiminishingAffinity } from "../affinityCalculator";
import { appendFormattedDescription } from "../tagUtils";
import { SacredTimelineService, extractLastQuote } from "../../services/SacredTimelineService";
import { resolveNpcEntity } from "../npcIdentityResolver";

const SIMILARITY_THRESHOLD = 0.8;

// Helper to resolve location name to ID
const resolveLocationId = (
  kb: KnowledgeBase,
  providedLocationIdentifier: string | undefined,
): string | undefined => {
  if (!providedLocationIdentifier) return undefined;

  // 1. Check if it matches an existing ID exactly
  if (kb.discoveredLocations.some((l) => l.id === providedLocationIdentifier)) {
    return providedLocationIdentifier;
  }

  // 2. Check if it matches a Location Name exactly (case-insensitive)
  const exactNameMatch = kb.discoveredLocations.find(
    (l) => l.name.toLowerCase() === providedLocationIdentifier.toLowerCase(),
  );
  if (exactNameMatch) {
    return exactNameMatch.id;
  }

  // 3. Fuzzy match name
  let bestMatch = { id: "", score: 0 };
  const normalizedInput = normalizeStringForComparison(
    providedLocationIdentifier,
  );

  kb.discoveredLocations.forEach((loc) => {
    const score = diceCoefficient(
      normalizedInput,
      normalizeStringForComparison(loc.name),
    );
    if (score > bestMatch.score) {
      bestMatch = { id: loc.id, score };
    }
  });

  if (bestMatch.score >= 0.8) {
    return bestMatch.id;
  }

  return providedLocationIdentifier; // Return original if no better match found (fallback)
};

export const processNpc = async (
  currentKb: KnowledgeBase,
  tagParams: Record<string, string>,
  turnForSystemMessages: number,
  logNpcAvatarPromptCallback?: (prompt: string) => void,
): Promise<{
  updatedKb: KnowledgeBase;
  systemMessages: GameMessage[];
  newVectorMetadata?: VectorMetadata;
}> => {
  if (!currentKb) {
      console.error("processNpc called with null KnowledgeBase!");
      return { updatedKb: {} as KnowledgeBase, systemMessages: [] };
  }
  const newKb = currentKb;
  const systemMessages: GameMessage[] = [];
  let newVectorMetadata: VectorMetadata | undefined = undefined;

  const name = tagParams.name;
  const description = tagParams.description || tagParams.details || "";
  const title = tagParams.title || "";
  const personality = tagParams.personality;
  const affinity = parseInt(
    tagParams.initialAffinity || tagParams.affinity || "0",
    10,
  );
  const factionId = tagParams.factionId;
  const gender =
    (tagParams.gender as "Nam" | "Nữ" | "Khác" | "Không rõ") || "Không rõ";
  const race = tagParams.race || "Nhân Tộc";
  const relationshipToPlayer = tagParams.relationshipToPlayer;
  const aiSuggestedAvatarUrl = tagParams.avatarUrl;
  const tuChat = tagParams.tuChat as any;
  const spiritualRoot = tagParams.spiritualRoot;
  const specialPhysique = tagParams.specialPhysique;
  const pride = tagParams.pride !== undefined ? parseInt(tagParams.pride, 10) : 50;
  const survivalInstinct = tagParams.survivalInstinct;
  const resentmentCounter = tagParams.resentmentCounter !== undefined ? parseInt(tagParams.resentmentCounter, 10) : 0;

  const rawLocationId = tagParams.locationId;
  const locationId = resolveLocationId(newKb, rawLocationId);

  const vendorType = tagParams.vendorType as any;
  const vendorSlogan = tagParams.vendorSlogan;
  const vendorBuysCategoriesStr = tagParams.vendorBuysCategories;

  if (!name) {
    console.warn("NPC: Missing name.", tagParams);
    return { updatedKb: newKb, systemMessages };
  }

  // 0. Identity Shield: Do not create NPC if name matches the current player (MC)
  const currentPlayerName = (newKb.worldConfig?.playerName || newKb.playerStats?.name || newKb.playerStats?.originalPlayerName || '').trim().toLowerCase();
  const deceasedProtagonists = (newKb.worldConfig?.deceasedProtagonists || newKb.deceasedProtagonists || []).map(p => p.trim().toLowerCase());

  if (currentPlayerName && name.trim().toLowerCase() === currentPlayerName) {
      console.warn(`[Identity Shield] Ngăn chặn tạo/cập nhật NPC trùng tên với người chơi hiện tại: '${name}'`);
      return { updatedKb: newKb, systemMessages };
  }

  // 1. Gather all potential NPCs to check for existing records (including wives, slaves, prisoners, companions)
  const allNPCs = [
    ...(newKb.discoveredNPCs || []),
    ...(newKb.wives || []),
    ...(newKb.slaves || []),
    ...(newKb.prisoners || []),
    ...(newKb.companions || [])
  ];

  // 1a. ID-First Match
  let npcToProcess = tagParams.id ? allNPCs.find(n => n.id === tagParams.id) : undefined;
  
  // 2. Exact Name Match (if no ID match)
  // FIX: Use normalized names to prevent duplicates from spacing/casing variations
  if (!npcToProcess) {
    const targetNameNorm = name.trim().toLowerCase();
    npcToProcess = allNPCs.find((n) => n.name.trim().toLowerCase() === targetNameNorm);
  }

  const isNew = !npcToProcess;

  // 0b. Deceased MC Shield: Do not create new NPC if name matches a deceased protagonist
  if (isNew && deceasedProtagonists.includes(name.trim().toLowerCase())) {
      console.warn(`[Deceased MC Shield] Ngăn chặn tạo NPC mới cho nhân vật chính tiền nhiệm đã chết: '${name}'`);
      return { updatedKb: newKb, systemMessages };
  }

  // Anti-Ghost / Death Guard: Nếu NPC mới được phát tag NPC_CREATE nhưng mô tả thể hiện nhân vật đã tử trận/chết/hy sinh
  if (isNew) {
    const deathKeywords = ["tử trận", "đã chết", "hy sinh", "vong mạng", "ngã xuống tử trận", "thi thể", "tử vong", "bị tiêu diệt", "qua đời"];
    const textToCheck = `${description} ${tagParams.status || ''} ${tagParams.title || ''}`.toLowerCase();
    if (deathKeywords.some(kw => textToCheck.includes(kw))) {
      console.warn(`[Death Guard] Ngăn chặn tạo NPC mới '${name}' vì bối cảnh mô tả nhân vật đã tử trận/chết.`);
      return { updatedKb: newKb, systemMessages };
    }
  }

  if (!isNew) {
    // Update existing NPC properties if provided in the tag
    if (description) {
      npcToProcess!.description = appendFormattedDescription(
        npcToProcess!.description || "",
        description,
        turnForSystemMessages,
        false
      );
    }
    if (tagParams.realm) npcToProcess!.realm = tagParams.realm;
    if (race) npcToProcess!.race = race;
    if (gender) npcToProcess!.gender = gender as any;
    if (locationId) npcToProcess!.locationId = locationId;
  }

  // --- GIỮ NGUYÊN CẢNH GIỚI DO AI / FAST AGENT CUNG CẤP (TẮT ĐỒNG BỘ VỚI NỀN THẾ GIỚI) ---
  let realm = tagParams.realm
    ? RealmParserService.cleanRealmString(tagParams.realm)
    : npcToProcess
      ? npcToProcess.realm
      : undefined;

  // 1. Kiểm tra xem NPC đã có cảnh giới từ tag của AI hoặc từ NPC đã lưu trong CSDL chưa
  let resolvedRealm = realm?.trim();

  // Nếu tag không có realm hợp lệ, kiểm tra xem NPC cũ trong CSDL đã có realm chưa
  if ((!resolvedRealm || resolvedRealm === 'Không rõ' || resolvedRealm === 'Chưa rõ') && npcToProcess?.realm) {
    resolvedRealm = npcToProcess.realm;
  }

  realm = (resolvedRealm && resolvedRealm !== 'Không rõ' && resolvedRealm !== 'Chưa rõ') ? resolvedRealm : undefined;
  // ---------------------------------

  const isDeath = String(tagParams.death || tagParams.isDeath || '').toLowerCase() === 'true' || tagParams.death === '1';
  const oldHp = npcToProcess?.stats?.sinhLuc;

  let statsRaw: Record<string, any> = {};
  if (tagParams.statsJSON) {
    try {
      statsRaw = JSON.parse(sanitizeJson(tagParams.statsJSON));
    } catch (e) {
      console.warn(
        `NPC: Could not parse statsJSON for ${name}:`,
        tagParams.statsJSON,
        e,
      );
    }
  }

  if (isNew) {
    npcToProcess = {
      id: `npc-${name.replace(/\s+/g, "-")}-${Date.now()}`,
      name: name,
      gender: gender,
      race: race,
      description: appendFormattedDescription("", description || "Một nhân vật bí ẩn.", turnForSystemMessages, true),
      title: title,
      personalityTraits: personality
        ? personality.split(",").map((p) => p.trim())
        : [],
      personality: personality || "",
      affinity: isNaN(affinity) ? 0 : affinity,
      factionId: factionId,
      realm: realm,
      relationshipToPlayer: relationshipToPlayer,
      avatarUrl: aiSuggestedAvatarUrl,
      tuChat: TU_CHAT_TIERS.includes(tuChat) ? tuChat : "Trung Phẩm",
      spiritualRoot: spiritualRoot,
      specialPhysique: specialPhysique,
      pride: pride,
      survivalInstinct: survivalInstinct,
      resentmentCounter: resentmentCounter,
      locationId: locationId,
      status: tagParams.status,
      vendorType: vendorType,
      vendorSlogan: vendorSlogan,
      vendorBuysCategories: vendorBuysCategoriesStr
        ? (vendorBuysCategoriesStr
            .split(",")
            .map((c) => c.trim())
            .filter((c) =>
              Object.values(GameTemplates.ItemCategory).includes(c as any),
            ) as ItemCategoryValues[])
        : undefined,
      stats: {},
      skills: [],
      lastInteractionTurn: turnForSystemMessages,
    };
  } else {
    // Update existing NPC
    npcToProcess!.lastInteractionTurn = turnForSystemMessages;
    npcToProcess!.realm = realm || npcToProcess!.realm;
    if (description) {
      npcToProcess!.description = appendFormattedDescription(
        npcToProcess!.description || "",
        description,
        turnForSystemMessages,
        false
      );
    }
    if (title) npcToProcess!.title = title;
    if (gender) npcToProcess!.gender = gender;
    if (race) npcToProcess!.race = race;
    if (tagParams.pride !== undefined) npcToProcess!.pride = pride;
    if (survivalInstinct) npcToProcess!.survivalInstinct = survivalInstinct;
    if (tagParams.resentmentCounter !== undefined) npcToProcess!.resentmentCounter = resentmentCounter;
  }

  if (statsRaw && Object.keys(statsRaw).length > 0) {
    if (!npcToProcess!.stats) npcToProcess!.stats = {};
    Object.entries(statsRaw).forEach(([key, val]) => {
      const statKey = key as keyof PlayerStats;
      if (typeof val === "string" && val === "MAX") {
        if (statKey === "sinhLuc") npcToProcess!.stats!.sinhLuc = npcToProcess!.stats!.maxSinhLuc;
        if (statKey === "linhLuc") npcToProcess!.stats!.linhLuc = npcToProcess!.stats!.maxLinhLuc;
      } else if (typeof val === "number") {
        (npcToProcess!.stats as any)[statKey] = val;
      } else if (typeof val === "string") {
        const currentStat = (npcToProcess!.stats as any)[statKey] || 0;
        if (val.endsWith("%")) {
          const isSub = val.includes("-");
          const pct = parseFloat(val.replace("+=", "").replace("-=", "").replace("+", "").replace("-", "").slice(0, -1));
          if (!isNaN(pct)) {
            const maxVal = statKey === "sinhLuc" ? (npcToProcess!.stats!.maxSinhLuc || 100) : (npcToProcess!.stats!.maxLinhLuc || 100);
            let delta = Math.floor(maxVal * (pct / 100));
            if (isSub) delta = -delta;
            (npcToProcess!.stats as any)[statKey] = currentStat + delta;
          }
        } else if (val.startsWith("+=")) {
          const change = parseInt(val.substring(2), 10);
          if (!isNaN(change)) (npcToProcess!.stats as any)[statKey] = currentStat + change;
        } else if (val.startsWith("-=")) {
          const change = parseInt(val.substring(2), 10);
          if (!isNaN(change)) (npcToProcess!.stats as any)[statKey] = currentStat - change;
        } else {
          const parsed = parseInt(val, 10);
          if (!isNaN(parsed)) (npcToProcess!.stats as any)[statKey] = parsed;
        }
      }
    });
  }

  // Stats calculation
  updateEntityStatsFromRealm(npcToProcess!, newKb);

  // CHỐT CHẶN CƠ HỌC: NPC Sinh lực không giảm xuống dưới 20% trừ khi có death="true"
  if (!isDeath && oldHp !== undefined && npcToProcess!.stats?.sinhLuc !== undefined) {
    const newHp = npcToProcess!.stats.sinhLuc;
    if (newHp < oldHp) {
      const maxHp = npcToProcess!.stats.maxSinhLuc || 100;
      const minHpFloor = Math.floor(maxHp * 0.20);
      const targetFloor = Math.min(oldHp, minHpFloor);
      if (newHp < targetFloor) {
        npcToProcess!.stats.sinhLuc = targetFloor;
      }
    }
  }

  if (isNew) {
    newKb.discoveredNPCs.push(npcToProcess!);
  }
  newVectorMetadata = {
    entityId: npcToProcess!.id,
    entityType: "npc",
    text: formatPersonForEmbedding(npcToProcess!),
  };

  systemMessages.push({
    id: "npc-discovered-" + npcToProcess!.id,
    type: "system",
    content: `🚹 Bạn đã gặp NPC mới: ${name}${npcToProcess!.realm ? ` (${npcToProcess!.realm})` : ""}.`,
    timestamp: Date.now(),
    turnNumber: turnForSystemMessages,
  });

  const apiSettings = getApiSettings();
  const npcIdToUpdate = npcToProcess!.id;

  if (apiSettings.autoGenerateNpcAvatars && !npcToProcess!.avatarUrl) {
    systemMessages.push({
      id: `npc-avatar-generating-${npcIdToUpdate}`,
      type: "system",
      content: `Đang tạo ảnh đại diện AI cho ${npcToProcess!.name}...`,
      timestamp: Date.now(),
      turnNumber: turnForSystemMessages,
    });

    (async () => {
      try {
        const basePrompt = generateWuxiaAvatarPrompt(
          `Chân dung nhân vật ${npcToProcess!.name}, Giới tính: ${npcToProcess!.gender}, Chủng tộc: ${npcToProcess!.race}, Mô tả: ${npcToProcess!.description || ""}, Tính cách: ${(npcToProcess!.personalityTraits || []).join(", ")}, Cảnh giới: ${npcToProcess!.realm || "Người thường"}`
        );
        if (logNpcAvatarPromptCallback) logNpcAvatarPromptCallback(basePrompt);
        const rawBase64ImageData = await generateImageUnified(basePrompt);
        if (rawBase64ImageData) {
          const finalUrl = rawBase64ImageData.startsWith("data:image")
            ? rawBase64ImageData
            : `data:image/png;base64,${rawBase64ImageData}`;
          npcToProcess!.avatarUrl = finalUrl;
        }
      } catch (err) {
        console.error(
          `Async avatar generation for NPC ${npcIdToUpdate} failed:`,
          err,
        );
      }
    })();
  }

  return { updatedKb: newKb, systemMessages, newVectorMetadata };
};

export const processNpcUpdate = async (
  currentKb: KnowledgeBase,
  tagParams: Record<string, string>,
  turnForSystemMessages: number,
  logNpcAvatarPromptCallback?: (prompt: string) => void,
  summaryQueue?: BatchSummaryRequestItem[],
): Promise<{
  updatedKb: KnowledgeBase;
  systemMessages: GameMessage[];
  updatedVectorMetadata?: VectorMetadata;
  affinityChange?: { name: string; delta: number };
  errorReason?: string;
}> => {
  if (!currentKb) {
      console.error("processNpcUpdate called with null KnowledgeBase!");
      return { updatedKb: {} as KnowledgeBase, systemMessages: [] };
  }
  const newKb = currentKb;
  const systemMessages: GameMessage[] = [];
  let updatedVectorMetadata: VectorMetadata | undefined = undefined;
  let affinityChange: { name: string; delta: number } | undefined = undefined;

  const npcName = tagParams.name || tagParams.targetName;
  const providedId = tagParams.id || tagParams.targetId;
  const desc = tagParams.description || "";

  if (!npcName && !providedId && !desc) {
    console.warn("NPC_UPDATE: Missing name, id, and description.", tagParams);
    return { updatedKb: newKb, systemMessages };
  }

  let npcToProcess: any = undefined;
  let targetList: any[] | undefined = undefined;
  let targetIndex: number = -1;

  // Use NpcIdentityResolver for cross-validation between target token, id, and name
  const resolved = resolveNpcEntity(newKb, {
    target: tagParams.target,
    id: providedId,
    name: npcName,
    targetId: tagParams.targetId,
    targetName: tagParams.targetName,
    description: desc,
  });

  if (resolved) {
    npcToProcess = resolved.npc;
    targetList = resolved.list;
    targetIndex = resolved.index;
  }

  if (!npcToProcess) {
    if (tagParams.gender && tagParams.description) {
      return await processNpc(
        currentKb,
        tagParams,
        turnForSystemMessages,
        logNpcAvatarPromptCallback,
      );
    } else {
      return { updatedKb: newKb, systemMessages, errorReason: `[NPC_UPDATE] Không tìm thấy thực thể mang tên/id: "${npcName || providedId || tagParams.target}". (Lưu ý: Không dùng thẻ này cho MC)` };
    }
  }

  const isBattlePlusOne = newKb.battlePlusOneTurn === turnForSystemMessages;
  const requestedDeath = tagParams.Death === "true" || tagParams.death === "true";

  if (requestedDeath && !isBattlePlusOne) {
    const deadNpcName = npcToProcess.name;
    const deadNpcId = npcToProcess.id;

    if (newKb.discoveredNPCs) {
      newKb.discoveredNPCs = newKb.discoveredNPCs.filter(n => n.id !== deadNpcId && n.name !== deadNpcName);
    }
    if (newKb.wives) {
      newKb.wives = newKb.wives.filter(n => n.id !== deadNpcId && n.name !== deadNpcName);
    }
    if (newKb.slaves) {
      newKb.slaves = newKb.slaves.filter(n => n.id !== deadNpcId && n.name !== deadNpcName);
    }
    if (newKb.prisoners) {
      newKb.prisoners = newKb.prisoners.filter(n => n.id !== deadNpcId && n.name !== deadNpcName);
    }
    if (newKb.companions) {
      newKb.companions = newKb.companions.filter(n => n.id !== deadNpcId && n.name !== deadNpcName);
    }
    if (newKb.master && (newKb.master.id === deadNpcId || newKb.master.name === deadNpcName)) {
      newKb.master = undefined;
    }

    systemMessages.push({
      id: "npc-died-" + deadNpcId + "-" + Date.now(),
      type: "system",
      content: `Hệ thống: NPC ${deadNpcName} đã chết và bị loại bỏ hoàn toàn khỏi dữ liệu. Lý do: ${tagParams.description || "Không rõ"}`,
      timestamp: Date.now(),
      turnNumber: turnForSystemMessages,
    });

    return {
      updatedKb: newKb,
      systemMessages,
      updatedVectorMetadata: undefined,
      affinityChange: undefined
    };
  }

  const oldDescription = npcToProcess.description || "";

  npcToProcess.lastInteractionTurn = turnForSystemMessages;

  if (tagParams.description) {
    const newDescriptionPart = tagParams.description;
    const combinedDescription = appendFormattedDescription(
      oldDescription,
      newDescriptionPart,
      turnForSystemMessages,
      false
    );
    const words = combinedDescription.split(/\s+/);
    const WORD_LIMIT = 1600;
    const SUMMARY_KEEP_WORDS = 600;
    let finalDescription = combinedDescription;

    if (words.length > WORD_LIMIT) {
      const firstPart = words.slice(0, SUMMARY_KEEP_WORDS).join(" ");
      const summarizedEnd = await summarizeEndOfDescription(
        words.slice(SUMMARY_KEEP_WORDS).join(" "),
      );
      finalDescription = `${firstPart}\n\n[Tóm tắt các sự kiện gần đây:]\n${summarizedEnd}`;

      systemMessages.push({
        id: `npc-desc-summarized-${npcToProcess.id}`,
        type: "system",
        content: `Hệ thống: Mô tả của ${npcToProcess.name} đã được tóm tắt tự động để tối ưu hóa.`,
        timestamp: Date.now(),
        turnNumber: turnForSystemMessages,
      });
    }

    if (summaryQueue) {
      summaryQueue.push({
        id: npcToProcess.id,
        name: npcToProcess.name,
        oldDesc: oldDescription,
        newDesc: finalDescription,
        type: "npc",
      });
    }
    npcToProcess.description = finalDescription;
  }

  if (tagParams.newName) npcToProcess.name = tagParams.newName;
  if (tagParams.personality) {
    npcToProcess.personalityTraits = tagParams.personality
      .split(",")
      .map((p) => p.trim());
    npcToProcess.personality = tagParams.personality;
  }

  const affinityRaw = tagParams.affinity || tagParams.initialAffinity;
  if (affinityRaw) {
    const currentVal = npcToProcess.affinity || 0;
    const newVal = calculateNumericValue(currentVal, affinityRaw, true);
    let delta = newVal - currentVal;
    
    if (delta !== 0) {
      // 1. Áp dụng giới hạn thô trước (Clamping)
      if (delta > 50) delta = 50;
      if (delta < -50) delta = -50;

      // 2. Chạy qua màng lọc kháng tính cơ học nếu điểm tăng lên
      const finalDelta = calculateDiminishingAffinity(currentVal, delta);

      // 3. Ghi nhận giá trị mới an toàn
      npcToProcess.affinity = Math.max(-100, Math.min(100, currentVal + finalDelta));
      affinityChange = { name: npcToProcess.name, delta: finalDelta };
    }
  }

  if (tagParams.factionId) npcToProcess.factionId = tagParams.factionId;
  
  if (tagParams.realm) {
    const cleanedRealm = RealmParserService.cleanRealmString(tagParams.realm);
    npcToProcess.realm = cleanedRealm;
    updateEntityStatsFromRealm(npcToProcess, newKb);
  }

  if (tagParams.gender) npcToProcess.gender = tagParams.gender as any;
  if (tagParams.race) npcToProcess.race = tagParams.race;
  if (tagParams.relationshipToPlayer)
    npcToProcess.relationshipToPlayer = tagParams.relationshipToPlayer;
  if (tagParams.status) {
    npcToProcess.status = tagParams.status;
    npcToProcess.statusDuration = 5;
  }
  if (tagParams.avatarUrl) npcToProcess.avatarUrl = tagParams.avatarUrl;
  if (tagParams.tuChat && TU_CHAT_TIERS.includes(tagParams.tuChat as any))
    npcToProcess.tuChat = tagParams.tuChat as any;
  if (tagParams.spiritualRoot)
    npcToProcess.spiritualRoot = tagParams.spiritualRoot;
  if (tagParams.specialPhysique)
    npcToProcess.specialPhysique = tagParams.specialPhysique;
  if (tagParams.pride !== undefined)
    npcToProcess.pride = parseInt(tagParams.pride, 10);
  if (tagParams.survivalInstinct)
    npcToProcess.survivalInstinct = tagParams.survivalInstinct;
  if (tagParams.resentmentCounter !== undefined) {
    const rawRes = tagParams.resentmentCounter;
    const currentRes = npcToProcess.resentmentCounter || 0;
    npcToProcess.resentmentCounter = calculateNumericValue(currentRes, rawRes);
  }
  if (tagParams.locationId)
    npcToProcess.locationId = resolveLocationId(newKb, tagParams.locationId);

  let logContent = `🚹 Thông tin NPC ${npcToProcess.name} đã được cập nhật.`;
  if (tagParams.status) {
    logContent = `🚹 [${npcToProcess.name}] Cập nhật trạng thái: "${tagParams.status}"`;
  } else if (tagParams.description) {
    logContent = `🚹 [${npcToProcess.name}] Đã cập nhật ghi chép thông tin mới.`;
  }

  systemMessages.push({
    id: "npc-info-updated-" + Date.now() + "-" + Math.random().toString(36).substring(2, 7),
    type: "system",
    content: logContent,
    timestamp: Date.now(),
    turnNumber: turnForSystemMessages,
  });

  updatedVectorMetadata = {
    entityId: npcToProcess.id,
    entityType: "npc",
    text: formatPersonForEmbedding(npcToProcess),
  };

  return {
    updatedKb: newKb,
    systemMessages,
    updatedVectorMetadata,
    affinityChange,
  };
};

export const processNpcRemove = (
  currentKb: KnowledgeBase,
  tagParams: Record<string, string>,
  turnForSystemMessages: number,
): { updatedKb: KnowledgeBase; systemMessages: GameMessage[] } => {
  const newKb = currentKb;
  const systemMessages: GameMessage[] = [];
  const name = tagParams.name;

  if (!name) {
    console.warn("NPC_REMOVE: Missing name.", tagParams);
    return { updatedKb: newKb, systemMessages };
  }

  let removedNpcName = "";
  let removedNpcId = "";

  const removeFromList = (list: any[]): boolean => {
    let indexToRemove = -1;
    let bestScore = 0;
    const normalizedInputName = normalizeStringForComparison(name);

    list.forEach((npc, index) => {
      const score = diceCoefficient(
        normalizedInputName,
        normalizeStringForComparison(npc.name)
      );
      if (score > bestScore) {
        bestScore = score;
        indexToRemove = index;
      }
    });

    if (indexToRemove > -1 && bestScore >= SIMILARITY_THRESHOLD) {
      removedNpcName = list[indexToRemove].name;
      removedNpcId = list[indexToRemove].id;
      list.splice(indexToRemove, 1);
      return true;
    }
    return false;
  };

  let removed = false;
  if (newKb.discoveredNPCs && removeFromList(newKb.discoveredNPCs)) removed = true;
  else if (newKb.wives && removeFromList(newKb.wives)) removed = true;
  else if (newKb.slaves && removeFromList(newKb.slaves)) removed = true;
  else if (newKb.prisoners && removeFromList(newKb.prisoners)) removed = true;
  else if (newKb.companions && removeFromList(newKb.companions)) removed = true;

  if (removed) {
    systemMessages.push({
      id: "npc-removed-" + removedNpcId + "-" + Date.now(),
      type: "system",
      content: `NPC ${removedNpcName} đã bị xóa khỏi danh sách (chết hoặc biến mất).`,
      timestamp: Date.now(),
      turnNumber: turnForSystemMessages,
    });

    // Log death into Sacred Timeline
    if (newKb.universeId) {
      const lastMessage = newKb.currentTurnLog && newKb.currentTurnLog.length > 0
        ? newKb.currentTurnLog[newKb.currentTurnLog.length - 1]
        : "";
      const lastMessageText = typeof lastMessage === 'string' ? lastMessage : (lastMessage?.text || "");
      const lastQuote = extractLastQuote(lastMessageText, removedNpcName);
      SacredTimelineService.logDeath(newKb.universeId, removedNpcId, removedNpcName, turnForSystemMessages, lastQuote);
    }
  }

  return { updatedKb: newKb, systemMessages };
};

export const processAppearanceUpdate = (
  currentKb: KnowledgeBase,
  tagParams: Record<string, string>,
  turnForSystemMessages: number,
): { updatedKb: KnowledgeBase; systemMessages: GameMessage[]; errorReason?: string; } => {
  const newKb = currentKb;
  const systemMessages: GameMessage[] = [];
  const npcName = tagParams.name;
  const providedId = tagParams.id;
  const appearanceText = tagParams.appearance || tagParams.content;

  if (!appearanceText) {
    return { updatedKb: newKb, systemMessages, errorReason: "[APPEARANCE_UPDATE] Thiếu tham số appearance hoặc content." };
  }

  if (!npcName && !providedId) {
    return { updatedKb: newKb, systemMessages, errorReason: "[APPEARANCE_UPDATE] Thiếu tham số name và id." };
  }

  let npcToProcess: any = undefined;
  let targetIndex: number = -1;

  const searchLists = [
    { list: newKb.discoveredNPCs, type: 'npc' },
    { list: newKb.wives || [], type: 'wife' },
    { list: newKb.slaves || [], type: 'slave' },
    { list: newKb.prisoners || [], type: 'prisoner' },
    { list: newKb.companions || [], type: 'companion' }
  ];

  if (newKb.master && (newKb.master.id === providedId || newKb.master.name === npcName)) {
    npcToProcess = newKb.master;
  } else if (newKb.playerStats && (providedId === 'player' || newKb.playerStats.name === npcName)) {
    npcToProcess = newKb.playerStats;
  }

  if (!npcToProcess) {
    for (const { list } of searchLists) {
      if (providedId) {
        targetIndex = list.findIndex(n => n.id === providedId);
      }
      if (targetIndex === -1 && npcName) {
        const normalizedInputName = normalizeStringForComparison(npcName);
        let bestScore = 0;
        list.forEach((npc, index) => {
          const score = diceCoefficient(normalizedInputName, normalizeStringForComparison(npc.name));
          if (score > bestScore) {
            bestScore = score;
            targetIndex = index;
          }
        });
        if (bestScore < SIMILARITY_THRESHOLD) targetIndex = -1;
      }

      if (targetIndex > -1) {
        npcToProcess = list[targetIndex];
        break;
      }
    }
  }

  if (npcToProcess) {
    npcToProcess.appearance = appearanceText;
    const customDuration = parseInt(tagParams.duration || tagParams.durationTurns || "");
    npcToProcess.appearanceDuration = !isNaN(customDuration) ? customDuration : 5;
    npcToProcess.lastInteractionTurn = turnForSystemMessages;
    
    systemMessages.push({
      id: `appearance-updated-${npcToProcess.id}-${Date.now()}`,
      type: "system",
      content: `[Thiên Đạo] Bề ngoài của [${npcToProcess.name}] đã được ghi nhận: "${appearanceText}" (Thời hạn: ${npcToProcess.appearanceDuration} lượt).`,
      timestamp: Date.now(),
      turnNumber: turnForSystemMessages,
    });
  } else {
    return { updatedKb: newKb, systemMessages, errorReason: `[APPEARANCE_UPDATE] Không tìm thấy thực thể mang tên/id: "${npcName || providedId}".` };
  }

  return { updatedKb: newKb, systemMessages };
};


export const processNpcMove = (
  currentKb: KnowledgeBase,
  tagParams: Record<string, string>,
  turnForSystemMessages: number
): { updatedKb: KnowledgeBase; systemMessages: GameMessage[] } => {
  if (!currentKb) {
      console.error("processNpcMove called with null KnowledgeBase!");
      return { updatedKb: {} as KnowledgeBase, systemMessages: [] };
  }
  const newKb = { ...currentKb };
  const systemMessages: GameMessage[] = [];

  const providedId = tagParams.id || tagParams.targetId;
  const npcName = tagParams.name;
  
  if (!providedId && !npcName) {
    console.warn("NPC_MOVE: Missing ID or Name.", tagParams);
    return { updatedKb: newKb, systemMessages };
  }

  let npcToProcess = providedId ? newKb.discoveredNPCs.find((n) => n.id === providedId) : undefined;
  if (!npcToProcess && npcName) {
    npcToProcess = newKb.discoveredNPCs.find((n) => n.name === npcName);
  }
  if (!npcToProcess) {
     npcToProcess = providedId ? newKb.wives.find((n: any) => n.id === providedId) as any : undefined;
     if (!npcToProcess && npcName) {
         npcToProcess = newKb.wives.find((n: any) => n.name === npcName) as any;
     }
  }
  if (!npcToProcess) {
     npcToProcess = providedId ? newKb.slaves.find((n: any) => n.id === providedId) as any : undefined;
     if (!npcToProcess && npcName) {
         npcToProcess = newKb.slaves.find((n: any) => n.name === npcName) as any;
     }
  }
  
  if (!npcToProcess) {
      console.warn("NPC_MOVE: Could not find NPC.", tagParams);
      return { updatedKb: newKb, systemMessages };
  }

  const rawLocationId = tagParams.locationId || tagParams.location;
  if (rawLocationId) {
    npcToProcess.locationId = resolveLocationId(newKb, rawLocationId);
    
    // Check if the resolved location exists to log name
    let locationName = rawLocationId;
    const resolvedLoc = newKb.discoveredLocations.find(l => l.id === npcToProcess!.locationId);
    if (resolvedLoc) {
       locationName = resolvedLoc.name;
    }
    
    systemMessages.push({
      id: "npc-move-" + Date.now() + Math.random(),
      type: "system",
      content: `🚹 ${npcToProcess.name} đã di chuyển đến ${locationName}.`,
      timestamp: Date.now(),
      turnNumber: turnForSystemMessages,
    });
  }

  return { updatedKb: newKb, systemMessages };
};

export const processNpcRename = (
  currentKb: KnowledgeBase,
  tagParams: Record<string, string>,
  turnForSystemMessages: number
): { updatedKb: KnowledgeBase; systemMessages: GameMessage[]; updatedVectorMetadata?: VectorMetadata; errorReason?: string; } => {
  const newKb = { ...currentKb };
  const systemMessages: GameMessage[] = [];
  const providedId = tagParams.id || tagParams.targetId;
  const npcName = tagParams.oldName || tagParams.name;
  const newName = tagParams.newName;

  if ((!npcName && !providedId) || !newName) {
    return { updatedKb: newKb, systemMessages, errorReason: "[NPC_RENAME] Thiếu tham số oldName/name hoặc newName." };
  }

  let foundOldName: string | null = null;
  let renamedNpc: NPC | null = null;

  const renameInList = (list: any[]) => {
    if (!list) return;
    list.forEach((npc) => {
      const matchById = providedId && npc.id === providedId;
      const matchByName = npcName && npc.name && npc.name.trim().toLowerCase() === npcName.trim().toLowerCase();
      if (matchById || matchByName) {
        if (!foundOldName) foundOldName = npc.name;
        npc.name = newName;
        renamedNpc = npc;
      }
    });
  };

  if (newKb.discoveredNPCs) renameInList(newKb.discoveredNPCs);
  if (newKb.wives) renameInList(newKb.wives);
  if (newKb.slaves) renameInList(newKb.slaves);
  if (newKb.prisoners) renameInList(newKb.prisoners);
  if (newKb.companions) renameInList(newKb.companions);

  let updatedVectorMetadata: VectorMetadata | undefined = undefined;

  if (foundOldName) {
    const msgContent = `🚹 [Thiên Đạo - Đổi Tên] Tù nhân / NPC "${foundOldName}" đã được cập nhật tên thành "${newName}".`;
    systemMessages.push({
      id: "npc-rename-" + Date.now() + Math.random(),
      type: "system",
      content: msgContent,
      timestamp: Date.now(),
      turnNumber: turnForSystemMessages,
    });

    const embeddedContent = renamedNpc ? formatPersonForEmbedding(renamedNpc) : `Sự kiện đổi tên: Tù nhân/NPC ${foundOldName} đã đổi tên thành ${newName}.`;
    updatedVectorMetadata = {
      entityId: (renamedNpc as any)?.id || `npc-rename-${Date.now()}`,
      entityType: 'npc',
      text: `[Thiên Đạo - Cập Nhật Danh Xưng / Đổi Tên]: Tù nhân / NPC trước đây là "${foundOldName}" đã được cấp/đổi tên thành "${newName}". ${embeddedContent}`,
    };
  } else {
    console.warn("NPC_RENAME: Could not find NPC with name/id:", npcName || providedId);
  }

  return { updatedKb: newKb, systemMessages, updatedVectorMetadata };
};
