import { RequestHandler } from 'express';
import prisma from '../../db';
import logger from '../../logger';
import { UserRole } from '@prisma/client';


// Create a new team and assign members
export const createTeam: RequestHandler = async (req, res, next) => {
    const { teamName, team_leader_id, member_user_ids } = req.body;
    if (!teamName || !team_leader_id) {
        return res.status(400).json({ message: 'Team name and leader ID are required.' });
    }

    try {
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

        logger.info({ message: 'Team created', teamId: newTeam.id, leaderId: team_leader_id, adminUserId: req.user?.id });
        res.status(201).json({ 
            team: newTeam, 
            updatedUsers
        });

    } catch (error) {
        logger.error({ message: 'Failed to create team', context: { body: req.body, adminUserId: req.user?.id }, error });
        next(error);
    }
};

// Add members to an existing team
export const addMembersToTeam: RequestHandler = async (req, res, next) => {
    const { teamId } = req.params;
    const { user_ids } = req.body;
    const requestingUser = req.user;

    if (!user_ids || !Array.isArray(user_ids) || user_ids.length === 0) {
        return res.status(400).json({ message: 'User IDs array is required.' });
    }

    try {
        const team = await prisma.team.findUnique({ where: { id: teamId } });
        if (!team) {
            return res.status(404).json({ message: 'Team not found.' });
        }
        
        // In Prisma schema, the leader is just a member, authorization might need adjustment
        // This logic is simplified as we don't store a 'leaderId' on the team model itself
        if (requestingUser?.role === 'TEAM_MANAGER' && requestingUser.teamId !== teamId) {
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
        
        logger.info({ message: 'Members added to team', teamId, addedUserIds: user_ids, requestingUserId: requestingUser?.id });
        res.status(200).json(updatedUsers);
    } catch (error) {
        logger.error({ message: 'Failed to add members to team', context: { teamId, body: req.body, requestingUserId: requestingUser?.id }, error });
        next(error);
    }
};

// Update a team's name and members
export const updateTeam: RequestHandler = async (req, res, next) => {
    const { teamId } = req.params;
    const { teamName, leaderId, memberIds } = req.body;
    
    try {
        const newMemberAndLeaderIds = [...new Set([...memberIds, leaderId])];
        
        // Prisma's 'set' command disconnects all old members and connects all new members
        const updatedTeam = await prisma.team.update({
            where: { id: teamId },
            data: {
                name: teamName,
                members: {
                    set: newMemberAndLeaderIds.map((id: string) => ({ id }))
                }
            },
        });

        // The logic to fetch all affected users is complex with Prisma's set.
        // We will just return the team and let the frontend refetch users if needed.
        // Or fetch all users associated with the team.
        const updatedUsers = await prisma.user.findMany({
            where: { teamId },
            select: { id: true, name: true, email: true, role: true, avatarUrl: true, teamId: true }
        });

        logger.info({ message: 'Team updated', teamId, adminUserId: req.user?.id });
        res.json({ 
            team: updatedTeam, 
            updatedUsers
        });

    } catch (error) {
        logger.error({ message: 'Failed to update team', context: { teamId, body: req.body, adminUserId: req.user?.id }, error });
        next(error);
    }
};

// Delete a team
export const deleteTeam: RequestHandler = async (req, res, next) => {
    const { teamId } = req.params;
    
    try {
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
        
        logger.info({ message: 'Team deleted', teamId, adminUserId: req.user?.id });
        // Returning teamId to allow frontend to know which team was deleted
        res.status(200).json({ teamId });
    } catch (error) {
        logger.error({ message: 'Failed to delete team', context: { teamId, adminUserId: req.user?.id }, error });
        next(error);
    }
};

// Remove a single user from a team
export const removeUserFromTeam: RequestHandler = async (req, res, next) => {
    const { teamId, userId } = req.params;
    const requestingUser = req.user;

    try {
        if (requestingUser?.role === 'TEAM_MANAGER' && requestingUser.teamId !== teamId) {
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
        
        logger.info({ message: 'User removed from team', removedUserId: userId, teamId, requestingUserId: requestingUser?.id });
        res.json(updatedUser);
    } catch (error) {
        logger.error({ message: 'Failed to remove user from team', context: { teamId, userId, requestingUserId: requestingUser?.id }, error });
        next(error);
    }
};