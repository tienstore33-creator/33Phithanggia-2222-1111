// FIX: Add React import to resolve namespace errors.
import React, { useCallback, useState } from 'react';
// FIX: Add GameLocation to imports for the new handleTravelToLocation function
// FIX: Add Combatant to import from types.ts and remove the incorrect import from CombatScreen.
// FIX: Added UIState and StartingSkill to imports
import { DefeatOutcome, determineDefeatOutcome } from '../src/logic/combatDefeatHandler';
import { processFatality, HardcoreDeathResult } from '../src/logic/deathMechanics';
import { KnowledgeBase, GameMessage, WorldSettings, PlayerActionInputType, ResponseLength, GameScreen, RealmBaseStatDefinition, TurnHistoryEntry, AuctionState, Item as ItemType, AuctionCommentaryEntry, FindLocationParams, Prisoner, Wife, Slave, CombatEndPayload, AuctionSlave, NPC, CombatDispositionMap, GameLocation, Skill, WorldLoreEntry, YeuThu, PlayerStats, AuctionItem, Combatant, OfflineCombatSkill, UIState, AiChoice, StartingSkill, PlayerSpecialStatus, StyleSettings, StatusEffect, EconomicZoneStub, EconomicZoneType, EquipmentSlotId, TuChatTier } from '../types';
// FIX: Add generateTravelEvent to imports
// FIX: Add generateEcoZoneDetails to imports
import { countTokens, getApiSettings as getGeminiApiSettings, handleCompanionInteraction, handlePrisonerInteraction, summarizeCompanionInteraction, summarizePrisonerInteraction, generateNonCombatDefeatConsequence, generateSlaveAuctionData, runSlaveAuctionTurn, runSlaveAuctioneerCall, generateVictoryConsequence, summarizeCombat, generateDefeatConsequence, generateCraftedItemViaAI, findLocationWithAI, generateNextTurn, generateTravelEvent, generateMemoryFromNarration, judgeChallengeConsequences, generateEcoZoneDetails, generateEconomyLocations, generatePossessionNarration, generateEnterSamsaraNarration, callGeminiAPI } from '../services/geminiService';
import { analyzeCombatants, resolveCombatantIds } from '../services/CombatTriggerAnalyst';
import { limitCombatParticipants } from '../utils/combatLimiter';
import { CombatEquipmentGenerator } from '../services/CombatEquipmentGenerator';
import { extractLootFromDefeatedEntities } from '../utils/postCombatLootService';
import { normalizeNpcRealmsApi } from '../services/normalizeRealmService';
import { parseRealm, ensureValidOrLowestRealm } from '../utils/realmUtils';
import { getEffectiveRealmSystem } from '../services/realmManager';
import { DataExtractionService } from '../services/dataExtractionService';
import { runFlashAgentAsync, saveFlashAgentMemoryOffline } from '../services/FlashAgentService';
import { useSetupActions } from './actions/useSetupActions';
import { useAuctionActions, useSlaveAuctionActions } from './actions/useAuctionActions';
// FIX: Corrected the import path for useMainGameLoop.
import { useMainGameLoop } from './useMainGameLoop';
import { useCultivationActions } from './useCultivationActions';
// FIX: Import calculatePrisonerValue to resolve usage error.
// FIX: Add processCoreMemoryAdd to imports
// FIX: Import performTagProcessing
import { performTagProcessing, addTurnHistoryEntryRaw, calculatePrisonerValue, calculateSlaveValue, processCoreMemoryAdd } from '../utils/gameLogicUtils';
import { extractTagsFromText } from '../utils/tagUtils';
import { extractSatelliteTags } from '../services/satelliteTagExtractor';
import { MasterIntegrityService } from '../services/MasterIntegrityService';
import { cleanTextFromXmlUpdates } from '../utils/xmlUpdateParser';
import { extractMainStoryContent } from '../utils/journalParser';
import { calculateRealmBaseStats, calculateEffectiveStats, updateEntityStatsFromRealm } from '../utils/statsCalculationUtils';
// FIX: Corrected typo in SUB_REALM_NAMES import
import { VIETNAMESE, INITIAL_KNOWLEDGE_BASE, DEFAULT_WORLD_SETTINGS, DEFAULT_PLAYER_STATS, SUB_REALM_NAMES, DEFAULT_TIERED_STATS, TU_CHAT_VALUE_MULTIPLIERS } from '../constants'; // Import DEFAULT_PLAYER_STATS and SUB_REALM_NAMES
import { SPECIAL_EFFECT_KEYWORDS } from '../constants/economy';
import * as GameTemplates from '../templates';
import { grantCombatExp } from '../utils/npcProgressionService';
import { generateEcoZoneJsonData } from '../services/geminiService2';
import { applyEcoZoneJsonDataToKb } from '../services/economy/EcoZoneJsonService';

/**
 * Handles the logic for a character learning a skill from a "Ngọc Giản" (LinhKi item) offline.
 * @param kb Current KnowledgeBase.
 * @param targetPerson The character who will learn the skill.
 * @param itemName The name of the item being used.
 * @returns An object with the updated KB and a system message, or null if the action is not applicable.
 */
