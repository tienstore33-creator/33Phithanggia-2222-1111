
import React, { useMemo } from 'react';
import { CustomSelect } from '../ui/CustomSelect';

import { MajorRealm } from '../../types';

interface RealmSelectorProps {
  value: string;
  onChange: (newValue: string) => void;
  majorOptions: MajorRealm[];
  minorOptions: string[];
  isReady: boolean;
  label?: string;
  id?: string;
}

export const RealmSelector: React.FC<RealmSelectorProps> = ({
  value, onChange, majorOptions, minorOptions, isReady, label, id
}) => {
  const majorNames = useMemo(() => majorOptions.map(m => m.name), [majorOptions]);

  // Logic tách Đại/Tiểu cảnh giới từ chuỗi tổng hợp
  const { selectedMajor, selectedMinor } = useMemo(() => {
    if (!value || !isReady || majorNames.length === 0) return { selectedMajor: '', selectedMinor: '' };
    
    // Tìm Đại cảnh giới khớp ở đầu chuỗi (cần sort để tìm cái dài nhất trước, ví dụ: 'Luyện Khí Cảnh' thay vì 'Luyện Khí')
    const sortedMajors = [...majorNames].sort((a, b) => b.length - a.length);
    const foundMajor = sortedMajors.find(m => value.startsWith(m));

    if (foundMajor) {
      let remainder = value.slice(foundMajor.length).trim();
      // Loại bỏ dấu ngoặc nếu có
      remainder = remainder.replace(/^\(|\)$/g, '').trim();
      return { selectedMajor: foundMajor, selectedMinor: remainder };
    }
    
    return { selectedMajor: '', selectedMinor: '' };
  }, [value, majorNames, isReady]);

  const handleMajorChange = (major: string) => {
    if (!major) {
      onChange('');
      return;
    }
    const newValue = selectedMinor ? `${major} ${selectedMinor}` : major;
    onChange(newValue);
  };

  const handleMinorChange = (minor: string) => {
    if (!selectedMajor) {
      // Nếu chưa chọn đại cảnh giới mà chọn tiểu cảnh giới, mặc định lấy đại cảnh giới đầu tiên
      const defaultMajor = majorNames[0] || '';
      if (defaultMajor) {
        onChange(`${defaultMajor} ${minor}`);
      }
      return;
    }
    const newValue = minor ? `${selectedMajor} ${minor}` : selectedMajor;
    onChange(newValue);
  };

  if (!isReady) {
    return (
      <div className="space-y-1">
        {label && <label htmlFor={id} className="block text-xs font-medium text-gray-400">{label}</label>}
        <input 
          id={id}
          type="text" 
          value={value} 
          onChange={(e) => onChange(e.target.value)}
          className="w-full p-2 bg-gray-800 border border-gray-700 rounded text-sm text-gray-100 focus:border-indigo-500 focus:outline-none"
          placeholder="Thiết lập hệ thống tu luyện để dùng dropdown..."
        />
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {label && <label className="block text-xs font-medium text-gray-400">{label}</label>}
      <div className="flex gap-2">
        <CustomSelect
          value={selectedMajor}
          onChange={handleMajorChange}
          options={majorNames}
          placeholder="-- Đại Cảnh Giới --"
          className="flex-1"
        />
        
        <CustomSelect
          value={selectedMinor}
          onChange={handleMinorChange}
          options={minorOptions}
          placeholder="-- Tiểu Cảnh Giới --"
          className="flex-1"
        />
      </div>
    </div>
  );
};
