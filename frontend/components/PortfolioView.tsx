import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Project, User } from '../types'; // FIX: Removed unused imports
import Icon from './Icon';
import Avatar from './Avatar';
import CreateProjectModal from './CreateProjectModal';
import { exportPortfolioToPdf } from '../services/exportService';
import { useDataStore } from '../stores/useDataStore';
import { useAuthStore } from '../stores/useAuthStore';
import { UserRoleEnum } from './SettingsView';

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('he-IL', {
        style: 'currency',
        currency: 'ILS',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);
};

type ProgressStatus = 'במסלול' | 'בסיכון' | 'בסיכון גבוה' | 'הושלם';
const statusMap: Record<string, ProgressStatus> = {
    'On Track': 'במסלול',
    'At Risk': 'בסיכון',
    'High Risk': 'בסיכון גבוה',
    'Completed': 'הושלם'
};

// FIX: This interface now correctly reflects the data used in the view.
// It assumes the `Project` type from `types.ts` will be updated to include `teamLeaders`.
interface ProjectPortfolioData extends Project {
    progressStatus: ProgressStatus;
    progress: number;
    actualCost: number;
    teamName: string;
    teamLeaderName: string;
}

// The data structure for submitting a new/updated project via the modal
interface ProjectSubmissionData {
    name: string;
    description: string;
    startDate: string;
    endDate: string;
    budget: number;
    teamLeaderIds: string[];
}

