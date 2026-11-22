import React, { useCallback } from 'react';
import { KnowledgeBase, GameMessage, GameScreen } from '../types';
import { handleLevelUps } from '../utils/gameLogicUtils';
import { VIETNAMESE, PROFICIENCY_TIERS, PROFICIENCY_EXP_THRESHOLDS } from '../constants';
import { useUiLockStore } from '@/src/store/uiLockStore';
import { checkLocationSafety } from '../services/ai/cultivationValidator';
import { generateSeclusionNarrative } from '../services/ai/seclusionNarrativeService';
import { runFlashAgentAsync } from '../services/FlashAgentService';
import { UIState } from '../types';
import { applyLifespanDeduction } from '../utils/statsCalculationUtils';

interface UseCultivationActionsProps {
  knowledgeBase: KnowledgeBase;
  gameMessages: GameMessage[];
  setKnowledgeBase: React.Dispatch<React.SetStateAction<KnowledgeBase>>;
  addMessageAndUpdateState: (newMessages: GameMessage[], newKnowledgeBase: KnowledgeBase, startingCurrency?: number, callback?: () => void) => void;
  setIsCultivating: React.Dispatch<React.SetStateAction<boolean>>;
  showNotification: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  setCurrentScreen: (screen: GameScreen) => void;
  uiState: UIState;
  setUiState: React.Dispatch<React.SetStateAction<UIState>>;
  handleSuccession?: (kbToModify: KnowledgeBase) => Promise<GameMessage>;
}

