import React, { useState } from 'react';
import { Sparkles, X, Play, CheckCircle, AlertTriangle, Copy, Check, Eye, EyeOff, ShieldAlert, Cpu } from 'lucide-react';
import { callGeminiAPI } from '../../../services/geminiService';

interface PromptCheck429ModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialPrompt: string;
  systemInstruction: string;
  actionText: string;
  inputType: string;
  responseLength: string;
  useGoogleSearch?: boolean;
  isOocAction?: boolean;
  onApplyToGame?: (editedPrompt: string) => Promise<void>;
}

export const PromptCheck429Modal: React.FC<PromptCheck429ModalProps> = ({
  isOpen,
  onClose,
  initialPrompt,
  systemInstruction,
  actionText,
  inputType,
  responseLength,
  useGoogleSearch = true,
  isOocAction = false,
  onApplyToGame
}) => {
  const [editedPrompt, setEditedPrompt] = useState<string>(initialPrompt);
  const [showSystemInstruction, setShowSystemInstruction] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [apiResponse, setApiResponse] = useState<string | null>(null);
  const [modelUsed, setModelUsed] = useState<string>('');
  const [apiError, setApiError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [executionTimeSec, setExecutionTimeSec] = useState<number>(0);

  // Synchronize when initialPrompt changes
  React.useEffect(() => {
    setEditedPrompt(initialPrompt);
    setApiResponse(null);
    setApiError(null);
  }, [initialPrompt]);

  if (!isOpen) return null;

  const charCount = editedPrompt.length;
  const estimatedTokens = Math.round(charCount / 3.8);

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(editedPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTestApi = async () => {
    setIsLoading(true);
    setApiError(null);
    setApiResponse(null);
    const startTime = Date.now();

    try {
      // Execute API call with dynamic 'main' model and full metadata tracking
      const result = await callGeminiAPI(
        editedPrompt,
        undefined,
        'main',
        (m) => setModelUsed(m),
        systemInstruction,
        useGoogleSearch,
        undefined,
        undefined,
        undefined,
        "Kiểm tra 429 : Bước #5 : PlayerInputArea.tsx",
        undefined,
        !isOocAction,
        "</tuong_than>\n<thinking>\n"
      );

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      setExecutionTimeSec(Number(elapsed));
      setApiResponse(result.text);
      setModelUsed(result.modelUsed || 'main');
    } catch (err: any) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      setExecutionTimeSec(Number(elapsed));
      const errorMessage = err?.message || String(err);
      setApiError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-stone-900 border border-amber-600/40 rounded-xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-stone-950 border-b border-amber-900/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-amber-200">
                KIỂM TRA PROMPT & 429 (LƯỢT BƯỚC #5)
              </h3>
              <p className="text-xs text-stone-400">
                Toàn bộ payload được chuẩn bị theo quy trình chuẩn của lượt kể chuyện thường.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-200 hover:bg-stone-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1 text-sm">
          {/* Metadata badges */}
          <div className="flex flex-wrap gap-2 items-center bg-stone-950/60 p-3 rounded-lg border border-stone-800 text-xs">
            <div className="bg-amber-950/60 border border-amber-700/40 text-amber-300 px-2.5 py-1 rounded font-medium">
              Ô nhập: Lượt bước #5
            </div>
            <div className="bg-stone-800 border border-stone-700 text-stone-300 px-2.5 py-1 rounded">
              Chế độ: <span className="text-amber-300 font-semibold">{inputType === 'story' ? 'Câu chuyện' : 'Hành động'}</span>
            </div>
            <div className="bg-stone-800 border border-stone-700 text-stone-300 px-2.5 py-1 rounded">
              Độ dài: <span className="text-amber-300 font-semibold">{responseLength}</span>
            </div>
            <div className="bg-stone-800 border border-stone-700 text-stone-300 px-2.5 py-1 rounded">
              Dung lượng: <span className="text-emerald-400 font-semibold">{charCount.toLocaleString()}</span> ký tự (~{estimatedTokens.toLocaleString()} tokens)
            </div>
            <div className="bg-blue-950/50 border border-blue-800/40 text-blue-300 px-2.5 py-1 rounded flex items-center gap-1">
              <Cpu className="w-3.5 h-3.5" />
              Nguồn Model: <span className="font-semibold text-blue-200">main (Động)</span>
            </div>
          </div>

          {/* Action text preview */}
          <div className="bg-stone-950/40 border border-stone-800 rounded-lg p-3">
            <span className="text-xs font-semibold text-stone-400 block mb-1">Nội dung hành động (Bước #5):</span>
            <div className="text-amber-200/90 italic text-xs bg-stone-900/80 p-2 rounded border border-stone-800/60 max-h-20 overflow-y-auto">
              "{actionText}"
            </div>
          </div>

          {/* Prompt Editor */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                Nội Dung Prompt Sẽ Gửi Lên AI (Có Thể Chỉnh Sửa Trực Tiếp):
              </label>
              <button
                onClick={handleCopyPrompt}
                className="flex items-center gap-1 text-xs text-stone-400 hover:text-amber-300 bg-stone-800/80 hover:bg-stone-800 px-2.5 py-1 rounded transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Đã sao chép' : 'Sao chép Prompt'}
              </button>
            </div>
            <textarea
              value={editedPrompt}
              onChange={(e) => setEditedPrompt(e.target.value)}
              rows={12}
              className="w-full bg-stone-950 border border-amber-900/40 rounded-lg p-3 font-mono text-xs text-stone-200 focus:outline-none focus:border-amber-500 transition-colors leading-relaxed selection:bg-amber-700 selection:text-white resize-y"
              placeholder="Nội dung prompt..."
            />
          </div>

          {/* System Instruction toggle */}
          <div className="border border-stone-800 rounded-lg overflow-hidden">
            <button
              onClick={() => setShowSystemInstruction(!showSystemInstruction)}
              className="w-full px-4 py-2.5 bg-stone-950 hover:bg-stone-900 text-left flex items-center justify-between text-xs font-semibold text-stone-400 hover:text-stone-200 transition-colors"
            >
              <span>Xem System Instruction ({systemInstruction.length.toLocaleString()} ký tự)</span>
              {showSystemInstruction ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
            {showSystemInstruction && (
              <div className="p-3 bg-stone-950/80 border-t border-stone-800 max-h-48 overflow-y-auto">
                <pre className="text-[11px] font-mono text-stone-400 whitespace-pre-wrap leading-normal">
                  {systemInstruction}
                </pre>
              </div>
            )}
          </div>

          {/* API Test Result Feedback */}
          {apiError && (
            <div className="bg-red-950/50 border border-red-800/60 rounded-lg p-4 space-y-2 animate-fade-in">
              <div className="flex items-center gap-2 text-red-400 font-bold text-sm">
                <ShieldAlert className="w-5 h-5 text-red-500" />
                <span>
                  {apiError.includes('429') ? '⚠️ PHÁT HIỆN LỖI 429 (TOO MANY REQUESTS / QUOTA EXCEEDED)' : 'LỖI KHI GỌI API'}
                </span>
                <span className="text-xs text-stone-400 font-normal ml-auto">({executionTimeSec}s)</span>
              </div>
              <div className="text-xs text-red-200/90 font-mono bg-red-950/80 p-2.5 rounded border border-red-900/50 overflow-x-auto whitespace-pre-wrap">
                {apiError}
              </div>
            </div>
          )}

          {apiResponse && (
            <div className="bg-emerald-950/40 border border-emerald-800/60 rounded-lg p-4 space-y-2 animate-fade-in">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                <CheckCircle className="w-5 h-5 text-emerald-400" />
                <span>GỌI API THÀNH CÔNG (KHÔNG BỊ 429)</span>
                <span className="text-xs text-emerald-300/80 font-normal ml-auto">
                  {modelUsed ? `Model: ${modelUsed} • ` : ''}{executionTimeSec}s
                </span>
              </div>
              <div className="text-xs text-stone-300 font-serif bg-stone-950/80 p-3 rounded border border-emerald-900/40 max-h-56 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                {apiResponse}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-stone-950 border-t border-stone-800 flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold transition-colors"
          >
            Đóng
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={handleTestApi}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 font-bold text-xs border border-stone-700 transition-all disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-stone-300 border-t-transparent rounded-full animate-spin" />
                  <span>Đang test...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Test API (Lấy kết quả tĩnh)</span>
                </>
              )}
            </button>

            {onApplyToGame && (
              <button
                onClick={() => onApplyToGame(editedPrompt)}
                disabled={isLoading}
                className="flex items-center gap-2 px-5 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:bg-amber-800/50 text-stone-950 font-extrabold text-xs shadow-lg shadow-amber-900/20 transition-all disabled:cursor-not-allowed animate-pulse hover:animate-none"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>🚀 Gửi như lượt bình thường (Có Stream)</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
