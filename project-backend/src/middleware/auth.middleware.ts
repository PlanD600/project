import { Request, Response, NextFunction, RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import asyncHandler from 'express-async-handler';
import prisma from '../db';
import logger from '../logger';
import { UserRole } from '@prisma/client';

// We extend the global Express Request type to include our custom 'user' property.
// This tells TypeScript that we are adding 'user' to the request object.
declare global {
    namespace Express {
        interface Request {
            user?: {
                id: string;
                organizationId: string;
                name: string;
                email: string;
                role: string;
                teamId: string | null;
                avatarUrl: string | null;
            };
        }
    }
}

/**
 * Middleware to protect routes.
 * It checks for a valid JWT in the Authorization header and attaches the user to the request.
 */
export const protect = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    let token;

    // 1. נבדוק אם הטוקן נשלח בכותרת ה-Authorization
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            // 2. נחלץ את הטוקן מהכותרת (הוא מגיע בפורמט 'Bearer <token>')
            token = req.headers.authorization.split(' ')[1];

            if (!process.env.JWT_SECRET) {
                logger.error('FATAL: JWT_SECRET is not defined in protect middleware.');
                throw new Error('Server configuration error');
            }
            
            // 3. נאמת את הטוקן
            const decoded = jwt.verify(token, process.env.JWT_SECRET) as { id: string };

            // 4. נמצא את המשתמש לפי ה-ID מהטוקן ונצרף אותו לבקשה
            const user = await prisma.user.findUnique({
                where: { id: decoded.id },
                select: {
                    id: true,
                    email: true,
                    name: true,
                    avatarUrl: true,
                    role: true,
                    organizationId: true,
                    teamId: true,
                }
            });

            if (!user) {
                res.status(401);
                throw new Error('Not authorized, user not found');
            }
            
            req.user = user; // הוספת המשתמש ל-req
            
            next(); // המשתמש מאומת, נעבור לפונקציה הבאה
            return; // נוודא שהפונקציה מסיימת כאן

        } catch (error) {
            logger.error('Token verification failed:', { error });
            res.status(401);
            throw new Error('Not authorized, token failed');
        }
    }

    if (!token) {
        logger.warn('Unauthorized access attempt: No token provided in headers.');
        res.status(401);
        throw new Error('Not authorized, no token');
    }
});

/**
 * Middleware to authorize routes based on user roles.
 * Example: authorize('ADMIN', 'TEAM_MANAGER')
 * @param {...string} roles - A list of roles that are allowed to access the route.
 */
export const authorize = (...roles: UserRole[]): RequestHandler => {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role as UserRole)) {
            logger.warn({
                message: 'Forbidden: User does not have the right role for this resource.',
                userId: req.user?.id,
                userRole: req.user?.role,
                requiredRoles: roles,
                path: req.originalUrl
            });
            res.status(403);
            throw new Error(`User role '${req.user?.role}' is not authorized to access this route`);
        }
        next();
    };
};
