import { GeminiService } from './geminiService';
import { IntegrityManager } from '../logic/IntegrityManager';
import { GameStore } from '../store/gameStore';
import { WorldSetupData } from '../types/fanfic';
import { GeneratedWorldElements } from '../../types';
import { UnifiedExtractionService } from './unifiedExtractionService';
import { FullyUnifiedExtractionService } from './FullyUnifiedExtractionService';

export enum InitState {
  IDLE = 'IDLE',
  ANALYZING_CHARACTER = 'Đang phân tích Nhân Vật & Bối Cảnh...', // NEW
  FORMATTING_DATA = 'Đang chuẩn hóa dữ liệu (L0.5)...',
  APPLYING_INTEGRITY = 'Đang đồng bộ nguyên tác...',
  DONE = 'Hoàn tất!'
}

export class WorldInitializationService {
  static async initializeWorld(
    userInput: string, 
    onProgress: (state: InitState) => void, 
    rawContent?: string,
    onChunk?: (text: string) => void,
    useDeepGrounding: boolean = false
  ) {
    try {
      // PHASE 1 & 2 HỢP NHẤT: Trích xuất & Định dạng toàn bộ chỉ số thế giới trong ĐÚNG 1 BƯỚC DUY NHẤT
      onProgress(InitState.ANALYZING_CHARACTER);
      if (onChunk) onChunk('');
      
      const unifiedResult = await FullyUnifiedExtractionService.extractAndFormatAllInOne(
        userInput,
        rawContent || "",
        onChunk,
        useDeepGrounding
      );

      const charPlotData = unifiedResult.characterPlot || {};
      const formattedData = unifiedResult.formattedData || {};

      // PHASE 3: Integrity
      onProgress(InitState.APPLYING_INTEGRITY);
      
      // Map dữ liệu gộp sang WorldSetupData
      const setupData: WorldSetupData = {
        topic: userInput,
        worldDescription: (charPlotData.initialContext || "") + "\n\n" + (formattedData.worldSettingDescription || ""),
        mainPlot: charPlotData.goal || "", // Setup Mục tiêu vào MainPlot
        characters: formattedData.startingNPCs || [],
        locations: formattedData.startingLocations || [],
        factions: formattedData.startingFactions || [],
        items: formattedData.startingItems || [],
        skills: formattedData.startingSkills || [],
        lore: formattedData.startingLore || [],
        yeuThu: formattedData.startingYeuThu || [],
        charPlotData: charPlotData // << Gắn gói dữ liệu này vào trả về
      };

      const finalWorldSettings = IntegrityManager.enforceWorldIntegrity(setupData);

      // BƯỚC 4: Lưu Store
      GameStore.setSetup(finalWorldSettings);
      onProgress(InitState.DONE);
      
      return finalWorldSettings;
    } catch (error) {
      console.error("Lỗi khởi tạo thế giới:", error);
      throw error;
    }
  }

  private static cleanMarkdown(text: string) {
    return text.replace(/```json\n?|\n?```/g, '').trim();
  }
}

