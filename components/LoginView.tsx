import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom'; // ייבוא useNavigate
import { useAuthStore } from '../stores/useAuthStore'; // ייבוא useAuthStore
import { useUIStore } from '../stores/useUIStore'; // ייבוא useUIStore
import Icon from './Icon';
import Spinner from './Spinner';
import RegistrationModal from './RegistrationModal'; // עדיין בשימוש אם מדובר במודאל הרשמה
import ForgotPasswordModal from './ForgotPasswordModal'; // ייבוא הפופ-אפ החדש

// הממשק LoginViewProps כבר לא נחוץ כיוון שהקומפוננטה משתמשת ישירות ב-stores
// interface LoginViewProps {
//     onLogin: (email: string, password: string) => Promise<string | null>;
//     onRegister: (data: { fullName: string; email: string; password: string; companyName: string; }) => Promise<{ success: boolean; error: string | null; }>;
//     onRegistrationSuccess: () => void;
// }

// const LoginView: React.FC<LoginViewProps> = ({ onLogin, onRegister, onRegistrationSuccess }) => {
const LoginView: React.FC = (props) => { // ללא props כעת
    // If you use currentUser or similar, add:
    // const { currentUser } = useAuthStore();
    // if (currentUser === undefined) return <div>Loading...</div>;
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false); // שינוי השם מ-isLoading ל-isSubmitting להבהרה
    const [isRegisterModalOpen, setRegisterModalOpen] = useState(false);
    const [isForgotPasswordModalOpen, setIsForgotPasswordModalOpen] = useState(false); // מצב חדש לפופ-אפ שכחתי סיסמה

    // שימוש ב-stores ישירות
    const navigate = useNavigate();
    const handleLogin = useAuthStore((state) => state.handleLogin);
    const handleRegistration = useAuthStore((state) => state.handleRegistration); // קריאה לפונקציית הרשמה מה-store
    const setNotification = useUIStore((state) => state.setNotification); // קריאה לפונקציית התראות מה-UI store

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        // אין צורך בבדיקת null/empty כאן כי handleLogin ב-store כרגע מטפל בזה
        // וגם ה-API validation יעשה זאת
        
        setIsSubmitting(true);
        // קריאה ל-handleLogin ישירות מה-auth store
        const error = await handleLogin(email, password);
        if (error) {
            setNotification({ message: error, type: 'error' }); // שימוש ב-setNotification מה-UI store
        }
        setIsSubmitting(false);
    };
    
    // שינוי handleRegister שתתאים לשימוש ב-handleRegistration מה-useAuthStore
    const handleRegisterSubmit = async (data: { fullName: string; email: string; password: string; companyName: string; }): Promise<string | null> => {
        setIsSubmitting(true);
        const { success, error: registrationError } = await handleRegistration(data); // קריאה לפונקציית הרשמה מה-store
        setIsSubmitting(false);
        if (registrationError) {
            return registrationError;
        }
        if (success) {
            setRegisterModalOpen(false);
            // onRegistrationSuccess(); // כבר לא צריך כי הניווט יטופל ב-App.tsx
            setNotification({ message: 'ההרשמה בוצעה בהצלחה! הנך מחובר כעת.', type: 'success' });
            // הניווט ללוח המחוונים יקרה אוטומטית כי isAuthenticated יהיה true
        }
        return null;
    };

    return (
        <>
            <div className="min-h-screen bg-light flex flex-col justify-center items-center p-4 font-sans">
                <div className="w-full max-w-md">
                    <div className="text-center mb-8">
                        <div className="inline-block p-4 rounded-3xl shadow-neumorphic-convex mb-4">
                            <div className='p-2 bg-primary rounded-xl'>
                            <svg className="w-8 h-8 text-light" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2a4 4 0 00-4-4H3V9h2a4 4 0 004-4V3l4 4-4 4zm6 0v-2a4 4 0 014-4h2V9h-2a4 4 0 01-4-4V3l-4 4 4 4z"></path>
                            </svg>
                            </div>
                        </div>
                        <h1 className="text-3xl font-bold text-primary">מנהל פרויקטים </h1>
                        <p className="text-secondary mt-2">התחבר כדי להמשיך ללוח המחוונים שלך</p>
                    </div>

                    <form onSubmit={handleSubmit} className="bg-light shadow-neumorphic-convex rounded-2xl p-8 space-y-6">
                        {/* השתמש ב-error מה-UI store במקום state מקומי, אם תרצה */}
                        {/* {error && (
                            <div className="bg-danger/20 text-danger text-sm p-3 rounded-md text-center">
                                {error}
                            </div>
                        )} */}
                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-secondary mb-2">כתובת אימייל</label>
                            <input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                className="w-full bg-light p-3 rounded-xl border-none shadow-neumorphic-concave-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                                placeholder="you@example.com"
                            />
                        </div>
                        <div>
                               <label htmlFor="password" className="block text-sm font-medium text-secondary mb-2">סיסמה</label>
                            <input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                className="w-full bg-light p-3 rounded-xl border-none shadow-neumorphic-concave-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                                placeholder="••••••••"
                            />
                        </div>
                        <div className="flex items-center justify-between">
                            {/* --- שינוי כאן: פתיחת הפופ-אפ של שכחתי סיסמה --- */}
                            <a href="#" onClick={(e) => { e.preventDefault(); setIsForgotPasswordModalOpen(true); }} className="text-sm text-primary hover:underline">שכחת סיסמה?</a>
                            {/* --- סוף שינוי --- */}
                            <div className="flex items-center">
                                <label htmlFor="remember-me" className="mr-2 block text-sm text-secondary">זכור אותי</label>
                                <input id="remember-me" name="remember-me" type="checkbox" className="h-4 w-4 text-primary bg-light shadow-neumorphic-concave-sm rounded focus:ring-primary border-none" />
                            </div>
                        </div>
                        <div>
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full flex justify-center items-center py-3 px-4 rounded-xl shadow-neumorphic-convex hover:shadow-neumorphic-convex-sm active:shadow-neumorphic-concave-sm transition-all text-sm font-medium text-primary bg-light disabled:opacity-50 disabled:cursor-wait"
                            >
                                {isSubmitting ? <Spinner /> : 'התחבר'}
                            </button>
                        </div>
                    </form>
                    <div className="text-center mt-6">
                        <p className="text-sm text-secondary">
                            אין לך חשבון?{' '}
                            <a href="#" onClick={(e) => {e.preventDefault(); setRegisterModalOpen(true)}} className="font-medium text-primary hover:underline">
                                צור סביבת עבודה חדשה
                            </a>
                        </p>
                    </div>
                </div>
            </div>
            {/* --- הוספה כאן: מודאל הרשמה --- */}
            {isRegisterModalOpen && (
                <RegistrationModal
                    isOpen={isRegisterModalOpen}
                    onClose={() => setRegisterModalOpen(false)}
                    onRegister={handleRegisterSubmit} // שימוש ב-handleRegisterSubmit החדש
                />
            )}
            {/* --- הוספה כאן: מודאל שכחתי סיסמה --- */}
            <ForgotPasswordModal
                isOpen={isForgotPasswordModalOpen}
                onClose={() => setIsForgotPasswordModalOpen(false)}
            />
        </>
    );
};

export default LoginView;