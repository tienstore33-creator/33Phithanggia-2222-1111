import React, { useState, ChangeEvent } from 'react';
import { Item as ItemType } from '../../../../types';
import Button from '../../../ui/Button';
import { VIETNAMESE } from '../../../../constants';

interface ItemEntryProps {
  item: ItemType;
  price: number;
  currencyName: string;
  actionLabel: string;
  onAction: (item: ItemType, price: number, quantity: number) => void;
  onItemClick: (item: ItemType) => void; // For showing details
  disabled?: boolean;
  maxQuantity?: number; // Max quantity available for transaction
  playerCurrency: number;
  isBuyMode: boolean;
}

const ItemEntry: React.FC<ItemEntryProps> = ({ item, price, currencyName, actionLabel, onAction, onItemClick, disabled = false, maxQuantity, playerCurrency, isBuyMode }) => {
  const [quantity, setQuantity] = useState(1);
  const totalPrice = price * quantity;

  const handleQuantityChange = (e: ChangeEvent<HTMLInputElement>) => {
    let value = parseInt(e.target.value, 10);
    if (isNaN(value) || value < 1) {
      value = 1;
    }
    if (maxQuantity && value > maxQuantity) {
      value = maxQuantity;
    }
    setQuantity(value);
  };

  const isActionDisabled = disabled || (isBuyMode && playerCurrency < totalPrice);

  return (
    <div className="flex items-center justify-between p-2 bg-gray-700/50 rounded-lg hover:bg-gray-700/80 transition-colors duration-150 flex-wrap sm:flex-nowrap gap-2">
      <div 
        className="flex-grow cursor-pointer w-full sm:w-auto"
        onClick={() => onItemClick(item)}
        title={`Xem chi tiết ${item.name}`}
      >
        <p className="font-semibold text-indigo-300">{item.name}</p>
        <p className="text-xs text-gray-400">{item.rarity} - Giá gốc: {price.toLocaleString()}</p>
      </div>
      <div className="flex items-center space-x-2 flex-shrink-0 w-full sm:w-auto justify-end">
        <input
          type="number"
          value={quantity}
          onChange={handleQuantityChange}
          min="1"
          max={maxQuantity}
          className="w-16 p-1 text-sm text-center bg-gray-800 border border-gray-600 rounded-md focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
          disabled={disabled}
          aria-label="Số lượng"
        />
        <p className="text-sm font-semibold text-amber-400 w-28 text-right tabular-nums" title={`Tổng giá: ${totalPrice.toLocaleString()}`}>
          {totalPrice.toLocaleString()} {currencyName}
        </p>
        <Button 
            size="sm" 
            variant="primary" 
            onClick={() => onAction(item, price, quantity)} 
            className="text-xs"
            disabled={isActionDisabled}
            title={isActionDisabled && isBuyMode ? VIETNAMESE.notEnoughMoney : ''}
        >
          {actionLabel}
        </Button>
      </div>
    </div>
  );
};

export default ItemEntry;
