import { CultivationSystem, RaceCultivationSystem } from '../types';
import { parseUnifiedRealmString } from './realmParser';

export function normalizeCultivationFromAiResponse(response: any): {
  cultivationSystem?: CultivationSystem;
  raceCultivationSystems?: RaceCultivationSystem[];
} {
  let rawMajorString = response.unifiedCultivationSystem || '';

  // Nếu không có unifiedCultivationSystem nhưng có raceCultivationSystems (vd: Nhân Tộc)
  if (!rawMajorString && response.raceCultivationSystems?.length > 0) {
    const humanSystem = response.raceCultivationSystems.find((s: any) => s.raceName === 'Nhân Tộc') || response.raceCultivationSystems[0];
    if (humanSystem?.realmSystem) {
      rawMajorString = humanSystem.realmSystem.replace(/\s*-\s*/g, ' - ');
    }
  }

  if (rawMajorString) {
    const parsed = parseUnifiedRealmString(rawMajorString);
    const cultivationSystem: CultivationSystem = {
      majorRealmsRaw: rawMajorString,
      minorRealmsRaw: "Tầng 1 - Tầng 2 - Tầng 3 - Tầng 4 - Tầng 5 - Tầng 6 - Tầng 7 - Tầng 8 - Tầng 9",
      parsedMajors: parsed.map(p => ({ ...p, levels: 1 })),
      parsedMinors: ["Tầng 1", "Tầng 2", "Tầng 3", "Tầng 4", "Tầng 5", "Tầng 6", "Tầng 7", "Tầng 8", "Tầng 9"],
      isReady: parsed.length > 0
    };

    // Đảm bảo raceCultivationSystems cũng có dữ liệu Nhân Tộc đồng bộ
    const raceSystems: RaceCultivationSystem[] = response.raceCultivationSystems ? [...response.raceCultivationSystems] : [];
    if (!raceSystems.some(s => s.raceName === 'Nhân Tộc')) {
      raceSystems.unshift({
        id: 'default-human-' + Date.now(),
        raceName: 'Nhân Tộc',
        realmSystem: rawMajorString
      });
    }

    return { cultivationSystem, raceCultivationSystems: raceSystems };
  }

  return {};
}
