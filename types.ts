
import { HarmBlockThreshold, HarmCategory } from "@google/genai";
import * as GameTemplates from './templates';

export enum GameScreen {
  Initial = 'Initial',
  GameSetup = 'GameSetup',
  Gameplay = 'Gameplay',
  Equipment = 'Equipment',
  CompanionEquipment = 'CompanionEquipment',
  Crafting = 'Crafting',
  Map = 'Map',
  Auction = 'Auction',
  SlaveAuction = 'SlaveAuction',
  Combat = 'Combat',
  Cultivation = 'Cultivation',
  CompanionManagement = 'CompanionManagement',
  PrisonerManagement = 'PrisonerManagement',
  Prompts = 'Prompts',
  ApiSettings = 'ApiSettings',
  LoadGameSelection = 'LoadGameSelection',
  StorageSettings = 'StorageSettings',
  ImportExport = 'ImportExport',
  Chatbot = 'Chatbot',
}

export type NsfwStage = 'foreplay' | 'penetration' | 'female_orgasm' | 'male_orgasm' | 'afterglow' | 'none';

export type ArcPhase = 'cooldown' | 'buildup' | 'active';

export interface TimelineEvent {
  id: string; // ID duy nhất
  periodName: string; // Tên thời đại/giai đoạn
  eventName: string; // Tên sự kiện
  description: string; // Chi tiết sự kiện ngắn gọn
  requiredAction?: string; // Hành động hoặc mục tiêu bắt buộc để sự kiện này hoàn thành
  location?: string; // Địa điểm xảy ra sự kiện
  characters?: string[]; // Nhân vật tham gia sự kiện
}

export interface NarrativeArcState {
  phase: ArcPhase;
  turnCount: number;
  targetEvent: string | null;
  questIssued: boolean; // Đánh dấu xem đã giao nhiệm vụ chưa
  originalTimelineIndex?: number; // Chỉ số sự kiện trong timeline nguyên tác đang diễn ra
  originalEventResolved?: boolean; // Đánh dấu sự kiện nguyên tác hiện tại đã kết thúc
  timelineEventStartTurn?: number; // Lượt bắt đầu mốc sự kiện hiện tại
  lastCanonNews?: string; // Tin tức sự kiện nguyên tác vừa hoàn thành gần nhất
}

export interface CultivationSummaryData {
  totalDays: number;
  currentRealm: string;
  skillsPracticed: string[];
  cultivationProgress?: number;
}

export interface BatchSummaryRequestItem {
    id: string;
    name: string;
    oldDesc: string;
    newDesc: string;
    type: 'npc' | 'wife' | 'slave' | 'prisoner' | 'master';
}

export type PlayerActionInputType = 'action' | 'story';
export type ResponseLength = 'extra-short' | 'short' | 'default' | 'medium' | 'long' | 'dialogue';

export enum EconomicZoneType {
  BLACKSMITH = 'Vũ khí & Giáp trụ',
  APOTHECARY = 'Dược phẩm & Luyện đan',
  TAVERN = 'Dịch vụ & Tửu quán',
  MARKET = 'Chợ & Giao thương',
  FACTION_STORE = 'Đặc thù Tông môn',
  GENERAL_STORE = 'Tạp hóa',
  AUCTION = 'Đấu giá',
  SLAVE_MARKET = 'Nô lệ',
  SLAVE_AUCTION = 'Đấu giá Nô lệ',
  OTHER = 'Khác'
}

export interface EconomicZoneStub {
  id: string;
  name: string;
  type: EconomicZoneType;
  description: string;
  isGenerated: boolean;
}

export type GenreType = "Tu Tiên (Mặc định)" | "Kiếm Hiệp" | "Huyền Huyễn" | "Khoa Huyễn" | "Đô Thị" | "Võng Du" | "Dị Giới" | "Mạt Thế" | "Phương Tây Fantasy" | "Kinh Dị/Tâm Linh" | "Lịch Sử/Quân Sự" | "Cung Đấu/Gia Đấu" | "Khác (Tự định nghĩa)";
export type CustomGenreType = "Khác (Tự định nghĩa)";
export const GENRE_VALUES_FOR_TYPE = ["Tu Tiên (Mặc định)", "Kiếm Hiệp", "Huyền Huyễn", "Khoa Huyễn", "Đô Thị", "Võng Du", "Dị Giới", "Mạt Thế", "Phương Tây Fantasy", "Kinh Dị/Tâm Linh", "Lịch Sử/Quân Sự", "Cung Đấu/Gia Đấu", "Khác (Tự định nghĩa)"] as const;

export type ViolenceLevel = 'Nhẹ Nhàng' | 'Thực Tế' | 'Cực Đoan';
export type StoryTone = 'Tích Cực' | 'Trung Tính' | 'Đen Tối' | 'Dâm Dục' | 'Hoang Dâm' | 'Dâm Loạn';
export type NsfwDescriptionStyle = 'Hoa Mỹ' | 'Trần Tục' | 'Gợi Cảm' | 'Mạnh Bạo (BDSM)';

export type TuChatTier = "Phế Phẩm" | "Hạ Phẩm" | "Trung Phẩm" | "Thượng Phẩm" | "Cực Phẩm" | "Tiên Phẩm" | "Thần Phẩm" | "Thánh Phẩm";
export const TU_CHAT_TIERS: TuChatTier[] = ["Phế Phẩm", "Hạ Phẩm", "Trung Phẩm", "Thượng Phẩm", "Cực Phẩm", "Tiên Phẩm", "Thần Phẩm", "Thánh Phẩm"];
export const DIALOGUE_MARKER = '##';

export type AvatarGenerationEngine = string;

export interface SafetySetting {
  category: HarmCategory;
  threshold: HarmBlockThreshold;
}

export interface CombatGraphicsConfig {
    resolutionScale: number; // 0.1 to 2.0 (e.g. 0.5 for lower res, 1.0 for normal, 2.0 for retina)
    enableVfx: boolean; // Turn on/off visual effects
    enableDamageNumbers: boolean; // Turn on/off damage numbers
    maxUnitsPerSide: number; // Max characters per side in combat (default 4, min 3, max 6)
    combatEngineMode?: 'neon_classic' | 'tang_dong_realtime';
}

