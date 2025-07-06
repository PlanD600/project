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
                name: string;
                email: string;
                avatarUrl: string | null;
                teamId: string | null;
                // Multi-tenant properties (temporary until schema migration)
                activeOrganizationId: string;
                activeRole: UserRole;
                memberships: Array<{
                    organizationId: string;
                    role: UserRole;
                }>;
            };
        }
    }
}

/**
 * Middleware to protect routes.
 * It checks for a valid JWT in the Authorization header and validates organization membership.
 * TEMPORARY: This version works with the current schema until we migrate to multi-tenant.
 */
export const protect = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    let token;

    // 1. Check if token is sent in Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            // 2. Extract token from header (format: 'Bearer <token>')
            token = req.headers.authorization.split(' ')[1];

            if (!process.env.JWT_SECRET) {
                logger.error('FATAL: JWT_SECRET is not defined in protect middleware.');
                throw new Error('Server configuration error');
            }
            
            // 3. Verify the token
            const decoded = jwt.verify(token, process.env.JWT_SECRET) as { id: string };

            // 4. Get active organization ID from header (optional for now)
            const activeOrganizationId = req.headers['x-active-organization-id'] as string;
            
            // 5. Find user (temporary - using current schema)
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

            // 6. For now, use the user's organizationId as active organization
            const currentActiveOrgId = activeOrganizationId || user.organizationId;
            
            // 7. Attach user with active organization context to request
            req.user = {
                id: user.id,
                email: user.email,
                name: user.name,
                avatarUrl: user.avatarUrl,
                teamId: user.teamId,
                activeOrganizationId: currentActiveOrgId,
                activeRole: user.role as UserRole,
                memberships: [{
                    organizationId: user.organizationId,
                    role: user.role as UserRole
                }]
            };
            
            next();
            return;

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
 * Middleware to authorize routes based on user roles within the active organization.
 * Example: authorize('SUPER_ADMIN', 'ORG_ADMIN')
 * @param {...string} roles - A list of roles that are allowed to access the route.
 */
export const authorize = (...roles: UserRole[]): RequestHandler => {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.activeRole)) {
            logger.warn({
                message: 'Forbidden: User does not have the right role for this resource.',
                userId: req.user?.id,
                userRole: req.user?.activeRole,
                activeOrganizationId: req.user?.activeOrganizationId,
                requiredRoles: roles,
                path: req.originalUrl
            });
            res.status(403);
            throw new Error(`User role '${req.user?.activeRole}' is not authorized to access this route`);
        }
        next();
    };
};

/**
 * Middleware to check if user is a Super Admin (can manage multiple organizations)
 * TEMPORARY: This will be updated after schema migration
 */
export const requireSuperAdmin = (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
        res.status(401);
        throw new Error('Not authorized');
    }

    // For now, check if user has ADMIN role (will be updated to SUPER_ADMIN after migration)
    const hasSuperAdminRole = req.user.memberships.some(
        membership => membership.role === 'ADMIN' as any
    );

    if (!hasSuperAdminRole) {
        logger.warn({
            message: 'Forbidden: User is not a Super Admin.',
            userId: req.user.id,
            path: req.originalUrl
        });
        res.status(403);
        throw new Error('Super Admin privileges required');
    }

    next();
};

/**
 * Middleware to check if user can manage the current organization
 * TEMPORARY: This will be updated after schema migration
 */
export const requireOrgManagement = (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
        res.status(401);
        throw new Error('Not authorized');
    }

    // Check if user has admin role in the active organization
    const canManageOrg = ['ADMIN', 'TEAM_MANAGER'].includes(req.user.activeRole as any);

    if (!canManageOrg) {
        logger.warn({
            message: 'Forbidden: User cannot manage this organization.',
            userId: req.user.id,
            userRole: req.user.activeRole,
            activeOrganizationId: req.user.activeOrganizationId,
            path: req.originalUrl
        });
        res.status(403);
        throw new Error('Organization management privileges required');
    }

    next();
};
