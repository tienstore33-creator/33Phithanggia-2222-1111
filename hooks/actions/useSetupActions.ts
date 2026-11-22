
// FIX: Add React import to resolve namespace errors.
import React, { useCallback } from 'react';
import { KnowledgeBase, GameMessage, WorldSettings, GameScreen, RealmBaseStatDefinition, TurnHistoryEntry } from '../../types';
import { INITIAL_KNOWLEDGE_BASE, APP_VERSION, DEFAULT_PLAYER_STATS, DEFAULT_TIERED_STATS, VIETNAMESE, MAX_AUTO_SAVE_SLOTS } from '../../constants';
import { generateInitialStory } from '../../services/geminiService';
import { generateEmbeddings } from '../../services/embeddingService';
import { RealmParserService } from '../../services/RealmParserService';
import { DataExtractionService } from '../../services/dataExtractionService';
import { QuestSyncService } from '../../services/QuestSyncService';
import { runFlashAgentAsync } from '../../services/FlashAgentService';
import { updateKnowledgeBaseWithInputRoll } from '../../utils/difficultyUtils';
import { performTagProcessing, calculateRealmBaseStats, addTurnHistoryEntryRaw, calculateEffectiveStats, vectorizeKnowledgeBase, updateEntityStatsFromRealmEnhanced, normalizeSlotId, parseStatBonuses } from '../../utils/gameLogicUtils'; // Import vectorizeKnowledgeBase
import { applyAutoLayout } from '../../utils/tagProcessors/locationTagProcessor';
import { generateUniverseId } from '../../services/SacredTimelineService';
import { apiRunningService } from '../../services/apiRunningService';

interface UseSetupActionsProps {
  setIsLoadingApi: React.Dispatch<React.SetStateAction<boolean>>;
  resetApiError: () => void;
  setKnowledgeBase: React.Dispatch<React.SetStateAction<KnowledgeBase>>;
  setCurrentScreen: (screen: GameScreen) => void;
  addMessageAndUpdateState: (newMessages: GameMessage[], newKnowledgeBase: KnowledgeBase, startingCurrency?: number, callback?: () => void) => void;
  logSentPromptCallback: (prompt: string) => void;
  setRawAiResponsesLog: React.Dispatch<React.SetStateAction<string[]>>;
  setApiErrorWithTimeout: (message: string | null) => void;
  logNpcAvatarPromptCallback?: (prompt: string) => void;
  styleSettings?: any;
  setIsStreaming?: React.Dispatch<React.SetStateAction<boolean>>;
  setStreamingText?: React.Dispatch<React.SetStateAction<string>>;
  abortControllerRef?: React.MutableRefObject<AbortController | null>;
  setIsSwapping?: React.Dispatch<React.SetStateAction<boolean>>;
}

