
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useGame } from '../../../hooks/useGame';
import Button from '../../ui/Button';
import { VIETNAMESE } from '../../../constants';
// FIX: Import Spinner component
import Spinner from '../../ui/Spinner';
import SoulFlameRouletteGame from './SoulFlameRouletteGame';

// --- HELPER TYPES & CONSTANTS ---
type MiniGameType = 'TIMING' | 'RUNNER' | 'MATCHING' | 'ROULETTE';

const GAME_HEIGHT = 80; // px, fits within input area

// --- GAME A: TỤ LINH QUYẾT (Timing) ---
const SpiritGatheringGame: React.FC<{ 
    onReward: (amount: number) => void; 
    onFail?: () => void;
    multiplier: number;
    currencyName: string;
}> = ({ onReward, onFail, multiplier, currencyName }) => {
  const [cursorPos, setCursorPos] = useState(0);
  const [direction, setDirection] = useState(1);
  const [targetZone, setTargetZone] = useState({ start: 40, width: 20 }); // %
  const [score, setScore] = useState(0);
  const reqRef = useRef<number>();
  const speedRef = useRef(1.5);

  useEffect(() => {
    const animate = () => {
      let isBouncing = false;
      
      setCursorPos(prev => {
        let next = prev + speedRef.current * direction;
        if (next >= 100 || next <= 0) {
           isBouncing = true;
           next = Math.max(0, Math.min(100, next));
        }
        return next;
      });

      if (isBouncing) {
        setDirection(d => -d);
      }
      
      reqRef.current = requestAnimationFrame(animate);
    };
    reqRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(reqRef.current!);
  }, [direction]);

  const handleClick = () => {
    if (cursorPos >= targetZone.start && cursorPos <= targetZone.start + targetZone.width) {
      // Success
      const baseReward = 100; 
      const finalReward = Math.floor(baseReward * multiplier);
      
      onReward(finalReward);
      setScore(s => s + finalReward);
      
      // Randomize next zone
      setTargetZone({
          start: Math.random() * 80,
          width: Math.max(10, 20 - (score / (finalReward || 1)) * 0.5) // Gets harder slightly
      });
      speedRef.current = Math.min(4, speedRef.current + 0.2);
    } else {
        // Miss - slight penalty or just reset speed
        speedRef.current = 1.5;
        if (onFail) onFail();
    }
  };

  return (
    <div className="w-full h-full flex flex-col items-center justify-center relative select-none cursor-pointer" onClick={handleClick}>
      <div className="text-xs text-cyan-300 mb-1 font-bold">TỤ LINH QUYẾT: Bấm khi vào vùng sáng! (x{multiplier.toLocaleString()})</div>
      <div className="w-full bg-gray-700 h-8 rounded-full relative overflow-hidden border border-gray-600">
        {/* Target Zone */}
        <div 
            className="absolute top-0 bottom-0 bg-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.8)]" 
            style={{ left: `${targetZone.start}%`, width: `${targetZone.width}%` }}
        />
        {/* Cursor */}
        <div 
            className="absolute top-0 bottom-0 w-4 bg-white rounded-full shadow-[0_0_10px_white]"
            style={{ left: `calc(${cursorPos}% - 8px)`, transition: 'none' }}
        />
      </div>
      <div className="text-[10px] text-gray-400 mt-1">Thu hoạch: +{score.toLocaleString()} {currencyName}</div>
    </div>
  );
};

