import React from 'react';
import { useUIStore } from '../../stores/useUIStore';
import Icon from './Icon';

interface LimitExceededModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpgrade: () => void;
  limitType: 'projects' | 'companies';
  currentCount: number;
  limit: number;
  planName: string;
}

const LimitExceededModal: React.FC<LimitExceededModalProps> = ({
  isOpen,
  onClose,
  onUpgrade,
  limitType,
  currentCount,
  limit,
  planName
}) => {
  const { setNotification } = useUIStore();

  if (!isOpen) return null;

  const getLimitTypeText = () => {
    return limitType === 'projects' ? 'פרויקטים' : 'חברות';
  };

  const handleUpgrade = () => {
    onUpgrade();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-light rounded-xl p-6 max-w-md w-full shadow-neumorphic-convex">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-warning/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Icon name="warning" className="w-8 h-8 text-warning" />
          </div>
          <h3 className="text-xl font-bold text-primary mb-2">הגעת למגבלת התוכנית</h3>
          <p className="text-secondary">
            הגעת למגבלת {getLimitTypeText()} המותרת בתוכנית ה-{planName} שלך.
          </p>
        </div>

        <div className="bg-dark/10 rounded-lg p-4 mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-secondary">{getLimitTypeText()} נוכחיים:</span>
            <span className="font-semibold text-primary">{currentCount}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-secondary">מגבלת התוכנית:</span>
            <span className="font-semibold text-primary">{limit}</span>
          </div>
        </div>

        <div className="space-y-3">
          <button
            onClick={handleUpgrade}
            className="w-full bg-accent text-light py-3 px-4 rounded-lg font-semibold hover:bg-accent/80 transition-colors"
          >
            שדרג עכשיו
          </button>
          <button
            onClick={onClose}
            className="w-full bg-dark/20 text-primary py-3 px-4 rounded-lg font-semibold hover:bg-dark/30 transition-colors"
          >
            ביטול
          </button>
        </div>

        <div className="mt-4 text-center">
          <p className="text-xs text-secondary">
            שדרוג התוכנית יאפשר לך ליצור {limitType === 'projects' ? 'פרויקטים' : 'חברות'} נוספים
          </p>
        </div>
      </div>
    </div>
  );
};

export default LimitExceededModal; 