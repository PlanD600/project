import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Notification, User } from '../types';
import Icon from './Icon';

interface NotificationsProps {
    notifications: Notification[];
    currentUser: User;
    onSetRead: (ids: string[]) => void;
}

const timeSince = (date: string) => {
    const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);
    let interval = seconds / 31536000;
    if (interval > 1) return `לפני ${Math.floor(interval)} שנים`;
    interval = seconds / 2592000;
    if (interval > 1) return `לפני ${Math.floor(interval)} חודשים`;
    interval = seconds / 86400;
    if (interval > 1) return `לפני ${Math.floor(interval)} ימים`;
    interval = seconds / 3600;
    if (interval > 1) return `לפני ${Math.floor(interval)} שעות`;
    interval = seconds / 60;
    if (interval > 1) return `לפני ${Math.floor(interval)} דקות`;
    return `לפני ${Math.floor(seconds)} שניות`;
};

const Notifications: React.FC<NotificationsProps> = ({ notifications, currentUser, onSetRead }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const userNotifications = useMemo(() => {
        return notifications.filter(n => n.userId === currentUser.id);
    }, [notifications, currentUser]);

    const unreadCount = useMemo(() => {
        return userNotifications.filter(n => !n.read).length;
    }, [userNotifications]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleToggle = () => {
        setIsOpen(prev => !prev);
        if (!isOpen && unreadCount > 0) {
            const unreadIds = userNotifications.filter(n => !n.read).map(n => n.id);
            onSetRead(unreadIds);
        }
    };
    
    return (
        <div className="relative z-[60]" ref={dropdownRef}>
            <button 
                onClick={handleToggle} 
                className="relative p-2 rounded-full text-dimmed hover:bg-dark/50 hover:text-accent transition-colors"
                aria-haspopup="true"
                aria-expanded={isOpen}
                aria-label={`התראות, ${unreadCount} לא נקראו`}
            >
                <Icon name="bell" className="w-6 h-6" />
                {unreadCount > 0 && (
                    <span className="absolute top-0 left-0 block h-2.5 w-2.5 transform -translate-y-1/2 -translate-x-1/2 rounded-full bg-danger ring-2 ring-medium"></span>
                )}
            </button>
            {isOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-medium rounded-lg shadow-xl overflow-hidden text-right border border-dark">
                    <div id="notifications-title" className="p-3 font-bold text-primary border-b border-dark">
                        התראות
                    </div>
                    <ul role="region" aria-labelledby="notifications-title" className="max-h-96 overflow-y-auto">
                        {userNotifications.length > 0 ? (
                            userNotifications.map(n => (
                                <li key={n.id} className={`p-3 border-b border-dark/50 ${!n.read ? 'bg-accent/20' : ''}`}>
                                    <p className="text-sm text-primary">{n.text}</p>
                                    <p className="text-xs text-dimmed mt-1">{timeSince(n.timestamp)}</p>
                                </li>
                            ))
                        ) : (
                            <li className="p-4 text-center text-sm text-dimmed">
                                אין לך התראות חדשות.
                            </li>
                        )}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default Notifications;