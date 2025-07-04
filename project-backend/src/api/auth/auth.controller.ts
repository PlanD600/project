import { Request, Response } from 'express';
import asyncHandler from 'express-async-handler';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../../db';
import logger from '../../logger';

/**
 * Generates a JWT for a given user ID.
 * @param userId The ID of the user to generate a token for.
 * @returns The generated JWT.
 */
const generateToken = (userId: string): string => {
    if (!process.env.JWT_SECRET) {
        logger.error('FATAL: JWT_SECRET is not defined. Cannot generate token.');
        throw new Error('Server configuration error: JWT secret is missing.');
    }
    return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
        expiresIn: '30d',
    });
};

/**
 * @desc    Register a new user and organization
 * @route   POST /api/auth/register
 * @access  Public
 */
export const registerUser = asyncHandler(async (req, res) => {
    const { name, email, password, organizationName } = req.body;

    if (!name || !email || !password || !organizationName) {
        res.status(400);
        throw new Error('Please provide all required fields for registration.');
    }

    const userExists = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (userExists) {
        res.status(400);
        throw new Error('User with this email already exists.');
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const organization = await prisma.organization.create({
        data: { name: organizationName }
    });

    const user = await prisma.user.create({
        data: {
            name,
            email: email.toLowerCase(),
            password: hashedPassword,
            role: 'ADMIN',
            organizationId: organization.id,
        },
    });

    if (user) {
        logger.info('User and Organization registered successfully.', { userId: user.id, email: user.email });
        
        const token = generateToken(user.id);

        const userResponse = {
            id: user.id,
            email: user.email,
            name: user.name,
            avatarUrl: user.avatarUrl,
            role: user.role,
            organizationId: user.organizationId,
            teamId: user.teamId,
        };
        
        res.status(201).json({
            user: userResponse,
            token: token
        });
    } else {
        res.status(500);
        throw new Error('Failed to create user.');
    }
});


/**
 * @desc    Authenticate user & get token
 * @route   POST /api/auth/login
 * @access  Public
 */
export const loginUser = asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = req.body;

    if (!email || !password) {
        res.status(400);
        throw new Error('Please provide email and password');
    }

    const user = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
    });

    if (user && (await bcrypt.compare(password, user.password))) {
        logger.info(`הצלחת להתחבר`, { userId: user.id });

        const token = generateToken(user.id);
        
        const userResponse = {
            id: user.id,
            email: user.email,
            name: user.name,
            avatarUrl: user.avatarUrl,
            role: user.role,
            organizationId: user.organizationId,
            teamId: user.teamId,
        };

        res.status(200).json({
            user: userResponse,
            token: token
        });

    } else {
        // THIS IS THE FIX:
        res.status(401);
        throw new Error('Invalid email or password');
    }
});

/**
 * @desc    Get user profile
 * @route   GET /api/auth/me
 * @access  Private
 */
export const getMe = asyncHandler(async (req, res) => {
    if (!req.user) {
        res.status(404);
        throw new Error('User not found');
    }
    res.status(200).json(req.user);
});

/**
 * @desc    Logout user
 * @route   POST /api/auth/logout
 * @access  Private
 */
export const logoutUser = asyncHandler(async (req, res) => {
    logger.info('User logged out successfully.');
    res.status(200).json({ message: 'Logged out' });
});

/**
 * @desc    Upload user avatar
 * @route   POST /api/auth/me/avatar
 * @access  Private
 */
export const uploadAvatar = asyncHandler(async (req, res) => {
    const { image } = req.body;
    if (!req.user) {
        res.status(401);
        throw new Error('Not authorized');
    }
    
    const updatedUser = await prisma.user.update({
        where: { id: req.user.id },
        data: { avatarUrl: 'https://i.pravatar.cc/150?u=' + req.user.id },
        select: {
            id: true,
            email: true,
            name: true,
            avatarUrl: true,
            role: true,
            organizationId: true,
            teamId: true,
        },
    });
    
    res.status(200).json(updatedUser);
});