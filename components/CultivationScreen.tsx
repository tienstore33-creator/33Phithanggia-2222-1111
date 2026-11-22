import React, { useState, useEffect, useRef } from 'react';
import { KnowledgeBase, GameMessage, GameScreen, PlayerStats, UIState } from '../types';
import { useCultivationActions } from '../hooks/useCultivationActions';
import { useRealmSystem } from '../hooks/useRealmSystem';
import { VIETNAMESE } from '../constants';
import { checkLocationSafety } from '../services/ai/cultivationValidator';
import { parseRealm } from '../utils/realmUtils';

interface CultivationScreenProps {
    knowledgeBase: KnowledgeBase;
    setKnowledgeBase: React.Dispatch<React.SetStateAction<KnowledgeBase>>;
    gameMessages: GameMessage[];
    addMessageAndUpdateState: (newMessages: GameMessage[], newKnowledgeBase: KnowledgeBase, startingCurrency?: number, callback?: () => void) => void;
    setIsCultivating: React.Dispatch<React.SetStateAction<boolean>>;
    showNotification: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
    setCurrentScreen: (screen: GameScreen) => void;
    handleStartBreakthroughCombat: () => void;
    uiState: UIState;
    setUiState: React.Dispatch<React.SetStateAction<UIState>>;
}

