import React, {
  createContext,
  ReactNode,
  useRef,
  useState,
  useCallback,
  useEffect,
  useMemo,
} from "react";
import * as jsonpatch from "fast-json-patch";
import pako from "pako";
import { GameScreen, KnowledgeBase, GameMessage, WorldSettings, PlayerStats, ApiConfig, SaveGameData, StorageType, SaveGameMeta, RealmBaseStatDefinition, TurnHistoryEntry, StyleSettings, PlayerActionInputType, EquipmentSlotId, Item as ItemType, NPC, GameLocation, ResponseLength, StorageSettings, FindLocationParams, Skill, Prisoner, Wife, Slave, CombatEndPayload, AuctionSlave, CombatDispositionMap, YeuThu, CombatMode, OfflineCombatSkill, OfflineCombatItem, Item, UIState, } from "../types";
import { DefeatOutcome } from "../src/logic/combatDefeatHandler";
import { executeFleeCombat, executeAutoCombat } from "../src/logic/pendingCombatManager";
import {
  buildAutoCombatOutcomePrompt,
  buildFleeOutcomePrompt,
  generatePendingCombatNarration,
} from "../services/ai/pendingCombatNarrativeService";
import { saveFlashAgentMemoryOffline } from "../services/FlashAgentService";
import { DataExtractionService } from "../services/dataExtractionService";
import {
  INITIAL_KNOWLEDGE_BASE,
  VIETNAMESE,
  APP_VERSION,
  MAX_AUTO_SAVE_SLOTS,
  TURNS_PER_PAGE,
  DEFAULT_TIERED_STATS,
  EQUIPMENT_SLOTS_CONFIG,
  DEFAULT_WORLD_SETTINGS,
  DEFAULT_PLAYER_STATS,
  MAX_COMBAT_COMPANIONS,
} from "../constants";
import {
  saveGameToIndexedDB,
  loadGamesFromIndexedDB,
  loadSpecificGameFromIndexedDB,
  deleteGameFromIndexedDB,
  importGameToIndexedDB,
  resetDBConnection as resetIndexedDBConnection,
} from "../services/indexedDBService";
import * as GameTemplates from "../templates";
import { useAppInitialization } from "../hooks/useAppInitialization";
import {
  useGameNotifications,
  NotificationState,
} from "../hooks/useGameNotifications";
import { useGameData } from "../hooks/useGameData";
import { useGameActions } from "../hooks/useGameActions";
import {
  useGameplayModals,
  GameEntity,
  GameEntityType,
} from "../hooks/useGameplayModals";
import { useGameplayPanels } from "../hooks/useGameplayPanels";
import { useUiLockStore } from "../src/store/uiLockStore";
import { isEntityFemale, generateRandomFemaleAvatar } from "../utils/avatarGenerator";
import { getEffectiveRealmSystem } from "../services/realmManager";
import { parseRealm } from "../utils/realmUtils";
import { cleanTextFromXmlUpdates } from "../utils/xmlUpdateParser";
import { calculateRealmBaseStats } from "../utils/statsCalculationUtils";
import { extractStatusEffectNameFromQuestText, isMainQuest } from "../utils/questUtils";
import { applyAutoLayout } from "../utils/tagProcessors/locationTagProcessor";
import {
  performTagProcessing,
  handleLevelUps,
  progressNpcCultivation,
  calculateEffectiveStats,
  auditAllEntitiesStats,
  reconstructSnapshotsForExport,
  processCoreMemoryAdd,
} from "../utils/gameLogicUtils";
import {
  getApiSettings as getGeminiApiSettings,
  countTokens,
  generateCraftedItemViaAI,
  generateDefeatConsequence,
  summarizePrisonerInteraction,
  summarizeCompanionInteraction,
  generateImageUnified,
  generateAvatarsForFemales,
  verifyApiConnection,
} from "../services/geminiService";
import { extractSatelliteTags } from "../services/satelliteTagExtractor";
import { uploadImageToCloudinary } from "../services/cloudinaryService";
import { isValidImageUrl } from "../utils/imageValidationUtils";
import { mergeKnowledgeBase } from "../utils/stateMigrationUtils";
import { normalizeOldNPC } from "../utils/levelUtils";
import { updateKnowledgeBaseWithInputRoll } from "../utils/difficultyUtils";
import { useCombatRecovery } from "../src/hooks/useCombatRecovery";
import {
  analyzeCombatants,
  resolveCombatantIds,
} from "../services/CombatTriggerAnalyst";
import { TaskCategory } from "../utils/modelFallback";

// ... (GameContextType interface remains the same)
export interface GameContextType {
  // State
  currentScreen: GameScreen;
  knowledgeBase: KnowledgeBase;
  gameMessages: GameMessage[];
  styleSettings: StyleSettings;
  storageSettings: StorageSettings;
  isInitialLoading: boolean;
  storageInitError: string | null;
  notification: NotificationState | null;
  apiError: string | null;
  isLoadingApi: boolean;
  isAutoPlaying: boolean;
  isSavingGame: boolean;
  isAutoSaving: boolean;
  isSummarizingOnLoad: boolean;
  isCraftingItem: boolean;
  isUploadingAvatar: boolean;
  isCultivating: boolean;
  isReaderMode: boolean; // From useGameplayPanels
  isCharPanelOpen: boolean; // From useGameplayPanels
  isQuestsPanelOpen: boolean; // From useGameplayPanels
  isWorldPanelOpen: boolean; // From useGameplayPanels
  showDebugPanel: boolean; // From useGameplayPanels
  isJourneyLogOpen: boolean;
  isSummaryModalOpen: boolean;
  isSwapping: boolean;
  setIsSwapping: React.Dispatch<React.SetStateAction<boolean>>;
  rawAiResponsesLog: string[];
  sentPromptsLog: string[];
  sentEconomyPromptsLog: string[];
  receivedEconomyResponsesLog: string[];
  sentGeneralSubLocationPromptsLog: string[];
  receivedGeneralSubLocationResponsesLog: string[];
  latestPromptTokenCount: number | string | null;
  summarizationResponsesLog: string[];
  sentCraftingPromptsLog: string[];
  receivedCraftingResponsesLog: string[];
  sentNpcAvatarPromptsLog: string[];
  sentCultivationPromptsLog: string[];
  receivedCultivationResponsesLog: string[];
  prisonerInteractionLog: string[];
  companionInteractionLog: string[];
  sentPrisonerPromptsLog: string[];
  receivedPrisonerResponsesLog: string[];
  sentCompanionPromptsLog: string[];
  receivedCompanionResponsesLog: string[];
  retrievedRagContextLog: string[];
  // New log states
  sentCombatSummaryPromptsLog: string[];
  receivedCombatSummaryResponsesLog: string[];
  sentVictoryConsequencePromptsLog: string[];
  receivedVictoryConsequenceResponsesLog: string[];
  messageIdBeingEdited: string | null;
  selectedResponseLength: ResponseLength;
  apiSettingsReturnScreen: GameScreen;
  isApiVerified: boolean;
  apiKeyDisplay: string | null;
  uiState: UIState;
  avatarGenerationState: "idle" | "generating" | "uploading";
  isStreaming: boolean;
  streamingText: string;
  abortControllerRef: React.MutableRefObject<AbortController | null>;
  abortStream: () => void;
  addMessageAndUpdateState: (
    newMessages: GameMessage[],
    newKnowledgeBase: KnowledgeBase,
    startingCurrency?: number,
    callback?: () => void,
  ) => void;

  // New Context Strings for Prompts
  currentPageMessagesLog: string;
  previousPageSummaries: string[];
  lastNarrationFromPreviousPage?: string;

  // Modal State
  selectedEntity: { type: GameEntityType; entity: GameEntity } | null;
  isStyleSettingsModalOpen: boolean;
  isCompanionSelectionModalOpen: boolean; // NEW
  activeEconomyModal: {
    type: "marketplace" | "shopping_center";
    locationId: string;
  } | null;
  activeSlaveMarketModal: { locationId: string } | null;

  // Actions
  setCurrentScreen: React.Dispatch<React.SetStateAction<GameScreen>>;
  setKnowledgeBase: React.Dispatch<React.SetStateAction<KnowledgeBase>>;
  setGameMessages: React.Dispatch<React.SetStateAction<GameMessage[]>>;
  setStyleSettings: (newSettings: StyleSettings) => void;
  setSelectedResponseLength: React.Dispatch<
    React.SetStateAction<ResponseLength>
  >;
  setApiKeyDisplay: React.Dispatch<React.SetStateAction<string | null>>;
  setRetrievedRagContextLog: React.Dispatch<React.SetStateAction<string[]>>;
  setIsCultivating: React.Dispatch<React.SetStateAction<boolean>>;
  setIsReaderMode: React.Dispatch<React.SetStateAction<boolean>>; // From useGameplayPanels
  setIsCharPanelOpen: React.Dispatch<React.SetStateAction<boolean>>; // From useGameplayPanels
  setIsQuestsPanelOpen: React.Dispatch<React.SetStateAction<boolean>>; // From useGameplayPanels
  setIsWorldPanelOpen: React.Dispatch<React.SetStateAction<boolean>>; // From useGameplayPanels
  setShowDebugPanel: React.Dispatch<React.SetStateAction<boolean>>; // From useGameplayPanels
  setIsJourneyLogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setIsSummaryModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setUiState: React.Dispatch<React.SetStateAction<UIState>>;
  handleSetupComplete: (
    settings: WorldSettings,
    rawAvatarData?: string | null,
  ) => Promise<void>;
  handlePlayerAction: (
    action: string,
    isChoice: boolean,
    inputType: PlayerActionInputType,
    responseLength: ResponseLength,
    matPhapResumeCtx?: any,
    overrideKnowledgeBase?: KnowledgeBase,
    customPromptOverride?: string
  ) => Promise<void>;
  handleFindLocation: (params: FindLocationParams) => Promise<void>;
  handleTravelToLocation: (locationId: string) => Promise<void>;
  handleNonCombatDefeat: (
    kbStateAtDefeat: KnowledgeBase,
    fatalNarration: string,
  ) => Promise<void>;
  handleActivePlayerDeath: (isFromCombat: boolean) => Promise<void>;
  handlePrisonerAction: (prisoner: Prisoner, action: string) => Promise<void>;
  handleCompanionAction: (
    companion: Wife | Slave,
    action: string,
  ) => Promise<void>;
  handleExitPrisonerScreen: (log: string[]) => Promise<void>;
  handleExitCompanionScreen: (log: string[]) => Promise<void>;
  onQuit: () => void;
  onSaveGame: () => Promise<void>;
  onDownloadSaveFile: () => void;
  onLoadGame: (saveId: string) => Promise<void>;
  handleUpdateEquipment: (
    slotId: EquipmentSlotId,
    itemIdToEquip: string | null,
    previousItemIdInSlot: string | null,
  ) => void;
  handleCraftItem: (
    desiredCategory: GameTemplates.ItemCategoryValues,
    requirements: string,
    materialIds: string[],
  ) => Promise<void>;
  handleBuyItem: (itemId: string, vendorId: string, quantity: number) => void;
  handleFailQuest: (questId: string) => void;
  handleCompleteQuest: (questId: string) => void;
  handleSellItem: (
    itemId: string,
    vendorId: string,
    sellPrice: number,
    quantity: number,
  ) => void;
  handleCombatEnd: (result: CombatEndPayload) => Promise<void>;
  handleCombatEndSpecificOutcome: (
    outcome: DefeatOutcome,
    payload: CombatEndPayload,
  ) => Promise<void>;
  handleSuccession?: (kbToModify: KnowledgeBase) => Promise<GameMessage>;
  onEnterCombat: () => void;
  onFleeCombat: () => void;
  onAutoCombat: () => void;
  handleMatPhapContinue?: () => Promise<void>;
  matPhapCountdown?: number | null;
  isCurrentlyActivePage: boolean;
  onToggleAutoPlay: () => void;
  onStartEditMessage: (messageId: string) => void;
  onSaveEditedMessage: (messageId: string, newContent: string) => void;
  onCancelEditMessage: () => void;
  onUpdatePlayerAvatar: (newAvatarUrl: string) => void;
  normalizeNpcRealms: (npcsToNormalize: any[]) => Promise<any>;
  onUpdateEntityAvatar: (
    entityType: "npc" | "yeuThu",
    entityId: string,
    newAvatarUrlOrData: string,
  ) => void;
  handleStartAuction: (
    locationId: string,
    playerItemIds?: string[],
  ) => Promise<void>;
  handlePlayerAuctionAction: (
    itemId: string,
    bidAmount: number,
  ) => Promise<void>;
  handleAuctioneerCall: () => void;
  handleSkipAuctionItem: () => Promise<void>;
  fetchSaveGamesForImportExport: () => Promise<SaveGameMeta[]>;
  loadSpecificGameDataForExport: (
    saveId: string,
  ) => Promise<SaveGameData | null>;
  handleImportGameData: (
    gameData: Omit<SaveGameData, "id" | "timestamp"> & { name: string },
  ) => Promise<void>;
  showNotification: (
    message: string,
    type: "success" | "error" | "info" | "warning",
  ) => void;
  onSettingsSaved: (newSettings: StorageSettings) => void;
  gameplayScrollPosition: React.MutableRefObject<number>;
  justLoadedGame: React.MutableRefObject<boolean>;
  handleRetryFlashSummary: () => Promise<void>;
  handleIgnoreFlashSummary: () => void;
  isRecoveringNarration: boolean;
  narrationRecoveryAction: 'continue' | 'rewrite' | null;
  handleContinueIncompleteNarration: () => void;
  handleRewriteIncompleteNarration: () => void;
  handleIgnoreIncompleteNarration: () => void;
  handleHideIncompleteNarration: () => void;
  handleRestoreIncompleteNarration: () => void;
  handleSelectIncompleteNarrationModel: (model: string) => void;
  convertPrisoner: (prisonerId: string, targetType: "wife" | "slave") => void;
  paySalary: (npcId: string, entityType: "slave" | "prisoner") => void;
  handleProcessDebugTags: (narration: string, tags: string) => Promise<void>;
  handleCreateCoreMemoryDebug: (
    entityNameOrId: string,
    text: string,
    strength: number,
  ) => void;
  handleCreateMemoryFromLastTurn: () => Promise<void>;
  updateLocationCoordinates: (locationId: string, x: number, y: number) => void;
  onStartDebugCombat: () => void;
  handleSetCombatCompanions: (ids: string[]) => void;
  handleStartBreakthroughCombat: () => Promise<void>;
  handleAnalyzeCombat: (kb: KnowledgeBase) => Promise<void>;
  handleSellPrisoner: (prisonerId: string, vendorId: string) => void;
  handleBuyPrisoner: (prisonerId: string, vendorId: string) => void;
  handleFreePerson: (
    personId: string,
    personType: "prisoner" | "slave" | "wife",
  ) => void;
  handleStartChallenge: (
    target: NPC | Wife | Slave | Prisoner,
  ) => Promise<void>;
  handleEnterEcoZone: (zoneStub: any) => Promise<void>;
  handleInitializeEconomicZones: () => Promise<void>;
  applyMinigameReward: (amount: number) => void;
  applyRouletteResult: (
    currencyChange: number,
    expPercentageLoss: number,
  ) => void;
  onGenerateAndUploadEntityAvatar: (
    entityType: "npc" | "yeuThu",
    entityId: string,
    prompt: string,
  ) => Promise<void>;
  onRandomizeAvatarHair: (
    entityType: "npc" | "yeuThu",
    entityId: string,
  ) => void;
  unrecognizedTags: string[];
  isUnrecognizedTagsModalOpen: boolean;
  isRetryingTags: boolean;
  handleIgnoreUnrecognizedTags: () => void;
  handleRetryUnrecognizedTags: (tags: string[]) => Promise<void>;
  onResetAllAvatars: () => Promise<void>;

