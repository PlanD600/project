import { create } from 'zustand';
import { User } from '../types';
import { api } from '../services/api';
import { useDataStore } from './useDataStore';

interface AuthState {
    currentUser: User | null;
    isAuthenticated: boolean;
    isAppLoading: boolean;
    setCurrentUser: (user: User | null) => void;
    setIsAuthenticated: (auth: boolean) => void;
    checkAuthStatus: () => Promise<void>;
    handleLogin: (email: string, password: string) => Promise<string | null>;
    handleLogout: () => void;
    handleRegistration: (data: { fullName: string; email: string; password: string; companyName: string; }) => Promise<{ success: boolean; error: string | null }>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
    currentUser: null,
    isAuthenticated: false,
    isAppLoading: true,
    setCurrentUser: (user) => set({ currentUser: user }),
    setIsAuthenticated: (auth) => set({ isAuthenticated: auth }),
    
    checkAuthStatus: async () => {
        try {
            const user = await api.getMe();
            if (user) {
                set({ currentUser: user, isAuthenticated: true });
                await useDataStore.getState().bootstrapApp();
            }
        } catch (error) {
            // Not authenticated, do nothing
        } finally {
            set({ isAppLoading: false });
        }
    },
    
    handleLogin: async (email, password) => {
        set({ isAppLoading: true });
        try {
            const user = await api.login(email, password);
            if (user) {
                set({ currentUser: user, isAuthenticated: true });
                await useDataStore.getState().bootstrapApp();
                set({ isAppLoading: false });
                return null;
            }
            set({ isAppLoading: false });
            return "אימייל או סיסמה שגויים.";
        } catch (err) {
            set({ isAppLoading: false });
            return (err as Error).message || "שגיאה לא צפויה";
        }
    },

    handleLogout: () => {
        api.logout().catch(err => console.error("Logout failed", err));
        useDataStore.getState().resetDataState();
        set({ currentUser: null, isAuthenticated: false });
    },

    handleRegistration: async (registrationData) => {
        try {
            const { user, organizationSettings } = await api.register(registrationData);
            set({ currentUser: user, isAuthenticated: true });
            useDataStore.getState().setOrganizationSettings(organizationSettings);
            await useDataStore.getState().bootstrapApp();
            return { success: true, error: null };
        } catch(err) {
            return { success: false, error: (err as Error).message || "שגיאת הרשמה לא צפויה."};
        }
    },
}));