
import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

interface CustomSelectProps {
  label?: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
  label,
  value,
  options,
  onChange,
  placeholder = "Chọn...",
  className = ""
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {label && <label className="block text-xs font-medium text-gray-400 mb-1">{label}</label>}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-2 bg-gray-800 border border-gray-700 rounded text-sm text-gray-100 focus:border-indigo-500 focus:outline-none transition-colors"
      >
        <span className={value ? "text-gray-100" : "text-gray-500"}>
          {value || placeholder}
        </span>
        <ChevronDown size={16} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-gray-800 border border-gray-700 rounded shadow-xl max-h-60 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600">
          <div className="py-1">
            {options.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-500 italic">Không có lựa chọn</div>
            ) : (
              options.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    onChange(option);
                    setIsOpen(false);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 text-sm text-left hover:bg-indigo-600/20 transition-colors group"
                >
                  <span className={value === option ? "text-indigo-400 font-medium" : "text-gray-300"}>
                    {option}
                  </span>
                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${
                    value === option ? 'border-indigo-500 bg-indigo-500' : 'border-gray-600'
                  }`}>
                    {value === option && <Check size={10} className="text-white" />}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
