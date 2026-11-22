
import { PlayerStats, RealmBaseStatDefinition, ProficiencyTier, PROFICIENCY_TIERS, TuChatTier } from '../types';

export const SUB_REALM_NAMES = ["Nhất Trọng", "Nhị Trọng", "Tam Trọng", "Tứ Trọng", "Ngũ Trọng", "Lục Trọng", "Thất Trọng", "Bát Trọng", "Cửu Trọng", "Đỉnh Phong"];

export const DEFAULT_MORTAL_STATS: Pick<PlayerStats, 'baseMaxSinhLuc' | 'baseMaxLinhLuc' | 'baseSucTanCong' | 'baseMaxKinhNghiem' | 'realm' | 'linhLuc' | 'maxLinhLuc' | 'kinhNghiem' | 'maxKinhNghiem' | 'hieuUngBinhCanh' | 'activeStatusEffects' | 'spiritualRoot' | 'specialPhysique' | 'professions' | 'thoNguyen' | 'maxThoNguyen' | 'defeatCount' | 'consecutiveSexCount' | 'exp' | 'level' | 'cultivation'> = {
  baseMaxSinhLuc: 100,
  baseMaxLinhLuc: 50,
  baseSucTanCong: 10,
  baseMaxKinhNghiem: 100,
  realm: "Người Thường",
  linhLuc: 50,
  maxLinhLuc: 50,
  kinhNghiem: 0,
  maxKinhNghiem: 100,
  hieuUngBinhCanh: false,
  activeStatusEffects: [],
  spiritualRoot: "Phàm Căn",
  specialPhysique: "Phàm Thể",
  professions: [],
  thoNguyen: 80,
  maxThoNguyen: 80,
  defeatCount: 0, // Rule 3: Initialize defeat count
  consecutiveSexCount: 0,
  exp: 0,
  level: 1,
  cultivation: {
    isCultivating: false,
    startTime: Date.now(),
    lastUpdate: Date.now(),
    autoBreakthrough: false,
    baseRate: 0.1, // Mortal has very low rate
    bonusMultiplier: 0,
  },
};

const generateTieredStats = (): RealmBaseStatDefinition[] => {
  const tiers: RealmBaseStatDefinition[] = [];
  const baseHp = 100;
  const baseMp = 50;
  const baseAtk = 3;
  const baseExp = 100;
  
  const exponent = 3.5;
  
  for (let i = 0; i < 30; i++) {
    const scale = Math.pow(i + 1, exponent);
    tiers.push({
      hpBase: Math.floor(baseHp * scale),
      hpInc: Math.floor(baseHp * scale * 0.2), // Tăng trưởng 20% mỗi tầng nhỏ
      mpBase: Math.floor(baseMp * scale),
      mpInc: Math.floor(baseMp * scale * 0.2),
      atkBase: Math.floor(baseAtk * scale),
      atkInc: Math.floor(baseAtk * scale * 0.2),
      expBase: Math.floor(baseExp * scale),
      expInc: Math.floor(baseExp * scale * 0.2),
    });
  }
  return tiers;
};

export const DEFAULT_TIERED_STATS: RealmBaseStatDefinition[] = generateTieredStats();

export const DEFAULT_PLAYER_STATS: PlayerStats = {
  baseMaxSinhLuc: 100,
  baseMaxLinhLuc: 50,
  baseSucTanCong: 10,
  baseMaxKinhNghiem: 100,
  sinhLuc: 100,
  maxSinhLuc: 100,
  linhLuc: 50,
  maxLinhLuc: 50,
  sucTanCong: 10,
  phongNgu: 0,
  kinhNghiem: 0,
  maxKinhNghiem: 100,
  realm: "Phàm Nhân Nhất Trọng",
  currency: 0,
  isInCombat: false,
  turn: 0,
  hieuUngBinhCanh: false,
  activeStatusEffects: [],
  spiritualRoot: "Chưa rõ", // New
  specialPhysique: "Chưa rõ", // New
  professions: [], // New
  thoNguyen: 120, // New
  maxThoNguyen: 120, //New
  playerSpecialStatus: null, // NEW
  defeatCount: 0, // Rule 3: Initialize defeat count
  permanentSinhLucBonus: 0, // NEW
  blackFlashCombo: 0,
  blackFlashMissCount: 0,
  consecutiveSexCount: 0,
  exp: 0,
  level: 1,
  cultivation: {
    isCultivating: false,
    startTime: Date.now(),
    lastUpdate: Date.now(),
    autoBreakthrough: false,
    baseRate: 1,
    bonusMultiplier: 0,
  },
};

export const PROFICIENCY_EXP_THRESHOLDS: Record<ProficiencyTier, number | null> = {
    "Sơ Nhập": 100,
    "Tiểu Thành": 200,
    "Đại Thành": 400,
    "Viên Mãn": 800,
    "Xuất Thần Nhập Hóa": null, // Max level
};

export const PROFICIENCY_DMG_HEAL_MULTIPLIERS: Record<ProficiencyTier, number> = {
    "Sơ Nhập": 1.0,
    "Tiểu Thành": 2.0,
    "Đại Thành": 3.0,
    "Viên Mãn": 4.0,
    "Xuất Thần Nhập Hóa": 5.0,
};

export const PROFICIENCY_COST_COOLDOWN_MULTIPLIERS: Record<ProficiencyTier, number> = {
    "Sơ Nhập": 1.0,
    "Tiểu Thành": 0.8,
    "Đại Thành": 0.6,
    "Viên Mãn": 0.4,
    "Xuất Thần Nhập Hóa": 0.2,
};

export const TU_CHAT_VALUE_MULTIPLIERS: Record<TuChatTier, number> = {
    "Phế Phẩm": 0.8,
    "Hạ Phẩm": 1.0,
    "Trung Phẩm": 1.2,
    "Thượng Phẩm": 1.5,
    "Cực Phẩm": 2.0,
    "Tiên Phẩm": 3.0,
    "Thần Phẩm": 5.0,
    "Thánh Phẩm": 10.0,
};


export const WEAPON_TYPES_FOR_VO_Y = ["Quyền", "Kiếm", "Đao", "Thương", "Côn", "Cung", "Trượng", "Phủ", "Chỉ", "Trảo", "Chưởng"] as const;