  // King Crimson persistence
  kcActive: boolean;
  kcQueue: string[];
  kcCurrentIndex: number;
  kcType: PlayerActionInputType;
  startKingCrimson: (queue: string[], type: PlayerActionInputType) => void;
  stopKingCrimson: () => void;

  // Modal Actions
  openEntityModal: (type: GameEntityType, entity: GameEntity) => void;
  closeModal: () => void;
  closeEconomyModal: () => void;
  setIsStyleSettingsModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setIsApiVerified: React.Dispatch<React.SetStateAction<boolean>>;
  checkApiConnection: (
    force?: boolean,
    category?: TaskCategory,
  ) => Promise<void>;
  apiConnectionInfo: {
    success: boolean;
    model: string;
    embeddingModel?: string;
    embeddingSuccess?: boolean;
    source: string;
    timestamp: number;
  } | null;
  setIsCompanionSelectionModalOpen: React.Dispatch<
    React.SetStateAction<boolean>
  >;
  setActiveEconomyModal: React.Dispatch<
    React.SetStateAction<{
      type: "marketplace" | "shopping_center";
      locationId: string;
    } | null>
  >;

  // New Slave Market/Auction Actions
  setActiveSlaveMarketModal: React.Dispatch<
    React.SetStateAction<{ locationId: string } | null>
  >;
  closeSlaveMarketModal: () => void;
  isUpgradeModalOpen: boolean;
  upgradeItem: Item | null;
  openUpgradeModal: (item: Item) => void;
  closeUpgradeModal: () => void;
  handleUpgradeItem: (mainItemId: string, sacrificeItemIds: string[]) => void;
  handleBuySlave: (slave: Slave, vendorId: string) => void;
  handleSellSlave: (slaveId: string, vendorId: string) => void;
  renameSlave: (slaveId: string, newName: string) => void;
  handleStartSlaveAuction: (
    locationId: string,
    playerSlaveIds?: string[],
  ) => Promise<void>;
  handlePlayerSlaveAuctionAction: (
    slaveId: string,
    bidAmount: number,
  ) => Promise<void>;
  handleSlaveAuctioneerCall: () => Promise<void>;
  handleSkipSlaveAuctionItem: () => Promise<void>;
  handleSetPlayerMaxBid?: (maxBid: number) => void;
  handleInfluenceBaitRatio?: (type: 'rumor' | 'trap') => void;
  handleSetPlayerMaxBidSlave?: (maxBid: number) => void;
  handleInfluenceBaitRatioSlave?: (type: 'rumor' | 'trap') => void;
}

export const GameContext = createContext<GameContextType | null>(null);

