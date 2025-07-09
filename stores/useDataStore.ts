import { create } from 'zustand';
import { produce } from 'immer';
import { User, Task, FinancialTransaction, Notification, Comment, Project, Team, ProjectSubmissionData, Organization, SubscriptionInfo, Membership } from '../types';
import { api } from '../services/api';
import { useAuthStore } from './useAuthStore';
import { useUIStore } from './useUIStore';

// --- Multi-tenant data store interface ---
interface DataState {
    // Multi-tenant organization management
    activeOrganizationId: string | null;
    organization: { name: string; logoUrl?: string } | null;
    organizations: Organization[];
    userMemberships: Membership[];
    
    // Data for active organization
    users: User[];
    teams: Team[];
    projects: Project[];
    tasks: Task[];
    financials: FinancialTransaction[];
    notifications: Notification[];
    selectedProjectId: string | null;

    // Multi-tenant functions
    setActiveOrganizationId: (id: string | null) => void;
    getActiveOrganization: () => Organization | null;
    getUserRoleInActiveOrg: () => string;
    canManageOrganizations: () => boolean;
    
    // Standard functions
    setSelectedProjectId: (id: string | null) => void;
    bootstrapApp: () => Promise<void>;
    resetDataState: () => void;
    updateSingleUserInList: (user: User) => void;
    setOrganizationSettings: (settings: { name: string; logoUrl?: string }) => void;

    // Handlers
    handleUpdateTask: (updatedTask: Task) => Promise<void>;
    handleBulkUpdateTasks: (updatedTasks: Task[]) => Promise<void>;
    handleAddTask: (taskData: Omit<Task, 'id' | 'columnId' | 'comments' | 'plannedCost' | 'actualCost' | 'dependencies' | 'isMilestone'>) => Promise<void>;
    handleAddComment: (taskId: string, comment: Comment) => Promise<void>;
    handleAddFinancialTransaction: (transactionData: Omit<FinancialTransaction, 'id'>) => Promise<void>;
    
    handleCreateProject: (projectData: ProjectSubmissionData) => Promise<void>;
    handleUpdateProject: (projectId: string, projectData: Partial<ProjectSubmissionData> | { status: 'active' | 'archived' }) => Promise<void>;
    
    handleDeleteProject: (projectId: string) => Promise<void>;
    handleSetNotificationsRead: (ids: string[]) => void;
    handleInviteGuest: (email: string, projectId: string) => Promise<void>;
    handleRevokeGuest: (guestId: string, projectId: string) => Promise<void>;
    handleGlobalSearch: (query: string) => { projects: Project[]; tasks: Task[]; comments: (Comment & { task: Task })[] };
    handleUpdateUser: (updatedUser: User) => Promise<void>;
    handleCreateUser: (newUserData: Omit<User, 'id' | 'avatarUrl'>) => Promise<void>;
    handleDeleteUser: (userId: string) => Promise<void>;
    handleUpdateTeam: (updatedTeam: Team, newLeaderId: string | null, newMemberIds: string[]) => Promise<void>;
    handleCreateTeam: (newTeamData: Omit<Team, 'id'>, leaderId: string, memberIds: string[]) => Promise<void>;
    handleDeleteTeam: (teamId: string) => Promise<void>;
    handleAddUsersToTeam: (userIds: string[], teamId: string) => Promise<void>;
    handleRemoveUserFromTeam: (userId: string, teamId: string) => Promise<void>;
    handleDeleteTask: (taskId: string) => Promise<void>;
    
    // Multi-tenant organization management
    handleGetOrganizations: () => Promise<void>;
    handleCreateOrganization: (name: string) => Promise<void>;
    handleSwitchOrganization: (organizationId: string) => Promise<void>;
    handleGetUserMemberships: () => Promise<void>;
    
    // Subscription management
    subscriptionInfo: SubscriptionInfo | null;
    handleGetSubscriptionInfo: () => Promise<void>;
    handleCreateCheckoutSession: (planId: string) => Promise<{ url: string }>;
    handleCreatePortalSession: () => Promise<{ url: string }>;

