import { RequestHandler } from 'express';
import prisma from '../../db'; // Using Prisma client instead of getDb
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import logger from '../../logger';

// Helper to generate a JWT for a user
const generateToken = (id: string) => {
    const secret = process.env.JWT_SECRET!;
    const options: jwt.SignOptions = {
        expiresIn: process.env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] || '30d', 
    };
    // ודא שהשורה הבאה נראית בדיוק כך, ללא תווי רווח נוספים או תווים שגויים
    return jwt.sign({ id }, secret, options); 
};

// Helper to send token response
const sendTokenResponse = (user: { id: string, [key: string]: any }, statusCode: number, res: any) => {
    const token = generateToken(user.id);

    const options = {
        expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict' as const,
    };

    // Sanitize user object for response, removing the password
    const { password, ...userWithoutPassword } = user;

    res.status(statusCode)
       .cookie('token', token, options)
       .json(userWithoutPassword);
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
        const userExists = await prisma.user.findUnique({ where: { email } });
        if (userExists) {
            return res.status(400).json({ message: 'User with this email already exists' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        
        const newUser = await prisma.user.create({
            data: {
                name: fullName,
                email,
                password: hashedPassword, // The field is 'password' in the Prisma schema
                role: 'Super Admin',
                avatarUrl: '', // Default avatar
            }
        });
        
        logger.info({
            message: 'New user registered successfully',
            userId: newUser.id,
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
        const user = await prisma.user.findUnique({ where: { email } });

        // Note: Prisma schema does not have a 'disabled' field currently. Add it if needed.
        if (user && (await bcrypt.compare(password, user.password))) {
            logger.info({ message: 'User logged in successfully', userId: user.id });
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
    // The user object is already attached to req.user by the 'protect' middleware.
    // The middleware (which we'll update later) will fetch from Prisma.
    // We can just return it.
    res.json(req.user);
};

export const logoutUser: RequestHandler = async (req, res, next) => {
    try {
        res.cookie('token', 'none', {
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

export const uploadAvatar: RequestHandler = async (req, res, next) => {
    const { image } = req.body; // Expects a base64 data URL
    const user = req.user;

    if (!user) return res.status(401).json({ message: "Not authorized" });
    if (!image) return res.status(400).json({ message: "No image data provided" });

    try {
        const updatedUser = await prisma.user.update({
            where: { id: user.id },
            data: { avatarUrl: image },
        });
        
        logger.info({ message: 'User avatar updated', userId: user.id });

        const { password, ...userWithoutPassword } = updatedUser;
        res.status(200).json(userWithoutPassword);

    } catch (error) {
        logger.error({ message: 'Failed to upload avatar', context: { userId: user.id }, error });
        next(error);
    }
};