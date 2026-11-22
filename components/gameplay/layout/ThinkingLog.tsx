import React, { useState } from 'react';
import { Sparkles, Compass } from 'lucide-react';

interface ThinkingLogProps {
  content: string;
}

/**
 * ThinkingLog Component
 * Extracts and displays content within <thinking> tags with a toggle button.
 */
const ThinkingLog: React.FC<ThinkingLogProps> = ({ content }) => {
  const [isVisible, setIsVisible] = useState(false);

  const normalizedContent = (content || "").normalize('NFC');

  // Intelligent extraction function that does not truncate content due to internal nested tags
  const extractThinkingContent = (text: string): string[] => {
    const extractedBlocks: string[] = [];

    // Extract prethinking & tuong_than blocks explicitly
    const prethinkingRegex = /<(prethinking|tuong_than)>([\s\S]*?)(?:<\/(?:prethinking|tuong_than)>|$)/gi;
    let preMatch;
    while ((preMatch = prethinkingRegex.exec(text)) !== null) {
      const tag = preMatch[1];
      const inner = preMatch[2].trim();
      const block = `<${tag}>\n${inner}${text.includes(`</${tag}>`) ? `\n</${tag}>` : ''}`;
      if (!extractedBlocks.includes(block)) {
        extractedBlocks.push(block);
      }
    }

    // Handle orphan </prethinking> or </tuong_than> if present in raw text
    const hasPreOrTuong = text.toLowerCase().includes('prethinking') || text.toLowerCase().includes('tuong_than');
    if (hasPreOrTuong && extractedBlocks.length === 0) {
      const isTuongThan = text.toLowerCase().includes('tuong_than');
      const tagStr = isTuongThan ? 'tuong_than' : 'prethinking';
      const openTag = `<${tagStr}>`;
      const closeTag = `</${tagStr}>`;

      if (text.includes(closeTag)) {
        const parts = text.split(closeTag);
        const prePart = parts[0].replace(new RegExp(openTag, 'gi'), '').trim();
        if (prePart) {
          extractedBlocks.push(`${openTag}\n${prePart}\n${closeTag}`);
        } else {
          extractedBlocks.push(closeTag);
        }
      } else if (text.includes(openTag)) {
        const parts = text.split(openTag);
        if (parts[1]) {
          extractedBlocks.push(`${openTag}\n${parts[1].trim()}`);
        }
      }
    }

    let searchIndex = 0;
    while (searchIndex < text.length) {
      const matchOpen = text.slice(searchIndex).match(/<(thinking|think)>/i);
      if (!matchOpen || matchOpen.index === undefined) break;

      const openTag = matchOpen[0];
      const openIndex = searchIndex + matchOpen.index;
      const contentStartIndex = openIndex + openTag.length;

      const closeTagPattern = openTag.toLowerCase() === '<think>' ? '<\\/think>' : '<\\/thinking>';
      const closeTagRegex = new RegExp(closeTagPattern, 'i');
      const matchClose = text.slice(contentStartIndex).match(closeTagRegex);

      let blockText = "";
      let nextSearchIndex = contentStartIndex;

      if (matchClose && matchClose.index !== undefined) {
        const closeIndex = contentStartIndex + matchClose.index;
        blockText = text.substring(contentStartIndex, closeIndex);
        nextSearchIndex = closeIndex + matchClose[0].length;
      } else {
        // Fallback: search for anchor 'Bắt đầu viết' or start of next logical narrative segment if close tag is missing
        const anchorIndex = text.slice(contentStartIndex).indexOf("Bắt đầu viết");
        const nextSegmentMatch = text.slice(contentStartIndex).match(/<(content|narration)>/i);
        
        let cutoffIndex = -1;
        if (anchorIndex !== -1 && (nextSegmentMatch?.index === undefined || anchorIndex < nextSegmentMatch.index)) {
          cutoffIndex = anchorIndex;
        } else if (nextSegmentMatch && nextSegmentMatch.index !== undefined) {
          cutoffIndex = nextSegmentMatch.index;
        }

        if (cutoffIndex !== -1) {
          blockText = text.substring(contentStartIndex, contentStartIndex + cutoffIndex);
          nextSearchIndex = contentStartIndex + cutoffIndex;
        } else {
          blockText = text.substring(contentStartIndex);
          nextSearchIndex = text.length;
        }
      }

      const trimmedBlock = blockText.trim();
      if (trimmedBlock && !extractedBlocks.includes(trimmedBlock)) {
        extractedBlocks.push(trimmedBlock);
      }
      searchIndex = nextSearchIndex;
    }
    return extractedBlocks;
  };

  // Extract all thinking blocks safely
  const blocks = extractThinkingContent(normalizedContent);

  // Fallback: If no explicit thinking block was matched, but there is text before "Bắt đầu viết", "</thinking>", or "<content>", treat that pre-anchor text as thinking content.
  if (blocks.length === 0) {
    const anchors = ["Bắt đầu viết", "</thinking>", "<content>"];
    let lastAnchorIndex = -1;
    for (const anchor of anchors) {
      const index = normalizedContent.lastIndexOf(anchor);
      if (index > lastAnchorIndex) {
        lastAnchorIndex = index;
      }
    }
    if (lastAnchorIndex > 0) {
      const preAnchorText = normalizedContent.substring(0, lastAnchorIndex).trim();
      if (preAnchorText) {
        blocks.push(preAnchorText);
      }
    }
  }

  let thinkingContent = blocks.length > 0 ? blocks.join('\n\n---\n\n') : null;

  // Extract audit logs and other technical checkpoints
  const auditRegex = /\[(Progress|Audit|Word Count|Checkpoint|Technical):[\s\S]*?\]/gi;
  const auditMatches = normalizedContent.match(auditRegex);
  const auditContent = auditMatches ? auditMatches.join('\n\n') : null;

  // Ensure thinkingContent doesn't contain narration or content tags
  if (thinkingContent) {
      thinkingContent = thinkingContent.replace(/<(content|narration)>([\s\S]*?)(?:<\/(?:content|narration)>|$)/gi, '').trim();
  }

  // Regex to extract Canon Alignment parts
  const canonRegex = /\[CANON RECALL\]([\s\S]*?)\[ALIGNMENT\]([\s\S]*?)(?=\n\d\.|$|\[)/;
  const canonMatch = thinkingContent ? thinkingContent.match(canonRegex) : null;

  // Parse Yggdrasil Quest Audit line
  interface YggdrasilAuditData {
    questName: string;
    coreObjective: string;
    evidence: string;
    verdict: string;
    statusType: 'completed' | 'progress' | 'incomplete';
  }

  const extractYggdrasilAudit = (text: string | null): YggdrasilAuditData | null => {
    if (!text) return null;
    const match = text.match(/\[YGGDRASIL_QUEST_AUDIT\]\s*\|([^\n]+)/i);
    if (!match) return null;

    const segments = match[1].split('|').map(s => s.trim()).filter(Boolean);
    const getField = (prefixRegex: RegExp) => {
      const found = segments.find(seg => prefixRegex.test(seg));
      return found ? found.replace(prefixRegex, '').trim().replace(/^["']|["']\.?$/g, '') : '';
    };

    const questName = getField(/^Nhiệm\s*vụ\s*:\s*/i) || 'Không rõ';
    const coreObjective = getField(/^Mục\s*tiêu(?:\s*cốt\s*lõi)?\s*:\s*/i) || 'Không rõ';
    const evidence = getField(/^Bằng\s*chứng(?:\s*lượt\s*này)?\s*:\s*/i) || 'Không rõ';
    const verdict = getField(/^Phán\s*quyết\s*:\s*/i) || segments[segments.length - 1] || 'Chưa rõ';

    const verdictUpper = verdict.toUpperCase();
    let statusType: 'completed' | 'progress' | 'incomplete' = 'incomplete';
    if (verdictUpper.includes('CHƯA HOÀN THÀNH') || verdictUpper.includes('CHƯA ĐẠT')) {
      statusType = 'incomplete';
    } else if (verdictUpper.includes('CÓ TIẾN TRIỂN') || verdictUpper.includes('TIẾN TRIỂN')) {
      statusType = 'progress';
    } else if (verdictUpper.includes('HOÀN THÀNH')) {
      statusType = 'completed';
    }

    return { questName, coreObjective, evidence, verdict, statusType };
  };

  const yggdrasilAudit = extractYggdrasilAudit(thinkingContent);

  // Backstage block definition and extraction
  interface BackstageBlock {
    tagName: string;
    displayName: string;
    colorClass: string;
    borderClass: string;
    bgClass: string;
    content: string;
  }

  const extractBackstageBlocks = (text: string): BackstageBlock[] => {
    const result: BackstageBlock[] = [];
    const tagsConfig = [
      { name: 'Entity_Tracking', display: 'Entity Tracking (Giám Sát Thực Thể)', color: 'text-amber-400', border: 'border-amber-500/40', bg: 'bg-amber-950/15' },
      { name: 'SECRET_ACTION', display: 'Secret Action (Hành Động Bí Mật)', color: 'text-red-400', border: 'border-red-500/40', bg: 'bg-red-950/15' },
      { name: 'ENIGMA_RECORD', display: 'Enigma Record (Hồ Sơ Bí Ẩn)', color: 'text-cyan-400', border: 'border-cyan-500/40', bg: 'bg-cyan-950/15' },
      { name: 'SEED_PLANT', display: 'Seed Plant (Gieo Mầm Nhân Quả)', color: 'text-emerald-400', border: 'border-emerald-500/40', bg: 'bg-emerald-950/15' },
      { name: 'Seed_Plant', display: 'Seed Plant (Gieo Mầm Nhân Quả)', color: 'text-emerald-400', border: 'border-emerald-500/40', bg: 'bg-emerald-950/15' },
      { name: 'Seed', display: 'Seed (Gieo Mầm)', color: 'text-emerald-400', border: 'border-emerald-500/40', bg: 'bg-emerald-950/15' },
      { name: 'Plant', display: 'Plant (Cắm Mầm)', color: 'text-emerald-400', border: 'border-emerald-500/40', bg: 'bg-emerald-950/15' },
      { name: 'Update_Data', display: 'Update Data (Dữ Liệu Đồng Bộ Thiên Đạo)', color: 'text-pink-400', border: 'border-pink-500/40', bg: 'bg-pink-950/15' },
      { name: 'UPDATE_DATA', display: 'Update Data (Dữ Liệu Đồng Bộ Thiên Đạo)', color: 'text-pink-400', border: 'border-pink-500/40', bg: 'bg-pink-950/15' }
    ];

    tagsConfig.forEach(cfg => {
      const regex = new RegExp(`<(${cfg.name})>([\\s\\S]*?)(?:<\\/\\1>|$)`, 'gi');
      let match;
      while ((match = regex.exec(text)) !== null) {
        const blockContent = match[2].trim();
        if (blockContent) {
          result.push({
            tagName: cfg.name,
            displayName: cfg.display,
            colorClass: cfg.color,
            borderClass: cfg.border,
            bgClass: cfg.bg,
            content: blockContent
          });
        }
      }
    });

    return result;
  };

  const backstageBlocks = extractBackstageBlocks(normalizedContent);

  // If there's no thinking content, no audit logs, and no backstage data, don't render
  const hasBackstage = backstageBlocks.length > 0;
  const hasThinking = !!thinkingContent || normalizedContent.includes('<thinking>') || normalizedContent.includes('<think>') || normalizedContent.toLowerCase().includes('prethinking') || normalizedContent.toLowerCase().includes('tuong_than') || normalizedContent.includes('Bắt đầu viết');
  const hasAudit = !!auditContent;

  if (!hasThinking && !hasAudit && !hasBackstage) {
      return null;
  }

  return (
    <div className="mb-2 w-full">
      <div className="flex flex-wrap gap-2 mb-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsVisible(!isVisible);
          }}
          className="flex items-center gap-1.5 px-2 py-1 text-[10px] uppercase tracking-wider font-bold text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 rounded border border-blue-500/30 transition-all duration-200"
          title="Xem tư duy của AI"
        >
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            viewBox="0 0 20 20" 
            fill="currentColor" 
            className={`w-3 h-3 transition-transform duration-200 ${isVisible ? 'rotate-180' : ''}`}
          >
            <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
          </svg>
          Raw Log
        </button>

        {canonMatch && (
          <div className="flex items-center gap-1.5 px-2 py-1 text-[10px] uppercase tracking-wider font-bold text-amber-400 bg-amber-500/10 rounded border border-amber-500/30">
            <Sparkles size={12} className="animate-pulse" />
            Định Mệnh Đồng Quy
          </div>
        )}

        {auditContent && (
          <div className="flex items-center gap-1.5 px-2 py-1 text-[10px] uppercase tracking-wider font-bold text-emerald-400 bg-emerald-500/10 rounded border border-emerald-500/30">
            Audit Checkpoint
          </div>
        )}

        {hasBackstage && (
          <div className="flex items-center gap-1.5 px-2 py-1 text-[10px] uppercase tracking-wider font-bold text-purple-400 bg-purple-500/10 rounded border border-purple-500/30 animate-pulse">
            Backstage Data ({backstageBlocks.length})
          </div>
        )}

        {yggdrasilAudit && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsVisible(!isVisible);
            }}
            className={`flex items-center gap-1.5 px-2 py-1 text-[10px] uppercase tracking-wider font-bold rounded border transition-all duration-200 ${
              yggdrasilAudit.statusType === 'completed'
                ? 'text-emerald-300 bg-emerald-500/15 border-emerald-500/40 hover:bg-emerald-500/25'
                : yggdrasilAudit.statusType === 'progress'
                ? 'text-amber-300 bg-amber-500/15 border-amber-500/40 hover:bg-amber-500/25'
                : 'text-slate-300 bg-slate-500/15 border-slate-500/40 hover:bg-slate-500/25'
            }`}
            title="Xem kết quả thẩm định nhiệm vụ của thanh tra Yggdrasil"
          >
            <Compass size={12} />
            Yggdrasil: {yggdrasilAudit.statusType === 'completed' ? 'HOÀN THÀNH' : yggdrasilAudit.statusType === 'progress' ? 'TIẾN TRIỂN' : 'CHƯA HOÀN THÀNH'} - {yggdrasilAudit.questName}
          </button>
        )}
      </div>

      {/* Grounding URLs UI - Placeholder for future implementation */}
      {/* {groundingUrls && groundingUrls.length > 0 && (
        <div className="mt-2 p-2 bg-blue-900/20 border border-blue-500/30 rounded">
          <span className="text-[10px] text-blue-400 font-bold">Nguồn tra cứu (Grounding):</span>
          <ul className="list-disc list-inside text-[10px] text-gray-400">
            {groundingUrls.map(url => (
              <li><a href={url} target="_blank" rel="noreferrer">{url}</a></li>
            ))}
          </ul>
        </div>
      )} */}

      {canonMatch && (
        <div className="mb-3 p-3 border-l-4 border-amber-500 bg-amber-900/20 rounded-r-lg animate-in fade-in slide-in-from-left-1 duration-300">
          <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase mb-1">
            <Sparkles size={14} />
            Phân Tích Đồng Quy
          </div>
          <p className="text-[10px] text-gray-400 italic mb-2">"Mạch truyện đang dần giao thoa với nguyên tác..."</p>
          <div className="space-y-2">
            <div className="text-xs text-amber-200/80">
              <span className="font-bold text-amber-400/80 mr-1">Nguyên tác:</span>
              {canonMatch[1].trim()}
            </div>
            <div className="text-xs text-amber-100">
              <span className="font-bold text-amber-400/80 mr-1">Chiến lược:</span>
              {canonMatch[2].trim()}
            </div>
          </div>
        </div>
      )}

      {isVisible && (
        <div className="mt-2 animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="bg-gray-900/80 backdrop-blur-sm p-3 rounded-lg border-l-2 border-blue-500 shadow-inner overflow-hidden">
            {yggdrasilAudit && (
              <div
                className={`mb-4 p-3.5 rounded-lg border ${
                  yggdrasilAudit.statusType === 'completed'
                    ? 'border-emerald-500/50 bg-emerald-950/20'
                    : yggdrasilAudit.statusType === 'progress'
                    ? 'border-amber-500/50 bg-amber-950/20'
                    : 'border-slate-500/40 bg-slate-900/40'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <Compass size={14} className={
                      yggdrasilAudit.statusType === 'completed'
                        ? 'text-emerald-400'
                        : yggdrasilAudit.statusType === 'progress'
                        ? 'text-amber-400'
                        : 'text-slate-400'
                    } />
                    <span className="text-[10px] font-mono uppercase tracking-widest font-bold text-gray-200">
                      Yggdrasil Quest Audit Gate
                    </span>
                  </div>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase ${
                    yggdrasilAudit.statusType === 'completed'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : yggdrasilAudit.statusType === 'progress'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : 'bg-slate-600/30 text-slate-300 border border-slate-500/40'
                  }`}>
                    {yggdrasilAudit.statusType === 'completed' ? 'HOÀN THÀNH' : yggdrasilAudit.statusType === 'progress' ? 'CÓ TIẾN TRIỂN' : 'CHƯA HOÀN THÀNH'}
                  </span>
                </div>
                <div className="space-y-1 text-xs font-mono text-gray-300 leading-relaxed">
                  <div><span className="text-gray-400">• Nhiệm vụ / Sự kiện:</span> <span className="text-white font-semibold">{yggdrasilAudit.questName}</span></div>
                  <div><span className="text-gray-400">• Mục tiêu cốt lõi:</span> {yggdrasilAudit.coreObjective}</div>
                  <div><span className="text-gray-400">• Bằng chứng lượt này:</span> {yggdrasilAudit.evidence}</div>
                  <div><span className="text-gray-400">• Phán quyết &amp; Đồng bộ:</span> {yggdrasilAudit.verdict}</div>
                </div>
              </div>
            )}

            {thinkingContent && (
              <div className="mb-4 p-3.5 border border-green-500 bg-green-950/10 rounded-lg shadow-[0_0_12px_rgba(34,197,94,0.15)]">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] font-mono text-green-400 uppercase tracking-widest font-bold">Bộ phận hỗ trợ - Hỗ trợ hiển thị logic suy nghĩ của AI</span>
                  <div className="h-[1px] flex-grow bg-green-500/30"></div>
                </div>
                <div className="text-xs font-mono text-gray-300 leading-relaxed whitespace-pre-wrap italic pl-1">
                  {thinkingContent}
                </div>
              </div>
            )}

            {hasBackstage && (
              <div className="space-y-4 mb-4">
                {backstageBlocks.map((block, idx) => (
                  <div key={idx} className={`p-3.5 border ${block.borderClass} ${block.bgClass} rounded-lg shadow-sm animate-in fade-in slide-in-from-left-1 duration-200`}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-[10px] font-mono ${block.colorClass} uppercase tracking-widest font-bold`}>
                        {block.displayName}
                      </span>
                      <div className={`h-[1px] flex-grow opacity-30 ${block.colorClass.replace('text-', 'bg-')}`}></div>
                    </div>
                    <div className="text-xs font-mono text-gray-200 leading-relaxed whitespace-pre-wrap pl-1 select-text">
                      {block.content}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {auditContent && (
              <div>
                <div className="flex items-center gap-2 mb-1.5 opacity-50">
                  <span className="text-[9px] font-mono text-emerald-400 uppercase tracking-widest">Audit & Progress Logs</span>
                  <div className="h-[1px] flex-grow bg-emerald-500/20"></div>
                </div>
                <div className="text-xs font-mono text-emerald-200/60 leading-relaxed whitespace-pre-wrap italic">
                  {auditContent}
                </div>
              </div>
            )}

            {!thinkingContent && !auditContent && !hasBackstage && (
              <div className="text-xs font-mono text-gray-500 italic">
                Không có dữ liệu chi tiết cho lượt này.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ThinkingLog;
