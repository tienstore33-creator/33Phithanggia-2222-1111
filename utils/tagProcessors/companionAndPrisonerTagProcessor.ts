import {
  KnowledgeBase,
  GameMessage,
  NPC,
  Wife,
  Slave,
  Prisoner,
  PlayerStats,
  VectorMetadata,
  PlayerSpecialStatus,
  Master,
  PersonBase,
  BatchSummaryRequestItem,
} from "../../types";
import { formatPersonForEmbedding } from "../ragUtils";
// FIX: Import the missing calculateRealmBaseStats function.
import { calculateRealmBaseStats } from "../statsCalculationUtils";
import { summarizeEndOfDescription } from "../../services/geminiService";
import { RealmParserService } from "../../services/RealmParserService";
import { appendFormattedDescription } from "../tagUtils";
import { calculateDiminishingAffinity } from "../affinityCalculator";
import { resolveNpcEntity } from "../npcIdentityResolver";

// Helper to calculate delta and apply update
// Returns the actual delta applied, or null if no change
const updateNumericField = <T extends Record<string, any>>(
  target: T,
  fieldName: keyof T,
  valueStr: string | undefined,
  min: number = 0,
  max: number = 100,
): number | null => {
  if (valueStr) {
    const changeStr = valueStr.trim();
    const currentValue = (target[fieldName] as number) || 0;
    let newValue: number | null = null;
    let appliedDelta: number | null = null;

    // STRICT RULE: Affinity change is capped at 50 per turn
    const applyClamping = (delta: number): number => {
      if (fieldName === "affinity") {
        return Math.min(50, delta);
      }
      return delta;
    };

    if (changeStr.startsWith("+=")) {
      let delta = parseInt(changeStr.substring(2), 10);
      if (!isNaN(delta)) {
        delta = applyClamping(delta);
        newValue = currentValue + delta;
        appliedDelta = delta;
      }
    } else if (changeStr.startsWith("-=")) {
      let delta = parseInt(changeStr.substring(2), 10);
      if (!isNaN(delta)) {
        delta = applyClamping(delta);
        newValue = currentValue - delta;
        appliedDelta = -delta;
      }
    } else if (changeStr.startsWith("=")) {
      const rawTarget = parseInt(changeStr.substring(1), 10);
      if (!isNaN(rawTarget)) {
        let delta = rawTarget - currentValue;
        delta = applyClamping(delta);
        newValue = currentValue + delta;
        appliedDelta = delta;
      }
    } else {
      // Legacy or direct number (treat as absolute assignment if no sign, or relative if just +/-, though usually AI uses +=)
      // Safest approach for ambiguous numbers like "5":
      // If it starts with + or -, treat as relative. Else absolute.
      if (changeStr.startsWith("+")) {
        let delta = parseInt(changeStr, 10); // parseInt parses "+5" as 5
        delta = applyClamping(delta);
        newValue = currentValue + delta;
        appliedDelta = delta;
      } else if (changeStr.startsWith("-")) {
        let delta = parseInt(changeStr, 10); // parseInt parses "-5" as -5
        delta = applyClamping(delta);
        newValue = currentValue + delta;
        appliedDelta = delta;
      } else {
        const rawTarget = parseInt(changeStr, 10);
        if (!isNaN(rawTarget)) {
          let delta = rawTarget - currentValue;
          delta = applyClamping(delta);
          newValue = currentValue + delta;
          appliedDelta = delta;
        }
      }
    }

    if (fieldName === "affinity" && appliedDelta !== null && appliedDelta > 0) {
      appliedDelta = calculateDiminishingAffinity(currentValue, appliedDelta);
      newValue = currentValue + appliedDelta;
    }

    if (newValue !== null && !isNaN(newValue) && appliedDelta !== null) {
      (target as any)[fieldName] = Math.max(min, Math.min(max, newValue));
      return appliedDelta;
    }
  }
  return null;
};

