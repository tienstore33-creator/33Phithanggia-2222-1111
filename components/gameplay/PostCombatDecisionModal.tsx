import React, { useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { CombatDisposition, CombatDispositionMap } from '../../types';

interface PostCombatDecisionModalProps {
  isOpen: boolean;
  onMinimize: () => void;
  defeatedNpcs: any[];
  onConfirm: (dispositions: CombatDispositionMap) => void;
  isLoading: boolean;
}

export const PostCombatDecisionModal: React.FC<PostCombatDecisionModalProps> = ({
  isOpen,
  onMinimize,
  defeatedNpcs,
  onConfirm,
  isLoading
}) => {
  const [localDispositions, setLocalDispositions] = useState<CombatDispositionMap>({});

  const setDisposition = (npcId: string, disposition: CombatDisposition) => {
    setLocalDispositions(prev => ({
      ...prev,
      [npcId]: disposition
    }));
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onMinimize} 
      hideDefaultFooter={true}
      title={
        <div className="flex items-center justify-between w-full pr-2">
          <span>KẾT QUẢ TRẬN ĐẤU</span>
          <button
            type="button"
            onClick={onMinimize}
            className="text-xs bg-gray-700 hover:bg-gray-600 text-cyan-300 px-2 py-1 rounded border border-gray-600 flex items-center gap-1 transition-all"
            title="Tạm thời thu nhỏ để đọc lại nhật ký chiến đấu"
          >
            ➖ Thu nhỏ
          </button>
        </div>
      }
    >
      <div className="p-4 space-y-4">
        <h3 className="text-2xl font-bold text-center text-green-400">CHIẾN THẮNG!</h3>
        <p className="text-center text-gray-300 text-sm">
          Quyết định số phận của kẻ địch đã bị đánh bại:
        </p>

        <div className="space-y-3 max-h-60 overflow-y-auto custom-scrollbar p-2">
          {defeatedNpcs.map((npc, idx) => {
            const entityId = npc.id || `enemy_${idx}`;
            const currentChoice = localDispositions[entityId] || 'release';
            return (
              <div key={entityId} className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-gray-700/80 p-3 rounded-lg gap-2 border border-gray-600">
                <span className="font-semibold text-white">
                  {npc.name} {npc.canhGioi ? `(${npc.canhGioi})` : ''}
                </span>
                <div className="flex gap-2 flex-wrap">
                  <Button 
                    size="sm" 
                    variant={currentChoice === 'kill' ? 'danger' : 'secondary'} 
                    onClick={() => setDisposition(entityId, 'kill')}
                  >
                    ☠️ Kết Liễu
                  </Button>
                  <Button 
                    size="sm" 
                    variant={currentChoice === 'capture' ? 'primary' : 'secondary'} 
                    onClick={() => setDisposition(entityId, 'capture')}
                  >
                    🕸️ Bắt Giữ
                  </Button>
                  <Button 
                    size="sm" 
                    variant={currentChoice === 'release' ? 'secondary' : 'secondary'} 
                    onClick={() => setDisposition(entityId, 'release')}
                    className={currentChoice === 'release' ? 'bg-emerald-600 text-white' : ''}
                  >
                    🕊️ Thả Đi
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-700">
          <Button variant="secondary" onClick={onMinimize} disabled={isLoading}>
            👁️ Tạm Thu Nhỏ
          </Button>
          <Button variant="primary" onClick={() => onConfirm(localDispositions)} disabled={isLoading}>
            {isLoading ? 'Đang Xử Lý...' : 'Xác Nhận & Tiếp Tục ⚡'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
