import React, { useState } from 'react';
import { Project, TransactionType, FinancialTransaction } from '../types';
import Icon from './Icon';

interface AddFinancialTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (transaction: Omit<FinancialTransaction, 'id'>) => void;
  type: TransactionType;
  currentUserRole: 'Super Admin' | 'Team Leader';
  projects: Project[];
}

const AddFinancialTransactionModal: React.FC<AddFinancialTransactionModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  type,
  currentUserRole,
  projects,
}) => {
  const d = (days: number) => new Date(Date.now() + days * 86400000).toISOString().split('T')[0];

  const [amount, setAmount] = useState('');
  const [source, setSource] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(d(0));
  const [projectId, setProjectId] = useState(projects[0]?.id || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !source || !projectId) return;

    const transactionData: Omit<FinancialTransaction, 'id'> = {
      type,
      date,
      source,
      description,
      amount: parseFloat(amount),
      projectId,
    };

    onSubmit(transactionData);
    onClose();
  };

  if (!isOpen) return null;

  const title = type === 'Income' ? 'הוספת הכנסה' : 'הוספת הוצאה';
  const sourceLabel = type === 'Income' ? 'מקור הכנסה/לקוח' : 'שולם ל...';
  const canSelectProject = projects.length > 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50 p-4" onClick={onClose}>
      <form 
        role="dialog"
        aria-modal="true"
        aria-labelledby="financial-modal-title"
        className="bg-medium rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col border border-dark" 
        onClick={e => e.stopPropagation()} 
        onSubmit={handleSubmit}
      >
        <header className="p-4 border-b border-dark flex justify-between items-center">
          <button type="button" onClick={onClose} aria-label="סגור חלון" className="text-dimmed hover:text-primary">
            <Icon name="close" className="w-7 h-7" />
          </button>
          <h2 id="financial-modal-title" className="text-2xl font-bold text-primary">{title}</h2>
        </header>

        <div className="p-6 flex-grow overflow-y-auto space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="amount" className="font-semibold text-dimmed mb-1 block">סכום <span className="text-danger">*</span></label>
              <input
                id="amount"
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                required
                className="w-full bg-light text-primary p-2 rounded-md border border-dark focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
            <div>
              <label htmlFor="date" className="font-semibold text-dimmed mb-1 block">תאריך <span className="text-danger">*</span></label>
              <input
                id="date"
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                required
                className="w-full bg-light text-primary p-2 rounded-md border border-dark focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
          </div>

          <div>
            <label htmlFor="source" className="font-semibold text-dimmed mb-1 block">{sourceLabel} <span className="text-danger">*</span></label>
            <input
              id="source"
              type="text"
              value={source}
              onChange={e => setSource(e.target.value)}
              required
              className="w-full bg-light text-primary p-2 rounded-md border border-dark focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          <div>
            <label htmlFor="project" className="font-semibold text-dimmed mb-1 block">שייך לפרויקט <span className="text-danger">*</span></label>
            <select
              id="project"
              value={projectId}
              onChange={e => setProjectId(e.target.value)}
              disabled={!canSelectProject}
              required
              className="w-full bg-light text-primary p-2 rounded-md border border-dark focus:outline-none focus:ring-2 focus:ring-accent disabled:cursor-not-allowed"
            >
              {canSelectProject ? (
                 projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)
              ) : (
                <option value="" disabled>אין פרויקטים זמינים</option>
              )}
            </select>
          </div>

          <div>
            <label htmlFor="description" className="font-semibold text-dimmed mb-1 block">תיאור</label>
            <textarea
              id="description"
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full bg-light text-primary p-2 rounded-md border border-dark focus:outline-none focus:ring-2 focus:ring-accent"
              rows={3}
            />
          </div>
        </div>

        <footer className="p-4 border-t border-dark bg-medium/50 flex justify-end space-x-4 space-x-reverse">
          <button type="submit" disabled={!amount || !source || !projectId} className="px-6 py-2 text-sm font-semibold rounded-md bg-primary hover:bg-primary/90 text-light disabled:opacity-50 disabled:cursor-not-allowed">
            צור רישום
          </button>
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-md text-primary bg-dark/50 hover:bg-dark">
            ביטול
          </button>
        </footer>
      </form>
    </div>
  );
};

export default AddFinancialTransactionModal;