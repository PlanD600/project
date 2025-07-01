import React, { useState } from 'react';
import Icon from './Icon';
import Spinner from './Spinner';
import LegalDocumentModal from './LegalDocumentModal';

interface RegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRegister: (data: {
    fullName: string;
    email: string;
    password: string;
    companyName: string;
  }) => Promise<string | null>;
}

const RegistrationModal: React.FC<RegistrationModalProps> = ({ isOpen, onClose, onRegister }) => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [termsAgreed, setTermsAgreed] = useState(false);
  
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [legalDocToShow, setLegalDocToShow] = useState<'terms' | 'privacy' | null>(null);

  const passwordsMatch = password && password === confirmPassword;
  const isFormValid = fullName && email && companyName && password && passwordsMatch && termsAgreed;
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!passwordsMatch) {
      setError('הסיסמאות אינן תואמות.');
      return;
    }
    if (!isFormValid) {
        setError('אנא מלא את כל שדות החובה והסכם לתנאים.');
        return;
    }

    setIsLoading(true);
    const registrationError = await onRegister({ fullName, email, password, companyName });
    if (registrationError) {
      setError(registrationError);
    } else {
      onClose(); // Success
    }
    setIsLoading(false);
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50 p-4" onClick={onClose}>
        <form
          role="dialog"
          aria-modal="true"
          aria-labelledby="registration-modal-title"
          className="bg-medium rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col text-right border border-dark"
          onClick={e => e.stopPropagation()}
          onSubmit={handleSubmit}
        >
          <header className="p-4 border-b border-dark flex justify-between items-center">
            <button type="button" onClick={onClose} aria-label="סגור חלון" className="text-dimmed hover:text-primary">
              <Icon name="close" className="w-7 h-7" />
            </button>
            <h2 id="registration-modal-title" className="text-2xl font-bold text-primary">יצירת סביבת עבודה חדשה</h2>
          </header>

          <main className="p-6 flex-grow overflow-y-auto space-y-4">
            {error && <div className="bg-danger/20 text-danger text-sm p-3 rounded-md text-center">{error}</div>}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="reg-fullname" className="font-semibold text-dimmed mb-1 block">שם מלא <span className="text-danger">*</span></label>
                <input id="reg-fullname" type="text" value={fullName} onChange={e => setFullName(e.target.value)} required className="w-full bg-light text-primary p-2 rounded-md border border-dark focus:outline-none focus:ring-2 focus:ring-accent" />
              </div>
              <div>
                <label htmlFor="reg-email" className="font-semibold text-dimmed mb-1 block">כתובת אימייל <span className="text-danger">*</span></label>
                <input id="reg-email" type="email" value={email} onChange={e => setEmail(e.target.value)} required className="w-full bg-light text-primary p-2 rounded-md border border-dark focus:outline-none focus:ring-2 focus:ring-accent" />
              </div>
            </div>
            
             <div>
                <label htmlFor="reg-company" className="font-semibold text-dimmed mb-1 block">שם חברה או ארגון <span className="text-danger">*</span></label>
                <input id="reg-company" type="text" value={companyName} onChange={e => setCompanyName(e.target.value)} required className="w-full bg-light text-primary p-2 rounded-md border border-dark focus:outline-none focus:ring-2 focus:ring-accent" />
              </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="reg-password" className="font-semibold text-dimmed mb-1 block">בחר סיסמה <span className="text-danger">*</span></label>
                <input id="reg-password" type="password" value={password} onChange={e => setPassword(e.target.value)} required className="w-full bg-light text-primary p-2 rounded-md border border-dark focus:outline-none focus:ring-2 focus:ring-accent" />
                <p className="text-xs text-dimmed mt-1">לפחות 8 תווים, אות גדולה ומספר.</p>
              </div>
              <div>
                <label htmlFor="reg-confirm-password" className="font-semibold text-dimmed mb-1 block">אימות סיסמה <span className="text-danger">*</span></label>
                <input 
                  id="reg-confirm-password" 
                  type="password" 
                  value={confirmPassword} 
                  onChange={e => setConfirmPassword(e.target.value)} 
                  required 
                  aria-invalid={!!(confirmPassword && !passwordsMatch)}
                  className={`w-full bg-light text-primary p-2 rounded-md border border-dark focus:outline-none focus:ring-2 ${password && confirmPassword && !passwordsMatch ? 'ring-danger' : 'focus:ring-accent'}`} />
              </div>
            </div>
            
            <div>
              <label className="flex items-center space-x-3 space-x-reverse cursor-pointer">
                <input type="checkbox" checked={termsAgreed} onChange={() => setTermsAgreed(p => !p)} className="h-5 w-5 rounded bg-light border-dark text-accent focus:ring-accent"/>
                <span className="text-sm text-primary">
                  אני מסכים/ה ל<button type="button" onClick={() => setLegalDocToShow('terms')} className="text-accent hover:underline mx-1">תנאי השימוש</button> 
                  ול<button type="button" onClick={() => setLegalDocToShow('privacy')} className="text-accent hover:underline mx-1">מדיניות הפרטיות</button>.
                </span>
              </label>
            </div>
          </main>

          <footer className="p-4 border-t border-dark bg-medium/50 flex justify-end">
            <button type="submit" disabled={!isFormValid || isLoading} className="w-full md:w-auto flex justify-center items-center px-8 py-2.5 text-sm font-semibold rounded-md bg-primary hover:bg-primary/90 text-light disabled:opacity-50 disabled:cursor-wait">
              {isLoading ? <Spinner /> : 'צור חשבון והתחבר'}
            </button>
          </footer>
        </form>
      </div>
      {legalDocToShow && (
        <LegalDocumentModal 
          documentType={legalDocToShow} 
          onClose={() => setLegalDocToShow(null)} 
        />
      )}
    </>
  );
};

export default RegistrationModal;