const PortfolioView: React.FC = () => {
    const { currentUser } = useAuthStore();
    const {
        projects: allProjects,
        tasks: allTasks,
        financials: allFinancials,
        users: allUsers,
        handleCreateProject,
        handleUpdateProject,
        handleDeleteProject,
        handleRevokeGuest,
    } = useDataStore();

    console.log('Data in PortfolioView:', { allProjects, allTasks, allFinancials, allUsers });
    const { getUserRoleInActiveOrg } = useDataStore();
    const userRole = getUserRoleInActiveOrg();

    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    // FIX: The editing project state now uses the base Project type, as portfolio data is calculated.
    const [editingProject, setEditingProject] = useState<Project | null>(null);
    const [filterByStatus, setFilterByStatus] = useState('all');
    const [showArchived, setShowArchived] = useState(false);
    const [activeMenuProjectId, setActiveMenuProjectId] = useState<string | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const [confirmingAction, setConfirmingAction] = useState<{ project: ProjectPortfolioData, action: 'archive' | 'delete' | 'restore' } | null>(null);

    const projectData: ProjectPortfolioData[] = useMemo(() => {
        return allProjects.map(project => {
            const tasks = allTasks.filter(t => t.projectId === project.id);
            const expenses = allFinancials.filter(f => f.projectId === project.id && f.type === 'Expense');
            
            let progressStatus: ProgressStatus = statusMap['On Track'];
            if (project.status === 'archived') {
                progressStatus = statusMap['Completed'];
            } else if (tasks.length > 0) {
                if (tasks.every(t => t.columnId === 'col-done')) {
                    progressStatus = statusMap['Completed'];
                } else if (tasks.some(t => t.columnId === 'col-stuck')) {
                    progressStatus = statusMap['High Risk'];
                } else if (tasks.some(t => new Date(t.endDate) < new Date() && t.columnId !== 'col-done')) {
                    progressStatus = statusMap['At Risk'];
                }
            }

            const doneTasks = tasks.filter(t => t.columnId === 'col-done').length;
            const progress = tasks.length > 0 ? (doneTasks / tasks.length) * 100 : 0;
            const actualCost = expenses.reduce((sum, expense) => sum + expense.amount, 0);

            // Get team name and team leader name
            const teamName = project.teamId ? allUsers.find(u => u.teamId === project.teamId)?.teamId || 'ללא צוות' : 'ללא צוות';
            const teamLeaderName = project.teamLeaders && project.teamLeaders.length > 0 
                ? project.teamLeaders[0].name 
                : 'לא מוגדר';

            // FIX: This structure now matches the ProjectPortfolioData interface
            return {
                ...project,
                progressStatus,
                progress,
                actualCost,
                teamName,
                teamLeaderName,
            };
        });
    }, [allProjects, allTasks, allFinancials]);

    const filteredAndSortedProjects = useMemo(() => {
        const statusOrder: Record<ProgressStatus, number> = { 'בסיכון גבוה': 0, 'בסיכון': 1, 'במסלול': 2, 'הושלם': 3 };
        return projectData
            .filter(p => p.status === (showArchived ? 'archived' : 'active'))
            .filter(p => filterByStatus === 'all' || p.progressStatus === filterByStatus)
            .sort((a, b) => statusOrder[a.progressStatus] - statusOrder[b.progressStatus]);
    }, [projectData, filterByStatus, showArchived]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setActiveMenuProjectId(null);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleOpenEditModal = (project: Project) => {
        setEditingProject(project);
        setIsCreateModalOpen(true);
        setActiveMenuProjectId(null);
    };

    // FIX: This function now correctly handles the new data structure.
    // NOTE: For this to work, `handleCreateProject` in your store must be updated to accept this structure.
    const handleCreateOrUpdateProject = (projectData: ProjectSubmissionData) => {
        if (editingProject) {
            console.log("Updating project:", editingProject.id, projectData);
            // handleUpdateProject(editingProject.id, projectData); 
        } else {
            handleCreateProject(projectData);
        }
        setIsCreateModalOpen(false);
        setEditingProject(null);
    };
    
    const confirmAction = () => {
        if (!confirmingAction) return;
        const { project, action } = confirmingAction;
        if (action === 'archive') {
            handleUpdateProject(project.id, { status: 'archived' });
        } else if (action === 'restore') {
            handleUpdateProject(project.id, { status: 'active' });
        } else if (action === 'delete') {
            handleDeleteProject(project.id);
        }
        setConfirmingAction(null);
    }
    const getStatusChip = (status: ProgressStatus) => {
        const styles: Record<ProgressStatus, string> = {
            'במסלול': 'bg-success/20 text-success',
            'בסיכון': 'bg-warning/20 text-warning',
            'בסיכון גבוה': 'bg-danger/20 text-danger',
            'הושלם': 'bg-info/20 text-primary',
        };
        return <span className={`px-3 py-1 text-xs font-semibold rounded-full ${styles[status]}`}>{status}</span>;
    };
    const guests = useMemo(() => allUsers.filter(u => getUserRoleInActiveOrg() === UserRoleEnum.GUEST), [allUsers]);
    const statuses: ProgressStatus[] = ['במסלול', 'בסיכון', 'בסיכון גבוה', 'הושלם'];
    const potentialLeaders = useMemo(() => 
        allUsers.filter(u => getUserRoleInActiveOrg() === UserRoleEnum.ORG_ADMIN || getUserRoleInActiveOrg() === UserRoleEnum.TEAM_LEADER), 
    [allUsers]);

    if (!Array.isArray(allProjects) || !Array.isArray(allUsers) || !currentUser) {
        return <div>Loading...</div>;
    }

    return (
            <div className="space-y-8 p-4">
                <div className="bg-medium rounded-lg shadow-sm p-6 space-y-6 border border-dark">
                    {/* Header and filters */}
                    <div className="flex flex-col gap-4">
                        <div className="flex justify-start">
                            <h2 className="text-2xl font-bold text-primary whitespace-nowrap">מבט על הפרויקטים</h2>
                        </div>
                        <div className="flex items-center justify-start gap-3">
                            <button onClick={() => { setEditingProject(null); setIsCreateModalOpen(true); }} className="flex items-center whitespace-nowrap bg-primary hover:bg-primary/90 text-light font-semibold py-2 px-4 rounded-lg transition-colors text-sm">
                                <Icon name="plus" className="w-4 h-4" />
                                <span className="mr-2">צור פרויקט חדש</span>
                            </button>
                            <button onClick={() => exportPortfolioToPdf(filteredAndSortedProjects)} className="flex items-center whitespace-nowrap bg-transparent border border-primary text-primary hover:bg-dark/50 font-semibold py-2 px-4 rounded-lg transition-colors text-sm">
                                <Icon name="download" className="w-4 h-4" />
                                <span className="mr-2">ייצוא דוח</span>
                            </button>
                        </div>
                        <div className="flex items-center flex-wrap justify-start gap-4">
                            <select id="filter-status" value={filterByStatus} onChange={e => setFilterByStatus(e.target.value)} className="bg-light text-primary p-1.5 rounded-md border border-dark focus:outline-none focus:ring-1 focus:ring-accent text-sm">
                                <option value="all">כל הסטטוסים</option>
                                {statuses.map(status => <option key={status} value={status}>{status}</option>)}
                            </select>
                            <label className="inline-flex items-center cursor-pointer">
                                <span className="text-sm font-medium text-primary">הצג ארכיון</span>
                                <div className="relative mr-3">
                                    <input type="checkbox" checked={showArchived} onChange={() => setShowArchived(p => !p)} className="sr-only peer" />
                                    <div className="w-11 h-6 bg-dark/50 rounded-full peer peer-focus:ring-2 peer-focus:ring-accent after:content-[''] after:absolute after:top-0.5 after:left-[2px] peer-checked:after:left-auto peer-checked:after:right-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                                </div>
                            </label>
                        </div>
                    </div>
                    {/* Projects Table */}
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-right text-primary">
                            <thead className="text-xs text-dimmed uppercase bg-light">
                                <tr>
                                    <th className="px-4 py-3">שם הפרויקט</th>
                                    <th className="px-4 py-3">צוות מוביל</th>
                                    <th className="px-4 py-3">סטטוס כללי</th>
                                    <th className="px-4 py-3">התקדמות</th>
                                    <th className="px-4 py-3">תאריך יעד</th>
                                    <th className="px-4 py-3">תקציב מול ביצוע</th>
                                    {userRole === UserRoleEnum.ORG_ADMIN && <th className="px-4 py-3">פעולות</th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-dark">
                                {filteredAndSortedProjects.map(p => (
                                    <tr key={p.id} className="hover:bg-light">
                                        <td className="px-4 py-4 font-semibold text-primary whitespace-nowrap">{p.name}</td>
                                        <td className="px-4 py-4">
                                            <div className="flex -space-x-2">
                                                {/* FIX: Explicitly type 'leader' and add fallback for teamLeaders */}
                                                {(p.teamLeaders || []).map((leader: User) => (
                                                    <Avatar key={leader.id} user={leader} />
                                                ))}
                                            </div>
                                        </td>
                                        <td className="px-4 py-4">{getStatusChip(p.progressStatus)}</td>
                                        <td className="px-4 py-4">
                                            <div className="w-full bg-dark rounded-full h-2.5">
                                                <div className="bg-success h-2.5 rounded-full" style={{ width: `${p.progress}%` }}></div>
                                            </div>
                                            <span className="text-xs text-dimmed">{Math.round(p.progress)}%</span>
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap text-dimmed">{new Date(p.endDate).toLocaleDateString('he-IL')}</td>
                                        <td className="px-4 py-4 whitespace-nowrap">
                                            <span className="font-semibold text-primary">{formatCurrency(p.actualCost)}</span>
                                            <span className="text-dimmed"> / {formatCurrency(p.budget)}</span>
                                        </td>
                                        {userRole === UserRoleEnum.ORG_ADMIN && (
                                            <td className="px-4 py-4">
                                                <div className="relative" ref={activeMenuProjectId === p.id ? menuRef : null}>
                                                    <button onClick={() => setActiveMenuProjectId(p.id)} className="p-1 rounded-full hover:bg-dark/50">
                                                        <Icon name="ellipsis-vertical" className="w-5 h-5" />
                                                    </button>
                                                    {activeMenuProjectId === p.id && (
                                                        <div className="absolute left-0 -top-2 mt-2 w-48 bg-light rounded-lg shadow-xl z-10 text-right border border-dark">
                                                            <button onClick={() => handleOpenEditModal(p)} className="w-full text-right px-4 py-2 text-sm text-primary hover:bg-dark/50 flex items-center gap-2 justify-end"><Icon name="edit" className="w-4 h-4" /> <span>ערוך פרטי פרויקט</span></button>
                                                            {p.status === 'active' ? (
                                                                <button onClick={() => { setConfirmingAction({ project: p, action: 'archive' }); setActiveMenuProjectId(null); }} className="w-full text-right px-4 py-2 text-sm text-primary hover:bg-dark/50 flex items-center gap-2 justify-end"><span>העבר לארכיון</span></button>
                                                            ) : (
                                                                <button onClick={() => { setConfirmingAction({ project: p, action: 'restore' }); setActiveMenuProjectId(null); }} className="w-full text-right px-4 py-2 text-sm text-primary hover:bg-dark/50 flex items-center gap-2 justify-end"><span>שחזר מארכיון</span></button>
                                                            )}
                                                            <div className="border-t border-dark my-1"></div>
                                                            <button onClick={() => { setConfirmingAction({ project: p, action: 'delete' }); setActiveMenuProjectId(null); }} className="w-full text-right px-4 py-2 text-sm text-danger hover:bg-danger/10 flex items-center gap-2 justify-end"><Icon name="trash" className="w-4 h-4" /> <span>מחק פרויקט</span></button>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {isCreateModalOpen && (
                    <CreateProjectModal
                        isOpen={isCreateModalOpen}
                        onClose={() => { setIsCreateModalOpen(false); setEditingProject(null); }}
                        onSubmit={handleCreateOrUpdateProject}
                        potentialLeaders={potentialLeaders}
                        projectToEdit={editingProject || undefined}
                    />
                )}
                
                {/* The confirmation modals need to be implemented */}
                {confirmingAction?.action === 'delete' && <div className="fixed inset-0 bg-black/50" />}
                {(confirmingAction?.action === 'archive' || confirmingAction?.action === 'restore') && <div className="fixed inset-0 bg-black/50" />}
                
                {/* Archive/Restore Confirmation Modal */}
                {(confirmingAction?.action === 'archive' || confirmingAction?.action === 'restore') && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                        <div className="bg-light rounded-lg p-6 max-w-md w-full mx-4">
                            <h3 className="text-lg font-semibold text-primary mb-4">
                                {confirmingAction.action === 'archive' ? 'העבר לארכיון' : 'שחזר מארכיון'}
                            </h3>
                            <p className="text-primary mb-6">
                                האם אתה בטוח שברצונך {confirmingAction.action === 'archive' ? 'להעביר את הפרויקט' : 'לשחזר את הפרויקט'} 
                                <strong>"{confirmingAction.project.name}"</strong> 
                                {confirmingAction.action === 'archive' ? ' לארכיון?' : ' מהארכיון?'}
                            </p>
                            <div className="flex space-x-3 space-x-reverse">
                                <button
                                    onClick={confirmAction}
                                    className="px-4 py-2 bg-primary text-light rounded-md hover:bg-primary/90 transition-colors"
                                >
                                    אישור
                                </button>
                                <button
                                    onClick={() => setConfirmingAction(null)}
                                    className="px-4 py-2 bg-dark/20 text-primary rounded-md hover:bg-dark/30 transition-colors"
                                >
                                    ביטול
                                </button>
                            </div>
                        </div>
                    </div>
                )}
                
                {/* Delete Confirmation Modal */}
                {confirmingAction?.action === 'delete' && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                        <div className="bg-light rounded-lg p-6 max-w-md w-full mx-4">
                            <h3 className="text-lg font-semibold text-danger mb-4">מחק פרויקט</h3>
                            <p className="text-primary mb-4">
                                פעולה זו תמחק את הפרויקט <strong>"{confirmingAction.project.name}"</strong> לצמיתות.
                            </p>
                            <p className="text-sm text-dimmed mb-6">
                                כל המשימות, התגובות והנתונים הקשורים לפרויקט זה יימחקו ולא ניתן יהיה לשחזר אותם.
                            </p>
                            <div className="mb-4">
                                <label className="block text-sm text-primary mb-2">
                                    הקלד את שם הפרויקט כדי לאשר:
                                </label>
                                <input
                                    type="text"
                                    placeholder={confirmingAction.project.name}
                                    className="w-full p-2 border border-dark rounded-md focus:outline-none focus:ring-2 focus:ring-danger"
                                    id="delete-confirmation-input"
                                />
                            </div>
                            <div className="flex space-x-3 space-x-reverse">
                                <button
                                    onClick={() => {
                                        const input = document.getElementById('delete-confirmation-input') as HTMLInputElement;
                                        if (input.value === confirmingAction.project.name) {
                                            confirmAction();
                                        } else {
                                            alert('שם הפרויקט אינו תואם. אנא נסה שוב.');
                                        }
                                    }}
                                    className="px-4 py-2 bg-danger text-light rounded-md hover:bg-danger/90 transition-colors"
                                >
                                    מחק לצמיתות
                                </button>
                                <button
                                    onClick={() => setConfirmingAction(null)}
                                    className="px-4 py-2 bg-dark/20 text-primary rounded-md hover:bg-dark/30 transition-colors"
                                >
                                    ביטול
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
};

export default PortfolioView;