const processPersonUpdate = async <T extends Wife | Slave | Prisoner>(
  personToUpdate: T,
  tagParams: Record<string, string>,
  personType: "wife" | "slave" | "prisoner",
  turn: number,
  summaryQueue?: BatchSummaryRequestItem[],
): Promise<{
  updatedCount: number;
  affinityChange: number | null;
  systemMessages: GameMessage[];
  shouldFree?: boolean;
}> => {
  let updatedFieldsCount = 0;
  let affinityChange: number | null = null;
  const systemMessages: GameMessage[] = [];
  let shouldFree = tagParams.free === "true";

  // NEW: Update last interaction turn
  personToUpdate.lastInteractionTurn = turn;

  const affDelta = updateNumericField(
    personToUpdate,
    "affinity",
    tagParams.affinity,
    -100,
    100,
  );
  if (affDelta !== null && affDelta !== 0) {
    updatedFieldsCount++;
    affinityChange = affDelta;
  }

  if (
    updateNumericField(
      personToUpdate,
      "willpower" as keyof T,
      tagParams.willpower,
    ) !== null
  )
    updatedFieldsCount++;
  if (
    updateNumericField(
      personToUpdate,
      "obedience" as keyof T,
      tagParams.obedience,
    ) !== null
  )
    updatedFieldsCount++;

  if (personType === "prisoner") {
    if (
      updateNumericField(
        personToUpdate,
        "resistance" as keyof T,
        tagParams.resistance,
      ) !== null
    )
      updatedFieldsCount++;
  }

  if (tagParams.description) {
    const oldDescription = personToUpdate.description || "";
    const combinedDescription = appendFormattedDescription(
      oldDescription,
      tagParams.description,
      turn,
      false
    );
    const WORD_LIMIT = 1600;
    const SUMMARY_KEEP_WORDS = 600;
    const words = combinedDescription.split(/\s+/);
    let finalDescription = combinedDescription;

    if (words.length > WORD_LIMIT) {
      const firstPart = words.slice(0, SUMMARY_KEEP_WORDS).join(" ");
      const restToSummarize = words.slice(SUMMARY_KEEP_WORDS).join(" ");
      const summarizedEnd = await summarizeEndOfDescription(restToSummarize);
      finalDescription = `${firstPart}\n\n[Tóm tắt các sự kiện gần đây:]\n${summarizedEnd}`;

      systemMessages.push({
        id: `desc-summarized-${personToUpdate.id}`,
        type: "system",
        content: `Hệ thống: Mô tả của ${personToUpdate.name} đã được tóm tắt tự động.`,
        timestamp: Date.now(),
        turnNumber: turn,
      });
    }

    if (summaryQueue) {
      summaryQueue.push({
        id: personToUpdate.id,
        name: personToUpdate.name,
        oldDesc: oldDescription,
        newDesc: finalDescription,
        type: personType,
      });
    }
    personToUpdate.description = finalDescription;
    updatedFieldsCount++;
  }

  if (tagParams.status) {
    personToUpdate.status = tagParams.status;
    personToUpdate.statusDuration = 5;
    updatedFieldsCount++;
  }

  if (tagParams.statsJSON) {
    try {
      const statsUpdate = JSON.parse(tagParams.statsJSON);
      if (!personToUpdate.stats) personToUpdate.stats = {};

      const isDeath = String(tagParams.death || tagParams.isDeath || '').toLowerCase() === 'true' || tagParams.death === '1';
      const oldHp = personToUpdate.stats.sinhLuc;

      Object.entries(statsUpdate).forEach(([key, val]) => {
        const statKey = key as keyof PlayerStats;
        if (typeof val === "string" && val === "MAX") {
          if (statKey === "sinhLuc")
            personToUpdate.stats!.sinhLuc = personToUpdate.stats!.maxSinhLuc;
          if (statKey === "linhLuc")
            personToUpdate.stats!.linhLuc = personToUpdate.stats!.maxLinhLuc;
        } else if (
          typeof val === "number" ||
          (typeof val === "string" &&
            (val.startsWith("+=") || val.startsWith("-=") || val.endsWith("%")))
        ) {
          let numVal = 0;
          const currentStat = (personToUpdate.stats as any)[statKey] || 0;

          if (typeof val === "string") {
            if (val.endsWith("%")) {
              const isSub = val.includes("-");
              const pct = parseFloat(val.replace("+=", "").replace("-=", "").replace("+", "").replace("-", "").slice(0, -1));
              if (!isNaN(pct)) {
                const maxVal = statKey === "sinhLuc" ? (personToUpdate.stats!.maxSinhLuc || 100) : (personToUpdate.stats!.maxLinhLuc || 100);
                let delta = Math.floor(maxVal * (pct / 100));
                if (isSub) delta = -delta;
                numVal = currentStat + delta;
              }
            } else {
              const change = parseInt(val.substring(2), 10);
              if (val.startsWith("+=")) numVal = currentStat + change;
              if (val.startsWith("-=")) numVal = currentStat - change;
            }
          } else {
            numVal = val;
          }
          (personToUpdate.stats as any)[statKey] = numVal;
        }
      });

      // CHỐT CHẶN CƠ HỌC: Sinh lực không giảm xuống dưới 20% trừ khi có death="true"
      if (!isDeath && oldHp !== undefined && personToUpdate.stats.sinhLuc !== undefined) {
        const newHp = personToUpdate.stats.sinhLuc;
        if (newHp < oldHp) {
          const maxHp = personToUpdate.stats.maxSinhLuc || 100;
          const minHpFloor = Math.floor(maxHp * 0.20);
          const targetFloor = Math.min(oldHp, minHpFloor);
          if (newHp < targetFloor) {
            personToUpdate.stats.sinhLuc = targetFloor;
          }
        }
      }

      updatedFieldsCount++;
    } catch (e) {
      console.warn(`Error parsing statsJSON for ${personToUpdate.name}:`, e);
    }
  }

  if (shouldFree) updatedFieldsCount++;
  return { updatedCount: updatedFieldsCount, affinityChange, systemMessages, shouldFree };
};

