// @FIX: Add React import to resolve namespace errors.
import React, { useState, useCallback, useEffect, useRef } from 'react';
// @FIX: Added UIState to imports
import { KnowledgeBase, GameMessage, PlayerActionInputType, ResponseLength, GameScreen, FindLocationParams, UIState, NPC } from '../types';
import { VIETNAMESE, TURNS_PER_PAGE, AUTO_SAVE_INTERVAL_TURNS, MAX_AUTO_SAVE_SLOTS, DEFAULT_TIERED_STATS } from '../constants';
import { prepareMessagesForSummary } from '../utils/summarizationHelper';
import { generateCityEconomy, generateGeneralSubLocations, findLocationWithAI, getApiSettings, getCurrentlyUsedApiKey, parseAiResponseText } from '../services/geminiService';
import { streamNextTurn, isNarrationTextIncomplete, streamNarrationContinuation } from '../services/storyStreamService';
import { RewriteNarrationContext, executeRewriteNarrationFromScratch } from '../services/vietlailoike';
import { getRecentNarrations } from '../utils/narrationContext';
import { generateEmbeddings } from '../services/embeddingService';
import { pruneHistoricalData } from '../utils/pruningUtils';
import { performTagProcessing, addTurnHistoryEntryRaw, calculateRealmBaseStats, calculateEffectiveStats, auditAllEntitiesStats, progressNpcCultivation, handleLevelUps, searchVectors, extractEntityContextsFromString, detectImplicitCombat, extractEntityBatchHistory } from '../utils/gameLogicUtils';
import { matchAndFixTags } from '../utils/tagProcessingUtils';
import { extractSatelliteTags } from '../services/satelliteTagExtractor';
import { applyLifespanDeduction } from '../utils/statsCalculationUtils';
import { processFatality } from '../src/logic/deathMechanics';
import { fastCloneKb } from '../utils/cloneKb';
import { backgroundTaskManager } from '../utils/BackgroundTaskManager';
import { WorldProgressionService } from '../services/WorldProgressionService';
import { checkAndExpandConnections } from '../utils/map/autoExpander';
import { autoAssignNpcSkills } from '../utils/npcSkillAssigner';
import { runFlashAgentAsync, saveFlashAgentMemoryOffline } from '../services/FlashAgentService';
import { prepareDynamicMemory, cleanUserInput } from '../services/DynamicMemoryService';
import { runKnowledgeArchitectAsync } from '../services/KnowledgeArchitectService';
import { DataExtractionService } from '../services/dataExtractionService';
import { TurnCoordinator } from '../services/turnCoordinator';
import { extractSuperManualTurnData } from '../services/superManualExtractor';
import { analyzeCombatants, resolveCombatantIds, CombatAnalysisResult } from '../services/CombatTriggerAnalyst';
import { filterActiveCombatants } from '../utils/combatFilterUtils';
import { processBeginCombat } from '../utils/tagProcessors/combatTagProcessor';
import { QuestSyncService } from '../services/QuestSyncService';
import { updateKnowledgeBaseWithInputRoll } from '../utils/difficultyUtils';
import * as GameTemplates from '../templates';
import { NpcLifecycleManager } from '../services/NpcLifecycleManager';
import { detectNsfwIntent } from '../src/services/prompt-engineering/situationalRules';
import { apiRunningService } from '../services/apiRunningService';
import { PlayerZeroService } from '../services/PlayerZeroService';
import { parseRealm, ensureValidOrLowestRealm } from '../utils/realmUtils';
import { advanceTime } from '../utils/timeUtils';
import { cleanTextFromXmlUpdates, parseXmlUpdatesToLegacyTags } from '../utils/xmlUpdateParser';
import { extractMainStoryContent } from '../utils/journalParser';
import { isPostCombatAction, applyPostCombatMechanicOverrides } from '../services/combat/PostCombatNarrationService';

import { useUiLockStore } from '@/src/store/uiLockStore';

