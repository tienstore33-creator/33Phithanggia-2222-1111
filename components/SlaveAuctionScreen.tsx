import React, { useState, useEffect, useRef, useMemo } from 'react';
import { KnowledgeBase, AuctionSlave, PlayerStats, Slave, Item } from './../types';
import Button from './ui/Button';
import InputField from './ui/InputField';
import Spinner from './ui/Spinner';
import { VIETNAMESE } from './../constants';
import Modal from './ui/Modal';
import { useGame } from '../hooks/useGame';
import { getDeterministicAvatarSrc } from '../utils/avatarUtils';
import { calculateSlaveValue } from '../utils/gameLogicUtils';


interface SlaveAuctionScreenProps {
  knowledgeBase: KnowledgeBase;
  onPlaceBid: (slaveId: string, bidAmount: number) => void;
  onAuctioneerCall: () => void;
  onSkipItem: () => void;
  onLeave: () => void;
  isLoading: boolean;
  sentEconomyPromptsLog: string[];
  receivedEconomyResponsesLog: string[];
}

const DebugModal: React.FC<{ prompts: string[]; responses: string[]; onClose: () => void; }> = ({ prompts, responses, onClose }) => {
    return (
      <Modal isOpen={true} onClose={onClose} title="Nhật Ký Gỡ Lỗi Đấu Giá Nô Lệ">
        <div className="space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
          {/* Prompt and Response logs would go here, same as in AuctionScreen */}
        </div>
      </Modal>
    );
};

