import { Request, Response, NextFunction, RequestHandler } from 'express';
import prisma from '../../db';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import logger from '../../logger';
import { UserRole } from '@prisma/client';

// A type helper for the user object, ensuring it has an organizationId
type UserWithOrg = {
    id: string;
    organizationId: string;
    password?: string | null; // Password can be optional in the object
    [key: string]: any;
};

// --- START: REVISED TOKEN AND COOKIE LOGIC ---

/**
 * Generates a JWT and sets it as a robust, secure HTTP-only cookie.
 * This function replaces the old generateToken and sendTokenResponse helpers.
 * @param res The Express response object.
 * @param user The user object, must contain id and organizationId.
 */
const generateAndSetTokenCookie = (res: Response, user: UserWithOrg) => {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        logger.error('FATAL: JWT_SECRET is not defined in environment variables.');
        throw new Error('Server configuration error: JWT secret is missing.');
    }
    if (secret.length < 32) {
        logger.warn('SECURITY WARNING: JWT_SECRET is less than 32 characters long. Please use a longer, more secure secret for production.');
    }

    const payload = {
        id: user.id,
        organizationId: user.organizationId,
    };

    const token = jwt.sign(payload, secret, {
        expiresIn: '30d',
    });

    const isProduction = process.env.NODE_ENV === 'production';

    // Dynamically determine the cookie domain from the FRONTEND_URL for production
    let cookieDomain: string | undefined = undefined;
    if (isProduction && process.env.FRONTEND_URL) {
        try {
            const frontendUrl = new URL(process.env.FRONTEND_URL);
            // Use the eTLD+1 domain (e.g., 'mypland.com')
            // This allows the cookie to be shared between api.mypland.com and mypland.com
            cookieDomain = frontendUrl.hostname.split('.').slice(-2).join('.');
            logger.info(`Setting cookie domain for production: .${cookieDomain}`);
        } catch (error) {
            logger.error('Could not parse FRONTEND_URL to set cookie domain.', { url: process.env.FRONTEND_URL, error });
        }
    }

    res.cookie('token', token, {
        httpOnly: true, // Crucial for security, prevents JS access
        secure: isProduction, // Send only over HTTPS in production
        sameSite: isProduction ? 'lax' : 'strict', // 'lax' is a robust choice for production auth
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        ...(cookieDomain && { domain: cookieDomain }), // Set the domain only if it was determined
    });
};

// --- END: REVISED TOKEN AND COOKIE LOGIC ---


export const registerUser: RequestHandler = async (req, res, next) => {
    const { fullName, email, password, companyName } = req.body;
    if (!fullName || !email || !password || !companyName) {
        logger.warn({ message: 'Registration attempt failed: Missing required fields.', context: { email, companyName } });
        return res.status(400).json({ message: 'נא למלא את כל השדות.' });
    }

    // Your password validation logic remains the same
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d]{8,}$/;
    if (!passwordRegex.test(password)) {
        logger.warn({ message: 'Registration attempt failed: Weak password.', context: { email } });
        return res.status(400).json({ message: 'הסיסמה חייבת להיות באורך 8 תווים לפחות, ולכלול אות גדולה, אות קטנה ומספר.' });
    }

    try {
        const userExists = await prisma.user.findUnique({ where: { email } });
        if (userExists) {
            logger.warn({ message: 'Registration attempt failed: User already exists.', context: { email } });
            return res.status(400).json({ message: 'המייל הזה כבר במערכת. רוצה להתחבר?' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Your transaction logic is great, it stays the same.
        const { newUser } = await prisma.$transaction(async (tx) => {
            const newOrganization = await tx.organization.create({ data: { name: companyName } });
            const newUser = await tx.user.create({
                data: {
                    name: fullName,
                    email,
                    password: hashedPassword,
                    role: UserRole.ADMIN,
                    organizationId: newOrganization.id,
                    avatarUrl: '',
                },
            });
            return { newUser, newOrganization };
        });

        logger.info({ message: 'User and Organization registered successfully.', userId: newUser.id, email: newUser.email });

        // Generate and set the cookie using the new robust function
        generateAndSetTokenCookie(res, newUser);

        // Send the response
        const { password: _, ...userWithoutPassword } = newUser;
        res.status(201).json(userWithoutPassword);

    } catch (error) {
        logger.error({ message: 'Failed to register user.', error });
        next(error);
    }
};

export const loginUser: RequestHandler = async (req, res, next) => {
    const { email, password } = req.body;
    try {
        const user = await prisma.user.findUnique({ where: { email } });

        if (user && user.password && (await bcrypt.compare(password, user.password))) {
            if (!user.organizationId) {
                logger.error({ message: 'Login failed: User exists but has no organization ID.', userId: user.id });
                return res.status(500).json({ message: 'שגיאה במבנה הנתונים, נא ליצור קשר עם התמיכה.' });
            }

            logger.info({ message: 'הצלחת להתחבר', userId: user.id });
            
            // Generate and set the cookie using the new robust function
            generateAndSetTokenCookie(res, user);

            // Send the response
            const { password: _, ...userWithoutPassword } = user;
            res.status(200).json(userWithoutPassword);

        } else {
            logger.warn({ message: 'Failed login attempt: Invalid credentials.', email });
            res.status(401).json({ message: 'הפרטים שהזנת אינם תואמים.' });
        }
    } catch (error) {
        logger.error({ message: 'Login failed.', error });
        next(error);
    }
};

export const getMe: RequestHandler = async (req, res, next) => {
    // This function is fine as it is, it relies on the 'protect' middleware.
    if (!req.user) {
        logger.warn({ message: 'Unauthorized attempt to get current user data: No user in request.' });
        return res.status(401).json({ message: 'גישה למורשים בלבד' });
    }
    logger.info({ message: 'Current user data accessed successfully.', userId: req.user.id });
    res.json(req.user);
};

export const logoutUser: RequestHandler = async (req, res, next) => {
    try {
        // To properly clear a cookie, you should set its value to empty and expire it in the past.
        // We also need to provide the same domain and path as when we set it.
        const isProduction = process.env.NODE_ENV === 'production';
        let cookieDomain: string | undefined = undefined;
        if (isProduction && process.env.FRONTEND_URL) {
             try {
                const frontendUrl = new URL(process.env.FRONTEND_URL);
                cookieDomain = frontendUrl.hostname.split('.').slice(-2).join('.');
            } catch {}
        }

        res.cookie('token', '', {
            httpOnly: true,
            secure: isProduction,
            sameSite: isProduction ? 'lax' : 'strict',
            expires: new Date(0), // Expire immediately
            ...(cookieDomain && { domain: cookieDomain }),
        });

        logger.info({ message: 'User logged out successfully.', userId: req.user?.id });
        res.status(200).json({ success: true, message: 'Logged out' });

    } catch (error) {
        logger.error({ message: 'Logout failed.', error });
        next(error);
    }
};

export const uploadAvatar: RequestHandler = async (req, res, next) => {
    // This function is also fine as it is.
    const { image } = req.body;
    const user = req.user;

    if (!user) {
        return res.status(401).json({ message: "גישה למורשים בלבד" });
    }
    if (!image) {
        return res.status(400).json({ message: "נא לספק תמונה." });
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
