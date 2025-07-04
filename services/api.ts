// services/api.ts
import axios, { AxiosError } from 'axios';
import { User, Task, Project, Team, FinancialTransaction, Comment } from '../types';
import { logger } from './logger';

const apiClient = axios.create({
    baseURL: (import.meta as any).env.VITE_API_BASE_URL || 'http://localhost:8080/api',
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json',
    },
});

// --- Interceptors ---

// Request Interceptor: Attaches the auth token to every outgoing request.
apiClient.interceptors.request.use(
    (config) => {
        // Get the token from localStorage
        const token = localStorage.getItem('token');
        if (token) {
            // If the token exists, add it to the Authorization header
            config.headers['Authorization'] = `Bearer ${token}`;
        }
        logger.info(`Sending ${config.method?.toUpperCase()} request to ${config.url}`, {
            method: config.method,
            url: config.url,
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
        if (error.response?.data && typeof error.response.data === 'object' && 'message' in error.response.data) {
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
            // The backend is expected to return an object like { user: User, token: string }
            const response = await requests.post('/auth/login', { email, password });
            
            if (response && response.token && response.user) {
                // Save the token to localStorage
                localStorage.setItem('token', response.token);
                console.log(`[API] login successful. Token has been saved.`);
                // Return only the user object to the auth store
                return response.user;
            } else {
                console.error('[API] login response is invalid. Missing token or user.', response);
                // Ensure old tokens are cleared if login fails this way
                localStorage.removeItem('token');
                return null;
            }
        } catch (error) {
            console.error(`[API] login failed with error:`, error);
            // Clean up any stale token on failure
            localStorage.removeItem('token');
            throw error;
        }
    },
    logout: async (): Promise<void> => {
        console.log(`[API] logout called.`);
        try {
            // It's good practice to inform the backend about the logout
            await requests.post('/auth/logout', {});
        } catch (error) {
            console.error(`[API] Backend logout call failed, but proceeding with local logout.`, error);
        } finally {
            // Always remove the token from local storage on logout
            localStorage.removeItem('token');
            // Remove the header from the current axios instance
            delete apiClient.defaults.headers['Authorization'];
            console.log(`[API] Local logout completed. Token removed.`);
        }
    },
    register: (registrationData: {}): Promise<{ user: User, organizationSettings: { name: string, logoUrl: string } }> => requests.post('/auth/register', registrationData),
    getMe: (): Promise<User> => requests.get('/auth/me'),
    uploadAvatar: (imageDataUrl: string): Promise<User> => requests.post('/auth/me/avatar', { image: imageDataUrl }),

    // --- Initial Data Fetch ---
    getInitialData: (): Promise<{users: User[], teams: Team[], projects: Project[], tasks: Task[], financials: FinancialTransaction[], organizationSettings: {name: string, logoUrl: string}}> => requests.get('/bootstrap'),
    
    // --- Tasks ---
    getTask: (taskId: string): Promise<Task> => requests.get(`/tasks/${taskId}`),
    updateTask: (updatedTask: Task): Promise<Task> => requests.put(`/tasks/${updatedTask.id}`, updatedTask),
    bulkUpdateTasks: (updatedTasks: Task[]): Promise<Task[]> => requests.patch('/tasks', { tasks: updatedTasks }),
    addTask: (taskData: Omit<Task, 'id'>): Promise<Task> => requests.post(`/projects/${taskData.projectId}/tasks`, taskData),
    addComment: (taskId: string, comment: Comment): Promise<Task> => requests.post(`/tasks/${taskId}/comments`, { content: comment.text, parentId: comment.parentId }),
    
    post: (url: string, data: any) => requests.post(url, data),

    // --- Financials ---
    addFinancialTransaction: (transactionData: Omit<FinancialTransaction, 'id'>): Promise<FinancialTransaction> => requests.post('/finances/entries', transactionData),

    // --- Projects ---
    createProject: (projectData: Omit<Project, 'id' | 'status'>): Promise<Project> => requests.post('/projects', projectData),
    updateProject: (projectId: string, projectData: Partial<Project>): Promise<Project> => requests.put(`/projects/${projectId}`, projectData),
    deleteProject: (projectId: string): Promise<void> => requests.delete(`/projects/${projectId}`),

    // --- Guests ---
    inviteGuest: (email: string, projectId: string): Promise<User> => api.createUser({ 
        name: email.split('@')[0], 
        email: email, 
        role: 'GUEST',
        projectId: projectId,
    }),
    revokeGuest: (guestId: string): Promise<void> => requests.delete(`/users/${guestId}`),
    
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
};