export const useCultivationActions = ({
  knowledgeBase,
  gameMessages,
  setKnowledgeBase,
  addMessageAndUpdateState,
  setIsCultivating,
  showNotification,
  setCurrentScreen,
  uiState,
  setUiState,
  handleSuccession,
}: UseCultivationActionsProps) => {

  const handleStartCultivation = useCallback(async (
    durationInDays: number
  ): Promise<string[]> => {
    // Check safety before starting
    const safety = checkLocationSafety(knowledgeBase);
    if (!safety.isSafe) {
        showNotification(VIETNAMESE.cultivationUnsafeLocation, 'warning');
        throw new Error(VIETNAMESE.cultivationUnsafeLocation);
    }

    setIsCultivating(true);
    
    try {
      const { playerStats, worldConfig, realmProgressionList } = knowledgeBase;
      const currentMainRealm = realmProgressionList.find(r => playerStats.realm.startsWith(r));
      const realmIndex = currentMainRealm ? realmProgressionList.indexOf(currentMainRealm) : 0;
      
      const COST_BASE = 5;
      const EXP_BASE = 5;

      const costMultiplier = Math.pow(1.2, realmIndex);
      const expMultiplier = Math.pow(0.8, realmIndex);

      const costPerDay = Math.floor(COST_BASE * costMultiplier);
      const expPerDay = Math.floor(EXP_BASE * expMultiplier);

      const totalCost = durationInDays * costPerDay;
      const totalExpGain = durationInDays * expPerDay;

      if (playerStats.currency < totalCost) {
          throw new Error(`Không đủ ${worldConfig?.currencyName || "tiền tệ"}. Cần ${totalCost.toLocaleString()}.`);
      }

      const newCurrency = playerStats.currency - totalCost;
      const newExp = playerStats.kinhNghiem + totalExpGain;

      let updatedKb = {
          ...knowledgeBase,
          playerStats: {
              ...playerStats,
              currency: newCurrency,
              kinhNghiem: newExp,
              turn: playerStats.turn + durationInDays // Advance time
          }
      };

      // Handle level ups mechanically
      const levelUpResult = handleLevelUps(updatedKb);
      updatedKb = levelUpResult.updatedKb;
      const systemMessages = levelUpResult.systemMessages;

      const log: string[] = [];
      log.push(`Bắt đầu bế quan ${durationInDays} ngày...`);
      log.push(`Tiêu hao: ${totalCost.toLocaleString()} ${worldConfig?.currencyName || "tiền tệ"}.`);
      log.push(`Thu được: ${totalExpGain.toLocaleString()} kinh nghiệm.`);
      
      if (systemMessages.length > 0) {
          log.push(...systemMessages.map(m => m.content));
      } else if (updatedKb.playerStats.hieuUngBinhCanh) {
          log.push(`!!! ĐẠT ĐẾN BÌNH CẢNH: Cần độ kiếp để đột phá !!!`);
      } else {
          log.push(`Còn thiếu ${Math.max(0, updatedKb.playerStats.maxKinhNghiem - updatedKb.playerStats.kinhNghiem).toLocaleString()} kinh nghiệm để đột phá.`);
      }

      setKnowledgeBase(updatedKb);
      return log;

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Lỗi không xác định khi bắt đầu tu luyện.";
      showNotification(errorMsg, 'error');
      throw error;
    } finally {
      setIsCultivating(false);
    }
  }, [knowledgeBase, setKnowledgeBase, showNotification, setIsCultivating]);
  
  const handleExitCultivation = useCallback(async (totalDuration: { days: number; months: number; years: number; }) => {
      const { setLocked } = useUiLockStore.getState();
      const totalDays = totalDuration.days + (totalDuration.months * 30) + (totalDuration.years * 360);
      
      if (totalDays > 0) {
          setLocked(true);
          setCurrentScreen(GameScreen.Gameplay); 
          showNotification("Đang xuất quan và cảm nhận biến động thế giới...", 'info');
          
          let narration = "";
          let finalKb = JSON.parse(JSON.stringify(knowledgeBase));
          finalKb.pendingCombat = null;
          finalKb.postCombatState = null;
          if (finalKb.playerStats) {
              finalKb.playerStats.isInCombat = false;
          }
          
          // Mechanical updates
          let { day, month, year } = finalKb.worldDate;
          const oldYear = year;
          day += totalDuration.days;
          month += totalDuration.months;
          year += totalDuration.years;
          if (day > 30) { month += Math.floor((day - 1) / 30); day = ((day - 1) % 30) + 1; }
          if (month > 12) { year += Math.floor((month - 1) / 12); month = ((month - 1) % 12) + 1; }
          finalKb.worldDate = { ...finalKb.worldDate, day, month, year, timeOfDay: 'Sáng' };
          
          const yearsPassed = (totalDuration.years || 0) + ((totalDuration.months || 0) / 12) + ((totalDuration.days || 0) / 360);
          let seclusionDeadNpcs: string[] = [];
          let seclusionMcDied = false;
          let lifespanSystemMessages: GameMessage[] = [];

          if (yearsPassed > 0) {
              const lifespanRes = applyLifespanDeduction(finalKb, yearsPassed, finalKb.playerStats.turn);
              seclusionDeadNpcs = lifespanRes.deadNpcNames;
              seclusionMcDied = lifespanRes.mcDied;
              lifespanSystemMessages = lifespanRes.systemMessages;
          }

          if (!seclusionMcDied) {
              finalKb.playerStats.sinhLuc = finalKb.playerStats.maxSinhLuc;
              finalKb.playerStats.linhLuc = finalKb.playerStats.maxLinhLuc;
          }

          try {
              const contextFromHistory = (gameMessages || []).slice(-10).map(msg => msg.content).join('\n');
              narration = await generateSeclusionNarrative(
                knowledgeBase, 
                totalDuration.days, 
                totalDuration.months, 
                totalDuration.years, 
                contextFromHistory,
                seclusionDeadNpcs,
                seclusionMcDied
              );
              narration = narration.replace(/\[[A-Z0-9_]+:[^\]]*\]/g, '').trim(); 
          } catch (error) {
              console.error("Failed to generate seclusion narrative:", error);
              narration = `[XUẤT QUAN]\nBạn đã kết thúc quá trình bế quan kéo dài ${totalDays} ngày. Tu vi hiện tại: ${finalKb.playerStats.realm}.`;
          } finally {
              setLocked(false);
          }

          const now = Date.now();
          const timeX = `${totalDuration.years > 0 ? totalDuration.years + ' năm ' : ''}${totalDuration.months > 0 ? totalDuration.months + ' tháng ' : ''}${totalDuration.days > 0 ? totalDuration.days + ' ngày' : ''}`;
          
          const summaryMessage: GameMessage = {
              id: 'cultivation-summary-' + now,
              type: 'narration',
              content: narration,
              timestamp: now,
              turnNumber: finalKb.playerStats.turn,
              choices: [
                  { text: `kiểm tra tình hình mọi người sau ${timeX} trôi qua`, thought: "Tôi cần biết người thân thế nào." },
                  { text: `kiểm tra tình hình thế giới sau ${timeX} trôi qua`, thought: "Thế sự thay đổi ra sao?" },
                  { text: `kiểm tra tình hình cơ thể sau ${timeX} trôi qua`, thought: "Xem xét lại bản thân." }
              ]
          };

          const newMessagesToPush = [summaryMessage, ...lifespanSystemMessages];

          addMessageAndUpdateState(newMessagesToPush, finalKb, undefined, () => {
          });

          // --- ADDED: GENERATE SUMMARY & RICH SUMMARY ---
          const locDetail = finalKb.discoveredLocations.find(loc => loc.id === finalKb.currentLocationId);
          const locName = locDetail ? locDetail.name : "Không rõ";
          const worldDate = finalKb.worldDate;
          const timeStr = worldDate 
              ? `${worldDate.timeOfDay}, Ngày ${worldDate.day}, Tháng ${worldDate.month}, Năm ${worldDate.year}`
              : "Không rõ";
          const turn = finalKb.playerStats.turn;

          // Lưu dữ liệu để nhỡ cần retry
          setUiState(prev => ({
              ...prev,
              lastFlashRetryData: {
                  action: `Xuất quan sau ${timeX}`,
                  aiResponse: narration,
                  turn: turn,
                  locName,
                  timeStr
              }
          }));

          runFlashAgentAsync(
              `Xuất quan sau ${timeX}`,
              narration,
              turn,
              setKnowledgeBase,
              "",
              finalKb,
              locName,
              timeStr
          );

          // Tự động kiểm tra sau 2s
          setTimeout(() => {
              setKnowledgeBase(currentKb => {
                  const flashEntry = currentKb.ragHistoryLog?.find(entry => entry && entry.turn === turn && entry.type === 'flash_agent');
                  if (!flashEntry || !flashEntry.summary) {
                      setUiState(prev => ({ ...prev, isFlashSummaryMissingModalOpen: true }));
                  }
                  return currentKb;
              });
          }, 2000);
          // ----------------------------------------------

          showNotification("Đã xuất quan!", 'success');
      } else {
          setKnowledgeBase(prev => ({
              ...prev,
              pendingCombat: null,
              postCombatState: null,
              playerStats: {
                  ...prev.playerStats,
                  isInCombat: false
              }
          }));
          setCurrentScreen(GameScreen.Gameplay);
      }
  }, [knowledgeBase, setKnowledgeBase, addMessageAndUpdateState, showNotification, setCurrentScreen, setUiState]);


  return { handleStartCultivation, handleExitCultivation };
};