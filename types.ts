export type UserRole = 'Super Admin' | 'Team Leader' | 'Employee' | 'Guest';

export interface NotificationPreferences {
    onAssignment: boolean;
    onComment: boolean;
    onStatusChange: boolean;
    onDueDateChange: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
  avatarUrl: string;
  role: UserRole;
  teamId?: string;
  projectId?: string; // For guest access
  disabled?: boolean;
  notificationPreferences?: NotificationPreferences;
}

export interface Team {
    id: string;
    name: string;
}

export interface Project {
    id: string;
    name: string;
    description: string;
    teamId: string;
    budget: number;
    startDate: string;
    endDate: string;
}

export interface Comment {
  id:string;
  user: User;
  text: string;
  timestamp: string;
  parentId?: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  assigneeIds: string[];
  columnId: string;
  comments: Comment[];
  startDate: string;
  endDate: string;
  plannedCost: number;
  actualCost: number;
  dependencies: string[];
  baselineStartDate?: string;
  baselineEndDate?: string;
  projectId: string;
  isMilestone?: boolean;
  parentId?: string;
}

export interface Column {
  id: string;
  title: string;
  color: string;
}

export type TransactionType = 'Income' | 'Expense';

export interface FinancialTransaction {
  id: string;
  type: TransactionType;
  date: string;
  source: string; // Client name for income, vendor for expense
  description: string;
  amount: number;
  projectId: string;
}

export interface Notification {
  id: string;
  userId: string; // The user who should see this notification
  text: string;
  timestamp: string;
  read: boolean;
  taskId?: string; // Optional link to a task
}