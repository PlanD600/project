import React, { useMemo, useState } from 'react';
import { FinancialTransaction, Project } from '../types';
import Icon from './Icon';
import AddFinancialTransactionModal from './AddFinancialTransactionModal';
import InviteGuestModal from './InviteGuestModal';
import { exportFinancesToCsv } from '../services/exportService';
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

const SuperAdminView: React.FC = () => {
    const { teams, projects, financials: allFinancials, handleAddFinancialTransaction } = useDataStore();
    const [viewByTeam, setViewByTeam] = useState('all');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalType, setModalType] = useState<'Income' | 'Expense' | null>(null);

    const transactionsForView = useMemo(() => {
        if (viewByTeam === 'all') {
            return allFinancials;
        }
        const projectIdsForTeam = projects.filter(p => p.teamId === viewByTeam).map(p => p.id);
        return allFinancials.filter(f => projectIdsForTeam.includes(f.projectId));
    }, [viewByTeam, allFinancials, projects]);
    
    const { totalIncome, totalExpenses, balance } = useMemo(() => {
        let totalIncome = 0;
        let totalExpenses = 0;
        transactionsForView.forEach(t => {
            if (t.type === 'Income') totalIncome += t.amount;
            else totalExpenses += t.amount;
        });
        return { totalIncome, totalExpenses, balance: totalIncome - totalExpenses };
    }, [transactionsForView]);
    
    const handleAddClick = (type: 'Income' | 'Expense') => {
        setModalType(type);
        setIsModalOpen(true);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
                 <button onClick={() => exportFinancesToCsv(transactionsForView, viewByTeam === 'all' ? 'all_teams' : teams.find(t => t.id === viewByTeam)?.name || 'team')} className="flex items-center whitespace-nowrap bg-transparent border border-primary text-primary hover:bg-dark/50 font-semibold py-2 px-4 rounded-lg transition-colors text-sm">
                    <Icon name="download" className="w-4 h-4 mr-2" />
                    ייצוא ל-CSV
                </button>
                <div className="flex items-center space-x-4 space-x-reverse">
                    <select id="view-by" value={viewByTeam} onChange={e => setViewByTeam(e.target.value)} className="bg-medium text-primary p-2 rounded-md border border-dark focus:outline-none focus:ring-2 focus:ring-accent">
                        <option value="all">כללי (כל הצוותים)</option>
                        {teams.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}
                    </select>
                    <label htmlFor="view-by" className="font-semibold text-primary">הצג לפי:</label>
                </div>
            </div>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-success/10 border-r-4 border-success text-success p-4 rounded-lg shadow">
                    <div className="text-sm font-bold uppercase">סך הכל הכנסות</div>
                    <div className="text-3xl font-bold text-primary">{formatCurrency(totalIncome)}</div>
                </div>
                <div className="bg-danger/10 border-r-4 border-danger text-danger p-4 rounded-lg shadow">
                    <div className="text-sm font-bold uppercase">סך הכל הוצאות</div>
                    <div className="text-3xl font-bold text-primary">{formatCurrency(totalExpenses)}</div>
                </div>
                <div className="bg-info/10 border-r-4 border-info text-info p-4 rounded-lg shadow">
                    <div className="text-sm font-bold uppercase">מאזן</div>
                    <div className={`text-3xl font-bold ${balance >= 0 ? 'text-primary' : 'text-danger'}`}>{formatCurrency(balance)}</div>
                </div>
            </div>
             <div className="flex space-x-4 space-x-reverse">
                 <button onClick={() => handleAddClick('Expense')} className="flex items-center bg-warning hover:bg-yellow-500 text-primary font-bold py-2 px-4 rounded-lg transition-colors">
                    <Icon name="plus" className="w-5 h-5 mr-2" />
                    הוסף הוצאה
                </button>
                <button onClick={() => handleAddClick('Income')} className="flex items-center bg-success hover:bg-green-700 text-light font-bold py-2 px-4 rounded-lg transition-colors">
                    <Icon name="plus" className="w-5 h-5 mr-2" />
                    הוסף הכנסה
                </button>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <TransactionTable title="יומן הכנסות" data={transactionsForView.filter(t => t.type === 'Income')} type="Income" projects={projects} />
                <TransactionTable title="יומן הוצאות" data={transactionsForView.filter(t => t.type === 'Expense')} type="Expense" projects={projects} />
            </div>
             {isModalOpen && modalType && (
                <AddFinancialTransactionModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    onSubmit={handleAddFinancialTransaction}
                    type={modalType}
                    currentUserRole='ADMIN'
                    projects={projects}
                />
            )}
        </div>
    );
};

