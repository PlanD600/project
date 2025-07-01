import React, { useState } from 'react';
import Icon from './Icon';
import Spinner from './Spinner';
import RegistrationModal from './RegistrationModal';

interface LoginViewProps {
    onLogin: (email: string, password: string) => Promise<string | null>;
    onRegister: (data: { fullName: string; email: string; password: string; companyName: string; }) => Promise<{ success: boolean; error: string | null; }>;
    onRegistrationSuccess: () => void;
}

const LoginView: React.FC<LoginViewProps> = ({ onLogin, onRegister, onRegistrationSuccess }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isRegisterModalOpen, setRegisterModalOpen] = useState(false);


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !password) {
            setError("אנא הזן אימייל וסיסמה.");
            return;
        }
        setError(null);
        setIsLoading(true);
        const loginError = await onLogin(email, password);
        if (loginError) {
            setError(loginError);
        }
        setIsLoading(false);
    };
    
    const handleRegister = async (data: { fullName: string; email: string; password: string; companyName: string; }): Promise<string | null> => {
        setIsLoading(true);
        const { success, error: registrationError } = await onRegister(data);
        setIsLoading(false);
        if (registrationError) {
            return registrationError;
        }
        if (success) {
            setRegisterModalOpen(false);
            onRegistrationSuccess();
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
                        {error && (
                            <div className="bg-danger/20 text-danger text-sm p-3 rounded-md text-center">
                                {error}
                            </div>
                        )}
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
                             <a href="#" onClick={(e) => { e.preventDefault(); alert('הוראות לאיפוס סיסמה נשלחו לכתובת האימייל שלך.'); }} className="text-sm text-primary hover:underline">שכחת סיסמה?</a>
                            <div className="flex items-center">
                                <label htmlFor="remember-me" className="mr-2 block text-sm text-secondary">זכור אותי</label>
                                <input id="remember-me" name="remember-me" type="checkbox" className="h-4 w-4 text-primary bg-light shadow-neumorphic-concave-sm rounded focus:ring-primary border-none" />
                            </div>
                        </div>
                        <div>
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full flex justify-center items-center py-3 px-4 rounded-xl shadow-neumorphic-convex hover:shadow-neumorphic-convex-sm active:shadow-neumorphic-concave-sm transition-all text-sm font-medium text-primary bg-light disabled:opacity-50 disabled:cursor-wait"
                            >
                                {isLoading ? <Spinner /> : 'התחבר'}
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
             {isRegisterModalOpen && (
                <RegistrationModal
                    isOpen={isRegisterModalOpen}
                    onClose={() => setRegisterModalOpen(false)}
                    onRegister={handleRegister}
                />
            )}
        </>
    );
};

export default LoginView;