import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { apiRunningService, ApiTask } from '../../services/apiRunningService';
import Spinner from './Spinner';
import FallbackPromptModal from './FallbackPromptModal';

const formatRawContent = (str: string): string => {
    if (!str) return '';
    return str.replace(/\\n/g, '\n').replace(/\\r/g, '');
};

const TaskToastItem: React.FC<{ task: ApiTask; isRagActive: boolean }> = ({ task, isRagActive }) => {
    const [elapsedTime, setElapsedTime] = useState(() =>
        Math.floor((Date.now() - task.startTime) / 1000)
    );

    useEffect(() => {
        const interval = setInterval(() => {
            setElapsedTime(Math.floor((Date.now() - task.startTime) / 1000));
        }, 1000);
        return () => clearInterval(interval);
    }, [task.startTime]);

    const keyLabel = task.apiKeyLabel ? task.apiKeyLabel : 'API KEY';

    return (
        <motion.div
            initial={{ opacity: 0, x: -50, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -50, scale: 0.9 }}
            transition={{ duration: 0.2 }}
            className="bg-indigo-950/85 backdrop-blur-md border border-indigo-500/50 rounded-2xl px-3 py-2 flex items-start gap-2 shadow-2xl pointer-events-auto max-w-[90vw] sm:max-w-[400px]"
        >
            <div className="mt-0.5"><Spinner size="xs" /></div>
            <div className="flex flex-wrap items-center gap-1.5 text-[9.5px] font-bold tracking-tight uppercase leading-relaxed">
                <span className="text-amber-300 font-mono font-extrabold whitespace-nowrap">Request thứ {task.requestNumber || 1}</span>
                <span className="text-indigo-500">:</span>
                <span className="text-indigo-300 font-mono whitespace-nowrap">{keyLabel}</span>
                <span className="text-indigo-500">:</span>
                <span className="text-white font-mono whitespace-nowrap">{task.modelName}</span>
                <span className="text-indigo-500">:</span>
                <span className="text-indigo-400 tabular-nums bg-indigo-900/80 px-1 py-0.5 rounded font-mono text-[9px] whitespace-nowrap">
                    {elapsedTime}s
                </span>
                {task.purpose && (
                    <>
                        <span className="text-indigo-500">:</span>
                        <span className="text-indigo-200 normal-case font-normal inline-block line-clamp-2">
                            {task.purpose}
                        </span>
                    </>
                )}
                {/* HIỂN THỊ FILE TẠO CUỘC GỌI Ở ĐẰNG SAU - CHỈ KHI RAG BẬT */}
                {task.caller && isRagActive && (
                    <>
                        <span className="text-indigo-500 whitespace-nowrap">:</span>
                        <span className="text-rose-400 font-mono lowercase bg-rose-950/60 px-1 py-0.5 rounded border border-rose-800/30 text-[8.5px] whitespace-nowrap">
                            {task.caller}
                        </span>
                    </>
                )}
            </div>
        </motion.div>
    );
};

