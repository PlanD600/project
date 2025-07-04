import axios, { AxiosError } from 'axios';
import { User, Task, Project, Team, FinancialTransaction, Comment } from '../types';
import { logger } from './logger';

// --- START OF CHANGES ---

// The base URL for the API is now loaded from environment variables.
// This is the most important change for making your app work on Render.
const baseURL = import.meta.env.VITE_API_URL;

// If the environment variable is not set, we log a critical error.
if (!baseURL) {
  console.error("CRITICAL ERROR: The 'VITE_API_URL' environment variable is not defined.");
  console.error("Please set it in your .env file for local development, or in your hosting provider's settings (e.g., Render).");
  logger.error("CRITICAL: VITE_API_URL is not defined!");
}

// Log the URL being used for easier debugging.
logger.info(`API is configured to use baseURL: ${baseURL}`);

// --- END OF CHANGES ---


const apiClient = axios.create({
    // We use the dynamic baseURL from the environment variable.
    baseURL: baseURL,
    // This is crucial for sending cookies with requests for authentication.
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request Interceptor: Log outgoing requests (from your original code)
apiClient.interceptors.request.use(
    (config) => {
        logger.info(`Sending ${config.method?.toUpperCase()} request to ${config.url}`, {
            method: config.method,
            url: config.url,
            // Log data only if it exists
            ...(config.data && { data: config.data }),
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

// Response Interceptor: Log responses and handle errors (from your original code)
apiClient.interceptors.response.use(
    (response) => {
        logger.info(`Received successful response from ${response.config.method?.toUpperCase()} ${response.config.url}`, {
            status: response.status,
            // Log a preview of the data to avoid overly long logs
            dataPreview: response.data ? (JSON.stringify(response.data).substring(0, 100) + '...') : 'No data',
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

        // This makes sure the error that is thrown contains the specific message from the server
        return Promise.reject(new Error(errorMessage));
    }
);

// Helper object to wrap the axios methods and extract data
const requests = {
    get: (url: string) => apiClient.get(url).then(response => response.data),
    post: (url: string, body: {}) => apiClient.post(url, body).then(response => response.data),
    put: (url: string, body: {}) => apiClient.put(url, body).then(response => response.data),
    patch: (url: string, body: {}) => apiClient.patch(url, body).then(response => response.data),
    delete: (url: string) => apiClient.delete(url).then(response => response.data),
};

// Your structured api object, now using the dynamic apiClient
export const api = {
    // --- Auth ---
    login: (email: string, password: string): Promise<User | null> => requests.post('/auth/login', { email, password }),
    register: (registrationData: {}): Promise<{ user: User, organizationSettings: { name: string, logoUrl: string } }> => requests.post('/auth/register', registrationData),
    logout: (): Promise<void> => requests.post('/auth/logout', {}),
    getMe: (): Promise<User> => requests.get('/auth/me'),
    uploadAvatar: (imageDataUrl: string): Promise<User> => requests.post('/auth/me/avatar', { image: imageDataUrl }),

    // --- Initial Data Fetch ---
    getInitialData: (): Promise<{ users: User[], teams: Team[], projects: Project[], tasks: Task[], financials: FinancialTransaction[], organizationSettings: { name: string, logoUrl: string } }> => requests.get('/bootstrap'),

    // --- Tasks ---
    getTask: (taskId: string): Promise<Task> => requests.get(`/tasks/${taskId}`),
    updateTask: (updatedTask: Task): Promise<Task> => requests.put(`/tasks/${updatedTask.id}`, updatedTask),
    bulkUpdateTasks: (updatedTasks: Task[]): Promise<Task[]> => requests.patch('/tasks', { tasks: updatedTasks }),
    addTask: (taskData: Omit<Task, 'id'>): Promise<Task> => requests.post(`/projects/${taskData.projectId}/tasks`, taskData),
    addComment: (taskId: string, comment: Comment): Promise<Task> => requests.post(`/tasks/${taskId}/comments`, { content: comment.text, parentId: comment.parentId }),

    // --- Generic Post ---
    post: (url: string, data: any) => requests.post(url, data),

    // --- Financials ---
    addFinancialTransaction: (transactionData: Omit<FinancialTransaction, 'id'>): Promise<FinancialTransaction> => requests.post('/finances/entries', transactionData),

    // --- Projects ---
    createProject: (projectData: Omit<Project, 'id' | 'status'>): Promise<Project> => requests.post('/projects', projectData),
    updateProject: (projectId: string, projectData: Partial<Project>): Promise<Project> => requests.put(`/projects/${projectId}`, projectData),
    deleteProject: (projectId: string): Promise<void> => requests.delete(`/projects/${projectId}`),

    // --- Guests ---
    inviteGuest: (email: string, projectId: string): Promise<User> => api.createUser({ name: email.split('@')[0], email: email, role: 'GUEST', projectId: projectId }),
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
