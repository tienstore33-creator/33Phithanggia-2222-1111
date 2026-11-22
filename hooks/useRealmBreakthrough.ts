
import React, { useCallback } from 'react';
import { realmManager } from '../services/realmManager';
import { KnowledgeBase, PlayerStats, GameMessage } from '../types';

export const useRealmBreakthrough = (
  kb: KnowledgeBase,
  setKnowledgeBase: React.Dispatch<React.SetStateAction<KnowledgeBase>>,
  addMessageAndUpdateState: (newMessages: GameMessage[], newKnowledgeBase: KnowledgeBase) => void
) => {
  const { playerStats } = kb;

  /**
   * Kích hoạt kiểm tra và thực hiện đột phá nếu đủ điều kiện (XP >= MaxXP).
   */
  const attemptBreakthrough = useCallback(() => {
    if (playerStats.kinhNghiem >= playerStats.maxKinhNghiem) {
      const isValid = realmManager.isValidRealm(playerStats.realm, kb);
      const nextRealm = realmManager.getBreakthroughRealm(playerStats.realm, kb);

      // Nếu cảnh giới hiện tại không hợp lệ -> Kích hoạt Fallback và thông báo
      if (!isValid) {
        const baseRealm = realmManager.getBaseRealm(kb);
        const progressionList = realmManager.getProgressionList(kb);
        
        const fallbackMessage: GameMessage = {
          id: `fallback-${Date.now()}`,
          type: 'system',
          content: `Cảnh giới hiện tại "${playerStats.realm}" không hợp lệ. Hệ thống đã tự động đưa bạn về cảnh giới nền: "${baseRealm}". Danh sách cảnh giới hợp lệ: ${progressionList.join(', ')}.`,
          timestamp: Date.now(),
          turnNumber: playerStats.turn
        };

        console.log(`Fallback về cảnh giới nền: ${baseRealm}`);
        
        // Cập nhật KnowledgeBase: Reset XP, tăng MaxXP, và đặt cảnh giới nền
        const updatedKb = {
          ...kb,
          playerStats: {
            ...kb.playerStats,
            realm: baseRealm,
            kinhNghiem: 0,
            maxKinhNghiem: Math.floor(kb.playerStats.maxKinhNghiem * 1.5)
          }
        };

        addMessageAndUpdateState([fallbackMessage], updatedKb);
        return true;
      }

      // Nếu cảnh giới tiếp theo khác cảnh giới hiện tại
      if (nextRealm !== playerStats.realm) {
        // NEW: Do not advance if at breakthrough bottleneck (bình cảnh)
        if (playerStats.hieuUngBinhCanh) {
          console.log(`Đang ở bình cảnh, cần độ kiếp để đột phá lên ${nextRealm}`);
          return false;
        }

        console.log(`Đột phá thành công! Cảnh giới mới: ${nextRealm}`);
        
        // Cập nhật KnowledgeBase: Reset XP, tăng MaxXP, và đặt cảnh giới mới
        setKnowledgeBase(prev => ({
          ...prev,
          playerStats: {
            ...prev.playerStats,
            realm: nextRealm,
            kinhNghiem: 0, // Reset XP về 0 sau khi đột phá
            maxKinhNghiem: Math.floor(prev.playerStats.maxKinhNghiem * 1.5) // Tăng độ khó cho cảnh giới tiếp theo
          }
        }));
        
        return true; // Đã đột phá thành công
      }
    }
    return false; // Không đủ điều kiện hoặc đã ở đỉnh cao
  }, [playerStats, setKnowledgeBase, addMessageAndUpdateState, kb]);

  return { attemptBreakthrough };
};
