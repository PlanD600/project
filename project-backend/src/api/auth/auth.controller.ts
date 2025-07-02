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
    };

    const { password, ...userWithoutPassword } = user;

    res.status(statusCode)
        .cookie('token', token, options)
        .json(userWithoutPassword);
};

export const registerUser: RequestHandler = async (req, res, next) => {
    const { fullName, email, password, companyName } = req.body;
    if (!fullName || !email || !password || !companyName) {
        return res.status(400).json({ message: 'נא למלא את כל השדות. גורל הטופס הזה תלוי בך!' });
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d]{8,}$/;
    if (!passwordRegex.test(password)) {
        return res.status(400).json({ message: 'הסיסמה חייבת להיות באורך 8 תווים לפחות, ולשחק אותה מתוחכמת עם אות גדולה, אות קטנה ומספר. בלי זה היא לא נכנסת למסיבה.' });
    }

    try {
        const userExists = await prisma.user.findUnique({ where: { email } });
        if (userExists) {
            return res.status(400).json({ message: 'רגע, רגע... נראה לי שכבר נפגשנו. המייל הזה כבר במערכת. רוצה להתחבר?' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = await prisma.user.create({
            data: {
                name: fullName,
                email,
                password: hashedPassword,
                role: UserRole.ADMIN, // <-- התיקון החשוב
                avatarUrl: '',
            }
        });

        logger.info({
            message: 'זהו, את/ה בפנים! איזה כיף שהצטרפת אלינו. ברוכים הבאים!',
            userId: newUser.id,
            email: newUser.email,
            role: newUser.role,
        });

        sendTokenResponse(newUser, 201, res);
    } catch (error) {
        logger.error({
            message: 'אופס, משהו השתבש בתהליך ההרשמה. בוא/י ננסה שוב.',
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
            logger.info({ message: 'התחברת בהצלחה. הכל מוכן בשבילך.', userId: user.id });
            sendTokenResponse(user, 200, res, projectId);
        } else {
            logger.warn({ message: 'Failed login attempt', email });
            res.status(401).json({ message: 'הפרטים שהזנת אינם תואמים. אולי שכחת את הסיסמה?' });
        }
    } catch (error) {
        logger.error({
            message: 'ההתחברות לא הצליחה. ננסה פעם נוספת?',
            context: { endpoint: req.originalUrl, email },
            error,
        });
        next(error);
    }
};

export const getMe: RequestHandler = async (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ message: 'גישה למורשים בלבד' });
    }
    res.json(req.user);
};

export const logoutUser: RequestHandler = async (req, res, next) => {
    try {
        res.cookie('token', 'none', {
            expires: new Date(Date.now() + 10 * 1000),
            httpOnly: true,
        });
        logger.info({ message: 'התנתקת בהצלחה. נשמח לראות אותך שוב בקרוב!', userId: req.user?.id });
        res.status(200).json({ success: true, data: {} });
    } catch (error) {
        logger.error({ message: 'משהו קטן השתבש וההתנתקות לא הצליחה. אפשר לנסות שוב. אם הבעיה ממשיכה, סגירת הדפדפן תנתק אותך מהמערכת באופן סופי.', error });
        next(error);
    }
};

export const uploadAvatar: RequestHandler = async (req, res, next) => {
    const { image } = req.body;
    const user = req.user;

    if (!user) return res.status(401).json({ message: "גישה למורשים בלבד" });
    if (!image) return res.status(400).json({ message: "קצת ריק פה, בוא/י נוסיף תמונה כדי להשלים את הפרופיל." });

    try {
        const updatedUser = await prisma.user.update({
            where: { id: user.id },
            data: { avatarUrl: image },
        });

        logger.info({ message: 'אהבנו את הלוק החדש! התמונה עודכנה.', userId: user.id });

        const { password, ...userWithoutPassword } = updatedUser;
        res.status(200).json(userWithoutPassword);

    } catch (error) {
        logger.error({ message: 'העלאת התמונה לא הצליחה. כדאי לוודא שהקובץ הוא מסוג JPG או PNG ושהגודל שלו אינו עולה על 5 מגה-בייט.', context: { userId: user.id }, error });
        next(error);
    }
};