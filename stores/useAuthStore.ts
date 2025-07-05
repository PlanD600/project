import { create } from 'zustand';
import { User } from '../types';
import { api } from '../services/api'; // ייבוא של api בלבד
import { useDataStore } from './useDataStore';
import { useUIStore } from './useUIStore';
import { logger } from '../services/logger'; // ודא ייבוא של logger אם הוא בשימוש


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
    isAppLoading: true, // מאותחל כ-true כדי שהאפליקציה תתחיל בבדיקת אימות

    // Setters בסיסיים
    setCurrentUser: (user) => set({ currentUser: user }),
    setIsAuthenticated: (auth) => set({ isAuthenticated: auth }),

    checkAuthStatus: async () => {
        set({ isAppLoading: true }); // הפעל מצב טעינה
        const token = localStorage.getItem('token');

        if (!token) {
            // אם אין טוקן, אין משתמש מחובר
            set({ currentUser: null, isAuthenticated: false, isAppLoading: false });
            api.removeAuthToken(); // ודא שהטוקן הוסר גם מ-axios defaults
            return;
        }

        // הגדר את הטוקן ב-axios defaults לפני כל קריאה מאומתת
        api.setAuthToken(token); 

        try {
            const user = await api.getMe(); // קריאה מאומתת לפרטי המשתמש
            set({ currentUser: user, isAuthenticated: true });
            await useDataStore.getState().bootstrapApp(); // טעינת נתונים ראשוניים מאומתים
        } catch (error) {
            // אם האימות נכשל (טוקן לא חוקי/פג תוקף), נקה את המצב
            logger.error("Authentication check failed:", error); // השתמש ב-logger
            localStorage.removeItem('token');
            api.removeAuthToken(); // הסר את הטוקן מ-axios defaults
            set({ currentUser: null, isAuthenticated: false });
        } finally {
            set({ isAppLoading: false }); // כבה מצב טעינה
        }
    },

    handleLogin: async (email, password) => {
        set({ isAppLoading: true }); // הפעל מצב טעינה
        try {
            // api.login כבר מטפל בשמירת הטוקן ב-localStorage וקריאה ל-api.setAuthToken
            const user = await api.login(email, password); 
            if (user) {
                set({ currentUser: user, isAuthenticated: true });
                // לאחר ההתחברות, טען את הנתונים הראשוניים של האפליקציה (קריאה מאומתת)
                await useDataStore.getState().bootstrapApp(); 
                set({ isAppLoading: false }); // כבה מצב טעינה בהצלחה
                return null; // הצלחה
            }
            set({ isAppLoading: false }); // כבה מצב טעינה בכישלון
            return "אימייל או סיסמה שגויים.";
        } catch (err) {
            set({ isAppLoading: false }); // כבה מצב טעינה בכישלון
            return (err as Error).message || "שגיאה לא צפויה";
        }
    },

    handleRegistration: async (registrationData) => {
        set({ isAppLoading: true }); // הפעל מצב טעינה
        try {
            // api.register כבר מטפל בשמירת הטוקן ב-localStorage וקריאה ל-api.setAuthToken
            // וטיפוס החזרה שלו עודכן לכלול את ה-token.
            const response = await api.register(registrationData); 
            if (response && response.user && response.token) {
                set({ currentUser: response.user, isAuthenticated: true });
                // לאחר ההרשמה, טען את הנתונים הראשוניים של האפליקציה (קריאה מאומתת)
                await useDataStore.getState().bootstrapApp();
                set({ isAppLoading: false }); // כבה מצב טעינה בהצלחה
                return { success: true, error: null };
            }
            set({ isAppLoading: false }); // כבה מצב טעינה בכישלון
            return { success: false, error: "שגיאת הרשמה: לא התקבלו פרטי משתמש או טוקן." };
        } catch (err) {
            set({ isAppLoading: false }); // כבה מצב טעינה בכישלון
            return { success: false, error: (err as Error).message || "שגיאת הרשמה לא צפויה." };
        }
    },

    handleLogout: () => {
        // קריאה ל-api.logout שתנקה את הטוקן ב-localStorage וב-axios defaults
        api.logout().catch(err => logger.error("Logout API call failed", err)); 
        useDataStore.getState().resetDataState(); // איפוס נתוני האפליקציה
        set({ currentUser: null, isAuthenticated: false });
        // אין צורך ב-delete apiClient.defaults.headers.common['Authorization']; כאן, api.logout כבר מטפל בזה
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