const handleOfflineSkillLearning = (
    kb: KnowledgeBase,
    targetPerson: Prisoner | Wife | Slave,
    itemName: string
): { updatedKb: KnowledgeBase; systemMessage: GameMessage | null } | null => {
    
    const itemInInventory = kb.inventory.find(i => i.name === itemName);
    if (!itemInInventory || itemInInventory.category !== GameTemplates.ItemCategory.LINH_KI) {
        return null; // Not a skill slip, let AI handle it.
    }

    const skillSlip = itemInInventory as GameTemplates.LinhKiTemplate;
    if (!skillSlip.skillToLearnJSON) {
        return null; // Item is misconfigured, let AI handle it.
    }

    let startingSkill: StartingSkill;
    try {
        startingSkill = JSON.parse(skillSlip.skillToLearnJSON);
    } catch (e) {
        console.error("Failed to parse skillToLearnJSON:", e);
        return null; // Malformed JSON, let AI handle it.
    }

    // Create a full SkillTemplate from StartingSkill, adapted from skillTagProcessor
    const newSkill: Skill = {
        id: `skill-${(startingSkill.name || 'unknown').toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
        name: startingSkill.name!,
        description: startingSkill.description,
        skillType: startingSkill.skillType || GameTemplates.SkillType.KHAC,
        detailedEffect: startingSkill.specialEffects || startingSkill.description,
        manaCost: startingSkill.manaCost || 0,
        baseDamage: startingSkill.baseDamage || 0,
        damageMultiplier: startingSkill.damageMultiplier || 0,
        healingAmount: startingSkill.baseHealing || 0,
        healingMultiplier: startingSkill.healingMultiplier || 0,
        cooldown: startingSkill.cooldown || 0,
        currentCooldown: 0,
        proficiency: 0,
        maxProficiency: 100,
        proficiencyTier: "Sơ Nhập",
        congPhapDetails: startingSkill.congPhapDetails,
        linhKiDetails: startingSkill.linhKiDetails,
        professionDetails: startingSkill.professionDetails,
        camThuatDetails: startingSkill.camThuatDetails,
        thanThongDetails: startingSkill.thanThongDetails,
    };

    const newKb = JSON.parse(JSON.stringify(kb));

    // Find the target entity in the newKb to update it
    let targetEntityList: (Prisoner[] | Wife[] | Slave[]);
    if (targetPerson.entityType === 'prisoner') targetEntityList = newKb.prisoners;
    else if (targetPerson.entityType === 'wife') targetEntityList = newKb.wives;
    else targetEntityList = newKb.slaves;

    const targetIndex = targetEntityList.findIndex((p: any) => p.id === targetPerson.id);
    if (targetIndex === -1) {
        return null; // Should not happen
    }
    
    const targetToUpdate = targetEntityList[targetIndex];

    if (!targetToUpdate.skills) {
        targetToUpdate.skills = [];
    }

    // Check if skill is already known
    if (targetToUpdate.skills.some(s => s.name === newSkill.name)) {
        
  return {
            updatedKb: kb, // no change
            systemMessage: {
                id: `skill-learn-fail-duplicate-${Date.now()}`,
                type: 'system',
                content: `${targetToUpdate.name} đã biết kỹ năng "${newSkill.name}" rồi.`,
                timestamp: Date.now(),
                turnNumber: kb.playerStats.turn
            }
        };
    }
    
    targetToUpdate.skills.push(newSkill);
    
    // Consume item from player inventory
    const itemIndexInInventory = newKb.inventory.findIndex((i: ItemType) => i.id === skillSlip.id);
    if (itemIndexInInventory > -1) {
        newKb.inventory[itemIndexInInventory].quantity -= 1;
        if (newKb.inventory[itemIndexInInventory].quantity <= 0) {
            newKb.inventory.splice(itemIndexInInventory, 1);
        }
    }

    const systemMessage: GameMessage = {
        id: `skill-learn-offline-${Date.now()}`,
        type: 'system',
        content: `${targetToUpdate.name} đã dùng "${skillSlip.name}" và học được kỹ năng mới: ${newSkill.name}!`,
        timestamp: Date.now(),
        turnNumber: kb.playerStats.turn
    };

    return { updatedKb: newKb, systemMessage };
};

interface UseGameActionsProps {
  knowledgeBase: KnowledgeBase;
  setKnowledgeBase: React.Dispatch<React.SetStateAction<KnowledgeBase>>;
  gameMessages: GameMessage[];
  setGameMessages: React.Dispatch<React.SetStateAction<GameMessage[]>>; // Added for pruning
  addMessageAndUpdateState: (newMessages: GameMessage[], newKnowledgeBase: KnowledgeBase, startingCurrency?: number, callback?: () => void) => void;
  setRawAiResponsesLog: React.Dispatch<React.SetStateAction<string[]>>;
  setSentPromptsLog: React.Dispatch<React.SetStateAction<string[]>>;
  setSentEconomyPromptsLog: React.Dispatch<React.SetStateAction<string[]>>;
  setReceivedEconomyResponsesLog: React.Dispatch<React.SetStateAction<string[]>>;
  setSentGeneralSubLocationPromptsLog: React.Dispatch<React.SetStateAction<string[]>>;
  setReceivedGeneralSubLocationResponsesLog: React.Dispatch<React.SetStateAction<string[]>>;
  setLatestPromptTokenCount: React.Dispatch<React.SetStateAction<number | null | string>>;
  setSummarizationResponsesLog: React.Dispatch<React.SetStateAction<string[]>>;
  showNotification: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  setCurrentScreen: (screen: GameScreen) => void;
  isAutoPlaying: boolean;
  setIsAutoPlaying: React.Dispatch<React.SetStateAction<boolean>>;
  executeSaveGame: (kbToSave: KnowledgeBase, messagesToSave: GameMessage[], saveName: string, existingId: string | null, isAuto: boolean) => Promise<string | null>;
  storageType: string; 
  firebaseUser: null; // FirebaseUser replaced with null
  logNpcAvatarPromptCallback: (prompt: string) => void;
  setApiErrorWithTimeout: (message: string | null) => void;
  resetApiError: () => void;
  isLoadingApi: boolean;
  setIsLoadingApi: React.Dispatch<React.SetStateAction<boolean>>;
  setIsCultivating: React.Dispatch<React.SetStateAction<boolean>>;
  setSentCultivationPromptsLog: React.Dispatch<React.SetStateAction<string[]>>;
  setReceivedCultivationResponsesLog: React.Dispatch<React.SetStateAction<string[]>>;
  setCompanionInteractionLog: React.Dispatch<React.SetStateAction<string[]>>;
  setPrisonerInteractionLog: React.Dispatch<React.SetStateAction<string[]>>;
  setSentPrisonerPromptsLog: React.Dispatch<React.SetStateAction<string[]>>;
  setReceivedPrisonerResponsesLog: React.Dispatch<React.SetStateAction<string[]>>;
  setSentCompanionPromptsLog: React.Dispatch<React.SetStateAction<string[]>>;
  setReceivedCompanionResponsesLog: React.Dispatch<React.SetStateAction<string[]>>;
  setRetrievedRagContextLog: React.Dispatch<React.SetStateAction<string[]>>; // NEW
  onQuit: () => void;
  // New props for context
  currentPageMessagesLog: string;
  previousPageSummaries: string[];
  lastNarrationFromPreviousPage?: string;
  // New props for combat summary logs
  setSentCombatSummaryPromptsLog: React.Dispatch<React.SetStateAction<string[]>>;
  setReceivedCombatSummaryResponsesLog: React.Dispatch<React.SetStateAction<string[]>>;
  setSentVictoryConsequencePromptsLog: React.Dispatch<React.SetStateAction<string[]>>;
  setReceivedVictoryConsequenceResponsesLog: React.Dispatch<React.SetStateAction<string[]>>;
  uiState: UIState;
  setUiState: React.Dispatch<React.SetStateAction<UIState>>;
  styleSettings: StyleSettings;
  setIsStreaming: React.Dispatch<React.SetStateAction<boolean>>;
  setStreamingText: React.Dispatch<React.SetStateAction<string>>;
  isSwapping: boolean;
  setIsSwapping: React.Dispatch<React.SetStateAction<boolean>>;
  abortControllerRef: React.MutableRefObject<AbortController | null>;
  openEntityModal: (type: any, entity: any) => void;
  setActiveEconomyModal: (modal: { type: 'marketplace' | 'shopping_center', locationId: string } | null) => void;
  setActiveSlaveMarketModal: (modal: { type: 'slave_market', locationId: string } | null) => void;
}

export const useGameActions = (props: UseGameActionsProps) => {
  const { 
      setSentPromptsLog, setLatestPromptTokenCount, setIsLoadingApi, isLoadingApi, gameMessages, 
      knowledgeBase, setKnowledgeBase, addMessageAndUpdateState, showNotification, 
      setCurrentScreen, currentPageMessagesLog, previousPageSummaries, lastNarrationFromPreviousPage, 
      onQuit, logNpcAvatarPromptCallback, setRawAiResponsesLog, setApiErrorWithTimeout, 
      resetApiError, setSentEconomyPromptsLog, setReceivedEconomyResponsesLog, 
      setSentCombatSummaryPromptsLog, setReceivedCombatSummaryResponsesLog, 
      setSentVictoryConsequencePromptsLog, setReceivedVictoryConsequenceResponsesLog,
      setGameMessages, setPrisonerInteractionLog, setSentPrisonerPromptsLog, setReceivedPrisonerResponsesLog,
      setCompanionInteractionLog, setSentCompanionPromptsLog, setReceivedCompanionResponsesLog,
      uiState, setUiState, styleSettings, setIsStreaming, setStreamingText, isSwapping, setIsSwapping, abortControllerRef, openEntityModal, setActiveEconomyModal, setActiveSlaveMarketModal
    } = props;

  // ... (keep existing logSentPromptCallback and handleSetupComplete)
  const normalizeNpcRealms = async (npcsToNormalize: NPC[]) => {
      setIsLoadingApi(true);
      let apiResult: { results: any[]; modelUsed: string; executionTimeMs: number } = { results: [], modelUsed: '', executionTimeMs: 0 };
      try {
          let metaStr = '';
          let isRealmUpdated = false;

          // 1. If there are NPCs with invalid realms, call AI API to normalize realm names
          if (npcsToNormalize && npcsToNormalize.length > 0) {
              const { results, modelUsed, executionTimeMs } = await normalizeNpcRealmsApi(knowledgeBase, npcsToNormalize);
              apiResult = { results, modelUsed, executionTimeMs };
              const timeSec = (executionTimeMs / 1000).toFixed(1);
              metaStr = ` [Model: ${modelUsed} | Thời gian: ${timeSec}s]`;
          }

          // 2. Perform mechanical stats checking & normalization for MC and ALL NPCs
          let mechanicalUpdated = false;

          const newKb = {
              ...knowledgeBase,
              playerStats: knowledgeBase.playerStats ? { ...knowledgeBase.playerStats } : undefined,
              discoveredNPCs: (knowledgeBase.discoveredNPCs || []).map(npc => ({
                  ...npc,
                  stats: npc.stats ? { ...npc.stats } : undefined
              })),
              wives: (knowledgeBase.wives || []).map(w => ({
                  ...w,
                  stats: w.stats ? { ...w.stats } : undefined
              })),
              slaves: (knowledgeBase.slaves || []).map(s => ({
                  ...s,
                  stats: s.stats ? { ...s.stats } : undefined
              })),
              prisoners: (knowledgeBase.prisoners || []).map(p => ({
                  ...p,
                  stats: p.stats ? { ...p.stats } : undefined
              })),
              companions: (knowledgeBase.companions || []).map(c => ({
                  ...c,
                  stats: c.stats ? { ...c.stats } : undefined
              })),
              currentRealmBaseStats: knowledgeBase.currentRealmBaseStats ? { ...knowledgeBase.currentRealmBaseStats } : undefined
          };

          const realmSystem = getEffectiveRealmSystem(newKb);

          // Force refresh realm stats from DEFAULT_TIERED_STATS to ensure the exact formula is applied
          if (newKb.currentRealmBaseStats && realmSystem.majorRealms) {
              realmSystem.majorRealms.forEach((realmName, index) => {
                  const latestStatDef = DEFAULT_TIERED_STATS[Math.min(index, DEFAULT_TIERED_STATS.length - 1)];
                  const currentStatDef = newKb.currentRealmBaseStats![realmName];
                  if (!currentStatDef || currentStatDef.hpBase !== latestStatDef.hpBase || currentStatDef.expBase !== latestStatDef.hpBase) {
                      newKb.currentRealmBaseStats![realmName] = {
                          ...latestStatDef,
                          expBase: latestStatDef.hpBase,
                          expInc: latestStatDef.hpInc
                      };
                      mechanicalUpdated = true;
                  }
              });
          }

          // Update realm strings if AI returned results
          if (apiResult.results && apiResult.results.length > 0) {
              const updateListRealm = (list: any[]) => {
                  if (!list) return false;
                  let updated = false;
                  for (const npc of list) {
                      const updateObj = apiResult.results.find((r: any) => 
                          (r.id && npc.id && r.id.trim() === npc.id.trim()) ||
                          (r.name && npc.name && r.name.trim().toLowerCase() === npc.name.trim().toLowerCase())
                      );
                      if (updateObj && updateObj.newRealm) {
                          // Áp dụng cơ chế bẻ lái cơ học để chặn kết quả lỗi "Phàm Nhân" từ AI
                          const finalRealm = ensureValidOrLowestRealm(updateObj.newRealm, newKb);
                          if (finalRealm !== npc.realm) {
                              npc.realm = finalRealm;
                              updated = true;
                          }
                      }
                  }
                  return updated;
              };
              if (updateListRealm(newKb.discoveredNPCs)) isRealmUpdated = true;
              if (updateListRealm(newKb.wives)) isRealmUpdated = true;
              if (updateListRealm(newKb.slaves)) isRealmUpdated = true;
              if (updateListRealm(newKb.prisoners)) isRealmUpdated = true;
              if (updateListRealm(newKb.companions)) isRealmUpdated = true;
          }

          const isOutOfRange = (val: number, expected: number) => {
              if (expected <= 0) return false;
              return val < expected * 0.95 || val > expected * 1.05;
          };

          // Fix MC
          if (newKb.playerStats && !newKb.playerStats.isDead && (newKb.playerStats.thoNguyen === undefined || newKb.playerStats.thoNguyen >= 1)) {
              const mcBase = calculateRealmBaseStats(
                  newKb.playerStats.realm || "Phàm Nhân",
                  realmSystem.majorRealms,
                  newKb.currentRealmBaseStats,
                  realmSystem.minorRealms
              );
              const parsedMc = parseRealm(newKb.playerStats.realm || "Phàm Nhân", realmSystem);
              const expectedMcThoNguyen = parsedMc.majorIndex === 0 ? 120 : 100 * Math.pow(2, parsedMc.majorIndex);

              const currentMaxHp = newKb.playerStats.baseMaxSinhLuc || 0;
              const currentAtk = newKb.playerStats.baseSucTanCong || 0;
              const currentMaxMp = newKb.playerStats.baseMaxLinhLuc || 0;
              const currentThoNguyen = newKb.playerStats.maxThoNguyen || newKb.playerStats.thoNguyen || 0;
              const currentMaxExp = newKb.playerStats.maxKinhNghiem || 0;

              const isMcDeviant = isOutOfRange(currentMaxHp, mcBase.baseMaxSinhLuc) ||
                                  isOutOfRange(currentAtk, mcBase.baseSucTanCong) ||
                                  isOutOfRange(currentMaxMp, mcBase.baseMaxLinhLuc) ||
                                  isOutOfRange(currentThoNguyen, expectedMcThoNguyen) ||
                                  currentMaxExp !== mcBase.baseMaxSinhLuc;

              if (isMcDeviant) {
                  newKb.playerStats.baseMaxSinhLuc = mcBase.baseMaxSinhLuc;
                  newKb.playerStats.maxSinhLuc = mcBase.baseMaxSinhLuc + (newKb.playerStats.permanentSinhLucBonus || 0);
                  if (newKb.playerStats.sinhLuc > newKb.playerStats.maxSinhLuc) {
                      newKb.playerStats.sinhLuc = newKb.playerStats.maxSinhLuc;
                  }
                  newKb.playerStats.baseSucTanCong = mcBase.baseSucTanCong;
                  newKb.playerStats.sucTanCong = mcBase.baseSucTanCong;
                  newKb.playerStats.baseMaxLinhLuc = mcBase.baseMaxLinhLuc;
                  newKb.playerStats.maxLinhLuc = mcBase.baseMaxLinhLuc;
                  if (newKb.playerStats.linhLuc > newKb.playerStats.maxLinhLuc) {
                      newKb.playerStats.linhLuc = newKb.playerStats.maxLinhLuc;
                  }
                  newKb.playerStats.maxThoNguyen = expectedMcThoNguyen;
                  newKb.playerStats.thoNguyen = Math.min(typeof newKb.playerStats.thoNguyen === 'number' ? newKb.playerStats.thoNguyen : expectedMcThoNguyen, expectedMcThoNguyen);
                  newKb.playerStats.maxKinhNghiem = mcBase.baseMaxSinhLuc;
                  if (typeof newKb.playerStats.kinhNghiem !== 'number') {
                      newKb.playerStats.kinhNghiem = 0;
                  } else {
                      newKb.playerStats.kinhNghiem = Math.min(newKb.playerStats.kinhNghiem, newKb.playerStats.maxKinhNghiem);
                  }
                  mechanicalUpdated = true;
              }
          }

          // Fix NPCs
          const fixNpcListStats = (list: any[]) => {
              if (!list) return;
              for (const npc of list) {
                  if (npc.isDead || (npc.stats && typeof npc.stats.thoNguyen === 'number' && npc.stats.thoNguyen < 1)) {
                      continue;
                  }
                  const npcBase = calculateRealmBaseStats(
                      npc.realm || "Phàm Nhân",
                      realmSystem.majorRealms,
                      newKb.currentRealmBaseStats,
                      realmSystem.minorRealms
                  );
                  const parsed = parseRealm(npc.realm || "Phàm Nhân", realmSystem);
                  const expectedThoNguyen = parsed.majorIndex === 0 ? 120 : 100 * Math.pow(2, parsed.majorIndex);

                  if (!npc.stats) {
                      npc.stats = {
                          baseMaxSinhLuc: npcBase.baseMaxSinhLuc,
                          maxSinhLuc: npcBase.baseMaxSinhLuc,
                          sinhLuc: npcBase.baseMaxSinhLuc,
                          baseSucTanCong: npcBase.baseSucTanCong,
                          sucTanCong: npcBase.baseSucTanCong,
                          baseMaxLinhLuc: npcBase.baseMaxLinhLuc,
                          maxLinhLuc: npcBase.baseMaxLinhLuc,
                          linhLuc: npcBase.baseMaxLinhLuc,
                          baseMaxKinhNghiem: npcBase.baseMaxKinhNghiem,
                          maxKinhNghiem: npcBase.baseMaxKinhNghiem,
                          kinhNghiem: 0,
                          maxThoNguyen: expectedThoNguyen,
                          thoNguyen: expectedThoNguyen
                      };
                      mechanicalUpdated = true;
                      continue;
                  }

                  const hpToUse = npc.stats.baseMaxSinhLuc || npc.stats.maxSinhLuc || 0;
                  const atkToUse = npc.stats.baseSucTanCong || npc.stats.sucTanCong || 0;
                  const mpToUse = npc.stats.baseMaxLinhLuc || npc.stats.maxLinhLuc || 0;
                  const npcThoNguyen = npc.stats.maxThoNguyen || npc.stats.thoNguyen || 0;
                  const npcMaxExp = npc.stats.baseMaxKinhNghiem || npc.stats.maxKinhNghiem || 0;
                  const expectedExp = npcBase.baseMaxKinhNghiem;

                  const isNpcDeviant = isOutOfRange(hpToUse, npcBase.baseMaxSinhLuc) ||
                                       isOutOfRange(atkToUse, npcBase.baseSucTanCong) ||
                                       isOutOfRange(mpToUse, npcBase.baseMaxLinhLuc) ||
                                       isOutOfRange(npcThoNguyen, expectedThoNguyen) ||
                                       (expectedExp > 0 && (npcMaxExp < expectedExp * 0.99 || npcMaxExp > expectedExp * 1.01));

                  if (isNpcDeviant) {
                      // Dua cac chi so max/base ve 0 truoc khi khoi tao lai
                      npc.stats.maxSinhLuc = 0;
                      npc.stats.baseMaxSinhLuc = 0;
                      npc.stats.sucTanCong = 0;
                      npc.stats.baseSucTanCong = 0;
                      npc.stats.maxLinhLuc = 0;
                      npc.stats.baseMaxLinhLuc = 0;
                      npc.stats.maxThoNguyen = 0;
                      npc.stats.maxKinhNghiem = 0;
                      npc.stats.baseMaxKinhNghiem = 0;

                      // Tinh toan va gan lai chi so chuan
                      npc.stats.baseMaxSinhLuc = npcBase.baseMaxSinhLuc;
                      npc.stats.maxSinhLuc = npcBase.baseMaxSinhLuc + (npc.stats.permanentSinhLucBonus || 0);
                      npc.stats.sinhLuc = npc.stats.maxSinhLuc;
                      npc.stats.baseSucTanCong = npcBase.baseSucTanCong;
                      npc.stats.sucTanCong = npcBase.baseSucTanCong;
                      npc.stats.baseMaxLinhLuc = npcBase.baseMaxLinhLuc;
                      npc.stats.maxLinhLuc = npcBase.baseMaxLinhLuc;
                      npc.stats.linhLuc = npc.stats.maxLinhLuc;
                      npc.stats.maxThoNguyen = expectedThoNguyen;
                      npc.stats.thoNguyen = expectedThoNguyen;
                      npc.stats.baseMaxKinhNghiem = npcBase.baseMaxKinhNghiem;
                      npc.stats.maxKinhNghiem = npcBase.baseMaxKinhNghiem;
                      if (typeof npc.stats.kinhNghiem !== 'number') {
                          npc.stats.kinhNghiem = 0;
                      } else {
                          npc.stats.kinhNghiem = Math.min(npc.stats.kinhNghiem, npc.stats.maxKinhNghiem);
                      }
                      mechanicalUpdated = true;
                  }
              }
          };

          fixNpcListStats(newKb.discoveredNPCs);
          fixNpcListStats(newKb.wives);
          fixNpcListStats(newKb.slaves);
          fixNpcListStats(newKb.prisoners);
          fixNpcListStats(newKb.companions);

          if (isRealmUpdated || mechanicalUpdated) {
              setKnowledgeBase(newKb);
              showNotification(`Chuẩn hoá thực lực và chỉ số thành công!${metaStr}`, "success");
          } else {
              showNotification(`Đã kiểm tra xong, cảnh giới và chỉ số đã chuẩn xác.${metaStr}`, "info");
          }
      } catch (err: any) {
          console.error("Lỗi chuẩn hoá thực lực:", err);
          showNotification(`Đã có lỗi xảy ra khi chuẩn hoá thực lực: ${err?.message || err}`, "error");
      } finally {
          setIsLoadingApi(false);
      }
      return apiResult;
  };


  const logSentPromptCallback = useCallback((prompt: string, turnNumber?: number) => {
    setSentPromptsLog(prev => [prompt, ...prev].slice(0, 10));
    try {
      const currentTurn = turnNumber ?? (knowledgeBase?.playerStats?.turn || 0);
      // Chỉ giữ nội dung của duy nhất lượt gửi AI mới nhất, xóa toàn bộ lượt cũ
      const promptsList = [{ turn: currentTurn, prompt }];
      localStorage.setItem('latest_ai_prompts', JSON.stringify(promptsList));
    } catch (e) {
      console.warn("Failed to save latest prompt to localStorage", e);
    }

    const { model: currentModel } = getGeminiApiSettings();
    if (currentModel === 'gemini-2.5-flash-preview-04-17' || !currentModel.startsWith('gemini-1.5-flash')) { 
      setLatestPromptTokenCount('Đang tính...');
      countTokens(prompt)
        .then(count => setLatestPromptTokenCount(count))
        .catch(err => {
          console.warn("Could not count tokens for prompt:", err);
          setLatestPromptTokenCount('Lỗi');
        });
    } else {
       setLatestPromptTokenCount('N/A (model)');
    }
  }, [setSentPromptsLog, setLatestPromptTokenCount, knowledgeBase]);

  const logReceivedResponseCallback = useCallback((responseRaw: string, turnNumber: number) => {
    setRawAiResponsesLog(prev => [responseRaw, ...prev].slice(0, 50));
    try {
      // Chỉ giữ nội dung của duy nhất lượt phản hồi AI mới nhất
      const responsesList = [{ turn: turnNumber, response: responseRaw }];
      localStorage.setItem('latest_ai_responses', JSON.stringify(responsesList));
    } catch (e) {
      console.warn("Failed to save latest response to localStorage", e);
    }
  }, [setRawAiResponsesLog]);

  const { handleSetupComplete } = useSetupActions({
    ...props,
    setIsLoadingApi,
    logSentPromptCallback,
  });

  // ... (keep existing handleNonCombatDefeat, mainGameLoopActions, auctionActions, cultivationActions, handleTravelToLocation, handleCreateMemoryFromLastTurn, handlePrisonerAction, handleCompanionAction, handleExitPrisonerScreen, handleExitCompanionScreen, handleSuccession)
  const handleNonCombatDefeat = useCallback(async (kbStateAtDefeat: KnowledgeBase, fatalNarration?: string) => {
    // NEW CHECK: If player is already a prisoner or slave, prevent standard defeat.
    if (kbStateAtDefeat.playerStats.playerSpecialStatus) {
        showNotification("Bạn đã gục ngã nhưng số phận của bạn nằm trong tay chủ nhân.", "warning");
        const newKb = JSON.parse(JSON.stringify(kbStateAtDefeat));
        if (newKb.playerStats.sinhLuc <= 0 && !newKb.playerStats.isDead) {
            newKb.playerStats.sinhLuc = 1; // Heal to 1 HP to prevent repeated triggers
        }
        const systemMessage: GameMessage = {
            id: `non-combat-defeat-prevented-${Date.now()}`,
            type: 'system',
            content: `Bạn đã gục ngã, nhưng vì đang là ${newKb.playerStats.playerSpecialStatus.type === 'prisoner' ? 'tù nhân' : 'nô lệ'}, bạn không thể chết. Số phận của bạn sẽ do ${newKb.playerStats.playerSpecialStatus.ownerName} quyết định.`,
            timestamp: Date.now(),
            turnNumber: newKb.playerStats.turn
        };
        addMessageAndUpdateState([systemMessage], newKb);
        setIsLoadingApi(false); // Reset loading state set by the caller
        return; // Exit early to avoid the defeat consequence prompt
    }

    setIsLoadingApi(true);
    resetApiError();

    // PROCESS DEATH MECHANICALS
    const workingKb = JSON.parse(JSON.stringify(kbStateAtDefeat)) as KnowledgeBase;
    const deathOutcome = processFatality(workingKb, false);

    if (deathOutcome.type === 'samsara') {
        workingKb.playerStats.forcedHardcoreRebirth = true;
        workingKb.playerStats.isDead = true;
        
        const systemMsg: GameMessage = {
            id: `samsara-forced-sysmsg-${Date.now()}`,
            type: 'system',
            content: `\n*** LUÂN HỒI KHỐC LIỆT ***\nBạn đã tử vong quá 2 lần! Thân thể tàn tạ không thể cứu chữa, linh hồn bị cuốn phăng vào không gian Luân Hồi sâu thẳm. Bạn bắt buộc phải luân hồi chuyển kiếp chọn mốc MC mới!`,
            timestamp: Date.now(),
            turnNumber: workingKb.playerStats.turn
        };
        
        const narrationMsg: GameMessage = {
            id: `samsara-forced-narration-${Date.now()}`,
            type: 'narration',
            content: `Bạn đã ngã xuống lần thứ ba. Không còn bất kỳ tiên đan hay thế lực nào có thể níu giữ sinh mệnh của bạn ở kiếp này nữa. Linh hồn bạn lìa khỏi xác, bị lực lượng luân hồi vô tận kéo thẳng vào sâu trong hư vô. Mời bạn tiến bước vào Không gian Luân hồi để tái sinh.`,
            timestamp: Date.now(),
            turnNumber: workingKb.playerStats.turn,
            choices: []
        };
        
        addMessageAndUpdateState([narrationMsg, systemMsg], workingKb);
        showNotification("Linh hồn rơi vào không gian luân hồi!", 'warning');
        setIsLoadingApi(false);
        return;
    }

    // Persist the updated death count even if no special death was triggered
    kbStateAtDefeat.playerStats.deathCount = workingKb.playerStats.deathCount;

    showNotification("Bạn đã gục ngã! AI đang quyết định số phận của bạn...", 'warning');

    try {
        // @FIX: Corrected argument order to match service function signature.
        const { response, rawText } = await generateNonCombatDefeatConsequence(
            kbStateAtDefeat,
            currentPageMessagesLog,
            previousPageSummaries,
            fatalNarration || 'Bạn đã gục ngã do một sự kiện không rõ.',
            lastNarrationFromPreviousPage,
            (prompt) => setSentPromptsLog(prev => [prompt, ...prev].slice(0, 10))
        );
        logReceivedResponseCallback(rawText, kbStateAtDefeat.playerStats.turn + 1);

        const tagsToProcess = extractSatelliteTags(rawText, response?.tags);
        const {
            newKb: kbAfterTags,
            systemMessagesFromTags
        } = await performTagProcessing(
            kbStateAtDefeat, // We process tags based on the state *before* the consequence
            tagsToProcess,
            kbStateAtDefeat.playerStats.turn + 1, // Consequence is the next turn
            logNpcAvatarPromptCallback
        );
        
        kbAfterTags.pendingCombat = null;

        // CƠ HỌC HỒI PHỤC SAU CẢNH GỤC NGÃ/PHẢN PHỆ: Nếu MC vẫn còn thọ nguyên (>= 1 năm),
        // sau khi phát sinh diễn biến hậu quả gục ngã (được cứu, hồi tỉnh...), hồi sinh lực tối thiểu và mở khóa isDead.
        if (kbAfterTags.playerStats) {
            const hasLifespan = typeof kbAfterTags.playerStats.thoNguyen === 'number' 
                ? kbAfterTags.playerStats.thoNguyen >= 1 
                : true;
            // CHỈ hồi phục nếu KHÔNG phải là trường hợp đã xác định tử vong (isDead = true) từ trước (ví dụ: Tự sát)
            if (hasLifespan && !kbAfterTags.playerStats.isDead) {
                kbAfterTags.playerStats.isDead = false;
                if (kbAfterTags.playerStats.sinhLuc <= 0) {
                    kbAfterTags.playerStats.sinhLuc = Math.max(1, Math.floor((kbAfterTags.playerStats.maxSinhLuc || 100) * 0.1));
                }
            }
        }

        const narrationMessage: GameMessage = {
            id: 'non-combat-defeat-narration-' + Date.now(),
            type: 'narration',
            content: response.narration,
            timestamp: Date.now(),
            choices: response.choices,
            turnNumber: kbAfterTags.playerStats.turn, // Use the turn from after tag processing
        };
        
        const finalMessages = [narrationMessage, ...systemMessagesFromTags];
        addMessageAndUpdateState(finalMessages, kbAfterTags);

    } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Lỗi khi xử lý hậu quả.";
        setApiErrorWithTimeout(`Lỗi sinh hậu quả gục ngã: ${errorMsg}. Đã kích hoạt kịch bản dự phòng.`);
        
        // Kịch bản dự phòng: Khôi phục tối thiểu, tăng lượt và cho phép người chơi tiếp tục, tránh mất file cứu hộ
        const fallbackKb = { ...kbStateAtDefeat };
        fallbackKb.pendingCombat = null;
        if (fallbackKb.playerStats) {
            fallbackKb.playerStats.isDead = false;
            fallbackKb.playerStats.sinhLuc = Math.max(1, Math.floor((fallbackKb.playerStats.maxSinhLuc || 100) * 0.15));
            fallbackKb.playerStats.turn = (fallbackKb.playerStats.turn || 0) + 1;
        }

        const fallbackMessage: GameMessage = {
            id: 'non-combat-defeat-fallback-' + Date.now(),
            type: 'narration',
            content: `Bạn đột ngột cảm thấy toàn thân kiệt sức, trước mắt tối sầm rồi bất tỉnh nhân sự... May mắn thay, sau một khoảng thời gian dài hôn mê, bạn chậm rãi mở mắt ra, phát hiện mình đang nằm ở một nơi tương đối an toàn. Tuy sinh lực đã hồi phục một chút nhưng cơ thể vẫn còn cảm giác rã rời và uể oải vô cùng. (Lưu ý: API sinh hậu quả gặp lỗi và kịch bản câu chuyện dự phòng tự động đã được kích hoạt thành công để bảo toàn tiến trình của bạn).`,
            timestamp: Date.now(),
            choices: [
                { text: "Từ từ ngồi dậy điều hòa hơi thở", thought: "Mình cần phải cẩn thận hơn" },
                { text: "Nhìn dáo dác xung quanh xem đây là đâu", thought: "Nơi này có vẻ lạ lẫm" }
            ],
            turnNumber: fallbackKb.playerStats?.turn || 1,
        };

        addMessageAndUpdateState([fallbackMessage], fallbackKb);
    } finally {
        setIsLoadingApi(false);
    }
  }, [addMessageAndUpdateState, showNotification, setIsLoadingApi, setApiErrorWithTimeout, setRawAiResponsesLog, setSentPromptsLog, resetApiError, onQuit, setKnowledgeBase, logNpcAvatarPromptCallback, currentPageMessagesLog, lastNarrationFromPreviousPage, previousPageSummaries]);

  const handleSuccession = useCallback(async (kbToModify: KnowledgeBase) => {
      // Clear the hunted state for the new character
      kbToModify.huntedState = null;

      const wasHardcore = kbToModify.playerStats?.forcedHardcoreRebirth || false;

      // Xóa triệt để các NPC đã chết / tọa hóa / hết thọ nguyên khỏi database
      kbToModify.discoveredNPCs = (kbToModify.discoveredNPCs || []).filter(npc => 
          !npc.isDead && 
          npc.status !== 'Đã tử vong (Tọa hóa)' && 
          npc.status !== 'Tử vong' && 
          npc.status !== '[ĐÃ CHẾT]' &&
          (npc.stats?.thoNguyen === undefined || npc.stats.thoNguyen >= 1)
      );

      // Rule 3: Permadeath / Succession Logic - UPDATED FOR FRESH START
      // If forcedHardcoreRebirth is true, we treat potentialSuccessors as empty to force creating a new player.
      const potentialSuccessors = wasHardcore ? [] : [...kbToModify.discoveredNPCs];
      
      let successor: NPC;

      if (potentialSuccessors.length === 0) {
          // Khi KHÔNG CÒN BẤT KỲ NPC NÀO CÒN SỐNG: Tự động sinh ra một Nhân Vật Chính mới hoàn toàn với bối cảnh Tiên Hiệp sinh động
          const SURNAMES = ['Lâm', 'Diệp', 'Sở', 'Thẩm', 'Trần', 'Lục', 'Bạch', 'Phương', 'Tô', 'Vương', 'Tiêu', 'Lý', 'Tần', 'Cố', 'Doãn', 'Nhan', 'Hạ', 'Phong'];
          const MALE_NAMES = ['Lăng Vũ', 'Thiên Mặc', 'Hoài Nam', 'Bất Vi', 'Vũ Phong', 'Nhất Dao', 'Trường Sinh', 'Tấn Triệt', 'Đạo Huyền', 'Thanh Trạch', 'Vân Khởi', 'Mô Phong', 'Cảnh Dao'];
          const FEMALE_NAMES = ['Dao Dao', 'Tuyết Anh', 'Thanh Y', 'Bích Vân', 'Nguyệt Như', 'Linh Nhi', 'Tư Duệ', 'Tử Câm', 'Hạ Vũ', 'Tố Tâm', 'Băng Nhi', 'Khinh Vũ'];
          const GENDERS = ['Nam', 'Nữ'];
          const SPIRITUAL_ROOTS = ['Lôi Biến Dị Linh Căn', 'Phong Biến Dị Linh Căn', 'Băng Linh Căn', 'Thuần Dương Đơn Linh Căn', 'Thiên Căn Luyện Khí', 'Bách Thảo Linh Căn', 'Hỏa Linh Căn'];
          const PHYSIQUES = ['Phàm Thể', 'Chân Long Phụ Thể', 'Cửu Âm Tuyệt Mạch', 'Thiên Tiên Linh Thể', 'Huyền Ấm Chi Thể', 'Thái Sơ Hỗn Độn Thể'];
          const TRAITS = ['Kiên định', 'Lạnh lùng', 'Sâu sắc', 'Nhanh trí', 'Trọng tình nghĩa', 'Bất khuất', 'Tự do'];
          const BACKSTORIES = [
              'Thiếu niên mang theo linh căn đột biến cổ xưa vừa bái nhập tiên môn, mang trong mình hoài hoài bảo quy tiên.',
              'Tán tu cô độc vô tình nhặt được tàn quyển bí kíp, bước vào con đường sinh tử truy tìm đại đạo.',
              'Kẻ may mắn sống sót qua thiên tai biến cố gia tộc, tiếp bước con đường gánh vác vận mệnh thiên hạ.',
              'Tu sĩ trẻ tuổi ngộ ra duyên cơ sau muôn vàn trắc trở, dấn thân vào con đường tu luyện trường sinh.'
          ];

          const randomGender = GENDERS[Math.floor(Math.random() * GENDERS.length)] as 'Nam' | 'Nữ';
          const surname = SURNAMES[Math.floor(Math.random() * SURNAMES.length)];
          const firstname = randomGender === 'Nam' 
              ? MALE_NAMES[Math.floor(Math.random() * MALE_NAMES.length)]
              : FEMALE_NAMES[Math.floor(Math.random() * FEMALE_NAMES.length)];
          const newName = `${surname} ${firstname}`;
          const spiritualRoot = SPIRITUAL_ROOTS[Math.floor(Math.random() * SPIRITUAL_ROOTS.length)];
          const physique = PHYSIQUES[Math.floor(Math.random() * PHYSIQUES.length)];
          const trait = TRAITS[Math.floor(Math.random() * TRAITS.length)];
          const backstory = BACKSTORIES[Math.floor(Math.random() * BACKSTORIES.length)];

          successor = {
              id: `ai-successor-${Date.now()}`,
              name: newName,
              gender: randomGender,
              race: 'Nhân Tộc',
              description: backstory,
              affinity: 0,
              realm: 'Luyện Khí Nhất Trọng',
              tuChat: 'Thượng Phẩm',
              spiritualRoot: spiritualRoot,
              specialPhysique: physique,
              stats: { 
                  ...DEFAULT_PLAYER_STATS, 
                  realm: 'Luyện Khí Nhất Trọng',
                  sinhLuc: 120,
                  maxSinhLuc: 120,
                  linhLuc: 80,
                  maxLinhLuc: 80,
                  thoNguyen: 120,
                  maxThoNguyen: 120
              },
              skills: [],
              personalityTraits: [trait],
              title: 'Tân Nhân Kế Thừa Vận Mệnh'
          };
      } else {
           // Randomly pick a successor from existing NPCs
          const successorIndex = Math.floor(Math.random() * potentialSuccessors.length);
          successor = potentialSuccessors[successorIndex];
          
          // Remove this NPC from the world list because they are becoming the player
          kbToModify.discoveredNPCs = kbToModify.discoveredNPCs.filter(n => n.id !== successor.id);
      }

      const oldMcName = kbToModify.worldConfig?.playerName || "Người đi trước";
      const oldMcGender = kbToModify.worldConfig?.playerGender || 'Nam';
      const oldMcRace = kbToModify.worldConfig?.playerRace || 'Nhân Tộc';
      const oldMcRealm = kbToModify.playerStats?.realm || 'Phàm Nhân';
      const oldMcStats = { ...kbToModify.playerStats, sinhLuc: 0 };
      
      // 1. Create a Lore Entry about the fallen hero
      const deathLore: WorldLoreEntry = {
          id: `lore-death-${Date.now()}`,
          title: `Sự Ra Đi Của ${oldMcName}`,
          content: `${oldMcName} đã ngã xuống trên con đường tu tiên đầy chông gai. Câu chuyện của họ đã kết thúc, nhưng thế giới vẫn tiếp diễn. ${successor.name} đã xuất hiện và tiếp bước hành trình.`
      };
      if (!kbToModify.worldLore) kbToModify.worldLore = [];
      kbToModify.worldLore.push(deathLore);

      // Register deceased protagonist in worldConfig & knowledgeBase
      if (kbToModify.worldConfig) {
          kbToModify.worldConfig.deceasedProtagonists = Array.from(new Set([
              ...(kbToModify.worldConfig.deceasedProtagonists || []),
              oldMcName
          ]));
      }
      kbToModify.deceasedProtagonists = Array.from(new Set([
          ...(kbToModify.deceasedProtagonists || []),
          oldMcName
      ]));

      // Register old MC as deceased in discoveredNPCs so entity extraction / combat analysts know they are dead
      const existingOldMcIdx = (kbToModify.discoveredNPCs || []).findIndex(n => n.name === oldMcName);
      if (existingOldMcIdx >= 0) {
          kbToModify.discoveredNPCs[existingOldMcIdx] = {
              ...kbToModify.discoveredNPCs[existingOldMcIdx],
              status: 'Đã chết',
              stats: {
                  ...(kbToModify.discoveredNPCs[existingOldMcIdx].stats || {}),
                  sinhLuc: 0
              }
          };
      } else {
          kbToModify.discoveredNPCs.push({
              id: `deceased-mc-${Date.now()}`,
              name: oldMcName,
              description: `Cựu nhân vật chính tiền nhiệm, đã tử nạn.`,
              gender: oldMcGender,
              race: oldMcRace,
              realm: oldMcRealm,
              status: 'Đã chết',
              affinity: 0,
              tuChat: 'Trung Phẩm',
              stats: oldMcStats,
              locationId: kbToModify.currentLocationId,
              personalityTraits: ['Đã khuất']
          });
      }

      // 2. Update World Config with new identity
      if(kbToModify.worldConfig) {
          kbToModify.worldConfig.playerName = successor.name;
          kbToModify.worldConfig.originalPlayerName = successor.name;
          kbToModify.worldConfig.playerGender = (successor.gender as any) || 'Nam';
          kbToModify.worldConfig.playerRace = successor.race || 'Nhân Tộc';
          kbToModify.worldConfig.playerPersonality = (successor.personalityTraits || []).join(', ');
          kbToModify.worldConfig.playerBackstory = `Vốn là ${successor.title || 'một tu sĩ'} tên là ${successor.name}. ${successor.description}. Sau khi ${oldMcName} chết, số phận đã đẩy đưa bạn bước lên vũ đài chính.`;
          kbToModify.worldConfig.playerAvatarUrl = successor.avatarUrl;
      }
      // Update avatar data as well
      kbToModify.playerAvatarData = successor.avatarUrl;

      // 3. Reset Player Stats to match the Successor
      kbToModify.playerStats = {
          ...DEFAULT_PLAYER_STATS,
          originalPlayerName: successor.name,
          realm: successor.realm || 'Phàm Nhân',
          isDead: false,
          thoNguyen: typeof successor.stats?.thoNguyen === 'number' ? successor.stats.thoNguyen : 120,
          maxThoNguyen: typeof successor.stats?.maxThoNguyen === 'number' ? successor.stats.maxThoNguyen : 120,
          // Use successor stats if available, otherwise defaults
          sinhLuc: successor.stats?.sinhLuc || 100,
          maxSinhLuc: successor.stats?.maxSinhLuc || 100,
          linhLuc: successor.stats?.linhLuc || 50,
          maxLinhLuc: successor.stats?.maxLinhLuc || 50,
          sucTanCong: successor.stats?.sucTanCong || 10,
          kinhNghiem: 0, 
          
          // Reset meta-stats
          defeatCount: 0, 
          currency: successor.stats?.currency || Math.floor(Math.random() * 100), // Start with NPC's money or small amount
          
          // Copy traits
          spiritualRoot: successor.spiritualRoot || "Phàm Căn",
          specialPhysique: successor.specialPhysique || "Phàm Thể",
          tuChat: successor.tuChat || "Trung Phẩm",
          
          // Keep time moving forward
          turn: kbToModify.playerStats.turn, 
          
          // Reset status
          activeStatusEffects: [],
          playerSpecialStatus: null,
          professions: [], // Reset professions for now
          justHardcoreReborn: wasHardcore // Sét cờ hiệu hardcore reborn để AI đổi tên
      };
      
      // 4. Reset Skills & Inventory to give a fresh start feeling
      // Transfer any skills the NPC explicitly had
      kbToModify.playerSkills = successor.skills || [];
      kbToModify.inventory = []; // Clear old inventory (Fresh start)
      kbToModify.equippedItems = { // Clear equipment
          mainWeapon: null, offHandWeapon: null, head: null, body: null, hands: null, legs: null, artifact: null, pet: null, accessory1: null, accessory2: null 
      };
      
      // 5. Reset Relationships (Crucial for "Fresh Perspective")
      // Reset affinity of all remaining NPCs to 0 (Stranger) unless logic dictates otherwise.
      // For simplicity and "freshness", we reset all to 0/Stranger.
      kbToModify.discoveredNPCs.forEach(npc => {
          npc.affinity = 0;
          npc.relationshipToPlayer = 'Người lạ';
      });
      
      // 6. Clear Old Memories
      kbToModify.coreMemories = kbToModify.coreMemories.filter(m => m.entityId !== 'player');
      
      // 7. Tách rời Ký ức: Reset nhật ký ngắn hạn và đánh dấu lượt Luân hồi
      kbToModify.reincarnationTurn = kbToModify.playerStats.turn;
      kbToModify.pageSummaries = {};
      kbToModify.flashState = undefined;
      if (kbToModify.ragHistoryLog) {
          kbToModify.ragHistoryLog = kbToModify.ragHistoryLog.filter(log => log.type !== 'flash_agent');
      }

      const successionMessage: GameMessage = {
          id: `succession-${Date.now()}`,
          type: 'system',
          content: `\n*** LUÂN HỒI CHUYỂN KIẾP ***\n${oldMcName} đã chết. Bánh xe vận mệnh đã chọn ${successor.name} làm nhân vật chính mới.\nBạn bắt đầu một cuộc đời mới với thân phận, chỉ số và các mối quan hệ hoàn toàn mới.`,
          timestamp: Date.now(),
          turnNumber: kbToModify.playerStats.turn
      };

      return successionMessage;

  }, []);

  const extractLast4TurnsSummary = (messages: GameMessage[], logStr: string): string => {
    if (messages && messages.length > 0) {
        const narrativeMsgs = messages.filter(m => m.type === 'narration' || m.type === 'player_action' || (m as any).type === 'action');
        const lastMsgs = narrativeMsgs.slice(-8);
        if (lastMsgs.length > 0) {
            return lastMsgs.map(m => {
                const tag = m.type === 'player_action' || (m as any).type === 'action' ? 'Hành động người chơi' : 'Lời kể diễn biến';
                return `[Lượt ${m.turnNumber || '?'}] (${tag}):\n${m.content}`;
            }).join('\n\n');
        }
    }
    if (logStr) {
        return logStr.slice(-2500);
    }
    return "";
  };

  const handleActivePlayerDeath = useCallback(async (_choiceOrIsFromCombat?: 'samsara' | boolean) => {
    setIsLoadingApi(true);
    resetApiError();
    setUiState(prev => ({ ...prev, isSyncingData: true }));

    let workingKb = JSON.parse(JSON.stringify(knowledgeBase)) as KnowledgeBase;
    const isStreamingMode = styleSettings?.turnResponseMode === 'streaming';
    
    try {
        // Trích xuất 4 lượt gần nhất trước khi tử vong
        const recent4Turns = extractLast4TurnsSummary(gameMessages, currentPageMessagesLog);
        
        // Luân hồi chuyển kiếp: Khởi tạo MC mới hoàn toàn
        workingKb.playerStats.forcedHardcoreRebirth = true;
        workingKb.playerStats.isDead = false;
        workingKb.playerStats.reincarnationPhase = undefined;
        
        // Generate the new MC through succession
        const successionMsg = await handleSuccession(workingKb);
        const newMcName = workingKb.worldConfig.playerName;

        // Kích hoạt streaming nếu cấu hình bật
        if (isStreamingMode) {
            setCurrentScreen(GameScreen.Gameplay);
            setIsStreaming(true);
            setStreamingText("");
            abortControllerRef.current = new AbortController();
        }

        // 1. Gọi AI sinh lời dẫn Luân Hồi Tái Sinh với streaming và ngữ cảnh 4 lượt + World Lore
        const { response, rawText } = await generateEnterSamsaraNarration(
            workingKb, 
            newMcName, 
            recent4Turns,
            isStreamingMode ? (chunk) => setStreamingText(prev => prev + chunk) : undefined,
            abortControllerRef.current?.signal,
            (p) => setSentVictoryConsequencePromptsLog(prev => [p, ...prev].slice(0, 10))
        );
        logReceivedResponseCallback(rawText, workingKb.playerStats.turn);

        // 2. Kích hoạt Tag Extraction & Fast Agent Memory cho lượt Luân Hồi Tái Sinh
        const locDetail = workingKb.discoveredLocations?.find(loc => loc.id === workingKb.currentLocationId);
        const locName = locDetail ? locDetail.name : "Không rõ";
        const worldDate = workingKb.worldDate;
        const timeStr = worldDate 
            ? `${worldDate.timeOfDay}, Ngày ${worldDate.day}, Tháng ${worldDate.month}, Năm ${worldDate.year}`
            : "Không rõ";

        try {
            const extractionRes = await DataExtractionService.extractTagsAndMemory(
                rawText,
                "Luân hồi tái sinh",
                workingKb.playerStats.turn,
                locName,
                timeStr,
                workingKb
            );

            let consequenceTags = [...(response.tags || []), ...(extractionRes.tags || [])];

            if (consequenceTags.length > 0) {
                const { newKb, systemMessagesFromTags } = await performTagProcessing(
                    workingKb,
                    consequenceTags,
                    workingKb.playerStats.turn,
                    logNpcAvatarPromptCallback
                );
                workingKb = newKb;
                if (systemMessagesFromTags.length > 0) {
                    addMessageAndUpdateState(systemMessagesFromTags, workingKb);
                }
            }

            if (extractionRes.flashSummary || extractionRes.flashDetails) {
                await saveFlashAgentMemoryOffline(
                    workingKb.playerStats.turn,
                    setKnowledgeBase,
                    extractionRes.flashSummary || "",
                    extractionRes.flashDetails || "",
                    workingKb,
                    locName,
                    timeStr,
                    rawText
                );
            }
        } catch (extractErr) {
            console.error("Lỗi trích xuất Tag & Fast Agent lượt Luân Hồi Tái Sinh:", extractErr);
        }

        const narrationMsg: GameMessage = {
            id: `samsara-narration-${Date.now()}`,
            type: 'narration',
            content: response.narration,
            timestamp: Date.now(),
            turnNumber: workingKb.playerStats.turn,
            choices: response.choices.length > 0 ? response.choices : [
                { text: "Mở mắt nhìn ngắm thế giới mới, bắt đầu con đường tu tiên", thought: "Kiếp này ta nhất định phải chứng đạo trường sinh!" }
            ]
        };

        addMessageAndUpdateState([narrationMsg, successionMsg], workingKb);
        if (isStreamingMode) {
            setIsStreaming(false);
            setStreamingText("");
        }
        showNotification("Luân hồi tái sinh thành công! Bạn đã bắt đầu kiếp sống mới.", 'success');

    } catch (err) {
        console.error("Lỗi xử lý tử vong chủ động:", err);
        showNotification("Thiên Đạo trục trặc, đang kích hoạt kịch bản dự phòng...", "error");
        // Fallback: Nếu lỗi thì ép luân hồi
        workingKb.playerStats.forcedHardcoreRebirth = true;
        workingKb.playerStats.isDead = false;
        const successionMsg = await handleSuccession(workingKb);
        addMessageAndUpdateState([successionMsg], workingKb);
    } finally {
        setIsLoadingApi(false);
        setUiState(prev => ({ ...prev, isSyncingData: false }));
        if (isStreamingMode) {
            setIsStreaming(false);
            setStreamingText("");
        }
    }
  }, [knowledgeBase, addMessageAndUpdateState, handleNonCombatDefeat, logReceivedResponseCallback, generatePossessionNarration, generateEnterSamsaraNarration, handleSuccession, showNotification, setIsLoadingApi, setUiState, resetApiError, gameMessages, currentPageMessagesLog, styleSettings, setCurrentScreen, setIsStreaming, setStreamingText, abortControllerRef, setSentVictoryConsequencePromptsLog]);

  const [unrecognizedTags, setUnrecognizedTags] = useState<string[]>([]);
  const [isUnrecognizedTagsModalOpen, setIsUnrecognizedTagsModalOpen] = useState<boolean>(false);
  const [isRetryingTags, setIsRetryingTags] = useState<boolean>(false);

  const handleIgnoreUnrecognizedTags = useCallback(() => {
      setIsUnrecognizedTagsModalOpen(false);
      setUnrecognizedTags([]);
  }, []);

  const handleRetryUnrecognizedTags = useCallback(async (tagsToRetry: string[]) => {
      setIsRetryingTags(true);
      try {
          const prompt = `Bạn là AI Fast Agent chuyên sửa lỗi cú pháp thẻ trong game tu tiên. Các thẻ sau đây bị lỗi cú pháp hoặc sai định dạng tag:\n${tagsToRetry.join('\n')}\nHãy phân tích và viết lại chính xác các thẻ này theo đúng định dạng chuẩn cú pháp tag trong game (ví dụ: [NPC_UPDATE: id="..." name="..." ...], [ITEM_ADD: ...], v.v.). Chỉ trả về danh sách các thẻ đã được sửa đúng định dạng, mỗi thẻ một dòng trong ngoặc vuông [].`;
          const startTime = Date.now();
          let usedModel = 'gemini-flash-latest';
          const apiResult = await callGeminiAPI(
              prompt,
              undefined,
              'main',
              (m) => { usedModel = m; },
              undefined,
              false,
              undefined,
              undefined,
              undefined,
              "Tự động phân tích & sửa lỗi tag bằng AI Fast Agent"
          );
          const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
          console.log(`api key #1 : ${usedModel} : ${durationSec}s : Tự động phân tích & sửa lỗi tag bằng AI Fast Agent : useGameActions.ts`);

          const fixedText = apiResult?.text || "";
          const fixedTagMatches = fixedText.match(/\[(.*?)\]/g) || [];
          if (fixedTagMatches.length > 0) {
              const turnNow = knowledgeBase.playerStats?.turn || 1;
              const { newKb, systemMessagesFromTags } = await performTagProcessing(knowledgeBase, fixedTagMatches, turnNow, logNpcAvatarPromptCallback);
              setKnowledgeBase(newKb);
              if (systemMessagesFromTags.length > 0) {
                  addMessageAndUpdateState(systemMessagesFromTags, newKb);
              }
              showNotification("Đã sửa và đồng bộ lại các thẻ thành công!", "success");
          } else {
              showNotification("AI không thể trích xuất thẻ đã sửa. Đã bỏ qua.", "warning");
          }
          setIsUnrecognizedTagsModalOpen(false);
          setUnrecognizedTags([]);
      } catch (err) {
          console.error("Error retrying unrecognized tags:", err);
          showNotification("Lỗi khi tự động sửa lỗi tag bằng AI.", "error");
      } finally {
          setIsRetryingTags(false);
      }
  }, [knowledgeBase, setKnowledgeBase, addMessageAndUpdateState, logNpcAvatarPromptCallback, showNotification]);

  const handleUnrecognizedTagsDetected = useCallback((tags: string[]) => {
      // Cơ chế modal báo lỗi đã bị xoá bỏ hoàn toàn
      setUnrecognizedTags([]);
      setIsUnrecognizedTagsModalOpen(false);
  }, []);

  const mainGameLoopActions = useMainGameLoop({
      ...props,
      setIsLoadingApi,
      logSentPromptCallback,
      logReceivedResponseCallback,
      handleNonCombatDefeat,
      handleSuccession,
      onUnrecognizedTagsDetected: handleUnrecognizedTagsDetected,
  });

  const auctionActions = useAuctionActions({
      ...props,
      isLoadingApi,
      setIsLoadingApi,
  });

  // FIX: Added instantiation of slaveAuctionActions
  const slaveAuctionActions = useSlaveAuctionActions({
      ...props,
      isLoadingApi,
      setIsLoadingApi,
  });

  const cultivationActions = useCultivationActions({
    ...props,
    handleSuccession,
  });
  
  const handleTravelToLocation = useCallback(async (locationId: string) => {
    const targetLocation = knowledgeBase.discoveredLocations.find(l => l.id === locationId);

    if (!targetLocation) {
        showNotification("Lỗi: Không tìm thấy địa điểm điểm đến.", 'error');
        return;
    }

    // Call handlePlayerAction with the travel command to trigger a standard AI turn
    await mainGameLoopActions.handlePlayerAction(`Di chuyển đến ${targetLocation.name}`, false, 'action', 'default');
  }, [knowledgeBase.discoveredLocations, mainGameLoopActions, showNotification]);

  const handleCreateMemoryFromLastTurn = useCallback(async () => {
    setIsLoadingApi(true);
    resetApiError();
    try {
        const lastNarrationMessage = [...gameMessages].reverse().find(m => m.type === 'narration');
        if (!lastNarrationMessage) {
            throw new Error("Không tìm thấy lời kể nào ở lượt trước để tạo ký ức.");
        }
        
        const playerMemories = knowledgeBase.coreMemories.filter(m => m.entityId === 'player');

        const memoryData = await generateMemoryFromNarration(lastNarrationMessage.content, playerMemories);
        
        if (!memoryData) {
            throw new Error("AI không thể tạo ký ức từ sự kiện vừa rồi.");
        }

        const tagParams = {
            entityId: 'player',
            text: memoryData.text,
            strength: String(memoryData.strength)
        };
        
        // Use the existing tag processor to add the memory
        const { updatedKb, systemMessages } = processCoreMemoryAdd(knowledgeBase, tagParams, knowledgeBase.playerStats.turn);
        
        addMessageAndUpdateState(systemMessages, updatedKb);
        showNotification("Đã tạo ký ức cốt lõi mới thành công!", 'success');

    } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Lỗi khi tạo ký ức.";
        setApiErrorWithTimeout(errorMsg);
    } finally {
        setIsLoadingApi(false);
    }
  }, [knowledgeBase, gameMessages, setIsLoadingApi, resetApiError, addMessageAndUpdateState, showNotification, setApiErrorWithTimeout]);
  
  const handlePrisonerAction = useCallback(async (prisoner: Prisoner, action: string) => {
    // OFFLINE ACTION: Check for skill learning from a 'LinhKi' item
    const useItemPattern = /^Sử dụng vật phẩm "(.*?)"/i;
    const match = action.match(useItemPattern);

    if (match && match[1]) {
        const itemName = match[1];
        const result = handleOfflineSkillLearning(knowledgeBase, prisoner, itemName);
        if (result) {
            const { updatedKb, systemMessage } = result;
            if (systemMessage) {
                addMessageAndUpdateState([systemMessage], updatedKb);
            } else {
                setKnowledgeBase(updatedKb); // Should not happen with current logic, but safe
            }
            return; // Bypass AI call for this specific action
        }
    }

    if (isLoadingApi) return;
    setIsLoadingApi(true);
    props.resetApiError();
    try {
        const { response, rawText } = await handlePrisonerInteraction(
            knowledgeBase, 
            prisoner, 
            action,
            currentPageMessagesLog,
            previousPageSummaries,
            lastNarrationFromPreviousPage,
            undefined, // retrievedContext - can be added later
            (prompt) => props.setSentPrisonerPromptsLog(prev => [prompt, ...prev].slice(0, 20))
        );
        props.setReceivedPrisonerResponsesLog(prev => [rawText, ...prev].slice(0, 20));
        
        // --- V5: TWO-STEP GENERATION (TAG EXTRACTION) ---
        const extractedTags = await DataExtractionService.extractTags(rawText, knowledgeBase);
        const allTags = [...(response.tags || []), ...extractedTags];

        const { newKb } = await performTagProcessing(knowledgeBase, allTags, knowledgeBase.playerStats.turn, props.logNpcAvatarPromptCallback);
        setKnowledgeBase(newKb);
        props.setPrisonerInteractionLog(prev => [...prev, response.narration]);
    } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Lỗi khi tương tác với tù nhân.";
        props.setApiErrorWithTimeout(errorMsg);
    } finally {
        setIsLoadingApi(false);
    }
  }, [knowledgeBase, setIsLoadingApi, props, currentPageMessagesLog, previousPageSummaries, lastNarrationFromPreviousPage, setKnowledgeBase, addMessageAndUpdateState, showNotification]);

  const handleCompanionAction = useCallback(async (companion: Wife | Slave, action: string) => {
    // OFFLINE ACTION: Check for skill learning from a 'LinhKi' item
    const useItemPattern = /^Sử dụng vật phẩm "(.*?)"/i;
    const match = action.match(useItemPattern);

    if (match && match[1]) {
        const itemName = match[1];
        const result = handleOfflineSkillLearning(knowledgeBase, companion, itemName);
        if (result) {
            const { updatedKb, systemMessage } = result;
            if (systemMessage) {
                addMessageAndUpdateState([systemMessage], updatedKb);
            } else {
                setKnowledgeBase(updatedKb);
            }
            return; // Bypass AI call for this specific action
        }
    }

    if (isLoadingApi) return;
    setIsLoadingApi(true);
    props.resetApiError();
    try {
        const { response, rawText } = await handleCompanionInteraction(
            knowledgeBase, 
            companion, 
            action,
            currentPageMessagesLog,
            previousPageSummaries,
            lastNarrationFromPreviousPage,
            (prompt) => props.setSentCompanionPromptsLog(prev => [prompt, ...prev].slice(0, 20))
        );
        props.setReceivedCompanionResponsesLog(prev => [rawText, ...prev].slice(0, 20));

        // --- V5: TWO-STEP GENERATION (TAG EXTRACTION) ---
        const extractedTags = await DataExtractionService.extractTags(rawText, knowledgeBase);
        const allTags = [...(response.tags || []), ...extractedTags];

        const { newKb } = await performTagProcessing(knowledgeBase, allTags, knowledgeBase.playerStats.turn, props.logNpcAvatarPromptCallback);
        setKnowledgeBase(newKb);
        props.setCompanionInteractionLog(prev => [...prev, response.narration]);
    } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Lỗi khi tương tác với bạn đồng hành.";
        props.setApiErrorWithTimeout(errorMsg);
    } finally {
        setIsLoadingApi(false);
    }
  }, [knowledgeBase, setIsLoadingApi, props, currentPageMessagesLog, previousPageSummaries, lastNarrationFromPreviousPage]);

  const handleExitPrisonerScreen = useCallback(async (log: string[]) => {
      if (log.length > 0) {
          try {
            const summary = await summarizePrisonerInteraction(log);
            const summaryMessage: GameMessage = {
                id: 'prisoner-summary-' + Date.now(),
                type: 'narration',
                content: summary,
                timestamp: Date.now(),
                turnNumber: knowledgeBase.playerStats.turn,
            };
            addMessageAndUpdateState([summaryMessage], knowledgeBase);

            // --- ADDED: GENERATE SUMMARY & RICH SUMMARY ---
            const locDetail = knowledgeBase.discoveredLocations.find(loc => loc.id === knowledgeBase.currentLocationId);
            const locName = locDetail ? locDetail.name : "Không rõ";
            const worldDate = knowledgeBase.worldDate;
            const timeStr = worldDate 
                ? `${worldDate.timeOfDay}, Ngày ${worldDate.day}, Tháng ${worldDate.month}, Năm ${worldDate.year}`
                : "Không rõ";
            const turn = knowledgeBase.playerStats.turn;

            // Lưu dữ liệu để nhỡ cần retry
            setUiState(prev => ({
                ...prev,
                lastFlashRetryData: {
                    action: "Kết thúc tương tác với tù nhân",
                    aiResponse: summary,
                    turn: turn,
                    locName,
                    timeStr
                }
            }));

            runFlashAgentAsync(
                "Kết thúc tương tác với tù nhân",
                summary,
                turn,
                setKnowledgeBase,
                "",
                knowledgeBase,
                locName,
                timeStr
            );

            // Tự động kiểm tra sau 2s
            setTimeout(() => {
                setKnowledgeBase(currentKb => {
                    const flashEntry = currentKb.ragHistoryLog?.find(entry => entry && entry.turn === turn && entry.type === 'flash_agent');
                    if (!flashEntry || !flashEntry.summary) {
                        setUiState(prev => ({ ...prev, isFlashSummaryMissingModalOpen: true }));
                    }
                    return currentKb;
                });
            }, 2000);
            // ----------------------------------------------
          } catch(err) {
              console.error("Failed to summarize prisoner interactions:", err);
              showNotification("Lỗi tóm tắt tương tác với tù nhân.", 'error');
          }
      }
      props.setPrisonerInteractionLog([]);
      props.setSentPrisonerPromptsLog([]);
      props.setReceivedPrisonerResponsesLog([]);
      setCurrentScreen(GameScreen.Gameplay);
  }, [knowledgeBase, addMessageAndUpdateState, showNotification, setCurrentScreen, props]);

  const handleExitCompanionScreen = useCallback(async (log: string[]) => {
    if (log.length > 0) {
        try {
          const summary = await summarizeCompanionInteraction(log);
          const summaryMessage: GameMessage = {
              id: 'companion-summary-' + Date.now(),
              type: 'narration',
              content: summary,
              timestamp: Date.now(),
              turnNumber: knowledgeBase.playerStats.turn,
          };
          addMessageAndUpdateState([summaryMessage], knowledgeBase);

          // --- ADDED: GENERATE SUMMARY & RICH SUMMARY ---
          const locDetail = knowledgeBase.discoveredLocations.find(loc => loc.id === knowledgeBase.currentLocationId);
          const locName = locDetail ? locDetail.name : "Không rõ";
          const worldDate = knowledgeBase.worldDate;
          const timeStr = worldDate 
              ? `${worldDate.timeOfDay}, Ngày ${worldDate.day}, Tháng ${worldDate.month}, Năm ${worldDate.year}`
              : "Không rõ";
          const turn = knowledgeBase.playerStats.turn;

          // Lưu dữ liệu để nhỡ cần retry
          setUiState(prev => ({
              ...prev,
              lastFlashRetryData: {
                  action: "Kết thúc tương tác với bạn đồng hành",
                  aiResponse: summary,
                  turn: turn,
                  locName,
                  timeStr
              }
          }));

          runFlashAgentAsync(
              "Kết thúc tương tác với bạn đồng hành",
              summary,
              turn,
              setKnowledgeBase,
              "",
              knowledgeBase,
              locName,
              timeStr
          );

          // Tự động kiểm tra sau 2s
          setTimeout(() => {
              setKnowledgeBase(currentKb => {
                  const flashEntry = currentKb.ragHistoryLog?.find(entry => entry && entry.turn === turn && entry.type === 'flash_agent');
                  if (!flashEntry || !flashEntry.summary) {
                      setUiState(prev => ({ ...prev, isFlashSummaryMissingModalOpen: true }));
                  }
                  return currentKb;
              });
          }, 2000);
          // ----------------------------------------------
        } catch(err) {
            console.error("Failed to summarize companion interactions:", err);
            showNotification("Lỗi tóm tắt tương tác với bạn đồng hành.", 'error');
        }
    }
    props.setCompanionInteractionLog([]);
    props.setSentCompanionPromptsLog([]);
    props.setReceivedCompanionResponsesLog([]);
    setCurrentScreen(GameScreen.Gameplay);
}, [knowledgeBase, addMessageAndUpdateState, showNotification, setCurrentScreen, props]);

  const handleCombatEndSpecificOutcome = useCallback(async (outcome: DefeatOutcome, payload: CombatEndPayload) => {
      setIsLoadingApi(true);
      resetApiError();
      
      let systemMessages: GameMessage[] = [];
      const { turnHistory: _history, ...kbSnapshot } = knowledgeBase;
      let workingKb = JSON.parse(JSON.stringify(kbSnapshot)) as KnowledgeBase;
      workingKb.turnHistory = _history || [];
      workingKb.battlePlusOneTurn = workingKb.playerStats.turn;

      // PROCESS DEATH MECHANICALS
      const deathOutcome = processFatality(workingKb, true);
      if (deathOutcome.type === 'samsara') {
          workingKb.playerStats.forcedHardcoreRebirth = true;
          workingKb.playerStats.isDead = true;
          workingKb.pendingCombat = null;
          
          const systemMsg: GameMessage = {
              id: `samsara-combat-forced-sysmsg-${Date.now()}`,
              type: 'system',
              content: `\n*** LUÂN HỒI KHỐC LIỆT ***\nBạn đã tử vong quá 2 lần! Thân thể tàn tạ không thể cứu chữa trong chiến đấu, linh hồn bị cuốn phăng vào không gian Luân Hồi sâu thẳm. Bạn bắt buộc phải luân hồi chuyển kiếp chọn mốc MC mới!`,
              timestamp: Date.now(),
              turnNumber: workingKb.playerStats.turn
          };
          
          const narrationMsg: GameMessage = {
              id: `samsara-combat-forced-narration-${Date.now()}`,
              type: 'narration',
              content: `Trận chiến vừa rồi là nấm mồ chôn cất kiếp tu hành này của bạn. Tử vong lần thứ ba, không còn ai có thể cứu chữa, linh hồn bạn bị lực hút của Không gian Luân hồi cưỡng chế lôi kéo đi đầu thai chuyển kiếp. Hãy bắt đầu một cuộc đời mới.`,
              timestamp: Date.now(),
              turnNumber: workingKb.playerStats.turn,
              choices: []
          };
          
          setCurrentScreen(GameScreen.Gameplay);
          addMessageAndUpdateState([narrationMsg, systemMsg], workingKb);
          showNotification("Linh hồn rơi vào không gian luân hồi!", 'warning');
          setIsLoadingApi(false);
          return;
      }

      // Sync the incremented death count back to original kb so it persists correctly if none triggered
      knowledgeBase.playerStats.deathCount = workingKb.playerStats.deathCount;
      
      if (outcome === 'reincarnate') {
           workingKb.playerStats.sinhLuc = 0;
           workingKb.playerStats.isDead = true;
           workingKb.playerStats.forcedHardcoreRebirth = false;
           systemMessages.push({
               id: `suicide-reincarnate-sysmsg-${Date.now()}`,
               type: 'system',
               content: `\n*** CHUNG CỰC TỬ VONG: TỰ SÁT HOÁ ĐẠO ***\nBạn đã chủ động bạo thể tự sát để bảo toàn danh dự. Thân xác tàn lụi, linh hồn phiêu dạt quy về quy trình Chung Cực Tử Vong để chuẩn bị Luân Hồi Tái Sinh.`,
               timestamp: Date.now(),
               turnNumber: workingKb.playerStats.turn
           });
      } else {
           workingKb.playerStats.isDead = false; // Defensively mark MC alive when captured or released
           if (outcome !== 'prisoner') {
               workingKb.playerStats.playerSpecialStatus = null;
           }
           
           // Deduct currency on regular defeat
           const lostCurrency = Math.floor(workingKb.playerStats.currency * 0.3); // Lose 30% on desperate actions
           workingKb.playerStats.currency -= lostCurrency;
           systemMessages.push({
               id: `defeat-penalty-${Date.now()}`,
               type: 'system',
               content: `Bạn tổn thất ${lostCurrency} linh thạch khi cố sinh tồn dưới tay kẻ địch.`,
               timestamp: Date.now(),
               turnNumber: workingKb.playerStats.turn
           });

           // Recover some HP/MP so player isn't at 0
           const recoveryFactor = outcome === 'prisoner' ? 0.05 : 0.20;
           workingKb.playerStats.sinhLuc = Math.max(10, Math.floor(workingKb.playerStats.maxSinhLuc * recoveryFactor));
           workingKb.playerStats.linhLuc = Math.max(5, Math.floor(workingKb.playerStats.maxLinhLuc * recoveryFactor));
           workingKb.playerStats.isDead = false;
      }
      
      workingKb.pendingCombat = null;                

      try {
          const summary = `Chiến thắng thuộc về phe địch. ${payload.summary}`;
          const apiSettings = getGeminiApiSettings();

          // Switch to Gameplay screen early if streaming to show the progress
          if (styleSettings?.turnResponseMode === 'streaming') {
              setCurrentScreen(GameScreen.Gameplay);
              setIsStreaming(true);
              setStreamingText("");
              abortControllerRef.current = new AbortController();
          }

          // Generate aftermath narration with AI
          const { response, rawText } = await generateDefeatConsequence(
             workingKb,
             payload,
             currentPageMessagesLog,
             previousPageSummaries,
             lastNarrationFromPreviousPage,
             summary,
             (prompt) => setSentVictoryConsequencePromptsLog(prev => [prompt, ...prev].slice(0, 10)),
             styleSettings?.turnResponseMode === 'streaming' ? (chunk) => setStreamingText(prev => prev + chunk) : undefined,
             abortControllerRef.current?.signal
          );
          setReceivedVictoryConsequenceResponsesLog(prev => [rawText, ...prev].slice(0, 10));

          let consequenceNarration = response.narration;
          let consequenceChoices = response.choices;
          const combinedContent = consequenceNarration || `*Hậu quả chiến bại:*\n${summary}`;

          // Đưa message vào state TRƯỚC KHI tắt cờ streaming để giao diện chuyển tiếp liền mạch không bị rỗng/biến mất văn bản
          const summaryMessage: GameMessage = {
              id: 'combat-summary-' + Date.now(),
              type: 'narration',
              content: combinedContent,
              timestamp: Date.now(),
              turnNumber: workingKb.playerStats.turn,
              choices: consequenceChoices
          };
          
          const allMessages = [summaryMessage, ...systemMessages];
          addMessageAndUpdateState(allMessages, workingKb);

          // Tắt trạng thái stream sau khi message đã an toàn nằm trong State
          setIsStreaming(false);
          setStreamingText("");

          // Check for Mat Phap (Manual Mode)
          if (apiSettings.matPhapManual) {
              // Set Mat Phap state to wait for extraction
              setUiState(prev => ({
                  ...prev,
                  matPhapStep: 'waiting_extraction',
                  matPhapCtx: {
                      knowledgeBaseAtActionStart: workingKb,
                      cleanedAction: "Hậu quả chiến bại",
                      turnOfPlayerAction: workingKb.playerStats.turn,
                      narrativeResult: { rawText, narration: consequenceNarration, choices: consequenceChoices }
                  }
              }));
              
              setCurrentScreen(GameScreen.Gameplay);
              return;
          }

          // API Call 2: Gộp trích xuất tag và tổng hợp trí nhớ Flash Agent trong 1 cuộc gọi duy nhất
          const locDetail = workingKb.discoveredLocations.find(loc => loc.id === workingKb.currentLocationId);
          const locName = locDetail ? locDetail.name : "Không rõ";
          const worldDate = workingKb.worldDate;
          const timeStr = worldDate 
              ? `${worldDate.timeOfDay}, Ngày ${worldDate.day}, Tháng ${worldDate.month}, Năm ${worldDate.year}`
              : "Không rõ";

          const extractionRes = await DataExtractionService.extractTagsAndMemory(
              rawText,
              "Hậu quả chiến bại",
              workingKb.playerStats.turn,
              locName,
              timeStr,
              workingKb
          );

          let consequenceTags = [...(response.tags || []), ...(extractionRes.tags || [])];

          if (consequenceTags.length > 0) {
               const { newKb, systemMessagesFromTags } = await performTagProcessing(
                  workingKb,
                  consequenceTags,
                  workingKb.playerStats.turn,
                  logNpcAvatarPromptCallback
               );
               workingKb = newKb;
               if (systemMessagesFromTags.length > 0) {
                   addMessageAndUpdateState(systemMessagesFromTags, workingKb);
               }
          }

          // Đồng bộ Flash Memory Offline (0 API Call phụ)
          if (extractionRes.flashSummary || extractionRes.flashDetails) {
              await saveFlashAgentMemoryOffline(
                  workingKb.playerStats.turn,
                  setKnowledgeBase,
                  extractionRes.flashSummary || "",
                  extractionRes.flashDetails || "",
                  workingKb,
                  locName,
                  timeStr,
                  rawText
              );
          }
          
          setCurrentScreen(GameScreen.Gameplay);
      } catch (error) {
          console.error("Error generating post-defeat choice summary:", error);
          const errorMsg = `Lỗi tạo tóm tắt sau khi chọn hành động thất bại: ${error instanceof Error ? error.message : String(error)}`;
          setApiErrorWithTimeout(errorMsg);

          addMessageAndUpdateState(systemMessages, workingKb);
          setCurrentScreen(GameScreen.Gameplay);
      } finally {
          setIsLoadingApi(false);
      }
  }, [
      knowledgeBase, currentPageMessagesLog, previousPageSummaries, lastNarrationFromPreviousPage,
      addMessageAndUpdateState, handleSuccession, setIsLoadingApi, resetApiError,
      setSentVictoryConsequencePromptsLog, setReceivedVictoryConsequenceResponsesLog,
      setKnowledgeBase, logNpcAvatarPromptCallback, setCurrentScreen, setApiErrorWithTimeout,
      performTagProcessing
  ]);