export interface OfflineCombatAiConfig {
    // Shared setting
    aiLogicMode: 'simple' | 'advanced';

    // Settings for 'simple' mode
    simpleEnemyTargetPriority: 'lowestHpPercent' | 'highestAtk' | 'player' | 'ally' | 'random';
    simpleAllyTactic: 'fullAttack' | 'defensive' | 'balanced' | 'conserve';

    // Settings for 'advanced' mode
    advancedEnemyTargetPriority: 'lowestHpPercent' | 'highestAtk' | 'player' | 'ally' | 'random';
    advancedEnemyActionPriority: 'aggressive' | 'smart' | 'cautious' | 'basic';
    advancedAllyTargetPriority: 'followPlayer' | 'lowestHp' | 'highestAtk' | 'free';
    advancedAllySupportPriority: 'heal75' | 'heal50' | 'heal25' | 'focusBuff';
}

export type ApiKeySource = 'system' | 'user' | 'proxy';

export interface FallbackSettings {
  mode: 'auto' | 'custom';
  customList: string[];
  recoveryStrategy?: 'sequential' | 'last_successful';
}

export interface ApiConfig {
  apiKeySource?: ApiKeySource;
  userApiKeys: string[];
  model: string;
  economyModel: string;
  combatModel: string;
  matPhapManual?: boolean;
  // Fallbacks
  storyFallback?: FallbackSettings;
  economyFallback?: FallbackSettings;
  combatFallback?: FallbackSettings;
  
  safetySettings: SafetySetting[];
  autoGenerateNpcAvatars: boolean;
  avatarGenerationEngine: AvatarGenerationEngine;
  embeddingModel?: string;
  useDeepReasoning?: boolean;
  slowThinking?: boolean;
  isSuperManualMode?: boolean;
  ragTopK: number;
  apiTimeout?: number;
  perspectiveMode: 'firstPerson' | 'thirdPersonOmniscient';
  offlineCombatAiConfig: OfflineCombatAiConfig;
  combatGraphicsConfig?: CombatGraphicsConfig;
  architectureMode?: 'standard' | 'monolithic';
  temperature?: number;
  topK?: number;
  topP?: number;
  maxOutputTokens?: number;
  thinkingBudget?: number;
  modelThinkingLevels?: Record<string, string>;
  jsonBuffer?: number;
  pacingLevel?: 'slow' | 'normal' | 'fast';
  availableModels?: string[];
  proxyUrl?: string;
  proxyKey?: string;
  proxyModel?: string;
  proxyModels?: string[];
  proxyUrl2?: string;
  proxyKey2?: string;
  remoteCanonUrl?: string;
  useRemoteCanon?: boolean;
  aiProvider?: string;
  accessoryPrompt?: string;
  useExclusiveAccessoryPrompt?: boolean;
  exclusivePromptSections?: Record<string, boolean>;
  accessoryPresetFiles?: any[];
  useAiOath?: boolean;
}

export interface StorageSettings {
  storageType: 'local';
}

export type StorageType = 'local';

export interface WorldDate {
  day: number;
  month: number;
  year: number;
  timeOfDay: 'Sáng' | 'Chiều' | 'Đêm';
  canh?: number;
  hour?: number;
  minute?: number;
}

export interface RaceCultivationSystem {
  id: string;
  raceName: string;
  realmSystem: string;
}

export interface RealmSystem {
    majorRealms: string[];
    minorRealms: string[];
}

export interface MajorRealm {
  name: string;
  levels: number;
  description?: string;
}

export interface CultivationSystem {
  majorRealmsRaw: string;
  minorRealmsRaw: string;
  parsedMajors: MajorRealm[];
  parsedMinors: string[];
  isReady: boolean;
}

export interface WorldSettings {
  saveGameName: string;
  theme: string;
  settingDescription: string;
  writingStyle: string;
  difficulty: string;
  currencyName: string;
  playerName: string;
  originalPlayerName?: string; // NEW: Trích xuất tên gốc ban đầu của MC
  deceasedProtagonists?: string[]; // Danh sách các nhân vật chính tiền nhiệm đã tử vong (đổi góc nhìn / luân hồi)
  playerGender: 'Nam' | 'Nữ' | 'Khác';
  playerRace: string;
  playerPersonality: string;
  playerPersonalityCore?: string;
  playerBackstory: string;
  playerGoal: string;
  playerStartingTraits: string;
  playerStartingLocationType: string;
  playerSpiritualRoot?: string;
  playerSpecialPhysique?: string;
  playerThoNguyen?: number;
  playerMaxThoNguyen?: number;
  startingCurrency: number;
  startingSkills: StartingSkill[];
  startingItems: StartingItem[];
  startingNPCs: StartingNPC[];
  startingYeuThu: StartingYeuThu[];
  startingLore: StartingLore[];
  startingLocations: StartingLocation[];
  startingFactions: StartingFaction[];
  nsfwMode: boolean;
  nsfwDescriptionStyle?: NsfwDescriptionStyle;
  violenceLevel?: ViolenceLevel;
  storyTone?: StoryTone;
  originalWork?: string;
  originalStorySummary?: string;
  timelineEvents?: TimelineEvent[];
  genre: GenreType;
  customGenreName?: string;
  isCultivationEnabled: boolean;
  cultivationSystem: CultivationSystem;
  daiCanhGioi?: string[];
  tieuCanhGioi?: string[];
  raceCultivationSystems: RaceCultivationSystem[];
  yeuThuRealmSystem?: string;
  canhGioiKhoiDau: string;
  startingDate: WorldDate;
  playerAvatarUrl?: string;
  playerAvatarHairId?: number;
  playerAvatarFaceId?: number;
  initialContext?: string;
  useCauseAndEffectScenario?: boolean;
  causeAndEffectNpcCount?: number;
  storyMode?: 'worldSimulator' | 'focusedStoryteller';
  remoteCanonUrl?: string;
  Tutienhiep?: number;
  useRemoteCanon?: boolean;
  isStrictGrounding?: boolean;
  useDeepGrounding?: boolean;
  useOriginalSummary?: boolean;
}

