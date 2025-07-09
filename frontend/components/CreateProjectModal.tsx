import React, { useState, useEffect } from 'react';
import { Project, User } from '../types';
import { useAuthStore } from '../stores/useAuthStore';
import { useDataStore } from '../stores/useDataStore';
import { useUIStore } from '../stores/useUIStore';
import Icon from './Icon';
import LimitExceededModal from './LimitExceededModal';
import Avatar from './Avatar'; // Assuming you have an Avatar component

// Define the data structure for submitting a new project
interface ProjectSubmissionData {
    name: string;
    description: string;
    startDate: string;
    endDate: string;
    budget: number;
    teamLeaderIds: string[]; // Changed from teamId
}

interface CreateProjectModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (projectData: ProjectSubmissionData) => void;
    // The list of users who can be assigned as leaders
    potentialLeaders?: User[]; // FIX: Made this prop optional
    // The project to edit might have a list of teamLeaders
    projectToEdit?: Project & { teamLeaders?: User[] };
}

// FIX: Added a default empty array for potentialLeaders to prevent crash
const CreateProjectModal: React.FC<CreateProjectModalProps> = ({ isOpen, onClose, onSubmit, potentialLeaders = [], projectToEdit }) => {
    const { subscriptionInfo } = useDataStore();
    const { setNotification } = useUIStore();
    
    const [showLimitModal, setShowLimitModal] = useState(false);
    const [limitModalData, setLimitModalData] = useState({
        limitType: 'projects' as 'projects' | 'companies',
        currentCount: 0,
        limit: 0,
        planName: ''
    });
    
    const isEditing = !!projectToEdit;
    const d = (days: number) => new Date(Date.now() + days * 86400000).toISOString().split('T')[0];

    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [startDate, setStartDate] = useState(d(0));
    const [endDate, setEndDate] = useState(d(30));
    const [budget, setBudget] = useState('');
    // NEW: State for managing multiple team leader IDs
    const [teamLeaderIds, setTeamLeaderIds] = useState<string[]>([]);

    useEffect(() => {
        if (isEditing && projectToEdit) {
            setName(projectToEdit.name);
            setDescription(projectToEdit.description || '');
            setStartDate(new Date(projectToEdit.startDate).toISOString().split('T')[0]);
            setEndDate(new Date(projectToEdit.endDate).toISOString().split('T')[0]);
            setBudget(String(projectToEdit.budget));
            // Set the initial team leaders from the project being edited
            setTeamLeaderIds(projectToEdit.teamLeaders ? projectToEdit.teamLeaders.map(u => u.id) : []);
        } else {
            // Reset form for new project creation
            setName('');
            setDescription('');
            setStartDate(d(0));
            setEndDate(d(30));
            setBudget('');
            setTeamLeaderIds([]);
        }
    }, [projectToEdit, isEditing, isOpen]); // Rerun when the modal opens

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim() || !startDate || !endDate) return;

        // Check subscription limits for new projects only
        if (!isEditing && subscriptionInfo) {
            if (subscriptionInfo.projectCount >= subscriptionInfo.projectLimit) {
                setLimitModalData({
                    limitType: 'projects',
                    currentCount: subscriptionInfo.projectCount,
                    limit: subscriptionInfo.projectLimit,
                    planName: subscriptionInfo.currentPlan.toLowerCase()
                });
                setShowLimitModal(true);
                return;
            }
        }

        onSubmit({
            name,
            description,
            startDate,
            endDate,
            budget: budget ? parseFloat(budget) : 0,
            teamLeaderIds, // Pass the array of leader IDs
        });

        onClose();
    };

    const handleUpgrade = () => {
        // Navigate to subscription page
        window.location.href = '/settings?section=billing';
    };

    const handleLeaderToggle = (userId: string) => {
        setTeamLeaderIds(prev => 
            prev && prev.includes(userId) ? prev.filter(id => id !== userId) : [...(prev || []), userId]
        );
    };

    if (!isOpen) return null;

    const modalTitle = isEditing ? `ערוך פרויקט: ${projectToEdit.name}` : 'יצירת פרויקט חדש';
    const submitButtonText = isEditing ? 'שמור שינויים' : 'צור פרויקט';

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
                    <h2 id="create-project-modal-title" className="text-2xl font-bold text-primary">{modalTitle}</h2>
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

                    {/* NEW: Multi-select for Team Leaders */}
                    <div>
                        <label className="font-semibold text-dimmed mb-1 block">שייך ראשי צוות</label>
                        <div className="w-full bg-light text-primary p-2 rounded-md border border-dark max-h-48 overflow-y-auto">
                            {potentialLeaders.map(leader => (
                                <div key={leader.id} className="flex items-center p-1.5 rounded-md hover:bg-dark/50">
                                    <input
                                        id={`leader-${leader.id}`}
                                        type="checkbox"
                                        checked={teamLeaderIds && teamLeaderIds.includes(leader.id)}
                                        onChange={() => handleLeaderToggle(leader.id)}
                                        className="h-4 w-4 rounded border-gray-300 text-accent focus:ring-accent"
                                    />
                                    <label htmlFor={`leader-${leader.id}`} className="mr-3 flex items-center cursor-pointer text-primary">
                                        <Avatar user={leader} />
                                        <span className="ml-2">{leader.name}</span>
                                    </label>
                                </div>
                            ))}
                        </div>
                        <p className="text-xs text-dimmed mt-1">יוצר הפרויקט יתווסף אוטומטית כראש צוות.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    <button type="submit" disabled={!name.trim()} className="px-6 py-2 text-sm font-semibold rounded-md bg-primary hover:bg-primary/90 text-light disabled:opacity-50 disabled:cursor-not-allowed">
                        {submitButtonText}
                    </button>
                    <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-md text-primary bg-dark/50 hover:bg-dark">
                        ביטול
                    </button>
                </footer>
            </form>
            
            <LimitExceededModal
                isOpen={showLimitModal}
                onClose={() => setShowLimitModal(false)}
                onUpgrade={handleUpgrade}
                limitType={limitModalData.limitType}
                currentCount={limitModalData.currentCount}
                limit={limitModalData.limit}
                planName={limitModalData.planName}
            />
        </div>
    );
};

export default CreateProjectModal;
