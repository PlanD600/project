// project-backend/src/api/guests/guests.controller.ts
import { RequestHandler } from 'express';
import asyncHandler from 'express-async-handler';
import prisma from '../../db';
import logger from '../../logger';
import { UserRole } from '@prisma/client';

// @desc    Invite guest to specific project
// @route   POST /api/guests/invite
// @access  Private (Org Admin, Super Admin, or Team Leader of the project)
export const inviteGuest: RequestHandler = asyncHandler(async (req, res) => {
    const { email, projectId } = req.body;
    const user = req.user;

    if (!user || !user.activeOrganizationId) {
        res.status(401);
        throw new Error('Not authorized');
    }

    if (!email || !projectId) {
        res.status(400);
        throw new Error('Email and project ID are required');
    }

    // Check if user can invite guests (Org Admin, Super Admin, or Team Leader of the project)
    const membership = user.memberships.find(m => m.organizationId === user.activeOrganizationId);
    const role = membership?.role;
    const canInviteGuests = role && ([UserRole.ORG_ADMIN, UserRole.SUPER_ADMIN, UserRole.TEAM_LEADER] as UserRole[]).includes(role);
    if (!canInviteGuests) {
        res.status(403);
        throw new Error('User is not authorized to invite guests');
    }

    // Verify the project exists and belongs to the active organization
    const project = await prisma.project.findFirst({
        where: {
            id: projectId,
            organizationId: user.activeOrganizationId
        },
        include: {
            teamLeaders: true
        }
    });

    if (!project) {
        res.status(404);
        throw new Error('Project not found');
    }

    // Additional check for Team Leaders - they can only invite to their own projects
    if (role === UserRole.TEAM_LEADER && !project.teamLeaders.some(leader => leader.id === user.id)) {
        res.status(403);
        throw new Error('Team leaders can only invite guests to their own projects');
    }

    // Find or create guest user
    let guestUser = await prisma.user.findUnique({
        where: { email }
    });

    if (!guestUser) {
        // Create new guest user
        const tempPassword = Math.random().toString(36).slice(-8);
        guestUser = await prisma.user.create({
            data: {
                email,
                name: email.split('@')[0], // Use email prefix as name
                password: tempPassword, // In production, hash this password
            }
        });
    } else {
        // Check if user is already a guest for this project
        const existingGuestTask = await prisma.task.findFirst({
            where: {
                projectId: projectId,
                assignees: {
                    some: {
                        id: guestUser.id
                    }
                }
            }
        });

        if (existingGuestTask) {
            res.status(400);
            throw new Error('User is already a guest for this project');
        }
    }

    // Create a special task for the guest to access the project
    const guestTask = await prisma.task.create({
        data: {
            title: `Guest Access - ${project.name}`,
            description: `Guest access task for ${email}`,
            startDate: new Date(),
            endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
            columnId: 'guest-access',
            projectId: projectId,
            organizationId: user.activeOrganizationId,
            assignees: {
                connect: [{ id: guestUser.id }]
            }
        },
        include: {
            assignees: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                    avatarUrl: true
                }
            }
        }
    });

    logger.info({ 
        message: 'Guest invited to project.', 
        guestEmail: email, 
        projectId: projectId, 
        invitedBy: user.id,
        guestUserId: guestUser.id 
    });

    // In production, send SMS invitation here
    // For now, just return the guest user info
    res.status(201).json({
        id: guestUser.id,
        name: guestUser.name,
        email: guestUser.email,
        avatarUrl: guestUser.avatarUrl,
        projectId: projectId,
        message: 'Guest invitation created successfully. SMS invitation will be sent.'
    });
});

