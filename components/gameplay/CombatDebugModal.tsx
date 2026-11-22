import React from 'react';
import Button from '../ui/Button';

interface CombatDebugModalProps {
  isOpen: boolean;
  title: string;
  content: string;
  onClose: () => void;
}

export const CombatDebugModal: React.FC<CombatDebugModalProps> = ({
  isOpen,
  title,
  content,
  onClose
}) => {
  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(content).catch(err => {
      console.error("Failed to copy text: ", err);
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-4xl h-[80vh] flex flex-col bg-slate-900 border border-blue-500/50 rounded-xl shadow-[0_0_15px_rgba(59,130,246,0.3)] overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-blue-500/30 bg-slate-800/50">
          <h2 className="text-lg font-bold text-blue-300 font-tech uppercase tracking-wider flex items-center gap-2">
            <span className="text-blue-500">⚙️</span> {title}
          </h2>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors p-1"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 bg-slate-950 font-mono text-xs sm:text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
          {content || '(Không có dữ liệu)'}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-blue-500/30 bg-slate-800/50 flex justify-between items-center">
          <Button 
            variant="outline"
            className="border-blue-500/50 text-blue-300 hover:bg-blue-900/50"
            onClick={handleCopy}
          >
            📋 Copy to Clipboard
          </Button>
          <Button 
            onClick={onClose}
            className="bg-blue-600 hover:bg-blue-500 text-white"
          >
            ĐÓNG
          </Button>
        </div>
      </div>
    </div>
  );
};
