import React, { useState } from 'react';
import Icon from './Icon';

interface InviteGuestModalProps {
    isOpen: boolean;
    onClose: () => void;
    onInvite: (email: string) => void;
}

const InviteGuestModal: React.FC<InviteGuestModalProps> = ({ isOpen, onClose, onInvite }) => {
    const [email, setEmail] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (email.trim() && email.includes('@')) {
            onInvite(email);
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50 p-4" onClick={onClose}>
            <form 
                role="dialog"
                aria-modal="true"
                aria-labelledby="invite-guest-title"
                className="bg-medium rounded-lg shadow-2xl w-full max-w-md text-right border border-dark" 
                onClick={e => e.stopPropagation()} 
                onSubmit={handleSubmit}>
                <header className="p-4 border-b border-dark flex justify-between items-center">
                     <button type="button" onClick={onClose} aria-label="סגור חלון" className="text-dimmed hover:text-primary">
                        <Icon name="close" className="w-6 h-6" />
                    </button>
                    <h2 id="invite-guest-title" className="text-xl font-bold text-primary">הזמנת אורח</h2>
                </header>
                <div className="p-6 space-y-4">
                    <p className="text-sm text-dimmed">
                        הזמן לקוח או משתף פעולה חיצוני לפרויקט זה. הם יוכלו לצפות במשימות ובצירי זמן, ולהוסיף תגובות. לא תהיה להם גישה לנתונים פיננסיים או יכולת לערוך דבר.
                    </p>
                    <div>
                        <label htmlFor="guest-email" className="font-semibold text-primary mb-1 block">כתובת האימייל של האורח</label>
                        <input
                            id="guest-email"
                            type="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            required
                            placeholder="לדוגמה: client@example.com"
                            className="w-full bg-light text-primary p-2 rounded-md border border-dark focus:outline-none focus:ring-2 focus:ring-accent"
                        />
                    </div>
                </div>
                <footer className="p-4 border-t border-dark bg-medium/50 flex justify-end space-x-4 space-x-reverse">
                     <button type="submit" disabled={!email.trim() || !email.includes('@')} className="px-6 py-2 text-sm font-semibold rounded-md bg-primary hover:bg-primary/90 text-light disabled:opacity-50">
                        שלח הזמנה
                    </button>
                    <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-md text-primary bg-dark/50 hover:bg-dark">
                        ביטול
                    </button>
                </footer>
            </form>
        </div>
    );
};

export default InviteGuestModal;