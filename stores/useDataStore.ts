import { create } from 'zustand';
import { User, Task, FinancialTransaction, Notification, Comment, Project, Team, NotificationPreferences } from '../types';
import { api } from '../services/api';
import { useAuthStore } from './useAuthStore';
import { useUIStore } from './useUIStore';

interface DataState {
    users: User[];
    teams: Team[];
    projects: Project[];
    tasks: Task[];
    financials: FinancialTransaction[];
    organizationSettings: { name: string; logoUrl: string };
    notifications: Notification[];
    selectedProjectId: string | null;

    setOrganizationSettings: (settings: { name: string, logoUrl: string }) => void;
    setSelectedProjectId: (id: string | null) => void;
    bootstrapApp: () => Promise<void>;
    resetDataState: () => void;

    // Handlers
    handleUpdateTask: (updatedTask: Task) => Promise<void>;
    handleBulkUpdateTasks: (updatedTasks: Task[], originalTasksMap: Map<string, Task>) => Promise<void>;
    handleAddTask: (taskData: Omit<Task, 'id' | 'columnId' | 'comments' | 'plannedCost' | 'actualCost' | 'dependencies' | 'isMilestone'>) => Promise<void>;
    handleAddComment: (taskId: string, comment: Comment) => Promise<void>;
    handleAddFinancialTransaction: (transactionData: Omit<FinancialTransaction, 'id'>) => Promise<void>;
    handleCreateProject: (projectData: Omit<Project, 'id'>) => Promise<void>;
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
    users: [],
    teams: [],
    projects: [],
    tasks: [],
    financials: [],
    organizationSettings: { name: '', logoUrl: '' },
    notifications: [],
    selectedProjectId: null,
};

export const calculateProjectsForCurrentUser = (currentUser: User | null, projects: Project[], tasks: Task[]): Project[] => {
    if (!currentUser) return [];
    if (currentUser.role === 'Super Admin') return projects;
    if (currentUser.role === 'Team Leader') return projects.filter(p => p.teamId === currentUser.teamId);
    if (currentUser.role === 'Guest') return projects.filter(p => p.id === currentUser.projectId);
    
    const userTaskProjectIds = new Set(tasks.filter(t => t.assigneeIds.includes(currentUser.id)).map(t => t.projectId));
    return projects.filter(p => userTaskProjectIds.has(p.id));
};

