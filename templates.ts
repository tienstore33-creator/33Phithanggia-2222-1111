
import { PlayerStats, TuChatTier, ProficiencyTier, Slave, StructuredEffect, OfflineCombatItem, OfflineCombatSkill, OfflineCombatEffect, LocationConnection, Prisoner, NpcRelationship, PregnancyData, EconomicZoneStub, EquipmentSlotId } from './types'; // PlayerStats will be defined in types.ts

export const ItemRarity = {
    PHO_THONG: "Phổ Thông", HIEM: "Hiếm", QUY_BAU: "Quý Báu", CUC_PHAM: "Cực Phẩm", THAN_THOAI: "Thần Thoại", CHI_TON: "Chí Tôn"
} as const;
export type EquipmentRarity = typeof ItemRarity[keyof typeof ItemRarity];

export const ItemCategory = {
    EQUIPMENT: "Equipment", POTION: "Potion", MATERIAL: "Material", QUEST_ITEM: "QuestItem", MISCELLANEOUS: "Miscellaneous",
    CONG_PHAP: "CongPhap", // New: Cultivation Method book/slip
    LINH_KI: "LinhKi", // New: Spirit Skill manual
    PROFESSION_SKILL_BOOK: "ProfessionSkillBook", // New: Book to learn a profession
    PROFESSION_TOOL: "ProfessionTool", // New: Tool required for a profession
} as const;
export type ItemCategoryValues = typeof ItemCategory[keyof typeof ItemCategory];

export const PotionType = { HOI_PHUC: "Hồi Phục", TANG_CUONG: "Tăng Cường", GIAI_DOC: "Giải Độc", DAC_BIET: "Đặc Biệt" } as const;
export type PotionTypeValues = typeof PotionType[keyof typeof PotionType];

export const MaterialType = { LINH_THAO: "Linh Thảo", KHOANG_THACH: "Khoáng Thạch", YEU_DAN: "Yêu Đan", DA_XUONG_YEU_THU: "Da/Xương Yêu Thú", LINH_HON: "Linh Hồn", VAT_LIEU_CHE_TAO_CHUNG: "Vật Liệu Chế Tạo Chung", KHAC: "Khác" } as const;
export type MaterialTypeValues = typeof MaterialType[keyof typeof MaterialType];

// New: Profession types
export const ProfessionType = {
    LUYEN_DAN_SU: "Luyện Đan Sư", LUYEN_KHI_SU: "Luyện Khí Sư", LUYEN_PHU_SU: "Luyện Phù Sư",
    TRAN_PHAP_SU: "Trận Pháp Sư", KHOI_LOI_SU: "Khôi Lỗi Sư", NGU_THU_SU: "Ngự Thú Sư",
    LINH_THAO_SU: "Linh Thảo Sư", THIEN_CO_SU: "Thiên Cơ Sư", DOC_SU: "Độc Sư", LINH_TRU: "Linh Trù",
    HOA_SU:"Họa Sư",
} as const;
export type ProfessionType = typeof ProfessionType[keyof typeof ProfessionType];

// New: CongPhap types
export const CongPhapType = {
    KHI_TU: "Khí Tu", // Absorbing Qi
    THE_TU: "Thể Tu", // Body Cultivation
    VO_Y: "Võ Ý", // Martial Intent
    HON_TU: "Hồn Tu", // Soul Cultivation
    THON_PHE: "Thôn Phệ", // Devouring
    SONG_TU: "Song Tu", // Dual Cultivation
    CO_TU: "Cổ Tu", // Ancient (Insect) Cultivation
    AM_LUAT_TU: "Âm Tu", // Musical Cultivation
} as const;
export type CongPhapType = typeof CongPhapType[keyof typeof CongPhapType];

export const CONG_PHAP_GRADES = ['Phàm Phẩm', 'Hoàng Phẩm', 'Huyền Phẩm', 'Địa Phẩm', 'Thiên Phẩm'] as const;
export type CongPhapGrade = typeof CONG_PHAP_GRADES[number];

