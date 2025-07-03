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

// Request Interceptor: Log outgoing requests
apiClient.interceptors.request.use(
    (config) => {
        logger.info(`Sending ${config.method?.toUpperCase()} request to ${config.url}`, {
            method: config.method,
            url: config.url,
            data: config.data, // Include data for POST/PUT/PATCH requests
        });
        return config;
    },
    (error) => {
        logger.error('Failed to send API request (interceptor)', {
            message: error.message,
            config: error.config,
        });
        return Promise.reject(error);
    }
);


apiClient.interceptors.response.use(
    (response) => {
        logger.info(`Received successful response from ${response.config.method?.toUpperCase()} ${response.config.url}`, {
            status: response.status,
            dataPreview: response.data ? (JSON.stringify(response.data).substring(0, 100) + '...') : 'No data', // Log a preview of the data
            endpoint: response.config.url,
            method: response.config.method,
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

// This is a new helper object to wrap the axios methods
const requests = {
    get: (url: string) => apiClient.get(url).then(response => response.data),
    post: (url: string, body: {}) => apiClient.post(url, body).then(response => response.data),
    put: (url: string, body: {}) => apiClient.put(url, body).then(response => response.data),
    patch: (url: string, body: {}) => apiClient.patch(url, body).then(response => response.data),
    delete: (url: string) => apiClient.delete(url).then(response => response.data),
};

// We keep your structured api object, but make it use the helper above
export const api = {
    // --- Auth ---
    login: async (email: string, password: string): Promise<User | null> => {
        console.log(`[API] login called with:`, { email });
        try {
            const result = await requests.post('/auth/login', { email, password });
            console.log(`[API] login successful. Result:`, result);
            return result;
        } catch (error) {
            console.error(`[API] login failed. Error:`, error);
            throw error;
        }
    },
    register: async (registrationData: {}): Promise<{ user: User, organizationSettings: { name: string, logoUrl: string } }> => {
        console.log(`[API] register called with:`, { registrationData });
        try {
            const result = await requests.post('/auth/register', registrationData);
            console.log(`[API] register successful. Result:`, result);
            return result;
        } catch (error) {
            console.error(`[API] register failed. Error:`, error);
            throw error;
        }
    },
    logout: async (): Promise<void> => {
        console.log(`[API] logout called.`);
        try {
            const result = await requests.post('/auth/logout', {});
            console.log(`[API] logout successful. Result:`, result);
            return result;
        } catch (error) {
            console.error(`[API] logout failed. Error:`, error);
            throw error;
        }
    },
    getMe: async (): Promise<User> => {
        console.log(`[API] getMe called.`);
        try {
            const result = await requests.get('/auth/me');
            console.log(`[API] getMe successful. Result:`, result);
            return result;
        } catch (error) {
            console.error(`[API] getMe failed. Error:`, error);
            throw error;
        }
    },
    uploadAvatar: async (imageDataUrl: string): Promise<User> => {
        console.log(`[API] uploadAvatar called.`);
        try {
            const result = await requests.post('/auth/me/avatar', { image: imageDataUrl });
            console.log(`[API] uploadAvatar successful. Result:`, result);
            return result;
        } catch (error) {
            console.error(`[API] uploadAvatar failed. Error:`, error);
            throw error;
        }
    },

    // --- Initial Data Fetch ---
    getInitialData: async (): Promise<{users: User[], teams: Team[], projects: Project[], tasks: Task[], financials: FinancialTransaction[], organizationSettings: {name: string, logoUrl: string}}> => {
        console.log(`[API] getInitialData called.`);
        try {
            const result = await requests.get('/bootstrap');
            console.log(`[API] getInitialData successful. Result:`, result);
            return result;
        } catch (error) {
            console.error(`[API] getInitialData failed. Error:`, error);
            throw error;
        }
    },
    
    // --- Tasks ---
    getTask: async (taskId: string): Promise<Task> => {
        console.log(`[API] getTask called with:`, { taskId });
        try {
            const result = await requests.get(`/tasks/${taskId}`);
            console.log(`[API] getTask successful. Result:`, result);
            return result;
        } catch (error) {
            console.error(`[API] getTask failed. Error:`, error);
            throw error;
        }
    },
    updateTask: async (updatedTask: Task): Promise<Task> => {
        console.log(`[API] updateTask called with:`, { updatedTask });
        try {
            const result = await requests.put(`/tasks/${updatedTask.id}`, updatedTask);
            console.log(`[API] updateTask successful. Result:`, result);
            return result;
        } catch (error) {
            console.error(`[API] updateTask failed. Error:`, error);
            throw error;
        }
    },
    bulkUpdateTasks: async (updatedTasks: Task[]): Promise<Task[]> => {
        console.log(`[API] bulkUpdateTasks called with:`, { updatedTasks });
        try {
            const result = await requests.patch('/tasks', { tasks: updatedTasks });
            console.log(`[API] bulkUpdateTasks successful. Result:`, result);
            return result;
        } catch (error) {
            console.error(`[API] bulkUpdateTasks failed. Error:`, error);
            throw error;
        }
    },
    addTask: async (taskData: Omit<Task, 'id'>): Promise<Task> => {
        console.log(`[API] addTask called with:`, { taskData });
        try {
            const result = await requests.post(`/projects/${taskData.projectId}/tasks`, taskData);
            console.log(`[API] addTask successful. Result:`, result);
            return result;
        } catch (error) {
            console.error(`[API] addTask failed. Error:`, error);
            throw error;
        }
    },
    addComment: async (taskId: string, comment: Comment): Promise<Task> => {
        console.log(`[API] addComment called with:`, { taskId, comment });
        try {
            const result = await requests.post(`/tasks/${taskId}/comments`, { content: comment.text, parentId: comment.parentId });
            console.log(`[API] addComment successful. Result:`, result);
            return result;
        } catch (error) {
            console.error(`[API] addComment failed. Error:`, error);
            throw error;
        }
    },
    
    // This is the function we need for the datastore - it's a generic post
    post: async (url: string, data: any) => {
        console.log(`[API] post called with:`, { url, data });
        try {
            const result = await requests.post(url, data);
            console.log(`[API] post successful. Result:`, result);
            return result;
        } catch (error) {
            console.error(`[API] post failed. Error:`, error);
            throw error;
        }
    },

    // --- Financials ---
    addFinancialTransaction: async (transactionData: Omit<FinancialTransaction, 'id'>): Promise<FinancialTransaction> => {
        console.log(`[API] addFinancialTransaction called with:`, { transactionData });
        try {
            const result = await requests.post('/finances/entries', transactionData);
            console.log(`[API] addFinancialTransaction successful. Result:`, result);
            return result;
        } catch (error) {
            console.error(`[API] addFinancialTransaction failed. Error:`, error);
            throw error;
        }
    },

    // --- Projects ---
    createProject: async (projectData: Omit<Project, 'id' | 'status'>): Promise<Project> => {
        console.log(`[API] createProject called with:`, { projectData });
        try {
            const result = await requests.post('/projects', projectData);
            console.log(`[API] createProject successful. Result:`, result);
            return result;
        } catch (error) {
            console.error(`[API] createProject failed. Error:`, error);
            throw error;
        }
    },
    updateProject: async (projectId: string, projectData: Partial<Project>): Promise<Project> => {
        console.log(`[API] updateProject called with:`, { projectId, projectData });
        try {
            const result = await requests.put(`/projects/${projectId}`, projectData);
            console.log(`[API] updateProject successful. Result:`, result);
            return result;
        } catch (error) {
            console.error(`[API] updateProject failed. Error:`, error);
            throw error;
        }
    },
    deleteProject: async (projectId: string): Promise<void> => {
        console.log(`[API] deleteProject called with:`, { projectId });
        try {
            const result = await requests.delete(`/projects/${projectId}`);
            console.log(`[API] deleteProject successful. Result:`, result);
            return result;
        } catch (error) {
            console.error(`[API] deleteProject failed. Error:`, error);
            throw error;
        }
    },

    // --- Guests ---
    inviteGuest: async (email: string, projectId: string): Promise<User> => {
        console.log(`[API] inviteGuest called with:`, { email, projectId });
        // This function calls another function in the same object.
        // The logging for createUser will be triggered automatically.
        try {
            const result = await api.createUser({ 
                name: email.split('@')[0], 
                email: email, 
                role: 'GUEST',
                projectId: projectId,
            });
            console.log(`[API] inviteGuest successful. Result:`, result);
            return result;
        } catch (error) {
            console.error(`[API] inviteGuest failed. Error:`, error);
            throw error;
        }
    },
    revokeGuest: async (guestId: string): Promise<void> => {
        console.log(`[API] revokeGuest called with:`, { guestId });
        try {
            const result = await requests.delete(`/users/${guestId}`);
            console.log(`[API] revokeGuest successful. Result:`, result);
            return result;
        } catch (error) {
            console.error(`[API] revokeGuest failed. Error:`, error);
            throw error;
        }
    },
    
    // --- Users ---
    updateUser: async (updatedUser: User): Promise<User> => {
        console.log(`[API] updateUser called with:`, { updatedUser });
        try {
            const result = await requests.put(`/users/${updatedUser.id}`, updatedUser);
            console.log(`[API] updateUser successful. Result:`, result);
            return result;
        } catch (error) {
            console.error(`[API] updateUser failed. Error:`, error);
            throw error;
        }
    },
    createUser: async (newUserData: Omit<User, 'id' | 'avatarUrl'>): Promise<User> => {
        console.log(`[API] createUser called with:`, { newUserData });
        try {
            const result = await requests.post('/users', newUserData);
            console.log(`[API] createUser successful. Result:`, result);
            return result;
        } catch (error) {
            console.error(`[API] createUser failed. Error:`, error);
            throw error;
        }
    },
    deleteUser: async (userId: string): Promise<User> => {
        console.log(`[API] deleteUser called with:`, { userId });
        try {
            const result = await requests.delete(`/users/${userId}`);
            console.log(`[API] deleteUser successful. Result:`, result);
            return result;
        } catch (error) {
            console.error(`[API] deleteUser failed. Error:`, error);
            throw error;
        }
    },
    
    // --- Teams ---
    createTeam: async (newTeamData: Omit<Team, 'id'>, leaderId: string, memberIds: string[]): Promise<{ team: Team, updatedUsers: User[] }> => {
        console.log(`[API] createTeam called with:`, { newTeamData, leaderId, memberIds });
        try {
            const result = await requests.post('/teams', { teamName: newTeamData.name, team_leader_id: leaderId, member_user_ids: memberIds });
            console.log(`[API] createTeam successful. Result:`, result);
            return result;
        } catch (error) {
            console.error(`[API] createTeam failed. Error:`, error);
            throw error;
        }
    },
    updateTeam: async (updatedTeam: Team, newLeaderId: string | null, newMemberIds: string[]): Promise<{ team: Team, updatedUsers: User[] }> => {
        console.log(`[API] updateTeam called with:`, { updatedTeam, newLeaderId, newMemberIds });
        try {
            const result = await requests.put(`/teams/${updatedTeam.id}`, { teamName: updatedTeam.name, leaderId: newLeaderId, memberIds: newMemberIds });
            console.log(`[API] updateTeam successful. Result:`, result);
            return result;
        } catch (error) {
            console.error(`[API] updateTeam failed. Error:`, error);
            throw error;
        }
    },
    deleteTeam: async (teamId: string): Promise<{ teamId: string, updatedUsers: User[] }> => {
        console.log(`[API] deleteTeam called with:`, { teamId });
        try {
            const result = await requests.delete(`/teams/${teamId}`);
            console.log(`[API] deleteTeam successful. Result:`, result);
            return result;
        } catch (error) {
            console.error(`[API] deleteTeam failed. Error:`, error);
            throw error;
        }
    },
    addUsersToTeam: async (userIds: string[], teamId: string): Promise<User[]> => {
        console.log(`[API] addUsersToTeam called with:`, { userIds, teamId });
        try {
            const result = await requests.post(`/teams/${teamId}/members`, { user_ids: userIds });
            console.log(`[API] addUsersToTeam successful. Result:`, result);
            return result;
        } catch (error) {
            console.error(`[API] addUsersToTeam failed. Error:`, error);
            throw error;
        }
    },
    removeUserFromTeam: async (userId: string, teamId: string): Promise<User> => {
        console.log(`[API] removeUserFromTeam called with:`, { userId, teamId });
        try {
            const result = await requests.delete(`/teams/${teamId}/members/${userId}`);
            console.log(`[API] removeUserFromTeam successful. Result:`, result);
            return result;
        } catch (error) {
            console.error(`[API] removeUserFromTeam failed. Error:`, error);
            throw error;
        }
    },
};
