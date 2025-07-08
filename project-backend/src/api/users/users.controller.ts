// project-backend/src/api/users/users.controller.ts
import { Request, Response, NextFunction, RequestHandler } from 'express';
import prisma from '../../db';
import bcrypt from 'bcrypt';
import logger from '../../logger';
import { UserRole } from '@prisma/client';
import { z } from 'zod';

const createUserSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email'),
  role: z.string().min(1, 'Role is required'),
  teamId: z.string().optional(),
  projectId: z.string().optional(),
});

const updateUserSchema = z.object({
  name: z.string().min(1, 'Name is required').optional(),
  email: z.string().email('Invalid email').optional(),
  role: z.string().min(1, 'Role is required').optional(),
  teamId: z.string().optional(),
});

export const createUser: RequestHandler = async (req, res, next) => {
    const { name, email, role, teamId, projectId } = req.body;
    const adminUser = req.user;

    if (!adminUser || !adminUser.activeOrganizationId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    const parsed = createUserSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input', details: parsed.error.errors });
      return;
    }
    const { name: parsedName, email: parsedEmail, role: parsedRole, teamId: parsedTeamId, projectId: parsedProjectId } = parsed.data;

    if (!parsedName || !parsedEmail || !parsedRole) {
        logger.warn({ message: 'User creation failed: Missing required fields.', context: { adminUserId: adminUser.id, body: req.body } });
        return res.status(400).json({ message: 'Please provide name, email, and role' });
    }
    
    // כלל #2: שימוש ב-enum
    if (parsedRole === UserRole.GUEST && !parsedProjectId) {
        logger.warn({ message: 'Guest user creation failed: Missing projectId for guest.', context: { adminUserId: adminUser.id, email } });
        return res.status(400).json({ message: 'Guests must be associated with a project.' });
    }

    try {
        logger.info({ message: 'Attempting to create user by admin.', email, role, teamId, adminUserId: adminUser.id, orgId: adminUser.activeOrganizationId });
        const userExists = await prisma.user.findFirst({
            where: {
                email,
                memberships: { some: { organizationId: adminUser.activeOrganizationId } }
            }
        });
        if (userExists) {
            logger.warn({ message: 'User creation failed: User with this email already exists in this organization.', email, adminUserId: adminUser.id });
            return res.status(400).json({ message: 'User with this email already exists' });
        }

        // כלל #1: אם משייכים לצוות, ודא שהצוות שייך לארגון
        if (parsedTeamId) {
            const teamExists = await prisma.team.findFirst({
                where: { id: parsedTeamId, organizationId: adminUser.activeOrganizationId }
            });
            if (!teamExists) {
                logger.warn({ message: 'User creation failed: Team not found in organization.', teamId, adminUserId: adminUser.id });
                return res.status(400).json({ message: 'Team not found.' });
            }
        }

        const tempPassword = Math.random().toString(36).slice(-8);
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(tempPassword, salt);
        
        const newUser = await prisma.user.create({
            data: {
                name,
                email,
                password: hashedPassword,
                teamId: teamId || null,
                avatarUrl: '',
                memberships: {
                    create: {
                        organizationId: adminUser.activeOrganizationId,
                        role: role,
                    },
                },
            },
            select: { id: true, name: true, email: true, teamId: true, avatarUrl: true }
        });
        
        logger.info({ message: 'User created by admin successfully.', newUserId: newUser.id, email: newUser.email, orgId: adminUser.activeOrganizationId, adminUserId: adminUser.id });
        res.status(201).json(newUser);
    } catch (error) {
        logger.error({ message: 'Failed to create user by admin.', context: { body: req.body, adminUserId: adminUser.id }, error });
        next(error);
    }
};

export const getAllUsers: RequestHandler = async (req, res, next) => {
    const user = req.user;
    if (!user || !user.activeOrganizationId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
        logger.info({ message: 'Attempting to get all users.', userId: user.id, orgId: user.activeOrganizationId });
        const users = await prisma.user.findMany({
            // כלל #1: הצג רק משתמשים מהארגון של המשתמש המחובר
            where: {
                memberships: { some: { organizationId: user.activeOrganizationId } }
            },
            select: { id: true, name: true, email: true, teamId: true, avatarUrl: true },
            orderBy: { name: 'asc' }
        });
        logger.info({ message: 'All users fetched successfully.', usersCount: users.length, userId: user.id });
        res.json(users);
    } catch (error) {
        logger.error({ message: 'Failed to get all users.', context: { userId: user.id }, error });
        next(error);
    }
};

