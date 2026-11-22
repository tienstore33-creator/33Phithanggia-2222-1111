import React from 'react';
import { GameMessage, KnowledgeBase, UIState, StyleSettings, NPC } from '../../../types';
import { VIETNAMESE } from '../../../constants';
import { stripThinkingTags } from '../../../utils/tagProcessingUtils';
import ThinkingLog from './ThinkingLog';
import DynamicAvatar from '../../DynamicAvatar';
import FormattedNarration from '../FormattedNarration';
import { Volume2, Square, Settings, Edit3 } from 'lucide-react';
import Modal from '../../ui/Modal';

interface StoryTurnItemProps {
  msg: GameMessage;
  containerMargin: string;
  isCurrentlyActivePage: boolean;
  knowledgeBase: KnowledgeBase;
  uiState: UIState;
  styleSettings: StyleSettings;
  messageIdBeingEdited: string | null;
  editingText: string;
  setEditingText: (text: string) => void;
  onStartEditMessage: (messageId: string) => void;
  onSaveEditedMessage: (messageId: string, newContent: string) => void;
  onCancelEditMessage: () => void;
  parseAndHighlightText: (text: string) => React.ReactNode[];
  dynamicStyle: React.CSSProperties;
  isMajorMessage: boolean;
  settingsOpenId: string | null;
  setSettingsOpenId: (id: string | null) => void;
  speech: {
    speak: (text: string, id: string) => void;
    stop: () => void;
    isSpeaking: boolean;
    currentId: string | null;
    pitch: number;
    setPitch: (v: number) => void;
    rate: number;
    setRate: (v: number) => void;
  };
  isLatestNarration?: boolean;
}

