import { Request, Response } from 'express';
import asyncHandler from 'express-async-handler';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import prisma from '../../db';
import logger from '../../logger';
import { z } from 'zod';

/**
 * פונקציית עזר ליצירת טוקן (JWT) עבור ID של משתמש.
 * @param userId ה-ID של המשתמש שעבורו יש ליצור טוקן.
 * @returns הטוקן (JWT) שנוצר.
 */
const generateToken = (userId: string): string => {
    if (!process.env.JWT_SECRET) {
        logger.error('FATAL: JWT_SECRET is not defined. Cannot generate token.');
        throw new Error('Server configuration error: JWT secret is missing.');
    }
    return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
        expiresIn: '30d', // תוקף הטוקן: 30 יום
    });
};

// Registration input schema
const registrationSchema = z.object({
  fullName: z.string().min(1, 'Full name is required'),
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  companyName: z.string().min(1, 'Company name is required'),
});

/**
 * @desc    הרשמת משתמש וארגון חדשים
 * @route   POST /api/auth/register
 * @access  Public
 */
export const registerUser = asyncHandler(async (req, res) => {
    // [DEBUG] 1. Registration process started. Request body:
    console.log('[DEBUG] 1. Registration process started. Request body:', req.body);

    // Validate input
    const parsed = registrationSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input', details: parsed.error.errors });
      return;
    }
    const { fullName: name, email, password, companyName: organizationName } = parsed.data;

    logger.info('Registration request received', { name, email, organizationName });

    if (!name || !email || !password || !organizationName) {
        logger.warn('Missing required registration fields', { name, email, organizationName });
        res.status(400);
        throw new Error('נא למלא את כל השדות הנדרשים להרשמה.');
    }

    const userExists = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (userExists) {
        logger.warn('User already exists', { email });
        res.status(400);
        throw new Error('משתמש עם כתובת אימייל זו כבר קיים.');
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    try {
        const result = await prisma.$transaction(async (tx) => {
            // [DEBUG] 4. Data for creating organization:
            const organizationDataObject = { name: organizationName };
            console.log('[DEBUG] 4. Data for creating organization:', organizationDataObject);
            // 1. Create organization
            const newOrganization = await tx.organization.create({
                data: organizationDataObject
            });
            // [DEBUG] 5. New organization created:
            console.log('[DEBUG] 5. New organization created:', newOrganization);
            logger.info('Organization created', { orgId: newOrganization.id });

            // [DEBUG] 2. Data for creating user:
            const userDataObject = {
                name,
                email: email.toLowerCase(),
                password: hashedPassword,
            };
            console.log('[DEBUG] 2. Data for creating user:', userDataObject);
            // 2. Create user (without activeOrganizationId)
            const newUser = await tx.user.create({
                data: userDataObject
            });
            // [DEBUG] 3. New user created:
            console.log('[DEBUG] 3. New user created:', newUser);

            // 3. Create membership
            const membership = await tx.membership.create({
                data: {
                    userId: newUser.id,
                    organizationId: newOrganization.id,
                    role: 'ORG_ADMIN',
                },
            });
            logger.info('Membership created', { membershipId: membership.id });

            // [DEBUG] 6. Data for updating user with active org:
            console.log('[DEBUG] 6. Data for updating user with active org:', { where: { id: newUser.id }, data: { activeOrganizationId: newOrganization.id } });
            // 4. Update user to set activeOrganizationId
            const updatedUser = await tx.user.update({
                where: { id: newUser.id },
                data: { activeOrganizationId: newOrganization.id },
                select: {
                    id: true,
                    email: true,
                    name: true,
                    avatarUrl: true,
                    teamId: true,
                    activeOrganization: { select: { id: true } },
                },
            });
            logger.info('User updated with activeOrganizationId', { userId: updatedUser.id, activeOrganizationId: updatedUser.activeOrganization?.id });

            return { user: updatedUser, organization: newOrganization, membership };
        });

        if (result.user && result.organization && result.membership) {
            logger.info('Registration transaction successful', {
                userId: result.user.id,
                orgId: result.organization.id,
                membershipId: result.membership.id,
            });

            const token = generateToken(result.user.id);

            const userResponse = {
                id: result.user.id,
                email: result.user.email,
                name: result.user.name,
                avatarUrl: result.user.avatarUrl,
                teamId: result.user.teamId,
                activeOrganizationId: result.user.activeOrganization?.id,
            };

            res.status(201).json({
                user: userResponse,
                organization: result.organization, // <-- add this
                token: token
            });
        } else {
            logger.error('Registration transaction did not return all expected entities');
            res.status(500);
            throw new Error('יצירת המשתמש נכשלה.');
        }
    } catch (error) {
        logger.error('Registration transaction failed', { error });
        res.status(500);
        throw new Error('שגיאה ביצירת משתמש וארגון: ' + error.message);
    }
});

const loginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

/**
 * @desc    אימות משתמש וקבלת טוקן
 * @route   POST /api/auth/login
 * @access  Public
 */