export type EquipmentSlotId = 'mainWeapon' | 'offHandWeapon' | 'head' | 'body' | 'hands' | 'legs' | 'artifact' | 'pet' | 'accessory1' | 'accessory2';

export interface PregnancyData {
  isPregnant: boolean;
  fatherId: string;       // ID người cha (thường là Player)
  currentTurn: number;    // Lượt thai kỳ hiện tại (0 -> 20)
  isRevealed: boolean;    // Đưa vào prompt công khai hay bí mật
  childGenerated: boolean;// Đánh dấu đã sinh con chưa
  conceptionTurn?: number;
  discoveredAtTurn?: number;
  conceptionDate?: number; 
  fatherName?: string;
}

export interface PlayerSpecialStatus {
    type: 'prisoner' | 'slave';
    ownerName: string;
    willpower: number;
    resistance: number;
    obedience: number;
    fear: number;
    trust: number;
}

export interface StatusEffect {
    id: string;
    name: string;
    description: string;
    type: 'buff' | 'debuff' | 'neutral';
    durationTurns: number;
    statModifiers: Partial<PlayerStats>;
    specialEffects: string[];
    stacks?: number;
    source?: string;
    icon?: string;
}

export interface CultivationState {
  isCultivating: boolean;
  startTime: number;
  lastUpdate: number;
  autoBreakthrough: boolean;
  baseRate: number; // Linh khí cơ bản của khu vực
  bonusMultiplier: number; // Tổng % cộng thêm từ công pháp
  sessionStartExp?: number;
  sessionStartLevel?: number;
  sessionStartCurrency?: number;
  sessionStartTime?: number;
}

export interface PlayerStats {
    name?: string; // NEW: Added to prevent identity collision
    id?: string; // NEW: Added for unique identification
    originalPlayerName?: string; // NEW: Tên gốc ban đầu của nhân vật chính
    baseMaxSinhLuc: number;
    baseMaxLinhLuc: number;
    baseSucTanCong: number;
    baseMaxKinhNghiem: number;
    sinhLuc: number;
    maxSinhLuc: number;
    linhLuc: number;
    maxLinhLuc: number;
    sucTanCong: number;
    phongNgu: number;
    kinhNghiem: number;
    maxKinhNghiem: number;
    realm: string;
    currency: number;
    linhThach?: number;
    tien?: number;
    isInCombat: boolean;
    turn: number;
    hieuUngBinhCanh: boolean;
    activeStatusEffects: StatusEffect[];
    spiritualRoot?: string;
    specialPhysique?: string;
    professions: { type: string; level: number; exp: number; maxExp: number }[];
    thoNguyen?: number;
    maxThoNguyen?: number;
    playerSpecialStatus?: PlayerSpecialStatus | null;
    defeatCount?: number;
    deathCount?: number; // Đếm số lần sinh lực = 0
    forcedHardcoreRebirth?: boolean; // Cờ hiệu đánh dấu phải luân hồi đổi tên
    justHardcoreReborn?: boolean; // Cờ hiệu tạm đánh dấu vừa hồi sinh hardcore để AI đổi tên
    permanentSinhLucBonus?: number; // NEW: Persistent HP bonus from tribulation failure
    tuChat?: TuChatTier;
    Tutienhiep?: number;
    blackFlashCombo?: number;
    blackFlashMissCount?: number; // NEW: Số lượt liên tiếp hụt khi đủ điều kiện
    consecutiveSexCount: number; // NEW
    exp: number; // NEW: Trạng thái tu luyện bền vững
    level: number; // NEW: Cảnh giới (dạng số để scaling)
    cultivation: CultivationState; // NEW: Trạng thái tu luyện
    isDead?: boolean; // NEW: Trạng thái tử vong (tọa hóa)
    reincarnationPhase?: 'pending' | 'possession_ready' | 'new_mc_ready'; // NEW: Quản lý tiến trình luân hồi
    appearance?: string;
    avatarAppearance?: string;
    avatarAppearancePendingTransition?: boolean;
    appearanceDuration?: number;
    description?: string;
    currentAction?: string;
    equipmentPassives?: Record<string, number>; // NEW: Passive effects from equipment (e.g., lifesteal, crit)
    permanentBonuses?: {
        speedMult?: number;
        critChanceAdd?: number;
        shieldDurationMult?: number;
        shieldCdMult?: number;
        damageReductionAdd?: number;
        attackPowerMult?: number;
        maxHpMult?: number;
        attackSpeedMult?: number;
    };
}

// Re-exporting these so they can be used as types
export type ItemCategoryValues = GameTemplates.ItemCategoryValues;
export type CongPhapType = GameTemplates.CongPhapType;
export type CongPhapGrade = GameTemplates.CongPhapGrade;
export type LinhKiCategory = GameTemplates.LinhKiCategory;
export type LinhKiActivationType = GameTemplates.LinhKiActivationType;
export type ProfessionType = GameTemplates.ProfessionType;
export type ProfessionGrade = GameTemplates.ProfessionGrade;
export type SkillTypeValues = GameTemplates.SkillTypeValues;
export type EquipmentTypeValues = GameTemplates.EquipmentTypeValues;

export interface StartingSkill {
    name: string;
    description: string;
    skillType?: GameTemplates.SkillTypeValues;
    baseDamage?: number;
    baseHealing?: number;
    damageMultiplier?: number;
    healingMultiplier?: number;
    manaCost?: number;
    cooldown?: number;
    specialEffects?: string;
    congPhapDetails?: { type: CongPhapType; grade: CongPhapGrade; weaponFocus?: string };
    linhKiDetails?: { category: LinhKiCategory; activation: LinhKiActivationType };
    professionDetails?: { type: ProfessionType; grade: ProfessionGrade; skillDescription?: string };
    camThuatDetails?: { sideEffects?: string };
    thanThongDetails?: {};
}

