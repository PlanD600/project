import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Project, Task, FinancialTransaction, User, Team } from '../types';
import Icon from './Icon';
import Avatar from './Avatar';
import CreateProjectModal from './CreateProjectModal';
import { exportPortfolioToPdf } from '../services/exportService';
import { useDataStore } from '../stores/useDataStore';
import { useAuthStore } from '../stores/useAuthStore';


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

interface ProjectPortfolioData extends Project {
    teamName: string;
    teamLeaderName: string;
    progressStatus: ProgressStatus;
    progress: number;
    actualCost: number;
}

const PortfolioView: React.FC = () => {
    const { currentUser } = useAuthStore();
    const {
        projects: allProjects,
        tasks: allTasks,
        financials: allFinancials,
        users: allUsers,
        teams: allTeams,
        handleCreateProject,
        handleUpdateProject,
        handleDeleteProject,
        handleRevokeGuest
    } = useDataStore();

    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [editingProject, setEditingProject] = useState<ProjectPortfolioData | null>(null);
    const [filterByTeam, setFilterByTeam] = useState('all');
    const [filterByStatus, setFilterByStatus] = useState('all');
    const [showArchived, setShowArchived] = useState(false);

    const [activeMenuProjectId, setActiveMenuProjectId] = useState<string | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    const [confirmingAction, setConfirmingAction] = useState<{ project: ProjectPortfolioData, action: 'archive' | 'delete' | 'restore' } | null>(null);


    const projectData = useMemo(() => {
        return allProjects.map(project => {
            const tasks = allTasks.filter(t => t.projectId === project.id);
            const expenses = allFinancials.filter(f => f.projectId === project.id && f.type === 'Expense');
            const team = allTeams.find(t => t.id === project.teamId);
            const teamLeader = allUsers.find(u => u.role === 'TEAM_MANAGER' && u.teamId === project.teamId);

            // Status Calculation
            let progressStatus: ProgressStatus = statusMap['On Track'];
            if (project.status === 'archived') {
                progressStatus = statusMap['Completed'];
            }
            else if (tasks.length > 0) {
                if (tasks.every(t => t.columnId === 'col-done')) {
                    progressStatus = statusMap['Completed'];
                } else if (tasks.some(t => t.columnId === 'col-stuck')) {
                    progressStatus = statusMap['High Risk'];
                } else if (tasks.some(t => new Date(t.endDate) < new Date() && t.columnId !== 'col-done')) {
                    progressStatus = statusMap['At Risk'];
                }
            }

            // Progress Calculation
            const doneTasks = tasks.filter(t => t.columnId === 'col-done').length;
            const progress = tasks.length > 0 ? (doneTasks / tasks.length) * 100 : 0;

            // Budget Calculation
            const actualCost = expenses.reduce((sum, expense) => sum + expense.amount, 0);

            return {
                ...project,
                teamName: team?.name || 'אין',
                teamLeaderName: teamLeader?.name || 'אין',
                progressStatus,
                progress,
                actualCost,
            };
        });
    }, [allProjects, allTasks, allFinancials, allUsers, allTeams]);

    const filteredAndSortedProjects = useMemo(() => {
        const statusOrder: Record<ProgressStatus, number> = { 'בסיכון גבוה': 0, 'בסיכון': 1, 'במסלול': 2, 'הושלם': 3 };

        return projectData
            .filter(p => p.status === (showArchived ? 'archived' : 'active'))
            .filter(p => filterByTeam === 'all' || p.teamId === filterByTeam)
            .filter(p => filterByStatus === 'all' || p.progressStatus === filterByStatus)
            .sort((a, b) => {
                return statusOrder[a.progressStatus] - statusOrder[b.progressStatus];
            });
    }, [projectData, filterByTeam, filterByStatus, showArchived]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setActiveMenuProjectId(null);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleOpenEditModal = (project: ProjectPortfolioData) => {
        setEditingProject(project);
        setIsCreateModalOpen(true);
        setActiveMenuProjectId(null);
    };

    const handleCreateOrUpdateProject = (projectData: Omit<Project, 'id' | 'status'>) => {
        if (editingProject) {
            handleUpdateProject(editingProject.id, projectData);
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

    const guests = useMemo(() => allUsers.filter(u => u.role === 'Guest'), [allUsers]);
    const statuses: ProgressStatus[] = ['במסלול', 'בסיכון', 'בסיכון גבוה', 'הושלם'];

    return (
        <div className="space-y-8">
            <div className="bg-medium rounded-lg shadow-sm p-6 space-y-6 border border-dark">
                {/* === קוד מתוקן לסרגל העליון לפי הסדר החדש === */}
                <div className="flex flex-col gap-4">

                    {/* שורה 1: כותרת */}
                    <div className="flex justify-start">
                        <h2 className="text-2xl font-bold text-primary whitespace-nowrap">מבט על הפרויקטים</h2>
                    </div>

                    {/* שורה 2: כפתורי פעולות */}
                    <div className="flex items-center justify-start gap-3">
                        <button onClick={() => { setEditingProject(null); setIsCreateModalOpen(true); }} className="flex items-center whitespace-nowrap bg-primary hover:bg-primary/90 text-light font-semibold py-2 px-4 rounded-lg transition-colors text-sm">
                            <Icon name="plus" className="w-4 h-4" />
                            <span className="mr-2">צור פרויקט חדש</span>
                        </button>
                        <button onClick={async () => await exportPortfolioToPdf(filteredAndSortedProjects)} className="flex items-center whitespace-nowrap bg-transparent border border-primary text-primary hover:bg-dark/50 font-semibold py-2 px-4 rounded-lg transition-colors text-sm">
                            <Icon name="download" className="w-4 h-4" />
                            <span className="mr-2">ייצוא דוח</span>
                        </button>
                    </div>

                    {/* שורה 3: פילטרים */}
                    <div className="flex items-center flex-wrap justify-start gap-4">
                        <select id="filter-team" value={filterByTeam} onChange={e => setFilterByTeam(e.target.value)} className="bg-light text-primary p-1.5 rounded-md border border-dark focus:outline-none focus:ring-1 focus:ring-accent text-sm">
                            <option value="all">כל הצוותים</option>
                            {allTeams.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}
                        </select>
                        <select id="filter-status" value={filterByStatus} onChange={e => setFilterByStatus(e.target.value)} className="bg-light text-primary p-1.5 rounded-md border border-dark focus:outline-none focus:ring-1 focus:ring-accent text-sm">
                            <option value="all">כל הסטטוסים</option>
                            {statuses.map(status => <option key={status} value={status}>{status}</option>)}
                        </select>
                        <label className="inline-flex items-center cursor-pointer">
                            <span className="text-sm font-medium text-primary">הצג ארכיון</span>
                            <div className="relative mr-3">
                                <input type="checkbox" checked={showArchived} onChange={() => setShowArchived(p => !p)} className="sr-only peer" />
<div className="w-11 h-6 bg-dark/50 rounded-full peer peer-focus:ring-2 peer-focus:ring-accent after:content-[''] after:absolute after:top-0.5 after:left-[2px] peer-checked:after:left-auto peer-checked:after:right-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>                            </div>
                        </label>
                    </div>

                </div>
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
                                {currentUser?.role === 'ADMIN' && <th className="px-4 py-3">פעולות</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-dark">
                            {filteredAndSortedProjects.map(p => (
                                <tr key={p.id} className="hover:bg-light">
                                    <td className="px-4 py-4 font-semibold text-primary whitespace-nowrap">{p.name}</td>
                                    <td className="px-4 py-4 text-dimmed">{p.teamLeaderName} ({p.teamName})</td>
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
                                    {currentUser?.role === 'ADMIN' && (
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
                    teamLeaders={allUsers.filter(u => u.role === 'TEAM_MANAGER')}
                    projectToEdit={editingProject || undefined}
                />
            )}

            {confirmingAction?.action === 'delete' && <DeleteProjectModal project={confirmingAction.project} onConfirm={confirmAction} onClose={() => setConfirmingAction(null)} />}
            {(confirmingAction?.action === 'archive' || confirmingAction?.action === 'restore') && <ConfirmationModal action={confirmingAction.action} project={confirmingAction.project} onConfirm={confirmAction} onClose={() => setConfirmingAction(null)} />}

            <div className="bg-medium rounded-lg shadow-sm p-6 space-y-6 border border-dark">
                <h2 className="text-2xl font-bold text-primary">ניהול אורחים</h2>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-right text-primary">
                        <thead className="text-xs text-dimmed uppercase bg-light">
                            <tr>
                                <th className="px-4 py-3">שם האורח</th>
                                <th className="px-4 py-3">גישה לפרויקט</th>
                                <th className="px-4 py-3">פעולות</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-dark">
                            {guests.length > 0 ? guests.map(guest => {
                                const projectName = allProjects.find(p => p.id === guest.projectId)?.name || 'N/A';
                                return (
                                    <tr key={guest.id} className="hover:bg-light">
                                        <td className="px-4 py-4 font-semibold text-primary whitespace-nowrap flex items-center">
                                            <Avatar user={guest} className="w-8 h-8 rounded-full ml-3" />
                                            {guest.name}
                                        </td>
                                        <td className="px-4 py-4 text-dimmed">{projectName}</td>
                                        <td className="px-4 py-4">
                                            <button onClick={() => handleRevokeGuest(guest.id)} className="text-danger hover:underline text-xs">בטל גישה</button>
                                        </td>
                                    </tr>
                                );
                            }) : (
                                <tr>
                                    <td colSpan={3} className="text-center p-4 text-dimmed">לא הוזמנו אורחים.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};


const DeleteProjectModal: React.FC<{ project: Project, onConfirm: () => void, onClose: () => void }> = ({ project, onConfirm, onClose }) => {
    const [confirmText, setConfirmText] = useState('');
    const isConfirmed = confirmText === project.name;
    return (
        <div className="fixed inset-0 bg-black/80 flex justify-center items-center z-50 p-4" onClick={onClose}>
            <div role="alertdialog" aria-modal="true" aria-labelledby="delete-title" className="bg-medium rounded-lg shadow-2xl w-full max-w-lg text-right border border-dark" onClick={e => e.stopPropagation()}>
                <div className="p-6">
                    <h2 id="delete-title" className="text-2xl font-bold text-danger mb-4">מחיקת פרויקט לצמיתות</h2>
                    <p className="text-primary">
                        אתה עומד למחוק את הפרויקט <strong className="font-bold">"{project.name}"</strong>. פעולה זו תמחק גם את כל המשימות, ההערות והנתונים הפיננסיים המשויכים אליו. לא ניתן לשחזר את המידע.
                    </p>
                    <p className="mt-4 text-primary font-semibold">לאישור, אנא הקלד את שם הפרויקט במלואו:</p>
                    <input type="text" value={confirmText} onChange={e => setConfirmText(e.target.value)} className="w-full bg-light p-2 mt-2 rounded-md text-primary border border-dark" />
                </div>
                <footer className="p-4 bg-light/50 border-t border-dark flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 text-sm rounded-md bg-dark hover:bg-dark/80 text-primary">ביטול</button>
                    <button onClick={onConfirm} disabled={!isConfirmed} className="px-4 py-2 text-sm rounded-md bg-danger hover:bg-red-700 text-light disabled:opacity-50 disabled:cursor-not-allowed">אני מבין את הסיכון, מחק את הפרויקט</button>
                </footer>
            </div>
        </div>
    );
};

const ConfirmationModal: React.FC<{ action: 'archive' | 'restore', project: Project, onConfirm: () => void, onClose: () => void }> = ({ action, project, onConfirm, onClose }) => {
    const messages = {
        archive: { title: 'אישור העברה לארכיון', body: `האם אתה בטוח? לאחר ההעברה, הפרויקט "${project.name}" יהפוך לקריאה בלבד.` },
        restore: { title: 'אישור שחזור מארכיון', body: `האם אתה בטוח שברצונך לשחזר את הפרויקט "${project.name}"?` },
    };
    const current = messages[action];

    return (
        <div className="fixed inset-0 bg-black/80 flex justify-center items-center z-50 p-4" onClick={onClose}>
            <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" className="bg-medium rounded-lg shadow-2xl w-full max-w-md text-right border border-dark" onClick={e => e.stopPropagation()}>
                <div className="p-6">
                    <h2 id="confirm-title" className="text-xl font-bold text-primary mb-4">{current.title}</h2>
                    <p className="text-primary">{current.body}</p>
                </div>
                <footer className="p-4 bg-light/50 border-t border-dark flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 text-sm rounded-md bg-dark hover:bg-dark/80 text-primary">ביטול</button>
                    <button onClick={onConfirm} className="px-4 py-2 text-sm rounded-md bg-primary hover:bg-primary/90 text-light">אישור</button>
                </footer>
            </div>
        </div>
    );
}

export default PortfolioView;