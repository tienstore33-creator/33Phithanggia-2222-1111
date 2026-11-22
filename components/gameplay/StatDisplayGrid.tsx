
import React from 'react';
import { PlayerStats } from '../../types';
import { getHpFormulaExplanation } from '../../utils/statsCalculationUtils';
import { formatNumberDot } from '../../utils/combatDataSanitizer';

interface StatDisplayGridProps {
  stats: Partial<PlayerStats>;
  className?: string;
  equippedItemIds?: Record<any, any>;
  inventory?: any[];
  kb?: any;
}

const StatItem = ({ icon, label, value, colorClass, extra }: { icon: string, label: string, value: string | number, colorClass: string, extra?: React.ReactNode }) => (
  <div className="flex flex-col p-2 bg-slate-900/40 rounded border border-slate-700/30 hover:border-slate-600/50 transition-colors">
    <div className="flex items-center gap-1.5 mb-1">
      <span className="text-sm" role="img" aria-label={label}>{icon}</span>
      <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500">{label}</span>
    </div>
    <div className={`font-mono text-sm font-semibold truncate ${colorClass}`}>
      {value}
    </div>
    {extra}
  </div>
);

export const StatDisplayGrid: React.FC<StatDisplayGridProps> = ({ stats, className = "", equippedItemIds, inventory, kb }) => {
  const sinhLuc = Math.round(stats.sinhLuc || 0);
  const maxSinhLuc = Math.round(stats.maxSinhLuc || 0);
  const linhLuc = Math.round(stats.linhLuc || 0);
  const maxLinhLuc = Math.round(stats.maxLinhLuc || 0);
  const sucTanCong = Math.round(stats.sucTanCong || 0);
  const phongNgu = Math.round(stats.phongNgu || 0);
  const kinhNghiem = Math.round(stats.kinhNghiem || 0);
  const maxKinhNghiem = Math.round(stats.maxKinhNghiem || 0);
  const thoNguyenDisplay = typeof stats.thoNguyen === 'number'
    ? (Number.isInteger(stats.thoNguyen) ? formatNumberDot(stats.thoNguyen) : parseFloat(stats.thoNguyen.toFixed(7)).toString())
    : '0';
  const maxThoNguyen = Math.round(stats.maxThoNguyen || 120);

  // Calculate HP formula explanation
  const hpExplanation = getHpFormulaExplanation(stats as PlayerStats, equippedItemIds, inventory, kb);

  return (
    <div className={`grid grid-cols-2 gap-2 w-full ${className}`}>
      <div className="col-span-2">
        <StatItem 
          icon="❤️" 
          label="Sinh lực" 
          value={`${formatNumberDot(sinhLuc)}/${formatNumberDot(maxSinhLuc)}`}
          colorClass="text-red-400" 
          extra={(
            <div className="mt-1.5 pt-1 border-t border-slate-700/40 text-[10px] text-slate-400 font-normal space-y-0.5">
              <div className="font-mono text-red-300 font-semibold flex flex-wrap gap-1">
                <span>Công thức:</span>
                <span className="text-white">{formatNumberDot(hpExplanation.formulaText)}</span>
              </div>
              <div className="text-[9px] text-slate-500 italic leading-snug">
                {formatNumberDot(hpExplanation.breakdownText)}
              </div>
            </div>
          )}
        />
      </div>
      <StatItem 
        icon="💧" 
        label="Linh lực" 
        value={`${formatNumberDot(linhLuc)}/${formatNumberDot(maxLinhLuc)}`}
        colorClass="text-blue-400" 
      />

      <StatItem 
        icon="⚔️" 
        label="Tấn công" 
        value={formatNumberDot(sucTanCong)} 
        colorClass="text-orange-400" 
      />
      <StatItem 
        icon="🛡️" 
        label="Phòng ngự" 
        value={formatNumberDot(phongNgu)} 
        colorClass="text-blue-300" 
      />
      <StatItem 
        icon="🧪" 
        label="Kinh nghiệm" 
        value={`${formatNumberDot(kinhNghiem)}/${formatNumberDot(maxKinhNghiem)}`}
        colorClass="text-purple-400" 
      />
      <StatItem 
        icon="⏳" 
        label="Thọ nguyên" 
        value={`${thoNguyenDisplay}/${formatNumberDot(maxThoNguyen)}`}
        colorClass="text-emerald-400" 
      />
      <StatItem 
        icon="🪙" 
        label="Linh thạch" 
        value={formatNumberDot(Math.round(stats.currency || 0))} 
        colorClass="text-yellow-400" 
      />
    </div>
  );
};

export default StatDisplayGrid;
