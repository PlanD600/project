import React, { useMemo, useState } from 'react';
import { Project, Task, FinancialTransaction, User, Team } from '../types';
import Icon from './Icon';
import CreateProjectModal from './CreateProjectModal';
import { exportPortfolioToPdf } from '../services/exportService';
import { useDataStore } from '../stores/useDataStore';

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency: 'ILS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

type Status = 'במסלול' | 'בסיכון' | 'בסיכון גבוה' | 'הושלם';
const statusMap: Record<string, Status> = {
    'On Track': 'במסלול',
    'At Risk': 'בסיכון',
    'High Risk': 'בסיכון גבוה',
    'Completed': 'הושלם'
};

const PortfolioView: React.FC = () => {
    const { 
        projects: allProjects, 
        tasks: allTasks, 
        financials: allFinancials, 
        users: allUsers, 
        teams: allTeams, 
        handleCreateProject, 
        handleRevokeGuest 
    } = useDataStore();

    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [filterByTeam, setFilterByTeam] = useState('all');
    const [filterByStatus, setFilterByStatus] = useState('all');

    const projectData = useMemo(() => {
        return allProjects.map(project => {
            const tasks = allTasks.filter(t => t.projectId === project.id);
            const expenses = allFinancials.filter(f => f.projectId === project.id && f.type === 'Expense');
            const team = allTeams.find(t => t.id === project.teamId);
            const teamLeader = allUsers.find(u => u.role === 'Team Leader' && u.teamId === project.teamId);

            // Status Calculation
            let status: Status = statusMap['On Track'];
            if (tasks.length > 0) {
                if (tasks.every(t => t.columnId === 'col-done')) {
                    status = statusMap['Completed'];
                } else if (tasks.some(t => t.columnId === 'col-stuck')) {
                    status = statusMap['High Risk'];
                } else if (tasks.some(t => new Date(t.endDate) < new Date() && t.columnId !== 'col-done')) {
                    status = statusMap['At Risk'];
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
                status,
                progress,
                actualCost,
            };
        });
    }, [allProjects, allTasks, allFinancials, allUsers, allTeams]);

    const filteredAndSortedProjects = useMemo(() => {
        const statusOrder: Record<Status, number> = { 'בסיכון גבוה': 0, 'בסיכון': 1, 'במסלול': 2, 'הושלם': 3 };
        
        return projectData
            .filter(p => filterByTeam === 'all' || p.teamId === filterByTeam)
            .filter(p => filterByStatus === 'all' || p.status === filterByStatus)
            .sort((a, b) => {
                // Default sort by status
                return statusOrder[a.status] - statusOrder[b.status];
            });
    }, [projectData, filterByTeam, filterByStatus]);

    const getStatusChip = (status: Status) => {
        const styles: Record<Status, string> = {
            'במסלול': 'bg-success/20 text-success',
            'בסיכון': 'bg-warning/20 text-warning',
            'בסיכון גבוה': 'bg-danger/20 text-danger',
            'הושלם': 'bg-success/20 text-success',
        };
        return <span className={`px-3 py-1 text-xs font-semibold rounded-full ${styles[status]}`}>{status}</span>;
    };
    
    const guests = useMemo(() => allUsers.filter(u => u.role === 'Guest'), [allUsers]);
    const statuses: Status[] = ['במסלול', 'בסיכון', 'בסיכון גבוה', 'הושלם'];

    return (
        <div className="space-y-8">
            <div className="bg-medium rounded-lg shadow-sm p-6 space-y-6 border border-dark">
                <div className="flex flex-wrap justify-between items-center gap-4">
                     <div className="flex items-center flex-wrap-reverse justify-end gap-3">
                         <button onClick={() => setIsCreateModalOpen(true)} className="flex items-center whitespace-nowrap bg-primary hover:bg-primary/90 text-light font-semibold py-2 px-4 rounded-lg transition-colors text-sm">
                            <Icon name="plus" className="w-4 h-4 mr-2" />
                            צור פרויקט חדש
                        </button>
                         <button onClick={() => exportPortfolioToPdf(filteredAndSortedProjects)} className="flex items-center whitespace-nowrap bg-transparent border border-primary text-primary hover:bg-dark/50 font-semibold py-2 px-4 rounded-lg transition-colors text-sm">
                            <Icon name="download" className="w-4 h-4 mr-2" />
                            ייצוא דוח
                        </button>
                    </div>

                     <div className="flex items-center flex-wrap gap-4">
                        <select id="filter-status" value={filterByStatus} onChange={e => setFilterByStatus(e.target.value)} className="bg-light text-primary p-1.5 rounded-md border border-dark focus:outline-none focus:ring-1 focus:ring-accent text-sm">
                            <option value="all">כל הסטטוסים</option>
                            {statuses.map(status => <option key={status} value={status}>{status}</option>)}
                        </select>
                        <select id="filter-team" value={filterByTeam} onChange={e => setFilterByTeam(e.target.value)} className="bg-light text-primary p-1.5 rounded-md border border-dark focus:outline-none focus:ring-1 focus:ring-accent text-sm">
                            <option value="all">כל הצוותים</option>
                            {allTeams.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}
                        </select>
                        <h2 className="text-2xl font-bold text-primary whitespace-nowrap">פורטפוליו פרויקטים</h2>
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
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-dark">
                            {filteredAndSortedProjects.map(p => (
                                <tr key={p.id} className="hover:bg-light">
                                    <td className="px-4 py-4 font-semibold text-primary whitespace-nowrap">{p.name}</td>
                                    <td className="px-4 py-4 text-dimmed">{p.teamLeaderName} ({p.teamName})</td>
                                    <td className="px-4 py-4">{getStatusChip(p.status)}</td>
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
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
             {isCreateModalOpen && (
                <CreateProjectModal 
                    isOpen={isCreateModalOpen}
                    onClose={() => setIsCreateModalOpen(false)}
                    onSubmit={handleCreateProject}
                    teamLeaders={allUsers.filter(u => u.role === 'Team Leader')}
                />
            )}

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
                                            <img src={guest.avatarUrl} alt={guest.name} className="w-8 h-8 rounded-full ml-3" />
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

export default PortfolioView;