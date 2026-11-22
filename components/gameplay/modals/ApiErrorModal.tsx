import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  AlertTriangle, 
  WifiOff, 
  Clock, 
  RefreshCw, 
  Settings, 
  X, 
  KeyRound, 
  ServerCrash 
} from 'lucide-react';
import { UIState } from '../../../types';

interface ApiErrorModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiErrorDetails: UIState['apiErrorDetails'];
  retryCallback: UIState['retryCallback'];
  onOpenSettings: () => void;
}

export const ApiErrorModal: React.FC<ApiErrorModalProps> = ({
  isOpen,
  onClose,
  apiErrorDetails,
  retryCallback,
  onOpenSettings
}) => {
  const [isRetrying, setIsRetrying] = useState(false);

  if (!isOpen || !apiErrorDetails) return null;

  const { type, title, reason, suggestion, message } = apiErrorDetails;

  const handleRetry = async () => {
    if (!retryCallback) return;
    setIsRetrying(true);
    try {
      onClose(); // Close modal first
      await retryCallback();
    } catch (err) {
      console.error("Retry failed:", err);
    } finally {
      setIsRetrying(false);
    }
  };

  // Select icon and color scheme based on error type
  const getErrorTypeStyling = () => {
    switch (type) {
      case '404':
        return {
          icon: <KeyRound className="w-12 h-12 text-rose-500" />,
          borderColor: 'border-rose-500/30',
          badgeBg: 'bg-rose-500/10 text-rose-400',
          badgeText: 'Lỗi API Key / Model 404',
          btnBg: 'bg-gradient-to-r from-rose-600 to-red-650 hover:from-rose-500 hover:to-red-600 focus:ring-rose-500'
        };
      case '429':
        return {
          icon: <Clock className="w-12 h-12 text-amber-500 animate-pulse" />,
          borderColor: 'border-amber-500/30',
          badgeBg: 'bg-amber-500/10 text-amber-400',
          badgeText: 'Quá Tải Hạn Mức 429',
          btnBg: 'bg-gradient-to-r from-amber-600 to-orange-650 hover:from-amber-500 hover:to-orange-600 focus:ring-amber-500'
        };
      case 'network':
        return {
          icon: <WifiOff className="w-12 h-12 text-sky-500" />,
          borderColor: 'border-sky-500/30',
          badgeBg: 'bg-sky-500/10 text-sky-400',
          badgeText: 'Lỗi Kết Nối Mạng / Timeout',
          btnBg: 'bg-gradient-to-r from-sky-600 to-blue-650 hover:from-sky-500 hover:to-blue-600 focus:ring-sky-500'
        };
      default:
        return {
          icon: <ServerCrash className="w-12 h-12 text-gray-400" />,
          borderColor: 'border-gray-500/30',
          badgeBg: 'bg-gray-500/10 text-gray-400',
          badgeText: 'Sự Cố Hệ Thống',
          btnBg: 'bg-gray-700 hover:bg-gray-600 focus:ring-gray-500'
        };
    }
  };

  const style = getErrorTypeStyling();

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
        {/* Backdrop overlay trigger click close */}
        <div className="absolute inset-0" onClick={onClose} />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ type: 'spring', duration: 0.4 }}
          className={`relative w-full max-w-lg overflow-hidden bg-gray-900 border ${style.borderColor} rounded-2xl shadow-2xl z-10 flex flex-col`}
          id="visualApiErrorModal"
        >
          {/* Top colored accent line */}
          <div className={`h-1.5 w-full bg-current ${
            type === '404' ? 'text-rose-500' : type === '429' ? 'text-amber-500' : type === 'network' ? 'text-sky-500' : 'text-gray-500'
          }`} />

          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-700"
            aria-label="Đóng"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Body Content */}
          <div className="p-6 md:p-8 flex flex-col items-center text-center">
            {/* Visual Icon Halo */}
            <div className="mb-4 p-4 rounded-full bg-gray-800/80 border border-gray-700 shadow-inner flex items-center justify-center">
              {style.icon}
            </div>

            {/* Error Type Badge */}
            <span className={`px-3 py-1 rounded-full text-xs font-semibold tracking-wider uppercase mb-3 ${style.badgeBg}`}>
              {style.badgeText}
            </span>

            {/* Core Title */}
            <h2 className="text-xl md:text-2xl font-bold text-gray-100 tracking-tight mb-3">
              {title}
            </h2>

            {/* Explanatory Sections */}
            <div className="w-full space-y-4 text-left border-t border-b border-gray-800 py-5 my-2">
              <div>
                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                  Nguyên nhân khả dĩ
                </h4>
                <p className="text-sm text-gray-300 leading-relaxed">
                  {reason}
                </p>
              </div>

              <div>
                <h4 className="text-xs font-semibold text-amber-400/90 uppercase tracking-wider mb-1">
                  Cách giải quyết đề xuất
                </h4>
                <p className="text-sm text-gray-300 leading-relaxed">
                  {suggestion}
                </p>
              </div>

              {message && (
                <div className="p-2.5 bg-black/40 rounded-lg border border-gray-800/80">
                  <h4 className="text-[10px] font-mono font-semibold text-gray-500 uppercase tracking-wider mb-0.5">
                    Mã lỗi chi tiết từ máy chủ API
                  </h4>
                  <p className="text-[11px] font-mono text-gray-400 break-all select-all leading-normal max-h-20 overflow-y-auto">
                    {message}
                  </p>
                </div>
              )}
            </div>

            {/* Action Buttons Section */}
            <div className="flex flex-col sm:flex-row w-full gap-3 mt-4">
              {retryCallback && (
                <button
                  type="button"
                  onClick={handleRetry}
                  disabled={isRetrying}
                  className={`flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-semibold text-white shadow-lg transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none ${style.btnBg}`}
                >
                  <RefreshCw className={`w-4 h-4 ${isRetrying ? 'animate-spin' : ''}`} />
                  <span>{isRetrying ? 'Đang thử lại...' : 'Thử lại ngay'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenSettings();
                }}
                className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-200 hover:text-white font-semibold border border-gray-700 transition-colors active:scale-[0.98]"
              >
                <Settings className="w-4 h-4" />
                <span>Cấu hình API Key</span>
              </button>
            </div>

            {/* Cancel closing text button */}
            <button
              onClick={onClose}
              className="mt-4 text-xs text-gray-500 hover:text-gray-400 underline transition-colors focus:outline-none"
            >
              Hủy, quay lại trò chơi
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