export const useDataStore = create<DataState>()((set, get) => ({
    ...initialState,

    setOrganizationSettings: (settings) => set({ organizationSettings: settings }),
    setSelectedProjectId: (id) => set({ selectedProjectId: id }),

    bootstrapApp: async () => {
        try {
            const data = await api.getInitialData();
            set({
                users: data.users,
                teams: data.teams,
                projects: data.projects,
                tasks: data.tasks,
                financials: data.financials,
                organizationSettings: data.organizationSettings,
            });
        } catch (error) {
            console.error("Bootstrap failed:", error);
            useAuthStore.getState().handleLogout();
        }
    },
    
    resetDataState: () => set(initialState),

    // Handlers
    handleUpdateTask: async (updatedTask) => {
        try {
            const returnedTask = await api.updateTask(updatedTask);
            set(state => ({
                tasks: state.tasks.map(task => (task.id === returnedTask.id ? returnedTask : task))
            }));
        } catch (error) {
            useUIStore.getState().setGlobalError(`שגיאה בעדכון המשימה: ${(error as Error).message}`);
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
            useUIStore.getState().setGlobalError(`שגיאה בעדכון מספר משימות: ${(error as Error).message}`);
        }
    },

    handleAddTask: async (taskData) => {
        const fullTaskData: Omit<Task, 'id'> = { ...taskData, columnId: 'col-not-started', comments: [], plannedCost: 0, actualCost: 0, dependencies: [], isMilestone: false };
        try {
            const newTask = await api.addTask(fullTaskData);
            set(state => ({ tasks: [...state.tasks, newTask] }));
        } catch (error) {
            useUIStore.getState().setGlobalError(`שגיאה בהוספת משימה: ${(error as Error).message}`);
        }
    },

    handleAddComment: async (taskId, comment) => {
        try {
            const updatedTask = await api.addComment(taskId, comment);
            set(state => ({
                tasks: state.tasks.map(t => (t.id === taskId ? updatedTask : t))
            }));
        } catch (error) {
            useUIStore.getState().setGlobalError(`שגיאה בהוספת תגובה: ${(error as Error).message}`);
        }
    },
    
    handleAddFinancialTransaction: async (transactionData) => {
        try {
            const newTransaction = await api.addFinancialTransaction(transactionData);
            set(state => ({ financials: [newTransaction, ...state.financials] }));
        } catch (error) {
            useUIStore.getState().setGlobalError(`שגיאה בהוספת רישום כספי: ${(error as Error).message}`);
        }
    },

    handleCreateProject: async (projectData) => {
        try {
            const newProject = await api.createProject(projectData);
            set(state => ({
                projects: [newProject, ...state.projects]
            }));
        } catch (error) {
            useUIStore.getState().setGlobalError(`שגיאה ביצירת פרויקט: ${(error as Error).message}`);
        }
    },
    
    handleSetNotificationsRead: (ids) => {
        set(state => ({
            notifications: state.notifications.map(n => ids.includes(n.id) ? {...n, read: true} : n)
        }));
    },
  
    handleInviteGuest: async (email, projectId) => {
        try {
            const newGuest = await api.inviteGuest(email, projectId);
            set(state => ({ users: [...state.users, newGuest] }));
        } catch (error) {
            useUIStore.getState().setGlobalError(`שגיאה בהזמנת אורח: ${(error as Error).message}`);
        }
    },
  
    handleRevokeGuest: async (guestId) => {
        try {
            await api.revokeGuest(guestId);
            set(state => ({ users: state.users.filter(u => u.id !== guestId) }));
        } catch (error) {
            useUIStore.getState().setGlobalError(`שגיאה בביטול גישת אורח: ${(error as Error).message}`);
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
      const foundComments = tasks.flatMap(t => t.comments.map(c => ({...c, task: t}))).filter(c => accessibleProjectIds.has(c.task.projectId) && c.text.toLowerCase().includes(lowerQuery));
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
            useUIStore.getState().setGlobalError(`שגיאה בעדכון משתמש: ${(error as Error).message}`);
        }
    },

    handleCreateUser: async (newUserData) => {
        try {
            const newUser = await api.createUser(newUserData);
            set(state => ({ users: [...state.users, newUser] }));
        } catch(error) {
            useUIStore.getState().setGlobalError(`שגיאה ביצירת משתמש: ${(error as Error).message}`);
        }
    },
    
    handleDeleteUser: async (userId) => {
        try {
            const disabledUser = await api.deleteUser(userId);
            set(state => ({ users: state.users.map(u => u.id === userId ? disabledUser : u) }));
        } catch(error) {
            useUIStore.getState().setGlobalError(`שגיאה בהשבתת משתמש: ${(error as Error).message}`);
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
            useUIStore.getState().setGlobalError(`שגיאה בעדכון צוות: ${(error as Error).message}`);
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
            useUIStore.getState().setGlobalError(`שגיאה ביצירת צוות: ${(error as Error).message}`);
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
            useUIStore.getState().setGlobalError(`שגיאה במחיקת צוות: ${(error as Error).message}`);
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
            useUIStore.getState().setGlobalError(`שגיאה בהוספת חברים לצוות: ${(error as Error).message}`);
        }
    },

    handleRemoveUserFromTeam: async (userId, teamId) => {
        try {
            const updatedUser = await api.removeUserFromTeam(userId, teamId);
            set(state => ({
                users: state.users.map(u => u.id === userId ? updatedUser : u)
            }));
        } catch (error) {
            useUIStore.getState().setGlobalError(`שגיאה בהסרת חבר מצוות: ${(error as Error).message}`);
        }
    },
}));
