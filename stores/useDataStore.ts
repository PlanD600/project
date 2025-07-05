import { create } from 'zustand';
import { produce } from 'immer';
// FIX: Removed unused imports and added ProjectSubmissionData
import { User, Task, FinancialTransaction, Notification, Comment, Project, Team, ProjectSubmissionData } from '../types';
import { api } from '../services/api';
import { useAuthStore } from './useAuthStore';
import { useUIStore } from './useUIStore';

interface DataState {
    organization: { name: string; logoUrl?: string } | null;
    users: User[];
    teams: Team[];
    projects: Project[];
    tasks: Task[];
    financials: FinancialTransaction[];
    notifications: Notification[];
    selectedProjectId: string | null;

    setSelectedProjectId: (id: string | null) => void;
    bootstrapApp: () => Promise<void>;
    resetDataState: () => void;
    updateSingleUserInList: (user: User) => void;
    setOrganizationSettings: (settings: { name: string; logoUrl?: string }) => void;

    // Handlers
    handleUpdateTask: (updatedTask: Task) => Promise<void>;
    handleBulkUpdateTasks: (updatedTasks: Task[], originalTasksMap: Map<string, Task>) => Promise<void>;
    handleAddTask: (taskData: Omit<Task, 'id' | 'columnId' | 'comments' | 'plannedCost' | 'actualCost' | 'dependencies' | 'isMilestone'>) => Promise<void>;
    handleAddComment: (taskId: string, comment: Comment) => Promise<void>;
    handleAddFinancialTransaction: (transactionData: Omit<FinancialTransaction, 'id'>) => Promise<void>;
    
    // FIX: Updated function signatures to be correct and flexible
    handleCreateProject: (projectData: ProjectSubmissionData) => Promise<void>;
    handleUpdateProject: (projectId: string, projectData: Partial<ProjectSubmissionData> | { status: string }) => Promise<void>;
    
    handleDeleteProject: (projectId: string) => Promise<void>;
    handleSetNotificationsRead: (ids: string[]) => void;
    handleInviteGuest: (email: string, projectId: string) => Promise<void>;
    handleRevokeGuest: (guestId: string) => Promise<void>;
    handleGlobalSearch: (query: string) => { projects: Project[]; tasks: Task[]; comments: (Comment & { task: Task })[] };
    handleUpdateUser: (updatedUser: User) => Promise<void>;
    handleCreateUser: (newUserData: Omit<User, 'id' | 'avatarUrl'>) => Promise<void>;
    handleDeleteUser: (userId: string) => Promise<void>;
    handleUpdateTeam: (updatedTeam: Team, newLeaderId: string | null, newMemberIds: string[]) => Promise<void>;
    handleCreateTeam: (newTeamData: Omit<Team, 'id'>, leaderId: string, memberIds: string[]) => Promise<void>;
    handleDeleteTeam: (teamId: string) => Promise<void>;
    handleAddUsersToTeam: (userIds: string[], teamId: string) => Promise<void>;
    handleRemoveUserFromTeam: (userId: string, teamId: string) => Promise<void>;
}

const initialState = {
    organization: null,
    users: [],
    teams: [],
    projects: [],
    tasks: [],
    financials: [],
    notifications: [],
    selectedProjectId: null,
};

// FIX: This helper function is now updated for the new 'teamLeaders' logic
export const calculateProjectsForCurrentUser = (currentUser: User | null, projects: Project[], tasks: Task[]): Project[] => {
    if (!currentUser) return [];

    const activeProjects = projects.filter(p => p.status === 'active');

    if (currentUser.role === 'ADMIN') return activeProjects;
    
    // TEAM_MANAGER sees projects they are a leader of
    if (currentUser.role === 'TEAM_MANAGER') {
        return activeProjects.filter(p => 
            p.teamLeaders?.some(leader => leader.id === currentUser.id)
        );
    }
    
    if (currentUser.role === 'GUEST') {
        // Assuming GUEST is tied to a project via a new field, e.g., `projectId` on the User model
        return activeProjects.filter(p => (currentUser as any).projectId === p.id);
    }

    // EMPLOYEE sees projects where they have assigned tasks
    const userTaskProjectIds = new Set(
        tasks.filter(t => (t.assigneeIds || []).includes(currentUser.id)).map(t => t.projectId)
    );
    return activeProjects.filter(p => userTaskProjectIds.has(p.id));
};


