import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, Download, AlertTriangle, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { VectorMigrationService, MigrationProgress } from '../../../services/VectorMigrationService';
import { KnowledgeBase } from '../../../types';

interface VectorModelSwitchModalProps {
    isOpen: boolean;
    onClose: () => void;
    targetModel: string;
    targetModelName: string;
    knowledgeBase: KnowledgeBase;
    onComplete: (updatedKb: KnowledgeBase) => void;
}

const VectorModelSwitchModal: React.FC<VectorModelSwitchModalProps> = ({
    isOpen,
    onClose,
    targetModel,
    targetModelName,
    knowledgeBase,
    onComplete
}) => {
    const [progress, setProgress] = useState<MigrationProgress>({
        step: 'idle',
        percent: 0,
        currentCount: 0,
        totalCount: 0,
        statusText: ''
    });
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleStart = async () => {
        setIsProcessing(true);
        setError(null);
        try {
            // Bước 1: Kiểm tra xem model local đã tải chưa (nếu là BGE)
            if (targetModel.startsWith('TaylorAI/')) {
                const isInstalled = await VectorMigrationService.checkIsLocalModelInstalled(targetModel);
                if (!isInstalled) {
                    setProgress(prev => ({ 
                        ...prev, 
                        step: 'downloading', 
                        percent: 0, 
                        statusText: 'Đang tải model nội bộ (~30MB)...' 
                    }));
                    await VectorMigrationService.downloadModel(targetModel, (p) => {
                        setProgress(prev => ({ ...prev, percent: Math.round(p) }));
                    });
                }
            }

            // Bước 2: Tiến hành di trú
            const result = await VectorMigrationService.migrate(targetModel, knowledgeBase, (p) => {
                setProgress(p);
            });

            // Bước 3: Hoàn tất
            onComplete(result.updatedKb);
            
            // Tự động đóng sau 2 giây nếu thành công
            setTimeout(() => {
                onClose();
            }, 2000);

        } catch (err: any) {
            console.error("Migration error:", err);
            setError(err.message || 'Có lỗi xảy ra trong quá trình chuyển đổi.');
            setProgress(prev => ({ ...prev, step: 'failed' }));
        } finally {
            setIsProcessing(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl"
            >
                {/* Header */}
                <div className="p-6 border-b border-slate-800 bg-slate-800/50">
                    <h3 className="text-xl font-bold text-white flex items-center gap-3">
                        <RefreshCw className={`${isProcessing ? 'animate-spin' : ''} text-indigo-400`} size={24} />
                        Đồng Bộ Model Embedding
                    </h3>
                </div>

                <div className="p-8 space-y-6">
                    {progress.step === 'idle' && !error && (
                        <div className="space-y-4">
                            <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl text-indigo-200 text-sm leading-relaxed">
                                <p>Bạn đang yêu cầu chuyển đổi toàn bộ dữ liệu vector sang model:</p>
                                <p className="font-bold text-indigo-400 mt-2 text-base">● {targetModelName}</p>
                                {targetModel.startsWith('TaylorAI/') && (
                                    <p className="mt-4 text-xs opacity-80 italic">
                                        * Model BGE-Micro-V2 sẽ được tải về trình duyệt (~30MB) và chạy offline 100%.
                                    </p>
                                )}
                            </div>
                            <p className="text-slate-400 text-xs text-center px-4">
                                Quá trình này sẽ tái tạo lại toàn bộ vector dựa trên văn bản gốc. Dữ liệu của bạn hoàn toàn an toàn.
                            </p>
                            <div className="flex gap-3 pt-4">
                                <button 
                                    onClick={onClose}
                                    className="flex-1 py-3 rounded-xl bg-slate-800 text-slate-300 font-bold hover:bg-slate-700 transition-colors"
                                >
                                    Hủy Bỏ
                                </button>
                                <button 
                                    onClick={handleStart}
                                    className="flex-1 py-3 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-900/40"
                                >
                                    Xác Nhận & Chạy
                                </button>
                            </div>
                        </div>
                    )}

                    {(progress.step !== 'idle' || error) && (
                        <div className="space-y-6">
                            {/* Icon Trạng thái */}
                            <div className="flex justify-center">
                                {progress.step === 'completed' ? (
                                    <CheckCircle className="text-emerald-400 animate-bounce" size={64} />
                                ) : progress.step === 'failed' || error ? (
                                    <XCircle className="text-red-400" size={64} />
                                ) : (
                                    <div className="relative">
                                        <Loader2 className="text-indigo-500 animate-spin" size={64} />
                                        <div className="absolute inset-0 flex items-center justify-center text-xs font-black text-indigo-200">
                                            {progress.percent}%
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Thông tin tiến trình */}
                            <div className="text-center space-y-2">
                                <h4 className="font-bold text-white uppercase tracking-widest text-xs">
                                    {progress.step === 'downloading' && "Đang tải Model..."}
                                    {progress.step === 'embedding_rag' && "Đang xử lý Ký ức..."}
                                    {progress.step === 'embedding_works' && "Đang xử lý Truyện gốc..."}
                                    {progress.step === 'completed' && "Đã Hoàn Tất!"}
                                    {progress.step === 'failed' && "Lỗi Đồng Bộ"}
                                </h4>
                                <p className="text-slate-400 text-sm italic">
                                    {error || progress.statusText}
                                </p>
                            </div>

                            {/* Thanh Progress */}
                            {progress.step !== 'completed' && progress.step !== 'failed' && !error && (
                                <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                                    <motion.div 
                                        className="h-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]"
                                        initial={{ width: 0 }}
                                        animate={{ width: `${progress.percent}%` }}
                                    />
                                </div>
                            )}

                            {/* Nút đóng khi có lỗi hoặc xong */}
                            {(progress.step === 'completed' || progress.step === 'failed' || error) && (
                                <button 
                                    onClick={onClose}
                                    className="w-full py-3 rounded-xl bg-slate-800 text-slate-300 font-bold hover:bg-slate-700 transition-colors"
                                >
                                    Đóng
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );
};

export default VectorModelSwitchModal;
