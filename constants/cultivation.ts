import { RealmSystem } from '../types';
import { SUB_REALM_NAMES } from './character';

export const ALL_REALMS_LIST = [
    "Phàm Nhân",
    ...["Luyện Khí", "Trúc Cơ", "Kim Đan", "Nguyên Anh", "Hóa Thần", "Luyện Hư", "Hợp Thể", "Đại Thừa", "Độ Kiếp"].flatMap(major => 
        SUB_REALM_NAMES.map(minor => `${major} ${minor}`)
    )
];

export const GAME_CONSTANTS = {
  BASE_COST: 50,  // Tiền cần đột phá cấp 1
  BASE_GAIN: 2,   // Exp nhận được mỗi tick cấp 1
  
  COST_SCALING: 1.6, 
  GAIN_SCALING: 1.15,
  
  TICK_RATE: 1000,
  OFFLINE_CAP: 24 * 60 * 60 * 1000, 
};

export const GENERIC_REALM_SYSTEM: RealmSystem = {
    majorRealms: Array.from({ length: 12 }, (_, i) => `Cảnh giới thứ ${i + 1}`),
    minorRealms: Array.from({ length: 10 }, (_, i) => `${i + 1} Tầng`)
};
