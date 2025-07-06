// Updated roles to support multi-tenant model
export type UserRole = 'SUPER_ADMIN' | 'ORG_ADMIN' | 'TEAM_LEADER' | 'EMPLOYEE' | 'GUEST';

// New interface for user-organization membership
export interface Membership {
  id: string;
  userId: string;
  organizationId: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
  user?: User;
  organization?: Organization;
}

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
  // Multi-tenant relationships
  memberships: Membership[];
  // Project relationships
  ledProjects: User[];
  teamId?: string; // For team membership
  projectId?: string; // For GUEST access
  disabled?: boolean;
  notificationPreferences?: NotificationPreferences;
}

export interface Team {
  id: string;
  name: string;
  organizationId: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  teamLeaders: User[];
  teamId?: string; // For team association
  organizationId: string;
  budget: number;
  startDate: string;
  endDate: string;
  status: 'active' | 'archived';
}

export interface Comment {
  id: string;
  user: User;
  text: string;
  timestamp: string;
  parentId?: string;
  organizationId: string;
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
  organizationId: string;
  isMilestone?: boolean;
  parentId?: string;
  color?: string; // Hex color code for task color-coding
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
  organizationId: string;
}

export interface Notification {
  id: string;
  userId: string; // The user who should see this notification
  text: string;
  timestamp: string;
  read: boolean;
  taskId?: string; // Optional link to a task
  organizationId: string;
}

export interface ProjectSubmissionData {
    name: string;
    description: string;
    startDate: string;
    endDate: string;
    budget: number;
    teamLeaderIds: string[];
}

export interface Organization {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  planType: 'FREE' | 'BUSINESS' | 'ENTERPRISE';
  subscriptionStatus: 'ACTIVE' | 'PAST_DUE' | 'CANCELED';
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  // Multi-tenant relationships
  memberships: Membership[];
  _count?: {
    users: number;
    projects: number;
    teams: number;
  };
}

export interface SubscriptionInfo {
  currentPlan: 'FREE' | 'BUSINESS' | 'ENTERPRISE';
  status: 'ACTIVE' | 'PAST_DUE' | 'CANCELED';
  nextBillingDate?: string;
  projectCount: number;
  projectLimit: number;
  companyCount: number;
  companyLimit: number;
  canDowngrade: boolean;
  stripeCustomerId?: string;
}