    // New state properties
    needsOrganizationSetup: boolean;
}

const initialState = {
    activeOrganizationId: null,
    organization: null,
    organizations: [],
    userMemberships: [],
    users: [],
    teams: [],
    projects: [],
    tasks: [],
    financials: [],
    notifications: [],
    selectedProjectId: null,
    needsOrganizationSetup: false,
};

// Utility function to ensure task safety
const ensureTaskSafety = (task: any): Task => Object.assign({}, task, {
    assigneeIds: Array.isArray(task.assigneeIds) ? [...task.assigneeIds] : [],
    dependencies: Array.isArray(task.dependencies) ? [...task.dependencies] : [],
    comments: Array.isArray(task.comments) ? [...task.comments] : [],
    description: task.description || ''
});

// *** Updated function for multi-tenant model ***
export const calculateProjectsForCurrentUser = (currentUser: User | null, projects: Project[], tasks: Task[], activeOrganizationId: string | null): Project[] => {
    if (!currentUser || !activeOrganizationId) return [];

    const activeProjects = projects.filter(p => p.status === 'active' && p.organizationId === activeOrganizationId);

    // Get user's role in the active organization
    const userMembership = currentUser?.memberships?.find(m => m.organizationId === activeOrganizationId);
    const userRole = userMembership?.role;

    if (userRole === 'SUPER_ADMIN' || userRole === 'ORG_ADMIN') return activeProjects;
    
    if (userRole === 'TEAM_LEADER') {
        return activeProjects.filter(p => 
            (p.teamLeaders || []).some(leader => leader.id === currentUser.id)
        );
    }
    
    if (userRole === 'GUEST') {
        return activeProjects.filter(p => (currentUser as any).projectId === p.id);
    }

    // For EMPLOYEE role, show projects where they have assigned tasks
    const userTaskProjectIds = new Set(
        tasks
            .filter(t => t && Array.isArray(t.assigneeIds) && t.organizationId === activeOrganizationId)
            .filter(t => t.assigneeIds && t.assigneeIds.includes(currentUser.id))
            .map(t => t.projectId)
    );
    return activeProjects.filter(p => userTaskProjectIds.has(p.id));
};

