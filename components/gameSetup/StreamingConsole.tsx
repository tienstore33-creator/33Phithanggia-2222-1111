import React, { useEffect, useRef } from 'react';
import { Loader2, Brain, Terminal, X } from 'lucide-react';

interface StreamingConsoleProps {
  streamingText: string;
  isStreamingActive: boolean;
  onClose?: () => void;
}

export const StreamingConsole: React.FC<StreamingConsoleProps> = ({
  streamingText,
  isStreamingActive,
  onClose
}) => {
  const prethinkingRef = useRef<HTMLDivElement>(null);
  const outputRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom when new text arrives
  useEffect(() => {
    if (prethinkingRef.current) {
      prethinkingRef.current.scrollTop = prethinkingRef.current.scrollHeight;
    }
  }, [streamingText]);

  if (!isStreamingActive && !streamingText) return null;

  // Extract <prethinking> ... </prethinking> or <tuong_than> ... </tuong_than> or <thinking> ... </thinking>
  let prethinking = '';
  let cleanOutput = streamingText;

  const preMatch = streamingText.match(/<prethinking>([\s\S]*?)(<\/prethinking>|$)/i);
  const tuongThanMatch = streamingText.match(/<tuong_than>([\s\S]*?)(<\/tuong_than>|$)/i);
  const thinkMatch = streamingText.match(/<thinking>([\s\S]*?)(<\/thinking>|$)/i);

  if (tuongThanMatch) {
    prethinking = tuongThanMatch[1].trim();
  } else if (preMatch) {
    prethinking = preMatch[1].trim();
  } else if (thinkMatch) {
    prethinking = thinkMatch[1].trim();
  }

  // If no closing tag yet, everything after opening tag can be prethinking
  if (!prethinking && (streamingText.includes('<prethinking>') || streamingText.includes('<tuong_than>') || streamingText.includes('<thinking>'))) {
    const startTag = streamingText.includes('<tuong_than>') 
      ? '<tuong_than>' 
      : (streamingText.includes('<prethinking>') ? '<prethinking>' : '<thinking>');
    const idx = streamingText.indexOf(startTag);
    prethinking = streamingText.substring(idx + startTag.length).trim();
  }

  // Clean output is everything outside thinking tags
  cleanOutput = streamingText
    .replace(/<prethinking>[\s\S]*?<\/prethinking>/gi, '')
    .replace(/<tuong_than>[\s\S]*?<\/tuong_than>/gi, '')
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
    // also remove unclosed tags
    .replace(/<prethinking>[\s\S]*/gi, '')
    .replace(/<tuong_than>[\s\S]*/gi, '')
    .replace(/<thinking>[\s\S]*/gi, '')
    .trim();

  return (
    <div id="ai-streaming-console" className="bg-gray-950 border border-gray-800 rounded-lg p-4 my-4 shadow-2xl relative overflow-hidden transition-all duration-300">
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-gray-800 pb-3 mb-3">
        <div className="flex items-center gap-2">
          {isStreamingActive ? (
            <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />
          ) : (
            <div className="w-2 h-2 rounded-full bg-gray-500 animate-pulse" />
          )}
          <span className="text-xs font-mono font-bold tracking-wider text-gray-300 uppercase">
            {isStreamingActive ? '⚙️ AI STREAMING' : '📋 BẢN GHI PHÂN TÍCH AI HOÀN TẤT'}
          </span>
        </div>
        {!isStreamingActive && onClose && (
          <button 
            type="button" 
            onClick={onClose}
            className="text-gray-500 hover:text-white transition-colors"
            title="Đóng bảng hiển thị"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Left Column: AI Cognitive Process (Prethinking) */}
        <div className="flex flex-col h-48 border border-gray-900 bg-gray-900/40 rounded-md p-3">
          <div className="flex items-center gap-2 mb-2 text-amber-400">
            <Brain className="w-4 h-4" />
            <span className="text-xs font-semibold font-mono">Luồng Tư Duy Của Hệ Thống:</span>
          </div>
          <div 
            ref={prethinkingRef}
            className="flex-1 overflow-y-auto text-xs font-mono text-gray-400 leading-relaxed scrollbar-thin scrollbar-thumb-gray-800 scrollbar-track-transparent pr-1 whitespace-pre-wrap select-text"
          >
            {prethinking || (isStreamingActive ? 'Đang kích hoạt quy trình lập luận...' : 'Không có dữ liệu lập luận.')}
          </div>
        </div>

        {/* Right Column: AI Live Structured Output */}
        <div className="flex flex-col h-48 border border-gray-900 bg-gray-900/20 rounded-md p-3">
          <div className="flex items-center gap-2 mb-2 text-emerald-400">
            <Terminal className="w-4 h-4" />
            <span className="text-xs font-semibold font-mono">Kết Quả Phân Tích Thực Thể (Live Output):</span>
          </div>
          <div 
            ref={outputRef}
            className="flex-1 overflow-y-auto text-xs font-mono text-emerald-300/90 leading-relaxed scrollbar-thin scrollbar-thumb-gray-800 scrollbar-track-transparent pr-1 whitespace-pre-wrap select-text"
          >
            {cleanOutput || (isStreamingActive ? 'Đang trích xuất các thẻ thuộc tính...' : 'Không có dữ liệu.')}
          </div>
        </div>
      </div>

      {/* Decorative footer/stats */}
      <div className="flex justify-between items-center mt-3 pt-2 border-t border-gray-900 text-[10px] font-mono text-gray-600">
        <span>Kích thước luồng: {streamingText.length} kí tự</span>
        <span>Mấu chốt suy nghĩ: Enforced &lt;tuong_than&gt;</span>
      </div>
    </div>
  );
};