export const processWifeUpdate = async (
  currentKb: KnowledgeBase,
  tagParams: Record<string, string>,
  turnForSystemMessages: number,
  summaryQueue?: BatchSummaryRequestItem[],
): Promise<{
  updatedKb: KnowledgeBase;
  systemMessages: GameMessage[];
  updatedVectorMetadata?: VectorMetadata;
  affinityChange?: { name: string; delta: number };
}> => {
  const newKb = currentKb;
  const systemMessages: GameMessage[] = [];
  const name = tagParams.name || "";
  const target = tagParams.target || "";
  let updatedVectorMetadata: VectorMetadata | undefined = undefined;
  let affinityChange: { name: string; delta: number } | undefined = undefined;

  if (!name && !target) return { updatedKb: newKb, systemMessages };

  const resolved = resolveNpcEntity(newKb, {
    target: target,
    id: tagParams.id || tagParams.targetId,
    name: name,
  });

  const wife = resolved && resolved.listType === "wife" ? resolved.npc : null;
  if (wife) {
    const {
      updatedCount,
      affinityChange: delta,
      systemMessages: descUpdateMessages,
    } = await processPersonUpdate(
      wife,
      tagParams,
      "wife",
      turnForSystemMessages,
      summaryQueue,
    );
    systemMessages.push(...descUpdateMessages);
    if (updatedCount > 0) {
      systemMessages.push({
        id: `wife-update-${wife.id}-${Date.now()}`,
        type: "system",
        content: `Trạng thái của đạo lữ ${wife.name} đã thay đổi.`,
        timestamp: Date.now(),
        turnNumber: turnForSystemMessages,
      });
      updatedVectorMetadata = {
        entityId: wife.id,
        entityType: "wife",
        text: formatPersonForEmbedding(wife),
      };
    }
    if (delta !== null) {
      affinityChange = { name: wife.name, delta };
    }
  }
  return {
    updatedKb: newKb,
    systemMessages,
    updatedVectorMetadata,
    affinityChange,
  };
};

export const processSlaveUpdate = async (
  currentKb: KnowledgeBase,
  tagParams: Record<string, string>,
  turnForSystemMessages: number,
  summaryQueue?: BatchSummaryRequestItem[],
): Promise<{
  updatedKb: KnowledgeBase;
  systemMessages: GameMessage[];
  updatedVectorMetadata?: VectorMetadata;
  affinityChange?: { name: string; delta: number };
}> => {
  const newKb = currentKb;
  const systemMessages: GameMessage[] = [];
  const name = tagParams.name || "";
  const target = tagParams.target || "";
  let updatedVectorMetadata: VectorMetadata | undefined = undefined;
  let affinityChange: { name: string; delta: number } | undefined = undefined;

  if (!name && !target) return { updatedKb: newKb, systemMessages };

  const resolved = resolveNpcEntity(newKb, {
    target: target,
    id: tagParams.id || tagParams.targetId,
    name: name,
  });

  const slave = resolved && resolved.listType === "slave" ? resolved.npc : null;
  if (slave) {
    const {
      updatedCount,
      affinityChange: delta,
      systemMessages: descUpdateMessages,
      shouldFree,
    } = await processPersonUpdate(
      slave,
      tagParams,
      "slave",
      turnForSystemMessages,
      summaryQueue,
    );
    systemMessages.push(...descUpdateMessages);

    if (shouldFree) {
        // Move to discoveredNPCs
        const newNpc: NPC = {
            ...slave,
            entityType: undefined,
            isFollowingPlayer: false,
        } as any;
        newKb.discoveredNPCs.push(newNpc);
        newKb.slaves = newKb.slaves.filter(s => s.id !== slave.id);
        
        systemMessages.push({
            id: `slave-freed-${slave.id}`,
            type: "system",
            content: `Nô lệ ${slave.name} đã được giải thoát và trở thành người tự do.`,
            timestamp: Date.now(),
            turnNumber: turnForSystemMessages,
        });
    } else if (updatedCount > 0) {
      systemMessages.push({
        id: `slave-update-${slave.id}-${Date.now()}`,
        type: "system",
        content: `Trạng thái của nô lệ ${slave.name} đã thay đổi.`,
        timestamp: Date.now(),
        turnNumber: turnForSystemMessages,
      });
      updatedVectorMetadata = {
        entityId: slave.id,
        entityType: "slave",
        text: formatPersonForEmbedding(slave),
      };
    }
    if (delta !== null) {
      affinityChange = { name: slave.name, delta };
    }
  }
  return {
    updatedKb: newKb,
    systemMessages,
    updatedVectorMetadata,
    affinityChange,
  };
};