// @desc    Revoke guest access from project
// @route   DELETE /api/guests/:guestId/project/:projectId
// @access  Private (Org Admin, Super Admin, or Team Leader of the project)
export const revokeGuest: RequestHandler = asyncHandler(async (req, res) => {
    const { guestId, projectId } = req.params;
    const user = req.user;

    if (!user || !user.activeOrganizationId) {
        res.status(401);
        throw new Error('Not authorized');
    }

    // Check if user can revoke guest access
    const membership = user.memberships.find(m => m.organizationId === user.activeOrganizationId);
    const role = membership?.role;
    const canRevokeGuests = role && ([UserRole.ORG_ADMIN, UserRole.SUPER_ADMIN, UserRole.TEAM_LEADER] as UserRole[]).includes(role);
    if (!canRevokeGuests) {
        res.status(403);
        throw new Error('User is not authorized to revoke guest access');
    }

    // Verify the project exists and belongs to the active organization
    const project = await prisma.project.findFirst({
        where: {
            id: projectId,
            organizationId: user.activeOrganizationId
        },
        include: {
            teamLeaders: true
        }
    });

    if (!project) {
        res.status(404);
        throw new Error('Project not found');
    }

    // Additional check for Team Leaders - they can only revoke from their own projects
    if (role === UserRole.TEAM_LEADER && !project.teamLeaders.some(leader => leader.id === user.id)) {
        res.status(403);
        throw new Error('Team leaders can only revoke guests from their own projects');
    }

    // Find and delete the guest task
    const guestTask = await prisma.task.findFirst({
        where: {
            projectId: projectId,
            assignees: {
                some: {
                    id: guestId
                }
            },
            title: {
                startsWith: 'Guest Access -'
            }
        }
    });

    if (!guestTask) {
        res.status(404);
        throw new Error('Guest access not found for this project');
    }

    // Delete the guest task
    await prisma.task.delete({
        where: {
            id: guestTask.id
        }
    });

    logger.info({ 
        message: 'Guest access revoked from project.', 
        guestId: guestId, 
        projectId: projectId, 
        revokedBy: user.id 
    });

    res.status(200).json({ message: 'Guest access revoked successfully' });
});

// @desc    Get all guests for a project
// @route   GET /api/guests/project/:projectId
// @access  Private (Org Admin, Super Admin, or Team Leader of the project)
export const getProjectGuests: RequestHandler = asyncHandler(async (req, res) => {
    const { projectId } = req.params;
    const user = req.user;

    if (!user || !user.activeOrganizationId) {
        res.status(401);
        throw new Error('Not authorized');
    }

    // Check if user can view project guests
    const membership = user.memberships.find(m => m.organizationId === user.activeOrganizationId);
    const role = membership?.role;
    const canViewGuests = role && ([UserRole.ORG_ADMIN, UserRole.SUPER_ADMIN, UserRole.TEAM_LEADER] as UserRole[]).includes(role);
    if (!canViewGuests) {
        res.status(403);
        throw new Error('User is not authorized to view project guests');
    }

    // Verify the project exists and belongs to the active organization
    const project = await prisma.project.findFirst({
        where: {
            id: projectId,
            organizationId: user.activeOrganizationId
        },
        include: {
            teamLeaders: true
        }
    });

    if (!project) {
        res.status(404);
        throw new Error('Project not found');
    }

    // Additional check for Team Leaders - they can only view guests of their own projects
    if (role === UserRole.TEAM_LEADER && !project.teamLeaders.some(leader => leader.id === user.id)) {
        res.status(403);
        throw new Error('Team leaders can only view guests of their own projects');
    }

    // Find all guest tasks for this project
    const guestTasks = await prisma.task.findMany({
        where: {
            projectId: projectId,
            title: {
                startsWith: 'Guest Access -'
            }
        },
        include: {
            assignees: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                    avatarUrl: true
                }
            }
        }
    });

    // Extract guest users from the tasks
    const guests = guestTasks.map(task => task.assignees[0]).filter(Boolean);

    logger.info({ 
        message: 'Project guests retrieved.', 
        projectId: projectId, 
        guestCount: guests.length,
        retrievedBy: user.id 
    });

    res.status(200).json(guests);
}); 