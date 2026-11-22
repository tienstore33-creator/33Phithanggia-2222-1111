import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { KnowledgeBase, Wife, Slave, PlayerStats, Prisoner, NPC } from '../../../types';
import Modal from '../../ui/Modal';
import Button from '../../ui/Button';
import { getDeterministicAvatarSrc } from '../../../utils/avatarUtils';
import { MAX_COMBAT_COMPANIONS, VIETNAMESE, SUB_REALM_NAMES } from '../../../constants';

interface CompanionSelectionForCombatModalProps {
    isOpen: boolean;
    onClose: () => void;
    knowledgeBase: KnowledgeBase;
    onSave: (selectedIds: string[]) => void;
    initialSelection?: string[]; // Optional: Allow overriding initial selection (e.g., for mid-combat swap)
}



// NEW: Define a union type for all potential combat members
type PotentialCompanion = Wife | Slave | Prisoner | NPC;

const CompanionEntry: React.FC<{
    companion: PotentialCompanion;
    isSelected: boolean;
    onToggle: (id: string) => void;
    isDisabled: boolean;
}> = ({ companion, isSelected, onToggle, isDisabled }) => {
    const stats: Partial<PlayerStats> = companion.stats || {};
    
    let role = 'Tù Binh / Nô Lệ';
    if ('entityType' in companion && (companion as any).entityType) {
        switch((companion as any).entityType) {
            case 'wife': role = 'Đạo Lữ'; break;
            case 'slave': role = 'Nô Lệ'; break;
            case 'prisoner': role = 'Tù Binh'; break;
        }
    } else if ('price' in companion || (companion as any).isSlave) {
        role = 'Nô Lệ';
    } else if ('captureTurn' in companion || (companion as any).isPrisoner) {
        role = 'Tù Binh';
    }

    const satisfaction = (companion as any).satisfaction !== undefined ? (companion as any).satisfaction : 100;

    return (
        <div 
            className={`flex items-center gap-4 p-3 rounded-lg border transition-colors duration-150 ${isSelected ? 'bg-indigo-800/60 border-indigo-500' : 'bg-gray-700/50 border-gray-600'} ${isDisabled && !isSelected ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-gray-700'}`}
            onClick={() => (!isDisabled || isSelected) && onToggle(companion.id)}
            role="checkbox"
            aria-checked={isSelected}
            tabIndex={0}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (!isDisabled || isSelected) && onToggle(companion.id)}
        >
            <input
                type="checkbox"
                checked={isSelected}
                onChange={() => {}} // Click is handled by the div
                disabled={isDisabled && !isSelected}
                className="h-5 w-5 rounded text-indigo-500 bg-gray-600 border-gray-500 focus:ring-indigo-400 shrink-0"
            />
            <img src={getDeterministicAvatarSrc(companion)} alt={companion.name} className="w-12 h-12 rounded-full object-cover flex-shrink-0"/>
            <div className="flex-grow grid grid-cols-2 gap-x-4 text-xs">
                <div className="col-span-2">
                    <p className="font-semibold text-base text-gray-100">{companion.name}</p>
                    <p className="text-gray-400">{companion.realm} - <span className="font-semibold">{role}</span></p>
                </div>
                <p><strong className="text-gray-400">HP:</strong> {stats.sinhLuc ?? '??'}/{stats.maxSinhLuc ?? '??'}</p>
                <p><strong className="text-gray-400">ATK:</strong> {stats.sucTanCong ?? '??'}</p>
                <p><strong className="text-gray-400">Thiện cảm:</strong> {companion.affinity}</p>
                <p><strong className="text-gray-400">Thỏa mãn:</strong> {satisfaction}%</p>
            </div>
        </div>
    );
};