export const processPrisonerUpdate = async (
  currentKb: KnowledgeBase,
  tagParams: Record<string, string>,
  turnForSystemMessages: number,
  summaryQueue?: BatchSummaryRequestItem[],
): Promise<{
  updatedKb: KnowledgeBase;
  systemMessages: GameMessage[];
  updatedVectorMetadata?: VectorMetadata;
  affinityChange?: { name: string; delta: number };
}> => {
  const newKb = currentKb;
  const systemMessages: GameMessage[] = [];
  const name = tagParams.name || "";
  const target = tagParams.target || "";
  let updatedVectorMetadata: VectorMetadata | undefined = undefined;
  let affinityChange: { name: string; delta: number } | undefined = undefined;

  if (!name && !target) return { updatedKb: newKb, systemMessages };

  const resolved = resolveNpcEntity(newKb, {
    target: target,
    id: tagParams.id || tagParams.targetId,
    name: name,
  });

  const prisoner = resolved && resolved.listType === "prisoner" ? resolved.npc : null;
  if (prisoner) {
    const {
      updatedCount,
      affinityChange: delta,
      systemMessages: descUpdateMessages,
      shouldFree,
    } = await processPersonUpdate(
      prisoner,
      tagParams,
      "prisoner",
      turnForSystemMessages,
      summaryQueue,
    );
    systemMessages.push(...descUpdateMessages);

    if (shouldFree) {
        // Move to discoveredNPCs
        const newNpc: NPC = {
            ...prisoner,
            entityType: undefined,
            isFollowingPlayer: false,
        } as any;
        newKb.discoveredNPCs.push(newNpc);
        newKb.prisoners = newKb.prisoners.filter(p => p.id !== prisoner.id);
        
        systemMessages.push({
            id: `prisoner-freed-${prisoner.id}`,
            type: "system",
            content: `Tù nhân ${prisoner.name} đã được trả tự do.`,
            timestamp: Date.now(),
            turnNumber: turnForSystemMessages,
        });
    } else if (updatedCount > 0) {
      updatedVectorMetadata = {
        entityId: prisoner.id,
        entityType: "prisoner",
        text: formatPersonForEmbedding(prisoner),
      };
    }
    if (delta !== null) {
      affinityChange = { name: prisoner.name, delta };
    }
  }
  return {
    updatedKb: newKb,
    systemMessages,
    updatedVectorMetadata,
    affinityChange,
  };
};

