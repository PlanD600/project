


import { RequestHandler } from 'express';
import { getDb } from '../../db';
import { ObjectId } from 'mongodb';
import logger from '../../logger';

export const createTeam: RequestHandler = async (req, res, next) => {
    const { teamName, team_leader_id, member_user_ids } = req.body;
    if (!teamName || !team_leader_id) {
        return res.status(400).json({ message: 'Team name and leader ID are required.' });
    }

    try {
        const db = getDb();
        const newTeamDocument = {
            name: teamName,
            leaderId: team_leader_id,
            createdAt: new Date(),
        };

        const teamResult = await db.collection('teams').insertOne(newTeamDocument);
        const newTeamId = teamResult.insertedId;

        const allMemberIds = [...new Set([...(member_user_ids || []), team_leader_id])];
        const allMemberObjectIds = allMemberIds.map(id => new ObjectId(id));

        await db.collection('users').updateMany(
            { _id: { $in: allMemberObjectIds } },
            { $set: { teamId: newTeamId.toHexString() } }
        );

        const updatedUsers = await db.collection('users').find(
            { _id: { $in: allMemberObjectIds } },
            { projection: { passwordHash: 0 } }
        ).toArray();
        
        logger.info({ message: 'Team created', teamId: newTeamId.toHexString(), leaderId: team_leader_id, adminUserId: req.user?.id });
        res.status(201).json({ 
            team: { id: newTeamId.toHexString(), name: teamName }, 
            updatedUsers: updatedUsers.map(u => ({...u, id: u._id}))
        });

    } catch (error) {
        logger.error({ message: 'Failed to create team', context: { body: req.body, adminUserId: req.user?.id }, error });
        next(error);
    }
};

export const addMembersToTeam: RequestHandler = async (req, res, next) => {
    const { teamId } = req.params;
    const { user_ids } = req.body;
    const requestingUser = req.user;

    if (!user_ids || !Array.isArray(user_ids) || user_ids.length === 0) {
        return res.status(400).json({ message: 'User IDs array is required.' });
    }
    if (!ObjectId.isValid(teamId)) {
        return res.status(400).json({ message: 'Invalid team ID format' });
    }

    try {
        const db = getDb();
        const team = await db.collection('teams').findOne({ _id: new ObjectId(teamId) });
        if (!team) {
            return res.status(404).json({ message: 'Team not found.' });
        }
        
        if (requestingUser?.role === 'Team Leader' && team.leaderId !== requestingUser.id) {
            return res.status(403).json({ message: 'Not authorized to add members to this team.' });
        }
        
        const userObjectIds = user_ids.map(id => new ObjectId(id));

        await db.collection('users').updateMany(
            { _id: { $in: userObjectIds }, teamId: null },
            { $set: { teamId: teamId } }
        );

        const updatedUsers = await db.collection('users').find(
            { _id: { $in: userObjectIds } },
            { projection: { passwordHash: 0 } }
        ).toArray();
        
        logger.info({ message: 'Members added to team', teamId, addedUserIds: user_ids, requestingUserId: requestingUser?.id });
        res.status(200).json(updatedUsers.map(u => ({...u, id: u._id})));
    } catch (error) {
        logger.error({ message: 'Failed to add members to team', context: { teamId, body: req.body, requestingUserId: requestingUser?.id }, error });
        next(error);
    }
};

export const updateTeam: RequestHandler = async (req, res, next) => {
    const { teamId } = req.params;
    const { teamName, leaderId, memberIds } = req.body;
    if (!ObjectId.isValid(teamId)) {
        return res.status(400).json({ message: 'Invalid team ID format' });
    }
    
    try {
        const db = getDb();
        const teamObjectId = new ObjectId(teamId);

        // Update team name and leader
        const updatedTeamResult = await db.collection('teams').findOneAndUpdate(
            { _id: teamObjectId },
            { $set: { name: teamName, leaderId: leaderId } },
            { returnDocument: 'after' }
        );

        if (!updatedTeamResult) {
            return res.status(404).json({ message: "Team not found" });
        }

        const newMemberAndLeaderIds = [...new Set([...memberIds, leaderId])];
        const newMemberObjectIds = newMemberAndLeaderIds.map(id => new ObjectId(id));
        
        // Remove teamId from users no longer in the team
        await db.collection('users').updateMany(
            { teamId: teamId, _id: { $nin: newMemberObjectIds } },
            { $set: { teamId: null } }
        );
        // Add teamId to new members
        await db.collection('users').updateMany(
            { _id: { $in: newMemberObjectIds } },
            { $set: { teamId: teamId } }
        );
        
        const allAffectedUsers = await db.collection('users').find(
            { $or: [{ teamId: teamId }, { teamId: null, _id: { $in: newMemberObjectIds } }] },
            { projection: { passwordHash: 0 } }
        ).toArray();
        
        logger.info({ message: 'Team updated', teamId, adminUserId: req.user?.id });
        res.json({ 
            team: { ...updatedTeamResult, id: updatedTeamResult._id }, 
            updatedUsers: allAffectedUsers.map(u => ({...u, id: u._id})) 
        });

    } catch (error) {
        logger.error({ message: 'Failed to update team', context: { teamId, body: req.body, adminUserId: req.user?.id }, error });
        next(error);
    }
};

export const deleteTeam: RequestHandler = async (req, res, next) => {
    const { teamId } = req.params;
     if (!ObjectId.isValid(teamId)) {
        return res.status(400).json({ message: 'Invalid team ID format' });
    }
    
    try {
        const db = getDb();
        
        const usersInTeam = await db.collection('users').find({ teamId: teamId }).project({_id: 1}).toArray();
        const userIds = usersInTeam.map(u => u._id);

        await db.collection('users').updateMany(
            { _id: { $in: userIds } },
            { $set: { teamId: null } }
        );
        
        await db.collection('teams').deleteOne({ _id: new ObjectId(teamId) });

        const updatedUsers = await db.collection('users').find({ _id: { $in: userIds } }).project({passwordHash: 0}).toArray();
        
        logger.info({ message: 'Team deleted', teamId, adminUserId: req.user?.id });
        res.json({ updatedUsers: updatedUsers.map(u => ({...u, id: u._id})) });
    } catch (error) {
        logger.error({ message: 'Failed to delete team', context: { teamId, adminUserId: req.user?.id }, error });
        next(error);
    }
};

export const removeUserFromTeam: RequestHandler = async (req, res, next) => {
    const { teamId, userId } = req.params;
    const requestingUser = req.user;
    if (!ObjectId.isValid(teamId) || !ObjectId.isValid(userId)) {
        return res.status(400).json({ message: 'Invalid team or user ID format' });
    }

    try {
        if (requestingUser?.role === 'Team Leader' && requestingUser.teamId !== teamId) {
             return res.status(403).json({ message: 'Not authorized to remove members from this team.' });
        }
        
        const db = getDb();
        const result = await db.collection('users').findOneAndUpdate(
            { _id: new ObjectId(userId), teamId: teamId },
            { $set: { teamId: null } },
            { returnDocument: 'after', projection: { passwordHash: 0 } }
        );
        
        if (!result) {
            return res.status(404).json({ message: 'User not found in the specified team.' });
        }
        logger.info({ message: 'User removed from team', removedUserId: userId, teamId, requestingUserId: requestingUser?.id });
        res.json({ ...result, id: result._id });
    } catch (error) {
        logger.error({ message: 'Failed to remove user from team', context: { teamId, userId, requestingUserId: requestingUser?.id }, error });
        next(error);
    }
};