const ApiRunningToast: React.FC = () => {
    const [state, setState] = useState(apiRunningService.getState());
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [activeRawModal, setActiveRawModal] = useState<{ title: string; content: string; filename: string } | null>(null);

    useEffect(() => {
        const unsubscribe = apiRunningService.subscribe((newState) => {
            setState(newState);
        });
        return unsubscribe;
    }, []);

    const [isRagActive, setIsRagActive] = useState(() => localStorage.getItem('isRagSystemActive') === 'true');

    useEffect(() => {
        const handleRagChange = () => {
            setIsRagActive(localStorage.getItem('isRagSystemActive') === 'true');
        };
        window.addEventListener('rag-system-change', handleRagChange);
        return () => window.removeEventListener('rag-system-change', handleRagChange);
    }, []);

    const tasks = state.activeTasks || [];
    const history = state.currentTurnHistory || [];
    const hasHistory = history.length > 0;
    const isProcessing = state.isProcessing;

    const downloadTxt = (filename: string, text: string) => {
        const element = document.createElement("a");
        const file = new Blob([text], {type: 'text/plain;charset=utf-8'});
        element.href = URL.createObjectURL(file);
        element.download = filename;
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
    };

    return (
        <>
            <FallbackPromptModal />

            {/* Vùng hiển thị Toast hoạt động */}
            <div className="fixed bottom-4 left-4 z-[250] pointer-events-none flex flex-col gap-2 max-w-lg">
                <AnimatePresence>
                    {tasks.map((task) => (
                        <TaskToastItem key={task.id} task={task} isRagActive={isRagActive} />
                    ))}
                </AnimatePresence>
            </div>

            {/* NÚT POPUP THỐNG KÊ NHỎ KHẢ DỤNG KHI HOÀN TẤT CUỘC GỌI - CHỈ HIỂN THỊ KHI RAG ĐANG BẬT */}
            <AnimatePresence>
                {!isProcessing && hasHistory && isRagActive && (
                    <motion.button
                        drag
                        dragMomentum={false}
                        dragConstraints={{ top: -500, left: -500, right: 500, bottom: 500 }}
                        whileDrag={{ scale: 1.05, cursor: 'grabbing' }}
                        initial={{ opacity: 0, scale: 0.8, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.8, y: 20 }}
                        onClick={() => setIsModalOpen(true)}
                        className="fixed bottom-4 left-4 z-[251] bg-amber-500 hover:bg-amber-400 active:scale-95 transition-all text-slate-950 font-serif font-bold text-[10px] px-3.5 py-2 rounded-full shadow-lg flex items-center gap-1.5 border border-amber-300 cursor-grab"
                    >
                        <span>📊</span> Thống kê API lượt vừa qua ({history.length})
                    </motion.button>
                )}
            </AnimatePresence>

            {/* HỘP THOẠI CHI TIẾT (POPUP MODAL) */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-[300] flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-slate-900 border border-[#dcc9a6]/30 rounded-lg p-5 max-w-3xl w-full shadow-2xl relative font-sans"
                    >
                        <button 
                            onClick={() => setIsModalOpen(false)}
                            className="absolute top-4 right-4 text-gray-400 hover:text-white text-lg font-bold"
                        >
                            ✕
                        </button>
                        <h3 className="text-[#dcc9a6] font-serif text-sm font-bold border-b border-[#dcc9a6]/20 pb-2 mb-4 flex items-center gap-2">
                            <span>📊</span> CHI TIẾT CÁC CUỘC GỌI API TRONG LƯỢT VỪA QUA
                        </h3>
                        <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1 text-[10px]">
                            {history.map((h) => (
                                <div key={h.id} className="flex items-center justify-between gap-2 text-gray-300 font-mono leading-relaxed p-2 bg-slate-950/40 rounded border border-slate-800/50">
                                    <div className="flex items-start gap-2 flex-1">
                                        <span className="text-amber-400 font-bold mt-0.5">○</span>
                                        <div className="flex-1">
                                            <span className="text-amber-300 font-bold">Request thứ {h.requestNumber}</span>
                                            <span className="text-gray-500"> : </span>
                                            <span className="text-indigo-300">{h.apiKeyLabel || 'API KEY'}</span>
                                            <span className="text-gray-500"> : </span>
                                            <span className="text-teal-400">{h.modelName}</span>
                                            <span className="text-gray-500"> : </span>
                                            <span className="text-rose-400 font-bold">{h.durationSeconds}s</span>
                                            <span className="text-gray-500"> : </span>
                                            <span className="text-gray-200">{h.purpose || 'Không rõ mục đích'}</span>
                                            <span className="text-gray-500"> : </span>
                                            <span className="text-emerald-400 font-bold italic">{h.caller}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        <button
                                            onClick={() => setActiveRawModal({
                                                title: `Nội dung thô Gửi AI - Request #${h.requestNumber} (${h.modelName})`,
                                                content: formatRawContent(h.rawRequest || '(Không có nội dung thô gửi đi)'),
                                                filename: `request_${h.requestNumber}_${Date.now()}.txt`
                                            })}
                                            className="px-2 py-1 bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-700/50 rounded font-bold text-[9px] transition-all"
                                            title="Xem nội dung thô gửi AI (Request)"
                                        >
                                            Gửi
                                        </button>
                                        <button
                                            onClick={() => setActiveRawModal({
                                                title: `Nội dung thô Nhận từ AI - Request #${h.requestNumber} (${h.modelName})`,
                                                content: formatRawContent(h.rawResponse || '(Không có nội dung thô nhận về)'),
                                                filename: `response_${h.requestNumber}_${Date.now()}.txt`
                                            })}
                                            className="px-2 py-1 bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-700/50 rounded font-bold text-[9px] transition-all"
                                            title="Xem nội dung thô lấy từ AI (Response)"
                                        >
                                            Nhận
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="mt-5 flex justify-end">
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="bg-[#dcc9a6]/10 hover:bg-[#dcc9a6]/20 text-[#dcc9a6] font-serif text-[11px] px-4 py-1.5 rounded border border-[#dcc9a6]/30 transition-all"
                            >
                                Đóng Thống Kê
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}

            {/* MODAL HIỂN THỊ NỘI DUNG THÔ (GỬI HOẶC NHẬN) */}
            {activeRawModal && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[350] flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-slate-900 border border-[#dcc9a6]/30 rounded-lg p-5 max-w-3xl w-full shadow-2xl relative font-sans flex flex-col max-h-[85vh]"
                    >
                        <button 
                            onClick={() => setActiveRawModal(null)}
                            className="absolute top-4 right-4 text-gray-400 hover:text-white text-lg font-bold"
                        >
                            ✕
                        </button>
                        <h3 className="text-[#dcc9a6] font-serif text-sm font-bold border-b border-[#dcc9a6]/20 pb-2 mb-3 flex items-center gap-2">
                            <span>📝</span> {activeRawModal.title}
                        </h3>
                        <div className="flex-1 overflow-y-auto bg-slate-950 p-3 rounded border border-slate-800 text-gray-200 font-mono text-[11px] whitespace-pre-wrap leading-relaxed select-text">
                            {activeRawModal.content}
                        </div>
                        <div className="mt-4 flex items-center justify-between pt-3 border-t border-slate-800">
                            <button
                                onClick={() => downloadTxt(activeRawModal.filename, activeRawModal.content)}
                                className="bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold font-serif text-[11px] px-4 py-1.5 rounded shadow transition-all flex items-center gap-1.5"
                            >
                                <span>📥</span> Tải về TXT
                            </button>
                            <button
                                onClick={() => setActiveRawModal(null)}
                                className="bg-slate-800 hover:bg-slate-700 text-gray-300 font-serif text-[11px] px-4 py-1.5 rounded border border-slate-700 transition-all"
                            >
                                Đóng
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </>
    );
};

export default ApiRunningToast;
