// project-backend/src/types/express/index.d.ts

// Add 'export' to make this type available in other files
export type UserRole = 'Super Admin' | 'Team Leader' | 'Employee' | 'Guest';

declare global {
  namespace Express {
    export interface Request {
      user?: {
        id: string;
        role: UserRole;
        teamId?: string | null; // Allow null to match Prisma
      };
    }
  }
}