import React, { useState, useEffect, useCallback } from 'react';
import Button from './ui/Button';

interface Offset {
  x: number;
  y: number;
  scale: number;
}

interface AvatarStudioProps {
  isOpen: boolean;
  onClose: () => void;
}

const AvatarStudio: React.FC<AvatarStudioProps> = ({ isOpen, onClose }) => {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [hairOffsets, setHairOffsets] = useState<Offset[]>(() => [
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
  ]);
  const [faceOffsets, setFaceOffsets] = useState<Offset[]>(() => [
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
  ]);
  const [calibrationTarget, setCalibrationTarget] = useState<'hair' | 'face'>('hair');
  const [showGrid, setShowGrid] = useState(true);
  const [log, setLog] = useState<string>('Chào mừng tới Calibration Studio.');
  const [isAnchorMode, setIsAnchorMode] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying) {
        interval = setInterval(() => {
            setCurrentIdx(prev => (prev >= 24 ? 0 : prev + 1));
        }, 500); 
    }
    return () => clearInterval(interval);
  }, [isPlaying]);

  const currentOffset = calibrationTarget === 'hair' ? hairOffsets[currentIdx] : faceOffsets[currentIdx];

  const updateCurrentOffset = useCallback((updates: Partial<Offset>) => {
    const setter = calibrationTarget === 'hair' ? setHairOffsets : setFaceOffsets;
    setter(prev => {
      const next = [...prev];
      next[currentIdx] = { ...next[currentIdx], ...updates };
      return next;
    });
  }, [currentIdx, calibrationTarget]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      const step = e.shiftKey ? 2 : 0.5;

      switch(e.key) {
        case 'ArrowUp': updateCurrentOffset({ y: currentOffset.y - step }); e.preventDefault(); break;
        case 'ArrowDown': updateCurrentOffset({ y: currentOffset.y + step }); e.preventDefault(); break;
        case 'ArrowLeft': updateCurrentOffset({ x: currentOffset.x - step }); e.preventDefault(); break;
        case 'ArrowRight': updateCurrentOffset({ x: currentOffset.x + step }); e.preventDefault(); break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentOffset, updateCurrentOffset]);

  const handleExport = () => {
    const data = {
      hair: hairOffsets,
      face: faceOffsets
    };
    const dataStr = JSON.stringify(data, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'avatar_calibration_data.json';
    link.click();
    setLog('Đã xuất file JSON (Hair & Face)!');
  };

  const calculatePosition = (index: number) => {
    const row = Math.floor(index / 5);
    const col = index % 5;
    return `${col * 25}% ${row * 25}%`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[300] bg-gray-950 flex flex-col animate-in fade-in duration-300 overflow-auto">
      {/* Header */}
      <div className="p-4 border-b border-indigo-900/50 flex justify-between items-center bg-gray-950 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse"></div>
          <h1 className="text-xl font-bold text-white uppercase tracking-tighter">Avatar Calibration Studio <span className="text-xs text-indigo-500 ml-2">v1.0</span></h1>
        </div>
        <div className="flex gap-2">
           <Button variant="outline" size="sm" onClick={handleExport}>Lưu/Xuất JSON</Button>
           <Button variant="primary" size="sm" onClick={onClose}>[X] Đóng Studio</Button>
        </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row p-6 gap-8 justify-center items-start">
        {/* Left: Preview Area */}
        <div className="flex flex-col gap-4 w-full max-w-[500px]">
          <div className="flex justify-between items-end">
            <div className="text-xs font-bold text-gray-500 uppercase tracking-widest">[ Vùng Xem Trước ]</div>
            <div className="text-[10px] text-indigo-400 font-mono">Layer: {calibrationTarget.toUpperCase()}</div>
          </div>
           <div className={`relative aspect-square rounded-2xl border-4 border-indigo-500/30 overflow-hidden bg-black shadow-2xl`}>
             {/* Base Anchor Face Layer (#0) */}
             {(isAnchorMode || calibrationTarget === 'hair') && (
                <div className="absolute inset-0 w-full h-full transform-gpu"
                  style={{
                    backgroundImage: 'url(/images/faces_sprite.jpg)',
                    backgroundSize: '500% 500%',
                    backgroundPosition: calculatePosition(0),
                    opacity: 1,
                    transform: `translate(${faceOffsets[0].x}%, ${faceOffsets[0].y}%) scale(${faceOffsets[0].scale})`,
                  }}
                />
             )}
             
             {/* Face Layer (FACE TARGET) */}
             {calibrationTarget === 'face' && (
                <div className={`absolute inset-0 w-full h-full transform-gpu ${isPlaying ? 'transition-all duration-300' : ''}`}
                  style={{
                    backgroundImage: 'url(/images/faces_sprite.jpg)',
                    backgroundSize: '500% 500%',
                    backgroundPosition: calculatePosition(currentIdx),
                    opacity: isAnchorMode ? 0.6 : 1,
                    mixBlendMode: isAnchorMode ? 'multiply' : 'normal',
                    transform: `translate(${faceOffsets[currentIdx].x}%, ${faceOffsets[currentIdx].y}%) scale(${faceOffsets[currentIdx].scale})`,
                  }}
                />
             )}
             
             {/* Hair Layer (HAIR TARGET) */}
             {calibrationTarget === 'hair' && (
                <div className={`absolute inset-0 w-full h-full transform-gpu ${isPlaying ? 'transition-all duration-300' : 'transition-all duration-75'}`}
                  style={{
                    backgroundImage: 'url(/images/hair_sprite.png)',
                    backgroundSize: '500% 500%',
                    backgroundPosition: calculatePosition(currentIdx),
                    opacity: 1,
                    transform: `translate(${hairOffsets[currentIdx].x}%, ${hairOffsets[currentIdx].y}%) scale(${hairOffsets[currentIdx].scale})`,
                  }}
                />
             )}
             
             {showGrid && (
               <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 pointer-events-none opacity-20">
                 <div className="border-r border-b border-white"></div>
                 <div className="border-b border-white"></div>
                 <div className="border-r border-white"></div>
                 <div></div>
               </div>
             )}
          </div>
          
          <div className="flex gap-2">
            <Button variant={showGrid ? "primary" : "outline"} size="sm" className="flex-1" onClick={() => setShowGrid(!showGrid)}>
              {showGrid ? "Ẩn Lưới" : "Hiện Lưới"}
            </Button>
            <Button variant="outline" size="sm" className="flex-1" onClick={() => setLog(`Đã đánh dấu lưu #${currentIdx}`)}>Ghi nhớ ID này</Button>
          </div>
        </div>

        {/* Right: Controls Area */}
        <div className="flex flex-col gap-6 w-full max-w-[350px] bg-gray-900 p-6 rounded-3xl border border-indigo-500/20 shadow-xl">
           <div className="text-xs font-bold text-indigo-400 uppercase tracking-widest">[ Bảng Điều Khiển ]</div>

           {/* 0. Target Selection */}
           <div className="grid grid-cols-2 gap-2">
             <Button variant={calibrationTarget === 'face' ? 'primary' : 'outline'} size="sm" onClick={() => setCalibrationTarget('face')}>Căn Mặt</Button>
             <Button variant={calibrationTarget === 'hair' ? 'primary' : 'outline'} size="sm" onClick={() => setCalibrationTarget('hair')}>Căn Tóc</Button>
           </div>

           {/* 1. Select Position */}
           <div className="space-y-3">
             <div className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter">1. CHỌN PARITY (ID: 0-24):</div>
             <div className="flex items-center gap-2">
               <Button variant="outline" className="h-10 w-10 p-0" onClick={() => setCurrentIdx(prev => Math.max(0, prev - 1))}>{"<"}</Button>
               <div className="flex-1 bg-black rounded-lg py-2 border border-gray-800 text-center text-white font-mono text-sm">
                 Vị trí: #{currentIdx.toString().padStart(2, '0')}
               </div>
               <Button variant="outline" className="h-10 w-10 p-0" onClick={() => setCurrentIdx(prev => Math.min(24, prev + 1))}>{">"}</Button>
             </div>
             
             <div className="grid grid-cols-2 gap-2 mt-2">
                 <Button 
                     variant={isAnchorMode ? 'primary' : 'outline'} 
                     size="sm" 
                     onClick={() => setIsAnchorMode(!isAnchorMode)}
                     className="text-[10px]"
                 >
                     {isAnchorMode ? '[ON] Mốc Mặt #0' : '[OFF] Mốc Mặt #0'}
                 </Button>
                 <Button 
                     variant={isPlaying ? 'primary' : 'outline'} 
                     size="sm" 
                     onClick={() => setIsPlaying(!isPlaying)}
                     className="text-[10px]"
                 >
                     {isPlaying ? '⏸ Dừng Lướt' : '▶ Bắt đầu Lướt'}
                 </Button>
             </div>
           </div>

           {/* 2. Offset Movement */}
           <div className="space-y-3">
             <div className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter">2. DI CHUYỂN {calibrationTarget === 'hair' ? 'TÓC' : 'MẶT'} (OFFSET):</div>
             <div className="flex flex-col items-center gap-1">
               <Button variant="outline" onClick={() => updateCurrentOffset({ y: currentOffset.y - 0.5 })} className="w-10 h-10 p-0">▲</Button>
               <div className="flex gap-1">
                 <Button variant="outline" onClick={() => updateCurrentOffset({ x: currentOffset.x - 0.5 })} className="w-10 h-10 p-0">◄</Button>
                 <Button variant="outline" onClick={() => updateCurrentOffset({ x: 0, y: calibrationTarget === 'hair' ? -1 : 0 })} className="text-[8px] w-14 p-0 uppercase">Reset</Button>
                 <Button variant="outline" onClick={() => updateCurrentOffset({ x: currentOffset.x + 0.5 })} className="w-10 h-10 p-0">►</Button>
               </div>
               <Button variant="outline" onClick={() => updateCurrentOffset({ y: currentOffset.y + 0.5 })} className="w-10 h-10 p-0">▼</Button>
             </div>
             <div className="text-center text-[9px] text-gray-600">(Phím Mũi Tên | Shift: 2%)</div>
           </div>

           {/* 3. Scale */}
           <div className="space-y-3">
             <div className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter">3. TỶ LỆ (SCALE):</div>
             <div className="flex items-center gap-4">
                <Button variant="outline" className="h-8 w-8 p-0" onClick={() => updateCurrentOffset({ scale: currentOffset.scale - 0.01 })}>-</Button>
                <div className="flex-1 text-center font-mono text-emerald-400 font-bold bg-black rounded border border-gray-800 py-1">{Math.round(currentOffset.scale * 100)}%</div>
                <Button variant="outline" className="h-8 w-8 p-0" onClick={() => updateCurrentOffset({ scale: currentOffset.scale + 0.01 })}>+</Button>
             </div>
           </div>
        </div>
      </div>

      {/* Footer Log */}
      <div className="bg-black p-3 border-t border-indigo-900/50 flex justify-between items-center text-[10px] font-mono sticky bottom-0">
         <div className="text-emerald-500">STATUS: {isPlaying ? `Đang phát tự động... (ID: ${currentIdx})` : log}</div>
         <div className="text-indigo-400 flex gap-6">
            <div className="flex flex-col">
              <span className="text-gray-600 text-[8px] uppercase">Face Offset</span>
              <span>X:{faceOffsets[currentIdx].x.toFixed(1)} Y:{faceOffsets[currentIdx].y.toFixed(1)} S:{faceOffsets[currentIdx].scale.toFixed(2)}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-gray-600 text-[8px] uppercase">Hair Offset</span>
              <span>X:{hairOffsets[currentIdx].x.toFixed(1)} Y:{hairOffsets[currentIdx].y.toFixed(1)} S:{hairOffsets[currentIdx].scale.toFixed(2)}</span>
            </div>
         </div>
      </div>
    </div>
  );
};

export default AvatarStudio;
