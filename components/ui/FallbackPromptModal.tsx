import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { fallbackPromptService, FallbackPromptRequest } from '../../services/fallbackPromptService';
import { AVAILABLE_MODELS } from '../../constants/api';

const FallbackPromptModal: React.FC = () => {
    const [request, setRequest] = useState<FallbackPromptRequest | null>(null);
    const [selectedModel, setSelectedModel] = useState<string>('');

    useEffect(() => {
        const unsubscribe = fallbackPromptService.subscribe((req) => {
            setRequest(req);
            if (req) {
                const list = req.availableModels.length > 0
                    ? req.availableModels
                    : AVAILABLE_MODELS.map(m => m.id);
                
                const defaultChoice = list.find(m => m !== req.parsedError.failedModel) || list[0] || 'gemini-flash-latest';
                setSelectedModel(defaultChoice);
            }
        });
        return unsubscribe;
    }, []);

    if (!request) return null;

    const rawList = request.availableModels.length > 0
        ? request.availableModels
        : AVAILABLE_MODELS.map(m => m.id);

    const modelList = Array.from(new Set(rawList));

    // Phân nhóm model thành 4 loại theo yêu cầu: pro, flash, flash lite, những loại khác
    const getModelLabel = (mId: string) => {
        const found = AVAILABLE_MODELS.find(item => item.id === mId);
        return found ? found.name : mId;
    };

    const proGroup: string[] = [];
    const flashGroup: string[] = [];
    const flashLiteGroup: string[] = [];
    const otherGroup: string[] = [];

    modelList.forEach((mId: string) => {
        const lower = mId.toLowerCase();
        if (lower.includes('pro')) {
            proGroup.push(mId);
        } else if (lower.includes('lite') || lower.includes('flash-lite')) {
            flashLiteGroup.push(mId);
        } else if (lower.includes('flash')) {
            flashGroup.push(mId);
        } else {
            otherGroup.push(mId);
        }
    });

    const handleConfirm = () => {
        if (!selectedModel) return;
        request.onSelect(selectedModel);
    };

    const handleCancel = () => {
        request.onSelect(null);
    };

    const { parsedError } = request;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[999] flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 10 }}
                    className="bg-slate-900 border border-rose-500/40 rounded-xl p-5 max-w-xl w-full shadow-2xl relative font-sans text-amber-100"
                >
                    {/* Header */}
                    <div className="flex items-center gap-2.5 border-b border-rose-500/20 pb-3 mb-4">
                        <span className="text-2xl">⚠️</span>
                        <div>
                            <h3 className="text-rose-400 font-serif font-bold text-base leading-tight">
                                CẢNH BÁO LỖI API GOOGLE (Mã {parsedError.code})
                            </h3>
                            <p className="text-xs text-slate-400 mt-0.5">
                                Trạng thái lỗi: <span className="font-mono text-rose-300">{parsedError.status}</span>
                            </p>
                        </div>
                    </div>

                    {/* Bóc tách thông tin lỗi chi tiết */}
                    <div className="space-y-4 text-xs leading-relaxed">
                        <div className="bg-slate-950/70 p-4 rounded-lg border border-slate-800 space-y-2 font-mono">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-300">
                                <div>
                                    <span className="text-rose-400 font-bold">Model gặp sự cố:</span>
                                    <span className="text-white ml-1">{parsedError.failedModel}</span>
                                </div>
                                {parsedError.retryDelay && (
                                    <div>
                                        <span className="text-amber-400 font-bold">Thời gian chờ lại:</span>
                                        <span className="text-white ml-1 bg-amber-500/20 px-1.5 py-0.5 rounded text-[11px]">{parsedError.retryDelay}</span>
                                    </div>
                                )}
                                {parsedError.tokenLimit && (
                                    <div>
                                        <span className="text-blue-400 font-bold">Giới hạn Token:</span>
                                        <span className="text-white ml-1">{Number(parsedError.tokenLimit).toLocaleString()}</span>
                                    </div>
                                )}
                                {parsedError.quotaMetric && (
                                    <div className="col-span-1 sm:col-span-2">
                                        <span className="text-slate-400 font-bold">Loại quota vi phạm:</span>
                                        <span className="text-slate-200 ml-1 truncate block sm:inline">{parsedError.quotaMetric}</span>
                                    </div>
                                )}
                            </div>

                            <div className="border-t border-slate-800/60 pt-2 text-amber-200">
                                <span className="text-rose-400 font-bold">Mô tả chi tiết lỗi:</span>
                                <p className="mt-1 font-sans text-[12px] leading-normal text-slate-200">
                                    {parsedError.cleanDescription}
                                </p>
                            </div>
                        </div>

                        {/* Dropdown chọn model phân theo 4 nhóm */}
                        <div className="space-y-2 pt-1">
                            <label className="block text-amber-200 font-medium text-xs">
                                Chọn Model khác để tiếp tục xử lý tác vụ:
                            </label>
                            <select
                                value={selectedModel}
                                onChange={(e) => setSelectedModel(e.target.value)}
                                className="w-full bg-slate-950 border border-amber-500/30 text-amber-100 rounded-lg p-2.5 text-xs font-mono focus:outline-none focus:border-amber-400 transition-colors"
                            >
                                {proGroup.length > 0 && (
                                    <optgroup label="✨ NHÓM PRO (Suy luận cao, bám sát cốt truyện)">
                                        {proGroup.map(m => (
                                            <option key={m} value={m}>{getModelLabel(m)} ({m})</option>
                                        ))}
                                    </optgroup>
                                )}

                                {flashGroup.length > 0 && (
                                    <optgroup label="⚡ NHÓM FLASH (Cân bằng, tốc độ cực nhanh)">
                                        {flashGroup.map(m => (
                                            <option key={m} value={m}>{getModelLabel(m)} ({m})</option>
                                        ))}
                                    </optgroup>
                                )}

                                {flashLiteGroup.length > 0 && (
                                    <optgroup label="🍃 NHÓM FLASH LITE (Siêu tiết kiệm, tốc độ tối đa)">
                                        {flashLiteGroup.map(m => (
                                            <option key={m} value={m}>{getModelLabel(m)} ({m})</option>
                                        ))}
                                    </optgroup>
                                )}

                                {otherGroup.length > 0 && (
                                    <optgroup label="⚙️ NHÓM KHÁC (Gemma & Chuyên biệt)">
                                        {otherGroup.map(m => (
                                            <option key={m} value={m}>{getModelLabel(m)} ({m})</option>
                                        ))}
                                    </optgroup>
                                )}
                            </select>
                        </div>
                    </div>

                    {/* Footer buttons */}
                    <div className="mt-6 flex justify-end gap-3 pt-3 border-t border-slate-800">
                        <button
                            onClick={handleCancel}
                            className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium px-4 py-2 rounded-lg text-xs transition-colors"
                        >
                            ✖ Không (Hủy bỏ)
                        </button>
                        <button
                            onClick={handleConfirm}
                            className="bg-rose-600 hover:bg-rose-500 text-slate-950 font-bold px-4 py-2 rounded-lg text-xs shadow-lg transition-all"
                        >
                            ✔ Thử lại với Model này
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default FallbackPromptModal;
