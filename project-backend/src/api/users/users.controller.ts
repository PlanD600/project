
import { RequestHandler } from 'express';
import { getDb } from '../../db';
import bcrypt from 'bcrypt';
import { ObjectId } from 'mongodb';
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
        const db = getDb();
        const userExists = await db.collection('users').findOne({ email });
        if (userExists) {
            return res.status(400).json({ message: 'User with this email already exists' });
        }

        const tempPassword = Math.random().toString(36).slice(-8);
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(tempPassword, salt);
        const defaultAvatar = `https://i.pravatar.cc/150?u=${email}`;
        
        const newUserDocument = {
            name,
            email,
            passwordHash,
            role,
            teamId: teamId || null,
            projectId: projectId || null,
            disabled: false,
            avatarUrl: defaultAvatar,
            notificationPreferences: { onAssignment: true, onComment: true, onStatusChange: false, onDueDateChange: false },
            createdAt: new Date(),
        };

        const result = await db.collection('users').insertOne(newUserDocument);
        
        // TODO: Send an invitation email to the user with a password creation link.
        
        const newUser = { id: result.insertedId, ...newUserDocument };
        delete (newUser as any).passwordHash;
        
        logger.info({ message: 'User created by admin', newUserId: newUser.id, adminUserId: req.user?.id });
        res.status(201).json(newUser);
    } catch (error) {
        logger.error({ message: 'Failed to create user', context: { body: req.body, userId: req.user?.id }, error });
        next(error);
    }
};

export const getAllUsers: RequestHandler = async (req, res, next) => {
    try {
        const db = getDb();
        const users = await db.collection('users').find({}, { projection: { passwordHash: 0 } }).sort({ name: 1 }).toArray();
        const responseUsers = users.map(u => ({ ...u, id: u._id }));
        res.json(responseUsers);
    } catch (error) {
        logger.error({ message: 'Failed to get all users', context: { userId: req.user?.id }, error });
        next(error);
    }
};

export const getUnassignedUsers: RequestHandler = async (req, res, next) => {
    try {
        const db = getDb();
        const users = await db.collection('users').find(
            { role: 'Employee', teamId: null, disabled: false },
            { projection: { _id: 1, name: 1, email: 1 } }
        ).sort({ name: 1 }).toArray();
        const responseUsers = users.map(u => ({ ...u, id: u._id }));
        res.json(responseUsers);
    } catch (error) {
        logger.error({ message: 'Failed to get unassigned users', context: { userId: req.user?.id }, error });
        next(error);
    }
};

export const updateUser: RequestHandler = async (req, res, next) => {
    const { userId } = req.params;
    const { name, email, role, teamId, disabled } = req.body;
    if (!name || !email || !role) {
        return res.status(400).json({ message: 'Name, email, and role are required' });
    }
    if (!ObjectId.isValid(userId)) {
        return res.status(400).json({ message: 'Invalid user ID format' });
    }

    try {
        const db = getDb();
        const result = await db.collection('users').findOneAndUpdate(
            { _id: new ObjectId(userId) },
            { $set: { name, email, role, teamId: teamId || null, disabled } },
            { returnDocument: 'after', projection: { passwordHash: 0 } }
        );
        
        if (!result) {
            return res.status(404).json({ message: 'User not found' });
        }
        logger.info({ message: 'User updated', updatedUserId: userId, adminUserId: req.user?.id });
        res.json({ ...result, id: result._id });
    } catch (error) {
        logger.error({ message: 'Failed to update user', context: { userId, body: req.body, adminUserId: req.user?.id }, error });
        next(error);
    }
};

export const deleteUser: RequestHandler = async (req, res, next) => {
    const { userId } = req.params;
     if (!ObjectId.isValid(userId)) {
        return res.status(400).json({ message: 'Invalid user ID format' });
    }

    try {
        const db = getDb();
        const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
        if (!user) {
             return res.status(404).json({ message: 'User not found' });
        }

        if(user.role === 'Guest') {
            await db.collection('users').deleteOne({ _id: new ObjectId(userId) });
            logger.info({ message: 'Guest user permanently deleted', deletedUserId: userId, adminUserId: req.user?.id });
            return res.status(204).send();
        } else {
            const result = await db.collection('users').findOneAndUpdate(
                { _id: new ObjectId(userId) },
                { $set: { disabled: true } },
                { returnDocument: 'after', projection: { passwordHash: 0 } }
            );
            if (!result) {
                return res.status(404).json({ message: 'User not found' });
            }
            logger.info({ message: 'User disabled', disabledUserId: userId, adminUserId: req.user?.id });
            res.json({ ...result, id: result._id });
        }
    } catch (error) {
        logger.error({ message: 'Failed to delete/disable user', context: { userId, adminUserId: req.user?.id }, error });
        next(error);
    }
};
