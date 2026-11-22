import React from 'react';
import { GameMessage } from '../../../types';
import { Sparkles } from 'lucide-react';

interface StorySummaryItemProps {
  msg: GameMessage;
  containerMargin: string;
}

const StorySummaryItem: React.FC<StorySummaryItemProps> = ({ msg, containerMargin }) => {
  const isPageSummary = msg.type === 'page_summary';
  
  return (
    <div className={`flex justify-center ${containerMargin} w-full`}>
      <div className={`
        max-w-[90%] p-3 rounded-lg border shadow-sm relative overflow-hidden
        ${isPageSummary 
          ? 'bg-purple-900/30 border-purple-500/50 text-purple-200' 
          : 'bg-green-900/30 border-green-500/50 text-green-200'}
      `}>
        <div className="flex items-center gap-2 mb-1 border-b border-white/10 pb-1">
          <Sparkles size={14} className={isPageSummary ? 'text-purple-400' : 'text-green-400'} />
          <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">
            {isPageSummary ? 'Tóm tắt giai đoạn' : 'Sự kiện đặc biệt'}
          </span>
        </div>
        <p className="text-xs sm:text-sm italic leading-relaxed">
          {msg.content}
        </p>
      </div>
    </div>
  );
};

export default React.memo(StorySummaryItem);
