
import React, { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { NPC, YeuThu } from '../../types';
import { VIETNAMESE } from '../../constants';
import { safeNumber, formatNumberDot } from '../../utils/combatDataSanitizer';
import { SlashVFX } from './vfx/SlashVFX';

// NEW: Sub-component to handle interaction logic for a single opponent card
const OpponentCard: React.FC<{
    opponent: any;
    isSelected: boolean;
    isShaking: boolean; // Added
    onSelect?: (id: string) => void;
    onShowDetails?: (opponent: any) => void;
    vfxs?: { id: string; targetId: string; type: string }[];
    onCharacterClick?: (name: string) => void;
}> = ({ opponent, isSelected, isShaking, onSelect, onShowDetails, vfxs = [], onCharacterClick }) => {
    if (!opponent.stats) return null;
    
    const sinhLuc = safeNumber(opponent.stats.sinhLuc);
    const maxSinhLuc = safeNumber(opponent.stats.maxSinhLuc, 1);
    const linhLuc = safeNumber(opponent.stats.linhLuc);
    const maxLinhLuc = safeNumber(opponent.stats.maxLinhLuc);
    
    const hpPercent = maxSinhLuc > 0 ? Math.max(0, Math.min(100, (sinhLuc / maxSinhLuc) * 100)) : 0;
    const mpPercent = maxLinhLuc > 0 ? Math.max(0, Math.min(100, (linhLuc / maxLinhLuc) * 100)) : 0;
    
    const speciesOrRace = 'species' in opponent ? opponent.species : ('race' in opponent ? opponent.race : 'Không rõ');
    const faction = opponent.faction || 'enemy';

    // Xác định màu viền theo phe
    let factionBorder = 'border-red-500/70 shadow-[0_0_8px_rgba(239,68,68,0.2)]';
    let factionBadge = <span className="text-[9px] bg-red-950 text-red-300 px-1.5 py-0.5 rounded border border-red-500/40">Địch</span>;
    if (faction === 'ally') {
        factionBorder = 'border-blue-500/70 shadow-[0_0_8px_rgba(59,130,246,0.2)]';
        factionBadge = <span className="text-[9px] bg-blue-950 text-blue-300 px-1.5 py-0.5 rounded border border-blue-500/40">Đồng Minh</span>;
    } else if (faction === 'neutral') {
        factionBorder = 'border-purple-500/70 shadow-[0_0_8px_rgba(168,85,247,0.2)]';
        factionBadge = <span className="text-[9px] bg-purple-950 text-purple-300 px-1.5 py-0.5 rounded border border-purple-500/40">Trung Lập</span>;
    }

    return (
        <div
            id={`combatant-${opponent.id}`}
            className={`w-36 sm:w-52 flex-shrink-0 p-1.5 sm:p-2 bg-gray-900/80 rounded-lg border-2 transition-all duration-300 cursor-pointer
                        ${factionBorder}
                        ${isSelected ? 'ring-2 ring-yellow-400' : 'hover:brightness-110'}
                        ${isShaking ? 'animate-shake' : ''}`}
            onClick={() => {
                if (onSelect) onSelect(opponent.id);
                if (onCharacterClick) onCharacterClick(opponent.name);
            }}
        >
            <AnimatePresence>
                {(vfxs || []).filter(v => v.targetId === opponent.id && v.type === 'slash').map(v => (
                    <SlashVFX key={v.id} />
                ))}
            </AnimatePresence>
            <div className="flex justify-between items-center mb-1">
                {factionBadge}
                <span className="text-[9px] sm:text-xs text-gray-400 truncate">{opponent.realm || speciesOrRace}</span>
            </div>
            <div className="flex justify-between items-baseline mb-1">
                <span className="font-bold text-gray-100 text-xs sm:text-sm truncate" title={opponent.name}>
                    {opponent.name}
                </span>
                <button 
                    onClick={(e) => { e.stopPropagation(); onShowDetails && onShowDetails(opponent); }}
                    className="p-0.5 px-1.5 rounded-full bg-gray-700 hover:bg-gray-600 text-[9px] text-gray-300 transition-colors"
                    title="Xem chi tiết"
                >
                    i
                </button>
            </div>
            <div className="space-y-1 text-[10px] sm:text-xs">
                {/* HP Bar */}
                <div title={`HP: ${formatNumberDot(sinhLuc)} / ${formatNumberDot(maxSinhLuc)}`}>
                    <div className="flex justify-between mb-0.5 text-red-300 text-[9px]">
                        <span>HP</span>
                        <span>{formatNumberDot(sinhLuc)} / {formatNumberDot(maxSinhLuc)}</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-1 sm:h-1.5">
                        <div className="bg-red-600 h-1 sm:h-1.5 rounded-full transition-all duration-300" style={{ width: `${hpPercent}%` }}></div>
                    </div>
                </div>
                {/* MP Bar */}
                {maxLinhLuc > 0 && (
                    <div title={`MP: ${formatNumberDot(linhLuc)} / ${formatNumberDot(maxLinhLuc)}`}>
                        <div className="flex justify-between mb-0.5 text-blue-300 text-[9px]">
                            <span>MP</span>
                            <span>{formatNumberDot(linhLuc)} / {formatNumberDot(maxLinhLuc)}</span>
                        </div>
                        <div className="w-full bg-gray-700 rounded-full h-1 sm:h-1.5">
                            <div className="bg-blue-500 h-1 sm:h-1.5 rounded-full transition-all duration-300" style={{ width: `${mpPercent}%` }}></div>
                        </div>
                    </div>
                )}
                {/* ATK */}
                <div className="pt-0.5 flex justify-between text-[10px]">
                    <span className="text-gray-400">ATK:</span>
                    <span className="text-amber-300 font-mono font-semibold">{formatNumberDot(safeNumber(opponent.stats.sucTanCong))}</span>
                </div>
            </div>
        </div>
    );
};

// Main component
interface OpponentStatsPanelProps {
    opponents: any[];
    companions?: any[];
    selectedTargetId?: string | null;
    onTargetSelect?: (opponentId: string) => void;
    shakingTargets?: string[];
    onShowDetails?: (opponent: any) => void;
    vfxs?: { id: string; targetId: string; type: string }[];
    onCharacterClick?: (name: string) => void;
    onShowPrompt?: () => void;
    onShowResponse?: () => void;
}

const OpponentStatsPanel: React.FC<OpponentStatsPanelProps> = ({ 
    opponents, 
    companions = [],
    selectedTargetId = null, 
    onTargetSelect, 
    shakingTargets, 
    onShowDetails, 
    vfxs = [],
    onCharacterClick,
    onShowPrompt,
    onShowResponse
}) => {
    const [showDebugButtons, setShowDebugButtons] = useState(false);

    // Gộp tất cả các thực thể (địch, đồng minh, trung lập) vào chung 1 mảng và tự động sắp xếp đồng minh gần nhau, kẻ địch gần nhau, ưu tiên máu cao lên trước
    const allEntities = [...(opponents || []), ...(companions || [])].sort((a, b) => {
        const factionA = a.faction || 'enemy';
        const factionB = b.faction || 'enemy';
        const rank = (f: string) => f === 'ally' ? 1 : f === 'neutral' ? 2 : 3;
        if (rank(factionA) !== rank(factionB)) {
            return rank(factionA) - rank(factionB);
        }
        const getNpcHp = (c: any) => {
            if (!c) return 0;
            const stats = c.stats || c;
            return Math.max(
                stats.maxSinhLuc ?? 0,
                stats.sinhLuc ?? 0,
                stats.sinhLucToiDa ?? 0,
                stats.maxHp ?? 0,
                stats.hp ?? 0,
                c.maxSinhLuc ?? 0,
                c.sinhLuc ?? 0,
                0
            );
        };
        return getNpcHp(b) - getNpcHp(a);
    });

    if (allEntities.length === 0) {
        return <div className="p-3 bg-gray-800 rounded-lg"><p className="text-gray-400 italic">Không có thực thể tham chiến.</p></div>;
    }

    return (
        <div className="p-2 sm:p-3 bg-gray-800/90 rounded-lg border border-gray-700/80 shadow-md">
            <h4 className="font-semibold text-cyan-400 border-b border-gray-700 pb-1 mb-2 text-xs sm:text-sm flex justify-between items-center">
                <span>⚔️ THỰC THỂ THAM CHIẾN (Vuốt ngang để xem)</span>
                {showDebugButtons ? (
                    <span className="text-[10px] text-gray-400 font-mono flex items-center gap-1.5">
                        <button onClick={() => setShowDebugButtons(false)} className="cursor-pointer hover:text-white mr-1 text-[12px]">👉</button>
                        <button onClick={onShowPrompt} className="px-2 py-0.5 bg-blue-900/50 hover:bg-blue-800 text-blue-300 rounded border border-blue-500/50 transition-colors">GỬI</button>
                        <button onClick={onShowResponse} className="px-2 py-0.5 bg-purple-900/50 hover:bg-purple-800 text-purple-300 rounded border border-purple-500/50 transition-colors">NHẬN</button>
                    </span>
                ) : (
                    <span 
                        onClick={() => setShowDebugButtons(true)} 
                        className="text-[10px] text-gray-400 font-mono cursor-pointer hover:text-gray-200"
                    >
                        👉 Vuốt sang phải/trái
                    </span>
                )}
            </h4>
            <div className="flex gap-3 overflow-x-auto custom-scrollbar pb-2 -mb-2">
                {allEntities.map(opp => (
                   <OpponentCard
                        key={opp.id}
                        opponent={opp}
                        isSelected={selectedTargetId === opp.id}
                        isShaking={shakingTargets?.includes(opp.id) || false}
                        onSelect={onTargetSelect}
                        onShowDetails={onShowDetails}
                        vfxs={vfxs}
                        onCharacterClick={onCharacterClick}
                   />
                ))}
            </div>
        </div>
    );
};

export default OpponentStatsPanel;
