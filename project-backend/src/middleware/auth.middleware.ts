


import { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import logger from '../logger';

/**
 * Middleware to protect routes by verifying a JWT.
 * It checks for a 'jwt_token' in the request's cookies.
 * If the token is valid, it decodes the payload and attaches it to `req.user`.
 */
export const protect: RequestHandler = (req, res, next) => {
    const token = req.cookies.jwt_token;

    if (!token) {
        return res.status(401).json({ message: 'Not authorized, no token provided' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET!);
        req.user = decoded as Express.Request['user'];
        next();
    } catch (error) {
        logger.warn({
            message: 'JWT verification failed',
            error,
            ip: req.ip,
        });
        return res.status(401).json({ message: 'Not authorized, token failed' });
    }
};

/**
 * Middleware factory to check for specific user roles.
 * @param roles A list of authorized roles.
 */
export const authorize = (...roles: string[]): RequestHandler => {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            logger.warn({
                message: 'Authorization denied for route',
                requiredRoles: roles,
                userRole: req.user?.role,
                userId: req.user?.id,
                route: req.originalUrl,
            });
            return res.status(403).json({ message: `User role '${req.user?.role}' is not authorized to access this route` });
        }
        next();
    }
}