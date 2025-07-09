// components/ForgotPasswordModal.tsx
import React, { useState } from 'react';
import { useAuthStore } from '../../stores/useAuthStore';
import { useUIStore } from '../../stores/useUIStore';
import Icon from './Icon';
import Spinner from './Spinner'; // ודא שיש לך קומפוננטת ספינר

interface ForgotPasswordModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({ isOpen, onClose }) => {
    const [email, setEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState('');
    const { forgotPassword } = useAuthStore();
    const { setNotification } = useUIStore();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setMessage('');

        const response = await forgotPassword(email); // קריאה לפונקציה מה-store

        if (response.success) {
            setMessage(response.message);
            setNotification({ message: response.message, type: 'success' });
            // Optional: close modal after a short delay
            setTimeout(onClose, 3000);
        } else {
            setMessage(response.message);
            setNotification({ message: response.message, type: 'error' });
        }
        setIsLoading(false);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50 p-4" onClick={onClose}>
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="forgot-password-title"
                className="bg-medium rounded-lg shadow-2xl w-full max-w-sm border border-dark"
                onClick={e => e.stopPropagation()}
            >
                <header className="p-4 border-b border-dark flex justify-between items-center">
                    <button type="button" onClick={onClose} aria-label="סגור חלון" className="text-dimmed hover:text-primary"><Icon name="close" /></button>
                    <h2 id="forgot-password-title" className="text-xl font-bold text-primary">שכחתי סיסמה</h2>
                </header>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <p className="text-sm text-dimmed">אנא הזן את כתובת המייל שלך ואנו נשלח לך קישור לאיפוס סיסמה.</p>
                    <div>
                        <label htmlFor="email" className="text-sm text-dimmed block mb-1">כתובת אימייל</label>
                        <input
                            type="email"
                            id="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full bg-light p-2 rounded-md text-primary border border-dark"
                            required
                        />
                    </div>
                    {message && (
                        <p className={`text-sm ${message.includes('נשלח') ? 'text-success' : 'text-danger'}`}>
                            {message}
                        </p>
                    )}
                    <div className="flex justify-end">
                        <button
                            type="submit"
                            className="px-4 py-2 bg-primary hover:bg-primary/90 text-light rounded-md text-sm flex items-center justify-center"
                            disabled={isLoading}
                        >
                            {isLoading ? <Spinner className="w-4 h-4 mr-2" /> : 'שלח קישור לאיפוס'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ForgotPasswordModal;