export interface StartingItem {
    name: string;
    description: string;
    quantity: number;
    category: GameTemplates.ItemCategoryValues;
    rarity?: GameTemplates.EquipmentRarity;
    value?: number;
    itemRealm?: string;
    aiPreliminaryType?: string;
    equipmentDetails?: { 
        slot?: string; 
        uniqueEffectsString?: string; 
        statBonusesString?: string; 
        statBonuses?: Record<string, number>;
        bonusPercentageStats?: Record<string, number>;
        uniqueEffects?: string[];
    };
    potionDetails?: { type?: GameTemplates.PotionTypeValues; effectsString?: string; durationTurns?: number; cooldownTurns?: number };
    materialDetails?: { type?: GameTemplates.MaterialTypeValues };
    questItemDetails?: { questIdAssociated?: string };
    miscDetails?: { usable?: boolean; consumable?: boolean };
    congPhapDetails?: { congPhapType?: CongPhapType; expBonusPercentage?: number };
    linhKiDetails?: { skillToLearnJSON?: string };
    professionSkillBookDetails?: { professionToLearn?: ProfessionType };
    professionToolDetails?: { professionRequired?: ProfessionType };
}

export interface StartingNPC {
    name: string;
    personality: string;
    initialAffinity: number;
    details: string;
    gender: 'Nam' | 'Nữ' | 'Khác' | 'Không rõ';
    race?: string;
    realm?: string;
    tuChat?: TuChatTier;
    avatarUrl?: string;
    relationshipToPlayer?: string;
    spiritualRoot?: string;
    specialPhysique?: string;
    thoNguyen?: number;
    maxThoNguyen?: number;
    isOfficial?: boolean;
}

export interface StartingYeuThu {
    name: string;
    species: string;
    description: string;
    isHostile: boolean;
    realm?: string;
}

export interface StartingLore {
    title: string;
    content: string;
}

export interface StartingLocation {
    name: string;
    description: string;
    isSafeZone?: boolean;
    tags?: string[];
    regionId?: string;
    mapX?: number;
    mapY?: number;
    locationType?: GameTemplates.LocationTypeValues;
}

export interface StartingFaction {
    name: string;
    description: string;
    alignment: GameTemplates.FactionAlignmentValues;
    initialPlayerReputation: number;
}

export interface GeneratedWorldElements {
    saveGameName?: string;
    startingSkills: StartingSkill[];
    startingItems: StartingItem[];
    startingNPCs: StartingNPC[];
    startingYeuThu: StartingYeuThu[];
    startingLore: StartingLore[];
    startingLocations: StartingLocation[];
    startingFactions: StartingFaction[];
    raceCultivationSystems: RaceCultivationSystem[];
    yeuThuRealmSystem?: string;
    genre?: GenreType;
    isCultivationEnabled?: boolean;
    nsfwMode?: boolean;
    nsfwDescriptionStyle?: NsfwDescriptionStyle;
    violenceLevel?: ViolenceLevel;
    storyTone?: StoryTone;
    originalStorySummary?: string;
    timelineEvents?: TimelineEvent[];
    playerName?: string;
    playerGender?: 'Nam' | 'Nữ' | 'Khác';
    playerRace?: string;
    playerPersonality?: string;
    playerPersonalityCore?: string;
    playerBackstory?: string;
    playerGoal?: string;
    playerStartingTraits?: string;
    playerAvatarUrl?: string;
    worldTheme?: string;
    worldSettingDescription?: string;
    worldWritingStyle?: string;
    currencyName?: string;
    canhGioiKhoiDau?: string;
    customGenreName?: string;
    startingDate?: WorldDate;
    playerSpiritualRoot?: string;
    playerSpecialPhysique?: string;
    playerThoNguyen?: number;
    playerMaxThoNguyen?: number;
    startingCurrency?: number;
    difficulty?: string;
    majorRealmsRaw?: string;
    minorRealmsRaw?: string;
}

export interface NpcRelationship {
    targetId: string;
    targetName: string;
    type: string; 
    note?: string;
}

export interface PersonBase {
    id: string;
    name: string;
    title?: string;
    gender?: 'Nam' | 'Nữ' | 'Khác' | 'Không rõ';
    race?: string;
    description: string;
    history?: string[]; 
    affinity: number; 
    trust?: number; // Chỉ số niềm tin cho Game Theory (0-100)
    fear?: number;  // Chỉ số sợ hãi cho Game Theory (0-100)
    avatarUrl?: string;
    realm?: string;
    factionId?: string;
    faction?: 'enemy' | 'ally' | 'neutral';
    relationshipToPlayer?: string;
    tuChat?: TuChatTier;
    spiritualRoot?: string;
    specialPhysique?: string;
    pride?: number; // Added to PersonBase for consistency
    survivalInstinct?: string; // Added to PersonBase for consistency
    resentmentCounter?: number; // Added to PersonBase for consistency
    stats?: Partial<PlayerStats>;
    personalityTraits?: string[];
    isBinhCanh?: boolean;
    binhCanhCounter?: number;
    isFollowingPlayer?: boolean;
    locationId?: string;
    appearance?: string;
    avatarAppearance?: string;
    avatarAppearancePendingTransition?: boolean;
    appearanceDuration?: number;
    inventoryIds?: string[];
    status?: string;
    statusDuration?: number;
    inventory?: Item[]; // Deep inventory
    skills?: Skill[]; // Entity specific skills
    relationships?: NpcRelationship[]; 
    lastInteractionTurn?: number; 
    reunionCounter?: number; // Bộ đếm số lượt trôi qua không gặp/không nhắc tới NPC này
    pregnancy?: PregnancyData;
    equippedItems?: Record<string, string | null>;
    avatarHairId?: number;
    avatarFaceId?: number;
    totalSexCount?: number;
    currentSexStreak?: number;
    lastSexTurn?: number;
    isSexDissatisfied?: boolean;
}

