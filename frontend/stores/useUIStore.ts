import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

interface UIState {
    notification: { message: string; type: 'success' | 'error' | 'info' } | null;
    setNotification: (notification: { message: string; type: 'success' | 'error' | 'info' } | null) => void;
}

export const useUIStore = create<UIState>()(
  devtools<UIState>((set, get) => ({
    notification: null,
    setNotification: (notification: { message: string; type: 'success' | 'error' | 'info' } | null) => set({ notification }),
  }), { name: 'UIStore' })
);