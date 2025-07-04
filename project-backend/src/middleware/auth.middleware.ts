import { Request, Response, NextFunction, RequestHandler } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';
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
                teamId: string | null; // Ensures teamId is part of the type
                avatarUrl: string | null;
            };
        }
    }
}

/**
 * Middleware to protect routes.
 * It checks for a valid JWT in the cookies and attaches the user to the request.
 */
export const protect = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    let token;

    if (req.cookies && req.cookies.token) {
        token = req.cookies.token;
    }

    if (!token) {
        logger.warn('Unauthorized access attempt: No token provided.', { path: req.originalUrl, ip: req.ip });
        res.status(401);
        throw new Error('Not authorized, no token');
    }

    try {
        const secret = process.env.JWT_SECRET;
        if (!secret) {
            logger.error('FATAL: JWT_SECRET is not defined. Cannot verify token.');
            throw new Error('Server configuration error.');
        }

        const decoded = jwt.verify(token, secret) as JwtPayload;

        // Fetch the user from the database.
        // *** FIX 1: Added 'teamId' to the select statement. ***
        const user = await prisma.user.findUnique({
            where: { id: decoded.id },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                organizationId: true,
                teamId: true, // This was the missing field
                avatarUrl: true
            }
        });

        if (!user || !user.organizationId) {
             logger.warn('Authorization failed: User from token not found or is invalid.', { userId: decoded.id });
             res.status(401);
             throw new Error('Not authorized, user not found.');
        }

        req.user = user;
        next();

    } catch (error) {
        logger.error('Token verification failed. The token might be expired or malformed.', { error });
        res.status(401);
        throw new Error('Not authorized, token failed');
    }
});

/**
 * Middleware to authorize routes based on user roles.
 * Example: authorize('ADMIN', 'TEAM_MANAGER')
 * @param {...string} roles - A list of roles that are allowed to access the route.
 */
// *** FIX 2: Added the missing 'authorize' middleware function. ***
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