import { create } from 'zustand';
import { User } from '../types';
import { api, apiClient } from '../services/api'; // ייבוא של apiClient בנוסף ל-api
import { useDataStore } from './useDataStore';
import { useUIStore } from './useUIStore';
import { logger } from '../services/logger';

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
    handleUploadAvatar: (imageDataUrl: string) => Promise<void>;
    forgotPassword: (email: string) => Promise<{ success: boolean; message: string }>;
    resetPassword: (token: string, password: string) => Promise<{ success: boolean; message: string }>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
    currentUser: null,
    isAuthenticated: false,
    isAppLoading: true,

    checkAuthStatus: async () => {
        set({ isAppLoading: true });
        const token = localStorage.getItem('token');
        if (!token) {
            set({ currentUser: null, isAuthenticated: false, isAppLoading: false });
            return;
        }
        apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        try {
            const user = await api.getMe();
            set({ currentUser: user, isAuthenticated: true });
            await useDataStore.getState().bootstrapApp();
        } catch (error) {
            localStorage.removeItem('token');
            delete apiClient.defaults.headers.common['Authorization'];
            set({ currentUser: null, isAuthenticated: false });
        } finally {
            set({ isAppLoading: false });
        }
    },

    handleLogin: async (email, password) => {
        try {
            const response = await api.login(email, password);
            if (response && response.user && response.token) {
                // FIX: THE CRITICAL FIX FOR THE RACE CONDITION
                apiClient.defaults.headers.common['Authorization'] = `Bearer ${response.token}`;
                set({ currentUser: response.user, isAuthenticated: true });
                await useDataStore.getState().bootstrapApp();
                return null; // Success
            }
            return "אימייל או סיסמה שגויים.";
        } catch (err) {
            return (err as Error).message || "שגיאה לא צפויה";
        }
    },

    handleRegistration: async (registrationData) => {
        try {
            const response = await api.register(registrationData);
            if (response && response.user && response.token) {
                // FIX: THE CRITICAL FIX FOR THE RACE CONDITION
                apiClient.defaults.headers.common['Authorization'] = `Bearer ${response.token}`;
                set({ currentUser: response.user, isAuthenticated: true });
                await useDataStore.getState().bootstrapApp();
                return { success: true, error: null };
            }
            return { success: false, error: "שגיאת הרשמה: לא התקבלו פרטי משתמש." };
        } catch (err) {
            return { success: false, error: (err as Error).message || "שגיאת הרשמה לא צפויה." };
        }
    },

    handleLogout: () => {
        api.logout().catch(err => logger.error("Logout API call failed", err));
        useDataStore.getState().resetDataState();
        delete apiClient.defaults.headers.common['Authorization'];
        set({ currentUser: null, isAuthenticated: false });
    },

    handleUploadAvatar: async (imageDataUrl: string) => {
        const { setNotification } = useUIStore.getState();
        try {
            const updatedUser = await api.uploadAvatar(imageDataUrl);
            set({ currentUser: updatedUser });
            useDataStore.getState().updateSingleUserInList(updatedUser);
            setNotification({ message: 'תמונת הפרופיל עודכנה בהצלחה.', type: 'success' });
        } catch (err) {
            setNotification({ message: `שגיאה בהעלאת התמונה: ${(err as Error).message}`, type: 'error' });
        }
    },

    forgotPassword: async (email: string) => {
        try {
            const response = await api.forgotPassword(email);
            return { success: true, message: response.message };
        } catch (error) {
            return { success: false, message: (error as Error).message || 'Failed to send password reset link.' };
        }
    },

    resetPassword: async (token: string, password: string) => {
        try {
            const response = await api.resetPassword(token, password);
            return { success: true, message: response.message };
        } catch (error) {
            return { success: false, message: (error as Error).message || 'Failed to reset password.' };
        }
    },
}));