import React from 'react';

export interface ModelOption {
    id: string;
    name: string;
}

interface IncompleteNarrationModalProps {
    isOpen: boolean;
    attempt: number;
    maxAttempts: number;
    isLoading?: boolean;
    recoveryAction?: 'continue' | 'rewrite' | null;
    hasPartialContent?: boolean;
    availableModels?: ModelOption[];
    selectedModel?: string;
    onSelectModel?: (model: string) => void;
    onContinue: () => void;
    onRewrite?: () => void;
    onIgnore: () => void;
    onHide?: () => void;
    isMinimized?: boolean;
    onRestore?: () => void;
}

export const IncompleteNarrationModal: React.FC<IncompleteNarrationModalProps> = ({
    isOpen,
    attempt,
    maxAttempts,
    isLoading = false,
    recoveryAction = null,
    hasPartialContent = true,
    availableModels = [],
    selectedModel,
    onSelectModel,
    onContinue,
    onRewrite,
    onIgnore,
    onHide,
    isMinimized = false,
    onRestore
}) => {
    if (!isOpen) return null;

    // Render Floating Widget when minimized
    if (isMinimized) {
        return (
            <div className="fixed bottom-6 right-6 z-[9999] flex items-center gap-3 bg-slate-900/95 backdrop-blur-md border border-amber-500/50 p-3 px-4 rounded-2xl shadow-2xl shadow-amber-950/60 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="flex items-center gap-2 text-amber-400 text-xs font-medium">
                    <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                    </span>
                    <span>
                        {isLoading
                            ? (recoveryAction === 'rewrite' ? 'Đang viết lại từ đầu...' : 'Đang viết tiếp lời kể...')
                            : `Lời kể bị đứt đoạn (Lần ${attempt}/${maxAttempts})`}
                    </span>
                </div>
                <button
                    type="button"
                    onClick={onRestore}
                    className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-all transform hover:scale-105 active:scale-95 shadow-md shadow-amber-500/20 flex items-center gap-1.5"
                >
                    <span>Mở lại</span>
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 15l-6-6-6 6"/>
                    </svg>
                </button>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-amber-500/40 rounded-2xl p-6 max-w-lg w-full shadow-2xl shadow-amber-950/30 animate-in fade-in zoom-in-95 duration-200 relative">
                {/* Close / Minimize Button */}
                {onHide && (
                    <button
                        type="button"
                        onClick={onHide}
                        title="Tạm đóng modal để đọc truyện"
                        className="absolute top-4 right-4 text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 p-2 rounded-xl transition-all"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 6 6 18" />
                            <path d="m6 6 12 12" />
                        </svg>
                    </button>
                )}

                <div className="flex items-center gap-3 mb-4 text-amber-400">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0">
                        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                            <path d="M12 9v4" />
                            <path d="M12 17h.01" />
                        </svg>
                    </div>
                    <div>
                        <h3 className="text-xl font-bold font-sans tracking-tight text-white flex items-center gap-2">
                            Lời Kể Bị Đứt Đoạn
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                Bù đắp {attempt}/{maxAttempts}
                            </span>
                        </h3>
                        <p className="text-xs text-slate-400 mt-0.5">Phát hiện thiếu thẻ đóng &lt;/content&gt; hoàn tất</p>
                    </div>
                </div>

                <div className="space-y-3 mb-5 text-sm text-slate-300 leading-relaxed bg-slate-950/50 p-3.5 rounded-xl border border-slate-800">
                    <p>
                        Phản hồi thô của AI kể chuyện kết thúc khi chưa hoàn thành lời kể (thiếu thẻ đóng <code className="text-amber-300 font-mono text-xs bg-slate-800 px-1.5 py-0.5 rounded">&lt;/content&gt;</code>). Điều này thường xảy ra khi lời kể quá dài hoặc đạt giới hạn token.
                    </p>
                    <p className="text-xs text-slate-400">
                        Bạn có thể chọn Model AI để viết tiếp phần còn dang dở, chọn <strong className="text-rose-300">Viết lại từ đầu</strong> để xóa nội dung viết dở và tạo mới hoàn toàn, hoặc bấm tạm đóng để xem trước nội dung đang viết.
                    </p>
                </div>

                {/* Model Selector Dropdown */}
                {availableModels && availableModels.length > 0 && onSelectModel && (
                    <div className="mb-5 bg-slate-950/40 p-3 rounded-xl border border-slate-800/80">
                        <label className="block text-xs font-medium text-amber-300 mb-1.5 flex items-center gap-1.5">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 2v8"/>
                                <path d="m4.93 10.93 1.41 1.41"/>
                                <path d="M2 18h2"/>
                                <path d="M20 18h2"/>
                                <path d="m19.07 10.93-1.41 1.41"/>
                                <path d="M22 22H2"/>
                                <path d="m16 6-4 4-4-4"/>
                            </svg>
                            <span>Chọn Model AI (Tạo tiếp / Viết lại):</span>
                        </label>
                        <select
                            value={selectedModel || ''}
                            onChange={(e) => onSelectModel(e.target.value)}
                            disabled={isLoading}
                            className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 font-medium"
                        >
                            {availableModels.map((m) => (
                                <option key={m.id} value={m.id}>
                                    {m.name} ({m.id})
                                </option>
                            ))}
                        </select>
                    </div>
                )}

                {/* Actions */}
                <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2.5 justify-end items-stretch sm:items-center">
                    {onHide && (
                        <button
                            type="button"
                            onClick={onHide}
                            disabled={isLoading}
                            className="w-full sm:w-auto px-3.5 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition-colors font-medium text-xs disabled:opacity-50"
                        >
                            Tạm đóng & Đọc tiếp
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={onIgnore}
                        disabled={isLoading}
                        className="w-full sm:w-auto px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 transition-colors font-medium text-xs disabled:opacity-50"
                    >
                        Bỏ qua & Dùng nội dung này
                    </button>
                    {onRewrite && (
                        <button
                            type="button"
                            onClick={onRewrite}
                            disabled={isLoading}
                            className="w-full sm:w-auto px-4 py-2 rounded-xl bg-rose-950/70 hover:bg-rose-900/90 border border-rose-500/40 text-rose-200 font-semibold text-xs transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                        >
                            {isLoading && recoveryAction === 'rewrite' ? (
                                <>
                                    <svg className="animate-spin h-3.5 w-3.5 text-rose-200" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    <span>Đang viết lại...</span>
                                </>
                            ) : (
                                <>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                                        <path d="M3 3v5h5" />
                                    </svg>
                                    <span>Viết lại từ đầu</span>
                                </>
                            )}
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={onContinue}
                        disabled={isLoading || !hasPartialContent}
                        className="w-full sm:w-auto px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {isLoading && recoveryAction !== 'rewrite' ? (
                            <>
                                <svg className="animate-spin h-3.5 w-3.5 text-slate-950" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                <span>Đang viết tiếp...</span>
                            </>
                        ) : (
                            <>
                                <span>Viết tiếp lời kể ➔</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
