import { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../db';
import logger from '../logger';
import { UserRole } from '../types/express'; // Import the UserRole type

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

        // Cast role to UserRole to satisfy the type definition
        req.user = { ...currentUser, role: currentUser.role as UserRole };
        next();
    } catch (error) {
        logger.error({ message: 'Token verification failed', error });
        return res.status(401).json({ message: 'Not authorized, token failed' });
    }
};