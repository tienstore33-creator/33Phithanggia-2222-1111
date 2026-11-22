import React from 'react';
import { motion } from 'motion/react';

export interface GuideBubbleProps {
  text: string;
  position: 'top' | 'bottom';
  children?: React.ReactNode;
}

export interface GuideMarkerProps extends GuideBubbleProps {
  id: string;
  index: number;
  activeId: string | null;
  onToggle: (id: string | null) => void;
}

export const GuideBubble: React.FC<GuideBubbleProps> = ({ text, position, children }) => {
  // Khoảng cách lùi lớn hơn (mb-10 và mt-10) để không bị đè lên nút số
  const positionClass = position === 'top' ? 'bottom-full mb-10' : 'top-full mt-10';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={`absolute left-1/2 -translate-x-1/2 z-[60] w-64 p-3 bg-[#f4e4c1] text-[#2d2820] text-xs font-medium rounded-lg shadow-[0_12px_28px_rgba(0,0,0,0.65)] border-2 border-[#a68c68] text-center whitespace-normal leading-relaxed pointer-events-auto ${positionClass}`}
    >
      {/* Kim chỉ dẫn kéo dài tinh tế phong cách cổ phong */}
      <div className="absolute left-1/2 -translate-x-1/2 pointer-events-none">
        {position === 'top' && (
          <div className="absolute top-full left-1/2 -translate-x-1/2 flex flex-col items-center">
            {/* Đường chỉ mảnh dài 28px nối từ hộp thoại xuống */}
            <div className="w-[1.5px] h-[28px] bg-[#a68c68]" />
            {/* Mũi kim nhọn chạm sát vào nút số */}
            <div className="w-0 h-0 border-x-[4px] border-x-transparent border-t-[6px] border-t-[#a68c68]" />
          </div>
        )}

        {position === 'bottom' && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 flex flex-col-reverse items-center">
            {/* Đường chỉ mảnh dài 28px nối từ hộp thoại lên */}
            <div className="w-[1.5px] h-[28px] bg-[#a68c68]" />
            {/* Mũi kim nhọn chạm sát vào nút số */}
            <div className="w-0 h-0 border-x-[4px] border-x-transparent border-b-[6px] border-b-[#a68c68]" />
          </div>
        )}
      </div>

      <div>{text}</div>
      {children && <div className="mt-2">{children}</div>}
    </motion.div>
  );
};

export const GuideMarker: React.FC<GuideMarkerProps> = ({ id, index, text, position, children, activeId, onToggle }) => {
  const isActive = activeId === id;

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div className="relative w-full h-full">
        {/* Nút số nhấp nháy */}
        <motion.button
          onClick={(e) => {
            e.stopPropagation();
            onToggle(isActive ? null : id);
          }}
          className={`absolute left-1/2 -translate-x-1/2 z-[55] w-6 h-6 rounded-full border-2 flex items-center justify-center text-[10px] font-bold transition-all pointer-events-auto
            ${isActive 
              ? 'bg-[#a68c68] text-[#f4e4c1] border-[#f4e4c1] scale-110 shadow-[0_0_15px_#a68c68]' 
              : 'bg-[#2d2820] text-[#a68c68] border-[#a68c68] hover:bg-[#a68c68] hover:text-[#f4e4c1]'}`}
          animate={!isActive ? {
            scale: [1, 1.15, 1],
            boxShadow: ["0 0 0px #a68c68", "0 0 10px #a68c68", "0 0 0px #a68c68"]
          } : {}}
          transition={{ repeat: Infinity, duration: 2 }}
          style={{ 
            top: position === 'top' ? '-12px' : 'auto', 
            bottom: position === 'bottom' ? '-12px' : 'auto' 
          }}
        >
          {index}
        </motion.button>

        {/* Nội dung bóng thoại (Chỉ hiện khi isActive) */}
        {isActive && (
          <GuideBubble text={text} position={position}>
            {children}
          </GuideBubble>
        )}
      </div>
    </div>
  );
};

export interface GuideOverlayProps {
  isActive: boolean;
  onClose: () => void;
  message?: string;
}

export const GuideOverlay: React.FC<GuideOverlayProps> = ({ isActive, onClose, message = "Chế độ hướng dẫn đang bật" }) => {
  if (!isActive) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/40 z-50 transition-opacity pointer-events-none flex items-center justify-center"
    >
      <div className="absolute top-20 text-white/60 text-xs italic animate-pulse font-serif bg-black/40 px-4 py-2 rounded-full border border-white/10">{message}</div>
    </div>
  );
};

export interface GuideToggleButtonProps {
  isActive: boolean;
  onClick: () => void;
  className?: string;
}

export const GuideToggleButton: React.FC<GuideToggleButtonProps> = ({ isActive, onClick, className = "" }) => {
  return (
    <motion.button
      onClick={onClick}
      className={`fixed top-4 right-4 w-10 h-10 rounded-full border-2 flex items-center justify-center font-bold text-lg transition-all z-[70] font-serif ${className}
        ${isActive 
          ? 'bg-[#a68c68] text-[#2d2820] border-[#f4e4c1] shadow-[0_0_15px_#a68c68]' 
          : 'bg-[#3e3527]/90 text-[#dcc9a6] border-[#a68c68]/60 hover:border-[#a68c68] hover:bg-[#5c4a31]'}`}
      animate={!isActive ? {
        boxShadow: [
          "0 0 0px rgba(166, 140, 104, 0)", 
          "0 0 12px rgba(166, 140, 104, 0.6)", 
          "0 0 0px rgba(166, 140, 104, 0)"
        ],
        borderColor: [
          "rgba(166, 140, 104, 0.4)", 
          "rgba(244, 228, 193, 0.8)", 
          "rgba(166, 140, 104, 0.4)"
        ]
      } : {}}
      transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
      title="Bật/Tắt hướng dẫn trực quan"
    >
      ?
    </motion.button>
  );
};
