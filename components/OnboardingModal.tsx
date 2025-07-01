import React from 'react';
import { User } from '../types';
import Icon from './Icon';

interface OnboardingModalProps {
  user: User;
  onClose: () => void;
  onGoToCreateTeam: () => void;
}

const OnboardingModal: React.FC<OnboardingModalProps> = ({ user, onClose, onGoToCreateTeam }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
        className="bg-medium rounded-lg shadow-2xl w-full max-w-lg text-right relative border border-dark"
        onClick={e => e.stopPropagation()}
      >
        <button onClick={onClose} aria-label="סגור חלון" className="absolute top-3 left-3 text-dimmed hover:text-primary p-1">
            <Icon name="close" className="w-6 h-6" />
        </button>
        
        <div className="p-8 text-center">
            <div className="inline-block bg-accent rounded-lg p-3 mb-4">
                <Icon name="sparkles" className="w-8 h-8 text-primary"/>
            </div>
            <h2 id="onboarding-title" className="text-2xl font-bold text-primary mb-2">
                ברוך הבא, {user.name}!
            </h2>
            <p className="text-dimmed mb-6">
                סביבת העבודה החדשה שלך נוצרה בהצלחה. אתה כעת מנהל המערכת.
            </p>
            <div className="bg-light p-4 rounded-lg border border-dark">
                <p className="text-primary mb-4">הצעד הראשון שלך הוא ליצור את הצוות הראשון שלך כדי שתוכל להתחיל להקצות משימות.</p>
                <button 
                    onClick={onGoToCreateTeam}
                    className="w-full flex justify-center items-center gap-2 px-6 py-2.5 text-sm font-semibold rounded-md bg-primary hover:bg-primary/90 text-light"
                >
                    <Icon name="plus" className="w-5 h-5" />
                    צור את הצוות הראשון שלך
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default OnboardingModal;