// project-backend/src/api/auth/auth.controller.ts
import { RequestHandler } from 'express';
import prisma from '../../db';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import logger from '../../logger';
import { UserRole } from '@prisma/client';

// Helper to generate a JWT for a user
const generateToken = (id: string, projectId?: string | null) => {
    const secret = process.env.JWT_SECRET!;
    const options: jwt.SignOptions = {
        expiresIn: '30d',
    };

    const payload: { id: string; projectId?: string } = { id };
    if (projectId) {
        payload.projectId = projectId;
    }

    return jwt.sign(payload, secret, options);
};

// Helper to send token response
const sendTokenResponse = (user: { id: string, [key: string]: any }, statusCode: number, res: any, projectId?: string | null) => {
    const token = generateToken(user.id, projectId);

    const options = {
        expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'none' as const,
        domain: process.env.COOKIE_DOMAIN,
    };

    const { password, ...userWithoutPassword } = user;

    res.status(statusCode)
        .cookie('token', token, options)
        .json(userWithoutPassword);
};

export const registerUser: RequestHandler = async (req, res, next) => {
    const { fullName, email, password, companyName } = req.body;
    if (!fullName || !email || !password || !companyName) {
        logger.warn({ message: 'Registration attempt failed: Missing required fields.', context: { email, companyName } });
        return res.status(400).json({ message: 'נא למלא את כל השדות. גורל הטופס הזה תלוי בך!' });
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d]{8,}$/;
    if (!passwordRegex.test(password)) {
        logger.warn({ message: 'Registration attempt failed: Weak password.', context: { email } });
        return res.status(400).json({ message: 'הסיסמה חייבת להיות באורך 8 תווים לפחות, ולשחק אותה מתוחכמת עם אות גדולה, אות קטנה ומספר. בלי זה היא לא נכנסת למסיבה.' });
    }

    try {
        const userExists = await prisma.user.findUnique({ where: { email } });
        if (userExists) {
            logger.warn({ message: 'Registration attempt failed: User already exists.', context: { email } });
            return res.status(400).json({ message: 'רגע, רגע... נראה לי שכבר נפגשנו. המייל הזה כבר במערכת. רוצה להתחבר?' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = await prisma.user.create({
            data: {
                name: fullName,
                email,
                password: hashedPassword,
                role: 'ADMIN', // <-- התיקון החשוב
                avatarUrl: '',
            }
        });

        logger.info({
            message: 'User registered successfully.',
            userId: newUser.id,
            email: newUser.email,
            role: newUser.role,
        });

        sendTokenResponse(newUser, 201, res);
    } catch (error) {
        logger.error({
            message: 'Failed to register user.',
            context: { endpoint: req.originalUrl, body: req.body },
            error,
        });
        next(error);
    }
};

export const loginUser: RequestHandler = async (req, res, next) => {
    const { email, password, projectId } = req.body;
    try {
        const user = await prisma.user.findUnique({ where: { email } });

        if (user && (await bcrypt.compare(password, user.password))) {
            logger.info({ message: 'User logged in successfully.', userId: user.id });
            sendTokenResponse(user, 200, res, projectId);
        } else {
            logger.warn({ message: 'Failed login attempt: Invalid credentials.', email });
            res.status(401).json({ message: 'הפרטים שהזנת אינם תואמים. אולי שכחת את הסיסמה?' });
        }
    } catch (error) {
        logger.error({
            message: 'Login failed.',
            context: { endpoint: req.originalUrl, email },
            error,
        });
        next(error);
    }
};

export const getMe: RequestHandler = async (req, res, next) => {
    if (!req.user) {
        logger.warn({ message: 'Unauthorized attempt to get current user data: No user in request.' });
        return res.status(401).json({ message: 'גישה למורשים בלבד' });
    }
    try {
        // Since req.user is already populated by the protect middleware,
        // we just need to confirm it's valid and log the access.
        logger.info({ message: 'Current user data accessed successfully.', userId: req.user.id });
        res.json(req.user);
    } catch (error) {
        logger.error({ message: 'Failed to retrieve current user data.', context: { userId: req.user.id }, error });
        next(error);
    }
};

export const logoutUser: RequestHandler = async (req, res, next) => {
    try {
        res.cookie('token', 'none', {
            expires: new Date(Date.now() + 10 * 1000),
            httpOnly: true,
        });
        logger.info({ message: 'User logged out successfully.', userId: req.user?.id });
        res.status(200).json({ success: true, data: {} });
    } catch (error) {
        logger.error({ message: 'Logout failed.', error });
        next(error);
    }
};

export const uploadAvatar: RequestHandler = async (req, res, next) => {
    const { image } = req.body;
    const user = req.user;

    if (!user) {
        logger.warn({ message: 'Unauthorized attempt to upload avatar: No user in request.' });
        return res.status(401).json({ message: "גישה למורשים בלבד" });
    }
    if (!image) {
        logger.warn({ message: 'Avatar upload failed: No image provided.', userId: user.id });
        return res.status(400).json({ message: "קצת ריק פה, בוא/י נוסיף תמונה כדי להשלים את הפרופיל." });
    }

    try {
        const updatedUser = await prisma.user.update({
            where: { id: user.id },
            data: { avatarUrl: image },
        });

        logger.info({ message: 'Avatar updated successfully.', userId: user.id });

        const { password, ...userWithoutPassword } = updatedUser;
        res.status(200).json(userWithoutPassword);

    } catch (error) {
        logger.error({ message: 'Failed to upload avatar.', context: { userId: user.id }, error });
        next(error);
    }
};