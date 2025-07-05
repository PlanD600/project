import axios, { AxiosError } from 'axios';
import { User, Task, Project, Team, FinancialTransaction, Comment } from '../types';
import { logger } from './logger';

const apiBaseURL = (import.meta as any).env.VITE_API_BASE_URL || 'http://localhost:8080/api';

// FIX: ייצאנו את apiClient כדי לאפשר גישה ישירה אליו מה-store
export const apiClient = axios.create({
    baseURL: apiBaseURL,
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Interceptor שמוסיף את הטוקן מ-localStorage לכל בקשה יוצאת
apiClient.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        // הוסף את הכותרת רק אם היא לא קיימת כבר (כדי לא לדרוס את הכותרת המיידית מה-store)
        if (token && !config.headers['Authorization']) {
            config.headers['Authorization'] = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Interceptor שמטפל בתגובות שגיאה באופן גלובלי
apiClient.interceptors.response.use(
    (response) => response,
    (error: AxiosError) => {
        let errorMessage = 'An unexpected error occurred.';
        if (error.response?.data && typeof error.response.data === 'object' && 'message' in error.response.data) {
            errorMessage = (error.response.data as { message: string }).message;
        } else if (error.message) {
            errorMessage = error.message;
        }
        logger.error('API call failed', { errorMessage, status: error.response?.status, endpoint: error.config?.url });
        return Promise.reject(new Error(errorMessage));
    }
);

const requests = {
    get: (url: string) => apiClient.get(url).then(response => response.data),
    post: (url: string, body: {}) => apiClient.post(url, body).then(response => response.data),
    put: (url: string, body: {}) => apiClient.put(url, body).then(response => response.data),
    patch: (url: string, body: {}) => apiClient.patch(url, body).then(response => response.data),
    delete: (url: string) => apiClient.delete(url).then(response => response.data),
};

export const api = {
    // --- Auth ---
    // FIX: login מחזירה כעת אובייקט המכיל את המשתמש והטוקן
    login: async (email: string, password: string): Promise<{ user: User, token: string }> => {
        const response = await requests.post('/auth/login', { email, password });
        if (response && response.token && response.user) {
            localStorage.setItem('token', response.token);
            return response;
        }
        throw new Error('Invalid login response from server.');
    },

    // FIX: register מחזירה כעת אובייקט המכיל את המשתמש והטוקן
    register: async (registrationData: {}): Promise<{ user: User, token: string }> => {
        const response = await requests.post('/auth/register', registrationData);
         if (response && response.token && response.user) {
            localStorage.setItem('token', response.token);
            return response;
        }
        throw new Error('Invalid registration response from server.');
    },
    
    logout: async (): Promise<void> => {
        try {
            await requests.post('/auth/logout', {});
        } finally {
            localStorage.removeItem('token');
            delete apiClient.defaults.headers.common['Authorization'];
        }
    },
    
    getMe: (): Promise<User> => requests.get('/auth/me'),
    
    uploadAvatar: (imageDataUrl: string): Promise<User> => requests.post('/auth/me/avatar', { image: imageDataUrl }),

    forgotPassword: (email: string): Promise<{ message: string }> => requests.post('/auth/forgotpassword', { email }),
    
    // FIX: שליחת הטוקן בגוף הבקשה כדי להתאים ל-backend
    resetPassword: (token: string, password: string): Promise<{ message: string }> => requests.patch(`/auth/resetpassword`, { token, password }),

    // --- Data Fetching ---
    getInitialData: (): Promise<{users: User[], teams: Team[], projects: Project[], tasks: Task[]}> => requests.get('/bootstrap'),
    
    // ... שאר הפונקציות נשארות כפי שהיו ...
    // --- Tasks ---
    getTask: (taskId: string): Promise<Task> => requests.get(`/tasks/${taskId}`),
    updateTask: (updatedTask: Task): Promise<Task> => requests.put(`/tasks/${updatedTask.id}`, updatedTask),
    addTask: (taskData: any): Promise<Task> => requests.post(`/projects/${taskData.projectId}/tasks`, taskData),
    addComment: (taskId: string, comment: any): Promise<Task> => requests.post(`/tasks/${taskId}/comments`, { content: comment.text, parentId: comment.parentId }),
    
    // --- Projects ---
    createProject: (projectData: any): Promise<Project> => requests.post('/projects', projectData),
    updateProject: (projectId: string, projectData: Partial<Project>): Promise<Project> => requests.put(`/projects/${projectId}`, projectData),
    deleteProject: (projectId: string): Promise<void> => requests.delete(`/projects/${projectId}`),
    
    // --- Users ---
    updateUser: (updatedUser: User): Promise<User> => requests.put(`/users/${updatedUser.id}`, updatedUser),
    createUser: (newUserData: any): Promise<User> => requests.post('/users', newUserData),
    deleteUser: (userId: string): Promise<User> => requests.delete(`/users/${userId}`),
    
    // --- Teams ---
    createTeam: (newTeamData: any, leaderId: string, memberIds: string[]): Promise<{ team: Team, updatedUsers: User[] }> => requests.post('/teams', { teamName: newTeamData.name, team_leader_id: leaderId, member_user_ids: memberIds }),
    updateTeam: (updatedTeam: Team, newLeaderId: string | null, newMemberIds: string[]): Promise<{ team: Team, updatedUsers: User[] }> => requests.put(`/teams/${updatedTeam.id}`, { teamName: updatedTeam.name, leaderId: newLeaderId, memberIds: newMemberIds }),
    deleteTeam: (teamId: string): Promise<{ teamId: string, updatedUsers: User[] }> => requests.delete(`/teams/${teamId}`),
};