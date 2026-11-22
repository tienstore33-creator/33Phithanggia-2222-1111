
import React, { useRef, useCallback, useMemo, useLayoutEffect, useState, useEffect } from 'react';
import { callGeminiAPI } from '../services/apiService';
import { parseAttributes } from '../utils/attributeParser';
import { GameScreen, GameMessage, StyleSettings, StyleSettingProperty } from './../types';
import { VIETNAMESE } from './../constants';
import * as GameTemplates from '../templates'; // Import GameTemplates

// Import Layout Components
import GameHeader from './gameplay/layout/GameHeader';
import StoryLog from './gameplay/layout/StoryLog';
import { CombatTriggerOverlay } from './gameplay/CombatTriggerOverlay';
import PlayerInputArea from './gameplay/layout/PlayerInputArea';
import EconomicZoneBar from './gameplay/economy/EconomicZoneBar';
import EconomicZoneModal from './gameplay/economy/EconomicZoneModal';

// Import Panels & Modals
import OffCanvasPanel from './ui/OffCanvasPanel';
import CharacterSidePanel from './gameplay/CharacterSidePanel';
import QuestsSidePanel from './gameplay/QuestsSidePanel';
import WorldSidePanel from './gameplay/WorldSidePanel';
import DebugPanelDisplay from './gameplay/DebugPanelDisplay';
import MiniInfoPopover from './ui/MiniInfoPopover';
import Modal from './ui/Modal';
import { Clock } from 'lucide-react';
import VectorCheckModal from './gameplay/modals/VectorCheckModal';
import { apiRunningService } from '../services/apiRunningService';
import { generateTimelineEventsService, appendTimelineEventsService } from '../services/geminiService';
import { sanitizeTimelineEvents } from '../utils/sanitizeUtils';
import { StreamingConsole } from './gameSetup/StreamingConsole';

// Import Custom Hooks
import { usePlayerInput } from '../hooks/usePlayerInput';
import { usePopover } from '../hooks/usePopover';
import { useGame } from '../hooks/useGame';
import { useRealmBreakthrough } from '../hooks/useRealmBreakthrough';

// Import Utilities
import { parseAndHighlightText } from '../utils/textHighlighting';
import { applySkipPenalty, getRandomInsult } from '../src/logic/PenaltyManager';
import { checkAndInterceptTimeline } from '../utils/timelineInterceptor';
import { resolveCombatEntitiesByIds } from '../utils/pendingCombatEntityResolver';
import Button from './ui/Button'; // Import Button
import { DynamicCanvasEffect } from './DynamicCanvasEffect';
import { BackgroundYouTubePlayer } from './gameplay/BackgroundYouTubePlayer';

const getBackgroundColorByTime = (timeOfDay: 'Sáng' | 'Chiều' | 'Đêm'): string => {
    return 'bg-black';
};