export const LINH_KI_CATEGORIES = ['Tấn công', 'Phòng thủ', 'Hồi phục', 'Thân pháp', 'Khác'] as const;
export type LinhKiCategory = typeof LINH_KI_CATEGORIES[number];

export const LINH_KI_ACTIVATION_TYPES = ['Chủ động', 'Bị động'] as const;
export type LinhKiActivationType = typeof LINH_KI_ACTIVATION_TYPES[number];

export const PROFESSION_GRADES = ['Nhất phẩm', 'Nhị phẩm', 'Tam phẩm', 'Tứ phẩm', 'Ngũ phẩm', 'Lục phẩm', 'Thất phẩm', 'Bát phẩm', 'Cửu phẩm'] as const;
export type ProfessionGrade = typeof PROFESSION_GRADES[number];

export const SkillType = {
    CONG_PHAP_TU_LUYEN: "Công Pháp Tu Luyện",
    LINH_KI: "Linh Kĩ",
    NGHE_NGHIEP: "Nghề Nghiệp",
    THAN_THONG: "Thần Thông",
    CAM_THUAT: "Cấm Thuật",
    KHAC: "Khác",
} as const;
export type SkillTypeValues = typeof SkillType[keyof typeof SkillType];

export type SkillTargetType = 'Tự Thân' | 'Đồng Minh Đơn Lẻ' | 'Đồng Minh Toàn Bộ' | 'Kẻ Địch Đơn Lẻ' | 'Kẻ Địch Toàn Bộ' | 'Khu Vực';

export const FactionAlignment = { CHINH_NGHIA: 'Chính Nghĩa', TRUNG_LAP: 'Trung Lập', TA_AC: 'Tà Ác', HON_LOAN: 'Hỗn Loạn' } as const;
export type FactionAlignmentValues = typeof FactionAlignment[keyof typeof FactionAlignment];

export const LocationType = { VILLAGE: 'Làng mạc', TOWN: 'Thị trấn', CITY: 'Thành thị', CAPITAL: 'Thủ đô', SECT_CLAN: 'Tông môn/Gia tộc', FOREST: 'Rừng rậm', MOUNTAIN: 'Núi non', CAVE: 'Hang động', DUNGEON: 'Hầm ngục/Bí cảnh', RUIN: 'Tàn tích', RIVER_LAKE: 'Sông/Hồ', LANDMARK: 'Địa danh Đặc biệt (Độc lập)', DEFAULT: 'Mặc định', } as const;
export type LocationTypeValues = typeof LocationType[keyof typeof LocationType];

export const SubLocationType = { PLAZA: 'Quảng trường', GOVERNMENT_BUILDING: 'Công trình công cộng (Phủ Chúa, Toà thị chính)', TOWER: 'Tháp (Canh gác, Phép thuật)', BARRACKS: 'Doanh trại', TRAINING_GROUND: 'Luyện võ trường', LIBRARY: 'Thư viện/Tàng Kinh Các', TEMPLE: 'Đền/Miếu/Nhà thờ', GARDEN: 'Công viên/Khu vườn', GATE: 'Cổng thành', WALL: 'Tường thành', INN: 'Quán trọ/Tửu điếm', HARBOR: 'Bến cảng', THEATER: 'Nhà hát/Sân khấu', ACADEMY: 'Học viện', ALTAR: 'Bàn thờ/Tế đàn', HALL: 'Sảnh chính/Đại điện', DUNGEON_ROOM: 'Phòng trong Bí cảnh', RESIDENTIAL_AREA: 'Khu dân cư', PRISON: 'Nhà tù/Ngục tối', BRIDGE: 'Cầu', FARM: 'Nông trại', MONUMENT: 'Đài tưởng niệm/Địa danh nhỏ', OTHER: 'Khác', } as const;
export type SubLocationTypeValues = typeof SubLocationType[keyof typeof SubLocationType];

export const EconomyLocationType = { 
    SHOP: 'Cửa hàng', 
    MARKETPLACE: 'Phường Thị', 
    SHOPPING_CENTER: 'Thương Thành', 
    AUCTION_HOUSE: 'Đấu Giá Hội',
    SLAVE_MARKET: 'Chợ Nô Lệ',
    SLAVE_AUCTION: 'Đấu Giá Nô Lệ',
} as const;
export type EconomyLocationTypeValues = typeof EconomyLocationType[keyof typeof EconomyLocationType];

