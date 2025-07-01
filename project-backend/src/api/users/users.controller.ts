import { RequestHandler } from 'express';
import prisma from '../../db';
import bcrypt from 'bcrypt';
import logger from '../../logger';

export const createUser: RequestHandler = async (req, res, next) => {
    const { name, email, role, teamId, projectId } = req.body;
    if (!name || !email || !role) {
        return res.status(400).json({ message: 'Please provide name, email, and role' });
    }
    if (role === 'Guest' && !projectId) {
        return res.status(400).json({ message: 'Guests must be associated with a project.' });
    }

    try {
        const userExists = await prisma.user.findUnique({ where: { email } });
        if (userExists) {
            return res.status(400).json({ message: 'User with this email already exists' });
        }

        // Guests and new employees get a temporary password. They should be prompted to change it.
        const tempPassword = Math.random().toString(36).slice(-8);
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(tempPassword, salt);
        
        const newUser = await prisma.user.create({
            data: {
                name,
                email,
                password: hashedPassword,
                role,
                teamId: teamId || null,
                // Note: projectId is not a direct field on the User model in Prisma schema.
                // This logic might need adjustment depending on how guest access is handled.
                // For now, we omit it as the schema doesn't support it directly on the user.
                avatarUrl: '',
            },
            select: { id: true, name: true, email: true, role: true, teamId: true, avatarUrl: true } // Return the user without the password
        });
        
        // TODO: Send an invitation email to the user with the temporary password and a password creation link.
        logger.info({ message: 'User created by admin', newUserId: newUser.id, adminUserId: req.user?.id });
        res.status(201).json(newUser);
    } catch (error) {
        logger.error({ message: 'Failed to create user', context: { body: req.body, userId: req.user?.id }, error });
        next(error);
    }
};

export const getAllUsers: RequestHandler = async (req, res, next) => {
    try {
        const users = await prisma.user.findMany({
            select: { id: true, name: true, email: true, role: true, teamId: true, avatarUrl: true },
            orderBy: { name: 'asc' }
        });
        res.json(users);
    } catch (error) {
        logger.error({ message: 'Failed to get all users', context: { userId: req.user?.id }, error });
        next(error);
    }
};

export const getUnassignedUsers: RequestHandler = async (req, res, next) => {
    try {
        // Find employees that are not assigned to any team
        const users = await prisma.user.findMany({
            where: {
                role: 'Employee',
                teamId: null,
            },
            select: { id: true, name: true, email: true },
            orderBy: { name: 'asc' }
        });
        res.json(users);
    } catch (error) {
        logger.error({ message: 'Failed to get unassigned users', context: { userId: req.user?.id }, error });
        next(error);
    }
};

export const updateUser: RequestHandler = async (req, res, next) => {
    const { userId } = req.params;
    const { name, email, role, teamId } = req.body;
    if (!name || !email || !role) {
        return res.status(400).json({ message: 'Name, email, and role are required' });
    }

    try {
        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: {
                name,
                email,
                role,
                teamId: teamId || null,
            },
            select: { id: true, name: true, email: true, role: true, teamId: true, avatarUrl: true }
        });
        
        logger.info({ message: 'User updated', updatedUserId: userId, adminUserId: req.user?.id });
        res.json(updatedUser);
    } catch (error) {
        // Handle case where user is not found
        if ((error as any).code === 'P2025') {
            return res.status(404).json({ message: 'User not found' });
        }
        logger.error({ message: 'Failed to update user', context: { userId, body: req.body, adminUserId: req.user?.id }, error });
        next(error);
    }
};

export const deleteUser: RequestHandler = async (req, res, next) => {
    const { userId } = req.params;

    try {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // The old logic had a 'disabled' flag. The new schema performs a hard delete.
        // This is a simplification. For a real production app, a soft delete (like the disabled flag) is often better.
        await prisma.user.delete({
            where: { id: userId }
        });
        
        logger.info({ message: 'User permanently deleted', deletedUserId: userId, adminUserId: req.user?.id });
        res.status(204).send();

    } catch (error) {
        logger.error({ message: 'Failed to delete user', context: { userId, adminUserId: req.user?.id }, error });
        next(error);
    }
};