export const CultivationScreen: React.FC<CultivationScreenProps> = ({
    knowledgeBase,
    setKnowledgeBase,
    gameMessages,
    addMessageAndUpdateState,
    setIsCultivating,
    showNotification,
    setCurrentScreen,
    handleStartBreakthroughCombat,
    uiState,
    setUiState
}) => {
    const { handleStartCultivation, handleExitCultivation } = useCultivationActions({
        knowledgeBase,
        gameMessages,
        setKnowledgeBase,
        addMessageAndUpdateState,
        setIsCultivating,
        showNotification,
        setCurrentScreen,
        uiState,
        setUiState
    });

    const [durationDays, setDurationDays] = useState<number>(0);
    const [durationMonths, setDurationMonths] = useState<number>(0);
    const [durationYears, setDurationYears] = useState<number>(0);
    const [cultivationLog, setCultivationLog] = useState<string[]>([]);
    const [isPreparingTribulation, setIsPreparingTribulation] = useState(false);
    const [isExiting, setIsExiting] = useState(false);
    const [tribulationCountdown, setTribulationCountdown] = useState(3);
    
    // Track total accumulated duration for the exit summary
    const [totalAccumulatedDuration, setTotalAccumulatedDuration] = useState({ days: 0, months: 0, years: 0 });

    const logEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [cultivationLog]);

    useEffect(() => {
        if (knowledgeBase.pendingCombat || knowledgeBase.playerStats?.isInCombat) {
            setKnowledgeBase(prev => ({
                ...prev,
                pendingCombat: null,
                postCombatState: null,
                playerStats: {
                    ...prev.playerStats,
                    isInCombat: false
                }
            }));
        }
    }, [knowledgeBase.pendingCombat, knowledgeBase.playerStats?.isInCombat, setKnowledgeBase]);

    const { playerStats, worldConfig } = knowledgeBase;
    const system = useRealmSystem();
    const safety = checkLocationSafety(knowledgeBase);
    const { majorIndex: realmIndex } = parseRealm(playerStats.realm, system);
    
    const COST_BASE = 5;
    const EXP_BASE = 5;

    const costMultiplier = Math.pow(1.2, realmIndex);
    const expMultiplier = Math.pow(0.8, realmIndex);

    const costPerDay = Math.floor(COST_BASE * costMultiplier);
    const expPerDay = Math.floor(EXP_BASE * expMultiplier);

    const totalDaysToCultivate = durationDays + (durationMonths * 30) + (durationYears * 360);
    const totalCost = totalDaysToCultivate * costPerDay;
    const totalExpGain = totalDaysToCultivate * expPerDay;

    const handleStart = async () => {
        if (totalDaysToCultivate <= 0) {
            showNotification("Vui lòng chọn thời gian bế quan.", 'warning');
            return;
        }

        try {
            const newLogs = await handleStartCultivation(totalDaysToCultivate);
            setCultivationLog(prev => [...prev, ...newLogs, '-------------------']);
            
            // Accumulate duration
            setTotalAccumulatedDuration(prev => {
                let newDays = prev.days + durationDays;
                let newMonths = prev.months + durationMonths;
                let newYears = prev.years + durationYears;

                if (newDays >= 30) {
                    newMonths += Math.floor(newDays / 30);
                    newDays = newDays % 30;
                }
                if (newMonths >= 12) {
                    newYears += Math.floor(newMonths / 12);
                    newMonths = newMonths % 12;
                }
                return { days: newDays, months: newMonths, years: newYears };
            });

            // Reset inputs after successful start
            setDurationDays(0);
            setDurationMonths(0);
            setDurationYears(0);

        } catch (error) {
            // Error is handled in the hook, just prevent further action here if needed
        }
    };

    const handleTribulation = () => {
        setIsPreparingTribulation(true);
        let count = 3;
        const interval = setInterval(() => {
            count--;
            setTribulationCountdown(count);
            if (count === 0) {
                clearInterval(interval);
                handleStartBreakthroughCombat();
            }
        }, 1000);
    };

    const handleExitBtnClick = async () => {
        if (isExiting) return;
        setIsExiting(true);
        try {
            await handleExitCultivation(totalAccumulatedDuration);
        } catch (error) {
            setIsExiting(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-gray-900 text-gray-100 p-4 font-sans">
            <div className="flex justify-between items-center mb-6 border-b border-gray-700 pb-2">
                <h2 className="text-2xl font-bold text-blue-400">Động Phủ Bế Quan</h2>
                <button
                    onClick={handleExitBtnClick}
                    disabled={isExiting}
                    className={`px-4 py-2 rounded transition-colors ${isExiting ? 'bg-gray-600 text-gray-400 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700 text-white'}`}
                >
                    {isExiting ? 'Đang Xuất Quan...' : `Xuất Quan (${totalAccumulatedDuration.years > 0 ? `${totalAccumulatedDuration.years} năm ` : ''}${totalAccumulatedDuration.months > 0 ? `${totalAccumulatedDuration.months} tháng ` : ''}${totalAccumulatedDuration.days} ngày)`}
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-grow overflow-hidden">
                {/* Left Column: Stats & Settings */}
                <div className="md:col-span-1 flex flex-col gap-4 overflow-y-auto pr-2 custom-scrollbar">
                    <div className="bg-gray-800 p-4 rounded-lg shadow-md border border-gray-700">
                        <h3 className="text-lg font-semibold text-yellow-400 mb-2 border-b border-gray-600 pb-1">Trạng Thái Hiện Tại</h3>
                        <div className="space-y-2 text-sm">
                            <p><span className="text-gray-400">Cảnh giới:</span> <span className="font-bold text-purple-300">{playerStats.realm}</span></p>
                            <p><span className="text-gray-400">Kinh nghiệm:</span> {playerStats.kinhNghiem.toLocaleString()} / {playerStats.maxKinhNghiem.toLocaleString()}</p>
                            <div className="w-full bg-gray-700 rounded-full h-2.5 mt-1">
                                <div className="bg-blue-500 h-2.5 rounded-full" style={{ width: `${playerStats.maxKinhNghiem > 0 ? Math.min(100, (playerStats.kinhNghiem / playerStats.maxKinhNghiem) * 100) : 0}%` }}></div>
                            </div>
                            <p><span className="text-gray-400">Tài sản:</span> <span className="text-yellow-300">{playerStats.currency.toLocaleString()} {worldConfig?.currencyName || 'Linh Thạch'}</span></p>
                            <div className={`mt-3 p-2 rounded border text-xs ${safety.isSafe ? 'bg-green-900/30 border-green-700 text-green-300' : 'bg-red-900/30 border-red-700 text-red-300'}`}>
                                <span className="font-bold">Vị trí:</span> {knowledgeBase.discoveredLocations?.find(l => l.id === knowledgeBase.currentLocationId)?.name || 'Không xác định'}
                                <br />
                                <span className="font-bold">Trạng thái:</span> {safety.isSafe ? 'An toàn' : 'Nguy hiểm'}
                            </div>
                        </div>
                    </div>

                    <div className="bg-gray-800 p-4 rounded-lg shadow-md border border-gray-700">
                        <h3 className="text-lg font-semibold text-green-400 mb-2 border-b border-gray-600 pb-1">Thiết Lập Bế Quan</h3>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Thời gian dự kiến:</label>
                                <div className="flex gap-2">
                                    <div className="flex-1">
                                        <input type="number" min="0" value={durationYears} onChange={e => setDurationYears(Number(e.target.value))} className="w-full bg-gray-700 text-white p-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none" />
                                        <span className="text-xs text-gray-500 block text-center mt-1">Năm</span>
                                    </div>
                                    <div className="flex-1">
                                        <input type="number" min="0" max="11" value={durationMonths} onChange={e => setDurationMonths(Number(e.target.value))} className="w-full bg-gray-700 text-white p-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none" />
                                        <span className="text-xs text-gray-500 block text-center mt-1">Tháng</span>
                                    </div>
                                    <div className="flex-1">
                                        <input type="number" min="0" max="29" value={durationDays} onChange={e => setDurationDays(Number(e.target.value))} className="w-full bg-gray-700 text-white p-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none" />
                                        <span className="text-xs text-gray-500 block text-center mt-1">Ngày</span>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-gray-900 p-3 rounded border border-gray-700 text-sm">
                                <p className="mb-1"><span className="text-gray-400">Tốc độ tiêu hao:</span> {costPerDay.toLocaleString()} {worldConfig?.currencyName}/ngày</p>
                                <p className="mb-2"><span className="text-gray-400">Tốc độ thu nạp:</span> {expPerDay.toLocaleString()} EXP/ngày</p>
                                <div className="border-t border-gray-700 pt-2 mt-2">
                                    <p className="text-red-400">Tổng chi phí: {totalCost.toLocaleString()} {worldConfig?.currencyName}</p>
                                    <p className="text-green-400">Tổng thu hoạch: {totalExpGain.toLocaleString()} EXP</p>
                                </div>
                            </div>

                            {playerStats.hieuUngBinhCanh ? (
                                <div className="bg-red-900/50 border border-red-500 p-3 rounded text-center">
                                    <p className="text-red-200 font-bold mb-2">Đã đạt bình cảnh!</p>
                                    <p className="text-sm text-red-300 mb-3">Tu luyện thông thường không thể tăng thêm tu vi. Cần độ kiếp để đột phá.</p>
                                    <button 
                                        onClick={handleTribulation}
                                        disabled={isPreparingTribulation}
                                        className={`w-full py-2 rounded font-bold transition-colors ${isPreparingTribulation ? 'bg-gray-600 text-gray-400 cursor-not-allowed' : 'bg-red-600 hover:bg-red-500 text-white shadow-[0_0_10px_rgba(220,38,38,0.5)]'}`}
                                    >
                                        {isPreparingTribulation ? `Chuẩn bị độ kiếp... (${tribulationCountdown}s)` : 'Bắt Đầu Độ Kiếp'}
                                    </button>
                                </div>
                            ) : (
                                <button 
                                    onClick={handleStart}
                                    disabled={totalDaysToCultivate <= 0 || playerStats.currency < totalCost}
                                    className={`w-full py-3 rounded font-bold text-lg transition-colors ${
                                        totalDaysToCultivate <= 0 || playerStats.currency < totalCost 
                                        ? 'bg-gray-700 text-gray-500 cursor-not-allowed' 
                                        : 'bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)]'
                                    }`}
                                >
                                    Bắt Đầu Bế Quan
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Column: Log */}
                <div className="md:col-span-2 bg-black rounded-lg border border-gray-700 flex flex-col overflow-hidden font-mono text-sm">
                    <div className="bg-gray-800 px-4 py-2 border-b border-gray-700 flex justify-between items-center">
                        <span className="text-gray-300 font-semibold">Nhật Ký Tu Luyện</span>
                        <span className="text-xs text-gray-500">Hệ thống cơ học</span>
                    </div>
                    <div className="flex-grow p-4 overflow-y-auto custom-scrollbar space-y-2">
                        {cultivationLog.length === 0 ? (
                            <div className="h-full flex items-center justify-center text-gray-600 italic">
                                Chưa có ghi chép tu luyện nào trong lần bế quan này.
                            </div>
                        ) : (
                            cultivationLog.map((log, index) => {
                                let colorClass = "text-gray-300";
                                if (log.includes("Tiêu hao")) colorClass = "text-red-400";
                                if (log.includes("Thu được")) colorClass = "text-green-400";
                                if (log.includes("ĐỘT PHÁ")) colorClass = "text-yellow-300 font-bold";
                                if (log.includes("BÌNH CẢNH")) colorClass = "text-orange-400 font-bold";
                                if (log === '-------------------') colorClass = "text-gray-600";

                                return (
                                    <div key={index} className={`${colorClass} leading-relaxed`}>
                                        {log !== '-------------------' && <span className="text-gray-600 mr-2">{'>'}</span>}
                                        {log}
                                    </div>
                                );
                            })
                        )}
                        <div ref={logEndRef} />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CultivationScreen;
