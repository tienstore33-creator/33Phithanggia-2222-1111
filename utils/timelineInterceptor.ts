import { GameContextType } from '../contexts/GameContext';

export interface TimelineCheckParams {
  game: GameContextType;
  setShowTimelineWarningBanner: (show: boolean) => void;
  setIsTimelineModalOpen: (open: boolean) => void;
}

/**
 * Kiểm tra trạng thái dòng thời gian thiết lập.
 * Nếu số sự kiện còn lại < 2 và đủ điều kiện cảnh báo, sẽ mở Modal và trả về true để ngắt luồng gửi.
 */
export const checkAndInterceptTimeline = ({
  game,
  setShowTimelineWarningBanner,
  setIsTimelineModalOpen,
}: TimelineCheckParams): boolean => {
  const events = game.knowledgeBase.worldConfig?.timelineEvents || [];
  const currentIndex = game.knowledgeBase.arcState?.originalTimelineIndex ?? 0;
  const currentTurn = game.knowledgeBase.playerStats?.turn ?? 0;
  const lastWarningTurn = game.uiState?.lastTimelineWarningTurn;

  const dismissCount = game.uiState?.timelineWarningDismissCount ?? 0;
  const remainingEvents = events.length - currentIndex;

  // Số lượt chờ lũy tiến: (lần đóng + 1) * 5 (tức 5, 10, 15, 20... lượt)
  const requiredInterval = (dismissCount + 1) * 5;

  const isIntervalReached = lastWarningTurn === undefined || (currentTurn - lastWarningTurn) >= requiredInterval;

  if (remainingEvents < 2 && isIntervalReached) {
    game.setUiState(prev => ({
      ...prev,
      lastTimelineWarningTurn: currentTurn
    }));
    setShowTimelineWarningBanner(true);
    setIsTimelineModalOpen(true);
    game.showNotification("Dòng thời gian sắp cạn kiệt! Hãy tạo thêm sự kiện.", "warning");
    return true; // Ngắt luồng gửi
  }

  return false; // Cho phép đi tiếp
};
