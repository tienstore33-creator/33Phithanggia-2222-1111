
import React, { ChangeEvent, useState, useEffect, useRef } from 'react';
import { GameMessage, PlayerActionInputType, ResponseLength } from '../../../types';
import Button from '../../ui/Button';
import { VIETNAMESE } from '../../../constants';
import { useGame } from '../../../hooks/useGame';
import { useUiLockStore } from '@/src/store/uiLockStore';
import { PromptCheck429Modal } from '../modals/PromptCheck429Modal';
import { constructStandardTurnPromptPayload } from '../../../services/geminiService';

import LoadingMiniGameContainer from '../minigames/LoadingMiniGameContainer';

interface PlayerInputAreaProps {
  latestMessageWithChoices: GameMessage | undefined;
  showAiSuggestions: boolean;
  setShowAiSuggestions: (show: boolean) => void;
  playerInput: string;
  setPlayerInput: (input: string) => void;
  currentActionType: PlayerActionInputType;
  setCurrentActionType: (type: PlayerActionInputType) => void;
  isActionTypeDropdownOpen: boolean;
  setIsActionTypeDropdownOpen: (isOpen: boolean) => void;
  actionTypeDropdownRef: React.RefObject<HTMLDivElement | null>;
  selectedResponseLength: ResponseLength;
  setSelectedResponseLength: (length: ResponseLength) => void;
  isResponseLengthDropdownOpen: boolean;
  setIsResponseLengthDropdownOpen: (isOpen: boolean) => void;
  responseLengthDropdownRef: React.RefObject<HTMLDivElement | null>;
  isLoadingUi: boolean;
  isSummarizingUi: boolean;
  isCurrentlyActivePage: boolean;
  messageIdBeingEdited: string | null;
  handleChoiceClick: (choiceText: string, thought?: string) => void;
  handleSubmit: (e: React.FormEvent) => void;
  choiceButtonStyles: React.CSSProperties;
  isMiniGameVisible: boolean;
  setIsMiniGameVisible: (visible: boolean) => void;
  storyLogRef: React.RefObject<HTMLDivElement | null>;
}

