import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Icon from './Icon';
import Spinner from './Spinner';

interface LegalDocumentModalProps {
  documentType: 'terms' | 'privacy';
  onClose: () => void;
}

const LegalDocumentModal: React.FC<LegalDocumentModalProps> = ({ documentType, onClose }) => {
  const [markdown, setMarkdown] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const docDetails = {
    terms: {
      title: 'תנאי שימוש',
      path: '/legal/terms-of-service.md',
    },
    privacy: {
      title: 'מדיניות פרטיות',
      path: '/legal/privacy-policy.md',
    },
  };

  const currentDoc = docDetails[documentType];

  useEffect(() => {
    setIsLoading(true);
    fetch(currentDoc.path)
      .then(response => response.text())
      .then(text => {
        setMarkdown(text);
        setIsLoading(false);
      })
      .catch(error => {
        console.error('Error fetching legal document:', error);
        setMarkdown('לא ניתן היה לטעון את המסמך.');
        setIsLoading(false);
      });
  }, [documentType, currentDoc.path]);

  return (
    <div
      className="fixed inset-0 bg-black/80 flex justify-center items-center z-[60] p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="legal-doc-title"
        className="bg-medium rounded-lg shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col text-right border border-dark"
        onClick={e => e.stopPropagation()}
      >
        <header className="p-4 border-b border-dark flex justify-between items-center sticky top-0 bg-medium">
          <button
            type="button"
            onClick={onClose}
            aria-label="סגור חלון"
            className="text-dimmed hover:text-primary p-1 rounded-full hover:bg-dark/50"
          >
            <Icon name="close" className="w-6 h-6" />
          </button>
          <h2 id="legal-doc-title" className="text-xl font-bold text-primary">
            {currentDoc.title}
          </h2>
        </header>
        <main className="p-6 flex-grow overflow-y-auto">
          {isLoading ? (
            <div className="flex justify-center items-center h-48">
              <Spinner />
            </div>
          ) : (
            <div className="prose prose-sm md:prose-base prose-headings:font-bold prose-headings:text-primary prose-p:text-primary prose-strong:text-primary prose-li:marker:text-primary max-w-none text-right">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
            </div>
          )}
        </main>
        <footer className="p-3 border-t border-dark bg-medium/50 flex justify-start">
            <button
                type="button"
                onClick={onClose}
                className="px-6 py-2 text-sm font-semibold rounded-md bg-dark/50 hover:bg-dark text-primary"
              >
                סגור
            </button>
        </footer>
      </div>
    </div>
  );
};

export default LegalDocumentModal;