export const processPrisonerAdd = (
  currentKb: KnowledgeBase,
  tagParams: Record<string, string>,
  turnForSystemMessages: number,
): {
  updatedKb: KnowledgeBase;
  systemMessages: GameMessage[];
  newVectorMetadata?: VectorMetadata;
} => {
  const newKb = currentKb;
  const systemMessages: GameMessage[] = [];

  const name = tagParams.name;
  const description = tagParams.description;

  if (!name) return { updatedKb: newKb, systemMessages };

  // CHECK: If prisoner with this name already exists
  const existingPrisonerIndex = newKb.prisoners.findIndex(p => p.name === name);
  if (existingPrisonerIndex > -1) {
    const existingPrisoner = newKb.prisoners[existingPrisonerIndex];
    if (description) {
      existingPrisoner.description = appendFormattedDescription(
        existingPrisoner.description || "",
        description,
        turnForSystemMessages,
        false
      );
    }
    console.log(`[TagProcessing] Prisoner "${name}" already exists in prisoners array.`);
    return { updatedKb: newKb, systemMessages };
  }

  // Find existing NPC in discoveredNPCs, slaves, or wives
  const existingInNpcIndex = newKb.discoveredNPCs.findIndex(n => n.name === name);
  const existingInSlaveIndex = newKb.slaves.findIndex(s => s.name === name);
  const existingInWifeIndex = newKb.wives.findIndex(w => w.name === name);

  let existingPerson: any = null;
  if (existingInNpcIndex > -1) {
    existingPerson = newKb.discoveredNPCs[existingInNpcIndex];
    newKb.discoveredNPCs.splice(existingInNpcIndex, 1);
    if (newKb.combatCompanionIds) {
      newKb.combatCompanionIds = newKb.combatCompanionIds.filter(id => id !== existingPerson.id);
    }
  } else if (existingInSlaveIndex > -1) {
    existingPerson = newKb.slaves[existingInSlaveIndex];
    newKb.slaves.splice(existingInSlaveIndex, 1);
  } else if (existingInWifeIndex > -1) {
    existingPerson = newKb.wives[existingInWifeIndex];
    newKb.wives.splice(existingInWifeIndex, 1);
  }

  let newPrisoner: Prisoner;

  if (existingPerson) {
    // CONVERT EXISTING NPC TO PRISONER, RETAINING 100% OF ORIGINAL ATTRIBUTES
    const updatedStats = { ...(existingPerson.stats || {}) };
    updatedStats.sinhLuc = Math.max(1, updatedStats.sinhLuc || 1); // Đảm bảo luôn có ít nhất 1 HP

    newPrisoner = {
      ...existingPerson,
      stats: updatedStats,
      entityType: "prisoner",
      satisfaction: 100,
      captureReason: tagParams.captureReason || "Bị bắt giữ",
      lastInteractionTurn: turnForSystemMessages,
    };
    if (description) {
      newPrisoner.description = appendFormattedDescription(
        newPrisoner.description || "",
        description,
        turnForSystemMessages,
        false
      );
    }
    if (tagParams.realm) {
      newPrisoner.realm = RealmParserService.cleanRealmString(tagParams.realm);
    }
  } else {
    // BRAND NEW PRISONER CREATION
    const preservedId = `prisoner-${name.replace(/\s+/g, "-")}-${Date.now()}`;
    newPrisoner = {
      id: preservedId,
      name,
      description: description || "",
      entityType: "prisoner",
      gender: (tagParams.gender as any) || "Không rõ",
      race: tagParams.race || "Nhân Tộc",
      realm: tagParams.realm
        ? RealmParserService.cleanRealmString(tagParams.realm)
        : "Phàm Nhân",
      affinity: parseInt(tagParams.affinity, 10) || -50,
      willpower: parseInt(tagParams.willpower, 10) || 50,
      obedience: parseInt(tagParams.obedience, 10) || 10,
      resistance: parseInt(tagParams.resistance, 10) || 90,
      stats: {},
      skills: [],
      equippedItems: {
        mainWeapon: null, offHandWeapon: null, head: null, body: null,
        hands: null, legs: null, artifact: null, pet: null, accessory1: null, accessory2: null,
      },
      lastInteractionTurn: turnForSystemMessages,
    };

    if (newKb.worldConfig?.isCultivationEnabled && newPrisoner.realm) {
      const raceSystem =
        newKb.worldConfig.raceCultivationSystems.find(
          (rs) => rs.raceName === newPrisoner.race,
        ) || newKb.worldConfig.raceCultivationSystems[0];
      if (raceSystem) {
        const progression = RealmParserService.parseMajorRealms(
          raceSystem.realmSystem,
        );
        const baseStats = calculateRealmBaseStats(
          newPrisoner.realm,
          progression,
          newKb.currentRealmBaseStats,
          newKb.minorRealmProgressionList,
        );
        newPrisoner.stats = {
          ...baseStats,
          maxSinhLuc: baseStats.baseMaxSinhLuc,
          maxLinhLuc: baseStats.baseMaxLinhLuc,
          sucTanCong: baseStats.baseSucTanCong,
          sinhLuc: Math.floor(baseStats.baseMaxSinhLuc * 0.2),
          linhLuc: 0,
        };
      }
    }
  }

  newKb.prisoners.push(newPrisoner);

  const newVectorMetadata = {
    entityId: newPrisoner.id,
    entityType: "prisoner" as const,
    text: formatPersonForEmbedding(newPrisoner),
  };

  systemMessages.push({
    id: `prisoner-added-${newPrisoner.id}`,
    type: "system",
    content: `Đã bắt giữ tù nhân: ${name} (giữ nguyên thuộc tính gốc).`,
    timestamp: Date.now(),
    turnNumber: turnForSystemMessages,
  });

  return { updatedKb: newKb, systemMessages, newVectorMetadata };
};

