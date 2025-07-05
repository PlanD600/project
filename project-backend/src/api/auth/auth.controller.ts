import { Request, Response } from 'express';
import asyncHandler from 'express-async-handler';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto'; // <-- הוספנו את הייבוא החסר כאן
import prisma from '../../db';
import logger from '../../logger';
import { sendEmail } from '../../services/emailService'; // ודא שקובץ זה קיים בנתיב הנכון

/**
 * פונקציית עזר ליצירת טוקן (JWT) עבור ID של משתמש.
 * @param userId ה-ID של המשתמש שעבורו יש ליצור טוקן.
 * @returns הטוקן (JWT) שנוצר.
 */
const generateToken = (userId: string): string => {
    if (!process.env.JWT_SECRET) {
        logger.error('FATAL: JWT_SECRET is not defined. Cannot generate token.');
        // באפליקציה אמיתית, ייתכן שנרצה למנוע מהשרת לעלות אם המפתח הסודי חסר.
        throw new Error('Server configuration error: JWT secret is missing.');
    }
    return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
        expiresIn: '30d', // תוקף הטוקן: 30 יום
    });
};

/**
 * @desc    הרשמת משתמש וארגון חדשים
 * @route   POST /api/auth/register
 * @access  Public
 */
export const registerUser = asyncHandler(async (req, res) => {
    const { name, email, password, organizationName } = req.body;

    if (!name || !email || !password || !organizationName) {
        res.status(400);
        throw new Error('נא למלא את כל השדות הנדרשים להרשמה.');
    }

    const userExists = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (userExists) {
        res.status(400);
        throw new Error('משתמש עם כתובת אימייל זו כבר קיים.');
    }

    // הצפנת הסיסמה
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // יצירת הארגון והמשתמש בטרנזקציה אחת כדי להבטיח שלמות מידע
    const { organization, user } = await prisma.$transaction(async (tx) => {
        const newOrganization = await tx.organization.create({
            data: { name: organizationName }
        });

        const newUser = await tx.user.create({
            data: {
                name,
                email: email.toLowerCase(),
                password: hashedPassword,
                role: 'ADMIN', // המשתמש הראשון הוא אדמין של הארגון
                organizationId: newOrganization.id,
            },
        });

        return { organization: newOrganization, user: newUser };
    });

    if (user) {
        logger.info('משתמש וארגון נרשמו בהצלחה.', { userId: user.id, email: user.email });
        
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
        
        // שליחת תגובה בפורמט שה-frontend מצפה לו
        res.status(201).json({
            user: userResponse,
            token: token
        });
    } else {
        res.status(500);
        throw new Error('יצירת המשתמש נכשלה.');
    }
});


/**
 * @desc    אימות משתמש וקבלת טוקן
 * @route   POST /api/auth/login
 * @access  Public
 */
export const loginUser = asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = req.body;

    if (!email || !password) {
        res.status(400);
        throw new Error('נא למלא אימייל וסיסמה.');
    }

    const user = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
    });

    // בדיקה אם המשתמש קיים והסיסמה נכונה
    if (user && (await bcrypt.compare(password, user.password))) {
        logger.info(`התחברות מוצלחת למשתמש.`, { userId: user.id });

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

        // שליחת תגובה בפורמט שה-frontend מצפה לו
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
    // המידע על המשתמש מגיע מה-middleware 'protect' שהוסיף אותו ל-req
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
    // בשימוש ב-JWT, ההתנתקות מתבצעת בצד הלקוח (מחיקת הטוקן).
    // ה-endpoint הזה קיים בעיקר לשלמות המערכת.
    logger.info('התנתקות משתמש בוצעה.', { userId: req.user?.id });
    res.status(200).json({ message: 'התנתקת בהצלחה.' });
});

/**
 * @desc    העלאת תמונת פרופיל למשתמש
 * @route   POST /api/auth/me/avatar
 * @access  Private
 */