export const loginUser = asyncHandler(async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.errors });
    return;
  }
  const { email, password } = parsed.data;

    if (!email || !password) {
        res.status(400);
        throw new Error('נא למלא אימייל וסיסמה.');
    }

    const user = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
    });

    if (user && (await bcrypt.compare(password, user.password))) {
        logger.info(`התחברות מוצלחת למשתמש.`, { userId: user.id });

        const token = generateToken(user.id);
        
        const userResponse = {
            id: user.id,
            email: user.email,
            name: user.name,
            avatarUrl: user.avatarUrl,
            teamId: user.teamId,
        };

        res.status(200).json({
            user: userResponse,
            token: token
        });
    } else {
        res.status(401);
        throw new Error('אימייל או סיסמה שגויים.');
    }
});

/**
 * @desc    קבלת פרטי המשתמש המחובר
 * @route   GET /api/auth/me
 * @access  Private
 */
export const getMe = asyncHandler(async (req, res) => {
    if (!req.user) {
        res.status(404);
        throw new Error('המשתמש לא נמצא.');
    }
    res.status(200).json(req.user);
});

/**
 * @desc    התנתקות המשתמש
 * @route   POST /api/auth/logout
 * @access  Private
 */
export const logoutUser = asyncHandler(async (req, res) => {
    logger.info('התנתקות משתמש בוצעה.', { userId: req.user?.id });
    res.status(200).json({ message: 'התנתקת בהצלחה.' });
});

/**
 * @desc    העלאת תמונת פרופיל למשתמש
 * @route   POST /api/auth/me/avatar
 * @access  Private
 */
export const uploadAvatar = asyncHandler(async (req, res) => {
    const { image } = req.body;
    if (!req.user) {
        res.status(401);
        throw new Error('אינך מורשה לבצע פעולה זו.');
    }
    
    const updatedUser = await prisma.user.update({
        where: { id: req.user.id },
        data: { avatarUrl: 'https://i.pravatar.cc/150?u=' + req.user.id },
        select: {
            id: true,
            email: true,
            name: true,
            avatarUrl: true,
            teamId: true,
        },
    });
    
    res.status(200).json(updatedUser);
});

/**
 * @desc    בקשת קישור לאיפוס סיסמה
 * @route   POST /api/auth/forgotpassword
 * @access  Public
 */
export const forgotPassword = asyncHandler(async (req: Request, res: Response) => {
    const { email } = req.body;

    if (!email) {
        res.status(400);
        throw new Error('נא לספק כתובת אימייל.');
    }

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });

    if (!user) {
        logger.warn(`Password reset requested for non-existent email: ${email}`);
        // אנו שולחים תגובה זהה כדי לא לחשוף אם משתמש קיים או לא
        res.status(200).json({ message: 'אם קיים משתמש עם כתובת מייל זו, נשלח אליו קישור לאיפוס סיסמה.' });
        return;
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    const passwordResetExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 דקות תוקף

    await prisma.user.update({
        where: { email: email.toLowerCase() },
        data: { passwordResetToken, passwordResetExpires },
    });

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
    const emailHtml = `<p>כדי לאפס את סיסמתך, לחץ על הקישור הבא: <a href="${resetUrl}">אפס סיסמה</a></p>`;

    // REMOVE THE EMAIL SENDING LOGIC FROM forgotPassword:
    // try {
    //     await sendEmail({ to: user.email, subject: 'איפוס סיסמה', html: emailHtml });
    //     res.status(200).json({ message: 'אם קיים משתמש עם כתובת מייל זו, נשלח אליו קישור לאיפוס סיסמה.' });
    // } catch (error) {
    //     logger.error(`Failed to send password reset email to ${user.email}`, error);
    //     // נקה את טוקן האיפוס אם שליחת המייל נכשלה
    //     await prisma.user.update({
    //         where: { email: email.toLowerCase() },
    //         data: { passwordResetToken: null, passwordResetExpires: null },
    //     });
    //     throw new Error('שגיאה בשליחת המייל. נסה שוב מאוחר יותר.');
    // }
    // INSTEAD, JUST RESPOND SUCCESSFULLY:
    res.status(200).json({ message: 'אם קיים משתמש עם כתובת מייל זו, ניתן לאפס סיסמה.' });
});


/**
 * @desc    איפוס סיסמה באמצעות טוקן
 * @route   PATCH /api/auth/resetpassword
 * @access  Public
 */
export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
    const { token, password } = req.body;

    if (!token || !password) {
        res.status(400);
        throw new Error("Token and new password are required.");
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await prisma.user.findFirst({
        where: {
            passwordResetToken: hashedToken,
            passwordResetExpires: { gt: new Date() },
        },
    });

    if (!user) {
        res.status(400);
        throw new Error('הטוקן אינו תקין או שפג תוקפו.');
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    await prisma.user.update({
        where: { id: user.id },
        data: {
            password: hashedPassword,
            passwordResetToken: null,
            passwordResetExpires: null,
        },
    });

    logger.info(`סיסמה אופסה בהצלחה עבור משתמש: ${user.email}`);
    res.status(200).json({ message: 'הסיסמה אופסה בהצלחה.' });
});