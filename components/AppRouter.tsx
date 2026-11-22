
import React, { Suspense } from 'react';
import { GameScreen } from '../types';
import { useGame } from '../hooks/useGame';
import { useClassicCombatEnd } from '../hooks/useClassicCombatEnd';
import Spinner from './ui/Spinner'; // Import the Spinner for fallback UI

// Eagerly load the initial screen as it's always the first thing shown
import InitialScreen from './InitialScreen';
import GameplayScreen from './GameplayScreen';
import { getApiSettings } from '../services/geminiService';

// Lazy load all other screens
const GameSetupScreen = React.lazy(() => import('./GameSetupScreen'));
const EquipmentScreen = React.lazy(() => import('./gameplay/equipment/EquipmentScreen'));
const CraftingScreen = React.lazy(() => import('./gameplay/crafting/CraftingScreen'));
const ApiSettingsScreen = React.lazy(() => import('./ApiSettingsScreen').then(module => ({ default: module.ApiSettingsScreen })));
import LoadGameScreen from './LoadGameScreen';
const StorageSettingsScreen = React.lazy(() => import('./StorageSettingsScreen').then(module => ({ default: module.StorageSettingsScreen })));
const ImportExportScreen = React.lazy(() => import('./ImportExportScreen'));
const MapPanel = React.lazy(() => import('./gameplay/map/MapPanel'));
const RealTimeCombatScreen = React.lazy(() => import('./gameplay/RealTimeCombatScreen'));
import CombatScreenold from './CombatScreenold';
const AuctionScreen = React.lazy(() => import('./AuctionScreen'));
const CultivationScreen = React.lazy(() => import('./CultivationScreen'));
const CompanionManagementScreen = React.lazy(() => import('./CompanionManagementScreen'));
const PrisonerManagementScreen = React.lazy(() => import('./PrisonerManagementScreen'));
const CompanionEquipmentScreen = React.lazy(() => import('./gameplay/equipment/CompanionEquipmentScreen').then(module => ({ default: module.CompanionEquipmentScreen })));
const SlaveAuctionScreen = React.lazy(() => import('./SlaveAuctionScreen'));
const PromptsScreen = React.lazy(() => import('./PromptsScreen'));
const ChatbotScreen = React.lazy(() => import('./ChatbotScreen'));


interface AppRouterProps {
    openDevInterface: () => void;
}

