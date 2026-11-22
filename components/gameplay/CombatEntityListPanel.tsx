import React, { useState } from 'react';
import { NPC } from '../../types';

interface CombatEntityListPanelProps {
    combatants: any[];
    activeCompanions: any[];
    opponents: any[];
    onPlayerNameClick?: (name: string) => void;
    onRequestFormationChange?: (actionText: string) => void;
}

export const CombatEntityListPanel: React.FC<CombatEntityListPanelProps> = ({
    combatants,
    activeCompanions,
    opponents,
    onPlayerNameClick,
    onRequestFormationChange
}) => {
    const [selectedOut, setSelectedOut] = useState<string | null>(null);

    // Phân loại phe
    const allies = combatants.filter(c => c.faction === 'ally');
    const enemies = combatants.filter(c => c.faction === 'enemy');
    const neutrals = combatants.filter(c => c.faction === 'neutral');

    const getStatus = (c: any) => {
        const isAlly = c.faction === 'ally';
        const isActive = isAlly 
            ? activeCompanions.some(comp => comp.id === c.id) 
            : opponents.some(opp => opp.id === c.id);
        
        if (isActive) {
            return { label: 'đang chiến đấu', color: 'text-emerald-400 font-semibold', isActive: true, isBenched: false, isDead: false };
        }
        const hp = c.stats?.sinhLuc ?? c.hp ?? 0;
        if (hp <= 0) {
            return { label: 'gục ngã', color: 'text-red-400 line-through opacity-60', isActive: false, isBenched: false, isDead: true };
        }
        return { label: 'dự bị', color: 'text-gray-400 italic', isActive: false, isBenched: true, isDead: false };
    };

    const formatHp = (num: number) => {
        return num.toLocaleString('vi-VN');
    };

    const handleSelectForSwap = (name: string, isCurrentActive: boolean) => {
        if (!onRequestFormationChange) {
            onPlayerNameClick?.(name);
            return;
        }

        if (isCurrentActive) {
            if (selectedOut === name) {
                setSelectedOut(null);
            } else {
                setSelectedOut(name);
            }
        } else {
            // Đây là người dự bị
            if (selectedOut) {
                onRequestFormationChange(`Yêu cầu đổi đội hình: Cho [${selectedOut}] lùi về dự bị, [${name}] xuất trận thay thế!`);
                setSelectedOut(null);
            } else {
                // Tự động tìm 1 đồng minh đang chiến đấu có HP thấp nhất để gợi ý đổi
                const activeAllies = allies.filter(a => activeCompanions.some(ac => ac.id === a.id));
                if (activeAllies.length > 0) {
                    // Sắp xếp theo HP tăng dần
                    const lowestHpAlly = [...activeAllies].sort((a, b) => {
                        const hpA = a.stats?.sinhLuc ?? a.hp ?? 99999;
                        const hpB = b.stats?.sinhLuc ?? b.hp ?? 99999;
                        return hpA - hpB;
                    })[0];
                    onRequestFormationChange(`Yêu cầu đổi đội hình: Cho [${lowestHpAlly.name}] lùi về dự bị, [${name}] xuất trận thay thế!`);
                } else {
                    onRequestFormationChange(`Yêu cầu đổi đội hình: Cho [${name}] từ dự bị xuất trận nghênh chiến!`);
                }
            }
        }
    };

    const renderFactionSection = (title: string, list: any[], colorClasses: { title: string; cardBg: string; border: string; text: string }) => {
        if (list.length === 0) return null;

        return (
            <div className="space-y-2">
                <div className="flex justify-between items-center border-b border-gray-700/60 pb-1 mb-2 select-none">
                    <div className={`text-xs font-bold uppercase tracking-wider ${colorClasses.title}`}>
                        {title} ({list.length})
                    </div>
                    {title.includes('Đồng Minh') && selectedOut && (
                        <span className="text-[10px] text-amber-300 animate-pulse">
                            Đã chọn [{selectedOut}], bấm vào NPC dự bị để đổi chỗ
                        </span>
                    )}
                </div>
                <div className="space-y-1.5">
                    {list.map((c, idx) => {
                        const statusInfo = getStatus(c);
                        const stats = c.stats || {};
                        const hp = stats.sinhLuc ?? c.hp ?? 0;
                        const maxHp = stats.maxSinhLuc ?? stats.sinhLucToiDa ?? c.maxHp ?? hp ?? 100;
                        const hpPercent = maxHp > 0 ? Math.max(0, Math.min(100, (hp / maxHp) * 100)) : 0;
                        const isFallen = hp <= 0;
                        const isSelectedOut = selectedOut === c.name;

                        return (
                            <div 
                                key={c.id || `${c.faction}_${idx}`} 
                                className={`p-2 rounded border ${colorClasses.cardBg} ${isSelectedOut ? 'border-amber-400 bg-amber-950/30 ring-1 ring-amber-400' : colorClasses.border} transition-all hover:bg-gray-800/40`}
                            >
                                <div className="flex justify-between items-start gap-1">
                                    <div 
                                        onClick={() => onPlayerNameClick && onPlayerNameClick(c.name)}
                                        className={`cursor-pointer hover:underline select-none font-medium truncate ${isFallen ? 'opacity-50 line-through' : colorClasses.text}`}
                                        title="Bấm để copy tên nhân vật"
                                    >
                                        + {c.name} <span className="text-[10px] text-gray-400">({c.canhGioi || 'Chưa rõ'})</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 flex-shrink-0">
                                        <span className={`text-[10px] ${statusInfo.color}`}>
                                            ({statusInfo.label})
                                        </span>
                                        {c.faction === 'ally' && !isFallen && onRequestFormationChange && (
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleSelectForSwap(c.name, statusInfo.isActive);
                                                }}
                                                className={`text-[9px] px-1.5 py-0.5 rounded border transition-all ${
                                                    statusInfo.isActive 
                                                        ? isSelectedOut 
                                                            ? 'bg-amber-500 text-black font-bold border-amber-400' 
                                                            : 'bg-indigo-900/60 hover:bg-indigo-800 text-indigo-200 border-indigo-500/40'
                                                        : 'bg-emerald-900/60 hover:bg-emerald-800 text-emerald-200 border-emerald-500/40 font-semibold'
                                                }`}
                                                title={statusInfo.isActive ? 'Chọn NPC này để đổi ra dự bị' : 'Đổi NPC dự bị này vào sân'}
                                            >
                                                {statusInfo.isActive ? (isSelectedOut ? '✓ Đang chọn đổi' : '🔄 Đổi ra') : '⚔️ Đổi vào'}
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <div className="mt-1 space-y-0.5">
                                    <div className="flex justify-between text-[10px] text-gray-300 font-mono">
                                        <span>HP</span>
                                        <span>{formatHp(hp)} / {formatHp(maxHp)}</span>
                                    </div>
                                    <div className="w-full bg-gray-800 h-1 rounded-full overflow-hidden border border-gray-900/50">
                                        <div 
                                            className={`h-full rounded-full transition-all duration-300 ${
                                                isFallen ? 'bg-red-900/40' : hpPercent < 25 ? 'bg-red-500' : hpPercent < 50 ? 'bg-amber-500' : 'bg-green-500'
                                            }`}
                                            style={{ width: `${hpPercent}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-4 max-h-[300px] overflow-y-auto custom-scrollbar pr-1 py-1">
            {renderFactionSection('Phe Đồng Minh', allies, {
                title: 'text-indigo-400',
                cardBg: 'bg-indigo-950/20',
                border: 'border-indigo-500/20',
                text: 'text-indigo-200'
            })}
            {renderFactionSection('Phe Kẻ Địch', enemies, {
                title: 'text-red-400',
                cardBg: 'bg-red-950/20',
                border: 'border-red-500/20',
                text: 'text-red-200'
            })}
            {renderFactionSection('Phe Trung Lập', neutrals, {
                title: 'text-amber-400',
                cardBg: 'bg-amber-950/20',
                border: 'border-amber-500/20',
                text: 'text-amber-200'
            })}
        </div>
    );
};
