import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import asyncHandler from 'express-async-handler';
import prisma from '../db';
import logger from '../logger';
import { UserRole } from '@prisma/client'; // ודא ששורה זו קיימת או הוסף אותה בראש הקובץ


// 1. Define the "contract" for our token's payload
interface JwtPayload {
  id: string;
  organizationId: string;
}

export const authorize = (...roles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      // This case should ideally be caught by 'protect' middleware first
      res.status(401);
      throw new Error('Not authorized');
    }

    if (!roles.includes(req.user.role)) {
      res.status(403); // 403 Forbidden - user is authenticated but not authorized
      logger.warn({ message: 'Forbidden: User role not authorized for this route.', userId: req.user.id, userRole: req.user.role, requiredRoles: roles });
      throw new Error(`User role ${req.user.role} is not authorized to access this route`);
    }
    
    // If user role is in the allowed roles, proceed to the next middleware/controller
    next();
  };
};

export const protect = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // Get token from header
      token = req.headers.authorization.split(' ')[1];

      // Verify token
      const secret = process.env.JWT_SECRET;
      if (!secret) {
        throw new Error('JWT_SECRET not defined');
      }
      
      // 2. Verify the token AND tell TypeScript to trust our "contract" (as JwtPayload)
      const decoded = jwt.verify(token, secret) as JwtPayload;

      // Now TypeScript knows that decoded.organizationId exists
      if (!decoded.id || !decoded.organizationId) {
        res.status(401);
        throw new Error('Not authorized, token payload is invalid');
      }

      // 3. Use the merged logic from our previous discussion
      const user = await prisma.user.findFirst({
        where: {
          id: decoded.id,
          organizationId: decoded.organizationId,
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          avatarUrl: true,
          teamId: true,
          organizationId: true,
        }
      });

      if (!user) {
        res.status(401);
        throw new Error('Not authorized, user not found');
      }
      
      req.user = user; // The user object (including orgId) is now on the request
      
      next();

    } catch (error) {
      logger.error('Not authorized, token failed', error);
      res.status(401);
      throw new Error('Not authorized');
    }
  }

  if (!token) {
    res.status(401);
    throw new Error('Not authorized, no token');
  }
});