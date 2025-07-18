// services/api.ts
import axios, { AxiosError } from 'axios';
import { User, Task, Project, Team, FinancialTransaction, Comment, Organization, SubscriptionInfo, Membership } from '../types';
import { logger } from './logger';

const apiBaseURL = (import.meta as any).env.VITE_API_BASE_URL || '/api';
console.log(`[API] Initializing with base URL: ${apiBaseURL}`); // Helpful log for debugging

const apiClient = axios.create({
    baseURL: apiBaseURL,
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json',
    },
});

// --- Interceptors ---

// Request Interceptor: Attaches the auth token and active organization to every outgoing request.
apiClient.interceptors.request.use(
    (config) => {
        // The token is now handled by the Authorization header on a per-request basis
        const token = localStorage.getItem('token'); // תמיד קורא מ-localStorage
        if (token) {
            config.headers['Authorization'] = `Bearer ${token}`;
        }
        
        // Add active organization header for multi-tenant support
        const activeOrganizationId = localStorage.getItem('activeOrganizationId');
        if (activeOrganizationId) {
            config.headers['x-active-organization-id'] = activeOrganizationId;
        }
        
        logger.info(`Sending ${config.method?.toUpperCase()} request to ${config.url}`, {
            method: config.method,
            url: config.url,
            activeOrganizationId,
        });
        return config;
    },
    (error) => {
        logger.error('Failed to send API request (interceptor)', {
            message: error.message,
        });
        return Promise.reject(error);
    }
);

// Response Interceptor: Handles generic responses and errors.
apiClient.interceptors.response.use(
    (response) => {
        logger.info(`Received successful response from ${response.config.url}`, {
            status: response.status,
        });
        return response;
    },
    (error: AxiosError) => {
        let errorMessage = 'An unexpected error occurred.';
        // Handle network errors specifically
        if (error.message === 'Network Error' && !error.response) {
            errorMessage = 'Network Error: Cannot connect to the API server. Please check the server status and your network connection.';
        } else if (error.response?.data && typeof error.response.data === 'object' && 'message' in error.response.data) {
            errorMessage = (error.response.data as { message: string }).message;
        } else if (error.message) {
            errorMessage = error.message;
        }

        logger.error('API call failed', {
            errorMessage,
            status: error.response?.status,
            endpoint: error.config?.url,
            method: error.config?.method,
            response: error.response?.data
        });

        return Promise.reject(new Error(errorMessage));
    }
);

// --- Request Helpers ---
const requests = {
    get: (url: string) => apiClient.get(url).then(response => response.data),
    post: (url: string, body: {}) => apiClient.post(url, body).then(response => response.data),
    put: (url: string, body: {}) => apiClient.put(url, body).then(response => response.data),
    patch: (url: string, body: {}) => apiClient.patch(url, body).then(response => response.data),
    delete: (url: string) => apiClient.delete(url).then(response => response.data),
};

