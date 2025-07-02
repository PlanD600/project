// project-backend/src/api/users/users.controller.ts
import { RequestHandler } from 'express';
import prisma from '../../db';
import bcrypt from 'bcrypt';
import logger from '../../logger';

export const createUser: RequestHandler = async (req, res, next) => {
    const { name, email, role, teamId, projectId } = req.body; // projectId might be sent for GUEST role
    const adminUser = req.user;

    if (!name || !email || !role) {
        logger.warn({ message: 'User creation failed: Missing required fields.', context: { adminUserId: adminUser?.id, body: req.body } });
        return res.status(400).json({ message: 'Please provide name, email, and role' });
    }
    // Specific logic for GUEST role if projectId is indeed used for guest users (assuming it's transient)
    if (role === 'GUEST' && !projectId) {
        logger.warn({ message: 'Guest user creation failed: Missing projectId for guest.', context: { adminUserId: adminUser?.id, email } });
        return res.status(400).json({ message: 'Guests must be associated with a project.' });
    }


    try {
        logger.info({ message: 'Attempting to create user by admin.', email, role, teamId, adminUserId: adminUser?.id });
        const userExists = await prisma.user.findUnique({ where: { email } });
        if (userExists) {
            logger.warn({ message: 'User creation failed: User with this email already exists.', email, adminUserId: adminUser?.id });
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
                avatarUrl: '', // Default avatar URL
            },
            select: { id: true, name: true, email: true, role: true, teamId: true, avatarUrl: true } // Return the user without the password
        });
        
        // If the new user is a GUEST, you might want to link them to a project
        // This depends on your Prisma schema. If User has a direct projectId, add it here.
        // Assuming 'projectId' is not a direct field on User in Prisma and is handled via JWT for GUEST for now.
        // If you need to store it in DB for GUEST, you'd add it to the schema and here.

        logger.info({ message: 'User created by admin successfully.', newUserId: newUser.id, email: newUser.email, role: newUser.role, adminUserId: adminUser?.id });
        res.status(201).json(newUser);
    } catch (error) {
        logger.error({ message: 'Failed to create user by admin.', context: { body: req.body, adminUserId: adminUser?.id }, error });
        next(error);
    }
};

export const getAllUsers: RequestHandler = async (req, res, next) => {
    const user = req.user;
    try {
        logger.info({ message: 'Attempting to get all users.', userId: user?.id, role: user?.role });
        const users = await prisma.user.findMany({
            select: { id: true, name: true, email: true, role: true, teamId: true, avatarUrl: true },
            orderBy: { name: 'asc' }
        });
        logger.info({ message: 'All users fetched successfully.', usersCount: users.length, userId: user?.id });
        res.json(users);
    } catch (error) {
        logger.error({ message: 'Failed to get all users.', context: { userId: user?.id }, error });
        next(error);
    }
};

export const getUnassignedUsers: RequestHandler = async (req, res, next) => {
    const user = req.user;
    try {
        logger.info({ message: 'Attempting to get unassigned users.', userId: user?.id, role: user?.role });
        // Find employees that are not assigned to any team
        const users = await prisma.user.findMany({
            where: {
                role: 'Employee',
                teamId: null,
            },
            select: { id: true, name: true, email: true },
            orderBy: { name: 'asc' }
        });
        logger.info({ message: 'Unassigned users fetched successfully.', unassignedUsersCount: users.length, userId: user?.id });
        res.json(users);
    } catch (error) {
        logger.error({ message: 'Failed to get unassigned users.', context: { userId: user?.id }, error });
        next(error);
    }
};

export const updateUser: RequestHandler = async (req, res, next) => {
    const { userId } = req.params;
    const { name, email, role, teamId } = req.body;
    const adminUser = req.user;

    if (!name || !email || !role) {
        logger.warn({ message: 'User update failed: Missing required fields.', context: { userId, adminUserId: adminUser?.id, body: req.body } });
        return res.status(400).json({ message: 'Name, email, and role are required' });
    }

    try {
        logger.info({ message: 'Attempting to update user.', userId, adminUserId: adminUser?.id, updateData: { name, email, role, teamId } });
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
        
        logger.info({ message: 'User updated successfully.', updatedUserId: userId, adminUserId: adminUser?.id });
        res.json(updatedUser);
    } catch (error) {
        if ((error as any).code === 'P2025') {
            logger.warn({ message: 'User update failed: User not found.', userId, adminUserId: adminUser?.id });
            return res.status(404).json({ message: 'User not found' });
        }
        logger.error({ message: 'Failed to update user.', context: { userId, body: req.body, adminUserId: adminUser?.id }, error });
        next(error);
    }
};

export const deleteUser: RequestHandler = async (req, res, next) => {
    const { userId } = req.params;
    const adminUser = req.user;

    try {
        logger.info({ message: 'Attempting to delete user.', userId, adminUserId: adminUser?.id });
        const userToDelete = await prisma.user.findUnique({ where: { id: userId } });
        if (!userToDelete) {
            logger.warn({ message: 'User deletion failed: User not found.', userId, adminUserId: adminUser?.id });
            return res.status(404).json({ message: 'User not found' });
        }

        await prisma.user.delete({
            where: { id: userId }
        });
        
        logger.info({ message: 'User permanently deleted successfully.', deletedUserId: userId, adminUserId: adminUser?.id });
        res.status(204).send();

    } catch (error) {
        if ((error as any).code === 'P2003') { // Foreign key constraint failed
             logger.error({ message: 'Cannot delete user: User is linked to other records (e.g., owner of a project, assigned to tasks).', context: { userId, adminUserId: adminUser?.id }, error });
             return res.status(400).json({ message: 'Cannot delete user. This user is associated with existing projects or tasks.' });
        }
        logger.error({ message: 'Failed to delete user.', context: { userId, adminUserId: adminUser?.id }, error });
        next(error);
    }
};