export const processWifeAdd = (
  currentKb: KnowledgeBase,
  tagParams: Record<string, string>,
  turnForSystemMessages: number,
): {
  updatedKb: KnowledgeBase;
  systemMessages: GameMessage[];
  newVectorMetadata?: VectorMetadata;
} => {
  const newKb = currentKb;
  const systemMessages: GameMessage[] = [];

  const name = tagParams.name;
  const description = tagParams.description;

  if (!name) return { updatedKb: newKb, systemMessages };

  // Instead of adding to a separate 'wives' array, we find the entity and update its status
  // 1. Check in discoveredNPCs
  const npcIndex = newKb.discoveredNPCs.findIndex(n => n.name === name);
  if (npcIndex > -1) {
    const npc = newKb.discoveredNPCs[npcIndex];
    npc.relationshipToPlayer = "Vợ chồng";
    npc.isBinhCanh = true;
    npc.isFollowingPlayer = true;
    if (description) {
      npc.description = appendFormattedDescription(
        npc.description || "",
        description,
        turnForSystemMessages,
        false
      );
    }
    if (tagParams.affinity) {
        let delta = parseInt(tagParams.affinity, 10) || 10;
        // Apply mechanical constraints: increase max 15, decrease max 50
        if (delta > 15) delta = 15;
        if (delta < -50) delta = -50;
        npc.affinity = Math.max(-100, Math.min(100, npc.affinity + delta));
    }

    systemMessages.push({
      id: `wife-added-npc-${npc.id}`,
      type: "system",
      content: `Đã xác nhận quan hệ vợ chồng với: ${name}.`,
      timestamp: Date.now(),
      turnNumber: turnForSystemMessages,
    });

    return { 
        updatedKb: newKb, 
        systemMessages,
        newVectorMetadata: {
            entityId: npc.id,
            entityType: "npc",
            text: formatPersonForEmbedding(npc)
        }
    };
  }

  // 2. Check in prisoners
  const prisonerIndex = newKb.prisoners.findIndex(p => p.name === name);
  if (prisonerIndex > -1) {
    const prisoner = newKb.prisoners[prisonerIndex];
    // Convert prisoner to NPC with spouse status
    const newNpc: NPC = {
        ...prisoner,
        relationshipToPlayer: "Vợ chồng",
        isBinhCanh: true,
        isFollowingPlayer: true,
    } as any; // Cast because NPC template might differ slightly from Prisoner interface in implementation details but structurally compatible
    
    // Ensure it's treated as NPC
    (newNpc as any).entityType = undefined; 

    if (description) {
      newNpc.description = appendFormattedDescription(
        newNpc.description || "",
        description,
        turnForSystemMessages,
        false
      );
    }
    
    newKb.discoveredNPCs.push(newNpc);
    newKb.prisoners.splice(prisonerIndex, 1);

    systemMessages.push({
      id: `wife-added-prisoner-${newNpc.id}`,
      type: "system",
      content: `Đã thu phục tù nhân ${name} trở thành vợ chồng/đạo lữ.`,
      timestamp: Date.now(),
      turnNumber: turnForSystemMessages,
    });

    return { 
        updatedKb: newKb, 
        systemMessages,
        newVectorMetadata: {
            entityId: newNpc.id,
            entityType: "npc",
            text: formatPersonForEmbedding(newNpc)
        }
    };
  }

  // 3. Check in slaves
  const slaveIndex = newKb.slaves.findIndex(s => s.name === name);
  if (slaveIndex > -1) {
    const slave = newKb.slaves[slaveIndex];
    // Convert slave to NPC
    const newNpc: NPC = {
        ...slave,
        relationshipToPlayer: "Vợ chồng",
        isBinhCanh: true,
        isFollowingPlayer: true,
    } as any;
    
    if (description) {
      newNpc.description = appendFormattedDescription(
        newNpc.description || "",
        description,
        turnForSystemMessages,
        false
      );
    }
    
    newKb.discoveredNPCs.push(newNpc);
    newKb.slaves.splice(slaveIndex, 1);

    systemMessages.push({
      id: `wife-added-slave-${newNpc.id}`,
      type: "system",
      content: `Đã giải thoát nô lệ ${name} và xác nhận quan hệ vợ chồng.`,
      timestamp: Date.now(),
      turnNumber: turnForSystemMessages,
    });

    return { 
        updatedKb: newKb, 
        systemMessages,
        newVectorMetadata: {
            entityId: newNpc.id,
            entityType: "npc",
            text: formatPersonForEmbedding(newNpc)
        }
    };
  }

  // 4. If not found at all (newly appearing wife - rare but possible via tags)
  const newWife: NPC = {
    id: `npc-wife-${name.replace(/\s+/g, "-")}-${Date.now()}`,
    name,
    description: description || "",
    gender: (tagParams.gender as any) || "Nữ",
    race: tagParams.race || "Nhân Tộc",
    realm: tagParams.realm ? RealmParserService.cleanRealmString(tagParams.realm) : "Phàm Nhân",
    affinity: 90,
    relationshipToPlayer: "Vợ chồng",
    isBinhCanh: true,
    isFollowingPlayer: true,
    personalityTraits: [],
  };

  newKb.discoveredNPCs.push(newWife);

  systemMessages.push({
    id: `wife-added-new-${newWife.id}`,
    type: "system",
    content: `Đã thêm nhân vật mới: ${name} (Quan hệ: Vợ chồng).`,
    timestamp: Date.now(),
    turnNumber: turnForSystemMessages,
  });

  return {
    updatedKb: newKb,
    systemMessages,
    newVectorMetadata: {
        entityId: newWife.id,
        entityType: "npc",
        text: formatPersonForEmbedding(newWife)
    }
  };
};