// --- GAME B: NGỰ KIẾM (Runner) ---
const SwordFlightGame: React.FC<{ 
    onReward: (amount: number) => void; 
    onFail?: () => void;
    multiplier: number; 
    currencyName: string;
}> = ({ onReward, onFail, multiplier, currencyName }) => {
    const [playerLane, setPlayerLane] = useState<'top' | 'bottom'>('bottom');
    const [obstacles, setObstacles] = useState<{id: number, lane: 'top' | 'bottom', x: number}[]>([]);
    const [score, setScore] = useState(0);
    const [isGameOver, setIsGameOver] = useState(false);
    const reqRef = useRef<number>();
    const frameCountRef = useRef(0);

    // Game loop
    useEffect(() => {
        if (isGameOver) return;

        const animate = () => {
            frameCountRef.current++;
            
            if (frameCountRef.current % 60 === 0) {
                const newObstacle = {
                    id: Date.now(),
                    lane: Math.random() > 0.5 ? 'top' : 'bottom' as 'top' | 'bottom',
                    x: 100
                };
                setObstacles(prev => [...prev, newObstacle]);
            }

            let collisionFound = false;

            setObstacles(prev => {
                const nextObstacles = prev.map(o => ({ ...o, x: o.x - 1.5 })).filter(o => o.x > -10);
                
                const collision = nextObstacles.some(o => 
                    o.x > 5 && o.x < 15 && o.lane === playerLane
                );

                if (collision) {
                    collisionFound = true;
                }
                return nextObstacles;
            });

            if (collisionFound) {
                setIsGameOver(true);
                if (onFail) onFail();
            }

            if (frameCountRef.current % 120 === 0 && !isGameOver) { // Changed to trigger every 120 frames (approx 2s)
                const baseReward = 20;
                const finalReward = Math.floor(baseReward * multiplier);
                
                onReward(finalReward);
                setScore(s => s + finalReward);
            }

            if (!isGameOver) {
                reqRef.current = requestAnimationFrame(animate);
            }
        };

        reqRef.current = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(reqRef.current!);
    }, [playerLane, isGameOver, onReward, multiplier]);

    return (
        <div 
            className="w-full h-full relative bg-gray-800 rounded overflow-hidden cursor-pointer border border-gray-600 select-none"
            onClick={() => !isGameOver && setPlayerLane(prev => prev === 'top' ? 'bottom' : 'top')}
        >
            {isGameOver ? (
                 <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-10">
                     <span className="text-red-500 font-bold text-sm">Đã va chạm!</span>
                     <span className="text-xs text-gray-300">Thu hoạch: {score.toLocaleString()} {currencyName}</span>
                     <Button size="sm" variant="ghost" onClick={() => { setIsGameOver(false); setObstacles([]); setScore(0); frameCountRef.current = 0; }} className="mt-1 text-xs !p-1">Chơi lại</Button>
                 </div>
            ) : (
                <>
                     <div className="absolute top-2 left-2 text-[10px] text-amber-400 z-10 font-mono">Ngự Kiếm (x{multiplier.toLocaleString()}): {score.toLocaleString()} {currencyName}</div>
                     <div className="absolute top-1/2 w-full h-px bg-gray-600 border-t border-dashed border-gray-500"></div>
                     
                     <div className={`absolute left-[10%] w-8 h-4 transition-all duration-150 flex items-center justify-center ${playerLane === 'top' ? 'top-[15%]' : 'top-[65%]'}`}>
                        <span className="text-xl filter drop-shadow-[0_0_5px_cyan]">🗡️</span>
                     </div>

                     {obstacles.map(obs => (
                         <div 
                            key={obs.id}
                            className={`absolute w-6 h-6 flex items-center justify-center ${obs.lane === 'top' ? 'top-[10%]' : 'top-[60%]'}`}
                            style={{ left: `${obs.x}%` }}
                         >
                             🪨
                         </div>
                     ))}
                     <div className="absolute bottom-1 right-2 text-[9px] text-gray-500">Click để đổi làn</div>
                </>
            )}
        </div>
    );
};

// --- GAME C: TÂM MA TRẬN (Matching) ---
const ELEMENTS = ['Kim', 'Mộc', 'Thủy', 'Hỏa', 'Thổ'];
const COLORS = ['text-yellow-300', 'text-green-400', 'text-blue-400', 'text-red-500', 'text-amber-600'];