export type AnyLocationType = LocationTypeValues | EconomyLocationTypeValues | SubLocationTypeValues;

export const EquipmentType = {
    VU_KHI: "Vũ Khí", GIAP_DAU: "Giáp Đầu", GIAP_THAN: "Giáp Thân", GIAP_TAY: "Giáp Tay", GIAP_CHAN: "Giáp Chân", PHAP_BAO: "Pháp Bảo", THU_CUNG: "Thú Cưng", TRANG_SUC: "Trang Sức", KHIEN: "Khiên"
} as const;
export type EquipmentTypeValues = typeof EquipmentType[keyof typeof EquipmentType];

export interface BaseItemTemplate { id: string; name: string; description: string; category: ItemCategoryValues; rarity: EquipmentRarity; value?: number; icon?: string; stackable?: boolean; maxStack?: number; quantity: number; itemRealm?: string; ownerId?: string; }
export interface EquipmentTemplate extends BaseItemTemplate { 
    category: typeof ItemCategory.EQUIPMENT; 
    slot: EquipmentSlotId; 
    equipmentType?: EquipmentTypeValues; 
    statBonuses: Partial<Omit<PlayerStats, 'realm' | 'currency' | 'isInCombat' | 'turn' | 'hieuUngBinhCanh' | 'baseMaxKinhNghiem' | 'baseMaxLinhLuc' | 'baseMaxSinhLuc' | 'baseSucTanCong' | 'activeStatusEffects' | 'sinhLuc' | 'linhLuc' | 'kinhNghiem' | 'spiritualRoot' | 'specialPhysique' | 'professions'>>; 
    bonusPercentageStats?: Record<string, number>; 
    uniqueEffects: string[]; 
    durability?: number; 
    maxDurability?: number; 
    levelRequirement?: number; 
    usable?: boolean; 
    consumable?: boolean; 
    upgradeLevel?: number; // NEW: (+X)
    rank?: string; // NEW: Realm rank for upgrading (e.g. "Luyện Khí", "Trúc Cơ")
    rankLevel?: number; // NEW: Numerical representation of rank for comparison
}
export interface PotionTemplate extends BaseItemTemplate { category: typeof ItemCategory.POTION; potionType: PotionTypeValues; effects: string[]; structuredEffects?: StructuredEffect[]; durationTurns?: number; isConsumedOnUse: true; cooldownTurns?: number; usable: true; consumable: true; effect?: OfflineCombatEffect; statBonuses?: Partial<Omit<PlayerStats, 'realm' | 'currency' | 'isInCombat' | 'turn' | 'hieuUngBinhCanh' | 'activeStatusEffects'>>; }
export interface MaterialTemplate extends BaseItemTemplate { category: typeof ItemCategory.MATERIAL; materialType: MaterialTypeValues; usable: false; consumable: false; }
export interface QuestItemTemplate extends BaseItemTemplate { category: typeof ItemCategory.QUEST_ITEM; questIdAssociated: string; isConsumedOnQuestCompletion?: boolean; usable: false; consumable: false; }
export interface MiscellaneousItemTemplate extends BaseItemTemplate { category: typeof ItemCategory.MISCELLANEOUS; usable: boolean; consumable: boolean; }

// --- New Item Templates ---
export interface CongPhapTemplate extends BaseItemTemplate { category: typeof ItemCategory.CONG_PHAP; congPhapType: CongPhapType; expBonusPercentage: number; }
export interface LinhKiTemplate extends BaseItemTemplate { category: typeof ItemCategory.LINH_KI; skillToLearnJSON: string; } // JSON string of a skill to be parsed
export interface ProfessionSkillBookTemplate extends BaseItemTemplate { category: typeof ItemCategory.PROFESSION_SKILL_BOOK; professionToLearn: ProfessionType; }
export interface ProfessionToolTemplate extends BaseItemTemplate { category: typeof ItemCategory.PROFESSION_TOOL; professionRequired: ProfessionType; }
// --- End New Item Templates ---

