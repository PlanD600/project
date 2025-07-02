// project-backend/src/api/teams/teams.controller.ts
import { RequestHandler } from 'express';
import prisma from '../../db';
import logger from '../../logger';
import { UserRole } from '@prisma/client';


// Create a new team and assign members
export const createTeam: RequestHandler = async (req, res, next) => {
    const { teamName, team_leader_id, member_user_ids } = req.body;
    const user = req.user;

    if (!teamName || !team_leader_id) {
        logger.warn({ message: 'Team creation failed: Missing team name or leader ID.', context: { userId: user?.id, body: req.body } });
        return res.status(400).json({ message: 'Team name and leader ID are required.' });
    }

    try {
        logger.info({ message: 'Attempting to create team.', teamName, leaderId: team_leader_id, adminUserId: user?.id });
        const allMemberIds = [...new Set([...(member_user_ids || []), team_leader_id])];

        // Create the team and connect all members in one go
        const newTeam = await prisma.team.create({
            data: {
                name: teamName,
                members: {
                    connect: allMemberIds.map((id: string) => ({ id }))
                }
            }
        });
        
        // Fetch the users that were just updated to return them
        const updatedUsers = await prisma.user.findMany({
            where: { id: { in: allMemberIds } },
            select: { id: true, name: true, email: true, role: true, avatarUrl: true, teamId: true }
        });

        logger.info({ message: 'Team created successfully.', teamId: newTeam.id, leaderId: team_leader_id, adminUserId: user?.id });
        res.status(201).json({ 
            team: newTeam, 
            updatedUsers
        });

    } catch (error) {
        logger.error({ message: 'Failed to create team.', context: { body: req.body, adminUserId: user?.id }, error });
        next(error);
    }
};

// Add members to an existing team
export const addMembersToTeam: RequestHandler = async (req, res, next) => {
    const { teamId } = req.params;
    const { user_ids } = req.body;
    const requestingUser = req.user;

    if (!user_ids || !Array.isArray(user_ids) || user_ids.length === 0) {
        logger.warn({ message: 'Add members to team failed: User IDs array is required.', context: { teamId, requestingUserId: requestingUser?.id, body: req.body } });
        return res.status(400).json({ message: 'User IDs array is required.' });
    }

    try {
        logger.info({ message: 'Attempting to add members to team.', teamId, addedUserIds: user_ids, requestingUserId: requestingUser?.id });
        const team = await prisma.team.findUnique({ where: { id: teamId } });
        if (!team) {
            logger.warn({ message: 'Add members to team failed: Team not found.', teamId, requestingUserId: requestingUser?.id });
            return res.status(404).json({ message: 'Team not found.' });
        }
        
        if (requestingUser?.role === 'TEAM_MANAGER' && requestingUser.teamId !== teamId) {
            logger.warn({ message: 'Unauthorized attempt by team manager to add members to another team.', teamId, requestingUserId: requestingUser?.id });
            return res.status(403).json({ message: 'Not authorized to add members to this team.' });
        }
        
        await prisma.user.updateMany({
            where: {
                id: { in: user_ids },
                teamId: null // Only add users not already in a team
            },
            data: {
                teamId: teamId
            }
        });

        const updatedUsers = await prisma.user.findMany({
            where: { id: { in: user_ids } },
            select: { id: true, name: true, email: true, role: true, avatarUrl: true, teamId: true }
        });
        
        logger.info({ message: 'Members added to team successfully.', teamId, addedUserIds: user_ids, requestingUserId: requestingUser?.id, updatedUsersCount: updatedUsers.length });
        res.status(200).json(updatedUsers);
    } catch (error) {
        logger.error({ message: 'Failed to add members to team.', context: { teamId, body: req.body, requestingUserId: requestingUser?.id }, error });
        next(error);
    }
};