export const uploadAvatar = asyncHandler(async (req, res) => {
    // זהו יישום דמה (placeholder) שיש להחליף בשירות העלאת קבצים אמיתי.
    const { image } = req.body; // מצפים לקבל מחרוזת base64 או data URL
    if (!req.user) {
        res.status(401);
        throw new Error('אינך מורשה לבצע פעולה זו.');
    }

    // באפליקציה אמיתית, כאן יעלה הקובץ לשירות ענן (כמו S3 או Cloudinary) ונקבל חזרה URL.
    // כרגע, נעדכן את כתובת התמונה לכתובת דמה.
    const updatedUser = await prisma.user.update({
        where: { id: req.user.id },
        data: { avatarUrl: 'https://i.pravatar.cc/150?u=' + req.user.id }, // כתובת דמה
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


/**
 * @desc    Request a password reset link
 * @route   POST /api/auth/forgotpassword
 * @access  Public
 */
export const forgotPassword = asyncHandler(async (req: Request, res: Response): Promise<void> => { // הוספתי Promise<void>
    const { email } = req.body;

    if (!email) {
        res.status(400).json({ message: 'Please provide an email address.' });
        return; // ודא חזרה מפורשת של void
    }

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });

    if (!user) {
        logger.warn(`Password reset requested for non-existent email: ${email}`);
        res.status(200).json({ message: 'If a user with that email exists, a password reset link has been sent.' });
        return; // ודא חזרה מפורשת של void
    }

    // Generate a reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');

    // Set token expiry to 1 hour
    const passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000);

    // Save token and expiry to user
    await prisma.user.update({
        where: { id: user.id },
        data: {
            passwordResetToken,
            passwordResetExpires,
        },
    });

    // Create reset URL for the frontend
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

    const emailHtml = `
        <h1>איפוס סיסמה ל-PlanD</h1>
        <p>קיבלת הודעה זו כי בקשת לאיפוס סיסמתך.</p>
        <p>אנא לחץ על הקישור הבא כדי לאפס את סיסמתך (הקישור תקף לשעה אחת בלבד):</p>
        <a href="${resetUrl}">איפוס סיסמה</a>
        <p>אם לא ביקשת איפוס סיסמה, אנא התעלם ממייל זה.</p>
    `;

    try {
        await sendEmail({
            to: user.email,
            subject: 'איפוס סיסמה עבור PlanD שלך',
            html: emailHtml,
        });

        logger.info(`Password reset email sent to ${user.email}`);
        res.status(200).json({ message: 'If a user with that email exists, a password reset link has been sent.' });
        return; // ודא חזרה מפורשת של void
    } catch (error) {
        // If email fails, revert the token in DB to prevent invalid tokens
        await prisma.user.update({
            where: { id: user.id },
            data: {
                passwordResetToken: null,
                passwordResetExpires: null,
            },
        });
        logger.error(`Failed to send password reset email to ${user.email}: ${(error as Error).message}`);
        res.status(500); // קבע סטטוס לפני זריקת שגיאה
        throw new Error('There was an error sending the password reset email. Please try again later.');
    }
});

/**
 * @desc    Reset user password using token
 * @route   PATCH /api/auth/resetpassword/:token
 * @access  Public
 */
export const resetPassword = asyncHandler(async (req: Request, res: Response): Promise<void> => { // הוספתי Promise<void>
    const { token } = req.params;
    const { password } = req.body;

    if (!password) {
        res.status(400).json({ message: 'Please provide a new password.' });
        return; // ודא חזרה מפורשת של void
    }

    // Hash the incoming token to compare with the one in the database
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await prisma.user.findFirst({
        where: {
            passwordResetToken: hashedToken,
            passwordResetExpires: {
                gt: new Date(), // Check if the token is not expired
            },
        },
    });

    if (!user) {
        res.status(400).json({ message: 'Invalid or expired password reset token.' });
        return; // ודא חזרה מפורשת של void
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Update user password and clear reset token fields
    await prisma.user.update({
        where: { id: user.id },
        data: {
            password: hashedPassword,
            passwordResetToken: null,
            passwordResetExpires: null,
        },
    });

    logger.info(`Password successfully reset for user: ${user.email}`);
    res.status(200).json({ message: 'Password has been reset successfully.' });
    return; // ודא חזרה מפורשת של void
});