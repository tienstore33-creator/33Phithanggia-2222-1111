
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { KnowledgeBase } from '../../types';
import { VIETNAMESE } from '../../constants';
import Button from '../ui/Button';
import InputField from '../ui/InputField';
import * as GameTemplates from '../../templates';

interface DebugPanelDisplayProps {
  kb: KnowledgeBase;
  sentPromptsLog: string[];
  rawAiResponsesLog: string[];
  sentEconomyPromptsLog: string[];
  receivedEconomyResponsesLog: string[];
  sentGeneralSubLocationPromptsLog: string[];
  receivedGeneralSubLocationResponsesLog: string[];
  latestPromptTokenCount: number | null | string;
  summarizationResponsesLog: string[];
  sentCraftingPromptsLog: string[]; 
  receivedCraftingResponsesLog: string[];
  sentNpcAvatarPromptsLog: string[];
  retrievedRagContextLog: string[]; // NEW
  currentPageDisplay: number;
  totalPages: number;
  isAutoPlaying: boolean;
  onToggleAutoPlay: () => void;
  onStartDebugCombat: () => void;
  onProcessDebugTags: (narration: string, tags: string) => Promise<void>;
  isLoading: boolean;
  // New props for post-combat logs
  sentCombatSummaryPromptsLog: string[];
  receivedCombatSummaryResponsesLog: string[];
  sentVictoryConsequencePromptsLog: string[];
  receivedVictoryConsequenceResponsesLog: string[];
  onClose: () => void; // Added onClose prop
}

const MIN_WIDTH = 320; // px
const MIN_HEIGHT = 250; // px
const INITIAL_WIDTH = 420; // px
const INITIAL_HEIGHT = 500; // px
const HANDLE_SIZE = 12; // px

const LogSection: React.FC<{ title: string; logs: string[] }> = ({ title, logs }) => {
    if (logs.length === 0) return null;
    return (
        <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar text-xs">
            {logs.map((entry, index) => (
                <details key={index} className="bg-gray-800 rounded group">
                    <summary className="p-1.5 text-inherit cursor-pointer text-[11px] group-open:font-semibold">
                        {title} #{logs.length - index} (Nhấn để xem)
                    </summary>
                    <pre className="p-1.5 bg-gray-850 text-inherit whitespace-pre-wrap break-all text-[10px] leading-relaxed max-h-80 overflow-y-auto custom-scrollbar">
                        {entry}
                    </pre>
                </details>
            ))}
        </div>
    );
};