export const useSetupActions = (props: UseSetupActionsProps) => {
  const {
    setIsLoadingApi,
    resetApiError,
    setKnowledgeBase,
    setCurrentScreen,
    addMessageAndUpdateState,
    logSentPromptCallback,
    setRawAiResponsesLog,
    setApiErrorWithTimeout,
    logNpcAvatarPromptCallback,
    styleSettings,
    setIsStreaming,
    setStreamingText,
    abortControllerRef,
    setIsSwapping
  } = props;

  const handleSetupComplete = useCallback(async (settings: WorldSettings, dataForKbPlayerAvatar?: string | null) => { 
    setIsLoadingApi(true);
    resetApiError();
    
    const playerRaceTrimmed = settings.playerRace.trim();
    let playerRaceSystem = settings.raceCultivationSystems.find(s => s.raceName.trim() === playerRaceTrimmed);

    // Fallback logic if the specific race is not found.
    if (!playerRaceSystem) {
        // Attempt to match the start of the realm string to a race name.
        playerRaceSystem = settings.raceCultivationSystems.find(s => settings.canhGioiKhoiDau.trim().startsWith(s.raceName.trim()));
        if (playerRaceSystem) {
            console.log(`[SETUP_DEBUG] Player race "${settings.playerRace}" not found. Inferred race "${playerRaceSystem.raceName}" from starting realm "${settings.canhGioiKhoiDau}".`);
        }
    }
    
    // Priority: 1. Global cultivation system, 2. Player race system, 3. First race system in list
    const majorRealmInput = settings.cultivationSystem?.majorRealmsRaw || playerRaceSystem?.realmSystem || settings.raceCultivationSystems[0]?.realmSystem || '';
    const realmProgression = RealmParserService.parseMajorRealms(majorRealmInput);
    
    // Parse minor realms from settings
    const minorRealmInput = settings.cultivationSystem?.minorRealmsRaw || '';
    const minorRealmProgression = RealmParserService.parseMinorRealms(minorRealmInput);

    const initialRealm = settings.canhGioiKhoiDau;
    
    const generatedBaseStats: Record<string, RealmBaseStatDefinition> = {};
    realmProgression.forEach((realmName, index) => {
        generatedBaseStats[realmName] = DEFAULT_TIERED_STATS[Math.min(index, DEFAULT_TIERED_STATS.length - 1)];
    });
    
    const initialCalculatedStats = calculateRealmBaseStats(initialRealm, realmProgression, generatedBaseStats, minorRealmProgression);
    
    const worldConfigForKb = { 
      ...settings,
      playerName: settings.playerName || "Người chơi",
      originalPlayerName: settings.playerName || "Người chơi"
    }; 

    const startQuests: any[] = [];
    if (settings.timelineEvents && settings.timelineEvents.length > 0) {
      const firstEvt = settings.timelineEvents[0];
      startQuests.push({
        id: "mainsq-0",
        title: `[Cốt Truyện] ${firstEvt.eventName}`,
        description: firstEvt.description || "Tham gia vào dòng chảy lịch sử nguyên tác.",
        status: 'active',
        updatedAt: Date.now(),
        objectives: [
          { 
            id: 'obj-main', 
            text: firstEvt.requiredAction || "Đẩy nhanh tiến trình sự kiện để hệ thống chuyển sang mốc tiếp theo.", 
            completed: false 
          }
        ]
      });
    }

    let minimalInitialKB: KnowledgeBase = {
      ...INITIAL_KNOWLEDGE_BASE, 
      universeId: generateUniverseId(),
      allQuests: startQuests,
      worldDate: settings.startingDate,
      worldRealmBase: initialRealm, // NEW: Init world realm base with player starting realm
      playerStats: {
        ...DEFAULT_PLAYER_STATS, 
        name: settings.playerName || "Người chơi",
        originalPlayerName: settings.playerName || "Người chơi",
        realm: initialRealm, 
        ...initialCalculatedStats, 
        // Ensure current and max stats are synced with base stats
        sinhLuc: initialCalculatedStats.baseMaxSinhLuc,
        maxSinhLuc: initialCalculatedStats.baseMaxSinhLuc,
        linhLuc: initialCalculatedStats.baseMaxLinhLuc,
        maxLinhLuc: initialCalculatedStats.baseMaxLinhLuc,
        sucTanCong: initialCalculatedStats.baseSucTanCong,
        maxKinhNghiem: initialCalculatedStats.baseMaxKinhNghiem,
        kinhNghiem: 0,
        currency: typeof settings.startingCurrency === 'number' ? settings.startingCurrency : parseInt(settings.startingCurrency as any, 10) || 0,
        turn: 0, 
        hieuUngBinhCanh: false,
        activeStatusEffects: [], 
        spiritualRoot: settings.playerSpiritualRoot || "Phàm Căn",
        specialPhysique: settings.playerSpecialPhysique || "Phàm Thể",
        professions: [],
        thoNguyen: settings.playerThoNguyen ?? 120,
        maxThoNguyen: settings.playerMaxThoNguyen ?? 120,
        playerSpecialStatus: null,
      },
      realmProgressionList: realmProgression,
      minorRealmProgressionList: minorRealmProgression,
      currentRealmBaseStats: generatedBaseStats,
      worldConfig: worldConfigForKb, 
      inventory: (settings.startingItems || []).map(item => ({
          id: `item-start-${Date.now()}-${Math.random().toString(36).substring(2,7)}`,
          name: item.name,
          description: item.description,
          quantity: item.quantity || 1,
          category: item.category,
          rarity: item.rarity,
          value: item.value || 0,
          itemRealm: item.itemRealm,
          ...(item.equipmentDetails && Object.keys(item.equipmentDetails).length > 0 && {
               slot: normalizeSlotId(item.equipmentDetails.slot),
               statBonuses: item.equipmentDetails.statBonuses || parseStatBonuses(item.equipmentDetails.statBonusesString),
               uniqueEffects: item.equipmentDetails.uniqueEffects || (item.equipmentDetails.uniqueEffectsString ? item.equipmentDetails.uniqueEffectsString.split(';').map(s=>s.trim()) : [])
          }),
          ...(item.potionDetails && Object.keys(item.potionDetails).length > 0 && {
               potionType: item.potionDetails.type,
               effects: item.potionDetails.effectsString ? item.potionDetails.effectsString.split(';').map(s=>s.trim()) : [],
               durationTurns: item.potionDetails.durationTurns,
               cooldownTurns: item.potionDetails.cooldownTurns
          }),
          ...(item.materialDetails && Object.keys(item.materialDetails).length > 0 && {
               materialType: item.materialDetails.type
          }),
          ...(item.questItemDetails && Object.keys(item.questItemDetails).length > 0 && {
               questIdAssociated: item.questItemDetails.questIdAssociated
          }),
          ...(item.miscDetails && Object.keys(item.miscDetails).length > 0 && {
               usable: item.miscDetails.usable,
               consumable: item.miscDetails.consumable
          })
      })) as any[],
      playerSkills: (() => {
          const skills = (settings.startingSkills || []).map(skill => ({
              id: `skill-start-${Date.now()}-${Math.random().toString(36).substring(2,7)}`,
              name: skill.name,
              description: skill.description,
              skillType: skill.skillType,
              baseDamage: skill.baseDamage,
              baseHealing: skill.baseHealing,
              damageMultiplier: skill.damageMultiplier,
              healingMultiplier: skill.healingMultiplier,
              manaCost: skill.manaCost,
              cooldown: skill.cooldown,
              specialEffects: skill.specialEffects,
              level: 1,
              exp: 0,
              maxExp: 100
          })) as any[];
          
          return skills;
      })(),
      discoveredNPCs: (settings.startingNPCs || []).map(npc => ({
          id: `npc-start-${Date.now()}-${Math.random().toString(36).substring(2,7)}`,
          name: npc.name,
          gender: npc.gender,
          race: npc.race,
          description: npc.details || npc.personality,
          personalityTraits: npc.personality ? [npc.personality] : [],
          affinity: npc.initialAffinity || 0,
          realm: npc.realm,
          tuChat: npc.tuChat,
          avatarUrl: npc.avatarUrl,
          history: [],
          relationships: npc.relationshipToPlayer ? [{ targetId: 'player', targetName: settings.playerName || 'Player', type: npc.relationshipToPlayer }] : []
      })) as any[],
      discoveredLocations: (settings.startingLocations || []).map(loc => ({
          id: `loc-start-${Date.now()}-${Math.random().toString(36).substring(2,7)}`,
          name: loc.name,
          description: loc.description,
          isSafeZone: loc.isSafeZone,
          tags: loc.tags || [],
          locationType: loc.locationType
      })) as any[],
      discoveredYeuThu: (settings.startingYeuThu || []).map(yt => ({
          id: `yeuthu-start-${Date.now()}-${Math.random().toString(36).substring(2,7)}`,
          name: yt.name,
          species: yt.species,
          description: yt.description,
          isHostile: yt.isHostile,
          realm: yt.realm,
          history: []
      })) as any[],
      discoveredFactions: (settings.startingFactions || []).map(fac => ({
          id: `faction-start-${Date.now()}-${Math.random().toString(36).substring(2,7)}`,
          name: fac.name,
          description: fac.description,
          alignment: fac.alignment,
          playerReputation: fac.initialPlayerReputation || 0,
          members: []
      })) as any[],
      worldLore: (settings.startingLore || []).map(lore => ({
          id: `lore-start-${Date.now()}-${Math.random().toString(36).substring(2,7)}`,
          title: lore.title,
          content: lore.content
      })) as any[],
      // FIX: Removed appVersion from KnowledgeBase. It belongs at the root of the save data object.
      pageSummaries: {},
      currentPageHistory: [1], // Initial page starts at turn 1 (after AI gen)
      lastSummarizedTurn: 0,
      turnHistory: [], // Starts empty
      autoSaveTurnCounter: 0,
      currentAutoSaveSlotIndex: 0,
      autoSaveSlotIds: Array(MAX_AUTO_SAVE_SLOTS).fill(null),
      manualSaveId: null,
      manualSaveName: settings.saveGameName || VIETNAMESE.saveGameNamePlaceholder.replace("[Tên Nhân Vật]", settings.playerName || "Tân Đạo Hữu"),
      playerAvatarData: dataForKbPlayerAvatar || settings.playerAvatarUrl || undefined, 
      arcState: {
          phase: 'prologue' as any,
          turnCount: 0,
          targetEvent: settings.timelineEvents?.[0]?.eventName || null,
          questIssued: false,
          originalTimelineIndex: 0,
          originalEventResolved: false,
          timelineEventStartTurn: 0
      },
      currentTurnLog: [],
      isNsfwSceneActive: false
    };

    // Call enhanced normalization for NPCs to ensure stats are calculated correctly
    minimalInitialKB.discoveredNPCs.forEach(npc => {
        updateEntityStatsFromRealmEnhanced(npc as any, minimalInitialKB);
    });
    
    // History entry for "before turn 1" (initial state)
    minimalInitialKB.turnHistory = addTurnHistoryEntryRaw(
        [], // No previous history
        JSON.parse(JSON.stringify(minimalInitialKB)), // Snapshot of the very initial KB
        []  // No messages before the game starts
    );

    setKnowledgeBase(minimalInitialKB); 
    setCurrentScreen(GameScreen.Gameplay); 

    try {
      let onChunk: ((text: string) => void) | undefined;
      let signal: AbortSignal | undefined;

      let onResetStream: (() => void) | undefined;

      if (styleSettings?.turnResponseMode === 'streaming' && setIsStreaming && setStreamingText && abortControllerRef && setIsSwapping) {
          setIsStreaming(true);
          setStreamingText("");
          abortControllerRef.current = new AbortController();
          signal = abortControllerRef.current.signal;
          
          let buffer = "";
          let lastUpdateTime = Date.now();

          onChunk = (text: string) => {
              buffer += text;
              const now = Date.now();
              if (now - lastUpdateTime > 50) { 
                  setStreamingText(prev => prev + buffer);
                  buffer = "";
                  lastUpdateTime = now;
              }
          };

          onResetStream = () => {
              buffer = "";
              lastUpdateTime = Date.now();
              setStreamingText("");
          };
          setIsSwapping(true);
          await new Promise(resolve => setTimeout(resolve, 100)); // Buffer to allow UI logic to stabilize
      }

      apiRunningService.resetTurnCounter();
      const {response, rawText} = await generateInitialStory(minimalInitialKB.worldConfig!, logSentPromptCallback, onChunk, signal, onResetStream); 
      setRawAiResponsesLog(prev => [rawText, ...prev].slice(0,50));
      
      if (signal?.aborted) {
          console.log("Initial AI setup aborted, stopping state updates.");
          return;
      }
      
      // --- V5: TWO-STEP GENERATION (TAG EXTRACTION FOR INITIAL STORY) ---
      const extractedTags = await DataExtractionService.extractTags(rawText, minimalInitialKB);
      const allTags = [...(response.tags || []), ...extractedTags];

      let workingKbForProcessing = JSON.parse(JSON.stringify(minimalInitialKB));
       // The turn for the first AI-generated content is 1.
      // Tags in initial story should modify this "turn 1" state.
      const { 
        newKb: kbAfterTags, 
        turnIncrementedByTag, // This should ideally not happen or be handled carefully for turn 1
        systemMessagesFromTags: systemMessagesFromInitialTags, 
        realmChangedByTag: realmChangedByInitTag,
        tagErrors: initTagErrors
      } = await performTagProcessing(workingKbForProcessing, allTags, 1, logNpcAvatarPromptCallback); 
      
      kbAfterTags.pendingCorrections = [];      
      let finalKbForDisplay = kbAfterTags;
      
      // FIX: Re-apply the user's settings for lifespan over any values the AI might have generated.
      // This ensures user input from the setup screen is always respected.
      if (settings.playerThoNguyen !== undefined) {
          finalKbForDisplay.playerStats.thoNguyen = Number(settings.playerThoNguyen);
      }
      if (settings.playerMaxThoNguyen !== undefined) {
          finalKbForDisplay.playerStats.maxThoNguyen = Number(settings.playerMaxThoNguyen);
      }

      let turnForInitialMessages = 1;

      // Ensure turn is at least 1 after initial tags.
      if (finalKbForDisplay.playerStats.turn < 1) {
          finalKbForDisplay.playerStats.turn = 1;
      }
      turnForInitialMessages = finalKbForDisplay.playerStats.turn;

      // --- V6: INITIAL QUEST SYNC ---
      // Force a quest sync right after game start to catch the first timeline event
      // Wrapped in try-catch to prevent setup failure if sync has issues
      let initialSyncMessages: GameMessage[] = [];
      try {
          const syncResult = await QuestSyncService.sync(finalKbForDisplay);
          if (syncResult && syncResult.updatedKb) {
              finalKbForDisplay = syncResult.updatedKb;
              initialSyncMessages = syncResult.systemMessages || [];
          }
      } catch (syncErr) {
          console.error("Initial quest sync failed, but continuing setup:", syncErr);
      }
      
      if (realmChangedByInitTag) {
          const reCalculatedStats = calculateRealmBaseStats(finalKbForDisplay.playerStats.realm, finalKbForDisplay);
          finalKbForDisplay.playerStats = { 
              ...finalKbForDisplay.playerStats, 
              ...reCalculatedStats,
              maxSinhLuc: reCalculatedStats.baseMaxSinhLuc,
              maxLinhLuc: reCalculatedStats.baseMaxLinhLuc,
              sucTanCong: reCalculatedStats.baseSucTanCong,
              maxKinhNghiem: reCalculatedStats.baseMaxKinhNghiem
          };
          finalKbForDisplay.playerStats.sinhLuc = finalKbForDisplay.playerStats.maxSinhLuc;
          finalKbForDisplay.playerStats.linhLuc = finalKbForDisplay.playerStats.maxLinhLuc;
          finalKbForDisplay.playerStats.kinhNghiem = Math.min(finalKbForDisplay.playerStats.kinhNghiem, finalKbForDisplay.playerStats.maxKinhNghiem);
      } else {
          // Sync current stats with initial calculated base stats if not changed by AI
          finalKbForDisplay.playerStats.maxSinhLuc = initialCalculatedStats.baseMaxSinhLuc;
          finalKbForDisplay.playerStats.maxLinhLuc = initialCalculatedStats.baseMaxLinhLuc;
          finalKbForDisplay.playerStats.sucTanCong = initialCalculatedStats.baseSucTanCong;
          finalKbForDisplay.playerStats.maxKinhNghiem = initialCalculatedStats.baseMaxKinhNghiem;
          
          finalKbForDisplay.playerStats.sinhLuc = finalKbForDisplay.playerStats.maxSinhLuc;
          finalKbForDisplay.playerStats.linhLuc = finalKbForDisplay.playerStats.maxLinhLuc;
      }
      
      // currentPageHistory should correctly point to the start turn of the first page.
      finalKbForDisplay.playerStats = calculateEffectiveStats(finalKbForDisplay.playerStats, finalKbForDisplay.equippedItems, finalKbForDisplay.inventory);
      
      // --- NEW: Apply automatic map layout to starting locations so they are separated by coordinates ---
      try {
          finalKbForDisplay = applyAutoLayout(finalKbForDisplay);
          console.log("[MAP-SETUP] Successfully applied auto map layout for starting locations!", finalKbForDisplay.discoveredLocations);
      } catch (layoutError) {
          console.error("[MAP-SETUP] Failed to run applyAutoLayout during setup completion:", layoutError);
      }

      // Set initial location based on the first discovered location from the setup
      const firstLocation = finalKbForDisplay.discoveredLocations?.[0];
      if (firstLocation) {
          finalKbForDisplay.currentLocationId = firstLocation.id;
      }

      const newMessages: GameMessage[] = [];
      newMessages.push({
        id: Date.now().toString() + Math.random(), type: 'narration', content: response.narration, 
        timestamp: Date.now(), choices: response.choices, turnNumber: turnForInitialMessages
      });
      if (response.systemMessage) {
        newMessages.push({
          id: Date.now().toString() + Math.random(), type: 'system', content: response.systemMessage, 
          timestamp: Date.now(), turnNumber: turnForInitialMessages
        });
      }
      // Add system messages from initial tags
      newMessages.push(...systemMessagesFromInitialTags.map(msg => ({
          id: `sys-init-${Date.now()}-${Math.random()}`,
          type: 'system' as const,
          content: typeof msg === 'string' ? msg : (msg as any).content,
          timestamp: Date.now(),
          turnNumber: turnForInitialMessages
      })));

      // Add system messages from initial quest sync
      newMessages.push(...initialSyncMessages.map(msg => ({
          id: `sys-sync-init-${Date.now()}-${Math.random()}`,
          type: 'system' as const,
          content: typeof msg === 'string' ? msg : msg.content,
          timestamp: Date.now(),
          turnNumber: turnForInitialMessages
      })));
      
      // Vectorize the initial knowledge base for RAG
      try {
        console.log("Vectorizing initial knowledge base for RAG...");
        finalKbForDisplay.ragVectorStore = await vectorizeKnowledgeBase(finalKbForDisplay);
        
        // Roll for first turn restriction
        finalKbForDisplay = updateKnowledgeBaseWithInputRoll(finalKbForDisplay);

        // --- NEW: INTEGRATE FLASH AGENT FOR INITIAL STORY NARRATION ---
        console.log("Generating Flash Agent memory for initial turn 1...");
        const firstLocation = finalKbForDisplay.discoveredLocations?.[0];
        const initialDate = finalKbForDisplay.worldDate;
        const initialDateStr = initialDate 
            ? `${initialDate.timeOfDay}, Ngày ${initialDate.day}, Tháng ${initialDate.month}, Năm ${initialDate.year}`
            : "Không rõ";

        const isFlashAgentSuccess = await runFlashAgentAsync(
            "Khởi đầu game",
            response.narration,
            turnForInitialMessages,
            setKnowledgeBase,
            "",
            finalKbForDisplay,
            firstLocation?.name || "Không rõ",
            initialDateStr
        );
        
        if (isFlashAgentSuccess) {
            console.log("Flash Agent memory successfully created for initial turn!");
        } else {
            console.warn("Flash Agent execution failed for initial turn fallback. Vectorizing raw narration...");
            const initialStoryText = `[Khởi đầu] Lời dẫn: ${response.narration}`;
            const [initialStoryVector] = await generateEmbeddings([initialStoryText]);
            if (initialStoryVector) {
                finalKbForDisplay.ragVectorStore.vectors.push(initialStoryVector);
                finalKbForDisplay.ragVectorStore.metadata.push({
                    entityId: `turn-${turnForInitialMessages}-initial`,
                    entityType: 'turn' as any,
                    turn: turnForInitialMessages,
                    text: initialStoryText
                });
            }
        }
        // -------------------------------------------------------------

        console.log(`Initial vectorization complete. Vector store has ${finalKbForDisplay.ragVectorStore.vectors.length} entries.`);
        newMessages.push({
          id: `rag-init-${Date.now()}`,
          type: 'system',
          content: `[Hệ thống] Đã tạo ${finalKbForDisplay.ragVectorStore.metadata.length} vector cho ngữ cảnh RAG.`,
          timestamp: Date.now(),
          turnNumber: turnForInitialMessages
        });
      } catch (embeddingError) {
          console.error("Failed to vectorize initial knowledge base:", embeddingError);
          newMessages.push({
            id: `rag-init-error-${Date.now()}`,
            type: 'error',
            content: `Lỗi tạo vector ngữ cảnh: ${embeddingError instanceof Error ? embeddingError.message : 'Unknown error'}.`,
            timestamp: Date.now(),
            turnNumber: turnForInitialMessages
          });
      }
      
      addMessageAndUpdateState(newMessages, finalKbForDisplay);

    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      setApiErrorWithTimeout(`Lỗi khi tạo cốt truyện ban đầu: ${errorMsg}`);
      setCurrentScreen(GameScreen.Initial);
    } finally {
      setIsLoadingApi(false);
      if (setIsStreaming) {
          setIsStreaming(false);
      }
      if (setStreamingText) {
          setStreamingText("");
      }
      if (setIsSwapping) {
          setIsSwapping(false);
      }
    }
  }, [
    setIsLoadingApi,
    resetApiError,
    setKnowledgeBase,
    setCurrentScreen,
    addMessageAndUpdateState,
    logSentPromptCallback,
    setRawAiResponsesLog,
    setApiErrorWithTimeout,
    logNpcAvatarPromptCallback,
    styleSettings,
    setIsStreaming,
    setStreamingText,
    abortControllerRef,
    setIsSwapping
  ]);

  return { handleSetupComplete };
};