export type Item = GameTemplates.InventoryItem;
export type Skill = GameTemplates.SkillTemplate;
export type NPC = GameTemplates.NPCTemplate;
export type YeuThu = GameTemplates.YeuThuTemplate;
export type GameLocation = GameTemplates.LocationTemplate;
export type Faction = GameTemplates.FactionTemplate;

export interface QuestObjective {
    id: string;
    text: string;
    completed: boolean;
    updatedAt?: number;
}

export interface Quest {
    id: string;
    title: string;
    description: string;
    status: 'active' | 'completed' | 'failed' | 'pending';
    objectives: QuestObjective[];
    rewardText?: string;
    punishmentText?: string;
    rewardExp?: number;
    rewardCurrency?: number;
    rewardItem?: string;
    duration?: number;
    deadlineTurn?: number;
    updatedAt?: number;
    turnsPending?: number;
    resolvedAtTurn?: number;
    type?: 'MAIN' | 'SIDE' | 'HIDDEN';
    createdTurn?: number;
    completedByCanonProtagonist?: boolean;
}

export interface WorldLoreEntry {
    id: string;
    title: string;
    content: string;
}

export interface Companion extends PersonBase {
    hp: number;
    maxHp: number;
    mana: number;
    maxMana: number;
    atk: number;
}

export interface ComplexCompanionBase extends PersonBase {
    willpower?: number;
    obedience?: number;
    skills: Skill[];
    equippedItems: Record<EquipmentSlotId, string | null>;
    status?: string;
    satisfaction?: number;
    captureReason?: string;
}

export interface Wife extends ComplexCompanionBase {
    entityType: 'wife';
}

export interface Slave extends ComplexCompanionBase {
    entityType: 'slave';
    value?: number;
}

export interface Prisoner extends ComplexCompanionBase {
    entityType: 'prisoner';
    resistance?: number;
}

export interface Master extends PersonBase {
    mood: 'Vui Vẻ' | 'Hài Lòng' | 'Bình Thường' | 'Bực Bội' | 'Giận Dữ' | 'Nghi Ngờ';
    needs: { 'Dục Vọng'?: number; 'Tham Vọng'?: number; 'An Toàn'?: number; 'Giải Trí'?: number };
    currentGoal: string;
    favor: number;
}

export type AuctionItem = Item & {
    startingPrice: number;
    currentBid: number;
    buyoutPrice: number;
    highestBidderId?: string;
    ownerId?: string;
    originalStartingPrice?: number;
    baitPriceRatio?: number;
    npcBidCount?: number;
    playerMaxBidLimit?: number;
}

export interface AuctionSlave extends Slave {
    startingPrice: number;
    currentBid: number;
    buyoutPrice: number;
    highestBidderId?: string;
    ownerId?: string;
    originalStartingPrice?: number;
    baitPriceRatio?: number;
    npcBidCount?: number;
    playerMaxBidLimit?: number;
}

export interface AuctionNPC {
    id: string;
    name: string;
    realm: string;
    currency: number;
    personality?: string;
}

export interface AuctionCommentaryEntry {
    id: string;
    text: string;
    timestamp: number;
}

export interface AuctionState {
    isOpen: boolean;
    items: (AuctionItem | AuctionSlave)[];
    auctionNPCs: AuctionNPC[];
    currentItemIndex: number;
    auctioneerCommentary: AuctionCommentaryEntry[];
    lastBidTime: number;
    auctioneerCallCount: number;
    secondCallCount?: number;
    itemExhausted?: boolean;
    locationId: string;
}

export interface DungeonCrawlState {
    isActive: boolean;
    dungeonLocationId: string;
    dungeonName: string;
    stage: 'setup' | 'entry' | 'puzzle' | 'reunion' | 'boss' | 'report';
    startTurn: number;
    objective: string;
}

export interface HuntedState {
    isActive: boolean;
    reason: string;
    lastAttackTurn: number;
}

export interface ActiveWorldEvent {
    id: string;
    type: 'DUNGEON_APPEAR'; 
    startTurn: number;
    description: string;
    locationName: string;
    hasTriggeredCutscene: boolean;
    hasTriggeredInvitation: boolean;
}

export interface CoreMemory {
    id: string;
    text: string;
    strength: number;
    turn: number;
    entityId: string;
}

export interface Milestone {
    id: string;
    description: string;
    turn: number;
}

export interface Chapter {
    id: string;
    title: string;
    objective: string;
}

export interface MainQuest {
    title: string;
    chapters: Chapter[];
    currentChapterId: string;
}

export interface VectorMetadata {
    entityId: string;
    entityType: 'npc' | 'item' | 'skill' | 'lore' | 'location' | 'quest' | 'faction' | 'yeuThu' | 'master' | 'wife' | 'slave' | 'prisoner' | 'turn';
    text: string;
    turn?: number;
}

export interface VectorStore {
    vectors: number[][];
    metadata: VectorMetadata[];
}

export type CombatMode = 'online' | 'offline';

export type AiRole = 'user' | 'model' | 'system';

export interface AiContextEntry {
    role: AiRole;
    text: string;
}

export interface RetrievalResult {
    text: string;
    score: number;
    metadata?: VectorMetadata;
}

export interface PathState {
    current: string;
    deviationScore: number;
    triggerHistory: string[];
}

export interface AnalyzedCombatant {
    id?: string;
    name: string;
    isNew: boolean;
    description?: string;
    powerLevel?: string;
    quantity?: number; // NEW: Trích xuất số lượng đối thủ
    realm?: string;             // Cảnh giới / Tu vi suy luận (VD: "Trúc Cơ Tầng 3")
    identityReasoning?: string; // Suy luận định danh (VD: "Sát thủ Huyết Môn ẩn danh")
    race?: string;              // Chủng tộc
    gender?: string;            // Giới tính
}

export interface AnalyzedParticipant {
  name: string;
  side: 'player' | 'enemy' | 'neutral';
  isNew: boolean;
  isPlural: boolean;
  originalNameInText: string;
  action: string;
  location: string;
  powerLevel?: string;
  description?: string;
}