const DebugPanelDisplay: React.FC<DebugPanelDisplayProps> = ({
    kb,
    sentPromptsLog,
    rawAiResponsesLog,
    sentEconomyPromptsLog,
    receivedEconomyResponsesLog,
    sentGeneralSubLocationPromptsLog,
    receivedGeneralSubLocationResponsesLog,
    latestPromptTokenCount,
    summarizationResponsesLog,
    sentCraftingPromptsLog, 
    receivedCraftingResponsesLog, 
    sentNpcAvatarPromptsLog,
    retrievedRagContextLog, // NEW
    currentPageDisplay,
    totalPages,
    isAutoPlaying,
    onToggleAutoPlay,
    onStartDebugCombat,
    onProcessDebugTags,
    isLoading,
    sentCombatSummaryPromptsLog,
    receivedCombatSummaryResponsesLog,
    sentVictoryConsequencePromptsLog,
    receivedVictoryConsequenceResponsesLog,
    onClose, // Destructure onClose
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [debugNarration, setDebugNarration] = useState('');
  const [debugTags, setDebugTags] = useState('');
  
  const handleProcessTagsClick = () => {
      if (!isLoading) {
          onProcessDebugTags(debugNarration, debugTags);
      }
  };

  const [position, setPosition] = useState(() => {
    const top = window.innerHeight - INITIAL_HEIGHT - 16;
    const left = window.innerWidth - INITIAL_WIDTH - 16;
    return { top: Math.max(0, top), left: Math.max(0, left) };
  });
  const [dimensions, setDimensions] = useState({ width: INITIAL_WIDTH, height: INITIAL_HEIGHT });
  
  const interactionStartRef = useRef({ 
    mouseX: 0, 
    mouseY: 0, 
    panelX: 0, 
    panelY: 0, 
    panelW: 0, 
    panelH: 0 
  });

  useEffect(() => {
    setPosition({
      top: Math.max(0, window.innerHeight - dimensions.height - 16),
      left: Math.max(0, window.innerWidth - dimensions.width - 16),
    });
  }, []); 


  const handleMouseDownDrag = useCallback((e: React.MouseEvent<HTMLHeadingElement>) => {
    if (e.button !== 0) return; 
    setIsDragging(true);
    interactionStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      panelX: position.left,
      panelY: position.top,
      panelW: dimensions.width,
      panelH: dimensions.height,
    };
    document.body.style.userSelect = 'none'; 
    e.preventDefault();
  }, [position, dimensions]);

  const handleMouseDownResize = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    setIsResizing(true);
    interactionStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      panelX: position.left,
      panelY: position.top,
      panelW: dimensions.width,
      panelH: dimensions.height,
    };
    document.body.style.userSelect = 'none';
    e.preventDefault();
  }, [position, dimensions]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDragging) {
      const deltaX = e.clientX - interactionStartRef.current.mouseX;
      const deltaY = e.clientY - interactionStartRef.current.mouseY;
      
      let newLeft = interactionStartRef.current.panelX + deltaX;
      let newTop = interactionStartRef.current.panelY + deltaY;

      newLeft = Math.max(0, Math.min(newLeft, window.innerWidth - dimensions.width));
      newTop = Math.max(0, Math.min(newTop, window.innerHeight - dimensions.height));
      
      setPosition({ left: newLeft, top: newTop });
    } else if (isResizing) {
      const deltaX = e.clientX - interactionStartRef.current.mouseX;
      const deltaY = e.clientY - interactionStartRef.current.mouseY;
      
      let newWidth = interactionStartRef.current.panelW + deltaX;
      let newHeight = interactionStartRef.current.panelH + deltaY;

      newWidth = Math.max(MIN_WIDTH, newWidth);
      newHeight = Math.max(MIN_HEIGHT, newHeight);

      newWidth = Math.min(newWidth, window.innerWidth - position.left);
      newHeight = Math.min(newHeight, window.innerHeight - position.top);
      
      setDimensions({ width: newWidth, height: newHeight });
    }
  }, [isDragging, isResizing, dimensions.width, dimensions.height, position.left, position.top]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setIsResizing(false);
    document.body.style.userSelect = ''; 
  }, []);

  useEffect(() => {
    if (isDragging || isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    // The cleanup function for the effect.
    // This runs before the next effect execution or on unmount.
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
    };
  }, [isDragging, isResizing, handleMouseMove, handleMouseUp]);

  const displayTokenInfo = () => {
    if (latestPromptTokenCount === null && sentPromptsLog.length === 0) return 'N/A';
    if (typeof latestPromptTokenCount === 'string') return latestPromptTokenCount;
    if (typeof latestPromptTokenCount === 'number') return latestPromptTokenCount.toString();
    return 'N/A'; 
  };

  const getTokenDisplayClass = () => {
    if (typeof latestPromptTokenCount === 'number') {
      return "font-semibold text-yellow-300";
    }
    return "italic text-gray-400"; 
  };
  
  // --- MEMORY INTEGRITY CHECK LOGIC ---
  const lastSummarizedTurn = kb.lastSummarizedTurn || 0;
  const currentTurn = kb.playerStats.turn;
  const currentLogLength = kb.currentTurnLog ? kb.currentTurnLog.length : 0;
  // Estimate turns covered by log (each turn is roughly 2 entries: User + AI)
  // This is an estimate for display, exact logic logic is handled by 'accumulate until summarized'.
  const turnsCoveredByLog = Math.floor(currentLogLength / 2);
  
  // A gap exists if the log covers fewer turns than the difference between current and last summarized,
  // allowing for a margin of error (e.g., current turn just started).
  // Ideally: LastSummarized + TurnsInLog should equal CurrentTurn.
  const gapSize = (currentTurn - lastSummarizedTurn) - turnsCoveredByLog;
  const hasGap = gapSize > 1; // Tolerance of 1 turn

  return (
    <div 
      ref={panelRef}
      className="fixed bg-gray-900 border-2 border-yellow-500 rounded-lg shadow-2xl overflow-y-auto custom-scrollbar z-50 flex flex-col"
      style={{ 
        top: `${position.top}px`, 
        left: `${position.left}px`, 
        width: `${dimensions.width}px`, 
        height: `${dimensions.height}px`,
      }}
      onClick={(e) => e.stopPropagation()} // Prevent closing via overlay
    >
      <div 
        className="flex justify-between items-center border-b border-yellow-600 bg-gray-850 flex-shrink-0 cursor-move"
        onMouseDown={handleMouseDownDrag}
      >
        <h4 className="text-lg font-bold text-yellow-400 p-3 select-none">
          Bảng Điều Khiển Debug
        </h4>
        <button 
            onClick={onClose}
            className="p-3 text-gray-400 hover:text-red-500 transition-colors"
            title="Đóng bảng điều khiển"
        >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
        </button>
      </div>

      <div className="p-3 overflow-y-auto flex-grow custom-scrollbar"> 
        <div className="mb-3 text-xs text-gray-400">
          Player: {kb.playerStats.realm}, Lượt: {kb.playerStats.turn}<br/>
          Trang: {currentPageDisplay}/{totalPages}<br/>
          Token Prompt Gần Nhất: <span className={getTokenDisplayClass()}>{displayTokenInfo()}</span>
        </div>
        
        {/* MEMORY INTEGRITY SECTION */}
        <div className="mb-4 p-2 bg-gray-800 rounded border border-gray-600">
            <h5 className="text-sm font-bold text-cyan-300 mb-1">Kiểm Tra Toàn Vẹn Ký Ức (Memory Integrity)</h5>
            <div className="text-xs space-y-1">
                <div className="flex justify-between">
                    <span className="text-gray-400">Lượt Tóm Tắt Cuối:</span>
                    <span className="text-white font-mono">{lastSummarizedTurn}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-gray-400">Lượt Hiện Tại:</span>
                    <span className="text-white font-mono">{currentTurn}</span>
                </div>
                 <div className="flex justify-between">
                    <span className="text-gray-400">Log Hiện Tại (Entries/Turns):</span>
                    <span className="text-white font-mono">{currentLogLength} / ~{turnsCoveredByLog}</span>
                </div>
                <div className="mt-2 pt-1 border-t border-gray-700">
                    {hasGap ? (
                         <div className="text-red-400 font-bold bg-red-900/30 p-1 rounded animate-pulse">
                            CẢNH BÁO: PHÁT HIỆN LỖ HỔNG KÝ ỨC!
                            <br/>
                            Gap ước tính: {gapSize} lượt.
                         </div>
                    ) : (
                         <div className="text-green-400 font-bold">
                            Trạng thái ký ức: Ổn định.
                         </div>
                    )}
                </div>
            </div>
        </div>

        <Button
          variant={isAutoPlaying ? "danger" : "secondary"}
          size="sm"
          onClick={onToggleAutoPlay}
          className="w-full mb-3 border-orange-500 text-orange-300 hover:bg-orange-700 hover:text-white"
        >
          {isAutoPlaying ? VIETNAMESE.stopAutoPlayButton : VIETNAMESE.autoPlayButton}
        </Button>

        <Button
            variant="secondary"
            size="sm"
            onClick={onStartDebugCombat}
            className="w-full mb-3 border-red-500 text-red-300 hover:bg-red-700 hover:text-white"
        >
            Bắt đầu Chiến đấu Thử
        </Button>

        <Button
            variant="secondary"
            size="sm"
            onClick={() => {
                const tags = GameTemplates.COMBAT_MODE_SKILLS.map(s => 
                    `[SKILL_LEARNED: name="${s.name}" description="${s.description}" type="Linh Kĩ"]`
                ).join('\n');
                onProcessDebugTags("Bản thân tập trung tư tưởng, đột nhiên thông suốt đại đạo của chư thiên vạn giới, lĩnh ngộ toàn bộ bí kỹ võ học trong thiên hạ!", tags);
            }}
            className="w-full mb-3 border-emerald-500 text-emerald-300 hover:bg-emerald-700 hover:text-white font-bold"
        >
            ✨ Nhận Toàn Bộ Skill Combat ✨
        </Button>

        <div className="mb-4 pt-4 border-t border-yellow-700">
          <h5 className="text-md font-semibold text-yellow-300 mb-1">Xử lý Tags Thủ Công</h5>
          <textarea
            value={debugNarration}
            onChange={(e) => setDebugNarration(e.target.value)}
            placeholder="Nhập lời kể (narration) ở đây..."
            rows={2}
            className="w-full p-1.5 bg-gray-800 border border-gray-600 rounded-md text-xs text-gray-200 mb-2"
            disabled={isLoading}
          />
          <textarea
            value={debugTags}
            onChange={(e) => setDebugTags(e.target.value)}
            placeholder="Nhập các tags ở đây, mỗi tag một dòng. Ví dụ: [ITEM_ACQUIRED: name=&quot;Kiếm Gỗ&quot; ...]"
            rows={4}
            className="w-full p-1.5 bg-gray-800 border border-gray-600 rounded-md text-xs text-gray-200 mb-2"
            disabled={isLoading}
          />
          <Button
            variant="primary"
            size="sm"
            onClick={handleProcessTagsClick}
            className="w-full"
            disabled={isLoading}
            isLoading={isLoading}
          >
            Xử lý Tags
          </Button>
        </div>
        
        <div className="mb-4 text-orange-300">
          <h5 className="text-md font-semibold mb-1">Nhật Ký Truy Xuất RAG ({retrievedRagContextLog.length} gần nhất)</h5>
          <LogSection title="Context Truy Xuất" logs={retrievedRagContextLog} />
        </div>

        <div className="mb-4">
          <h5 className="text-md font-semibold text-sky-300 mb-1">Nhật Ký Prompt (Gameplay &amp; Tóm tắt) ({sentPromptsLog.length} gần nhất)</h5>
          {sentPromptsLog.length === 0 ? (
            <p className="text-xs italic text-gray-500">Chưa có prompt nào được gửi.</p>
          ) : (
             <LogSection title="Prompt Gameplay" logs={sentPromptsLog} />
          )}
        </div>

        <div className="mb-4">
          <h5 className="text-md font-semibold text-lime-300 mb-1">Nhật Ký Phản Hồi Gameplay Từ AI ({rawAiResponsesLog.length} gần nhất)</h5>
          {rawAiResponsesLog.length === 0 ? (
            <p className="text-xs italic text-gray-500">Chưa có phản hồi gameplay nào từ AI.</p>
          ) : (
            <LogSection title="Phản hồi Gameplay" logs={rawAiResponsesLog} />
          )}
        </div>
        
        <div className="mb-4">
          <h5 className="text-md font-semibold text-purple-300 mb-1">Nhật Ký Phản Hồi Tóm Tắt Từ AI ({summarizationResponsesLog.length} gần nhất)</h5>
          {summarizationResponsesLog.length === 0 ? (
            <p className="text-xs italic text-gray-500">Chưa có phản hồi tóm tắt nào từ AI.</p>
          ) : (
            <LogSection title="Phản hồi Tóm Tắt" logs={summarizationResponsesLog} />
          )}
        </div>
        
        {/* NEW: Post-Combat Summary and Consequence Logs */}
        <div className="mb-4 text-rose-300">
          <h5 className="text-md font-semibold mb-1">Nhật Ký Prompt (Tóm tắt/Hậu quả CĐ) ({sentCombatSummaryPromptsLog.length + sentVictoryConsequencePromptsLog.length} gần nhất)</h5>
          <LogSection title="Prompt Tóm Tắt CĐ" logs={sentCombatSummaryPromptsLog} />
          <LogSection title="Prompt Hậu Quả CĐ" logs={sentVictoryConsequencePromptsLog} />
        </div>
        
        <div className="mb-4 text-fuchsia-300">
          <h5 className="text-md font-semibold mb-1">Nhật Ký Phản Hồi (Tóm tắt/Hậu quả CĐ) ({receivedCombatSummaryResponsesLog.length + receivedVictoryConsequenceResponsesLog.length} gần nhất)</h5>
          <LogSection title="Phản hồi Tóm Tắt CĐ" logs={receivedCombatSummaryResponsesLog} />
          <LogSection title="Phản hồi Hậu Quả CĐ" logs={receivedVictoryConsequenceResponsesLog} />
        </div>

        <div className="mb-4">
          <h5 className="text-md font-semibold text-cyan-300 mb-1">Nhật Ký Prompt Tạo Kinh Tế ({sentEconomyPromptsLog.length} gần nhất)</h5>
          {sentEconomyPromptsLog.length === 0 ? (
            <p className="text-xs italic text-gray-500">Chưa có prompt tạo kinh tế nào được gửi.</p>
          ) : (
            <LogSection title="Prompt Tạo Kinh Tế" logs={sentEconomyPromptsLog} />
          )}
        </div>

        <div className="mb-4">
          <h5 className="text-md font-semibold text-emerald-300 mb-1">Nhật Ký Phản Hồi Kinh Tế Từ AI ({receivedEconomyResponsesLog.length} gần nhất)</h5>
          {receivedEconomyResponsesLog.length === 0 ? (
            <p className="text-xs italic text-gray-500">Chưa có phản hồi kinh tế nào từ AI.</p>
          ) : (
            <LogSection title="Phản hồi Kinh Tế" logs={receivedEconomyResponsesLog} />
          )}
        </div>

        <div className="mb-4">
          <h5 className="text-md font-semibold text-rose-300 mb-1">Nhật Ký Prompt Tạo Địa Điểm Phụ ({sentGeneralSubLocationPromptsLog.length} gần nhất)</h5>
          {sentGeneralSubLocationPromptsLog.length === 0 ? (
            <p className="text-xs italic text-gray-500">Chưa có prompt tạo địa điểm phụ nào được gửi.</p>
          ) : (
            <LogSection title="Prompt Địa Điểm Phụ" logs={sentGeneralSubLocationPromptsLog} />
          )}
        </div>

        <div className="mb-4">
          <h5 className="text-md font-semibold text-fuchsia-300 mb-1">Nhật Ký Phản Hồi Địa Điểm Phụ Từ AI ({receivedGeneralSubLocationResponsesLog.length} gần nhất)</h5>
          {receivedGeneralSubLocationResponsesLog.length === 0 ? (
            <p className="text-xs italic text-gray-500">Chưa có phản hồi địa điểm phụ nào từ AI.</p>
          ) : (
            <LogSection title="Phản hồi Địa Điểm Phụ" logs={receivedGeneralSubLocationResponsesLog} />
          )}
        </div>

        {/* Crafting Prompts Log */}
        <div className="mb-4">
          <h5 className="text-md font-semibold text-orange-300 mb-1">Nhật Ký Prompt Luyện Chế ({sentCraftingPromptsLog.length} gần nhất)</h5>
          {sentCraftingPromptsLog.length === 0 ? (
            <p className="text-xs italic text-gray-500">Chưa có prompt luyện chế nào được gửi.</p>
          ) : (
             <LogSection title="Prompt Luyện Chế" logs={sentCraftingPromptsLog} />
          )}
        </div>

        {/* Crafting Responses Log */}
        <div className="mb-4">
          <h5 className="text-md font-semibold text-teal-300 mb-1">Nhật Ký Phản Hồi Luyện Chế Từ AI ({receivedCraftingResponsesLog.length} gần nhất)</h5>
          {receivedCraftingResponsesLog.length === 0 ? (
            <p className="text-xs italic text-gray-500">Chưa có phản hồi luyện chế nào từ AI.</p>
          ) : (
            <LogSection title="Phản hồi Luyện Chế" logs={receivedCraftingResponsesLog} />
          )}
        </div>

        {/* NPC Avatar Prompts Log */}
        <div>
          <h5 className="text-md font-semibold text-amber-300 mb-1">Nhật Ký Prompt Tạo Ảnh NPC ({sentNpcAvatarPromptsLog.length} gần nhất)</h5>
          {sentNpcAvatarPromptsLog.length === 0 ? (
            <p className="text-xs italic text-gray-500">Chưa có prompt tạo ảnh NPC nào được ghi lại.</p>
          ) : (
            <LogSection title="Prompt Ảnh NPC" logs={sentNpcAvatarPromptsLog} />
          )}
        </div>

      </div>
      <div 
        className="absolute bg-yellow-600 opacity-50 hover:opacity-100"
        style={{
            width: `${HANDLE_SIZE}px`,
            height: `${HANDLE_SIZE}px`,
            bottom: '0px',
            right: '0px',
            cursor: 'nwse-resize',
        }}
        onMouseDown={handleMouseDownResize}
      />
    </div>
  );
};

export default DebugPanelDisplay;
