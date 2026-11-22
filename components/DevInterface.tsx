import React, { useState } from 'react';
import Button from './ui/Button';
import AvatarStudio from './AvatarStudio';
import CanvasGeneratorModal from './CanvasGeneratorModal';
import { VIETNAMESE } from '../constants';

interface DevInterfaceProps {
    isOpen: boolean;
    onClose: () => void;
    isDevMode: boolean;
    onToggleDevMode: () => void;
}

const DevInterface: React.FC<DevInterfaceProps> = ({ isOpen, onClose, isDevMode, onToggleDevMode }) => {
    const [showStudio, setShowStudio] = useState(false);
    const [showCanvasStudio, setShowCanvasStudio] = useState(false);
    const [isPlayerZeroActive, setIsPlayerZeroActive] = useState(() => {
        return localStorage.getItem('isPlayerZeroActive') === 'true';
    });

    const handleTogglePlayerZero = () => {
        const nextVal = !isPlayerZeroActive;
        setIsPlayerZeroActive(nextVal);
        localStorage.setItem('isPlayerZeroActive', String(nextVal));
    };
    
    if (showStudio) {
        return <AvatarStudio isOpen={showStudio} onClose={() => setShowStudio(false)} />;
    }

    if (!isOpen) return null;

    return (
        <>
            <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                <div className="bg-gray-900 border-2 border-indigo-500 rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                    {/* Header */}
                    <div className="bg-indigo-900/50 p-4 border-b border-indigo-500/50 flex justify-between items-center">
                        <h2 className="text-xl font-bold text-indigo-300 uppercase tracking-widest flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
                            </svg>
                            Giao diện DEV
                        </h2>
                        <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-6 space-y-6">
                        {/* Toggle Mode */}
                        <div className="flex items-center justify-between p-4 bg-gray-800 rounded-lg border border-gray-700">
                            <div>
                                <div className="text-sm font-bold text-white uppercase tracking-wider">Chế độ DEV</div>
                                <div className="text-[10px] text-gray-400 mt-1 italic">Bật để xem thông tin debug và logs hệ thống</div>
                            </div>
                            <button 
                                onClick={onToggleDevMode}
                                className={`relative inline-flex h-6 w-12 items-center rounded-full transition-colors duration-200 focus:outline-none ${isDevMode ? 'bg-indigo-600' : 'bg-gray-600'}`}
                            >
                                <span className="sr-only">Toggle Dev Mode</span>
                                <span
                                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${isDevMode ? 'translate-x-7' : 'translate-x-1'}`}
                                />
                            </button>
                        </div>

                        {/* Toggle Player Zero (P0) */}
                        <div className="flex items-center justify-between p-4 bg-gray-800 rounded-lg border border-gray-700">
                            <div>
                                <div className="text-sm font-bold text-white uppercase tracking-wider">Người chơi số 0 (P0)</div>
                                <div className="text-[10px] text-gray-400 mt-1 italic">Kích hoạt các NPC đặc biệt có ý chí hành động ngầm độc lập</div>
                            </div>
                            <button 
                                onClick={handleTogglePlayerZero}
                                className={`relative inline-flex h-6 w-12 items-center rounded-full transition-colors duration-200 focus:outline-none ${isPlayerZeroActive ? 'bg-indigo-600' : 'bg-gray-600'}`}
                            >
                                <span className="sr-only">Toggle Player Zero Mode</span>
                                <span
                                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${isPlayerZeroActive ? 'translate-x-7' : 'translate-x-1'}`}
                                />
                            </button>
                        </div>

                        {/* Canvas Generator Studio Button */}
                        <div className="p-4 bg-indigo-950/40 rounded-lg border border-indigo-500/40 flex items-center justify-between">
                            <div>
                                <div className="text-sm font-bold text-indigo-300 uppercase tracking-wider">Canvas Prompt Studio</div>
                                <div className="text-[10px] text-indigo-400/80 mt-1 italic">Tạo và vẽ hình ảnh HTML5 Canvas bằng AI Prompt</div>
                            </div>
                            <Button variant="primary" size="sm" onClick={() => setShowCanvasStudio(true)}>Tạo Canvas</Button>
                        </div>

                        {/* Calibration Studio Button */}
                        <div className="p-4 bg-indigo-900/20 rounded-lg border border-indigo-500/30 flex items-center justify-between">
                            <div>
                                <div className="text-sm font-bold text-indigo-300 uppercase tracking-wider">Calibration Studio</div>
                                <div className="text-[10px] text-indigo-400/70 mt-1 italic">Phòng thí nghiệm hiệu chỉnh Avatar (v1.0)</div>
                            </div>
                            <Button variant="outline" size="sm" onClick={() => setShowStudio(true)}>Mở Studio</Button>
                        </div>

                        {/* System Info */}
                        <div className="space-y-3">
                            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest border-b border-gray-800 pb-1">Thông tin hệ thống</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-gray-850 p-3 rounded border border-gray-800">
                                    <div className="text-[10px] text-gray-500 uppercase font-bold">Phiên bản</div>
                                    <div className="text-sm font-mono text-indigo-300">1.8.0</div>
                                </div>
                                <div className="bg-gray-850 p-3 rounded border border-gray-800">
                                    <div className="text-[10px] text-gray-500 uppercase font-bold">Engine</div>
                                    <div className="text-sm font-mono text-indigo-300">Gemini 3 Flash</div>
                                </div>
                            </div>
                        </div>

                        {/* Warning */}
                        <div className="p-3 bg-amber-900/20 border border-amber-500/30 rounded text-[10px] text-amber-200/70 leading-relaxed italic">
                            Lưu ý: Chế độ DEV hiển thị các dữ liệu thô từ AI và trạng thái bộ nhớ. Chỉ sử dụng cho mục đích kiểm thử và gỡ lỗi.
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="p-4 bg-gray-850 border-t border-gray-800 flex justify-end">
                        <Button variant="primary" size="md" onClick={onClose} className="min-w-[100px]">
                            {VIETNAMESE.closeButton}
                        </Button>
                    </div>
                </div>
            </div>

            {/* Canvas Prompt Studio Modal */}
            <CanvasGeneratorModal
                isOpen={showCanvasStudio}
                onClose={() => setShowCanvasStudio(false)}
            />
        </>
    );
};

export default DevInterface;
