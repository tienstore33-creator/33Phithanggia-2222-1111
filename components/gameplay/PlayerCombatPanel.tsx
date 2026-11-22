
import React, { useState, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2 } from 'lucide-react';
import { KnowledgeBase, Item, Skill, StatusEffect, PlayerStats, NPC, YeuThu, Wife, Slave, Combatant } from '../../types'; // Added KnowledgeBase
import { VIETNAMESE, SUB_REALM_NAMES, PROFICIENCY_DMG_HEAL_MULTIPLIERS } from '../../constants';
import StatDisplay from './StatDisplay';
import { useGame } from '../../hooks/useGame';
import { useSkillTransformation } from '../../hooks/useSkillTransformation';
import { safeNumber, formatNumberDot } from '../../utils/combatDataSanitizer';
import { calculateRealmBaseStats, getHpFormulaExplanation } from '../../utils/statsCalculationUtils';
import { SlashVFX } from './vfx/SlashVFX';

const PartyMemberCard: React.FC<{
    member: Combatant;
    isSelected: boolean;
    isShaking: boolean;
    onSelect: (id: string) => void;
    onStatusEffectClick: (effect: StatusEffect) => void;
    isManualCompanion: boolean;
    onShowDetails: (member: Combatant) => void;
    kb: KnowledgeBase;
    vfxs: { id: string; targetId: string; type: string }[];
    isMvp?: boolean;
}> = ({ member, isSelected, isShaking, onSelect, onStatusEffectClick, isManualCompanion, onShowDetails, kb, vfxs, isMvp }) => {
    
    const isPlayer = member.entityType === 'player';
    const isSelectable = !isPlayer; // Player card is not selectable for targeting

    const handleInteractionEnd = () => {
        if (!isSelectable) return;
        onSelect(member.id);
    };

    let stats: Partial<PlayerStats>;
    let realm: string | undefined;

    if (member.entityType === 'player') {
        stats = member;
        realm = member.realm;
    } else {
        stats = member.stats || {};
        realm = member.realm;
    }
    
    const sinhLuc = safeNumber(stats.sinhLuc);
    const maxSinhLuc = safeNumber(stats.maxSinhLuc, 1);
    const linhLuc = safeNumber(stats.linhLuc);
    const maxLinhLuc = safeNumber(stats.maxLinhLuc);
    
    const hpPercent = maxSinhLuc > 0 ? Math.max(0, Math.min(100, (sinhLuc / maxSinhLuc) * 100)) : 0;
    const mpPercent = maxLinhLuc > 0 ? Math.max(0, Math.min(100, (linhLuc / maxLinhLuc) * 100)) : 0;
    
    // Calculate HP Formula for tooltip if player
    const hpTooltip = useMemo(() => {
        if (!isPlayer) return `HP: ${formatNumberDot(sinhLuc)} / ${formatNumberDot(maxSinhLuc)}`;
        
        const baseStats = calculateRealmBaseStats(member.realm || "Phàm Nhân Nhất Trọng", {} as any);
        const maxHpMult = member.permanentBonuses?.maxHpMult || 1.0;
        
        const expl = getHpFormulaExplanation(
            member as PlayerStats,
            kb.equippedItems,
            kb.inventory,
            kb
        );
        return formatNumberDot(expl.steps.join('\n'));
    }, [isPlayer, member, sinhLuc, maxSinhLuc]);

    // Determine border color logic
    let borderColor = 'border-sky-500'; // Default: Manual Companion (Blue/Cyan)
    let hpColor = 'bg-sky-500';
    let hpTextColor = 'text-sky-300';

    if (isPlayer) {
        borderColor = 'border-green-500';
        hpColor = 'bg-green-500';
        hpTextColor = 'text-green-300';
    } else if (!isManualCompanion) {
        // Auto-joining ally (affinity > 50)
        borderColor = 'border-purple-500'; // Purple for auto-allies
        hpColor = 'bg-purple-500';
        hpTextColor = 'text-purple-300';
    }
    
    const selectionClass = isSelectable && isSelected ? 'ring-2 ring-yellow-400 border-yellow-400' : borderColor;
    const cursorClass = isSelectable ? 'cursor-pointer' : 'cursor-default';

    const getStatusEffectTypeColor = (type: StatusEffect['type']) => {
        switch (type) {
        case 'buff': return 'text-green-300 border-green-500';
        case 'debuff': return 'text-red-300 border-red-500';
        case 'neutral': return 'text-gray-300 border-gray-500';
        default: return 'text-gray-200 border-gray-500';
        }
    };

    return (
        <div 
            id={`combatant-${member.id}`}
            className={`w-32 sm:w-48 flex-shrink-0 p-1.5 sm:p-2 bg-gray-700/50 rounded-md border transition-all duration-200 ${selectionClass} ${cursorClass} ${isShaking ? 'animate-shake' : ''}`}
            onClick={handleInteractionEnd}
        >
            <AnimatePresence>
                {vfxs.filter(v => v.targetId === member.id && v.type === 'slash').map(v => (
                    <SlashVFX key={v.id} />
                ))}
            </AnimatePresence>
            <div className="relative">
                <div className="flex justify-between items-baseline mb-0.5 sm:mb-1">
                    <span className="font-bold text-gray-200 text-[11px] sm:text-sm truncate pointer-events-none" title={member.name}>{member.name}</span>
                    {isMvp && (
                        <span className="ml-1 text-[8px] bg-yellow-600 text-white px-1 rounded font-bold uppercase" title="MVP / Slayer">
                            {member.id === 'player' ? 'MVP' : 'Slayer'}
                        </span>
                    )}
                    <div className="flex items-center gap-1">
                        <button 
                            onClick={(e) => { e.stopPropagation(); onShowDetails(member); }}
                            className="p-0.5 px-1.5 rounded-full bg-gray-600/50 hover:bg-gray-500 text-[9px] text-gray-300 transition-colors cursor-pointer block"
                            title="Xem chi tiết"
                        >
                            i
                        </button>
                        {realm && <span className="text-[9px] sm:text-xs text-gray-400 truncate pointer-events-none">{realm}</span>}
                    </div>
                </div>
                <div className="space-y-1 sm:space-y-1.5 text-[10px] sm:text-xs pointer-events-none">
                    {/* HP Bar */}
                    <div title={hpTooltip}>
                        <div className={`flex justify-between mb-0.5 ${hpTextColor} text-[9px] sm:text-[10px]`}>
                            <span className="border-b border-dotted border-gray-500 cursor-help">HP</span>
                            <span>{formatNumberDot(sinhLuc)} / {formatNumberDot(maxSinhLuc)}</span>
                        </div>
                        <div className="w-full bg-gray-600 rounded-full h-1 sm:h-1.5">
                            <div className={`${hpColor} h-1 sm:h-1.5 rounded-full transition-all duration-300`} style={{ width: `${hpPercent}%` }}></div>
                        </div>
                    </div>
                    {/* MP Bar (if applicable) */}
                    {maxLinhLuc > 0 && (
                        <div title={`MP: ${formatNumberDot(linhLuc)} / ${formatNumberDot(maxLinhLuc)}`}>
                            <div className="flex justify-between mb-0.5 text-blue-300 text-[9px] sm:text-[10px]">
                                <span>MP</span>
                                <span>{formatNumberDot(linhLuc)} / {formatNumberDot(maxLinhLuc)}</span>
                            </div>
                            <div className="w-full bg-gray-600 rounded-full h-1 sm:h-1.5">
                                <div className="bg-blue-500 h-1 sm:h-1.5 rounded-full transition-all duration-300" style={{ width: `${mpPercent}%` }}></div>
                            </div>
                        </div>
                    )}
                    {/* ATK */}
                    <div className="pt-0.5 sm:pt-1 text-[10px] sm:text-[11px] flex justify-between items-center">
                        <div>
                            <span className="font-semibold text-gray-400">ATK: </span>
                            <span className="text-gray-200">{formatNumberDot(safeNumber(stats.sucTanCong))}</span>
                        </div>
                        {isPlayer && stats.blackFlashMissCount !== undefined && stats.blackFlashMissCount > 0 && (
                            <div className="text-red-400 font-bold text-[9px] sm:text-[11px]" title={`Tích tụ Hắc Thiểm: +${stats.blackFlashMissCount * 5}%`}>
                                BF+{(stats.blackFlashMissCount * 5)}%
                            </div>
                        )}
                    </div>
                    {/* Status Effects */}
                    {stats.activeStatusEffects && stats.activeStatusEffects.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                            {stats.activeStatusEffects.map(effect => (
                                <span 
                                    key={effect.id} 
                                    onClick={(e) => { e.stopPropagation(); onStatusEffectClick(effect); }} 
                                    className={`status-badge ${effect.type === 'buff' ? 'badge-buff' : 'badge-debuff'} cursor-pointer`}
                                    title={`${effect.name || 'Unknown'}: ${effect.description || ''} (${effect.durationTurns > 0 ? `${effect.durationTurns}t` : '∞'})`}
                                >
                                    {(effect.name || 'Unknown').length > 6 ? (effect.name || 'Unknown').substring(0, 5) + '...' : (effect.name || 'Unknown')}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const getSkillDescriptiveLabel = (s: Skill, stats: PlayerStats) => {
    const proficiencyTier = s.proficiencyTier || 'Sơ Nhập';
    const dmgMult = PROFICIENCY_DMG_HEAL_MULTIPLIERS[proficiencyTier] || 1.0;
    const burstBonus = Math.ceil((stats.maxLinhLuc || 0) * 0.08);
    const playerAtk = stats.sucTanCong || 0;

    let parts: React.ReactNode[] = [];
    
    // 1. Damage Calculation
    const skillBaseDamage = s.baseDamage || (s.effect?.type === 'DAMAGE_HP' ? s.effect.basePower : 0) || 0;
    if (skillBaseDamage > 0 || (s.damageMultiplier || 0) > 0) {
        const totalBase = Math.floor(skillBaseDamage * dmgMult) + burstBonus + playerAtk;
        const min = totalBase;
        const max = Math.round(totalBase * 1.05); 
        parts.push(<span key="dmg" className="text-red-500 font-bold ml-1">(- {formatNumberDot(min)}-{formatNumberDot(max)})</span>);
    }

    // 2. Healing Calculation
    const skillBaseHeal = s.healingAmount || (s.effect?.type === 'HEAL_HP' ? s.effect.basePower : 0) || 0;
    if (skillBaseHeal > 0 || (s.healingMultiplier || 0) > 0) {
        const totalHeal = Math.floor(skillBaseHeal * dmgMult) + burstBonus + playerAtk;
        const min = totalHeal;
        const max = Math.round(totalHeal * 1.05);
        parts.push(<span key="heal" className="text-green-500 font-bold ml-1">(+ {formatNumberDot(min)}-{formatNumberDot(max)})</span>);
    }

    // 3. Status/Effects Detection
    const addStatus = (label: string) => {
        parts.push(<span key={`status-${label}-${parts.length}`} className="text-yellow-500 font-bold ml-1">({label.toLowerCase()})</span>);
    };

    const effectStatus = s.effect?.status;
    if (effectStatus) {
        const statusUpper = String(effectStatus).toUpperCase();
        if (['PROTECT', 'SHELL', 'SHIELD', 'HỘ THỂ', 'THUẪN', 'GIÁP', 'PHÒNG THỦ'].some(k => statusUpper.includes(k))) addStatus('protect');
        else if (['SLOW', 'GIẢM TỐC', 'TRÌ HOÃN', 'CHẬM'].some(k => statusUpper.includes(k))) addStatus('slow');
        else if (['HASTE', 'TĂNG TỐC', 'THẦN HÀNH', 'NHANH'].some(k => statusUpper.includes(k))) addStatus('haste');
        else if (['POISON', 'ĐỘC'].some(k => statusUpper.includes(k))) addStatus('poison');
        else if (['STUN', 'CHOÁNG'].some(k => statusUpper.includes(k))) addStatus('stun');
        else if (['SILENCE', 'CÂM LẶNG'].some(k => statusUpper.includes(k))) addStatus('silence');
        else if (['BLIND', 'MÙ'].some(k => statusUpper.includes(k))) addStatus('blind');
        else addStatus(String(effectStatus));
    } else {
        const hasBuffs = (s.buffsApplied && s.buffsApplied.length > 0) || (s.otherEffects && s.otherEffects.some(e => e.toLowerCase().includes('tăng')));
        const hasDebuffs = (s.debuffsApplied && s.debuffsApplied.length > 0) || (s.otherEffects && s.otherEffects.some(e => e.toLowerCase().includes('giảm')));
        if (hasBuffs && skillBaseHeal === 0) addStatus('buff');
        if (hasDebuffs && skillBaseDamage === 0) addStatus('debuff');
    }

    // Keyword fallback for descriptiveness
    const nameLower = s.name.toLowerCase();
    const currentLabels = parts.map(p => (p as any).key);
    if (!currentLabels.some(l => l.includes('status'))) {
        if (['kim cương', 'phòng thủ', 'thuẫn', 'hộ thể', 'linh thuẫn', 'giáp'].some(k => nameLower.includes(k))) addStatus('protect');
        else if (['trì hoãn', 'làm chậm', 'giảm tốc'].some(k => nameLower.includes(k))) addStatus('slow');
        else if (['thần hành', 'tốc độ', 'tăng tốc'].some(k => nameLower.includes(k))) addStatus('haste');
    }

    // 4. Lifesteal override
    const isLifesteal = nameLower.includes('hút máu') || s.effect?.type === 'DRAIN_HP';
    if (isLifesteal) {
        const drainBase = skillBaseDamage || 25;
        const totalDrain = Math.floor(drainBase * dmgMult) + burstBonus + playerAtk;
        parts = [
            <span key="drain-heal" className="text-green-500 font-bold">(+ {formatNumberDot(totalDrain)}-{formatNumberDot(Math.round(totalDrain*1.05))})</span>,
            <span key="drain-self" className="text-gray-400 text-[10px]"> (self)</span>,
            <span key="drain-dmg" className="text-red-500 font-bold ml-1"> (- {formatNumberDot(totalDrain)}-{formatNumberDot(Math.round(totalDrain*1.05))})</span>
        ];
    } else {
        // 5. Target range
        const isAll = s.targetType === 'Kẻ Địch Toàn Bộ' || s.targetType === 'Đồng Minh Toàn Bộ' || s.targetType === 'Khu Vực' || s.effect?.target?.includes('all');
        const isSelf = s.targetType === 'Tự Thân' || s.effect?.target === 'self';
        
        if (isAll) {
            parts.push(<span key="range-all" className="text-gray-400 text-[10px] ml-1">(all)</span>);
        } else if (isSelf && parts.length > 0) {
            parts.push(<span key="range-self" className="text-gray-400 text-[10px] ml-1">(self)</span>);
        }
    }

    const prefix = s.isTransformed ? "combat " : "";
    return (
        <div className="flex items-center min-w-0 gap-1">
            <span className="text-white truncate font-medium" title={s.name}>
                {prefix}{s.name}
            </span>
            <div className="flex items-center whitespace-nowrap flex-shrink-0">
                {parts}
            </div>
        </div>
    );
};

interface PlayerCombatPanelProps {
  party: Combatant[];
  kb: KnowledgeBase; // Pass full KB to access worldConfig
  selectedTargetId: string | null;
  onTargetSelect: (id: string) => void;
  onStatusEffectClick: (effect: StatusEffect) => void,
  onSkillClick: (skill: Skill) => void,
  onItemClick: (item: Item) => void,
  shakingTargets?: string[]; // Added
  onShowDetails: (member: Combatant) => void;
  vfxs: { id: string; targetId: string; type: string }[];
  mvpId: string | null;
}

const PlayerCombatPanel: React.FC<PlayerCombatPanelProps> = React.memo(({party, kb, selectedTargetId, onTargetSelect, onStatusEffectClick, onSkillClick, onItemClick, shakingTargets, onShowDetails, vfxs, mvpId}) => {
    const [activeTab, setActiveTab] = useState<'stats' | 'skills' | 'items'>('stats');
    const [sortOrder, setSortOrder] = useState<'default' | 'realm'>('default');
    const { triggerTransformation, eligibleSkillsCount, isTransforming } = useSkillTransformation();

    const getRealmSortValue = useCallback((realm: string | undefined): number => {
        const realmProgressionList = kb.realmProgressionList || [];
        if (!realm || realm === VIETNAMESE.mortalRealmName || realm === "Không rõ") {
            return -1;
        }
        let mainRealmIndex = -1;
        let subRealmIndex = -1;
        const sortedMainRealms = [...realmProgressionList].sort((a, b) => b.length - a.length);
        for (const mainRealm of sortedMainRealms) {
            if (realm.startsWith(mainRealm)) {
                mainRealmIndex = realmProgressionList.indexOf(mainRealm);
                const subRealmStr = realm.substring(mainRealm.length).trim();
                subRealmIndex = SUB_REALM_NAMES.indexOf(subRealmStr as any);
                if (subRealmIndex === -1) subRealmIndex = 0;
                break;
            }
        }
        if (mainRealmIndex === -1) return 0;
        return mainRealmIndex * 10 + subRealmIndex;
    }, [kb.realmProgressionList]);

    const sortedParty = useMemo(() => {
        const player = party.find(p => p.id === 'player');
        const allies = party.filter(p => p.id !== 'player');

        if (sortOrder === 'realm') {
            allies.sort((a, b) => {
                const valA = getRealmSortValue(a.realm);
                const valB = getRealmSortValue(b.realm);
                return valA - valB;
            });
        }
        
        return player ? [player, ...allies] : allies;
    }, [party, sortOrder, getRealmSortValue]);

    if (!party || party.length === 0) {
         return (
            <div className="p-3 bg-gray-800 rounded-lg flex-grow flex flex-col">
                <h4 className="font-semibold text-green-400 border-b border-gray-600 pb-1 mb-2">{VIETNAMESE.playerPanelTitle}</h4>
                <p className="text-gray-400 italic">Lỗi tải dữ liệu phe ta.</p>
            </div>
        );
    }

    return (
        <div className="p-3 bg-gray-800 rounded-lg flex-grow flex flex-col">
            <h4 className="font-semibold text-green-400 border-b border-gray-600 pb-1 mb-2">{VIETNAMESE.playerPanelTitle}</h4>
            <div className="flex border-b border-gray-700 mb-2">
                <button onClick={() => setActiveTab('stats')} className={`flex-1 py-1 text-xs ${activeTab === 'stats' ? 'text-green-300 border-b-2 border-green-400' : 'text-gray-400'}`}>{VIETNAMESE.playerCombatStatsTab}</button>
                <button onClick={() => setActiveTab('skills')} className={`flex-1 py-1 text-xs ${activeTab === 'skills' ? 'text-green-300 border-b-2 border-green-400' : 'text-gray-400'}`}>{VIETNAMESE.playerCombatSkillsTab}</button>
                <button onClick={() => setActiveTab('items')} className={`flex-1 py-1 text-xs ${activeTab === 'items' ? 'text-green-300 border-b-2 border-green-400' : 'text-gray-400'}`}>{VIETNAMESE.playerCombatItemsTab}</button>
                {activeTab === 'stats' && party.length > 1 && (
                     <button 
                        onClick={() => setSortOrder(prev => prev === 'default' ? 'realm' : 'default')} 
                        className="ml-auto text-[10px] text-gray-400 hover:text-white px-1"
                        title={sortOrder === 'default' ? 'Sắp xếp theo Cảnh giới' : 'Sắp xếp Mặc định'}
                     >
                        Sắp xếp
                    </button>
                )}
            </div>
            <div className="flex-grow overflow-y-auto custom-scrollbar text-xs max-h-48 sm:max-h-32">
                {activeTab === 'stats' && (
                    <div className="flex gap-3 overflow-x-auto custom-scrollbar pb-2 -mb-2">
                       {sortedParty.map(member => (
                           <PartyMemberCard 
                               key={member.id}
                               member={member}
                               kb={kb}
                               isSelected={selectedTargetId === member.id}
                               isShaking={shakingTargets?.includes(member.id) || false}
                               onSelect={onTargetSelect}
                               onStatusEffectClick={onStatusEffectClick}
                               isManualCompanion={member.id === 'player' || kb.combatCompanionIds.includes(member.id)}
                               onShowDetails={onShowDetails}
                               vfxs={vfxs}
                               isMvp={mvpId === member.id}
                           />
                       ))}
                    </div>
                )}
                {activeTab === 'skills' && (
                    <div className="space-y-2">
                        {eligibleSkillsCount > 0 && (
                            <button 
                                onClick={(e) => { e.stopPropagation(); triggerTransformation(); }}
                                disabled={isTransforming}
                                className={`w-full py-1 mb-2 ${isTransforming ? 'bg-indigo-800' : 'bg-indigo-600 hover:bg-indigo-700'} text-white rounded text-[10px] font-bold transition-colors shadow-sm flex items-center justify-center gap-2`}
                            >
                                {isTransforming ? (
                                    <>
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                        ĐANG THẤU HIỂU THIÊN ĐẠO...
                                    </>
                                ) : (
                                    `${VIETNAMESE.transformSkillButton} (${eligibleSkillsCount})`
                                )}
                            </button>
                        )}
                        {kb.playerSkills.length > 0 ?
                        <ul className="space-y-1.5">
                            {kb.playerSkills.map(s => (
                                <li 
                                    key={s.id} 
                                    onClick={() => onSkillClick(s)} 
                                    className="px-2.5 py-2 rounded-md bg-gradient-to-r from-gray-700/80 to-gray-800/80 hover:from-gray-600 hover:to-gray-700 border border-gray-600 hover:border-green-500/50 cursor-pointer active:scale-[0.97] transition-all shadow-md flex items-center group" 
                                    title={s.name}
                                >
                                    <div className="min-w-0 flex-1">{getSkillDescriptiveLabel(s, kb.playerStats)}</div>
                                </li>
                            ))}
                        </ul> : <p className="text-gray-400 italic">{VIETNAMESE.noSkillsAvailable}</p>}
                    </div>
                )}
                {activeTab === 'items' && (
                     kb.inventory.filter(i => i.category === 'Potion').length > 0 ?
                    <ul className="space-y-1">
                       {kb.inventory.filter(i => i.category === 'Potion').map(i => <li key={i.id} onClick={() => onItemClick(i)} className="p-1 rounded hover:bg-gray-700 cursor-pointer" title={`${i.name} (x${i.quantity})`}>{i.name} (x{i.quantity})</li>)}
                    </ul> : <p className="text-gray-400 italic">{VIETNAMESE.noItemsAvailable}</p>
                )}
            </div>
        </div>
    );
});

export default PlayerCombatPanel;