export type InventoryItem = EquipmentTemplate | PotionTemplate | MaterialTemplate | QuestItemTemplate | MiscellaneousItemTemplate | CongPhapTemplate | LinhKiTemplate | ProfessionSkillBookTemplate | ProfessionToolTemplate;

export interface NPCTemplate {
    id: string; name: string; title?: string; gender?: 'Nam' | 'Nữ' | 'Khác' | 'Không rõ'; race?: string; description: string; personalityTraits?: string[]; affinity: number; factionId?: string; avatarUrl?: string; relationshipToPlayer?: string; realm?: string; tuChat?: TuChatTier;
    spiritualRoot?: string; // New
    specialPhysique?: string; // New
    pride?: number; // Hide from user, 0-100 Lòng tự tôn
    survivalInstinct?: string; // Hide from user, bản năng sinh tồn
    resentmentCounter?: number; // Hide from user, đếm số lần bị nhục nhã
    isBinhCanh?: boolean; binhCanhCounter?: number; baseStatOverrides?: Partial<Pick<PlayerStats, 'baseMaxSinhLuc' | 'baseMaxLinhLuc' | 'baseSucTanCong' | 'baseMaxKinhNghiem'>>; stats?: Partial<PlayerStats>; 
    skills?: SkillTemplate[]; // Changed to SkillTemplate[]
    inventoryIds?: string[];
    inventory?: InventoryItem[];
    vendorType?: 'MarketStall' | 'SpecializedShop' | 'Auctioneer' | 'SlaveTrader'; vendorSlogan?: string; vendorBuysCategories?: ItemCategoryValues[]; 
    shopInventory?: InventoryItem[];
    slavesForSale?: Slave[]; // New
    prisonersForSale?: Prisoner[]; // New
    lastRestockYear?: number;
    isEssential?: boolean; locationId?: string; level?: number;
    history?: string[]; // New: to track past descriptions/events
    isFollowingPlayer?: boolean; // New: If true, the NPC moves with the player
    appearance?: string;
    avatarAppearance?: string;
    avatarAppearancePendingTransition?: boolean;
    appearanceDuration?: number;
    isNewlyGenerated?: boolean; // NEW: To track if NPC was just created
    relationships?: NpcRelationship[]; // NEW: Add relationships field to NPCTemplate
    currentGoal?: string; // NEW: AI NPC Life Goal
    pregnancy?: PregnancyData;
    avatarHairId?: number; // Added for Dynamic Avatar
    avatarFaceId?: number;
    /* @FIX: Added lastInteractionTurn property to resolve TypeScript errors in prompt generation and NPC processing. */
    lastInteractionTurn?: number; // NEW
    reunionCounter?: number; // Bộ đếm số lượt trôi qua không gặp/không nhắc tới NPC này
    equippedItems?: Record<string, string | null>;
    status?: string;
    statusDuration?: number; // NEW
    isDead?: boolean;
    deathNarrated?: boolean;
    personality?: string;
    isPlayerZero?: boolean;
    playerZeroLog?: string[];
    playerZeroTargetId?: string;
    playerZeroTargetType?: 'player' | 'npc' | 'beast';
    playerZeroTargetName?: string;
    playerZeroActionType?: 'combat' | 'interaction';
}

// New YeuThuTemplate
export interface YeuThuTemplate {
    id: string;
    name: string;
    species: string; // e.g., Hỏa Lang, Băng Giao Long
    description: string;
    isHostile: boolean;
    avatarUrl?: string;
    avatarHairId?: number; // Added for Dynamic Avatar
    avatarFaceId?: number;
    realm?: string;
    stats?: Partial<PlayerStats>;
    skills?: SkillTemplate[]; // Changed to SkillTemplate[]
    lootTable?: Array<{ itemId: string, dropChance: number, minQuantity: number, maxQuantity: number }>; // For drops after combat
    locationId?: string; // Where it can be found
    isDead?: boolean;
    deathNarrated?: boolean;
}

