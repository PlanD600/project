
import { RequestHandler, Response } from 'express';
import { getDb } from '../../db';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { ObjectId } from 'mongodb';
import logger from '../../logger';

// Helper to generate a JWT for a user
const generateToken = (id: string, role: string, teamId?: string, projectId?: string) => {
    const payload: {id: string; role: string; teamId?: string; projectId?: string} = { id, role };
    if (teamId) payload.teamId = teamId;
    if (projectId) payload.projectId = projectId;
    
    const secret = process.env.JWT_SECRET!;
    const options = {
        expiresIn: process.env.JWT_EXPIRES_IN || '1d',
    };
    return jwt.sign(payload, secret, options as any);
};

// Helper to send token response
const sendTokenResponse = (user: any, statusCode: number, res: Response) => {
    const token = generateToken(user._id.toHexString(), user.role, user.teamId, user.projectId);

    const options = {
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 1 day
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict' as const,
    };

    // Sanitize user object for response
    const responseUser = {
        id: user._id.toHexString(),
        name: user.name,
        email: user.email,
        role: user.role,
        teamId: user.teamId,
        avatarUrl: user.avatarUrl,
        notificationPreferences: user.notificationPreferences,
        projectId: user.projectId,
    };

    res.status(statusCode)
        .cookie('jwt_token', token, options)
        .json(responseUser);
}

export const registerUser: RequestHandler = async (req, res, next) => {
    const { fullName, email, password, companyName } = req.body;
    if (!fullName || !email || !password || !companyName) {
        return res.status(400).json({ message: 'Please provide all required fields' });
    }
    
    // Password complexity check
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d]{8,}$/;
    if(!passwordRegex.test(password)){
        return res.status(400).json({ message: 'Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, and one number.'});
    }

    try {
        const db = getDb();
        const userExists = await db.collection('users').findOne({ email });
        if (userExists) {
            return res.status(400).json({ message: 'User with this email already exists' });
        }

        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);
        
        const defaultAvatar = `https://i.pravatar.cc/150?u=${email}`;
        const defaultNotificationPrefs = { onAssignment: true, onComment: true, onStatusChange: false, onDueDateChange: false };

        const newUserDocument = {
            name: fullName,
            email,
            passwordHash,
            role: 'Super Admin' as const,
            teamId: null,
            projectId: null,
            disabled: false,
            avatarUrl: defaultAvatar,
            notificationPreferences: defaultNotificationPrefs,
            createdAt: new Date(),
        };

        const result = await db.collection('users').insertOne(newUserDocument);
        
        const newUser = { _id: result.insertedId, ...newUserDocument };
        
        logger.info({
            message: 'New user registered successfully',
            userId: newUser._id.toHexString(),
            email: newUser.email,
            role: newUser.role,
        });

        sendTokenResponse(newUser, 201, res);
    } catch (error) {
        logger.error({
            message: 'User registration failed',
            context: { endpoint: req.originalUrl, body: req.body },
            error,
        });
        next(error);
    }
};

export const loginUser: RequestHandler = async (req, res, next) => {
    const { email, password } = req.body;
    try {
        const db = getDb();
        const user = await db.collection('users').findOne({ email, disabled: false });

        if (user && (await bcrypt.compare(password, user.passwordHash))) {
            logger.info({ message: 'User logged in successfully', userId: user._id.toHexString() });
            sendTokenResponse(user, 200, res);
        } else {
            logger.warn({ message: 'Failed login attempt', email });
            res.status(401).json({ message: 'Invalid email or password' });
        }
    } catch (error) {
        logger.error({
            message: 'User login process failed',
            context: { endpoint: req.originalUrl, email },
            error,
        });
        next(error);
    }
};

export const getMe: RequestHandler = async (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ message: 'Not authorized' });
    }
    try {
        const db = getDb();
        const user = await db.collection('users').findOne(
            { _id: new ObjectId(req.user.id), disabled: false },
            { projection: { passwordHash: 0 } }
        );

        if (user) {
             const responseUser = {
                id: user._id.toHexString(),
                name: user.name,
                email: user.email,
                role: user.role,
                teamId: user.teamId,
                avatarUrl: user.avatarUrl,
                notificationPreferences: user.notificationPreferences,
                projectId: user.projectId,
            };
            res.json(responseUser);
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
         logger.error({
            message: 'Failed to fetch current user (getMe)',
            context: { endpoint: req.originalUrl, userId: req.user?.id },
            error,
        });
        next(error);
    }
};

export const logoutUser: RequestHandler = async (req, res, next) => {
    try {
        res.cookie('jwt_token', 'none', {
            expires: new Date(Date.now() + 10 * 1000),
            httpOnly: true,
        });
        logger.info({ message: 'User logged out', userId: req.user?.id });
        res.status(200).json({ success: true, data: {} });
    } catch(error) {
        logger.error({ message: 'Logout failed', error });
        next(error);
    }
};
