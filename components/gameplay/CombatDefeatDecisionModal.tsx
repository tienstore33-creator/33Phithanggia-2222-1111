import React from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';

interface CombatDefeatDecisionModalProps {
  isOpen: boolean;
  onMinimize: () => void;
  onSelectAction: (action: 'surrender' | 'flee' | 'suicide') => void;
  isLoading: boolean;
}

export const CombatDefeatDecisionModal: React.FC<CombatDefeatDecisionModalProps> = ({
  isOpen,
  onMinimize,
  onSelectAction,
  isLoading
}) => {
  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onMinimize} 
      hideDefaultFooter={true}
      title={
        <div className="flex items-center justify-between w-full pr-2">
          <span>KẾT QUẢ TRẬN ĐẤU - CHIẾN BẠI</span>
          <button
            type="button"
            onClick={onMinimize}
            className="text-xs bg-gray-700 hover:bg-gray-600 text-red-300 px-2 py-1 rounded border border-gray-600 flex items-center gap-1"
          >
            ➖ Thu nhỏ
          </button>
        </div>
      }
    >
      <div className="p-4 space-y-4">
        <h3 className="text-2xl font-bold text-center text-red-500">BẠN ĐÃ BỊ ĐÁNH BẠI!</h3>
        <p className="text-center text-gray-300 text-sm">
          Sinh lực của bạn đã cạn kiệt. Kẻ địch đang áp sát, hãy đưa ra quyết định cuối cùng của bạn!
        </p>
        <div className="flex flex-col gap-3 mt-6">
          <Button variant="secondary" className="w-full bg-gray-700 hover:bg-gray-600 justify-start h-12" onClick={() => onSelectAction('surrender')} disabled={isLoading}>
            🏳️ Đầu Hàng (Trở thành Tù Binh)
          </Button>
          <Button variant="secondary" className="w-full bg-blue-900/50 hover:bg-blue-800 border border-blue-700 justify-start h-12 text-blue-200" onClick={() => onSelectAction('flee')} disabled={isLoading}>
            🏃 Bỏ Chạy (Tỉ lệ trốn thoát ngẫu nhiên)
          </Button>
          <Button variant="danger" className="w-full justify-start h-12" onClick={() => onSelectAction('suicide')} disabled={isLoading}>
            🗡️ Tự Sát (Bảo toàn danh dự)
          </Button>
        </div>
        <div className="flex justify-start mt-2 pt-2 border-t border-gray-700">
          <Button variant="ghost" size="sm" onClick={onMinimize} className="text-gray-400">
            👁️ Tạm thu nhỏ để xem nhật ký
          </Button>
        </div>
      </div>
    </Modal>
  );
};