export interface SkillTemplate {
    id: string; name: string; description: string; skillType: SkillTypeValues; detailedEffect: string; icon?: string; manaCost: number; damageMultiplier: number; baseDamage: number; healingAmount: number; healingMultiplier: number;
    ownerId?: string;
    buffsApplied?: Array<{ stat: keyof PlayerStats | string; amount: number | string; durationTurns: number; chance?: number }>;
    debuffsApplied?: Array<{ stat: keyof PlayerStats | string; amount: number | string; durationTurns: number; chance?: number }>;
    otherEffects?: string[]; targetType?: SkillTargetType; cooldown?: number; currentCooldown?: number; levelRequirement?: number;
    requiredRealm?: string; prerequisiteSkillId?: string; isUltimate?: boolean; xpGainOnUse?: number;
    proficiency?: number; // New: Current proficiency EXP
    maxProficiency?: number; // New: EXP needed for next tier
    proficiencyTier?: ProficiencyTier; // New: The current proficiency tier
    // Add details from StartingSkill
    congPhapDetails?: {
        type?: CongPhapType;
        grade?: CongPhapGrade;
        weaponFocus?: string;
    };
    linhKiDetails?: {
        category?: LinhKiCategory;
        activation?: LinhKiActivationType;
    };
    professionDetails?: {
        type?: ProfessionType;
        grade?: ProfessionGrade;
        skillDescription?: string;
    };
    camThuatDetails?: { 
        sideEffects?: string;
    };
    thanThongDetails?: {
        // Future properties can go here
    };
    effect?: OfflineCombatEffect;
    // New properties for Skill Transformation
    isCombatUsable?: boolean;
    isTransformable?: boolean;
    isTransformed?: boolean;
    transformedAt?: number;
    coreSkillName?: string;
    tier?: number; // Added tier for balancing
    level?: number; // Added level for transformation logic
    exp?: number; // Added exp for transformation logic
}

export interface LocationTemplate { id: string; name: string; description: string; mapIcon?: string; regionId?: string; parentLocationId?: string; travelConnections?: Record<string, { locationId: string; travelTimeTurns?: number; requirements?: string }>; discoverableNPCIds?: string[]; discoverableItemIds?: string[]; resourceNodes?: Array<{ materialId: string; quantityRange: [number, number]; respawnTimeTurns?: number; toolRequired?: string }>; isSafeZone?: boolean; tags?: string[]; environmentalEffects?: string[]; ambientSound?: string; requiredLevel?: number; requiredQuestIdForEntry?: string; visited?: boolean; locationType?: AnyLocationType; mapX?: number; mapY?: number; connections?: LocationConnection[]; isTemporary?: boolean; isHidden?: boolean; economicZones?: EconomicZoneStub[]; }
export interface FactionTemplate { id: string; name: string; description: string; bannerIcon?: string; leaderNPCId?: string; keyNPCIds?: string[]; baseLocationId?: string; alliedFactionIds?: string[]; enemyFactionIds?: string[]; alignment: FactionAlignmentValues; playerReputation: number; reputationTiers?: Record<string, { threshold: number; title: string; benefits?: string[] }>; ranks?: Array<{ rankName: string; reputationRequired: number; benefits?: string[] }>; }

