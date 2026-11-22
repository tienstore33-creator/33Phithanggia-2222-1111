
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { fallbackEventService } from '../../services/fallbackEventService';
import Spinner from './Spinner';
import { Minimize2, Maximize2 } from 'lucide-react';

const FallbackOverlay: React.FC = () => {
    const [state, setState] = useState(fallbackEventService.getState());
    const [elapsedTime, setElapsedTime] = useState(0);
    const [isMinimized, setIsMinimized] = useState(false);

    useEffect(() => {
        const unsubscribe = fallbackEventService.subscribe((newState) => {
            setState(newState);
            if (!newState.isProcessing) {
                setIsMinimized(false);
            }
        });
        return unsubscribe;
    }, []);

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (state.isProcessing && state.startTime) {
            interval = setInterval(() => {
                setElapsedTime(Math.floor((Date.now() - state.startTime!) / 1000));
            }, 1000);
        } else {
            setElapsedTime(0);
        }
        return () => clearInterval(interval);
    }, [state.isProcessing, state.startTime]);

    return (
        <AnimatePresence>
            {state.isProcessing && (
                <motion.div
                    initial={{ opacity: 0, x: 50 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 50 }}
                    className="fixed top-4 right-4 z-[260] w-[90%] max-w-sm"
                >
                    {isMinimized ? (
                        <div className="bg-gray-900/95 backdrop-blur-md border border-indigo-500/50 rounded-xl shadow-2xl overflow-hidden px-3 py-2 flex items-center justify-between gap-3 text-xs text-indigo-300">
                            <div className="flex items-center gap-2">
                                <Spinner size="sm" />
                                <span className="font-semibold tracking-wide">
                                    Đang chuyển đổi... <span className="text-indigo-400 font-mono">({elapsedTime}s)</span>
                                </span>
                                <span className="bg-indigo-950/50 text-[10px] text-indigo-400 font-mono px-1.5 py-0.5 rounded border border-indigo-500/20">
                                    {state.attempt}/{state.total}
                                </span>
                            </div>
                            <button 
                                onClick={() => setIsMinimized(false)}
                                className="p-1 hover:bg-white/10 rounded text-gray-400 hover:text-white transition-colors"
                                title="Mở rộng"
                            >
                                <Maximize2 className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    ) : (
                        <div className="bg-gray-900/95 backdrop-blur-md border border-indigo-500/50 rounded-xl shadow-2xl overflow-hidden">
                            {/* Header */}
                            <div className="bg-indigo-600/20 px-4 py-2 flex items-center justify-between border-b border-indigo-500/30">
                                <div className="flex items-center gap-2">
                                    <Spinner size="sm" />
                                    <span className="text-indigo-300 font-bold text-sm uppercase tracking-wider">
                                        Đang chuyển đổi Model dự phòng...
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-mono text-indigo-400 bg-indigo-950/50 px-2 py-0.5 rounded">
                                        {elapsedTime}s
                                    </span>
                                    <button 
                                        onClick={() => setIsMinimized(true)}
                                        className="p-1 hover:bg-white/10 rounded text-gray-400 hover:text-white transition-colors"
                                        title="Thu nhỏ"
                                    >
                                        <Minimize2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>

                            {/* Body */}
                            <div className="p-4 space-y-3">
                                {state.failedModel && (
                                    <div className="text-xs text-red-400 flex flex-col gap-1">
                                        <span className="opacity-60 uppercase font-semibold">Model lỗi:</span>
                                        <span className="font-mono bg-red-950/30 p-1 rounded border border-red-900/30">
                                            {state.failedModel}
                                        </span>
                                    </div>
                                )}

                                <div className="text-xs text-indigo-300 flex flex-col gap-1">
                                    <span className="opacity-60 uppercase font-semibold">Đang thử:</span>
                                    <span className="font-mono bg-indigo-950/30 p-1 rounded border border-indigo-900/30">
                                        {state.currentModel}
                                    </span>
                                </div>

                                {/* Progress Bar */}
                                <div className="space-y-1">
                                    <div className="flex justify-between text-[10px] text-gray-400 uppercase font-bold">
                                        <span>Tiến độ chuỗi dự phòng</span>
                                        <span>{state.attempt} / {state.total}</span>
                                    </div>
                                    <div className="h-1.5 w-full bg-gray-800 rounded-full overflow-hidden">
                                        <motion.div 
                                            className="h-full bg-indigo-500"
                                            initial={{ width: 0 }}
                                            animate={{ width: `${(state.total > 0 ? (state.attempt / state.total) * 100 : 0)}%` }}
                                            transition={{ type: 'spring', bounce: 0, duration: 0.5 }}
                                        />
                                    </div>
                                </div>
                            </div>
                            
                            {/* Footer Hint */}
                            <div className="px-4 py-2 bg-black/20 text-[10px] text-gray-500 italic text-center border-t border-white/5">
                                Hệ thống đang tự động tìm kiếm model khả dụng nhất. Vui lòng đợi...
                            </div>
                        </div>
                    )}
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default FallbackOverlay;
