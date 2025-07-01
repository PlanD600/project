// This file extends the Express Request type to include a user property.
// This allows us to attach the decoded JWT payload to the request object
// in our authentication middleware and access it in downstream controllers.

type UserRole = 'Super Admin' | 'Team Leader' | 'Employee' | 'Guest';

declare global {
  namespace Express {
    export interface Request {
      user?: {
        id: string;
        role: UserRole;
        teamId?: string;
        projectId?: string;
      };
    }
  }
}

// This export is needed to make the file a module
export {}