import React, { useState, useRef, useEffect } from 'react';
import { KnowledgeBase, NPC, PlayerStats, Item, Skill, StatusEffect, CombatDispositionMap, CombatDisposition, YeuThu, CombatEndPayload } from '../types';
import { VIETNAMESE } from '../constants';
import Button from './ui/Button';
import Spinner from './ui/Spinner';
import OpponentStatsPanel from './gameplay/OpponentStatsPanel';
import Modal from './ui/Modal';
import { useClassicCombat } from '../hooks/useClassicCombat';
import { CombatEntityListPanel } from './gameplay/CombatEntityListPanel';
import { CombatDebugModal } from './gameplay/CombatDebugModal';
import { parseCombatMessage } from '../src/utils/combatMessageParser';
import { judgeCombatOutcome } from '../services/ai/combatOutcomeJudgeService';
import { PostCombatDecisionModal } from './gameplay/PostCombatDecisionModal';
import { CombatDefeatDecisionModal } from './gameplay/CombatDefeatDecisionModal';
import { useGame } from '../hooks/useGame';

// --- SUB-COMPONENTS ---
const PlayerCombatPanel: React.FC<{
    player: PlayerStats | undefined;
    playerName: string;
    companions: NPC[];
    opponents: any[];
    combatants: any[];
    kb: KnowledgeBase;
    onStatusEffectClick: (effect: StatusEffect) => void;
    onSkillClick: (skill: Skill) => void;
    onItemClick: (item: Item) => void;
    onPlayerNameClick?: (name: string) => void;
    onRequestFormationChange?: (actionText: string) => void;
}> = ({ player, playerName, companions, opponents, combatants, kb, onStatusEffectClick, onSkillClick, onItemClick, onPlayerNameClick, onRequestFormationChange }) => {
    const [activeTab, setActiveTab] = useState<'stats' | 'skills' | 'items' | 'allies'>('stats');

    if (!player) {
        return (
            <div className="p-3 bg-gray-800 rounded-lg flex-grow flex flex-col">
                <h4 className="font-semibold text-green-400 border-b border-gray-600 pb-1 mb-2">{VIETNAMESE.playerPanelTitle}</h4>
                <p className="text-gray-400 italic">Lỗi tải dữ liệu người chơi.</p>
            </div>
        );
    }

    const getStatusEffectTypeColor = (type: StatusEffect['type']) => {
        switch (type) {
            case 'buff': return 'text-green-300 border-green-500';
            case 'debuff': return 'text-red-300 border-red-500';
            case 'neutral': return 'text-gray-300 border-gray-500';
            default: return 'text-gray-200 border-gray-500';
        }
    };

    return (
        <div className="p-3 bg-gray-800/90 rounded-lg flex-grow flex flex-col border border-gray-700/80 shadow-md">
            <h4 className="font-semibold text-green-400 border-b border-gray-600 pb-1 mb-2 flex justify-between items-center select-none">
                <span 
                    onClick={() => onPlayerNameClick && onPlayerNameClick(playerName)}
                    className="cursor-pointer hover:text-green-300 hover:underline decoration-dotted decoration-green-400"
                    title="Bấm để copy tên nhân vật"
                >
                    {playerName} (Phe Ta)
                </span>
                {combatants.length > 0 && (
                    <span className="text-[10px] bg-indigo-900/80 text-indigo-200 px-2 py-0.5 rounded-full border border-indigo-500/40">
                        [đồng minh ({combatants.filter(c => c.faction === 'ally').length}), kẻ địch ({combatants.filter(c => c.faction === 'enemy').length}), trung lập ({combatants.filter(c => c.faction === 'neutral').length})]
                    </span>
                )}
            </h4>

            <div className="flex border-b border-gray-700 mb-2 gap-1 overflow-x-auto text-xs">
                <button onClick={() => setActiveTab('stats')} className={`flex-1 py-1 px-1 min-w-[50px] text-center ${activeTab === 'stats' ? 'text-green-300 border-b-2 border-green-400 font-bold' : 'text-gray-400 hover:text-gray-200'}`}>
                    Chỉ số
                </button>
                <button onClick={() => setActiveTab('skills')} className={`flex-1 py-1 px-1 min-w-[50px] text-center ${activeTab === 'skills' ? 'text-green-300 border-b-2 border-green-400 font-bold' : 'text-gray-400 hover:text-gray-200'}`}>
                    Kỹ Năng
                </button>
                <button onClick={() => setActiveTab('items')} className={`flex-1 py-1 px-1 min-w-[50px] text-center ${activeTab === 'items' ? 'text-green-300 border-b-2 border-green-400 font-bold' : 'text-gray-400 hover:text-gray-200'}`}>
                    Vật Phẩm
                </button>
                {combatants.length > 0 && (
                    <button onClick={() => setActiveTab('allies')} className={`flex-1 py-1 px-1 min-w-[50px] text-center ${activeTab === 'allies' ? 'text-green-300 border-b-2 border-green-400 font-bold' : 'text-gray-400 hover:text-gray-200'}`}>
                        Danh sách ⚔️
                    </button>
                )}
            </div>

            <div className="flex-grow overflow-y-auto custom-scrollbar text-xs max-h-36 pr-1">
                {activeTab === 'stats' && (
                    <div className="space-y-1">
                        <p><strong>Cảnh giới:</strong> <span className="text-amber-300 font-medium">{player.canhGioi}</span></p>
                        <p><strong>HP:</strong> <span className="text-red-400">{player.sinhLuc} / {player.maxSinhLuc ?? player.sinhLucToiDa}</span></p>
                        <p><strong>MP:</strong> <span className="text-blue-400">{player.linhLuc} / {player.maxLinhLuc ?? player.linhLucToiDa}</span></p>
                        <p><strong>Sức Tấn Công:</strong> <span className="text-yellow-400">{(player.sucTanCong || 0) * 4}</span></p>
                        {player.activeStatusEffects && player.activeStatusEffects.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-gray-700/50">
                                <h5 className="font-semibold mb-1">Hiệu ứng:</h5>
                                <ul className="space-y-1">
                                    {player.activeStatusEffects.map(effect => (
                                        <li key={effect.id} onClick={() => onStatusEffectClick(effect)} className={`p-1 text-xs rounded border cursor-pointer ${getStatusEffectTypeColor(effect.type)}`}>
                                            {effect.name} ({effect.durationTurns > 0 ? `${effect.durationTurns} lượt` : 'Vĩnh viễn'})
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                )}
                {activeTab === 'skills' && (
                    (kb?.playerSkills || []).length > 0 ? (
                        <ul className="space-y-1">
                            {(kb?.playerSkills || []).map(s => (
                                <li key={s.id} onClick={() => onSkillClick(s)} className="p-1.5 bg-gray-700/60 rounded hover:bg-gray-700 cursor-pointer border border-gray-600/50 flex justify-between items-center" title={s.name}>
                                    <span className="font-medium text-amber-200">{s.name}</span>
                                    <span className="text-[10px] text-blue-300">-{s.costMp || 0} MP</span>
                                </li>
                            ))}
                        </ul>
                    ) : <p className="text-gray-400 italic">{VIETNAMESE.noSkillsAvailable}</p>
                )}
                {activeTab === 'items' && (
                    (kb?.inventory || []).filter(i => i.category === 'Potion').length > 0 ? (
                        <ul className="space-y-1">
                            {(kb?.inventory || []).filter(i => i.category === 'Potion').map(i => (
                                <li key={i.id} onClick={() => onItemClick(i)} className="p-1.5 bg-gray-700/60 rounded hover:bg-gray-700 cursor-pointer border border-gray-600/50 flex justify-between items-center" title={`${i.name} (x${i.quantity})`}>
                                    <span className="text-emerald-200">{i.name}</span>
                                    <span className="text-xs font-bold text-gray-300">x{i.quantity}</span>
                                </li>
                            ))}
                        </ul>
                    ) : <p className="text-gray-400 italic">{VIETNAMESE.noItemsAvailable}</p>
                )}
                {activeTab === 'allies' && (
                    <CombatEntityListPanel
                        combatants={combatants}
                        activeCompanions={companions}
                        opponents={opponents}
                        onPlayerNameClick={onPlayerNameClick}
                        onRequestFormationChange={onRequestFormationChange}
                    />
                )}
            </div>
        </div>
    );
};

const CombatLog: React.FC<{
    messages: { id: string; text: string; type: string; timestamp: number }[];
    isStreaming: boolean;
    currentStreamText: string;
    onLogClick: () => void;
    isReaderMode: boolean;
}> = ({ messages, isStreaming, currentStreamText, onLogClick, isReaderMode }) => {
    const logEndRef = useRef<HTMLDivElement>(null);
    const [showThinking, setShowThinking] = useState(false);

    // useEffect(() => {
    //     logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    // }, [messages, currentStreamText]);

    return (
        <div
            className={`bg-gray-900/90 rounded-lg shadow-inner p-4 flex-grow overflow-y-auto custom-scrollbar h-full transition-all duration-300 border border-gray-800 ${
                isReaderMode ? 'absolute inset-0 z-10 bg-gray-950 p-6' : ''
            }`}
            onClick={onLogClick}
        >
            <div className="flex justify-between items-center mb-3 border-b border-gray-800 pb-2">
                <div className="w-24"></div>
                <h3 className="text-lg font-bold text-center text-amber-400/90 flex-grow">
                    NHẬT KÝ CHIẾN ĐẤU & HỘI THOẠI (NEON ROLEPLAY)
                </h3>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        setShowThinking(!showThinking);
                    }}
                    className="text-[11px] bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/30 text-emerald-300 px-2.5 py-1 rounded select-none shrink-0"
                >
                    {showThinking ? 'Ẩn Suy Nghĩ 👁️' : 'Hiện Suy Nghĩ 👁️‍🗨️'}
                </button>
            </div>
            <div className="space-y-3 text-sm leading-relaxed">
                {messages.map((msg) => {
                    if (msg.type === 'player_action') {
                        return (
                            <div key={msg.id} className="bg-indigo-950/40 p-2.5 rounded-lg border border-indigo-500/30 text-indigo-200">
                                <span className="font-bold text-indigo-400">👤 Hành Động / Thoại:</span> {msg.text}
                            </div>
                        );
                    }
                    if (msg.type === 'system') {
                        return (
                            <div key={msg.id} className="text-xs text-amber-300/80 italic text-center py-1 bg-amber-950/20 rounded border border-amber-800/30">
                                📜 {msg.text}
                            </div>
                        );
                    }

                    const { thinking, content, statNotice, choicesText, combatDataRaw } = parseCombatMessage(msg.text);

                    if (!thinking && !content && !statNotice && !choicesText && !combatDataRaw) return null;

                    return (
                        <div key={msg.id} className="space-y-2">
                            {thinking && showThinking && (
                                <div className="border border-emerald-500/30 bg-emerald-950/10 rounded-lg p-3">
                                    <div className="flex items-center gap-1.5 mb-1.5 text-[10px] font-mono text-emerald-400 font-bold uppercase tracking-wider">
                                        <span>&lt;thinking&gt;</span>
                                    </div>
                                    <div className="text-xs text-gray-300 font-mono pl-1 whitespace-pre-wrap select-text leading-relaxed">
                                        {thinking}
                                    </div>
                                    <div className="mt-1.5 text-[10px] font-mono text-emerald-500/50 font-semibold">
                                        &lt;/thinking&gt;
                                    </div>
                                </div>
                            )}
                            {content && (
                                <div className="border border-indigo-500/30 bg-indigo-950/20 rounded-lg p-3 text-gray-200">
                                    <div className="flex items-center gap-1.5 mb-1.5 text-[10px] font-mono text-indigo-400 font-bold uppercase tracking-wider">
                                        <span>&lt;noi_dung&gt;</span>
                                    </div>
                                    <div className="text-sm pl-1 whitespace-pre-wrap leading-relaxed">
                                        {content}
                                    </div>
                                    <div className="mt-1.5 text-[10px] font-mono text-indigo-500/50 font-semibold">
                                        &lt;/noi_dung&gt;
                                    </div>
                                </div>
                            )}
                            {statNotice && (
                                <div className="border border-amber-500/40 bg-amber-950/30 rounded-lg p-3 text-amber-200 shadow-md">
                                    <div className="flex items-center gap-1.5 mb-1.5 text-[11px] font-mono text-amber-400 font-bold uppercase tracking-wider">
                                        <span>⚡ BÁO CÁO TÁC ĐỘNG CHỈ SỐ:</span>
                                    </div>
                                    <div className="text-xs font-mono pl-1 whitespace-pre-wrap leading-relaxed font-semibold text-amber-100">
                                        {statNotice}
                                    </div>
                                </div>
                            )}
                            {choicesText && (
                                <div className="border border-purple-500/40 bg-purple-950/20 rounded-lg p-3 text-purple-200">
                                    <div className="flex items-center gap-1.5 mb-1.5 text-[10px] font-mono text-purple-400 font-bold uppercase tracking-wider">
                                        <span>🎮 LỰA CHỌN PHẢN ỨNG MỚI NHẤT &lt;choice&gt;:</span>
                                    </div>
                                    <div className="text-xs font-mono pl-1 whitespace-pre-wrap leading-relaxed">
                                        {choicesText}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}

                {isStreaming && (() => {
                    const { thinking, content, statNotice, choicesText, combatDataRaw } = parseCombatMessage(currentStreamText);
                    return (
                        <div className="space-y-2 animate-pulse">
                            {thinking && showThinking && (
                                <div className="border border-emerald-500/40 bg-emerald-950/20 rounded-lg p-3">
                                    <div className="flex items-center gap-1.5 mb-1.5 text-[10px] font-mono text-emerald-400 font-bold uppercase tracking-wider">
                                        <span>&lt;thinking&gt;</span>
                                    </div>
                                    <div className="text-xs text-emerald-200/90 font-mono pl-1 whitespace-pre-wrap leading-relaxed">
                                        {thinking}
                                    </div>
                                    <span className="inline-block w-2.5 h-2.5 bg-emerald-400 ml-1 rounded-full animate-ping" />
                                </div>
                            )}
                            {content && (
                                <div className="border border-cyan-500/40 bg-indigo-900/20 rounded-lg p-3 text-cyan-200">
                                    <div className="flex items-center gap-1.5 mb-1.5 text-[10px] font-mono text-cyan-400 font-bold uppercase tracking-wider">
                                        <span>&lt;noi_dung&gt;</span>
                                    </div>
                                    <div className="text-sm pl-1 whitespace-pre-wrap leading-relaxed">
                                        {content}
                                    </div>
                                    <span className="inline-block w-2.5 h-2.5 bg-cyan-400 ml-1 rounded-full animate-ping" />
                                </div>
                            )}
                            {statNotice && (
                                <div className="border border-amber-500/40 bg-amber-950/30 rounded-lg p-3 text-amber-200 shadow-md">
                                    <div className="flex items-center gap-1.5 mb-1.5 text-[11px] font-mono text-amber-400 font-bold uppercase tracking-wider">
                                        <span>⚡ BÁO CÁO TÁC ĐỘNG CHỈ SỐ:</span>
                                    </div>
                                    <div className="text-xs font-mono pl-1 whitespace-pre-wrap leading-relaxed font-semibold text-amber-100">
                                        {statNotice}
                                    </div>
                                </div>
                            )}
                            {choicesText && (
                                <div className="border border-purple-500/40 bg-purple-950/20 rounded-lg p-3 text-purple-200">
                                    <div className="flex items-center gap-1.5 mb-1.5 text-[10px] font-mono text-purple-400 font-bold uppercase tracking-wider">
                                        <span>🎮 LỰA CHỌN PHẢN ỨNG MỚI NHẤT &lt;choice&gt;:</span>
                                    </div>
                                    <div className="text-xs font-mono pl-1 whitespace-pre-wrap leading-relaxed">
                                        {choicesText}
                                    </div>
                                </div>
                            )}
                            {!thinking && !content && !statNotice && !choicesText && !combatDataRaw && (
                                <div className="bg-indigo-900/20 p-3 rounded-lg border border-cyan-500/40 text-cyan-200 whitespace-pre-wrap">
                                    <Spinner text="AI đang suy nghĩ phản ứng & diễn biến..." />
                                    <span className="inline-block w-2 h-4 bg-cyan-400 ml-1 animate-ping" />
                                </div>
                            )}
                        </div>
                    );
                })()}
            </div>
            <div ref={logEndRef} />
        </div>
    );
};

const CombatInput: React.FC<{
    onAction: (action: string) => void;
    isLoading: boolean;
    choices?: string[];
    inputValue: string;
    onInputChange: (val: string) => void;
}> = ({ onAction, isLoading, choices = [], inputValue, onInputChange }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    const defaultSuggestions = [
        'Dùng mọi sức mạnh lớn nhất để tấn công phủ đầu đối thủ',
        'Vận chuyển công pháp phòng thủ tối đa, sẵn sàng đón đỡ sát thương',
        'Sử dụng kỹ năng sở trường để khắc chế sơ hở của kẻ địch',
        'Thay đổi đội hình, cho thành viên dự bị sung sức lên thay thế',
        'Cất tiếng thương lượng, đề xuất ngừng chiến và đàm phán ôn hòa',
        'Nhanh chân rút lui phối hợp bọc lót bảo toàn sinh lực'
    ];

    const displayChoices = choices && choices.length > 0 ? choices : defaultSuggestions;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (inputValue.trim() && !isLoading) {
            onAction(inputValue.trim());
            onInputChange('');
        }
    };

    const handleExpand = () => {
        setIsExpanded(true);
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
            setIsExpanded(false);
        }, 8000); // Tăng thời gian hiển thị lên 8s để người chơi dễ đọc 6 gợi ý
    };

    useEffect(() => {
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, []);

    return (
        <div 
            onClick={handleExpand}
            className="bg-gray-800/90 p-3 rounded-lg space-y-2 flex flex-col border border-gray-700 shadow-md transition-all duration-300"
        >
            <div className="flex justify-between items-center border-b border-gray-700 pb-1 flex-shrink-0 select-none">
                <h4 className="font-semibold text-xs text-indigo-300 flex items-center gap-1">
                    🎯 GỢI Ý HÀNH ĐỘNG DÀNH CHO BẠN ({displayChoices.length} LỰA CHỌN CHIẾN THUẬT)
                </h4>
                <span className="text-[10px] text-gray-400">
                    {isExpanded ? 'Bấm gợi ý để copy vào ô nhập' : '👉 Bấm vào đây để mở rộng gợi ý'}
                </span>
            </div>

            <div className={`grid grid-cols-1 sm:grid-cols-2 gap-1.5 overflow-y-auto custom-scrollbar flex-shrink-0 p-0.5 transition-all duration-300 ${isExpanded ? 'max-h-72' : 'max-h-[82px] overflow-hidden'}`}>
                {displayChoices.map((text, idx) => (
                    <button
                        key={idx}
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation(); // Ngăn click nổi lên làm reset timer
                            onInputChange(text);
                            handleExpand();
                        }}
                        disabled={isLoading}
                        className="text-[11px] p-2 bg-gray-900/80 hover:bg-indigo-900/50 hover:border-cyan-500/60 border border-gray-700 rounded-md text-left text-cyan-200 transition-all font-sans leading-snug shadow-sm active:scale-[0.98]"
                    >
                        <span className="text-amber-400 font-mono font-bold mr-1">[{idx + 1}]</span>
                        ⚡ {text}
                    </button>
                ))}
            </div>

            <form onSubmit={handleSubmit} className="flex-shrink-0 flex items-center gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
                <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => onInputChange(e.target.value)}
                    placeholder="Vừa gõ vừa nói, ví dụ: 'Rút kiếm chỉ thẳng: Ngươi muốn chết sao?'..."
                    disabled={isLoading}
                    className="flex-grow p-2 text-xs bg-gray-900 border border-gray-700 rounded-md focus:outline-none focus:border-indigo-500 text-white"
                />
                <Button type="submit" disabled={isLoading || !inputValue.trim()} size="sm" variant="primary">
                    {isLoading ? 'Đang gửi...' : 'Gửi ⚡'}
                </Button>
            </form>
        </div>
    );
};

// --- MAIN COMBAT SCREEN COMPONENT ---
interface CombatScreenProps {
    knowledgeBase: KnowledgeBase;
    onCombatEnd: (result: CombatEndPayload) => Promise<void>;
    onClassicCombatEnd: (result: CombatEndPayload, last4Logs: string[]) => Promise<void>;
    currentPageMessagesLog?: any;
    previousPageSummaries?: string[];
    lastNarrationFromPreviousPage?: string;
}

const CombatScreen: React.FC<CombatScreenProps> = ({
    knowledgeBase,
    onCombatEnd,
    onClassicCombatEnd,
    currentPageMessagesLog,
    previousPageSummaries,
    lastNarrationFromPreviousPage,
}) => {
    const {
        combatMessages,
        isStreaming,
        currentStreamText,
        opponents,
        activeCompanions,
        isEnded,
        choices,
        sendAction,
        combatants,
        lastRawPrompt,
        lastRawResponse
    } = useClassicCombat({
        knowledgeBase,
        onCombatEnd,
        currentPageMessagesLog,
        previousPageSummaries,
        lastNarrationFromPreviousPage
    });

    const [isReaderMode, setIsReaderMode] = useState(false);
    const { setKnowledgeBase } = useGame();

    // Tự động tắt bỏ pendingCombat và trạng thái chiến đấu một cách cơ học khi thoát khỏi CombatScreenold
    useEffect(() => {
        return () => {
            setKnowledgeBase(prev => {
                if (prev?.pendingCombat || prev?.postCombatState || prev?.playerStats?.isInCombat) {
                    return {
                        ...prev,
                        pendingCombat: null,
                        postCombatState: null,
                        playerStats: {
                            ...prev.playerStats,
                            isInCombat: false
                        }
                    };
                }
                return prev;
            });
        };
    }, [setKnowledgeBase]);

    const [selectedStatusEffect, setSelectedStatusEffect] = useState<StatusEffect | null>(null);
    const [selectedSkillForDetail, setSelectedSkillForDetail] = useState<Skill | null>(null);
    const [selectedItemForDetail, setSelectedItemForDetail] = useState<Item | null>(null);
    const isPlayerDefeated = (knowledgeBase.playerStats.sinhLuc ?? 0) <= 0;
    const [isVictoryModalOpen, setIsVictoryModalOpen] = useState(false);
    const [isDefeatModalOpen, setIsDefeatModalOpen] = useState(false);
    const [isOutcomeModalMinimized, setIsOutcomeModalMinimized] = useState(false);
    const [isProcessingEnd, setIsProcessingEnd] = useState(false);
    const [actionInput, setActionInput] = useState('');
    const [debugModalType, setDebugModalType] = useState<'none' | 'prompt' | 'response'>('none');

    const playerName = knowledgeBase.worldConfig?.playerName || 'Người Chơi';

    // Xác định phe kẻ địch từ danh sách combatants (không tính các NPC đã đổi sang phe ta - faction === 'ally')
    const enemyNpcs = combatants.filter(c => c.faction === 'enemy' || c.faction === 'neutral');
    const allEnemiesDefeated = enemyNpcs.length === 0 || enemyNpcs.every(c => (c.stats?.sinhLuc ?? 0) <= 0);
    const canShowFinishButton = isEnded || allEnemiesDefeated || isPlayerDefeated;

    useEffect(() => {
        if (isProcessingEnd) return;

        if (isPlayerDefeated && !isDefeatModalOpen) {
            // Player hết HP -> Mở Modal Chiến Bại
            setIsDefeatModalOpen(true);
        } else if (allEnemiesDefeated && !isPlayerDefeated && !isVictoryModalOpen) {
            // Địch chết hết và Player còn sống -> Mở Modal Chiến Thắng
            setIsVictoryModalOpen(true);
        }
    }, [allEnemiesDefeated, isPlayerDefeated, isProcessingEnd, isDefeatModalOpen, isVictoryModalOpen]);

    const handleUseSkill = (skill: Skill) => {
        setActionInput(`thi triển kĩ năng ${skill.name}`);
    };

    const handleUseItem = (item: Item) => {
        setActionInput(`thi triển kĩ năng ${item.name}`);
    };

    const handleCharacterNameClick = (name: string) => {
        setActionInput(prev => {
            const trimmed = prev.trim();
            if (!trimmed) return name;
            if (trimmed.includes(name)) return prev;
            return `${trimmed} ${name}`;
        });
    };

    const handleEndCombat = async (
        actualOutcome: 'victory' | 'defeat' | 'flee' | 'draw', 
        dispositions: CombatDispositionMap = {}
    ) => {
        setIsProcessingEnd(true);
        
        const finalOpponentsStatus = combatants
            .filter(c => c.faction === 'enemy' || c.faction === 'neutral')
            .map(c => ({
                id: c.id,
                hp: typeof c.stats?.sinhLuc === 'number' ? c.stats.sinhLuc : 0,
                mp: typeof c.stats?.linhLuc === 'number' ? c.stats.linhLuc : 0
            }));

        const finalAlliesStatus = combatants
            .filter(c => c.faction === 'ally' && c.id !== 'player')
            .map(c => ({
                id: c.id,
                hp: typeof c.stats?.sinhLuc === 'number' ? c.stats.sinhLuc : 0,
                mp: typeof c.stats?.linhLuc === 'number' ? c.stats.linhLuc : 0
            }));

        const playerCombatant = combatants.find(c => c.id === 'player' || c.isPlayer);
        const finalPlayerState = { ...knowledgeBase.playerStats };
        if (playerCombatant && playerCombatant.stats) {
            finalPlayerState.sinhLuc = playerCombatant.stats.sinhLuc;
            finalPlayerState.linhLuc = playerCombatant.stats.linhLuc;
        }
        
        const last4Logs = combatMessages.slice(-4).map(m => m.text);

        await onClassicCombatEnd({
            outcome: actualOutcome,
            summary: combatMessages.map(m => m.text).join('\n'),
            finalPlayerState,
            dispositions,
            opponentIds: opponents.map(o => o.id),
            finalOpponentsStatus,
            finalAlliesStatus
        }, last4Logs);
        setIsProcessingEnd(false);
    };

    const handleFinishButtonClick = async () => {
        if (isPlayerDefeated) {
            setIsDefeatModalOpen(true);
        } else if (allEnemiesDefeated) {
            setIsVictoryModalOpen(true);
        } else {
            setIsProcessingEnd(true);
            try {
                const logs = combatMessages.map(m => m.text);
                const result = await judgeCombatOutcome(logs, combatants, playerName);
                if (result.outcome === 'victory') {
                    setIsVictoryModalOpen(true);
                } else if (result.outcome === 'defeat') {
                    setIsDefeatModalOpen(true);
                } else {
                    await handleEndCombat(result.outcome, {});
                }
            } catch (err) {
                console.error("Lỗi khi phán quyết kết quả:", err);
                setIsVictoryModalOpen(true);
            } finally {
                setIsProcessingEnd(false);
            }
        }
    };

    return (
        <>
            <div className="h-screen w-screen bg-gray-950 flex flex-col p-2 sm:p-4 text-gray-100 font-sans">
                <header className="mb-2 flex justify-between items-center flex-shrink-0 border-b border-gray-800 pb-2">
                    <h1 className="text-xl sm:text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-indigo-400 to-purple-400">
                        ⚡ GIAO DIỆN CHIẾN ĐẤU NEON CLASSIC
                    </h1>
                    <div className="flex items-center gap-2">
                        {canShowFinishButton && (
                            <Button variant="danger" onClick={handleFinishButtonClick} isLoading={isProcessingEnd} loadingText="Đang kết thúc...">
                                Kết Thúc Trận Đấu
                            </Button>
                        )}
                    </div>
                </header>

                <div className="flex flex-col gap-3 flex-grow overflow-hidden relative">
                    {/* BẢNG ĐỐI THỦ & THỰC THỂ */}
                    <div className="flex-shrink-0">
                        <OpponentStatsPanel 
                            opponents={opponents} 
                            companions={activeCompanions} 
                            onCharacterClick={handleCharacterNameClick}
                            onShowPrompt={() => setDebugModalType('prompt')}
                            onShowResponse={() => setDebugModalType('response')}
                        />
                    </div>

                    {/* NHẬT KÝ CHIẾN ĐẤU */}
                    <div className="flex-grow min-h-0 relative">
                        <CombatLog
                            messages={combatMessages}
                            isStreaming={isStreaming}
                            currentStreamText={currentStreamText}
                            onLogClick={() => setIsReaderMode(p => !p)}
                            isReaderMode={isReaderMode}
                        />
                    </div>

                    {/* BẢNG ĐIỀU KHIỂN & NHẬP THOẠI */}
                    {!isReaderMode && !isEnded && !isPlayerDefeated && !allEnemiesDefeated && (
                        <div className="flex-shrink-0 grid grid-cols-1 lg:grid-cols-3 gap-3">
                            <div className="lg:col-span-1">
                                <PlayerCombatPanel
                                    player={knowledgeBase.playerStats}
                                    playerName={playerName}
                                    companions={activeCompanions}
                                    opponents={opponents}
                                    combatants={combatants}
                                    kb={knowledgeBase}
                                    onStatusEffectClick={setSelectedStatusEffect}
                                    onSkillClick={(skill) => {
                                        setSelectedSkillForDetail(skill);
                                        handleUseSkill(skill);
                                    }}
                                    onItemClick={(item) => {
                                        setSelectedItemForDetail(item);
                                        handleUseItem(item);
                                    }}
                                    onPlayerNameClick={handleCharacterNameClick}
                                    onRequestFormationChange={(txt) => setActionInput(txt)}
                                />
                            </div>
                            <div className="lg:col-span-2">
                                <CombatInput 
                                    onAction={sendAction} 
                                    isLoading={isStreaming} 
                                    choices={choices} 
                                    inputValue={actionInput}
                                    onInputChange={setActionInput}
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {selectedStatusEffect && (
                <Modal isOpen={!!selectedStatusEffect} onClose={() => setSelectedStatusEffect(null)} title={`Hiệu Ứng: ${selectedStatusEffect.name}`}>
                    <p className="text-sm text-gray-300">{selectedStatusEffect.description}</p>
                </Modal>
            )}
            {selectedSkillForDetail && (
                <Modal isOpen={!!selectedSkillForDetail} onClose={() => setSelectedSkillForDetail(null)} title={`Kỹ Năng: ${selectedSkillForDetail.name}`}>
                    <p className="text-sm text-gray-300">{selectedSkillForDetail.description}</p>
                </Modal>
            )}
            {selectedItemForDetail && (
                <Modal isOpen={!!selectedItemForDetail} onClose={() => setSelectedItemForDetail(null)} title={`Vật Phẩm: ${selectedItemForDetail.name}`}>
                    <p className="text-sm text-gray-300">{selectedItemForDetail.description}</p>
                </Modal>
            )}

            {/* Modal Chiến Thắng */}
            {isVictoryModalOpen && (
                <PostCombatDecisionModal
                    isOpen={isVictoryModalOpen && !isOutcomeModalMinimized}
                    onMinimize={() => setIsOutcomeModalMinimized(true)}
                    defeatedNpcs={enemyNpcs}
                    onConfirm={(dispositions) => {
                        setIsVictoryModalOpen(false);
                        setIsOutcomeModalMinimized(false);
                        handleEndCombat('victory', dispositions);
                    }}
                    isLoading={isProcessingEnd}
                />
            )}

            {/* Modal Chiến Bại */}
            {isDefeatModalOpen && (
                <CombatDefeatDecisionModal
                    isOpen={isDefeatModalOpen && !isOutcomeModalMinimized}
                    onMinimize={() => setIsOutcomeModalMinimized(true)}
                    onSelectAction={(action) => {
                        setIsDefeatModalOpen(false);
                        setIsOutcomeModalMinimized(false);
                        if (action === 'flee') {
                            handleEndCombat('flee');
                        } else {
                            handleEndCombat('defeat', { player: action });
                        }
                    }}
                    isLoading={isProcessingEnd}
                />
            )}

            {/* Thanh hiển thị khi thu nhỏ */}
            {isOutcomeModalMinimized && (isVictoryModalOpen || isDefeatModalOpen) && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-bounce">
                    <button
                        type="button"
                        onClick={() => setIsOutcomeModalMinimized(false)}
                        className="bg-gradient-to-r from-amber-600 to-indigo-600 hover:from-amber-500 hover:to-indigo-500 text-white font-bold px-6 py-3 rounded-full shadow-[0_0_25px_rgba(245,158,11,0.7)] border border-amber-300 flex items-center gap-3 text-sm transition-all duration-300 transform hover:scale-105 active:scale-95"
                    >
                        <span>📋</span>
                        <span>Mở Lại Quyết Định Kết Quả Trận Đấu</span>
                        <span className="bg-black/30 px-2.5 py-0.5 rounded text-xs text-amber-200">Mở 🔼</span>
                    </button>
                </div>
            )}

            <CombatDebugModal
                isOpen={debugModalType !== 'none'}
                title={debugModalType === 'prompt' ? 'NỘI DUNG PROMPT GỬI' : 'NỘI DUNG AI PHẢN HỒI'}
                content={debugModalType === 'prompt' ? lastRawPrompt : lastRawResponse}
                onClose={() => setDebugModalType('none')}
            />
        </>
    );
};

export default CombatScreen;