interface UseMainGameLoopProps {
  knowledgeBase: KnowledgeBase;
  setKnowledgeBase: React.Dispatch<React.SetStateAction<KnowledgeBase>>;
  gameMessages: GameMessage[];
  setGameMessages: React.Dispatch<React.SetStateAction<GameMessage[]>>; // Added for pruning
  addMessageAndUpdateState: (newMessages: GameMessage[], newKnowledgeBase: KnowledgeBase, startingCurrency?: number, callback?: () => void) => void;
  setRawAiResponsesLog: React.Dispatch<React.SetStateAction<string[]>>;
  logSentPromptCallback: (prompt: string, turnNumber?: number) => void;
  logReceivedResponseCallback: (responseRaw: string, turnNumber: number) => void;
  setSummarizationResponsesLog: React.Dispatch<React.SetStateAction<string[]>>;
  showNotification: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  isAutoPlaying: boolean;
  setIsAutoPlaying: React.Dispatch<React.SetStateAction<boolean>>;
  executeSaveGame: (kbToSave: KnowledgeBase, messagesToSave: GameMessage[], saveName: string, existingId: string | null, isAuto: boolean) => Promise<string | null>;
  logNpcAvatarPromptCallback: (prompt: string) => void;
  setIsLoadingApi: React.Dispatch<React.SetStateAction<boolean>>;
  setApiErrorWithTimeout: (message: string | null) => void;
  resetApiError: () => void;
  setSentEconomyPromptsLog: React.Dispatch<React.SetStateAction<string[]>>;
  setReceivedEconomyResponsesLog: React.Dispatch<React.SetStateAction<string[]>>;
  setSentGeneralSubLocationPromptsLog: React.Dispatch<React.SetStateAction<string[]>>;
  setReceivedGeneralSubLocationResponsesLog: React.Dispatch<React.SetStateAction<string[]>>;
  handleNonCombatDefeat: (kbStateAtDefeat: KnowledgeBase, fatalNarration: string) => Promise<void>;
  handleSuccession?: (kbToModify: KnowledgeBase) => Promise<GameMessage>;
  setRetrievedRagContextLog: React.Dispatch<React.SetStateAction<string[]>>;
  // Added from props
  currentPageMessagesLog: string;
  previousPageSummaries: string[];
  lastNarrationFromPreviousPage?: string;
  uiState: UIState;
  setUiState: React.Dispatch<React.SetStateAction<UIState>>;
  styleSettings: import('../types').StyleSettings;
  setIsStreaming: React.Dispatch<React.SetStateAction<boolean>>;
  setStreamingText: React.Dispatch<React.SetStateAction<string>>;
  isSwapping: boolean;
  setIsSwapping: React.Dispatch<React.SetStateAction<boolean>>;
  abortControllerRef: React.MutableRefObject<AbortController | null>;
  onUnrecognizedTagsDetected?: (tags: string[]) => void;
}
// @FIX: Add an empty export to prevent "Variable declaration list cannot be empty" error in some bundlers.
export {};
export const useMainGameLoop = ({
  knowledgeBase,
  setKnowledgeBase, 
  gameMessages,
  setGameMessages, // Added for pruning
  addMessageAndUpdateState,
  setRawAiResponsesLog,
  logSentPromptCallback,
  logReceivedResponseCallback,
  setSummarizationResponsesLog,
  showNotification,
  isAutoPlaying,
  setIsAutoPlaying,
  executeSaveGame,
  logNpcAvatarPromptCallback,
  setIsLoadingApi,
  setApiErrorWithTimeout,
  resetApiError,
  setSentEconomyPromptsLog,
  setReceivedEconomyResponsesLog,
  setSentGeneralSubLocationPromptsLog,
  setReceivedGeneralSubLocationResponsesLog,
  handleNonCombatDefeat,
  handleSuccession,
  setRetrievedRagContextLog,
  currentPageMessagesLog, // Destructure new prop
  previousPageSummaries, // Destructure new prop
  lastNarrationFromPreviousPage, // Destructure new prop
  uiState, // Destructure UI state
  setUiState, // Destructure UI state setter
  styleSettings,
  setIsStreaming,
  setStreamingText,
  isSwapping,
  setIsSwapping,
  abortControllerRef,
  onUnrecognizedTagsDetected
}: UseMainGameLoopProps) => {

    const [isSummarizingNextPageTransition, setIsSummarizingNextPageTransition] = useState<boolean>(false);
    const isGeneratingRef = useRef<boolean>(false);
    const pendingFlashAgentRecoveryRef = useRef<{
        resolve: (value: boolean) => void;
        reject: () => void;
    } | null>(null);

    const logSummarizationResponseCallback = useCallback((response: string) => {
        setSummarizationResponsesLog(prev => [response, ...prev].slice(0, 10));
    }, [setSummarizationResponsesLog]);

    const handleIgnoreFlashSummary = useCallback(() => {
        if (pendingFlashAgentRecoveryRef.current) {
            pendingFlashAgentRecoveryRef.current.resolve(false);
        }
        setUiState(prev => ({ ...prev, isFlashSummaryMissingModalOpen: false }));
    }, [setUiState]);

    const handleRetryFlashSummary = useCallback(async () => {
        if (pendingFlashAgentRecoveryRef.current) {
            pendingFlashAgentRecoveryRef.current.resolve(true);
            setUiState(prev => ({ ...prev, isFlashSummaryMissingModalOpen: false }));
            return;
        }

        if (!uiState.lastFlashRetryData) {
            showNotification("Không tìm thấy dữ liệu để tạo lại tóm tắt.", 'error');
            setUiState(prev => ({ ...prev, isFlashSummaryMissingModalOpen: false }));
            return;
        }

        const { action, aiResponse, turn, locName, timeStr } = uiState.lastFlashRetryData;
        
        setIsLoadingApi(true);
        setUiState(prev => ({ ...prev, isFlashSummaryMissingModalOpen: false }));
        
        showNotification(`Đang thử tạo lại tóm tắt cho lượt ${turn}...`, 'info');
        
        const success = await runFlashAgentAsync(action, aiResponse, turn, setKnowledgeBase, "", undefined, locName, timeStr);
        
        setIsLoadingApi(false);
        
        if (success) {
            showNotification(`Đã khôi phục tóm tắt lượt ${turn} thành công!`, 'success');
        } else {
            showNotification(`Khôi phục tóm tắt lượt ${turn} thất bại.`, 'error');
            // Mở lại modal nếu vẫn thất bại
            setUiState(prev => ({ ...prev, isFlashSummaryMissingModalOpen: true }));
        }
    }, [uiState.lastFlashRetryData, setKnowledgeBase, setIsLoadingApi, showNotification, setUiState]);

    const [isRecoveringNarration, setIsRecoveringNarration] = useState<boolean>(false);
    const [narrationRecoveryAction, setNarrationRecoveryAction] = useState<'continue' | 'rewrite' | null>(null);
    const selectedNarrationModelRef = useRef<string>('');
    const pendingNarrationRecoveryRef = useRef<{
        resolve: (value: 'continue' | 'rewrite' | 'ignore') => void;
        reject: () => void;
    } | null>(null);

    const handleIgnoreIncompleteNarration = useCallback(() => {
        if (pendingNarrationRecoveryRef.current) {
            pendingNarrationRecoveryRef.current.resolve('ignore');
        }
        setUiState(prev => ({ ...prev, isNarrationIncompleteModalOpen: false, incompleteNarrationData: null }));
    }, [setUiState]);

    const handleContinueIncompleteNarration = useCallback(() => {
        if (pendingNarrationRecoveryRef.current) {
            pendingNarrationRecoveryRef.current.resolve('continue');
        }
    }, []);

    const handleRewriteIncompleteNarration = useCallback(() => {
        if (pendingNarrationRecoveryRef.current) {
            pendingNarrationRecoveryRef.current.resolve('rewrite');
        }
    }, []);

    const handleHideIncompleteNarration = useCallback(() => {
        setUiState(prev => ({
            ...prev,
            incompleteNarrationData: prev.incompleteNarrationData ? {
                ...prev.incompleteNarrationData,
                isMinimized: true
            } : null
        }));
    }, [setUiState]);

    const handleRestoreIncompleteNarration = useCallback(() => {
        setUiState(prev => ({
            ...prev,
            incompleteNarrationData: prev.incompleteNarrationData ? {
                ...prev.incompleteNarrationData,
                isMinimized: false
            } : null
        }));
    }, [setUiState]);

    const handleSelectIncompleteNarrationModel = useCallback((model: string) => {
        selectedNarrationModelRef.current = model;
        setUiState(prev => ({
            ...prev,
            incompleteNarrationData: prev.incompleteNarrationData ? {
                ...prev.incompleteNarrationData,
                selectedModel: model
            } : null
        }));
    }, [setUiState]);

    const checkAndRecoverIncompleteNarration = useCallback(async (
        initialResult: { response: any; rawText: string },
        messageId: string,
        turnNumber: number,
        turnContextParams?: Omit<RewriteNarrationContext, 'turnNumber'>
    ): Promise<{ response: any; rawText: string }> => {
        let currentRawText = initialResult.rawText || '';
        let currentResponse = initialResult.response;
        let attempt = 0;
        const maxAttempts = 2;

        const apiSettings = getApiSettings();
        const initialModel = selectedNarrationModelRef.current || apiSettings.model || 'gemini-3.8-flash';
        selectedNarrationModelRef.current = initialModel;

        while (isNarrationTextIncomplete(currentRawText) && attempt < maxAttempts) {
            const nextAttemptNum = attempt + 1;
            console.log(`[Narration Recovery] Phát hiện thiếu thẻ </content>. Kích hoạt modal bù đắp (Lần ${nextAttemptNum}/${maxAttempts}).`);

            setUiState(prev => ({
                ...prev,
                isNarrationIncompleteModalOpen: true,
                incompleteNarrationData: {
                    rawText: currentRawText,
                    attempt: nextAttemptNum,
                    maxAttempts,
                    messageId,
                    turn: turnNumber,
                    selectedModel: selectedNarrationModelRef.current,
                    isMinimized: false
                }
            }));

            // Chờ người chơi bấm "Viết tiếp", "Viết lại từ đầu" hoặc "Bỏ qua"
            const userChoice = await new Promise<'continue' | 'rewrite' | 'ignore'>((resolve) => {
                pendingNarrationRecoveryRef.current = {
                    resolve,
                    reject: () => resolve('ignore')
                };
            });
            pendingNarrationRecoveryRef.current = null;

            if (userChoice === 'ignore') {
                console.log("[Narration Recovery] Người chơi chọn bỏ qua bù đắp lời kể.");
                setUiState(prev => ({ ...prev, isNarrationIncompleteModalOpen: false, incompleteNarrationData: null }));
                break;
            }

            const modelToUse = selectedNarrationModelRef.current || apiSettings.model;

            if (userChoice === 'rewrite') {
                setNarrationRecoveryAction('rewrite');
                setIsRecoveringNarration(true);
                showNotification(`Đang xóa nội dung viết dở và viết lại từ đầu bằng model ${modelToUse}...`, 'info');

                // Xóa nội dung viết dở khỏi UI và thu gọn modal để người chơi thấy luồng viết lại trực tiếp
                currentRawText = '';
                currentResponse = { narration: '', choices: [] };
                setGameMessages(prev => prev.filter(m =>
                    !(m.id === messageId || (m.type === 'system' && m.turnNumber === turnNumber && m.id.startsWith('reunion-sys-')))
                ));
                setUiState(prev => ({
                    ...prev,
                    incompleteNarrationData: prev.incompleteNarrationData ? {
                        ...prev.incompleteNarrationData,
                        rawText: '',
                        isMinimized: true
                    } : null
                }));

                setIsStreaming(true);
                setStreamingText("");
                setIsLoadingApi(true);

                try {
                    const rewriteRes = await executeRewriteNarrationFromScratch({
                        modelToUse,
                        context: {
                            ...(turnContextParams || {}),
                            turnNumber
                        },
                        callbacks: {
                            onChunk: (chunk) => {
                                if (chunk) {
                                    setStreamingText(prev => prev + chunk);
                                }
                            },
                            onMetadata: (meta) => {
                                console.log(`[Story Rewrite] Lời kể viết lại hoàn tất trong ${meta.duration} bằng ${meta.model}`);
                            },
                            onError: (err) => {
                                console.error('[Story Rewrite] Lỗi phát sinh:', err);
                            }
                        },
                        abortControllerRef,
                        onResetStream: () => setStreamingText("")
                    });

                    setIsStreaming(false);
                    setStreamingText("");
                    setIsSwapping(false);
                    setIsLoadingApi(false);
                    abortControllerRef.current = null;

                    currentRawText = rewriteRes.rawText || '';
                    currentResponse = rewriteRes.response;
                    attempt = 0;

                    const rewrittenRawNarration = currentResponse?.narration || "";
                    const rewrittenCleanNarration = cleanTextFromXmlUpdates(rewrittenRawNarration) || extractMainStoryContent(rewrittenRawNarration);
                    const rewrittenMessage: GameMessage = {
                        id: messageId,
                        type: 'narration',
                        content: rewrittenCleanNarration,
                        timestamp: Date.now(),
                        choices: currentResponse?.choices || [],
                        turnNumber
                    };

                    setGameMessages(prev => {
                        const filtered = prev.filter(m => m.id !== messageId);
                        const nextMsgs = [...filtered, rewrittenMessage];
                        if (currentResponse?.reunionOccurred) {
                            nextMsgs.push({
                                id: `reunion-sys-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                                type: 'system',
                                content: `[Hệ thống] Một sự kiện tái ngộ NPC đã diễn ra! (Mục tiêu: ${currentResponse.reunionNpcNames?.join(", ")})`,
                                timestamp: Date.now() + 1,
                                turnNumber
                            });
                        }
                        return nextMsgs;
                    });

                    if (!isNarrationTextIncomplete(currentRawText)) {
                        showNotification("Đã viết lại lời kể mới hoàn chỉnh!", 'success');
                        setUiState(prev => ({ ...prev, isNarrationIncompleteModalOpen: false, incompleteNarrationData: null }));
                        break;
                    } else {
                        showNotification("Lời kể viết lại vẫn thiếu thẻ đóng </content>. Bạn có thể viết tiếp hoặc thử lại với model khác.", 'warning');
                        continue;
                    }
                } catch (err: any) {
                    setIsStreaming(false);
                    setStreamingText("");
                    setIsSwapping(false);
                    setIsLoadingApi(false);
                    abortControllerRef.current = null;
                    console.error("[Narration Recovery] Lỗi khi viết lại lời kể từ đầu:", err);
                    showNotification(`Lỗi viết lại từ đầu: ${err?.message || err}`, 'error');
                    currentRawText = '';
                    currentResponse = { narration: '', choices: [] };
                    attempt = 0;
                    continue;
                } finally {
                    setIsRecoveringNarration(false);
                    setNarrationRecoveryAction(null);
                }
            }

            // Người chơi chọn tiếp tục: bắt đầu gọi API bù đắp
            setNarrationRecoveryAction('continue');
            setIsRecoveringNarration(true);
            showNotification(`Đang gọi API bù đắp lời kể (Model: ${modelToUse}, Lần ${nextAttemptNum}/${maxAttempts})...`, 'info');

            try {
                let chunkBuffer = '';
                const continuationRes = await streamNarrationContinuation(
                    currentRawText,
                    {
                        onChunk: (chunk) => {
                            chunkBuffer += chunk;
                            const fullDraft = currentRawText + chunkBuffer;
                            const cleaned = cleanTextFromXmlUpdates(fullDraft) || extractMainStoryContent(fullDraft);
                            setGameMessages(prev => prev.map(m => {
                                if (m.id === messageId) {
                                    return { ...m, content: cleaned };
                                }
                                return m;
                            }));
                        }
                    },
                    undefined,
                    modelToUse,
                    turnContextParams
                );

                currentRawText += continuationRes.text;
                attempt++;

                currentResponse = parseAiResponseText(currentRawText);
                const updatedClean = cleanTextFromXmlUpdates(currentRawText) || extractMainStoryContent(currentRawText);
                setGameMessages(prev => prev.map(m => {
                    if (m.id === messageId) {
                        return { ...m, content: updatedClean, choices: currentResponse.choices || m.choices };
                    }
                    return m;
                }));

                if (!isNarrationTextIncomplete(currentRawText)) {
                    showNotification("Lời kể đã được hoàn thành trọn vẹn!", 'success');
                    setUiState(prev => ({ ...prev, isNarrationIncompleteModalOpen: false, incompleteNarrationData: null }));
                    break;
                } else {
                    if (attempt >= maxAttempts) {
                        showNotification("Đã đạt giới hạn tối đa 2 lần bù đắp. Tiếp tục quy trình đồng bộ dữ liệu.", 'info');
                        setUiState(prev => ({ ...prev, isNarrationIncompleteModalOpen: false, incompleteNarrationData: null }));
                        break;
                    }
                }
            } catch (err: any) {
                console.error("[Narration Recovery] Lỗi khi gọi API bù đắp lời kể:", err);
                showNotification(`Lỗi bù đắp lời kể: ${err?.message || err}`, 'error');
                setUiState(prev => ({ ...prev, isNarrationIncompleteModalOpen: false, incompleteNarrationData: null }));
                break;
            } finally {
                setIsRecoveringNarration(false);
                setNarrationRecoveryAction(null);
            }
        }

        // Đảm bảo an toàn cấu trúc thẻ trước khi đưa vào bước tiếp theo
        currentRawText = matchAndFixTags(currentRawText, true);
        currentResponse = parseAiResponseText(currentRawText);

        return {
            response: currentResponse,
            rawText: currentRawText
        };
    }, [setGameMessages, setUiState, showNotification, setIsStreaming, setStreamingText, setIsSwapping, setIsLoadingApi, abortControllerRef]);

    const checkAndTriggerNormalizePower = useCallback(async (kbToCheck: KnowledgeBase) => {
        if (kbToCheck.worldConfig?.isCultivationEnabled === false) {
            console.log("[NormalizePower] Bypassing power normalization check because isCultivationEnabled is false.");
            return;
        }
        try {
            const { getEffectiveRealmSystem } = await import('../services/realmManager');
            const realmSystem = getEffectiveRealmSystem(kbToCheck);
            
            // CLEANSE: Refresh currentRealmBaseStats Map from DEFAULT_TIERED_STATS to ensure it uses the latest formula
            let kbStatsMapFixed = false;
            if (kbToCheck.currentRealmBaseStats && realmSystem.majorRealms) {
                realmSystem.majorRealms.forEach((realmName, index) => {
                    const latestStatDef = DEFAULT_TIERED_STATS[Math.min(index, DEFAULT_TIERED_STATS.length - 1)];
                    const currentStatDef = kbToCheck.currentRealmBaseStats![realmName];
                    
                    if (!currentStatDef || currentStatDef.hpBase !== latestStatDef.hpBase || currentStatDef.expBase !== latestStatDef.hpBase) {
                        // Force overwrite to the latest formula and sync EXP to HP
                        kbToCheck.currentRealmBaseStats![realmName] = {
                            ...latestStatDef,
                            expBase: latestStatDef.hpBase,
                            expInc: latestStatDef.hpInc
                        };
                        kbStatsMapFixed = true;
                        console.log(`[Sanitizer] Refreshed realm stats map for ${realmName}: Updated to latest formula values.`);
                    }
                });
            }

            if (kbStatsMapFixed) {
                setKnowledgeBase(kbToCheck);
            }

            const validRealms = new Set<string>();
            realmSystem.majorRealms.forEach(major => {
                validRealms.add(major);
                realmSystem.minorRealms.forEach(minor => {
                    validRealms.add(major + ' ' + minor);
                });
            });

            const npcsToFixRealm: NPC[] = [];
            const npcsToFixStats: NPC[] = [];
            let mcNeedsFix = false;
            const statsIssuesDetails: { name: string; realm: string; deviantStats: string[] }[] = [];
            const realmIssuesDetails: { name: string; realm: string }[] = [];
            const mcDeviantStats: string[] = [];

            const isOutOfRange = (val: number, expected: number) => {
                if (expected <= 0) return false;
                return val < expected * 0.95 || val > expected * 1.05;
            };

            if (!kbToCheck.playerStats.isDead && (kbToCheck.playerStats.thoNguyen === undefined || kbToCheck.playerStats.thoNguyen >= 1)) {
                const mcRealm = kbToCheck.playerStats.realm;
                const mcBase = calculateRealmBaseStats(mcRealm || "Phàm Nhân", realmSystem.majorRealms, kbToCheck.currentRealmBaseStats, realmSystem.minorRealms);
                const parsedMc = parseRealm(mcRealm || "Phàm Nhân", realmSystem);
                const expectedMcThoNguyen = parsedMc.majorIndex === 0 ? 120 : 100 * Math.pow(2, parsedMc.majorIndex);
                const expectedMcMaxExp = mcBase.baseMaxSinhLuc;
                
                const mcHp = kbToCheck.playerStats.baseMaxSinhLuc || kbToCheck.playerStats.maxSinhLuc || 0;
                const mcAtk = kbToCheck.playerStats.baseSucTanCong || kbToCheck.playerStats.sucTanCong || 0;
                const mcMp = kbToCheck.playerStats.baseMaxLinhLuc || kbToCheck.playerStats.maxLinhLuc || 0;
                const mcThoNguyen = kbToCheck.playerStats.maxThoNguyen || kbToCheck.playerStats.thoNguyen || 0;
                const mcMaxExp = kbToCheck.playerStats.maxKinhNghiem || 0;

                if (isOutOfRange(mcHp, mcBase.baseMaxSinhLuc)) {
                    mcDeviantStats.push("Sinh Lực");
                }
                if (isOutOfRange(mcAtk, mcBase.baseSucTanCong)) {
                    mcDeviantStats.push("Sức Tấn Công");
                }
                if (isOutOfRange(mcMp, mcBase.baseMaxLinhLuc)) {
                    mcDeviantStats.push("Linh Lực");
                }
                if (isOutOfRange(mcThoNguyen, expectedMcThoNguyen)) {
                    mcDeviantStats.push("Thọ Nguyên");
                }
                if (mcMaxExp !== expectedMcMaxExp) {
                    mcDeviantStats.push("Kinh Nghiệm Tối Đa");
                }
                if (mcDeviantStats.length > 0) {
                    mcNeedsFix = true;
                }
            }

            const allNpcs = [
                ...(kbToCheck.discoveredNPCs || []),
                ...(kbToCheck.wives || []).map(w => w as unknown as NPC),
                ...(kbToCheck.slaves || []).map(s => s as unknown as NPC),
                ...(kbToCheck.prisoners || []).map(p => p as unknown as NPC),
                ...(kbToCheck.companions || []).map(c => c as unknown as NPC)
            ];

            const uniqueNpcs = new Map<string, NPC>();
            allNpcs.forEach(n => {
                if (n && n.id) uniqueNpcs.set(n.id, n);
            });

            Array.from(uniqueNpcs.values()).forEach(npc => {
                if (npc.isDead || (npc.stats && typeof npc.stats.thoNguyen === 'number' && npc.stats.thoNguyen < 1)) {
                    return;
                }
                
                // CHỐT CHẶN CƠ HỌC: Tự động chuyển cảnh giới Phàm Nhân hoặc lỗi về cảnh giới thấp nhất của game
                const checkedRealm = ensureValidOrLowestRealm(npc.realm || "", kbToCheck);
                if (npc.realm !== checkedRealm) {
                    npc.realm = checkedRealm;
                    console.log(`[Cơ Học] Tự động bẻ lái cảnh giới của NPC ${npc.name} từ "${npc.realm}" về cảnh giới cơ bản: "${checkedRealm}"`);
                }

                let hasWrongRealm = false;
                if (!validRealms.has(npc.realm || "Phàm Nhân")) {
                    npcsToFixRealm.push(npc);
                    realmIssuesDetails.push({ name: npc.name || "Không rõ", realm: npc.realm || "Phàm Nhân" });
                    hasWrongRealm = true;
                }
                
                if (!hasWrongRealm) {
                    const npcBase = calculateRealmBaseStats(npc.realm || "Phàm Nhân", realmSystem.majorRealms, kbToCheck.currentRealmBaseStats, realmSystem.minorRealms);
                    const parsedNpc = parseRealm(npc.realm || "Phàm Nhân", realmSystem);
                    const expectedNpcThoNguyen = parsedNpc.majorIndex === 0 ? 120 : 100 * Math.pow(2, parsedNpc.majorIndex);

                    let statsWrong = false;
                    const deviantStats: string[] = [];
                    if (npc.stats) {
                        const baseHp = (npc.stats as any).baseMaxSinhLuc || npc.stats.maxSinhLuc || 0;
                        const baseAtk = (npc.stats as any).baseSucTanCong || npc.stats.sucTanCong || 0;
                        const baseMp = (npc.stats as any).baseMaxLinhLuc || npc.stats.maxLinhLuc || 0;
                        const npcThoNguyen = (npc.stats as any).maxThoNguyen || (npc.stats as any).thoNguyen || 0;
                        const npcMaxExp = (npc.stats as any).maxKinhNghiem || 0;
                        const expectedNpcMaxExp = npcBase.baseMaxSinhLuc;

                        if (baseHp > 0 && isOutOfRange(baseHp, npcBase.baseMaxSinhLuc)) {
                            statsWrong = true;
                            deviantStats.push("Sinh Lực");
                        }
                        if (baseAtk > 0 && isOutOfRange(baseAtk, npcBase.baseSucTanCong)) {
                            statsWrong = true;
                            deviantStats.push("Sức Tấn Công");
                        }
                        if (baseMp > 0 && isOutOfRange(baseMp, npcBase.baseMaxLinhLuc)) {
                            statsWrong = true;
                            deviantStats.push("Linh Lực");
                        }
                        if (isOutOfRange(npcThoNguyen, expectedNpcThoNguyen) || (npc.stats as any).maxThoNguyen < expectedNpcThoNguyen * 0.99 || (npc.stats as any).maxThoNguyen > expectedNpcThoNguyen * 1.01) {
                            statsWrong = true;
                            deviantStats.push("Thọ Nguyên");
                        }
                        if (npcMaxExp < expectedNpcMaxExp * 0.99 || npcMaxExp > expectedNpcMaxExp * 1.01) {
                            statsWrong = true;
                            deviantStats.push("Kinh Nghiệm Tối Đa");
                        }
                    } else {
                        statsWrong = true;
                        deviantStats.push("Chưa khởi tạo chỉ số");
                    }
                    if (statsWrong) {
                        npcsToFixStats.push(npc);
                        statsIssuesDetails.push({ name: npc.name || "Không rõ", realm: npc.realm || "Phàm Nhân", deviantStats });
                    }
                }
            });

            if (mcNeedsFix || npcsToFixRealm.length > 0 || npcsToFixStats.length > 0) {
                setUiState(prev => ({
                    ...prev,
                    isNormalizePowerModalOpen: true,
                    powerNormalizationsData: {
                        npcsToFixRealm,
                        npcsToFixStats,
                        mcNeedsFix,
                        statsIssuesDetails,
                        realmIssuesDetails,
                        mcDeviantStats,
                        triggerAction: () => {
                            setUiState(p => ({ ...p, isNormalizePowerModalOpen: false, powerNormalizationsData: null }));
                        }
                    }
                }));
            }
        } catch (e) {
            console.error("Lỗi kiểm tra chuẩn hóa thực lực:", e);
        }
    }, [setUiState]);

    const handlePlayerAction = useCallback(async (
        action: string, 
        isChoice: boolean,
        inputType: PlayerActionInputType,
        responseLength: ResponseLength,
        matPhapResumeCtx?: any,
        overrideKnowledgeBase?: KnowledgeBase,
        customPromptOverride?: string
    ) => {
        if (isGeneratingRef.current) {
            console.warn("Hệ thống chặn gọi đè: Đang trong tiến trình tạo lời kể.");
            return;
        }

        // --- PRESERVE STREAMING TEXT IF ACTIVE ---
        // Save any uncommitted streaming content to history before starting a new action (e.g., Đoạt xá, choice)
        try {
            const currentStream = (window as any).__lastStreamingText || "";
            // We can also check streamingText via closure if available or commit if streamingText has content
        } catch (e) {
            console.error("Error committing streaming text:", e);
        }

        isGeneratingRef.current = true;
        try {
            apiRunningService.resetTurnCounter();
            setIsLoadingApi(true);
            resetApiError();
        
        let knowledgeBaseAtActionStart: KnowledgeBase;
        let startingCurrency: number;
        let gameMessagesAtActionStart: GameMessage[];
        let turnOfPlayerAction: number;
        let cleanedAction: string;
        let finalActionForAI: string = "";
        let turnHistoryAtStart: any[] = [];
        let signal: AbortSignal | undefined;
        let escapedPrisonerNames: string[] = [];

        if (matPhapResumeCtx) {
            knowledgeBaseAtActionStart = matPhapResumeCtx.knowledgeBaseAtActionStart;
            startingCurrency = matPhapResumeCtx.startingCurrency;
            gameMessagesAtActionStart = matPhapResumeCtx.gameMessagesAtActionStart || [];
            turnOfPlayerAction = matPhapResumeCtx.turnOfPlayerAction;
            cleanedAction = matPhapResumeCtx.cleanedAction;
            turnHistoryAtStart = matPhapResumeCtx.turnHistoryAtStart || [];
        } else {
            // State AT THE START of this turn's processing cycle
            // FIX: Ensure a deep clone exists for prompt building, but avoid recursive history if possible
            const sourceKb = overrideKnowledgeBase || knowledgeBase;
            const { turnHistory: _history, ...kbSnapshot } = sourceKb;
            turnHistoryAtStart = _history || [];
            const kbSnapshotCopy = fastCloneKb(kbSnapshot as KnowledgeBase);
            kbSnapshotCopy.turnHistory = turnHistoryAtStart;
            knowledgeBaseAtActionStart = kbSnapshotCopy;

            if (isPostCombatAction(action)) {
                knowledgeBaseAtActionStart.pendingCombat = null;
                knowledgeBaseAtActionStart.postCombatState = null;
            }

            startingCurrency = knowledgeBaseAtActionStart.playerStats.currency;
            gameMessagesAtActionStart = [...gameMessages];
            turnOfPlayerAction = knowledgeBaseAtActionStart.playerStats.turn + 1;

            // --- PREVENT ACTIONS DURING PENDING COMBAT ---
            // If a fight is waiting, the player MUST resolve it via the UI.
            // We do not allow them to narrate their way out of it or ignore it.
            if (knowledgeBaseAtActionStart.pendingCombat) {
                showNotification("Bạn đang ở trong trạng thái chiến đấu! Hãy nhấn vào nút chiến đấu để tiếp tục.", 'warning');
                setIsLoadingApi(false);
                isGeneratingRef.current = false;
                return;
            }
            // ---------------------------------------------

            // --- CHẶN INPUT KHI ĐANG ĐỢI LUÂN HỒI / ĐOẠT XÁ ---
            const currentPhase = knowledgeBase.playerStats.reincarnationPhase;
            const rebirthActionLower = action.toLowerCase();
            const isAllowedPossession = rebirthActionLower.includes("đổi vai");
            const isAllowedReincarnation = rebirthActionLower.includes("đầu thai");

            if (currentPhase === 'possession_ready' && !isAllowedPossession) {
                showNotification("Bạn đang ở trong trạng thái đoạt xá! Hãy nhấn vào nút 'Đổi vai' để tiếp tục.", 'warning');
                setIsLoadingApi(false);
                isGeneratingRef.current = false;
                return;
            }
            if (currentPhase === 'new_mc_ready' && !isAllowedReincarnation) {
                showNotification("Bạn đang ở trong trạng thái luân hồi! Hãy chọn một hình thức 'Đầu thai' để tiếp tục.", 'warning');
                setIsLoadingApi(false);
                isGeneratingRef.current = false;
                return;
            }
            // ------------------------------------------------

            // --- SUCCESSION CHECK ON ACTION START ---
            if (
                action.toLowerCase().includes("luân hồi chuyển kiếp") ||
                action.toLowerCase().includes("luan hoi chuyen kiep")
            ) {
                if (handleSuccession) {
                    const successionMsg = await handleSuccession(knowledgeBaseAtActionStart);
                    if (successionMsg) {
                        gameMessagesAtActionStart.push(successionMsg);
                    }
                    // Make sure the new successor is explicitly marked alive
                    knowledgeBaseAtActionStart.playerStats.isDead = false;
                    showNotification(`Luân Hồi Chuyển Kiếp: ${knowledgeBaseAtActionStart.worldConfig?.playerName} đã tiếp bước tu tiên!`, 'info');
                }
            }
            // ----------------------------------------

            // NSFW Scene Management: End scene if player requests
            if (knowledgeBaseAtActionStart.isNsfwSceneActive && (action.toLowerCase().includes("kết thúc cảnh") || action.toLowerCase().includes("dừng lại"))) {
                knowledgeBaseAtActionStart.isNsfwSceneActive = false;
                // Also update the main state
                setKnowledgeBase(prev => ({ ...prev, isNsfwSceneActive: false }));
                showNotification("Phân cảnh NSFW đã kết thúc.", 'info');
            } else {
                const isExplicitlyNSFW = detectNsfwIntent(action);
                if (isExplicitlyNSFW && !knowledgeBaseAtActionStart.isNsfwSceneActive) {
                    knowledgeBaseAtActionStart.isNsfwSceneActive = true;
                    setKnowledgeBase(prev => ({ ...prev, isNsfwSceneActive: true }));
                }
            }

            // Layer 1: Input Processing (Regex)
            cleanedAction = cleanUserInput(action);

            // --- XỬ LÝ THỰC THI LUÂN HỒI TÁI SINH ---
            const rebirthAction = cleanedAction.toLowerCase();
            const phase = knowledgeBaseAtActionStart.playerStats.reincarnationPhase;

            if (phase === 'new_mc_ready' && rebirthAction.includes("đầu thai")) {
                // Cơ học: Reset
                knowledgeBaseAtActionStart.playerStats = {
                    ...knowledgeBaseAtActionStart.playerStats,
                    sinhLuc: 100,
                    maxSinhLuc: 100,
                    linhLuc: 50,
                    maxLinhLuc: 50,
                    sucTanCong: 10,
                    realm: "Phàm Nhân",
                    isDead: false,
                    reincarnationPhase: undefined
                };
                
                let background = "ngẫu nhiên";
                if (rebirthAction.includes("nhà giàu")) background = "gia đình quyền quý, giàu sang";
                else if (rebirthAction.includes("nhà nghèo")) background = "gia đình nghèo khó, bần hàn";
                else if (rebirthAction.includes("cô nhi")) background = "đứa trẻ mồ côi, không nơi nương tựa";

                finalActionForAI = `[HỆ THỐNG]: LUÂN HỒI THÀNH CÔNG! Sau khi chết, linh hồn đã đầu thai vào một ${background}. Tuy nhiên, do một trục trặc kỳ bí, ký ức tiền kiếp vẫn còn sót lại một phần. Hãy kể về sự sinh ra hoặc xuất hiện của nhân vật chính ở một nơi mới, một thân xác mới và bắt đầu hành trình tu tiên từ con số 0.`;
            }

            // UI Update: Immediately add player action to state if it is not an internal system prompt
            const isSystemAction = action.startsWith('[HỆ THỐNG');
            if (!isSystemAction) {
                const playerActionMessage: GameMessage = {
                    id: `player-action-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                    type: 'player_action',
                    content: cleanedAction,
                    timestamp: Date.now(),
                    isPlayerInput: true,
                    turnNumber: turnOfPlayerAction 
                };

                // UI Update: Immediately add player action to state
                setGameMessages(prev => [...prev, playerActionMessage]);
            }
        }
        
        try {
            let narrativeMessageIdForEarlyRender: string | null = null;
            let narrativeResult: any = null;
            let extractionTags: string[] = [];
            let syncKb: any = null;

        if (matPhapResumeCtx) {
            narrativeMessageIdForEarlyRender = matPhapResumeCtx.narrativeMessageIdForEarlyRender;
            narrativeResult = matPhapResumeCtx.narrativeResult;
            extractionTags = matPhapResumeCtx.extractionTags || [];
            syncKb = matPhapResumeCtx.syncKb;
        } else {
            const apiSettings = getApiSettings();
            const ragTopK = apiSettings.ragTopK ?? 10;

            // --- DYNAMIC MEMORY LAYERS (2 & 4) ---
            const { contextLayers } = await prepareDynamicMemory(cleanedAction, knowledgeBaseAtActionStart, ragTopK);

            // --- DETECT RECENT SLAVE, PRISONER & ITEM TRANSACTIONS (BUY/SELL) FROM PREVIOUS TURN ---
            const previousTurnNumber = turnOfPlayerAction - 1;
            const recentTransactionMessages = gameMessagesAtActionStart.filter(msg => 
                msg.type === 'event_summary' && 
                msg.turnNumber >= previousTurnNumber &&
                msg.content.includes('TỔNG KẾT') &&
                (msg.content.includes('NÔ LỆ') || msg.content.includes('TÙ NHÂN') || msg.content.includes('VẬT PHẨM') || msg.content.includes('BẢO VẬT'))
            );

            let slavePrisonerTransactionPrompt = '';
            if (recentTransactionMessages.length > 0) {
                slavePrisonerTransactionPrompt = `

<HệThốngBơmThôngTinGiaoDịchNôLệTùBinh>
================
**THÔNG TIN CÁC GIAO DỊCH MUA/BÁN NÔ LỆ, TÙ BINH, VẬT PHẨM & BẢO VẬT VỪA DIỄN RA Ở CÁC LƯỢT TRƯỚC:**

${recentTransactionMessages.map((msg, idx) => `[Giao dịch #${idx + 1}]:\n${msg.content}`).join('\n\n')}
================
</HệThốngBơmThôngTinGiaoDịchNôLệTùBinh>`;
            }

        // --- RAG CONTEXT RETRIEVAL (HYBRID STRATEGY) ---
        let retrievedContext: string | undefined = undefined;
        const contextChunks = new Set<string>();
        let hasEntityBatch = false;

        const isRagEnabled = localStorage.getItem('isRagSystemActive') !== 'false';

        // Lấy Fast Summary của lượt trước từ Flash Agent (ragHistoryLog hoặc flashState)
        const previousFlashLog = knowledgeBaseAtActionStart.ragHistoryLog
            ?.filter((log: any) => log && log.type === 'flash_agent' && (log.turn === undefined || log.turn < turnOfPlayerAction))
            ?.sort((a: any, b: any) => (b.turn || 0) - (a.turn || 0))[0];
        const previousFlashSummary = previousFlashLog?.summary || previousFlashLog?.richSummary || knowledgeBaseAtActionStart.flashState?.currentState || "";

        // Kết hợp Fast Summary lượt trước, action và lời kể lượt trước để tăng khả năng nhận diện thực thể & RAG
        const contextTextForEntityDetection = (previousFlashSummary ? "Fast Summary lượt trước: " + previousFlashSummary + "\n" : "") + action + "\n" + (lastNarrationFromPreviousPage || "");

        if (isRagEnabled && knowledgeBase && knowledgeBase.ragVectorStore && knowledgeBase.ragVectorStore.vectors?.length > 0 && ragTopK > 0) {
            try {
                // Step 1: Explicitly extract raw entity context
                const explicitContexts = extractEntityContextsFromString(contextTextForEntityDetection, knowledgeBase);
                explicitContexts.forEach(ctx => contextChunks.add(ctx));
                
                // Step 2: Hàng loạt trích xuất các lượt có nhắc đến thực thể
                const batchExtractionResult = extractEntityBatchHistory(contextTextForEntityDetection, knowledgeBase, 50);
                if (batchExtractionResult.hasMentions && batchExtractionResult.contexts.length > 0) {
                    batchExtractionResult.contexts.forEach(ctx => contextChunks.add(ctx));
                    hasEntityBatch = true;
                }

                // Step 3: Perform semantic search if no specific entity was mentioned (fallback mode)
                if (!hasEntityBatch) {
                    const ragQueryForEmbedding = (previousFlashSummary ? previousFlashSummary + "\n" : "") + action;
                    const queryEmbedding = await generateEmbeddings([ragQueryForEmbedding]);
                    if (queryEmbedding && queryEmbedding.length > 0) {
                        const searchResults = searchVectors(queryEmbedding[0], knowledgeBase.ragVectorStore, ragTopK);
                        searchResults.forEach(ctx => contextChunks.add(ctx));
                    }
                    // Thêm delay 4s sau khi gọi API Embedding
                    await new Promise(resolve => setTimeout(resolve, 4000));
                }
            } catch (e) {
                console.error("Failed to generate embeddings or search for RAG context:", e);
                showNotification("Lỗi khi truy xuất ký ức (RAG).", 'error');
            }
        }
        
        if (contextChunks.size > 0) {
            retrievedContext = Array.from(contextChunks).join('\n---\n');
            setRetrievedRagContextLog(prev => [retrievedContext!, ...prev].slice(0, 10));

            // SYSTEM-LEVEL RAG LOGGING: Persisted in KnowledgeBase
            const currentTurn = turnOfPlayerAction;
            const timestamp = new Date().toLocaleTimeString('vi-VN', { hour12: false });
            
            const logPrefix = hasEntityBatch ? "[RAG: BATCH ENTITY EXTRACTION]\n" : "[RAG: VECTOR SIMILARITY SEARCH]\n";
            const newRagEntry = { turn: currentTurn, timestamp, content: logPrefix + retrievedContext!, type: 'retrieval' as const };

            // Update local snapshot so it's not overwritten later
            if (!knowledgeBaseAtActionStart.ragHistoryLog) knowledgeBaseAtActionStart.ragHistoryLog = [];
            const existingIdxLocal = knowledgeBaseAtActionStart.ragHistoryLog.findIndex((h: any) => h && h.turn === currentTurn);
            if (existingIdxLocal !== -1) {
                knowledgeBaseAtActionStart.ragHistoryLog[existingIdxLocal] = newRagEntry;
            } else {
                knowledgeBaseAtActionStart.ragHistoryLog.push(newRagEntry);
            }
            if (knowledgeBaseAtActionStart.ragHistoryLog.length > 30) {
                knowledgeBaseAtActionStart.ragHistoryLog = knowledgeBaseAtActionStart.ragHistoryLog.slice(-30);
            }

            setKnowledgeBase(prev => {
                let history = prev.ragHistoryLog ? [...prev.ragHistoryLog] : [];
                const existingIdx = history.findIndex((h: any) => h && h.turn === currentTurn);
                if (existingIdx !== -1) {
                    history[existingIdx] = newRagEntry;
                } else {
                    history.push(newRagEntry);
                }
                if (history.length > 30) { // Keep last 30 turns of RAG
                    history = history.slice(-30);
                }
                return { ...prev, ragHistoryLog: history };
            });
        }
        // --- END RAG ---

            let onChunk: ((text: string) => void) | undefined;
            let onResetStream: (() => void) | undefined;

            setIsStreaming(true);
            setStreamingText("");
            abortControllerRef.current = new AbortController();
            signal = abortControllerRef.current.signal;

            onChunk = (text: string) => {
                if (text) {
                    setStreamingText(prev => prev + text);
                }
            };

            onResetStream = () => {
                setStreamingText("");
            };

            // Identify turn messages (narration or player_action) from current history
            const turnMessagesAtStart = (gameMessages || []).filter(m => m.type === 'narration' || m.type === 'player_action');
            const uniqueTurnsAtStart = Array.from(new Set(turnMessagesAtStart.map(m => m.turnNumber))).sort((a, b) => Number(a) - Number(b));
            
            // If we have 5 or more existing turns, we MUST prune for the current AI call
            const turnsToKeepAtStart = uniqueTurnsAtStart.slice(-4);
            const reincarnationTurn = knowledgeBase.reincarnationTurn || 0;
            const cutoffTurnForAI = Math.max(reincarnationTurn, turnsToKeepAtStart.length > 0 ? turnsToKeepAtStart[0] : (uniqueTurnsAtStart[0] || 0));
            
            const filteredPreviousPageSummaries = (reincarnationTurn > 0 && knowledgeBase.playerStats.turn <= reincarnationTurn + 1) ? [] : previousPageSummaries;
            const filteredLastNarrationFromPreviousPage = (reincarnationTurn > 0 && knowledgeBase.playerStats.turn <= reincarnationTurn + 1) ? undefined : lastNarrationFromPreviousPage;

            // Re-calculate the log for the AI context specifically to respect the 5-turn limit (last 4 + current action)
            const prunedMessagesLogForAI = gameMessages
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

            const prunedNarrationContext = getRecentNarrations(gameMessages.filter(m => m.turnNumber >= cutoffTurnForAI));

            // Create a sync KB that will be modified in-place by sync steps
            syncKb = structuredClone(knowledgeBaseAtActionStart);

            const stalkedDebuffName = "Bị theo dõi sau đấu giá";
            const hasStalkedDebuff = knowledgeBaseAtActionStart.playerStats.activeStatusEffects?.some(
                (eff: any) => eff.name === stalkedDebuffName
            );
            
            if (!finalActionForAI) {
                finalActionForAI = cleanedAction + slavePrisonerTransactionPrompt;
            } else if (slavePrisonerTransactionPrompt) {
                finalActionForAI += slavePrisonerTransactionPrompt;
            }
            if (hasStalkedDebuff && Math.random() < 0.2) {
                finalActionForAI += "\n\n[HỆ THỐNG]: CẢNH BÁO PHỤC KÍCH: Người chơi mang trạng thái 'Bị theo dõi sau đấu giá' và lượt này hệ thống đã kích hoạt xác suất 20% bị chặn đường cướp bảo vật/nô lệ. Hãy bắt đầu dòng kể bằng việc người chơi đột ngột bị chặn đường, phục kích bởi các tặc nhân, đối thủ cũ trong phòng đấu giá hoặc thế lực thèm khát bảo vật/nô lệ đó. Sự kiện này là một cuộc chạm trán kẻ địch hung hãn hòng cướp đoạt những gì người chơi vừa đấu giá được. Hãy kể chi tiết cuộc chặn đường phục kích vô cùng nghẹt thở này, ép buộc người chơi phải chiến đấu hoặc phòng thủ dữ dội, dứt khoát kích hoạt combat tag [BEGIN_COMBAT: enemies=...] với kẻ địch thích hợp với tu vi/cảnh giới hiện tại của người chơi!";
            }

            // --- NPC DANGER EVENT ---
            const rollDanger = Math.floor(Math.random() * 100) + 1;
            if (rollDanger <= 2) {
                const allCharacters = [
                    ...knowledgeBaseAtActionStart.discoveredNPCs,
                    ...knowledgeBaseAtActionStart.wives,
                    ...knowledgeBaseAtActionStart.slaves,
                    ...knowledgeBaseAtActionStart.prisoners
                ];
                
                // Sort by highest affection/relationship points
                const sortedByAffection = allCharacters.sort((a, b) => {
                    const affA = a.affinity || 0;
                    const affB = b.affinity || 0;
                    return affB - affA;
                });

                const top10 = sortedByAffection.slice(0, 10);
                if (top10.length > 0) {
                    const selectedNpc = top10[Math.floor(Math.random() * top10.length)];
                    finalActionForAI += `\n\n[CƠ CHẾ HỆ THỐNG KÍCH HOẠT]: AN NGUY CỦA NPC!
Yêu cầu hệ thống: NPC tên là "${selectedNpc.name}" đang gặp một nguy hiểm lớn ảnh hưởng đến sự tồn tại/tính mạng của NPC đó. Hãy tạo ra một tình huống diễn tả sự nguy hiểm này (có thể là phân cảnh trực tiếp cùng MC hoặc là một phân cảnh song song, tùy theo tình huống nào hợp lý và khả thi hơn).`;
                }
            }
            // ------------------------

            // --- SATISFACTION DEGRADATION & ESCAPE EVENT (BASED ON SATISFACTION < 30%) ---
            // Giảm mức độ thỏa mãn của tù nhân và nô lệ mỗi lượt (giảm từ 1% đến 3% ngẫu nhiên)
            if (knowledgeBaseAtActionStart.prisoners) {
                knowledgeBaseAtActionStart.prisoners.forEach((p: any) => {
                    const currentSat = p.satisfaction !== undefined ? p.satisfaction : 100;
                    const decrease = Math.floor(Math.random() * 3) + 1; // 1% - 3%
                    p.satisfaction = Math.max(0, currentSat - decrease);
                });
            }
            if (knowledgeBaseAtActionStart.slaves) {
                knowledgeBaseAtActionStart.slaves.forEach((s: any) => {
                    const currentSat = s.satisfaction !== undefined ? s.satisfaction : 100;
                    const decrease = Math.floor(Math.random() * 3) + 1; // 1% - 3%
                    s.satisfaction = Math.max(0, currentSat - decrease);
                });
            }

            if (syncKb) {
                if (syncKb.prisoners) {
                    syncKb.prisoners.forEach((p: any) => {
                        const localP = knowledgeBaseAtActionStart.prisoners.find((kp: any) => kp.id === p.id);
                        if (localP) p.satisfaction = localP.satisfaction;
                    });
                }
                if (syncKb.slaves) {
                    syncKb.slaves.forEach((s: any) => {
                        const localS = knowledgeBaseAtActionStart.slaves.find((ks: any) => ks.id === s.id);
                        if (localS) s.satisfaction = localS.satisfaction;
                    });
                }
            }

            // Lọc ra danh sách những tù nhân + nô lệ có mức độ thỏa mãn tụt dưới 30%
            const escapablePrisoners = (knowledgeBaseAtActionStart.prisoners || []).filter((p: any) => (p.satisfaction !== undefined ? p.satisfaction : 100) < 30);
            const escapableSlaves = (knowledgeBaseAtActionStart.slaves || []).filter((s: any) => (s.satisfaction !== undefined ? s.satisfaction : 100) < 30);
            const totalEscapable = [...escapablePrisoners, ...escapableSlaves];

            const rollEscape = Math.floor(Math.random() * 100) + 1;
            if (rollEscape <= 5 && totalEscapable.length > 0) { // 5% tỉ lệ đào tẩu khi có người có mức thỏa mãn < 30%
                const availableCount = totalEscapable.length;
                const escapeCount = Math.min(availableCount, Math.floor(Math.random() * 2) + 1);
                
                const escapedEntities: any[] = [];
                const tempEscapable = [...totalEscapable];
                for (let i = 0; i < escapeCount; i++) {
                    if (tempEscapable.length === 0) break;
                    const idx = Math.floor(Math.random() * tempEscapable.length);
                    const [escaped] = tempEscapable.splice(idx, 1);
                    escapedEntities.push(escaped);
                }
                
                if (escapedEntities.length > 0) {
                    const silentEscapedNames: string[] = [];
                    const betrayerNames: string[] = [];
                    const betrayerIds: string[] = [];

                    escapedEntities.forEach(freedPerson => {
                        const rollBetrayal = Math.floor(Math.random() * 100) + 1;
                        const isBetrayal = rollBetrayal <= 30; // 30% cơ hội phản bội

                        // Xóa khỏi danh sách tương ứng
                        if (freedPerson.entityType === 'prisoner') {
                            knowledgeBaseAtActionStart.prisoners = (knowledgeBaseAtActionStart.prisoners || []).filter((p: any) => p.id !== freedPerson.id);
                        } else {
                            knowledgeBaseAtActionStart.slaves = (knowledgeBaseAtActionStart.slaves || []).filter((s: any) => s.id !== freedPerson.id);
                        }

                        const { entityType, willpower, obedience, resistance, equippedItems, skills, ...baseNpcData } = freedPerson;
                        const relationText = isBetrayal 
                            ? (freedPerson.entityType === 'prisoner' ? 'Tù nhân phản bội' : 'Nô lệ phản bội')
                            : (freedPerson.entityType === 'prisoner' ? 'Tù nhân đào tẩu' : 'Nô lệ đào tẩu');
                        
                        const affinityVal = isBetrayal ? -100 : Math.max(0, Math.floor((freedPerson.affinity || 0) - 20));

                        const newNpc: NPC = {
                            ...baseNpcData,
                            relationshipToPlayer: relationText,
                            affinity: affinityVal,
                            locationId: knowledgeBaseAtActionStart.currentLocationId,
                            skills: skills || [],
                        };
                        
                        knowledgeBaseAtActionStart.discoveredNPCs.push(newNpc);
                        
                        if (isBetrayal) {
                            betrayerNames.push(freedPerson.name);
                            betrayerIds.push(newNpc.id);
                        } else {
                            silentEscapedNames.push(freedPerson.name);
                        }
                        
                        if (knowledgeBaseAtActionStart.combatCompanionIds) {
                            knowledgeBaseAtActionStart.combatCompanionIds = knowledgeBaseAtActionStart.combatCompanionIds.filter((id: string) => id !== freedPerson.id);
                        }
                    });
                    
                    if (syncKb) {
                        escapedEntities.forEach(freedPerson => {
                            const matchedNpc = knowledgeBaseAtActionStart.discoveredNPCs.find((n: any) => n.id === freedPerson.id || n.name === freedPerson.name);
                            const relationText = matchedNpc ? matchedNpc.relationshipToPlayer : (freedPerson.entityType === 'prisoner' ? 'Tù nhân đào tẩu' : 'Nô lệ đào tẩu');
                            const affinityVal = matchedNpc ? matchedNpc.affinity : Math.max(0, Math.floor((freedPerson.affinity || 0) - 20));

                            if (freedPerson.entityType === 'prisoner') {
                                syncKb.prisoners = (syncKb.prisoners || []).filter((p: any) => p.id !== freedPerson.id);
                            } else {
                                syncKb.slaves = (syncKb.slaves || []).filter((s: any) => s.id !== freedPerson.id);
                            }

                            const { entityType, willpower, obedience, resistance, equippedItems, skills, ...baseNpcData } = freedPerson;
                            const newNpc: NPC = {
                                ...baseNpcData,
                                relationshipToPlayer: relationText,
                                affinity: affinityVal,
                                locationId: syncKb.currentLocationId,
                                skills: skills || [],
                            };
                            syncKb.discoveredNPCs.push(newNpc);
                            if (syncKb.combatCompanionIds) {
                                syncKb.combatCompanionIds = syncKb.combatCompanionIds.filter((id: string) => id !== freedPerson.id);
                            }
                        });
                    }

                    if (silentEscapedNames.length > 0) {
                        finalActionForAI += `\n\n[SỰ KIỆN HỆ THỐNG - ĐÀO TẨU THÀNH CÔNG]: Đối tượng tên là ${silentEscapedNames.join(', ')} do có mức độ thỏa mãn cực kỳ thấp (dưới 30%), đã âm thầm bẻ khóa/phá bỏ cấm chế, bẻ gãy xiềng xích sắt và trốn thoát thành công không một tiếng động! Hãy miêu tả cảnh đào tẩu âm thầm vô cùng kịch tính này vào nội dung truyện của lượt này để MC đột ngột phát hiện ra sự biến mất của họ.`;
                    }

                    if (betrayerNames.length > 0) {
                        const betrayalPendingCombat = {
                            opponentIds: betrayerIds,
                            surrenderedNpcIds: [],
                            analyzed: false,
                            enemy: { ids: betrayerIds },
                            analysis: null
                        };
                        knowledgeBaseAtActionStart.pendingCombat = betrayalPendingCombat;
                        if (syncKb) {
                            syncKb.pendingCombat = betrayalPendingCombat;
                        }

                        finalActionForAI += `\n\n[SỰ KIỆN HỆ THỐNG CỰC KỲ KHẨN CẤP - PHẢN BỘI & TẤN CÔNG]: Đối tượng tên là ${betrayerNames.join(', ')} do có mức độ thỏa mãn cực kỳ thấp (dưới 30%), đã tự bẻ khóa và phá vỡ xiềng xích sắt thành công. Tuy nhiên, họ KHÔNG đào tẩu âm thầm mà ôm oán hận ngút trời, quyết định nổi loạn và phản bội, lao vào tấn công trực diện hoặc cấu kết với phe địch (nếu trong cảnh hiện tại đang có xung đột với kẻ địch nào khác) để hãm hại MC hòng báo thù rửa hận vì đã bị bỏ đói, keo kiệt suốt thời gian qua!
Yêu cầu miêu tả truyện bắt buộc:
1. Hãy tạo phân cảnh oai hùng dũng mãnh hoặc u ám oán hận: từ đằng sau vang lên tiếng xiềng xích vỡ vụn xé rách không gian, các đối tượng trên bộc phát tu vi tự do.
2. Họ hét lớn tố cáo sự keo kiệt, tàn nhẫn của MC (ví dụ: đã bỏ đói suốt thời gian dài, không cho ăn, đối xử tệ bạc) rồi điên cuồng lao tới tấn công MC. Nếu trong truyện hiện hành đang có một thế lực thù địch/NPC đối địch nào khác xuất hiện chặn đường MC, họ sẽ lập tức nhảy về phía thế lực thù địch đó, gia nhập phe kẻ địch để lập liên minh trả cả nợ mới lẫn oán cũ!
3. Toàn bộ diễn biến oán hận này dẫn dắt tới một phân cảnh chiến đấu khốc liệt kịch tính.
4. Bạn BẮT BUỘC phải viết câu dẫn dắt nghẹt thở chuẩn bị tiến vào Combat và xuất ra tag [BEGIN_COMBAT: opponentIds="${betrayerNames.join(', ')}"] ở cuối bài (bạn có thể thêm các tên kẻ địch thù địch khác cùng tham chiến vào tham số opponentIds nếu có, ngăn cách bằng dấu phẩy).`;
                    }
                }
            }
            // -----------------------------------------------------------------

            // --- DEVIATE FLOW FOR MAT PHAP (MANUAL STEP CO-ORDINATOR) ---
            const isMatPhap = apiSettings.matPhapManual === true;
            const arcStateBeforeTurn = knowledgeBaseAtActionStart.arcState ? structuredClone(knowledgeBaseAtActionStart.arcState) : undefined;

            if (isMatPhap) {
                let finalOnChunk = onChunk;

                narrativeResult = await streamNextTurn(
                    knowledgeBaseAtActionStart, 
                    finalActionForAI,
                    inputType,
                    responseLength,
                    prunedMessagesLogForAI,
                    filteredPreviousPageSummaries,
                    filteredLastNarrationFromPreviousPage,
                    retrievedContext,
                    {
                        onChunk: finalOnChunk ? finalOnChunk : () => {},
                        onMetadata: (meta) => {
                            console.log(`[Story Stream] Lời kể hoàn tất trong ${meta.duration} bằng ${meta.model}`);
                        },
                        onError: (err) => {
                            console.error('[Story Stream] Lỗi phát sinh:', err);
                        }
                    },
                    (p) => logSentPromptCallback(p, turnOfPlayerAction),
                    signal,
                    contextLayers,
                    onResetStream,
                    customPromptOverride
                );

                narrativeMessageIdForEarlyRender = `narration-early-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
                const rawNarrationText = narrativeResult.response.narration || "";
                const cleanNarrationText = cleanTextFromXmlUpdates(rawNarrationText) || extractMainStoryContent(rawNarrationText);
                const earlyNarrationMessage: GameMessage = {
                    id: narrativeMessageIdForEarlyRender,
                    type: 'narration',
                    content: cleanNarrationText,
                    timestamp: Date.now(),
                    choices: narrativeResult.response.choices,
                    turnNumber: turnOfPlayerAction
                };

                setGameMessages(prev => {
                    if (prev.some(m => m.id === earlyNarrationMessage.id)) return prev;
                    const newMsgs = [...prev, earlyNarrationMessage];
                    if (narrativeResult.response.reunionOccurred) {
                        newMsgs.push({
                            id: `reunion-sys-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                            type: 'system',
                            content: `[Hệ thống] Một sự kiện tái ngộ NPC đã diễn ra! (Mục tiêu: ${narrativeResult.response.reunionNpcNames?.join(", ")})`,
                            timestamp: Date.now() + 1,
                            turnNumber: turnOfPlayerAction
                        });
                    }
                    return newMsgs;
                });

                if (styleSettings.turnResponseMode === 'streaming' && abortControllerRef.current) {
                    setIsStreaming(false);
                    setStreamingText("");
                    setIsSwapping(false);
                    abortControllerRef.current = null;
                }

                setIsLoadingApi(false);

                const turnContextForContinuation = {
                    knowledgeBase: knowledgeBaseAtActionStart,
                    arcStateSnapshot: arcStateBeforeTurn,
                    playerAction: finalActionForAI,
                    inputType,
                    responseLength,
                    currentPageMessagesLog: prunedMessagesLogForAI,
                    previousPageSummaries: filteredPreviousPageSummaries,
                    lastNarrationFromPreviousPage: filteredLastNarrationFromPreviousPage,
                    retrievedContext,
                    dynamicContextLayers: contextLayers,
                    customPromptOverride,
                    logSentPrompt: logSentPromptCallback
                };

                // Kiểm tra và xử lý bù đắp nếu lời kể bị đứt đoạn trước khi tạm dừng ở bước trích xuất
                narrativeResult = await checkAndRecoverIncompleteNarration(
                    narrativeResult,
                    narrativeMessageIdForEarlyRender,
                    turnOfPlayerAction,
                    turnContextForContinuation
                );

                // Save full context package for continuation via handleMatPhapContinue
                const matPhapCtx = {
                    knowledgeBaseAtActionStart,
                    cleanedAction,
                    startingCurrency,
                    gameMessagesAtActionStart: [...gameMessages],
                    turnOfPlayerAction,
                    narrativeMessageIdForEarlyRender,
                    narrativeResult,
                    syncKb: structuredClone(knowledgeBaseAtActionStart),
                    signal,
                    onResetStream,
                    turnHistoryAtStart
                };

                setUiState(prev => ({
                    ...prev,
                    matPhapStep: 'waiting_extraction',
                    matPhapCtx,
                }));

                return; // Stop auto processing here!
            }

            // --- V5.1: THREE-STEP GENERATION WITH COORDINATOR & DELAY ---
            const coordLocDetail = (knowledgeBaseAtActionStart.discoveredLocations || []).find(loc => loc.id === knowledgeBaseAtActionStart.currentLocationId);
            const coordLocName = coordLocDetail ? coordLocDetail.name : "Không rõ";
            const coordWorldDate = knowledgeBaseAtActionStart.worldDate;
            const coordTimeStr = coordWorldDate 
                ? `${coordWorldDate.timeOfDay}, Ngày ${coordWorldDate.day}, Tháng ${coordWorldDate.month}, Năm ${coordWorldDate.year}`
                : "Không rõ";

            const fullTurnResult = await TurnCoordinator.runFullTurn({
                isSuperManualMode: apiSettings.isSuperManualMode,
                locationName: coordLocName,
                timeString: coordTimeStr,
                callNarrative: () => streamNextTurn(
                    knowledgeBaseAtActionStart, 
                    finalActionForAI,
                    inputType,
                    responseLength,
                    prunedMessagesLogForAI,
                    filteredPreviousPageSummaries,
                    filteredLastNarrationFromPreviousPage,
                    retrievedContext,
                    {
                        onChunk: onChunk ? onChunk : () => {},
                        onMetadata: (meta) => {
                            console.log(`[Story Stream] Lời kể hoàn tất trong ${meta.duration} bằng ${meta.model}`);
                        },
                        onError: (err) => {
                            console.error('[Story Stream] Lỗi phát sinh:', err);
                        }
                    },
                    (p) => logSentPromptCallback(p, turnOfPlayerAction),
                    signal,
                    contextLayers, // Pass dynamic layers
                    onResetStream,
                    customPromptOverride
                ),
                onNarrativeReady: (res) => {
                    // CUNG CẤP TRUYỆN NGAY LẬP TỨC (UI Update - Turn 1 only)
                    narrativeMessageIdForEarlyRender = `narration-early-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
                    const rawNarration = res.response.narration || "";
                    const cleanedNarration = cleanTextFromXmlUpdates(rawNarration) || extractMainStoryContent(rawNarration);
                    const earlyNarrationMessage: GameMessage = {
                        id: narrativeMessageIdForEarlyRender,
                        type: 'narration',
                        content: cleanedNarration,
                        timestamp: Date.now(),
                        choices: res.response.choices,
                        turnNumber: turnOfPlayerAction
                    };
                    
                    // Hiển thị truyện ngay cho người chơi
                    setGameMessages(prev => {
                        // Tránh duplicate nếu loop chạy hai lần? Thường không xảy ra ở đây.
                        if (prev.some(m => m.id === earlyNarrationMessage.id)) return prev;
                        const newMsgs = [...prev, earlyNarrationMessage];
                        
                        // Nếu có sự kiện tái ngộ, thêm thông báo hệ thống
                        if (res.response.reunionOccurred) {
                            newMsgs.push({
                                id: `reunion-sys-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                                type: 'system',
                                content: `[Hệ thống] Một sự kiện tái ngộ NPC đã diễn ra! (Mục tiêu: ${res.response.reunionNpcNames?.join(", ")})`,
                                timestamp: Date.now() + 1,
                                turnNumber: turnOfPlayerAction
                            });
                        }
                        
                        return newMsgs;
                    });

                    // TẮT STREAMING NGAY KHI CÓ TRUYỆN CHÍNH THỨC ĐỂ BÀN GIAO DOM
                    if (styleSettings.turnResponseMode === 'streaming') {
                        setIsStreaming(false);
                        setStreamingText("");
                        setIsSwapping(false);
                    }

                    // Tắt loading chính để người chơi có thể đọc truyện
                    setIsLoadingApi(false);
                },
                onCheckIncomplete: async (res) => {
                    const turnContextForContinuation = {
                        knowledgeBase: knowledgeBaseAtActionStart,
                        arcStateSnapshot: arcStateBeforeTurn,
                        playerAction: finalActionForAI,
                        inputType,
                        responseLength,
                        currentPageMessagesLog: prunedMessagesLogForAI,
                        previousPageSummaries: filteredPreviousPageSummaries,
                        lastNarrationFromPreviousPage: filteredLastNarrationFromPreviousPage,
                        retrievedContext,
                        dynamicContextLayers: contextLayers,
                        customPromptOverride,
                        logSentPrompt: logSentPromptCallback
                    };
                    return await checkAndRecoverIncompleteNarration(
                        res,
                        narrativeMessageIdForEarlyRender,
                        turnOfPlayerAction,
                        turnContextForContinuation
                    );
                },
                callExtraction: async (text) => {
                    const currentLocDetail = (knowledgeBaseAtActionStart.discoveredLocations || []).find(loc => loc.id === knowledgeBaseAtActionStart.currentLocationId);
                    const locName = currentLocDetail ? currentLocDetail.name : "Không rõ";
                    
                    const worldDate = knowledgeBaseAtActionStart.worldDate;
                    const timeStr = worldDate 
                        ? `${worldDate.timeOfDay}, Ngày ${worldDate.day}, Tháng ${worldDate.month}, Năm ${worldDate.year}`
                        : "Không rõ";

                    return await DataExtractionService.extractTagsAndMemory(
                        text, 
                        cleanedAction, 
                        turnOfPlayerAction, 
                        locName, 
                        timeStr, 
                        knowledgeBaseAtActionStart,
                        (streamText) => {
                            setUiState(prev => ({
                                ...prev,
                                syncStreamingText: streamText
                            }));
                        }
                    );
                },
                callThienDaoSync: async (text, extractionResult) => {
                    // Lấy tên địa điểm
                    const currentLocDetail = (knowledgeBaseAtActionStart.discoveredLocations || []).find(loc => loc.id === knowledgeBaseAtActionStart.currentLocationId);
                    const locName = currentLocDetail ? currentLocDetail.name : "Không rõ";
                    
                    // Lấy thời gian hiện tại
                    const worldDate = knowledgeBaseAtActionStart.worldDate;
                    const timeStr = worldDate 
                        ? `${worldDate.timeOfDay}, Ngày ${worldDate.day}, Tháng ${worldDate.month}, Năm ${worldDate.year}`
                        : "Không rõ";

                    // Lưu dữ liệu để nhỡ cần retry
                    setUiState(prev => ({
                        ...prev,
                        lastFlashRetryData: {
                            action: cleanedAction,
                            aiResponse: text,
                            turn: turnOfPlayerAction,
                            locName,
                            timeStr
                        }
                    }));

                    // Ở đây, vì ta ĐÃ CÓ kết quả tóm tắt từ Lượt 2 truyền sang (extractionResult)
                    // Ta chỉ cần lưu trữ offline sền sệt cực mượt!
                    const fastMemory = extractionResult?.flashSummary || "";
                    const richMemory = extractionResult?.flashDetails || "";

                    if (fastMemory && richMemory) {
                        console.log(`[Flash Agent - Offline] Đồng bộ ký ức lượt ${turnOfPlayerAction} hoàn toàn offline.`);
                        await saveFlashAgentMemoryOffline(
                            turnOfPlayerAction,
                            setKnowledgeBase,
                            fastMemory,
                            richMemory,
                            syncKb,
                            locName,
                            timeStr,
                            text
                        );
                    } else {
                        // Phát hiện thiếu tóm tắt: Dừng mọi tác vụ, hiển thị modal chờ người dùng quyết định
                        console.warn(`[Flash Agent] Thiếu tóm tắt lượt ${turnOfPlayerAction}. Dừng mọi tác vụ chờ quyết định người dùng...`);
                        
                        setUiState(prev => ({ ...prev, isFlashSummaryMissingModalOpen: true }));

                        // Chờ người chơi lựa chọn qua Promise
                        const shouldCallApi = await new Promise<boolean>((resolve) => {
                            pendingFlashAgentRecoveryRef.current = {
                                resolve,
                                reject: () => resolve(false)
                            };
                        });

                        pendingFlashAgentRecoveryRef.current = null;

                        if (shouldCallApi) {
                            console.log(`[Flash Agent] Người dùng chọn gọi API để tạo lại tóm tắt.`);
                            await runFlashAgentAsync(
                                cleanedAction, 
                                text, 
                                turnOfPlayerAction, 
                                setKnowledgeBase,
                                "",
                                syncKb,
                                locName,
                                timeStr
                            );
                        } else {
                            console.log(`[Flash Agent] Người dùng chọn bỏ qua gọi API, đồng bộ rỗng.`);
                            await saveFlashAgentMemoryOffline(
                                turnOfPlayerAction,
                                setKnowledgeBase,
                                "",
                                "",
                                syncKb,
                                locName,
                                timeStr,
                                text
                            );
                        }
                    }

                    // --- CƠ CHẾ KIỂM TRA CƠ HỌC & KHÔI PHỤC (2.5S để tránh lag) ---
                    setTimeout(async () => {
                        // Use functional update to check the LATEST state, avoiding stale closure issues
                        setKnowledgeBase(currentKb => {
                            const flashEntry = currentKb.ragHistoryLog?.find(log => log && log.turn === turnOfPlayerAction && log.type === 'flash_agent');
                            const isMissing = !flashEntry || !flashEntry.summary || !flashEntry.richSummary;

                            if (isMissing) {
                                console.warn(`[Summary Audit] Thiếu tóm tắt lượt ${turnOfPlayerAction}. Đang thử khôi phục nhanh...`);
                                
                                const fallbackFast = fastMemory || "Không thể tóm tắt diễn biến.";
                                const fallbackRich = richMemory || "Không thể phân tích chi tiết cốt truyện.";
                                
                                // Return the updated KB with memory added
                                let updatedKb = { ...currentKb };
                                if (!updatedKb.ragHistoryLog) updatedKb.ragHistoryLog = [];
                                
                                // Only add if still missing to avoid duplicates
                                if (!updatedKb.ragHistoryLog.some(log => log && log.turn === turnOfPlayerAction && log.type === 'flash_agent')) {
                                    updatedKb.ragHistoryLog.push({
                                        turn: turnOfPlayerAction,
                                        timestamp: new Date().toLocaleTimeString('vi-VN', { hour12: false }),
                                        content: `[FLASH AGENT MEMORY - TURN ${turnOfPlayerAction}]\n${fallbackRich}`,
                                        richSummary: fallbackRich,
                                        summary: fallbackFast,
                                        type: 'flash_agent'
                                    });
                                }
                                return updatedKb;
                            }
                            return currentKb;
                        });
                    }, 2500);
                    // -----------------------------------------------
                },
                onStepChange: (step) => {
                    if (step === 'syncing') {
                        setUiState(prev => ({ ...prev, isSyncingData: true }));
                    } else if (step === 'narrative' || step === 'delay') {
                        // Ensure it's false when not syncing
                        setUiState(prev => ({ ...prev, isSyncingData: false, syncStreamingText: undefined }));
                    }
                }
            });

            narrativeResult = fullTurnResult.narrativeResult;
            extractionTags = fullTurnResult.extractedTags;
        }

        setUiState(prev => ({ ...prev, isSyncingData: false, syncStreamingText: undefined }));

        // --- GIẢI PHÓNG UI TRƯỚC KHI XỬ LÝ CƠ HỌC NẶNG ---
            await new Promise(resolve => setTimeout(resolve, 0));

            let response = narrativeResult?.response || {} as any;
            response.narration = cleanTextFromXmlUpdates(response.narration || "");
            let rawText = narrativeResult?.rawText || "";
            
            const extractedTags = extractionTags;

            // KIỂM TRA DỪNG KHẨN CẤP (ROLLBACK)
            if (signal?.aborted) {
                console.log("AI generation aborted, stopping state updates.");
                return;
            }

            if (styleSettings.turnResponseMode === 'streaming') {
                setIsSwapping(true);
                // Buffer to allow StoryLog to measure the streaming text height
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            logReceivedResponseCallback(rawText, turnOfPlayerAction);
            
            let currentTurnKb = syncKb || structuredClone(knowledgeBaseAtActionStart); // Use the KB that was modified by sync steps
            let systemMessagesForThisTurn: GameMessage[] = [];
            if (escapedPrisonerNames.length > 0) {
                systemMessagesForThisTurn.push({
                    id: `escape-sys-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                    type: 'system',
                    content: `[CƠ CHẾ HỆ THỐNG - TÙ NHÂN ĐÀO TẨU]: Tù nhân ${escapedPrisonerNames.join(', ')} đã bẻ gãy xích sắt, hóa giải cấm chế hoàn toàn cơ học và trốn thoát thành công! Họ đã rời khỏi ngục tối của bạn và trở thành kẻ tự do trong thế giới này.`,
                    timestamp: Date.now(),
                    turnNumber: turnOfPlayerAction
                });
            }
            let turnIncrementedByTag = false;

            // --- MAIN STORY FALLBACK NOTIFICATION ---
            const apiSettings = getApiSettings();
            const targetModel = apiSettings.model;
            const actualModel = response?.modelUsed;

            if (actualModel && actualModel !== targetModel) {
                if (uiState.lastNotifiedFallbackModel !== actualModel) {
                    systemMessagesForThisTurn.push({
                        id: `fallback-notice-${Date.now()}`,
                        type: 'system',
                        content: `Hệ thống: Model ${targetModel} đang quá tải hoặc gặp lỗi. Đã tự động chuyển sang model ${actualModel} để tiếp tục.`,
                        timestamp: Date.now(),
                        turnNumber: turnOfPlayerAction
                    });
                    setUiState(prev => ({ ...prev, lastNotifiedFallbackModel: actualModel }));
                }
            } else if (actualModel && actualModel === targetModel) {
                if (uiState.lastNotifiedFallbackModel) {
                    systemMessagesForThisTurn.push({
                        id: `fallback-recover-${Date.now()}`,
                        type: 'system',
                        content: `Hệ thống: Đã kết nối lại thành công với model chính ${targetModel}.`,
                        timestamp: Date.now(),
                        turnNumber: turnOfPlayerAction
                    });
                    setUiState(prev => ({ ...prev, lastNotifiedFallbackModel: undefined }));
                }
            }

            // Parse XML updates from raw text and combine with extractedTags
            const xmlLegacyTags = parseXmlUpdatesToLegacyTags(rawText);
            const allTags = [...(extractedTags || []), ...xmlLegacyTags];

            // If there are AI-dictated hidden NPC index changes, apply them automatically
            if (response?.npcChanges && response.npcChanges.length > 0) {
                response.npcChanges.forEach((change: any) => {
                    const npcLists = [
                        currentTurnKb.discoveredNPCs,
                        currentTurnKb.wives || [],
                        currentTurnKb.slaves || [],
                        currentTurnKb.prisoners || []
                    ];
                    
                    let targetNpc: any = undefined;
                    
                    if (change.name) {
                        const targetNameNorm = change.name.toLowerCase().trim();
                        for (const list of npcLists) {
                            const found = list.find(n => n.name.toLowerCase().trim() === targetNameNorm);
                            if (found) {
                                targetNpc = found;
                                break;
                            }
                        }
                    }
                    
                    if (!targetNpc && currentTurnKb.discoveredNPCs.length > 0) {
                        const sortedNpcs = [...currentTurnKb.discoveredNPCs].sort((a, b) => 
                            (b.lastInteractionTurn || 0) - (a.lastInteractionTurn || 0)
                        );
                        if (sortedNpcs.length > 0) {
                            targetNpc = sortedNpcs[0];
                        }
                    }
                    
                    if (targetNpc) {
                        if (change.pride_change !== undefined) {
                            const currentPride = targetNpc.pride !== undefined ? targetNpc.pride : 50;
                            targetNpc.pride = Math.max(0, Math.min(100, currentPride + change.pride_change));
                        }
                        if (change.affinity_change !== undefined) {
                            const currentVal = targetNpc.affinity || 0;
                            let delta = change.affinity_change;
                            // Apply mechanical constraints: increase max 15, decrease max 50
                            if (delta > 15) delta = 15;
                            if (delta < -50) delta = -50;
                            targetNpc.affinity = Math.max(-100, Math.min(100, currentVal + delta));
                        }
                        if (change.resentment_change !== undefined) {
                            const currentRes = targetNpc.resentmentCounter || 0;
                            targetNpc.resentmentCounter = Math.max(0, currentRes + change.resentment_change);
                        }
                    }
                });
            }

            if (!currentTurnKb) {
                console.error("currentTurnKb is null before performTagProcessing! Falling back to knowledgeBase prop.");
                currentTurnKb = fastCloneKb(knowledgeBase);
            }

            const { 
                newKb: kbAfterTags, 
                systemMessagesFromTags, 
                turnIncrementedByTag: tagTurnInc,
                tagErrors,
                unrecognizedTags
            } = await performTagProcessing(currentTurnKb, allTags, turnOfPlayerAction, logNpcAvatarPromptCallback); 

            kbAfterTags.pendingCorrections = [];

            const oldDate = currentTurnKb.worldDate || { canh: 1, hour: 7, timeOfDay: 'Sáng', day: 1, month: 1, year: 1 };
            let newDate = kbAfterTags.worldDate || oldDate;
            // Nếu AI quên sinh tag CHANGE_TIME, thời gian sẽ không đổi
            if (oldDate.canh === newDate.canh && oldDate.day === newDate.day && oldDate.hour === newDate.hour) {
                kbAfterTags.worldDate = advanceTime(oldDate, 1, 0, 0); // Tịnh tiến 1 canh
                systemMessagesFromTags.push({
                    id: `sys-time-fallback-${Date.now()}`,
                    type: 'system',
                    content: '🕒 Đã qua 1 canh giờ.',
                    timestamp: Date.now(),
                    turnNumber: turnOfPlayerAction
                });
                // Tự động trừ thọ nguyên cơ học cho 1 canh giờ (1/4320 năm)
                const canhLifespanRes = applyLifespanDeduction(kbAfterTags, 1 / 4320, turnOfPlayerAction);
                systemMessagesFromTags.push(...canhLifespanRes.systemMessages);
            }            
            // --- DETECT IMPLICIT COMBAT ---
            // Đã tắt cơ chế "Tự động kích hoạt combat qua bối cảnh" theo yêu cầu người dùng.
            if (false && !kbAfterTags.pendingCombat && !kbAfterTags.playerStats.isInCombat) {
                // Check if the current turn has NSFW content
                const isTurnNsfw = 
                    response?.isNsfwActive === true || 
                    kbAfterTags.isNsfwSceneActive === true || 
                    (response?.nsfwStage && response.nsfwStage !== 'none') ||
                    ["hoan lạc", "giao hợp", "làm tình", "mây mưa", "cởi đồ", "khoái cảm", "rên rỉ", "đút vào", "dâm dục", "khỏa thân", "ân ái", "thân thể", "khoái lạc", "nhục dục", "nhục thể", "dâm thủy", "mật dịch", "ngọc môn", "quy đầu", "âm hộ", "dương vật", "kích thích", "rên khẽ", "bạch hổ"].some(k => rawText.toLowerCase().includes(k));

                if (!isTurnNsfw) {
                    const implicitCheck = detectImplicitCombat(rawText, kbAfterTags);
                    if (implicitCheck.suspected) {
                        const opponentNames: string[] = [];
                        if (implicitCheck.mentionedHostileIds && implicitCheck.mentionedHostileIds.length > 0) {
                            implicitCheck.mentionedHostileIds.forEach(id => {
                                const entity = [
                                    ...kbAfterTags.discoveredNPCs,
                                    ...kbAfterTags.discoveredYeuThu,
                                    ...kbAfterTags.wives,
                                    ...kbAfterTags.slaves,
                                    ...kbAfterTags.prisoners
                                ].find(e => e.id === id);
                                if (entity && entity.name) {
                                    opponentNames.push(entity.name);
                                }
                            });
                        }
                        
                        // Fallback scan if list is empty
                        if (opponentNames.length === 0) {
                            const lowerRawText = rawText.toLowerCase();
                            const allEntities = [...kbAfterTags.discoveredNPCs, ...kbAfterTags.discoveredYeuThu];
                            allEntities.forEach(ent => {
                                if (ent.name && lowerRawText.includes(ent.name.toLowerCase())) {
                                    opponentNames.push(ent.name);
                                }
                            });
                        }
                        
                        if (opponentNames.length === 0) {
                            opponentNames.push("Kẻ địch");
                        }

                        console.log(`[IMPLICIT COMBAT TRIGGERED] Suspected combat in raw text. Opponents: ${opponentNames.join(', ')}`);
                        const { updatedKb: kbWithCombat, systemMessages: combatSysMsgs } = processBeginCombat(
                            kbAfterTags,
                            { opponentIds: opponentNames.join(',') }
                        );
                        
                        // Apply updates directly to kbAfterTags
                        if (kbWithCombat.pendingCombat) {
                            kbAfterTags.pendingCombat = kbWithCombat.pendingCombat;
                        }
                        if (combatSysMsgs && combatSysMsgs.length > 0) {
                            systemMessagesFromTags.push(...combatSysMsgs);
                        }
                        
                        systemMessagesFromTags.push({
                            id: `implicit-combat-notice-${Date.now()}`,
                            type: 'system',
                            content: `Hệ thống: Phát hiện tình huống giao tranh ngầm. Tự động chuyển cảnh sang chuẩn bị chiến đấu với: ${opponentNames.join(', ')}.`,
                            timestamp: Date.now(),
                            turnNumber: turnOfPlayerAction
                        });
                    }
                }
            }

            // --- COMBAT CLIFFHANGER PROTOCOL FALLBACK ---
            // Nếu Flash Agent hoàn thành tác vụ nhưng trượt tag [BEGIN_COMBAT] trong khi phản hồi thô (rawText) của AI chính
            // có chứa chỉ thị COMBAT_CLIFFHANGER_PROTOCOL hoặc [BEGIN_COMBAT], tự động kích hoạt pendingCombat cơ học
            // để chuyển tiếp sang bước "AI Phân Tích Trước Chiến Đấu".
            if (kbAfterTags.worldConfig?.isCultivationEnabled !== false && !kbAfterTags.playerStats.isDead && kbAfterTags.playerStats.sinhLuc > 0) {
                if (!kbAfterTags.pendingCombat && !kbAfterTags.playerStats.isInCombat) {
                    const upperRawText = (rawText || "").toUpperCase();
                    const hasCliffhangerSignal = 
                        upperRawText.includes("COMBAT_CLIFFHANGER_PROTOCOL") ||
                        upperRawText.includes("COMBAT_CLIFFHANGER") ||
                        upperRawText.includes("BEGIN_COMBAT") ||
                        upperRawText.includes("KÍCH HOẠT PHÂN TÍCH CHIẾN ĐẤU") ||
                        upperRawText.includes("KICH HOAT PHAN TICH CHIEN DAU");

                    if (hasCliffhangerSignal) {
                        console.log("[COMBAT CLIFFHANGER FALLBACK] Detected cliffhanger signal in raw text. Initializing pendingCombat fallback...");
                        
                        const lowerRawText = (rawText || "").toLowerCase();
                        const opponentNames: string[] = [];
                        const allEntities = [
                            ...kbAfterTags.discoveredNPCs,
                            ...kbAfterTags.discoveredYeuThu,
                            ...kbAfterTags.wives,
                            ...kbAfterTags.slaves,
                            ...kbAfterTags.prisoners
                        ];

                        allEntities.forEach(ent => {
                            if (ent.name && lowerRawText.includes(ent.name.toLowerCase())) {
                                if (!opponentNames.includes(ent.name)) {
                                    opponentNames.push(ent.name);
                                }
                            }
                        });

                        if (opponentNames.length === 0) {
                            opponentNames.push("Kẻ địch");
                        }

                        const { updatedKb: kbWithCombat, systemMessages: combatSysMsgs } = processBeginCombat(
                            kbAfterTags,
                            { opponentIds: opponentNames.join(',') }
                        );

                        if (kbWithCombat.pendingCombat) {
                            kbAfterTags.pendingCombat = kbWithCombat.pendingCombat;
                        }
                        if (combatSysMsgs && combatSysMsgs.length > 0) {
                            systemMessagesFromTags.push(...combatSysMsgs);
                        }

                        systemMessagesFromTags.push({
                            id: `cliffhanger-combat-fallback-${Date.now()}`,
                            type: 'system',
                            content: `⚔️ Hệ thống: Phát hiện tín hiệu COMBAT_CLIFFHANGER_PROTOCOL trong phản hồi AI nhưng thiếu tag. Tự động chuyển giao cho AI Phân tích trước chiến đấu.`,
                            timestamp: Date.now(),
                            turnNumber: turnOfPlayerAction
                        });
                    }
                }
            } else {
                // NẾU TẮT TU LUYỆN HOẶC NHÂN VẬT ĐÃ CHẾT: Xóa sổ pendingCombat để đảm bảo an toàn tuyệt đối
                kbAfterTags.pendingCombat = null;
            }

            // Áp dụng cơ chế bảo vệ hậu chiến: Cấm pendingCombat và tắt cơ chế trừ HP cơ học trong lượt này
            if (isPostCombatAction(action)) {
                applyPostCombatMechanicOverrides(
                    kbAfterTags,
                    knowledgeBaseAtActionStart,
                    action
                );
                kbAfterTags.pendingCombat = null;
            }
            
            // Nghỉ ngắn để trình duyệt xử lý render/GC
            await new Promise(resolve => setTimeout(resolve, 10));

            // --- STEP 2: THIÊN ĐẠO SYNC (QUESTS & LOGIC & LOCATIONS) ---
            const { updatedKb: kbAfterQuestSync, systemMessages: syncMessages } = await QuestSyncService.sync(kbAfterTags);
            
            // Nghỉ ngắn giữa các block xử lý
            await new Promise(resolve => setTimeout(resolve, 10));
            turnIncrementedByTag = tagTurnInc;
            let finalKbForThisTurn = kbAfterQuestSync;
            systemMessagesForThisTurn.push(...systemMessagesFromTags, ...syncMessages);

            // FORCE 100 HP / 50 MP for player if cultivation is disabled
            if (finalKbForThisTurn.worldConfig?.isCultivationEnabled === false) {
                finalKbForThisTurn.playerStats = {
                    ...finalKbForThisTurn.playerStats,
                    baseMaxSinhLuc: 100,
                    baseMaxLinhLuc: 50,
                    maxSinhLuc: 100,
                    maxLinhLuc: 50,
                    sucTanCong: Math.max(finalKbForThisTurn.playerStats.sucTanCong, 10),
                    sinhLuc: Math.min(finalKbForThisTurn.playerStats.sinhLuc, 100),
                    linhLuc: Math.min(finalKbForThisTurn.playerStats.linhLuc, 50),
                };
            }

            const locationBefore = knowledgeBaseAtActionStart.currentLocationId;
            const locationAfter = finalKbForThisTurn.currentLocationId;

            // Check for first visit to a major location to generate its sub-locations
            if (locationAfter && locationAfter !== locationBefore) {
                const targetLocationIndex = finalKbForThisTurn.discoveredLocations.findIndex(l => l.id === locationAfter);
                if (targetLocationIndex > -1) {
                    const targetLocation = finalKbForThisTurn.discoveredLocations[targetLocationIndex];
                    const isFirstVisit = !targetLocation.visited && !targetLocation.parentLocationId;

                    if (isFirstVisit) {
                        finalKbForThisTurn.discoveredLocations[targetLocationIndex].visited = true;
                        systemMessagesForThisTurn.push({ id: `gen-details-notice-${Date.now()}`, type: 'system', content: `Đang tạo chi tiết cho ${targetLocation.name}...`, timestamp: Date.now(), turnNumber: turnOfPlayerAction });

                        // Sequential generation with 1s delay for API spacing
                        const allResponses = [];
                        
                        const subLocResponse = await generateGeneralSubLocations(
                            targetLocation,
                            finalKbForThisTurn,
                        );
                        allResponses.push(subLocResponse);
                        
                        // Generate economy only for specific location types
                         const eligibleForEconomy = [
                            GameTemplates.LocationType.TOWN,
                            GameTemplates.LocationType.CITY,
                            GameTemplates.LocationType.CAPITAL
                         ].includes(targetLocation.locationType as any);

                        if (eligibleForEconomy) {
                            await new Promise(resolve => setTimeout(resolve, 4000));
                            const economyResponse = await generateCityEconomy(
                                targetLocation,
                                finalKbForThisTurn
                            );
                            allResponses.push(economyResponse);
                        }
                        
                        // Process their tags
                        for (const parsedResponse of allResponses) {
                            const tagsToProcess = extractSatelliteTags((parsedResponse as any).rawText, (parsedResponse as any).tags || (parsedResponse as any).response?.tags);
                             const { 
                                newKb: kbAfterSubGenTags, 
                                systemMessagesFromTags: subGenSystemMessages,
                                tagErrors: subGenTagErrors
                            } = await performTagProcessing(
                                finalKbForThisTurn, 
                                tagsToProcess, 
                                finalKbForThisTurn.playerStats.turn, 
                                logNpcAvatarPromptCallback
                            );
                            
                            kbAfterSubGenTags.pendingCorrections = [];

                            finalKbForThisTurn = kbAfterSubGenTags;
                            systemMessagesForThisTurn.push(...subGenSystemMessages);
                        }
                    }
                }
            }
            
            let manualTurnIncrementMessage: GameMessage | null = null;
            
            if (turnIncrementedByTag) {
                if (finalKbForThisTurn.playerStats.turn < turnOfPlayerAction) {
                    finalKbForThisTurn.playerStats.turn = turnOfPlayerAction;
                    manualTurnIncrementMessage = {
                        id: 'manual-fix-turn-' + Date.now(), type: 'system', 
                        content: `Hệ thống: Lượt chơi đã được điều chỉnh thành ${finalKbForThisTurn.playerStats.turn} (do AI tag không hợp lệ).`, 
                        timestamp: Date.now(), turnNumber: turnOfPlayerAction 
                    };
                }
            } else {
                finalKbForThisTurn.playerStats.turn = turnOfPlayerAction;
            }

            // Pending Quests Timeout Logic on Turn Advance
            if (finalKbForThisTurn.playerStats.turn > knowledgeBaseAtActionStart.playerStats.turn) {
                const turnsPassed = finalKbForThisTurn.playerStats.turn - knowledgeBaseAtActionStart.playerStats.turn;
                let failedQuestCount = 0;
                let failedQuestNames: string[] = [];
                finalKbForThisTurn.allQuests = finalKbForThisTurn.allQuests.map(q => {
                    if (q.status === 'pending') {
                        const newTurns = (q.turnsPending || 0) + turnsPassed;
                        if (newTurns >= 3) {
                            failedQuestCount++;
                            failedQuestNames.push(q.title);
                            return { ...q, status: 'failed', punishmentText: q.punishmentText || "Bạn đã phớt lờ nhiệm vụ quá lâu.", turnsPending: newTurns, resolvedAtTurn: finalKbForThisTurn.playerStats.turn };
                        }
                        return { ...q, turnsPending: newTurns };
                    }
                    return q;
                });

                if (failedQuestCount > 0) {
                    systemMessagesForThisTurn.push({
                        id: `quest_timeout_${Date.now()}`,
                        type: 'system',
                        content: `BẠN ĐÃ TỪ CHỐI NHIỆM VỤ: [${failedQuestNames.join(', ')}]. NPC liên quan có thể sẽ khó chịu, tình tiết có thể thay đổi theo hướng xấu ở lượt tới.`,
                        timestamp: Date.now(),
                        turnNumber: finalKbForThisTurn.playerStats.turn
                    });
                }
            }
            
            const { updatedKb: kbAfterEvo, systemMessages: evoMsgs } = WorldProgressionService.processWorldEvolution(finalKbForThisTurn);
            finalKbForThisTurn = kbAfterEvo;
            systemMessagesForThisTurn.push(...evoMsgs);
            
            // Process original timeline jumps
            if (finalKbForThisTurn.arcState && finalKbForThisTurn.arcState.originalTimelineIndex != null) {
                const worldConfig = finalKbForThisTurn.worldConfig; // Fallback for old kb structure if worldSettings is kept within? Actually it's worldConfig.
                // Just to be safe:
                const events = worldConfig?.timelineEvents;
                if (events && events.length > 0) {
                    const currentIndex = finalKbForThisTurn.arcState.originalTimelineIndex;
                    if (currentIndex < events.length - 1) {
                        if (finalKbForThisTurn.arcState.originalEventResolved) {
                            // Mark previous main quest as completed
                            const oldQuestId = `mainsq-${currentIndex}`;
                            if (finalKbForThisTurn.allQuests) {
                                const oldQuest = finalKbForThisTurn.allQuests.find(q => q.id === oldQuestId);
                                if (oldQuest) {
                                    oldQuest.status = 'completed';
                                    oldQuest.objectives.forEach(obj => obj.completed = true);
                                    oldQuest.updatedAt = Date.now();
                                }
                            }

                            const nextIndex = currentIndex + 1;
                            finalKbForThisTurn.arcState.originalTimelineIndex = nextIndex;
                            finalKbForThisTurn.arcState.originalEventResolved = false;
                            
                            systemMessagesForThisTurn.push({
                                id: `timeline-event-${Date.now()}`,
                                type: 'system',
                                content: `[Cột Mốc Cốt Truyện] Đã hoàn thành sự kiện cũ. Bước sang mốc mới: ${events[nextIndex].periodName} - Sự kiện: ${events[nextIndex].eventName}.`,
                                timestamp: Date.now(),
                                turnNumber: finalKbForThisTurn.playerStats.turn
                            });

                            // Auto-assign the next story event as an active quest
                            const questId = `mainsq-${nextIndex}`;
                            if (!finalKbForThisTurn.allQuests) {
                                finalKbForThisTurn.allQuests = [];
                            }
                            const existingQuest = finalKbForThisTurn.allQuests.find(q => q.id === questId);
                            if (!existingQuest) {
                                finalKbForThisTurn.allQuests.push({
                                    id: questId,
                                    title: `[Cốt Truyện] ${events[nextIndex].eventName}`,
                                    description: events[nextIndex].description || "Tham gia vào dòng chảy lịch sử nguyên tác.",
                                    status: 'active' as const,
                                    objectives: [
                                        {
                                            id: 'obj-main',
                                            text: events[nextIndex].requiredAction || "Đẩy nhanh tiến trình sự kiện để hệ thống chuyển sang mốc tiếp theo.",
                                            completed: false
                                        }
                                    ],
                                    updatedAt: Date.now()
                                });
                            }
                        }
                    }
                }
            }
            
            const npcProgressionResult = progressNpcCultivation(finalKbForThisTurn);
            finalKbForThisTurn = npcProgressionResult.updatedKb;
            systemMessagesForThisTurn.push(...npcProgressionResult.systemMessages);

            // --- XỬ LÝ HÀNH ĐỘNG NGẦM CỦA "NGƯỜI CHƠI SỐ 0" (PLAYER ZERO) ---
            try {
                const isPlayerZeroActive = localStorage.getItem('isPlayerZeroActive') === 'true';
                
                const last5Narrations = (gameMessagesAtActionStart || [])
                    .filter(m => m.type === 'narration' && m.content)
                    .slice(-5)
                    .map(m => m.content as string);
                
                if (narrativeResult?.response?.narration) {
                    last5Narrations.push(narrativeResult.response.narration);
                }

                const pZeroResult = await PlayerZeroService.processPlayerZeroTurn(finalKbForThisTurn, isPlayerZeroActive, last5Narrations);
                finalKbForThisTurn = pZeroResult.updatedKb;
                if (pZeroResult.systemMessages && pZeroResult.systemMessages.length > 0) {
                    systemMessagesForThisTurn.push(...pZeroResult.systemMessages);
                }
            } catch (err) {
                console.error("[Player Zero Error]:", err);
            }

            // 5. Audit all entities
            // Optimize: Build NPC list once
            const allAliveNPCs = [
                ...(finalKbForThisTurn.discoveredNPCs || []),
                ...(finalKbForThisTurn.wives || []),
                ...(finalKbForThisTurn.slaves || []),
                ...(finalKbForThisTurn.prisoners || [])
            ];

            // Centralized Entity Processing
            // 1. Tự động gán kỹ năng
            autoAssignNpcSkills(allAliveNPCs); 

            // --- [QUAN TRỌNG] CẬP NHẬT BỘ ĐẾM TÁI NGỘ NPC & ĐỒNG BỘ DANH TÍNH ---
            try {
                finalKbForThisTurn = NpcLifecycleManager.deduplicateNpcs(finalKbForThisTurn);
                await NpcLifecycleManager.updateNpcCounters(finalKbForThisTurn, response.narration);
            } catch (err) {
                console.error("[NPC Lifecycle] Lỗi khi cập nhật bộ đếm NPC:", err);
            }

            // Nghỉ để UI cập nhật (giảm tải sau vòng lặp NPC)
            await new Promise(resolve => setTimeout(resolve, 0));

            const checkAndReduceEffects = (entity: any, entityName: string) => {
                const effectsToExpire: string[] = [];
                if (entity && entity.activeStatusEffects) {
                    entity.activeStatusEffects = entity.activeStatusEffects
                        .map((effect: any) => {
                            if (effect.durationTurns > 0) {
                                effect.durationTurns -= 1;
                                if (effect.durationTurns === 0) {
                                    effectsToExpire.push(effect.name);
                                }
                            }
                            return effect;
                        })
                        .filter((effect: any) => effect.durationTurns !== 0); 
                    
                    effectsToExpire.forEach(effectName => {
                        systemMessagesForThisTurn.push({
                            id: `status-effect-expired-${entityName}-${effectName}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`, type: 'system',
                            content: entityName === 'MC' ? VIETNAMESE.statusEffectRemoved(effectName) : `[${entityName}] đã hết hiệu ứng: ${effectName}`,
                            timestamp: Date.now(), turnNumber: finalKbForThisTurn.playerStats.turn 
                        });
                    });
                }
            };

            // 2. MC Effects
            checkAndReduceEffects(finalKbForThisTurn.playerStats, 'MC');

            // 3. NPC Effects & Text Statuses (Consolidated loop)
            allAliveNPCs.forEach(npc => {
                if (npc.stats) {
                    checkAndReduceEffects(npc.stats, npc.name);
                }

                if (npc.status && npc.status.trim() !== '') {
                    if (npc.statusDuration === undefined || npc.statusDuration === null || isNaN(npc.statusDuration)) {
                        npc.statusDuration = 5;
                    }
                    npc.statusDuration -= 1;
                    if (npc.statusDuration <= 0) {
                        const expiredStatus = npc.status;
                        npc.status = undefined;
                        npc.statusDuration = undefined;
                        systemMessagesForThisTurn.push({
                            id: `npc-status-expired-${npc.id}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                            type: 'system',
                            content: `[${npc.name}] đã hết trạng thái: "${expiredStatus}"`,
                            timestamp: Date.now(),
                            turnNumber: finalKbForThisTurn.playerStats.turn
                        });
                    }
                }

                if (npc.appearance && npc.appearance.trim() !== '') {
                    if (npc.appearanceDuration === undefined || npc.appearanceDuration === null || isNaN(npc.appearanceDuration)) {
                        npc.appearanceDuration = 5;
                    }
                    npc.appearanceDuration -= 1;
                    if (npc.appearanceDuration <= 0) {
                        // Nếu có diện mạo từ ảnh, khôi phục về đó thay vì undefined
                        npc.appearance = npc.avatarAppearance || undefined;
                        npc.appearanceDuration = undefined;
                    }
                }

                // Xóa cờ chuyển đổi diện mạo sau khi đã xử lý xong lượt truyện
                if (npc.avatarAppearancePendingTransition) {
                    npc.avatarAppearancePendingTransition = false;
                }
            });

            if (finalKbForThisTurn.master) {
                if ((finalKbForThisTurn.master as any).stats) {
                    checkAndReduceEffects((finalKbForThisTurn.master as any).stats, finalKbForThisTurn.master.name);
                }
                const master = finalKbForThisTurn.master;
                if (master.appearance && master.appearance.trim() !== '') {
                    if (master.appearanceDuration === undefined || master.appearanceDuration === null || isNaN(master.appearanceDuration)) {
                        master.appearanceDuration = 5;
                    }
                    master.appearanceDuration -= 1;
                    if (master.appearanceDuration <= 0) {
                        // Nếu có diện mạo từ ảnh, khôi phục về đó thay vì undefined
                        master.appearance = master.avatarAppearance || undefined;
                        master.appearanceDuration = undefined;
                    }
                }

                if (master.avatarAppearancePendingTransition) {
                    master.avatarAppearancePendingTransition = false;
                }
            }

            // Xử lý cho PlayerStats
            if (finalKbForThisTurn.playerStats) {
                const ps = finalKbForThisTurn.playerStats;
                if (ps.appearance && ps.appearance.trim() !== '') {
                    if (ps.appearanceDuration === undefined || ps.appearanceDuration === null || isNaN(ps.appearanceDuration)) {
                        ps.appearanceDuration = 5;
                    }
                    ps.appearanceDuration -= 1;
                    if (ps.appearanceDuration <= 0) {
                        ps.appearance = ps.avatarAppearance || undefined;
                        ps.appearanceDuration = undefined;
                    }
                }
                if (ps.avatarAppearancePendingTransition) {
                    ps.avatarAppearancePendingTransition = false;
                }
            }

            if (finalKbForThisTurn.discoveredYeuThu) {
                finalKbForThisTurn.discoveredYeuThu.forEach(yt => {
                    if (yt.stats) checkAndReduceEffects(yt.stats, yt.name);
                });
            }

            // Nghỉ trước khi xử lý Level Up
            await new Promise(resolve => setTimeout(resolve, 0));

            // Centralized Level Up Check
            const levelUpResult = handleLevelUps(finalKbForThisTurn);
            finalKbForThisTurn = levelUpResult.updatedKb;
            systemMessagesForThisTurn.push(...levelUpResult.systemMessages.map((msg, index) => ({
                id: `sys-${Date.now()}-${index}`,
                type: 'system' as const,
                content: msg.content,
                timestamp: Date.now(),
                turnNumber: finalKbForThisTurn.playerStats.turn
            })));

            // Nghỉ trước khi Audit toàn bộ Stats (Task rất nặng)
            await new Promise(resolve => setTimeout(resolve, 0));

            const activeAuditIds = new Set<string>();

            // Collect active entities for auditing (Optimization: reuse already collected allAliveNPCs filter)
            allAliveNPCs.forEach(npc => {
                if (npc.isFollowingPlayer) activeAuditIds.add(npc.id);
            });

            // 2. NPCs from Narration
            await extractEntityContextsFromString(response.narration, finalKbForThisTurn); // Just to update lastInteractionTurn

            // Re-evaluating ID extraction for auditing:
            const lowerNarration = response.narration.toLowerCase();
            allAliveNPCs.forEach(npc => {
                if (lowerNarration.includes(npc.name.toLowerCase())) activeAuditIds.add(npc.id);
            });

            // 3. Level up / Processed NPCs
            if (npcProgressionResult.progressedNpcIds) {
                npcProgressionResult.progressedNpcIds.forEach(id => activeAuditIds.add(id));
            }

            // Final effective stats calculation ONLY for active entities (or all if large enough? No, respect user request)
            finalKbForThisTurn = auditAllEntitiesStats(finalKbForThisTurn, activeAuditIds);

            // Cho phép trình duyệt nghỉ trước khi tiếp tục
            await new Promise(resolve => setTimeout(resolve, 0));

            if (response.isNsfwActive !== undefined) {
                finalKbForThisTurn.isNsfwSceneActive = response.isNsfwActive;
            }
            if (response.nsfwStage !== undefined) {
                finalKbForThisTurn.nsfwStage = response.nsfwStage;
            }
            if (response.nsfwPeakCount !== undefined) {
                finalKbForThisTurn.nsfwPeakCount = response.nsfwPeakCount;
            }
            if (response.isNsfwResting !== undefined) {
                finalKbForThisTurn.isNsfwResting = response.isNsfwResting;
            }

            // Cập nhật currentTurnLog với hành động thô của người chơi và phản hồi thô của AI
            const updatedTurnLog = [
                ...(finalKbForThisTurn.currentTurnLog || []),
                { role: 'user' as const, text: finalActionForAI },
                { role: 'model' as const, text: rawText }
            ].slice(-10); // Lưu giữ tối đa 10 lượt gần nhất (mỗi lượt gồm 1 user + 1 model = 20 entries)
            finalKbForThisTurn.currentTurnLog = updatedTurnLog;

            // --- OFFLOAD HISTORY RECORDING TO BACKGROUND ---
            backgroundTaskManager.addTask(async () => {
                const updatedHistory = addTurnHistoryEntryRaw(
                    turnHistoryAtStart,
                    knowledgeBaseAtActionStart,
                    gameMessagesAtActionStart
                );
                
                setKnowledgeBase(prev => {
                    // Cắt tỉa lịch sử trong KB trước khi lưu
                    const { prunedKb } = pruneHistoricalData({ ...prev, turnHistory: updatedHistory }, []);
                    return prunedKb;
                });
            });

            // Nghỉ trước khi kích hoạt các tác vụ nền
            await new Promise(resolve => setTimeout(resolve, 50));

            // --- NEW: AUTO MAP EXPANSION (OFFLOADED TO BACKGROUND) ---
            if (locationAfter && locationAfter !== locationBefore) {
                const actualApiKey = getCurrentlyUsedApiKey();

                if (actualApiKey) {
                    setUiState(prev => ({ ...prev, isExpandingMap: true }));
                    checkAndExpandConnections(finalKbForThisTurn, locationAfter, actualApiKey)
                        .then(({ updatedKb, systemMessages }) => {
                            if (systemMessages.length > 0) {
                                addMessageAndUpdateState(systemMessages, updatedKb);
                            } else {
                                setKnowledgeBase(updatedKb);
                            }
                        })
                        .catch(err => console.error("[AutoExpander] Background task failed:", err))
                        .finally(() => {
                            setUiState(prev => ({ ...prev, isExpandingMap: false }));
                        });
                }
            }
            
            // Defeat Check - Updated for New Samsara Flow
            if (finalKbForThisTurn.playerStats.sinhLuc <= 0 || finalKbForThisTurn.playerStats.isDead) {
                finalKbForThisTurn.playerStats.sinhLuc = 0;
                finalKbForThisTurn.playerStats.linhLuc = 0;
                finalKbForThisTurn.playerStats.sucTanCong = 0;
                finalKbForThisTurn.playerStats.kinhNghiem = 0;
                finalKbForThisTurn.playerStats.realm = "Đang trống";
                finalKbForThisTurn.playerStats.spiritualRoot = "Đang trống";
                finalKbForThisTurn.playerStats.specialPhysique = "Đang trống";
                (finalKbForThisTurn.playerStats as any).tuChat = "Đang trống";
                finalKbForThisTurn.worldConfig.playerName = "Đang trống";
                finalKbForThisTurn.playerStats.isDead = true;
                finalKbForThisTurn.pendingCombat = null;

                const defeatMessages: GameMessage[] = [];
                defeatMessages.push({
                    id: 'defeat-narration-' + Date.now(),
                    type: 'narration',
                    content: response.narration, 
                    timestamp: Date.now(), 
                    choices: [],
                    turnNumber: finalKbForThisTurn.playerStats.turn
                });
                if (response.systemMessage) {
                    defeatMessages.push({
                        id: 'defeat-sysmsg-' + Date.now(),
                        type: 'system',
                        content: response.systemMessage, 
                        timestamp: Date.now(), 
                        turnNumber: finalKbForThisTurn.playerStats.turn
                    });
                }
                defeatMessages.push(...systemMessagesForThisTurn.map(m => ({...m, turnNumber: finalKbForThisTurn.playerStats.turn })));
                
                // Cập nhật trạng thái "Tàn Hồn" để hiện Banner Đỏ, giữ nguyên lựa chọn Luân Hồi / Đoạt Xá
                const deadKb: KnowledgeBase = {
                    ...finalKbForThisTurn,
                    playerStats: { 
                        ...finalKbForThisTurn.playerStats, 
                        isDead: true, 
                        sinhLuc: 0,
                        linhLuc: 0,
                        sucTanCong: 0,
                        kinhNghiem: 0,
                        realm: "Đang trống",
                        spiritualRoot: "Đang trống",
                        specialPhysique: "Đang trống",
                        tuChat: "Đang trống" as any
                    },
                    worldConfig: {
                        ...finalKbForThisTurn.worldConfig,
                        playerName: "Đang trống"
                    },
                    pendingCombat: null
                };
                
                addMessageAndUpdateState(defeatMessages, deadKb);
                return;
            }

            const newMessagesForThisCycle: GameMessage[] = [];
            // Nếu truyện đã được hiển thị sớm (ở TurnCoordinator), ta KHÔNG được đẩy nó vào list nữa
            // Tuy nhiên, ta CẦN ID của nó để addMessageAndUpdateState có thể merge state chính xác?
            // Thực tế addMessageAndUpdateState sẽ append messages vào list hiện có.
            
            if (!narrativeMessageIdForEarlyRender) {
                newMessagesForThisCycle.push({
                    id: Date.now().toString() + Math.random(), type: 'narration', content: response.narration,
                    timestamp: Date.now(), choices: response.choices, turnNumber: finalKbForThisTurn.playerStats.turn 
                });
            } else {
                // ĐÃ RENDER SỚM: Ta không đẩy tin nhắn truyện vào mảng tin nhắn mới nữa.
                // Nhưng ta cần đảm bảo các tin nhắn hệ thống (system messages) vẫn được quan tâm.
                console.log("[Render Flow] Truyện đã render sớm, bỏ qua bước push narration lặp.");
            }

            if (response.systemMessage) {
              newMessagesForThisCycle.push({
                id: Date.now().toString() + Math.random(), type: 'system', content: response.systemMessage,
                timestamp: Date.now(), turnNumber: finalKbForThisTurn.playerStats.turn
              });
            }
            systemMessagesForThisTurn.forEach(msg => msg.turnNumber = finalKbForThisTurn.playerStats.turn);
            newMessagesForThisCycle.push(...systemMessagesForThisTurn); 

            if (manualTurnIncrementMessage) { 
                manualTurnIncrementMessage.turnNumber = finalKbForThisTurn.playerStats.turn;
                newMessagesForThisCycle.push(manualTurnIncrementMessage);
            }

            // --- PRE-COMBAT ANALYSIS TRIGGER ---
            const previousNarrationMsg = (gameMessagesAtActionStart || []).filter(m => m.type === 'narration').slice(-1)[0]?.content || "";
            const previousSystemMsgs = (gameMessagesAtActionStart || []).filter(m => m.type === 'system' && !m.content.startsWith('⚔️')).slice(-2).map(m => m.content).join("\n");
            const previousNarration = `${previousNarrationMsg}\n${previousSystemMsgs}`.trim();

            if (finalKbForThisTurn.pendingCombat && !finalKbForThisTurn.pendingCombat.analyzed && !finalKbForThisTurn.playerStats.isDead && finalKbForThisTurn.playerStats.sinhLuc > 0) {
                console.log("[Combat Analysis] Triggering AI analysis for pending combat...");
                try {
                    // Thêm delay 4s trước khi phân tích chiến đấu để giãn cách API
                    await new Promise(resolve => setTimeout(resolve, 4000));

                    // Create a timeout promise to prevent soft-lock if API hangs
                    const timeoutPromise = new Promise<CombatAnalysisResult>((_, reject) => {
                        setTimeout(() => reject(new Error("COMBAT_ANALYSIS_TIMEOUT")), 90000);
                    });

                    // Race the analysis against the timeout
                    const analysisResult = await Promise.race([
                        analyzeCombatants(finalKbForThisTurn, rawText, previousNarration),
                        timeoutPromise
                    ]);

                    if (analysisResult) {
                        const resolvedCombat = resolveCombatantIds(analysisResult, finalKbForThisTurn);
                        
                        if (resolvedCombat.opponentIds.length === 0) {
                             console.log("[Combat Analysis] No opponents found, canceling combat.");
                             finalKbForThisTurn.pendingCombat = undefined;
                             
                             newMessagesForThisCycle.push({
                                 id: `combat-cancel-${Date.now()}`,
                                 type: 'system',
                                 content: `🛡️ XUNG ĐỘT KẾT THÚC: ${analysisResult.reasoning}`,
                                 timestamp: Date.now(),
                                 turnNumber: finalKbForThisTurn.playerStats.turn
                             });
                        } else {
                            finalKbForThisTurn.pendingCombat = {
                                ...finalKbForThisTurn.pendingCombat,
                                ...resolvedCombat,
                                analyzed: true,
                                analysis: resolvedCombat, // For recovery hook
                                narration: response.narration
                            };

                            // Đẩy thông báo vào Log truyện
                            newMessagesForThisCycle.push({
                                id: `combat-init-${Date.now()}`,
                                type: 'system',
                                content: `⚔️ CHIẾN ĐẤU KÍCH HOẠT: ${analysisResult.reasoning}`,
                                timestamp: Date.now(),
                                turnNumber: finalKbForThisTurn.playerStats.turn
                            });

                            console.log("[Combat Analysis] Analysis complete and resolved.");
                        }
                    } else {
                        // Fallback if AI fails to return valid JSON
                        finalKbForThisTurn.pendingCombat.analyzed = true;
                    }
                } catch (error: any) {
                    if (error.message === "COMBAT_ANALYSIS_TIMEOUT") {
                        console.warn("[Combat Analysis] Analysis timed out after 90s. Skipping to resolution with fallback.");
                        // Skip AI analysis and proceed directly to resolution with empty lists
                        const fallbackResult: CombatAnalysisResult = { 
                            opponents: [], 
                            allies: [], 
                            reasoning: "Phân tích AI bị quá thời gian (90s). Hệ thống tự động bỏ qua bước này để tránh kẹt game.",
                            winProbability: 50
                        };
                        const resolvedCombat = resolveCombatantIds(fallbackResult, finalKbForThisTurn);
                        finalKbForThisTurn.pendingCombat = undefined;
                    } else {
                        console.error("[Combat Analysis] Error during analysis:", error);
                        finalKbForThisTurn.pendingCombat.analyzed = true; // Bypass on error to avoid soft-lock
                    }
                }
            }
            // ------------------------------------

            // --- AUTOSAVE TRIGGER (OFFLOADED TO BACKGROUND WITH 10S DELAY) ---
            backgroundTaskManager.addTask(async () => {
                // Delay 10s as requested
                await new Promise(resolve => setTimeout(resolve, 10000));

                const lockStore = useUiLockStore.getState();
                
                try {
                    // Lock UI and show status
                    lockStore.setLocked(true);
                    setUiState(prev => ({ ...prev, isAutoSaving: true }));

                    const autoSaveSlot = finalKbForThisTurn.currentAutoSaveSlotIndex;
                    const autoSaveName = `Auto Save Slot ${autoSaveSlot + 1}`;
                    const existingAutoSaveId = finalKbForThisTurn.autoSaveSlotIds[autoSaveSlot];
                    const messagesForAutoSave = [...gameMessagesAtActionStart];
                    if (narrativeMessageIdForEarlyRender) {
                        messagesForAutoSave.push({
                            id: narrativeMessageIdForEarlyRender,
                            type: 'narration',
                            content: response.narration,
                            timestamp: Date.now(),
                            choices: response.choices,
                            turnNumber: finalKbForThisTurn.playerStats.turn
                        });
                    }
                    messagesForAutoSave.push(...newMessagesForThisCycle);

                    // Execute save with a bit of "slow" pace if needed
                    // (Note: executeSaveGame is usually atomic, but we hold the state longer)
                    const savedId = await executeSaveGame(finalKbForThisTurn, messagesForAutoSave, autoSaveName, existingAutoSaveId, true);
                    
                    if (savedId) {
                        setKnowledgeBase(prevKb => { 
                            const newKbWithAutoSaveId = structuredClone(prevKb);
                            if (newKbWithAutoSaveId.autoSaveSlotIds.length > MAX_AUTO_SAVE_SLOTS) {
                                newKbWithAutoSaveId.autoSaveSlotIds = newKbWithAutoSaveId.autoSaveSlotIds.slice(0, MAX_AUTO_SAVE_SLOTS);
                            }
                            const currentSlot = autoSaveSlot % MAX_AUTO_SAVE_SLOTS;
                            newKbWithAutoSaveId.autoSaveSlotIds[currentSlot] = savedId;
                            newKbWithAutoSaveId.currentAutoSaveSlotIndex = (currentSlot + 1) % MAX_AUTO_SAVE_SLOTS;
                            return newKbWithAutoSaveId;
                        });
                    }
                } catch (err) {
                    console.error("[AutoSave] Error:", err);
                } finally {
                    // Release lock
                    lockStore.setLocked(false);
                    setUiState(prev => ({ ...prev, isAutoSaving: false }));
                }
            });
            // ------------------------

            // --- GRAPHRAG TRIGGER (BACKGROUND) ---
            // MOVED TO SYNC STEP ABOVE
            // ------------------------

            // --- BACKGROUND KNOWLEDGE ARCHITECT (LAYER 5) ---
            if (finalKbForThisTurn.currentTurnLog.length >= 10) {
                backgroundTaskManager.addTask(async () => {
                    // Chạy Knowledge Architect mỗi 10 lượt để tái cấu trúc Lore
                    if (finalKbForThisTurn.playerStats.turn % 10 === 0) {
                        await runKnowledgeArchitectAsync(finalKbForThisTurn, setKnowledgeBase);
                    }
                });
            }
            // ------------------------

            const turnCompleted = finalKbForThisTurn.playerStats.turn; 
            
            // --- LUÂN HỒI TÁI SINH KHI PENDING ---
            if (finalKbForThisTurn.playerStats.reincarnationPhase === 'pending') {
                finalKbForThisTurn.playerStats.reincarnationPhase = 'new_mc_ready';
                finalKbForThisTurn.suggestedActions = [
                    "Đầu thai nhà giàu", 
                    "Đầu thai nhà nghèo", 
                    "Đầu thai cô nhi", 
                    "Đầu thai ngẫu nhiên"
                ];
            } else if (!finalKbForThisTurn.playerStats.reincarnationPhase) {
                // Xóa gợi ý cũ nếu không còn trong tiến trình luân hồi
                finalKbForThisTurn.suggestedActions = undefined;
            }

            // Roll for next turn difficulty-based input restriction
            finalKbForThisTurn = updateKnowledgeBaseWithInputRoll(finalKbForThisTurn);

            // --- REFACTORED CONTINUOUS TIMELINE LOGIC (Summarization removed) ---
            const { prunedMessages, prunedKb } = pruneHistoricalData(finalKbForThisTurn, newMessagesForThisCycle);
            addMessageAndUpdateState(prunedMessages, prunedKb, startingCurrency);
            
            if (styleSettings.turnResponseMode === 'streaming') {
                setIsStreaming(false);
                setStreamingText("");
                setIsSwapping(false);
                abortControllerRef.current = null;
            }

            // Check power normalization after all turn tasks complete
            await checkAndTriggerNormalizePower(prunedKb);
            setIsLoadingApi(false);

        } catch (err) {
            if (styleSettings.turnResponseMode === 'streaming') {
                setIsStreaming(false);
                setStreamingText("");
                abortControllerRef.current = null;
            }

            const errorMsg = err instanceof Error ? err.message : String(err);
            
            if (errorMsg === "AbortError") {
                showNotification("Đã huỷ tạo phản hồi.", 'warning');
            } else {
                setApiErrorWithTimeout(errorMsg);
                console.error(err);
                
                if (isAutoPlaying) {
                    setIsAutoPlaying(false); 
                    showNotification(VIETNAMESE.autoPlayStoppedOnError, 'warning');
                }
            }
            
            setIsLoadingApi(false); // Ensure loading is stopped on error
            throw err; // Propagate error so UI can retain input
        }
    } finally {
        isGeneratingRef.current = false;
    }
    }, [
        knowledgeBase, gameMessages, addMessageAndUpdateState, setKnowledgeBase,
        logSentPromptCallback, logReceivedResponseCallback, setApiErrorWithTimeout, showNotification,
        isAutoPlaying, setIsAutoPlaying, executeSaveGame,
        setSummarizationResponsesLog, setIsLoadingApi, logNpcAvatarPromptCallback, setSentEconomyPromptsLog, 
        setReceivedEconomyResponsesLog, setSentGeneralSubLocationPromptsLog, setReceivedGeneralSubLocationResponsesLog,
        resetApiError, logSummarizationResponseCallback, handleNonCombatDefeat, setRetrievedRagContextLog,
        setGameMessages, // Added missing dep
        currentPageMessagesLog, 
        previousPageSummaries, 
        lastNarrationFromPreviousPage,
        setUiState // Added missing dep
    ]);

    const handleMatPhapContinue = useCallback(async () => {
        const { matPhapStep, matPhapCtx } = uiState;
        if (!matPhapStep || !matPhapCtx) return;

        setIsLoadingApi(true);
        resetApiError();

        const apiSettings = getApiSettings();

        const {
            knowledgeBaseAtActionStart,
            cleanedAction,
            turnOfPlayerAction,
            narrativeResult,
            syncKb,
            signal
        } = matPhapCtx;

        const currentLocDetail = knowledgeBaseAtActionStart.discoveredLocations.find(
            (loc: any) => loc.id === knowledgeBaseAtActionStart.currentLocationId
        );
        const locName = currentLocDetail ? currentLocDetail.name : "Không rõ";
        
        const worldDate = knowledgeBaseAtActionStart.worldDate;
        const timeStr = worldDate 
            ? `${worldDate.timeOfDay}, Ngày ${worldDate.day}, Tháng ${worldDate.month}, Năm ${worldDate.year}`
            : "Không rõ";

        if (matPhapStep === 'waiting_extraction') {
            // Bước 2: Trích xuất Thẻ tag & Ký ức
            setUiState(prev => ({ ...prev, isSyncingData: true, syncStreamingText: "Đang trích xuất dữ liệu..." }));
            try {
                let extractionRes;
                if (apiSettings.isSuperManualMode) {
                    console.log("[useMainGameLoop] Offline super manual extraction triggered in Mat Phap step.");
                    extractionRes = extractSuperManualTurnData(
                        narrativeResult.rawText,
                        locName,
                        timeStr
                    );
                } else {
                    extractionRes = await DataExtractionService.extractTagsAndMemory(
                        narrativeResult.rawText,
                        cleanedAction,
                        turnOfPlayerAction,
                        locName,
                        timeStr,
                        knowledgeBaseAtActionStart,
                        (streamText) => {
                            setUiState(prev => ({
                                ...prev,
                                syncStreamingText: streamText
                            }));
                        }
                    );
                }

                // Cập nhật kết quả extraction vào context
                const updatedCtx = {
                    ...matPhapCtx,
                    extractionTags: extractionRes?.tags || [],
                    extractionResult: extractionRes
                };

                showNotification("Trích xuất diễn biến và tài nguyên thành công!", "success");

                setUiState(prev => ({
                    ...prev,
                    matPhapStep: 'waiting_sync',
                    matPhapCtx: updatedCtx,
                    isSyncingData: false,
                    syncStreamingText: undefined
                }));
            } catch (error) {
                console.error("Lỗi trích xuất Mạt Pháp:", error);
                showNotification("Lỗi khi trích xuất dữ liệu. Vui lòng thử lại.", "error");
            } finally {
                setIsLoadingApi(false);
            }
        } else if (matPhapStep === 'waiting_sync') {
            // Bước 3: Thiên Đạo đồng bộ (Database Sync)
            setUiState(prev => ({ ...prev, isSyncingData: true, syncStreamingText: "Đang đồng bộ Thiên Đạo..." }));
            try {
                const { extractionResult } = matPhapCtx;
                
                // Save retry data in UI state
                setUiState(prev => ({
                    ...prev,
                    lastFlashRetryData: {
                        action: cleanedAction,
                        aiResponse: narrativeResult.rawText,
                        turn: turnOfPlayerAction,
                        locName,
                        timeStr
                    }
                }));

                const fastMemory = extractionResult?.flashSummary || "";
                const richMemory = extractionResult?.flashDetails || "";

                if (fastMemory && richMemory) {
                    await saveFlashAgentMemoryOffline(
                        turnOfPlayerAction,
                        setKnowledgeBase,
                        fastMemory,
                        richMemory,
                        syncKb,
                        locName,
                        timeStr,
                        narrativeResult.rawText
                    );
                } else {
                    await runFlashAgentAsync(
                        cleanedAction,
                        narrativeResult.rawText,
                        turnOfPlayerAction,
                        setKnowledgeBase,
                        "",
                        syncKb,
                        locName,
                        timeStr
                    );
                }

                // Chạy đồng bộ đồ thị tri thức offline nhanh sau đó
                setTimeout(async () => {
                    setKnowledgeBase(currentKb => {
                        const flashEntry = currentKb.ragHistoryLog?.find(log => log && log.turn === turnOfPlayerAction && log.type === 'flash_agent');
                        const isMissing = !flashEntry || !flashEntry.summary || !flashEntry.richSummary;

                        if (isMissing) {
                            const fallbackFast = fastMemory || "Không thể tóm tắt diễn biến.";
                            const fallbackRich = richMemory || "Không thể phân tích chi tiết cốt truyện.";
                            
                            let updatedKb = { ...currentKb };
                            if (!updatedKb.ragHistoryLog) updatedKb.ragHistoryLog = [];
                            
                            if (!updatedKb.ragHistoryLog.some(log => log && log.turn === turnOfPlayerAction && log.type === 'flash_agent')) {
                                updatedKb.ragHistoryLog.push({
                                    turn: turnOfPlayerAction,
                                    timestamp: new Date().toLocaleTimeString('vi-VN', { hour12: false }),
                                    content: `[FLASH AGENT MEMORY - TURN ${turnOfPlayerAction}]\n${fallbackRich}`,
                                    richSummary: fallbackRich,
                                    summary: fallbackFast,
                                    type: 'flash_agent'
                                });
                            }
                            return updatedKb;
                        }
                        return currentKb;
                    });
                }, 1000);

                showNotification("Đồng bộ Thiên Đạo thành công! Hoàn thành lượt xử lý chính.", "success");

                // Đưa game trở lại trạng thái sẵn sàng để người chơi nhập lượt tiếp theo,
                // bằng cách reset matPhapStep và matPhapCtx về null để chạy lại xử lý hậu kỳ của lượt chơi
                setUiState(prev => ({
                    ...prev,
                    matPhapStep: null,
                    matPhapCtx: null,
                    isSyncingData: false,
                    syncStreamingText: undefined
                }));

                // Gọi hành động để hoàn thành nốt hậu kỳ
                const updatedCtx = {
                    ...matPhapCtx,
                    extractionTags: matPhapCtx.extractionTags || []
                };
                await handlePlayerAction("", false, "choice", "standard", updatedCtx);

            } catch (error) {
                console.error("Lỗi đồng bộ Mạt Pháp:", error);
                showNotification("Lỗi khi đồng bộ Thiên Đạo. Vui lòng thử lại.", "error");
                setIsLoadingApi(false);
            }
        }
    }, [uiState, setIsLoadingApi, resetApiError, setKnowledgeBase, showNotification, handlePlayerAction, setUiState]);

        const [matPhapCountdown, setMatPhapCountdown] = useState<number | null>(null);

    const handleMatPhapContinueRef = useRef(handleMatPhapContinue);
    useEffect(() => {
        handleMatPhapContinueRef.current = handleMatPhapContinue;
    }, [handleMatPhapContinue]);

    // --- AUTO MAT PHAP TIMEOUT (40s) ---
    useEffect(() => {
        if (!uiState.matPhapStep) {
            setMatPhapCountdown(null);
            return;
        }

        setMatPhapCountdown(40);
        
        const timer = setInterval(() => {
            setMatPhapCountdown(prev => {
                if (prev === null) return null;
                if (prev <= 1) {
                    clearInterval(timer);
                    // Tự động chạy tiếp khi hết giờ
                    handleMatPhapContinueRef.current();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [uiState.matPhapStep]);

    const handleFindLocation = useCallback(async (params: FindLocationParams) => {
            setIsLoadingApi(true);
            resetApiError();
            showNotification(VIETNAMESE.findingLocationMessage, 'info');
    
            try {
                const { response: { narration, tags } } = await findLocationWithAI(
                    knowledgeBase, 
                    params,
                    currentPageMessagesLog,
                    previousPageSummaries,
                    lastNarrationFromPreviousPage,
                    (prompt) => setSentGeneralSubLocationPromptsLog(prev => [prompt, ...prev].slice(0, 10))
                );
    
                const { 
                    newKb: kbAfterTags, 
                    systemMessagesFromTags,
                    tagErrors: findLocTagErrors
                } = await performTagProcessing(
                    knowledgeBase,
                    tags,
                    knowledgeBase.playerStats.turn, // This action doesn't advance the turn
                    logNpcAvatarPromptCallback
                );

                kbAfterTags.pendingCorrections = [];
    
                const narrationMessage: GameMessage = {
                    id: 'find-location-narration-' + Date.now(),
                    type: 'system',
                    content: narration,
                    timestamp: Date.now(),
                    turnNumber: knowledgeBase.playerStats.turn
                };
    
                addMessageAndUpdateState([narrationMessage, ...systemMessagesFromTags], kbAfterTags);
    
            } catch (err) {
                const errorMsg = err instanceof Error ? err.message : String(err);
                setApiErrorWithTimeout(errorMsg);
                showNotification(VIETNAMESE.errorFindingLocation + `: ${errorMsg}`, 'error');
            } finally {
                setIsLoadingApi(false);
            }
    
        }, [
            knowledgeBase, 
            setIsLoadingApi, 
            resetApiError, 
            showNotification, 
            addMessageAndUpdateState, 
            setKnowledgeBase, 
            logNpcAvatarPromptCallback, 
            setSentGeneralSubLocationPromptsLog, 
            setApiErrorWithTimeout,
            currentPageMessagesLog, 
            previousPageSummaries, 
            lastNarrationFromPreviousPage
        ]);

    return {
        handlePlayerAction,
        handleMatPhapContinue,
        matPhapCountdown,
        isSummarizingNextPageTransition,
        handleFindLocation,
        handleRetryFlashSummary,
        handleIgnoreFlashSummary,
        isRecoveringNarration,
        narrationRecoveryAction,
        handleContinueIncompleteNarration,
        handleRewriteIncompleteNarration,
        handleIgnoreIncompleteNarration,
        handleHideIncompleteNarration,
        handleRestoreIncompleteNarration,
        handleSelectIncompleteNarrationModel,
    };
};