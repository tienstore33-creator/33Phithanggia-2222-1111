import { create } from 'zustand';

interface UiLockState {
  isLocked: boolean;
  setLocked: (locked: boolean) => void;
}

export const useUiLockStore = create<UiLockState>((set) => ({
  isLocked: false,
  setLocked: (locked) => set({ isLocked: locked }),
}));
