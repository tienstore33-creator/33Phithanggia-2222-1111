export enum ApiKeySource {
  DEFAULT = 'DEFAULT',
  CUSTOM = 'CUSTOM',
}

export interface Settings {
  apiKeySource: ApiKeySource;
  customApiKeys: string[];
  currentApiKeyIndex: number;
}

export type NarrativePerspective = 'Ngôi thứ hai' | 'Ngôi thứ ba Giới hạn' | 'Ngôi thứ ba Toàn tri' | 'Nhãn Quan Toàn Tri';
export type LustModeFlavor = 'DOMINATION' | 'HARMONY' | 'SUBMISSION' | 'TEASING' | 'AI_FREESTYLE' | 'SEDUCTION' | 'RELEASE';
export type NpcMindset = 'IRON_WILL' | 'TORN_MIND' | 'PRIMAL_INSTINCT' | 'HEDONISTIC_MIND' | 'DEFAULT';
export type ViewMode = 'desktop' | 'mobile';
export type DestinyCompassMode = 'NORMAL' | 'HARSH' | 'HELLISH';

// State from the world creator screen
export interface WorldCreationState {
  genre: string;
  description: string;
  isNsfw: boolean;
  narrativePerspective: NarrativePerspective;
  character: {
    name: string;
    gender: 'Nam' | 'Nữ' | 'Tự định nghĩa';
    customGender: string;
    personality: string;
    biography: string;
    skills: string; // User's raw text input for skills
  };
}

// Represents a single ability within a skill set
export interface Ability {
  name: string;
  description: string;
}

// Represents a set of skills for the character
export interface Skill {
  name: string;
  description: string;
  abilities: Ability[];
}

export enum StatType {
  GOOD = 'GOOD',
  BAD = 'BAD',
  INJURY = 'INJURY',
  NEUTRAL = 'NEUTRAL',
  SPECIAL = 'SPECIAL', // For hidden skills, items, etc.
  NSFW = 'NSFW',
  KNOWLEDGE = 'KNOWLEDGE', // For lore, memories, understanding
}

// Represents a single character stat. The key in the CharacterStats object is the stat's unique name.
export interface CharacterStat {
  description: string; // "Bị làm sao" - What it is.
  effect: string; // "Ảnh hưởng như thế nào" - What it does.
  source: string; // "Nguồn gốc gây ra" - Where it came from.
  cure: string; // "Cách chữa trị" - How to fix it.
  type: StatType; // For categorization and UI color-coding.
  duration?: number; // "Thời gian" - How long it lasts in turns. Undefined means permanent.
}


// Represents a single stat update from the AI. 'name' will be used as the key.
export interface CharacterStatUpdate {
  name: string;
  description: string;
  effect: string;
  source: string;
  cure: string;
  type: StatType;
  duration?: number;
}

// Represents a delta update for character stats.
export interface StatChanges {
    statsToUpdate?: CharacterStatUpdate[];
    statsToDelete?: string[]; // Array of stat names to delete
}


// Dynamic stats for the character, can be updated by the AI
export interface CharacterStats {
  [key: string]: CharacterStat;
}

// Represents one turn in the game's story
export interface GameTurn {
  playerAction: string | null; // The action (choice) that led to this story text. Null for the first turn.
  storyText: string;
  choices: string[];
  tokenCount?: number; // How many tokens this turn cost
  characterExpressionId?: number;
  omniscientInterlude?: {
    title: string;
    text: string;
  }
}

// Represents a Non-Player Character
export interface NPC {
  id: string; // A unique, machine-readable ID (e.g., 'an_nac')
  name: string;
  gender: string;
  personality: string;
  relationship: string; // Relationship to the player (e.g., 'Nô lệ', 'Kẻ thù')
  status: string; // Current state (e.g., 'Bị giam giữ', 'Tự do')
  lastInteractionSummary: string; // A one-sentence summary of the last key interaction
  lastInteractionTurn?: number; // Turn number of the last interaction
  reunionCounter?: number; // Bộ đếm số lượt trôi qua không gặp/không nhắc tới NPC này
  stats?: CharacterStats; // Optional stats specific to this NPC
  isProtected?: boolean; // If true, AI is forbidden from deleting this NPC
  sortOrder?: number; // Manual sorting order
  embedding?: number[]; // Vector embedding of the NPC's core info
  pregnancy?: PregnancyData;
  history?: string[];
  locationId?: string;
  description?: string;
  race?: string;
  realm?: string;
  affinity?: number;
  relationshipToPlayer?: string;
  isPlayerZero?: boolean;
  playerZeroLog?: string[];
  deathNarrated?: boolean;
}

export interface PregnancyData {
  isPregnant: boolean;
  fatherId: string;       // ID người cha (thường là Player)
  fatherName?: string;    // Tên người cha
  currentTurn: number;    // Lượt thai kỳ hiện tại (0 -> 20)
  isRevealed: boolean;    // Đưa vào prompt công khai hay bí mật
  childGenerated: boolean;// Đánh dấu đã sinh con chưa
  conceptionTurn?: number;
  discoveredAtTurn?: number;
}

// Represents an update instruction for an NPC from the AI
export interface NPCUpdate {
    action: 'CREATE' | 'UPDATE' | 'DELETE';
    id: string; // ID of the NPC to update or delete
    // The payload for CREATE/UPDATE can contain both NPC properties and a delta of stat changes
    payload?: Partial<Omit<NPC, 'stats'>> & { statsChanges?: StatChanges };
}

// Represents the settings for the AI's behavior in-game.
export interface AiSettings {
  isLogicModeOn: boolean;
  lustModeFlavor: LustModeFlavor | null;
  npcMindset: NpcMindset;
  isConscienceModeOn: boolean;
  isStrictInterpretationOn: boolean;
  destinyCompassMode: DestinyCompassMode;
  flowOfDestinyInterval: number | null;
  currentEroticStage: number; // Thêm hằng số để theo dõi tiến trình NSFW Stage Lock
}

// Represents an entry in the turn-by-turn chronicle.
export interface ChronicleEntry {
  turnNumber: number;
  timestamp: string; // "HH:MM:SS" - For backward compatibility
  isoTimestamp?: string; // Full ISO 8601 date string for new entries
  summary: string;
  embedding?: number[]; // Vector embedding of the summary
}

export type EntityTarget = 'PLAYER' | 'ALL_NPCS' | 'PLAYER_AND_ALL_NPCS' | string; // 'string' will be an NPC ID
export type StatAction = 'DELETE' | 'REFINE' | 'RECONSTRUCT' | 'SANITIZE';
export type StatTypeGroup = 'REGULAR' | 'SPECIAL' | 'KNOWLEDGE';
export type StatScopes = {
  [key in StatTypeGroup]?: boolean;
};

export interface TagCorrection {
  id: string;
  originalTag: string;
  tagName: string;
  errorReason: string;
  suggestedFix?: string;
  status: 'PENDING' | 'FIXING' | 'RESOLVED' | 'IGNORED';
}

// The overall state of the game session
export interface GameState {
  history: GameTurn[];
  playerStats: CharacterStats;
  playerStatOrder?: string[];
  worldContext: WorldCreationState;
  npcs: NPC[];
  playerSkills: Skill[]; // Structured skills
  plotChronicle: string; // The summarized history of major plot points.
  aiSettings: AiSettings; // In-game AI behavioral settings
  chronicleHistory: ChronicleEntry[];
  turnSinceLastWorldTurn: number;
  pendingCorrections?: TagCorrection[];
}
