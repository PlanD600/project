import axios, { AxiosError } from 'axios';
import { User, Task, Project, Team, FinancialTransaction, Comment } from '../types';
import { logger } from './logger';

const apiClient = axios.create({
    baseURL: (import.meta as any).env.VITE_API_BASE_URL || 'http://localhost:8080/api',
    headers: {
        'Content-Type': 'application/json',
    },
    withCredentials: true, // This is crucial for sending HttpOnly cookies
});

// Add a response interceptor for handling errors globally
apiClient.interceptors.response.use(
    (response) => response,
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


// Helper function to extract data from response
const getData = (response: { data: any }) => response.data;

export const api = {
    // --- Auth ---
    login: async (email: string, password: string): Promise<User | null> => {
        return apiClient.post('/auth/login', { email, password }).then(getData);
    },

    register: async (registrationData: { fullName: string; email: string; password: string; companyName: string; }): Promise<{ user: User, organizationSettings: { name: string, logoUrl: string } }> => {
        const user = await apiClient.post('/auth/register', registrationData).then(getData);
        return { user, organizationSettings: { name: registrationData.companyName, logoUrl: '' } };
    },

    logout: async (): Promise<void> => {
        await apiClient.post('/auth/logout');
    },
    
    getMe: async (): Promise<User> => {
        return apiClient.get('/auth/me').then(getData);
    },

    // --- Initial Data Fetch ---
    getInitialData: async (): Promise<{users: User[], teams: Team[], projects: Project[], tasks: Task[], financials: FinancialTransaction[], organizationSettings: {name: string, logoUrl: string}}> => {
        return apiClient.get('/bootstrap').then(getData);
    },
    
    // --- Tasks ---
    updateTask: async (updatedTask: Task): Promise<Task> => {
        return apiClient.put(`/tasks/${updatedTask.id}`, updatedTask).then(getData);
    },
    
    bulkUpdateTasks: async (updatedTasks: Task[]): Promise<Task[]> => {
        return apiClient.patch('/tasks', { tasks: updatedTasks }).then(getData);
    },

    addTask: async (taskData: Omit<Task, 'id'>): Promise<Task> => {
        return apiClient.post(`/projects/${taskData.projectId}/tasks`, taskData).then(getData);
    },

    addComment: async(taskId: string, comment: Comment): Promise<Task> => {
        return apiClient.post(`/tasks/${taskId}/comments`, { content: comment.text, parentId: comment.parentId }).then(getData);
    },
    
    // --- Financials ---
    addFinancialTransaction: async(transactionData: Omit<FinancialTransaction, 'id'>): Promise<FinancialTransaction> => {
        return apiClient.post('/finances/entries', transactionData).then(getData);
    },

    // --- Projects ---
    createProject: async(projectData: Omit<Project, 'id'>): Promise<Project> => {
        return apiClient.post('/projects', projectData).then(getData);
    },

    // --- Guests ---
    inviteGuest: async(email: string, projectId: string): Promise<User> => {
         return api.createUser({ 
             name: email.split('@')[0], 
             email: email, 
             role: 'Guest',
             projectId: projectId,
         });
    },

    revokeGuest: async(guestId: string): Promise<void> => {
        await apiClient.delete(`/users/${guestId}`);
    },
    
    // --- Users ---
    updateUser: async(updatedUser: User): Promise<User> => {
        return apiClient.put(`/users/${updatedUser.id}`, updatedUser).then(getData);
    },

    createUser: async (newUserData: Omit<User, 'id' | 'avatarUrl'>): Promise<User> => {
        return apiClient.post('/users', newUserData).then(getData);
    },

    deleteUser: async(userId: string): Promise<User> => {
        return apiClient.delete(`/users/${userId}`).then(getData);
    },
    
    // --- Teams ---
    createTeam: async(newTeamData: Omit<Team, 'id'>, leaderId: string, memberIds: string[]): Promise<{ team: Team, updatedUsers: User[] }> => {
        return apiClient.post('/teams', { teamName: newTeamData.name, team_leader_id: leaderId, member_user_ids: memberIds }).then(getData);
    },
    
    updateTeam: async(updatedTeam: Team, newLeaderId: string | null, newMemberIds: string[]): Promise<{ team: Team, updatedUsers: User[] }> => {
        return apiClient.put(`/teams/${updatedTeam.id}`, { teamName: updatedTeam.name, leaderId: newLeaderId, memberIds: newMemberIds }).then(getData);
    },
    
    deleteTeam: async(teamId: string): Promise<{ teamId: string, updatedUsers: User[] }> => {
        return apiClient.delete(`/teams/${teamId}`).then(getData);
    },

    addUsersToTeam: async (userIds: string[], teamId: string): Promise<User[]> => {
        return apiClient.post(`/teams/${teamId}/members`, { user_ids: userIds }).then(getData);
    },

    removeUserFromTeam: async (userId: string, teamId: string): Promise<User> => {
        return apiClient.delete(`/teams/${teamId}/members/${userId}`).then(getData);
    },
};