export const processSlaveAdd = (
  currentKb: KnowledgeBase,
  tagParams: Record<string, string>,
  turnForSystemMessages: number,
): {
  updatedKb: KnowledgeBase;
  systemMessages: GameMessage[];
  newVectorMetadata?: VectorMetadata;
} => {
  const newKb = currentKb;
  const systemMessages: GameMessage[] = [];

  const name = tagParams.name;
  const description = tagParams.description;

  if (!name) return { updatedKb: newKb, systemMessages };

  // CHECK: If slave with this name already exists
  const existingSlaveIndex = newKb.slaves.findIndex(s => s.name === name);
  if (existingSlaveIndex > -1) {
    const existingSlave = newKb.slaves[existingSlaveIndex];
    if (description) {
      existingSlave.description = appendFormattedDescription(
        existingSlave.description || "",
        description,
        turnForSystemMessages,
        false
      );
    }
    console.log(`[TagProcessing] Slave "${name}" already exists in slaves array.`);
    return { updatedKb: newKb, systemMessages };
  }

  // Find existing NPC in discoveredNPCs, prisoners, or wives
  const existingInNpcIndex = newKb.discoveredNPCs.findIndex(n => n.name === name);
  const existingInPrisonerIndex = newKb.prisoners.findIndex(p => p.name === name);
  const existingInWifeIndex = newKb.wives.findIndex(w => w.name === name);

  let existingPerson: any = null;
  if (existingInNpcIndex > -1) {
    existingPerson = newKb.discoveredNPCs[existingInNpcIndex];
    newKb.discoveredNPCs.splice(existingInNpcIndex, 1);
    if (newKb.combatCompanionIds) {
      newKb.combatCompanionIds = newKb.combatCompanionIds.filter(id => id !== existingPerson.id);
    }
  } else if (existingInPrisonerIndex > -1) {
    existingPerson = newKb.prisoners[existingInPrisonerIndex];
    newKb.prisoners.splice(existingInPrisonerIndex, 1);
  } else if (existingInWifeIndex > -1) {
    existingPerson = newKb.wives[existingInWifeIndex];
    newKb.wives.splice(existingInWifeIndex, 1);
  }

  let newSlave: Slave;

  if (existingPerson) {
    // CONVERT EXISTING NPC TO SLAVE, RETAINING 100% OF ORIGINAL ATTRIBUTES
    newSlave = {
      ...existingPerson,
      entityType: "slave",
      willpower: tagParams.willpower ? parseInt(tagParams.willpower, 10) : (existingPerson.willpower ?? 40),
      obedience: tagParams.obedience ? parseInt(tagParams.obedience, 10) : (existingPerson.obedience ?? 60),
      affinity: tagParams.affinity ? parseInt(tagParams.affinity, 10) : (existingPerson.affinity ?? -20),
      value: existingPerson.value ?? 1000,
      lastInteractionTurn: turnForSystemMessages,
    };
    if (description) {
      newSlave.description = appendFormattedDescription(
        newSlave.description || "",
        description,
        turnForSystemMessages,
        false
      );
    }
    if (tagParams.realm) {
      newSlave.realm = RealmParserService.cleanRealmString(tagParams.realm);
    }
  } else {
    // BRAND NEW SLAVE CREATION
    const preservedId = `slave-${name.replace(/\s+/g, "-")}-${Date.now()}`;
    newSlave = {
      id: preservedId,
      name,
      description: description || "",
      entityType: "slave",
      gender: (tagParams.gender as any) || "Nữ",
      race: tagParams.race || "Nhân Tộc",
      realm: tagParams.realm
        ? RealmParserService.cleanRealmString(tagParams.realm)
        : "Phàm Nhân",
      affinity: parseInt(tagParams.affinity, 10) || -20,
      willpower: parseInt(tagParams.willpower, 10) || 40,
      obedience: parseInt(tagParams.obedience, 10) || 60,
      stats: {},
      skills: [],
      equippedItems: {
        mainWeapon: null, offHandWeapon: null, head: null, body: null,
        hands: null, legs: null, artifact: null, pet: null, accessory1: null, accessory2: null,
      },
      value: 1000,
      lastInteractionTurn: turnForSystemMessages,
    };

    if (newKb.worldConfig?.isCultivationEnabled && newSlave.realm) {
      const raceSystem =
        newKb.worldConfig.raceCultivationSystems.find(
          (rs) => rs.raceName === newSlave.race,
        ) || newKb.worldConfig.raceCultivationSystems[0];
      if (raceSystem) {
        const progression = RealmParserService.parseMajorRealms(
          raceSystem.realmSystem,
        );
        const baseStats = calculateRealmBaseStats(
          newSlave.realm,
          progression,
          newKb.currentRealmBaseStats,
          newKb.minorRealmProgressionList,
        );
        newSlave.stats = {
          ...baseStats,
          maxSinhLuc: baseStats.baseMaxSinhLuc,
          maxLinhLuc: baseStats.baseMaxLinhLuc,
          sucTanCong: baseStats.baseSucTanCong,
          sinhLuc: baseStats.baseMaxSinhLuc,
          linhLuc: baseStats.baseMaxLinhLuc,
        };
      }
    }
  }

  newKb.slaves.push(newSlave);

  const newVectorMetadata = {
    entityId: newSlave.id,
    entityType: "slave" as const,
    text: formatPersonForEmbedding(newSlave),
  };

  systemMessages.push({
    id: `slave-added-${newSlave.id}`,
    type: "system",
    content: `Đã chuyển ${name} thành nô lệ (giữ nguyên thuộc tính gốc).`,
    timestamp: Date.now(),
    turnNumber: turnForSystemMessages,
  });

  return { updatedKb: newKb, systemMessages, newVectorMetadata };
};