const AppRouter: React.FC<AppRouterProps> = ({ openDevInterface }) => {
    const game = useGame();
    const { handleClassicCombatSequence } = useClassicCombatEnd();

    const renderScreen = () => {
        switch (game.currentScreen) {
            case GameScreen.Initial:
                return <InitialScreen 
                    setCurrentScreen={game.setCurrentScreen} 
                    onSignOut={() => {}} // Firebase removed
                    isFirebaseLoading={false} // Firebase removed
                    openDevInterface={openDevInterface}
                />;
            case GameScreen.GameSetup:
                return <GameSetupScreen 
                    setCurrentScreen={game.setCurrentScreen} 
                    onSetupComplete={game.handleSetupComplete} 
                />;
            case GameScreen.Gameplay:
                return <GameplayScreen />;
            case GameScreen.Equipment: 
                return <EquipmentScreen
                    knowledgeBase={game.knowledgeBase}
                    setCurrentScreen={game.setCurrentScreen}
                    onUpdateEquipment={game.handleUpdateEquipment}
                />;
            case GameScreen.CompanionEquipment:
                return <CompanionEquipmentScreen />;
            case GameScreen.Crafting:
                return <CraftingScreen
                    knowledgeBase={game.knowledgeBase}
                    setCurrentScreen={game.setCurrentScreen}
                    onCraftItem={game.handleCraftItem}
                    isCrafting={game.isCraftingItem}
                />;
            case GameScreen.Map:
                return <MapPanel
                    knowledgeBase={game.knowledgeBase}
                    setCurrentScreen={game.setCurrentScreen}
                />;
            case GameScreen.Auction:
                return <AuctionScreen
                    knowledgeBase={game.knowledgeBase}
                    onPlaceBid={game.handlePlayerAuctionAction}
                    onAuctioneerCall={game.handleAuctioneerCall}
                    onSkipItem={game.handleSkipAuctionItem}
                    onLeave={() => {
                        game.setKnowledgeBase(prev => ({ ...prev, auctionState: null }));
                        game.setCurrentScreen(GameScreen.Gameplay);
                    }}
                    isLoading={game.isLoadingApi}
                    sentEconomyPromptsLog={game.sentEconomyPromptsLog}
                    receivedEconomyResponsesLog={game.receivedEconomyResponsesLog}
                />;
             case GameScreen.SlaveAuction:
                return <SlaveAuctionScreen
                    knowledgeBase={game.knowledgeBase}
                    onPlaceBid={game.handlePlayerSlaveAuctionAction}
                    onAuctioneerCall={game.handleSlaveAuctioneerCall}
                    onSkipItem={game.handleSkipSlaveAuctionItem}
                    onLeave={() => {
                        game.setKnowledgeBase(prev => ({ ...prev, slaveAuctionState: null }));
                        game.setCurrentScreen(GameScreen.Gameplay);
                    }}
                    isLoading={game.isLoadingApi}
                    sentEconomyPromptsLog={game.sentEconomyPromptsLog}
                    receivedEconomyResponsesLog={game.receivedEconomyResponsesLog}
                />;
            case GameScreen.Combat: {
                const apiSettings = getApiSettings();
                const isClassicNeon = apiSettings?.combatGraphicsConfig?.combatEngineMode === 'neon_classic';

                if (isClassicNeon) {
                    return <CombatScreenold
                        knowledgeBase={game.knowledgeBase}
                        onCombatEnd={game.handleCombatEnd}
                        onClassicCombatEnd={handleClassicCombatSequence}
                        currentPageMessagesLog={game.currentPageMessagesLog}
                        previousPageSummaries={game.previousPageSummaries}
                        lastNarrationFromPreviousPage={game.lastNarrationFromPreviousPage}
                    />;
                }

                return <RealTimeCombatScreen
                    knowledgeBase={game.knowledgeBase}
                    onCombatEnd={game.handleCombatEnd}
                    currentPageMessagesLog={game.currentPageMessagesLog}
                    previousPageSummaries={game.previousPageSummaries}
                    lastNarrationFromPreviousPage={game.lastNarrationFromPreviousPage}
                />;
            }
            case GameScreen.Cultivation:
                return <CultivationScreen
                    knowledgeBase={game.knowledgeBase}
                    setKnowledgeBase={game.setKnowledgeBase}
                    gameMessages={game.gameMessages}
                    addMessageAndUpdateState={game.addMessageAndUpdateState}
                    setIsCultivating={game.setIsCultivating}
                    showNotification={game.showNotification}
                    setCurrentScreen={game.setCurrentScreen}
                    handleStartBreakthroughCombat={game.handleStartBreakthroughCombat}
                    uiState={game.uiState}
                    setUiState={game.setUiState}
                />;
            case GameScreen.CompanionManagement:
                return <CompanionManagementScreen />;
            case GameScreen.PrisonerManagement:
                return <PrisonerManagementScreen />;
            case GameScreen.Prompts:
                return <PromptsScreen />;
            case GameScreen.ApiSettings:
                return <ApiSettingsScreen 
                    setCurrentScreen={game.setCurrentScreen} 
                    apiSettingsReturnScreen={game.apiSettingsReturnScreen}
                    onSettingsSavedNotification={() => {
                        game.showNotification("Cài đặt API đã được lưu. Các thay đổi sẽ có hiệu lực ngay.", "success");
                    }}
                    knowledgeBase={game.knowledgeBase}
                    setKnowledgeBase={game.setKnowledgeBase}
                />;
            case GameScreen.LoadGameSelection:
                return <LoadGameScreen
                    setCurrentScreen={game.setCurrentScreen}
                    onLoadGame={game.onLoadGame}
                    notify={game.showNotification}
                    storageType={game.storageSettings.storageType}
                />;
            case GameScreen.StorageSettings:
                return <StorageSettingsScreen
                    setCurrentScreen={game.setCurrentScreen}
                    onSettingsSaved={game.onSettingsSaved}
                />;
            case GameScreen.ImportExport:
                return <ImportExportScreen
                    setCurrentScreen={game.setCurrentScreen}
                    storageType={game.storageSettings.storageType}
                    notify={game.showNotification}
                    fetchSaveGames={game.fetchSaveGamesForImportExport}
                    loadSpecificGameData={game.loadSpecificGameDataForExport}
                    importGameData={game.handleImportGameData}
                />;
            case GameScreen.Chatbot:
                return <ChatbotScreen />;
            default:
                return <div>Error: Unknown screen</div>;
        }
    };

    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-gray-900">
                <Spinner text="Đang tải..." />
            </div>
        }>
            {renderScreen()}
        </Suspense>
    );
};

export default AppRouter;
