import React, { useRef, useEffect, useState, useMemo } from 'react';
import { AnimatePresence, motion } from "motion/react";
import { GameMessage, KnowledgeBase, StyleSettings, UIState } from '../../../types';
import Button from '../../ui/Button';
import Spinner from '../../ui/Spinner';
import { VIETNAMESE } from '../../../constants';
import ObservedMessage from './ObservedMessage'; // Import the new component
import SystemMessageGroup from './SystemMessageGroup'; // Import the new grouping component
import ThinkingLog from './ThinkingLog';
import { stripThinkingTags, matchAndFixTags } from '../../../utils/tagProcessingUtils';
import { useStoryPagination } from '../../../hooks/useStoryPagination';
import { useSpeech } from '../../../hooks/useSpeech';
import { Volume2, Square, Settings } from 'lucide-react';
import StoryTurnItem from './StoryTurnItem';
import StorySummaryItem from './StorySummaryItem';

interface MessageItemProps {
  item: GameMessage | GameMessage[];
  index: number;
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
  parseAndHighlightText: (text: string, skipKeywords?: boolean) => React.ReactNode[];
  getDynamicMessageStyles: (msgType: GameMessage['type']) => React.CSSProperties;
  getPlaceholderHeight: (type: GameMessage['type']) => number;
  isMajorMessage: (type: GameMessage['type']) => boolean;
  settingsOpenId: string | null;
  setSettingsOpenId: (id: string | null) => void;
  speech: any;
}

interface StoryLogProps {
  storyLogRef: React.RefObject<HTMLDivElement | null>;
  displayedMessages: GameMessage[];
  isLoadingUi: boolean;
  isSummarizingUi: boolean;
  isCurrentlyActivePage: boolean;
  knowledgeBase: KnowledgeBase;
  uiState: UIState;
  styleSettings: StyleSettings;
  messageIdBeingEdited: string | null;
  currentEditText: string;
  setCurrentEditText: (text: string) => void;
  onStartEditMessage: (messageId: string) => void;
  onSaveEditedMessage: (messageId: string, newContent: string) => void;
  onCancelEditMessage: () => void;
  parseAndHighlightText: (text: string, skipKeywords?: boolean) => React.ReactNode[];
  getDynamicMessageStyles: (msgType: GameMessage['type']) => React.CSSProperties;
  onClick: () => void;
  onScroll: (e: React.UIEvent<HTMLDivElement>) => void;
  isStreaming: boolean;
  streamingText: string;
}

