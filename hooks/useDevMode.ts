import { useState, useEffect, useCallback } from 'react';
import { useGame } from './useGame';

/**
 * Hook to manage Dev Mode state and interface.
 * Persists isDevMode in localStorage.
 */
export const useDevMode = () => {
    const { uiState, setUiState } = useGame();
    const [isDevInterfaceOpen, setIsDevInterfaceOpen] = useState(false);

    // Initialize isDevMode from localStorage on mount
    useEffect(() => {
        const savedDevMode = localStorage.getItem('isDevMode');
        if (savedDevMode !== null) {
            const isDev = savedDevMode === 'true';
            setUiState(prev => ({ ...prev, isDevMode: isDev }));
        }
    }, [setUiState]);

    const toggleDevMode = useCallback(() => {
        setUiState(prev => {
            const nextDevMode = !prev.isDevMode;
            localStorage.setItem('isDevMode', String(nextDevMode));
            return { ...prev, isDevMode: nextDevMode };
        });
    }, [setUiState]);

    const openDevInterface = useCallback(() => {
        setIsDevInterfaceOpen(true);
    }, []);

    const closeDevInterface = useCallback(() => {
        setIsDevInterfaceOpen(false);
    }, []);

    return {
        isDevMode: uiState.isDevMode,
        isDevInterfaceOpen,
        toggleDevMode,
        openDevInterface,
        closeDevInterface
    };
};