const StoryTurnItem: React.FC<StoryTurnItemProps> = ({
  msg,
  containerMargin,
  isCurrentlyActivePage,
  knowledgeBase,
  uiState,
  styleSettings,
  messageIdBeingEdited,
  editingText,
  setEditingText,
  onStartEditMessage,
  onSaveEditedMessage,
  onCancelEditMessage,
  parseAndHighlightText,
  dynamicStyle,
  isMajorMessage,
  settingsOpenId,
  setSettingsOpenId,
  speech,
  isLatestNarration
}) => {
  const { speak, stop, isSpeaking, currentId, pitch, setPitch, rate, setRate } = speech;
  const isEditable = (msg.type === 'narration' || msg.type === 'player_action') && isCurrentlyActivePage;

  let typeSpecificClass = 'text-gray-100';

  const [isRagActive, setIsRagActive] = React.useState(() => localStorage.getItem('isRagSystemActive') === 'true');
  const [showRawModal, setShowRawModal] = React.useState(false);
  const [rawPromptText, setRawPromptText] = React.useState('');
  const [modalTitle, setModalTitle] = React.useState('');
  const [anyPresetEnabled, setAnyPresetEnabled] = React.useState<boolean>(false);

  React.useEffect(() => {
    const checkPresets = () => {
      try {
        const saved = localStorage.getItem('accessory_preset_files');
        if (saved) {
          const files = JSON.parse(saved);
          if (Array.isArray(files)) {
            const isAnyEnabled = files.some((pf: any) => pf.enabled);
            setAnyPresetEnabled(isAnyEnabled);
            return;
          }
        }
        setAnyPresetEnabled(false);
      } catch (e) {
        console.error('Error checking presets in StoryTurnItem:', e);
        setAnyPresetEnabled(false);
      }
    };

    checkPresets();

    const handlePresetChange = () => {
      checkPresets();
    };
    window.addEventListener('accessory_preset_files_changed', handlePresetChange);
    window.addEventListener('storage', handlePresetChange);

    return () => {
      window.removeEventListener('accessory_preset_files_changed', handlePresetChange);
      window.removeEventListener('storage', handlePresetChange);
    };
  }, []);

  React.useEffect(() => {
    const handler = () => {
      setIsRagActive(localStorage.getItem('isRagSystemActive') === 'true');
    };
    window.addEventListener('rag-system-change', handler);
    return () => {
      window.removeEventListener('rag-system-change', handler);
    };
  }, []);

  const handleShowRawPromptModal = (turnNumber: number) => {
    try {
      if (msg.type === 'summary') {
        setModalTitle(`Dữ liệu RAG thô (Raw Prompt AI) - Lượt Tóm Tắt`);
        setRawPromptText("Lượt tóm tắt không sử dụng prompt AI chính.");
        setShowRawModal(true);
        return;
      }
      const stored = localStorage.getItem('latest_ai_prompts');
      const promptsList = stored ? JSON.parse(stored) : [];
      // Luôn lấy lượt gửi AI mới nhất/gần nhất trong bộ nhớ
      const target = promptsList.length > 0 ? promptsList[promptsList.length - 1] : null;
      if (target && target.prompt) {
        setModalTitle(`Dữ liệu RAG thô (Raw Prompt AI) - Lượt ${target.turn ?? turnNumber}`);
        setRawPromptText(target.prompt);
      } else {
        setModalTitle(`Dữ liệu RAG thô (Raw Prompt AI) - Lượt ${turnNumber}`);
        setRawPromptText("Chưa có dữ liệu prompt gửi AI thô nào trong bộ nhớ đệm.");
      }
      setShowRawModal(true);
    } catch (e) {
      console.warn("Failed to read raw prompt from localStorage", e);
      setRawPromptText("Có lỗi xảy ra khi đọc dữ liệu gửi AI.");
      setShowRawModal(true);
    }
  };

  const handleShowRawResponseModal = (turnNumber: number) => {
    try {
      if (msg.type === 'summary') {
        setModalTitle(`Nội dung AI phản hồi thô (Raw Response AI) - Lượt Tóm Tắt`);
        setRawPromptText("Lượt tóm tắt không có phản hồi AI thô.");
        setShowRawModal(true);
        return;
      }
      const stored = localStorage.getItem('latest_ai_responses');
      const responsesList = stored ? JSON.parse(stored) : [];
      // Luôn lấy lượt phản hồi AI mới nhất/gần nhất trong bộ nhớ
      const target = responsesList.length > 0 ? responsesList[responsesList.length - 1] : null;
      if (target && target.response) {
        setModalTitle(`Nội dung AI phản hồi thô (Raw Response AI) - Lượt ${target.turn ?? turnNumber}`);
        setRawPromptText(target.response);
      } else {
        setModalTitle(`Nội dung AI phản hồi thô (Raw Response AI) - Lượt ${turnNumber}`);
        setRawPromptText("Chưa có dữ liệu phản hồi AI thô nào trong bộ nhớ đệm.");
      }
      setShowRawModal(true);
    } catch (e) {
      console.warn("Failed to read raw response from localStorage", e);
      setRawPromptText("Có lỗi xảy ra khi đọc dữ liệu phản hồi AI.");
      setShowRawModal(true);
    }
  };
  
  return (
    <div 
      id={`turn-wrapper-${msg.turnNumber}`} 
      data-msg-type={msg.type} 
      data-is-latest-narration={isLatestNarration ? "true" : undefined}
      className={`flex ${msg.isPlayerInput ? 'justify-end' : 'justify-start'} ${containerMargin} w-full`}
    >
      <div
        className={`w-full py-4 ${msg.type === 'player_action' ? 'px-4 my-3 border border-purple-800/40 rounded-xl bg-gradient-to-r from-purple-950/45 to-indigo-950/35 shadow-[0_0_15px_rgba(168,85,247,0.15)]' : 'border-t border-zinc-700/50'} relative ${typeSpecificClass} ${messageIdBeingEdited === msg.id ? 'w-full' : ''}`}
        style={msg.type === 'player_action' ? { ...dynamicStyle, boxShadow: 'none' } : { ...dynamicStyle, backgroundColor: 'transparent', boxShadow: 'none' }}
      >
        {isEditable && messageIdBeingEdited !== msg.id && (
          <button 
            onClick={() => onStartEditMessage(msg.id)} 
            className="absolute top-1 right-1 p-0.5 text-gray-400 hover:text-white bg-gray-700 hover:bg-gray-600 rounded-full transition-colors"
            title={VIETNAMESE.editButtonLabel}
          >
            <Edit3 size={12} />
          </button>
        )}

        {messageIdBeingEdited === msg.id ? (
          <div className="mt-1">
            <textarea 
              value={editingText} 
              onChange={(e) => setEditingText(e.target.value)} 
              className="w-full p-2 text-base md:text-sm bg-gray-600 border border-gray-500 rounded-md focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400 text-gray-100 min-h-[80px]" 
              rows={Math.max(3, editingText.split('\n').length)} 
            />
            <div className="flex justify-between items-center mt-2 group">
              <div className="flex flex-col text-[10px] text-gray-500">
                <span>{knowledgeBase.worldDate.timeOfDay}, Ngày {knowledgeBase.worldDate.day} Tháng {knowledgeBase.worldDate.month}, Năm {knowledgeBase.worldDate.year}</span>
              </div>
              <div className="flex items-center space-x-3">
                {isRagActive && (
                  <div className="flex items-center space-x-2 mr-2">
                    <button 
                      type="button"
                      onClick={() => handleShowRawPromptModal(msg.turnNumber)}
                      className="text-[12px] font-black text-amber-500 drop-shadow-[0_0_5px_rgba(245,158,11,0.8)] hover:scale-110 active:scale-90 transition-all cursor-pointer focus:outline-none"
                      title="Xem Dữ liệu RAG thô (Raw Prompt AI)"
                    >
                      ©
                    </button>
                    <button 
                      type="button"
                      onClick={() => handleShowRawResponseModal(msg.turnNumber)}
                      className="text-[12px] font-black text-blue-400 drop-shadow-[0_0_5px_rgba(96,165,250,0.8)] hover:scale-110 active:scale-90 transition-all cursor-pointer focus:outline-none"
                      title="Xem Nội dung AI phản hồi thô (Raw Response AI)"
                    >
                      ™
                    </button>
                  </div>
                )}
                <button 
                  className="px-2 py-1 text-xs text-gray-400 hover:text-white"
                  onClick={onCancelEditMessage}
                >
                  {VIETNAMESE.cancelEditButton}
                </button>
                <button 
                  className="px-2 py-1 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded shadow-sm flex items-center"
                  onClick={() => onSaveEditedMessage(msg.id, editingText)}
                >
                  {VIETNAMESE.saveEditButton}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            {isMajorMessage && (
              <div className="flex justify-between items-center mb-2 pb-1 border-b border-gray-600/30 text-[10px] uppercase tracking-wider text-gray-400">
                <span>{msg.type === 'narration' ? 'Dẫn truyện' : 'Hành động'} - Lượt {msg.turnNumber}</span>
                <div className="flex items-center gap-2 mr-[40px]">
                  <div className="relative">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setSettingsOpenId(settingsOpenId === msg.id ? null : msg.id);
                      }}
                      className={`hover:text-amber-400 transition-colors ${settingsOpenId === msg.id ? 'text-amber-400' : ''}`}
                      title={VIETNAMESE.speechSettings}
                    >
                      <Settings size={12} />
                    </button>
                    {settingsOpenId === msg.id && (
                      <div className="absolute right-0 top-5 z-20 bg-gray-900 border border-gray-600 p-2 rounded shadow-xl text-[10px] w-32 space-y-2 normal-case tracking-normal" onClick={(e) => e.stopPropagation()}>
                        <div>
                          <label className="block text-gray-400 mb-1">{VIETNAMESE.speechPitch}: {pitch.toFixed(1)}</label>
                          <input 
                            type="range" min="0.5" max="2" step="0.1" 
                            value={pitch} 
                            onChange={(e) => setPitch(parseFloat(e.target.value))}
                            className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                          />
                        </div>
                        <div>
                          <label className="block text-gray-400 mb-1">{VIETNAMESE.speechRate}: {rate.toFixed(1)}</label>
                          <input 
                            type="range" min="0.5" max="2" step="0.1" 
                            value={rate} 
                            onChange={(e) => setRate(parseFloat(e.target.value))}
                            className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      const isThisSpeaking = isSpeaking && currentId === msg.id;
                      isThisSpeaking ? stop() : speak(stripThinkingTags(msg.content), msg.id);
                    }}
                    className="hover:text-amber-400 transition-colors flex items-center gap-1"
                  >
                    {isSpeaking && currentId === msg.id ? <Square size={12} /> : <Volume2 size={12} />}
                    <span>{isSpeaking && currentId === msg.id ? VIETNAMESE.speechStop : VIETNAMESE.speechRead}</span>
                  </button>
                </div>
              </div>
            )}
            {!msg.isPlayerInput && <ThinkingLog content={String(msg.content)} />}
            <div className="flex gap-4 items-start mt-2 w-full">
              <div className="flex-1">
                <FormattedNarration 
                  content={String(msg.content)} 
                  activeNpc={undefined}
                  characterExpressionId={msg.characterExpressionId}
                  knowledgeBase={knowledgeBase}
                  parseAndHighlightText={parseAndHighlightText}
                  isDevMode={uiState.isDevMode}
                />
              </div>
            </div>
            {anyPresetEnabled && msg.choices && msg.choices.length > 0 && (
              <div className="mt-3 p-3 rounded-lg border border-amber-500/20 bg-amber-950/20 font-mono text-xs text-amber-300 space-y-1 select-text">
                <div className="text-amber-500/70 font-semibold">&lt;choice&gt;</div>
                <div className="pl-4 space-y-1">
                  {msg.choices.map((choice, cIdx) => (
                    <div key={cIdx} className="whitespace-pre-wrap">
                      [CHOICE: "{choice.text}"]{choice.thought ? ` /* ${choice.thought} */` : ''}
                    </div>
                  ))}
                </div>
                <div className="text-amber-500/70 font-semibold">&lt;/choice&gt;</div>
              </div>
            )}
            {isMajorMessage && (
              <div className="flex justify-between text-[10px] text-gray-500 mt-2 pt-1 border-t border-gray-600/50">
                <span>{knowledgeBase.worldDate.timeOfDay}, Ngày {knowledgeBase.worldDate.day} Tháng {knowledgeBase.worldDate.month}, Năm {knowledgeBase.worldDate.year}</span>
                <span>Lượt: {msg.turnNumber}</span>
              </div>
            )}
          </>
        )}
      </div>
      {showRawModal && (
        <Modal
          isOpen={showRawModal}
          onClose={() => setShowRawModal(false)}
          title={
            <div className="flex items-center gap-3 flex-wrap">
              <span>{modalTitle}</span>
              <button
                type="button"
                onClick={() => {
                  const blob = new Blob([rawPromptText], { type: 'text/plain;charset=utf-8' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `AI_Data_Turn_${msg.turnNumber}.txt`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="text-xs px-2 py-0.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded cursor-pointer transition-all select-none normal-case font-medium whitespace-nowrap"
                title="Tải dữ liệu thô về máy dưới dạng .txt"
              >
                Tải về (.txt)
              </button>
            </div>
          }
          maxWidth="max-w-xl"
        >
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 text-xs font-mono text-gray-300 max-h-[60vh] overflow-y-auto custom-scrollbar whitespace-pre-wrap select-text">
            {rawPromptText}
          </div>
        </Modal>
      )}
    </div>
  );
};

export default React.memo(StoryTurnItem);