const StoryLog: React.FC<StoryLogProps> = ({
  storyLogRef,
  displayedMessages,
  isLoadingUi,
  isSummarizingUi,
  isCurrentlyActivePage,
  knowledgeBase,
  uiState,
  styleSettings,
  messageIdBeingEdited,
  currentEditText,
  setCurrentEditText,
  onStartEditMessage,
  onSaveEditedMessage,
  onCancelEditMessage,
  parseAndHighlightText,
  getDynamicMessageStyles,
  onClick,
  onScroll,
  isStreaming,
  streamingText,
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const streamingRef = useRef<HTMLDivElement>(null);
  const [lockedHeight, setLockedHeight] = useState<number | null>(null);
  const [lastStreamingText, setLastStreamingText] = useState('');
  const [editingText, setEditingText] = useState('');
  const [settingsOpenId, setSettingsOpenId] = useState<string | null>(null);

  const { speak, stop, isSpeaking, currentId, pitch, setPitch, rate, setRate } = useSpeech();

  const [isRagActive, setIsRagActive] = useState(() => localStorage.getItem('isRagSystemActive') === 'true');

  useEffect(() => {
    const handler = () => {
      setIsRagActive(localStorage.getItem('isRagSystemActive') === 'true');
    };
    window.addEventListener('rag-system-change', handler);
    return () => {
      window.removeEventListener('rag-system-change', handler);
    };
  }, []);

  const speech = useMemo(() => ({
    speak, stop, isSpeaking, currentId, pitch, setPitch, rate, setRate
  }), [speak, stop, isSpeaking, currentId, pitch, setPitch, rate, setRate]);

  useEffect(() => {
    if (uiState.isSwapping && streamingRef.current) {
      setLockedHeight(streamingRef.current.offsetHeight);
    } else if (!uiState.isSwapping) {
      setLockedHeight(null);
    }
  }, [uiState.isSwapping]);

  // Use the pagination hook to limit visible turns on the active page
  const { visibleMessages, hiddenCount } = useStoryPagination(displayedMessages, isCurrentlyActivePage, 5);

  const filteredVisibleMessages = useMemo(() => {
    if (isRagActive) return visibleMessages;
    return visibleMessages.filter(msg => {
      if (msg.type === 'event_summary' && msg.content.includes('Người chơi số 0')) {
        return false;
      }
      return true;
    });
  }, [visibleMessages, isRagActive]);

  // Define the states for the story log
  const storyState = useMemo((): 'IDLE' | 'STREAMING' | 'PROCESSING' => {
    if (isStreaming && streamingText) return 'STREAMING';
    if (isLoadingUi && (!displayedMessages || displayedMessages.length === 0) && isCurrentlyActivePage) return 'PROCESSING';
    return 'IDLE';
  }, [isStreaming, streamingText, isLoadingUi, displayedMessages, isCurrentlyActivePage]);

  useEffect(() => {
    if (messageIdBeingEdited) {
        const msgToEdit = displayedMessages.find(m => m.id === messageIdBeingEdited);
        setEditingText(msgToEdit?.content || '');
    }
  }, [messageIdBeingEdited, displayedMessages]);
  
  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (messageIdBeingEdited) return;
    const target = e.target as HTMLElement;
    if (target.closest('button, a, [role="button"], textarea')) return;
    onClick();
  };

  const isMajorMessage = (type: GameMessage['type']) => type === 'narration' || type === 'player_action';

  const getPlaceholderHeight = (type: GameMessage['type']): number => {
    switch (type) {
      case 'system':
      case 'error':
      case 'page_summary':
      case 'event_summary':
        return 36; // A smaller, more appropriate height for single-line system messages.
      case 'narration':
      case 'player_action':
      default:
        return 75; // The original default for longer content.
    }
  };
  
  // Group consecutive system messages for collapsibility
  const groupedMessages = useMemo(() => {
    const result: (GameMessage | GameMessage[])[] = [];
    let currentSystemGroup: GameMessage[] = [];

    filteredVisibleMessages.forEach((msg) => {
        // Only group 'system' messages. Other types like 'error' and 'page_summary' are distinct.
        if (msg.type === 'system') {
            currentSystemGroup.push(msg);
        } else {
            // If we encounter a non-system message, push any existing group first
            if (currentSystemGroup.length > 0) {
                result.push(currentSystemGroup);
                currentSystemGroup = [];
            }
            // Then push the non-system message
            result.push(msg);
        }
    });

    // Push any remaining group at the end of the loop
    if (currentSystemGroup.length > 0) {
        result.push(currentSystemGroup);
    }
    return result;
  }, [filteredVisibleMessages]);

  // Xác định ID của lời kể (narration) thuộc lượt mới nhất vừa được tạo
  const latestNarrationMsgId = useMemo(() => {
    if (!isCurrentlyActivePage) return null;
    for (let i = groupedMessages.length - 1; i >= 0; i--) {
      const item = groupedMessages[i];
      if (!Array.isArray(item) && item.type === 'narration') {
        return item.id;
      }
    }
    return null;
  }, [groupedMessages, isCurrentlyActivePage]);

  return (
    <div 
      id="story-log"
      ref={storyLogRef}
      onClick={handleContainerClick}
      onScroll={onScroll}
      className="flex-grow overflow-y-auto p-3 sm:p-4 bg-black rounded-t-lg custom-scrollbar min-h-0"
    >
      {groupedMessages.map((item, index) => {
        let containerMargin = 'mt-2'; // Default margin
        if (index > 0) {
            const prevItem = groupedMessages[index - 1];
            const currentItemIsMajor = isMajorMessage(Array.isArray(item) ? 'system' : item.type);
            const prevItemIsMajor = isMajorMessage(Array.isArray(prevItem) ? 'system' : prevItem.type);

            if (currentItemIsMajor !== prevItemIsMajor) {
                containerMargin = 'mt-3 sm:mt-4';
            }
        }
        
        // Handle grouped system messages
        if (Array.isArray(item)) {
          const firstMessageInGroup = item[0];
          return (
            <ObservedMessage key={`group-${firstMessageInGroup.id}-${index}`} placeholderHeight={getPlaceholderHeight('system')}>
              <div className={`flex justify-start ${containerMargin}`}>
                <div className="max-w-full w-full">
                  <SystemMessageGroup messages={item} isDevMode={uiState.isDevMode} />
                </div>
              </div>
            </ObservedMessage>
          );
        }

        // Handle Single Messages (Narration, Player Action, Summary)
        if (item.type === 'page_summary' || item.type === 'event_summary') {
          return (
            <StorySummaryItem 
              key={`${item.id}-${index}`} 
              msg={item} 
              containerMargin={containerMargin} 
            />
          );
        }

        const isLatestNarration = !Array.isArray(item) && item.id === latestNarrationMsgId;

        return (
          <ObservedMessage 
            key={`${item.id}-${index}`} 
            placeholderHeight={getPlaceholderHeight(item.type)}
            forceRender={isLatestNarration}
            id={isLatestNarration ? 'latest-story-narration' : undefined}
            dataMsgType={item.type}
            dataIsLatest={isLatestNarration ? 'true' : undefined}
          >
            <StoryTurnItem 
              msg={item}
              containerMargin={containerMargin}
              isCurrentlyActivePage={isCurrentlyActivePage}
              knowledgeBase={knowledgeBase}
              uiState={uiState}
              styleSettings={styleSettings}
              messageIdBeingEdited={messageIdBeingEdited}
              editingText={editingText}
              setEditingText={setEditingText}
              onStartEditMessage={onStartEditMessage}
              onSaveEditedMessage={onSaveEditedMessage}
              onCancelEditMessage={onCancelEditMessage}
              parseAndHighlightText={parseAndHighlightText}
              dynamicStyle={getDynamicMessageStyles(item.type)}
              isMajorMessage={isMajorMessage(item.type)}
              settingsOpenId={settingsOpenId}
              setSettingsOpenId={setSettingsOpenId}
              speech={speech}
              isLatestNarration={isLatestNarration}
            />
          </ObservedMessage>
        );
      })}
      
      {/* Render Streaming or Processing state */}
      <AnimatePresence mode="popLayout">
        {(storyState === 'STREAMING' || storyState === 'PROCESSING') && (
          <motion.div
            key="streaming-or-processing-message"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, height: lockedHeight || 'auto' }}
            transition={{ duration: 0.2 }}
          >
            <ObservedMessage key="streaming-or-processing-message" placeholderHeight={75} ref={streamingRef}>
                <div data-msg-type="narration" data-streaming="true" className={`flex justify-start mt-3 sm:mt-4 w-full`}>
                  <div
                    className={`w-full py-4 border-t border-zinc-700/50 relative text-gray-100 ${storyState === 'STREAMING' ? 'border-amber-500/50' : 'border-blue-500/30'}`}
                    style={{...getDynamicMessageStyles('narration'), whiteSpace: 'pre-wrap', backgroundColor: 'transparent'}}
                  >
                    <ThinkingLog content={streamingText} />
                    <div className="leading-relaxed">
                        {React.Children.toArray(parseAndHighlightText(matchAndFixTags(stripThinkingTags(streamingText), storyState !== 'STREAMING'), true))}
                        {storyState === 'PROCESSING' && (
                          <span className="inline-block ml-1.5 animate-pulse text-lg align-middle" title="Đang xử lý/gửi Prompt">🧠</span>
                        )}
                        {storyState === 'STREAMING' && (
                          (() => {
                            const cleaned = (streamingText || "")
                              .replace(/<prethinking>/gi, "")
                              .replace(/<\/prethinking>/gi, "")
                              .replace(/<tuong_than>/gi, "")
                              .replace(/<\/tuong_than>/gi, "")
                              .trim();
                            if (cleaned.length > 0) {
                              return <span className="inline-block ml-1.5 animate-pulse text-lg align-middle" title="Đã nhận dữ liệu thực">🖋️</span>;
                            }
                            return <span className="inline-block ml-1.5 animate-pulse text-lg align-middle" title="Đang xử lý/gửi Prompt">🧠</span>;
                          })()
                        )}
                    </div>
                    
                    {storyState === 'PROCESSING' && (
                      <div className="mt-2 pt-2 border-t border-gray-600/50 flex items-center gap-2 text-xs text-gray-400 italic">
                        <Spinner size="xs" />
                        <span>{VIETNAMESE.contactingAI}</span>
                      </div>
                    )}
                  </div>
                </div>
            </ObservedMessage>
          </motion.div>
        )}
      </AnimatePresence>

      {(isLoadingUi && displayedMessages.length === 0 && storyState === 'IDLE') && <Spinner text={VIETNAMESE.contactingAI} size="sm" className="my-4" />}
      {isSummarizingUi && <div className="text-center text-gray-400 italic py-2 mt-2"><Spinner text={displayedMessages.some(m => m.content.includes(VIETNAMESE.creatingMissingSummary)) ? VIETNAMESE.creatingMissingSummary : VIETNAMESE.summarizingAndPreparingNextPage} size="sm" /></div>}
      <div ref={messagesEndRef} />
      <div id="scroll-anchor" style={{ height: '1px', overflow: 'hidden' }} />
    </div>
  );
};

export default StoryLog;