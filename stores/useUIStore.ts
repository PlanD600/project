import { create } from 'zustand';

interface UIState {
    notification: { message: string; type: 'success' | 'error' | 'info' } | null;
    setNotification: (notification: { message: string; type: 'success' | 'error' | 'info' } | null) => void;
}

export const useUIStore = create<UIState>((set) => ({
    notification: null,
    setNotification: (notification) => set({ notification }),
}));