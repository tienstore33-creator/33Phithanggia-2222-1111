import React, { useState } from 'react';
import { Globe, ExternalLink, Search, Link2, ChevronDown, ChevronUp, ShieldCheck, Sparkles } from 'lucide-react';
import { GroundingData } from '../../types/chatbot';

interface ChatbotReferenceSourcesProps {
  grounding?: GroundingData;
  className?: string;
  variant?: 'main' | 'verifier';
  titleLabel?: string;
}

export const getDomainFromUrl = (url: string): string => {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};

export const ChatbotReferenceSources: React.FC<ChatbotReferenceSourcesProps> = ({
  grounding,
  className = '',
  variant = 'main',
  titleLabel,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const isVerifier = variant === 'verifier';
  const sources = grounding?.sources || [];
  const queries = grounding?.webSearchQueries || [];
  
  // Xác định nhãn trên nút Pill
  let countLabel = '';
  if (sources.length > 0) {
    countLabel = `${sources.length} trang web`;
  } else if (queries.length > 0) {
    countLabel = `${queries.length} truy vấn`;
  } else {
    countLabel = isVerifier ? '0 nguồn đối chiếu' : '0 trang web (Tri thức nội tại)';
  }

  const defaultTitle = isVerifier 
    ? 'Nguồn kiểm chứng độc lập (Verifier)' 
    : 'Nguồn tham khảo & tài liệu đối chiếu';

  return (
    <div className={`mt-2.5 transition-all duration-200 ${className}`}>
      {/* 1. NÚT PILL THU GỌN BAN ĐẦU (Luôn luôn hiển thị theo yêu cầu) */}
      {!isExpanded ? (
        <button
          type="button"
          onClick={() => setIsExpanded(true)}
          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border shadow-sm transition-all duration-150 cursor-pointer active:scale-95 group ${
            isVerifier
              ? 'bg-indigo-950/70 hover:bg-indigo-900/90 text-indigo-200 hover:text-white border-indigo-700/60 hover:border-indigo-500'
              : sources.length > 0
              ? 'bg-gray-900/90 hover:bg-gray-800 text-gray-200 hover:text-white border-gray-700/80 hover:border-emerald-500/60'
              : 'bg-gray-900/70 hover:bg-gray-850 text-gray-400 hover:text-gray-200 border-gray-800 hover:border-gray-600'
          }`}
          title="Bấm để xem các trang web và tài liệu AI đã tra cứu"
        >
          <div className="flex items-center -space-x-1.5">
            {isVerifier ? (
              <ShieldCheck size={14} className="text-indigo-400 group-hover:scale-110 transition-transform" />
            ) : sources.length > 0 ? (
              <>
                <Link2 size={13} className="text-emerald-400 transform -rotate-45" />
                <Globe size={13} className="text-emerald-400" />
              </>
            ) : (
              <Sparkles size={13} className="text-gray-400 group-hover:text-indigo-300" />
            )}
          </div>

          <span className="font-semibold tracking-wide">
            {countLabel}
          </span>

          <ChevronDown size={14} className="opacity-70 group-hover:opacity-100 ml-0.5" />
        </button>
      ) : (
        /* 2. KHUNG NỘI DUNG CHI TIẾT (Chỉ hiện ra sau khi người dùng bấm mở) */
        <div className={`p-3 sm:p-3.5 rounded-xl border shadow-xl space-y-2.5 animate-fade-in text-xs max-w-3xl ${
          isVerifier
            ? 'bg-indigo-950/50 border-indigo-800/70'
            : 'bg-gray-950/85 border-gray-800'
        }`}>
          {/* Header với nút Thu Gọn */}
          <div className="flex items-center justify-between gap-2 pb-2 border-b border-white/10">
            <div className="flex items-center gap-1.5 font-semibold text-gray-200 text-[11px] sm:text-xs">
              {isVerifier ? (
                <ShieldCheck size={14} className="text-indigo-400 flex-shrink-0" />
              ) : (
                <Link2 size={14} className="text-emerald-400 flex-shrink-0 transform -rotate-45" />
              )}
              <span>{titleLabel || defaultTitle}</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-medium ${
                isVerifier ? 'bg-indigo-900/80 text-indigo-200 border border-indigo-700/60' : 'bg-emerald-950 text-emerald-300 border border-emerald-800/60'
              }`}>
                {sources.length > 0 ? `${sources.length} nguồn` : `${queries.length} từ khóa`}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setIsExpanded(false)}
              className="text-[11px] text-gray-400 hover:text-white flex items-center gap-1 px-2 py-1 rounded-md hover:bg-white/10 transition-colors cursor-pointer"
              title="Thu gọn lại"
            >
              <span>Thu gọn</span>
              <ChevronUp size={13} />
            </button>
          </div>

          {/* Danh sách Thẻ Liên Kết (Clickable Link Chips) */}
          {sources.length > 0 ? (
            <div className="space-y-1.5">
              <div className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">
                Trang web & tài liệu đã đối chiếu ({sources.length}):
              </div>
              <div className="flex flex-wrap items-center gap-1.5 max-h-56 overflow-y-auto custom-scrollbar pr-1">
                {sources.map((src, idx) => {
                  const domain = src.domain || getDomainFromUrl(src.url);
                  return (
                    <a
                      key={idx}
                      href={src.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] transition-all duration-150 group shadow-sm border ${
                        isVerifier
                          ? 'bg-indigo-900/40 hover:bg-indigo-900/80 text-gray-200 hover:text-white border-indigo-700/50 hover:border-indigo-500'
                          : 'bg-gray-900/90 hover:bg-gray-800 text-gray-200 hover:text-white border-gray-700/70 hover:border-indigo-500/60'
                      }`}
                      title={`${src.title || domain}\n${src.url}`}
                    >
                      <Globe size={11} className={`${isVerifier ? 'text-indigo-400' : 'text-emerald-400'} flex-shrink-0 group-hover:scale-110 transition-transform`} />
                      <span className="font-medium max-w-[180px] sm:max-w-[240px] truncate">
                        {src.title || domain}
                      </span>
                      <span className="text-[9px] text-gray-400 opacity-75 font-mono hidden sm:inline truncate max-w-[100px]">
                        ({domain})
                      </span>
                      <ExternalLink size={10} className="text-gray-500 group-hover:text-indigo-300 flex-shrink-0 ml-0.5" />
                    </a>
                  );
                })}
              </div>
            </div>
          ) : queries.length === 0 ? (
            <div className="py-2 text-gray-400 text-xs italic">
              * Câu trả lời này được AI tổng hợp trực tiếp từ kho tri thức nội tại (chưa phát sinh truy vấn trang web bên ngoài).
            </div>
          ) : null}

          {/* Danh sách Từ Khóa Tra Cứu */}
          {queries.length > 0 && (
            <div className="pt-2 border-t border-white/10 space-y-1.5">
              <div className="text-[10px] text-gray-400 flex items-center gap-1 uppercase tracking-wider font-semibold">
                <Search size={11} className="text-indigo-400" />
                <span>Từ khóa đã tìm kiếm ({queries.length}):</span>
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto custom-scrollbar pr-1">
                {queries.map((q, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 rounded-md bg-gray-900/80 border border-gray-700/60 text-indigo-300 text-[10px] font-mono"
                  >
                    "{q}"
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
