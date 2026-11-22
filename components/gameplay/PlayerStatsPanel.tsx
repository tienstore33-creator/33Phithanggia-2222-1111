

import React from 'react';
import { PlayerStats, KnowledgeBase } from '../../types'; // Added KnowledgeBase
import { VIETNAMESE } from '../../constants';
import StatDisplay from './StatDisplay';
import StatDisplayGrid from './StatDisplayGrid';

interface PlayerStatsPanelProps {
  stats: PlayerStats;
  knowledgeBase: KnowledgeBase; // Pass full KB to access worldConfig
}

const PlayerStatsPanel: React.FC<PlayerStatsPanelProps> = React.memo(({stats, knowledgeBase}) => {
  const { worldConfig } = knowledgeBase;
  const isCultivationEnabled = worldConfig?.isCultivationEnabled !== undefined ? worldConfig.isCultivationEnabled : true;
  const currencyName = worldConfig?.currencyName || "Tiền Tệ";
  const playerName = worldConfig?.playerName;
  const playerGender = worldConfig?.playerGender;

  const realmLabel = isCultivationEnabled ? VIETNAMESE.realmLabel : "Trạng Thái/Cấp Độ";

  return (
    <div className="bg-gray-800 p-4 rounded-lg shadow-md mb-4">
      <h3 className="text-lg font-semibold text-indigo-400 mb-3 border-b border-gray-700 pb-2 flex justify-between items-center">
        <span>{VIETNAMESE.playerStats}</span>
        {isCultivationEnabled && stats.hieuUngBinhCanh && (
          <span className="text-sm font-bold text-red-400 bg-red-900/50 px-2 py-0.5 rounded-full border border-red-600 animate-pulse">
            {VIETNAMESE.bottleneckEffectLabel}
          </span>
        )}
      </h3>
      
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 mb-3">
        {playerName && (
          <StatDisplay 
            label={VIETNAMESE.characterName} 
            value={
              <span>
                {playerName}
                {worldConfig?.originalPlayerName && worldConfig.originalPlayerName !== playerName && (
                  <span className="text-[11px] text-gray-400 font-normal ml-1 whitespace-nowrap">
                    ({worldConfig.originalPlayerName})
                  </span>
                )}
              </span>
            } 
            className="col-span-1" 
          />
        )}
        {playerGender && <StatDisplay label={VIETNAMESE.gender} value={playerGender} className="col-span-1"/>}
        <StatDisplay label={realmLabel} value={stats.realm} className="col-span-2 text-amber-400 font-semibold" />
      </div>

      <StatDisplayGrid 
        stats={stats} 
        className="mb-4" 
        equippedItemIds={knowledgeBase.equippedItems}
        inventory={knowledgeBase.inventory}
        kb={knowledgeBase}
      />

      <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2 pt-2 border-t border-gray-700/50">
        <StatDisplay label={currencyName} value={stats.currency} />
        <StatDisplay label="Lượt" value={stats.turn} />
      </div>

      {stats.equipmentPassives && Object.keys(stats.equipmentPassives).length > 0 && (
        <div className="mt-4 pt-3 border-t border-gray-700">
          <h4 className="text-sm font-medium text-teal-400 mb-2 uppercase tracking-wider flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Hiệu Ứng Trang Bị
          </h4>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(stats.equipmentPassives).map(([keyword, value]) => (
              <div key={keyword} className="flex justify-between items-center bg-gray-900/50 px-2 py-1.5 rounded border border-gray-700/50">
                <span className="text-xs text-gray-400 capitalize">{keyword}</span>
                <span className="text-xs font-bold text-teal-300">+{value}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

export default PlayerStatsPanel;