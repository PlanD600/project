import { create } from 'zustand';

interface UIState {
    globalError: string | null;
    setGlobalError: (error: string | null) => void;
}

export const useUIStore = create<UIState>((set) => ({
    globalError: null,
    setGlobalError: (error) => set({ globalError: error }),
}));