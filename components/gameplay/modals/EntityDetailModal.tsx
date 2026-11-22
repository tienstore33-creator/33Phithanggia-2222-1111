import React, { useState, useEffect, useRef, useMemo } from 'react';
import Modal from '../../ui/Modal';
import { GameEntity, GameEntityType } from '../../../hooks/useGameplayModals';
import { KnowledgeBase, NPC, Wife, Slave, Prisoner, PlayerStats, Quest, Item, Skill, GameLocation, Faction, WorldLoreEntry, YeuThu, Companion, EquipmentSlotId } from '../../../types';
import { VIETNAMESE } from '../../../constants';
import Button from '../../ui/Button';
import { getDeterministicAvatarSrc } from '../../../utils/avatarUtils';
import { isShopVendor } from '../../../utils/npcHelper';
import DynamicAvatar from '../../DynamicAvatar';
import * as GameTemplates from '../../../templates';
import { useGame } from '../../../hooks/useGame';
import InputField from '../../ui/InputField';
import StatDisplayGrid from '../StatDisplayGrid';
import { calculateEffectiveStats, calculateRealmBaseStats } from '../../../utils/statsCalculationUtils';
import { calculateMechanicalItemPrice } from '../../../utils/itemValuationUtils';
import { formatNumberDot } from '../../../utils/combatDataSanitizer';
import { isMainQuest } from '../../../utils/questUtils';
import { realmManager, getEffectiveRealmSystem } from '../../../services/realmManager';
import { parseRealm } from '../../../utils/realmUtils';
import AvatarAnalysisButton from './AvatarAnalysisButton';

interface EntityDetailModalProps {
    selectedEntity: { type: GameEntityType; entity: GameEntity } | null;
    isOpen: boolean;
    onClose: () => void;
    knowledgeBase: KnowledgeBase;
}

const StatField: React.FC<{ label: string, value: React.ReactNode, valueClassName?: string }> = ({ label, value, valueClassName }) => {
    if (value === undefined || value === null || value === "") return null;
    return (
        <div>
            <span className="text-gray-400 text-xs sm:text-sm">{label}:</span>
            <span className={`ml-2 font-semibold text-sm ${valueClassName || 'text-gray-100'}`}>{value}</span>
        </div>
    );
};

const StatRow = ({ label, value, valueClassName }: { label: string, value: React.ReactNode, valueClassName?: string }) => (
    <div className="flex justify-between border-b border-gray-700/50 py-1.5 text-sm">
        <span className="text-gray-400 font-medium">{label}:</span>
        <span className={`text-right ml-2 ${valueClassName || 'text-gray-200'}`}>{value}</span>
    </div>
);

const getRelationshipStyle = (type: string) => {
    const t = type.toLowerCase();
    if (t.includes('kẻ thù') || t.includes('đối thủ') || t.includes('cừu nhân') || t.includes('giết')) {
        return 'border-red-500 bg-red-900/20 text-red-200';
    }
    if (t.includes('vợ') || t.includes('chồng') || t.includes('đạo lữ') || t.includes('yêu') || t.includes('tình')) {
        return 'border-rose-500 bg-rose-900/20 text-rose-200';
    }
    if (t.includes('cha') || t.includes('mẹ') || t.includes('sư') || t.includes('huynh') || t.includes('đệ') || t.includes('tỷ') || t.includes('muội') || t.includes('con')) {
        return 'border-blue-500 bg-blue-900/20 text-blue-200';
    }
    if (t.includes('bằng hữu') || t.includes('bạn') || t.includes('đồng minh')) {
        return 'border-green-500 bg-green-900/20 text-green-200';
    }
    return 'border-gray-500 bg-gray-800 text-gray-300';
};

const getSkillDescriptionWithCore = (skill: Skill | undefined): string => {
    if (!skill) return '';
    let desc = skill.description || '';
    if (skill.coreSkillName) {
        const descLower = desc.toLowerCase();
        const coreLower = skill.coreSkillName.toLowerCase();
        if (!descLower.includes('lõi là') && !descLower.includes('cốt lõi')) {
            desc = `${desc} (lõi là ${coreLower})`;
        }
    }
    return desc;
};