// Update a team's name and members
export const updateTeam: RequestHandler = async (req, res, next) => {
    const { teamId } = req.params;
    const { teamName, leaderId, memberIds } = req.body;
    const user = req.user;
    
    try {
        logger.info({ message: 'Attempting to update team.', teamId, teamName, leaderId, memberIdsCount: memberIds?.length, adminUserId: user?.id });
        const newMemberAndLeaderIds = [...new Set([...memberIds, leaderId])];
        
        const updatedTeam = await prisma.team.update({
            where: { id: teamId },
            data: {
                name: teamName,
                members: {
                    set: newMemberAndLeaderIds.map((id: string) => ({ id }))
                }
            },
        });

        const updatedUsers = await prisma.user.findMany({
            where: { teamId },
            select: { id: true, name: true, email: true, role: true, avatarUrl: true, teamId: true }
        });

        logger.info({ message: 'Team updated successfully.', teamId, adminUserId: user?.id, updatedUsersCount: updatedUsers.length });
        res.json({ 
            team: updatedTeam, 
            updatedUsers
        });

    } catch (error) {
        if ((error as any).code === 'P2025') {
            logger.warn({ message: 'Team update failed: Team or user not found.', teamId, adminUserId: user?.id });
            return res.status(404).json({ message: 'Team or specified members not found.' });
        }
        logger.error({ message: 'Failed to update team.', context: { teamId, body: req.body, adminUserId: user?.id }, error });
        next(error);
    }
};

// Delete a team
export const deleteTeam: RequestHandler = async (req, res, next) => {
    const { teamId } = req.params;
    const user = req.user;
    
    try {
        logger.info({ message: 'Attempting to delete team.', teamId, adminUserId: user?.id });
        // Use a transaction to ensure both operations succeed or fail together
        const [usersUpdate, teamDelete] = await prisma.$transaction([
            // Disconnect all users from the team
            prisma.user.updateMany({
                where: { teamId: teamId },
                data: { teamId: null }
            }),
            // Delete the team
            prisma.team.delete({
                where: { id: teamId }
            })
        ]);
        
        // Fetch users who were part of this team and are now unassigned
        const updatedUsers = await prisma.user.findMany({
            where: { teamId: null, id: { in: (await prisma.user.findMany({ where: { teamId }, select: { id: true } })).map(u => u.id) } }, // This gets users who were previously in this team and now have teamId: null
            select: { id: true, name: true, email: true, role: true, avatarUrl: true, teamId: true }
        });

        logger.info({ message: 'Team deleted successfully and members unassigned.', teamId, adminUserId: user?.id, unassignedUsersCount: updatedUsers.length });
        // Returning teamId to allow frontend to know which team was deleted
        res.status(200).json({ teamId, updatedUsers }); // Return updatedUsers for frontend state management
    } catch (error) {
        if ((error as any).code === 'P2025') {
            logger.warn({ message: 'Team deletion failed: Team not found.', teamId, adminUserId: user?.id });
            return res.status(404).json({ message: 'Team not found.' });
        }
        logger.error({ message: 'Failed to delete team.', context: { teamId, adminUserId: user?.id }, error });
        next(error);
    }
};

// Remove a single user from a team
export const removeUserFromTeam: RequestHandler = async (req, res, next) => {
    const { teamId, userId } = req.params;
    const requestingUser = req.user;

    try {
        logger.info({ message: 'Attempting to remove user from team.', userId, teamId, requestingUserId: requestingUser?.id });
        if (requestingUser?.role === 'TEAM_MANAGER' && requestingUser.teamId !== teamId) {
             logger.warn({ message: 'Unauthorized attempt by team manager to remove user from another team.', userId, teamId, requestingUserId: requestingUser?.id });
             return res.status(403).json({ message: 'Not authorized to remove members from this team.' });
        }
        
        const updatedUser = await prisma.user.update({
            where: { 
                id: userId,
                teamId: teamId // Ensure the user is actually in this team before updating
            },
            data: {
                teamId: null
            },
            select: { id: true, name: true, email: true, role: true, avatarUrl: true, teamId: true }
        });
        
        logger.info({ message: 'User removed from team successfully.', removedUserId: userId, teamId, requestingUserId: requestingUser?.id });
        res.json(updatedUser);
    } catch (error) {
        if ((error as any).code === 'P2025') {
            logger.warn({ message: 'Remove user from team failed: User or team not found.', userId, teamId, requestingUserId: requestingUser?.id });
            return res.status(404).json({ message: 'User not found in this team.' });
        }
        logger.error({ message: 'Failed to remove user from team.', context: { teamId, userId, requestingUserId: requestingUser?.id }, error });
        next(error);
    }
};