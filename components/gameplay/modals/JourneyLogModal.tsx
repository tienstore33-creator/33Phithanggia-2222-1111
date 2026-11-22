import React, { useMemo, useEffect, useRef, useState } from 'react';
import { KnowledgeBase, GameMessage } from '../../../types';
import { VIETNAMESE, DISABLE_SEX_INTERACTION_STORAGE_KEY } from '../../../constants';
import { useGame } from '../../../hooks/useGame';
import { useLogStore } from '../../../src/store/logStore';
import { X, BookOpen, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import JournalTurn from './JournalTurn';
import VectorModelSwitchModal from './VectorModelSwitchModal';
import { parseNarration, stripAllTags } from '../../../utils/journalParser';
import { usePopover } from '../../../hooks/usePopover';
import MiniInfoPopover from '../MiniInfoPopover';
import { parseAndHighlightText } from '../../../utils/textHighlighting';
import { getApiSettings } from '../../../services/geminiService';
import { AVAILABLE_EMBEDDING_MODELS, DEFAULT_EMBEDDING_MODEL_ID } from '../../../constants/api';

interface JourneyLogModalProps {
    isOpen: boolean;
    onClose: () => void;
    knowledgeBase: KnowledgeBase;
}

const TURNS_PER_LOG_PAGE = 10;

const JourneyLogModal: React.FC<JourneyLogModalProps> = ({ isOpen, onClose, knowledgeBase }) => {
    const game = useGame();
    const { gameMessages } = game;
    const { 
        history, 
        setHistory, 
        currentPage, 
        setPage, 
        viewMode, 
        setViewMode 
    } = useLogStore();

    const { popover, handleKeywordClick, closePopover } = usePopover();

    const highlightFn = useMemo(() => {
        return (text: string) => parseAndHighlightText(text, game.knowledgeBase, game.styleSettings, handleKeywordClick);
    }, [game.knowledgeBase, game.styleSettings, handleKeywordClick]);

    const [targetTurn, setTargetTurn] = useState<number | null>(null);
    const [isTocOpen, setIsTocOpen] = useState(false); // State for mobile TOC
    const [showRagView, setShowRagView] = useState(false);
    const [isRagActive, setIsRagActive] = useState(() => localStorage.getItem('isRagSystemActive') === 'true');
    const [isSexDisabled, setIsSexDisabled] = useState<boolean>(() => {
        return localStorage.getItem(DISABLE_SEX_INTERACTION_STORAGE_KEY) === 'true';
    });

    // State cho việc chuyển đổi model
    const [isMigrationModalOpen, setIsMigrationModalOpen] = useState(false);
    const [targetEmbeddingModel, setTargetEmbeddingModel] = useState<{id: string, name: string} | null>(null);
    const currentSettings = getApiSettings();
    const currentModelId = currentSettings.embeddingModel || DEFAULT_EMBEDDING_MODEL_ID;
    const currentModelName = AVAILABLE_EMBEDDING_MODELS.find(m => m.id === currentModelId)?.name || currentModelId;

    const handleToggleSexDisable = (e: React.MouseEvent) => {
        e.stopPropagation();
        const nextState = !isSexDisabled;
        setIsSexDisabled(nextState);
        localStorage.setItem(DISABLE_SEX_INTERACTION_STORAGE_KEY, String(nextState));
    };

    useEffect(() => {
        const handleRagChange = () => {
            const active = localStorage.getItem('isRagSystemActive') === 'true';
            setIsRagActive(active);
            if (!active && showRagView) {
                setShowRagView(false);
            }
        };
        window.addEventListener('rag-system-change', handleRagChange);
        return () => window.removeEventListener('rag-system-change', handleRagChange);
    }, [showRagView]);

    const turnRefs = useRef(new Map<number, HTMLDivElement>());
    const containerRef = useRef<HTMLDivElement | null>(null);

    // Sync history from gameMessages
    useEffect(() => {
        if (isOpen) {
            // Filter for narration and player actions to show in the log
            const filteredHistory = gameMessages.filter(msg => 
                msg.type === 'narration' || msg.type === 'player_action'
            );
            setHistory(filteredHistory);
        }
    }, [isOpen, gameMessages, setHistory]);

    // Scroll to target turn when page changes
    useEffect(() => {
        if (targetTurn !== null) {
            const timer = setTimeout(() => {
                requestAnimationFrame(() => {
                    const container = containerRef.current;
                    const targetElement = turnRefs.current.get(targetTurn) || document.getElementById(`turn-wrapper-${targetTurn}`);
                    
                    if (container && targetElement) {
                        // Calculate relative offset
                        const targetOffset = (targetElement as HTMLElement).offsetTop - container.offsetTop;
                        
                        // Perform manual scroll
                        container.scrollTo({
                            top: targetOffset,
                            behavior: 'smooth'
                        });
                        
                        setTargetTurn(null); // Reset after scrolling
                    }
                });
            }, 300); // Wait for animation
            return () => clearTimeout(timer);
        }
    }, [targetTurn, currentPage]);

    const paginatedTurns = useMemo(() => {
        const start = currentPage * TURNS_PER_LOG_PAGE;
        const end = start + TURNS_PER_LOG_PAGE;
        return history.slice(start, end);
    }, [history, currentPage]);

    const totalPages = Math.ceil(history.length / TURNS_PER_LOG_PAGE);

    const jumpToTurn = (turnNumber: number) => {
        // Find the index of the message with this turnNumber in the history
        const index = history.findIndex(msg => msg.turnNumber === turnNumber);
        if (index !== -1) {
            const page = Math.floor(index / TURNS_PER_LOG_PAGE);
            setPage(page);
            setTargetTurn(turnNumber);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl h-[85vh] flex flex-col shadow-2xl overflow-hidden"
            >
                {/* Header */}
                <header className="p-4 border-b border-slate-700 flex items-center justify-between bg-slate-800/50">
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={() => setIsTocOpen(!isTocOpen)}
                            className="md:hidden flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors text-sm font-medium shadow-lg"
                        >
                            <BookOpen size={18} /> Mục lục
                        </button>
                        <h2 className="text-xl font-bold text-emerald-400 flex items-center gap-2">
                            <BookOpen size={20} className="hidden md:block" />
                            {showRagView ? (
                                <span className="flex items-center gap-1.5 inline-flex">
                                    <span className={`font-mono font-extrabold tracking-wider transition-all duration-300 ${
                                        isSexDisabled 
                                            ? "text-amber-400 animate-pulse drop-shadow-[0_0_10px_rgba(251,191,36,0.8)]" 
                                            : "text-violet-400 drop-shadow-[0_0_8px_rgba(139,92,246,0.5)]"
                                    }`}>
                                        HỆ THỐNG TRUY XUẤT KÝ ỨC (RAG DATA)
                                    </span>
                                    <button
                                        type="button"
                                        onClick={handleToggleSexDisable}
                                        className={`ml-1 text-sm font-bold cursor-pointer transition-transform active:scale-95 px-1 rounded ${
                                            isSexDisabled 
                                                ? "text-amber-300 hover:text-amber-200 bg-amber-950/40 border border-amber-500/50" 
                                                : "text-violet-400 hover:text-violet-300 bg-violet-950/30 border border-violet-500/30"
                                        }`}
                                        title={isSexDisabled ? "Đang LỜ ĐI thẻ INTERACTION sex. Bấm để bật lại." : "Bấm để LỜ ĐI thẻ INTERACTION sex"}
                                    >
                                        ©
                                    </button>
                                </span>
                            ) : (
                                `Nhật ký hành trình - Trang ${currentPage + 1}`
                            )}
                            
                            {!showRagView && isRagActive && (
                                <button
                                    type="button"
                                    onClick={() => setShowRagView(true)}
                                    className="text-[10px] font-semibold text-violet-400 hover:text-violet-300 cursor-pointer select-none px-1.5 py-0.5 rounded border border-violet-500/30 hover:border-violet-400/50 active:scale-95 transition-all bg-violet-950/25 uppercase font-mono shadow-[0_0_8px_rgba(139,92,246,0.3)] ml-1"
                                    title="Xem hệ thống truy xuất ký ức (RAG Data)"
                                >
                                    [RAG]
                                </button>
                            )}
                            {showRagView && (
                                <button
                                    type="button"
                                    onClick={() => setShowRagView(false)}
                                    className="text-[10px] font-semibold text-slate-400 hover:text-slate-300 cursor-pointer select-none px-1.5 py-0.5 rounded border border-slate-700 hover:border-slate-600 active:scale-95 transition-all bg-slate-800 uppercase font-mono ml-2"
                                    title="Quay về Nhật ký hành trình"
                                >
                                    [Nhật ký]
                                </button>
                            )}
                        </h2>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-2 hover:bg-slate-700 rounded-full text-slate-400 hover:text-white transition-colors"
                    >
                        <X size={24} />
                    </button>
                </header>

                {/* Content Area - 2 Column Layout */}
                <div className="flex-1 flex overflow-hidden">
                    {/* Sidebar TOC */}
                    <div className={`${showRagView ? 'hidden' : (isTocOpen ? 'absolute inset-0 z-20 bg-slate-900' : 'hidden md:block w-full md:w-1/3')} md:static border-r border-slate-700 overflow-y-auto p-4 custom-scrollbar`}>
                        <div className="flex justify-between items-center mb-4 sticky top-0 bg-slate-900/95 backdrop-blur pb-2 z-10">
                            <h3 className="font-bold text-slate-300 text-lg">Bảng Mục Lục</h3>
                            <button onClick={() => setIsTocOpen(false)} className="md:hidden p-1 text-slate-400"><X size={20} /></button>
                        </div>

                        {/* Embedding Model Controller */}
                        <div className="mb-6 p-4 rounded-2xl bg-gradient-to-br from-indigo-950/40 to-slate-800/40 border border-indigo-500/20 shadow-inner">
                            <div className="flex items-center gap-2 mb-3">
                                <RefreshCw size={14} className="text-indigo-400 animate-pulse" />
                                <span className="text-[10px] font-black text-indigo-300 uppercase tracking-widest">Model Vector (RAG)</span>
                            </div>
                            <div className="space-y-3">
                                <div className="text-[11px] text-slate-300 bg-black/40 px-3 py-2 rounded-lg border border-white/5 font-mono truncate">
                                    <span className="text-indigo-400 mr-2">●</span> {currentModelName}
                                </div>
                                
                                {AVAILABLE_EMBEDDING_MODELS.map(model => {
                                    if (model.id === currentModelId) return null;
                                    return (
                                        <button
                                            key={model.id}
                                            onClick={() => {
                                                setTargetEmbeddingModel(model);
                                                setIsMigrationModalOpen(true);
                                            }}
                                            className="w-full py-2 px-3 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/40 border border-indigo-500/30 text-[10px] font-bold text-indigo-200 transition-all flex items-center justify-center gap-2 group active:scale-95"
                                        >
                                            <RefreshCw size={12} className="group-hover:rotate-180 transition-transform duration-500" />
                                            ĐỔI SANG {model.name.split(' ')[0]}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="space-y-2">
                            {(() => {
                                const allTurns = Array.from(new Set(gameMessages.map(m => m.turnNumber).filter(t => t !== undefined))).sort((a, b) => Number(a) - Number(b));
                                return allTurns.map(turn => {
                                    const msgsInTurn = gameMessages.filter(m => m.turnNumber === turn);
                                    if (msgsInTurn.length === 0) return null;
                                    
                                    const primaryMsg = 
                                        msgsInTurn.find(m => m.type === 'narration') || 
                                        msgsInTurn.find(m => m.type === 'player_action') || 
                                        msgsInTurn[0];
                                    
                                    // Tìm msg trong history để lấy số trang, nếu không có thì mặc định trang 1
                                    const primaryMsgInHistory = history.find(m => m.id === primaryMsg.id);
                                    const page = primaryMsgInHistory ? Math.floor(history.indexOf(primaryMsgInHistory) / TURNS_PER_LOG_PAGE) + 1 : 1;

                                    return (
                                        <button 
                                            key={`toc-turn-${turn}`}
                                            onClick={() => { jumpToTurn(turn); setIsTocOpen(false); }}
                                            className="w-full text-left p-3 rounded-xl bg-slate-800/40 border border-slate-700/50 hover:border-emerald-500/50 hover:bg-slate-800 transition-all group"
                                        >
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="font-bold text-emerald-400 group-hover:text-emerald-300 text-sm">Lượt {turn}</span>
                                                <span className="text-[10px] text-slate-500">Trang {page}</span>
                                            </div>
                                            <p className="text-xs text-slate-400 line-clamp-2 italic">
                                                {primaryMsg.type === 'player_action' ? `<Người chơi>: ${primaryMsg.content}` : stripAllTags(parseNarration(primaryMsg.content)).substring(0, 100)}...
                                            </p>
                                        </button>
                                    );
                                });
                            })()}
                            {history.length === 0 && (
                                <div className="text-center text-slate-500 italic py-10 text-sm">
                                    Mục lục trống.
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Main Content */}
                    <main ref={containerRef} className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-slate-900/50 relative">
                        <AnimatePresence mode="wait">
                            <motion.div 
                                key={showRagView ? "rag-view" : `page-${currentPage}`}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="space-y-8"
                            >
                                {showRagView ? (
                                    <div className="space-y-4 text-gray-200 select-text max-h-[75vh]">
                                        <div className="flex justify-between items-center mb-6 sticky top-0 bg-slate-900/90 py-2 z-10 backdrop-blur-md border-b border-violet-500/10">
                                            <div>
                                                <p className="text-xs text-violet-400 font-mono font-bold tracking-widest animate-pulse">
                                                    ● ĐANG TRUY XUẤT CƠ SỞ TRI THỨC...
                                                </p>
                                                <p className="text-[10px] text-slate-500 font-mono italic">
                                                    Dữ liệu phân tích đa lớp (Flash Agent & GraphRAG)
                                                </p>
                                            </div>
                                            <button 
                                                onClick={() => setShowRagView(false)}
                                                className="text-xs font-bold text-slate-400 hover:text-white border border-slate-700 px-3 py-1.5 rounded-lg bg-slate-800/50 hover:bg-slate-700 transition-all flex items-center gap-2"
                                            >
                                                <ChevronLeft size={14} /> Quay lại
                                            </button>
                                        </div>
                                        
                                        {!knowledgeBase.ragHistoryLog || knowledgeBase.ragHistoryLog.length === 0 ? (
                                            <div className="text-center text-slate-500 py-32 font-mono border border-dashed border-slate-800 rounded-3xl bg-slate-900/50">
                                                <div className="mb-4 opacity-20 flex justify-center">
                                                    <BookOpen size={64} />
                                                </div>
                                                <p className="text-sm">KHÔNG TÌM THẤY DỮ LIỆU KÝ ỨC TRONG HIỆN TẠI</p>
                                                <p className="text-[10px] mt-2 opacity-50 uppercase tracking-tighter">Waiting for Flash Agent extraction...</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-12 pb-10">
                                                {(() => {
                                                    const ragByTurn: Record<number, {
                                                        summary?: string;
                                                        richSummary?: string;
                                                        timestamp?: string;
                                                        entities: Record<string, any[]>;
                                                    }> = {};

                                                    // 0. Khởi tạo tất cả các lượt từ lịch sử
                                                    const uniqueHistoryTurns = Array.from(new Set(history.map(m => m.turnNumber)));
                                                    uniqueHistoryTurns.forEach(t => {
                                                        ragByTurn[t] = { entities: {} };
                                                    });

                                                    // 1. Lấy dữ liệu từ History Log
                                                    (knowledgeBase.ragHistoryLog || []).forEach(log => {
                                                        if (!log || log.turn === undefined) return;
                                                        if (!ragByTurn[log.turn]) ragByTurn[log.turn] = { entities: {} };
                                                        if (log.type === 'flash_agent' || log.richSummary) {
                                                            ragByTurn[log.turn].summary = log.summary;
                                                            ragByTurn[log.turn].richSummary = log.richSummary;
                                                            ragByTurn[log.turn].timestamp = log.timestamp;
                                                        }
                                                    });

                                                    // 2. Lấy dữ liệu thực thể từ Vector Store
                                                    (knowledgeBase.ragVectorStore?.metadata || []).forEach(meta => {
                                                        if (meta.turn !== undefined) {
                                                            if (!ragByTurn[meta.turn]) ragByTurn[meta.turn] = { entities: {} };
                                                            if (meta.entityType === 'turn') return;
                                                            const type = meta.entityType;
                                                            if (!ragByTurn[meta.turn].entities[type]) ragByTurn[meta.turn].entities[type] = [];
                                                            ragByTurn[meta.turn].entities[type].push(meta);
                                                        }
                                                    });

                                                    return Object.entries(ragByTurn)
                                                        .sort((a, b) => Number(b[0]) - Number(a[0]))
                                                        .map(([turnStr, data]) => {
                                                            const turn = Number(turnStr);
                                                            return (
                                                                <div key={`rag-turn-block-${turn}`} className="space-y-4">
                                                                    <div className="flex items-center gap-3 mb-4">
                                                                        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-violet-500/30 to-transparent"></div>
                                                                        <span className="text-[11px] font-black text-violet-400 uppercase tracking-[0.4em] bg-slate-900 border border-violet-500/30 px-5 py-1.5 rounded-full shadow-[0_0_15px_rgba(139,92,246,0.15)]">
                                                                            DỮ LIỆU LƯỢT {turn}
                                                                        </span>
                                                                        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-violet-500/30 to-transparent"></div>
                                                                    </div>

                                                                    <div className="bg-black/60 border border-violet-500/30 rounded-2xl p-6 shadow-xl backdrop-blur-sm space-y-6">
                                                                        <div className="flex justify-between items-center pb-3 border-b border-violet-500/10">
                                                                            <span className="text-xs font-bold text-violet-400 uppercase tracking-wider flex items-center gap-2">
                                                                                <div className="w-1.5 h-1.5 bg-violet-500 rounded-full animate-pulse"></div>
                                                                                Flash Agent Memory
                                                                            </span>
                                                                            <span className="text-[10px] text-slate-500 font-mono">[{data.timestamp || "--:--"}]</span>
                                                                        </div>

                                                                        {!data.summary && Object.keys(data.entities).length === 0 && (
                                                                            <div className="py-4 flex flex-col items-center justify-center text-slate-600">
                                                                                <span className="text-xs italic">Không có dữ liệu RAG trích xuất riêng biệt cho lượt này.</span>
                                                                            </div>
                                                                        )}

                                                                        {data.summary && (
                                                                            <div className="p-4 rounded-xl bg-violet-950/20 border border-violet-500/20">
                                                                                <span className="text-[9px] font-black text-violet-400 uppercase block mb-2 tracking-widest">⚡ TÓM TẮT NHANH:</span>
                                                                                <p className="text-sm text-violet-100 italic font-serif leading-relaxed">
                                                                                    "{data.summary}"
                                                                                </p>
                                                                            </div>
                                                                        )}

                                                                        {data.richSummary && (
                                                                            <div className="space-y-3">
                                                                                <span className="text-[9px] font-black text-slate-400 uppercase block tracking-widest">📝 DIỄN BIẾN CỐT LÕI:</span>
                                                                                <div className="text-[13px] text-gray-300 whitespace-pre-wrap leading-relaxed font-sans pl-2 border-l-2 border-slate-800">
                                                                                    {data.richSummary}
                                                                                </div>
                                                                            </div>
                                                                        )}

                                                                        {Object.keys(data.entities).length > 0 && (
                                                                            <div className="pt-6 mt-6 border-t border-slate-800 space-y-5">
                                                                                <span className="text-[9px] font-black text-cyan-500 uppercase block tracking-widest flex items-center gap-2">
                                                                                    <div className="w-1 h-1 bg-cyan-500 rounded-full"></div>
                                                                                    Thực thể được Vector hóa trong lượt này:
                                                                                </span>
                                                                                
                                                                                <div className="grid grid-cols-1 gap-4">
                                                                                    {/* Nhóm Nhân vật */}
                                                                                    {['npc', 'wife', 'slave', 'prisoner', 'yeuThu', 'master'].some(t => data.entities[t]) && (
                                                                                        <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/50">
                                                                                            <span className="text-[9px] font-bold text-emerald-400 uppercase block mb-3 opacity-80">● NHÂN VẬT & QUAN HỆ:</span>
                                                                                            <div className="space-y-3">
                                                                                                {[...(['npc', 'wife', 'slave', 'prisoner', 'yeuThu', 'master'].flatMap(t => data.entities[t] || []))].map((m, i) => (
                                                                                                    <div key={`meta-npc-${i}`} className="text-[12px] text-slate-300 bg-black/40 p-3 rounded-lg border border-emerald-500/10">
                                                                                                        <span className="font-bold text-emerald-400 mr-2">[{m.entityType.toUpperCase()}]</span>
                                                                                                        <div className="mt-1 opacity-90 whitespace-pre-wrap line-clamp-3 overflow-y-auto max-h-32 scrollbar-hide">{m.text}</div>
                                                                                                    </div>
                                                                                                ))}
                                                                                            </div>
                                                                                        </div>
                                                                                    )}

                                                                                    {/* Nhóm Vật phẩm & Kỹ năng */}
                                                                                    {['item', 'skill'].some(t => data.entities[t]) && (
                                                                                        <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/50">
                                                                                            <span className="text-[9px] font-bold text-amber-400 uppercase block mb-3 opacity-80">● VẬT PHẨM & KỸ NĂNG:</span>
                                                                                            <div className="space-y-3">
                                                                                                {[...(['item', 'skill'].flatMap(t => data.entities[t] || []))].map((m, i) => (
                                                                                                    <div key={`meta-item-${i}`} className="text-[12px] text-slate-300 bg-black/40 p-3 rounded-lg border border-amber-500/10">
                                                                                                        <span className="font-bold text-amber-400 mr-2">[{m.entityType.toUpperCase()}]</span>
                                                                                                        <div className="mt-1 opacity-90">{m.text}</div>
                                                                                                    </div>
                                                                                                ))}
                                                                                            </div>
                                                                                        </div>
                                                                                    )}

                                                                                    {/* Nhóm Thế giới & Địa danh */}
                                                                                    {['lore', 'location'].some(t => data.entities[t]) && (
                                                                                        <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/50">
                                                                                            <span className="text-[9px] font-bold text-cyan-400 uppercase block mb-3 opacity-80">● THẾ GIỚI & ĐỊA DANH:</span>
                                                                                            <div className="space-y-3">
                                                                                                {[...(['lore', 'location'].flatMap(t => data.entities[t] || []))].map((m, i) => (
                                                                                                    <div key={`meta-world-${i}`} className="text-[12px] text-slate-300 bg-black/40 p-3 rounded-lg border border-cyan-500/10">
                                                                                                        <span className="font-bold text-cyan-400 mr-2">[{m.entityType.toUpperCase()}]</span>
                                                                                                        <div className="mt-1 opacity-90">{m.text}</div>
                                                                                                    </div>
                                                                                                ))}
                                                                                            </div>
                                                                                        </div>
                                                                                    )}

                                                                                    {/* Nhóm Nhiệm vụ & Phe phái */}
                                                                                    {['quest', 'faction'].some(t => data.entities[t]) && (
                                                                                        <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/50">
                                                                                            <span className="text-[9px] font-bold text-indigo-400 uppercase block mb-3 opacity-80">● TIẾN TRÌNH & PHE PHÁI:</span>
                                                                                            <div className="space-y-3">
                                                                                                {[...(['quest', 'faction'].flatMap(t => data.entities[t] || []))].map((m, i) => (
                                                                                                    <div key={`meta-prog-${i}`} className="text-[12px] text-slate-300 bg-black/40 p-3 rounded-lg border border-indigo-500/10">
                                                                                                        <span className="font-bold text-indigo-400 mr-2">[{m.entityType.toUpperCase()}]</span>
                                                                                                        <div className="mt-1 opacity-90">{m.text}</div>
                                                                                                    </div>
                                                                                                ))}
                                                                                            </div>
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                        )}

                                                                        <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between font-mono text-[9px]">
                                                                            <span className="text-[#00ffcc] font-bold">[VECTOR SYNCED]</span>
                                                                            <span className="text-slate-800 tracking-tighter uppercase">AG_DYNAMIC_MEMORY_v2.5</span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })
                                                })()}
                                            </div>
                                        )}
                                    </div>
                                ) : paginatedTurns.length > 0 ? (
                                    paginatedTurns.map((msg) => (
                                        <JournalTurn 
                                            key={msg.id} 
                                            msg={msg} 
                                            parseAndHighlightText={highlightFn}
                                            ref={el => {
                                                if (el) turnRefs.current.set(msg.turnNumber, el);
                                                else turnRefs.current.delete(msg.turnNumber);
                                            }}
                                        />
                                    ))
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-full text-slate-500 italic min-h-[300px]">
                                        <BookOpen size={48} className="mb-4 opacity-20" />
                                        Chưa có nội dung nào được ghi lại.
                                    </div>
                                )}
                            </motion.div>
                        </AnimatePresence>
                    </main>
                </div>

                <MiniInfoPopover 
                    isOpen={popover.isOpen} 
                    targetRect={popover.targetRect} 
                    entity={popover.entity} 
                    entityType={popover.entityType} 
                    onClose={closePopover} 
                    knowledgeBase={game.knowledgeBase} 
                />

                {/* Migration Modal */}
                {targetEmbeddingModel && (
                    <VectorModelSwitchModal
                        isOpen={isMigrationModalOpen}
                        onClose={() => setIsMigrationModalOpen(false)}
                        targetModel={targetEmbeddingModel.id}
                        targetModelName={targetEmbeddingModel.name}
                        knowledgeBase={game.knowledgeBase}
                        onComplete={(updatedKb) => {
                            game.setKnowledgeBase(updatedKb);
                            // Cập nhật lại UI local bằng cách reload settings (currentSettings phụ thuộc vào localstorage)
                            window.dispatchEvent(new CustomEvent('api-settings-changed'));
                        }}
                    />
                )}

                {/* Footer / Pagination */}
                {totalPages > 1 && !showRagView && (
                    <footer className="p-4 border-t border-slate-700 bg-slate-800/30 flex items-center justify-center gap-4">
                        <button 
                            disabled={currentPage === 0}
                            onClick={() => setPage(currentPage - 1)}
                            className="p-2 rounded-lg bg-slate-800 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-700 transition-colors"
                        >
                            <ChevronLeft size={20} />
                        </button>
                        <div className="flex items-center gap-1 overflow-x-auto max-w-[200px] sm:max-w-md no-scrollbar">
                            {Array.from({ length: totalPages }).map((_, i) => (
                                <button
                                    key={i}
                                    onClick={() => setPage(i)}
                                    className={`flex-shrink-0 w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                                        currentPage === i 
                                        ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20' 
                                        : 'bg-slate-800 text-slate-500 hover:bg-slate-700'
                                    }`}
                                >
                                    {i + 1}
                                </button>
                            ))}
                        </div>
                        <button 
                            disabled={currentPage === totalPages - 1}
                            onClick={() => setPage(currentPage + 1)}
                            className="p-2 rounded-lg bg-slate-800 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-700 transition-colors"
                        >
                            <ChevronRight size={20} />
                        </button>
                    </footer>
                )}
            </motion.div>
        </div>
    );
};

export default JourneyLogModal;
