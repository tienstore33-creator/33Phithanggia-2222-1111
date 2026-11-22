
import React, { useRef, useEffect, useState } from 'react';
import { GameProvider } from './contexts/GameContext';
import { useGame } from './hooks/useGame';
import { useCultivation } from './hooks/useCultivation';
import AppRouter from './components/AppRouter';
import Spinner from './components/ui/Spinner';
import { VIETNAMESE, AVAILABLE_MODELS } from './constants';
import { GameScreen } from './types';
import { getCurrentlyUsedKeyDisplay, rotationIndices } from './services/geminiService';
import { useDevMode } from './hooks/useDevMode';
import DevInterface from './components/DevInterface';

// New imports for modals
import EntityDetailModal from './components/gameplay/modals/EntityDetailModal';
import MarketplaceModal from './components/gameplay/economy/MarketplaceModal';
import ShoppingCenterModal from './components/gameplay/economy/ShoppingCenterModal';
import StyleSettingsModal from './components/StyleSettingsModal';
import SlaveMarketModal from './components/gameplay/economy/SlaveMarketModal'; // NEW IMPORT
import JourneyLogModal from './components/gameplay/modals/JourneyLogModal'; // NEW IMPORT
import CompanionSelectionForCombatModal from './components/gameplay/modals/CompanionSelectionForCombatModal'; // NEW IMPORT
import ChallengeModal from './components/gameplay/modals/ChallengeModal'; // NEW IMPORT
import SummaryHistoryModal from './components/gameplay/modals/SummaryHistoryModal';
import UpgradeModal from './components/gameplay/modals/UpgradeModal';
import { FlashSummaryRecoveryModal } from './components/gameplay/modals/FlashSummaryRecoveryModal';
import { IncompleteNarrationModal } from './components/gameplay/modals/IncompleteNarrationModal';
import { NormalizePowerModal } from './components/gameplay/modals/NormalizePowerModal';
import FallbackOverlay from './components/ui/FallbackOverlay';
import ApiRunningToast from './components/ui/ApiRunningToast';
import BackgroundTaskIndicator from './components/ui/BackgroundTaskIndicator';
import { ScrollControl } from './components/ui/ScrollControl';
import { ScreenStretchWrapper } from './components/ui/ScreenStretchWrapper';
import { BackgroundSoundCloudPlayer } from './components/gameplay/BackgroundSoundCloudPlayer';

// Custom hook to get the previous value of a prop or state
const usePrevious = <T,>(value: T): T | undefined => {
  const ref = useRef<T>();
  useEffect(() => {
    ref.current = value;
  });
  return ref.current;
};