export const useDataStore = create<DataState>()((set, get) => ({
    ...initialState,
    
    // Multi-tenant helper functions
    setActiveOrganizationId: (id) => set({ activeOrganizationId: id }),
    
    getActiveOrganization: () => {
        const { organizations, activeOrganizationId } = get();
        return organizations.find(org => org.id === activeOrganizationId) || null;
    },
    
    getUserRoleInActiveOrg: () => {
        const { userMemberships, activeOrganizationId } = get();
        const membership = userMemberships.find(m => m.organizationId === activeOrganizationId);
        return membership?.role || 'GUEST';
    },
    
    canManageOrganizations: () => {
        const { userMemberships } = get();
        return userMemberships.some(m => m.role === 'SUPER_ADMIN');
    },
    
    setSelectedProjectId: (id) => set({ selectedProjectId: id }),
    updateSingleUserInList: (user) => set(state => ({ users: state.users.map(u => u.id === user.id ? user : u) })),
    
    bootstrapApp: async () => {
        try {
            // Always sync from localStorage
            let activeOrganizationId = localStorage.getItem('activeOrganizationId');
            let needsOrganizationSetup = false;
            if (!activeOrganizationId) {
                // Try to get organizations from API and set the first as active
                const organizations = await api.getOrganizations();
                if (organizations && organizations.length > 0) {
                    activeOrganizationId = organizations[0].id;
                    localStorage.setItem('activeOrganizationId', activeOrganizationId);
                    needsOrganizationSetup = false;
                } else {
                    console.error("No organizations found for user");
                    needsOrganizationSetup = true;
                    set({ needsOrganizationSetup });
                    return;
                }
            }
            set({ activeOrganizationId, needsOrganizationSetup: false });

            const data = await api.getInitialData();
            set(produce((state: DataState) => {
                state.users = data.users || [];
                state.teams = data.teams || [];
                state.projects = data.projects || [];
                // Ensure all tasks have assigneeIds as an array
                state.tasks = (data.tasks || []).filter(Boolean).map(ensureTaskSafety);
                state.financials = data.financials || [];
                state.organization = data.organizationSettings;
            }));
        } catch (error) {
            console.error("Bootstrap failed:", error);
            useAuthStore.getState().handleLogout();
        }
    },
    
    resetDataState: () => set(initialState),
    setOrganizationSettings: (settings) => set({ organization: settings }),

    handleGlobalSearch: (query) => {
        const { projects, tasks, activeOrganizationId } = get();
        const currentUser = useAuthStore.getState().currentUser;
        const projectsForCurrentUser = calculateProjectsForCurrentUser(currentUser, projects, tasks, activeOrganizationId);

        if (query.length < 3) return { projects: [], tasks: [], comments: [] };
        const lowerQuery = query.toLowerCase();
        const accessibleProjectIds = new Set(projectsForCurrentUser.map(p => p.id));
        
        const foundProjects = projectsForCurrentUser.filter(p => 
            p.name.toLowerCase().includes(lowerQuery) || 
            (p.description || '').toLowerCase().includes(lowerQuery)
        );
        const foundTasks = tasks.filter(t => 
            accessibleProjectIds.has(t.projectId) && 
            (t.title.toLowerCase().includes(lowerQuery) || 
            (t.description || '').toLowerCase().includes(lowerQuery))
        );
        const foundComments = tasks.flatMap(t => (t.comments || []).map(c => ({ ...c, task: t }))).filter(c => accessibleProjectIds.has(c.task.projectId) && c.text.toLowerCase().includes(lowerQuery));
        
        return { projects: foundProjects, tasks: foundTasks, comments: foundComments };
    },
    // ... כל שאר הפונקציות נשארות זהות ...
    handleCreateProject: async (projectData) => {
        try {
            const { users, activeOrganizationId } = get();
            if (!activeOrganizationId) {
                throw new Error('No active organization selected');
            }
            const leaders = users.filter(u => projectData.teamLeaderIds.includes(u.id));
            const projectForApi = { 
                ...projectData, 
                teamLeaders: leaders,
                organizationId: activeOrganizationId
            };
            const newProject = await api.createProject(projectForApi);
            if (newProject) set(state => ({ projects: [newProject, ...state.projects] }));
        } catch (error) { useUIStore.getState().setNotification({ message: `שגיאה ביצירת פרויקט: ${(error as Error).message}`, type: 'error' }); }
    },
    handleUpdateProject: async (projectId, projectData) => {
        try {
            const updatedProject = await api.updateProject(projectId, projectData);
            if (updatedProject) set(state => ({ projects: state.projects.map(p => p.id === updatedProject.id ? updatedProject : p) }));
        } catch (error) { useUIStore.getState().setNotification({ message: `שגיאה בעדכון פרויקט: ${(error as Error).message}`, type: 'error' }); }
    },
    handleUpdateTask: async (updatedTask) => {
        try {
            // Exclude comments field from the update request since it's a relation
            const { comments, ...taskDataForUpdate } = updatedTask;
            const returnedTask = await api.updateTask(taskDataForUpdate as Task);
            if (returnedTask) {
                // Ensure the updated task has proper assigneeIds
                const safeTask = ensureTaskSafety(returnedTask);
                set(state => ({
                    tasks: state.tasks.map(task => (task.id === safeTask.id ? safeTask : task))
                }));
            }
        } catch (error) {
            useUIStore.getState().setNotification({ message: `שגיאה בעדכון המשימה: ${(error as Error).message}`, type: 'error' });
        }
    },
    handleBulkUpdateTasks: async (updatedTasks) => {
        try {
            // Exclude comments field from each task update since it's a relation
            const tasksForUpdate = updatedTasks.map(task => {
                const { comments, ...taskDataForUpdate } = task;
                return taskDataForUpdate as Task;
            });
            const returnedTasks = await api.bulkUpdateTasks(tasksForUpdate);
            // Ensure all returned tasks have proper assigneeIds
            const safeTasks = returnedTasks.map(ensureTaskSafety);
            const updatedTaskMap = new Map(safeTasks.map(t => [t.id, t]));
            set(state => ({
                tasks: state.tasks.map(task => updatedTaskMap.get(task.id) || task)
            }));
        } catch (error) {
            useUIStore.getState().setNotification({ message: `שגיאה בעדכון מספר משימות: ${(error as Error).message}`, type: 'error' });
        }
    },
    handleAddTask: async (taskData) => {
        const fullTaskData: Omit<Task, 'id'> = { 
            ...taskData, 
            assigneeIds: taskData.assigneeIds || [],
            columnId: 'col-not-started', 
            comments: [], 
            plannedCost: 0, 
            actualCost: 0, 
            dependencies: [], 
            isMilestone: false 
        };
        try {
            const newTask = await api.addTask(fullTaskData);
            if (newTask && typeof newTask === 'object') {
                // Ensure the new task has proper assigneeIds
                const safeTask = ensureTaskSafety(newTask);
                set(state => ({ tasks: [...state.tasks, safeTask] }));
            } else {
                console.error("API returned an invalid task object after creation.", newTask);
                useUIStore.getState().setNotification({ message: `שגיאה בהוספת משימה: התקבלה תגובה לא תקינה מהשרת.`, type: 'error' });
            }
        } catch (error) {
            useUIStore.getState().setNotification({ message: `שגיאה בהוספת משימה: ${(error as Error).message}`, type: 'error' });
        }
    },
    handleAddComment: async (taskId, comment) => {
        try {
            const updatedTask = await api.post(`/tasks/${taskId}/comments`, { content: comment.text });
            if (updatedTask) {
                // Ensure the updated task has proper assigneeIds
                const safeTask = ensureTaskSafety(updatedTask);
                set(state => ({
                    tasks: state.tasks.map(t => (t.id === taskId ? safeTask : t))
                }));
                useUIStore.getState().setNotification({ message: 'התגובה נוספה בהצלחה!', type: 'success' });
            }
        } catch (error) {
            console.error("Failed to add comment:", error);
            useUIStore.getState().setNotification({ message: `שגיאה בהוספת תגובה: ${(error as Error).message}`, type: 'error' });
        }
    },
    handleAddFinancialTransaction: async (transactionData) => {
        try {
            const newTransaction = await api.addFinancialTransaction(transactionData);
            if (newTransaction) set(state => ({ financials: [newTransaction, ...state.financials] }));
        } catch (error) { useUIStore.getState().setNotification({ message: `שגיאה בהוספת רישום כספי: ${(error as Error).message}`, type: 'error' }); }
    },
    handleDeleteProject: async (projectId) => {
        try {
            await api.deleteProject(projectId);
            set(state => ({ projects: state.projects.filter(p => p.id !== projectId) }));
        } catch (error) { useUIStore.getState().setNotification({ message: `שגיאה במחיקת פרויקט: ${(error as Error).message}`, type: 'error' }); }
    },
    handleSetNotificationsRead: (ids) => {
        set(state => ({ notifications: state.notifications.map(n => ids.includes(n.id) ? { ...n, read: true } : n) }));
    },
    handleInviteGuest: async (email, projectId) => {
        try {
            const newGuest = await api.inviteGuest(email, projectId);
            if (newGuest) set(state => ({ users: [...state.users, newGuest] }));
            useUIStore.getState().setNotification({ message: `אורח הוזמן בהצלחה!`, type: 'success' });
        } catch (error) { useUIStore.getState().setNotification({ message: `שגיאה בהזמנת אורח: ${(error as Error).message}`, type: 'error' }); }
    },
    handleRevokeGuest: async (guestId, projectId) => {
        try {
            await api.revokeGuest(guestId, projectId);
            set(state => ({ users: state.users.filter(u => u.id !== guestId) }));
            useUIStore.getState().setNotification({ message: `גישת אורח בוטלה בהצלחה!`, type: 'success' });
        } catch (error) { useUIStore.getState().setNotification({ message: `שגיאה בביטול גישת אורח: ${(error as Error).message}`, type: 'error' }); }
    },
    handleUpdateUser: async (updatedUser) => {
        try {
            const returnedUser = await api.updateUser(updatedUser);
            if (returnedUser) {
                set(state => ({ users: state.users.map(u => u.id === returnedUser.id ? returnedUser : u) }));
                const { currentUser, setCurrentUser } = useAuthStore.getState();
                if (currentUser && currentUser.id === returnedUser.id) setCurrentUser(returnedUser);
            }
        } catch (error) { useUIStore.getState().setNotification({ message: `שגיאה בעדכון משתמש: ${(error as Error).message}`, type: 'error' }); }
    },
    handleCreateUser: async (newUserData) => {
        try {
            const newUser = await api.createUser(newUserData);
            if (newUser) set(state => ({ users: [...state.users, newUser] }));
        } catch (error) { useUIStore.getState().setNotification({ message: `שגיאה ביצירת משתמש: ${(error as Error).message}`, type: 'error' }); }
    },
    handleDeleteUser: async (userId) => {
        try {
            const disabledUser = await api.deleteUser(userId);
            if (disabledUser) set(state => ({ users: state.users.map(u => u.id === userId ? disabledUser : u) }));
        } catch (error) { useUIStore.getState().setNotification({ message: `שגיאה בהשבתת משתמש: ${(error as Error).message}`, type: 'error' }); }
    },
    handleUpdateTeam: async (updatedTeam, newLeaderId, newMemberIds) => {
        try {
            const { team, updatedUsers } = await api.updateTeam(updatedTeam, newLeaderId, newMemberIds);
            const updatedUsersMap = new Map(updatedUsers.map(u => [u.id, u]));
            set(state => ({ teams: state.teams.map(t => t.id === team.id ? team : t), users: state.users.map(u => updatedUsersMap.get(u.id) || u) }));
        } catch (error) { useUIStore.getState().setNotification({ message: `שגיאה בעדכון צוות: ${(error as Error).message}`, type: 'error' }); }
    },
    handleCreateTeam: async (newTeamData, leaderId, memberIds) => {
        try {
            const { team, updatedUsers } = await api.createTeam(newTeamData, leaderId, memberIds);
            const updatedUsersMap = new Map(updatedUsers.map(u => [u.id, u]));
            set(state => ({ teams: [...state.teams, team], users: state.users.map(u => updatedUsersMap.get(u.id) || u) }));
        } catch (error) { useUIStore.getState().setNotification({ message: `שגיאה ביצירת צוות: ${(error as Error).message}`, type: 'error' }); }
    },
    handleDeleteTeam: async (teamId) => {
        try {
            const { updatedUsers } = await api.deleteTeam(teamId);
            const updatedUsersMap = new Map(updatedUsers.map(u => [u.id, u]));
            set(state => ({ teams: state.teams.filter(t => t.id !== teamId), users: state.users.map(u => updatedUsersMap.get(u.id) || u) }));
        } catch (error) { useUIStore.getState().setNotification({ message: `שגיאה במחיקת צוות: ${(error as Error).message}`, type: 'error' }); }
    },
    handleAddUsersToTeam: async (userIds, teamId) => {
        try {
            const updatedUsers = await api.addUsersToTeam(userIds, teamId);
            const updatedUsersMap = new Map(updatedUsers.map(u => [u.id, u]));
            set(state => ({ users: state.users.map(u => updatedUsersMap.get(u.id) || u) }));
        } catch (error) { useUIStore.getState().setNotification({ message: `שגיאה בהוספת חברים לצוות: ${(error as Error).message}`, type: 'error' }); }
    },
    handleRemoveUserFromTeam: async (userId, teamId) => {
        try {
            const updatedUser = await api.removeUserFromTeam(userId, teamId);
            set(state => ({ users: state.users.map(u => u.id === userId ? updatedUser : u) }));
        } catch (error) { useUIStore.getState().setNotification({ message: `שגיאה בהסרת חבר מצוות: ${(error as Error).message}`, type: 'error' }); }
    },
    handleDeleteTask: async (taskId: string) => {
        try {
            await api.deleteTask(taskId);
            set(state => ({
                tasks: state.tasks.filter(task => task.id !== taskId)
            }));
            useUIStore.getState().setNotification({ message: 'המשימה נמחקה בהצלחה!', type: 'success' });
        } catch (error) {
            useUIStore.getState().setNotification({ message: `שגיאה במחיקת משימה: ${(error as Error).message}`, type: 'error' });
        }
    },
    handleGetOrganizations: async () => {
        try {
            const organizations = await api.getOrganizations();
            set(state => ({ organizations: organizations }));
        } catch (error) {
            console.error("Failed to get organizations:", error);
            useUIStore.getState().setNotification({ message: `שגיאה בטעינת חברות: ${(error as Error).message}`, type: 'error' });
        }
    },
    handleCreateOrganization: async (name) => {
        try {
            const newOrganization = await api.createOrganization(name);
            if (newOrganization) {
                set(state => ({ organizations: [...state.organizations, newOrganization] }));
                useUIStore.getState().setNotification({ message: `חברה "${name}" נוספה בהצלחה!`, type: 'success' });
            }
        } catch (error) {
            useUIStore.getState().setNotification({ message: `שגיאה ביצירת חברה: ${(error as Error).message}`, type: 'error' });
        }
    },
    handleSwitchOrganization: async (organizationId) => {
        try {
            const organization = await api.switchOrganization(organizationId);
            if (organization) {
                set(state => ({ organization: organization }));
                // Reload all data for the new organization
                await get().bootstrapApp();
                useUIStore.getState().setNotification({ message: `חברה "${organization.name}" נבחרה בהצלחה!`, type: 'success' });
            }
        } catch (error) {
            useUIStore.getState().setNotification({ message: `שגיאה בהחלפת חברה: ${(error as Error).message}`, type: 'error' });
        }
    },
    handleGetUserMemberships: async () => {
        try {
            const memberships = await api.getUserMemberships();
            set(state => ({ userMemberships: memberships }));
        } catch (error) {
            console.error("Failed to get user memberships:", error);
            useUIStore.getState().setNotification({ message: `שגיאה בטעינת חברות שלי: ${(error as Error).message}`, type: 'error' });
        }
    },
    subscriptionInfo: null,
    handleGetSubscriptionInfo: async () => {
        try {
            const info = await api.getSubscriptionInfo();
            set(state => ({ subscriptionInfo: info }));
        } catch (error) {
            console.error("Failed to get subscription info:", error);
            useUIStore.getState().setNotification({ message: `שגיאה בטעינת מידע תשתית: ${(error as Error).message}`, type: 'error' });
        }
    },
    handleCreateCheckoutSession: async (planId) => {
        try {
            const session = await api.createCheckoutSession(planId);
            if (session) {
                window.location.href = session.url;
                return session;
            }
            throw new Error("Failed to create checkout session.");
        } catch (error) {
            useUIStore.getState().setNotification({ message: `שגיאה ביצירת חלון ביצוע: ${(error as Error).message}`, type: 'error' });
            return { url: "" };
        }
    },
    handleCreatePortalSession: async () => {
        try {
            const session = await api.createPortalSession();
            if (session) {
                window.location.href = session.url;
                return session;
            }
            throw new Error("Failed to create portal session.");
        } catch (error) {
            useUIStore.getState().setNotification({ message: `שגיאה ביצירת חלון פורטל: ${(error as Error).message}`, type: 'error' });
            return { url: "" };
        }
    },
}));