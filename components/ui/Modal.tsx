import React, { useState, useEffect, useRef } from 'react';
import Button from './Button';
import { VIETNAMESE } from '../../constants';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
  maxWidth?: string;
  hideDefaultFooter?: boolean;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, maxWidth = "max-w-lg", hideDefaultFooter = false }) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const [isRagActive, setIsRagActive] = useState(() => localStorage.getItem('isRagSystemActive') === 'true');

  useEffect(() => {
    const handleRagChange = () => {
      setIsRagActive(localStorage.getItem('isRagSystemActive') === 'true');
    };
    window.addEventListener('rag-system-change', handleRagChange);
    return () => window.removeEventListener('rag-system-change', handleRagChange);
  }, []);

  useEffect(() => {
    if (isOpen) {
      modalRef.current?.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscKey);
    }

    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleToggleRag = () => {
    const currentState = localStorage.getItem('isRagSystemActive') === 'true';
    const nextVal = !currentState;
    localStorage.setItem('isRagSystemActive', nextVal ? 'true' : 'false');
    setIsRagActive(nextVal);
    window.dispatchEvent(new Event('rag-system-change'));
  };

  const isGuideModal = typeof title === 'string' && title === "Hướng Dẫn Sử Dụng";

  return (
    <div 
      className="absolute inset-0 bg-black/80 flex items-center justify-center z-[9999] p-2 sm:p-4 backdrop-blur-sm"
      onClick={onClose} 
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div 
        ref={modalRef}
        className={`bg-gray-800 rounded-xl shadow-2xl w-full ${maxWidth} max-h-[90vh] flex flex-col relative text-gray-100 border transition-all duration-500 ${
          isRagActive && isGuideModal
            ? 'border-purple-500 shadow-[0_0_25px_rgba(168,85,247,0.4)]'
            : 'border-gray-700'
        } mx-auto`}
        onClick={(e) => e.stopPropagation()} 
        tabIndex={-1}
      >
        <div className="flex justify-between items-center p-4 sm:p-6 pb-2 sm:pb-4 border-b border-gray-700 flex-shrink-0">
          <h2 id="modal-title" className="text-xl sm:text-2xl font-bold text-amber-400 uppercase tracking-tight flex items-center gap-1.5 flex-wrap">
            {title}
            
            {isGuideModal && (
              <button
                type="button"
                onClick={handleToggleRag}
                className={`text-[11px] font-black transition-all active:scale-90 ml-1.5 focus:outline-none ${
                  isRagActive 
                  ? 'text-purple-500 drop-shadow-[0_0_5px_rgba(168,85,247,0.8)]' 
                  : 'text-gray-600'
                }`}
                title={isRagActive ? "Hệ thống RAG: ĐANG BẬT" : "Hệ thống RAG: ĐANG TẮT"}
              >
                ©
              </button>
            )}
          </h2>
          <Button 
            onClick={onClose} 
            variant="ghost" 
            size="sm" 
            aria-label={VIETNAMESE.closeButton}
            className="text-gray-400 hover:text-white p-1"
            type="button"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 sm:w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </Button>
        </div>
        <div className="text-gray-200 flex-grow overflow-y-auto overflow-x-auto p-4 sm:p-6 custom-scrollbar scroll-smooth">
          {children}
        </div>
        {!hideDefaultFooter && (
          <div className="p-4 sm:p-6 pt-2 sm:pt-4 border-t border-gray-700 flex justify-center sm:justify-end flex-shrink-0 bg-gray-850/50 rounded-b-xl gap-2">
              <Button onClick={onClose} variant="secondary" type="button" className="w-full sm:w-auto px-8">
                {VIETNAMESE.closeButton}
              </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Modal;