const CompanionSelectionForCombatModal: React.FC<CompanionSelectionForCombatModalProps> = ({ isOpen, onClose, knowledgeBase, onSave, initialSelection }) => {
    const [selectedIds, setSelectedIds] = useState(new Set(initialSelection || knowledgeBase.combatCompanionIds || []));
    const [sortOrder, setSortOrder] = useState<'affinity' | 'realm' | 'satisfaction'>('affinity');
    const [sortDirection, setSortDirection] = useState<'desc' | 'asc'>('desc');
    
    useEffect(() => {
        if (isOpen) {
            setSelectedIds(new Set(initialSelection || knowledgeBase.combatCompanionIds || []));
        }
    }, [isOpen, knowledgeBase.combatCompanionIds, initialSelection]);

    const getRealmSortValue = useCallback((realm: string | undefined): number => {
        const realmProgressionList = knowledgeBase.realmProgressionList || [];
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
    
        if (mainRealmIndex === -1) {
            return 0; 
        }
    
        return mainRealmIndex * 10 + subRealmIndex;
    }, [knowledgeBase.realmProgressionList]);

    const allEligibleCompanions: PotentialCompanion[] = useMemo(() => {
        const companions: PotentialCompanion[] = [];
        
        // Requirement 2: Danh sách này sẽ chỉ bao gồm nô lệ tù binh không được phép đưa các npc khác vào
        if (knowledgeBase.slaves) companions.push(...knowledgeBase.slaves);
        if (knowledgeBase.prisoners) companions.push(...knowledgeBase.prisoners);
        
        const uniqueCompanions = Array.from(new Map(companions.map(c => [c.id, c])).values());

        uniqueCompanions.sort((a, b) => {
            let res = 0;
            if (sortOrder === 'realm') {
                const valA = getRealmSortValue(a.realm);
                const valB = getRealmSortValue(b.realm);
                res = valA - valB;
            } else if (sortOrder === 'satisfaction') {
                const satA = (a as any).satisfaction !== undefined ? (a as any).satisfaction : 100;
                const satB = (b as any).satisfaction !== undefined ? (b as any).satisfaction : 100;
                res = satA - satB;
            } else { // default 'affinity'
                res = a.affinity - b.affinity;
            }
            if (res === 0) {
                res = (a.name || '').localeCompare(b.name || '');
            }
            return sortDirection === 'desc' ? -res : res;
        });
        
        return uniqueCompanions;
    }, [knowledgeBase.slaves, knowledgeBase.prisoners, sortOrder, sortDirection, getRealmSortValue]);

    const handleToggle = (id: string) => {
        setSelectedIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else if (newSet.size < MAX_COMBAT_COMPANIONS) {
                newSet.add(id);
            }
            return newSet;
        });
    };
    
    const handleSave = () => {
        // Requirement 4: Ưu tiên đưa những NPC từ dưới cùng danh sách vào trận chiến khi vượt giới hạn
        const finalIds = Array.from(selectedIds).slice(-MAX_COMBAT_COMPANIONS);
        onSave(finalIds);
        onClose();
    };

    const handleToggleSelectAll = () => {
        if (selectedIds.size === 0) {
            // Requirement 4: Ưu tiên đưa những NPC từ dưới cùng danh sách vào trận chiến
            const toSelect = allEligibleCompanions.slice(-MAX_COMBAT_COMPANIONS).map(c => c.id);
            setSelectedIds(new Set(toSelect));
        } else {
            setSelectedIds(new Set());
        }
    };

    const isSelectionDisabled = selectedIds.size >= MAX_COMBAT_COMPANIONS;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Chọn Đội Hình Chiến Đấu">
            <div className="flex flex-col h-[65vh]">
                <div className="flex justify-between items-center mb-3 text-sm flex-shrink-0 border-b border-gray-700 pb-2 flex-wrap gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                         <Button 
                            variant="secondary" 
                            size="sm" 
                            onClick={() => setSortOrder(prev => prev === 'affinity' ? 'realm' : prev === 'realm' ? 'satisfaction' : 'affinity')}
                            className="text-xs"
                         >
                            Sắp xếp: {sortOrder === 'affinity' ? 'Thiện Cảm' : sortOrder === 'realm' ? 'Cảnh Giới' : 'Độ Thỏa Mãn'}
                        </Button>
                         <Button 
                            variant="secondary" 
                            size="sm" 
                            onClick={() => setSortDirection(prev => prev === 'desc' ? 'asc' : 'desc')}
                            className="text-xs font-semibold text-indigo-300 border-indigo-500/50"
                            title="Đổi chiều sắp xếp: từ dưới lên cao hoặc từ cao xuống thấp"
                         >
                            {sortDirection === 'desc' ? '↓ Cao -> Thấp' : '↑ Thấp -> Cao'}
                        </Button>
                    </div>
                    <p className="text-gray-300 text-xs sm:text-sm">
                        Đã chọn: <span className="text-indigo-300 font-bold">{selectedIds.size}/{MAX_COMBAT_COMPANIONS}</span>
                    </p>
                </div>
                <div className="flex-grow overflow-y-auto custom-scrollbar pr-2 -mr-2 space-y-3">
                    {allEligibleCompanions.length === 0 ? (
                        <p className="text-center italic text-gray-400 py-8">Không có nô lệ hoặc tù binh nào phù hợp để tham gia đội hình.</p>
                    ) : (
                        allEligibleCompanions.map(companion => (
                            <CompanionEntry
                                key={companion.id}
                                companion={companion}
                                isSelected={selectedIds.has(companion.id)}
                                onToggle={handleToggle}
                                isDisabled={isSelectionDisabled}
                            />
                        ))
                    )}
                </div>
                <div className="mt-4 pt-4 border-t border-gray-700 flex-shrink-0 flex gap-2">
                    <Button 
                        variant="secondary" 
                        className="w-1/3 text-xs sm:text-sm whitespace-nowrap"
                        onClick={handleToggleSelectAll}
                        disabled={allEligibleCompanions.length === 0}
                        title={selectedIds.size === 0 ? "Chọn tất cả" : "Bỏ chọn tất cả"}
                    >
                        {selectedIds.size === 0 ? 'Chọn tất cả' : 'Bỏ chọn tất cả'}
                    </Button>
                    <Button 
                        variant="primary" 
                        className="w-2/3 text-xs sm:text-sm"
                        onClick={handleSave}
                    >
                        Xác Nhận Đội Hình
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

export default CompanionSelectionForCombatModal;
