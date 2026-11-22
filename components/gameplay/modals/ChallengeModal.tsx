
import React, { useState, useMemo } from 'react';
import { KnowledgeBase, NPC, Wife, Slave, Prisoner, PlayerStats } from '../../../types';
import Modal from '../../ui/Modal';
import Button from '../../ui/Button';
import { VIETNAMESE } from '../../../constants';
import { getDeterministicAvatarSrc } from '../../../utils/avatarUtils';
import { useGame } from '../../../hooks/useGame';

type ChallengeTarget = NPC | Wife | Slave | Prisoner;

const ChallengeTargetEntry: React.FC<{
    target: ChallengeTarget;
    onSelect: (target: ChallengeTarget) => void;
}> = ({ target, onSelect }) => {
    const stats: Partial<PlayerStats> = target.stats || {};
    let role = 'NPC';
    if ('entityType' in target && (target as any).entityType) {
        switch((target as any).entityType) {
            case 'wife': role = 'Đạo Lữ'; break;
            case 'slave': role = 'Nô Lệ'; break;
            case 'prisoner': role = 'Tù Nhân'; break;
        }
    }

    return (
        <div 
            className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg hover:bg-red-900/30 border border-gray-600 hover:border-red-500 cursor-pointer transition-all duration-200 group"
            onClick={() => onSelect(target)}
        >
            <div className="flex items-center gap-3">
                <img 
                    src={getDeterministicAvatarSrc(target)} 
                    alt={target.name} 
                    className="w-12 h-12 rounded-full object-cover border-2 border-gray-500 group-hover:border-red-500 transition-colors"
                />
                <div>
                    <p className="font-bold text-gray-200 group-hover:text-red-300">{target.name}</p>
                    <p className="text-xs text-gray-400">{target.realm || 'Không rõ'} - <span className="font-medium text-gray-300">{role}</span></p>
                </div>
            </div>
            <div className="text-right">
                 <Button size="sm" variant="danger" className="text-xs pointer-events-none">
                    Khiêu Chiến
                 </Button>
            </div>
        </div>
    );
};

const ChallengeModal: React.FC = () => {
    const { uiState, setUiState, knowledgeBase, handleStartChallenge } = useGame();
    const [searchTerm, setSearchTerm] = useState('');

    const targets = useMemo(() => {
        const currentLocationId = knowledgeBase.currentLocationId;
        if (!currentLocationId) return [];

        const allPotentialTargets = [
            ...knowledgeBase.discoveredNPCs.filter(npc => npc.locationId === currentLocationId),
            ...knowledgeBase.wives.filter(w => (w as any).locationId === currentLocationId),
            ...knowledgeBase.slaves.filter(s => (s as any).locationId === currentLocationId),
            ...knowledgeBase.prisoners.filter(p => (p as any).locationId === currentLocationId)
        ];

        return allPotentialTargets.filter(t => 
            t.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [knowledgeBase, searchTerm]);

    const handleClose = () => {
        setUiState(prev => ({ ...prev, isChallengeModalOpen: false }));
    };

    const handleSelectTarget = (target: ChallengeTarget) => {
        handleStartChallenge(target);
        handleClose();
    };

    if (!uiState.isChallengeModalOpen) return null;

    return (
        <Modal isOpen={true} onClose={handleClose} title={VIETNAMESE.challengeModalTitle || "Chọn Đối Thủ"}>
            <div className="space-y-4">
                <p className="text-sm text-gray-300 bg-red-900/20 p-2 rounded border border-red-800/50">
                    {VIETNAMESE.challengeWarning || "Cảnh báo: Hành động này có thể gây ra hậu quả nghiêm trọng với mối quan hệ của bạn và phe phái của đối thủ."}
                </p>

                <div className="relative">
                    <input
                        type="text"
                        placeholder="Tìm kiếm tên..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full p-2 bg-gray-800 border border-gray-600 rounded-md text-sm text-gray-200 focus:ring-red-500 focus:border-red-500"
                    />
                </div>

                <div className="max-h-[50vh] overflow-y-auto custom-scrollbar space-y-2 pr-1">
                    {targets.length > 0 ? (
                        targets.map(target => (
                            <ChallengeTargetEntry 
                                key={target.id} 
                                target={target} 
                                onSelect={handleSelectTarget} 
                            />
                        ))
                    ) : (
                        <p className="text-center text-gray-500 italic py-4">Không tìm thấy mục tiêu nào ở đây.</p>
                    )}
                </div>

                <div className="flex justify-end pt-2 border-t border-gray-700">
                    <Button variant="secondary" onClick={handleClose}>
                        {VIETNAMESE.cancelButton || "Hủy Bỏ"}
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

export default ChallengeModal;