export const GameProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const gameplayScrollPosition = useRef(0);
  const justLoadedGame = useRef(false);

  const {
    storageSettings,
    styleSettings,
    setStorageSettings,
    setStyleSettings,
    isInitialLoading,
    storageInitError,
  } = useAppInitialization();
  const { notification, showNotification } = useGameNotifications();

  const gameData = useGameData();
  const {
    knowledgeBase,
    setKnowledgeBase,
    gameMessages,
    setGameMessages,
    addMessageAndUpdateState,
    resetGameData,
    messageIdBeingEdited,
    setMessageIdBeingEdited,
    selectedResponseLength,
    setSelectedResponseLength,
    prisonerInteractionLog,
    setPrisonerInteractionLog,
    companionInteractionLog,
    setCompanionInteractionLog,
    retrievedRagContextLog,
    setRetrievedRagContextLog,
    apiKeyDisplay,
    setApiKeyDisplay,
    sentCombatSummaryPromptsLog,
    setSentCombatSummaryPromptsLog,
    receivedCombatSummaryResponsesLog,
    setReceivedCombatSummaryResponsesLog,
    sentVictoryConsequencePromptsLog,
    setSentVictoryConsequencePromptsLog,
    receivedVictoryConsequenceResponsesLog,
    setReceivedVictoryConsequenceResponsesLog,
    sentCraftingPromptsLog,
    setSentCraftingPromptsLog,
    receivedCraftingResponsesLog,
    setReceivedCraftingResponsesLog,
  } = gameData;
  const {
    selectedEntity,
    isStyleSettingsModalOpen,
    activeEconomyModal,
    activeSlaveMarketModal,
    isCompanionSelectionModalOpen,
    isUpgradeModalOpen,
    upgradeItem,
    openEntityModal,
    openUpgradeModal,
    closeModal,
    closeEconomyModal,
    closeSlaveMarketModal,
    closeUpgradeModal,
    setIsStyleSettingsModalOpen,
    setActiveEconomyModal,
    setActiveSlaveMarketModal,
    setIsCompanionSelectionModalOpen,
    setIsUpgradeModalOpen,
    setUpgradeItem,
  } = useGameplayModals();
  const {
    isReaderMode,
    setIsReaderMode,
    isCharPanelOpen,
    setIsCharPanelOpen,
    isQuestsPanelOpen,
    setIsQuestsPanelOpen,
    isWorldPanelOpen,
    setIsWorldPanelOpen,
    showDebugPanel,
    setShowDebugPanel,
  } = useGameplayPanels();

  const [currentScreen, _setCurrentScreen] = useState<GameScreen>(
    GameScreen.Initial,
  );
  const [apiSettingsReturnScreen, setApiSettingsReturnScreen] =
    useState<GameScreen>(GameScreen.Initial);
  const [isApiVerified, setIsApiVerified] = useState<boolean>(false);
  const [apiConnectionInfo, setApiConnectionInfo] = useState<{
    success: boolean;
    model: string;
    embeddingModel?: string;
    embeddingSuccess?: boolean;
    source: string;
    timestamp: number;
  } | null>(null);
  const [sentNpcAvatarPromptsLog, setSentNpcAvatarPromptsLog] = useState<
    string[]
  >([]);
  const [isAutoPlaying, setIsAutoPlaying] = useState<boolean>(false);
  const [isSavingGame, setIsSavingGame] = useState<boolean>(false);
  const [isAutoSaving, setIsAutoSaving] = useState<boolean>(false);
  const [isSummarizingOnLoad, setIsSummarizingOnLoad] =
    useState<boolean>(false);
  const [isCraftingItem, setIsCraftingItem] = useState<boolean>(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState<boolean>(false);
  const [isCultivating, setIsCultivating] = useState<boolean>(false);
  const [isLoadingApi, setIsLoadingApi] = useState<boolean>(false);
  const [isJourneyLogOpen, setIsJourneyLogOpen] = useState(false);
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
  const [uiState, setUiState] = useState<UIState>({
    pendingCombatNoticeHidden: false,
    isChallengeModalOpen: false,
    isDevMode: false,
  });
  const [avatarGenerationState, setAvatarGenerationState] = useState<
    "idle" | "generating" | "uploading"
  >("idle");

  // Streaming states
  const [isStreaming, setIsStreaming] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);
  const [streamingText, setStreamingText] = useState("");

  useEffect(() => {
    setUiState((prev) => ({ ...prev, isSwapping }));
  }, [isSwapping]);

  const abortControllerRef = useRef<AbortController | null>(null);

  const abortStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  const { isLocked } = useUiLockStore();

  const setCurrentScreen = useCallback(
    (screenOrUpdater: React.SetStateAction<GameScreen>) => {
      _setCurrentScreen((prevScreen) => {
        const nextScreen =
          typeof screenOrUpdater === "function"
            ? screenOrUpdater(prevScreen)
            : screenOrUpdater;
        if (nextScreen === GameScreen.ApiSettings) {
          setApiSettingsReturnScreen(prevScreen);
        }
        return nextScreen;
      });
    },
    [],
  );

  const checkApiConnection = useCallback(
    async (force: boolean = false, category: TaskCategory = "combat") => {
      const result = await verifyApiConnection(force, category);
      setIsApiVerified(result.success);
      setApiConnectionInfo({
        success: result.success,
        model: result.model,
        embeddingModel: result.embeddingModel,
        embeddingSuccess: result.embeddingSuccess,
        source: result.source,
        timestamp: Date.now(),
      });
    },
    [],
  );

  const [apiError, setApiError] = useState<string | null>(null);
  const apiErrorTimer = useRef<number | undefined>(undefined);

  // King Crimson States
  const [kcActive, setKcActive] = useState<boolean>(false);
  const [kcQueue, setKcQueue] = useState<string[]>([]);
  const [kcCurrentIndex, setKcCurrentIndex] = useState<number>(-1);
  const [kcType, setKcType] = useState<PlayerActionInputType>("action");
  const kcTimerRef = useRef<any>(null);
  const lastSentIndexRef = useRef<number>(-1);

  const resetApiError = useCallback(() => {
    if (apiErrorTimer.current) clearTimeout(apiErrorTimer.current);
    setApiError(null);
  }, []);

  const setApiErrorWithTimeout = useCallback(
    (message: string | null, onRetry?: () => Promise<void>) => {
      resetApiError();
      setApiError(message);
      if (message) {
        // Classify the API error for the visual modal
        let type: '404' | '429' | 'network' | 'unknown' = 'unknown';
        let title = "Đã xảy ra lỗi kết nối AI";
        let reason = "Hệ thống gặp sự cố không xác định khi liên lạc với mô hình trí tuệ nhân tạo (Gemini).";
        let suggestion = "Hãy kiểm tra lại cấu hình kết nối và bấm nút 'Thử lại' để gửi lại hành động.";

        const msgLower = message.toLowerCase();
        
        if (msgLower.includes('404') || msgLower.includes('not found') || msgLower.includes('api_key_invalid') || msgLower.includes('invalid api') || (msgLower.includes('model') && msgLower.includes('not found'))) {
          type = '404';
          title = "Không Tìm Thấy Mô Hình / Không hợp lẹ (Lỗi 404)";
          reason = "Mô hình AI được chỉ định hiện tại không khớp hoàn toàn với cấu hình API Key, hoặc API Key bị không hợp lệ, không có quyền truy cập.";
          suggestion = "Vui lòng mở menu 'Cài đặt' (hình bánh răng ở trên cùng), chuyển sang nhóm Key khác hoặc bật 'Key Hệ thống' để tiếp tục trò chơi, sau đó bấm 'Thử lại'. Chuyển đổi mô hình thành gemini-flash-latest cũng có thể giúp giải quyết vấn đề.";
        } else if (msgLower.includes('429') || msgLower.includes('resource_exhausted') || msgLower.includes('quota') || msgLower.includes('busy') || msgLower.includes('bận')) {
          type = '429';
          title = "Vượt Quá Hạn Mức Yêu Cầu (Lỗi 429)";
          reason = "API Key hoặc IP hệ thống tạm thời bị quá giới hạn số lượt request trong một thời điểm (Rate Limit) hoặc hết hạn mức sử dụng (Quota Exceeded).";
          suggestion = "Hãy tạm dừng chế độ 'Tự động chơi' nếu đang bật. Vui lòng chờ tầm 5 - 10 giây để API nguội bớt rồi bấm 'Thử lại ngay'. Hoặc chuyển sang API Key khác trong Cài đặt.";
        } else if (msgLower.includes('failed to fetch') || msgLower.includes('network') || msgLower.includes('cors') || msgLower.includes('offline') || msgLower.includes('timeout') || msgLower.includes('time out') || msgLower.includes('aborted')) {
          type = 'network';
          title = "Sự Cố Kết Nối Mạng";
          reason = "Có lỗi kết nối mạng xảy ra giữa trình duyệt của bạn với cụm máy chủ Cloud Proxy AI. Có thể do đứt mạng cục bộ hoặc máy chủ AI phản hồi quá 330 giây.";
          suggestion = "Hãy kiểm tra lại Wi-Fi, mạng di động hoặc Internet trên thiết bị của bạn. Không cần reload trang, chỉ cần giữ nguyên trạng thái và bấm 'Thử lại ngay' để gửi lại lượt đi.";
        }

        setUiState(prev => ({
          ...prev,
          isApiErrorModalOpen: true,
          apiErrorDetails: {
            message,
            type,
            title,
            reason,
            suggestion
          },
          retryCallback: onRetry || null
        }));

        apiErrorTimer.current = window.setTimeout(
          () => setApiError(null),
          7000,
        );
      }
    },
    [resetApiError],
  );

  const onQuit = useCallback(() => {
    resetGameData();
    setCurrentScreen(GameScreen.Initial);
    setIsAutoPlaying(false);
  }, [resetGameData, setCurrentScreen, setIsAutoPlaying]);

  const lastNarrationFromPreviousPage: string | undefined = undefined;

  const previousPageSummariesContent: string[] = useMemo(() => {
    if (!knowledgeBase || !knowledgeBase.pageSummaries) return [];

    const allKeys = Object.keys(knowledgeBase.pageSummaries)
      .map(Number)
      .sort((a, b) => a - b);

    // Filter into two groups: chapters and regular pages
    const chapterKeys: number[] = [];
    const pageKeys: number[] = [];

    allKeys.forEach((key) => {
      const summaryText = knowledgeBase.pageSummaries![key];
      if (summaryText.startsWith("CHAPTER_SUMMARY::")) {
        chapterKeys.push(key);
      } else {
        pageKeys.push(key);
      }
    });

    // @FIX: [MEMORY - Tóm tắt] Chỉ lấy 5 tóm tắt trang gần nhất và TẤT CẢ tóm tắt chương
    const recentPageKeys = pageKeys.slice(-5);
    
    // Combine and sort back to chronological order
    const finalKeys = [...chapterKeys, ...recentPageKeys].sort((a, b) => a - b);

    return finalKeys.map((key) => {
      const summaryText = knowledgeBase.pageSummaries![key];
      const isChapter = summaryText.startsWith("CHAPTER_SUMMARY::");
      if (isChapter) {
        const content = summaryText.replace("CHAPTER_SUMMARY::", "");
        const chapterNumber = key / 5;
        return `Tóm Tắt Chương ${chapterNumber}: ${content}`;
      } else {
        return `${VIETNAMESE.pageSummaryTitle(key)}: ${summaryText}`;
      }
    });
  }, [knowledgeBase?.pageSummaries]);

  const currentPageMessagesLog = useMemo(() => {
    if (!knowledgeBase || !knowledgeBase.ragHistoryLog || knowledgeBase.ragHistoryLog.length === 0) {
      return "Không có dữ liệu trí nhớ 10 lượt gần nhất.";
    }

    // Lấy các bản ghi tóm tắt (thường là vectorization hoặc flash_agent) có chứa summary hoặc richSummary
    const sortedLogs = [...knowledgeBase.ragHistoryLog]
      .filter(log => log && typeof log.turn === 'number' && (log.summary || log.richSummary))
      .sort((a, b) => (b.turn ?? 0) - (a.turn ?? 0));

    const recentTurns: number[] = [];
    const logsToInclude: any[] = [];

    for (const log of sortedLogs) {
      if (!recentTurns.includes(log.turn)) {
        recentTurns.push(log.turn);
        logsToInclude.push(log);
      }
      if (recentTurns.length >= 10) break;
    }

    // Sắp xếp lại theo thứ tự thời gian tăng dần
    return logsToInclude
      .reverse()
      .map((log) => {
        const turnHeader = `[Bối cảnh Lượt ${log.turn}]:`;
        const summaryPart = log.summary ? `\n- Tóm lược: ${log.summary}` : "";
        const richSummaryPart = log.richSummary ? `\n- Diễn biến chi tiết: ${log.richSummary}` : "";
        return `${turnHeader}${summaryPart}${richSummaryPart}`;
      })
      .join("\n---\n");
  }, [knowledgeBase?.ragHistoryLog]);

  const executeSaveGame = useCallback(
    async (
      kbToSave: KnowledgeBase,
      messagesToSave: GameMessage[],
      saveName: string,
      existingId: string | null,
      isAuto: boolean,
    ): Promise<string | null> => {
      if (isAuto) setIsAutoSaving(true);
      else setIsSavingGame(true);
      try {
        let finalIdToUse = existingId;

        // If it's an autosave and we don't have an ID, try to find one by name
        // This prevents duplicate "Auto Save Slot X" entries across different playthroughs
        if (isAuto && !finalIdToUse) {
          try {
            const allSaves = await loadGamesFromIndexedDB();
            const matchingSave = allSaves.find((s) => s.name === saveName);
            if (matchingSave) {
              finalIdToUse = matchingSave.id;
              console.log(
                `Found existing autosave slot by name: ${saveName} (${finalIdToUse}). Overwriting...`,
              );
            }
          } catch (err) {
            console.error(
              "Error searching for existing autosave by name:",
              err,
            );
          }
        }

        // Prune autosave slots if they exceed the current limit
        if (isAuto && kbToSave.autoSaveSlotIds.length > MAX_AUTO_SAVE_SLOTS) {
          const extraIds = kbToSave.autoSaveSlotIds.slice(MAX_AUTO_SAVE_SLOTS);
          for (const id of extraIds) {
            if (id) {
              try {
                await deleteGameFromIndexedDB(id);
              } catch (e) {
                console.error(
                  "Error deleting extra autosave slot during pruning:",
                  e,
                );
              }
            }
          }
          kbToSave.autoSaveSlotIds = kbToSave.autoSaveSlotIds.slice(
            0,
            MAX_AUTO_SAVE_SLOTS,
          );
          if (kbToSave.currentAutoSaveSlotIndex >= MAX_AUTO_SAVE_SLOTS) {
            kbToSave.currentAutoSaveSlotIndex = 0;
          }
        }

        const idForLocal =
          typeof finalIdToUse === "string"
            ? parseInt(finalIdToUse, 10)
            : finalIdToUse;
        const newSaveId = await saveGameToIndexedDB(
          kbToSave,
          messagesToSave,
          saveName,
          isNaN(idForLocal as number) ? finalIdToUse : idForLocal,
        );
        if (!isAuto)
          showNotification(
            VIETNAMESE.gameSavedSuccess + ` ("${saveName}")`,
            "success",
          );
        return newSaveId;
      } catch (e) {
        const errorMsg =
          VIETNAMESE.errorSavingGame +
          (e instanceof Error ? `: ${e.message}` : "");
        if (!isAuto) showNotification(errorMsg, "error");
        else console.error(VIETNAMESE.autoSaveError(saveName), errorMsg);
        return null;
      } finally {
        if (isAuto) setIsAutoSaving(false);
        else setIsSavingGame(false);
      }
    },
    [showNotification],
  );

  const onSaveGame = useCallback(async () => {
    if (isSavingGame) return;
    const saveName =
      knowledgeBase.manualSaveName ||
      knowledgeBase.worldConfig?.saveGameName ||
      "DaoDoAI-Save";
    await executeSaveGame(
      knowledgeBase,
      gameMessages,
      saveName,
      knowledgeBase.manualSaveId,
      false,
    );
  }, [isSavingGame, knowledgeBase, gameMessages, executeSaveGame]);

  const onDownloadSaveFile = useCallback(() => {
    showNotification("Đang chuẩn bị file lưu...", "info");
    try {
      const fullGameData: SaveGameData = {
        id: knowledgeBase.manualSaveId || undefined,
        name:
          knowledgeBase.manualSaveName ||
          knowledgeBase.worldConfig?.saveGameName ||
          "DaoDoAI-Save",
        timestamp: new Date().toISOString(),
        knowledgeBase: knowledgeBase,
        gameMessages: gameMessages,
        appVersion: APP_VERSION,
      };

      const jsonString = JSON.stringify(fullGameData);
      const compressed = pako.gzip(jsonString);
      const blob = new Blob([compressed], { type: "application/gzip" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      let safeName = (fullGameData.name || "daodoai-save")
        .replace(/[^a-z0-9_-\s]/gi, "")
        .replace(/\s+/g, "-")
        .toLowerCase();
      link.download = `${safeName}.sav.gz`;
      link.href = url;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showNotification("Đã tải file lưu thành công!", "success");
    } catch (e) {
      console.error("Error creating save file for download:", e);
      showNotification(
        `Lỗi khi tạo file lưu: ${e instanceof Error ? e.message : "Unknown error"}`,
        "error",
      );
    }
  }, [knowledgeBase, gameMessages, showNotification]);

  const onLoadGame = useCallback(
    async (saveId: string) => {
      try {
        let loadedData = await loadSpecificGameFromIndexedDB(saveId);
        if (loadedData) {
          // Reconstruct full snapshots for delta entries in turn history
          loadedData = reconstructSnapshotsForExport(loadedData);

          const safeKnowledgeBase = mergeKnowledgeBase(
            loadedData.knowledgeBase,
          );

          // Prune autosave slots if they exceed the current limit
          if (safeKnowledgeBase.autoSaveSlotIds.length > MAX_AUTO_SAVE_SLOTS) {
            const extraIds =
              safeKnowledgeBase.autoSaveSlotIds.slice(MAX_AUTO_SAVE_SLOTS);
            for (const id of extraIds) {
              if (id) {
                try {
                  await deleteGameFromIndexedDB(id);
                } catch (e) {
                  console.error(
                    "Error deleting extra autosave slot during pruning:",
                    e,
                  );
                }
              }
            }
            safeKnowledgeBase.autoSaveSlotIds =
              safeKnowledgeBase.autoSaveSlotIds.slice(0, MAX_AUTO_SAVE_SLOTS);
            if (
              safeKnowledgeBase.currentAutoSaveSlotIndex >= MAX_AUTO_SAVE_SLOTS
            ) {
              safeKnowledgeBase.currentAutoSaveSlotIndex = 0;
            }
          }

          // Normalize NPCs to the current world config
          if (safeKnowledgeBase.discoveredNPCs) {
            safeKnowledgeBase.discoveredNPCs =
              safeKnowledgeBase.discoveredNPCs.map((npc) =>
                normalizeOldNPC(npc, safeKnowledgeBase),
              );
          }

          // Systemic fix: Ensure all entities have up-to-date stats with equipment bonuses on load
          let auditedKnowledgeBase = auditAllEntitiesStats(safeKnowledgeBase);
          
          // Roll for current turn restriction on load
          auditedKnowledgeBase = updateKnowledgeBaseWithInputRoll(auditedKnowledgeBase);

          setKnowledgeBase(auditedKnowledgeBase);
          setGameMessages(loadedData.gameMessages);
          setCurrentScreen(GameScreen.Gameplay);
          showNotification(VIETNAMESE.gameLoadedSuccess, "success");
        } else {
          showNotification("Không thể tải file lưu.", "error");
        }
      } catch (e) {
        console.error(e);
        showNotification(VIETNAMESE.errorLoadingGame, "error");
      }
    },
    [setKnowledgeBase, setGameMessages, setCurrentScreen, showNotification],
  );

  const logNpcAvatarPromptCallback = useCallback((prompt: string) => {
    setSentNpcAvatarPromptsLog((prev) => [prompt, ...prev].slice(0, 10));
  }, []);

  const onGenerateAndUploadEntityAvatar = useCallback(
    async (entityType: "npc" | "yeuThu", entityId: string, prompt: string) => {
      setAvatarGenerationState("generating");
      resetApiError();
      try {
        const base64Data = await generateImageUnified(prompt);
        if (!base64Data) {
          setAvatarGenerationState("idle");
          return;
        }

        setAvatarGenerationState("uploading");
        // Use the generated base64 image data directly
        const finalUrl = base64Data.startsWith("data:image")
          ? base64Data
          : `data:image/png;base64,${base64Data}`;

        const entityList =
          entityType === "npc"
            ? knowledgeBase.discoveredNPCs
            : knowledgeBase.discoveredYeuThu;
        const entity = entityList.find((e) => e.id === entityId);
        if (!entity) {
          throw new Error("Không tìm thấy thực thể để tải lên ảnh đại diện.");
        }

        setKnowledgeBase((prevKb) => {
          const newKb = JSON.parse(JSON.stringify(prevKb));
          const targetList =
            entityType === "npc"
              ? newKb.discoveredNPCs
              : newKb.discoveredYeuThu;
          const entityIndex = targetList.findIndex(
            (e: NPC | YeuThu) => e.id === entityId,
          );
          if (entityIndex > -1) {
            targetList[entityIndex].avatarUrl = finalUrl;
          }
          return newKb;
        });
        showNotification(VIETNAMESE.avatarUploadSuccess, "success");
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        setApiErrorWithTimeout(errorMsg);
      } finally {
        setAvatarGenerationState("idle");
      }
    },
    [
      knowledgeBase.discoveredNPCs,
      knowledgeBase.discoveredYeuThu,
      setKnowledgeBase,
      showNotification,
      resetApiError,
      setApiErrorWithTimeout,
    ],
  );

  const onEnterCombat = useCallback(() => {
    setKnowledgeBase((prev) => {
      const newKb = JSON.parse(JSON.stringify(prev));
      newKb.playerStats.isInCombat = true;
      return newKb;
    });
    setCurrentScreen(GameScreen.Combat);
  }, [setKnowledgeBase, setCurrentScreen]);



  const handleProcessDebugTags = useCallback(
    async (narration: string, tags: string) => {
      setIsLoadingApi(true);
      try {
        const tagArray = tags
          .split("\n")
          .map((t) => t.trim())
          .filter((t) => t.startsWith("["));
        if (tagArray.length === 0 && !narration.trim()) {
          showNotification(
            "Vui lòng nhập tag hoặc lời kể để xử lý.",
            "warning",
          );
          setIsLoadingApi(false);
          return;
        }
        const turnForMessages = knowledgeBase.playerStats.turn;

        const { 
          newKb: kbAfterTags, 
          systemMessagesFromTags, 
          mapNeedsLayout,
          tagErrors: debugTagErrors
        } = await performTagProcessing(
            knowledgeBase,
            tagArray,
            turnForMessages,
            logNpcAvatarPromptCallback,
          );

        kbAfterTags.pendingCorrections = [];

        let finalKb = kbAfterTags;
        if (mapNeedsLayout) {
            finalKb = applyAutoLayout(finalKb);
        }

        const levelUpResult = handleLevelUps(finalKb);
        finalKb = levelUpResult.updatedKb;
        const finalSystemMessages = [
          ...systemMessagesFromTags,
          ...levelUpResult.systemMessages.map((msg, index) => ({
            id: `debug-sys-${Date.now()}-${index}`,
            type: "system" as const,
            content: msg.content,
            timestamp: Date.now(),
            turnNumber: turnForMessages,
          })),
        ];

        finalKb.playerStats = calculateEffectiveStats(
          finalKb.playerStats,
          finalKb.equippedItems,
          finalKb.inventory,
        );

        if (finalKb.playerStats.sinhLuc <= 0) {
          await gameActions.handleNonCombatDefeat(
            finalKb,
            narration || "Bạn đã bị gục ngã do một sự kiện không rõ.",
          );
          return;
        }

        const newMessages: GameMessage[] = [];
        if (narration.trim()) {
          newMessages.push({
            id: `debug-narration-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            type: "narration",
            content: narration.trim(),
            timestamp: Date.now(),
            turnNumber: turnForMessages,
          });
        }
        newMessages.push(...finalSystemMessages);

        addMessageAndUpdateState(newMessages, finalKb);
        showNotification("Debug tags đã được xử lý.", "success");
      } catch (error) {
        console.error("Error processing debug tags:", error);
        showNotification(
          `Lỗi xử lý debug tags: ${error instanceof Error ? error.message : "Unknown error"}`,
          "error",
        );
      } finally {
        setIsLoadingApi(false);
      }
    },
    [
      knowledgeBase,
      setIsLoadingApi,
      showNotification,
      addMessageAndUpdateState,
      setKnowledgeBase,
      logNpcAvatarPromptCallback,
    ],
  );

  const handleCreateCoreMemoryDebug = useCallback(
    (entityNameOrId: string, text: string, strength: number) => {
      if (!text.trim() || isNaN(strength) || strength < 0 || strength > 100) {
        showNotification(
          "Vui lòng nhập nội dung và độ mạnh hợp lệ (0-100).",
          "error",
        );
        return;
      }

      setKnowledgeBase((prevKb) => {
        const newKb = JSON.parse(JSON.stringify(prevKb));
        let entityId = "player";
        let entityName = "Nhân vật chính";

        if (entityNameOrId.toLowerCase() !== "player") {
          const allEntities = [
            ...newKb.discoveredNPCs,
            ...newKb.wives,
            ...newKb.slaves,
            ...newKb.prisoners,
          ];
          if (newKb.master) allEntities.push(newKb.master);

          const foundEntity = allEntities.find(
            (e: any) => e.name === entityNameOrId || e.id === entityNameOrId,
          );
          if (foundEntity) {
            entityId = foundEntity.id;
            entityName = foundEntity.name;
          } else {
            showNotification(
              `Không tìm thấy thực thể với tên hoặc ID: "${entityNameOrId}"`,
              "error",
            );
            return prevKb; // Return original state
          }
        }

        const tagParams = {
          entityId: entityId,
          text: text,
          strength: String(strength),
        };

        const { updatedKb, systemMessages } = processCoreMemoryAdd(
          newKb,
          tagParams,
          newKb.playerStats.turn,
        );

        if (systemMessages.length > 0) {
          addMessageAndUpdateState(systemMessages, updatedKb);
        } else {
          setKnowledgeBase(updatedKb);
        }

        showNotification(
          `Đã tạo ký ức cho "${entityName}" thành công!`,
          "success",
        );

        return updatedKb;
      });
    },
    [setKnowledgeBase, showNotification, addMessageAndUpdateState],
  );

  const onUpdatePlayerAvatar = useCallback(
    async (newAvatarDataOrUrl: string) => {
      setIsUploadingAvatar(true);
      try {
        const finalUrl = newAvatarDataOrUrl;

        setKnowledgeBase((prevKb) => {
          const newKb = JSON.parse(JSON.stringify(prevKb));
          if (newKb.worldConfig) {
            newKb.worldConfig.playerAvatarUrl = finalUrl;
          }
          newKb.playerAvatarData = finalUrl;
          return newKb;
        });
        showNotification(VIETNAMESE.avatarUploadSuccess, "success");
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        showNotification(
          `${VIETNAMESE.avatarUploadError} ${errorMsg}`,
          "error",
        );
      } finally {
        setIsUploadingAvatar(false);
      }
    },
    [setKnowledgeBase, showNotification],
  );

  const onUpdateEntityAvatar = useCallback(
    async (
      entityType: "npc" | "yeuThu",
      entityId: string,
      newAvatarDataOrUrl: string,
    ) => {
      setIsUploadingAvatar(true);
      try {
        const finalUrl = newAvatarDataOrUrl;

        const entityList =
          entityType === "npc"
            ? knowledgeBase.discoveredNPCs
            : knowledgeBase.discoveredYeuThu;
        const entity = entityList.find((e) => e.id === entityId);
        if (!entity) {
          throw new Error("Entity not found.");
        }

        setKnowledgeBase((prevKb) => {
          const newKb = JSON.parse(JSON.stringify(prevKb));
          const targetList =
            entityType === "npc"
              ? newKb.discoveredNPCs
              : newKb.discoveredYeuThu;
          const entityIndex = targetList.findIndex(
            (e: NPC | YeuThu) => e.id === entityId,
          );
          if (entityIndex > -1) {
            targetList[entityIndex].avatarUrl = finalUrl;
          }
          return newKb;
        });

        showNotification(VIETNAMESE.avatarUploadSuccess, "success");
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        showNotification(
          `${VIETNAMESE.avatarUploadError} ${errorMsg}`,
          "error"
        );
      } finally {
        setIsUploadingAvatar(false);
      }
    },
    [
      knowledgeBase.discoveredNPCs,
      knowledgeBase.discoveredYeuThu,
      setKnowledgeBase,
      showNotification,
    ]
  );

  const onRandomizeAvatarHair = useCallback(
    (entityType: "npc" | "yeuThu", entityId: string) => {
      setKnowledgeBase((prevKb) => {
        const newKb = { ...prevKb };
        const targetList =
          entityType === "npc"
            ? [...newKb.discoveredNPCs]
            : [...newKb.discoveredYeuThu];
        const entityIndex = targetList.findIndex(
          (e: NPC | YeuThu) => e.id === entityId,
        );

        if (entityIndex > -1) {
          const randomAvatar = generateRandomFemaleAvatar();
          targetList[entityIndex] = {
            ...targetList[entityIndex],
            avatarUrl: undefined,
            avatarHairId: randomAvatar.avatarHairId,
            avatarFaceId: randomAvatar.avatarFaceId,
          };

          if (entityType === "npc") {
            newKb.discoveredNPCs = targetList as NPC[];
          } else {
            newKb.discoveredYeuThu = targetList as YeuThu[];
          }
        }
        return { ...newKb };
      });
      showNotification("Đã khởi tạo diện mạo mới cho nhân vật!", "success");
    },
    [setKnowledgeBase, showNotification]
  );

  const onResetAllAvatars = useCallback(async () => {
    let femaleList: any[] = [];
    
    // Thu thập tất cả các nhân vật nữ
    setKnowledgeBase((prevKb) => {
      const collect = (list: any[]) => {
        if (!list) return;
        list.forEach(item => {
           if (item && isEntityFemale(item)) {
             femaleList.push({ id: item.id || item.name, name: item.name, personality: item.personalityTraits?.join(', ') || item.personality || '', description: item.description || '' });
           }
        });
      }
      collect(prevKb.discoveredNPCs || []);
      collect(prevKb.wives || []);
      collect(prevKb.slaves || []);
      collect(prevKb.companions || []);
      collect(prevKb.prisoners || []);
      if (prevKb.master && isEntityFemale(prevKb.master)) {
        femaleList.push({ id: prevKb.master.id || prevKb.master.name, name: prevKb.master.name, personality: prevKb.master.personalityTraits?.join(', ') || prevKb.master.personality || '', description: prevKb.master.description || '' });
      }
      return prevKb; // Không thay đổi gì ở bước này
    });

    if (femaleList.length === 0) {
      showNotification("Không tìm thấy nhân vật nữ nào để khởi tạo Avatar.", "info");
      return;
    }

    showNotification(`Đang nhờ AI phân tích để tạo avatar cho ${femaleList.length} nhân vật nữ...`, "info");

    try {
      const result = await generateAvatarsForFemales(femaleList);
      
      const avatarMap: Record<string, { hair: number, face: number}> = {};
      result.forEach(r => {
        avatarMap[r.id] = { hair: r.hair, face: r.face };
      });

      // Cập nhật lại KnowledgeBase
      setKnowledgeBase((prevKb) => {
        const updateIfFemaleAndInMap = (entity: any) => {
          if (!entity) return entity;
          const id = entity.id || entity.name;
          if (isEntityFemale(entity) && avatarMap[id]) {
            return {
              ...entity,
              avatarHairId: avatarMap[id].hair,
              avatarFaceId: avatarMap[id].face,
              avatarUrl: undefined,
            };
          }
          if (!isEntityFemale(entity)) {
             return {
                ...entity,
                avatarHairId: undefined,
                avatarFaceId: undefined,
                avatarUrl: undefined,
             };
          }
          return entity;
        };

        const newKb = { ...prevKb };

        if (newKb.discoveredNPCs)
          newKb.discoveredNPCs = newKb.discoveredNPCs.map(updateIfFemaleAndInMap);
        if (newKb.discoveredYeuThu)
          newKb.discoveredYeuThu = newKb.discoveredYeuThu.map(updateIfFemaleAndInMap);
        if (newKb.wives) newKb.wives = newKb.wives.map(updateIfFemaleAndInMap);
        if (newKb.slaves)
          newKb.slaves = (newKb.slaves || []).map(updateIfFemaleAndInMap);
        if (newKb.prisoners)
          newKb.prisoners = (newKb.prisoners || []).map(updateIfFemaleAndInMap);
        if (newKb.companions)
          newKb.companions = (newKb.companions || []).map(updateIfFemaleAndInMap);
        if (newKb.master) newKb.master = updateIfFemaleAndInMap(newKb.master);

        // Xử lý player nếu là nữ (tạm cấp random vì player k có trong list AI)
        if (isEntityFemale(newKb)) {
          const randomAvatar = generateRandomFemaleAvatar();
          if (newKb.worldConfig) {
             newKb.worldConfig = {
               ...newKb.worldConfig,
               playerAvatarUrl: undefined,
               playerAvatarHairId: randomAvatar.avatarHairId,
               playerAvatarFaceId: randomAvatar.avatarFaceId,
             };
          }
          newKb.playerAvatarData = undefined;
        } else {
          if (newKb.worldConfig) {
             newKb.worldConfig.playerAvatarHairId = undefined;
             newKb.worldConfig.playerAvatarFaceId = undefined;
             newKb.worldConfig.playerAvatarUrl = undefined;
          }
          newKb.playerAvatarData = undefined;
        }

        return newKb;
      });

      showNotification("Đã hoàn tất quy trình quét và khởi tạo Avatar (Nữ) bằng AI!", "success");
    } catch (e) {
      console.error(e);
      showNotification("Lỗi khi dùng AI tạo Avatar. Hãy thử lại sau.", "error");
    }
  }, [setKnowledgeBase, showNotification]);

  const handleFailQuest = useCallback(
    (questId: string) => {
      setKnowledgeBase((prev) => {
        if (!prev) return prev;
        const questIndex = prev.allQuests.findIndex((q) => q.id === questId);
        if (questIndex === -1) return prev;

        const quest = prev.allQuests[questIndex];
        const newQuests = [...prev.allQuests];
        newQuests[questIndex] = {
          ...quest,
          status: "failed",
          resolvedAtTurn: prev.playerStats.turn,
        };

        const punishment = quest.punishmentText || "Nhiệm vụ bị thất bại do người chơi chủ động hủy bỏ.";
        const newStats = { ...prev.playerStats };

        // Nếu không phải là nhiệm vụ cốt truyện (MAIN) thì chèn debuff trạng thái phạt tồn tại trong 20 lượt
        let debuffNameMsg = "";
        if (!isMainQuest(quest)) {
          if (!newStats.activeStatusEffects) {
            newStats.activeStatusEffects = [];
          }
          const extractedName = extractStatusEffectNameFromQuestText(quest.punishmentText || "");
          const debuffName = extractedName ? `${extractedName} (Thất bại)` : `Hậu họa: [${quest.title}] (Thất bại)`;
          debuffNameMsg = debuffName;
          const debuffEffect = {
            id: `quest-fail-${quest.id}-${Date.now()}_debuff`,
            name: debuffName,
            description: quest.punishmentText || `Chịu hậu quả tiêu cực do thất bại hoặc chủ động hủy bỏ nhiệm vụ [${quest.title}].`,
            type: "debuff" as const,
            durationTurns: 20,
            statModifiers: {
              sucTanCong: -2,
            },
            specialEffects: ["QUEST_FAIL_PENALTY"],
          };
          newStats.activeStatusEffects = [
            ...newStats.activeStatusEffects.filter((eff) => eff.name !== debuffName),
            debuffEffect,
          ];
        }

        // Thêm tin nhắn hệ thống để AI xử lý ở lượt tới
        const failMsg: GameMessage = {
          id: `sys_q_fail_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          type: "system",
          content: `BẠN ĐÃ CHỦ ĐỘNG HỦY NHIỆM VỤ: [${quest.title}]. Hình phạt cơ học: ${punishment}${!isMainQuest(quest) ? `. Đã thêm trạng thái có hại "${debuffNameMsg}" tồn tại trong 20 lượt` : ''}. AI hãy mô tả sự hối hận hoặc hậu quả của việc này trong lượt kể tới.`,
          timestamp: Date.now(),
          turnNumber: prev.playerStats.turn,
        };

        // Chúng ta không gọi addMessageAndUpdateState ở đây vì nó sẽ gây vòng lặp render nếu không cẩn thận
        // Nhưng chúng ta cần cập nhật tin nhắn. Một cách đơn giản là dùng callback của setKnowledgeBase 
        // hoặc gọi nó sau đó. Ở đây tôi sẽ update quest status trước.
        
        setTimeout(() => {
            addMessageAndUpdateState([failMsg], null);
            showNotification(`Đã hủy nhiệm vụ: ${quest.title}`, "warning");
        }, 0);

        return {
          ...prev,
          playerStats: newStats,
          allQuests: newQuests,
        };
      });
    },
    [setKnowledgeBase, addMessageAndUpdateState, showNotification]
  );

  const handleCompleteQuest = useCallback(
    (questId: string) => {
      setKnowledgeBase((prev) => {
        if (!prev) return prev;
        const questIndex = prev.allQuests.findIndex((q) => q.id === questId);
        if (questIndex === -1) return prev;

        const quest = prev.allQuests[questIndex];
        const newQuests = [...prev.allQuests];
        newQuests[questIndex] = {
          ...quest,
          status: "completed",
          resolvedAtTurn: prev.playerStats.turn,
        };
        // Mark all objectives completed
        newQuests[questIndex].objectives = newQuests[questIndex].objectives.map((obj) => ({
          ...obj,
          completed: true,
        }));

        let rewardMsg = `Bạn đã nhận được thưởng cho nhiệm vụ [${quest.title}]: `;
        let newStats = { ...prev.playerStats };
        const newInventory = [...prev.inventory];
        
        let hasReward = false;
        if (quest.rewardExp) {
            newStats.kinhNghiem += quest.rewardExp;
            rewardMsg += ` ${quest.rewardExp} Tu Vi.`;
            hasReward = true;
        }
        if (quest.rewardCurrency) {
            newStats.currency += quest.rewardCurrency;
            rewardMsg += ` ${quest.rewardCurrency} Linh Thạch.`;
            hasReward = true;
        }
        if (quest.rewardItem) {
            const newItemId = `quest-reward-${Date.now()}`;
            newInventory.push({
                id: newItemId,
                name: quest.rewardItem,
                description: `Phần thưởng từ nhiệm vụ: ${quest.title}`,
                category: "Miscellaneous",
                rarity: "Phổ Thông",
                quantity: 1,
                usable: false,
                consumable: false
            } as any);
            rewardMsg += ` ${quest.rewardItem}.`;
            hasReward = true;
        }
        
        if (!hasReward) {
             rewardMsg += ` Nội dung thưởng: ${quest.rewardText || 'Không có'}`;
        }

        // Chèn trạng thái Buff tăng độ giao hảo (Hết hạn sau 20 lượt) nếu không phải nhiệm vụ cốt truyện (MAIN)
        if (!isMainQuest(quest)) {
          if (!newStats.activeStatusEffects) {
            newStats.activeStatusEffects = [];
          }
          const extractedName = extractStatusEffectNameFromQuestText(quest.rewardText || "");
          const buffName = extractedName ? `${extractedName} (Hoàn thành)` : `Phúc lành: [${quest.title}] (Hoàn thành)`;
          const buffEffect = {
            id: `quest-success-${quest.id}-${Date.now()}_buff`,
            name: buffName,
            description: quest.rewardText || `Nhận được sự công nhận và phúc trạch sau khi hoàn thành nhiệm vụ [${quest.title}].`,
            type: "buff" as const,
            durationTurns: 20,
            statModifiers: {
              sucTanCong: 2,
            },
            specialEffects: ["QUEST_SUCCESS_BUFF"],
          };
          newStats.activeStatusEffects = [
            ...newStats.activeStatusEffects.filter((eff) => eff.name !== buffName),
            buffEffect,
          ];
          rewardMsg += `. Đã thêm trạng thái có lợi "${buffName}" tồn tại trong 20 lượt.`;
        }

        const completeMsg: GameMessage = {
          id: `sys_q_comp_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          type: "system",
          content: `BẠN ĐÃ ÉP BUỘC HOÀN THÀNH NHIỆM VỤ: [${quest.title}]. ${rewardMsg}. AI hãy mô tả sự kiện tự động này ở lượt kể kế tiếp.`,
          timestamp: Date.now(),
          turnNumber: prev.playerStats.turn,
        };
        
        setTimeout(() => {
            addMessageAndUpdateState([completeMsg], null);
            showNotification(`Đã hoàn thành nhiệm vụ: ${quest.title}`, "success");
        }, 0);

        return {
          ...prev,
          playerStats: newStats,
          inventory: newInventory,
          allQuests: newQuests,
        };
      });
    },
    [setKnowledgeBase, addMessageAndUpdateState, showNotification]
  );

  const handleBuyItem = useCallback(
    (itemId: string, vendorId: string, quantity: number = 1) => {
      setKnowledgeBase((prevKb) => {
        const vendorIndex = prevKb.discoveredNPCs.findIndex(
          (n) => n.id === vendorId,
        );
        const vendor = prevKb.discoveredNPCs[vendorIndex];
        if (!vendor || !vendor.shopInventory) {
          console.warn(
            `Vendor with ID ${vendorId} or their inventory not found.`,
          );
          return prevKb;
        }

        const itemIndexInShop = vendor.shopInventory.findIndex(
          (i) => i.id === itemId,
        );
        if (itemIndexInShop === -1) {
          console.warn(
            `Item with ID ${itemId} not found in vendor ${vendor.name}'s inventory.`,
          );
          return prevKb;
        }

        const itemInShop = vendor.shopInventory[itemIndexInShop];
        const price = itemInShop.value || 0;
        const totalPrice = price * quantity;

        if (prevKb.playerStats.currency < totalPrice) {
          showNotification(VIETNAMESE.notEnoughMoney, "error");
          return prevKb;
        }

        if (itemInShop.quantity < quantity) {
          showNotification(
            `Cửa hàng không đủ số lượng "${itemInShop.name}".`,
            "warning",
          );
          return prevKb;
        }

        // Create new objects with structural sharing
        const newInventory = [...prevKb.inventory];
        const existingPlayerItemIndex = newInventory.findIndex(
          (i) => i.name === itemInShop.name && i.stackable !== false,
        );

        if (existingPlayerItemIndex > -1) {
          newInventory[existingPlayerItemIndex] = {
            ...newInventory[existingPlayerItemIndex],
            quantity: newInventory[existingPlayerItemIndex].quantity + quantity,
          };
        } else {
          const newItemForPlayer = {
            ...itemInShop,
            id: `item-${itemInShop.name.replace(/\s+/g, "-")}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            quantity: quantity,
          };
          newInventory.push(newItemForPlayer);
        }

        const newShopInventory = [...vendor.shopInventory];
        const updatedItemInShop = {
          ...itemInShop,
          quantity: itemInShop.quantity - quantity,
        };
        if (updatedItemInShop.quantity <= 0) {
          newShopInventory.splice(itemIndexInShop, 1);
        } else {
          newShopInventory[itemIndexInShop] = updatedItemInShop;
        }

        const newNPCs = [...prevKb.discoveredNPCs];
        newNPCs[vendorIndex] = { ...vendor, shopInventory: newShopInventory };

        const currencyName = prevKb.worldConfig?.currencyName || "Tiền";
        showNotification(
          VIETNAMESE.itemBought(itemInShop.name, totalPrice, currencyName),
          "success",
        );

        // Phát sinh event summary để lưu vào RAG / dòng thời gian
        const inGameDateStr = `Ngày ${prevKb.worldDate?.day || 1} Tháng ${prevKb.worldDate?.month || 1} Năm ${prevKb.worldDate?.year || 1} (${prevKb.worldDate?.timeOfDay || 'Sáng'})`;
        const buyLocation = vendor.name || "Cửa Hàng Vạn Bảo";
        const playerName = prevKb.worldConfig?.playerName || "Người chơi";
        const transactionStatus = `${playerName} mua thành công`;

        const eventSummaryContent = `[TỔNG KẾT MUA VẬT PHẨM CỬA HÀNG]
- Số lượt chơi hiện tại (turnNumber): Lượt ${prevKb.playerStats.turn}
- Ngày tháng giao dịch: ${inGameDateStr}
- Địa điểm giao dịch: ${buyLocation}
- Tên vật phẩm đã giao dịch: ${itemInShop.name} (Số lượng: ${quantity})
- Mức giá cuối cùng (finalPrice): ${totalPrice.toLocaleString()} ${currencyName}
- Trạng thái giao dịch: ${transactionStatus}

Chi tiết diễn biến: AI mô tả MC mua thành công ${quantity}x "${itemInShop.name}" từ cửa hàng của ${vendor.name} với giá ${totalPrice.toLocaleString()} ${currencyName}.`;

        const newEventMessage = {
          id: `item-buy-shop-${itemInShop.id}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          type: 'event_summary' as const,
          content: eventSummaryContent,
          timestamp: Date.now(),
          turnNumber: prevKb.playerStats.turn
        };

        setTimeout(() => {
          addMessageAndUpdateState([newEventMessage], null);
        }, 0);

        return {
          ...prevKb,
          playerStats: {
            ...prevKb.playerStats,
            currency: prevKb.playerStats.currency - totalPrice,
          },
          inventory: newInventory,
          discoveredNPCs: newNPCs,
        };
      });
    },
    [setKnowledgeBase, showNotification, addMessageAndUpdateState],
  );

  const handleSellItem = useCallback(
    (
      itemId: string,
      vendorId: string,
      sellPrice: number,
      quantity: number = 1,
    ) => {
      setKnowledgeBase((prevKb) => {
        const itemIndexInInventory = prevKb.inventory.findIndex(
          (i) => i.id === itemId,
        );
        if (itemIndexInInventory === -1) {
          return prevKb;
        }

        const itemToSell = prevKb.inventory[itemIndexInInventory];
        if (itemToSell.quantity < quantity) {
          showNotification(
            `Bạn không có đủ số lượng "${itemToSell.name}" để bán.`,
            "warning",
          );
          return prevKb;
        }

        const vendorIndex = prevKb.discoveredNPCs.findIndex(
          (n) => n.id === vendorId,
        );
        const vendor = prevKb.discoveredNPCs[vendorIndex];
        if (!vendor) {
          return prevKb;
        }

        const totalPrice = sellPrice * quantity;

        // Create new objects with structural sharing
        const newInventory = [...prevKb.inventory];
        const updatedItemToSell = {
          ...itemToSell,
          quantity: itemToSell.quantity - quantity,
        };
        if (updatedItemToSell.quantity <= 0) {
          newInventory.splice(itemIndexInInventory, 1);
        } else {
          newInventory[itemIndexInInventory] = updatedItemToSell;
        }

        const newShopInventory = [...(vendor.shopInventory || [])];
        const existingVendorItemIndex = newShopInventory.findIndex(
          (i) => i.name === itemToSell.name,
        );
        if (existingVendorItemIndex > -1) {
          newShopInventory[existingVendorItemIndex] = {
            ...newShopInventory[existingVendorItemIndex],
            quantity:
              newShopInventory[existingVendorItemIndex].quantity + quantity,
          };
        } else {
          const newItemForVendor = {
            ...itemToSell,
            id: `item-${itemToSell.name.replace(/\s+/g, "-")}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            quantity: quantity,
          };
          newShopInventory.push(newItemForVendor);
        }

        const newNPCs = [...prevKb.discoveredNPCs];
        newNPCs[vendorIndex] = { ...vendor, shopInventory: newShopInventory };

        const currencyName = prevKb.worldConfig?.currencyName || "Tiền";
        showNotification(
          VIETNAMESE.itemSold(itemToSell.name, totalPrice, currencyName),
          "success",
        );

        // Phát sinh event summary để lưu vào RAG / dòng thời gian
        const inGameDateStr = `Ngày ${prevKb.worldDate?.day || 1} Tháng ${prevKb.worldDate?.month || 1} Năm ${prevKb.worldDate?.year || 1} (${prevKb.worldDate?.timeOfDay || 'Sáng'})`;
        const sellLocation = vendor.name || "Cửa Hàng Vạn Bảo";
        const playerName = prevKb.worldConfig?.playerName || "Người chơi";
        const transactionStatus = `${playerName} bán thành công`;

        const eventSummaryContent = `[TỔNG KẾT BÁN VẬT PHẨM CỬA HÀNG]
- Số lượt chơi hiện tại (turnNumber): Lượt ${prevKb.playerStats.turn}
- Ngày tháng giao dịch: ${inGameDateStr}
- Địa điểm giao dịch: ${sellLocation}
- Tên vật phẩm đã giao dịch: ${itemToSell.name} (Số lượng: ${quantity})
- Mức giá cuối cùng (finalPrice): ${totalPrice.toLocaleString()} ${currencyName}
- Trạng thái giao dịch: ${transactionStatus}

Chi tiết diễn biến: AI mô tả MC bán thành công ${quantity}x "${itemToSell.name}" cho cửa hàng của ${vendor.name} với giá ${totalPrice.toLocaleString()} ${currencyName}.`;

        const newEventMessage = {
          id: `item-sell-shop-${itemToSell.id}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          type: 'event_summary' as const,
          content: eventSummaryContent,
          timestamp: Date.now(),
          turnNumber: prevKb.playerStats.turn
        };

        setTimeout(() => {
          addMessageAndUpdateState([newEventMessage], null);
        }, 0);

        return {
          ...prevKb,
          playerStats: {
            ...prevKb.playerStats,
            currency: prevKb.playerStats.currency + totalPrice,
          },
          inventory: newInventory,
          discoveredNPCs: newNPCs,
        };
      });
    },
    [setKnowledgeBase, showNotification, addMessageAndUpdateState],
  );

  const handleSetCombatCompanions = useCallback(
    (ids: string[]) => {
      setKnowledgeBase((prev) => {
        const slaveAndPrisonerIds = new Set([
          ...(prev.slaves || []).map((s) => s.id),
          ...(prev.prisoners || []).map((p) => p.id),
        ]);

        const existingStoryAllies = (prev.pendingCombat?.allyIds || []).filter(
          (id) => !slaveAndPrisonerIds.has(id),
        );
        const newAllyIds = Array.from(new Set([...existingStoryAllies, ...ids]));

        return {
          ...prev,
          combatCompanionIds: ids,
          pendingCombat: prev.pendingCombat
            ? {
                ...prev.pendingCombat,
                allyIds: newAllyIds,
              }
            : prev.pendingCombat,
        };
      });
      showNotification(
        `Đã cập nhật đội hình chiến đấu (${ids.length}/${MAX_COMBAT_COMPANIONS}).`,
        "success",
      );
    },
    [setKnowledgeBase, showNotification],
  );

  const applyMinigameReward = useCallback(
    (amount: number) => {
      if (isNaN(amount) || amount <= 0) return;

      setKnowledgeBase((prev) => {
        const currentCurrency = isNaN(prev.playerStats.currency)
          ? 0
          : prev.playerStats.currency;

        const newState = {
          ...prev,
          playerStats: {
            ...prev.playerStats,
            currency: currentCurrency + amount,
          },
        };
        return newState;
      });

      const currencyName = knowledgeBase.worldConfig?.currencyName || "Tiền";
      showNotification(
        `Bạn đã nhận được tổng cộng ${amount.toLocaleString()} ${currencyName} từ mini-game!`,
        "success",
      );
    },
    [
      setKnowledgeBase,
      showNotification,
      knowledgeBase.worldConfig?.currencyName,
    ],
  );

  const applyRouletteResult = useCallback(
    (currencyChange: number, expPercentageLoss: number) => {
      setKnowledgeBase((prev) => {
        const currentCurrency = isNaN(prev.playerStats.currency)
          ? 0
          : prev.playerStats.currency;
        const currentExp = isNaN(prev.playerStats.kinhNghiem)
          ? 0
          : prev.playerStats.kinhNghiem;
        const maxExp = isNaN(prev.playerStats.kinhNghiemCanThiet)
          ? 1
          : prev.playerStats.kinhNghiemCanThiet;

        const newCurrency = Math.max(0, currentCurrency + currencyChange);

        let newExp = currentExp;
        if (expPercentageLoss > 0) {
          const expLost = Math.floor(maxExp * (expPercentageLoss / 100));
          newExp = Math.max(0, currentExp - expLost);
        }

        return {
          ...prev,
          playerStats: {
            ...prev.playerStats,
            currency: newCurrency,
            kinhNghiem: newExp,
          },
        };
      });

      const currencyName = knowledgeBase.worldConfig?.currencyName || "Tiền";
      if (currencyChange > 0) {
        showNotification(
          `Tuyệt vời! Bạn thắng ${currencyChange.toLocaleString()} ${currencyName}.`,
          "success",
        );
      } else {
        showNotification(
          `Nghiệp chướng! Bạn mất ${Math.abs(currencyChange).toLocaleString()} ${currencyName} và ${expPercentageLoss}% Tu vi.`,
          "error",
        );
      }
    },
    [
      setKnowledgeBase,
      showNotification,
      knowledgeBase.worldConfig?.currencyName,
    ],
  );

  const handleAnalyzeCombat = useCallback(
    async (kb: KnowledgeBase) => {
      if (!kb.pendingCombat || !kb.pendingCombat.enemy) return;

      setIsLoadingApi(true);
      try {
        const currentNarration = kb.pendingCombat.narration || "";
        const previousNarration = lastNarrationFromPreviousPage || "";

        const analysis = await analyzeCombatants(
          kb,
          currentNarration,
          previousNarration,
          (prompt) =>
            gameData.setSentPromptsLog((prev) =>
              [prompt, ...prev].slice(0, 10),
            ),
        );

        const resolved = resolveCombatantIds(analysis, kb);

        setKnowledgeBase((prev) => {
          const newKb = JSON.parse(JSON.stringify(prev));
          if (newKb.pendingCombat) {
            newKb.pendingCombat = {
              ...newKb.pendingCombat,
              ...resolved,
              analyzed: true,
              analysis: resolved,
            };
          }
          return newKb;
        });
      } catch (error) {
        console.error("Lỗi phân tích chiến đấu:", error);
        showNotification("Không thể phân tích thực lực tương quan.", "error");
      } finally {
        setIsLoadingApi(false);
      }
    },
    [
      lastNarrationFromPreviousPage,
      gameData.setSentPromptsLog,
      setKnowledgeBase,
      showNotification,
    ],
  );

  useCombatRecovery(knowledgeBase, isLoadingApi, handleAnalyzeCombat);

  const gameActions = useGameActions({
    knowledgeBase,
    setKnowledgeBase,
    gameMessages,
    setGameMessages,
    addMessageAndUpdateState,
    setRawAiResponsesLog: gameData.setRawAiResponsesLog,
    setSentPromptsLog: gameData.setSentPromptsLog,
    setSentEconomyPromptsLog: gameData.setSentEconomyPromptsLog,
    setReceivedEconomyResponsesLog: gameData.setReceivedEconomyResponsesLog,
    setSentGeneralSubLocationPromptsLog:
      gameData.setSentGeneralSubLocationPromptsLog,
    setReceivedGeneralSubLocationResponsesLog:
      gameData.receivedGeneralSubLocationResponsesLog,
    setLatestPromptTokenCount: gameData.setLatestPromptTokenCount,
    uiState,
    setUiState,
    setSummarizationResponsesLog: gameData.setSummarizationResponsesLog,
    showNotification,
    setCurrentScreen,
    isAutoPlaying,
    setIsAutoPlaying,
    executeSaveGame,
    storageType: storageSettings.storageType,
    firebaseUser: null,
    logNpcAvatarPromptCallback,
    setApiErrorWithTimeout,
    resetApiError,
    isLoadingApi,
    setIsLoadingApi,
    setIsCultivating,
    setSentCultivationPromptsLog: gameData.setSentCultivationPromptsLog,
    setReceivedCultivationResponsesLog:
      gameData.receivedCultivationResponsesLog,
    setCompanionInteractionLog,
    setPrisonerInteractionLog,
    setSentPrisonerPromptsLog: gameData.setSentPrisonerPromptsLog,
    setReceivedPrisonerResponsesLog: gameData.receivedPrisonerResponsesLog,
    setSentCompanionPromptsLog: gameData.setSentCompanionPromptsLog,
    setReceivedCompanionResponsesLog: gameData.receivedCompanionResponsesLog,
    setRetrievedRagContextLog,
    onQuit,
    currentPageMessagesLog,
    previousPageSummaries: previousPageSummariesContent,
    lastNarrationFromPreviousPage,
    setSentCombatSummaryPromptsLog,
    setReceivedCombatSummaryResponsesLog,
    setSentVictoryConsequencePromptsLog,
    setReceivedVictoryConsequenceResponsesLog,
    styleSettings,
    setIsStreaming,
    setStreamingText,
    isSwapping,
    setIsSwapping,
    abortControllerRef,
    openEntityModal,
    setActiveEconomyModal,
    setActiveSlaveMarketModal,
  });

  const otherGameActions = gameActions;

  const findEntityByIdInKb = useCallback((kb: KnowledgeBase, id: string): any | null => {
    const collections = [
      kb.discoveredNPCs || [],
      kb.discoveredYeuThu || [],
      kb.wives || [],
      kb.slaves || [],
      kb.prisoners || [],
      kb.companions || []
    ];
    for (const collection of collections) {
      const found = collection.find((entity: any) => entity.id === id);
      if (found) return found;
    }
    return null;
  }, []);

  const onFleeCombat = useCallback(async () => {
    if (!knowledgeBase.pendingCombat) return;
    const result = executeFleeCombat(knowledgeBase);
    if (!result) return;

    // 1. Gửi thông báo và áp dụng kết quả cơ học tức thời lên giao diện
    addMessageAndUpdateState([result.message], result.updatedKb);
    setUiState((prev) => ({ ...prev, pendingCombatNoticeHidden: false }));
    showNotification("Đã đào tẩu thành công! Đang đồng bộ hóa và sáng tạo lời kể hậu quả...", "warning");

    // 2. Chuyển giao toàn quyền xử lý cho hàm trung tâm handleCombatEnd
    const payload: CombatEndPayload = {
      outcome: 'escaped',
      summary: `Đào tẩu thành công khỏi vòng vây chiến đấu. Phạt tu vi từ [${result.penaltyDetails.oldRealm}] xuống [${result.penaltyDetails.newRealm}]. Tổn thất Linh thạch: -${result.penaltyDetails.lostMoney.toLocaleString()}.`,
      finalPlayerState: result.updatedKb.playerStats,
      dispositions: { player: 'release' },
      opponentIds: knowledgeBase.pendingCombat.opponentIds || [],
      finalInventory: result.updatedKb.inventory,
      finalAlliesStatus: (knowledgeBase.pendingCombat.allyIds || []).map(id => {
        const ally = findEntityByIdInKb(knowledgeBase, id);
        return { id, hp: ally?.stats?.sinhLuc ?? 100, mp: ally?.stats?.linhLuc ?? 50 };
      }),
      finalOpponentsStatus: (knowledgeBase.pendingCombat.opponentIds || []).map(id => {
        const opp = findEntityByIdInKb(knowledgeBase, id);
        return { id, hp: opp?.stats?.sinhLuc ?? 100, mp: opp?.stats?.linhLuc ?? 50 };
      })
    };

    await gameActions.handleCombatEnd(payload);
  }, [knowledgeBase, gameActions, addMessageAndUpdateState, setUiState, showNotification, findEntityByIdInKb]);

  const onAutoCombat = useCallback(async () => {
    if (!knowledgeBase.pendingCombat) return;
    const result = executeAutoCombat(knowledgeBase);
    if (!result) return;

    // 1. Áp dụng kết quả cơ học tức thời
    addMessageAndUpdateState([result.message], result.updatedKb);
    setUiState((prev) => ({ ...prev, pendingCombatNoticeHidden: false }));
    
    if (result.summary.isVictory) {
      showNotification("Tự động chiến đấu: Thắng Lợi! Đang sáng tạo lời kể...", "success");
    } else {
      showNotification("Tự động chiến đấu: Bại Trận! Đang sáng tạo lời kể...", "danger");
    }

    // 2. Chuyển giao toàn quyền xử lý cho hàm trung tâm handleCombatEnd để tính Exp, Permadeath, Mật pháp và sinh lời kể đồng bộ
    const dispositions: CombatDispositionMap = {};
    (knowledgeBase.pendingCombat.opponentIds || []).forEach(id => {
      const oppAfter = findEntityByIdInKb(result.updatedKb, id);
      dispositions[id] = (oppAfter?.isDead || oppAfter?.status === '[ĐÃ CHẾT]') ? 'kill' : 'release';
    });

    const payload: CombatEndPayload = {
      outcome: result.summary.isVictory ? 'victory' : 'defeat',
      summary: `Tương quan lực chiến ban đầu: Lực chiến phe ta [${result.summary.allyPower.toLocaleString()}], Lực chiến phe địch [${result.summary.enemyPower.toLocaleString()}]. Xác suất thắng: [${Math.round(result.summary.winProbability * 100)}%]. Người chơi mất -${result.summary.playerHpLoss.toLocaleString()} HP.`,
      finalPlayerState: result.updatedKb.playerStats,
      dispositions,
      opponentIds: knowledgeBase.pendingCombat.opponentIds || [],
      finalInventory: result.updatedKb.inventory,
      finalAlliesStatus: (knowledgeBase.pendingCombat.allyIds || []).map(id => {
        const allyAfter = findEntityByIdInKb(result.updatedKb, id);
        const isDead = allyAfter?.isDead || (allyAfter?.status === '[ĐÃ CHẾT]');
        return { id, hp: isDead ? 0 : (allyAfter?.stats?.sinhLuc ?? 100), mp: allyAfter?.stats?.linhLuc ?? 50 };
      }),
      finalOpponentsStatus: (knowledgeBase.pendingCombat.opponentIds || []).map(id => {
        const oppAfter = findEntityByIdInKb(result.updatedKb, id);
        const isDead = oppAfter?.isDead || (oppAfter?.status === '[ĐÃ CHẾT]');
        return { id, hp: isDead ? 0 : (oppAfter?.stats?.sinhLuc ?? 100), mp: oppAfter?.stats?.linhLuc ?? 50 };
      })
    };

    await gameActions.handleCombatEnd(payload);
  }, [knowledgeBase, gameActions, addMessageAndUpdateState, setUiState, showNotification, findEntityByIdInKb]);

  const stopKingCrimson = useCallback(() => {
    setKcActive(false);
    setKcCurrentIndex(-1);
    if (kcTimerRef.current) clearTimeout(kcTimerRef.current);
    kcTimerRef.current = null;
    lastSentIndexRef.current = -1;
  }, []);

  const startKingCrimson = useCallback(
    (queue: string[], type: PlayerActionInputType) => {
      lastSentIndexRef.current = -1;
      setKcQueue(queue);
      setKcType(type);
      setKcActive(true);
      setKcCurrentIndex(0);
    },
    [],
  );

  const isReadyForNextStep =
    !isLoadingApi &&
    !isSummarizingOnLoad &&
    !isStreaming &&
    !isSwapping &&
    !uiState.isSyncingData &&
    !isLocked;

  useEffect(() => {
    if (!kcActive) {
      lastSentIndexRef.current = -1;
      return;
    }

    if (kcCurrentIndex >= 0 && kcCurrentIndex < kcQueue.length) {
      if (isReadyForNextStep && lastSentIndexRef.current < kcCurrentIndex) {
        lastSentIndexRef.current = kcCurrentIndex;
        const nextAction = kcQueue[kcCurrentIndex];

        if (kcTimerRef.current) clearTimeout(kcTimerRef.current);

        kcTimerRef.current = setTimeout(async () => {
          if (kcActive) {
            try {
              await otherGameActions.handlePlayerAction(
                nextAction,
                false,
                kcType,
                selectedResponseLength,
              );
              setKcCurrentIndex((prev) => prev + 1);
            } catch (error) {
              console.error("King Crimson auto action failed:", error);
              stopKingCrimson();
            }
          }
        }, 2000);
      }
    } else if (kcCurrentIndex >= kcQueue.length) {
      stopKingCrimson();
    }
  }, [
    isReadyForNextStep,
    kcActive,
    kcCurrentIndex,
    kcQueue,
    kcType,
    otherGameActions,
    selectedResponseLength,
    stopKingCrimson,
  ]);

  // Stop King Crimson when a combat is pending to avoid conflicting inputs
  useEffect(() => {
    if (kcActive && knowledgeBase.pendingCombat && knowledgeBase.pendingCombat.enemyId) {
      console.log("King Crimson stopped due to pending combat detection.");
      stopKingCrimson();
    }
  }, [knowledgeBase.pendingCombat, kcActive, stopKingCrimson]);

  const handleUpgradeItem = useCallback(
    (mainItemId: string, sacrificeItemIds: string[]) => {
      setKnowledgeBase((prev) => {
        const newKb = { ...prev };
        const inventory = [...newKb.inventory];
        
        const mainItemIndex = inventory.findIndex(i => i.id === mainItemId);
        if (mainItemIndex === -1) return prev;
        
        const mainItem = { ...inventory[mainItemIndex] } as GameTemplates.EquipmentTemplate;
        
        // Remove sacrifices
        sacrificeItemIds.forEach(id => {
          const idx = inventory.findIndex(i => i.id === id);
          if (idx > -1) inventory.splice(idx, 1);
        });
        
        // Upgrade logic
        const currentLevel = mainItem.upgradeLevel || 0;
        const nextLevel = currentLevel + 1;
        
        // Update name
        const baseName = mainItem.name.replace(/\s\(\+\d+\)$/, '').trim();
        mainItem.name = `${baseName} (+${nextLevel})`;
        mainItem.upgradeLevel = nextLevel;
        
        // Update Stats
        if (mainItem.statBonuses) {
          Object.keys(mainItem.statBonuses).forEach(key => {
            const k = key as keyof typeof mainItem.statBonuses;
            const val = mainItem.statBonuses[k];
            if (typeof val === 'number') {
              (mainItem.statBonuses[k] as number) = Math.floor(val * 1.05);
            }
          });
        }
        
        // Hidden Stats (bonusPercentageStats)
        if (!mainItem.bonusPercentageStats) {
          mainItem.bonusPercentageStats = {};
        }
        
        // Random hidden stat to increase by 1%
        const possibleHiddenStats = [
          'sucTanCong', 'maxSinhLuc', 'maxLinhLuc', 'phongNgu',
          'chimang', 'hutmau', 'mayman', 'hoiphuc'
        ];
        const randomStat = possibleHiddenStats[Math.floor(Math.random() * possibleHiddenStats.length)];
        mainItem.bonusPercentageStats[randomStat] = (mainItem.bonusPercentageStats[randomStat] || 0) + 1;
        
        inventory[mainItemIndex] = mainItem;
        newKb.inventory = inventory;
        
        // Re-audit stats
        return auditAllEntitiesStats(newKb);
      });
      
      showNotification(VIETNAMESE.upgradeSuccessTitle, "success");
    },
    [setKnowledgeBase, showNotification]
  );

  const handleUpdateEquipment = useCallback(
    (
      slotId: EquipmentSlotId,
      itemIdToEquip: string | null,
      previousItemIdInSlot: string | null,
    ) => {
      if (itemIdToEquip) {
        const item = knowledgeBase.inventory.find(
          (i) => i.id === itemIdToEquip,
        );
        if (item && item.ownerId && item.ownerId !== "player") {
          showNotification(
            `Vật phẩm này thuộc về NPC khác, bạn không thể sử dụng!`,
            "error",
          );
          return;
        }
      }
      setKnowledgeBase((prev) => {
        let newKb = { ...prev };
        newKb.equippedItems = {
          ...newKb.equippedItems,
          [slotId]: itemIdToEquip,
        };
        
        // Systemic audit instead of just player
        newKb = auditAllEntitiesStats(newKb);
        return newKb;
      });
    },
    [setKnowledgeBase, knowledgeBase.inventory, showNotification],
  );

  const handleCraftItem = useCallback(
    async (
      desiredCategory: GameTemplates.ItemCategoryValues,
      requirements: string,
      materialIds: string[],
    ) => {
      setIsCraftingItem(true);
      try {
        const materials = knowledgeBase.inventory.filter((i) =>
          materialIds.includes(i.id),
        );
        const materialsForPrompt = materials.map((m) => ({
          name: m.name,
          description: m.description,
          category: m.category,
          materialType: (m as any).materialDetails?.type,
        }));

        const { response, rawText } = await generateCraftedItemViaAI(
          desiredCategory,
          requirements,
          materialsForPrompt,
          knowledgeBase.playerStats,
          knowledgeBase.worldConfig,
          currentPageMessagesLog,
          previousPageSummariesContent,
          lastNarrationFromPreviousPage,
          (prompt) =>
            setSentCraftingPromptsLog((prev) => [prompt, ...prev].slice(0, 10)),
        );
        setReceivedCraftingResponsesLog((prev) =>
          [rawText, ...prev].slice(0, 10),
        );

        const tagsToProcess = extractSatelliteTags(rawText, response?.tags);
        const { newKb, systemMessagesFromTags } = await performTagProcessing(
          knowledgeBase,
          tagsToProcess,
          knowledgeBase.playerStats.turn,
          logNpcAvatarPromptCallback,
        );

        const kbWithConsumedMaterials = JSON.parse(
          JSON.stringify(newKb),
        ) as KnowledgeBase;
        materialIds.forEach((id) => {
          const index = kbWithConsumedMaterials.inventory.findIndex(
            (i) => i.id === id,
          );
          if (index > -1) kbWithConsumedMaterials.inventory.splice(index, 1);
        });

        addMessageAndUpdateState(
          systemMessagesFromTags,
          kbWithConsumedMaterials,
        );

        if (response.narration) {
          showNotification(response.narration, "info");
        }
        showNotification("Luyện chế hoàn tất!", "success");
      } catch (e) {
        console.error(e);
        showNotification(
          "Lỗi luyện chế: " + (e instanceof Error ? e.message : String(e)),
          "error",
        );
      } finally {
        setIsCraftingItem(false);
      }
    },
    [
      knowledgeBase,
      currentPageMessagesLog,
      previousPageSummariesContent,
      lastNarrationFromPreviousPage,
      setSentCraftingPromptsLog,
      setReceivedCraftingResponsesLog,
      setKnowledgeBase,
      logNpcAvatarPromptCallback,
      addMessageAndUpdateState,
      showNotification,
    ],
  );

  const handleToggleAutoPlay = useCallback(() => {
    setIsAutoPlaying((prev) => !prev);
    showNotification(
      !isAutoPlaying
        ? VIETNAMESE.autoPlayEnabledNotification
        : VIETNAMESE.autoPlayDisabledNotification,
      "info",
    );
  }, [isAutoPlaying, showNotification]);

  const updateLocationCoordinates = useCallback(
    (locationId: string, x: number, y: number) => {
      setKnowledgeBase((prev) => {
        const newKb = { ...prev };
        const locIndex = newKb.discoveredLocations.findIndex(
          (l) => l.id === locationId,
        );
        if (locIndex > -1) {
          const newLocs = [...newKb.discoveredLocations];
          newLocs[locIndex] = { ...newLocs[locIndex], mapX: x, mapY: y };
          newKb.discoveredLocations = newLocs;
        }
        return newKb;
      });
    },
    [setKnowledgeBase],
  );

  const onStartEditMessage = useCallback(
    (messageId: string) => {
      setMessageIdBeingEdited(messageId);
    },
    [setMessageIdBeingEdited],
  );

  const onSaveEditedMessage = useCallback(
    (messageId: string, newContent: string) => {
      setGameMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId ? { ...msg, content: newContent } : msg,
        ),
      );
      setMessageIdBeingEdited(null);
      showNotification(VIETNAMESE.messageEditedSuccess, "success");
    },
    [setGameMessages, setMessageIdBeingEdited, showNotification],
  );

  const onCancelEditMessage = useCallback(() => {
    setMessageIdBeingEdited(null);
  }, [setMessageIdBeingEdited]);

  const contextValue: GameContextType = {
    currentScreen,
    knowledgeBase,
    gameMessages,
    styleSettings,
    storageSettings,
    isInitialLoading,
    storageInitError,
    notification,
    apiError,
    isLoadingApi,
    isAutoPlaying,
    isSavingGame,
    isAutoSaving,
    isSummarizingOnLoad,
    isCraftingItem,
    isUploadingAvatar,
    isCultivating,
    isReaderMode,
    isCharPanelOpen,
    isQuestsPanelOpen,
    isWorldPanelOpen,
    showDebugPanel,
    isJourneyLogOpen,
    isSummaryModalOpen,
    isSwapping,
    setIsSwapping,
    rawAiResponsesLog: gameData.rawAiResponsesLog,
    sentPromptsLog: gameData.sentPromptsLog,
    sentEconomyPromptsLog: gameData.sentEconomyPromptsLog,
    receivedEconomyResponsesLog: gameData.receivedEconomyResponsesLog,
    sentGeneralSubLocationPromptsLog: gameData.sentGeneralSubLocationPromptsLog,
    receivedGeneralSubLocationResponsesLog:
      gameData.receivedGeneralSubLocationResponsesLog,
    latestPromptTokenCount: gameData.latestPromptTokenCount,
    summarizationResponsesLog: gameData.summarizationResponsesLog,
    sentCraftingPromptsLog,
    receivedCraftingResponsesLog,
    sentNpcAvatarPromptsLog: sentNpcAvatarPromptsLog,
    sentCultivationPromptsLog: gameData.sentCultivationPromptsLog,
    receivedCultivationResponsesLog: gameData.receivedCultivationResponsesLog,
    prisonerInteractionLog,
    companionInteractionLog,
    sentPrisonerPromptsLog: gameData.sentPrisonerPromptsLog,
    receivedPrisonerResponsesLog: gameData.receivedPrisonerResponsesLog,
    sentCompanionPromptsLog: gameData.setSentCompanionPromptsLog,
    receivedCompanionResponsesLog: gameData.receivedCompanionResponsesLog,
    retrievedRagContextLog,
    sentCombatSummaryPromptsLog,
    receivedCombatSummaryResponsesLog,
    sentVictoryConsequencePromptsLog,
    receivedVictoryConsequenceResponsesLog,
    kcActive,
    kcQueue,
    kcCurrentIndex,
    kcType,
    startKingCrimson,
    stopKingCrimson,
    messageIdBeingEdited,
    selectedResponseLength,
    apiSettingsReturnScreen,
    isApiVerified,
    apiKeyDisplay,
    uiState,
    avatarGenerationState,
    isStreaming,
    streamingText,
    abortControllerRef,
    abortStream,
    addMessageAndUpdateState,
    currentPageMessagesLog,
    previousPageSummaries: previousPageSummariesContent,
    lastNarrationFromPreviousPage,
    selectedEntity,
    isStyleSettingsModalOpen,
    isCompanionSelectionModalOpen,
    activeEconomyModal,
    activeSlaveMarketModal,
    isUpgradeModalOpen,
    upgradeItem,
    setCurrentScreen,
    setKnowledgeBase,
    setGameMessages,
    setStyleSettings,
    setSelectedResponseLength,
    setApiKeyDisplay,
    setRetrievedRagContextLog,
    setIsCultivating,
    setIsReaderMode,
    setIsCharPanelOpen,
    setIsQuestsPanelOpen,
    setIsWorldPanelOpen,
    setShowDebugPanel,
    setIsJourneyLogOpen,
    setIsSummaryModalOpen,
    setUiState,
    apiConnectionInfo,
    ...otherGameActions,
    handleAnalyzeCombat,
    onGenerateAndUploadEntityAvatar,
    onQuit,
    onSaveGame,
    onDownloadSaveFile,
    onLoadGame,
    handleUpdateEquipment,
    handleCraftItem,
    handleBuyItem,
    handleFailQuest,
    handleCompleteQuest,
    handleSellItem,
    isCurrentlyActivePage: true,
    onToggleAutoPlay: handleToggleAutoPlay,
    onStartEditMessage,
    onSaveEditedMessage,
    onCancelEditMessage,
    onUpdatePlayerAvatar,
    onUpdateEntityAvatar,
    onRandomizeAvatarHair,
    onResetAllAvatars,
    fetchSaveGamesForImportExport: () => loadGamesFromIndexedDB(),
    loadSpecificGameDataForExport: (saveId) =>
      loadSpecificGameFromIndexedDB(saveId),
    handleImportGameData: (data) =>
      importGameToIndexedDB(data).then(() => {
        showNotification(VIETNAMESE.dataImportedSuccess, "success");
      }),
    showNotification,
    onSettingsSaved: setStorageSettings,
    gameplayScrollPosition,
    justLoadedGame,
    handleProcessDebugTags,
    handleCreateCoreMemoryDebug,
    updateLocationCoordinates,
    handleSetCombatCompanions,
    openEntityModal,
    closeModal,
    closeEconomyModal,
    setIsStyleSettingsModalOpen,
    setIsApiVerified,
    checkApiConnection,
    setIsCompanionSelectionModalOpen,
    setActiveEconomyModal,
    setActiveSlaveMarketModal,
    closeSlaveMarketModal,
    openUpgradeModal,
    closeUpgradeModal,
    handleUpgradeItem,
    renameSlave: (slaveId, newName) => {
      setKnowledgeBase((prev) => {
        const newKb = { ...prev };
        const slave = newKb.slaves.find((s) => s.id === slaveId);
        if (slave) {
          slave.name = newName;
        }
        return newKb;
      });
    },
    paySalary: (npcId, entityType) => {
      setKnowledgeBase((prev) => {
        let npcToPay: any = null;

        if (entityType === "slave") {
          npcToPay = prev.slaves.find((s) => s.id === npcId);
        } else if (entityType === "prisoner") {
          npcToPay = prev.prisoners.find((p) => p.id === npcId);
        }

        if (!npcToPay) return prev;

        const npcMaxExp = npcToPay.stats?.maxKinhNghiem || 100;
        const cost = Math.max(10, Math.floor(npcMaxExp * 0.1));

        if (prev.playerStats.currency < cost) {
          showNotification(
            `Không đủ ${prev.worldConfig?.currencyName || "Linh Thạch"} để trả lương! Cần ${cost} ${prev.worldConfig?.currencyName || "Linh Thạch"}.`,
            "error",
          );
          return prev;
        }

        const newKb = JSON.parse(JSON.stringify(prev));
        newKb.playerStats.currency -= cost;

        let targetNpc: any = null;
        if (entityType === "slave") {
          targetNpc = newKb.slaves.find((s: any) => s.id === npcId);
        } else if (entityType === "prisoner") {
          targetNpc = newKb.prisoners.find((p: any) => p.id === npcId);
        }

        if (!targetNpc) return prev;

        const currentSatisfaction = targetNpc.satisfaction !== undefined ? targetNpc.satisfaction : 100;
        targetNpc.satisfaction = Math.min(100, currentSatisfaction + 20);

        if (!targetNpc.stats) {
          targetNpc.stats = {};
        }
        if (typeof targetNpc.stats.kinhNghiem !== "number" || isNaN(targetNpc.stats.kinhNghiem)) {
          targetNpc.stats.kinhNghiem = 0;
        }
        if (typeof targetNpc.stats.maxKinhNghiem !== "number" || isNaN(targetNpc.stats.maxKinhNghiem)) {
          targetNpc.stats.maxKinhNghiem = 100;
        }

        const maxExp = targetNpc.stats.maxKinhNghiem || 100;
        const expGain = Math.round(maxExp * 0.03);
        let expNotice = "";

        if (targetNpc.isBinhCanh) {
          expNotice = " (Đang ở bình cảnh đại cảnh giới, không thể tăng kinh nghiệm)";
        } else {
          let newExp = targetNpc.stats.kinhNghiem + expGain;
          const system = getEffectiveRealmSystem(newKb);
          const { majorIndex, minorIndex } = parseRealm(targetNpc.realm || "", system);

          if (majorIndex !== -1 && minorIndex !== -1) {
            if (newExp >= maxExp) {
              if (minorIndex === system.minorRealms.length - 1) {
                targetNpc.isBinhCanh = true;
                targetNpc.binhCanhCounter = 1;
                targetNpc.stats.kinhNghiem = maxExp;
                expNotice = ` (+${expGain} exp, đạt 100% kinh nghiệm và gặp Bình Cảnh!)`;
              } else {
                newExp -= maxExp;
                const nextSubRealmName = system.minorRealms[minorIndex + 1];
                const oldRealm = targetNpc.realm;
                targetNpc.realm = `${system.majorRealms[majorIndex]} ${nextSubRealmName}`;
                
                const newBaseStats = calculateRealmBaseStats(targetNpc.realm, newKb, newKb.currentRealmBaseStats);
                targetNpc.stats = {
                  ...targetNpc.stats,
                  ...newBaseStats,
                  maxSinhLuc: newBaseStats.baseMaxSinhLuc,
                  maxLinhLuc: newBaseStats.baseMaxLinhLuc,
                  sucTanCong: newBaseStats.baseSucTanCong,
                  maxKinhNghiem: newBaseStats.baseMaxKinhNghiem,
                  kinhNghiem: newExp,
                };
                expNotice = ` (Tăng cảnh giới từ ${oldRealm} lên ${targetNpc.realm}!)`;
              }
            } else {
              targetNpc.stats.kinhNghiem = newExp;
              expNotice = ` (+${expGain} exp: ${targetNpc.stats.kinhNghiem}/${maxExp})`;
            }
          } else {
            if (newExp >= maxExp) {
              targetNpc.stats.kinhNghiem = maxExp;
              expNotice = ` (+${expGain} exp, đạt giới hạn)`;
            } else {
              targetNpc.stats.kinhNghiem = newExp;
              expNotice = ` (+${expGain} exp: ${targetNpc.stats.kinhNghiem}/${maxExp})`;
            }
          }
        }

        showNotification(
          `Đã trả ${cost} ${prev.worldConfig?.currencyName || "Linh Thạch"} lương cho ${targetNpc.name}. Thỏa mãn tăng từ ${currentSatisfaction}% lên ${targetNpc.satisfaction}%${expNotice}!`,
          "success",
        );

        return newKb;
      });
    },
    convertPrisoner: (prisonerId, targetType) => {
      setKnowledgeBase((prev) => {
        const newKb = JSON.parse(JSON.stringify(prev));
        const prisonerIndex = newKb.prisoners.findIndex(
          (p: Prisoner) => p.id === prisonerId,
        );
        if (prisonerIndex === -1) {
          showNotification(VIETNAMESE.prisonerConversionError, "error");
          return prev;
        }
        const [prisoner] = newKb.prisoners.splice(prisonerIndex, 1);

        const { resistance, ...baseData } = prisoner;

        if (targetType === "wife") {
          const newNpc: NPC = {
            ...baseData,
            relationshipToPlayer: "Vợ chồng",
            isBinhCanh: true,
            isFollowingPlayer: true,
            affinity: 100, // High affinity after accepting marriage
            personalityTraits: [],
          };
          newKb.discoveredNPCs.push(newNpc);
        } else {
          // slave
          const newSlave: Slave = {
            ...baseData,
            entityType: "slave",
            willpower: Math.min(baseData.willpower + 20, 100),
            obedience: 100,
            skills: [],
            equippedItems: {
              mainWeapon: null,
              offHandWeapon: null,
              head: null,
              body: null,
              hands: null,
              legs: null,
              artifact: null,
              pet: null,
              accessory1: null,
              accessory2: null,
            },
          };
          newKb.slaves.push(newSlave);
        }

        showNotification(
          VIETNAMESE.prisonerConverted(prisoner.name, targetType),
          "success",
        );
        return newKb;
      });
    },
    onEnterCombat,
    onFleeCombat,
    onAutoCombat,
    applyMinigameReward,
    applyRouletteResult,
    unrecognizedTags: gameActions.unrecognizedTags,
    isUnrecognizedTagsModalOpen: gameActions.isUnrecognizedTagsModalOpen,
    isRetryingTags: gameActions.isRetryingTags,
    handleIgnoreUnrecognizedTags: gameActions.handleIgnoreUnrecognizedTags,
    handleRetryUnrecognizedTags: gameActions.handleRetryUnrecognizedTags,
    isRecoveringNarration: gameActions.isRecoveringNarration,
    narrationRecoveryAction: gameActions.narrationRecoveryAction,
    handleContinueIncompleteNarration: gameActions.handleContinueIncompleteNarration,
    handleRewriteIncompleteNarration: gameActions.handleRewriteIncompleteNarration,
    handleIgnoreIncompleteNarration: gameActions.handleIgnoreIncompleteNarration,
    handleHideIncompleteNarration: gameActions.handleHideIncompleteNarration,
    handleRestoreIncompleteNarration: gameActions.handleRestoreIncompleteNarration,
    handleSelectIncompleteNarrationModel: gameActions.handleSelectIncompleteNarrationModel,
  };

  return (
    <GameContext.Provider value={contextValue}>{children}</GameContext.Provider>
  );
};