const MindMatchGame: React.FC<{ 
    onReward: (amount: number) => void; 
    onFail?: () => void;
    multiplier: number; 
    currencyName: string;
}> = ({ onReward, onFail, multiplier, currencyName }) => {
    const [targetIndex, setTargetIndex] = useState(0);
    const [leftOption, setLeftOption] = useState(0);
    const [rightOption, setRightOption] = useState(0);
    const [score, setScore] = useState(0);
    const [timer, setTimer] = useState(100); // %

    const generateRound = useCallback(() => {
        const target = Math.floor(Math.random() * ELEMENTS.length);
        setTargetIndex(target);
        
        const isLeftCorrect = Math.random() > 0.5;
        const wrong = (target + 1 + Math.floor(Math.random() * (ELEMENTS.length - 1))) % ELEMENTS.length;
        
        if (isLeftCorrect) {
            setLeftOption(target);
            setRightOption(wrong);
        } else {
            setLeftOption(wrong);
            setRightOption(target);
        }
        setTimer(100);
    }, []);

    useEffect(() => {
        generateRound();
    }, [generateRound]);

    useEffect(() => {
        const interval = setInterval(() => {
            setTimer(t => {
                if (t <= 0) {
                    generateRound();
                    return 100;
                }
                return t - 2;
            });
        }, 50);
        return () => clearInterval(interval);
    }, [generateRound]);

    const handleChoice = (choiceIndex: number) => {
        if (choiceIndex === targetIndex) {
            const baseReward = 20;
            const finalReward = Math.floor(baseReward * multiplier);
            onReward(finalReward);
            setScore(s => s + finalReward);
            generateRound();
        } else {
            setScore(s => Math.max(0, s - Math.floor(5 * multiplier)));
            if (onFail) onFail();
            generateRound();
        }
    };

    return (
        <div className="w-full h-full flex items-center justify-between px-4 relative bg-gray-800 rounded overflow-hidden border border-purple-900/50">
            <div className="absolute top-0 left-0 h-1 bg-purple-500 transition-all duration-75" style={{ width: `${timer}%` }}></div>
            
            <Button 
                onClick={() => handleChoice(leftOption)} 
                variant="secondary" 
                className={`w-1/3 h-3/4 text-lg font-bold ${COLORS[leftOption]}`}
            >
                {ELEMENTS[leftOption]}
            </Button>

            <div className="flex flex-col items-center">
                <span className="text-[10px] text-purple-300">Chọn đúng:</span>
                <span className={`text-2xl font-bold ${COLORS[targetIndex]} animate-pulse`}>{ELEMENTS[targetIndex]}</span>
                <span className="text-[10px] text-amber-400">+{score.toLocaleString()} {currencyName}</span>
            </div>

            <Button 
                onClick={() => handleChoice(rightOption)} 
                variant="secondary" 
                className={`w-1/3 h-3/4 text-lg font-bold ${COLORS[rightOption]}`}
            >
                {ELEMENTS[rightOption]}
            </Button>
            <div className="absolute top-1 right-1 text-[8px] text-gray-600">x{multiplier.toLocaleString()}</div>
        </div>
    );
};


// --- MAIN CONTAINER ---
const LoadingMiniGameContainer: React.FC<{ onClose: () => void, onFail?: () => void }> = ({ onClose, onFail }) => {
  const { applyMinigameReward, applyRouletteResult, knowledgeBase } = useGame();
  const [gameType, setGameType] = useState<MiniGameType | null>(null);
  const [totalReward, setTotalReward] = useState(0);
  const totalRewardRef = useRef(0);

  useEffect(() => {
    totalRewardRef.current = totalReward;
  }, [totalReward]);
  
  const currencyName = knowledgeBase.worldConfig?.currencyName || "Linh Thạch";

  const realmMultiplier = useMemo(() => {
      const list = knowledgeBase.realmProgressionList || [];
      const currentRealm = knowledgeBase.playerStats.realm;
      
      let index = 0;
      if (list.length > 0) {
          const foundIndex = list.findIndex(r => currentRealm.startsWith(r));
          if (foundIndex !== -1) {
              index = foundIndex;
          }
      }
      
      return Math.pow(2, index);
  }, [knowledgeBase.realmProgressionList, knowledgeBase.playerStats.realm]);

  const currentCurrency = knowledgeBase.playerStats.currency || 0;
  const maxBetRoulette = Math.floor(currentCurrency * 0.5); // Tối đa 50% tài sản

  useEffect(() => {
      const random = Math.random();
      if (random < 0.9) {
          setGameType('ROULETTE');
      } else {
          const otherTypes: MiniGameType[] = ['TIMING', 'RUNNER', 'MATCHING'];
          setGameType(otherTypes[Math.floor(Math.random() * otherTypes.length)]);
      }
  }, []);

  const handleReward = useCallback((amount: number) => {
    if (isNaN(amount) || amount <= 0) return;
    setTotalReward(prev => prev + amount);
    applyMinigameReward(amount);
  }, [applyMinigameReward]);

  const renderGame = () => {
      switch (gameType) {
          case 'TIMING': return <SpiritGatheringGame onReward={handleReward} onFail={onFail} multiplier={realmMultiplier} currencyName={currencyName} />;
          case 'RUNNER': return <SwordFlightGame onReward={handleReward} onFail={onFail} multiplier={realmMultiplier} currencyName={currencyName} />;
          case 'MATCHING': return <MindMatchGame onReward={handleReward} onFail={onFail} multiplier={realmMultiplier} currencyName={currencyName} />;
          case 'ROULETTE': return <SoulFlameRouletteGame onComplete={applyRouletteResult} onFail={onFail} maxBet={maxBetRoulette} currencyName={currencyName} />;
          default: return <div className="flex items-center justify-center h-full"><Spinner size="sm" text="Đang tải mini-game..."/></div>;
      }
  };

  return (
    <div className="w-full h-[80px] bg-gray-900 rounded-lg border-2 border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.2)] relative overflow-hidden flex flex-col">
        <div className="flex-grow relative">
            {renderGame()}
        </div>
    </div>
  );
};

export default LoadingMiniGameContainer;