// --- NEW: OFFLINE COMBAT ITEM & SKILL LISTS ---
export const COMBAT_MODE_ITEMS: readonly OfflineCombatItem[] = [
    { name: "combat Hồi Khí Đan", description: "Hồi 200 HP cho một mục tiêu.", effect: { type: 'HEAL_HP', value: 200, target: 'single_ally' } },
    { name: "combat Đại Hồi Khí Đan", description: "Hồi 1000 HP cho một mục tiêu.", effect: { type: 'HEAL_HP', value: 1000, target: 'single_ally' } },
    { name: "combat Cực Phẩm Hồi Khí Đan", description: "Hồi đầy HP cho một mục tiêu.", effect: { type: 'HEAL_HP', value: 99999, target: 'single_ally' } },
    { name: "combat Phượng Hoàng Lệ", description: "Hồi sinh một đồng minh đã gục ngã với 25% HP.", effect: { type: 'REVIVE', percentage: 25, target: 'single_dead_ally' } },
    { name: "combat Hồi Linh Tán", description: "Hồi 100 MP cho một mục tiêu.", effect: { type: 'HEAL_MP', value: 100, target: 'single_ally' } },
    { name: "combat Tịnh Trần Đan", description: "Chữa trị các trạng thái bất lợi (Độc, Mù, Câm lặng, Choáng) cho một mục tiêu.", effect: { type: 'CURE_STATUS', statuses: ['POISON', 'BLIND', 'SILENCE', 'STUN'], target: 'single_ally' } },
    { name: "combat Lôi Hỏa Châu", description: "Gây 150 sát thương vật lý cho tất cả kẻ địch.", effect: { type: 'DAMAGE_HP', value: 150, target: 'all_enemies' } },
    { name: "combat Vạn Linh Dịch", description: "Hồi 500 HP và chữa trị trạng thái bất lợi cho toàn bộ phe ta.", effect: { type: 'HEAL_HP', value: 500, target: 'all_allies' } },
    { name: "combat Độc Dược", description: "Ném vào kẻ địch để gây hiệu ứng Độc trong 3 lượt.", effect: { type: 'APPLY_STATUS', status: 'POISON', duration: 3, target: 'single_enemy' } },
    { name: "combat Thiết Bì Tán", description: "Tăng phòng thủ vật lý cho một đồng minh trong 3 lượt.", effect: { type: 'APPLY_STATUS', status: 'PROTECT', duration: 3, target: 'single_ally' } },
] as const;

