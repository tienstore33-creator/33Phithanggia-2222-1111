import React, { useState, useRef } from 'react';
import Button from '../../ui/Button';
import { RouletteGauge } from './RouletteGauge';

interface SoulFlameRouletteGameProps {
    onComplete: (currencyChange: number, expLossPercent: number) => void;
    onFail?: () => void;
    maxBet: number;
    currencyName: string;
}

const SoulFlameRouletteGame: React.FC<SoulFlameRouletteGameProps> = ({ onComplete, onFail, maxBet, currencyName }) => {
    const [flameCount, setFlameCount] = useState(1);
    const [betAmount, setBetAmount] = useState(0);
    const [gameState, setGameState] = useState<'betting' | 'spinning' | 'result'>('betting');
    const [isWin, setIsWin] = useState<boolean | null>(null);
    const [rotation, setRotation] = useState(0);
    const spinTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const calculateWinAmount = (bet: number, flames: number) => {
        // Thắng: thưởng dựa trên rủi ro (lửa càng nhiều thưởng càng cao)
        const bonusMultiplier = 1.1 + (0.1 * flames);
        return Math.floor(bet * bonusMultiplier);
    };

    const handleMaxBet = () => {
        setBetAmount(maxBet);
    };

    const handleSpin = () => {
        if (betAmount <= 0 || betAmount > maxBet) return;
        
        setGameState('spinning');
        
        // Tạo hiệu ứng quay: quay ít nhất 5 vòng + một góc ngẫu nhiên
        const extraRounds = 5 + Math.floor(Math.random() * 5);
        const randomAngle = Math.random() * 360;
        const totalRotation = rotation + (extraRounds * 360) + randomAngle;
        
        setRotation(totalRotation);

        spinTimeoutRef.current = setTimeout(() => {
            const finalAngle = totalRotation % 360;
            const loseProbability = (35 + flameCount * 10) / 100;
            const redZoneAngle = loseProbability * 360;
            
            // Nếu góc rơi vào cung đỏ (0 -> redZoneAngle)
            const isLose = finalAngle >= 0 && finalAngle <= redZoneAngle;
            
            setIsWin(!isLose);
            setGameState('result');

            if (isLose) {
                // Thua: Mất tiền cược, mất exp dựa trên rủi ro
                onComplete(-betAmount, flameCount * 12);
                if (onFail) onFail();
            } else {
                const winAmount = calculateWinAmount(betAmount, flameCount);
                onComplete(winAmount, 0);
            }
        }, 2000);
    };

    const handleReset = () => {
        setGameState('betting');
        setIsWin(null);
        setBetAmount(0);
    };

    if (gameState === 'result') {
        const winAmount = calculateWinAmount(betAmount, flameCount);
        return (
            <div className="w-full h-full flex flex-col items-center justify-center relative bg-gray-800 rounded overflow-hidden border border-red-900/50">
                <div className={`text-lg font-bold ${isWin ? 'text-green-400' : 'text-red-500'}`}>
                    {isWin ? 'Sống sót!' : 'Nghiệp chướng!'}
                </div>
                <div className="text-[10px] text-gray-300 mt-1 text-center px-4">
                    {isWin ? `Phúc thần độ trì! +${winAmount.toLocaleString()} ${currencyName}` : `Kiếp số khó tránh! -${betAmount.toLocaleString()} ${currencyName} & -${flameCount * 12}% Tu vi`}
                </div>
                <Button size="sm" variant="ghost" onClick={handleReset} className="mt-2 text-xs !p-1">Chủ động cầu may</Button>
            </div>
        );
    }

    const currentExpectedWin = calculateWinAmount(betAmount, flameCount);
    const loseProb = (35 + flameCount * 10) / 100;
    const winPercent = Math.round((1 - loseProb) * 100);

    return (
        <div className="w-full h-full flex items-center justify-center gap-2 p-1 relative bg-gray-800 rounded overflow-hidden border border-red-900/50">
            <div className="flex flex-col w-[58%] border-r border-gray-700/50 h-full justify-center pr-1.5">
                <div className="text-[9px] text-red-500 font-bold mb-0.5 leading-tight truncate">Cò Quay (Max: {maxBet.toLocaleString()})</div>
                
                <div className="flex gap-1 mb-1.5">
                    <input 
                        type="number" 
                        value={betAmount || ''} 
                        onChange={(e) => setBetAmount(Math.min(maxBet, Math.max(0, parseInt(e.target.value) || 0)))}
                        placeholder="Tiền..."
                        className="flex-1 bg-gray-900 text-[10px] text-white px-1.5 py-0.5 h-6 rounded border border-gray-700 focus:border-red-500 outline-none"
                        disabled={gameState === 'spinning'}
                    />
                    <button 
                        onClick={handleMaxBet}
                        disabled={gameState === 'spinning'}
                        className="bg-gray-700 hover:bg-gray-600 text-white text-[8px] px-1.5 h-6 rounded border border-gray-600 font-bold"
                    >
                        MAX
                    </button>
                </div>

                <div className="flex flex-col gap-0.5">
                    <span className="text-[8px] text-gray-400">Ấn định Lửa:</span>
                    <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map((n) => (
                            <button
                                key={n}
                                onClick={() => setFlameCount(n)}
                                disabled={gameState === 'spinning'}
                                className={`w-5 h-5 rounded text-[9px] font-bold border ${
                                    flameCount === n 
                                    ? 'bg-red-900/80 border-red-500 text-white' 
                                    : 'bg-gray-900 border-gray-700 text-gray-500'
                                } transition-colors`}
                            >
                                {n}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="flex flex-col items-center justify-center w-[42%]">
                <div className="scale-90 origin-center">
                    <RouletteGauge 
                        loseProbability={(35 + flameCount * 10) / 100} 
                        isSpinning={gameState === 'spinning'} 
                        rotation={rotation} 
                    />
                </div>
                
                <div className="mt-1 w-full text-center">
                    <div className="text-[7px] text-gray-500 mb-0.5 leading-none">
                        Thắng: {winPercent}% | +{(currentExpectedWin - betAmount).toLocaleString()}
                    </div>
                    <Button 
                        onClick={handleSpin} 
                        disabled={betAmount <= 0 || betAmount > maxBet || gameState === 'spinning'}
                        className="w-full bg-red-900/60 hover:bg-red-800 text-red-100 border border-red-700 text-[9px] py-0 h-6 leading-none"
                    >
                        {gameState === 'spinning' ? '...' : 'KHAI HỎA'}
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default SoulFlameRouletteGame;
