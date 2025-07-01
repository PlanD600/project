import React, { useState } from 'react';
import { User, Project } from '../types';
import Icon from './Icon';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (projectData: Omit<Project, 'id'>) => void;
  teamLeaders: User[];
}

const CreateProjectModal: React.FC<CreateProjectModalProps> = ({ isOpen, onClose, onSubmit, teamLeaders }) => {
  const d = (days: number) => new Date(Date.now() + days * 86400000).toISOString().split('T')[0];
  
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [teamId, setTeamId] = useState(teamLeaders[0]?.teamId || '');
  const [startDate, setStartDate] = useState(d(0));
  const [endDate, setEndDate] = useState(d(30));
  const [budget, setBudget] = useState('');
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !teamId || !startDate || !endDate) return;
    
    onSubmit({
        name,
        description,
        teamId,
        startDate,
        endDate,
        budget: budget ? parseFloat(budget) : 0,
    });
    
    onClose();
  };
  
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50 p-4" onClick={onClose}>
      <form 
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-project-modal-title"
        className="bg-medium rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col border border-dark" 
        onClick={e => e.stopPropagation()} 
        onSubmit={handleSubmit}
      >
        <header className="p-4 border-b border-dark flex justify-between items-center">
          <button type="button" onClick={onClose} aria-label="סגור חלון" className="text-dimmed hover:text-primary">
            <Icon name="close" className="w-7 h-7" />
          </button>
          <h2 id="create-project-modal-title" className="text-2xl font-bold text-primary">יצירת פרויקט חדש</h2>
        </header>

        <div className="p-6 flex-grow overflow-y-auto space-y-4">
          <div>
            <label htmlFor="project-title" className="font-semibold text-dimmed mb-1 block">שם הפרויקט <span className="text-danger">*</span></label>
            <input
              id="project-title"
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              className="w-full bg-light text-primary p-2 rounded-md border border-dark focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          <div>
            <label htmlFor="project-description" className="font-semibold text-dimmed mb-1 block">תיאור הפרויקט</label>
            <textarea
              id="project-description"
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full bg-light text-primary p-2 rounded-md border border-dark focus:outline-none focus:ring-2 focus:ring-accent"
              rows={3}
            />
          </div>
          
          <div>
              <label htmlFor="assign-team" className="font-semibold text-dimmed mb-1 block">שייך לצוות <span className="text-danger">*</span></label>
              <select
                id="assign-team"
                value={teamId}
                onChange={e => setTeamId(e.target.value)}
                required
                className="w-full bg-light text-primary p-2 rounded-md border border-dark focus:outline-none focus:ring-2 focus:ring-accent"
              >
                  <option value="" disabled>בחר ראש צוות</option>
                  {teamLeaders.map(leader => (
                      <option key={leader.id} value={leader.teamId}>{leader.name}</option>
                  ))}
              </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div>
              <label htmlFor="end-date" className="font-semibold text-dimmed mb-1 block">תאריך יעד <span className="text-danger">*</span></label>
              <input
                id="end-date"
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                required
                className="w-full bg-light text-primary p-2 rounded-md border border-dark focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
            <div>
              <label htmlFor="start-date" className="font-semibold text-dimmed mb-1 block">תאריך התחלה <span className="text-danger">*</span></label>
              <input
                id="start-date"
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                required
                className="w-full bg-light text-primary p-2 rounded-md border border-dark focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
          </div>
          
           <div>
              <label htmlFor="project-budget" className="font-semibold text-dimmed mb-1 block">תקציב (אופציונלי)</label>
              <input
                id="project-budget"
                type="number"
                value={budget}
                onChange={e => setBudget(e.target.value)}
                placeholder="50000"
                className="w-full bg-light text-primary p-2 rounded-md border border-dark focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>

        </div>

        <footer className="p-4 border-t border-dark bg-medium/50 flex justify-end space-x-4 space-x-reverse">
          <button type="submit" disabled={!name.trim() || !teamId} className="px-6 py-2 text-sm font-semibold rounded-md bg-primary hover:bg-primary/90 text-light disabled:opacity-50 disabled:cursor-not-allowed">
            צור פרויקט
          </button>
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-md text-primary bg-dark/50 hover:bg-dark">
            ביטול
          </button>
        </footer>
      </form>
    </div>
  );
};

export default CreateProjectModal;