const GameplayScreen: React.FC = () => {
    const game = useGame(); // Get all props from context
    const [isCorrectionModalOpen, setIsCorrectionModalOpen] = useState(false);
    
    // Vector Check Command States
    const [isVectorCheckModalOpen, setIsVectorCheckModalOpen] = useState(false);
    const [vectorCheckQuery, setVectorCheckQuery] = useState('');

    const handleCommand = useCallback((command: string, args: string) => {
        if (command === 'check') {
            setVectorCheckQuery(args);
            setIsVectorCheckModalOpen(true);
        }
    }, []);

    const pendingCorrections = useMemo(() => {
        return game.knowledgeBase.pendingCorrections?.filter(c => c.status === 'PENDING') || [];
    }, [game.knowledgeBase.pendingCorrections]);

    const handleResolveCorrection = useCallback((id: string, fixedTag: string) => {
        game.setKnowledgeBase(prev => {
            const next = JSON.parse(JSON.stringify(prev));
            const corrections = next.pendingCorrections || [];
            const idx = corrections.findIndex((c: any) => c.id === id);
            if (idx > -1) {
                corrections[idx].status = 'RESOLVED';
                corrections[idx].suggestedFix = fixedTag;
            }
            return next;
        });
    }, [game.setKnowledgeBase]);

    const handleIgnoreCorrection = useCallback((id: string) => {
        game.setKnowledgeBase(prev => {
            const next = JSON.parse(JSON.stringify(prev));
            const corrections = next.pendingCorrections || [];
            const idx = corrections.findIndex((c: any) => c.id === id);
            if (idx > -1) {
                corrections[idx].status = 'IGNORED';
            }
            return next;
        });
    }, [game.setKnowledgeBase]);

    const prevLoadingApiRef = useRef(false);

    const scrollToLatestNarration = useCallback(() => {
        if (!storyLogRef.current) return false;
        const storyLog = storyLogRef.current;
        
        // Tìm phần tử chứa nội dung lời kể của lượt mới nhất vừa được tạo
        const targetEl = (
            storyLog.querySelector('#latest-story-narration') || 
            storyLog.querySelector('[data-is-latest-narration="true"]')
        ) as HTMLElement;
        
        if (targetEl) {
            const containerRect = storyLog.getBoundingClientRect();
            const elementRect = targetEl.getBoundingClientRect();
            const relativeTop = elementRect.top - containerRect.top;
            
            storyLog.scrollTo({
                top: storyLog.scrollTop + relativeTop - 12,
                behavior: 'smooth'
            });
            return true;
        }
        return false;
    }, []);

    useEffect(() => {
        if (prevLoadingApiRef.current && !game.isLoadingApi) {
            // Sau khi tất cả các bước đã hoàn thành sau chót, người chơi có quyền hành động trở lại -> Tự động cuộn đến đầu lời kể lượt mới nhất vừa được tạo
            requestAnimationFrame(() => {
                if (!scrollToLatestNarration()) {
                    setTimeout(scrollToLatestNarration, 80);
                }
            });
            setTimeout(scrollToLatestNarration, 200);
        }
        prevLoadingApiRef.current = game.isLoadingApi;
    }, [game.isLoadingApi, scrollToLatestNarration]);
    const storyLogRef = useRef<HTMLDivElement>(null);
    const isAutoScrollRef = useRef(true); // Default to true for smart auto-scroll
    const lastScrollTopRef = useRef(0);   // Lưu trữ vị trí cuộn cuối cùng của người dùng
    const [combatButtonCooldown, setCombatButtonCooldown] = useState(0);

    // Use custom hooks for UI state not needed globally
    const { isReaderMode, setIsReaderMode, isCharPanelOpen, setIsCharPanelOpen, isQuestsPanelOpen, setIsQuestsPanelOpen, isWorldPanelOpen, setIsWorldPanelOpen, showDebugPanel, setShowDebugPanel, setUiState, uiState } = useGame();
    const { popover, handleKeywordClick, closePopover } = usePopover();
    const [isMiniGameVisible, setIsMiniGameVisible] = useState(true);
    const [isTimelineModalOpen, setIsTimelineModalOpen] = useState(false);
    const [showTimelineWarningBanner, setShowTimelineWarningBanner] = useState(false);
    const [isGeneratingMore, setIsGeneratingMore] = useState(false);
    const [timelineAnswer, setTimelineAnswer] = useState<string>('');
    const [streamingText, setStreamingText] = useState('');
    const [isStreamingActive, setIsStreamingActive] = useState(false);
    const [isRagActive, setIsRagActive] = useState(() => localStorage.getItem('isRagSystemActive') === 'true');

    const [isAllyListExpanded, setIsAllyListExpanded] = useState(false);
    const [isOpponentListExpanded, setIsOpponentListExpanded] = useState(false);
    const [showFleeConfirmModal, setShowFleeConfirmModal] = useState(false);

    const allyNPCs = useMemo(() => {
        if (!game.knowledgeBase?.pendingCombat) return [];
        const combinedAllyIds = Array.from(new Set([
            ...(game.knowledgeBase.pendingCombat.allyIds || []),
            ...(game.knowledgeBase.combatCompanionIds || [])
        ]));
        return resolveCombatEntitiesByIds(combinedAllyIds, game.knowledgeBase);
    }, [game.knowledgeBase?.pendingCombat?.allyIds, game.knowledgeBase?.combatCompanionIds, game.knowledgeBase?.pendingCombat?.temporaryEntities, game.knowledgeBase?.discoveredNPCs, game.knowledgeBase?.discoveredYeuThu, game.knowledgeBase?.wives, game.knowledgeBase?.slaves, game.knowledgeBase?.prisoners]);

    const opponentNPCs = useMemo(() => {
        if (!game.knowledgeBase?.pendingCombat) return [];
        return resolveCombatEntitiesByIds(game.knowledgeBase.pendingCombat.opponentIds || [], game.knowledgeBase);
    }, [game.knowledgeBase?.pendingCombat?.opponentIds, game.knowledgeBase?.pendingCombat?.temporaryEntities, game.knowledgeBase?.discoveredNPCs, game.knowledgeBase?.discoveredYeuThu, game.knowledgeBase?.wives, game.knowledgeBase?.slaves, game.knowledgeBase?.prisoners]);

    useEffect(() => {
        const handleRagChange = () => {
            setIsRagActive(localStorage.getItem('isRagSystemActive') === 'true');
        };
        window.addEventListener('rag-system-change', handleRagChange);
        return () => window.removeEventListener('rag-system-change', handleRagChange);
    }, []);

    const [apiState, setApiState] = useState(() => apiRunningService.getState());
    const [elapsedTime, setElapsedTime] = useState(0);

    useEffect(() => {
        const unsubscribe = apiRunningService.subscribe((newState) => {
            setApiState(newState);
        });
        return unsubscribe;
    }, []);

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (apiState.isProcessing && apiState.startTime) {
            interval = setInterval(() => {
                setElapsedTime(Math.floor((Date.now() - apiState.startTime!) / 1000));
            }, 1000);
        } else {
            setElapsedTime(0);
        }
        return () => clearInterval(interval);
    }, [apiState.isProcessing, apiState.startTime]);

    const handleGenerateMoreEvents = async () => {
        setIsGeneratingMore(true);
        setStreamingText('');
        setIsStreamingActive(true);
        try {
            const events = game.knowledgeBase.worldConfig?.timelineEvents || [];
            const theme = game.knowledgeBase.worldConfig?.theme || "Tiên hiệp";
            const originalStorySummary = game.knowledgeBase.worldConfig?.originalStorySummary || "Cốt truyện nhập vai";

            let result: { events: any[], rawText: string };
            if (events.length === 0) {
                // Nếu chưa có sự kiện nào: tiêm tên nguyên tác (chủ đề thế giới) cùng content 2 lượt gần nhất
                const recent2TurnsContent = (game.gameMessages || [])
                    .slice(-2)
                    .map(m => m.content)
                    .filter(Boolean)
                    .join('\n\n---\n\n');

                const storyContextWithRecent = [
                    originalStorySummary,
                    `[TÊN NGUYÊN TÁC / CHỦ ĐỀ THẾ GIỚI]: ${theme}`,
                    recent2TurnsContent ? `[DIỄN BIẾN 2 LƯỢT GẦN NHẤT ĐỂ TRA CỨU MẠCH TRUYỆN VÀ VIẾT TIẾP NỐI]:\n${recent2TurnsContent}` : ''
                ].filter(Boolean).join('\n\n');

                result = await generateTimelineEventsService(
                    storyContextWithRecent,
                    theme,
                    undefined,
                    undefined,
                    (chunk) => setStreamingText(chunk),
                    (msg) => game.showNotification(msg, "info")
                );
            } else {
                // Nếu đã có ít nhất một sự kiện thì dùng appendTimelineEventsService với 5 sự kiện gần nhất
                const last5Events = events.slice(-5);
                result = await appendTimelineEventsService(
                    last5Events,
                    theme,
                    originalStorySummary,
                    undefined,
                    events.length + 1,
                    undefined,
                    (chunk) => setStreamingText(chunk),
                    (msg) => game.showNotification(msg, "info")
                );
            }

            const newEvents = sanitizeTimelineEvents(result.events || []);
            if (newEvents.length === 0) {
                game.showNotification("Không thể phân tích dữ liệu sự kiện từ AI. Vui lòng thử lại!", "error");
                return;
            }

            const updatedTimelineEvents = sanitizeTimelineEvents([...events, ...newEvents]);

            if (!game.knowledgeBase.worldConfig) {
                game.showNotification("Không tìm thấy worldConfig. Không thể lưu sự kiện!", "error");
                return;
            }

            const updatedKb = {
                ...game.knowledgeBase,
                worldConfig: {
                    ...game.knowledgeBase.worldConfig,
                    timelineEvents: updatedTimelineEvents
                }
            };

            // Tách phần văn bản giải thích của AI nếu có
            const firstTagIndex = result.rawText.indexOf('[GENERATED_TIMELINE_EVENT');
            let aiExplanation = '';
            if (firstTagIndex !== -1) {
                aiExplanation = result.rawText.substring(0, firstTagIndex).trim();
            } else {
                aiExplanation = result.rawText.trim();
            }
            aiExplanation = aiExplanation.replace(/^```[a-zA-Z]*\n?/, '').replace(/```$/, '').trim();

            if (aiExplanation) {
                setTimelineAnswer(aiExplanation);
                const disclosureMessage: GameMessage = {
                    id: `timeline_disclosure_${Date.now()}`,
                    type: 'system',
                    content: `🔮 **[TIẾT LỘ NGUYÊN TÁC - DÒNG THỜI GIAN]**\n\n**Hỏi**: *Tiết lộ các sự kiện tiếp theo trong dòng thời gian?*\n\n**Trả lời từ AI**:\n${aiExplanation}`,
                    timestamp: Date.now(),
                    turnNumber: game.knowledgeBase.playerStats?.turn ?? 1
                };
                game.addMessageAndUpdateState([disclosureMessage], updatedKb);
            } else {
                game.setKnowledgeBase(updatedKb);
            }

            game.showNotification(`Đã tạo thêm +${newEvents.length} sự kiện mới vào dòng thời gian!`, "success");
            game.setUiState(prev => ({
                ...prev,
                timelineWarningDismissCount: 0,
                lastTimelineWarningTurn: undefined
            }));
            setShowTimelineWarningBanner(false);

        } catch (err: any) {
            console.error("Lỗi khi tạo thêm sự kiện:", err);
            game.showNotification("Gặp lỗi khi tạo sự kiện mới: " + err.message, "error");
        } finally {
            setIsGeneratingMore(false);
            setIsStreamingActive(false);
        }
    };

    const handleCloseTimelineModal = useCallback(() => {
        setIsTimelineModalOpen(false);
        setShowTimelineWarningBanner(false);
        const currentTurn = game.knowledgeBase.playerStats?.turn ?? 0;
        const currentDismiss = game.uiState?.timelineWarningDismissCount ?? 0;
        game.setUiState(prev => ({
            ...prev,
            lastTimelineWarningTurn: currentTurn,
            timelineWarningDismissCount: currentDismiss + 1
        }));
    }, [game.knowledgeBase.playerStats?.turn, game.uiState?.timelineWarningDismissCount, game.setUiState]);

    const handleDecoratedPlayerAction = async (action: string, isChoice: boolean, inputType: any, responseLength: any) => {
        // Kiểm tra dòng thời gian. Trả về true nếu bị chặn do hết sự kiện
        const isIntercepted = checkAndInterceptTimeline({
            game,
            setShowTimelineWarningBanner,
            setIsTimelineModalOpen,
        });

        if (isIntercepted) {
            // Tách luồng: Chỉ hiện Modal, ném ngoại lệ để dừng luồng và GIỮ NGUYÊN VĂN BẢN NHẬP
            throw new Error("TIMELINE_INTERCEPTED");
        }

        await game.handlePlayerAction(action, isChoice, inputType, responseLength);
    };

    const {
        playerInput, setPlayerInput, currentActionType, setCurrentActionType,
        isActionTypeDropdownOpen, setIsActionTypeDropdownOpen,
        isResponseLengthDropdownOpen, setIsResponseLengthDropdownOpen, showAiSuggestions, setShowAiSuggestions,
        actionTypeDropdownRef, responseLengthDropdownRef, handleChoiceClick, handleSubmit
    } = usePlayerInput({
        onPlayerAction: handleDecoratedPlayerAction,
        isLoading: game.isLoadingApi,
        isSummarizing: game.isSummarizingOnLoad,
        isCurrentlyActivePage: true,
        messageIdBeingEdited: game.messageIdBeingEdited,
        selectedResponseLength: game.selectedResponseLength,
        setSelectedResponseLength: game.setSelectedResponseLength,
        onCommand: handleCommand
    });

    const isLoadingUi = game.isLoadingApi || game.isUploadingAvatar;
    const isSummarizingUi = game.isSummarizingOnLoad;

    // Countdown effect for the combat button
    useEffect(() => {
        let timer: number | undefined;
        if (game.knowledgeBase.pendingCombat && !uiState.pendingCombatNoticeHidden) {
            setCombatButtonCooldown(7);
            timer = window.setInterval(() => {
                setCombatButtonCooldown(prev => {
                    if (prev <= 1) {
                        clearInterval(timer);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        } else {
            setCombatButtonCooldown(0); // Reset if combat is no longer pending or hidden
        }

        return () => {
            if (timer) {
                clearInterval(timer);
            }
        };
    }, [game.knowledgeBase.pendingCombat, uiState.pendingCombatNoticeHidden]);

    // Scroll management
    const SCROLL_TOLERANCE = 150;

    const handleScroll = useCallback(() => {
        if (!storyLogRef.current) return;
        
        const { scrollTop, scrollHeight, clientHeight } = storyLogRef.current;
        
        // Nếu khoảng cách tới đáy < SCROLL_TOLERANCE, coi như đang cuộn tự động (người dùng muốn bám sát tin mới)
        const isAtBottom = scrollHeight - scrollTop - clientHeight < SCROLL_TOLERANCE;
        
        isAutoScrollRef.current = isAtBottom;
        if (!isAtBottom) {
            lastScrollTopRef.current = scrollTop;
        }
    }, []);

    // Kích hoạt cơ chế cuộn tự động thông minh (Scroll Stability)
    // ĐÃ VÔ HIỆU HÓA THEO YÊU CẦU NGƯỜI DÙNG: Không tự động nhảy camera khi đang đọc/streaming
    useLayoutEffect(() => {
        // Tắt hoàn toàn việc tự động cuộn để tránh làm phiền người dùng đang đọc
        /*
        const storyLog = storyLogRef.current;
        if (!storyLog) return;

        if (isAutoScrollRef.current) {
            if (game.isStreaming) {
                storyLog.scrollTop = storyLog.scrollHeight;
            } else {
                storyLog.scrollTo({ top: storyLog.scrollHeight, behavior: 'auto' });
            }
        }
        */
    }, [game.gameMessages, game.streamingText, game.isStreaming, isLoadingUi]);

    useEffect(() => {
        const handleEsc = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                closePopover();
                game.setIsStyleSettingsModalOpen(false);
                game.closeModal();
                game.closeEconomyModal();
                game.closeSlaveMarketModal();
                if (game.messageIdBeingEdited) game.onCancelEditMessage();
            }
        };
        document.addEventListener('keydown', handleEsc);
        return () => document.removeEventListener('keydown', handleEsc);
    }, [closePopover, game]);
    
    // Correctly implemented style function for story messages
    const getDynamicMessageStyles = useCallback((msgType: GameMessage['type']): React.CSSProperties => {
        const styles: React.CSSProperties = {};
        let settingsToApply: StyleSettingProperty | undefined;

        switch (msgType) {
            case 'narration':
                settingsToApply = game.styleSettings.narration;
                break;
            case 'player_action':
                settingsToApply = game.styleSettings.playerAction;
                break;
            default:
                return {}; // No custom styles for system, error, etc.
        }

        if (settingsToApply) {
            if (settingsToApply.fontFamily && settingsToApply.fontFamily !== 'inherit') {
                styles.fontFamily = settingsToApply.fontFamily;
            }
            if (settingsToApply.fontSize && settingsToApply.fontSize !== 'inherit') {
                styles.fontSize = settingsToApply.fontSize;
            }
            if (settingsToApply.textColor) {
                styles.color = settingsToApply.textColor;
            }
            if (settingsToApply.backgroundColor) {
                styles.backgroundColor = settingsToApply.backgroundColor;
            }
        }

        return styles;
    }, [game.styleSettings]);
    
    // Correctly implemented style function for choice buttons
    const getChoiceButtonStyles = useCallback((): React.CSSProperties => {
        const styles: React.CSSProperties = {};
        const settingsToApply = game.styleSettings.choiceButton;
    
        if (settingsToApply) {
            if (settingsToApply.fontFamily && settingsToApply.fontFamily !== 'inherit') {
                styles.fontFamily = settingsToApply.fontFamily;
            }
            if (settingsToApply.fontSize && settingsToApply.fontSize !== 'inherit') {
                styles.fontSize = settingsToApply.fontSize;
            }
            if (settingsToApply.textColor) {
                styles.color = settingsToApply.textColor;
            }
            if (settingsToApply.backgroundColor && settingsToApply.backgroundColor !== 'transparent') {
                styles.backgroundColor = settingsToApply.backgroundColor;
            }
        }
        return styles;
    }, [game.styleSettings]);


    const gameTitleDisplay = game.knowledgeBase.manualSaveName || game.knowledgeBase.worldConfig?.saveGameName || game.knowledgeBase.worldConfig?.theme || "Role Play AI";

    const currentLocation = game.knowledgeBase?.discoveredLocations?.find(l => l.id === game.knowledgeBase.currentLocationId);
    
    // Find main location for economic data (Economic Provider)
    const economicMainLocation = useMemo(() => {
        if (!currentLocation) return null;
        
        let root = currentLocation;
        const visitedIds = new Set<string>();
        
        while (root.parentLocationId && !visitedIds.has(root.parentLocationId)) {
            visitedIds.add(root.id);
            const parent = game.knowledgeBase?.discoveredLocations?.find(l => l.id === root.parentLocationId);
            if (!parent) break;
            root = parent;
        }
        return root;
    }, [currentLocation, game.knowledgeBase?.discoveredLocations]);

    const [isEconomicZoneModalOpen, setIsEconomicZoneModalOpen] = useState(false);
    
    const economicZones = useMemo(() => {
        return economicMainLocation?.economicZones || [];
    }, [economicMainLocation]);

    const economySubLocations = useMemo(() => {
        if (!economicMainLocation) return [];
        
        // Find all descendants of economicMainLocation
        const descendants = new Set<string>();
        const toCheck = [economicMainLocation.id];
        
        const allLocs = game.knowledgeBase.discoveredLocations;
        
        while (toCheck.length > 0) {
            const parentId = toCheck.pop()!;
            for (const loc of allLocs) {
                if (loc.parentLocationId === parentId && !descendants.has(loc.id)) {
                    descendants.add(loc.id);
                    toCheck.push(loc.id);
                }
            }
        }

        return allLocs.filter(loc =>
            descendants.has(loc.id) &&
            (Object.values(GameTemplates.EconomyLocationType).includes(loc.locationType as any))
        );
    }, [economicMainLocation, game.knowledgeBase.discoveredLocations]);

    const isLifespanExhausted = typeof game.knowledgeBase.playerStats?.thoNguyen === 'number' && game.knowledgeBase.playerStats.thoNguyen < 1;
    const isPlayerDead = (game.knowledgeBase.playerStats?.isDead || isLifespanExhausted) && !game.knowledgeBase.playerStats?.reincarnationPhase;

    // --- REINCARNATION / SAMSARA FLOW LOGIC ---
    const handleSelectReincarnationPath = async () => {
        if (isLoadingUi || game.isLoadingApi || game.uiState.isSyncingData) return;
        await (game as any).handleActivePlayerDeath('samsara');
    };

    return (
        <div className={`h-screen h-[100dvh] overflow-hidden flex flex-col text-gray-100 relative transition-colors duration-1000 ease-in-out ${isReaderMode ? 'p-0' : 'p-0 sm:p-4'} ${getBackgroundColorByTime(game.knowledgeBase.worldDate.timeOfDay)}`}>
             {!isReaderMode && <GameHeader gameTitleDisplay={gameTitleDisplay} />}
            
            <div className={`flex-grow flex flex-col bg-black overflow-hidden relative min-h-0 ${isReaderMode ? 'rounded-none' : 'rounded-none sm:rounded-lg'}`}>
                {/* Lớp Canvas vẽ hiệu ứng tự do từ Prompt Studio */}
                <DynamicCanvasEffect screenName="story" />

                {/* V5.1: Data Sync Indicator (Anti-Slop Modern Sleek Design) */}
                {uiState.isSyncingData && (
                    <div className="absolute top-0 left-0 right-0 z-50 bg-black/90 backdrop-blur-md border-b border-cyan-500/30 text-cyan-400 text-[10px] font-mono tracking-wider py-1.5 px-3 flex items-center justify-center gap-2 animate-in fade-in slide-in-from-top-full duration-300 shadow-md shadow-cyan-950/20">
                        <span className="relative flex h-1.5 w-1.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-cyan-500"></span>
                        </span>
                        <span className="font-bold uppercase tracking-wider">
                            ⚡ ĐANG ĐỒNG BỘ THIÊN ĐẠO & DỮ LIỆU...
                        </span>
                    </div>
                )}
                {/* Auto Map Expansion Indicator */}
                {uiState.isExpandingMap && (
                    <div className="absolute top-0 left-0 right-0 z-50 bg-indigo-600/90 text-white text-[10px] font-bold py-0.5 px-2 flex items-center justify-center gap-2 animate-in fade-in slide-in-from-top-full duration-300">
                        <div className="w-2 h-2 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>ĐANG THĂM DÒ KHU VỰC XUNG QUANH...</span>
                    </div>
                )}
                <StoryLog 
                    storyLogRef={storyLogRef}
                    displayedMessages={game.gameMessages}
                    isLoadingUi={isLoadingUi}
                    isSummarizingUi={isSummarizingUi}
                    isCurrentlyActivePage={true}
                    knowledgeBase={game.knowledgeBase}
                    uiState={game.uiState}
                    styleSettings={game.styleSettings}
                    messageIdBeingEdited={game.messageIdBeingEdited}
                    currentEditText={""} // The parent context will handle the actual edit text state
                    setCurrentEditText={() => {}} // Parent handles
                    onStartEditMessage={game.onStartEditMessage}
                    onSaveEditedMessage={game.onSaveEditedMessage}
                    onCancelEditMessage={game.onCancelEditMessage}
                    parseAndHighlightText={(text, skipKeywords) => parseAndHighlightText(text, game.knowledgeBase, game.styleSettings, handleKeywordClick, skipKeywords)}
                    getDynamicMessageStyles={getDynamicMessageStyles}
                    onScroll={handleScroll}
                    onClick={() => {
                        setIsReaderMode(prev => !prev);
                        setIsMiniGameVisible(false); // Close mini-game when clicking narration
                    }}
                    isStreaming={game.isStreaming}
                    streamingText={game.streamingText}
                />
                 
                  <div className={isReaderMode ? "hidden" : "contents"}>
                    <>
                        <EconomicZoneBar 
                            zones={economicZones}
                            subLocations={economySubLocations}
                            isMainLocation={!currentLocation?.parentLocationId}
                            onEnterZone={game.handleEnterEcoZone}
                            onEnterSubLocation={(loc) => {
                                if (loc.locationType === GameTemplates.EconomyLocationType.MARKETPLACE) {
                                    game.setActiveEconomyModal({ type: 'marketplace', locationId: loc.id });
                                } else if (loc.locationType === GameTemplates.EconomyLocationType.SHOPPING_CENTER) {
                                    game.setActiveEconomyModal({ type: 'shopping_center', locationId: loc.id });
                                } else if (loc.locationType === GameTemplates.EconomyLocationType.AUCTION_HOUSE) {
                                    game.handleStartAuction(loc.id);
                                } else if (loc.locationType === GameTemplates.EconomyLocationType.SLAVE_MARKET) {
                                    game.setActiveSlaveMarketModal({ locationId: loc.id });
                                } else if (loc.locationType === GameTemplates.EconomyLocationType.SLAVE_AUCTION) {
                                    game.handleStartSlaveAuction(loc.id);
                                }
                            }}
                            onInitialize={game.handleInitializeEconomicZones}
                            isLoading={game.isLoadingApi}
                            disabled={isLoadingUi || isSummarizingUi || !!game.messageIdBeingEdited || !!game.knowledgeBase.pendingCombat || !!game.knowledgeBase.postCombatState}
                            isModalOpen={isEconomicZoneModalOpen}
                            setIsModalOpen={setIsEconomicZoneModalOpen}
                        />

                        {isEconomicZoneModalOpen && (
                            <EconomicZoneModal 
                                isOpen={isEconomicZoneModalOpen}
                                onClose={() => setIsEconomicZoneModalOpen(false)}
                                zones={economicZones}
                                subLocations={economySubLocations}
                                onEnterStub={game.handleEnterEcoZone}
                                onEnterSubLocation={(loc) => {
                                    if (loc.locationType === GameTemplates.EconomyLocationType.MARKETPLACE) {
                                        game.setActiveEconomyModal({ type: 'marketplace', locationId: loc.id });
                                    } else if (loc.locationType === GameTemplates.EconomyLocationType.SHOPPING_CENTER) {
                                        game.setActiveEconomyModal({ type: 'shopping_center', locationId: loc.id });
                                    } else if (loc.locationType === GameTemplates.EconomyLocationType.AUCTION_HOUSE) {
                                        game.handleStartAuction(loc.id);
                                    } else if (loc.locationType === GameTemplates.EconomyLocationType.SLAVE_MARKET) {
                                        game.setActiveSlaveMarketModal({ locationId: loc.id });
                                    } else if (loc.locationType === GameTemplates.EconomyLocationType.SLAVE_AUCTION) {
                                        game.handleStartSlaveAuction(loc.id);
                                    }
                                    setIsEconomicZoneModalOpen(false);
                                }}
                                isLoading={game.isLoadingApi}
                                disabled={isLoadingUi || isSummarizingUi || !!game.messageIdBeingEdited || !!game.knowledgeBase.pendingCombat || !!game.knowledgeBase.postCombatState}
                            />
                        )}

                        {game.knowledgeBase.pendingCombat && !uiState.pendingCombatNoticeHidden ? (
                            <div className="p-4 bg-gray-900/90 border-t-2 border-red-500 flex flex-col items-center justify-center gap-4">
                                <div className="w-full flex items-center justify-between gap-2">
                                    <Button 
                                        id="pending-combat-squad-btn"
                                        variant="secondary" 
                                        size="sm"
                                        onClick={() => game.setIsCompanionSelectionModalOpen(true)}
                                        disabled={isSummarizingUi}
                                        className="bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-500/50 text-cyan-300 hover:text-cyan-200 font-bold text-xs sm:text-sm shadow-md flex items-center gap-1.5 shrink-0"
                                        title="Chọn đội hình chiến đấu (Nô lệ, tù binh xuất trận)"
                                    >
                                        🛡️ Đội Hình
                                    </Button>
                                    <h3 className="text-base sm:text-xl font-bold text-red-400 uppercase tracking-widest text-center flex-1">
                                        {VIETNAMESE.pendingCombatNotice}
                                    </h3>
                                    <div className="w-20 hidden sm:block shrink-0"></div>
                                </div>
                                
                                {/* Nút thao tác nhanh chuyển lên đầu theo yêu cầu */}
                                <div className="flex flex-wrap items-center justify-center gap-3">
                                    <Button 
                                        variant="secondary" 
                                        size="md"
                                        onClick={() => game.onAutoCombat()}
                                        disabled={isSummarizingUi || combatButtonCooldown > 0 || !game.knowledgeBase.pendingCombat.analyzed}
                                        className="bg-indigo-900/70 hover:bg-indigo-800 border border-indigo-500/50 text-indigo-200 font-bold text-sm shadow-md"
                                        title="Hệ thống tự động so khớp lực chiến, định đoạt kết quả và thương vong"
                                    >
                                        ⚡ Tự Động Chiến Đấu
                                    </Button>

                                    <Button 
                                        variant="warning" 
                                        size="md"
                                        onClick={() => setShowFleeConfirmModal(true)}
                                        disabled={isSummarizingUi || combatButtonCooldown > 0 || !game.knowledgeBase.pendingCombat.analyzed}
                                        className="bg-amber-950/70 hover:bg-amber-900 border border-amber-500/50 text-amber-300 font-bold text-sm shadow-md"
                                        title="100% thoát hiểm nhưng mất 1 tiểu cảnh giới, 70% tiền, giảm 50 thiện cảm"
                                    >
                                        🏃 Bỏ Chạy
                                    </Button>
                                </div>

                                {game.knowledgeBase.pendingCombat.analyzed ? (
                                    <div className="w-full max-w-2xl grid grid-cols-2 gap-4 my-2">
                                        <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-3 flex flex-col justify-between">
                                            <div>
                                                <h4 className="text-blue-400 font-bold mb-2 text-center border-b border-blue-500/30 pb-1">Phe Ta (Đồng Minh)</h4>
                                                <div className="max-h-60 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-blue-500/30 scrollbar-track-transparent">
                                                    <ul className="text-sm text-gray-300 space-y-1">
                                                        <li className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-blue-500"></span>{game.knowledgeBase.worldConfig?.playerName || "Người chơi"}</li>
                                                        {(isAllyListExpanded ? allyNPCs : allyNPCs.slice(0, 3)).map(npc => (
                                                            <li key={npc.id} className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-blue-400"></span>{npc.name}</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            </div>
                                            {allyNPCs.length > 3 && (
                                                <button 
                                                    onClick={() => setIsAllyListExpanded(!isAllyListExpanded)}
                                                    className="w-full mt-2 py-1 text-center bg-blue-950/40 hover:bg-blue-900/60 text-blue-400 hover:text-blue-300 border border-blue-500/20 rounded-md transition-all text-xs font-bold flex items-center justify-center gap-1"
                                                >
                                                    {isAllyListExpanded ? (
                                                        <>Ẩn bớt ▲</>
                                                    ) : (
                                                        <>Xem thêm ({allyNPCs.length - 3}) v</>
                                                    )}
                                                </button>
                                            )}
                                        </div>
                                        <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-3 flex flex-col justify-between">
                                            <div>
                                                <h4 className="text-red-400 font-bold mb-2 text-center border-b border-red-500/30 pb-1">Phe Địch (Đối Thủ)</h4>
                                                <div className="max-h-60 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-red-500/30 scrollbar-track-transparent">
                                                    <ul className="text-sm text-gray-300 space-y-1">
                                                        {(() => {
                                                             const allyCount = Math.max(1, allyNPCs.length + 1);
                                                             const maxAllowedOpponents = allyCount * 3;
                                                             const displayedList = isOpponentListExpanded ? opponentNPCs : opponentNPCs.slice(0, 3);
                                                             return displayedList.map((npc, idx) => {
                                                                 const isDimmed = idx >= maxAllowedOpponents;
                                                                 return (
                                                                     <li key={npc.id || idx} className={`flex items-center gap-2 ${isDimmed ? "opacity-40 grayscale text-gray-500 italic" : ""}`}>
                                                                         <span className={`w-2 h-2 rounded-full ${isDimmed ? "bg-gray-600" : "bg-red-500"}`}></span>
                                                                         <span className={isDimmed ? "line-through" : ""}>{npc.name}</span>
                                                                         {isDimmed && <span className="text-[10px] text-gray-400 font-normal ml-1">(Làm mờ / Dự bị)</span>}
                                                                     </li>
                                                                 );
                                                             });
                                                          })()}
                                                    </ul>
                                                </div>
                                            </div>
                                            {opponentNPCs.length > 3 && (
                                                <button 
                                                    onClick={() => setIsOpponentListExpanded(!isOpponentListExpanded)}
                                                    className="w-full mt-2 py-1 text-center bg-red-950/40 hover:bg-red-900/60 text-red-400 hover:text-red-300 border border-red-500/20 rounded-md transition-all text-xs font-bold flex items-center justify-center gap-1"
                                                >
                                                    {isOpponentListExpanded ? (
                                                        <>Ẩn bớt ▲</>
                                                    ) : (
                                                        <>Xem thêm ({opponentNPCs.length - 3}) v</>
                                                    )}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-sm text-gray-400 italic animate-pulse">Đang phân tích lực lượng tham chiến...</p>
                                )}

                                <div className="flex flex-wrap items-center justify-center gap-3 mt-2">
                                    <Button 
                                        variant="danger" 
                                        size="lg"
                                        onClick={() => {
                                            game.setUiState(prev => ({ ...prev, pendingCombatNoticeHidden: false }));
                                            game.setCurrentScreen(GameScreen.Combat);
                                        }}
                                        disabled={isSummarizingUi || combatButtonCooldown > 0 || !game.knowledgeBase.pendingCombat.analyzed}
                                    >
                                        {combatButtonCooldown > 0 ? `${VIETNAMESE.startCombatButton} (${combatButtonCooldown}s)` : `⚔️ ${VIETNAMESE.startCombatButton}`}
                                    </Button>
                                </div>
                            </div>
                        ) : isPlayerDead ? (
                            <div className="p-6 bg-stone-950/95 border-t-2 border-red-600 flex flex-col items-center justify-center gap-4 animate-fade-in shadow-2xl z-50">
                                <div className="flex items-center justify-center gap-3 text-red-400 font-bold text-lg sm:text-xl uppercase tracking-wider">
                                    <span className="text-2xl animate-pulse">💀</span>
                                    <span>CHUNG CỰC TỬ VONG - LINH HỒN PHIÊU DẠT</span>
                                </div>
                                <p className="text-gray-300 text-sm max-w-2xl text-center leading-relaxed">
                                    {isLifespanExhausted ? (
                                        <>Nhân vật chính <strong className="text-amber-400 font-bold">{game.knowledgeBase.worldConfig?.playerName || "Bạn"}</strong> đã tọa hóa quy thiên do cạn kiệt thọ nguyên. Tàn hồn quy về quy trình <strong className="text-red-400">Chung Cực Tử Vong</strong> để tiến vào Không Gian Luân Hồi tái sinh kiếp mới.</>
                                    ) : (
                                        <>Nhân vật chính <strong className="text-amber-400 font-bold">{game.knowledgeBase.worldConfig?.playerName || "Bạn"}</strong> đã tử vong / tự hủy nhục thân. Tàn hồn quy về quy trình <strong className="text-red-400">Chung Cực Tử Vong</strong> để tiến vào Bánh xe Luân Hồi tái sinh chuyển kiếp.</>
                                    )}
                                </p>
                                <div className="pt-2 flex justify-center w-full max-w-sm">
                                    <Button
                                        size="lg"
                                        variant="primary"
                                        onClick={handleSelectReincarnationPath}
                                        disabled={isLoadingUi || isSummarizingUi || game.isLoadingApi || game.uiState.isSyncingData}
                                        className="w-full bg-gradient-to-r from-blue-900 via-indigo-900 to-purple-900 hover:from-blue-800 hover:to-purple-800 border border-blue-500/50 text-white font-bold py-3.5 px-6 rounded-xl shadow-lg transform transition hover:scale-[1.02] flex flex-col items-center justify-center gap-1 disabled:opacity-50"
                                    >
                                        <div className="flex items-center gap-2 text-sm tracking-wide">
                                            <span>☸️</span>
                                            <span>LUÂN HỒI TÁI SINH</span>
                                        </div>
                                        <span className="text-[11px] font-normal text-blue-200/80">Khởi tạo nhân vật mới, kế thừa thế giới quan</span>
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="relative">
                                    {game.knowledgeBase.pendingCombat && uiState.pendingCombatNoticeHidden && (
                                        <div className="bg-red-950/90 border border-red-500/60 rounded-lg p-3 mx-4 mb-2 flex items-center justify-between shadow-lg">
                                            <span className="text-red-300 text-sm font-semibold flex items-center gap-2">
                                                ⚔️ Bạn đang có trận chiến chưa hoàn thành!
                                            </span>
                                            <Button
                                                variant="danger"
                                                size="sm"
                                                onClick={() => setUiState(prev => ({ ...prev, pendingCombatNoticeHidden: false }))}
                                            >
                                                Xem trận chiến
                                            </Button>
                                        </div>
                                    )}
                                    <PlayerInputArea 
                                        latestMessageWithChoices={[...game.gameMessages].reverse().find(msg => msg.type === 'narration' && msg.choices && msg.choices.length > 0)}
                                        showAiSuggestions={showAiSuggestions} setShowAiSuggestions={setShowAiSuggestions}
                                        playerInput={playerInput} setPlayerInput={setPlayerInput}
                                        currentActionType={currentActionType} setCurrentActionType={setCurrentActionType}
                                        isActionTypeDropdownOpen={isActionTypeDropdownOpen} setIsActionTypeDropdownOpen={setIsActionTypeDropdownOpen}
                                        actionTypeDropdownRef={actionTypeDropdownRef}
                                        selectedResponseLength={game.selectedResponseLength}
                                        setSelectedResponseLength={game.setSelectedResponseLength}
                                        isResponseLengthDropdownOpen={isResponseLengthDropdownOpen} setIsResponseLengthDropdownOpen={setIsResponseLengthDropdownOpen}
                                        responseLengthDropdownRef={responseLengthDropdownRef}
                                        isLoadingUi={isLoadingUi}
                                        isSummarizingUi={isSummarizingUi}
                                        isCurrentlyActivePage={true}
                                        messageIdBeingEdited={game.messageIdBeingEdited}
                                        handleChoiceClick={handleChoiceClick}
                                        handleSubmit={handleSubmit}
                                        choiceButtonStyles={getChoiceButtonStyles()}
                                        isMiniGameVisible={isMiniGameVisible}
                                        setIsMiniGameVisible={setIsMiniGameVisible}
                                        storyLogRef={storyLogRef}
                                    />
                                    {game.knowledgeBase.pendingCombat && uiState.pendingCombatNoticeHidden && (
                                        <Button
                                            variant="danger"
                                            className="absolute bottom-full right-4 mb-2 !p-3 rounded-full shadow-lg animate-pulse border-2 border-red-400 z-50"
                                            onClick={() => setUiState(prev => ({ ...prev, pendingCombatNoticeHidden: false }))}
                                            title={VIETNAMESE.pendingCombatNotice}
                                            disabled={isSummarizingUi}
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M12.75 0l-1.5 1.5 1.5 1.5m3 0h-3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z" />
                                            </svg>
                                            <span className="sr-only">{VIETNAMESE.pendingCombatNotice}</span>
                                        </Button>
                                    )}

                                    {/* Combat Analysis Notice Overlay */}
                                    <CombatTriggerOverlay />
                                </div>
                            </>
                        )}
                    </>
                  </div>
            </div>
            
            {/* Side Panels */}
            <OffCanvasPanel isOpen={isCharPanelOpen} onClose={() => setIsCharPanelOpen(false)} title={VIETNAMESE.characterPanelTitle} position="right">
                <CharacterSidePanel knowledgeBase={game.knowledgeBase} onItemClick={(item) => game.openEntityModal('item', item)} onSkillClick={(skill) => game.openEntityModal('skill', skill)} onPlayerAvatarUploadRequest={game.onUpdatePlayerAvatar} isUploadingPlayerAvatar={game.isUploadingAvatar} />
            </OffCanvasPanel>
             <OffCanvasPanel isOpen={isQuestsPanelOpen} onClose={() => setIsQuestsPanelOpen(false)} title={VIETNAMESE.questsPanelTitle} position="right">
                <QuestsSidePanel quests={game.knowledgeBase.allQuests} onQuestClick={(quest) => game.openEntityModal('quest', quest)} knowledgeBase={game.knowledgeBase} />
            </OffCanvasPanel>
             <OffCanvasPanel 
                isOpen={isWorldPanelOpen} 
                onClose={() => setIsWorldPanelOpen(false)} 
                title={VIETNAMESE.worldPanelTitle} 
                position="right"
                leftHeaderElement={
                    <Button
                        variant="primary"
                        size="xs"
                        onClick={() => setIsTimelineModalOpen(true)}
                        className="bg-indigo-600 hover:bg-indigo-500 text-xs py-1 px-2.5 flex items-center gap-1 font-bold rounded shadow-md border border-indigo-400 shrink-0"
                    >
                        <Clock size={12} className="text-indigo-200" />
                        Timeline
                    </Button>
                }
             >
                <WorldSidePanel 
                    knowledgeBase={game.knowledgeBase} 
                    onNpcClick={(npc) => game.openEntityModal('npc', npc)} 
                    onYeuThuClick={(yt) => game.openEntityModal('yeuThu', yt)}
                    onLocationClick={(loc) => game.openEntityModal('location', loc)} 
                    onLoreClick={(lore) => game.openEntityModal('lore', lore)} 
                    onFactionClick={(fac) => game.openEntityModal('faction', fac)}
                    onCompanionClick={(comp) => game.openEntityModal('companion', comp)}
                />
            </OffCanvasPanel>
            
            {/* Timeline Events Modal */}
            <Modal 
                isOpen={isTimelineModalOpen} 
                onClose={handleCloseTimelineModal} 
                title={
                    <span className="flex items-center gap-2">
                        <Clock className="w-5 h-5 text-indigo-400" />
                        DÒNG THỜI GIAN THIẾT LẬP
                    </span>
                }
                maxWidth="max-w-3xl"
                hideDefaultFooter={true}
            >
                {/* AI Processing Status Banner inside Modal - On Top of UI Layers */}
                {isGeneratingMore && (
                    <div className="mb-4 p-3.5 rounded-xl bg-indigo-950/80 backdrop-blur-md border border-indigo-400/50 flex flex-wrap items-center justify-between gap-2 shadow-[0_0_20px_rgba(99,102,241,0.25)] relative overflow-hidden z-[1002]">
                        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 via-transparent to-transparent animate-pulse" />
                        <div className="flex items-center gap-2 z-10">
                            <span className="relative flex h-2.5 w-2.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-500"></span>
                            </span>
                            <span className="text-xs font-black text-indigo-300 uppercase tracking-wider">Đang khởi tạo sự kiện dòng thời gian nguyên tác...</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs font-mono z-10 shrink-0">
                            <span className="text-[10px] text-gray-300 bg-indigo-950/80 px-2 py-0.5 rounded border border-indigo-500/30">
                                {apiState.currentModel || "models/gemini-flash-latest"}
                            </span>
                            <span className="text-emerald-400 font-extrabold bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-500/30 animate-pulse">
                                {elapsedTime}S
                            </span>
                        </div>
                    </div>
                )}

                <StreamingConsole
                    streamingText={streamingText}
                    isStreamingActive={isStreamingActive}
                    onClose={() => setStreamingText('')}
                />

                {showTimelineWarningBanner && (
                    <div className="mb-4 p-4 rounded-xl bg-amber-950/40 border-2 border-amber-500/80 text-left shadow-[0_0_15px_rgba(245,158,11,0.25)] relative overflow-hidden">
                        <div className="absolute right-3 top-3 text-2xl opacity-20 select-none pointer-events-none">⚠️</div>
                        <h4 className="text-xs font-black text-amber-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                            <span>⚠️ CẢNH BÁO: SỐ SỰ KIỆN DỰ TRỮ CÒN DƯỚI 2!</span>
                        </h4>
                        <p className="text-xs text-gray-200 leading-relaxed font-medium">
                            Hành trình sắp cạn kiệt kịch bản nguyên tác. Hãy bấm nút <strong className="text-indigo-400">"🔮 Tạo thêm sự kiện"</strong> ở bên dưới để hệ thống AI chuẩn bị trước các biến cố tiếp theo cho bạn nhé!
                        </p>
                    </div>
                )}

                {timelineAnswer && (
                    <div className="mb-4 p-4 rounded-xl bg-indigo-950/40 border border-indigo-500/30 text-left shadow-[0_0_15px_rgba(99,102,241,0.15)] relative overflow-hidden">
                        <div className="absolute right-2 top-2 text-3xl opacity-10 select-none pointer-events-none">🔮</div>
                        <h5 className="text-[11px] font-extrabold text-indigo-400 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                            🔮 THIÊN CƠ NGUYÊN TÁC TIẾT LỘ
                        </h5>
                        <p className="text-xs text-gray-200 leading-relaxed italic whitespace-pre-wrap">
                            "{timelineAnswer}"
                        </p>
                    </div>
                )}

                {(() => {
                    const sanitizedEvents = sanitizeTimelineEvents(game.knowledgeBase.worldConfig?.timelineEvents || []);
                    return sanitizedEvents.length > 0 ? (
                    <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1 custom-scrollbar p-2 text-left">
                        {sanitizedEvents.map((event, index) => {
                            const currentIndex = game.knowledgeBase.arcState?.originalTimelineIndex ?? 0;
                            const isPast = index < currentIndex;
                            const isCurrent = index === currentIndex;
                            const isNext = index === currentIndex + 1;
                            const isFuture = index > currentIndex + 1;

                            let cardStyle = "bg-gray-850/60 p-4 rounded-lg border border-gray-700/60 transition-all duration-200";
                            if (isCurrent) {
                                cardStyle = "bg-indigo-950/40 p-4 rounded-lg border-2 border-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.3)] hover:bg-indigo-950/50 transition-all duration-200 relative overflow-hidden";
                            } else if (isNext) {
                                cardStyle = "bg-amber-950/20 p-4 rounded-lg border border-amber-500/60 shadow-[0_0_10px_rgba(245,158,11,0.15)] hover:bg-amber-950/30 transition-all duration-200";
                            } else if (isFuture) {
                                cardStyle = isRagActive 
                                    ? "bg-gray-850/60 p-4 rounded-lg border border-gray-700/60 transition-all duration-200 relative overflow-hidden"
                                    : "bg-gray-900/40 p-4 rounded-lg border border-gray-840/80 blur-sm opacity-25 select-none pointer-events-none transition-all duration-200";
                            } else if (isPast) {
                                cardStyle = "bg-gray-900/30 p-4 rounded-lg border border-gray-800/40 opacity-70 hover:bg-gray-900/40 transition-all duration-200";
                            }

                            return (
                                <div key={event.id || index} className="relative pl-6 pb-2 border-l border-indigo-500/30 last:border-l-0">
                                    {/* Bullet */}
                                    <div className={`absolute -left-1.5 top-1.5 w-3 h-3 rounded-full border border-gray-800 ${
                                        isPast ? 'bg-gray-500 shadow-[0_0_4px_rgba(107,114,128,0.5)]' :
                                        isCurrent ? 'bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.8)] animate-pulse' :
                                        isNext ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]' :
                                        'bg-gray-750'
                                    }`} />
                                    
                                    <div className={cardStyle}>
                                        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                {event.periodName && (
                                                    <span className="text-[10px] uppercase tracking-wider font-bold bg-indigo-900/40 text-indigo-300 px-2 py-0.5 rounded border border-indigo-700/30">
                                                        {event.periodName}
                                                    </span>
                                                )}
                                                {isCurrent && (
                                                    <span className="text-[9px] uppercase tracking-wider font-extrabold bg-indigo-500 text-white px-1.5 py-0.5 rounded animate-pulse">
                                                        Hiện tại
                                                    </span>
                                                )}
                                                {isNext && (
                                                    <span className="text-[9px] uppercase tracking-wider font-extrabold bg-amber-500 text-gray-900 px-1.5 py-0.5 rounded">
                                                        Sắp tới
                                                    </span>
                                                )}
                                                {isPast && (
                                                    <span className="text-[9px] uppercase tracking-wider font-bold bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded">
                                                        Xong
                                                    </span>
                                                )}
                                                {isFuture && (
                                                    <span className="text-[9px] uppercase tracking-wider font-medium bg-gray-800 text-gray-500 px-1.5 py-0.5 rounded select-none border border-gray-700/30">
                                                        Thiên cơ
                                                    </span>
                                                )}
                                            </div>
                                            <span className="text-xs text-gray-400 font-mono">Giai đoạn #{index + 1}</span>
                                        </div>
                                        
                                        <h4 className={`text-sm font-bold mb-1 ${
                                            isCurrent ? 'text-indigo-350' :
                                            isNext ? 'text-amber-300' :
                                            isPast ? 'text-gray-400' :
                                            'text-gray-500'
                                        }`}>{event.eventName}</h4>
                                        <p className="text-xs text-gray-300 leading-relaxed whitespace-pre-line mb-3">{event.description}</p>
                                        
                                        {(event.requiredAction || event.location || (event.characters && event.characters.length > 0)) && (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 pt-2 border-t border-gray-800/50 text-[11px]">
                                                {event.location && (
                                                    <div className="flex items-start gap-1 text-gray-400">
                                                        <span className="font-semibold text-indigo-400">Địa điểm:</span>
                                                        <span className="truncate" title={event.location}>{event.location}</span>
                                                    </div>
                                                )}
                                                {event.requiredAction && (
                                                    <div className="flex items-start gap-1 text-gray-400 sm:col-span-2">
                                                        <span className="font-semibold text-emerald-400 shrink-0">Hành động yêu cầu:</span>
                                                        <span className="leading-normal">{event.requiredAction}</span>
                                                    </div>
                                                )}
                                                {event.characters && event.characters.length > 0 && (
                                                    <div className="flex items-start gap-1 text-gray-400 sm:col-span-2">
                                                        <span className="font-semibold text-amber-400 shrink-0">Nhân vật tham gia:</span>
                                                        <span className="flex flex-wrap gap-1">
                                                            {event.characters.map((char, cIdx) => (
                                                                <span key={cIdx} className="bg-gray-800 px-1.5 py-0.5 rounded text-[10px] text-gray-300 border border-gray-700">
                                                                    {char}
                                                                </span>
                                                            ))}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    ) : (
                        <div className="text-center py-10 text-gray-400 italic">
                            Không tìm thấy dữ liệu dòng thời gian từ thiết lập thế giới ban đầu.
                        </div>
                    );
                })()}
                
                <div className="mt-4 pt-4 border-t border-gray-750 flex justify-between items-center gap-3">
                    <Button 
                        onClick={handleGenerateMoreEvents} 
                        variant="primary" 
                        size="sm"
                        disabled={isGeneratingMore}
                        className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-900/50 text-xs py-1.5 px-3.5 flex items-center gap-1.5 font-bold rounded shadow-md border border-indigo-400 text-white transition-all duration-200"
                    >
                        {isGeneratingMore ? (
                            <>
                                <span className="animate-spin inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full mr-1"></span>
                                Đang khám phá thiên cơ...
                            </>
                        ) : (
                            <>
                                🔮 Tạo thêm sự kiện
                            </>
                        )}
                    </Button>
                    <Button onClick={handleCloseTimelineModal} variant="secondary" size="sm">
                        Đóng
                    </Button>
                </div>
            </Modal>
            
            {/* Popover & Debug */}
            <MiniInfoPopover isOpen={popover.isOpen} targetRect={popover.targetRect} entity={popover.entity} entityType={popover.entityType} onClose={closePopover} knowledgeBase={game.knowledgeBase} />
            
            {/* KING CRIMSON TERMINATOR BUTTON - SOLE WAY TO STOP AUTOMATION */}
            {game.kcActive && (
                <div className="fixed bottom-4 right-4 z-[9999] flex flex-col items-center">
                    <button
                        onClick={() => game.stopKingCrimson()}
                        className="w-12 h-12 bg-red-600 hover:bg-red-500 text-white rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(239,68,68,0.6)] border-2 border-white animate-pulse transition-transform hover:scale-110 active:scale-95"
                        title="Dừng chuỗi hành động (King Crimson)"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                    <span className="text-[10px] text-red-500 font-bold mt-1 bg-black/80 px-2 py-0.5 rounded-md border border-red-900/50">STOP KC</span>
                </div>
            )}

            {/* Debug Panel with click-outside overlay */}
            {!isReaderMode && showDebugPanel && uiState.isDevMode && (
                <>
                    <div 
                        className="fixed inset-0 z-40 bg-black/5" 
                        onClick={() => setShowDebugPanel(false)}
                        aria-hidden="true"
                    />
                    <DebugPanelDisplay 
                        kb={game.knowledgeBase} 
                        sentPromptsLog={game.sentPromptsLog} 
                        rawAiResponsesLog={game.rawAiResponsesLog} 
                        sentEconomyPromptsLog={game.sentEconomyPromptsLog} 
                        receivedEconomyResponsesLog={game.receivedEconomyResponsesLog} 
                        sentGeneralSubLocationPromptsLog={game.sentGeneralSubLocationPromptsLog} 
                        receivedGeneralSubLocationResponsesLog={game.receivedGeneralSubLocationResponsesLog} 
                        latestPromptTokenCount={game.latestPromptTokenCount} 
                        summarizationResponsesLog={game.summarizationResponsesLog} 
                        sentCraftingPromptsLog={game.sentCraftingPromptsLog} 
                        receivedCraftingResponsesLog={game.receivedCraftingResponsesLog} 
                        sentNpcAvatarPromptsLog={game.sentNpcAvatarPromptsLog} 
                        retrievedRagContextLog={game.retrievedRagContextLog}
                        isAutoPlaying={game.isAutoPlaying} 
                        onToggleAutoPlay={game.onToggleAutoPlay} 
                        onStartDebugCombat={game.onStartDebugCombat} 
                        onProcessDebugTags={game.handleProcessDebugTags} 
                        isLoading={isLoadingUi} 
                        sentCombatSummaryPromptsLog={game.sentCombatSummaryPromptsLog}
                        receivedCombatSummaryResponsesLog={game.receivedCombatSummaryResponsesLog}
                        sentVictoryConsequencePromptsLog={game.sentVictoryConsequencePromptsLog}
                        receivedVictoryConsequenceResponsesLog={game.receivedVictoryConsequenceResponsesLog}
                        onClose={() => setShowDebugPanel(false)}
                    />
                </>
            )}





            {showFleeConfirmModal && (
                <Modal
                    isOpen={showFleeConfirmModal}
                    onClose={() => setShowFleeConfirmModal(false)}
                    title="XÁC NHẬN ĐÀO TẨU KHỎI CHIẾN TRƯỜNG"
                >
                    <div className="p-4 space-y-4 text-gray-200">
                        <div className="p-3 bg-amber-950/40 border border-amber-500/40 rounded-lg text-sm text-amber-200">
                            <p className="font-bold mb-1">⚠️ CẢNH BÁO TỔN THẤT KHI BỎ CHẠY:</p>
                            <p>Bạn sẽ <strong>100% bỏ chạy thành công</strong>, nhưng phải gánh chịu những hậu quả nặng nề sau:</p>
                            <ul className="list-disc list-inside mt-2 space-y-1 text-xs text-amber-300/90">
                                <li><strong>Mất 1 tiểu cảnh giới:</strong> Tổn thương kinh mạch làm tụt giảm tu vi và đưa EXP hiện tại về 0.</li>
                                <li><strong>Mất 70% ngân lượng:</strong> Đánh rơi phần lớn Linh Thạch trong lúc hoảng loạn tháo chạy.</li>
                                <li><strong>Giảm 50 điểm thiện cảm:</strong> Đối thủ và các NPC liên quan trong trận chiến sẽ căm ghét/khinh miệt bạn.</li>
                            </ul>
                        </div>
                        <p className="text-xs text-gray-400 italic">
                            Bạn có chắc chắn muốn bỏ chạy ngay lúc này không?
                        </p>
                        <div className="flex justify-end gap-3 pt-2">
                            <Button 
                                variant="ghost" 
                                onClick={() => setShowFleeConfirmModal(false)}
                            >
                                Hủy bỏ
                            </Button>
                            <Button 
                                variant="warning" 
                                onClick={() => {
                                    setShowFleeConfirmModal(false);
                                    game.onFleeCombat();
                                }}
                                className="bg-amber-600 hover:bg-amber-500 text-white font-bold"
                            >
                                Xác Nhận Bỏ Chạy
                            </Button>
                        </div>
                    </div>
                </Modal>
            )}

            <BackgroundYouTubePlayer playlistUrl="https://music.youtube.com/playlist?list=PLdY0vD2hsAsg&si=aD0l1W3kcMFqlqxA" />
            {/* Vector Check Modal */}
            <VectorCheckModal 
                isOpen={isVectorCheckModalOpen}
                onClose={() => setIsVectorCheckModalOpen(false)}
                query={vectorCheckQuery}
                knowledgeBase={game.knowledgeBase}
            />
        </div>
    );
};

export default GameplayScreen;

