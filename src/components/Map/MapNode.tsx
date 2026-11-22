import React from 'react';
import { LocationCategory } from '../../types/game';
import { Landmark, Tent, TreePine, Circle, Skull, ShieldCheck } from 'lucide-react'; // Ví dụ icon

const getIconForCategory = (category: string) => {
  // Chuẩn hóa string trước khi so sánh
  const normalizedCategory = category?.trim(); 

  switch(normalizedCategory) {
    case LocationCategory.SECT: return <Landmark size={18} />;
    case LocationCategory.CAVE: return <Tent size={18} />;
    case LocationCategory.FOREST: return <TreePine size={18} />;
    // ... thêm các case khác
    default: return <Circle size={18} />;
  }
};

interface MapNodeProps {
  location: any;
  isCurrent: boolean;
}

export const MapNode: React.FC<MapNodeProps> = ({ location, isCurrent }) => {
  // Xác định màu sắc dựa trên isSafe
  const statusColorClass = location.isSafe ? 'text-emerald-400' : 'text-rose-500';
  const glowClass = isCurrent ? 'drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]' : '';

  return (
    <div 
      className={`absolute transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center cursor-pointer ${statusColorClass} ${glowClass}`}
      style={{ left: location.coordinates.x, top: location.coordinates.y }}
    >
      {/* Icon địa điểm */}
      <div className="bg-slate-900 rounded-full p-1 border border-slate-700">
         {getIconForCategory(location.category)}
      </div>
      
      {/* Tên địa điểm */}
      <span className="mt-1 text-xs font-bold bg-slate-900/80 px-1 rounded whitespace-nowrap">
        {location.name}
      </span>

      {/* Indicator an toàn nhỏ (Tùy chọn) */}
      {isCurrent && (
        <div className="absolute -top-2 -right-2">
          {location.isSafe ? <ShieldCheck size={12} className="text-emerald-400"/> : <Skull size={12} className="text-rose-500"/>}
        </div>
      )}
    </div>
  );
};