export interface CombatAnalysisResultV2 {
  isCombat: boolean;
  rejectReason?: string; // Lý do bác bỏ ở Bước 1
  participants: AnalyzedParticipant[];
  combatReason: string; // Giải trình ở Bước 5
}

export interface FlashState {
  currentState: string;
  recentChanges: string[];
  lastUpdateTurn: number;
}

export interface StoryBibleEntry {
  id: string;
  keyword: string;
  content: string;
  priority: number; // Low number = high priority
  weight: number;   // 0-1 relevance multiplier
  sticky: boolean;  // Always include in context if true
  tags?: string[];
}

export interface LorebookEntry {
  id: string;
  keywords: string[]; // Triggers
  content: string;
  isActive: boolean;
}

// 2. Định nghĩa số phận của NPC đã chết trong Sacred Timeline
export interface DeadNPCDestiny {
  npcId: string;
  npcName: string;
  deathTurn: number; // Lượt mà NPC này thực sự chết trong Sacred Timeline
  lastQuote: string; // Câu thoại cuối cùng trước khi chết (nhắc lại y hệt ở quá khứ)
}

// 3. Định nghĩa Sổ thiên tào (Sacred Timeline)
export interface SacredTimelineRecord {
  universeId: string;
  highestTurn: number; // Lượt chơi xa nhất đã đạt tới
  destinedDeaths: Record<string, DeadNPCDestiny>; // Object map theo npcId
}

export interface KnowledgeBase {
    universeId?: string; // Định danh Vũ trụ (VD: "A-3182", "D-2741")
    lsrState?: Record<string, any[]>;
    flashState?: FlashState;
    storyBible: StoryBibleEntry[];
    lorebook: LorebookEntry[];
    driftCheckLog?: string[];
    playerStats: PlayerStats;
    inventory: Item[];
    npcInventory: Item[];
    equippedItems: Record<EquipmentSlotId, string | null>;
    playerSkills: Skill[];
    allQuests: Quest[];
    discoveredNPCs: NPC[];
    deceasedProtagonists?: string[];
    reincarnationTurn?: number; // NEW: Lượt bắt đầu của MC hiện tại để tách rời ký ức
    forgottenNPCs?: any[];
    isCustomInputAllowed?: boolean;
    discoveredYeuThu: YeuThu[];
    discoveredLocations: GameLocation[];
    discoveredFactions: Faction[];
    realmProgressionList: string[];
    minorRealmProgressionList: string[];
    currentRealmBaseStats: Record<string, RealmBaseStatDefinition>;
    worldConfig: WorldSettings | null;
    Tutienhiep?: number;
    companions: Companion[];
    worldLore: WorldLoreEntry[];
    worldDate: WorldDate;
    pageSummaries: Record<number, string>;
    currentPageHistory: number[];
    lastSummarizedTurn: number;
    turnHistory: TurnHistoryEntry[];
    autoSaveTurnCounter: number;
    currentAutoSaveSlotIndex: number;
    autoSaveSlotIds: (string | null)[];
    manualSaveId: string | null;
    manualSaveName: string | null;
    playerAvatarData?: string;
    discoveredRegions: Region[];
    ragHistoryLog?: { 
        turn: number, 
        timestamp: string, 
        content: string, 
        type?: 'retrieval' | 'vectorization' | 'flash_agent',
        richSummary?: string,
        summary?: string,
        embeddingDim?: number 
    }[];
    currentLocationId?: string;
    auctionState: AuctionState | null;
    slaveAuctionState: AuctionState | null;
    pendingCombat: { 
        opponentIds: string[]; 
        surrenderedNpcIds: string[]; 
        isDungeonBossFight?: boolean; 
        allyIds?: string[]; 
        neutralIds?: string[];
        analyzed?: boolean;
        isCombatConfirmed?: boolean;
        reasoning?: string;
        analysis?: any; // For recovery hook
        narration?: string;
        enemy?: any; // For recovery hook
        temporaryEntities?: NPC[]; // NEW: NPCs generated for this combat only
    } | null;
    postCombatState: CombatEndPayload | null;
    userPrompts: string[];
    pendingBreakthrough: { targetRealm: string; requirements: string } | null;
    prisoners: Prisoner[];
    wives: Wife[];
    slaves: Slave[];
    combatCompanionIds: string[];
    master: Master | null;
    ragVectorStore: VectorStore;
    interactionHistory: string[];
    pathState?: PathState;
    dungeonCrawlState: DungeonCrawlState | null;
    huntedState: HuntedState | null;
    activeWorldEvent: ActiveWorldEvent | null; 
    combatMode: CombatMode;
    coreMemories: CoreMemory[];
    mainQuest: MainQuest | null;
    milestones: Record<string, Milestone>;
    worldRealmBase: string;
    initialWorldRealmBase?: string; // NEW: Điểm neo khởi đầu
    lastWorldEvolutionTurn?: number; // NEW: Lượt cuối cùng thế giới tiến hóa
    isNsfwSceneActive: boolean;
    nsfwStage: NsfwStage;
    nsfwPeakCount: number;
    isNsfwResting: boolean;
    currentEroticStage: number; // Thêm hằng số để theo dõi tiến trình NSFW Stage Lock
    
    // 3. Narrative Arc State
    arcState?: NarrativeArcState;

    // 2. Trí nhớ ngắn hạn (Short-term Context) - Matches "currentTurnLog" in design
    currentTurnLog: AiContextEntry[];
    currentLocationSafetyOverride?: 'safe' | 'danger'; 
    lastSafetyAssessmentTurn?: number; 
    reunionChancePercent?: number; // Tỉ lệ phần trăm tích lũy của sự kiện tái ngộ NPC
    lastMovementPath?: { fromId: string; toId: string; timestamp: number } | null;
    battlePlusOneTurn?: number;
    pendingCorrections?: TagCorrection[];
    suggestedActions?: string[]; // Danh sách hành động gợi ý ép buộc (VD: "Đổi vai", "Đầu thai")
    lastItemUsedTurn?: number; // Lượt gần nhất sử dụng vật phẩm/kỹ năng để khống chế 1 lần/lượt
}