export const getUnassignedUsers: RequestHandler = async (req, res, next) => {
    const user = req.user;
    if (!user || !user.activeOrganizationId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
        logger.info({ message: 'Attempting to get unassigned users.', userId: user.id, orgId: user.activeOrganizationId });
        const users = await prisma.user.findMany({
            where: {
                memberships: { some: { organizationId: user.activeOrganizationId, role: UserRole.EMPLOYEE } }
            },
            select: { id: true, name: true, email: true },
            orderBy: { name: 'asc' }
        });
        logger.info({ message: 'Unassigned users fetched successfully.', unassignedUsersCount: users.length, userId: user.id });
        res.json(users);
    } catch (error) {
        logger.error({ message: 'Failed to get unassigned users.', context: { userId: user.id }, error });
        next(error);
    }
};

export const updateUser: RequestHandler = async (req, res, next) => {
    const { userId } = req.params;
    const { name, email, role, teamId } = req.body;
    const adminUser = req.user;

    if (!adminUser || !adminUser.activeOrganizationId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    const parsedUpdate = updateUserSchema.safeParse(req.body);
    if (!parsedUpdate.success) {
      res.status(400).json({ error: 'Invalid input', details: parsedUpdate.error.errors });
      return;
    }
    const { name: updateName, email: updateEmail, role: updateRole, teamId: updateTeamId } = parsedUpdate.data;

    if (!updateName || !updateEmail || !updateRole) {
        logger.warn({ message: 'User update failed: Missing required fields.', context: { userId, adminUserId: adminUser.id, body: req.body } });
        return res.status(400).json({ message: 'Name, email, and role are required' });
    }

    try {
        logger.info({ message: 'Attempting to update user.', userId, adminUserId: adminUser.id });
        // "כלל הזהב": שימוש ב-updateMany עם where כפול מבטיח שאתה מעדכן רק משתמש בארגון שלך
        const updateResult = await prisma.user.updateMany({
            where: { id: userId, memberships: { some: { organizationId: adminUser.activeOrganizationId } } },
            data: { name, email, teamId: teamId || null },
        });

        if (updateResult.count === 0) {
            logger.warn({ message: 'User update failed: User not found in organization.', userId, adminUserId: adminUser.id });
            return res.status(404).json({ message: 'User not found' });
        }
        
        const updatedUser = await prisma.user.findUnique({ 
            where: { id: userId },
            select: { id: true, name: true, email: true, teamId: true, avatarUrl: true }
        });

        logger.info({ message: 'User updated successfully.', updatedUserId: userId, adminUserId: adminUser.id });
        res.json(updatedUser);
    } catch (error) {
        logger.error({ message: 'Failed to update user.', context: { userId, body: req.body, adminUserId: adminUser.id }, error });
        next(error);
    }
};

export const deleteUser: RequestHandler = async (req, res, next) => {
    const { userId } = req.params;
    const adminUser = req.user;
    
    if (!adminUser || !adminUser.activeOrganizationId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    if (userId === adminUser.id) {
        logger.warn({ message: 'User deletion failed: Admin tried to delete self.', userId, adminUserId: adminUser.id });
        return res.status(400).json({ message: 'Admins cannot delete their own account.' });
    }

    try {
        logger.info({ message: 'Attempting to delete user.', userId, adminUserId: adminUser.id });
        
        // "כלל הזהב": שימוש ב-deleteMany עם where כפול מבטיח מחיקה רק בתוך הארגון
        const deleteResult = await prisma.user.deleteMany({
            where: { id: userId, memberships: { some: { organizationId: adminUser.activeOrganizationId } } }
        });

        if (deleteResult.count === 0) {
            logger.warn({ message: 'User deletion failed: User not found in organization.', userId, adminUserId: adminUser.id });
            return res.status(404).json({ message: 'User not found' });
        }
        
        logger.info({ message: 'User permanently deleted successfully.', deletedUserId: userId, adminUserId: adminUser.id });
        res.status(204).send();

    } catch (error) {
        if ((error as any).code === 'P2003') { 
             logger.error({ message: 'Cannot delete user: User is linked to other records.', context: { userId, adminUserId: adminUser.id }, error });
             return res.status(400).json({ message: 'Cannot delete user. This user is associated with existing projects or tasks.' });
        }
        logger.error({ message: 'Failed to delete user.', context: { userId, adminUserId: adminUser.id }, error });
        next(error);
    }
};