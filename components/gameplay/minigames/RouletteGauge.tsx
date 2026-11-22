import React from 'react';

interface RouletteGaugeProps {
  loseProbability: number;
  isSpinning: boolean;
  rotation: number;
}

export const RouletteGauge: React.FC<RouletteGaugeProps> = ({ loseProbability, isSpinning, rotation }) => {
  const points = 7;
  const radius = 40;
  const center = 50;
  
  // Calculate markers (0-6)
  const markers = Array.from({ length: points }, (_, i) => {
    const angle = (i * 360) / points - 90; // Start from top (0)
    const x = center + radius * Math.cos((angle * Math.PI) / 180);
    const y = center + radius * Math.sin((angle * Math.PI) / 180);
    return { x, y, label: i };
  });

  // Calculate the red arc
  // Use stroke-dasharray for simplicity as suggested by AI council
  const circumference = 2 * Math.PI * radius;
  const redPercentage = loseProbability;
  const strokeDasharray = `${circumference * redPercentage} ${circumference}`;

  return (
    <div className="relative w-16 h-16 flex items-center justify-center">
      <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
        {/* Background circle */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="#374151"
          strokeWidth="6"
        />
        
        {/* Red death zone */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="#EF4444"
          strokeWidth="6"
          strokeDasharray={strokeDasharray}
          strokeLinecap="butt"
          className="transition-all duration-300"
        />

        {/* Markers */}
        {markers.map((m) => (
          <g key={m.label} transform={`rotate(90, ${m.x}, ${m.y})`}>
             <circle cx={m.x} cy={m.y} r="1.5" fill="#9CA3AF" />
             <text
                x={m.x}
                y={m.y - 4}
                textAnchor="middle"
                fontSize="6"
                fill="#9CA3AF"
                fontWeight="bold"
                className="select-none"
             >
                {m.label}
             </text>
          </g>
        ))}
        
        {/* Center pivot */}
        <circle cx={center} cy={center} r="3" fill="#6B7280" />
      </svg>

      {/* Needle (Kim quay) */}
      <div 
        className="absolute w-full h-full pointer-events-none transition-transform"
        style={{ 
            transform: `rotate(${rotation}deg)`,
            transition: isSpinning ? 'none' : 'transform 0.5s cubic-bezier(0.15, 0, 0.15, 1)'
        }}
      >
        <div 
            className="absolute top-1/2 left-1/2 -translate-y-full -translate-x-1/2 w-1 h-[40%] bg-amber-500 rounded-full shadow-lg"
            style={{ transformOrigin: 'bottom center' }}
        >
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-full w-0 h-0 border-l-[3px] border-l-transparent border-r-[3px] border-r-transparent border-b-[6px] border-b-amber-500" />
        </div>
      </div>
    </div>
  );
};
