
import React, { useState, useEffect } from 'react';
import { EconomicZoneStub, GameLocation } from '../../../types';
import Button from '../../ui/Button';
import EconomicZoneModal from './EconomicZoneModal';
import Modal from '../../ui/Modal';

interface EconomicZoneBarProps {
  zones: EconomicZoneStub[];
  subLocations: GameLocation[];
  onEnterZone: (zone: EconomicZoneStub) => void;
  onEnterSubLocation: (loc: GameLocation) => void;
  onInitialize: () => void;
  isLoading: boolean;
  disabled: boolean;
  isModalOpen: boolean;
  setIsModalOpen: (open: boolean) => void;
  isMainLocation?: boolean;
}

const EconomicZoneBar: React.FC<EconomicZoneBarProps> = ({ 
  zones = [], 
  subLocations = [], 
  onEnterZone, 
  onEnterSubLocation,
  onInitialize,
  isLoading, 
  disabled,
  isModalOpen,
  setIsModalOpen,
  isMainLocation = true
}) => {
  const hasContent = (zones && zones.length > 0) || (subLocations && subLocations.length > 0);

  if (!hasContent && !isMainLocation) {
    return null;
  }

  const renderContent = () => {
    if (isLoading && !hasContent) {
      return (
        <>
          <div className="w-3 h-3 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <span className="font-bold uppercase tracking-wider">Đang tìm hiểu...</span>
        </>
      );
    }
    
    if (!hasContent) {
      return (
        <>
          <span className="text-sm">🛍️</span>
          <span className="font-bold uppercase tracking-wider">Khu vực kinh tế (Tìm kiếm...)</span>
        </>
      );
    }

    return (
      <>
        <span className="text-sm">🛍️</span>
        <span className="font-bold uppercase tracking-wider">Khu vực kinh tế</span>
        <span className="opacity-60 text-[10px] ml-1">{isModalOpen ? '▲' : '▼'}</span>
      </>
    );
  };

  return (
    <div className="p-2 border-t border-gray-700 bg-gray-800/80 backdrop-blur-sm flex items-center justify-center gap-2">
      <Button
        variant="ghost"
        size="sm"
        className={`flex items-center gap-2 text-xs border border-gray-600/50 px-4 py-1.5 transition-all
          ${hasContent ? 'text-amber-400 border-amber-600/30 hover:bg-amber-900/20' : 'text-amber-500 border-amber-800 hover:bg-amber-900/10'}
          ${isLoading && !hasContent ? 'opacity-80' : ''}
        `}
        onClick={() => {
          if (!hasContent) {
            onInitialize();
          } else {
            setIsModalOpen(true);
          }
        }}
        disabled={disabled || (isLoading && !hasContent)}
      >
        {renderContent()}
      </Button>
    </div>
  );
};

export default EconomicZoneBar;
