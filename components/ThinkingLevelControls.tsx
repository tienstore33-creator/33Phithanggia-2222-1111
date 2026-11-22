import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Brain } from 'lucide-react';
import {
  THINKING_LEVEL_LABELS,
  THINKING_LEVEL_SHORT_LABELS,
  ConfigurableThinkingModelItem,
  cleanThinkingModelId,
  getSupportedThinkingLevels,
} from '../utils/thinkingLevelUtils';

interface ThinkingLevelControlProps {
  modelId: string;
  modelThinkingLevels: Record<string, string>;
  onChange: (modelId: string, level: string) => void;
}

export const ThinkingLevelControl: React.FC<ThinkingLevelControlProps> = ({
  modelId,
  modelThinkingLevels,
  onChange,
}) => {
  const cleanId = cleanThinkingModelId(modelId);
  const supportedLevels = getSupportedThinkingLevels(cleanId);

  if (supportedLevels.length === 0) {
    return null;
  }

  const currentLevel =
    modelThinkingLevels[cleanId] || modelThinkingLevels[modelId] || 'auto';

  return (
    <div className="mt-2.5 p-3 bg-gray-800/40 border border-gray-700/80 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="text-xs font-medium text-indigo-300 break-words">
          Mức Thinking Level ({cleanId})
        </div>
        <div className="text-[11px] text-gray-400 font-mono mt-0.5 tracking-wide">
          Hỗ trợ: {supportedLevels.map((lvl) => lvl.toUpperCase()).join(' · ')}
        </div>
      </div>

      <select
        value={currentLevel}
        onChange={(e) => onChange(cleanId, e.target.value)}
        aria-label={`Thinking Level cho ${cleanId}`}
        className="w-full sm:w-auto sm:min-w-[235px] bg-gray-900 border border-gray-600 rounded-md px-3 py-2 text-xs text-gray-100 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
      >
        <option value="auto">Mặc định (Tự động)</option>
        {supportedLevels.map((lvl) => (
          <option key={lvl} value={lvl}>
            {THINKING_LEVEL_LABELS[lvl]}
          </option>
        ))}
      </select>
    </div>
  );
};

interface ThinkingLevelAccordionProps {
  models: ConfigurableThinkingModelItem[];
  modelThinkingLevels: Record<string, string>;
  onChange: (modelId: string, level: string) => void;
}

export const ThinkingLevelAccordion: React.FC<ThinkingLevelAccordionProps> = ({
  models,
  modelThinkingLevels,
  onChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  if (models.length === 0) {
    return null;
  }

  return (
    <div className="border border-gray-700/80 rounded-lg bg-gray-800/30 overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full p-3.5 flex items-start justify-between gap-3 text-left hover:bg-gray-800/50 transition-colors"
      >
        <div className="flex items-start gap-2.5 min-w-0">
          <span className="mt-0.5 text-indigo-400 shrink-0">
            {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </span>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-gray-200 flex items-center gap-2 flex-wrap">
              <Brain size={15} className="text-indigo-400 shrink-0" />
              <span>
                Tùy chỉnh Thinking Level theo từng Model ({models.length} model hỗ trợ)
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              Thiết lập mức suy luận riêng cho từng model Gemini.
            </p>
          </div>
        </div>
      </button>

      {isOpen && (
        <div className="border-t border-gray-700/80 p-3.5 space-y-3 bg-gray-900/30">
          {models.map((item) => {
            const currentLevel = modelThinkingLevels[item.id] || 'auto';
            return (
              <div
                key={item.id}
                className="p-3 rounded-lg bg-gray-800/40 border border-gray-700/60 flex flex-col gap-2"
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-sm font-medium text-gray-100">
                    {item.name}
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {item.roles.map((role) => (
                      <span
                        key={role}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-950/60 border border-indigo-700/40 text-indigo-300"
                      >
                        {role}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="text-[11px] text-gray-400 font-mono">
                  {item.id} · [{item.supportedLevels.join(', ')}]
                </div>
                <select
                  value={currentLevel}
                  onChange={(e) => onChange(item.id, e.target.value)}
                  aria-label={`Tùy chỉnh Thinking Level cho ${item.name}`}
                  className="w-full bg-gray-900 border border-gray-600 rounded-md px-3 py-2 text-xs text-gray-100 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="auto">Mặc định (Tự động)</option>
                  {item.supportedLevels.map((lvl) => (
                    <option key={lvl} value={lvl}>
                      {THINKING_LEVEL_LABELS[lvl]}
                    </option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

interface FallbackThinkingSelectProps {
  modelId: string;
  modelThinkingLevels: Record<string, string>;
  onChange: (modelId: string, level: string) => void;
}

export const FallbackThinkingSelect: React.FC<FallbackThinkingSelectProps> = ({
  modelId,
  modelThinkingLevels,
  onChange,
}) => {
  const cleanId = cleanThinkingModelId(modelId);
  const supportedLevels = getSupportedThinkingLevels(cleanId);

  if (supportedLevels.length === 0) {
    return null;
  }

  const currentLevel =
    modelThinkingLevels[cleanId] || modelThinkingLevels[modelId] || 'auto';

  return (
    <select
      value={currentLevel}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => {
        e.stopPropagation();
        onChange(cleanId, e.target.value);
      }}
      aria-label={`Thinking Level cho fallback ${cleanId}`}
      className="bg-gray-900 border border-gray-600/80 rounded px-2 py-1 text-[11px] font-medium text-indigo-200 focus:outline-none focus:border-indigo-500 shrink-0"
    >
      <option value="auto">{THINKING_LEVEL_SHORT_LABELS.auto}</option>
      {supportedLevels.map((lvl) => (
        <option key={lvl} value={lvl}>
          {THINKING_LEVEL_SHORT_LABELS[lvl]}
        </option>
      ))}
    </select>
  );
};
