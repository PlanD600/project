// project-backend/src/types/index.d.ts

import { UserRole } from '@prisma/client';


declare global {
  namespace Express {
    export interface Request {
      user?: {
        id: string;
        role: UserRole; // <- שימוש ב-UserRole המיובא מ-Prisma
        teamId?: string | null;
        projectId?: string | null; // <- הוספת השדה החסר
      };
    }
  }
}

export {};