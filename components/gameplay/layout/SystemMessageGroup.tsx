
import React, { useState, useEffect } from 'react';
import { GameMessage } from '../../../types';
import Modal from '../../ui/Modal';

interface SystemMessageGroupProps {
  messages: GameMessage[];
  isDevMode?: boolean;
}

const SystemMessageGroup: React.FC<SystemMessageGroupProps> = ({ messages, isDevMode }) => {
  const [showModalType, setShowModalType] = useState<'sent' | 'received' | null>(null);
  const [logContent, setLogContent] = useState('');
  const [isRagActive, setIsRagActive] = useState(() => localStorage.getItem('isRagSystemActive') === 'true');

  useEffect(() => {
    const handleRagChange = () => {
      setIsRagActive(localStorage.getItem('isRagSystemActive') === 'true');
    };
    window.addEventListener('rag-system-change', handleRagChange);
    return () => window.removeEventListener('rag-system-change', handleRagChange);
  }, []);

  if (messages.length === 0) {
    return null;
  }

  const turnNumber = messages[0]?.turnNumber;

  const handleShowLog = (type: 'sent' | 'received') => {
    try {
      const stored = localStorage.getItem('latest_sync_logs');
      const logsList = stored ? JSON.parse(stored) : [];
      const target = logsList.find((l: any) => l.turn === turnNumber) || (logsList.length > 0 ? logsList[logsList.length - 1] : null);
      
      if (target) {
        const content = type === 'sent' ? target.prompt : target.response;
        setLogContent(content || "Không có nội dung dữ liệu.");
      } else {
        setLogContent("Chưa có dữ liệu đồng bộ Fast Agent nào trong bộ nhớ đệm.");
      }
      setShowModalType(type);
    } catch (e) {
      console.warn("Failed to read sync logs", e);
      setLogContent("Có lỗi xảy ra khi đọc dữ liệu.");
      setShowModalType(type);
    }
  };
  
  return (
    <div className="bg-black/25 border-l-2 border-indigo-500/50 text-indigo-300 font-mono text-xs sm:text-sm p-3 rounded-r-md shadow-sm space-y-1.5 animate-fade-in relative group">
        {isRagActive && turnNumber !== undefined && (
          <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button 
              onClick={() => handleShowLog('sent')}
              className="px-2 py-0.5 text-[10px] uppercase font-bold bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 border border-amber-500/30 rounded transition-colors"
            >
              Gửi
            </button>
            <button 
              onClick={() => handleShowLog('received')}
              className="px-2 py-0.5 text-[10px] uppercase font-bold bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border border-emerald-500/30 rounded transition-colors"
            >
              Nhận
            </button>
          </div>
        )}
        {messages.map((msg, index) => (
          <div key={`${msg.id}-${index}`} className="flex gap-2">
            <span className="opacity-50 shrink-0">::</span>
            <span className="opacity-90">{msg.content}</span>
          </div>
        ))}
        {showModalType && (
          <Modal
            isOpen={!!showModalType}
            onClose={() => setShowModalType(null)}
            title={
              <div className="flex justify-between items-center w-full pr-4">
                <span>{showModalType === 'sent' ? `Nội dung thô gửi AI đồng bộ - Lượt ${turnNumber}` : `Nội dung AI trả về đồng bộ - Lượt ${turnNumber}`}</span>
                <button
                  onClick={() => {
                    const blob = new Blob([logContent], { type: 'text/plain;charset=utf-8' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `AI_Sync_${showModalType}_Turn_${turnNumber}.txt`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="px-3 py-1 text-xs font-semibold bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 rounded border border-indigo-500/50 transition-colors"
                >
                  Tải xuống TXT
                </button>
              </div>
            }
          >
            <div className="p-4 bg-gray-950 text-gray-300 font-mono text-xs overflow-auto max-h-[70vh] rounded m-4 border border-gray-800">
                <pre className="whitespace-pre-wrap font-inherit font-mono break-words">
                  {logContent ? logContent.replace(/\\n/g, '\n').replace(/\\r/g, '') : ''}
                </pre>
            </div>
          </Modal>
        )}
    </div>
  );
};

export default SystemMessageGroup;
