import { Request, Response, NextFunction, RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../db';
import logger from '../logger';
// אין צורך לייבא UserRole מ- '../types' אם אתה משתמש ב-Prisma's UserRole
// אם השתמשת ב-UserRole משלך, וודא שהוא תואם ל-Prisma.UserRole
// אלא אם כן UserRole הוא enum שהגדרת בנפרד, עדיף להשתמש ב-Prisma.UserRole.
import { UserRole } from '@prisma/client'; // שינוי: ייבוא UserRole מ-Prisma

export const protect: RequestHandler = async (req, res, next) => {
    let token;

    if (req.cookies && req.cookies.token) {
        token = req.cookies.token;
    } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
        return res.status(401).json({ message: 'Not authorized, no token' });
    }

    try {
        // ודא שה-JWT מכיל גם את ה-id וגם את ה-projectId אם זה משתמש אורח
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { id: string; projectId?: string }; // הוספת projectId לטיפוס של decoded

        const currentUser = await prisma.user.findUnique({
            where: { id: decoded.id },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                avatarUrl: true,
                teamId: true,
            }
        });

        if (!currentUser) {
            return res.status(401).json({ message: 'Not authorized, user not found' });
        }

        // בניית האובייקט req.user בהתאם לתפקיד
        if (currentUser.role === 'Guest') {
            // אם המשתמש הוא אורח, נוסיף את ה-projectId לאובייקט req.user.
            // הנחה: projectId מגיע מתוך ה-JWT.
            // אם לא, יהיה עליך למשוך אותו ממקור אחר (לדוגמה, DB).
            (req as Request).user = {
                id: currentUser.id,
                role: currentUser.role as UserRole,
                teamId: currentUser.teamId,
                projectId: decoded.projectId || null, // או קבלת ה-projectId ממקור אחר
            };
        } else {
            // עבור תפקידים אחרים, האובייקט כפי שהיה
            (req as Request).user = {
                id: currentUser.id,
                role: currentUser.role as UserRole,
                teamId: currentUser.teamId,
                // projectId לא נחוץ עבורם, או שניתן להוסיף null אם רוצים שיהיה תמיד
                // projectId: null,
            };
        }
        
        next();
    } catch (error) {
        logger.error({ message: 'Token verification failed', error });
        return res.status(401).json({ message: 'Not authorized, token failed' });
    }
};

export const authorize = (...roles: UserRole[]) => { // שינוי: שימוש ב-UserRole מ-Prisma
    return (req: Request, res: Response, next: NextFunction) => {
        // יש לוודא ש-req.user.role מוגדר כ-UserRole מ-Prisma
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({ message: 'User role not authorized for this action' });
        }
        next();
    };
};