const SlaveAuctionScreen: React.FC<SlaveAuctionScreenProps> = ({
  knowledgeBase,
  onPlaceBid,
  onAuctioneerCall,
  onSkipItem,
  onLeave,
  isLoading,
  sentEconomyPromptsLog,
  receivedEconomyResponsesLog
}) => {
  const game = useGame();
  const { slaveAuctionState, playerStats, inventory } = knowledgeBase;
  const [isAuctionStarted, setIsAuctionStarted] = useState(false);
  const [playerSlavesForAuction, setPlayerSlavesForAuction] = useState<Set<string>>(new Set());
  const [mobileTab, setMobileTab] = useState<'bidding' | 'log'>('bidding');
  const [showTools, setShowTools] = useState(false);
  const [bidAmount, setBidAmount] = useState<string>('');
  const [countdown, setCountdown] = useState(8);
  const [showDebug, setShowDebug] = useState(false);
  const [proxyLimit, setProxyLimit] = useState(0);

  const commentaryEndRef = useRef<HTMLDivElement>(null);
  const auctioneerCallTimerRef = useRef<number | null>(null);
  const countdownIntervalRef = useRef<number | null>(null);

  const currentItem = slaveAuctionState?.items[slaveAuctionState.currentItemIndex];

  useEffect(() => {
    if (currentItem) {
      setProxyLimit(currentItem.playerMaxBidLimit || 0);
    }
  }, [currentItem?.id, currentItem?.playerMaxBidLimit]);
  
  const eligibleSlavesForPlayerAuction = useMemo(() => {
    return knowledgeBase.slaves;
  }, [knowledgeBase.slaves]);

  const handleToggleAuctionSlave = (slaveId: string) => {
      setPlayerSlavesForAuction(prev => {
          const newSet = new Set(prev);
          if (newSet.has(slaveId)) {
              newSet.delete(slaveId);
          } else {
              newSet.add(slaveId);
          }
          return newSet;
      });
  };

  const handleStartAuctionWithPlayerSlaves = () => {
      if (!slaveAuctionState) return;
      game.handleStartSlaveAuction(slaveAuctionState.locationId, Array.from(playerSlavesForAuction));
      setIsAuctionStarted(true);
  };

  useEffect(() => {
    if (!isAuctionStarted || !slaveAuctionState?.isOpen || !currentItem || isLoading) {
      if (auctioneerCallTimerRef.current) clearTimeout(auctioneerCallTimerRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      return;
    }
    auctioneerCallTimerRef.current = window.setTimeout(() => { onAuctioneerCall(); }, 8000);
    setCountdown(8);
    countdownIntervalRef.current = window.setInterval(() => { setCountdown(prev => Math.max(0, prev - 1)); }, 1000);
    return () => {
      if (auctioneerCallTimerRef.current) clearTimeout(auctioneerCallTimerRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, [slaveAuctionState?.currentItemIndex, slaveAuctionState?.lastBidTime, slaveAuctionState?.isOpen, isLoading, onAuctioneerCall, currentItem, isAuctionStarted]);

  useEffect(() => {
    commentaryEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [slaveAuctionState?.auctioneerCommentary]);


  const handleBidSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentItem && bidAmount) {
      const amount = parseInt(bidAmount, 10);
      if (!isNaN(amount) && amount > currentItem.currentBid && amount <= playerStats.currency) {
        onPlaceBid(currentItem.id, amount);
        setBidAmount('');
      } else if (amount <= currentItem.currentBid) {
          game.showNotification("Giá đặt phải cao hơn giá hiện tại!", 'error');
      } else {
          game.showNotification(VIETNAMESE.notEnoughMoney, 'error');
      }
    }
  };

  const getBidderName = (bidderId?: string) => {
    if (!bidderId) return 'Chưa có';
    if (bidderId === 'player') return 'Bạn';
    const npc = slaveAuctionState?.auctionNPCs?.find(n => n.id === bidderId);
    return npc?.name || 'Người mua bí ẩn';
  };
  
  const currencyName = knowledgeBase.worldConfig?.currencyName || "Tiền";
  
  if (!slaveAuctionState || (!isAuctionStarted && (!slaveAuctionState.items || slaveAuctionState.items.length === 0) && eligibleSlavesForPlayerAuction.length === 0)) {
    return (
        <div className="min-h-screen w-full bg-gray-900 flex flex-col items-center justify-center p-4">
            <h2 className="text-2xl font-bold text-gray-400 mb-4">Không có nô lệ nào để đấu giá.</h2>
            <Button onClick={onLeave}>{VIETNAMESE.returnToGame || "Quay Lại Cuộc Phiêu Lưu"}</Button>
        </div>
    );
  }

  if (!isAuctionStarted) {
    return (
        <div className="min-h-screen flex flex-col bg-gray-800 p-3 sm:p-4 text-gray-100">
            <header className="mb-3 flex justify-between items-center flex-shrink-0">
                <h1 className="text-xl sm:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-orange-500 to-red-600 truncate">
                    Sảnh Đấu Giá Nô Lệ
                </h1>
                 <Button variant="danger" size="sm" onClick={onLeave}>
                      {VIETNAMESE.leaveButton || "Rời Đi"}
                  </Button>
            </header>
            <div className="flex-grow bg-gray-900 p-3 sm:p-4 rounded-lg shadow-xl border border-gray-700 overflow-y-auto custom-scrollbar space-y-4 max-h-[calc(100vh-140px)]">
                
                <div>
                    <h2 className="text-lg sm:text-xl font-semibold text-amber-300 mb-2">Nô Lệ Sắp Đấu Giá (Từ Nhà Đấu Giá)</h2>
                    <div className="space-y-2">
                        {slaveAuctionState.items.length > 0 ? slaveAuctionState.items.map(slave => (
                            <div key={slave.id} className="p-2.5 bg-gray-800 rounded-md hover:bg-gray-700/50 cursor-pointer" onClick={() => game.openEntityModal('slave', slave)}>
                                <div className="flex justify-between items-center">
                                    <span className="font-semibold text-indigo-300 text-sm">{slave.name}</span>
                                    <span className="text-xs text-gray-400">{slave.realm}</span>
                                </div>
                                <p className="text-xs text-amber-400 mt-1">Giá khởi điểm: {slave.startingPrice.toLocaleString()} {currencyName}</p>
                            </div>
                        )) : <p className="text-gray-400 italic text-sm">Nhà đấu giá chưa chuẩn bị nô lệ nào.</p>}
                    </div>
                </div>

                 <div className="border-t border-gray-700 pt-4">
                    <h2 className="text-lg sm:text-xl font-semibold text-green-300 mb-2">Ký Gửi Nô Lệ Của Bạn</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                            <h3 className="text-sm font-medium text-gray-300 mb-1.5">Nô lệ của bạn</h3>
                            <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar bg-gray-800/50 p-2 rounded-md">
                                {eligibleSlavesForPlayerAuction.length > 0 ? eligibleSlavesForPlayerAuction.map(slave => (
                                    <div key={slave.id} className="flex items-center justify-between p-2 bg-gray-700 rounded-md text-xs">
                                        <div onClick={() => game.openEntityModal('slave', slave)} className="cursor-pointer min-w-0 flex-1 pr-2">
                                            <p className="font-medium text-gray-200 truncate">{slave.name}</p>
                                            <p className="text-[10px] text-gray-400 truncate">{slave.realm} - Tư chất: {slave.tuChat}</p>
                                        </div>
                                        <Button size="sm" variant="secondary" onClick={() => handleToggleAuctionSlave(slave.id)} className="text-xs px-2 py-0.5 shrink-0">
                                            {playerSlavesForAuction.has(slave.id) ? 'Bỏ' : 'Chọn'}
                                        </Button>
                                    </div>
                                )) : <p className="text-gray-400 italic text-xs p-2">Bạn không có nô lệ nào.</p>}
                            </div>
                        </div>

                        <div>
                             <h3 className="text-sm font-medium text-gray-300 mb-1.5">Đã chọn đấu giá</h3>
                             <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar bg-gray-800/50 p-2 rounded-md">
                                {Array.from(playerSlavesForAuction).map(slaveId => {
                                    const slave = knowledgeBase.slaves?.find(s => s.id === slaveId);
                                    if (!slave) return null;
                                    const slaveRaceSystem = knowledgeBase.worldConfig?.raceCultivationSystems?.find(rs => rs.raceName === slave.race)?.realmSystem || (knowledgeBase.realmProgressionList || []).join(' - ');
                                    const slaveRealmProgression = slaveRaceSystem.split(' - ').map(s => s.trim());
                                    const estimatedValue = calculateSlaveValue(slave, slaveRealmProgression);
                                    return (
                                        <div key={slave.id} className="p-2 bg-green-900/30 rounded-md text-xs">
                                            <p className="font-medium text-green-300">{slave.name}</p>
                                            <p className="text-[10px] text-gray-400">Giá khởi điểm (ước tính): ~{(estimatedValue * 0.5).toLocaleString()} {currencyName}</p>
                                        </div>
                                    )
                                })}
                                {playerSlavesForAuction.size === 0 && <p className="text-gray-400 italic text-xs p-2">Chưa chọn nô lệ nào.</p>}
                             </div>
                        </div>
                    </div>
                </div>

            </div>
            <div className="mt-3 mb-2 flex-shrink-0 flex justify-center">
                <Button 
                    variant="primary" 
                    size="lg" 
                    className="w-full max-w-xs sm:max-w-md font-bold shadow-lg py-2.5 tracking-wide text-sm" 
                    onClick={handleStartAuctionWithPlayerSlaves}
                >
                    Bắt Đầu Đấu Giá
                </Button>
            </div>
        </div>
    );
  }
  
  if (!slaveAuctionState.isOpen || !currentItem) {
    return (
        <div className="min-h-screen w-full bg-gray-900 flex flex-col items-center justify-center p-4">
            <h2 className="text-2xl font-bold text-gray-400 mb-4">{VIETNAMESE.auctionEnded}</h2>
            <p className="text-gray-500 mb-6">Phiên đấu giá đã kết thúc hoặc không có nô lệ nào.</p>
            <Button onClick={onLeave}>{VIETNAMESE.returnToGame}</Button>
        </div>
    );
  }

  const callText =
    slaveAuctionState.auctioneerCallCount === 1 ? 'LẦN THỨ NHẤT!' :
    slaveAuctionState.auctioneerCallCount === 2 ? 'LẦN THỨ HAI!' :
    slaveAuctionState.auctioneerCallCount === 3 ? 'LẦN CUỐI CÙNG!' : '';

  const latestCommentary = slaveAuctionState.auctioneerCommentary.length > 0 
    ? slaveAuctionState.auctioneerCommentary[slaveAuctionState.auctioneerCommentary.length - 1].text 
    : 'Chưa có diễn biến...';

  return (
    <>
    <div className="min-h-screen w-full bg-gray-900 flex flex-col p-2 sm:p-4 text-gray-100 font-sans">
      <header className="mb-2 flex justify-between items-center flex-shrink-0">
        <h1 className="text-lg sm:text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-orange-500 to-red-600 truncate max-w-[65%]">
          {VIETNAMESE.slaveAuctionTitle} ({slaveAuctionState.currentItemIndex + 1}/{slaveAuctionState.items.length})
        </h1>
        <div className="flex items-center gap-1.5 shrink-0">
            <Button variant="ghost" size="sm" onClick={() => setShowDebug(true)} className="border-yellow-500 text-yellow-300 hover:bg-yellow-700 hover:text-white text-xs px-2 py-1">Debug</Button>
            <Button variant="danger" size="sm" onClick={onLeave} disabled={isLoading} className="text-xs px-2 py-1">{VIETNAMESE.leaveButton}</Button>
        </div>
      </header>

      {/* Mobile Tab Switcher */}
      <div className="flex md:hidden bg-gray-800/90 rounded-lg p-1 border border-gray-700 mb-2 gap-1 shrink-0">
        <button
          type="button"
          onClick={() => setMobileTab('bidding')}
          className={`flex-1 py-1.5 px-2 rounded text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
            mobileTab === 'bidding'
              ? 'bg-amber-600 text-white shadow'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          <span>🏷️ Đặt Thầu</span>
          <span className="bg-amber-950/80 text-amber-300 text-[10px] px-1.5 py-0.5 rounded-full font-mono">
            {currentItem.currentBid.toLocaleString()}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setMobileTab('log')}
          className={`flex-1 py-1.5 px-2 rounded text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
            mobileTab === 'log'
              ? 'bg-cyan-700 text-white shadow'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          <span>📜 Diễn Biến</span>
          <span className="bg-cyan-950/80 text-cyan-300 text-[10px] px-1.5 py-0.5 rounded-full font-mono">
            {slaveAuctionState.auctioneerCommentary.length}
          </span>
        </button>
      </div>

      <div className="flex-grow flex flex-col md:flex-row gap-3 md:gap-4 md:h-[calc(100vh-120px)] h-[calc(100vh-115px)] overflow-hidden">
        {/* Left Panel: Auction Log */}
        <div className={`flex flex-col bg-gray-800 rounded-lg border border-gray-700 overflow-hidden ${
          mobileTab === 'log' ? 'flex-grow h-full' : 'hidden md:flex md:w-3/5 lg:w-2/3 md:h-full'
        }`}>
            <div className="p-2.5 sm:p-3 border-b border-gray-600 flex justify-between items-center flex-shrink-0">
              <h2 className="text-lg sm:text-xl font-semibold text-cyan-300 font-sans">Diễn biến đấu giá</h2>
              <span className="text-xs text-cyan-400 font-mono bg-cyan-950 px-2 py-0.5 rounded-full border border-cyan-800">
                {slaveAuctionState.auctioneerCommentary.length} tin
              </span>
            </div>
            <div className="flex-grow overflow-y-auto custom-scrollbar p-3 space-y-3">
                {slaveAuctionState.auctioneerCommentary.map(entry => (
                    <div key={entry.id} className="text-sm text-cyan-200/90 italic border-l-2 border-cyan-700 pl-2">{entry.text}</div>
                ))}
                {isLoading && <div className="flex justify-center pt-4"><Spinner text={"Đang chờ diễn biến..."} /></div>}
                <div ref={commentaryEndRef} />
            </div>
        </div>

        {/* Right Panel: Slave Details & Bidding */}
        <div className={`flex flex-col bg-gray-800 rounded-lg border-2 border-amber-500 shadow-xl p-3 sm:p-4 overflow-hidden ${
          mobileTab === 'bidding' ? 'flex-grow h-full' : 'hidden md:flex md:w-2/5 lg:w-1/3 md:h-full'
        }`}>
            {/* Live Commentary Ticker on Mobile Bidding Tab */}
            {slaveAuctionState.auctioneerCommentary.length > 0 && (
              <div 
                className="md:hidden flex items-center justify-between gap-2 bg-cyan-950/80 border border-cyan-700/60 rounded px-2.5 py-1.5 mb-2 text-xs text-cyan-200 cursor-pointer hover:bg-cyan-900/80 shrink-0"
                onClick={() => setMobileTab('log')}
              >
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <span className="shrink-0 text-cyan-400">📜</span>
                  <span className="truncate italic font-sans">{latestCommentary}</span>
                </div>
                <span className="shrink-0 text-[10px] text-cyan-300 bg-cyan-900 px-1.5 py-0.5 rounded font-medium">Xem log &raquo;</span>
              </div>
            )}

            {/* Slave Header */}
            <div 
                className="flex-shrink-0 pb-2 border-b border-gray-600 flex items-center gap-3 cursor-pointer hover:bg-gray-700/50 rounded-md p-1 -m-1"
                onClick={() => game.openEntityModal('slave', currentItem)}
                title={`Xem chi tiết ${currentItem.name}`}
            >
                <img src={getDeterministicAvatarSrc(currentItem)} alt={currentItem.name} className="w-12 h-12 sm:w-16 sm:h-16 rounded-full object-cover border-2 border-indigo-400 shrink-0"/>
                <div className="min-w-0 flex-1">
                    <h2 className="text-base sm:text-xl font-bold text-amber-300 truncate">{currentItem.name}</h2>
                    <p className="text-xs text-gray-400 italic truncate">{currentItem.realm} - {currentItem.race}</p>
                </div>
            </div>
            
            {/* Scrollable Center */}
            <div className="my-2 flex-grow overflow-y-auto custom-scrollbar pr-1 space-y-2.5">
                <p className="text-xs sm:text-sm text-gray-200 leading-relaxed line-clamp-2 sm:line-clamp-none">{currentItem.description}</p>
                <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs border-b border-gray-700/50 pb-2">
                    <p><strong className="text-gray-400">Tư chất:</strong> {currentItem.tuChat}</p>
                    <p><strong className="text-gray-400">Linh căn:</strong> {currentItem.spiritualRoot || 'Không rõ'}</p>
                </div>

                {/* Collapsible Tools Header */}
                <div className="bg-gray-900/80 rounded-lg border border-purple-800/60 overflow-hidden">
                    <button 
                      type="button"
                      onClick={() => setShowTools(prev => !prev)}
                      className="w-full p-2 text-xs font-semibold text-purple-300 flex justify-between items-center hover:bg-purple-950/40 transition-colors"
                    >
                      <span className="flex items-center gap-1.5">
                        <span>🛠️ Mưu Mẹo & Uỷ Thác</span>
                        {currentItem.playerMaxBidLimit && currentItem.playerMaxBidLimit > 0 ? (
                          <span className="bg-green-950 text-green-400 text-[10px] px-1.5 py-0.2 rounded border border-green-800 font-mono">
                            Đang uỷ thác
                          </span>
                        ) : null}
                      </span>
                      <span className="text-[10px] text-gray-400 font-normal">
                        {showTools ? '▲ Thu gọn' : '▼ Mở rộng'}
                      </span>
                    </button>

                    {showTools && (
                      <div className="p-2.5 border-t border-purple-900/50 space-y-2.5 bg-gray-950/60">
                        {/* 🤖 Proxy Bidding Input */}
                        <div className="space-y-1">
                            <div className="flex justify-between items-center">
                                <label className="text-xs font-semibold text-cyan-300">🤖 Uỷ Thác Ra Giá Tự Động</label>
                                <span className="text-[10px] text-gray-400 font-mono">+5%/lượt NPC</span>
                            </div>
                            <div className="flex gap-1.5">
                                <input 
                                    type="number"
                                    value={proxyLimit || ''}
                                    onChange={(e) => setProxyLimit(parseInt(e.target.value, 10) || 0)}
                                    placeholder="Giá tối đa..."
                                    className="flex-grow bg-gray-900 border border-cyan-800 rounded px-2 py-1 text-xs text-cyan-100 focus:outline-none focus:border-cyan-500"
                                    min={currentItem.currentBid + 1}
                                />
                                <Button 
                                    onClick={() => { if (game.handleSetPlayerMaxBidSlave) game.handleSetPlayerMaxBidSlave(proxyLimit); }} 
                                    size="sm" 
                                    className="bg-cyan-700 hover:bg-cyan-600 text-xs px-2.5 py-1 shrink-0"
                                >
                                    Cài Đặt
                                </Button>
                            </div>
                            {currentItem.playerMaxBidLimit && currentItem.playerMaxBidLimit > 0 ? (
                                <p className="text-[10px] text-green-400">✓ Giới hạn: <strong className="font-mono">{currentItem.playerMaxBidLimit.toLocaleString()}</strong> LNT</p>
                            ) : null}
                        </div>

                        {/* 🔮 Mưu Mẹo Đấu Giá */}
                        <div className="space-y-1.5 pt-1.5 border-t border-gray-800">
                            <label className="text-xs font-semibold text-purple-300 block">🔮 Mưu Mẹo Trấn Áp</label>
                            <div className="grid grid-cols-2 gap-1.5">
                                <Button 
                                    size="sm" 
                                    variant="secondary"
                                    onClick={() => game.handleInfluenceBaitRatioSlave?.('rumor')}
                                    className="text-[11px] bg-purple-950/60 hover:bg-purple-900/80 border border-purple-700 text-purple-300 py-1.5 h-auto flex flex-col items-center leading-tight"
                                >
                                    <span className="font-semibold">📣 Phao Tin Nô Lệ</span>
                                    <span className="text-[8px] text-purple-400">Tăng thầu NPC</span>
                                </Button>
                                <Button 
                                    size="sm" 
                                    variant="secondary"
                                    onClick={() => game.handleInfluenceBaitRatioSlave?.('trap')}
                                    className="text-[11px] bg-indigo-950/60 hover:bg-indigo-900/80 border border-indigo-700 text-indigo-300 py-1.5 h-auto flex flex-col items-center leading-tight"
                                >
                                    <span className="font-semibold">⚠️ Gài Tì Vết Giả</span>
                                    <span className="text-[8px] text-indigo-400">Hạ thầu NPC</span>
                                </Button>
                            </div>
                        </div>
                      </div>
                    )}
                </div>
            </div>

            {/* Pinned Bottom */}
            <div className="flex-shrink-0 pt-2 border-t border-gray-600 space-y-2">
                <div className="text-xs grid grid-cols-3 gap-1 bg-gray-900/80 p-2 rounded border border-gray-700/80 text-center">
                    <div>
                        <div className="text-[10px] text-gray-400">Khởi điểm</div>
                        <div className="font-semibold text-gray-200 truncate">{currentItem.startingPrice.toLocaleString()}</div>
                    </div>
                    <div>
                        <div className="text-[10px] text-amber-400 font-bold">Hiện tại</div>
                        <div className="font-bold text-sm text-amber-300 truncate">{currentItem.currentBid.toLocaleString()}</div>
                    </div>
                    <div>
                        <div className="text-[10px] text-gray-400">Thắng thầu</div>
                        <div className="font-semibold text-indigo-300 truncate">{getBidderName(currentItem.highestBidderId)}</div>
                    </div>
                </div>

                <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] text-gray-300">
                      <span>Của bạn: <strong className="text-amber-400">{playerStats.currency.toLocaleString()}</strong></span>
                      <div className="flex gap-1">
                        <button 
                          type="button" 
                          onClick={() => setBidAmount(String(Math.ceil(currentItem.currentBid * 1.05)))}
                          className="px-1.5 py-0.5 bg-amber-950/80 hover:bg-amber-800 text-amber-300 border border-amber-700 rounded text-[10px] font-mono"
                        >
                          +5%
                        </button>
                        <button 
                          type="button" 
                          onClick={() => setBidAmount(String(Math.ceil(currentItem.currentBid * 1.10)))}
                          className="px-1.5 py-0.5 bg-amber-950/80 hover:bg-amber-800 text-amber-300 border border-amber-700 rounded text-[10px] font-mono"
                        >
                          +10%
                        </button>
                        <button 
                          type="button" 
                          onClick={() => setBidAmount(String(Math.ceil(currentItem.currentBid * 1.20)))}
                          className="px-1.5 py-0.5 bg-amber-950/80 hover:bg-amber-800 text-amber-300 border border-amber-700 rounded text-[10px] font-mono"
                        >
                          +20%
                        </button>
                      </div>
                    </div>

                    <form onSubmit={handleBidSubmit} className="space-y-1.5">
                        <div className="flex gap-1.5">
                            <input 
                              type="number" 
                              value={bidAmount} 
                              onChange={(e) => setBidAmount(e.target.value)} 
                              placeholder={`> ${currentItem.currentBid.toLocaleString()}`} 
                              min={currentItem.currentBid + 1} 
                              disabled={isLoading} 
                              className="flex-grow bg-gray-950 border border-gray-700 rounded px-2.5 py-1 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-amber-500"
                            />
                            <Button type="submit" size="sm" variant="primary" className="px-3 sm:px-4 font-bold shrink-0 text-xs sm:text-sm" disabled={isLoading || !bidAmount}>
                                {VIETNAMESE.placeBidButton || "Ra Giá"}
                            </Button>
                        </div>
                    </form>

                    <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                        <Button onClick={onAuctioneerCall} size="sm" variant="secondary" className="text-xs py-1.5" disabled={isLoading}>
                            Bỏ qua chờ
                        </Button>
                        <Button onClick={onSkipItem} size="sm" variant="secondary" className="text-xs py-1.5" disabled={isLoading}>
                            Bỏ qua
                        </Button>
                    </div>
                </div>

                <div className="flex items-center justify-between bg-gray-950 px-2.5 py-1.5 rounded-lg border border-red-500/40">
                    <span className="text-xs text-red-300 font-medium">Hô giá sau:</span>
                    <div className="flex items-center gap-2">
                        {callText && <span className="text-xs font-bold text-yellow-300 animate-pulse">{callText}</span>}
                        <span className="text-base font-bold text-red-400 tabular-nums">{countdown}s</span>
                    </div>
                </div>
            </div>
        </div>
      </div>
    </div>
    {showDebug && (
        <DebugModal 
            prompts={sentEconomyPromptsLog} 
            responses={receivedEconomyResponsesLog} 
            onClose={() => setShowDebug(false)}
        />
    )}
    </>
  );
};

export default SlaveAuctionScreen;