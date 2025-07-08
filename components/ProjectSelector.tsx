import React from 'react';
import { Project, User } from '../types';
import { useDataStore } from '../stores/useDataStore';
import { UserRoleEnum } from './SettingsView';
import { useAuthStore } from '../stores/useAuthStore';

interface ProjectSelectorProps {
    projects: Project[];
    selectedProjectId: string | null;
    onSelectProject: (projectId: string) => void;
    currentUser: User;
}

const ProjectSelector: React.FC = () => {
  const { projects, selectedProjectId, setSelectedProjectId, getUserRoleInActiveOrg } = useDataStore();
  const { currentUser } = useAuthStore();
  if (!Array.isArray(projects) || !currentUser) {
    return <div>Loading...</div>;
  }
  try {
    const userRole = getUserRoleInActiveOrg();

    if (userRole === UserRoleEnum.EMPLOYEE) {
        return null; // EMPLOYEE do not get a project selector
    }

    if (!Array.isArray(projects)) {
        return <div>Loading...</div>;
    }

    const canSelect = projects.length > 0;

    return (
        <select
            value={selectedProjectId || ''}
            onChange={e => setSelectedProjectId(e.target.value)}
            disabled={!canSelect}
            className="w-full bg-light text-primary p-3 rounded-xl border-none shadow-neumorphic-concave-sm focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm disabled:cursor-not-allowed disabled:opacity-60 appearance-none text-center"
        >
            {canSelect ? (
                <>
                    <option value="" disabled>בחר פרויקט</option>
                    {projects.map(project => (
                        <option key={project.id} value={project.id}>{project.name}</option>
                    ))}
                </>
            ) : (
                <option value="">אין פרויקטים זמינים</option>
            )}
        </select>
    );
  } catch (error) {
    return <div className="text-danger">שגיאה בטעינת בורר פרויקטים: {String(error)}</div>;
  }
}

export default ProjectSelector;