// A new inner component to access the context provided by GameProvider
const AppContent: React.FC = () => {
  const game = useGame(); // useGame hook provides access to all game state and actions
  const { isDevMode, isDevInterfaceOpen, toggleDevMode, openDevInterface, closeDevInterface } = useDevMode();
  useCultivation(); // Active cultivation loop
  const prevIsLoadingApi = usePrevious(game.isLoadingApi);
  const [lastNotifiedGroupIndex, setLastNotifiedGroupIndex] = useState(rotationIndices.main);
  const { currentScreen, checkApiConnection, showNotification } = game;

  // Auto-recovery connection loop logic removed
  useEffect(() => {
    localStorage.removeItem('AUTO_RETRY_CONNECTION');
    localStorage.removeItem('RETRY_COUNT');
  }, []);

  useEffect(() => {
    // When isLoadingApi transitions from true to false, it means an API call has finished.
    if (prevIsLoadingApi && !game.isLoadingApi) {
        const keyDisplay = getCurrentlyUsedKeyDisplay();
        game.setApiKeyDisplay(keyDisplay);

        // Check if the API key group has changed and notify the user (Main group as representative)
        if (rotationIndices.main !== lastNotifiedGroupIndex && game.knowledgeBase.playerStats.turn > 1) {
            const message = VIETNAMESE.switchedToApiKeyGroup(rotationIndices.main + 1);
            game.showNotification(message, 'info');
            setLastNotifiedGroupIndex(rotationIndices.main);
        }
    }
  }, [game.isLoadingApi, prevIsLoadingApi, game.setApiKeyDisplay, lastNotifiedGroupIndex, game.knowledgeBase.playerStats.turn, game.showNotification]);


  if (game.isInitialLoading) {
    return <div className="h-full flex items-center justify-center bg-gray-900"><Spinner text="Đang tải và khởi tạo..." /></div>;
  }
  
  if (game.storageInitError && game.currentScreen !== GameScreen.StorageSettings) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-gray-900 p-6 text-center">
        <h1 className="text-3xl font-bold text-red-500 mb-4">{VIETNAMESE.errorInitializingStorage}</h1>
        <p className="text-lg text-gray-300 mb-6 font-mono tracking-wide">{game.storageInitError}</p>
        <button 
          onClick={() => game.setCurrentScreen(GameScreen.StorageSettings)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded"
        >
          {VIETNAMESE.storageSettings}
        </button>
      </div>
    );
  }

  const playlistUrl = 
    game.currentScreen === GameScreen.GameSetup 
      ? "https://soundcloud.com/knell101/sets/bat-dau" 
      : game.currentScreen === GameScreen.LoadGameSelection 
      ? "https://soundcloud.com/knell101/sets/load" 
      : "";
  const isSoundCloudActive = playlistUrl !== "";

  return (
    <ScreenStretchWrapper>
      <AppRouter openDevInterface={openDevInterface} />
      <BackgroundSoundCloudPlayer playlistUrl={playlistUrl} active={isSoundCloudActive} />
      <FallbackOverlay />
      <ApiRunningToast />
      <BackgroundTaskIndicator />
      {/* Global UI elements that can be displayed over any screen */}
      {game.notification && (
        <div 
          className={`fixed bottom-5 right-5 p-4 rounded-lg shadow-lg text-white text-sm z-[100]
                      ${game.notification.type === 'success' ? 'bg-green-600' : ''}
                      ${game.notification.type === 'error' ? 'bg-red-600' : ''}
                      ${game.notification.type === 'info' ? 'bg-blue-600' : ''}
                      ${game.notification.type === 'warning' ? 'bg-yellow-500 text-gray-800' : ''}`}
        >
          {game.notification.message}
        </div>
      )}
      {game.apiError && game.currentScreen === GameScreen.Gameplay && ( 
         <div className="fixed top-5 left-1/2 -translate-x-1/2 p-3 bg-red-700 text-white rounded-md shadow-lg z-[100] text-xs max-w-md">
            Lỗi API: {game.apiError}
         </div>
      )}
      {(game.isCraftingItem) && ( 
         <div className="fixed top-5 left-1/2 -translate-x-1/2 p-3 bg-blue-600 text-white rounded-md shadow-lg z-[100] text-sm flex items-center gap-2">
            <Spinner size="sm" />
            <span>{VIETNAMESE.craftingInProgress}</span>
         </div>
      )}

      {/* Global Modals - Rendered on top of any screen */}
      {game.activeEconomyModal?.type === 'marketplace' && <MarketplaceModal locationId={game.activeEconomyModal.locationId} knowledgeBase={game.knowledgeBase} onClose={game.closeEconomyModal} onBuyItem={game.handleBuyItem} onSellItem={game.handleSellItem} />}
      {game.activeEconomyModal?.type === 'shopping_center' && <ShoppingCenterModal locationId={game.activeEconomyModal.locationId} knowledgeBase={game.knowledgeBase} onClose={game.closeEconomyModal} onBuyItem={game.handleBuyItem} onSellItem={game.handleSellItem} />}
      {game.activeSlaveMarketModal && <SlaveMarketModal locationId={game.activeSlaveMarketModal.locationId} knowledgeBase={game.knowledgeBase} onClose={game.closeSlaveMarketModal} onBuySlave={game.handleBuySlave} />}
      {game.isStyleSettingsModalOpen && <StyleSettingsModal initialSettings={game.styleSettings} onSave={(s) => { game.setStyleSettings(s); game.setIsStyleSettingsModalOpen(false); }} onClose={() => game.setIsStyleSettingsModalOpen(false)} />}
      {game.isJourneyLogOpen && <JourneyLogModal isOpen={game.isJourneyLogOpen} onClose={() => game.setIsJourneyLogOpen(false)} knowledgeBase={game.knowledgeBase} />}
      {game.isSummaryModalOpen && <SummaryHistoryModal isOpen={game.isSummaryModalOpen} onClose={() => game.setIsSummaryModalOpen(false)} knowledgeBase={game.knowledgeBase} />}
      {game.isCompanionSelectionModalOpen && (
          <CompanionSelectionForCombatModal
              isOpen={game.isCompanionSelectionModalOpen}
              onClose={() => game.setIsCompanionSelectionModalOpen(false)}
              knowledgeBase={game.knowledgeBase}
              onSave={game.handleSetCombatCompanions}
          />
      )}
      {game.isUpgradeModalOpen && game.upgradeItem && (
          <UpgradeModal 
              knowledgeBase={game.knowledgeBase}
              mainItem={game.upgradeItem}
              onClose={game.closeUpgradeModal}
              onUpgrade={game.handleUpgradeItem}
          />
      )}
      {/* Challenge Modal - Rendered if uiState says so */}
      {game.uiState.isChallengeModalOpen && <ChallengeModal />}

      <FlashSummaryRecoveryModal 
        isOpen={!!game.uiState.isFlashSummaryMissingModalOpen}
        onAgree={game.handleRetryFlashSummary}
        onIgnore={game.handleIgnoreFlashSummary}
      />

      <IncompleteNarrationModal
        isOpen={!!game.uiState.isNarrationIncompleteModalOpen}
        attempt={game.uiState.incompleteNarrationData?.attempt || 1}
        maxAttempts={game.uiState.incompleteNarrationData?.maxAttempts || 2}
        isLoading={game.isRecoveringNarration}
        availableModels={AVAILABLE_MODELS}
        selectedModel={game.uiState.incompleteNarrationData?.selectedModel}
        onSelectModel={game.handleSelectIncompleteNarrationModel}
        onContinue={game.handleContinueIncompleteNarration}
        onIgnore={game.handleIgnoreIncompleteNarration}
        onHide={game.handleHideIncompleteNarration}
        isMinimized={!!game.uiState.incompleteNarrationData?.isMinimized}
        onRestore={game.handleRestoreIncompleteNarration}
      />

      <NormalizePowerModal
        isOpen={!!game.uiState.isNormalizePowerModalOpen}
        onAgree={() => game.setUiState(prev => ({ ...prev, isNormalizePowerModalOpen: false, powerNormalizationsData: null }))}
        onIgnore={() => game.setUiState(prev => ({ ...prev, isNormalizePowerModalOpen: false, powerNormalizationsData: null }))}
      />
      
      {/* EntityDetailModal is last to ensure it's on top of other modals */}
      <EntityDetailModal 
        selectedEntity={game.selectedEntity} 
        isOpen={!!game.selectedEntity} 
        onClose={game.closeModal} 
        knowledgeBase={game.knowledgeBase} 
        onUpdateEntityAvatar={game.onUpdateEntityAvatar}
        isUploadingAvatar={game.isUploadingAvatar}
      />

      {/* Dev Interface Modal */}
      <DevInterface 
        isOpen={isDevInterfaceOpen} 
        onClose={closeDevInterface} 
        isDevMode={isDevMode} 
        onToggleDevMode={toggleDevMode} 
      />
      {game.currentScreen === GameScreen.Gameplay && <ScrollControl />}
    </ScreenStretchWrapper>
  );
};

// The main App component is now just the provider wrapper
export const App: React.FC = () => {
  return (
    <GameProvider>
      <AppContent />
    </GameProvider>
  );
};
