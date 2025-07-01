// src/types/express.d.ts
import { User as PrismaUser, UserRole } from '@prisma/client';

// הרחבת ה-namespace הגלובלי של Express
declare global {
  namespace Express {
    // הרחבת הממשק Request כדי להוסיף את שדה ה-user
    // ה-user הוא PrismaUser בתוספת שדה אופציונלי projectId
    interface Request {
      user?: PrismaUser & { projectId?: string | null };
    }
  }
}