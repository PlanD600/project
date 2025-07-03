// project-backend/src/api/auth/auth.controller.ts
import { Request, Response, NextFunction, RequestHandler } from 'express';
import prisma from '../../db';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import logger from '../../logger';
import { UserRole } from '@prisma/client';

type UserWithOrg = {
    id: string;
    organizationId: string;
    [key: string]: any;
};


// Helper to generate a JWT for a user
const generateToken = (id: string, organizationId: string) => {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        // This will stop the server if the secret is not configured, which is a good practice.
        throw new Error('JWT_SECRET is not defined in the .env file');
    }

    // The payload now contains both id and organizationId
    const payload = {
        id,
        organizationId,
    };

    const options: jwt.SignOptions = {
        expiresIn: '30d',
    };

    return jwt.sign(payload, secret, options);
};

// Helper to send token response
export const sendTokenResponse = (user: UserWithOrg, statusCode: number, res: Response) => {
    // Call generateToken with both id and organizationId
    const token = generateToken(user.id, user.organizationId);

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
    // Your existing validation logic - stays the same!
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

        // --- START: NEW LOGIC ---
        // This is where we replace the old user creation with a transaction
        const result = await prisma.$transaction(async (tx) => {
            // 1. Create the organization using the companyName
            const newOrganization = await tx.organization.create({
                data: {
                    name: companyName,
                },
            });

            // 2. Create the user using fullName and link to the new organization
            const newUser = await tx.user.create({
                data: {
                    name: fullName,
                    email,
                    password: hashedPassword,
                    role: UserRole.ADMIN, // The first user is the admin of the organization
                    organizationId: newOrganization.id, // This is the crucial link!
                    avatarUrl: '', // Kept your avatarUrl field
                },
            });

            return { newUser, newOrganization };
        });
        // --- END: NEW LOGIC ---

        logger.info({
            message: 'User and Organization registered successfully.',
            userId: result.newUser.id,
            organizationId: result.newOrganization.id,
            email: result.newUser.email,
        });

        // We will need to update sendTokenResponse next
        sendTokenResponse(result.newUser, 201, res);

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
    const { email, password } = req.body;
    try {
        const user = await prisma.user.findUnique({ where: { email } });

        // We check for user, for password, AND that the user has an organizationId
        if (user && (await bcrypt.compare(password, user.password))) {

            // This is the new, important check
            if (!user.organizationId) {
                logger.error({ message: 'Login failed: User exists but has no organization ID.', userId: user.id });
                return res.status(500).json({ message: 'שגיאה במבנה הנתונים, נא ליצור קשר עם התמיכה.' });
            }

            logger.info({ message: 'הצלחת להתחבר', userId: user.id });
            sendTokenResponse(user, 200, res); // Now TypeScript is happy

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