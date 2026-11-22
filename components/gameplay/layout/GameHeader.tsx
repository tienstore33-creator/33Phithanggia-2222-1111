import React, { useState, useRef, useEffect } from 'react';
import { BookOpen, Tv, Volume2, VolumeX } from 'lucide-react';
import { GameScreen } from '../../../types';
import Button from '../../ui/Button';
import { VIETNAMESE } from '../../../constants';
import { useGame } from '../../../hooks/useGame';

interface GameHeaderProps {
  gameTitleDisplay: string;
}

const GameHeader: React.FC<GameHeaderProps> = ({ gameTitleDisplay }) => {
    const game = useGame();
    const { 
        apiKeyDisplay, setCurrentScreen, 
        isLoadingApi, isUploadingAvatar, isSavingGame, knowledgeBase, 
        onQuit, abortStream, onSaveGame, 
        isCharPanelOpen, setIsCharPanelOpen, 
        isQuestsPanelOpen, setIsQuestsPanelOpen, 
        isWorldPanelOpen, setIsWorldPanelOpen, 
        showDebugPanel, setShowDebugPanel, 
        setIsStyleSettingsModalOpen,
        setIsCompanionSelectionModalOpen, // NEW
        setIsJourneyLogOpen, // NEW
        uiState
    } = game;

    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isMusicPlaying, setIsMusicPlaying] = useState<boolean>(() => {
        return localStorage.getItem('music_enabled') !== 'false';
    });
    const [musicVolume, setMusicVolume] = useState<number>(() => {
        const savedVol = localStorage.getItem('music_volume');
        return savedVol !== null ? Number(savedVol) : 20; // Mức mặc định 20% (giảm 50% so với 40%)
    });
    const menuRef = useRef<HTMLDivElement>(null);
    const menuButtonClass = "w-full !justify-start";

    useEffect(() => {
        const handleMusicStateChanged = () => {
            setIsMusicPlaying(localStorage.getItem('music_enabled') !== 'false');
            const savedVol = localStorage.getItem('music_volume');
            setMusicVolume(savedVol !== null ? Number(savedVol) : 20);
        };
        window.addEventListener('storage', handleMusicStateChanged);
        window.addEventListener('music_state_changed', handleMusicStateChanged);
        window.addEventListener('music_volume_changed', handleMusicStateChanged);
        return () => {
            window.removeEventListener('storage', handleMusicStateChanged);
            window.removeEventListener('music_state_changed', handleMusicStateChanged);
            window.removeEventListener('music_volume_changed', handleMusicStateChanged);
        };
    }, []);

    const toggleMusic = () => {
        const newState = !isMusicPlaying;
        setIsMusicPlaying(newState);
        localStorage.setItem('music_enabled', newState.toString());
        window.dispatchEvent(new Event('music_state_changed'));
    };

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newVol = Number(e.target.value);
        setMusicVolume(newVol);
        localStorage.setItem('music_volume', newVol.toString());
        window.dispatchEvent(new Event('music_volume_changed'));
    };

    const isSummarizingUi = game.isSummarizingOnLoad;
    const isLoadingUi = isLoadingApi || isUploadingAvatar;
    const isPlayerRestricted = !!knowledgeBase.playerStats.playerSpecialStatus;
    const currentLocation = knowledgeBase.discoveredLocations.find(l => l.id === knowledgeBase.currentLocationId);
    const isLocationSafe = knowledgeBase.currentLocationSafetyOverride !== 'danger';
    const isSaveDisabled = isSavingGame || isLoadingUi || isSummarizingUi;

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsMenuOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [menuRef]);

    const handleMenuAction = (action: () => void) => {
        return () => {
            action();
            setIsMenuOpen(false);
        };
    };

  const timeOfDay = knowledgeBase?.worldDate?.timeOfDay || 'Sáng';

  let headerBgClass = "bg-gray-900 border-gray-800 shadow-md";
  if (timeOfDay === 'Sáng') {
      headerBgClass = "bg-gradient-to-r from-sky-400 via-blue-400 to-sky-500 border-sky-300/40 text-slate-900 shadow-[0_4px_20px_rgba(14,165,233,0.3)]";
  } else if (timeOfDay === 'Chiều') {
      headerBgClass = "bg-gradient-to-r from-orange-600 via-rose-500 to-amber-500 border-orange-400/40 text-white shadow-[0_4px_20px_rgba(244,63,94,0.3)]";
  } else if (timeOfDay === 'Đêm') {
      headerBgClass = "bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-900 border-indigo-950/40 text-white shadow-[0_4px_20px_rgba(99,102,241,0.2)]";
  }

  return (
    <header className={`relative w-full p-2 flex-shrink-0 mb-2 rounded-lg border transition-all duration-1000 ${headerBgClass}`}>
        {/* Style inline cho mây trôi vô tận */}
        <style>{`
            @keyframes headerCloudMove {
                0% { transform: translateX(0); }
                100% { transform: translateX(-33.33%); }
            }
            .animate-header-clouds {
                animation: headerCloudMove 90s linear infinite;
            }
        `}</style>

        {/* Background trời mây & lấp lánh có bo góc riêng để mây trôi không tràn ra ngoài */}
        <div className="absolute inset-0 rounded-lg overflow-hidden pointer-events-none z-0">
            {/* Lớp mây trắng lững lờ trôi */}
            <div className="absolute top-1/2 -translate-y-1/2 left-0 w-[300%] h-full opacity-20 flex gap-16 animate-header-clouds">
                <div className="flex gap-20 shrink-0 items-center">
                    {/* SVG Mây 1 */}
                    <svg className="w-16 h-8 text-white fill-current" viewBox="0 0 100 50">
                        <path d="M10 40a15 15 0 0 1 20-13 12 12 0 0 1 22-5 18 18 0 0 1 33 5 15 15 0 0 1 5 13z" />
                    </svg>
                    {/* SVG Mây 2 */}
                    <svg className="w-24 h-12 text-white fill-current opacity-90" viewBox="0 0 120 60">
                        <path d="M15 45a18 18 0 0 1 24-15 14 14 0 0 1 26-6 22 22 0 0 1 40 6 18 18 0 0 1 6 15z" />
                    </svg>
                </div>
                <div className="flex gap-20 shrink-0 items-center">
                    {/* Lặp lại để cuộn mượt */}
                    <svg className="w-16 h-8 text-white fill-current" viewBox="0 0 100 50">
                        <path d="M10 40a15 15 0 0 1 20-13 12 12 0 0 1 22-5 18 18 0 0 1 33 5 15 15 0 0 1 5 13z" />
                    </svg>
                    <svg className="w-24 h-12 text-white fill-current opacity-90" viewBox="0 0 120 60">
                        <path d="M15 45a18 18 0 0 1 24-15 14 14 0 0 1 26-6 22 22 0 0 1 40 6 18 18 0 0 1 6 15z" />
                    </svg>
                </div>
                <div className="flex gap-20 shrink-0 items-center">
                    {/* Lặp lại để cuộn mượt */}
                    <svg className="w-16 h-8 text-white fill-current" viewBox="0 0 100 50">
                        <path d="M10 40a15 15 0 0 1 20-13 12 12 0 0 1 22-5 18 18 0 0 1 33 5 15 15 0 0 1 5 13z" />
                    </svg>
                    <svg className="w-24 h-12 text-white fill-current opacity-90" viewBox="0 0 120 60">
                        <path d="M15 45a18 18 0 0 1 24-15 14 14 0 0 1 26-6 22 22 0 0 1 40 6 18 18 0 0 1 6 15z" />
                    </svg>
                </div>
            </div>

            {/* Các hạt sáng lấp lánh (Sparkle/Starry) */}
            <div className="absolute inset-0">
                <span className="absolute w-1.5 h-1.5 bg-white rounded-full animate-ping" style={{ top: '20%', left: '12%', animationDuration: '3s' }} />
                <span className="absolute w-1 h-1 bg-yellow-250 rounded-full animate-pulse shadow-[0_0_4px_#fef08a]" style={{ top: '70%', left: '22%', animationDuration: '2.2s' }} />
                <span className="absolute w-2 h-2 bg-white rounded-full animate-pulse opacity-80" style={{ top: '30%', left: '40%', animationDuration: '4.5s' }} />
                <span className="absolute w-1 h-1 bg-cyan-200 rounded-full animate-ping" style={{ top: '75%', left: '58%', animationDuration: '2.8s' }} />
                <span className="absolute w-1.5 h-1.5 bg-white rounded-full animate-pulse" style={{ top: '15%', left: '72%', animationDuration: '3.8s' }} />
                <span className="absolute w-1 h-1 bg-yellow-100 rounded-full animate-pulse shadow-[0_0_3px_#fef08a]" style={{ top: '60%', left: '84%', animationDuration: '1.9s' }} />
                <span className="absolute w-2 h-2 bg-white rounded-full animate-ping opacity-60" style={{ top: '40%', left: '94%', animationDuration: '5.2s' }} />
            </div>
        </div>

        {/* Toàn bộ nội dung header nổi trên nền mây trời */}
        <div className="relative z-10 w-full flex justify-between items-center">
            <div className="flex items-center gap-2 sm:gap-4">
                {/* Menu Button */}
                <div ref={menuRef} className="relative z-30">
                    <Button
                        onClick={() => setIsMenuOpen(prev => !prev)}
                        variant="secondary"
                        size="md"
                        className="p-3 bg-slate-950/45 hover:bg-slate-900/65 text-white border border-white/10 hover:border-white/20 backdrop-blur-xs transition-all duration-200"
                        title="Mở Menu Chức Năng"
                        aria-haspopup="true"
                        aria-expanded={isMenuOpen}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                    </Button>

                {isMenuOpen && (
                        <div className="absolute left-0 top-full mt-2 w-56 bg-gray-800 rounded-md shadow-lg border border-gray-600 max-h-96 overflow-y-auto custom-scrollbar">
                        <div className="p-2 flex flex-col space-y-1">
                            {/* API Key display for all screen sizes inside menu */}
                            {apiKeyDisplay && (
                                <div className="md:hidden px-2 py-1.5 mb-1 border-b border-gray-700 text-xs text-amber-300 flex items-center gap-1.5">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M18 8a6 6 0 01-7.743 5.743L10 14l-1 1-1 1H6v2H2v-4l4.257-4.257A6 6 0 1118 8zm-6-4a4 4 0 100 8 4 4 0 000-8z" clipRule="evenodd" />
                                    </svg>
                                    <span>{apiKeyDisplay}</span>
                                </div>
                            )}

                            <Button onClick={handleMenuAction(() => setIsCharPanelOpen(true))} variant="ghost" size="sm" aria-pressed={isCharPanelOpen} disabled={isSummarizingUi} className={`${menuButtonClass} ${isCharPanelOpen ? 'bg-indigo-600 text-white' : ''}`} title={VIETNAMESE.characterButton}>
                                {VIETNAMESE.characterButton}
                            </Button>
                            <Button onClick={handleMenuAction(() => game.setCurrentScreen(GameScreen.Equipment))} variant="ghost" size="sm" disabled={isSummarizingUi} className={menuButtonClass} title={VIETNAMESE.equipmentButton}>
                                {VIETNAMESE.equipmentButton}
                            </Button>
                             <Button onClick={handleMenuAction(() => setIsCompanionSelectionModalOpen(true))} variant="ghost" size="sm" disabled={isSummarizingUi || isPlayerRestricted} className={`${menuButtonClass} text-cyan-300`} title="Chọn đội hình chiến đấu">
                                Đội Hình
                            </Button>
                            <Button onClick={handleMenuAction(() => game.setCurrentScreen(GameScreen.CompanionManagement))} variant="ghost" size="sm" disabled={isSummarizingUi || isPlayerRestricted} className={menuButtonClass} title={VIETNAMESE.companionManagementButton}>
                                {VIETNAMESE.companionManagementButton}
                            </Button>
                            <Button onClick={handleMenuAction(() => game.setCurrentScreen(GameScreen.CompanionEquipment))} variant="ghost" size="sm" disabled={isSummarizingUi || isPlayerRestricted} className={menuButtonClass} title={"Trang Bị Hậu Cung"}>
                                Trang Bị Hậu Cung
                            </Button>
                            <Button onClick={handleMenuAction(() => game.setCurrentScreen(GameScreen.PrisonerManagement))} variant="ghost" size="sm" disabled={isSummarizingUi || isPlayerRestricted} className={menuButtonClass} title={VIETNAMESE.prisonerManagementButton}>
                                {VIETNAMESE.prisonerManagementButton}
                            </Button>
                            <Button onClick={handleMenuAction(() => game.setCurrentScreen(GameScreen.Map))} variant="ghost" size="sm" disabled={isSummarizingUi} className={menuButtonClass}>
                                {VIETNAMESE.mapButton}
                            </Button>
                            <Button onClick={handleMenuAction(() => game.setCurrentScreen(GameScreen.Crafting))} variant="ghost" size="sm" disabled={isSummarizingUi || isPlayerRestricted} className={menuButtonClass} title={VIETNAMESE.craftingButton}>
                                {VIETNAMESE.craftingButton}
                            </Button>
                            <Button onClick={handleMenuAction(() => game.setCurrentScreen(GameScreen.Cultivation))} variant="ghost" size="sm" disabled={isSummarizingUi || isLoadingUi || isPlayerRestricted} className={menuButtonClass} title={VIETNAMESE.cultivationButton}>
                                {VIETNAMESE.cultivationButton}
                            </Button>
                            <Button onClick={handleMenuAction(() => setIsWorldPanelOpen(true))} variant="ghost" size="sm" aria-pressed={isWorldPanelOpen} disabled={isSummarizingUi} className={`${menuButtonClass} ${isWorldPanelOpen ? 'bg-indigo-600 text-white' : ''}`}>
                                {VIETNAMESE.worldButton}
                            </Button>
                            <Button onClick={handleMenuAction(() => setIsQuestsPanelOpen(true))} variant="ghost" size="sm" aria-pressed={isQuestsPanelOpen} disabled={isSummarizingUi} className={`${menuButtonClass} ${isQuestsPanelOpen ? 'bg-indigo-600 text-white' : ''}`} title={VIETNAMESE.questsButton}>
                                {VIETNAMESE.questsButton}
                            </Button>
                            <Button onClick={handleMenuAction(() => game.setCurrentScreen(GameScreen.Prompts))} variant="ghost" size="sm" disabled={isSummarizingUi} className={menuButtonClass} title="Lời nhắc cho AI">
                                Lời Nhắc
                            </Button>
                            <Button onClick={handleMenuAction(() => game.setIsStyleSettingsModalOpen(true))} variant="ghost" size="sm" disabled={isSummarizingUi} className={menuButtonClass} title={VIETNAMESE.gameplaySettingsButton}>
                                {VIETNAMESE.gameplaySettingsButton}
                            </Button>

                            <div className="my-1 border-t border-gray-600"></div>

                            {isLoadingUi && (
                                <Button 
                                    onClick={handleMenuAction(abortStream)} 
                                    variant="ghost" 
                                    size="sm" 
                                    title="Dừng phản hồi từ AI" 
                                    className={`${menuButtonClass} text-red-400 animate-pulse font-bold hover:bg-red-900 hover:text-white transition-all duration-300`}
                                >
                                    🛑 DỪNG AI
                                </Button>
                            )}
                            <Button onClick={handleMenuAction(onSaveGame)} variant="ghost" size="sm" disabled={isSaveDisabled} isLoading={isSavingGame} loadingText="Đang lưu..." title={VIETNAMESE.saveGameButton} className={menuButtonClass}>
                                {VIETNAMESE.saveGameButtonShort || VIETNAMESE.saveGameButton}
                            </Button>
                            <Button onClick={handleMenuAction(game.onDownloadSaveFile)} variant="ghost" size="sm" disabled={isSaveDisabled} title="Tải file lưu về máy (.sav.gz)" className={menuButtonClass}>
                                Tải File Lưu
                            </Button>
                            {uiState.isDevMode && (
                                <Button onClick={handleMenuAction(() => setShowDebugPanel(!showDebugPanel))} variant="ghost" size="sm" className={`${menuButtonClass} text-yellow-300 hover:bg-yellow-700 hover:text-white`}>
                                    Debug Panel
                                </Button>
                            )}
                            <Button onClick={handleMenuAction(onQuit)} variant="ghost" size="sm" disabled={isSummarizingUi} className={`${menuButtonClass} text-red-400 hover:bg-red-700 hover:text-white`}>
                                {VIETNAMESE.quitGameButtonShort || VIETNAMESE.quitGameButton}
                            </Button>
                        </div>
                    </div>
                )}
            </div>
            
            {/* Dev Mode Badge */}
            {uiState.isDevMode && (
                <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 bg-indigo-900/40 border border-indigo-500/50 rounded-md animate-pulse">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.8)]" />
                    <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest">Dev Mode: ON</span>
                </div>
            )}

            {/* Journey Log Button in Header - Styled as a white box next to Menu */}
            <Button 
                onClick={() => setIsJourneyLogOpen(true)} 
                variant="secondary" 
                size="md" 
                className="flex items-center gap-2 px-3 py-2 bg-white hover:bg-gray-100 text-gray-900 border-none rounded-md shadow-sm transition-all duration-200" 
                title="Nhật ký hành trình"
            >
                <BookOpen size={18} className="text-indigo-600" />
                <span className="hidden sm:inline font-bold text-xs uppercase tracking-wider">Nhật ký</span>
            </Button>

            {/* Quick Screen Stretch Mode Switcher */}
            <Button 
                onClick={() => {
                    const currentMode = game.styleSettings.screenStretchMode || 'none';
                    let nextMode: 'none' | 'stretch' | 'fit-uniform' = 'none';
                    if (currentMode === 'none') nextMode = 'stretch';
                    else if (currentMode === 'stretch') nextMode = 'fit-uniform';
                    else nextMode = 'none';
                    
                    game.setStyleSettings({
                        ...game.styleSettings,
                        screenStretchMode: nextMode
                    });
                    
                    let msg = "";
                    if (nextMode === 'none') msg = "Chế độ: Giao diện thích ứng tự do (Responsive)";
                    else if (nextMode === 'stretch') msg = "Chế độ: Co giãn khít màn hình (Retro Stretch 📺) - Đã sửa lỗi che khuất nút!";
                    else if (nextMode === 'fit-uniform') msg = "Chế độ: Giữ tỉ lệ khít màn hình (Fit Uniform ⭐)";
                    
                    game.showNotification(msg, 'success');
                }} 
                variant="secondary" 
                size="md" 
                className={`flex items-center gap-2 px-3 py-1.5 border rounded-md shadow-sm transition-all duration-200
                            ${(game.styleSettings.screenStretchMode && game.styleSettings.screenStretchMode !== 'none') 
                              ? 'bg-amber-600/30 hover:bg-amber-600/40 border-amber-500/80 text-amber-300' 
                              : 'bg-gray-800 hover:bg-gray-700/80 border-gray-700 text-gray-300'}`} 
                title="Sửa lỗi che khuất nút / Co dãn màn hình"
            >
                <Tv size={16} className={game.styleSettings.screenStretchMode && game.styleSettings.screenStretchMode !== 'none' ? 'text-amber-400' : ''} />
                <span className="hidden sm:inline font-bold text-[11px] uppercase tracking-wider">
                    {game.styleSettings.screenStretchMode === 'stretch' ? "📺 Co Giãn" : 
                     game.styleSettings.screenStretchMode === 'fit-uniform' ? "⭐️ Tỉ Lệ" : "📱 Tự Do"}
                </span>
            </Button>

            {/* Music Toggle Button (■) / (▶) & Volume Slider */}
            <div className="flex items-center gap-1.5 bg-slate-900/80 p-1 rounded-md border border-slate-700/80 shadow-sm">
                <Button
                    onClick={toggleMusic}
                    variant="secondary"
                    size="md"
                    className={`p-1 h-7 w-7 flex items-center justify-center rounded border text-xs font-extrabold transition-all duration-200 ${
                        isMusicPlaying
                            ? 'bg-amber-500/30 border-amber-400 text-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.4)]'
                            : 'bg-slate-800 border-slate-700 text-gray-400'
                    }`}
                    title={isMusicPlaying ? 'Tắt nhạc nền' : 'Bật nhạc nền'}
                >
                    {isMusicPlaying ? '■' : '▶'}
                </Button>

                <div className="flex items-center gap-1 px-1" title={`Âm lượng nhạc nền: ${musicVolume}%`}>
                    {musicVolume === 0 || !isMusicPlaying ? (
                        <VolumeX size={14} className="text-gray-500 flex-shrink-0" />
                    ) : (
                        <Volume2 size={14} className="text-amber-400 flex-shrink-0" />
                    )}
                    <input
                        type="range"
                        min="0"
                        max="100"
                        value={musicVolume}
                        onChange={handleVolumeChange}
                        className="w-14 sm:w-16 h-1.5 accent-amber-400 bg-gray-700 rounded-lg cursor-pointer"
                    />
                    <span className="hidden sm:inline-block text-[10px] font-mono font-semibold text-amber-300 min-w-[24px]">
                        {musicVolume}%
                    </span>
                </div>
            </div>
            
            {/* Location Display */}
            {currentLocation && (
                <div className="hidden lg:flex flex-col justify-center border-l border-gray-700 pl-4 ml-2">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider">{VIETNAMESE.legendCurrentLocation}:</span>
                        <span className="text-sm font-medium text-white truncate max-w-[200px]">{currentLocation.name}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                        <div className={`w-2 h-2 rounded-full ${isLocationSafe ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]'}`} />
                        <span className={`text-[10px] font-bold uppercase tracking-widest ${isLocationSafe ? 'text-green-400' : 'text-red-400'}`}>
                            {isLocationSafe ? VIETNAMESE.safetyStatusSafe : VIETNAMESE.safetyStatusDanger}
                        </span>
                        {knowledgeBase.currentLocationSafetyOverride && (
                            <span className="text-[9px] text-indigo-400 font-medium italic opacity-80">{VIETNAMESE.aiVerified}</span>
                        )}
                    </div>
                </div>
            )}

            {/* Universe ID Display */}
            {knowledgeBase?.universeId && (
                <div className="hidden sm:flex flex-col justify-center border-l border-gray-700/80 pl-3 ml-2" title="Định danh Vũ trụ & Sacred Timeline">
                    <span className="text-[10px] font-bold text-cyan-300 uppercase tracking-widest flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
                        Vũ Trụ
                    </span>
                    <span className="text-xs font-extrabold text-amber-300 font-mono tracking-wider">
                        {knowledgeBase.universeId}
                    </span>
                </div>
            )}

            {/* API Key Display for Medium screens and up */}
            {apiKeyDisplay && (
                <div
                    className="hidden md:flex justify-center items-center gap-1.5 text-xs text-amber-300 bg-black/30 px-2 py-1 rounded-md border border-amber-700/50"
                    title={apiKeyDisplay}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M18 8a6 6 0 01-7.743 5.743L10 14l-1 1-1 1H6v2H2v-4l4.257-4.257A6 6 0 1118 8zm-6-4a4 4 0 100 8 4 4 0 000-8z" clipRule="evenodd" />
                    </svg>
                    <span>{apiKeyDisplay}</span>
                </div>
            )}
        </div>
    </div>
        
        <h1
            className="text-sm sm:text-base font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 via-cyan-500 to-blue-600 truncate max-w-[150px] sm:max-w-xs text-right absolute top-1/2 right-4 -translate-y-1/2 drop-shadow-[0_1.5px_2px_rgba(0,0,0,0.8)]"
            title={gameTitleDisplay}
        >
            {gameTitleDisplay}
        </h1>
    </header>
  );
};

export default GameHeader;