export const COMBAT_MODE_SKILLS: readonly OfflineCombatSkill[] = [
    // Black Magic (Offensive)
    { name: "combat Chém Chém", description: "Lướt 300 khoảng cách, chém liên hoàn 2 lần lên mục tiêu.", mpCost: 5, effect: { type: 'DAMAGE_HP', basePower: 30, target: 'single_enemy' } },
    { name: "combat Hỏa Cầu Thuật", description: "Gây sát thương lửa yếu lên một kẻ địch.", mpCost: 5, effect: { type: 'DAMAGE_HP', basePower: 30, element: 'fire', target: 'single_enemy' } },
    { name: "combat Viêm Bạo Thuật", description: "Gây sát thương lửa vừa lên một kẻ địch.", mpCost: 12, effect: { type: 'DAMAGE_HP', basePower: 75, element: 'fire', target: 'single_enemy' } },
    { name: "combat Liệt Hỏa Phần Thiên", description: "Gây sát thương lửa mạnh lên tất cả kẻ địch (Rơi từ trên cao AoE 200px, DoT thiêu đốt 5s, Hồi 15s).", mpCost: 25, effect: { type: 'DAMAGE_HP', basePower: 110, element: 'fire', target: 'all_enemies' }, cooldown: 15 },
    { name: "combat Băng Phong Châm", description: "Gây sát thương băng yếu lên một kẻ địch.", mpCost: 5, effect: { type: 'DAMAGE_HP', basePower: 30, element: 'ice', target: 'single_enemy' } },
    { name: "combat Hàn Băng Kích", description: "Gây sát thương băng vừa lên một kẻ địch.", mpCost: 12, effect: { type: 'DAMAGE_HP', basePower: 75, element: 'ice', target: 'single_enemy' } },
    { name: "combat Băng Hoàng Phá", description: "Gây sát thương băng mạnh lên tất cả kẻ địch (Xuyên mọi vật thể, giảm tốc 30% trong 3s, Hồi 15s).", mpCost: 25, effect: { type: 'DAMAGE_HP', basePower: 110, element: 'ice', target: 'all_enemies' }, cooldown: 15 },
    { name: "combat Lạc Lôi Thuật", description: "Gây sát thương sét yếu lên một kẻ địch.", mpCost: 5, effect: { type: 'DAMAGE_HP', basePower: 30, element: 'thunder', target: 'single_enemy' } },
    { name: "combat Cuồng Lôi Chú", description: "Gây sát thương sét vừa lên một kẻ địch.", mpCost: 12, effect: { type: 'DAMAGE_HP', basePower: 75, element: 'thunder', target: 'single_enemy' } },
    { name: "combat Lôi Long Giáng Thế", description: "Gây sát thương sét mạnh lên tất cả kẻ địch (Vòng xoáy lôi triều xoáy vào 200px rồi xoay quanh caster 2s, Hồi 15s).", mpCost: 25, effect: { type: 'DAMAGE_HP', basePower: 110, element: 'thunder', target: 'all_enemies' }, cooldown: 15 },
    { name: "combat Hấp Huyết Thuật", description: "Hút một lượng HP từ kẻ địch.", mpCost: 15, effect: { type: 'DRAIN_HP', basePower: 50, target: 'single_enemy' } },
    { name: "combat Hút Máu Thuật", description: "Hút một lượng HP nhỏ từ kẻ địch.", mpCost: 8, effect: { type: 'DRAIN_HP', basePower: 25, target: 'single_enemy' } },
    
    // White Magic (Support/Healing)
    { name: "combat Trị Liệu Thuật", description: "Hồi phục vết thương nhẹ cho đồng minh.", mpCost: 10, effect: { type: 'HEAL_HP', basePower: 60, target: 'single_ally' } },
    { name: "combat Đại Trị Liệu Thuật", description: "Hồi phục một lượng lớn HP cho đồng minh.", mpCost: 20, effect: { type: 'HEAL_HP', basePower: 150, target: 'single_ally' } },
    { name: "combat Từ Hàng Phổ Độ", description: "Hồi phục HP cho toàn bộ đồng minh trong khu vực.", mpCost: 35, effect: { type: 'HEAL_HP', basePower: 200, target: 'all_allies' } },
    
    // Status & Buffs
    { name: "combat Kim Cang Hộ Thể", description: "Tăng phòng thủ vật lý cho một đồng minh.", mpCost: 15, effect: { type: 'APPLY_STATUS', status: 'PROTECT', duration: 5, target: 'single_ally' } },
    { name: "combat Linh Thuẫn Thuật", description: "Tăng phòng thủ phép thuật cho một đồng minh.", mpCost: 15, effect: { type: 'APPLY_STATUS', status: 'SHELL', duration: 5, target: 'single_ally' } },
    { name: "combat Thần Hành Phù", description: "Tăng tốc độ di chuyển cho đồng minh.", mpCost: 12, effect: { type: 'APPLY_STATUS', status: 'HASTE', duration: 5, target: 'single_ally' } },
    
    // Debuffs & Crowd Control
    { name: "combat Trì Hoãn Chú", description: "Làm chậm tốc độ của kẻ địch.", mpCost: 10, effect: { type: 'APPLY_STATUS', status: 'SLOW', duration: 5, target: 'single_enemy' } },
    { name: "combat Thi Độc Chú", description: "Khiến kẻ địch bị trúng độc liên tục.", mpCost: 12, effect: { type: 'APPLY_STATUS', status: 'POISON', duration: 8, target: 'single_enemy' } },
    { name: "combat Điểm Huyệt Thuật", description: "Gây choáng khiến đối thủ bất động.", mpCost: 20, effect: { type: 'APPLY_STATUS', status: 'STUN', duration: 2, target: 'single_enemy' } },
    { name: "combat Phá Giáp Kích", description: "Triệu hồi hư ảnh Cự Búa gõ liên tiếp 3 lần hình quạt rộng gây sát thương AoE và làm choáng kẻ địch 2s.", mpCost: 12, effect: { type: 'DAMAGE_HP', basePower: 120, target: 'all_enemies' } },
    { name: "combat Triệu Hồi Thuật", description: "Triệu hồi 2 đệ tử cận chiến có sát thương và Máu bằng 1/4 người thi triển.", mpCost: 15, effect: { type: 'DAMAGE_HP', basePower: 0, target: 'single_enemy' } },
    { name: "combat Bom Vĩ Thú", description: "Tụ lực 5 giây nén năng lượng Âm Dương, bắn ra quả cầu Vĩ Thú nổ hình nấm bán kính 250px gây sát thương hủy diệt.", mpCost: 50, effect: { type: 'DAMAGE_HP', basePower: 500, element: 'fire', target: 'all_enemies' } },
] as const;

