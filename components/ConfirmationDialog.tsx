import React from 'react';
import Modal from './ui/Modal';
import Button from './ui/Button';

interface ConfirmationDialogProps {
  isOpen: boolean;
  count: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({ 
  isOpen, 
  count, 
  onConfirm, 
  onCancel 
}) => (
  <Modal 
    isOpen={isOpen} 
    onClose={onCancel} 
    title="Xác nhận xóa hàng loạt"
  >
    <div className="p-4">
      <p className="text-lg text-gray-200 mb-6">
        Bạn có chắc chắn muốn xóa <span className="text-red-400 font-bold">{count}</span> file lưu đã chọn không? Hành động này không thể hoàn tác.
      </p>
      <div className="flex justify-end space-x-4">
        <Button variant="ghost" onClick={onCancel}>
          Hủy
        </Button>
        <Button variant="danger" onClick={onConfirm}>
          Xác nhận xóa
        </Button>
      </div>
    </div>
  </Modal>
);
