
import { useState, useEffect, useCallback } from 'react';
import { READER_MODE_STORAGE_KEY } from '../constants';

export const useGameplayPanels = () => {
  const [isReaderMode, setIsReaderMode] = useState(() => {
    try {
      const storedValue = localStorage.getItem(READER_MODE_STORAGE_KEY);
      return storedValue ? JSON.parse(storedValue) : false;
    } catch {
      return false;
    }
  });

  const [isCharPanelOpen, setIsCharPanelOpen] = useState(false);
  const [isQuestsPanelOpen, setIsQuestsPanelOpen] = useState(false);
  const [isWorldPanelOpen, setIsWorldPanelOpen] = useState(false);
  const [showDebugPanel, setShowDebugPanel] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(READER_MODE_STORAGE_KEY, JSON.stringify(isReaderMode));
    } catch (error) {
      console.error("Could not save reader mode state:", error);
    }
  }, [isReaderMode]);

  const closeDebugPanel = useCallback(() => {
    setShowDebugPanel(false);
  }, []);

  return {
    isReaderMode,
    setIsReaderMode,
    isCharPanelOpen,
    setIsCharPanelOpen,
    isQuestsPanelOpen,
    setIsQuestsPanelOpen,
    isWorldPanelOpen,
    setIsWorldPanelOpen,
    showDebugPanel,
    setShowDebugPanel,
    closeDebugPanel,
  };
};
