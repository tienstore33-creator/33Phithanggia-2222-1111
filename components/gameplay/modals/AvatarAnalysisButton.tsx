import React, { useState } from 'react';
import { analyzeAvatarAppearance } from '../../../services/ai/avatarAnalysisService';

interface AvatarAnalysisButtonProps {
  avatarUrl?: string;
  characterName: string;
  gender?: string;
  onSuccess: (appearanceDesc: string) => void;
  onError?: (errorMsg: string) => void;
  className?: string;
}

export const AvatarAnalysisButton: React.FC<AvatarAnalysisButtonProps> = ({
  avatarUrl,
  characterName,
  gender,
  onSuccess,
  onError,
  className = ""
}) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Chỉ hiển thị nút khi đã có ảnh đại diện được tải lên
  if (!avatarUrl || avatarUrl.trim() === '') {
    return null;
  }

  const handleAnalyze = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setErrorMsg(null);
    setIsAnalyzing(true);

    try {
      const description = await analyzeAvatarAppearance(
        avatarUrl,
        characterName,
        gender || 'Không rõ'
      );
      if (description) {
        onSuccess(description);
      }
    } catch (err: any) {
      const msg = err?.message || "Lỗi khi phân tích diện mạo từ ảnh.";
      setErrorMsg(msg);
      onError?.(msg);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className={`flex flex-col items-center w-full ${className}`}>
      <button
        type="button"
        onClick={handleAnalyze}
        disabled={isAnalyzing}
        className={`w-full max-w-xs flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-xs font-semibold shadow-md transition-all active:scale-95 border ${
          isAnalyzing
            ? 'bg-slate-700/80 text-slate-300 border-slate-600 cursor-wait'
            : 'bg-gradient-to-r from-teal-700 to-indigo-700 hover:from-teal-600 hover:to-indigo-600 text-white border-teal-400/40 hover:border-teal-300'
        }`}
        title="Dùng AI phân tích chi tiết diện mạo, trang phục, chất liệu và đường cong thân hình từ ảnh đại diện"
      >
        {isAnalyzing ? (
          <>
            <span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full" />
            <span>Đang phân tích diện mạo từ ảnh...</span>
          </>
        ) : (
          <>
            <span className="text-sm">🔍</span>
            <span>Phân Tích Diện Mạo Từ Ảnh</span>
          </>
        )}
      </button>

      {errorMsg && (
        <p className="text-xs text-rose-400 mt-1 text-center font-medium">
          {errorMsg}
        </p>
      )}
    </div>
  );
};

export default AvatarAnalysisButton;
