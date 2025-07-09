import React, { useEffect } from 'react';
import Icon from './Icon';

interface ToastProps {
  message: string | null;
  onClose: () => void;
  type?: 'error' | 'success' | 'info';
}

const Toast: React.FC<ToastProps> = ({ message, onClose, type = 'error' }) => {
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => {
        onClose();
      }, 5000); // Auto-dismiss after 5 seconds
      return () => clearTimeout(timer);
    }
  }, [message, onClose]);

  if (!message) return null;

  const config = {
    error: { bgColor: 'bg-danger', title: 'שגיאה' },
    success: { bgColor: 'bg-success', title: 'הצלחה' },
    info: { bgColor: 'bg-blue-500', title: 'מידע' },
  };

  const { bgColor, title } = config[type] || config.error;

  return (
    <div className={`fixed top-5 right-5 z-[100] p-4 rounded-lg shadow-lg flex items-center text-light ${bgColor} text-right`}>
      <div className="ml-3">
        <p className="font-bold">{title}</p>
        <p className="text-sm">{message}</p>
      </div>
      <button onClick={onClose} className="p-1 rounded-full hover:bg-white/20">
        <Icon name="close" className="w-5 h-5" />
      </button>
    </div>
  );
};

export default Toast;