
import React from 'react';
import { safeNumber, formatNumberDot } from '../../utils/combatDataSanitizer';

interface StatDisplayProps {
  label: string;
  value: React.ReactNode;
  className?: string;
}

const StatDisplay: React.FC<StatDisplayProps> = ({label, value, className=""}) => {
  const displayValue = typeof value === 'number' ? formatNumberDot(safeNumber(value)) : value;
  
  return (
    <div className={`text-sm py-1 ${className}`}>
      <span className="font-semibold text-indigo-300">{label}: </span>
      <span className="text-gray-100">{displayValue}</span>
    </div>
  );
};

export default StatDisplay;