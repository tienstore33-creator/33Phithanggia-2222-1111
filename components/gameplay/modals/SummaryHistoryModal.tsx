import React from 'react';
import { KnowledgeBase } from '../../../types';
import { VIETNAMESE, TURNS_PER_PAGE } from '../../../constants';
import { X, BookOpen, ScrollText, Milestone } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface SummaryHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    knowledgeBase: KnowledgeBase;
}

const SummaryHistoryModal: React.FC<SummaryHistoryModalProps> = ({ isOpen, onClose, knowledgeBase }) => {
    if (!isOpen) return null;

    const pageSummaries = knowledgeBase.pageSummaries || {};
    const sortedPoints = Object.keys(pageSummaries)
        .map(Number)
        .sort((a, b) => b - a); // Newest first

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl h-[80vh] flex flex-col shadow-2xl overflow-hidden"
            >
                {/* Header */}
                <header className="p-4 border-b border-slate-700 flex items-center justify-between bg-slate-800/50">
                    <h2 className="text-xl font-bold text-teal-400 flex items-center gap-2">
                        <BookOpen size={20} />
                        Hành Trình Ký - Lịch Sử Tóm Tắt
                    </h2>
                    <button 
                        onClick={onClose}
                        className="p-2 hover:bg-slate-700 rounded-full text-slate-400 hover:text-white transition-colors"
                    >
                        <X size={24} />
                    </button>
                </header>

                {/* Content */}
                <main className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-slate-900/50">
                    {sortedPoints.length > 0 ? (
                        sortedPoints.map((point) => {
                            const summaryText = pageSummaries[point];
                            const isChapter = summaryText.startsWith("CHAPTER_SUMMARY::");
                            const content = isChapter ? summaryText.replace("CHAPTER_SUMMARY::", "") : summaryText;
                            const chapterNumber = Math.ceil(point / 5);

                            return (
                                <div 
                                    key={`summary-point-${point}`}
                                    className={`p-5 rounded-2xl border transition-all duration-300 ${
                                        isChapter 
                                        ? 'bg-teal-900/20 border-teal-500/30 shadow-[0_0_15px_rgba(20,184,166,0.1)]' 
                                        : 'bg-slate-800/40 border-slate-700 hover:border-slate-600'
                                    }`}
                                >
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className={`p-2 rounded-lg ${isChapter ? 'bg-teal-600/20 text-teal-400' : 'bg-slate-700 text-slate-300'}`}>
                                            {isChapter ? <Milestone size={18} /> : <ScrollText size={18} />}
                                        </div>
                                        <div>
                                            <h3 className={`text-sm font-bold uppercase tracking-wider ${isChapter ? 'text-teal-300' : 'text-slate-200'}`}>
                                                {isChapter ? `Chương ${chapterNumber}` : VIETNAMESE.pageSummaryTitle(point)}
                                            </h3>
                                            <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                                                {isChapter ? `Kết thúc tại lượt ${point * TURNS_PER_PAGE}` : `Tóm tắt lượt ${(point - 1) * TURNS_PER_PAGE + 1} đến ${point * TURNS_PER_PAGE}`}
                                            </p>
                                        </div>
                                    </div>
                                    <p className={`text-sm leading-relaxed ${isChapter ? 'text-teal-50' : 'text-slate-300'} whitespace-pre-wrap italic`}>
                                        {content}
                                    </p>
                                    {isChapter && (
                                        <div className="mt-3 pt-3 border-t border-teal-500/10 flex justify-end">
                                            <span className="text-[9px] font-bold text-teal-500/50 uppercase tracking-widest">Dấu Mốc Quan Trọng</span>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-slate-500 italic py-20">
                            <BookOpen size={48} className="mb-4 opacity-10" />
                            <p>Hành trình của bạn chưa để lại dấu ấn nào để tóm tắt.</p>
                            <p className="text-xs mt-2 opacity-50">(Tiếp tục chơi để hoàn thành các trang hành trình)</p>
                        </div>
                    )}
                </main>

                {/* Footer */}
                <footer className="p-4 border-t border-slate-700 bg-slate-800/30 text-center">
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest">
                        Lưu trữ bởi Thiên Đạo Ký Ức
                    </p>
                </footer>
            </motion.div>
        </div>
    );
};

export default SummaryHistoryModal;
