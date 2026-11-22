export interface FanficCharacter {
  id?: string;
  name: string;
  gender: string;
  age: string;
  personality: string; // Tính cách
  background: string;  // Tiểu sử/Lai lịch
  appearance: string;  // Ngoại hình
  skills: string;      // Kỹ năng/Sức mạnh
  goal: string;        // Mục tiêu/Động lực
  role: string;        // Vai trò (Chính, phụ, phản diện...)
  isOfficial?: boolean;
}

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

export interface FanficLocation {
  name: string;
  description: string;
  significance: string; // Tầm quan trọng/Lịch sử
  isOfficial?: boolean;
  category: LocationCategory;
  isSafe: boolean;
}

export interface FanficFaction {
  name: string;
  description: string;
  leader: string;
  alignment: string; // Xu hướng (Chính, tà, trung lập...)
  isOfficial?: boolean;
}

export interface FanficAnalysis {
  summary: string;
  characters: FanficCharacter[];
  locations: FanficLocation[];
  factions: FanficFaction[];
  items: any[];
}

export interface FanficWork {
  id: string;
  title: string;
  description: string;
  country: string;
  plot: string;
  worldSetting: string;
  characters: FanficCharacter[];
  locations?: FanficLocation[];
  factions?: FanficFaction[];
}

export interface WorldSetupData {
  topic: string;
  worldName?: string;
  worldDescription: string;
  mainPlot: string;
  characters: FanficCharacter[];
  locations: FanficLocation[];
  factions: FanficFaction[];
  items?: any[];
  skills?: any[];
  lore?: any[];
  yeuThu?: any[];
  charPlotData?: any;
  [key: string]: any;
}
