import { create } from 'zustand';
import { User } from '../types';
// FIX: Using the api object import as intended in your project
import { api } from '../services/api'; 
import { useDataStore } from './useDataStore';
import { useUIStore } from './useUIStore';
// FIX: Using the named logger import
import { logger } from '../services/logger'; 

// This interface matches your original code structure
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

// FIX: Changed 'get' to '_get' as it's not used, to prevent linting errors.
export const useAuthStore = create<AuthState>((set, _get) => ({
    currentUser: null,
    isAuthenticated: false,
    isAppLoading: true,

    setCurrentUser: (user) => set({ currentUser: user }),
    setIsAuthenticated: (auth) => set({ isAuthenticated: auth }),

    checkAuthStatus: async () => {
        set({ isAppLoading: true });
        const token = localStorage.getItem('token');

        if (!token) {
            set({ currentUser: null, isAuthenticated: false, isAppLoading: false });
            api.removeAuthToken();
            return;
        }

        api.setAuthToken(token); 

        try {
            const user = await api.getMe();
            set({ currentUser: user, isAuthenticated: true });
            // Wait for all bootstrap data to load before setting isAppLoading false
            await useDataStore.getState().bootstrapApp();
        } catch (error) {
            logger.error("Authentication check failed:", { error });
            localStorage.removeItem('token');
            api.removeAuthToken();
            set({ currentUser: null, isAuthenticated: false });
        } finally {
            set({ isAppLoading: false });
        }
    },

    handleLogin: async (email, password) => {
        set({ isAppLoading: true });
        try {
            // FIX: Calling the method from the imported api object
            const user = await api.login(email, password); 
            if (user) {
                set({ currentUser: user, isAuthenticated: true });
                await useDataStore.getState().bootstrapApp(); 
                set({ isAppLoading: false });
                return null; // Success
            }
            set({ isAppLoading: false });
            return "אימייל או סיסמה שגויים.";
        } catch (err) {
            set({ isAppLoading: false });
            return (err as Error).message || "שגיאה לא צפויה";
        }
    },

    handleRegistration: async (registrationData) => {
        set({ isAppLoading: true });
        try {
            // FIX: Calling the method from the imported api object
            const response = await api.register(registrationData); 
            if (response && response.user && response.token) {
                set({ currentUser: response.user, isAuthenticated: true });
                await useDataStore.getState().bootstrapApp();
                set({ isAppLoading: false });
                return { success: true, error: null };
            }
            set({ isAppLoading: false });
            return { success: false, error: "שגיאת הרשמה: לא התקבלו פרטי משתמש או טוקן." };
        } catch (err) {
            set({ isAppLoading: false });
            return { success: false, error: (err as Error).message || "שגיאת הרשמה לא צפויה." };
        }
    },

    handleLogout: () => {
        // FIX: Calling the method from the imported api object
        // FIX: Wrap the 'unknown' error in an object to satisfy the logger's type requirement.
        api.logout().catch(err => logger.error("Logout API call failed", { err })); 
        useDataStore.getState().resetDataState();
        set({ currentUser: null, isAuthenticated: false });
    },

    handleUploadAvatar: async (imageDataUrl: string) => {
        const { setNotification } = useUIStore.getState();
        try {
            // FIX: Calling the method from the imported api object
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
            // FIX: Calling the method from the imported api object
            const response = await api.forgotPassword(email);
            return { success: true, message: response.message };
        } catch (error) {
            return { success: false, message: (error as Error).message || 'Failed to send password reset link.' };
        }
    },

    resetPassword: async (token: string, password: string) => {
        try {
            // FIX: Calling the method from the imported api object
            const response = await api.resetPassword(token, password);
            return { success: true, message: response.message };
        } catch (error) {
            return { success: false, message: (error as Error).message || 'Failed to reset password.' };
        }
    },
}));
