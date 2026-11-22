import React, { forwardRef } from 'react';
import { GameMessage } from '../../../types';
import { parseNarration } from '../../../utils/journalParser';
import FormattedNarration from '../FormattedNarration';

interface JournalTurnProps {
    msg: GameMessage;
    parseAndHighlightText?: (text: string) => React.ReactNode[];
}

const JournalTurn = forwardRef<HTMLDivElement, JournalTurnProps>(({ msg, parseAndHighlightText }, ref) => {
    const isNarration = msg.type === 'narration';
    const content = isNarration ? parseNarration(msg.content) : msg.content;
    
    return (
        <div 
            ref={ref} 
            className="relative pl-6 border-l-2 border-slate-700 scroll-margin-top-[80px]"
            id={`turn-wrapper-${msg.turnNumber}`}
        >
            <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-slate-700 border-4 border-slate-900" />
            <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Lượt {msg.turnNumber}
                </span>
                <span className="text-[10px] text-slate-600">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
            </div>
            <div className={`text-base leading-relaxed ${msg.type === 'player_action' ? 'text-amber-200 italic font-medium' : 'text-slate-300'}`}>
                {msg.type === 'player_action' ? 
                    (parseAndHighlightText ? parseAndHighlightText(content) : content) : 
                    <FormattedNarration content={content} parseAndHighlightText={parseAndHighlightText} />
                }
            </div>
        </div>
    );
});

JournalTurn.displayName = 'JournalTurn';

export default JournalTurn;
