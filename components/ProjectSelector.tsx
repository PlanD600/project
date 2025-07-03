import React from 'react';
import { Project, User } from '../types';

interface ProjectSelectorProps {
    projects: Project[];
    selectedProjectId: string | null;
    onSelectProject: (projectId: string) => void;
    currentUser: User;
}

const ProjectSelector: React.FC<ProjectSelectorProps> = ({ projects, selectedProjectId, onSelectProject, currentUser }) => {
    
    if (currentUser.role === 'EMPLOYEE') {
        return null; // EMPLOYEE do not get a project selector
    }

    const canSelect = projects.length > 0;

    return (
        <select
            value={selectedProjectId || ''}
            onChange={(e) => onSelectProject(e.target.value)}
            disabled={!canSelect}
            className="w-full bg-light text-primary p-3 rounded-xl border-none shadow-neumorphic-concave-sm focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm disabled:cursor-not-allowed disabled:opacity-60 appearance-none text-center"
        >
            {canSelect ? (
                <>
                    <option value="" disabled>בחר פרויקט...</option>
                    {projects.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                </>
            ) : (
                <option value="">אין פרויקטים זמינים</option>
            )}
        </select>
    );
};

export default ProjectSelector;