const TeamLeaderView: React.FC = () => {
    const { currentUser } = useAuthStore();
    const { projects, financials: allFinancials, selectedProjectId, handleInviteGuest, handleAddFinancialTransaction } = useDataStore();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isInviteModalOpen, setInviteModalOpen] = useState(false);

    if (!currentUser) return null;

    const teamProjects = useMemo(() => projects.filter(p => p.teamId === currentUser.teamId), [projects, currentUser.teamId]);
    const project = projects.find(p => p.id === selectedProjectId);
    const canInvite = selectedProjectId && (currentUser.role === 'ADMIN' || currentUser.role === 'TEAM_MANAGER');

    const { totalBudget, totalTeamExpenses, remainingBudget } = useMemo(() => {
        if (!project) return { totalBudget: 0, totalTeamExpenses: 0, remainingBudget: 0 };
        const projectExpenses = allFinancials.filter(f => f.projectId === project.id && f.type === 'Expense');
        const totalTeamExpenses = projectExpenses.reduce((sum, t) => sum + t.amount, 0);
        return { totalBudget: project.budget, totalTeamExpenses, remainingBudget: project.budget - totalTeamExpenses };
    }, [project, allFinancials]);

    const projectTransactions = allFinancials.filter(f => f.projectId === project?.id);

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
                 <button onClick={() => exportFinancesToCsv(projectTransactions, project?.name || 'project')} className="flex items-center whitespace-nowrap bg-transparent border border-primary text-primary hover:bg-dark/50 font-semibold py-2 px-4 rounded-lg transition-colors text-sm">
                    <Icon name="download" className="w-4 h-4 mr-2" />
                    ייצוא ל-CSV
                </button>
                 <div className="flex items-center gap-4">
                    {canInvite && (
                        <button onClick={() => setInviteModalOpen(true)} title="הזמן אורח לפרויקט" className="flex items-center space-x-2 space-x-reverse bg-medium hover:bg-dark/50 text-primary hover:text-accent p-2 rounded-lg transition-colors border border-dark">
                            <Icon name="share-alt" className="w-5 h-5" />
                            <span className="text-sm font-semibold">שתף</span>
                        </button>
                    )}
                    <h2 className="text-2xl font-bold text-primary">נתונים פיננסיים - {project?.name}</h2>
                </div>
            </div>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-accent/10 border-r-4 border-accent text-accent p-4 rounded-lg shadow">
                    <div className="text-sm font-bold uppercase">תקציב כולל</div>
                    <div className="text-3xl font-bold text-primary">{formatCurrency(totalBudget)}</div>
                </div>
                <div className="bg-danger/10 border-r-4 border-danger text-danger p-4 rounded-lg shadow">
                    <div className="text-sm font-bold uppercase">הוצאות הצוות</div>
                    <div className="text-3xl font-bold text-primary">{formatCurrency(totalTeamExpenses)}</div>
                </div>
                <div className="bg-info/10 border-r-4 border-info text-info p-4 rounded-lg shadow">
                    <div className="text-sm font-bold uppercase">יתרת תקציב</div>
                    <div className={`text-3xl font-bold ${remainingBudget >= 0 ? 'text-primary' : 'text-danger'}`}>{formatCurrency(remainingBudget)}</div>
                </div>
            </div>
             <div className="flex justify-end">
                <button onClick={() => setIsModalOpen(true)} className="flex items-center bg-warning hover:bg-orange-500 text-primary font-bold py-2 px-4 rounded-lg transition-colors">
                    <Icon name="plus" className="w-5 h-5 mr-2" />
                    הוסף הוצאה
                </button>
            </div>
            <TransactionTable title="יומן הוצאות הצוות" data={projectTransactions.filter(t => t.type === 'Expense')} type="Expense" projects={projects} />
            {isModalOpen && (
                 <AddFinancialTransactionModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    onSubmit={handleAddFinancialTransaction}
                    type='Expense'
                    currentUserRole='TTEAM_MANAGER'
                    projects={teamProjects}
                />
            )}
            {isInviteModalOpen && selectedProjectId && (
                <InviteGuestModal
                    isOpen={isInviteModalOpen}
                    onClose={() => setInviteModalOpen(false)}
                    onInvite={(email) => handleInviteGuest(email, selectedProjectId)}
                />
            )}
        </div>
    );
};

