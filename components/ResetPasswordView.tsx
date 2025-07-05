// components/ResetPasswordView.tsx
import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/useAuthStore';
import { useUIStore } from '../stores/useUIStore';
import { useNavigate, useLocation } from 'react-router-dom';
import Spinner from './Spinner'; // ודא שיש לך קומפוננטת ספינר

const ResetPasswordView: React.FC = () => {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isValidToken, setIsValidToken] = useState(false);
    const { resetPassword } = useAuthStore();
    const { setNotification } = useUIStore();
    const navigate = useNavigate();
    const location = useLocation();

    // Extract token from URL
    const queryParams = new URLSearchParams(location.search);
    const token = queryParams.get('token');

    useEffect(() => {
        // In a real application, you might want to send the token to the backend
        // to verify its existence and validity on page load.
        // For now, we'll just check if a token exists in the URL.
        if (token) {
            setIsValidToken(true);
        } else {
            setNotification({ message: 'Missing password reset token.', type: 'error' });
            setTimeout(() => navigate('/login'), 3000); // Redirect to login if no token
        }
        setIsLoading(false);
    }, [token, navigate, setNotification]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        if (password !== confirmPassword) {
            setNotification({ message: 'Passwords do not match.', type: 'error' });
            setIsLoading(false);
            return;
        }

        if (!token) {
            setNotification({ message: 'No reset token found.', type: 'error' });
            setIsLoading(false);
            return;
        }

        const response = await resetPassword(token, password); // קריאה לפונקציה מה-store

        if (response.success) {
            setNotification({ message: response.message, type: 'success' });
            setTimeout(() => navigate('/login'), 3000); // Redirect to login after success
        } else {
            setNotification({ message: response.message, type: 'error' });
        }
        setIsLoading(false);
    };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-screen bg-gray-100">
                <Spinner />
                <p className="text-primary ml-2">Loading...</p>
            </div>
        );
    }

    if (!isValidToken) {
        return (
            <div className="flex justify-center items-center h-screen bg-gray-100">
                <p className="text-danger">Invalid or missing token. Redirecting...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
            <div className="bg-white rounded-lg shadow-lg p-8 w-full max-w-md text-center">
                <h2 className="text-2xl font-bold text-primary mb-6">איפוס סיסמה</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="password" className="text-sm font-medium text-dimmed block mb-1 text-right">סיסמה חדשה</label>
                        <input
                            type="password"
                            id="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full bg-light p-2 rounded-md text-primary border border-dark"
                            required
                        />
                    </div>
                    <div>
                        <label htmlFor="confirmPassword" className="text-sm font-medium text-dimmed block mb-1 text-right">אימות סיסמה חדשה</label>
                        <input
                            type="password"
                            id="confirmPassword"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="w-full bg-light p-2 rounded-md text-primary border border-dark"
                            required
                        />
                    </div>
                    <button
                        type="submit"
                        className="w-full px-4 py-2 bg-primary hover:bg-primary/90 text-light rounded-md text-sm flex items-center justify-center"
                        disabled={isLoading}
                    >
                        {isLoading ? <Spinner className="w-4 h-4 mr-2" /> : 'איפוס סיסמה'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default ResetPasswordView;