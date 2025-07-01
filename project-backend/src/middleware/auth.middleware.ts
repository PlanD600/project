import { Request, Response, NextFunction, RequestHandler } from 'express'; // <--- 1. עדכנו את הייבוא
import jwt from 'jsonwebtoken';
import prisma from '../db';
import logger from '../logger';
import { UserRole } from '../types/express';

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
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { id: string };

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

        req.user = { 
            id: currentUser.id,
            role: currentUser.role as UserRole,
            teamId: currentUser.teamId
        };
        next();
    } catch (error) {
        logger.error({ message: 'Token verification failed', error });
        return res.status(401).json({ message: 'Not authorized, token failed' });
    }
};

// <--- 2. הוספנו את הפונקציה החסרה
export const authorize = (...roles: string[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({ message: 'User role not authorized for this action' });
        }
        next();
    };
};