export interface TagCorrection {
    id: string;
    originalTag: string;
    tagName: string;
    errorReason: string;
    suggestedFix?: string;
    status: 'PENDING' | 'FIXING' | 'RESOLVED' | 'IGNORED';
}

export interface GameMessage {
    id: string;
    type: 'narration' | 'player_action' | 'system' | 'error' | 'page_summary' | 'event_summary';
    content: string;
    timestamp: number;
    choices?: AiChoice[];
    isPlayerInput?: boolean;
    turnNumber: number;
    characterExpressionId?: number; // Emotion/Expression ID (0-24)
    isEvent?: boolean;
}

export interface AiChoice {
    text: string;
    thought?: string;
}

export interface NpcChangeLog {
    name?: string;
    pride_change?: number;
    affinity_change?: number;
    resentment_change?: number;
}

export interface ParsedAiResponse {
    narration: string;
    choices: AiChoice[];
    tags: string[];
    systemMessage?: string;
    isNsfwActive?: boolean;
    nsfwStage?: NsfwStage;
    nsfwPeakCount?: number;
    isNsfwResting?: boolean;
    modelUsed?: string;
    characterExpressionId?: number; // Added for Dynamic Avatar mapping
    npcChanges?: NpcChangeLog[];
    summaryText?: string;
    reunionOccurred?: boolean;
    reunionNpcNames?: string[];
}

export interface SaveGameData {
    id?: string | number;
    name: string;
    timestamp: string | Date;
    knowledgeBase: KnowledgeBase;
    gameMessages: GameMessage[];
    appVersion: string;
}

export interface SaveGameMeta {
    id: string;
    name: string;
    timestamp: Date;
    size?: number;
    turnCount?: number;
    universeId?: string;
}

export interface TurnHistoryEntry {
    turnNumber: number;
    type: 'keyframe' | 'delta';
    knowledgeBaseSnapshot?: KnowledgeBase;
    gameMessagesSnapshot?: GameMessage[];
    knowledgeBaseDelta?: any[]; 
    gameMessagesDelta?: any[];
}

export interface StyleSettingProperty {
    fontFamily?: string;
    fontSize?: string;
    textColor?: string;
    backgroundColor?: string;
}

export type TurnResponseMode = 'standard' | 'streaming' | 'optimistic';

export type ScreenStretchMode = 'none' | 'stretch' | 'fit-uniform';

export interface StyleSettings {
    uiScale?: number;
    avatarScale?: number;
    avatarFaceScale?: number;
    screenStretchMode?: ScreenStretchMode;
    narration: StyleSettingProperty;
    playerAction: StyleSettingProperty;
    choiceButton: StyleSettingProperty;
    keywordHighlight: StyleSettingProperty;
    dialogueHighlight: StyleSettingProperty;
    turnResponseMode?: TurnResponseMode;
}

export interface EquipmentSlotConfig {
    id: EquipmentSlotId;
    labelKey: keyof typeof import('./constants/translations').VIETNAMESE_TRANSLATIONS;
    accepts: EquipmentTypeValues[];
}

export interface FindLocationParams {
    locationTypes: GameTemplates.LocationTypeValues[];
    isSafeZone: boolean | null;
    keywords: string;
    searchMethod: SearchMethod;
}

export type SearchMethod = "Hỏi Thăm Dân Địa Phương" | "Tra Cứu Cổ Tịch / Bản Đồ Cũ" | "Dùng Thần Thức / Linh Cảm" | "Đi Lang Thang Vô Định";
export const SEARCH_METHODS: SearchMethod[] = ["Hỏi Thăm Dân Địa Phương", "Tra Cứu Cổ Tịch / Bản Đồ Cũ", "Dùng Thần Thức / Linh Cảm", "Đi Lang Thang Vô Định"];

export interface CombatEndPayload {
    outcome: 'victory' | 'defeat' | 'escaped' | 'surrendered';
    summary: string;
    lastCombatTurns?: string[];
    storyContext?: string;
    finalPlayerState: PlayerStats;
    dispositions: CombatDispositionMap;
    opponentIds: string[];
    finalInventory?: Item[];
    finalNpcInventory?: Item[];
    finalAlliesStatus?: { id: string, hp: number, mp: number }[];
    finalOpponentsStatus?: { id: string, hp: number, mp: number }[];
    lastHits?: Record<string, { sourceId: string, sourceName: string }>;
    mvpDetails?: {
        id: string;
        name: string;
        damage: number;
        kills: number;
    };
    specificDefeatOutcome?: 'reincarnate' | 'prisoner' | 'released' | 'escaped';
    systemLogMessages?: string[];
}

export type CombatDisposition = 'kill' | 'capture' | 'release' | 'suicide' | 'surrender';
export type CombatDispositionMap = Record<string, CombatDisposition>;

export type ProficiencyTier = "Sơ Nhập" | "Tiểu Thành" | "Đại Thành" | "Viên Mãn" | "Xuất Thần Nhập Hóa";
export const PROFICIENCY_TIERS: ProficiencyTier[] = ["Sơ Nhập", "Tiểu Thành", "Đại Thành", "Viên Mãn", "Xuất Thần Nhập Hóa"];

export type PlayerStartingLocationType = "Ngẫu nhiên" | "Nơi An Toàn (Thành thị, Làng mạc)" | "Vùng Hoang Dã (Rừng, Núi)" | "Địa Điểm Bí Ẩn (Hang động, Tàn tích)";
export const STARTING_LOCATION_TYPES: PlayerStartingLocationType[] = ["Ngẫu nhiên", "Nơi An Toàn (Thành thị, Làng mạc)", "Vùng Hoang Dã (Rừng, Núi)", "Địa Điểm Bí Ẩn (Hang động, Tàn tích)"];

export interface Region {
    id: string;
    name: string;
    description: string;
}

export interface LocationConnection {
    targetLocationId: string;
    travelTimeTurns?: number;
    description?: string;
    isDiscovered: boolean;
    isPlayerCreated?: boolean;
}