const TransactionTable: React.FC<{
    title: string;
    data: FinancialTransaction[];
    type: 'Income' | 'Expense';
    projects: Project[];
}> = ({ title, data, type, projects }) => (
    <div className="bg-medium rounded-lg shadow-sm p-4 border border-dark">
        <h3 className="text-xl font-bold text-primary mb-4">{title}</h3>
        <div className="overflow-x-auto">
            <table className="w-full text-sm text-right text-primary">
                <thead className="text-xs text-dimmed uppercase bg-light">
                    <tr>
                        <th scope="col" className="px-6 py-3">תאריך</th>
                        <th scope="col" className="px-6 py-3">{type === 'Income' ? 'מקור' : 'שולם ל'}</th>
                        <th scope="col" className="px-6 py-3">פרויקט</th>
                        <th scope="col" className="px-6 py-3">תיאור</th>
                        <th scope="col" className="px-6 py-3 text-left">סכום</th>
                    </tr>
                </thead>
                <tbody>
                    {data.length > 0 ? data.map((tx) => (
                        <tr key={tx.id} className="border-b border-dark hover:bg-light">
                            <td className="px-6 py-4 text-dimmed">{new Date(tx.date).toLocaleDateString('he-IL')}</td>
                            <td className="px-6 py-4">{tx.source}</td>
                            <td className="px-6 py-4 text-dimmed">{projects.find(p => p.id === tx.projectId)?.name || 'N/A'}</td>
                            <td className="px-6 py-4 text-dimmed">{tx.description}</td>
                            <td className={`px-6 py-4 text-left font-semibold ${type === 'Income' ? 'text-success' : 'text-danger'}`}>
                                {formatCurrency(tx.amount)}
                            </td>
                        </tr>
                    )) : (
                        <tr>
                            <td colSpan={5} className="text-center p-4 text-dimmed">
                                אין רישומי {type === 'Income' ? 'הכנסות' : 'הוצאות'}
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    </div>
);


const FinancesView: React.FC = () => {
    const { currentUser } = useAuthStore();
    const { selectedProjectId } = useDataStore();

    if (!currentUser) return null;

    if (currentUser.role === 'TEAM_MANAGER' && !selectedProjectId) {
        return (
            <div className="flex items-center justify-center h-full bg-medium p-8 rounded-lg">
                <p className="text-lg text-dimmed">אנא בחר פרויקט כדי להציג את הנתונים הפיננסיים שלו.</p>
            </div>
        );
    }
    
    if (currentUser.role === 'ADMIN') {
        return <SuperAdminView />;
    }
    
    if (currentUser.role === 'TEAM_MANAGER') {
        return <TeamLeaderView />;
    }

    return null;
};

export default FinancesView;