export enum LocationCategory {
  VILLAGE = 'Làng mạc',
  TOWN = 'Thị trấn',
  CITY = 'Thành phố',
  CAPITAL = 'Thủ đô',
  SECT = 'Tông môn/Gia tộc',
  SHOP = 'Cửa hàng',
  INN = 'Quán trọ/Tửu điếm',
  FOREST = 'Rừng rậm',
  MOUNTAIN = 'Núi non',
  CAVE = 'Hang động',
  DUNGEON = 'Hầm ngục/Bí cảnh',
  RUIN = 'Tàn tích',
  WATER = 'Sông/Hồ',
  SPECIAL = 'Địa danh đặc biệt',
  DEFAULT = 'Mặc định'
}

export enum Difficulty {
  EASY = 'EASY',
  NORMAL = 'NORMAL',
  HARD = 'HARD',
  NIGHTMARE = 'NIGHTMARE'
}

export interface DifficultyConfig {
  maxAffinityGain: number;
  npcBehaviorPrompt: string;
  narrativeBias: string;
  customInputChance: number; // NEW: Chance (0-100) to allow custom player input
}

export interface Location {
  id: string;
  name: string;
  description: string;
  category: LocationCategory;
  isSafe: boolean;
  coordinates: { x: number, y: number };
}
