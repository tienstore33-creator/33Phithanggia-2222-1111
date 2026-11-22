import { create } from 'zustand';
import { WorldSetupData } from '../types/fanfic';
import { LocationCategory, Location } from '../types/game';

interface GameState {
  setup: WorldSetupData | null;
  npcs: any[];
  character: {
    currentLocation: {
      name: string;
      isSafe: boolean;
      coordinates: { x: number, y: number };
    };
  };
  map: {
    locations: Location[];
    connections: { source: string, target: string }[];
  };
  setSetup: (data: WorldSetupData) => void;
  addNpc: (npc: any) => void;
  handleAIResponse: (response: any) => void;
  addConnection: (sourceId: string, targetId: string) => void;
}

export const useGameStore = create<GameState>((set) => ({
  setup: null,
  npcs: [],
  character: {
    currentLocation: {
      name: "Khởi điểm",
      isSafe: true,
      coordinates: { x: 500, y: 400 }
    }
  },
  map: {
    locations: [],
    connections: []
  },
  setSetup: (data) => {
    set({ setup: data });
    console.log("[Store] Đã cập nhật thiết lập thế giới mới.");
  },
  addConnection: (sourceId, targetId) => {
    set((state) => {
      const isExist = state.map.connections.some(c => 
        (c.source === sourceId && c.target === targetId) || 
        (c.source === targetId && c.target === sourceId)
      );
      
      if (isExist) return state;

      return {
        map: {
          ...state.map,
          connections: [...state.map.connections, { source: sourceId, target: targetId }]
        }
      };
    });
    console.log(`[Store] Đã tạo kết nối: ${sourceId} <-> ${targetId}`);
  },
  addNpc: (npc) => {
    set((state) => ({
      npcs: [...state.npcs, npc]
    }));
    console.log(`[Store] Đã thêm NPC: ${npc.name} (${npc.isOfficial ? 'Nguyên tác' : 'AI'})`);
  },
  handleAIResponse: (response) => set((state) => {
    const newState = { ...state };

    // 1. Cập nhật trạng thái an toàn hiện tại (Ép kiểu boolean an toàn)
    if (response.currentLocationStatus !== undefined) {
      newState.character.currentLocation.isSafe = !!response.currentLocationStatus.isSafe;
    }

    // 2. Xử lý địa điểm mới
    if (response.newDiscoveredLocations && Array.isArray(response.newDiscoveredLocations)) {
      response.newDiscoveredLocations.forEach(newLoc => {
        // Chống trùng lặp tên
        const exists = newState.map.locations.some(loc => loc.name.toLowerCase() === newLoc.name.toLowerCase());
        
        if (!exists) {
          // Fallback category nếu AI vẫn ngáo
          const validCategory = Object.values(LocationCategory).includes(newLoc.category) 
            ? newLoc.category 
            : LocationCategory.DEFAULT;

          // Sinh tọa độ ngẫu nhiên quanh vị trí hiện tại (bán kính 50-100px)
          const currentX = newState.character.currentLocation.coordinates.x;
          const currentY = newState.character.currentLocation.coordinates.y;
          const angle = Math.random() * Math.PI * 2;
          const radius = 50 + Math.random() * 50;

          newState.map.locations.push({
            id: `loc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: newLoc.name,
            description: newLoc.description || "",
            category: validCategory,
            isSafe: !!newLoc.isSafe,
            coordinates: {
              x: currentX + Math.cos(angle) * radius,
              y: currentY + Math.sin(angle) * radius
            }
          });
          
          // Tự động kết nối địa điểm mới với vị trí hiện tại
          const newLocId = newState.map.locations[newState.map.locations.length - 1].id;
          const currentLocName = newState.character.currentLocation.name;
          const currentLoc = newState.map.locations.find(l => l.name === currentLocName);
          
          if (currentLoc) {
             const isLinked = newState.map.connections.some(c => 
                (c.source === currentLoc.id && c.target === newLocId) || 
                (c.source === newLocId && c.target === currentLoc.id)
             );
             if (!isLinked) {
                newState.map.connections.push({ source: currentLoc.id, target: newLocId });
             }
          }
        }
      });
    }

    return newState;
  })
}));

export class GameStore {
  private static setup: WorldSetupData | null = null;
  private static npcs: any[] = [];

  static setSetup(data: WorldSetupData) {
    useGameStore.getState().setSetup(data);
  }

  static getSetup(): WorldSetupData | null {
    return useGameStore.getState().setup;
  }

  static addNpc(npc: any) {
    useGameStore.getState().addNpc(npc);
  }

  static addConnection(sourceId: string, targetId: string) {
    useGameStore.getState().addConnection(sourceId, targetId);
  }

  static getAllNpcs(): any[] {
    return useGameStore.getState().npcs;
  }
}
