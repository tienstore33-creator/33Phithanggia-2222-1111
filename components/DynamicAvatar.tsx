import React from 'react';

interface DynamicAvatarProps {
  hairIndex?: number;
  faceIndex?: number;
  size?: number;
  zoomMode?: boolean;
  faceScale?: number;
}

const HAIR_OFFSETS = [
  { x: 0.5, y: -3.5, scale: 1.07 },
  { x: 4, y: -3.5, scale: 1.09 },
  { x: 6.5, y: -5.5, scale: 1.07 },
  { x: 9.5, y: -4, scale: 1.05 },
  { x: 12, y: -1, scale: 1.01 },
  { x: 0, y: -1, scale: 1 },
  { x: 4, y: -1, scale: 1.08 },
  { x: 6, y: -1, scale: 1.04 },
  { x: 9.5, y: -0.5, scale: 1.04 },
  { x: 12, y: 1, scale: 1.02 },
  { x: 0, y: 3, scale: 1.04 },
  { x: 3.5, y: 3.5, scale: 1.06 },
  { x: 6, y: 3.5, scale: 1.03 },
  { x: 9.5, y: 1.5, scale: 1.04 },
  { x: 12, y: 3, scale: 1.03 },
  { x: 0, y: 4.5, scale: 1.06 },
  { x: 4, y: 5, scale: 1.08 },
  { x: 6.5, y: 4, scale: 1.06 },
  { x: 9, y: 6, scale: 1.06 },
  { x: 12.5, y: 4, scale: 1.04 },
  { x: 0, y: 6, scale: 1.1 },
  { x: 4, y: 5, scale: 1.07 },
  { x: 6.5, y: 6, scale: 1.06 },
  { x: 8.5, y: 7.5, scale: 1.04 },
  { x: 13, y: 3.5, scale: 1.08 }
];

const FACE_OFFSETS = [
  { x: 0, y: 0, scale: 1 },
  { x: 2.5, y: 0, scale: 1 },
  { x: 5, y: 0, scale: 1 },
  { x: 8, y: 0, scale: 1 },
  { x: 11.5, y: 0, scale: 1 },
  { x: 0, y: 3, scale: 1 },
  { x: 2, y: 2.5, scale: 1 },
  { x: 4, y: 2.5, scale: 1 },
  { x: 8, y: 1, scale: 1 },
  { x: 11, y: 1.5, scale: 1 },
  { x: 0, y: 5.5, scale: 1 },
  { x: 3.5, y: 5.5, scale: 1 },
  { x: 5, y: 5.5, scale: 1 },
  { x: 8, y: 4, scale: 1 },
  { x: 11, y: 4.5, scale: 1 },
  { x: 0, y: 7, scale: 1 },
  { x: 2.5, y: 6.5, scale: 1 },
  { x: 5.5, y: 7.5, scale: 1 },
  { x: 8.5, y: 7.5, scale: 1 },
  { x: 11, y: 8, scale: 1 },
  { x: 0, y: 11, scale: 1 },
  { x: 2, y: 11.5, scale: 1 },
  { x: 5, y: 10.5, scale: 1 },
  { x: 8.5, y: 11, scale: 1 },
  { x: 11, y: 11, scale: 1 }
];

const DynamicAvatar: React.FC<DynamicAvatarProps> = ({ hairIndex = 0, faceIndex = 0, size = 48, zoomMode = false, faceScale = 1.0 }) => {
  // Ensure indices are within bounds (0-24)
  const safeHairIdx = Math.max(0, Math.min(24, hairIndex || 0));
  const safeFaceIdx = Math.max(0, Math.min(24, faceIndex || 0));
  const hairOffset = HAIR_OFFSETS[safeHairIdx];
  const faceOffset = FACE_OFFSETS[safeFaceIdx];

  // Calculate coordinates for 5x5 grid
  const calculatePosition = (index: number) => {
    const row = Math.floor(index / 5);
    const col = index % 5;
    // Standard 5x5 grid percentages: 0%, 25%, 50%, 75%, 100%
    return `${col * 25}% ${row * 25}%`;
  };

  return (
    <div 
      className="relative overflow-hidden rounded-full shadow-md shrink-0 bg-[#f0ecda] flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      {/* 
        The main container is scaled down to leave room for hair 
        Shift slightly up (translateY) if needed to center the face vertically.
      */}
      <div 
        className="absolute inset-0 flex items-center justify-center"
        style={{
          transform: zoomMode 
            ? `scale(${0.85 * faceScale}) translateY(-3%)` 
            : `scale(${0.65 * faceScale}) translateY(-5%)`
        }}
      >
        {/* Face Layer (z-index: 0) */}
        <div 
          className="absolute inset-0 w-full h-full"
          style={{
            backgroundImage: 'url(/images/faces_sprite.jpg)',
            backgroundSize: '500% 500%',
            backgroundPosition: calculatePosition(safeFaceIdx),
            zIndex: 0,
            transform: `translate(${faceOffset.x}%, ${faceOffset.y}%) scale(${faceOffset.scale})`
          }}
        />
        {/* Hair Layer (z-index: 10) - Calibrated via AvatarStudio */}
        <div 
          className="absolute inset-0 w-full h-full"
          style={{
            backgroundImage: 'url(/images/hair_sprite.png)',
            backgroundSize: '500% 500%',
            backgroundPosition: calculatePosition(safeHairIdx),
            backgroundRepeat: 'no-repeat',
            zIndex: 10,
            transform: `translate(${hairOffset.x}%, ${hairOffset.y}%) scale(${hairOffset.scale})`
          }}
        />
      </div>
    </div>
  );
};

export default React.memo(DynamicAvatar);
