import { useState, useCallback } from 'react';
import { Item, Skill, Quest, NPC, GameLocation, WorldLoreEntry, Faction, Companion, YeuThu as YeuThuTemplate, Wife, Slave, Prisoner, Master, PlayerStats } from '../types';

export type GameEntity = Item | Skill | Quest | NPC | GameLocation | WorldLoreEntry | Faction | Companion | YeuThuTemplate | Wife | Slave | Prisoner | Master | (PlayerStats & { entityType?: 'player'; id?: string; name?: string });
export type GameEntityType = 'item' | 'skill' | 'quest' | 'npc' | 'location' | 'lore' | 'faction' | 'companion' | 'yeuThu' | 'wife' | 'slave' | 'prisoner' | 'master' | 'player';

export const useGameplayModals = () => {
    const [selectedEntity, setSelectedEntity] = useState<{ type: GameEntityType; entity: GameEntity } | null>(null);
    const [isStyleSettingsModalOpen, setIsStyleSettingsModalOpen] = useState(false);
    const [activeEconomyModal, setActiveEconomyModal] = useState<{type: 'marketplace' | 'shopping_center', locationId: string} | null>(null);
    const [activeSlaveMarketModal, setActiveSlaveMarketModal] = useState<{locationId: string} | null>(null);
    const [isCompanionSelectionModalOpen, setIsCompanionSelectionModalOpen] = useState(false); // NEW
    const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false); // NEW
    const [upgradeItem, setUpgradeItem] = useState<Item | null>(null); // NEW

    const openEntityModal = useCallback((type: GameEntityType, entity: GameEntity) => {
        setSelectedEntity({ type, entity });
    }, []);
    
    const openUpgradeModal = useCallback((item: Item) => {
        setUpgradeItem(item);
        setIsUpgradeModalOpen(true);
    }, []);

    const closeUpgradeModal = useCallback(() => {
        setUpgradeItem(null);
        setIsUpgradeModalOpen(false);
    }, []);

    const closeModal = useCallback(() => {
        setSelectedEntity(null);
    }, []);

    const closeEconomyModal = useCallback(() => {
        setActiveEconomyModal(null);
    }, []);

    const closeSlaveMarketModal = useCallback(() => {
        setActiveSlaveMarketModal(null);
    }, []);


    const closeAllModals = useCallback(() => {
        setSelectedEntity(null);
        setActiveEconomyModal(null);
        setIsStyleSettingsModalOpen(false);
        setActiveSlaveMarketModal(null);
        setIsCompanionSelectionModalOpen(false); // NEW
        setIsUpgradeModalOpen(false); // NEW
        setUpgradeItem(null); // NEW
    }, []);

    return {
        selectedEntity,
        isStyleSettingsModalOpen,
        activeEconomyModal,
        activeSlaveMarketModal,
        isCompanionSelectionModalOpen, // NEW
        isUpgradeModalOpen, // NEW
        upgradeItem, // NEW
        openEntityModal,
        openUpgradeModal, // NEW
        closeModal,
        closeEconomyModal,
        closeSlaveMarketModal,
        closeUpgradeModal, // NEW
        setIsStyleSettingsModalOpen,
        setActiveEconomyModal,
        setActiveSlaveMarketModal,
        setIsCompanionSelectionModalOpen, // NEW
        setIsUpgradeModalOpen, // NEW
        setUpgradeItem, // NEW
        closeAllModals
    };
};
