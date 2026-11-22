import React from 'react';
import { VIETNAMESE } from '../../../constants';

interface FlashSummaryRecoveryModalProps {
    isOpen: boolean;
    onAgree: () => void;
    onIgnore: () => void;
}

export const FlashSummaryRecoveryModal: React.FC<FlashSummaryRecoveryModalProps> = ({ isOpen, onAgree, onIgnore }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-md w-full shadow-2xl animate-in fade-in zoom-in duration-300">
                <div className="flex items-center gap-3 mb-4 text-amber-400">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
                    <h3 className="text-xl font-bold font-sans tracking-tight">Lỗi Trí Nhớ AI</h3>
                </div>
                
                <p className="text-slate-300 mb-6 leading-relaxed">
                    Hệ thống không thể tạo bản tóm tắt diễn biến cho lượt này một cách chính xác sau nhiều lần thử. Trí nhớ của AI có thể gặp vấn đề nếu không có bản tóm tắt này. Bạn có muốn tiếp tục thử tạo lại không?
                </p>

                <div className="flex flex-col sm:flex-row gap-3 justify-end">
                    <button
                        onClick={onIgnore}
                        className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 transition-colors font-medium text-sm"
                    >
                        Bỏ qua (Có thể hỏng trí nhớ)
                    </button>
                    <button
                        onClick={onAgree}
                        className="px-6 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold transition-all transform hover:scale-105 active:scale-95 shadow-lg shadow-amber-500/20"
                    >
                        Đồng ý (Cố gắng khôi phục)
                    </button>
                </div>
            </div>
        </div>
    );
};