const PlayerInputArea: React.FC<PlayerInputAreaProps> = ({
  latestMessageWithChoices,
  showAiSuggestions,
  setShowAiSuggestions,
  playerInput,
  setPlayerInput,
  currentActionType,
  setCurrentActionType,
  isActionTypeDropdownOpen,
  setIsActionTypeDropdownOpen,
  actionTypeDropdownRef,
  selectedResponseLength,
  setSelectedResponseLength,
  isResponseLengthDropdownOpen,
  setIsResponseLengthDropdownOpen,
  responseLengthDropdownRef,
  isLoadingUi,
  isSummarizingUi,
  isCurrentlyActivePage,
  messageIdBeingEdited,
  handleChoiceClick,
  handleSubmit,
  choiceButtonStyles,
  isMiniGameVisible,
  setIsMiniGameVisible,
  storyLogRef,
}) => {
    const { 
      setUiState, 
      knowledgeBase, 
      isStreaming, 
      abortStream, 
      uiState, 
      handlePlayerAction,
      handleMatPhapContinue,
      matPhapCountdown,
      kcActive,
      kcQueue,
      kcCurrentIndex,
      startKingCrimson,
      stopKingCrimson,
      showNotification,
      gameMessages,
      previousPageSummaries,
      lastNarrationFromPreviousPage
    } = useGame();
    const { isLocked } = useUiLockStore();
    const [turnFailCount, setTurnFailCount] = useState(0);

    // King Crimson UI states (for the modal only)
    const [kingCrimsonInputs, setKingCrimsonInputs] = useState<string[]>(['', '', '', '', '']);
    const [isKcModalOpen, setIsKcModalOpen] = useState(false);
    const [anyPresetEnabled, setAnyPresetEnabled] = useState<boolean>(false);
    const [storyQuotaInfo, setStoryQuotaInfo] = useState<{ remaining: number, limit: number }>({ remaining: 5, limit: 100 });

    // Prompt Check 429 Modal states
    const [isPromptCheckModalOpen, setIsPromptCheckModalOpen] = useState(false);
    const [checkPromptData, setCheckPromptData] = useState<{
      prompt: string;
      systemInstruction: string;
      actionText: string;
      useGoogleSearch: boolean;
      isOocAction: boolean;
    }>({
      prompt: '',
      systemInstruction: '',
      actionText: '',
      useGoogleSearch: true,
      isOocAction: false
    });
    const [isPreparingCheckPrompt, setIsPreparingCheckPrompt] = useState(false);

    const handleCheck429Step5 = async () => {
      const step5Text = (kingCrimsonInputs[4] || '').trim();
      if (!step5Text) {
        showNotification("Vui lòng nhập nội dung vào ô 'LƯỢT BƯỚC #5' để kiểm tra prompt và 429!", "warning");
        return;
      }

      setIsPreparingCheckPrompt(true);
      try {
        // 1. Format pruned message log identically to standard narrative turns
        const turnMessagesAtStart = (gameMessages || []).filter(m => m.type === 'narration' || m.type === 'player_action');
        const uniqueTurnsAtStart = Array.from(new Set(turnMessagesAtStart.map(m => m.turnNumber))).sort((a, b) => Number(a) - Number(b));
        const turnsToKeepAtStart = uniqueTurnsAtStart.slice(-4);
        const cutoffTurnForAI = turnsToKeepAtStart.length > 0 ? turnsToKeepAtStart[0] : (uniqueTurnsAtStart[0] || 0);

        const prunedMessagesLogForAI = (gameMessages || [])
          .filter(m => m.turnNumber >= cutoffTurnForAI)
          .map((msg) => {
            if (msg.type === "player_action") {
              const prefix = `${knowledgeBase.worldConfig?.playerName || "Người chơi"} ${msg.isPlayerInput ? "đã làm" : "đã chọn"}: `;
              return prefix + msg.content;
            }
            if (msg.type === "narration") {
              const prefix = "AI kể: ";
              return prefix + msg.content;
            }
            if (msg.type === "system") {
              const contentLower = msg.content.toLowerCase();
              const isExcluded =
                contentLower.includes("tóm tắt") ||
                contentLower.includes("trang") ||
                contentLower.startsWith("nhận được:") ||
                contentLower.startsWith("học được kỹ năng mới:") ||
                contentLower.startsWith("bạn đã gặp npc mới:");

              if (!isExcluded) {
                return `Hệ thống: ${msg.content}`;
              }
            }
            return null;
          })
          .filter(Boolean)
          .join("\n---\n");

        // 2. Build standard payload using exact narrative turn parameters
        const payload = await constructStandardTurnPromptPayload(
          knowledgeBase,
          step5Text,
          currentActionType,
          selectedResponseLength,
          prunedMessagesLogForAI,
          previousPageSummaries || [],
          lastNarrationFromPreviousPage
        );

        setCheckPromptData({
          prompt: payload.optimizedPrompt,
          systemInstruction: payload.systemInstruction,
          actionText: step5Text,
          useGoogleSearch: payload.useGoogleSearch,
          isOocAction: payload.isOocAction
        });
        setIsPromptCheckModalOpen(true);
      } catch (err: any) {
        showNotification(`Lỗi khi tạo prompt kiểm tra: ${err?.message || err}`, "error");
      } finally {
        setIsPreparingCheckPrompt(false);
      }
    };

    const handleExecuteNormalTurnFromModal = async (editedPrompt: string) => {
      setIsPromptCheckModalOpen(false);
      setIsKcModalOpen(false);
      setKingCrimsonInputs(['', '', '', '', '']);

      try {
        const step5Text = (kingCrimsonInputs[4] || '').trim();
        await handlePlayerAction(
          step5Text,
          false,
          currentActionType,
          selectedResponseLength,
          undefined,
          undefined,
          editedPrompt
        );
      } catch (err: any) {
        console.error("Lỗi khi gửi lượt từ modal:", err);
        showNotification(`Lỗi khi gửi lượt chơi: ${err?.message || err}`, "error");
      }
    };

    useEffect(() => {
        const checkPresetsAndQuota = () => {
            try {
                // 1. Kiểm tra Presets
                const savedPresets = localStorage.getItem('accessory_preset_files');
                let isAnyEnabled = false;
                if (savedPresets) {
                    const files = JSON.parse(savedPresets);
                    if (Array.isArray(files)) {
                        isAnyEnabled = files.some((pf: any) => pf.enabled);
                    }
                }
                setAnyPresetEnabled(isAnyEnabled);

                // 2. Kiểm tra Quota
                const currentTurn = knowledgeBase.playerStats?.turn ?? 0;
                const limit = Math.ceil(currentTurn / 100) * 100 || 100;
                const quotaKey = `story_quota_${knowledgeBase.worldConfig?.saveGameName || 'default'}_${knowledgeBase.playerStats?.name || 'player'}`;
                
                let remaining = 5;
                const savedQuota = localStorage.getItem(quotaKey);
                if (savedQuota) {
                    const quotaMap = JSON.parse(savedQuota);
                    if (quotaMap && quotaMap[String(limit)] !== undefined) {
                        remaining = Number(quotaMap[String(limit)]);
                    }
                }
                setStoryQuotaInfo({ remaining, limit });
            } catch (e) {
                console.error('Error checking presets and quota in PlayerInputArea:', e);
                setAnyPresetEnabled(false);
                setStoryQuotaInfo({ remaining: 5, limit: 100 });
            }
        };

        checkPresetsAndQuota();

        const handleUpdateEvent = () => {
            checkPresetsAndQuota();
        };

        window.addEventListener('accessory_preset_files_changed', handleUpdateEvent);
        window.addEventListener('storage', handleUpdateEvent);

        return () => {
            window.removeEventListener('accessory_preset_files_changed', handleUpdateEvent);
            window.removeEventListener('storage', handleUpdateEvent);
        };
    }, [knowledgeBase.playerStats?.turn, knowledgeBase.worldConfig?.saveGameName, knowledgeBase.playerStats?.name]);

    useEffect(() => {
        if (isLoadingUi) {
            setTurnFailCount(0);
        }
    }, [isLoadingUi]);

    const handleMinigameFail = () => {
        setTurnFailCount(prev => {
            const newCount = prev + 1;
            if (newCount >= 2) {
                setTimeout(() => setIsMiniGameVisible(false), 0);
            }
            return newCount;
        });
    };

    useEffect(() => {
        if ((isLoadingUi || uiState.isSyncingData) && !isStreaming) {
            setIsMiniGameVisible(true);
        }
    }, [isLoadingUi, uiState.isSyncingData, isStreaming, setIsMiniGameVisible]);

    const responseLengthOptions: { label: string, value: ResponseLength }[] = [
        { label: VIETNAMESE.responseLength_dialogue, value: 'dialogue' },
        { label: VIETNAMESE.responseLength_default, value: 'default' },
        { label: VIETNAMESE.responseLength_extraShort, value: 'extra-short' },
        { label: VIETNAMESE.responseLength_short, value: 'short' },
        { label: VIETNAMESE.responseLength_medium, value: 'medium' },
        { label: VIETNAMESE.responseLength_long, value: 'long' },
    ];

    const [secondsElapsed, setSecondsElapsed] = useState(0);
    const isButtonLoading = (isLoadingUi || uiState.isSyncingData) && !isSummarizingUi && !isStreaming;

    const canChallenge = isCurrentlyActivePage && !isLoadingUi && !uiState.isSyncingData && !isSummarizingUi && !messageIdBeingEdited;

  return (
    <div className="bg-black p-2 sm:p-3 border-t border-gray-700 flex-shrink-0 relative animate-in fade-in duration-300">
      {uiState.isAutoSaving && (
        <div className="absolute top-0 left-0 w-full bg-indigo-900/90 border-b border-indigo-500 text-indigo-100 text-[10px] py-1 text-center font-bold tracking-widest z-[60] shadow-glow flex items-center justify-center gap-2">
            <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-pulse"></span>
            THIÊN TỰ ĐỘNG LƯU: ĐĂNG KÝ PHÁP BẢO...
            <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-pulse"></span>
        </div>
      )}
      {isMiniGameVisible && (isLoadingUi || isStreaming || uiState.isSyncingData) && !isSummarizingUi && (
        <div className="absolute inset-0 z-50 bg-gray-900/95 p-2 sm:p-3 flex flex-col items-center justify-center">
          {kcActive ? (
            <div className="flex flex-col items-center justify-center h-full w-full gap-3 p-4 bg-black/95 border border-red-900 rounded-lg shadow-[0_0_20px_rgba(239,68,68,0.3)] animate-pulse">
              <div className="relative flex items-center justify-center">
                <span className="absolute animate-ping inline-flex h-8 w-8 rounded-full bg-red-500 opacity-20"></span>
                <span className="text-red-500 text-3xl font-bold animate-bounce">⚡</span>
              </div>
              <div className="text-center">
                <h4 className="text-red-450 font-bold text-xs sm:text-sm tracking-widest uppercase font-sans">
                  KING CRIMSON: ĐANG XÓA NHÒA THỜI GIAN
                </h4>
                <p className="text-[11px] text-gray-400 mt-1 font-mono">
                  Đang tự động xử lý bước #{kcCurrentIndex + 1} / {kcQueue.length}
                </p>
              </div>
              <div className="flex gap-2.5 mt-1">
                {kcQueue.map((_, i) => (
                  <div 
                    key={i} 
                    className={`w-3 h-3 rounded-full border transition-all duration-300 ${
                      i < kcCurrentIndex 
                        ? 'bg-red-600 border-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]' 
                        : i === kcCurrentIndex 
                          ? 'bg-red-500 border-white animate-ping' 
                          : 'bg-gray-800 border-gray-700'
                    }`}
                  />
                ))}
              </div>
            </div>
          ) : uiState.isSyncingData && !isLoadingUi && !isStreaming ? (
            <div className="flex flex-col items-center gap-3 animate-in fade-in duration-500 max-w-lg mx-auto w-full text-center">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce"></div>
              </div>
              <span className="text-indigo-300 text-sm font-medium tracking-wide">Đang đồng bộ Thiên Đạo...</span>
              {uiState.syncStreamingText && (
                <div className="flex flex-col items-center gap-1.5 text-xs text-indigo-400 font-mono">
                  <div className="flex items-center gap-2 px-3.5 py-1.5 bg-indigo-950/40 rounded border border-indigo-900/30">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-indigo-500"></span>
                    </span>
                    <span>Đang trích xuất: {Math.ceil(uiState.syncStreamingText.length / 3.3)} linh ký (tokens)</span>
                  </div>
                  <span className="text-[10px] text-indigo-400/60 font-sans italic">Thiên cơ đang xoay chuyển và cập nhật thế giới quan...</span>
                </div>
              )}
            </div>
          ) : (
            <LoadingMiniGameContainer 
                onClose={() => setIsMiniGameVisible(false)} 
                onFail={handleMinigameFail}
            />
          )}
        </div>
      )}
      {isCurrentlyActivePage && !isSummarizingUi && (
        <div className="mb-2">
          <div className="relative w-full">
            {((latestMessageWithChoices?.choices && latestMessageWithChoices.choices.length > 0) || (knowledgeBase.suggestedActions && knowledgeBase.suggestedActions.length > 0)) && (
              <Button
                type="button"
                variant={anyPresetEnabled ? undefined : "ghost"}
                size="sm"
                className={`w-full relative overflow-hidden justify-center text-center py-2 px-2 text-xs mb-1 transition-all duration-500 rounded-lg ${
                  anyPresetEnabled
                    ? 'starry-shimmer-bg border border-sky-400 text-white font-extrabold shadow-[0_0_20px_rgba(14,165,233,0.4)] scale-[1.01]'
                    : 'text-indigo-300 hover:text-indigo-200 hover:bg-indigo-950/20'
                }`}
                onClick={() => setShowAiSuggestions(!showAiSuggestions)}
              >
                {/* Chữ hiển thị */}
                <span className="relative z-10 flex items-center justify-center gap-1.5 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                  {anyPresetEnabled && <span className="animate-pulse">✨</span>}
                  {showAiSuggestions ? VIETNAMESE.hideAiSuggestionsButton : VIETNAMESE.showAiSuggestionsButton}
                  {anyPresetEnabled && <span className="animate-pulse">✨</span>}
                </span>

                {/* Các hạt sao lấp lánh chỉ hiển thị khi có bất kì Preset nào được bật */}
                {anyPresetEnabled && (
                  <>
                    <span className="absolute w-1 h-1 bg-white rounded-full sparkle-particle animate-pulse" style={{ top: '15%', left: '10%', animationDelay: '0s', animationDuration: '2.5s' }} />
                    <span className="absolute w-1.5 h-1.5 bg-sky-200 rounded-full sparkle-particle animate-pulse" style={{ top: '70%', left: '25%', animationDelay: '0.4s', animationDuration: '3s' }} />
                    <span className="absolute w-1 h-1 bg-cyan-100 rounded-full sparkle-particle animate-pulse" style={{ top: '30%', left: '40%', animationDelay: '1.2s', animationDuration: '2s' }} />
                    <span className="absolute w-1 h-1 bg-blue-200 rounded-full sparkle-particle animate-pulse" style={{ top: '80%', left: '55%', animationDelay: '0.8s', animationDuration: '4s' }} />
                    <span className="absolute w-1.5 h-1.5 bg-sky-300 rounded-full sparkle-particle animate-pulse" style={{ top: '20%', left: '70%', animationDelay: '0.2s', animationDuration: '1.8s' }} />
                    <span className="absolute w-1 h-1 bg-white rounded-full sparkle-particle animate-pulse" style={{ top: '65%', left: '85%', animationDelay: '1.5s', animationDuration: '3.5s' }} />
                    <span className="absolute w-1 h-1 bg-sky-100 rounded-full sparkle-particle animate-pulse" style={{ top: '50%', left: '15%', animationDelay: '0.6s', animationDuration: '2.8s' }} />
                    <span className="absolute w-1.5 h-1.5 bg-cyan-100 rounded-full sparkle-particle animate-pulse" style={{ top: '10%', left: '90%', animationDelay: '1s', animationDuration: '2.2s' }} />
                    <span className="absolute w-1 h-1 bg-white rounded-full sparkle-particle animate-pulse" style={{ top: '75%', left: '95%', animationDelay: '0.5s', animationDuration: '3.2s' }} />
                  </>
                )}
              </Button>
            )}
          </div>
          {(showAiSuggestions || (knowledgeBase.suggestedActions && knowledgeBase.suggestedActions.length > 0)) && (
            <div className="flex flex-col space-y-2 max-h-32 overflow-y-auto custom-scrollbar pr-2">
              {knowledgeBase.suggestedActions && knowledgeBase.suggestedActions.length > 0 ? (
                knowledgeBase.suggestedActions.map((action, index) => (
                  <Button 
                    key={`forced-${index}`} 
                    variant="ghost" 
                    className="w-full text-left justify-start py-1.5 px-2 sm:py-2 sm:px-3 text-xs sm:text-sm whitespace-normal h-auto text-cyan-400 hover:text-cyan-200 border border-cyan-600/50 hover:border-cyan-500/80 hover:bg-cyan-900/30 flex flex-col items-start shrink-0" 
                    onClick={() => handleChoiceClick(action)} 
                    disabled={isLoadingUi || isSummarizingUi || !isCurrentlyActivePage || !!messageIdBeingEdited || isLocked || kcActive} 
                  >
                    <span className="font-medium">{index + 1}. {action}</span>
                    <span className="text-[10px] text-cyan-400/60 font-sans italic">Hành động duy nhất khả thi trong trạng thái này</span>
                  </Button>
                ))
              ) : (
                latestMessageWithChoices?.choices?.map((choice, index) => (
                  <Button 
                    key={index} 
                    variant="ghost" 
                    className="w-full text-left justify-start py-1.5 px-2 sm:py-2 sm:px-3 text-xs sm:text-sm whitespace-normal h-auto text-yellow-400 hover:text-yellow-200 border border-yellow-600/50 hover:border-yellow-500/80 hover:bg-yellow-900/30 flex flex-col items-start shrink-0" 
                    onClick={() => handleChoiceClick(choice.text, choice.thought)} 
                    disabled={isLoadingUi || isSummarizingUi || !isCurrentlyActivePage || !!messageIdBeingEdited || isLocked || kcActive} 
                    title={choice.text}
                    customStyles={choiceButtonStyles}
                  >
                    <span className="font-medium">{index + 1}. {choice.text}</span>
                    {choice.thought && (
                      <span className="text-[10px] sm:text-xs italic text-gray-400 mt-0.5 opacity-80">
                        "{choice.thought}"
                      </span>
                    )}
                  </Button>
                ))
              )}
            </div>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-2">
        {/* --- MOBILE LAYOUT --- */}
        <div className="flex flex-col gap-1.5 sm:hidden">
            <textarea
                value={playerInput}
                onChange={(e) => setPlayerInput(e.target.value)}
                placeholder={uiState.matPhapStep ? "Vui lòng bấm nút 'Chạy tiếp' để hoàn tất toàn bộ chuỗi tác vụ Mạt Pháp." : (kcActive ? `HỆ THỐNG ĐANG TỰ ĐỘNG CHẠY KING CRIMSON (#${kcCurrentIndex + 1}/${kcQueue.length})...` : ((anyPresetEnabled ? true : knowledgeBase.isCustomInputAllowed !== false) === false ? "Ý chí của bạn đang bị hạn chế! Hãy sử dụng gợi ý từ AI." : (!isCurrentlyActivePage ? "Chỉ có thể hành động ở trang hiện tại nhất." : VIETNAMESE.enterAction)))}
                className="w-full p-2 text-base md:text-sm bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 text-gray-100 placeholder-gray-400 resize-none h-16"
                rows={2}
                disabled={isLoadingUi || isSummarizingUi || !isCurrentlyActivePage || !!messageIdBeingEdited || isLocked || kcActive || !!uiState.matPhapStep || (anyPresetEnabled ? false : knowledgeBase.isCustomInputAllowed === false)}
            />
            <div className="flex flex-col gap-1.5 animate-in fade-in duration-300">
                <div className="grid grid-cols-2 gap-1.5 w-full">
                    <div ref={actionTypeDropdownRef} className="relative w-full">
                        <Button type="button" variant="secondary" size="sm" className="w-full h-full justify-between text-[10px]" onClick={() => setIsActionTypeDropdownOpen(!isActionTypeDropdownOpen)} disabled={isLoadingUi || isSummarizingUi || !isCurrentlyActivePage || !!messageIdBeingEdited || isLocked || kcActive || !!uiState.matPhapStep}>
                            <span className="truncate max-w-[120px]">{kcActive ? `⚡ KC (#${kcCurrentIndex + 1})` : (currentActionType === 'action' ? VIETNAMESE.inputTypeActionLabel : (anyPresetEnabled ? `Câu chuyện ( chỉ còn ${storyQuotaInfo.remaining} lần cho đến lượt ${storyQuotaInfo.limit})` : VIETNAMESE.inputTypeStoryLabel))}</span>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 ml-1 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        </Button>
                        {isActionTypeDropdownOpen && (
                            <div className="absolute bottom-full left-0 mb-1 w-44 bg-gray-800 border border-gray-700 rounded-md shadow-lg z-25 overflow-hidden">
                                <a href="#" onClick={(e) => { e.preventDefault(); setCurrentActionType('action'); setIsActionTypeDropdownOpen(false); }} className="block px-3 py-1.5 text-[11px] text-gray-200 hover:bg-gray-750 transition-colors">{VIETNAMESE.inputTypeActionLabel}</a>
                                <a href="#" onClick={(e) => { e.preventDefault(); setCurrentActionType('story'); setIsActionTypeDropdownOpen(false); }} className="block px-3 py-1.5 text-[11px] text-gray-200 hover:bg-gray-750 transition-colors border-t border-gray-700/50">{anyPresetEnabled ? `Câu chuyện ( chỉ còn ${storyQuotaInfo.remaining} lần cho đến lượt ${storyQuotaInfo.limit})` : VIETNAMESE.inputTypeStoryLabel}</a>
                                <div className="border-t border-gray-700"></div>
                                <a href="#" onClick={(e) => { e.preventDefault(); setIsKcModalOpen(true); setKingCrimsonInputs(['', '', '', '', '']); setIsActionTypeDropdownOpen(false); }} className="block px-3 py-2 text-[11px] text-red-400 hover:bg-red-950/45 transition-colors font-semibold flex items-center gap-1.5">
                                    <span className="relative flex h-2 w-2">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-650"></span>
                                    </span>
                                    Lập liên hoàn (KC)
                                </a>
                            </div>
                        )}
                    </div>
                    <div ref={responseLengthDropdownRef} className="relative w-full">
                         <Button type="button" variant="secondary" size="sm" className="w-full h-full justify-between text-[10px]" onClick={() => setIsResponseLengthDropdownOpen(!isResponseLengthDropdownOpen)} disabled={isLoadingUi || isSummarizingUi || !isCurrentlyActivePage || !!messageIdBeingEdited || isLocked || kcActive || !!uiState.matPhapStep}>
                            <span className="truncate max-w-[120px]">{responseLengthOptions.find(o => o.value === selectedResponseLength)?.label}</span>
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 ml-1 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        </Button>
                        {isResponseLengthDropdownOpen && ( <div className="absolute bottom-full right-0 mb-1 w-max bg-gray-600 rounded-md shadow-lg z-20">{responseLengthOptions.map(opt => ( <a key={opt.value} href="#" onClick={(e) => { e.preventDefault(); setSelectedResponseLength(opt.value); setIsResponseLengthDropdownOpen(false); }} className="block px-4 py-2 text-sm text-gray-200 hover:bg-indigo-500 first:rounded-t-md last:rounded-b-md">{opt.label}</a>))}</div> )}
                    </div>
                </div>
                <div className="flex w-full mt-1">
                    {uiState.matPhapStep ? (
                        <Button 
                            type="button" 
                            size="md" 
                            className="w-full text-xs bg-yellow-600 hover:bg-yellow-500 text-black font-semibold animate-pulse shadow-[0_0_15px_rgba(234,179,8,0.4)] border border-yellow-500 flex flex-col items-center justify-center py-2" 
                            onClick={handleMatPhapContinue} 
                            isLoading={isLoadingUi || uiState.isSyncingData}
                            loadingText="Đang chuyển pháp..."
                        >
                            <span className="flex items-center gap-1">
                                {uiState.matPhapStep === 'waiting_extraction' ? 'Chạy tiếp (Trích xuất)' : 'Chạy tiếp (Thiên Đạo)'} ➔
                            </span>
                            {matPhapCountdown !== null && (
                                <span className="text-[9px] opacity-80 mt-0.5">Tự động sau: {matPhapCountdown}s</span>
                            )}
                        </Button>
                    ) : (
                        <Button type="submit" size="md" className="w-full text-xs py-2" disabled={isLoadingUi || isSummarizingUi || playerInput.trim() === "" || !isCurrentlyActivePage || !!messageIdBeingEdited || isLocked || kcActive} isLoading={isButtonLoading} loadingText={`${VIETNAMESE.sendingAction} (${secondsElapsed}s)`}>
                            {VIETNAMESE.sendInputButton}
                        </Button>
                    )}
                </div>
            </div>
        </div>

        {/* --- DESKTOP LAYOUT --- */}
        <div className="hidden sm:flex gap-2 items-center">
            <textarea
                value={playerInput}
                onChange={(e) => setPlayerInput(e.target.value)}
                placeholder={uiState.matPhapStep ? "Vui lòng bấm nút 'Chạy tiếp' để hoàn tất toàn bộ chuỗi tác vụ Mạt Pháp." : (kcActive ? `HỆ THỐNG ĐANG TỰ ĐỘNG CHẠY KING CRIMSON (#${kcCurrentIndex + 1}/${kcQueue.length})...` : ((anyPresetEnabled ? true : knowledgeBase.isCustomInputAllowed !== false) === false ? "Ý chí của bạn đang bị hạn chế! Hãy sử dụng gợi ý từ AI." : (!isCurrentlyActivePage ? "Chỉ có thể hành động ở trang hiện tại nhất." : VIETNAMESE.enterAction)))}
                className="flex-grow w-full p-2.5 text-base bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 text-gray-100 placeholder-gray-400 resize-none"
                rows={1}
                disabled={isLoadingUi || isSummarizingUi || !isCurrentlyActivePage || !!messageIdBeingEdited || isLocked || kcActive || !!uiState.matPhapStep || (anyPresetEnabled ? false : knowledgeBase.isCustomInputAllowed === false)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && !uiState.matPhapStep && (anyPresetEnabled || knowledgeBase.isCustomInputAllowed !== false)) {
                        e.preventDefault();
                        handleSubmit(e as any);
                    }
                }}
            />
             <div className="flex gap-2 shrink-0 animate-in fade-in duration-300">
                <div ref={actionTypeDropdownRef} className="relative">
                    <Button type="button" variant="secondary" size="md" className="justify-between min-w-[130px] max-w-[240px]" onClick={() => setIsActionTypeDropdownOpen(!isActionTypeDropdownOpen)} disabled={isLoadingUi || isSummarizingUi || !isCurrentlyActivePage || !!messageIdBeingEdited || isLocked || kcActive || !!uiState.matPhapStep}>
                        <span className="truncate max-w-[160px]">{kcActive ? `⚡ KC (#${kcCurrentIndex + 1}/${kcQueue.length})` : (currentActionType === 'action' ? VIETNAMESE.inputTypeActionLabel : (anyPresetEnabled ? `Câu chuyện ( chỉ còn ${storyQuotaInfo.remaining} lần cho đến lượt ${storyQuotaInfo.limit})` : VIETNAMESE.inputTypeStoryLabel))}</span>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-2 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </Button>
                    {isActionTypeDropdownOpen && (
                        <div className="absolute bottom-full left-0 mb-1 w-56 bg-gray-800 border border-gray-700 rounded-md shadow-lg z-25 overflow-hidden">
                            <a href="#" onClick={(e) => { e.preventDefault(); setCurrentActionType('action'); setIsActionTypeDropdownOpen(false); }} className="block px-4 py-2.5 text-sm text-gray-200 hover:bg-gray-700 transition-colors">{VIETNAMESE.inputTypeActionLabel}</a>
                            <a href="#" onClick={(e) => { e.preventDefault(); setCurrentActionType('story'); setIsActionTypeDropdownOpen(false); }} className="block px-4 py-2.5 text-sm text-gray-200 hover:bg-gray-700 transition-colors border-t border-gray-700/50">{anyPresetEnabled ? `Câu chuyện ( chỉ còn ${storyQuotaInfo.remaining} lần cho đến lượt ${storyQuotaInfo.limit})` : VIETNAMESE.inputTypeStoryLabel}</a>
                            <div className="border-t border-gray-700"></div>
                            <a href="#" onClick={(e) => { e.preventDefault(); setIsKcModalOpen(true); setKingCrimsonInputs(['', '', '', '', '']); setIsActionTypeDropdownOpen(false); }} className="block px-4 py-3 text-sm text-red-400 hover:bg-red-950/45 transition-colors font-semibold flex items-center gap-2">
                                <span className="relative flex h-2.5 w-2.5">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-650"></span>
                                </span>
                                Lập liên hoàn (King Crimson)
                            </a>
                        </div>
                    )}
                </div>
                <div ref={responseLengthDropdownRef} className="relative">
                     <Button type="button" variant="secondary" size="md" className="justify-between" onClick={() => setIsResponseLengthDropdownOpen(!isResponseLengthDropdownOpen)} disabled={isLoadingUi || isSummarizingUi || !isCurrentlyActivePage || !!messageIdBeingEdited || isLocked || kcActive || !!uiState.matPhapStep}>
                        <span className="truncate max-w-[150px]">{responseLengthOptions.find(o => o.value === selectedResponseLength)?.label}</span>
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-2 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </Button>
                    {isResponseLengthDropdownOpen && ( <div className="absolute bottom-full right-0 mb-1 w-max bg-gray-600 rounded-md shadow-lg z-20">{responseLengthOptions.map(opt => ( <a key={opt.value} href="#" onClick={(e) => { e.preventDefault(); setSelectedResponseLength(opt.value); setIsResponseLengthDropdownOpen(false); }} className="block px-4 py-2 text-sm text-gray-200 hover:bg-indigo-500 first:rounded-t-md last:rounded-b-md">{opt.label}</a>))}</div> )}
                </div>
            </div>
            {uiState.matPhapStep ? (
                <Button 
                    type="button" 
                    size="lg" 
                    className="bg-yellow-600 hover:bg-yellow-500 text-black font-semibold animate-pulse shadow-[0_0_15px_rgba(234,179,8,0.4)] border border-yellow-500 min-w-[180px] flex flex-col items-center justify-center p-2" 
                    onClick={handleMatPhapContinue} 
                    isLoading={isLoadingUi || uiState.isSyncingData}
                    loadingText="Đang chuyển pháp..."
                >
                    <span className="flex items-center gap-1">
                        {uiState.matPhapStep === 'waiting_extraction' ? 'Chạy tiếp (Trích xuất)' : 'Chạy tiếp (Thiên Đạo)'} ➔
                    </span>
                    {matPhapCountdown !== null && (
                        <span className="text-[10px] opacity-80 mt-1 font-mono tracking-tighter">TỰ ĐỘNG SAU: {matPhapCountdown} GIÂY</span>
                    )}
                </Button>
            ) : (
                <Button type="submit" size="lg" disabled={isLoadingUi || isSummarizingUi || playerInput.trim() === "" || !isCurrentlyActivePage || !!messageIdBeingEdited || isLocked || kcActive} isLoading={isButtonLoading} loadingText={`${VIETNAMESE.sendingAction} (${secondsElapsed}s)`}>
                    {VIETNAMESE.sendInputButton}
                </Button>
            )}
        </div>
      </form>

      {/* --- KING CRIMSON CONFIGURATION MODAL --- */}
      {isKcModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-in fade-in duration-200">
              <div 
                  className="bg-gray-900 border border-red-800/80 rounded-xl shadow-[0_0_35px_rgba(220,38,38,0.25)] max-w-lg w-full flex flex-col overflow-hidden max-h-[90vh]"
                  onClick={(e) => e.stopPropagation()}
              >
                  {/* Modal Header */}
                  <div className="p-4 border-b border-red-950/80 bg-gradient-to-r from-red-950/40 via-gray-900 to-gray-900 flex justify-between items-center text-red-200 shrink-0">
                      <h3 className="text-sm sm:text-base font-bold tracking-wide flex items-center gap-2 font-sans">
                          <span className="text-red-500 text-lg animate-pulse">⚡</span>
                          THIẾT LẬP KING CRIMSON
                      </h3>
                      <button 
                          onClick={() => setIsKcModalOpen(false)} 
                          className="text-gray-400 hover:text-red-400 transition-colors p-1 rounded-full hover:bg-red-950/20"
                          type="button"
                      >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                  </div>

                  {/* Modal Body */}
                  <div className="p-4 space-y-4 overflow-y-auto custom-scrollbar flex-grow">
                      <div className="text-xs text-gray-400 border border-red-950/40 bg-red-950/10 p-3 rounded-lg leading-relaxed">
                          <p className="font-semibold text-red-400 mb-1 font-sans">Cơ chế xóa nhòa thời gian (King Crimson):</p>
                          Hệ thống sẽ thay bạn tự động gửi lần lượt các hành động từ <span className="text-red-400 font-bold">#1 đến #5</span>. Sau khi AI hoàn tất phản hồi một lượt, hệ thống sẽ tự động chờ <span className="text-red-400 font-bold">2 giây</span> rồi tự động gửi tiếp lượt sau. <span className="text-red-400 font-bold">(Yêu cầu nhập tối thiểu 2 ô)</span>. Các ô trống còn lại sẽ tự động bỏ qua.
                          <p className="mt-2 text-orange-400/90 italic font-medium">Chế độ áp dụng: {currentActionType === 'action' ? 'Hành động (Action)' : 'Câu chuyện (Story)'}</p>
                      </div>

                      <div className="space-y-3.5 pt-1">
                          {kingCrimsonInputs.map((inputVal, idx) => (
                              <div key={idx} className="space-y-1">
                                  <label className="text-[11px] font-bold text-gray-400 tracking-wider flex justify-between items-center font-mono">
                                      <span>LƯỢT BƯỚC #{idx + 1}</span>
                                      {inputVal.trim() === '' && <span className="text-[10px] text-gray-500 italic font-normal font-sans">(Để trống để bỏ qua)</span>}
                                  </label>
                                  <textarea
                                      value={inputVal}
                                      onChange={(e) => {
                                          const newInputs = [...kingCrimsonInputs];
                                          newInputs[idx] = e.target.value;
                                          setKingCrimsonInputs(newInputs);
                                      }}
                                      placeholder={`Nhập nội dung bước #${idx + 1}...`}
                                      className="w-full p-2.5 bg-gray-950 border border-gray-800 focus:border-red-900 focus:ring-1 focus:ring-red-900 rounded-lg text-sm text-gray-100 placeholder-gray-650 resize-none h-12 transition-all"
                                      rows={1}
                                  />
                              </div>
                          ))}
                      </div>
                  </div>

                  {/* Modal Footer */}
                  <div className="p-4 bg-gray-950 border-t border-red-950/50 flex items-center justify-between gap-2.5 shrink-0">
                      <Button
                          type="button"
                          variant="warning"
                          disabled={isPreparingCheckPrompt}
                          className="bg-amber-600/90 hover:bg-amber-500 text-stone-950 font-bold border-none shadow-md shadow-amber-950/40 px-4 text-xs"
                          onClick={handleCheck429Step5}
                      >
                          {isPreparingCheckPrompt ? (
                              <span className="flex items-center gap-1.5">
                                  <span className="w-3.5 h-3.5 border-2 border-stone-950 border-t-transparent rounded-full animate-spin" />
                                  Đang tải prompt...
                              </span>
                          ) : (
                              <span>🔍 Kiểm tra 429</span>
                          )}
                      </Button>

                      <div className="flex items-center gap-2.5">
                          <Button 
                              type="button" 
                              variant="secondary" 
                              onClick={() => setIsKcModalOpen(false)}
                          >
                              Hủy bỏ
                          </Button>
                          <Button 
                              type="button" 
                              variant="danger"
                              className="bg-red-800 hover:bg-red-700 border-none text-white shadow-md shadow-red-950/40 font-semibold px-5"
                              onClick={() => {
                                  const activeActions = kingCrimsonInputs.filter(val => val.trim() !== '');
                                  if (activeActions.length < 2) {
                                      showNotification("Vui lòng điền tối thiểu 2 ô hành động để kích hoạt King Crimson!", "warning");
                                      return;
                                  }
                                  // Activate King Crimson system via global context
                                  startKingCrimson(activeActions, currentActionType);
                                  
                                  // Clean current screen input field if any
                                  setPlayerInput('');
                                  
                                  // Close config modal
                                  setIsKcModalOpen(false);
                              }}
                          >
                              Kích hoạt (Xóa thời gian)
                          </Button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* Modal Kiểm Tra Prompt & Lỗi 429 */}
      <PromptCheck429Modal
          isOpen={isPromptCheckModalOpen}
          onClose={() => setIsPromptCheckModalOpen(false)}
          initialPrompt={checkPromptData.prompt}
          systemInstruction={checkPromptData.systemInstruction}
          actionText={checkPromptData.actionText}
          inputType={currentActionType}
          responseLength={selectedResponseLength}
          useGoogleSearch={checkPromptData.useGoogleSearch}
          isOocAction={checkPromptData.isOocAction}
          onApplyToGame={handleExecuteNormalTurnFromModal}
      />
    </div>
  );
};

export default PlayerInputArea;