export const useDataStore = create<DataState>()((set, get) => ({
    ...initialState,

    setSelectedProjectId: (id) => set({ selectedProjectId: id }),

    updateSingleUserInList: (user) => {
        set(state => ({
            users: state.users.map(u => u.id === user.id ? user : u)
        }));
    },

    bootstrapApp: async () => {
        try {
            const data = await api.getInitialData();
            set(produce((state: DataState) => {
                state.users = data.users;
                state.teams = data.teams;
                state.projects = data.projects;
                state.tasks = data.tasks;
                state.financials = data.financials;
                state.organization = data.organizationSettings;
            }));
        } catch (error) {
            console.error("Bootstrap failed:", error);
            useAuthStore.getState().handleLogout();
        }
    },

    resetDataState: () => set(initialState),
    
    setOrganizationSettings: (settings) => {
        set({ organization: settings });
    },

    // --- Handlers ---
    
    handleCreateProject: async (projectData) => {
        try {
            const newProject = await api.createProject(projectData);
            set(state => ({
                projects: [newProject, ...state.projects]
            }));
        } catch (error) {
            useUIStore.getState().setNotification({ message: `שגיאה ביצירת פרויקט: ${(error as Error).message}`, type: 'error' });
        }
    },

    handleUpdateProject: async (projectId, projectData) => {
        try {
            const updatedProject = await api.updateProject(projectId, projectData);
            set(state => ({
                projects: state.projects.map(p => p.id === updatedProject.id ? updatedProject : p)
            }));
        } catch (error) {
            useUIStore.getState().setNotification({ message: `שגיאה בעדכון פרויקט: ${(error as Error).message}`, type: 'error' });
        }
    },

    handleUpdateTask: async (updatedTask) => {
        try {
            const returnedTask = await api.updateTask(updatedTask);
            set(state => ({
                tasks: state.tasks.map(task => (task.id === returnedTask.id ? returnedTask : task))
            }));
        } catch (error) {
            useUIStore.getState().setNotification({ message: `שגיאה בעדכון המשימה: ${(error as Error).message}`, type: 'error' });
        }
    },
    handleBulkUpdateTasks: async (updatedTasks, originalTasksMap) => {
        try {
            const returnedTasks = await api.bulkUpdateTasks(updatedTasks);
            const updatedTaskMap = new Map(returnedTasks.map(t => [t.id, t]));
            set(state => ({
                tasks: state.tasks.map(task => updatedTaskMap.get(task.id) || task)
            }));
        } catch (error) {
            useUIStore.getState().setNotification({ message: `שגיאה בעדכון מספר משימות: ${(error as Error).message}`, type: 'error' });
        }
    },
    handleAddTask: async (taskData) => {
        const fullTaskData: Omit<Task, 'id'> = { ...taskData, columnId: 'col-not-started', comments: [], plannedCost: 0, actualCost: 0, dependencies: [], isMilestone: false };
        try {
            const newTask = await api.addTask(fullTaskData);
            set(state => ({ tasks: [...state.tasks, newTask] }));
        } catch (error) {
            useUIStore.getState().setNotification({ message: `שגיאה בהוספת משימה: ${(error as Error).message}`, type: 'error' });
        }
    },
    handleAddComment: async (taskId, comment) => {
        try {
            const updatedTask = await api.post(`/tasks/${taskId}/comments`, { content: comment.text });
            set(state => ({
                tasks: state.tasks.map(t => (t.id === taskId ? updatedTask : t))
            }));
            useUIStore.getState().setNotification({ message: 'התגובה נוספה בהצלחה!', type: 'success' });
        } catch (error) {
            console.error("Failed to add comment:", error);
            useUIStore.getState().setNotification({ message: `שגיאה בהוספת תגובה: ${(error as Error).message}`, type: 'error' });
        }
    },
    handleAddFinancialTransaction: async (transactionData) => {
        try {
            const newTransaction = await api.addFinancialTransaction(transactionData);
            set(state => ({ financials: [newTransaction, ...state.financials] }));
        } catch (error) {
            useUIStore.getState().setNotification({ message: `שגיאה בהוספת רישום כספי: ${(error as Error).message}`, type: 'error' });
        }
    },
    handleDeleteProject: async (projectId) => {
        try {
            await api.deleteProject(projectId);
            set(state => ({
                projects: state.projects.filter(p => p.id !== projectId)
            }));
        } catch (error) {
            useUIStore.getState().setNotification({ message: `שגיאה במחיקת פרויקט: ${(error as Error).message}`, type: 'error' });
        }
    },
    handleSetNotificationsRead: (ids) => {
        set(state => ({
            notifications: state.notifications.map(n => ids.includes(n.id) ? { ...n, read: true } : n)
        }));
    },
    handleInviteGuest: async (email, projectId) => {
        try {
            const newGuest = await api.inviteGuest(email, projectId);
            set(state => ({ users: [...state.users, newGuest] }));
        } catch (error) {
            useUIStore.getState().setNotification({ message: `שגיאה בהזמנת אורח: ${(error as Error).message}`, type: 'error' });
        }
    },
    handleRevokeGuest: async (guestId) => {
        try {
            await api.revokeGuest(guestId);
            set(state => ({ users: state.users.filter(u => u.id !== guestId) }));
        } catch (error) {
            useUIStore.getState().setNotification({ message: `שגיאה בביטול גישת אורח: ${(error as Error).message}`, type: 'error' });
        }
    },
    handleGlobalSearch: (query) => {
        const { projects, tasks } = get();
        const currentUser = useAuthStore.getState().currentUser;
        const projectsForCurrentUser = calculateProjectsForCurrentUser(currentUser, projects, tasks);

        if (query.length < 3) return { projects: [], tasks: [], comments: [] };
        const lowerQuery = query.toLowerCase();
        const accessibleProjectIds = new Set(projectsForCurrentUser.map(p => p.id));
        const foundProjects = projectsForCurrentUser.filter(p => p.name.toLowerCase().includes(lowerQuery) || p.description.toLowerCase().includes(lowerQuery));
        const foundTasks = tasks.filter(t => accessibleProjectIds.has(t.projectId) && (t.title.toLowerCase().includes(lowerQuery) || t.description.toLowerCase().includes(lowerQuery)));
        const foundComments = tasks.flatMap(t => t.comments.map(c => ({ ...c, task: t }))).filter(c => accessibleProjectIds.has(c.task.projectId) && c.text.toLowerCase().includes(lowerQuery));
        return { projects: foundProjects, tasks: foundTasks, comments: foundComments };
    },
    handleUpdateUser: async (updatedUser) => {
        try {
            const returnedUser = await api.updateUser(updatedUser);
            set(state => ({
                users: state.users.map(u => u.id === returnedUser.id ? returnedUser : u)
            }));
            const { currentUser, setCurrentUser } = useAuthStore.getState();
            if (currentUser && currentUser.id === returnedUser.id) {
                setCurrentUser(returnedUser);
            }
        } catch (error) {
            useUIStore.getState().setNotification({ message: `שגיאה בעדכון משתמש: ${(error as Error).message}`, type: 'error' });
        }
    },
    handleCreateUser: async (newUserData) => {
        try {
            const newUser = await api.createUser(newUserData);
            set(state => ({ users: [...state.users, newUser] }));
        } catch (error) {
            useUIStore.getState().setNotification({ message: `שגיאה ביצירת משתמש: ${(error as Error).message}`, type: 'error' });
        }
    },
    handleDeleteUser: async (userId) => {
        try {
            const disabledUser = await api.deleteUser(userId);
            set(state => ({ users: state.users.map(u => u.id === userId ? disabledUser : u) }));
        } catch (error) {
            useUIStore.getState().setNotification({ message: `שגיאה בהשבתת משתמש: ${(error as Error).message}`, type: 'error' });
        }
    },
    handleUpdateTeam: async (updatedTeam, newLeaderId, newMemberIds) => {
        try {
            const { team, updatedUsers } = await api.updateTeam(updatedTeam, newLeaderId, newMemberIds);
            const updatedUsersMap = new Map(updatedUsers.map(u => [u.id, u]));
            set(state => ({
                teams: state.teams.map(t => t.id === team.id ? team : t),
                users: state.users.map(u => updatedUsersMap.get(u.id) || u)
            }));
        } catch (error) {
            useUIStore.getState().setNotification({ message: `שגיאה בעדכון צוות: ${(error as Error).message}`, type: 'error' });
        }
    },
    handleCreateTeam: async (newTeamData, leaderId, memberIds) => {
        try {
            const { team, updatedUsers } = await api.createTeam(newTeamData, leaderId, memberIds);
            const updatedUsersMap = new Map(updatedUsers.map(u => [u.id, u]));
            set(state => ({
                teams: [...state.teams, team],
                users: state.users.map(u => updatedUsersMap.get(u.id) || u)
            }));
        } catch (error) {
            useUIStore.getState().setNotification({ message: `שגיאה ביצירת צוות: ${(error as Error).message}`, type: 'error' });
        }
    },
    handleDeleteTeam: async (teamId) => {
        try {
            const { updatedUsers } = await api.deleteTeam(teamId);
            const updatedUsersMap = new Map(updatedUsers.map(u => [u.id, u]));
            set(state => ({
                teams: state.teams.filter(t => t.id !== teamId),
                users: state.users.map(u => updatedUsersMap.get(u.id) || u)
            }));
        } catch (error) {
            useUIStore.getState().setNotification({ message: `שגיאה במחיקת צוות: ${(error as Error).message}`, type: 'error' });
        }
    },
    handleAddUsersToTeam: async (userIds, teamId) => {
        try {
            const updatedUsers = await api.addUsersToTeam(userIds, teamId);
            const updatedUsersMap = new Map(updatedUsers.map(u => [u.id, u]));
            set(state => ({
                users: state.users.map(u => updatedUsersMap.get(u.id) || u)
            }));
        } catch (error) {
            useUIStore.getState().setNotification({ message: `שגיאה בהוספת חברים לצוות: ${(error as Error).message}`, type: 'error' });
        }
    },
    handleRemoveUserFromTeam: async (userId, teamId) => {
        try {
            const updatedUser = await api.removeUserFromTeam(userId, teamId);
            set(state => ({
                users: state.users.map(u => u.id === userId ? updatedUser : u)
            }));
        } catch (error) {
            useUIStore.getState().setNotification({ message: `שגיאה בהסרת חבר מצוות: ${(error as Error).message}`, type: 'error' });
        }
    },
    
}));
