import { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../db';
import logger from '../logger';

export const protect: RequestHandler = async (req, res, next) => {
    let token;

    if (req.cookies && req.cookies.token) {
        token = req.cookies.token;
    } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
        logger.warn({ message: 'Authorization attempt with no token' });
        return res.status(401).json({ message: 'Not authorized, no token' });
    }

    try {
        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { id: string };

        // Get user from the db using Prisma
        const currentUser = await prisma.user.findUnique({
            where: { id: decoded.id },
            select: { // Select only the necessary fields, excluding the password
                id: true,
                name: true,
                email: true,
                role: true,
                avatarUrl: true,
                teamId: true,
            }
        });

        if (!currentUser) {
            logger.warn({ message: 'Authorization attempt with a valid token but user not found', userId: decoded.id });
            return res.status(401).json({ message: 'Not authorized, user not found' });
        }

        // Attach user to the request object
        req.user = currentUser;
        next();
    } catch (error) {
        logger.error({ message: 'Token verification failed', error });
        return res.status(401).json({ message: 'Not authorized, token failed' });
    }
};