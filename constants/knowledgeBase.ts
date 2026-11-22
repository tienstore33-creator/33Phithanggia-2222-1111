
import { KnowledgeBase } from '../types';
import { DEFAULT_PLAYER_STATS } from './character';
import { MAX_AUTO_SAVE_SLOTS } from './game';

export const INITIAL_KNOWLEDGE_BASE: KnowledgeBase = {
  playerStats: { ...DEFAULT_PLAYER_STATS },
  inventory: [],
  npcInventory: [],
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
  playerSkills: [],
  allQuests: [],
  discoveredNPCs: [],
  discoveredYeuThu: [], // New
  discoveredLocations: [],
  discoveredFactions: [],
  realmProgressionList: [],
  minorRealmProgressionList: [],
  currentRealmBaseStats: {},
  worldConfig: null,
  companions: [],
  worldLore: [],
  worldDate: { day: 1, month: 1, year: 1, timeOfDay: 'Sáng' }, 
  pageSummaries: {},
  currentPageHistory: [1],
  lastSummarizedTurn: 0,
  turnHistory: [],
  autoSaveTurnCounter: 0,
  currentAutoSaveSlotIndex: 0,
  autoSaveSlotIds: Array(MAX_AUTO_SAVE_SLOTS).fill(null),
  manualSaveId: null,
  manualSaveName: null,
  playerAvatarData: undefined,
  discoveredRegions: [],
  currentLocationId: undefined,
  auctionState: null,
  slaveAuctionState: null, // New
  pendingCombat: null,
  postCombatState: null, // NEW
  userPrompts: [], // NEW
  pendingBreakthrough: null, // NEW
  // New Entities
  prisoners: [],
  wives: [],
  slaves: [],
  combatCompanionIds: [], // NEW
  master: null,
  ragVectorStore: { vectors: [], metadata: [] }, // UPDATED: Use metadata instead of texts
  storyBible: [],
  lorebook: [],
  driftCheckLog: [],
  interactionHistory: [], // NEW
  dungeonCrawlState: null,
  huntedState: null,
  activeWorldEvent: null, // NEW: Active World Event State
  combatMode: 'offline', // NEW
  coreMemories: [], // NEW: Core Memory System
  mainQuest: null,
  milestones: {}, // NEW: Structured milestones
  worldRealmBase: "", // NEW: World Realm Progression
  currentTurnLog: [], // NEW: Initialized short-term context log
  isNsfwSceneActive: false,
  nsfwStage: 'none',
  nsfwPeakCount: 0,
  isNsfwResting: false,
  currentEroticStage: 0,
};

