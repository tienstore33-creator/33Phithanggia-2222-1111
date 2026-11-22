import React, { useState, useMemo } from 'react';
// @FIX: Import DefeatedEntity to resolve type error.
import { CombatEndPayload, CombatDispositionMap, CombatDisposition, KnowledgeBase, NPC, YeuThu, DefeatedEntity } from '../../../types';
import Modal from '../../ui/Modal';
import Button from '../../ui/Button';
import { VIETNAMESE } from '../../../constants';

interface PostCombatVictoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    postCombatState: CombatEndPayload;
    knowledgeBase: KnowledgeBase;
    onConfirm: (dispositions: CombatDispositionMap) => Promise<void>;
    isLoading: boolean;
}

// @FIX: Removed local definition as it's now imported from types.ts

const PostCombatVictoryModal: React.FC<PostCombatVictoryModalProps> = ({ isOpen, onClose, postCombatState, knowledgeBase, onConfirm, isLoading }) => {
    const [dispositions, setDispositions] = useState<CombatDispositionMap>({});

    const allDefeatedEntities: DefeatedEntity[] = useMemo(() => {
        return postCombatState.opponentIds
            .map(id => 
                (knowledgeBase.discoveredNPCs.find(n => n.id === id) as NPC | undefined) || 
                (knowledgeBase.discoveredYeuThu.find(y => y.id === id) as YeuThu | undefined)
            )
            .filter((e): e is NPC | YeuThu => e !== undefined && (e.stats?.sinhLuc ?? 1) <= 0)
            .map((e): DefeatedEntity => {
                if ('species' in e) { // This is a YeuThu
                    return { ...e, entityType: 'yeuThu' };
                } else { // This is an NPC
                    return { ...e, entityType: 'npc' };
                }
            });
    }, [postCombatState.opponentIds, knowledgeBase.discoveredNPCs, knowledgeBase.discoveredYeuThu]);

    const defeatedNpcs = allDefeatedEntities.filter((e): e is (NPC & { entityType: 'npc' }) => e.entityType === 'npc');

    // @FIX: If only beasts are defeated, no disposition is needed. Auto-confirm and close.
    if (isOpen && defeatedNpcs.length === 0) {
        // This effect will run when the modal is supposed to open but there's nothing to decide.
        React.useEffect(() => {
            onConfirm({});
            onClose();
        }, []); // Empty dependency array ensures it runs only once when this condition is met.
        return null; // Don't render the modal
    }

    const setDisposition = (npcId: string, disposition: CombatDisposition) => {
        setDispositions(prev => ({
            ...prev,
            [npcId]: disposition,
        }));
    };

    const handleConfirmAndClose = () => {
        onConfirm(dispositions).finally(() => {
            onClose();
        });
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Kết Quả Trận Đấu">
            <div className="p-4 space-y-4">
                <h3 className="text-2xl font-bold text-center text-green-400">CHIẾN THẮNG!</h3>
                <p className="text-center text-gray-300">Quyết định số phận của kẻ địch đã bị đánh bại:</p>
                <div className="space-y-3 max-h-60 overflow-y-auto custom-scrollbar p-2">
                {defeatedNpcs.map(npc => {
                    const isEnemyRedBorder = !npc.factionId || npc.factionId === 'enemy';
                    const isHpZero = (npc.stats?.sinhLuc ?? 0) <= 0;
                    const canExecuteOrCapture = isEnemyRedBorder && isHpZero;

                    return (
                        <div key={npc.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-gray-700 p-2 rounded-md gap-2">
                            <div className="flex flex-col">
                                <span className="font-semibold">{npc.name} ({npc.realm})</span>
                                {!canExecuteOrCapture && (
                                    <span className="text-[10px] text-amber-300">
                                        {!isEnemyRedBorder ? 'Không phải kẻ địch' : 'HP chưa bằng 0'}
                                    </span>
                                )}
                            </div>
                            <div className="flex gap-2 flex-shrink-0 self-end sm:self-center">
                                <Button 
                                    size="sm" 
                                    variant={dispositions[npc.id] === 'kill' ? 'danger' : 'secondary'} 
                                    onClick={() => setDisposition(npc.id, 'kill')}
                                    disabled={!canExecuteOrCapture}
                                    title={!canExecuteOrCapture ? 'Chỉ có thể kết liễu NPC kẻ địch (viền đỏ) có HP = 0' : ''}
                                >
                                    Kết Liễu
                                </Button>
                                <Button 
                                    size="sm" 
                                    variant={dispositions[npc.id] === 'capture' ? 'primary' : 'secondary'} 
                                    onClick={() => setDisposition(npc.id, 'capture')}
                                    disabled={!canExecuteOrCapture}
                                    title={!canExecuteOrCapture ? 'Chỉ có thể bắt giữ NPC kẻ địch (viền đỏ) có HP = 0' : ''}
                                >
                                    Bắt Giữ
                                </Button>
                                <Button 
                                    size="sm" 
                                    variant={dispositions[npc.id] === 'release' ? 'secondary' : 'secondary'} 
                                    onClick={() => setDisposition(npc.id, 'release')}
                                >
                                    Thả Đi
                                </Button>
                            </div>
                        </div>
                    );
                })}
                </div>
                 <Button
                    variant="primary"
                    size="lg"
                    className="w-full mt-4"
                    onClick={handleConfirmAndClose}
                    isLoading={isLoading}
                    loadingText="Đang xử lý..."
                >
                    {VIETNAMESE.confirmPostCombatActions}
                </Button>
            </div>
        </Modal>
    );
};

export default PostCombatVictoryModal;