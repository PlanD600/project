import { Request, Response, NextFunction } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';
import asyncHandler from 'express-async-handler';
import prisma from '../db';
import logger from '../logger';

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

    // 1. Read the token specifically from the 'token' cookie.
    if (req.cookies && req.cookies.token) {
        token = req.cookies.token;
    }

    // 2. If no token is found at all, deny access immediately.
    if (!token) {
        logger.warn('Unauthorized access attempt: No token provided.', { path: req.originalUrl, ip: req.ip });
        res.status(401);
        throw new Error('Not authorized, no token');
    }

    // 3. If a token exists, try to verify it.
    try {
        const secret = process.env.JWT_SECRET;
        if (!secret) {
            logger.error('FATAL: JWT_SECRET is not defined. Cannot verify token.');
            throw new Error('Server configuration error.');
        }

        // Decode the token to get the user ID and organization ID
        const decoded = jwt.verify(token, secret) as JwtPayload;

        // 4. Fetch the user from the database using the ID from the token.
        // We select only the necessary, non-sensitive fields.
        const user = await prisma.user.findUnique({
            where: { id: decoded.id },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                organizationId: true,
                avatarUrl: true
            }
        });

        // If the user doesn't exist in the DB, or is missing a crucial link, the token is invalid.
        if (!user || !user.organizationId) {
             logger.warn('Authorization failed: User from token not found or is invalid.', { userId: decoded.id });
             res.status(401);
             throw new Error('Not authorized, user not found.');
        }

        // 5. Success! Attach the user object to the request for use in subsequent routes.
        req.user = user;

        next(); // Proceed to the protected route.

    } catch (error) {
        logger.error('Token verification failed. The token might be expired or malformed.', { error });
        res.status(401);
        throw new Error('Not authorized, token failed');
    }
});
