// project-backend/src/api/teams/teams.controller.ts
import { Request, Response, NextFunction, RequestHandler } from 'express';
import prisma from '../../db';
import logger from '../../logger';
import { UserRole } from '@prisma/client';


// Create a new team and assign members
export const createTeam: RequestHandler = async (req, res, next) => {
    const { teamName, team_leader_id, member_user_ids } = req.body;
    const user = req.user;

    if (!user || !user.organizationId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    if (!teamName || !team_leader_id) {
        logger.warn({ message: 'Team creation failed: Missing team name or leader ID.', context: { userId: user.id, body: req.body } });
        return res.status(400).json({ message: 'Team name and leader ID are required.' });
    }

    try {
        logger.info({ message: 'Attempting to create team.', teamName, leaderId: team_leader_id, adminUserId: user.id, orgId: user.organizationId });
        const allMemberIds = [...new Set([...(member_user_ids || []), team_leader_id])];

        // כלל #1: ודא שכל המשתמשים שאתה מוסיף שייכים לארגון שלך
        const membersInOrg = await prisma.user.count({
            where: {
                id: { in: allMemberIds },
                organizationId: user.organizationId,
            }
        });

        if (membersInOrg !== allMemberIds.length) {
            logger.warn({ message: 'Team creation failed: Some users do not belong to the organization.', context: { userId: user.id, orgId: user.organizationId } });
            return res.status(403).json({ message: 'Cannot add users from a different organization.' });
        }

        const newTeam = await prisma.team.create({
            data: {
                name: teamName,
                organizationId: user.organizationId, // כלל #1: שייך את הצוות החדש לארגון
                members: {
                    connect: allMemberIds.map((id: string) => ({ id }))
                }
            }
        });
        
        const updatedUsers = await prisma.user.findMany({
            where: { id: { in: allMemberIds }, organizationId: user.organizationId }, // כלל #1
            select: { id: true, name: true, email: true, role: true, avatarUrl: true, teamId: true }
        });

        logger.info({ message: 'Team created successfully.', teamId: newTeam.id, orgId: newTeam.organizationId, adminUserId: user.id });
        res.status(201).json({ team: newTeam, updatedUsers });

    } catch (error) {
        logger.error({ message: 'Failed to create team.', context: { body: req.body, adminUserId: user.id }, error });
        next(error);
    }
};

// Add members to an existing team
export const addMembersToTeam: RequestHandler = async (req, res, next) => {
    const { teamId } = req.params;
    const { user_ids } = req.body;
    const requestingUser = req.user;

    if (!requestingUser || !requestingUser.organizationId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    if (!user_ids || !Array.isArray(user_ids) || user_ids.length === 0) {
        logger.warn({ message: 'Add members to team failed: User IDs array is required.', context: { teamId, requestingUserId: requestingUser.id, body: req.body } });
        return res.status(400).json({ message: 'User IDs array is required.' });
    }

    try {
        logger.info({ message: 'Attempting to add members to team.', teamId, addedUserIds: user_ids, requestingUserId: requestingUser.id });
        // כלל #1: ודא שהצוות שאליו אתה מוסיף חברים שייך לארגון שלך
        const team = await prisma.team.findFirst({ where: { id: teamId, organizationId: requestingUser.organizationId } });
        if (!team) {
            logger.warn({ message: 'Add members to team failed: Team not found in this org.', teamId, requestingUserId: requestingUser.id, orgId: requestingUser.organizationId });
            return res.status(404).json({ message: 'Team not found.' });
        }
        
        // כלל #2: החלפת הטקסט בערך מה-enum
        if (requestingUser.role === UserRole.TEAM_MANAGER && requestingUser.teamId !== teamId) {
            logger.warn({ message: 'Unauthorized attempt by team manager to add members to another team.', teamId, requestingUserId: requestingUser.id });
            return res.status(403).json({ message: 'Not authorized to add members to this team.' });
        }

        // כלל #1: אבטחה נוספת בעת עדכון המשתמשים
        await prisma.user.updateMany({
            where: {
                id: { in: user_ids },
                organizationId: requestingUser.organizationId,
                teamId: null 
            },
            data: { teamId: teamId }
        });

        const updatedUsers = await prisma.user.findMany({
            where: { id: { in: user_ids }, organizationId: requestingUser.organizationId },
            select: { id: true, name: true, email: true, role: true, avatarUrl: true, teamId: true }
        });
        
        logger.info({ message: 'Members added to team successfully.', teamId, addedUserIds: user_ids, requestingUserId: requestingUser.id, updatedUsersCount: updatedUsers.length });
        res.status(200).json(updatedUsers);
    } catch (error) {
        logger.error({ message: 'Failed to add members to team.', context: { teamId, body: req.body, requestingUserId: requestingUser.id }, error });
        next(error);
    }
};

// Update a team's name and members
export const updateTeam: RequestHandler = async (req, res, next) => {
    const { teamId } = req.params;
    const { teamName, leaderId, memberIds } = req.body;
    const user = req.user;

    if (!user || !user.organizationId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    
    try {
        logger.info({ message: 'Attempting to update team.', teamId, teamName, adminUserId: user.id, orgId: user.organizationId });
        // כלל #1: ודא שהצוות שייך לארגון שלך
        const team = await prisma.team.findFirst({ where: { id: teamId, organizationId: user.organizationId }});
        if (!team) {
            logger.warn({ message: 'Team update failed: Team not found in this org.', teamId, adminUserId: user.id, orgId: user.organizationId });
            return res.status(404).json({ message: 'Team not found.' });
        }
        
        const newMemberAndLeaderIds = [...new Set([...(memberIds || []), ...(leaderId ? [leaderId] : [])])];
        if (newMemberAndLeaderIds.length > 0) {
            // כלל #1: ודא שכל החברים החדשים שייכים לארגון שלך
            const membersInOrg = await prisma.user.count({
                where: { id: { in: newMemberAndLeaderIds }, organizationId: user.organizationId }
            });
            if (membersInOrg !== newMemberAndLeaderIds.length) {
                logger.warn({ message: 'Team update failed: Some new members do not belong to the organization.', teamId, adminUserId: user.id, orgId: user.organizationId });
                return res.status(403).json({ message: 'Cannot add users from a different organization.' });
            }
        }

        const updatedTeam = await prisma.team.update({
            where: { id: teamId }, // מאובטח בזכות הבדיקה שעשינו קודם
            data: {
                name: teamName,
                members: { set: newMemberAndLeaderIds.map((id: string) => ({ id })) }
            },
        });

        const updatedUsers = await prisma.user.findMany({
            where: { teamId, organizationId: user.organizationId },
            select: { id: true, name: true, email: true, role: true, avatarUrl: true, teamId: true }
        });

        logger.info({ message: 'Team updated successfully.', teamId, adminUserId: user.id, updatedUsersCount: updatedUsers.length });
        res.json({ team: updatedTeam, updatedUsers });

    } catch (error) {
        logger.error({ message: 'Failed to update team.', context: { teamId, body: req.body, adminUserId: user.id }, error });
        next(error);
    }
};

// Delete a team
export const deleteTeam: RequestHandler = async (req, res, next) => {
    const { teamId } = req.params;
    const user = req.user;

    if (!user || !user.organizationId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    
    try {
        logger.info({ message: 'Attempting to delete team.', teamId, adminUserId: user.id, orgId: user.organizationId });
        // כלל #1: ודא שהצוות שייך לארגון שלך לפני המחיקה
        const team = await prisma.team.findFirst({ where: { id: teamId, organizationId: user.organizationId }});
        if (!team) {
            logger.warn({ message: 'Team deletion failed: Team not found in this org.', teamId, adminUserId: user.id, orgId: user.organizationId });
            return res.status(404).json({ message: 'Team not found.' });
        }

        const [usersUpdate, teamDelete] = await prisma.$transaction([
            prisma.user.updateMany({
                where: { teamId: teamId, organizationId: user.organizationId }, // כלל #1
                data: { teamId: null }
            }),
            prisma.team.delete({
                where: { id: teamId } // מאובטח בזכות הבדיקה שעשינו קודם
            })
        ]);
        
        logger.info({ message: 'Team deleted successfully and members unassigned.', teamId, adminUserId: user.id });
        res.status(200).json({ message: 'Team deleted' });

    } catch (error) {
        logger.error({ message: 'Failed to delete team.', context: { teamId, adminUserId: user.id }, error });
        next(error);
    }
};

// Remove a single user from a team
export const removeUserFromTeam: RequestHandler = async (req, res, next) => {
    const { teamId, userId } = req.params;
    const requestingUser = req.user;

    if (!requestingUser || !requestingUser.organizationId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
        logger.info({ message: 'Attempting to remove user from team.', userId, teamId, requestingUserId: requestingUser.id });
        // כלל #2: החלפת הטקסט בערך מה-enum
        if (requestingUser.role === UserRole.TEAM_MANAGER && requestingUser.teamId !== teamId) {
             logger.warn({ message: 'Unauthorized attempt by team manager to remove user from another team.', userId, teamId, requestingUserId: requestingUser.id });
             return res.status(403).json({ message: 'Not authorized to remove members from this team.' });
        }
        
        // כלל #1: שאילתה אחת מאובטחת שמוודאת שהכל שייך לארגון הנכון
        const updatedUser = await prisma.user.update({
            where: { 
                id: userId,
                organizationId: requestingUser.organizationId,
                teamId: teamId
            },
            data: { teamId: null },
            select: { id: true, name: true, email: true, role: true, avatarUrl: true, teamId: true }
        });
        
        logger.info({ message: 'User removed from team successfully.', removedUserId: userId, teamId, requestingUserId: requestingUser.id });
        res.json(updatedUser);
    } catch (error) {
        if ((error as any).code === 'P2025') {
            logger.warn({ message: 'Remove user from team failed: User or team not found in this organization.', userId, teamId, requestingUserId: requestingUser.id });
            return res.status(404).json({ message: 'User not found in this team.' });
        }
        logger.error({ message: 'Failed to remove user from team.', context: { teamId, userId, requestingUserId: requestingUser.id }, error });
        next(error);
    }
};