// --- API Definitions ---
export const api = {
    // --- Auth ---
    login: async (email: string, password: string): Promise<User | null> => {
        console.log(`[API] login called with email: ${email}`);
        try {
            const response = await requests.post('/auth/login', { email, password });
            
            if (response && response.token && response.user) {
                localStorage.setItem('token', response.token);
                api.setAuthToken(response.token); // שימוש בפונקציה החדשה
                console.log(`[API] login successful. Token has been saved.`);
                return response.user;
            } else {
                console.error('[API] login response is invalid. Missing token or user.', response);
                localStorage.removeItem('token');
                api.removeAuthToken(); // ודא הסרה גם במקרה של כניסה לא חוקית
                return null;
            }
        } catch (error) {
            console.error(`[API] login failed with error:`, error);
            localStorage.removeItem('token');
            api.removeAuthToken(); // ודא הסרה גם במקרה של כשל
            throw error;
        }
    },
    logout: async (): Promise<void> => {
        console.log(`[API] logout called.`);
        try {
            await requests.post('/auth/logout', {});
        } catch (error) {
            console.error(`[API] Backend logout call failed, but proceeding with local logout.`, error);
        } finally {
            localStorage.removeItem('token');
            localStorage.removeItem('activeOrganizationId'); // Clear active organization on logout
            api.removeAuthToken(); // הסרה מפורשת
            console.log(`[API] Local logout completed. Token removed.`);
        }
    },
    // --- התיקון כאן: שינוי טיפוס החזרה והוספת שמירת טוקן בהרשמה ---
    register: async (registrationData: {}): Promise<{ user: User, organization: Organization, token: string }> => {
        const response = await requests.post('/auth/register', registrationData);
        if (response && response.user && response.token) {
            localStorage.setItem('token', response.token);
            // Set the organization as active after registration
            if (response.organization && response.organization.id) {
                localStorage.setItem('activeOrganizationId', response.organization.id);
                api.setActiveOrganization(response.organization.id);
            }
            api.setAuthToken(response.token);
            return response;
        }
        throw new Error('Registration failed: Missing user or token in response.');
    },
    // --- סוף התיקון ---
    getMe: (): Promise<User> => requests.get('/auth/me'),
    uploadAvatar: (imageDataUrl: string): Promise<User> => requests.post('/auth/me/avatar', { image: imageDataUrl }),

    forgotPassword: (email: string): Promise<{ message: string }> => requests.post('/auth/forgotpassword', { email }),
    resetPassword: (token: string, password: string): Promise<{ message: string }> => requests.patch(`/auth/resetpassword/${token}`, { password }),

    setAuthToken: (token: string | null) => {
        if (token) {
            apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        } else {
            delete apiClient.defaults.headers.common['Authorization'];
        }
    },
    removeAuthToken: () => {
        delete apiClient.defaults.headers.common['Authorization'];
    },

    // --- Multi-tenant organization management ---
    setActiveOrganization: (organizationId: string | null) => {
        if (organizationId) {
            localStorage.setItem('activeOrganizationId', organizationId);
            apiClient.defaults.headers.common['x-active-organization-id'] = organizationId;
        } else {
            localStorage.removeItem('activeOrganizationId');
            delete apiClient.defaults.headers.common['x-active-organization-id'];
        }
    },

    // --- Initial Data Fetch ---
    getInitialData: (): Promise<{users: User[], teams: Team[], projects: Project[], tasks: Task[], financials: FinancialTransaction[], organizationSettings: {name: string, logoUrl: string}, user: User}> => requests.get('/bootstrap'),
    
    // --- Tasks ---
    getTask: (taskId: string): Promise<Task> => requests.get(`/tasks/${taskId}`),
    updateTask: (updatedTask: Task): Promise<Task> => requests.put(`/tasks/${updatedTask.id}`, updatedTask),
    bulkUpdateTasks: (updatedTasks: Task[]): Promise<Task[]> => requests.patch('/tasks', { tasks: updatedTasks }),
    addTask: (taskData: Omit<Task, 'id' | 'columnId' | 'comments' | 'plannedCost' | 'actualCost' | 'dependencies' | 'isMilestone'>): Promise<Task> => requests.post(`/projects/${taskData.projectId}/tasks`, taskData),
    deleteTask: (taskId: string): Promise<void> => requests.delete(`/tasks/${taskId}`),
    addComment: (taskId: string, comment: Comment): Promise<Task> => requests.post(`/tasks/${taskId}/comments`, { content: comment.text, parentId: comment.parentId }),
    
    post: (url: string, data: any) => requests.post(url, data),

    // --- Financials ---
    addFinancialTransaction: (transactionData: Omit<FinancialTransaction, 'id'>): Promise<FinancialTransaction> => requests.post('/finances/entries', transactionData),

    // --- Projects ---
    createProject: (projectData: import('../types').ProjectSubmissionData & { organizationId: string }): Promise<Project> => requests.post('/projects', projectData),
    updateProject: (projectId: string, projectData: Partial<Project>): Promise<Project> => requests.put(`/projects/${projectId}`, projectData),
    deleteProject: (projectId: string): Promise<void> => requests.delete(`/projects/${projectId}`),

    // --- Guests ---
    inviteGuest: (email: string, projectId: string): Promise<User> => requests.post('/guests/invite', { 
        email: email, 
        projectId: projectId,
    }),
    revokeGuest: (guestId: string, projectId: string): Promise<void> => requests.delete(`/guests/${guestId}/project/${projectId}`),
    getProjectGuests: (projectId: string): Promise<User[]> => requests.get(`/guests/project/${projectId}`),
    
    // --- Users ---
    updateUser: (updatedUser: User): Promise<User> => requests.put(`/users/${updatedUser.id}`, updatedUser),
    createUser: (newUserData: Omit<User, 'id' | 'avatarUrl'>): Promise<User> => requests.post('/users', newUserData),
    deleteUser: (userId: string): Promise<User> => requests.delete(`/users/${userId}`),
    
    // --- Teams ---
    createTeam: (newTeamData: Omit<Team, 'id'>, leaderId: string, memberIds: string[]): Promise<{ team: Team, updatedUsers: User[] }> => requests.post('/teams', { teamName: newTeamData.name, team_leader_id: leaderId, member_user_ids: memberIds }),
    updateTeam: (updatedTeam: Team, newLeaderId: string | null, newMemberIds: string[]): Promise<{ team: Team, updatedUsers: User[] }> => requests.put(`/teams/${updatedTeam.id}`, { teamName: updatedTeam.name, leaderId: newLeaderId, memberIds: newMemberIds }),
    deleteTeam: (teamId: string): Promise<{ teamId: string, updatedUsers: User[] }> => requests.delete(`/teams/${teamId}`),
    addUsersToTeam: (userIds: string[], teamId: string): Promise<User[]> => requests.post(`/teams/${teamId}/members`, { user_ids: userIds }),
    removeUserFromTeam: (userId: string, teamId: string): Promise<User> => requests.delete(`/teams/${teamId}/members/${userId}`),

    // --- Multi-tenant Organizations ---
    getOrganizations: (): Promise<Organization[]> => requests.get('/organizations'),
    createOrganization: (name: string): Promise<Organization> => requests.post('/organizations', { name }),
    updateOrganization: (name: string): Promise<Organization> => requests.put('/organizations/me', { name }),
    switchOrganization: (organizationId: string): Promise<Organization> => {
        // Update active organization in localStorage and headers
        api.setActiveOrganization(organizationId);
        return requests.post('/organizations/switch', { organizationId });
    },
    getUserMemberships: (): Promise<Membership[]> => requests.get('/organizations/memberships'),

    // --- Billing ---
    getSubscriptionInfo: (): Promise<SubscriptionInfo> => requests.get('/billing/subscription'),
    createCheckoutSession: (planId: string): Promise<{ sessionId: string; url: string }> => requests.post('/billing/create-checkout-session', { planId }),
    createPortalSession: (): Promise<{ url: string }> => requests.post('/billing/create-portal-session', {}),
};

// SECURITY NOTE: Consider using sessionStorage for tokens if you want them cleared on tab close, or HttpOnly cookies for even better security (requires backend support).
// TODO: Add unit tests/mocks for API methods, especially for error scenarios.