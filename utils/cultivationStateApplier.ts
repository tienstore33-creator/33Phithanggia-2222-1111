import { WorldSettings } from '../types';
import { parseUnifiedRealmString } from './realmParser';

export function applyCultivationToWorldSettings(
  prevSettings: WorldSettings,
  majorRealmsRaw: string,
  minorRealmsRaw?: string
): WorldSettings {
  const majors = majorRealmsRaw.trim();
  const minors = (minorRealmsRaw || "Tầng 1 - Tầng 2 - Tầng 3 - Tầng 4 - Tầng 5 - Tầng 6 - Tầng 7 - Tầng 8 - Tầng 9").trim();
  const parsed = parseUnifiedRealmString(majors);

  return {
    ...prevSettings,
    isCultivationEnabled: true,
    cultivationSystem: {
      majorRealmsRaw: majors,
      minorRealmsRaw: minors,
      parsedMajors: parsed.map(p => ({ ...p, levels: 1 })),
      parsedMinors: minors.split(' - ').map(s => s.trim()).filter(Boolean),
      isReady: parsed.length > 0
    },
    raceCultivationSystems: [
      {
        id: 'human-default-' + Date.now(),
        raceName: 'Nhân Tộc',
        realmSystem: majors
      },
      ...(prevSettings.raceCultivationSystems || []).filter(s => s.raceName !== 'Nhân Tộc')
    ]
  };
}
