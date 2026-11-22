import React, { useCallback } from 'react';
import { WorldSettings } from '../../types';
import { parseRealmString } from '../../utils/realmParser';

export const useCultivationSystemActions = (
  setSettings: React.Dispatch<React.SetStateAction<WorldSettings>>
) => {
  const applyCultivationSystem = useCallback((majorRaw: string, minorRaw: string) => {
    // 1. Phân tích chuỗi thô thành mảng
    const majors = parseRealmString(majorRaw);
    const minors = parseRealmString(minorRaw);

    if (majors.length === 0 || minors.length === 0) return;

    // 2. Xác định cảnh giới thấp nhất
    const lowestMajor = majors[0];
    const lowestMinor = minors[0];
    const defaultStartingRealm = `${lowestMajor} ${lowestMinor}`;

    // 3. Cập nhật đồng bộ vào State
    setSettings(prev => {
      // Cập nhật tất cả các chủng tộc hiện có và hệ thống yêu thú với hệ thống vừa thiết lập
      const updatedRaceSystems = prev.raceCultivationSystems.map(s => ({
        ...s,
        realmSystem: majorRaw
      }));

      return {
        ...prev,
        cultivationSystem: {
          ...prev.cultivationSystem,
          majorRealmsRaw: majorRaw,
          minorRealmsRaw: minorRaw,
          parsedMajors: majors.map(name => ({ name, levels: minors.length })),
          parsedMinors: minors,
          isReady: true
        },
        raceCultivationSystems: updatedRaceSystems,
        yeuThuRealmSystem: majorRaw,
        canhGioiKhoiDau: defaultStartingRealm // CẬP NHẬT TRỰC TIẾP VÀO Ô KHỞI ĐẦU
      };
    });
  }, [setSettings]);

  return { applyCultivationSystem };
};
