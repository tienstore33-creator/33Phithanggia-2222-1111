
import React from 'react';
import { Item as ItemType } from '../../../types';
import { VIETNAMESE } from '../../../constants';
import * as GameTemplates from '../../../templates';

interface EquipmentInventoryListProps {
  inventory: ItemType[]; // Expects a pre-filtered list of available equipment items
  onDragStartItem: (event: React.DragEvent<HTMLDivElement>, item: ItemType) => void;
  onItemClick?: (item: ItemType) => void;
}

const EquipmentInventoryList: React.FC<EquipmentInventoryListProps> = ({ inventory, onDragStartItem, onItemClick }) => {
  // Filter to ensure only equipment is shown, as a safeguard.
  const equipmentItems = inventory.filter(item => item.category === GameTemplates.ItemCategory.EQUIPMENT);

  if (equipmentItems.length === 0) {
    return <p className="text-sm text-gray-400 italic text-center py-4">{VIETNAMESE.inventory} trống (không có trang bị để mặc).</p>;
  }

  return (
    <div className="h-full overflow-y-auto custom-scrollbar bg-gray-800 p-2 rounded-lg border border-gray-700">
      <h3 className="text-lg font-semibold text-indigo-300 mb-3 sticky top-0 bg-gray-800 py-2 px-1 z-10 border-b border-gray-700">
        {VIETNAMESE.equipmentInventorySection}
      </h3>
      <div className="space-y-2">
        {equipmentItems.map(item => (
          <div
            key={item.id}
            draggable
            onDragStart={(e) => onDragStartItem(e, item)}
            onClick={() => onItemClick && onItemClick(item)}
            className="p-2.5 bg-gray-700 hover:bg-gray-600 rounded-md shadow-sm cursor-grab active:cursor-grabbing transition-colors border border-gray-600 group relative"
            title={`${item.name} (${(() => {
              const s = (item as GameTemplates.EquipmentTemplate).slot;
              const key = s ? `slot${s.charAt(0).toUpperCase()}${s.slice(1)}` : '';
              return VIETNAMESE[key as keyof typeof VIETNAMESE] || s || 'N/A';
            })()} - ${item.rarity})`}
          >
            <p className="text-sm font-medium text-indigo-200 truncate">
              {item.name}
              {(item as GameTemplates.EquipmentTemplate).rank && (
                <span className="ml-2 text-xs text-amber-400">
                  [{VIETNAMESE.rankLabel} {(item as GameTemplates.EquipmentTemplate).rank}]
                </span>
              )}
              {(item as GameTemplates.EquipmentTemplate).upgradeLevel && (item as GameTemplates.EquipmentTemplate).upgradeLevel! > 0 && (
                <span className="ml-1 text-xs text-green-400">
                  +{ (item as GameTemplates.EquipmentTemplate).upgradeLevel }
                </span>
              )}
              {item.quantity > 1 && <span className="ml-1 text-gray-400 font-normal">(x{item.quantity})</span>}
            </p>
            <p className="text-xs text-gray-400 truncate">
              {(() => {
                const s = (item as GameTemplates.EquipmentTemplate).slot;
                const key = s ? `slot${s.charAt(0).toUpperCase()}${s.slice(1)}` : '';
                return VIETNAMESE[key as keyof typeof VIETNAMESE] || s || 'N/A';
              })()} - {item.rarity}
            </p>
            {/* Optionally display key stat bonuses or effects here */}
          </div>
        ))}
      </div>
    </div>
  );
};

export default EquipmentInventoryList;
