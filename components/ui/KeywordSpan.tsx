
import React from 'react';
// Corrected to import the broader types
import { GameEntity, GameEntityType } from '../../hooks/useGameplayModals';

interface KeywordSpanProps {
  keyword: string;
  entityType: GameEntityType; // Use the broader type
  entity: GameEntity; // Use the broader type
  onClick: (
    event: React.MouseEvent<HTMLSpanElement>, 
    entity: GameEntity,
    entityType: GameEntityType
  ) => void;
  style?: React.CSSProperties;
}

const KeywordSpan: React.FC<KeywordSpanProps> = ({ keyword, entityType, entity, onClick, style }) => {
  const handleClick = (event: React.MouseEvent<HTMLSpanElement>) => {
    onClick(event, entity, entityType);
  };

  // Custom colors mapping for specific game entities to override defaults
  const customColors: Record<string, { color: string; classes: string }> = {
    npc: { color: '#60a5fa', classes: 'text-blue-400 hover:text-blue-300 decoration-blue-400/50' },
    wife: { color: '#60a5fa', classes: 'text-blue-400 hover:text-blue-300 decoration-blue-400/50' },
    slave: { color: '#fca5a5', classes: 'text-red-300 hover:text-red-200 decoration-red-300/50' },
    prisoner: { color: '#fca5a5', classes: 'text-red-300 hover:text-red-200 decoration-red-300/50' },
    master: { color: '#c084fc', classes: 'text-purple-400 hover:text-purple-300 decoration-purple-400/50' },
    yeuThu: { color: '#f87171', classes: 'text-red-400 hover:text-red-300 decoration-red-400/50' },
    companion: { color: '#4ade80', classes: 'text-green-400 hover:text-green-300 decoration-green-400/50' },
    location: { color: '#38bdf8', classes: 'text-sky-400 hover:text-sky-300 decoration-sky-400/50' },
    faction: { color: '#facc15', classes: 'text-yellow-400 hover:text-yellow-300 decoration-yellow-400/50' },
    lore: { color: '#d29a5d', classes: 'text-[#d29a5d] hover:text-[#e4b584] decoration-[#d29a5d]/50' }
  };

  let matched = customColors[entityType];
  if (entityType === 'player') {
    const isRestricted = !!(entity as any)?.playerSpecialStatus;
    if (isRestricted) {
      // Màu đỏ đen nhấp nháy (khi bị biến thành tù nhân/nô lệ) - Chỉ hiệu ứng chữ lấp lánh, không khung nền
      matched = {
        color: '#ef4444',
        classes: 'text-red-500 hover:text-red-400 decoration-red-600 font-extrabold animate-pulse drop-shadow-[0_0_6px_rgba(220,38,38,0.9)]'
      };
    } else {
      // Màu xanh lá lấp lánh (khi tự do) - Chỉ hiệu ứng chữ lấp lánh, không khung nền
      matched = {
        color: '#4ade80',
        classes: 'text-green-400 hover:text-green-300 decoration-green-400 font-extrabold animate-pulse drop-shadow-[0_0_8px_rgba(74,222,128,0.9)]'
      };
    }
  } else if (entityType === 'wife') {
    // Màu vàng kim lấp lánh (khi là vợ/đạo lữ) - Chỉ hiệu ứng chữ lấp lánh, không khung nền
    matched = {
      color: '#fbbf24',
      classes: 'text-amber-300 hover:text-yellow-200 decoration-amber-400 font-extrabold animate-pulse drop-shadow-[0_0_8px_rgba(251,191,36,0.9)]'
    };
  }

  const finalStyle = matched 
    ? { ...style, color: matched.color } 
    : style;

  const colorClasses = matched 
    ? matched.classes 
    : 'text-yellow-400 hover:text-yellow-300 decoration-yellow-400/50';

  return (
    <span
      className={`underline font-semibold cursor-pointer transition-colors duration-150 underline-offset-2 ${colorClasses}`}
      style={finalStyle} // Apply overridden color & configuration styles
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleClick(e as any)}
      aria-label={`Details for ${keyword}`}
    >
      {keyword}
    </span>
  );
};

export default KeywordSpan;
