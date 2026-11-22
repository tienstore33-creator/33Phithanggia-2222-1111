import React from 'react';
import { MessageSquare, Trash2, Plus, Clock, X, Check, MessageSquarePlus } from 'lucide-react';
import Button from '../ui/Button';
import { ChatMessage, ChatSession } from '../../types/chatbot';

export type { ChatMessage, ChatSession };


interface ChatSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessions: ChatSession[];
  currentSessionId: string;
  onSelectSession: (session: ChatSession) => void;
  onDeleteSession: (sessionId: string) => void;
  onClearAllSessions: () => void;
  onNewSession: () => void;
}

export const ChatSessionModal: React.FC<ChatSessionModalProps> = ({
  isOpen,
  onClose,
  sessions,
  currentSessionId,
  onSelectSession,
  onDeleteSession,
  onClearAllSessions,
  onNewSession,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div 
        className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-gray-800 flex items-center justify-between bg-gray-950/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-950/80 border border-indigo-700/50 rounded-lg text-indigo-400">
              <MessageSquare size={18} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-gray-100 flex items-center gap-2">
                Lịch Sử Các Đoạn Chat
                <span className="text-xs bg-indigo-950 text-indigo-300 border border-indigo-800/60 px-2 py-0.5 rounded-full font-mono">
                  {sessions.length} đoạn hội thoại
                </span>
              </h2>
              <p className="text-xs text-gray-400">
                Lưu trữ các phiên đối thoại độc lập, không làm ảnh hưởng lẫn nhau.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-gray-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Action Bar */}
        <div className="p-3 bg-gray-950/40 border-b border-gray-800 flex items-center justify-between gap-2 px-4 sm:px-5">
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              onNewSession();
              onClose();
            }}
            className="text-xs py-1.5 px-3 bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-1.5 rounded-lg font-medium shadow"
          >
            <MessageSquarePlus size={14} />
            <span>Tạo Đoạn Chat Mới</span>
          </Button>

          {sessions.length > 0 && (
            <Button
              variant="danger"
              size="sm"
              onClick={onClearAllSessions}
              className="text-xs py-1.5 px-2.5 flex items-center gap-1.5 rounded-lg opacity-80 hover:opacity-100"
            >
              <Trash2 size={13} />
              <span className="hidden sm:inline">Xoá toàn bộ lịch sử</span>
            </Button>
          )}
        </div>

        {/* Sessions List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-2.5 custom-scrollbar">
          {sessions.length === 0 ? (
            <div className="text-center py-12 text-gray-500 text-sm">
              <MessageSquare size={36} className="mx-auto mb-2 opacity-30" />
              <p>Chưa có đoạn chat nào được lưu trong lịch sử.</p>
              <p className="text-xs text-gray-600 mt-1">Khi bạn bấm "Tạo chat mới", đoạn chat hiện tại sẽ tự động được lưu tại đây.</p>
            </div>
          ) : (
            sessions.map((session) => {
              const isCurrent = session.id === currentSessionId;
              const userMsgCount = session.messages.filter(m => m.sender === 'user').length;
              const totalMsgCount = session.messages.length;

              return (
                <div
                  key={session.id}
                  onClick={() => {
                    onSelectSession(session);
                    onClose();
                  }}
                  className={`group p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                    isCurrent
                      ? 'bg-indigo-950/40 border-indigo-500/60 shadow-md shadow-indigo-950/30'
                      : 'bg-gray-800/40 border-gray-800 hover:bg-gray-800/80 hover:border-gray-700'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-sm font-semibold truncate ${isCurrent ? 'text-indigo-300' : 'text-gray-200 group-hover:text-white'}`}>
                        {session.title || 'Đoạn chat không tiêu đề'}
                      </span>
                      {isCurrent && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-900/80 text-indigo-300 border border-indigo-700/60 flex items-center gap-1 flex-shrink-0">
                          <Check size={10} /> Đang mở
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <span className="flex items-center gap-1">
                        <Clock size={12} className="text-gray-500" />
                        {session.updatedAt || session.createdAt}
                      </span>
                      <span>•</span>
                      <span>{userMsgCount} câu hỏi ({totalMsgCount} tin nhắn)</span>
                    </div>

                    {session.messages.length > 1 && (
                      <p className="text-xs text-gray-400/80 truncate mt-1 italic">
                        "{session.messages.find(m => m.sender === 'user')?.text || session.messages[1]?.text || ''}"
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => onDeleteSession(session.id)}
                      className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-950/40 rounded-lg transition-colors"
                      title="Xóa đoạn chat này"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 sm:p-4 bg-gray-950/80 border-t border-gray-800 flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-xs text-gray-400 hover:text-white"
          >
            Đóng
          </Button>
        </div>
      </div>
    </div>
  );
};
