import React from 'react';

interface LegalDocumentViewProps {
    title: string;
    content: string;
    onBack: () => void;
}

const LegalDocumentView: React.FC<LegalDocumentViewProps> = ({ title, content, onBack }) => {
    return (
        <div className="min-h-screen bg-light flex flex-col justify-center items-center p-4 font-sans">
            <div className="bg-medium rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col text-right border border-dark">
                <header className="p-4 border-b border-dark flex justify-between items-center">
                    <button onClick={onBack} className="text-accent hover:underline text-sm">
                        חזרה להרשמה &rarr;
                    </button>
                    <h2 className="text-2xl font-bold text-primary">{title}</h2>
                </header>
                <main className="p-6 flex-grow overflow-y-auto text-primary leading-relaxed" style={{ maxHeight: 'calc(90vh - 65px)' }}>
                    <p className="whitespace-pre-wrap">{content}</p>
                </main>
            </div>
        </div>
    );
};

export default LegalDocumentView;