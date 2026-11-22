import { FanficSourceService } from '../services/fanficSourceService';
import { WorldSetupData, FanficCharacter } from '../types/fanfic';

export class IntegrityManager {
  
  /**
   * Chuẩn hóa chuỗi để so sánh chính xác hơn (Unicode NFC, trim, lowercase)
   */
  private static normalize(str: string | undefined | null): string {
    if (!str) return '';
    return str.normalize('NFC').trim().toLowerCase();
  }

  /**
   * Ghi đè thiết lập thế giới dựa trên file nguồn
   */
  static enforceWorldIntegrity(aiGeneratedSetup: WorldSetupData): WorldSetupData {
    const workTitle = aiGeneratedSetup.worldName || aiGeneratedSetup.topic;
    const officialWork = FanficSourceService.findWorkByTitle(workTitle);

    if (!officialWork) return aiGeneratedSetup;

    console.log(`[Integrity] Đồng bộ hóa nguyên tác: ${officialWork.title}`);

    const result = { ...aiGeneratedSetup };

    // 1. Ghi đè thông tin thế giới
    result.topic = officialWork.title;
    result.worldDescription = officialWork.worldSetting;
    result.mainPlot = officialWork.plot;

    // 2. Ghi đè và thêm nhân vật
    if (result.characters && Array.isArray(result.characters)) {
      result.characters = result.characters.map(char => {
        const officialChar = FanficSourceService.findCharacterInWork(officialWork, char.name);
        if (officialChar) {
          return {
            ...char,
            name: officialChar.name,
            gender: officialChar.gender || char.gender,
            age: officialChar.age || char.age,
            personality: officialChar.personality || (char as any).personality || "",
            background: (officialChar as any).description || (char as any).background || "",
            appearance: (officialChar as any).appearance || (char as any).appearance || "",
            skills: (officialChar as any).skills || (char as any).skills || "",
            goal: (officialChar as any).goal || (char as any).goal || "",
            role: officialChar.role || char.role,
            isOfficial: true
          };
        }
        return char;
      });

      // Thêm nhân vật từ file nguồn nếu chưa có
      if (officialWork.characters) {
        officialWork.characters.forEach(officialChar => {
          const exists = result.characters.find(c => this.normalize(c.name) === this.normalize(officialChar.name));
          if (!exists) {
            result.characters.push({
              name: officialChar.name,
              gender: officialChar.gender || "Không rõ",
              age: officialChar.age || "Không rõ",
              personality: officialChar.personality || "",
              background: (officialChar as any).description || "",
              appearance: (officialChar as any).appearance || "",
              skills: (officialChar as any).skills || "",
              goal: (officialChar as any).goal || "",
              role: officialChar.role || "Phụ",
              isOfficial: true
            });
          }
        });
      }
    } else if (officialWork.characters) {
        result.characters = officialWork.characters.map(officialChar => ({
              name: officialChar.name,
              gender: officialChar.gender || "Không rõ",
              age: officialChar.age || "Không rõ",
              personality: officialChar.personality || "",
              background: (officialChar as any).description || "",
              appearance: (officialChar as any).appearance || "",
              skills: (officialChar as any).skills || "",
              goal: (officialChar as any).goal || "",
              role: officialChar.role || "Phụ",
              isOfficial: true
        }));
    }

    // 3. Ghi đè và thêm địa điểm (nếu có trong file nguồn)
    if (officialWork.locations) {
      if (result.locations) {
        result.locations = result.locations.map(loc => {
          const officialLoc = officialWork.locations?.find(ol => this.normalize(ol.name) === this.normalize(loc.name));
          if (officialLoc) {
            return { ...loc, ...officialLoc, isOfficial: true };
          }
          return loc;
        });

        officialWork.locations.forEach(officialLoc => {
            const exists = result.locations.find(l => this.normalize(l.name) === this.normalize(officialLoc.name));
            if (!exists) {
                result.locations.push({ ...officialLoc, isOfficial: true });
            }
        });
      } else {
          result.locations = officialWork.locations.map(loc => ({ ...loc, isOfficial: true }));
      }
    }

    // 4. Ghi đè và thêm phe phái (nếu có trong file nguồn)
    if (officialWork.factions) {
      if (result.factions) {
        result.factions = result.factions.map(fac => {
          const officialFac = officialWork.factions?.find(of => this.normalize(of.name) === this.normalize(fac.name));
          if (officialFac) {
            return { ...fac, ...officialFac, isOfficial: true };
          }
          return fac;
        });

        officialWork.factions.forEach(officialFac => {
            const exists = result.factions.find(f => this.normalize(f.name) === this.normalize(officialFac.name));
            if (!exists) {
                result.factions.push({ ...officialFac, isOfficial: true });
            }
        });
      } else {
          result.factions = officialWork.factions.map(fac => ({ ...fac, isOfficial: true }));
      }
    }

    return result;
  }

  /**
   * Kiểm tra và ép buộc dữ liệu cho NPC phát sinh trong lúc chơi
   */
  static syncNpcWithSource(npcName: string, currentWorkTitle: string): FanficCharacter | null {
    const officialWork = FanficSourceService.findWorkByTitle(currentWorkTitle);
    if (!officialWork) return null;

    const officialChar = FanficSourceService.findCharacterInWork(officialWork, npcName);
    if (officialChar) {
      return {
        name: officialChar.name,
        gender: officialChar.gender,
        age: officialChar.age,
        personality: (officialChar as any).personality || "",
        background: (officialChar as any).description || "",
        appearance: (officialChar as any).appearance || "",
        skills: (officialChar as any).skills || "",
        goal: (officialChar as any).goal || "",
        role: officialChar.role,
        isOfficial: true
      };
    }
    
    return null;
  }
}