const handleCombatEnd = useCallback(async (result: CombatEndPayload) => {
    setIsLoadingApi(true);
    resetApiError();
    
    let systemMessages: GameMessage[] = [];
    
    const { turnHistory: _history, ...kbSnapshot } = knowledgeBase;
    let workingKb = JSON.parse(JSON.stringify(kbSnapshot)) as KnowledgeBase;
    workingKb.turnHistory = _history || [];
    workingKb.battlePlusOneTurn = workingKb.playerStats.turn;

    // Special handling for defeat while being hunted
    if (result.outcome === 'defeat' && workingKb.huntedState?.isActive) {
        showNotification("Bạn đã bị hành quyết! Luân hồi chuyển kiếp...", 'error');

        // The handleSuccession function will perform all the necessary resets.
        const successionMsg = await handleSuccession(workingKb); 
        
        const executionMessage: GameMessage = {
            id: `hunted-execution-${Date.now()}`,
            type: 'system',
            content: `Bạn đã bị đánh bại trong khi bị truy nã. Bạn bị áp giải đến trước mặt một thế lực tối cao và bị phán quyết tử hình. Cuộc đời này của bạn đã kết thúc.`,
            timestamp: Date.now(),
            turnNumber: workingKb.playerStats.turn
        };

        addMessageAndUpdateState([executionMessage, successionMsg], workingKb);
        setCurrentScreen(GameScreen.Gameplay);
        setIsLoadingApi(false);
        return; // Stop further processing.
    }
    
    // Dungeon Boss Fight Logic
    if (workingKb.pendingCombat?.isDungeonBossFight) {
        if (result.outcome === 'defeat') {
            const successionMsg = await handleSuccession(workingKb);
            systemMessages.push(successionMsg);
            systemMessages.push({
                id: `dungeon-fail-${Date.now()}`,
                type: 'system',
                content: `Bạn đã gục ngã trước trùm cuối. Bí cảnh sụp đổ và bạn đã bỏ mạng tại đây...`,
                timestamp: Date.now(),
                turnNumber: workingKb.playerStats.turn
            });
            workingKb.dungeonCrawlState = null; // Also clear dungeon state
            addMessageAndUpdateState(systemMessages, workingKb);
            setCurrentScreen(GameScreen.Gameplay);
            setIsLoadingApi(false);
            return;
        } else if (result.outcome === 'victory') {
            if (workingKb.dungeonCrawlState) {
                workingKb.dungeonCrawlState.stage = 'report';
                workingKb.dungeonCrawlState.objective = 'Báo cáo lại cho lãnh đội về kết quả cuộc thám hiểm.';
            }
            workingKb.playerStats = result.finalPlayerState;
            if (result.finalInventory) workingKb.inventory = result.finalInventory;
            workingKb.pendingCombat = null;
            workingKb.postCombatState = null;

            const summaryMessage: GameMessage = {
                id: `dungeon-boss-victory-${Date.now()}`,
                type: 'system',
                content: `Bạn đã đánh bại trùm cuối của hầm ngục! Hãy nhanh chóng thoát ra ngoài và báo cáo cho lãnh đội.`,
                timestamp: Date.now(),
                turnNumber: workingKb.playerStats.turn
            };
            
            addMessageAndUpdateState([summaryMessage], workingKb);
            setCurrentScreen(GameScreen.Gameplay);
            setIsLoadingApi(false);
            return;
        }
    }
    
    workingKb.playerStats = result.finalPlayerState;

    // --- XỬ LÝ EXP CƠ HỌC CHO CHIẾN HỮU SAU TRẬN ĐẤU ---
    // Extract enemies and allies from final state
    const enemies = result.finalOpponentsStatus || [];
    const allies = result.finalAlliesStatus || [];
    
    if (enemies.length > 0 && allies.length > 0) {
        // Build mock entities with proper maxHp for grantCombatExp calculation
        // The enemies array currently just has hp and mp. We'll find their actual representations from knowledgeBase or just use current hp as fallback.
        const fullEnemies = enemies.map(e => {
            const ent = [
                ...knowledgeBase.discoveredNPCs, 
                ...knowledgeBase.discoveredYeuThu,
                ...(knowledgeBase.pendingCombat?.temporaryEntities || [])
            ].find(x => x.id === e.id);
            return { id: e.id, maxHp: ent?.stats?.maxSinhLuc || 100 };
        });
        const fullAllies = allies.map(a => ({ id: a.id }));
        
        const progResult = grantCombatExp(workingKb, fullEnemies, fullAllies);
        Object.assign(workingKb, progResult.updatedKb);
        systemMessages.push(...progResult.systemMessages);
    }
    // --------------------------------------------------

    if (result.finalAlliesStatus) {
        result.finalAlliesStatus.forEach(status => {
            const wife = workingKb.wives.find((w: Wife) => w.id === status.id);
            if (wife) { 
                if (!wife.stats) wife.stats = {}; 
                wife.stats.sinhLuc = status.hp; 
                wife.stats.linhLuc = status.mp; 
            }

            const slave = workingKb.slaves.find((s: Slave) => s.id === status.id);
            if (slave) { 
                if (!slave.stats) slave.stats = {}; 
                slave.stats.sinhLuc = status.hp; 
                slave.stats.linhLuc = status.mp; 
            }
            
            const prisoner = workingKb.prisoners.find((p: Prisoner) => p.id === status.id);
            if (prisoner) { 
                if (!prisoner.stats) prisoner.stats = {}; 
                prisoner.stats.sinhLuc = status.hp; 
                prisoner.stats.linhLuc = status.mp; 
            }

            const npc = workingKb.discoveredNPCs.find((n: NPC) => n.id === status.id);
            if (npc) { 
                if (!npc.stats) npc.stats = {}; 
                npc.stats.sinhLuc = status.hp; 
                npc.stats.linhLuc = status.mp; 
            }

            // --- PERMADEATH LOGIC ---
            if (status.hp <= 0 && status.id !== 'player') {
                // Find ally info for notification
                const deadAlly = [
                    ...workingKb.wives,
                    ...workingKb.slaves,
                    ...workingKb.prisoners,
                    ...workingKb.discoveredNPCs
                ].find(a => a.id === status.id);

                // Remove from all relevant lists
                workingKb.wives = workingKb.wives.filter(w => w.id !== status.id);
                workingKb.slaves = workingKb.slaves.filter(s => s.id !== status.id);
                workingKb.prisoners = workingKb.prisoners.filter(p => p.id !== status.id);
                workingKb.discoveredNPCs = workingKb.discoveredNPCs.filter(n => n.id !== status.id);
                workingKb.companions = workingKb.companions.filter(c => c.id !== status.id);
                workingKb.combatCompanionIds = workingKb.combatCompanionIds.filter(id => id !== status.id);

                systemMessages.push({
                    id: `ally-death-${status.id}-${Date.now()}`,
                    type: 'system',
                    content: `${deadAlly?.name || 'Đồng minh'} đã gục ngã và không thể hồi sinh. Họ đã vĩnh viễn rời xa thế giới này.`,
                    timestamp: Date.now(),
                    turnNumber: workingKb.playerStats.turn
                });
            }
        });
    }

    if (result.finalOpponentsStatus) {
        result.finalOpponentsStatus.forEach(status => {
            // Kiểm tra xem kẻ địch này có bị kết liễu không
            const isKilled = result.outcome === 'victory' && Object.entries(result.dispositions || {}).some(([k, v]) => {
                const realId = k.replace(/^enemy_\d+_/, '');
                return (realId === status.id || k === status.id) && v === 'kill';
            });

            let finalHp = status.hp;
            if (result.outcome === 'victory' && !isKilled) {
                // Sửa lại ngay, nếu không chọn kết liễu thì sau khi thắng trận sẽ luôn cộng cơ học cho toàn bộ NPC kẻ địch thêm 1 HP để tránh bị xoá dữ liệu
                finalHp = Math.max(1, (status.hp || 0) + 1);
            }

            const npc = workingKb.discoveredNPCs.find((n: NPC) => n.id === status.id);
            if (npc) { 
                if (!npc.stats) npc.stats = {}; 
                npc.stats.sinhLuc = finalHp; 
                npc.stats.linhLuc = status.mp; 
                npc.isDead = finalHp <= 0;
            }
            
            const yeuThu = workingKb.discoveredYeuThu.find((y: YeuThu) => y.id === status.id);
            if (yeuThu) { 
                if (!yeuThu.stats) yeuThu.stats = {}; 
                yeuThu.stats.sinhLuc = finalHp; 
                yeuThu.stats.linhLuc = status.mp; 
                yeuThu.isDead = finalHp <= 0;
            }
        });
    }

    if (result.finalInventory) {
        workingKb.inventory = result.finalInventory;
    }
    
    if (result.finalNpcInventory) {
        workingKb.npcInventory = result.finalNpcInventory;
    }

    // --- MECHANICAL EXP REWARD (10% of Enemy Max HP) ---
    if (result.outcome === 'victory' && result.opponentIds && result.opponentIds.length > 0) {
        let totalEnemyMaxHp = 0;
        result.opponentIds.forEach(opponentId => {
            const opponent = [
                ...workingKb.discoveredNPCs,
                ...workingKb.discoveredYeuThu,
                ...(workingKb.pendingCombat?.temporaryEntities || [])
            ].find(o => o.id === opponentId);
            if (opponent && opponent.stats && opponent.stats.maxSinhLuc) {
                totalEnemyMaxHp += opponent.stats.maxSinhLuc;
            }
        });

        if (totalEnemyMaxHp > 0) {
            const rewardExp = Math.floor(totalEnemyMaxHp * 0.1);
            if (rewardExp > 0) {
                workingKb.playerStats.kinhNghiem = (workingKb.playerStats.kinhNghiem || 0) + rewardExp;
                systemMessages.push({
                    id: `exp-gain-battle-${Date.now()}`,
                    type: 'system',
                    content: `Bạn nhận được ${rewardExp} điểm kinh nghiệm từ việc đánh bại kẻ địch (10% tổng HP của chúng).`,
                    timestamp: Date.now(),
                    turnNumber: workingKb.playerStats.turn
                });
            }
        }
    }

    workingKb.pendingCombat = null;
    workingKb.postCombatState = null;
    if (workingKb.playerStats) {
        workingKb.playerStats.isInCombat = false;
    }

    const hasTribulationBoss = result.opponentIds.some(id => {
        const npc = knowledgeBase.discoveredNPCs.find(n => n.id === id); 
        if (!npc) return false;
        const name = npc.name ? npc.name.normalize("NFC") : "";
        return name.includes("Lôi Kiếp") || name.includes("Thiên Kiếp") || name.includes("Hóa Thân"); 
    });

    const wasBreakthroughCombat = knowledgeBase.pendingBreakthrough || hasTribulationBoss;

    if (wasBreakthroughCombat) {
        const opponentIdsToDelete = result.opponentIds;
        workingKb.discoveredNPCs = workingKb.discoveredNPCs.filter((npc: NPC) => !opponentIdsToDelete.includes(npc.id));

        workingKb.pendingBreakthrough = null;
        workingKb.playerStats.hieuUngBinhCanh = false;

        if (result.outcome === 'victory') {
            const playerRealmBeforeBreakthrough = knowledgeBase.playerStats.realm;
            let progressionList = workingKb.realmProgressionList || [];
            
            if (progressionList.length === 0 && workingKb.worldConfig?.raceCultivationSystems) {
                const playerRace = workingKb.worldConfig.playerRace || 'Nhân Tộc';
                const raceSystem = workingKb.worldConfig.raceCultivationSystems.find(s => s.raceName === playerRace);
                if (raceSystem) {
                    progressionList = raceSystem.realmSystem.split(' - ').map(s => s.trim()).filter(Boolean);
                    workingKb.realmProgressionList = progressionList;
                }
            }

            const sortedRealms = [...progressionList].sort((a, b) => b.length - a.length);
            const matchedMainRealm = sortedRealms.find(r => playerRealmBeforeBreakthrough.startsWith(r));
            const mainRealmIndex = progressionList.indexOf(matchedMainRealm || '');

            if (mainRealmIndex !== -1 && mainRealmIndex < progressionList.length - 1) {
                const nextMainRealmName = progressionList[mainRealmIndex + 1];
                const firstMinor = workingKb.minorRealmProgressionList && workingKb.minorRealmProgressionList.length > 0 
                    ? workingKb.minorRealmProgressionList[0] 
                    : SUB_REALM_NAMES[0];
                workingKb.playerStats.realm = `${nextMainRealmName} ${firstMinor}`;
                workingKb.playerStats.kinhNghiem = 0;
                
                const lifespanBonus = 100 * Math.pow(1.5, mainRealmIndex);
                if(workingKb.playerStats.maxThoNguyen) workingKb.playerStats.maxThoNguyen += lifespanBonus;
                if(workingKb.playerStats.thoNguyen) workingKb.playerStats.thoNguyen += lifespanBonus;
                
                const newBaseStats = calculateRealmBaseStats(workingKb.playerStats.realm, progressionList, workingKb.currentRealmBaseStats);
                workingKb.playerStats = { ...workingKb.playerStats, ...newBaseStats };
                
                workingKb.playerStats = calculateEffectiveStats(workingKb.playerStats, workingKb.equippedItems, workingKb.inventory);
                
                workingKb.playerStats.sinhLuc = workingKb.playerStats.maxSinhLuc;
                workingKb.playerStats.linhLuc = workingKb.playerStats.maxLinhLuc;

                systemMessages.push({ id: `breakthrough-success-${Date.now()}`, type: 'system', content: `Chúc mừng bạn đã độ kiếp thành công, từ ${playerRealmBeforeBreakthrough} đột phá đến ${workingKb.playerStats.realm}!`, timestamp: Date.now(), turnNumber: workingKb.playerStats.turn });
                systemMessages.push({ id: `lifespan-bonus-${Date.now()}`, type: 'system', content: `Thọ nguyên tăng thêm ${Math.floor(lifespanBonus)} năm!`, timestamp: Date.now(), turnNumber: workingKb.playerStats.turn });
                
                showNotification("Đột phá thành công!", 'success');
            } else {
                 showNotification("Đã chiến thắng nhưng không tìm thấy cảnh giới tiếp theo! (Lỗi dữ liệu hệ thống tu luyện)", 'warning');
            }
            workingKb.pendingCombat = null;
            workingKb.postCombatState = null;
            if (workingKb.playerStats) {
                workingKb.playerStats.isInCombat = false;
            }
            addMessageAndUpdateState(systemMessages, workingKb);
            setKnowledgeBase(workingKb);
            setCurrentScreen(GameScreen.Cultivation);
            setIsLoadingApi(false);
        } else { // Defeat in breakthrough combat
            workingKb.pendingCombat = null;
            workingKb.postCombatState = null;
            if (workingKb.playerStats) {
                workingKb.playerStats.isInCombat = false;
            }
            addMessageAndUpdateState([], workingKb);
            setKnowledgeBase(workingKb);
            setCurrentScreen(GameScreen.Gameplay);
            setIsLoadingApi(false);
            showNotification("Độ kiếp thất bại! Cảnh giới đang bất ổn...", 'warning');

            setTimeout(() => {
                setKnowledgeBase(prev => {
                    const { turnHistory, ...rest } = prev;
                    const kbAfterRealmDrop = JSON.parse(JSON.stringify(rest)) as KnowledgeBase;
                    const realmBefore = kbAfterRealmDrop.playerStats.realm;
                
                    let mainRealmName = "";
                    let subRealmName = "";
                    const realmProgressionList = kbAfterRealmDrop.realmProgressionList;
                    const sortedMainRealms = [...realmProgressionList].sort((a: string, b: string) => b.length - a.length);
                
                    for (const r of sortedMainRealms) {
                        if (realmBefore.startsWith(r)) {
                            mainRealmName = r;
                            subRealmName = realmBefore.substring(r.length).trim();
                            break;
                        }
                    }
                
                    let realmHasBeenDropped = false;
                    let newRealm = realmBefore;
                
                    if (mainRealmName && subRealmName) {
                        const currentSubRealmIndex = SUB_REALM_NAMES.indexOf(subRealmName as any);
                
                        if (currentSubRealmIndex > 0) { 
                            const prevSubRealmName = SUB_REALM_NAMES[currentSubRealmIndex - 1];
                            newRealm = `${mainRealmName} ${prevSubRealmName}`;
                            kbAfterRealmDrop.playerStats.realm = newRealm;
                            realmHasBeenDropped = true;
                        }
                    }
                
                    kbAfterRealmDrop.playerStats.kinhNghiem = 0;
                
                    if (realmHasBeenDropped) {
                        const newBaseStats = calculateRealmBaseStats(newRealm, kbAfterRealmDrop.realmProgressionList, kbAfterRealmDrop.currentRealmBaseStats);
                        kbAfterRealmDrop.playerStats = { ...kbAfterRealmDrop.playerStats, ...newBaseStats };
                
                        kbAfterRealmDrop.playerStats = calculateEffectiveStats(kbAfterRealmDrop.playerStats, kbAfterRealmDrop.equippedItems, kbAfterRealmDrop.inventory);
                
                        showNotification(`Cảnh giới của bạn đã bị lùi từ ${realmBefore} xuống ${newRealm}!`, 'error');
                        addMessageAndUpdateState([
                            { id: `breakthrough-fail-${Date.now()}`, type: 'system', content: `Độ kiếp thất bại! Cảnh giới của bạn bị lùi từ ${realmBefore} xuống ${newRealm} và kinh nghiệm bị xóa sạch.`, timestamp: Date.now(), turnNumber: kbAfterRealmDrop.playerStats.turn }
                        ], kbAfterRealmDrop);
                
                    } else {
                        showNotification(`Độ kiếp thất bại! May mắn là cảnh giới của bạn không bị lùi, nhưng kinh nghiệm đã bị xóa sạch!`, 'warning');
                        addMessageAndUpdateState([
                            { id: `breakthrough-fail-nodrop-${Date.now()}`, type: 'system', content: `Độ kiếp thất bại! May mắn là cảnh giới của bạn không bị lùi, nhưng kinh nghiệm đã bị xóa sạch.`, timestamp: Date.now(), turnNumber: kbAfterRealmDrop.playerStats.turn }
                        ], kbAfterRealmDrop);
                    }
                    
                    return { ...kbAfterRealmDrop, turnHistory };
                });

                setTimeout(() => {
                    setKnowledgeBase(prev => {
                        const { turnHistory, ...rest } = prev;
                        const kbAfterHpChange = JSON.parse(JSON.stringify(rest)) as KnowledgeBase;
                        const hpBonus = Math.floor(kbAfterHpChange.playerStats.baseMaxSinhLuc * 0.05);
                        kbAfterHpChange.playerStats.permanentSinhLucBonus = (kbAfterHpChange.playerStats.permanentSinhLucBonus || 0) + hpBonus;
                        
                        kbAfterHpChange.playerStats = calculateEffectiveStats(kbAfterHpChange.playerStats, kbAfterHpChange.equippedItems, kbAfterHpChange.inventory);
                        
                        kbAfterHpChange.playerStats.sinhLuc = Math.floor(kbAfterHpChange.playerStats.maxSinhLuc * 0.05);

                        showNotification(`Lôi kiếp tôi thể! Sinh Lực tối đa vĩnh viễn tăng ${hpBonus} điểm!`, 'success');
                         addMessageAndUpdateState([
                            { id: `hp-bonus-${Date.now()}`, type: 'system', content: `Tuy nhiên, nhờ được lôi kiếp tôi luyện, Sinh Lực tối đa của bạn vĩnh viễn tăng ${hpBonus} điểm! Bạn đang trong trạng thái suy yếu.`, timestamp: Date.now(), turnNumber: kbAfterHpChange.playerStats.turn }
                         ], kbAfterHpChange);
                        
                        return { ...kbAfterHpChange, turnHistory };
                    });
                }, 2000);

            }, 2000);
        }
        return;
    }
    
    if (result.outcome === 'defeat') {
        const isPlayerSuicide = result.dispositions?.player === 'suicide';
        if (isPlayerSuicide) {
            // Tự sát thành công -> Kích hoạt Luân Hồi Chuyển Kiếp tức thì
            workingKb.playerStats.forcedHardcoreRebirth = true;
            workingKb.playerStats.isDead = true;
            const successionMsg = await handleSuccession(workingKb);
            systemMessages.push(successionMsg);
        } else {
            const lostCurrency = Math.floor(workingKb.playerStats.currency / 2);
            workingKb.playerStats.currency -= lostCurrency;
            systemMessages.push({
                id: `defeat-penalty-${Date.now()}`,
                type: 'system',
                content: `Thất bại trong chiến đấu! Bạn đã bị cướp/mất ${lostCurrency} tiền tệ.`,
                timestamp: Date.now(),
                turnNumber: workingKb.playerStats.turn
            });

            workingKb.playerStats.defeatCount = (workingKb.playerStats.defeatCount || 0) + 1;
            
            if (workingKb.playerStats.defeatCount > 10) {
                 const successionMsg = await handleSuccession(workingKb);
                 systemMessages.push(successionMsg);
            }
        }
    }
    
    try {
        // Switch to Gameplay screen early if streaming to show the progress
        if (styleSettings?.turnResponseMode === 'streaming') {
            setCurrentScreen(GameScreen.Gameplay);
            setIsStreaming(true);
            setStreamingText("");
            abortControllerRef.current = new AbortController();
        }

        // Tối ưu: Dùng trực tiếp dữ liệu tóm tắt cơ học từ client thay vì gọi API summarizeCombat dư thừa
        const summary = `Kết quả: ${result.outcome === 'victory' ? 'Thắng lợi' : 'Thất bại'}. ${result.summary || ''}`;

        // --- XỬ LÝ ĐỒNG MINH VÀ NPC CỘNG SỰ CỦA NGƯỜI CHƠI TỬ TRẬN (HP === 0) ---
        if (result.finalAlliesStatus) {
            const deadAllies = result.finalAlliesStatus.filter(a => a.hp <= 0);
            deadAllies.forEach(deadAlly => {
                const realId = deadAlly.id;
                let allyName = realId;
                let foundType = "";

                // 1. Kiểm tra và xóa khỏi wives (đồng hành/vợ)
                if (workingKb.wives) {
                    const idx = workingKb.wives.findIndex(w => w.id === realId);
                    if (idx !== -1) {
                        allyName = workingKb.wives[idx].name || allyName;
                        workingKb.wives.splice(idx, 1);
                        foundType = "Thê thiếp / Bạn đời";
                    }
                }
                
                // 2. Kiểm tra và xóa khỏi slaves (binh hầu/gia nô)
                if (workingKb.slaves) {
                    const idx = workingKb.slaves.findIndex(s => s.id === realId);
                    if (idx !== -1) {
                        allyName = workingKb.slaves[idx].name || allyName;
                        workingKb.slaves.splice(idx, 1);
                        foundType = "Nô bộc / Tháp tùng";
                    }
                }

                // 3. Kiểm tra và xóa khỏi discoveredNPCs (NPC phát hiện)
                if (workingKb.discoveredNPCs) {
                    const idx = workingKb.discoveredNPCs.findIndex(n => n.id === realId);
                    if (idx !== -1) {
                        if (allyName === realId) {
                            allyName = workingKb.discoveredNPCs[idx].name || allyName;
                        }
                        workingKb.discoveredNPCs.splice(idx, 1);
                        if (!foundType) foundType = "Đồng hành NPC";
                    }
                }

                systemMessages.push({
                    id: `sys-ally-dead-${realId}-${Date.now()}`,
                    type: 'system',
                    content: `[Tử Trận] ${foundType ? `${foundType} - ` : ''}${allyName} đã cạn kiệt sinh lực và hy sinh vĩnh viễn trong trận chiến dũng cảm này.`,
                    timestamp: Date.now(),
                    turnNumber: workingKb.playerStats.turn
                });
            });
        }

        // --- XỬ LÝ SỐ PHẬN CƠ HỌC THAY VÌ TAG AI ---
        if (result.outcome === 'victory' && result.dispositions) {
            Object.entries(result.dispositions).forEach(([entityId, disposition]) => {
                const realId = entityId.replace(/^enemy_\d+_/, '');
                
                let capturedEntity: any = null;
                let entityName = entityId;
                let foundArray: string | null = null;
                let foundIndex = -1;

                const arraysToCheck = [
                    { name: 'discoveredNPCs', arr: workingKb.discoveredNPCs },
                    { name: 'discoveredYeuThu', arr: workingKb.discoveredYeuThu },
                    { name: 'wives', arr: workingKb.wives },
                    { name: 'slaves', arr: workingKb.slaves },
                    { name: 'prisoners', arr: workingKb.prisoners },
                    { name: 'temporaryEntities', arr: workingKb.pendingCombat?.temporaryEntities || [] }
                ];

                const targetSearchKey = realId.trim();
                const rawEntityKey = entityId.trim();

                for (const arrInfo of arraysToCheck) {
                    if (arrInfo.arr) {
                        const idx = arrInfo.arr.findIndex((e: any) => {
                            if (!e) return false;
                            if (e.id === targetSearchKey || e.id === rawEntityKey) return true;
                            if (e.name && (e.name === targetSearchKey || e.name === rawEntityKey)) return true;
                            if (e.name && targetSearchKey && e.name.trim().toLowerCase() === targetSearchKey.toLowerCase()) return true;
                            return false;
                        });
                        if (idx !== -1) {
                            foundArray = arrInfo.name;
                            foundIndex = idx;
                            capturedEntity = { ...arrInfo.arr[idx] };
                            entityName = capturedEntity.name || targetSearchKey;
                            break;
                        }
                    }
                }

                if (foundArray && foundIndex !== -1) {
                    if (disposition === 'kill') {
                        if (foundArray !== 'temporaryEntities') {
                            (workingKb as any)[foundArray].splice(foundIndex, 1);
                        }
                    } else if (disposition === 'capture' && foundArray !== 'prisoners') {
                        if (foundArray !== 'temporaryEntities') {
                            (workingKb as any)[foundArray].splice(foundIndex, 1);
                        }
                    }
                }

                if (disposition === 'kill') {
                     systemMessages.push({
                        id: `sys-kill-${realId}-${Date.now()}`,
                        type: 'system',
                        content: `[Hệ thống] Đã kết liễu và xóa dữ liệu của ${entityName}.`,
                        timestamp: Date.now(),
                        turnNumber: workingKb.playerStats.turn
                     });

                     // Nếu chưa xử lý trích xuất chiến lợi phẩm ở màn hình trước, tiến hành trích xuất 50% trang bị cơ học ngay tại đây
                     if (!result.finalInventory && capturedEntity) {
                         const lootRes = extractLootFromDefeatedEntities([capturedEntity], { [entityId]: 'kill', [realId]: 'kill' }, workingKb);
                         if (lootRes.lootedItems.length > 0) {
                             workingKb.inventory = [...(workingKb.inventory || []), ...lootRes.lootedItems];
                             lootRes.systemLogMessages.forEach(msg => {
                                 systemMessages.push({
                                     id: `sys-loot-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                                     type: 'system',
                                     content: msg,
                                     timestamp: Date.now(),
                                     turnNumber: workingKb.playerStats.turn
                                 });
                             });
                         }
                     }
                } else if (disposition === 'capture' && capturedEntity) {
                    if (foundArray !== 'prisoners') {
                        // Đảm bảo hồi máu (sinh lực) về ít nhất là 1 HP ngay khi thực hiện bắt giữ
                        const updatedStats = { ...(capturedEntity.stats || {}) };
                        updatedStats.sinhLuc = 1;

                        const newPrisoner = {
                            ...capturedEntity,
                            stats: updatedStats,
                            entityType: 'prisoner',
                            satisfaction: 100,
                            captureReason: "Bị bắt sau trận đấu",
                        };

                        workingKb.prisoners.push(newPrisoner);

                        // Realize the NPC if it was a temporary entity
                        if (foundArray === 'temporaryEntities') {
                            // Check if already in discoveredNPCs to avoid duplicates (though unlikely for temp entities)
                            const exists = workingKb.discoveredNPCs.some(n => n.id === capturedEntity.id);
                            if (!exists) {
                                workingKb.discoveredNPCs.push({
                                    ...capturedEntity,
                                    stats: updatedStats,
                                    faction: 'neutral' // Reset faction to neutral when captured
                                });
                            }
                        }
                    }
                    systemMessages.push({
                        id: `sys-capture-${realId}-${Date.now()}`,
                        type: 'system',
                        content: `[Hệ thống] Đã bắt giam ${entityName} vào danh sách Tù Binh.`,
                        timestamp: Date.now(),
                        turnNumber: workingKb.playerStats.turn
                    });
                } else if (disposition === 'release') {
                     // Cộng ngay 1 HP cho NPC/Yêu thú tương ứng khi thả đi để tránh lỗi 0HP làm cho NPC bị xóa dữ liệu
                     let targetObj = (foundArray && foundIndex !== -1) ? (workingKb as any)[foundArray]?.[foundIndex] : null;
                     if (!targetObj) {
                         for (const arrName of ['discoveredNPCs', 'discoveredYeuThu', 'wives', 'slaves', 'prisoners']) {
                             const arr = (workingKb as any)[arrName];
                             if (Array.isArray(arr)) {
                                 targetObj = arr.find((item: any) => item && (item.id === realId || item.id === entityId || item.name === entityName));
                                 if (targetObj) break;
                             }
                         }
                     }

                     if (targetObj) {
                         if (!targetObj.stats) targetObj.stats = {};
                         const currentHp = typeof targetObj.stats.sinhLuc === 'number' ? targetObj.stats.sinhLuc : 0;
                         targetObj.stats.sinhLuc = Math.max(1, currentHp + 1);
                         targetObj.isDead = false;
                         if (targetObj.status === 'Đã tử vong (Tọa hóa)' || targetObj.status === 'Tử vong' || targetObj.status === '[ĐÃ CHẾT]') {
                             targetObj.status = 'Tự do';
                         }
                     }

                     systemMessages.push({
                        id: `sys-release-${realId}-${Date.now()}`,
                        type: 'system',
                        content: `[Hệ thống] Đã thả ${entityName} (Cộng 1 Sinh Lực hồi phục). Dữ liệu của người/yêu thú này vẫn được giữ nguyên.`,
                        timestamp: Date.now(),
                        turnNumber: workingKb.playerStats.turn
                     });
                }
            });

            // Đưa thông báo nhật ký thu hoạch chiến lợi phẩm từ RealTimeCombatScreen vào System Messages nếu có
            if (result.systemLogMessages && result.systemLogMessages.length > 0) {
                result.systemLogMessages.forEach(msg => {
                    systemMessages.push({
                        id: `sys-loot-msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                        type: 'system',
                        content: msg,
                        timestamp: Date.now(),
                        turnNumber: workingKb.playerStats.turn
                    });
                });
            }
        }

        const apiSettings = getGeminiApiSettings();

        // Switch to Gameplay screen early if streaming to show the progress
        if (styleSettings?.turnResponseMode === 'streaming') {
            setCurrentScreen(GameScreen.Gameplay);
            setIsStreaming(true);
            setStreamingText("");
            abortControllerRef.current = new AbortController();
        }

        let consequenceNarration = "";
        let consequenceTags: string[] = [];
        let consequenceChoices: AiChoice[] = [];
        let rawAiText = "";

        if (result.outcome === 'victory') {
             const { response, rawText } = await generateVictoryConsequence(
                workingKb,
                result,
                currentPageMessagesLog,
                previousPageSummaries,
                lastNarrationFromPreviousPage,
                summary,
                (prompt) => setSentVictoryConsequencePromptsLog(prev => [prompt, ...prev].slice(0, 10)),
                styleSettings?.turnResponseMode === 'streaming' ? (chunk) => setStreamingText(prev => prev + chunk) : undefined,
                abortControllerRef.current?.signal
             );
             setReceivedVictoryConsequenceResponsesLog(prev => [rawText, ...prev].slice(0, 10));
             
             rawAiText = rawText;
             consequenceNarration = response.narration;
             consequenceTags = [...(response.tags || [])];
             consequenceChoices = response.choices;

        } else {
             // Handle defeat, escaped, and surrendered with AI-generated consequence
             const { response, rawText } = await generateDefeatConsequence(
                workingKb,
                result,
                currentPageMessagesLog,
                previousPageSummaries,
                lastNarrationFromPreviousPage,
                summary,
                (prompt) => setSentVictoryConsequencePromptsLog(prev => [prompt, ...prev].slice(0, 10)),
                styleSettings?.turnResponseMode === 'streaming' ? (chunk) => setStreamingText(prev => prev + chunk) : undefined,
                abortControllerRef.current?.signal
             );
             setReceivedVictoryConsequenceResponsesLog(prev => [rawText, ...prev].slice(0, 10));

             rawAiText = rawText;
             consequenceNarration = response.narration;
             consequenceTags = [...(response.tags || [])];
             consequenceChoices = response.choices;
        }

        const lastAction = result.outcome === 'victory' ? "Chiến thắng trong trận chiến" : "Thất bại trong trận chiến";
        const combinedContent = consequenceNarration || `*Kết quả trận chiến:*\n${summary}`;

        // Đưa message vào state TRƯỚC KHI tắt cờ streaming để giao diện chuyển tiếp liền mạch không bị rỗng/biến mất văn bản
        const summaryMessage: GameMessage = {
            id: 'combat-summary-' + Date.now(),
            type: 'narration',
            content: combinedContent,
            timestamp: Date.now(),
            turnNumber: workingKb.playerStats.turn,
            choices: consequenceChoices
        };
        
        const updatedTurnLog = [
            ...(workingKb.currentTurnLog || []),
            { role: 'user' as const, text: lastAction },
            { role: 'model' as const, text: combinedContent }
        ].slice(-20);
        workingKb.currentTurnLog = updatedTurnLog;

        const allMessages = [summaryMessage, ...systemMessages];
        addMessageAndUpdateState(allMessages, workingKb);

        // Tắt trạng thái stream sau khi message đã an toàn nằm trong State
        setIsStreaming(false);
        setStreamingText("");

        // Check for Mat Phap (Manual Mode)
        if (apiSettings.matPhapManual) {
            // Set Mat Phap state to wait for extraction
            setUiState(prev => ({
                ...prev,
                matPhapStep: 'waiting_extraction',
                matPhapCtx: {
                    knowledgeBaseAtActionStart: workingKb,
                    cleanedAction: result.outcome === 'victory' ? "Chiến thắng" : "Kết quả chiến đấu",
                    turnOfPlayerAction: workingKb.playerStats.turn,
                    narrativeResult: { rawText: rawAiText, narration: consequenceNarration, choices: consequenceChoices }
                }
            }));
            
            setCurrentScreen(GameScreen.Gameplay);
            return;
        }

        // API Call 2: Gộp trích xuất tag và tổng hợp trí nhớ Flash Agent trong 1 cuộc gọi duy nhất
        const locDetail = workingKb.discoveredLocations.find(loc => loc.id === workingKb.currentLocationId);
        const locName = locDetail ? locDetail.name : "Không rõ";
        const worldDate = workingKb.worldDate;
        const timeStr = worldDate 
            ? `${worldDate.timeOfDay}, Ngày ${worldDate.day}, Tháng ${worldDate.month}, Năm ${worldDate.year}`
            : "Không rõ";

        const extractionRes = await DataExtractionService.extractTagsAndMemory(
            rawAiText,
            lastAction,
            workingKb.playerStats.turn,
            locName,
            timeStr,
            workingKb
        );
        consequenceTags = [...consequenceTags, ...(extractionRes.tags || [])];
        
        if (consequenceTags.length > 0) {
             const { newKb, systemMessagesFromTags } = await performTagProcessing(
                workingKb,
                consequenceTags,
                workingKb.playerStats.turn,
                logNpcAvatarPromptCallback
             );
             workingKb = newKb;
             if (systemMessagesFromTags.length > 0) {
                 addMessageAndUpdateState(systemMessagesFromTags, workingKb);
             }
        }

        // Đồng bộ Flash Memory Offline (0 API Call phụ)
        if (extractionRes.flashSummary || extractionRes.flashDetails) {
            await saveFlashAgentMemoryOffline(
                workingKb.playerStats.turn,
                setKnowledgeBase,
                extractionRes.flashSummary || "",
                extractionRes.flashDetails || "",
                workingKb,
                locName,
                timeStr,
                rawAiText
            );
        }
        
        workingKb.pendingCombat = null;
        workingKb.postCombatState = null;
        if (workingKb.playerStats) {
            workingKb.playerStats.isInCombat = false;
        }
        setKnowledgeBase(workingKb);
        setCurrentScreen(GameScreen.Gameplay);

    } catch (error) {
        console.error("Error generating post-combat summary:", error);
        const errorMsg = `Lỗi tạo tóm tắt sau trận chiến: ${error instanceof Error ? error.message : String(error)}`;
        setApiErrorWithTimeout(errorMsg);

        workingKb.pendingCombat = null;
        workingKb.postCombatState = null;
        if (workingKb.playerStats) {
            workingKb.playerStats.isInCombat = false;
        }
        addMessageAndUpdateState(systemMessages, workingKb);
        setKnowledgeBase(workingKb);
        setCurrentScreen(GameScreen.Gameplay);
    } finally {
        setIsLoadingApi(false);
    }
}, [
    knowledgeBase, currentPageMessagesLog, previousPageSummaries, lastNarrationFromPreviousPage,
    addMessageAndUpdateState, handleNonCombatDefeat, setIsLoadingApi, resetApiError,
    setSentCombatSummaryPromptsLog, setReceivedCombatSummaryResponsesLog,
    setSentVictoryConsequencePromptsLog, setReceivedVictoryConsequenceResponsesLog,
    setKnowledgeBase, logNpcAvatarPromptCallback, setCurrentScreen, setApiErrorWithTimeout, showNotification, handleSuccession
]);


    const handleBuySlave = useCallback((slave: Slave, vendorId: string) => {
        const { turnHistory, ...rest } = knowledgeBase;
        const newKb = JSON.parse(JSON.stringify(rest)) as KnowledgeBase;
        const vendor = newKb.discoveredNPCs.find((n: NPC) => n.id === vendorId);
        if (!vendor) return;

        const price = slave.value || 0;
        if (newKb.playerStats.currency < price) {
            showNotification(VIETNAMESE.notEnoughMoney, 'error');
            return;
        }

        newKb.playerStats.currency -= price;

        const { value, ...newSlaveForCollection } = slave;
        newKb.slaves.push(newSlaveForCollection as Slave);

        if (vendor.slavesForSale) {
            vendor.slavesForSale = vendor.slavesForSale.filter((s: Slave) => s.id !== slave.id);
        }

        const currencyName = newKb.worldConfig?.currencyName || "linh thạch";
        const inGameDateStr = `Ngày ${newKb.worldDate?.day || 1} Tháng ${newKb.worldDate?.month || 1} Năm ${newKb.worldDate?.year || 1} (${newKb.worldDate?.timeOfDay || 'Sáng'})`;
        const slaveGender = slave.gender || "Không rõ";
        const buyLocation = vendor.name || "Cửa Hàng Nô Lệ";
        const playerName = newKb.worldConfig?.playerName || "Người chơi";

        const eventSummaryContent = `[TỔNG KẾT MUA NÔ LỆ CỬA HÀNG]
- Số lượt chơi hiện tại (turnNumber): Lượt ${newKb.playerStats.turn}
- Ngày tháng đã mua: ${inGameDateStr}
- Địa điểm mua nô lệ: ${buyLocation}
- Tên nô lệ đã giao dịch: ${slave.name} (Giới tính: ${slaveGender})
- Mức giá cuối cùng (finalPrice): ${price.toLocaleString()} ${currencyName}
- Trạng thái giao dịch: ${playerName} mua thành công tại cửa hàng của ${vendor.name}.

Chi tiết diễn biến: AI mô tả MC mua thành công nô lệ ${slave.name} với giá ${price.toLocaleString()} ${currencyName} từ cửa hàng của ${vendor.name}.`;

        showNotification(`Bạn đã mua nô lệ ${slave.name} với giá ${price.toLocaleString()} ${currencyName}.`, 'success');

        const updatedKb = { ...newKb, turnHistory };

        addMessageAndUpdateState([{
            id: `slave-buy-shop-${slave.id}-${Date.now()}`,
            type: 'event_summary',
            content: eventSummaryContent,
            timestamp: Date.now(),
            turnNumber: newKb.playerStats.turn
        }], updatedKb);
    }, [knowledgeBase, addMessageAndUpdateState, showNotification]);
    
    const handleBuyPrisoner = useCallback((prisonerId: string, vendorId: string) => {
        const { turnHistory, ...rest } = knowledgeBase;
        const newKb = JSON.parse(JSON.stringify(rest)) as KnowledgeBase;
        const vendor = newKb.discoveredNPCs.find((n: NPC) => n.id === vendorId);
        if (!vendor || !vendor.prisonersForSale) {
             showNotification("Lỗi: Không tìm thấy thương nhân hoặc thương nhân không bán tù nhân.", 'error');
            return;
        }

        const prisonerIndex = vendor.prisonersForSale.findIndex(p => p.id === prisonerId);
        if (prisonerIndex === -1) {
            showNotification("Lỗi: Không tìm thấy tù nhân trong danh sách bán.", 'error');
            return;
        }

        const prisonerToBuy = vendor.prisonersForSale[prisonerIndex];
        const price = (prisonerToBuy as any).value || 0;

        if (newKb.playerStats.currency < price) {
            showNotification(VIETNAMESE.notEnoughMoney, 'error');
            return;
        }

        newKb.playerStats.currency -= price;
        vendor.prisonersForSale.splice(prisonerIndex, 1);
        newKb.prisoners.push(prisonerToBuy);
        
        const currencyName = newKb.worldConfig?.currencyName || "linh thạch";
        const inGameDateStr = `Ngày ${newKb.worldDate?.day || 1} Tháng ${newKb.worldDate?.month || 1} Năm ${newKb.worldDate?.year || 1} (${newKb.worldDate?.timeOfDay || 'Sáng'})`;
        const prisonerGender = prisonerToBuy.gender || "Không rõ";
        const buyLocation = vendor.name || "Cửa Hàng Tù Nhân";
        const playerName = newKb.worldConfig?.playerName || "Người chơi";

        const eventSummaryContent = `[TỔNG KẾT MUA TÙ NHÂN CỬA HÀNG]
- Số lượt chơi hiện tại (turnNumber): Lượt ${newKb.playerStats.turn}
- Ngày tháng đã mua: ${inGameDateStr}
- Địa điểm mua tù nhân: ${buyLocation}
- Tên tù nhân đã giao dịch: ${prisonerToBuy.name} (Giới tính: ${prisonerGender})
- Mức giá cuối cùng (finalPrice): ${price.toLocaleString()} ${currencyName}
- Trạng thái giao dịch: ${playerName} mua thành công tù nhân tại cửa hàng của ${vendor.name}.

Chi tiết diễn biến: AI mô tả MC mua thành công tù nhân ${prisonerToBuy.name} với giá ${price.toLocaleString()} ${currencyName} từ cửa hàng của ${vendor.name}.`;

        showNotification(`Bạn đã mua tù nhân ${prisonerToBuy.name} với giá ${price.toLocaleString()} ${currencyName}.`, 'success');

        const updatedKb = { ...newKb, turnHistory };

        addMessageAndUpdateState([{
            id: `prisoner-buy-shop-${prisonerToBuy.id}-${Date.now()}`,
            type: 'event_summary',
            content: eventSummaryContent,
            timestamp: Date.now(),
            turnNumber: newKb.playerStats.turn
        }], updatedKb);
    }, [knowledgeBase, addMessageAndUpdateState, showNotification]);

    const handleSellPrisoner = useCallback((prisonerId: string, vendorId: string) => {
        const { turnHistory, ...rest } = knowledgeBase;
        const newKb = JSON.parse(JSON.stringify(rest)) as KnowledgeBase;
        
        const prisonerIndex = newKb.prisoners.findIndex(p => p.id === prisonerId);
        if (prisonerIndex === -1) {
            showNotification("Không tìm thấy tù nhân để bán.", "error");
            return;
        }

        const prisonerToSell = newKb.prisoners[prisonerIndex];
        
        const calculatedValue = calculatePrisonerValue(prisonerToSell, newKb);
        const sellPrice = Math.floor(calculatedValue * 0.8);

        const vendor = newKb.discoveredNPCs.find(n => n.id === vendorId);
        if (!vendor) {
            showNotification(`Không tìm thấy thương nhân với ID ${vendorId}.`, "error");
            return;
        }

        newKb.prisoners.splice(prisonerIndex, 1);
        
        newKb.playerStats.currency += sellPrice;

        if (!vendor.slavesForSale) {
            vendor.slavesForSale = [];
        }
        
        const { resistance, ...restOfPrisoner } = prisonerToSell as any;

        const slaveForResale: Slave = {
            ...restOfPrisoner,
            id: `slave-sold-${restOfPrisoner.name.replace(/\s/g, '-')}-${Date.now()}`,
            entityType: 'slave',
            value: calculatedValue,
            obedience: Math.min(100, (restOfPrisoner.obedience || 0) + 20),
            willpower: Math.max(0, (restOfPrisoner.willpower || 0) - 20),
            skills: restOfPrisoner.skills || [],
            equippedItems: restOfPrisoner.equippedItems || { mainWeapon: null, offHandWeapon: null, head: null, body: null, hands: null, legs: null, artifact: null, pet: null, accessory1: null, accessory2: null },
        };

        vendor.slavesForSale.push(slaveForResale);

        const currencyName = newKb.worldConfig?.currencyName || "linh thạch";
        const inGameDateStr = `Ngày ${newKb.worldDate?.day || 1} Tháng ${newKb.worldDate?.month || 1} Năm ${newKb.worldDate?.year || 1} (${newKb.worldDate?.timeOfDay || 'Sáng'})`;
        const prisonerGender = prisonerToSell.gender || "Không rõ";
        const sellLocation = vendor.name || "Cửa Hàng Tù Nhân";
        const playerName = newKb.worldConfig?.playerName || "Người chơi";

        const eventSummaryContent = `[TỔNG KẾT BÁN TÙ NHÂN CỬA HÀNG]
- Số lượt chơi hiện tại (turnNumber): Lượt ${newKb.playerStats.turn}
- Ngày tháng đã bán: ${inGameDateStr}
- Địa điểm bán tù nhân: ${sellLocation}
- Tên tù nhân đã giao dịch: ${prisonerToSell.name} (Giới tính: ${prisonerGender})
- Mức giá thu về (finalPrice): ${sellPrice.toLocaleString()} ${currencyName}
- Trạng thái giao dịch: ${playerName} bán thành công tù nhân cho cửa hàng của ${vendor.name}.

Chi tiết diễn biến: AI mô tả MC bán thành công tù nhân ${prisonerToSell.name} với giá ${sellPrice.toLocaleString()} ${currencyName} cho cửa hàng của ${vendor.name}.`;

        showNotification(`Bạn đã bán tù nhân ${prisonerToSell.name} với giá ${sellPrice.toLocaleString()} ${currencyName}.`, 'success');

        const updatedKb = { ...newKb, turnHistory };

        addMessageAndUpdateState([{
            id: `prisoner-sell-shop-${prisonerToSell.id}-${Date.now()}`,
            type: 'event_summary',
            content: eventSummaryContent,
            timestamp: Date.now(),
            turnNumber: newKb.playerStats.turn
        }], updatedKb);
    }, [knowledgeBase, addMessageAndUpdateState, showNotification]);

    const handleSellSlave = useCallback((slaveId: string, vendorId: string) => {
        const { turnHistory, ...rest } = knowledgeBase;
        const newKb = JSON.parse(JSON.stringify(rest)) as KnowledgeBase;
        
        const slaveIndex = newKb.slaves.findIndex(s => s.id === slaveId);
        if (slaveIndex === -1) {
            showNotification("Không tìm thấy nô lệ để bán.", "error");
            return;
        }

        const slaveToSell = newKb.slaves[slaveIndex];
        const calculatedValue = calculateSlaveValue(slaveToSell, newKb);
        const sellPrice = Math.floor(calculatedValue * 0.8);

        const vendor = newKb.discoveredNPCs.find(n => n.id === vendorId);
        if (!vendor) {
            showNotification(`Không tìm thấy thương nhân với ID ${vendorId}.`, "error");
            return;
        }

        newKb.slaves.splice(slaveIndex, 1);
        newKb.playerStats.currency += sellPrice;

        if (!vendor.slavesForSale) {
            vendor.slavesForSale = [];
        }
        const slaveForResale = {...slaveToSell, value: calculatedValue};
        vendor.slavesForSale.push(slaveForResale);

        const currencyName = newKb.worldConfig?.currencyName || "linh thạch";
        const inGameDateStr = `Ngày ${newKb.worldDate?.day || 1} Tháng ${newKb.worldDate?.month || 1} Năm ${newKb.worldDate?.year || 1} (${newKb.worldDate?.timeOfDay || 'Sáng'})`;
        const slaveGender = slaveToSell.gender || "Không rõ";
        const sellLocation = vendor.name || "Cửa Hàng Nô Lệ";
        const playerName = newKb.worldConfig?.playerName || "Người chơi";

        const eventSummaryContent = `[TỔNG KẾT BÁN NÔ LỆ CỬA HÀNG]
- Số lượt chơi hiện tại (turnNumber): Lượt ${newKb.playerStats.turn}
- Ngày tháng đã bán: ${inGameDateStr}
- Địa điểm bán nô lệ: ${sellLocation}
- Tên nô lệ đã giao dịch: ${slaveToSell.name} (Giới tính: ${slaveGender})
- Mức giá thu về (finalPrice): ${sellPrice.toLocaleString()} ${currencyName}
- Trạng thái giao dịch: ${playerName} bán thành công nô lệ cho cửa hàng của ${vendor.name}.

Chi tiết diễn biến: AI mô tả MC bán thành công nô lệ ${slaveToSell.name} với giá ${sellPrice.toLocaleString()} ${currencyName} cho cửa hàng của ${vendor.name}.`;

        showNotification(`Bạn đã bán nô lệ ${slaveToSell.name} với giá ${sellPrice.toLocaleString()} ${currencyName}.`, 'success');

        const updatedKb = { ...newKb, turnHistory };

        addMessageAndUpdateState([{
            id: `slave-sell-shop-${slaveToSell.id}-${Date.now()}`,
            type: 'event_summary',
            content: eventSummaryContent,
            timestamp: Date.now(),
            turnNumber: newKb.playerStats.turn
        }], updatedKb);
    }, [knowledgeBase, addMessageAndUpdateState, showNotification]);

    const handleStartSlaveAuction = slaveAuctionActions.handleStartSlaveAuction;
    const handlePlayerSlaveAuctionAction = slaveAuctionActions.handlePlayerSlaveAuctionAction;
    const handleSlaveAuctioneerCall = slaveAuctionActions.handleSlaveAuctioneerCall;
    const handleSkipSlaveAuctionItem = slaveAuctionActions.handleSkipSlaveAuctionItem;

    const handleStartBreakthroughCombat = useCallback(async () => {
        setIsLoadingApi(true);
        
        const pStats = knowledgeBase.playerStats;
        const numAllies = knowledgeBase.combatCompanionIds ? knowledgeBase.combatCompanionIds.length : 0;
        const totalBosses = 1 + numAllies; // 1 base + 1 per ally

        const newOpponents: NPC[] = [];
        const newOpponentIds: string[] = [];

        for (let i = 0; i < totalBosses; i++) {
            const lightningSkill = GameTemplates.COMBAT_MODE_SKILLS.find(s => s.name === 'combat Lôi Long Giáng Thế') 
                || GameTemplates.COMBAT_MODE_SKILLS.find(s => s.name === 'combat Lạc Lôi Thuật');
            
            const bossSkills: Skill[] = [];
            if (lightningSkill) {
                bossSkills.push({
                    id: `boss-skill-${i}-${Date.now()}`,
                    name: lightningSkill.name,
                    description: lightningSkill.description,
                    skillType: GameTemplates.SkillType.LINH_KI,
                    manaCost: lightningSkill.mpCost,
                    baseDamage: lightningSkill.effect.basePower || 50,
                    cooldown: 2,
                    currentCooldown: 0,
                    proficiency: 100,
                    maxProficiency: 100,
                    proficiencyTier: 'Viên Mãn',
                    detailedEffect: JSON.stringify(lightningSkill.effect),
                    effect: lightningSkill.effect,
                    damageMultiplier: 0,
                    healingAmount: 0,
                    healingMultiplier: 0,
                });
            } else {
                bossSkills.push({
                    id: `boss-skill-fallback-${i}-${Date.now()}`,
                    name: "combat Lôi Kích",
                    description: "Tấn công bằng sấm sét.",
                    skillType: GameTemplates.SkillType.LINH_KI,
                    manaCost: 10,
                    baseDamage: 50,
                    cooldown: 1,
                    currentCooldown: 0,
                    proficiency: 100,
                    maxProficiency: 100,
                    proficiencyTier: 'Viên Mãn',
                    detailedEffect: "Gây sát thương lôi hệ",
                    effect: { type: 'DAMAGE_HP', basePower: 50, element: 'thunder', target: 'single_enemy' },
                    damageMultiplier: 0,
                    healingAmount: 0,
                    healingMultiplier: 0,
                });
            }

            const bossId = `tribulation-boss-${i}-${Date.now()}`;
            const suffix = i === 0 ? "(Chủ)" : `(Ảnh ${i})`;
            
            const boss: NPC = {
                id: bossId,
                name: `Lôi Kiếp Hóa Thân ${suffix}`,
                gender: "Khác",
                race: "Thiên Đạo",
                description: `Sự phẫn nộ của trời đất ngưng tụ thành hình người, tương ứng với chấp niệm của ${i === 0 ? 'bạn' : 'đồng minh'}.`,
                affinity: -100,
                realm: pStats.realm || "Phàm Nhân",
                tuChat: "Thần Phẩm",
                stats: {},
                skills: bossSkills,
                personalityTraits: ["Hủy Diệt", "Vô Tình"],
                relationshipToPlayer: "Thử Thách Sinh Tử",
                avatarUrl: "https://res.cloudinary.com/dropcqgvd/image/upload/v1750815171/190.png"
            };

            updateEntityStatsFromRealm(boss, knowledgeBase);

            newOpponents.push(boss);
            newOpponentIds.push(bossId);
        }

        setKnowledgeBase(prev => {
            const { turnHistory, ...rest } = prev;
            const newKb = JSON.parse(JSON.stringify(rest));
            newKb.discoveredNPCs.push(...newOpponents);
            const { limitedOpponentIds } = limitCombatParticipants([], newOpponentIds);
            newKb.pendingCombat = {
                opponentIds: limitedOpponentIds,
                surrenderedNpcIds: [],
                analyzed: false
            };
            newKb.pendingBreakthrough = {
                targetRealm: "Next Level", 
                requirements: "Victory"
            };
            newKb.playerStats.isInCombat = true; 
            return { ...newKb, turnHistory };
        });

        showNotification(`Thiên kiếp giáng lâm! ${totalBosses} Lôi Kiếp Hóa Thân đã xuất hiện!`, "warning");
        setCurrentScreen(GameScreen.Combat);
        setIsLoadingApi(false);

    }, [knowledgeBase.playerStats, knowledgeBase.combatCompanionIds, setKnowledgeBase, setCurrentScreen, setIsLoadingApi, showNotification]);

    const handleFreePerson = useCallback(async (personId: string, personType: 'prisoner' | 'slave' | 'wife') => {
        setKnowledgeBase(prev => {
            const { turnHistory, ...rest } = prev;
            const newKb = JSON.parse(JSON.stringify(rest));
            let personArray: (Prisoner[] | Slave[] | Wife[]);
            let personIndex = -1;
            
            if (personType === 'prisoner') {
                personArray = newKb.prisoners;
                personIndex = newKb.prisoners.findIndex((p: { id: string; }) => p.id === personId);
            } else if (personType === 'slave') {
                personArray = newKb.slaves;
                personIndex = newKb.slaves.findIndex((s: { id: string; }) => s.id === personId);
            } else {
                 personArray = newKb.wives;
                 personIndex = newKb.wives.findIndex((w: { id: string; }) => w.id === personId);
            }
            
            if (personIndex === -1) {
                showNotification("Không tìm thấy người để trả tự do.", "error");
                return prev;
            }
            
            const [freedPerson] = personArray.splice(personIndex, 1) as any[];
            
            const { entityType, willpower, obedience, resistance, equippedItems, skills, ...baseNpcData } = freedPerson;
            const newNpc: NPC = {
                ...baseNpcData,
                relationshipToPlayer: 'Người quen cũ',
                affinity: Math.max(freedPerson.affinity, 10),
                locationId: newKb.currentLocationId,
                skills: skills || [],
            };
            
            newKb.discoveredNPCs.push(newNpc);
            
            if (newKb.combatCompanionIds) {
                newKb.combatCompanionIds = newKb.combatCompanionIds.filter((id: string) => id !== personId);
            }
            
            const message = `Bạn đã trả tự do cho ${newNpc.name}. Khuôn mặt họ thoáng chút ngỡ ngàng, rồi cúi đầu thật sâu trước bạn. "Đa tạ ân nhân tái tạo." Nói rồi, họ quay lưng, hòa vào dòng người, bắt đầu một cuộc đời mới.`;
            
            addMessageAndUpdateState(
                [{ id: `freed-${newNpc.id}`, type: 'system', content: message, timestamp: Date.now(), turnNumber: newKb.playerStats.turn }],
                newKb
            );
            
            showNotification(`${newNpc.name} đã được tự do.`, "success");
            
            return { ...newKb, turnHistory };
        });
    }, [setKnowledgeBase, showNotification, addMessageAndUpdateState]);
    
    const onStartDebugCombat = useCallback(() => {
        showNotification("Đang tạo trận chiến thử...", 'info');
        setKnowledgeBase(prev => {
            const { turnHistory, ...rest } = prev;
            const newKb = JSON.parse(JSON.stringify(rest)) as KnowledgeBase;

            const combatLocationId = 'debug-combat-location';
            // Ensure the debug location exists
            if (!newKb.discoveredLocations.some(l => l.id === combatLocationId)) {
                newKb.discoveredLocations.push({
                    id: combatLocationId,
                    name: "Bãi đất hoang",
                    description: "Một bãi đất trống thích hợp để tỉ thí.",
                    visited: true
                });
            }
            newKb.currentLocationId = combatLocationId;

            // --- HELPER: Random Skill Picker ---
            const pickRandomSkills = (count: number, idPrefix: string): Skill[] => {
                const allSkills = GameTemplates.COMBAT_MODE_SKILLS;
                // Fisher-Yates shuffle for randomness
                const shuffled = [...allSkills];
                for (let i = shuffled.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
                }
                
                const selectedTemplates = shuffled.slice(0, count);
                
                return selectedTemplates.map(template => ({
                    id: `${idPrefix}-${template.name.replace(/\s/g, '-')}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                    name: template.name,
                    description: template.description,
                    skillType: GameTemplates.SkillType.LINH_KI, // Assuming most are combat skills
                    manaCost: template.mpCost,
                    baseDamage: template.effect.type === 'DAMAGE_HP' ? (template.effect.basePower || 0) : 0,
                    healingAmount: template.effect.type === 'HEAL_HP' ? (template.effect.basePower || 0) : 0,
                    damageMultiplier: 0,
                    healingMultiplier: 0,
                    cooldown: 0, // Basic offline cooldown
                    currentCooldown: 0,
                    proficiency: 50, // Average proficiency
                    maxProficiency: 100,
                    proficiencyTier: 'Sơ Nhập',
                    detailedEffect: JSON.stringify(template.effect),
                    effect: template.effect
                }));
            };

            // --- HELPER: Create Stats corresponding to Realm ---
            const debugMajorRealms = [
                "Luyện Nhục Cảnh",
                "Ngưng Khí Cảnh",
                "Trúc Cơ Cảnh",
                "Huyết Linh Cảnh",
                "Kim Đan Cảnh",
                "Nguyên Anh Cảnh",
                "Hóa Thần Cảnh",
                "Luyện Hư Cảnh",
                "Hợp Đạo Cảnh",
                "Chân Tiên Cảnh"
            ];
            const debugMinorRealms = [
                "Nhất Trọng",
                "Nhị Trọng",
                "Tam Trọng",
                "Tứ Trọng",
                "Ngũ Trọng",
                "Lục Trọng",
                "Thất Trọng",
                "Bát Trọng",
                "Cửu Trọng",
                "Thập Trọng"
            ];

            const getRealmFromIndex = (index: number): string => {
                const majorIdx = Math.floor(index / 10);
                const minorIdx = index % 10;
                return `${debugMajorRealms[majorIdx]} ${debugMinorRealms[minorIdx]}`;
            };

            const getNPCRandomRealmIndex = (pIndex: number): number => {
                const minIdx = Math.max(0, pIndex - 2);
                const maxIdx = Math.min(99, pIndex + 2);
                return Math.floor(Math.random() * (maxIdx - minIdx + 1)) + minIdx;
            };

            // Set custom debug realm system in the cloned knowledge base so all services pick it up
            newKb.worldConfig = {
                ...(newKb.worldConfig || {}),
                isCultivationEnabled: true
            } as any;
            newKb.realmProgressionList = debugMajorRealms;
            newKb.minorRealmProgressionList = debugMinorRealms;

            const createRandomStats = (realm: string): Partial<PlayerStats> => {
                const base = calculateRealmBaseStats(realm, debugMajorRealms, undefined, debugMinorRealms);
                
                // Add some variance based on Tu Chat / Aptitude (random for debug)
                const tuChatTiers: TuChatTier[] = ["Phế Phẩm", "Hạ Phẩm", "Trung Phẩm", "Thượng Phẩm", "Cực Phẩm", "Tiên Phẩm", "Thần Phẩm", "Thánh Phẩm"];
                const randomTuChat = tuChatTiers[Math.floor(Math.random() * tuChatTiers.length)];
                const variance = 0.9 + Math.random() * 0.2; // 90% to 110%
                
                const finalHp = Math.round(base.baseMaxSinhLuc * variance);
                const finalMp = Math.round(base.baseMaxLinhLuc * variance);
                const finalAtk = Math.round(base.baseSucTanCong * variance);

                return {
                    ...DEFAULT_PLAYER_STATS,
                    baseMaxSinhLuc: finalHp,
                    maxSinhLuc: finalHp,
                    sinhLuc: finalHp,
                    baseMaxLinhLuc: finalMp,
                    maxLinhLuc: finalMp,
                    linhLuc: finalMp,
                    baseSucTanCong: finalAtk,
                    sucTanCong: finalAtk,
                    realm: realm,
                    tuChat: randomTuChat,
                };
            };

            // --- 1. PLAYER SETUP ---
            // Update Player Stats for Combat - Match NPC realms better
            const playerIndex = Math.floor(Math.random() * 100); // 0 to 99
            const randomPlayerRealm = getRealmFromIndex(playerIndex);
            const basePlayerStats = createRandomStats(randomPlayerRealm);
            
            // Generate Random Equipment for Debug using common generator
            const debugWeapon = CombatEquipmentGenerator.generateRandomEquipment('mainWeapon', 'Vũ Khí', randomPlayerRealm, debugMajorRealms);
            const debugArmor = CombatEquipmentGenerator.generateRandomEquipment('body', 'Giáp Thân', randomPlayerRealm, debugMajorRealms);

            newKb.inventory.push(debugWeapon as any, debugArmor as any);
            newKb.equippedItems['mainWeapon'] = debugWeapon.id;
            newKb.equippedItems['body'] = debugArmor.id;

            const playerStatsRaw: PlayerStats = {
                ...newKb.playerStats,
                baseMaxSinhLuc: basePlayerStats.maxSinhLuc!,
                baseMaxLinhLuc: basePlayerStats.maxLinhLuc!,
                baseSucTanCong: basePlayerStats.sucTanCong!,
                baseMaxKinhNghiem: basePlayerStats.maxKinhNghiem || 1000,
                sinhLuc: basePlayerStats.maxSinhLuc!,
                linhLuc: basePlayerStats.maxLinhLuc!,
                sucTanCong: basePlayerStats.sucTanCong!,
                realm: basePlayerStats.realm!,
            };

            // Sync initial stats with equipped items
            newKb.playerStats = calculateEffectiveStats(playerStatsRaw, newKb.equippedItems as any, newKb.inventory);
            // Ensure current HP/MP are full
            newKb.playerStats.sinhLuc = newKb.playerStats.maxSinhLuc;
            newKb.playerStats.linhLuc = newKb.playerStats.maxLinhLuc;

            // Give player ALL available combat skills for testing purposes
            const playerSkills = pickRandomSkills(GameTemplates.COMBAT_MODE_SKILLS.length, 'player');
            newKb.playerSkills = playerSkills;

            // Give player Phoenix Tears (useful for testing revive/heal)
            const phoenixItemTemplate = GameTemplates.COMBAT_MODE_ITEMS.find(i => i.name === 'combat Phượng Hoàng Lệ');
            if (phoenixItemTemplate) {
                const existingItem = newKb.inventory.find(i => i.name === phoenixItemTemplate.name);
                if (existingItem) {
                    existingItem.quantity = 10;
                } else {
                    newKb.inventory.push({
                        id: `debug-item-phoenix-${Date.now()}`,
                        name: phoenixItemTemplate.name,
                        description: phoenixItemTemplate.description,
                        category: GameTemplates.ItemCategory.POTION,
                        quantity: 10,
                        rarity: GameTemplates.ItemRarity.QUY_BAU,
                        effect: phoenixItemTemplate.effect,
                        value: 100,
                    } as any);
                }
            }
            
            // --- 2. ENEMY SETUP ---
            const enemyCount = Math.floor(Math.random() * 6) + 1; // 1 to 6 enemies
            const enemyPrefixes = ["Hắc Phong", "Bạch Cốt", "Huyết Ma", "Âm Sát", "Độc Long"];
            const enemyRoles = ["Đao Khách", "Kiếm Sĩ", "Pháp Sư", "Sát Thủ", "Cuồng Chiến"];
            const enemyIds: string[] = [];

            for (let i = 1; i <= enemyCount; i++) {
                const prefix = enemyPrefixes[Math.floor(Math.random() * enemyPrefixes.length)];
                const role = enemyRoles[Math.floor(Math.random() * enemyRoles.length)];
                const name = `${prefix} ${role} ${i}`;
                
                const enemyId = `debug-enemy-${i}-${Date.now()}`;
                const skills = pickRandomSkills(3, `enemy${i}`); // 3 skills per enemy
                const randomEnemyRealmIndex = getNPCRandomRealmIndex(playerIndex);
                const randomEnemyRealm = getRealmFromIndex(randomEnemyRealmIndex);
                const stats = createRandomStats(randomEnemyRealm);

                const enemy: NPC = {
                    id: enemyId,
                    name: name,
                    gender: Math.random() > 0.5 ? "Nam" : "Nữ",
                    race: "Nhân Tộc",
                    description: "Một kẻ địch nguy hiểm xuất hiện trong trận chiến thử nghiệm.",
                    affinity: -100,
                    realm: stats.realm!,
                    tuChat: stats.tuChat as TuChatTier || "Trung Phẩm",
                    stats: stats,
                    skills: skills,
                    personalityTraits: ["Hung hãn", "Tham lam"],
                    locationId: combatLocationId,
                };

                // NEW: Equip NPC
                CombatEquipmentGenerator.equipNPCsBeforeBattle([enemy], newKb);

                newKb.discoveredNPCs.push(enemy);
                enemyIds.push(enemyId);
            }

            // --- 3. ALLY SETUP ---
            const allyCount = Math.floor(Math.random() * 5); // 0 to 4 allies
            const allyNames = ["Tiểu Lan", "Lão Trương", "Mộ Dung", "Lý Tầm Hoan", "Kiều Phong"];
            const allyIds: string[] = [];

            for (let i = 1; i <= allyCount; i++) {
                const name = allyNames[Math.floor(Math.random() * allyNames.length)] + ` ${i}`;
                const allyId = `debug-ally-${i}-${Date.now()}`;
                const skills = pickRandomSkills(3, `ally${i}`);
                const randomAllyRealmIndex = getNPCRandomRealmIndex(playerIndex);
                const randomAllyRealm = getRealmFromIndex(randomAllyRealmIndex);
                const stats = createRandomStats(randomAllyRealm);

                const ally: NPC = {
                    id: allyId,
                    name: name,
                    gender: Math.random() > 0.5 ? "Nam" : "Nữ",
                    race: "Nhân Tộc",
                    description: "Một người bạn đồng hành đáng tin cậy.",
                    affinity: 80,
                    realm: stats.realm!,
                    tuChat: stats.tuChat as TuChatTier || "Trung Phẩm",
                    stats: stats,
                    skills: skills,
                    personalityTraits: ["Trung thành", "Dũng cảm"],
                    locationId: combatLocationId,
                };
                
                // NEW: Equip Ally
                CombatEquipmentGenerator.equipNPCsBeforeBattle([ally], newKb);

                newKb.discoveredNPCs.push(ally);
                allyIds.push(allyId);
            }
            
            // Set allies
            newKb.combatCompanionIds = allyIds;

            // --- 4. SET COMBAT STATE ---
            newKb.playerStats.isInCombat = true;
            const { limitedOpponentIds } = limitCombatParticipants(allyIds, enemyIds);
            newKb.pendingCombat = {
                opponentIds: limitedOpponentIds,
                surrenderedNpcIds: [],
                analyzed: false
            };
            
            return { ...newKb, turnHistory };
        });
    
        setTimeout(() => {
            setCurrentScreen(GameScreen.Combat);
        }, 50);
    
    }, [setKnowledgeBase, setCurrentScreen, showNotification]);

  // FIX: Implemented the missing handleStartChallenge function.
  const handleStartChallenge = useCallback(async (target: NPC | Wife | Slave | Prisoner) => {
    if (isLoadingApi) return;
    setIsLoadingApi(true);
    resetApiError();
    showNotification(`Bạn đang khiêu chiến ${target.name}...`, 'info');

    try {
        const response = await judgeChallengeConsequences(
            knowledgeBase,
            target,
            (prompt) => setSentPromptsLog(prev => [prompt, ...prev].slice(0, 10))
        );
        
        const tagsToProcess = extractSatelliteTags((response as any)?.rawText, response?.tags);
        const { newKb, systemMessagesFromTags } = await performTagProcessing(
            knowledgeBase,
            tagsToProcess,
            knowledgeBase.playerStats.turn,
            logNpcAvatarPromptCallback
        );
        
        addMessageAndUpdateState(systemMessagesFromTags, newKb, undefined, () => {
            // If pendingCombat is set by the tags, switch to the combat screen
            if (newKb.pendingCombat) {
                setCurrentScreen(GameScreen.Combat);
            }
        });

    } catch (e) {
        const errorMsg = e instanceof Error ? e.message : "Lỗi khi xử lý khiêu chiến.";
        setApiErrorWithTimeout(errorMsg);
    } finally {
        setIsLoadingApi(false);
    }
  }, [knowledgeBase, isLoadingApi, setIsLoadingApi, resetApiError, showNotification, setSentPromptsLog, addMessageAndUpdateState, setCurrentScreen, setApiErrorWithTimeout, setKnowledgeBase, logNpcAvatarPromptCallback]);
  
  const handleAnalyzeCombat = useCallback(async (kb: KnowledgeBase) => {
    if (isLoadingApi) return;
    setIsLoadingApi(true);
    resetApiError();

    try {
        // Get the last two narrations for context
        const narrations = gameMessages
            .filter(m => m.type === 'narration' || (m.type === 'system' && !m.content.startsWith('⚔️')))
            .slice(-4)
            .map(m => m.content);
        
        const currentNarration = narrations.join("\n");
        const previousNarration = "";

        const analysis = await analyzeCombatants(
            kb,
            currentNarration,
            previousNarration,
            (prompt) => setSentPromptsLog(prev => [prompt, ...prev].slice(0, 10))
        );

        const resolved = resolveCombatantIds(analysis, kb);

        setKnowledgeBase(prev => {
            const newKb = JSON.parse(JSON.stringify(prev));
            if (newKb.pendingCombat) {
                if (resolved.opponentIds.length === 0) {
                    newKb.pendingCombat = undefined;
                } else {
                    newKb.pendingCombat.opponentIds = resolved.opponentIds;
                    newKb.pendingCombat.allyIds = resolved.allyIds;
                    newKb.pendingCombat.analysis = {
                        winProbability: resolved.winProbability,
                        reasoning: resolved.reasoning
                    };
                    newKb.pendingCombat.analyzed = true;
                }
            }
            return newKb;
        });

        showNotification("Phân tích chiến đấu hoàn tất.", 'success');
    } catch (e) {
        console.error("Error in handleAnalyzeCombat:", e);
        showNotification("Lỗi khi phân tích chiến đấu.", 'error');
    } finally {
        setIsLoadingApi(false);
    }
  }, [gameMessages, isLoadingApi, setIsLoadingApi, resetApiError, setSentPromptsLog, setKnowledgeBase, showNotification]);

  const handlePlayerAction = useCallback(async (
      action: string, 
      isChoice: boolean, 
      inputType: PlayerActionInputType, 
      responseLength: ResponseLength,
      matPhapResumeCtx?: any,
      overrideKnowledgeBase?: KnowledgeBase,
      customPromptOverride?: string
  ) => {
    const kb = knowledgeBase;
    const turn = kb.playerStats.turn + 1;

    // --- CHECK AND CONSUME STORY QUOTA IF PRESET ENABLED ---
    let anyPresetEnabled = false;
    try {
        const savedPresets = localStorage.getItem('accessory_preset_files');
        if (savedPresets) {
            const files = JSON.parse(savedPresets);
            if (Array.isArray(files)) {
                anyPresetEnabled = files.some((pf: any) => pf.enabled);
            }
        }
    } catch (e) {
        console.error('Error checking presets in handlePlayerAction:', e);
    }

    if (anyPresetEnabled && inputType === 'story') {
        const currentTurn = kb.playerStats.turn || 0;
        const limitTurn = Math.ceil(currentTurn / 100) * 100 || 100;
        const quotaKey = `story_quota_${kb.worldConfig?.saveGameName || 'default'}_${kb.playerStats?.name || 'player'}`;
        
        let quotaMap: Record<string, number> = {};
        try {
            const savedQuota = localStorage.getItem(quotaKey);
            if (savedQuota) {
                quotaMap = JSON.parse(savedQuota);
            }
        } catch (err) {
            console.error('Error reading quota map:', err);
        }

        const remaining = quotaMap[String(limitTurn)] !== undefined ? quotaMap[String(limitTurn)] : 5;
        if (remaining <= 0) {
            showNotification(`Đã hết hạn ngạch Câu chuyện cho khoảng lượt này! Bạn chỉ có tối đa 5 lần mỗi 100 lượt (cho đến lượt ${limitTurn}). Vui lòng chuyển sang chế độ Hành động để gửi.`, 'error');
            throw new Error("Story quota exceeded");
        }

        // Khấu trừ và lưu lại
        quotaMap[String(limitTurn)] = remaining - 1;
        localStorage.setItem(quotaKey, JSON.stringify(quotaMap));
        // Kích hoạt sự kiện để đồng bộ UI
        window.dispatchEvent(new Event('accessory_preset_files_changed'));
    }

    // Condition 1: Dungeon Crawl Timeout -> Hunted State
    const playerInDungeon = kb.dungeonCrawlState?.isActive && (kb.currentLocationId === kb.dungeonCrawlState.dungeonLocationId || kb.discoveredLocations.find(l => l.id === kb.currentLocationId)?.parentLocationId === kb.dungeonCrawlState.dungeonLocationId);

    if (kb.dungeonCrawlState?.isActive && !playerInDungeon && turn > kb.dungeonCrawlState.startTurn + 100) {
        setIsLoadingApi(true);
        resetApiError();
        showNotification("Thế giới rung chuyển! Thảm họa đã ập đến...", 'error');

        let newKb = JSON.parse(JSON.stringify(kb));
        const dungeonName = newKb.dungeonCrawlState.dungeonName;
        newKb.dungeonCrawlState = null;
        
        newKb.huntedState = {
            isActive: true,
            reason: `Bị đổ tội là nguyên nhân khiến thảm họa từ ${dungeonName} được giải phóng.`,
            lastAttackTurn: turn
        };
        
        newKb.discoveredFactions.forEach((f: any) => f.playerReputation = -100);
        
        const lore: WorldLoreEntry = {
            id: `lore-catastrophe-${Date.now()}`,
            title: `Thảm Họa Từ ${dungeonName}`,
            content: `Một luồng ma khí ngút trời bốc lên từ ${dungeonName}, nhuộm đen cả một vùng trời. Một thảm họa đã được giải phóng! Vì ${newKb.worldConfig?.playerName} đã biết về bí cảnh nhưng không tham gia ngăn chặn, mọi tội lỗi đều đổ lên đầu họ.`
        };
        newKb.worldLore.push(lore);

        const systemMessage: GameMessage = {
            id: `catastrophe-${Date.now()}`,
            type: 'system',
            content: `*** BÁO ĐỘNG TOÀN THẾ GIỚI ***\n${lore.content}\nGiờ đây, bạn là kẻ thù của tất cả các phe phái!`,
            timestamp: Date.now(),
            turnNumber: turn
        };
        
        newKb.playerStats.turn = turn;
        addMessageAndUpdateState([systemMessage], newKb);
        setIsLoadingApi(false);
        return; // Override player action
    }

    // Condition 2: Hunted State Periodic Attack
    if (kb.huntedState?.isActive && turn > kb.huntedState.lastAttackTurn + 2) {
        setIsLoadingApi(true);
        resetApiError();

        let newKb = JSON.parse(JSON.stringify(kb));
        newKb.huntedState.lastAttackTurn = turn;
        
        const attacker1Name = "Sát Thủ Phe Phái";
        const attacker2Name = "Truy Nã Giả";
        // Create simple attacker tags
        const attackerTag1 = `[NPC: name="${attacker1Name}", description="Một kẻ được cử đi truy sát bạn, ánh mắt sắc lẹm.", realm="${kb.playerStats.realm}", affinity=-100]`;
        const attackerTag2 = `[NPC: name="${attacker2Name}", description="Một kẻ đeo mặt nạ, lẳng lặng rút vũ khí.", realm="${kb.playerStats.realm}", affinity=-100]`;
        const combatTag = `[BEGIN_COMBAT: opponentIds="${attacker1Name},${attacker2Name}"]`;
        
        const allTags = [attackerTag1, attackerTag2, combatTag];

        const narration = `Bạn đang đi thì cảm thấy sát khí ập đến! Hai bóng đen lao ra từ trong bóng tối, mục tiêu chính là bạn! "Kẻ bị truy nã, nộp mạng đi!"`;
        const narrationMessage: GameMessage = {
            id: `hunted-attack-${Date.now()}`,
            type: 'narration',
            content: narration,
            timestamp: Date.now(),
            turnNumber: turn
        };
        
        newKb.playerStats.turn = turn;

        const { newKb: kbAfterTags, systemMessagesFromTags } = await performTagProcessing(
            newKb, allTags, turn, logNpcAvatarPromptCallback
        );
        
        addMessageAndUpdateState([narrationMessage, ...systemMessagesFromTags], kbAfterTags, undefined, () => {
            setCurrentScreen(GameScreen.Combat);
        });

        setIsLoadingApi(false);
        return; // Override player action
    }
    
    // If no special conditions, fall back to the original game loop action
    return mainGameLoopActions.handlePlayerAction(action, isChoice, inputType, responseLength, matPhapResumeCtx, overrideKnowledgeBase, customPromptOverride);
  }, [knowledgeBase, gameMessages, mainGameLoopActions, setIsLoadingApi, resetApiError, showNotification, addMessageAndUpdateState, setKnowledgeBase, logNpcAvatarPromptCallback, setCurrentScreen]);

  const handleInitializeEconomicZones = useCallback(async () => {
    let mainLocId = knowledgeBase.currentLocationId;
    let mainLoc = knowledgeBase.discoveredLocations.find(l => l.id === mainLocId);
    if (!mainLoc) return;

    // Prevents double loading if zones already exist or API is busy
    if ((mainLoc.economicZones && mainLoc.economicZones.length > 0) || isLoadingApi) {
      return;
    }

    setIsLoadingApi(true);
    resetApiError();
    showNotification(VIETNAMESE.searchingEconomicZones || "Đang tìm kiếm khu vực kinh tế phù hợp...", "info");

    try {
      const { response, rawText } = await generateEconomyLocations(
        mainLoc,
        knowledgeBase,
        logSentPromptCallback
      );
      
      setReceivedEconomyResponsesLog(prev => [rawText, ...prev].slice(0, 50));
      
      const extractedTags = extractTagsFromText(rawText);
      
      const { newKb } = await performTagProcessing(
        knowledgeBase,
        extractedTags,
        knowledgeBase.playerStats.turn,
        logNpcAvatarPromptCallback
      );
      
      setKnowledgeBase(newKb);
      showNotification(VIETNAMESE.economicZonesFound || "Đã tìm thấy các khu vực kinh tế!", "success");
    } catch (err) {
      setApiErrorWithTimeout(err instanceof Error ? err.message : "Lỗi khi tải khu vực kinh tế.");
    } finally {
      setIsLoadingApi(false);
    }
  }, [knowledgeBase, isLoadingApi, setIsLoadingApi, resetApiError, showNotification, setKnowledgeBase, logNpcAvatarPromptCallback, setReceivedEconomyResponsesLog, logSentPromptCallback]);

  const handleEnterEcoZone = useCallback(async (zoneStub: EconomicZoneStub) => {
    if (isLoadingApi) return;

    // 1. Kiểm tra xem đã có dữ liệu NPC của zone này trong KB chưa (có thể đã được tạo hàng loạt trước đó)
    const npcsInZone = knowledgeBase.discoveredNPCs.filter(npc => npc.locationId === zoneStub.name);
    const hasExistingData = npcsInZone.length > 0;

    // 2. Nếu đã generated HOẶC đã có dữ liệu sẵn -> Tiến vào ngay lập tức (Instant Entry)
    if (zoneStub.isGenerated || hasExistingData) {
      // Nếu có dữ liệu nhưng cờ isGenerated chưa bật (do batch generation), ta cập nhật cờ này
      if (!zoneStub.isGenerated && hasExistingData) {
        setKnowledgeBase(prev => {
          const newKb = JSON.parse(JSON.stringify(prev)) as KnowledgeBase;
          
          // Find root main location
          const currentLoc = newKb.discoveredLocations.find(l => l.id === newKb.currentLocationId);
          let mainLoc = currentLoc;
          if (mainLoc?.parentLocationId) {
             const visitedIds = new Set<string>();
             while (mainLoc.parentLocationId && !visitedIds.has(mainLoc.parentLocationId)) {
                 visitedIds.add(mainLoc.id);
                 const parent = newKb.discoveredLocations.find(l => l.id === mainLoc.parentLocationId);
                 if (!parent) break;
                 mainLoc = parent;
             }
          }

          if (mainLoc && mainLoc.economicZones) {
            const z = mainLoc.economicZones.find(ez => ez.id === zoneStub.id);
            if (z) z.isGenerated = true;
          }
          return newKb;
        });
      }

      showNotification(`Đang tiến vào ${zoneStub.name}...`, 'info');
      
      // Mở modal mua bán tương ứng với loại khu vực
      if (zoneStub.type === EconomicZoneType.SLAVE_MARKET) {
        setActiveSlaveMarketModal({ type: 'slave_market', locationId: zoneStub.name });
      } else if (zoneStub.type === EconomicZoneType.AUCTION) {
        auctionActions.handleStartAuction(zoneStub.name);
      } else if (zoneStub.type === EconomicZoneType.SLAVE_AUCTION) {
        slaveAuctionActions.handleStartSlaveAuction(zoneStub.name);
      } else {
        // Mặc định mở Marketplace cho các khu thương mại
        setActiveEconomyModal({ type: 'marketplace', locationId: zoneStub.name });
      }
      return;
    }

    // 3. Nếu chưa có dữ liệu -> Gọi AI để tạo chi tiết (Logic cấu trúc JSON định dạng cứng)
    setIsLoadingApi(true);
    resetApiError();
    showNotification(`Đào sâu thông tin về ${zoneStub.name}...`, 'info');

    try {
      const { response: jsonResponse, rawText } = await generateEcoZoneJsonData(
        knowledgeBase,
        zoneStub,
        logSentPromptCallback
      );

      logReceivedResponseCallback(rawText, knowledgeBase.playerStats.turn);

      const newKb = applyEcoZoneJsonDataToKb(
        knowledgeBase,
        jsonResponse,
        zoneStub.name,
        knowledgeBase.currentLocationId
      );

      // Update the stub in the main location
      const updatedKb = JSON.parse(JSON.stringify(newKb)) as KnowledgeBase;
      const currentLocId = updatedKb.currentLocationId;
      const currentLoc = updatedKb.discoveredLocations.find(l => l.id === currentLocId);
      
      let mainLoc = currentLoc;
      if (mainLoc?.parentLocationId) {
          const visitedIds = new Set<string>();
          while (mainLoc.parentLocationId && !visitedIds.has(mainLoc.parentLocationId)) {
              visitedIds.add(mainLoc.id);
              const parent = updatedKb.discoveredLocations.find(l => l.id === mainLoc.parentLocationId);
              if (!parent) break;
              mainLoc = parent;
          }
      }
      
      if (mainLoc && mainLoc.economicZones) {
        const zoneIndex = mainLoc.economicZones.findIndex(z => z.id === zoneStub.id);
        if (zoneIndex !== -1) {
          mainLoc.economicZones[zoneIndex].isGenerated = true;
        }
      }

      const finalMessages: GameMessage[] = [];
      const narrationText = jsonResponse.sublocation?.description;
      
      if (narrationText && narrationText.trim()) {
        finalMessages.unshift({
          id: `eco-zone-entry-${Date.now()}`,
          type: 'narration',
          content: narrationText,
          timestamp: Date.now(),
          turnNumber: updatedKb.playerStats.turn
        });
      } else {
        finalMessages.unshift({
          id: `eco-zone-system-entry-${Date.now()}`,
          type: 'system',
          content: `Đã tiến vào ${zoneStub.name}. Dữ liệu thương nhân và hàng hóa đã được nạp thành công.`,
          timestamp: Date.now(),
          turnNumber: updatedKb.playerStats.turn
        });
      }

      addMessageAndUpdateState(finalMessages, updatedKb);
      
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Lỗi khi tạo thông tin khu vực kinh tế.";
      setApiErrorWithTimeout(errorMsg);
    } finally {
      setIsLoadingApi(false);
    }
  }, [knowledgeBase, isLoadingApi, showNotification, setIsLoadingApi, resetApiError, currentPageMessagesLog, previousPageSummaries, logSentPromptCallback, logReceivedResponseCallback, setKnowledgeBase, logNpcAvatarPromptCallback, addMessageAndUpdateState, mainGameLoopActions]);

  return {
    // FIX: Corrected access to properties on mainGameLoopActions which is an object.
    isSummarizingNextPageTransition: mainGameLoopActions.isSummarizingNextPageTransition,
    handleSetupComplete,
    handlePlayerAction, // Return the new wrapper function
    handleMatPhapContinue: mainGameLoopActions.handleMatPhapContinue,
    matPhapCountdown: mainGameLoopActions.matPhapCountdown,
    handleFindLocation: mainGameLoopActions.handleFindLocation,
    handleNonCombatDefeat,
    handleCombatEnd,
    handleCombatEndSpecificOutcome,
    handlePrisonerAction,
    handleCompanionAction,
    handleExitPrisonerScreen,
    handleExitCompanionScreen,
    handleTravelToLocation,
    ...auctionActions,
    ...slaveAuctionActions,
    ...cultivationActions,
    handleBuySlave,
    handleSellSlave,
    resetApiError: props.resetApiError,
    // FIX: Add missing functions to the return object.
    handleBuyPrisoner,
    handleSellPrisoner,
    // FIX: Add missing function to the return object to satisfy the context type.
    handleCreateMemoryFromLastTurn,
    handleStartBreakthroughCombat,
    handleFreePerson,
    onStartDebugCombat,
    // FIX: Added missing handleStartChallenge function to the return object.
    handleStartChallenge,
    handleAnalyzeCombat,
    handleEnterEcoZone,
    handleInitializeEconomicZones,
    handleRetryFlashSummary: mainGameLoopActions.handleRetryFlashSummary,
    handleIgnoreFlashSummary: mainGameLoopActions.handleIgnoreFlashSummary,
    isRecoveringNarration: mainGameLoopActions.isRecoveringNarration,
    narrationRecoveryAction: mainGameLoopActions.narrationRecoveryAction,
    handleContinueIncompleteNarration: mainGameLoopActions.handleContinueIncompleteNarration,
    handleRewriteIncompleteNarration: mainGameLoopActions.handleRewriteIncompleteNarration,
    handleIgnoreIncompleteNarration: mainGameLoopActions.handleIgnoreIncompleteNarration,
    handleHideIncompleteNarration: mainGameLoopActions.handleHideIncompleteNarration,
    handleRestoreIncompleteNarration: mainGameLoopActions.handleRestoreIncompleteNarration,
    handleSelectIncompleteNarrationModel: mainGameLoopActions.handleSelectIncompleteNarrationModel,
    handleActivePlayerDeath,
    logSentPromptCallback,
    logReceivedResponseCallback,
    normalizeNpcRealms,
    unrecognizedTags,
    isUnrecognizedTagsModalOpen,
    isRetryingTags,
    handleIgnoreUnrecognizedTags,
    handleRetryUnrecognizedTags,
  };
};