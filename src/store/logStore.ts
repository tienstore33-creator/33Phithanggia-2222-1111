
import { create } from 'zustand';
import { GameMessage } from '../../types';

interface LogState {
    history: GameMessage[];
    currentPage: number;
    isModalOpen: boolean;
    viewMode: 'content' | 'toc'; // Chuyển đổi giữa nội dung và mục lục
    setHistory: (history: GameMessage[]) => void;
    setPage: (page: number) => void;
    setViewMode: (mode: 'content' | 'toc') => void;
    toggleModal: () => void;
    openModal: () => void;
    closeModal: () => void;
}

export const useLogStore = create<LogState>((set) => ({
    history: [],
    currentPage: 0,
    isModalOpen: false,
    viewMode: 'content',
    setHistory: (history) => set({ history }),
    setPage: (page) => set({ currentPage: page }),
    setViewMode: (mode) => set({ viewMode: mode }),
    toggleModal: () => set((state) => ({ isModalOpen: !state.isModalOpen })),
    openModal: () => set({ isModalOpen: true }),
    closeModal: () => set({ isModalOpen: false }),
}));