export interface RealmBaseStatDefinition {
    hpBase: number;
    hpInc: number;
    mpBase: number;
    mpInc: number;
    atkBase: number;
    atkInc: number;
    expBase: number;
    expInc: number;
}

export type OfflineCombatEffectType = 'DAMAGE_HP' | 'HEAL_HP' | 'HEAL_MP' | 'REVIVE' | 'APPLY_STATUS' | 'DRAIN_HP' | 'CURE_STATUS' | 'STAT_DEBUFF';
export type OfflineCombatTarget = 'single_enemy' | 'all_enemies' | 'self' | 'single_ally' | 'all_allies' | 'single_dead_ally' | 'lowest_hp_ally';
export type OfflineCombatElement = 'fire' | 'ice' | 'thunder' | 'water' | 'holy' | 'dark';
export type OfflineCombatStatus = 'POISON' | 'BLIND' | 'SILENCE' | 'HASTE' | 'PROTECT' | 'SHELL' | 'SLOW' | 'SLEEP' | 'COUNTER_COOLDOWN' | 'COUNTER_SHIELD' | 'STUN';

export interface OfflineCombatEffect {
    type: OfflineCombatEffectType;
    target: OfflineCombatTarget;
    basePower?: number; // for damage/heal
    value?: number; // for fixed value items
    percentage?: number; // for revive/buffs
    element?: OfflineCombatElement;
    status?: OfflineCombatStatus;
    duration?: number;
    statuses?: OfflineCombatStatus[]; // for CURE_STATUS
    stat?: keyof PlayerStats; // for STAT_DEBUFF
}

export interface OfflineCombatItem {
    name: string;
    description: string;
    effect: OfflineCombatEffect;
}

export interface OfflineCombatSkill {
    name: string;
    description: string;
    mpCost: number;
    effect: OfflineCombatEffect;
    cooldown?: number;
}

export interface StructuredEffect {
    description: string;
}

export type Combatant = (NPC & { entityType: 'npc' }) | (YeuThu & { entityType: 'yeuThu' }) | (PlayerStats & { entityType: 'player'; id: 'player'; name: string; }) | (Wife & { entityType: 'wife' }) | (Slave & { entityType: 'slave' }) | (Prisoner & { entityType: 'prisoner' });
export type DefeatedEntity = (NPC & { entityType: 'npc' }) | (YeuThu & { entityType: 'yeuThu' });

export interface UIState {
    pendingCombatNoticeHidden: boolean;
    isChallengeModalOpen: boolean;
    isDevMode: boolean;
    isSwapping?: boolean;
    isSyncingData?: boolean;
    syncStreamingText?: string;
    lastNotifiedFallbackModel?: string;
    isExpandingMap?: boolean;
    isFlashSummaryMissingModalOpen?: boolean;
    isNormalizePowerModalOpen?: boolean;
    powerNormalizationsData?: {
        npcsToFixRealm: NPC[];
        npcsToFixStats: NPC[];
        mcNeedsFix: boolean;
        triggerAction: () => void;
        statsIssuesDetails?: { name: string; realm: string; deviantStats: string[] }[];
        realmIssuesDetails?: { name: string; realm: string }[];
        mcDeviantStats?: string[];
    } | null;
    matPhapStep?: 'waiting_extraction' | 'waiting_sync' | null;
    matPhapCtx?: any;
    isAutoSaving?: boolean;
    lastTimelineWarningTurn?: number;
    timelineWarningDismissCount?: number;
    apiErrorDetails?: { message: string; title?: string; response?: string } | null;
    retryCallback?: (() => void) | null;
    lastFlashRetryData?: {
        action: string;
        aiResponse: string;
        turn: number;
        locName: string;
        timeStr: string;
    };
    isNarrationIncompleteModalOpen?: boolean;
    incompleteNarrationData?: {
        rawText: string;
        attempt: number;
        maxAttempts: number;
        messageId: string;
        turn: number;
        selectedModel?: string;
        isMinimized?: boolean;
    } | null;
}

export interface ParsedTag {
    name: string;
    params: Record<string, string>;
}

export interface TawaModule {
    id: string;
    label: string;
    isActive: boolean;
    isCore?: boolean;
    position?: 'top' | 'system' | 'bottom' | 'final';
    order?: number;
    content: string;
    injectKey?: string;
}

export interface TawaPresetConfig {
    id?: string;
    name?: string;
    description?: string;
    cot: TawaModule;
    modules: TawaModule[];
}

export interface MonolithicWorldState {
    path_update?: {
        shift_to?: string;
        deviation_change?: number;
        trigger_event?: string;
    };
    stat_updates?: {
        name: string;
        operation: 'add' | 'subtract' | 'set';
        value: number;
        is_percentage?: boolean;
    }[];
    inventory_updates?: {
        add?: {
            name: string;
            quantity: number;
            description: string;
            category: string;
            tags?: string[];
        }[];
        remove?: {
            name: string;
            quantity: number;
        }[];
    };
    relation_updates?: {
        name: string;
        type: 'affinity' | 'loyalty' | 'fear';
        value: number;
    }[];
    quest_updates?: {
        name: string;
        description?: string;
        status?: 'active' | 'completed' | 'failed';
        objective?: string;
        log?: string;
        type?: 'MAIN' | 'SIDE' | 'HIDDEN';
    }[];
    npc_updates?: {
        id?: string;
        name: string;
        description?: string;
        personality?: string;
        thoughts?: string;
        location?: string;
        status_effect?: string;
    }[];
    location_update?: {
        name: string;
        description?: string;
    };
    time_passed?: string;
    reputation_change?: {
        amount: number;
        reason?: string;
    };
    new_memories?: string[];
    suggestions?: string[];
    combat_trigger?: {
        opponent_ids: string[];
        ally_ids?: string[];
        location?: string;
    };
    mythos_update?: {
        active: boolean;
        intensity: number;
        description: string;
    };
}

export interface VectorUpdate {
    id: string;
    type: string;
    content: string;
}

export interface TawaResponse {
    thinking: string;
    content: string;
    updateData: any;
}