const EntityDetailModal: React.FC<EntityDetailModalProps> = ({
    selectedEntity,
    isOpen,
    onClose,
    knowledgeBase,
}) => {
    const { 
        onGenerateAndUploadEntityAvatar, 
        avatarGenerationState, 
        apiError, 
        onUpdateEntityAvatar, 
        onRandomizeAvatarHair,
        handleFailQuest,
        handleCompleteQuest,
        setKnowledgeBase,
        showNotification,
        openUpgradeModal,
        handleUpdateEquipment
    } = useGame();
    const [showCoreMemories, setShowCoreMemories] = useState(false);
    const [showRelationships, setShowRelationships] = useState(false);
    const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
    const [isNormalizing, setIsNormalizing] = useState(false);
    
    const [aiAvatarPrompt, setAiAvatarPrompt] = useState('');
    const [aiAvatarError, setAiAvatarError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const isPersonType = selectedEntity && (selectedEntity.type === 'npc' || selectedEntity.type === 'wife' || selectedEntity.type === 'slave' || selectedEntity.type === 'prisoner' || selectedEntity.type === 'companion');
    
    // Fetch the "fresh" person from knowledgeBase to ensure UI updates during normalization
    const person = useMemo(() => {
        if (!isPersonType || !selectedEntity) return null;
        const id = (selectedEntity.entity as any).id;
        const type = selectedEntity.type;
        
        if (type === 'npc') return knowledgeBase.discoveredNPCs.find(n => n.id === id) || (selectedEntity.entity as NPC);
        if (type === 'wife') return knowledgeBase.wives.find(w => w.id === id) || (selectedEntity.entity as Wife);
        if (type === 'slave') return knowledgeBase.slaves.find(s => s.id === id) || (selectedEntity.entity as Slave);
        if (type === 'prisoner') return knowledgeBase.prisoners.find(p => p.id === id) || (selectedEntity.entity as Prisoner);
        if (type === 'companion') return knowledgeBase.companions.find(c => c.id === id) || (selectedEntity.entity as Companion);
        
        return selectedEntity.entity as any;
    }, [isPersonType, selectedEntity, knowledgeBase]);

    useEffect(() => {
        if (!isOpen) {
            setIsConfirmDeleteOpen(false);
        }
    }, [isOpen]);

    const getRealmIndex = (realmStr: string | undefined): number => {
        if (!realmStr) return -1;
        let trimmed = realmStr.trim();
        const match = trimmed.match(/^(.*)\s*\((.*)\)$/);
        if (match) {
            const major = match[1].trim();
            const minor = match[2].trim();
            trimmed = `${major} ${minor}`;
        }
        const cleanList = realmManager.getProgressionList(knowledgeBase).map(r => r.trim().toLowerCase());
        const idx = cleanList.indexOf(trimmed.toLowerCase());
        if (idx !== -1) return idx;

        const { majorRealms, minorRealms } = getEffectiveRealmSystem(knowledgeBase);
        if (!majorRealms || majorRealms.length === 0) return -1;
        
        const sortedMajors = [...majorRealms].sort((a, b) => b.length - a.length);
        for (let i = 0; i < sortedMajors.length; i++) {
            const major = sortedMajors[i];
            if (trimmed.toLowerCase().startsWith(major.toLowerCase())) {
                const subStr = trimmed.substring(major.length).trim();
                let subIdx = minorRealms.map(s => s.toLowerCase()).indexOf(subStr.toLowerCase());
                if (subIdx === -1) subIdx = 0;
                return (majorRealms.indexOf(major) * (minorRealms.length || 1)) + subIdx;
            }
        }
        return -1;
    };

    const handleDeleteNpc = () => {
        if (!person || !selectedEntity) return;
        const mcRealm = knowledgeBase.playerStats.realm;
        const npcRealm = person.realm || '';

        const mcIdx = getRealmIndex(mcRealm);
        const npcIdx = getRealmIndex(npcRealm);

        if (npcIdx >= mcIdx) {
            showNotification("Bạn chỉ có thể xóa NPC có cảnh giới thấp hơn chính mình!", "error");
            return;
        }

        const reunionTurns = (person as any).reunionCounter || 0;
        if (reunionTurns <= 20) {
            showNotification(`Bạn vừa tương tác với NPC này gần đây (Mới chỉ ${reunionTurns}/20 lượt chưa gặp, yêu cầu phải trên 20 lượt)!`, "error");
            return;
        }

        const expCost = Math.floor(knowledgeBase.playerStats.maxKinhNghiem * 0.5);

        if (knowledgeBase.playerStats.kinhNghiem < expCost) {
            showNotification(`Bạn không đủ EXP! Cần ${expCost} EXP (50% thanh EXP hiện tại) nhưng chỉ có ${knowledgeBase.playerStats.kinhNghiem} EXP.`, "error");
            return;
        }

        setKnowledgeBase((prevKb) => {
            const newKb = JSON.parse(JSON.stringify(prevKb));
            
            // Trừ exp của MC
            newKb.playerStats.kinhNghiem = Math.max(0, newKb.playerStats.kinhNghiem - expCost);
            
            // Xóa dữ liệu NPC tương ứng
            if (selectedEntity.type === 'npc') {
                newKb.discoveredNPCs = newKb.discoveredNPCs.filter((n: any) => n.id !== person.id);
            } else if (selectedEntity.type === 'wife') {
                newKb.wives = newKb.wives.filter((n: any) => n.id !== person.id);
            } else if (selectedEntity.type === 'slave') {
                newKb.slaves = newKb.slaves.filter((n: any) => n.id !== person.id);
            } else if (selectedEntity.type === 'prisoner') {
                newKb.prisoners = newKb.prisoners.filter((n: any) => n.id !== person.id);
            }

            return newKb;
        });

        showNotification(`Đã tiêu hao ${expCost} EXP và tiễn bạt thành công ${person.name}!`, "success");
        setIsConfirmDeleteOpen(false);
        onClose();
    };

    useEffect(() => {
        if (isOpen && selectedEntity && (selectedEntity.type === 'npc' || selectedEntity.type === 'yeuThu')) {
            const person = selectedEntity.entity as NPC | YeuThu;
            const genderText = 'gender' in person ? (person as NPC).gender : 'Không xác định';
            const personalityText = 'personalityTraits' in person ? (person as NPC).personalityTraits?.join(', ') : 'Không xác định';

            const defaultPrompt = `Masterpiece anime character portrait in the dynamic and highly detailed art style of Yusuke Murata (One-Punch Man, VERSUS). Character: ${person.name}. Gender: ${genderText}. Personality: ${personalityText}. Appearance and key features: ${person.description}. Emphasize clean lines, intricate details, and expressive, dramatic lighting. Key visual, official art.`;
            setAiAvatarPrompt(defaultPrompt);
        } else {
            setAiAvatarPrompt('');
            setAiAvatarError(null);
        }
    }, [isOpen, selectedEntity]);

    useEffect(() => {
        if (apiError && avatarGenerationState !== 'idle') {
            setAiAvatarError(apiError);
        } else {
            setAiAvatarError(null);
        }
    }, [apiError, avatarGenerationState]);

    const handleGenerateAvatar = async () => {
        if (!selectedEntity || !aiAvatarPrompt.trim() || !(selectedEntity.type === 'npc' || selectedEntity.type === 'yeuThu')) return;
        setAiAvatarError(null);
        await onGenerateAndUploadEntityAvatar(selectedEntity.type as 'npc' | 'yeuThu', (selectedEntity.entity as any).id, aiAvatarPrompt);
    };

    const [confirmFailId, setConfirmFailId] = useState<string | null>(null);

    if (!selectedEntity) return null;

    const handleNormalizeMechanical = async () => {
        if (!person || !selectedEntity || isNormalizing) return;
        
        setIsNormalizing(true);
        
        // Step 1: Set stats to 0 immediately in all lists where this person exists
        setKnowledgeBase((prevKb: KnowledgeBase) => {
            const newKb = JSON.parse(JSON.stringify(prevKb));
            
            const clearStats = (target: any) => {
                if (target && target.stats) {
                    target.stats.maxSinhLuc = 0;
                    target.stats.baseMaxSinhLuc = 0;
                    target.stats.sucTanCong = 0;
                    target.stats.baseSucTanCong = 0;
                    target.stats.maxLinhLuc = 0;
                    target.stats.baseMaxLinhLuc = 0;
                    target.stats.maxThoNguyen = 0;
                    target.stats.maxKinhNghiem = 0;
                    target.stats.baseMaxKinhNghiem = 0;
                }
            };

            [
                newKb.discoveredNPCs,
                newKb.wives,
                newKb.slaves,
                newKb.prisoners,
                newKb.companions
            ].forEach(list => {
                if (Array.isArray(list)) {
                    const found = list.find((item: any) => item && item.id === person.id);
                    if (found) clearStats(found);
                }
            });
            
            return newKb;
        });

        showNotification(`Đang tiến hành thanh trừng và chuẩn hoá cơ học cho ${person.name}... Vui lòng đợi 5 giây.`, "info");

        // Step 2: Wait 5 seconds
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Step 3: Recalculate based on current realm and fill in all lists
        setKnowledgeBase((prevKb: KnowledgeBase) => {
            const newKb = JSON.parse(JSON.stringify(prevKb));
            const realmSystem = getEffectiveRealmSystem(newKb);

            const recalculateStats = (target: any) => {
                if (!target) return;
                const npcBase = calculateRealmBaseStats(
                    target.realm || "Phàm Nhân",
                    realmSystem.majorRealms,
                    newKb.currentRealmBaseStats,
                    realmSystem.minorRealms
                );
                const parsedNpc = parseRealm(target.realm || "Phàm Nhân", realmSystem);
                const expectedThoNguyen = parsedNpc.majorIndex === 0 ? 120 : 100 * Math.pow(2, parsedNpc.majorIndex);

                target.stats = {
                    ...target.stats,
                    baseMaxSinhLuc: npcBase.baseMaxSinhLuc,
                    maxSinhLuc: npcBase.baseMaxSinhLuc + (target.stats?.permanentSinhLucBonus || 0),
                    sinhLuc: npcBase.baseMaxSinhLuc + (target.stats?.permanentSinhLucBonus || 0),
                    baseSucTanCong: npcBase.baseSucTanCong,
                    sucTanCong: npcBase.baseSucTanCong,
                    baseMaxLinhLuc: npcBase.baseMaxLinhLuc,
                    maxLinhLuc: npcBase.baseMaxLinhLuc,
                    linhLuc: npcBase.baseMaxLinhLuc,
                    maxThoNguyen: expectedThoNguyen,
                    thoNguyen: expectedThoNguyen,
                    baseMaxKinhNghiem: npcBase.baseMaxKinhNghiem,
                    maxKinhNghiem: npcBase.baseMaxKinhNghiem,
                    kinhNghiem: 0
                };
            };

            [
                newKb.discoveredNPCs,
                newKb.wives,
                newKb.slaves,
                newKb.prisoners,
                newKb.companions
            ].forEach(list => {
                if (Array.isArray(list)) {
                    const found = list.find((item: any) => item && item.id === person.id);
                    if (found) recalculateStats(found);
                }
            });

            return newKb;
        });

        setIsNormalizing(false);
        showNotification(`Đã tái cấu trúc thành công chỉ số cho ${person.name}!`, "success");
    };

    const handleUpdateAppearance = (targetId: string, newAppearance: string) => {
        setKnowledgeBase((prevKb: KnowledgeBase) => {
            const newKb = JSON.parse(JSON.stringify(prevKb));
            const updateInList = (list: any[]) => {
                if (!list) return;
                const found = list.find((item: any) => item.id === targetId);
                if (found) {
                    found.avatarAppearance = newAppearance;
                    found.appearance = newAppearance;
                    found.avatarAppearancePendingTransition = true;
                }
            };

            updateInList(newKb.discoveredNPCs);
            updateInList(newKb.wives);
            updateInList(newKb.slaves);
            updateInList(newKb.prisoners);
            updateInList(newKb.companions);
            if (newKb.discoveredYeuThu) updateInList(newKb.discoveredYeuThu);

            // Cập nhật cho player nếu là player
            if (targetId === 'player' || targetId === newKb.playerStats.id) {
                newKb.playerStats.avatarAppearance = newAppearance;
                newKb.playerStats.appearance = newAppearance;
                newKb.playerStats.avatarAppearancePendingTransition = true;
            }

            return newKb;
        });

        if (selectedEntity && selectedEntity.entity && (selectedEntity.entity as any).id === targetId) {
            const ent = selectedEntity.entity as any;
            ent.avatarAppearance = newAppearance;
            ent.appearance = newAppearance;
            ent.avatarAppearancePendingTransition = true;
        }

        showNotification("Đã cập nhật diện mạo từ ảnh thành công!", "success");
    };

    const isLoading = avatarGenerationState === 'generating' || avatarGenerationState === 'uploading';
    let loadingText = "Đang tải...";
    if (avatarGenerationState === 'generating') loadingText = "Đang tạo ảnh...";
    if (avatarGenerationState === 'uploading') loadingText = "Đang tải lên...";

    const { type, entity } = selectedEntity;
    
    let title = "Chi Tiết";
    let content: React.ReactNode = null;

    if ('name' in entity && entity.name) title = entity.name;
    if ('title' in entity && entity.title && type !== 'npc' && type !== 'lore') title = entity.title;


    switch(type) {
        case 'npc':
        case 'wife':
        case 'slave':
        case 'prisoner':
        case 'companion': {
            if (!person) break;
            const entityMemories = knowledgeBase.coreMemories.filter(m => m.entityId === person.id);
            const relationships = person.relationships || [];
            const skills = person.skills || [];
            
            const combatSkills = skills.filter(s => 
                s.skillType === GameTemplates.SkillType.LINH_KI ||
                s.skillType === GameTemplates.SkillType.THAN_THONG ||
                s.skillType === GameTemplates.SkillType.CAM_THUAT
            );
            
            content = (
                <div className="space-y-4">
                    <div className="text-center group relative flex flex-col items-center">
                        <div className="relative group overflow-hidden rounded-full border-2 border-rose-500 shadow-xl mb-4 h-32 w-32 bg-gray-900 flex items-center justify-center">
                            {/* Combined Avatar Layer - Preferred for Female */}
                            {person.gender?.toLowerCase().includes("nữ") && !person.avatarUrl ? (
                                <DynamicAvatar 
                                    hairIndex={person.avatarHairId ?? 0} 
                                    faceIndex={person.avatarFaceId ?? 0} 
                                    size={128} 
                                />
                            ) : (
                               <img 
                                   src={getDeterministicAvatarSrc(person)} 
                                   alt={person.name} 
                                   className="absolute inset-0 w-full h-full object-cover z-20" 
                               />
                           )}
                           
                           {/* Show the randomization button as a persistent overlay for DynamicAvatar or fallback */}
                           <button 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onRandomizeAvatarHair(type as any, person.id);
                                }}
                                className="absolute bottom-1 right-1 bg-indigo-600 hover:bg-indigo-500 p-2 rounded-full z-30 shadow-lg border border-white/20 transition-all transform active:scale-95"
                                title="Tạo avatar ngẫu nhiên (Cơ học)"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5 text-white">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                                </svg>
                           </button>
                        </div>
                        <h3 className="text-2xl font-bold flex items-center gap-2 justify-center">
                            {person.name}
                            {isShopVendor(person) && (
                                <span className="text-xs font-bold px-2 py-0.5 rounded bg-amber-950 text-amber-400 border border-amber-800">
                                    🏪 Chủ Tiệm
                                </span>
                            )}
                        </h3>
                        <p className="text-md text-gray-400">{person.race || 'Không rõ'}</p>
                        {person.title && <p className="text-sm text-gray-500">{person.title}</p>}
                        {person.avatarUrl && (
                            <AvatarAnalysisButton
                                avatarUrl={person.avatarUrl}
                                characterName={person.name}
                                gender={person.gender}
                                onSuccess={(newDesc) => handleUpdateAppearance(person.id, newDesc)}
                                className="mt-2"
                            />
                        )}
                    </div>
                    
                    <div className="bg-gray-900/40 p-3 rounded-lg">
                        <h4 className="font-semibold text-lg text-indigo-300 border-b border-gray-600 pb-2 mb-3">Thông Tin Cơ Bản & Tu Luyện</h4>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                            <StatField label="Giới tính" value={person.gender} />
                            <StatField label="Chủng tộc" value={person.race} />
                             <StatField 
                                 label="Trạng thái" 
                                 value={person.status ? `${person.status}${person.statusDuration !== undefined ? ` (${person.statusDuration} lượt)` : ''}` : "Bình thường"} 
                                 valueClassName={person.status ? "text-amber-400 font-bold" : "text-emerald-400 font-medium"} 
                             />
                            {person.personalityTraits && person.personalityTraits.length > 0 && (<div className="col-span-2"><StatField label="Tính cách" value={person.personalityTraits.join(', ')} /></div>)}
                            <div className="col-span-2 border-t border-gray-700/50 my-1"></div>
                            <StatField label="Cảnh giới" value={person.realm} valueClassName="text-amber-400 font-bold"/>
                            <StatField 
                                label="Vị trí" 
                                value={person.locationId ? knowledgeBase.discoveredLocations.find(l => l.id === person.locationId)?.name : 'Không rõ'} 
                                valueClassName="text-indigo-200"
                            />
                            <StatField label="Tư chất" value={person.tuChat} />
                            <StatField label="Linh Căn" value={person.spiritualRoot} />
                            <div className="col-span-2"><StatField label="Thể Chất" value={person.specialPhysique} /></div>
                        </div>
                    </div>

                    <div className="bg-gray-900/40 p-3 rounded-lg">
                        <div className="flex justify-between items-center border-b border-gray-600 pb-2 mb-3">
                            <h4 className="font-semibold text-lg text-indigo-300">Trạng thái quan hệ</h4>
                            <Button
                                onClick={() => setShowRelationships(!showRelationships)}
                                variant="ghost"
                                size="sm"
                                className="text-[10px] sm:text-xs !py-1 !px-2 border border-gray-600 hover:bg-gray-700 text-gray-300"
                            >
                                {showRelationships ? 'Ẩn Người Quen' : `Người Quen (${relationships.length})`}
                            </Button>
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                            <StatField label="Thiện cảm" value={person.affinity} valueClassName={person.affinity >= 0 ? "text-green-400" : "text-red-400"}/>
                            {('willpower' in person) && <StatField label="Ý chí" value={(person as any).willpower} />}
                            {('obedience' in person) && <StatField label="Phục tùng" value={(person as any).obedience} />}
                            {('resistance' in person) && <StatField label="Phản kháng" value={(person as Prisoner).resistance} />}
                        </div>

                        {showRelationships && (
                            <div className="mt-3 pt-3 border-t border-gray-700 space-y-2 animate-fade-in">
                                {relationships.length > 0 ? (
                                    relationships.map((rel, idx) => {
                                        const styleClass = getRelationshipStyle(rel.type);
                                        return (
                                            <div key={idx} className={`p-2 rounded border-l-4 text-xs flex flex-col gap-1 ${styleClass}`}>
                                                <div className="flex justify-between items-center">
                                                    <span className="font-bold uppercase opacity-80 tracking-wide">{rel.type}</span>
                                                    <span className="font-semibold text-white bg-black/30 px-2 py-0.5 rounded">{rel.targetName}</span>
                                                </div>
                                                {rel.note && <span className="italic opacity-70 border-t border-white/10 pt-1 mt-1 block">"{rel.note}"</span>}
                                            </div>
                                        );
                                    })
                                ) : (
                                    <p className="text-gray-500 italic text-xs text-center">Chưa có thông tin về người thân quen.</p>
                                )}
                            </div>
                        )}
                    </div>

                    {person.stats && (person.stats.maxSinhLuc != null || person.stats.sucTanCong != null) && (
                        <div className="bg-gray-900/40 p-3 rounded-lg border border-indigo-500/20">
                            <div className="flex justify-between items-center border-b border-gray-600 pb-2 mb-3">
                                <h4 className="font-semibold text-lg text-indigo-300">Chỉ số chiến đấu</h4>
                                <Button
                                    onClick={handleNormalizeMechanical}
                                    variant="ghost"
                                    size="sm"
                                    isLoading={isNormalizing}
                                    disabled={isNormalizing}
                                    className="text-[10px] sm:text-xs !py-1 !px-2 border border-red-900/50 hover:bg-red-900/20 text-red-400 font-bold uppercase tracking-tighter"
                                >
                                    Chuẩn hoá chỉ số (Cơ học)
                                </Button>
                            </div>
                            {(() => {
                                let displayStats = person.stats as PlayerStats;
                                // Resolve items for NPCs/Companions
                                const combinedInventory = [...knowledgeBase.inventory, ...knowledgeBase.npcInventory];
                                // If items are available, calculate effective stats on the fly for display
                                if (person.equippedItems && Object.values(person.equippedItems).some(v => !!v)) {
                                    displayStats = calculateEffectiveStats(displayStats, person.equippedItems as any, combinedInventory);
                                }
                                return (
                                    <StatDisplayGrid 
                                        stats={displayStats} 
                                        equippedItemIds={person.equippedItems as any}
                                        inventory={(person as any).inventory || combinedInventory}
                                        kb={knowledgeBase}
                                    />
                                );
                            })()}
                        </div>
                    )}

                    {person.equippedItems && Object.values(person.equippedItems).some(v => !!v) && (
                        <div className="bg-gray-900/40 p-3 rounded-lg border border-indigo-500/20">
                            <h4 className="font-semibold text-lg text-indigo-300 border-b border-gray-600 pb-2 mb-3 uppercase">TRANG BỊ HIỆN CÓ</h4>
                            <ul className="grid grid-cols-1 gap-2">
                                {Object.entries(person.equippedItems).map(([slot, itemId]) => {
                                    if (!itemId) return null;
                                    const combinedInventory = [...knowledgeBase.inventory, ...knowledgeBase.npcInventory];
                                    const item = (person as any).inventory?.find((i: any) => i.id === itemId) || combinedInventory.find(i => i.id === itemId);
                                    if (!item) return null;
                                    
                                    const slotLabel = VIETNAMESE[`slot${slot.charAt(0).toUpperCase() + slot.slice(1)}` as keyof typeof VIETNAMESE] || slot;
                                    
                                    const rawStats = (item as any).statBonuses ? Object.entries((item as any).statBonuses)
                                        .filter(([_, v]) => v !== 0)
                                        .map(([s, v]) => `${(v as number) > 0 ? '+' : ''}${formatNumberDot(v as number)} ${VIETNAMESE[s as keyof typeof VIETNAMESE] || s}`) : [];
                                        
                                    const pctStats = (item as any).bonusPercentageStats ? Object.entries((item as any).bonusPercentageStats)
                                        .filter(([_, v]) => v !== 0)
                                        .map(([s, v]) => `+${formatNumberDot(v as number)}% ${s === 'sucTanCong' ? 'Tấn công ẩn' : s === 'maxSinhLuc' ? 'Máu ẩn' : s === 'maxLinhLuc' ? 'Linh lực ẩn' : s === 'phongNgu' ? 'Phòng ngự ẩn' : s}`) : [];
                                        
                                    const stats = [...rawStats, ...pctStats].join(', ');
                                        
                                    return (
                                        <li key={slot} className="text-sm bg-gray-800/50 p-2 rounded border border-gray-700/50 flex flex-col sm:flex-row sm:justify-between items-start sm:items-center gap-1">
                                            <div className="flex flex-col">
                                                <span className="text-indigo-200 font-semibold">{item.name}</span>
                                                <span className="text-[10px] text-gray-500 uppercase">{slotLabel}</span>
                                            </div>
                                            {stats && <span className="text-green-400 text-xs font-mono">{stats}</span>}
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    )}
                    
                    <div className="bg-gray-900/40 p-3 rounded-lg border border-purple-900/30">
                        <h4 className="font-semibold text-lg text-purple-400 border-b border-gray-600 pb-2 mb-3">Kỹ Năng Chiến Đấu</h4>
                        {combatSkills.length > 0 ? (
                            <ul className="space-y-2">
                                {combatSkills.map((skill, idx) => (
                                    <li key={idx} className="bg-gray-800/60 p-2 rounded border border-gray-700">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="font-semibold text-indigo-200 text-sm">
                                                {skill.name}
                                            </span>
                                            {skill.skillType && <span className="text-[10px] text-gray-500 uppercase bg-black/20 px-1 rounded">{skill.skillType}</span>}
                                        </div>
                                        <p className="text-xs text-gray-400 italic break-words whitespace-normal leading-relaxed">{getSkillDescriptionWithCore(skill)}</p>
                                        {(skill.baseDamage || skill.healingAmount) ? (
                                            <p className="text-[10px] text-gray-500 mt-1">
                                                {skill.baseDamage ? `Sát thương: ${formatNumberDot(skill.baseDamage)}` : ''}
                                                {skill.baseDamage && skill.healingAmount ? ' | ' : ''}
                                                {skill.healingAmount ? `Hồi phục: ${formatNumberDot(skill.healingAmount)}` : ''}
                                                {skill.manaCost ? ` | MP: ${formatNumberDot(skill.manaCost)}` : ''}
                                            </p>
                                        ) : null}
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-gray-500 italic text-xs text-center">Chưa có kỹ năng chiến đấu.</p>
                        )}
                    </div>
                    
                    <div className="pt-3 border-t border-gray-700/50">
                        <div className="text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1">
                            📜 Tiểu Sử & Lai Lịch
                        </div>
                        <p className="text-sm italic text-gray-400">{person.description || "Chưa có thông tin tiểu sử."}</p>
                        {person.history && person.history.length > 0 && (
                            <details className="mt-2 group">
                                <summary className="text-xs font-medium text-indigo-400 cursor-pointer hover:text-indigo-300 select-none">
                                    Xem Lịch Sử Biến Động ({person.history.length})
                                </summary>
                                <div className="mt-2 pl-2 border-l-2 border-gray-700 space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
                                    {[...person.history].reverse().map((desc, i) => (
                                        <p key={i} className="text-xs text-gray-500 italic border-b border-gray-800/50 pb-1">
                                            {desc}
                                        </p>
                                    ))}
                                </div>
                            </details>
                        )}
                    </div>

                    {(person.avatarAppearance || person.appearance) && (
                        <div className="pt-3 border-t border-gray-700/50">
                            <div className="text-xs font-semibold text-amber-300 uppercase tracking-wider mb-1">
                                ✨ Diện Mạo Mô Tả (Từ Ảnh Đại Diện)
                            </div>
                            <div className="text-sm italic text-amber-100/90 bg-amber-950/25 border border-amber-800/40 rounded-lg p-2.5 leading-relaxed">
                                {person.avatarAppearance || person.appearance}
                            </div>
                        </div>
                    )}
                    
                    <div className="mt-4 pt-4 border-t border-gray-700 space-y-2">
                        <Button onClick={() => setShowCoreMemories(!showCoreMemories)} variant="secondary" className="w-full flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <span>Ký Ức Cốt Lõi ({entityMemories.length})</span>
                                {(person as any).reunionCounter > 0 && (
                                    <span className="text-[10px] bg-red-950/40 text-red-400 px-2 py-0.5 rounded-full border border-red-900/30 animate-pulse">
                                        Đã {formatNumberDot((person as any).reunionCounter)} lượt chưa gặp
                                    </span>
                                )}
                            </div>
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-4 h-4 transition-transform ${showCoreMemories ? 'rotate-180' : ''}`}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                            </svg>
                        </Button>
                        {showCoreMemories && (
                            <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar bg-gray-800 p-2 rounded-md border border-gray-700">
                                {entityMemories.length > 0 ? (
                                    entityMemories.sort((a, b) => b.strength - a.strength).map(mem => (
                                        <div key={mem.id} className="p-2 bg-gray-700/50 rounded border-l-2 border-indigo-400 text-xs">
                                            <p className="text-gray-200">{mem.text}</p>
                                            <p className="text-right text-[10px] text-indigo-300 mt-1">Độ mạnh: {mem.strength}</p>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-xs text-gray-500 italic text-center">Chưa có ký ức nào.</p>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Nút Xóa NPC */}
                    <div className="bg-red-950/10 border border-red-500/20 p-3 rounded-lg mt-4 space-y-3">
                        <div className="flex justify-between items-center border-b border-red-900/40 pb-2">
                            <span className="font-bold text-red-400 text-sm flex items-center gap-1.5">
                                ⚔️ Trục Xuất Cảnh Giới
                            </span>
                            <span className="text-[10px] bg-red-950/40 text-red-300 px-2 py-0.5 rounded-full border border-red-900/30">
                                Yêu cầu: Thấp hơn MC & không gặp &gt; 20 lượt
                            </span>
                        </div>
                        
                        {(() => {
                            const mcRealm = knowledgeBase.playerStats.realm;
                            const npcRealm = person?.realm || '';
                            const mcIdx = getRealmIndex(mcRealm);
                            const npcIdx = getRealmIndex(npcRealm);
                            const isNpcLowerRealm = npcIdx < mcIdx;
                            const expCost = Math.floor(knowledgeBase.playerStats.maxKinhNghiem * 0.5);
                            const currentMcExp = knowledgeBase.playerStats.kinhNghiem;
                            const isEnoughExp = currentMcExp >= expCost;
                            const reunionTurns = (person as any).reunionCounter || 0;
                            const isNotInteractedOver20 = reunionTurns > 20;

                            if (!isNpcLowerRealm) {
                                return (
                                    <p className="text-xs text-gray-400 italic text-center py-1">
                                        Không thể thực hiện. Cảnh giới của {person?.name} ({npcRealm || 'Phàm Nhân'}) ngang hoặc mạnh hơn bản thân bạn ({mcRealm}).
                                    </p>
                                );
                            }

                            if (!isNotInteractedOver20) {
                                return (
                                    <div className="space-y-1 py-1 text-center">
                                        <p className="text-xs text-gray-400 italic">
                                            Không thể thực hiện. Bạn vừa tương tác với {person?.name} gần đây.
                                        </p>
                                        <p className="text-xs text-amber-500 font-semibold">
                                            Số lượt chưa gặp: {reunionTurns}/20 lượt (Yêu cầu phải trên 20 lượt mới được xoá).
                                        </p>
                                    </div>
                                );
                            }

                            return (
                                <div className="space-y-2">
                                    <div className="flex justify-between text-xs text-gray-300 flex-wrap gap-1">
                                        <span>EXP cần tiêu hao (50%):</span>
                                        <span className="font-bold text-red-400">-{expCost} EXP</span>
                                    </div>
                                    <div className="flex justify-between text-xs text-gray-300 flex-wrap gap-1">
                                        <span>EXP hiện tại của bạn:</span>
                                        <span className={`font-semibold ${isEnoughExp ? 'text-green-400' : 'text-amber-500'}`}>
                                            {currentMcExp}/{knowledgeBase.playerStats.maxKinhNghiem} EXP
                                        </span>
                                    </div>
                                    <Button
                                        onClick={() => setIsConfirmDeleteOpen(true)}
                                        className="w-full bg-red-600/80 hover:bg-red-600 text-white font-bold py-1.5 text-xs rounded border border-red-500/30 transition-all active:scale-[0.98]"
                                        type="button"
                                        disabled={isLoading}
                                    >
                                        Xóa NPC ({person?.name})
                                    </Button>
                                </div>
                            );
                        })()}
                    </div>
                </div>
            );
            break;
        }
        case 'item': {
            const item = entity as Item;
            title = item.name;
            content = (
                <div className="space-y-4">
                    <p className="text-sm italic text-gray-400">{item.description}</p>
                    <div className="space-y-1.5 bg-gray-900/40 p-3 rounded-lg">
                        <StatRow label="Loại" value={VIETNAMESE[`itemCategory_${item.category}` as keyof typeof VIETNAMESE] || item.category} />
                        <StatRow label="Độ hiếm" value={item.rarity} />
                        <StatRow label="Số lượng" value={item.quantity} />
                        {(() => {
                            const val = (typeof item.value === 'number' && !isNaN(item.value) && item.value > 0)
                                ? item.value
                                : calculateMechanicalItemPrice(item, knowledgeBase);
                            return <StatRow label="Giá trị" value={`${val.toLocaleString()} ${knowledgeBase.worldConfig?.currencyName || ''}`} />;
                        })()}
                        {item.itemRealm && <StatRow label="Cảnh giới vật phẩm" value={item.itemRealm} />}
                    </div>
                    
                    {item.category === GameTemplates.ItemCategory.EQUIPMENT && (
                        <div className="space-y-2 bg-gray-900/40 p-3 rounded-lg">
                             <h4 className="font-semibold text-indigo-300 text-base mb-2">Thuộc tính trang bị</h4>
                             {(() => {
                                 const slot = (item as GameTemplates.EquipmentTemplate).slot;
                                 if (!slot) return null;
                                 const key = `slot${slot.charAt(0).toUpperCase()}${slot.slice(1)}`;
                                 const slotLabel = VIETNAMESE[key as keyof typeof VIETNAMESE] || slot;
                                 return <StatRow label="Vị trí" value={slotLabel} />;
                             })()}
                             {(item as GameTemplates.EquipmentTemplate).statBonuses && Object.keys((item as GameTemplates.EquipmentTemplate).statBonuses).length > 0 && (
                                <div className="pt-2">
                                    <h5 className="text-sm font-semibold text-gray-300 mb-1">Chỉ số cộng thêm:</h5>
                                    <ul className="list-disc list-inside pl-2 text-sm space-y-1">
                                        {Object.entries((item as GameTemplates.EquipmentTemplate).statBonuses).map(([stat, value]) => (
                                            <li key={stat}>{VIETNAMESE[stat as keyof typeof VIETNAMESE] || stat}: <span className="font-bold text-green-400">+{value}</span></li>
                                        ))}
                                    </ul>
                                </div>
                             )}
                             {(item as GameTemplates.EquipmentTemplate).bonusPercentageStats && Object.keys((item as GameTemplates.EquipmentTemplate).bonusPercentageStats).length > 0 && (
                                <div className="pt-2 border-t border-gray-800/50 mt-2">
                                    <h5 className="text-sm font-semibold text-emerald-400 mb-1">Chỉ số tăng % ẩn:</h5>
                                    <ul className="list-disc list-inside pl-2 text-sm space-y-1">
                                        {Object.entries((item as GameTemplates.EquipmentTemplate).bonusPercentageStats).map(([stat, value]) => {
                                            const label = stat === 'sucTanCong' ? 'Sức tấn công ẩn' : stat === 'maxSinhLuc' ? 'Sinh lực tối đa ẩn' : stat === 'maxLinhLuc' ? 'Linh lực tối đa ẩn' : stat === 'phongNgu' ? 'Phòng ngự ẩn' : stat;
                                            return (
                                                <li key={stat} className="text-emerald-300">
                                                    {label}: <span className="font-bold text-emerald-400">+{value}%</span>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </div>
                             )}
                             {(item as GameTemplates.EquipmentTemplate).uniqueEffects && (item as GameTemplates.EquipmentTemplate).uniqueEffects.length > 0 && (
                                <div className="pt-2">
                                    <h5 className="text-sm font-semibold text-gray-300 mb-1">Hiệu ứng đặc biệt:</h5>
                                    <ul className="list-disc list-inside pl-2 text-sm space-y-1">
                                        {(item as GameTemplates.EquipmentTemplate).uniqueEffects.map((effect, i) => <li key={i}>{effect}</li>)}
                                    </ul>
                                </div>
                             )}
                             <div className="pt-4 flex flex-col sm:flex-row gap-2">
                                {(() => {
                                    const eq = item as GameTemplates.EquipmentTemplate;
                                    const slotId = eq.slot as EquipmentSlotId;
                                    if (!slotId) return null;
                                    
                                    const isEquipped = knowledgeBase.equippedItems[slotId] === item.id;
                                    
                                    if (isEquipped) {
                                        return (
                                            <Button 
                                                onClick={() => {
                                                    handleUpdateEquipment(slotId, null, item.id);
                                                    onClose();
                                                }}
                                                className="flex-1 bg-red-700/80 hover:bg-red-600 text-white border border-red-500/50"
                                            >
                                                Tháo
                                            </Button>
                                        );
                                    } else {
                                        // Only show equip button if in player inventory
                                        const isInInventory = knowledgeBase.inventory.some(i => i.id === item.id);
                                        if (isInInventory) {
                                            return (
                                                <Button 
                                                    onClick={() => {
                                                        const prev = knowledgeBase.equippedItems[slotId];
                                                        handleUpdateEquipment(slotId, item.id, prev);
                                                        onClose();
                                                    }}
                                                    className="flex-1 bg-emerald-700/80 hover:bg-emerald-600 text-white border border-emerald-500/50"
                                                >
                                                    Trang bị
                                                </Button>
                                            );
                                        }
                                        return null;
                                    }
                                })()}
                                <Button 
                                    onClick={() => {
                                        openUpgradeModal(item);
                                        onClose();
                                    }}
                                    className="flex-1 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold py-2 rounded-lg shadow-lg shadow-amber-900/20 flex items-center justify-center gap-2 transition-all transform active:scale-95"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5" />
                                    </svg>
                                    {VIETNAMESE.upgradeItemButton}
                                </Button>
                             </div>
                        </div>
                    )}
                    {item.category === GameTemplates.ItemCategory.POTION && (
                         <div className="space-y-2 bg-gray-900/40 p-3 rounded-lg">
                            <h4 className="font-semibold text-indigo-300 text-base mb-2">Công dụng đan dược</h4>
                            <StatRow label="Loại đan dược" value={(item as GameTemplates.PotionTemplate).potionType} />
                            {(item as GameTemplates.PotionTemplate).effects && (item as GameTemplates.PotionTemplate).effects.length > 0 && (
                                <div className="pt-2">
                                    <h5 className="text-sm font-semibold text-gray-300 mb-1">Hiệu ứng:</h5>
                                    <ul className="list-disc list-inside pl-2 text-sm space-y-1">
                                        {(item as GameTemplates.PotionTemplate).effects.map((effect, i) => <li key={i}>{effect}</li>)}
                                    </ul>
                                </div>
                             )}
                             {(item as GameTemplates.PotionTemplate).durationTurns ? <StatRow label="Thời gian hiệu lực" value={`${(item as GameTemplates.PotionTemplate).durationTurns} lượt`} /> : null}
                             {(item as GameTemplates.PotionTemplate).cooldownTurns ? <StatRow label="Thời gian hồi" value={`${(item as GameTemplates.PotionTemplate).cooldownTurns} lượt`} /> : null}
                         </div>
                    )}
                </div>
            );
            break;
        }
        case 'skill': {
            const skill = entity as Skill;
            title = skill.name;
            content = (
                 <div className="space-y-4">
                    <p className="text-sm italic text-gray-400 break-words whitespace-normal leading-relaxed">{getSkillDescriptionWithCore(skill)}</p>
                    <div className="space-y-1.5 bg-gray-900/40 p-3 rounded-lg">
                        <StatRow label="Loại" value={skill.skillType} />
                        <StatRow label="Độ thuần thục" value={`${skill.proficiencyTier || 'Sơ Nhập'} (${skill.proficiency || 0}/${skill.maxProficiency || 100} EXP)`} />
                    </div>
                    <div className="space-y-1.5 bg-gray-900/40 p-3 rounded-lg">
                        <h4 className="font-semibold text-indigo-300 text-base mb-2">Thuộc tính chiến đấu</h4>
                        <StatRow label="Tiêu hao" value={`${skill.manaCost || 0} MP`} />
                        <StatRow label="Hồi chiêu" value={`${skill.cooldown || 0} lượt`} />
                        {skill.baseDamage > 0 && <StatRow label="Sát thương cơ bản" value={skill.baseDamage} />}
                        {skill.healingAmount > 0 && <StatRow label="Hồi phục cơ bản" value={skill.healingAmount} />}
                        {skill.damageMultiplier > 0 && <StatRow label="Sát thương theo % ATK" value={`${skill.damageMultiplier * 100}%`} />}
                        {skill.healingMultiplier > 0 && <StatRow label="Hồi phục theo % ATK" value={`${skill.healingMultiplier * 100}%`} />}
                    </div>
                     {skill.detailedEffect && (
                        <div className="space-y-1 bg-gray-900/40 p-3 rounded-lg">
                            <h4 className="font-semibold text-indigo-300 text-base mb-2">Hiệu ứng chi tiết</h4>
                            <p className="text-sm text-gray-300">{skill.detailedEffect}</p>
                        </div>
                     )}
                 </div>
            );
            break;
        }
        case 'quest': {
            const quest = entity as Quest;
            const completedObjectives = quest.objectives.filter(obj => obj.completed).length;
            const totalObjectives = quest.objectives.length;
            const progressPercent = totalObjectives > 0 ? (completedObjectives / totalObjectives) * 100 : 0;

            title = quest.title;
            content = (
                 <div className="space-y-4">
                    <p className="text-sm italic text-gray-400">{quest.description}</p>
                    
                    <div className="bg-gray-900/40 p-4 rounded-xl border border-gray-700/30">
                        <div className="flex justify-between items-end mb-2">
                            <h4 className="font-semibold text-lg text-indigo-300">Mục tiêu</h4>
                            <span className="text-xs font-mono text-gray-400 bg-gray-950 px-2 py-0.5 rounded-full border border-gray-800">
                                Tiến độ: {completedObjectives}/{totalObjectives}
                            </span>
                        </div>

                        {/* Detailed Progress Bar */}
                        <div className="w-full h-2 bg-gray-950 rounded-full overflow-hidden mb-4 border border-gray-800">
                            <div 
                                className="h-full bg-gradient-to-r from-indigo-600 to-indigo-400 transition-all duration-700 ease-out shadow-[0_0_8px_rgba(79,70,229,0.4)]"
                                style={{ width: `${progressPercent}%` }}
                            />
                        </div>

                        <ul className="space-y-2.5">
                            {quest.objectives.map(obj => (
                                <li key={obj.id} className={`flex items-start text-sm ${obj.completed ? 'text-gray-500 line-through' : 'text-gray-200'}`}>
                                    {obj.completed ? 
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-green-500/80 flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg> :
                                        <div className="h-5 w-5 mr-2 flex-shrink-0 flex items-center justify-center mt-0.5">
                                            <div className="h-2 w-2 rounded-full bg-amber-500/60 animate-pulse ring-4 ring-amber-500/10" />
                                        </div>
                                    }
                                    <span className="leading-tight">{obj.text}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {(quest.rewardText || quest.rewardExp || quest.rewardCurrency) && (
                        <div className="bg-green-900/20 p-3 rounded-lg border border-green-700/50">
                            <h4 className="font-semibold text-green-300">{VIETNAMESE.questRewardLabel}</h4>
                            <p className="text-sm text-gray-300">
                                {quest.rewardText || `${quest.rewardCurrency || 0} Linh Thạch, +${quest.rewardExp || 0} Tu Vi`}
                            </p>
                        </div>
                    )}

                    {quest.punishmentText && (
                        <div className="bg-red-900/20 p-3 rounded-lg border border-red-700/50">
                            <h4 className="font-semibold text-red-300">{VIETNAMESE.questPunishmentLabel}</h4>
                            <p className="text-sm text-gray-300">{quest.punishmentText}</p>
                        </div>
                    )}

                    {quest.deadlineTurn && (
                         <div className="text-center text-xs text-red-400 mt-2">
                            {VIETNAMESE.questDeadlineLabel}: Lượt {quest.deadlineTurn}
                         </div>
                     )}

                    {quest.status === 'active' && !isMainQuest(quest) && (
                        <div className="mt-6 pt-4 border-t border-gray-700/50 space-y-2">
                            {confirmFailId === quest.id ? (
                                <div className="space-y-2">
                                    <p className="text-xs text-red-400 text-center font-bold">Xác nhận hủy nhiệm vụ và chịu phạt?</p>
                                    <div className="flex gap-2">
                                        <Button 
                                            onClick={() => {
                                                handleFailQuest(quest.id);
                                                onClose();
                                                setConfirmFailId(null);
                                            }} 
                                            variant="primary" 
                                            className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold"
                                        >
                                            XÁC NHẬN HỦY
                                        </Button>
                                        <Button 
                                            onClick={() => setConfirmFailId(null)} 
                                            variant="secondary" 
                                            className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-200"
                                        >
                                            QUAY LẠI
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <Button 
                                    onClick={() => setConfirmFailId(quest.id)} 
                                    variant="secondary" 
                                    className="w-full bg-red-900/20 hover:bg-red-900/40 text-red-400 border border-red-500/30 font-bold"
                                >
                                    Hủy Nhiệm Vụ (Chấp Nhận Thất Bại)
                                </Button>
                            )}
                            <p className="text-[10px] text-gray-500 mt-2 text-center italic">
                                * Lưu ý: Việc ép buộc/hủy nhiệm vụ sẽ khiến AI tạo ra sự kiện trong lượt tới.
                            </p>
                        </div>
                    )}
                 </div>
            );
            break;
        }
        case 'yeuThu': {
            const yt = entity as YeuThu;
            content = (
                <div className="space-y-3">
                    <div className="text-center group relative flex flex-col items-center">
                        <div className="relative group overflow-hidden rounded-full border-2 border-red-500 shadow-xl mb-3 h-32 w-32 bg-gray-900 flex items-center justify-center">
                             {/* Combined Avatar Layer */}
                             <DynamicAvatar 
                                 hairIndex={(yt as any).avatarHairId ?? 0} 
                                 faceIndex={(yt as any).avatarFaceId ?? 0} 
                                 size={128} 
                             />
                             
                             {(yt.avatarUrl || !(yt as any).gender?.toLowerCase().includes("nữ")) && (
                                 <img 
                                     src={getDeterministicAvatarSrc(yt as any)} 
                                     alt={yt.name} 
                                     className="absolute inset-0 w-full h-full object-contain z-20" 
                                 />
                             )}

                            <button 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onRandomizeAvatarHair('yeuThu', yt.id);
                                }}
                                className="absolute bottom-1 right-1 bg-red-600 hover:bg-red-500 p-2 rounded-full z-30 shadow-lg border border-white/20 transition-all transform active:scale-95"
                                title="Tạo avatar ngẫu nhiên (Cơ học)"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4 text-white">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                                </svg>
                            </button>
                        </div>
                        <h3 className="text-xl font-bold text-red-400">{yt.name}</h3>
                        <p className="text-xs text-gray-400">{yt.species}</p>
                    </div>
                    <p className="text-gray-300 text-sm italic">{yt.description}</p>
                    <div className="bg-gray-900/30 p-2 rounded text-xs">
                        <StatRow label="Cảnh giới" value={yt.realm || 'Không rõ'} />
                        <StatRow label="Thái độ" value={yt.isHostile ? 'Thù địch' : 'Trung lập'} valueClassName={yt.isHostile ? 'text-red-400' : 'text-green-400'} />
                    </div>
                    
                    {yt.stats && (yt.stats.maxSinhLuc != null || yt.stats.sucTanCong != null) && (
                        <div className="bg-gray-900/40 p-3 rounded-lg">
                            <h4 className="font-semibold text-sm text-red-300 border-b border-gray-600 pb-1 mb-2">Chỉ số chiến đấu</h4>
                            <StatDisplayGrid stats={yt.stats} kb={knowledgeBase} />
                        </div>
                    )}
                </div>
            )
            break;
        }
        default:
            content = <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(entity, null, 2)}</pre>
            break;
    }

    return (
        <>
            <Modal isOpen={isOpen} onClose={onClose} title={title}>
                <div className="text-gray-200">
                    {content}
                    
                    {(type === 'npc' || type === 'yeuThu') && (
                        <div className="mt-6 pt-4 border-t border-gray-700 space-y-4">
                            <fieldset className="border border-indigo-700 p-3 rounded-md">
                                <legend className="text-sm font-semibold text-indigo-300 px-1">Tạo Ảnh Bằng AI</legend>
                                <div className="space-y-2 mt-1">
                                    <InputField
                                        label="Mô tả ảnh (Prompt)"
                                        id="npc-avatar-prompt"
                                        value={aiAvatarPrompt}
                                        onChange={(e) => setAiAvatarPrompt(e.target.value)}
                                        textarea
                                        rows={4}
                                        disabled={isLoading}
                                    />
                                    <Button
                                        variant="primary"
                                        className="w-full bg-indigo-600 hover:bg-indigo-700"
                                        onClick={handleGenerateAvatar}
                                        isLoading={isLoading}
                                        loadingText={loadingText}
                                        disabled={!aiAvatarPrompt.trim() || isLoading}
                                    >
                                        Tạo & Tải Lên Ảnh Mới
                                    </Button>
                                    {aiAvatarError && <p className="text-xs text-red-400 text-center">{aiAvatarError}</p>}
                                </div>
                            </fieldset>

                            <div className="text-center text-xs text-gray-500">hoặc</div>
                            
                            <label className={`w-full text-center cursor-pointer font-bold py-2 px-4 rounded text-sm ${isLoading ? 'bg-gray-600 text-gray-400 cursor-not-allowed' : 'bg-gray-600 hover:bg-gray-700 text-white'} block`}>
                                {isLoading ? 'Đang xử lý...' : VIETNAMESE.uploadNpcAvatarLabel}
                                <input 
                                    type="file" 
                                    ref={fileInputRef}
                                    className="hidden" 
                                    accept="image/*"
                                    onChange={(e) => {
                                        if (e.target.files && e.target.files[0]) {
                                            const reader = new FileReader();
                                            reader.onload = (ev) => {
                                                if (ev.target?.result) {
                                                    onUpdateEntityAvatar(type as 'npc' | 'yeuThu', (entity as any).id, ev.target.result as string);
                                                }
                                            };
                                            reader.readAsDataURL(e.target.files[0]);
                                            if (fileInputRef.current) fileInputRef.current.value = "";
                                        }
                                    }}
                                    disabled={isLoading}
                                />
                            </label>
                        </div>
                    )}
                </div>
            </Modal>

            {isConfirmDeleteOpen && person && (
                <Modal
                    isOpen={isConfirmDeleteOpen}
                    onClose={() => setIsConfirmDeleteOpen(false)}
                    title="⚠️ XÁC NHẬN TIÊU DIỆT / XÓA NPC"
                    hideDefaultFooter
                >
                    <div className="p-4 space-y-4 text-gray-200">
                        <p className="text-sm font-medium leading-relaxed">
                            Hành động này sẽ xóa vĩnh viễn dữ liệu của NPC <span className="text-amber-400 font-bold">{person.name}</span> ra khỏi dòng lịch sử thế giới.
                        </p>
                        <div className="bg-red-950/30 border border-red-500/20 p-3 rounded-md text-xs space-y-1 my-2">
                            <p className="text-red-300 font-semibold uppercase tracking-wider mb-1">Cảnh báo hệ quả:</p>
                            <p>• Dữ liệu đối thoại, ký ức và quan hệ của thực thể này sẽ hoàn toàn biến mất.</p>
                            <p>• Phải tiêu hao <span className="text-red-400 font-bold">{Math.floor(knowledgeBase.playerStats.maxKinhNghiem * 0.5)} EXP</span> từ thanh linh căn hiện tại của MC.</p>
                            <p className="text-amber-400 font-medium">• Hệ quả không thể phục hồi hoặc hoàn tác.</p>
                        </div>
                        
                        {(() => {
                            const expCost = Math.floor(knowledgeBase.playerStats.maxKinhNghiem * 0.5);
                            const isEnough = knowledgeBase.playerStats.kinhNghiem >= expCost;
                            const reunionTurns = (person as any).reunionCounter || 0;
                            const isNotInteractedOver20 = reunionTurns > 20;

                            if (!isNotInteractedOver20) {
                                return (
                                    <div className="p-2.5 bg-yellow-950/20 border border-yellow-600/30 text-yellow-400 text-xs rounded-md text-center">
                                        Không thể thực hiện! NPC phải không tương tác trên 20 lượt (Hiện tại mới chỉ có {reunionTurns}/20 lượt chưa gặp).
                                    </div>
                                );
                            }
                            
                            if (!isEnough) {
                                return (
                                    <div className="p-2.5 bg-yellow-950/20 border border-yellow-600/30 text-yellow-400 text-xs rounded-md text-center">
                                        Bạn không đủ kinh nghiệm! Cần <span className="font-bold">{expCost} EXP</span> nhưng bạn chỉ có <span className="font-bold">{knowledgeBase.playerStats.kinhNghiem} EXP</span>.
                                    </div>
                                );
                            }
                            
                            return (
                                <div className="flex gap-3 pt-2">
                                    <Button
                                        onClick={handleDeleteNpc}
                                        className="flex-1 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold py-2 shadow-lg hover:shadow-red-500/20 active:scale-95 transition-all text-xs border border-red-500/20"
                                    >
                                        Chấp Nhận & Xoá NPC
                                    </Button>
                                    <Button
                                        onClick={() => setIsConfirmDeleteOpen(false)}
                                        className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-200 font-bold py-2 text-xs active:scale-95 transition-all"
                                    >
                                        Hủy Bỏ
                                    </Button>
                                </div>
                            );
                        })()}
                    </div>
                </Modal>
            )}
        </>
    );
};

export default EntityDetailModal;
