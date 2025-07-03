// project-backend/src/types/express/express.d.ts

import { User } from '@prisma/client';

// Define the precise structure of our user object after it's been selected from the DB in the middleware
interface AuthenticatedUser {
  id: string;
  name: string | null;
  email: string;
  role: import('@prisma/client').UserRole;
  avatarUrl: string | null;
  teamId: string | null;
  organizationId: string;
}

declare global {
  namespace Express {
    export interface Request {
      // This tells TypeScript that the 'user' property on any Express Request object
      // will have the shape of our AuthenticatedUser interface.
      user?: AuthenticatedUser;
    }
  }
}

// This empty export is needed to treat this file as a module.
export {};