export const processWifeRemove = (
  currentKb: KnowledgeBase,
  tagParams: Record<string, string>,
  turnForSystemMessages: number,
): { updatedKb: KnowledgeBase; systemMessages: GameMessage[] } => {
  const newKb = currentKb;
  const systemMessages: GameMessage[] = [];
  const name = tagParams.name;

  if (name) {
    // Also check discoveredNPCs and reset relationship if they were wives there
    const npc = newKb.discoveredNPCs.find(n => n.name === name);
    if (npc && npc.relationshipToPlayer === "Vợ chồng") {
        npc.relationshipToPlayer = "Người quen";
        npc.isBinhCanh = false;
        npc.isFollowingPlayer = false;
    }

    newKb.wives = newKb.wives.filter((w) => w.name !== name);
    systemMessages.push({
      id: `wife-removed-${Date.now()}`,
      type: "system",
      content: `Đạo lữ ${name} đã rời đi hoặc không còn quan hệ vợ chồng.`,
      timestamp: Date.now(),
      turnNumber: turnForSystemMessages,
    });
  }
  return { updatedKb: newKb, systemMessages };
};

export const processSlaveRemove = (
  currentKb: KnowledgeBase,
  tagParams: Record<string, string>,
  turnForSystemMessages: number,
): { updatedKb: KnowledgeBase; systemMessages: GameMessage[] } => {
  const newKb = currentKb;
  const systemMessages: GameMessage[] = [];
  const name = tagParams.name;

  if (name) {
    const slaveIndex = newKb.slaves.findIndex((s) => s.name === name);
    if (slaveIndex > -1) {
      const slave = newKb.slaves[slaveIndex];
      newKb.slaves.splice(slaveIndex, 1);

      // If freed, restore to discoveredNPCs keeping 100% of stats
      if (tagParams.free === "true" || tagParams.freed === "true") {
        const freedNpc: NPC = {
          ...slave,
          entityType: undefined,
          isFollowingPlayer: false,
          relationshipToPlayer: "Người quen",
        } as any;
        if (!newKb.discoveredNPCs.some(n => n.name === name)) {
          newKb.discoveredNPCs.push(freedNpc);
        }
      }
    }

    systemMessages.push({
      id: `slave-removed-${Date.now()}`,
      type: "system",
      content: `Nô lệ ${name} đã bị xóa khỏi danh sách nô lệ.`,
      timestamp: Date.now(),
      turnNumber: turnForSystemMessages,
    });
  }
  return { updatedKb: newKb, systemMessages };
};

export const processPrisonerRemove = (
  currentKb: KnowledgeBase,
  tagParams: Record<string, string>,
  turnForSystemMessages: number,
): { updatedKb: KnowledgeBase; systemMessages: GameMessage[] } => {
  const newKb = currentKb;
  const systemMessages: GameMessage[] = [];
  const name = tagParams.name;

  if (name) {
    const prisonerIndex = newKb.prisoners.findIndex((p) => p.name === name);
    if (prisonerIndex > -1) {
      const prisoner = newKb.prisoners[prisonerIndex];
      newKb.prisoners.splice(prisonerIndex, 1);

      // If freed, restore to discoveredNPCs keeping 100% of stats
      if (tagParams.free === "true" || tagParams.freed === "true") {
        const freedNpc: NPC = {
          ...prisoner,
          entityType: undefined,
          isFollowingPlayer: false,
          relationshipToPlayer: "Người quen",
        } as any;
        if (!newKb.discoveredNPCs.some(n => n.name === name)) {
          newKb.discoveredNPCs.push(freedNpc);
        }
      }
    }

    systemMessages.push({
      id: `prisoner-removed-${Date.now()}`,
      type: "system",
      content: `Tù nhân ${name} đã không còn bị giam giữ.`,
      timestamp: Date.now(),
      turnNumber: turnForSystemMessages,
    });
  }
  return { updatedKb: newKb, systemMessages };
};
