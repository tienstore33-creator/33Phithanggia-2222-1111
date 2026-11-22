import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Hash, Clock, FileText, Database, Layers } from 'lucide-react';
import { VectorCheckService } from '../../../services/VectorCheckService';
import { KnowledgeBase, RetrievalResult } from '../../../types';
import Spinner from '../../ui/Spinner';

interface VectorCheckModalProps {
    isOpen: boolean;
    onClose: () => void;
    query: string;
    knowledgeBase: KnowledgeBase;
}

const VectorCheckModal: React.FC<VectorCheckModalProps> = ({ isOpen, onClose, query, knowledgeBase }) => {
    const [results, setResults] = useState<RetrievalResult[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (isOpen && query) {
            const performSearch = async () => {
                setIsLoading(true);
                const searchResults = await VectorCheckService.searchAll(query, knowledgeBase);
                setResults(searchResults);
                setIsLoading(false);
            };
            performSearch();
        }
    }, [isOpen, query, knowledgeBase]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-2xl h-[80vh] flex flex-col shadow-2xl overflow-hidden"
            >
                {/* Header */}
                <header className="p-5 border-b border-slate-800 bg-slate-800/50 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30">
                            <Search className="text-indigo-400" size={20} />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white leading-tight">Kiểm Tra Nội Dung RAG</h3>
                            <p className="text-xs text-slate-400 font-mono">Từ khóa: <span className="text-indigo-400">"{query}"</span></p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-2 hover:bg-slate-700 rounded-full text-slate-400 hover:text-white transition-colors"
                    >
                        <X size={24} />
                    </button>
                </header>

                {/* Content */}
                <main className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center h-full space-y-4 opacity-60">
                            <Spinner size="lg" />
                            <p className="text-sm font-medium text-slate-400 animate-pulse uppercase tracking-[0.2em]">Đang truy xuất không gian vector...</p>
                        </div>
                    ) : results.length > 0 ? (
                        results.map((res, i) => (
                            <motion.div 
                                key={i}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.05 }}
                                className="group p-5 rounded-2xl bg-slate-800/30 border border-slate-700/50 hover:border-indigo-500/50 hover:bg-slate-800/50 transition-all"
                            >
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-3">
                                        <span className={`text-[10px] font-black px-2 py-0.5 rounded border uppercase tracking-widest ${
                                            res.metadata?.entityType === 'turn' 
                                                ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                                                : 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400'
                                        }`}>
                                            {res.metadata?.entityType || 'Unknown'}
                                        </span>
                                        <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-mono">
                                            <Layers size={12} />
                                            {res.metadata?.entityId?.substring(0, 15) || 'System'}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="h-1 w-16 bg-slate-700 rounded-full overflow-hidden">
                                            <div 
                                                className="h-full bg-emerald-500" 
                                                style={{ width: `${Math.round(res.score * 100)}%` }}
                                            />
                                        </div>
                                        <span className="text-[10px] font-bold text-emerald-400 font-mono">
                                            {(res.score * 100).toFixed(1)}%
                                        </span>
                                    </div>
                                </div>
                                
                                <p className="text-sm text-slate-300 leading-relaxed font-serif italic border-l-2 border-slate-700 pl-4 py-1">
                                    "{res.text}"
                                </p>
                                
                                {res.metadata?.turn !== undefined && (
                                    <div className="mt-3 flex items-center gap-2 text-[10px] text-slate-500 uppercase font-black tracking-tighter">
                                        <Clock size={12} />
                                        Xuất hiện tại Lượt: {res.metadata.turn}
                                    </div>
                                )}
                            </motion.div>
                        ))
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-slate-600 italic">
                            <FileText size={48} className="mb-4 opacity-20" />
                            Không tìm thấy nội dung nào khớp với từ khóa trong toàn bộ cơ sở dữ liệu.
                        </div>
                    )}
                </main>

                {/* Footer */}
                <footer className="p-4 bg-slate-900/80 border-t border-slate-800 text-[10px] text-slate-500 flex justify-between font-mono">
                    <span className="flex items-center gap-1"><Database size={12} /> Total Scanned: {knowledgeBase.ragVectorStore?.vectors.length || 0} chunks</span>
                    <span>Result Limit: Top 20</span>
                </footer>
            </motion.div>
        </div>
    );
};

export default VectorCheckModal;
