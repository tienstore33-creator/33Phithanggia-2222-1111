
import React, { useState } from 'react';
import Modal from './Modal';
import Button from './Button';
import { VIETNAMESE } from '../../constants';

interface CustomPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (prompt: string) => void;
  title: string;
  placeholder?: string;
  isLoading?: boolean;
}

const CustomPromptModal: React.FC<CustomPromptModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  placeholder = "Ví dụ: 'Thêm NPC sư phụ đang bị trọng thương', 'Vũ khí khởi đầu là một thanh đoản kiếm rỉ sét'...",
  isLoading = false
}) => {
  const [prompt, setPrompt] = useState('');

  const handleConfirm = () => {
    if (!prompt.trim()) return;
    onConfirm(prompt);
    setPrompt('');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="space-y-4">
        <p className="text-sm text-gray-400">
          Nhập yêu cầu cụ thể của bạn. AI sẽ dựa trên yêu cầu này để tinh chỉnh nội dung phù hợp.
        </p>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={placeholder}
          className="w-full h-32 bg-gray-800 border border-gray-700 rounded-md p-3 text-sm text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none resize-none"
          disabled={isLoading}
        />
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={isLoading}>
            Hủy Bỏ
          </Button>
          <Button 
            variant="primary" 
            onClick={handleConfirm} 
            disabled={isLoading || !prompt.trim()}
            isLoading={isLoading}
          >
            ✨ Thực Thi Yêu Cầu
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default CustomPromptModal;