export const SKILL_TEMPLATES: SkillTemplate[] = [
    {
        id: 'template_chem_chem',
        name: 'Chém Chém',
        description: 'Lướt 300 khoảng cách, chém 2 lần liên tiếp.',
        skillType: SkillType.LINH_KI,
        detailedEffect: 'Người thi triển sẽ lướt nhanh đến phía trước 300 khoảng cách rồi tấn công một lần với hiệu ứng chém, sau 0.1s thì tấn công một lần với hiệu ứng chém tiếp.',
        manaCost: 10,
        damageMultiplier: 1.0,
        baseDamage: 30,
        healingAmount: 0,
        healingMultiplier: 0,
        effect: { type: 'DAMAGE_HP', basePower: 30, target: 'single_enemy' },
        tier: 1
    },
    {
        id: 'template_fire_ball',
        name: 'Hỏa Cầu Thuật',
        description: 'Gây sát thương lửa lên một kẻ địch.',
        skillType: SkillType.LINH_KI,
        detailedEffect: 'Tập trung linh lực tạo thành hỏa cầu tấn công đối phương.',
        manaCost: 10,
        damageMultiplier: 1.2,
        baseDamage: 50,
        healingAmount: 0,
        healingMultiplier: 0,
        effect: { type: 'DAMAGE_HP', basePower: 50, element: 'fire', target: 'single_enemy' },
        tier: 1
    },
    {
        id: 'template_ice_spike',
        name: 'Băng Phong Châm',
        description: 'Gây sát thương băng lên một kẻ địch.',
        skillType: SkillType.LINH_KI,
        detailedEffect: 'Ngưng tụ hơi nước thành băng châm sắc nhọn.',
        manaCost: 10,
        damageMultiplier: 1.1,
        baseDamage: 45,
        healingAmount: 0,
        healingMultiplier: 0,
        effect: { type: 'DAMAGE_HP', basePower: 45, element: 'ice', target: 'single_enemy' },
        tier: 1
    },
    {
        id: 'template_heal_light',
        name: 'Trị Liệu Thuật',
        description: 'Hồi phục vết thương nhẹ.',
        skillType: SkillType.LINH_KI,
        detailedEffect: 'Sử dụng linh lực dịu nhẹ để chữa lành vết thương.',
        manaCost: 15,
        damageMultiplier: 0,
        baseDamage: 0,
        healingAmount: 60,
        healingMultiplier: 1.2,
        effect: { type: 'HEAL_HP', basePower: 60, target: 'single_ally' },
        tier: 1
    },
    {
        id: 'template_thunder_strike',
        name: 'Lạc Lôi Thuật',
        description: 'Triệu hồi sấm sét tấn công kẻ địch.',
        skillType: SkillType.THAN_THONG,
        detailedEffect: 'Mượn sức mạnh thiên lôi để trừng phạt kẻ thù.',
        manaCost: 25,
        damageMultiplier: 1.5,
        baseDamage: 100,
        healingAmount: 0,
        healingMultiplier: 0,
        effect: { type: 'DAMAGE_HP', basePower: 100, element: 'thunder', target: 'single_enemy' },
        tier: 2
    },
    {
        id: 'template_summon_thrall',
        name: 'Triệu Hồi Thuật',
        description: 'Triệu hồi 2 đệ tử cận chiến hỗ trợ chiến đấu.',
        skillType: SkillType.LINH_KI,
        detailedEffect: 'Triệu hồi ra 2 NPC đệ tử cận chiến hỗ trợ chiến đấu, có sát thương và máu bằng 1/4 người thi triển.',
        manaCost: 15,
        damageMultiplier: 0,
        baseDamage: 0,
        healingAmount: 0,
        healingMultiplier: 0,
        effect: { type: 'DAMAGE_HP', basePower: 0, target: 'single_enemy' },
        tier: 1
    }
];
