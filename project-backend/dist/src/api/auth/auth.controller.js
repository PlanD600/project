"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetPassword = exports.forgotPassword = exports.uploadAvatar = exports.logoutUser = exports.getMe = exports.loginUser = exports.registerUser = void 0;
const express_async_handler_1 = __importDefault(require("express-async-handler"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const crypto_1 = __importDefault(require("crypto"));
const db_1 = __importDefault(require("../../db"));
const logger_1 = __importDefault(require("../../logger"));
const zod_1 = require("zod");
/**
 * פונקציית עזר ליצירת טוקן (JWT) עבור ID של משתמש.
 * @param userId ה-ID של המשתמש שעבורו יש ליצור טוקן.
 * @returns הטוקן (JWT) שנוצר.
 */
const generateToken = (userId) => {
    if (!process.env.JWT_SECRET) {
        logger_1.default.error('FATAL: JWT_SECRET is not defined. Cannot generate token.');
        throw new Error('Server configuration error: JWT secret is missing.');
    }
    return jsonwebtoken_1.default.sign({ id: userId }, process.env.JWT_SECRET, {
        expiresIn: '30d', // תוקף הטוקן: 30 יום
    });
};
// Registration input schema
const registrationSchema = zod_1.z.object({
    fullName: zod_1.z.string().min(1, 'Full name is required'),
    email: zod_1.z.string().email('Invalid email'),
    password: zod_1.z.string().min(8, 'Password must be at least 8 characters'),
    companyName: zod_1.z.string().min(1, 'Company name is required'),
});
/**
 * @desc    הרשמת משתמש וארגון חדשים
 * @route   POST /api/auth/register
 * @access  Public
 */
exports.registerUser = (0, express_async_handler_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    // [DEBUG] 1. Registration process started. Request body:
    console.log('[DEBUG] 1. Registration process started. Request body:', req.body);
    // Validate input
    const parsed = registrationSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: 'Invalid input', details: parsed.error.errors });
        return;
    }
    const { fullName: name, email, password, companyName: organizationName } = parsed.data;
    logger_1.default.info('Registration request received', { name, email, organizationName });
    if (!name || !email || !password || !organizationName) {
        logger_1.default.warn('Missing required registration fields', { name, email, organizationName });
        res.status(400);
        throw new Error('נא למלא את כל השדות הנדרשים להרשמה.');
    }
    const userExists = yield db_1.default.user.findUnique({ where: { email: email.toLowerCase() } });
    if (userExists) {
        logger_1.default.warn('User already exists', { email });
        res.status(400);
        throw new Error('משתמש עם כתובת אימייל זו כבר קיים.');
    }
    const salt = yield bcrypt_1.default.genSalt(10);
    const hashedPassword = yield bcrypt_1.default.hash(password, salt);
    try {
        const result = yield db_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
            var _a;
            // [DEBUG] 4. Data for creating organization:
            const organizationDataObject = { name: organizationName };
            console.log('[DEBUG] 4. Data for creating organization:', organizationDataObject);
            // 1. Create organization
            const newOrganization = yield tx.organization.create({
                data: organizationDataObject
            });
            // [DEBUG] 5. New organization created:
            console.log('[DEBUG] 5. New organization created:', newOrganization);
            logger_1.default.info('Organization created', { orgId: newOrganization.id });
            // [DEBUG] 2. Data for creating user:
            const userDataObject = {
                name,
                email: email.toLowerCase(),
                password: hashedPassword,
            };
            console.log('[DEBUG] 2. Data for creating user:', userDataObject);
            // 2. Create user (without activeOrganizationId)
            const newUser = yield tx.user.create({
                data: userDataObject
            });
            // [DEBUG] 3. New user created:
            console.log('[DEBUG] 3. New user created:', newUser);
            // 3. Create membership
            const membership = yield tx.membership.create({
                data: {
                    userId: newUser.id,
                    organizationId: newOrganization.id,
                    role: 'ORG_ADMIN',
                },
            });
            logger_1.default.info('Membership created', { membershipId: membership.id });
            // [DEBUG] 6. Data for updating user with active org:
            console.log('[DEBUG] 6. Data for updating user with active org:', { where: { id: newUser.id }, data: { activeOrganizationId: newOrganization.id } });
            // 4. Update user to set activeOrganizationId
            const updatedUser = yield tx.user.update({
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
            logger_1.default.info('User updated with activeOrganizationId', { userId: updatedUser.id, activeOrganizationId: (_a = updatedUser.activeOrganization) === null || _a === void 0 ? void 0 : _a.id });
            return { user: updatedUser, organization: newOrganization, membership };
        }));
        if (result.user && result.organization && result.membership) {
            logger_1.default.info('Registration transaction successful', {
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
                activeOrganizationId: (_a = result.user.activeOrganization) === null || _a === void 0 ? void 0 : _a.id,
            };
            res.status(201).json({
                user: userResponse,
                organization: result.organization, // <-- add this
                token: token
            });
        }
        else {
            logger_1.default.error('Registration transaction did not return all expected entities');
            res.status(500);
            throw new Error('יצירת המשתמש נכשלה.');
        }
    }
    catch (error) {
        logger_1.default.error('Registration transaction failed', { error });
        res.status(500);
        throw new Error('שגיאה ביצירת משתמש וארגון: ' + error.message);
    }
}));
const loginSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email'),
    password: zod_1.z.string().min(8, 'Password must be at least 8 characters'),
});
/**
 * @desc    אימות משתמש וקבלת טוקן
 * @route   POST /api/auth/login
 * @access  Public
 */
exports.loginUser = (0, express_async_handler_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
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
    const user = yield db_1.default.user.findUnique({
        where: { email: email.toLowerCase() },
    });
    if (user && (yield bcrypt_1.default.compare(password, user.password))) {
        logger_1.default.info(`התחברות מוצלחת למשתמש.`, { userId: user.id });
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
    }
    else {
        res.status(401);
        throw new Error('אימייל או סיסמה שגויים.');
    }
}));
/**
 * @desc    קבלת פרטי המשתמש המחובר
 * @route   GET /api/auth/me
 * @access  Private
 */
exports.getMe = (0, express_async_handler_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    if (!req.user) {
        res.status(404);
        throw new Error('המשתמש לא נמצא.');
    }
    res.status(200).json(req.user);
}));
/**
 * @desc    התנתקות המשתמש
 * @route   POST /api/auth/logout
 * @access  Private
 */
exports.logoutUser = (0, express_async_handler_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    logger_1.default.info('התנתקות משתמש בוצעה.', { userId: (_a = req.user) === null || _a === void 0 ? void 0 : _a.id });
    res.status(200).json({ message: 'התנתקת בהצלחה.' });
}));
/**
 * @desc    העלאת תמונת פרופיל למשתמש
 * @route   POST /api/auth/me/avatar
 * @access  Private
 */
exports.uploadAvatar = (0, express_async_handler_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { image } = req.body;
    if (!req.user) {
        res.status(401);
        throw new Error('אינך מורשה לבצע פעולה זו.');
    }
    const updatedUser = yield db_1.default.user.update({
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
}));
/**
 * @desc    בקשת קישור לאיפוס סיסמה
 * @route   POST /api/auth/forgotpassword
 * @access  Public
 */
exports.forgotPassword = (0, express_async_handler_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { email } = req.body;
    if (!email) {
        res.status(400);
        throw new Error('נא לספק כתובת אימייל.');
    }
    const user = yield db_1.default.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user) {
        logger_1.default.warn(`Password reset requested for non-existent email: ${email}`);
        // אנו שולחים תגובה זהה כדי לא לחשוף אם משתמש קיים או לא
        res.status(200).json({ message: 'אם קיים משתמש עם כתובת מייל זו, נשלח אליו קישור לאיפוס סיסמה.' });
        return;
    }
    const resetToken = crypto_1.default.randomBytes(32).toString('hex');
    const passwordResetToken = crypto_1.default.createHash('sha256').update(resetToken).digest('hex');
    const passwordResetExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 דקות תוקף
    yield db_1.default.user.update({
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
}));
/**
 * @desc    איפוס סיסמה באמצעות טוקן
 * @route   PATCH /api/auth/resetpassword
 * @access  Public
 */
exports.resetPassword = (0, express_async_handler_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { token, password } = req.body;
    if (!token || !password) {
        res.status(400);
        throw new Error("Token and new password are required.");
    }
    const hashedToken = crypto_1.default.createHash('sha256').update(token).digest('hex');
    const user = yield db_1.default.user.findFirst({
        where: {
            passwordResetToken: hashedToken,
            passwordResetExpires: { gt: new Date() },
        },
    });
    if (!user) {
        res.status(400);
        throw new Error('הטוקן אינו תקין או שפג תוקפו.');
    }
    const salt = yield bcrypt_1.default.genSalt(10);
    const hashedPassword = yield bcrypt_1.default.hash(password, salt);
    yield db_1.default.user.update({
        where: { id: user.id },
        data: {
            password: hashedPassword,
            passwordResetToken: null,
            passwordResetExpires: null,
        },
    });
    logger_1.default.info(`סיסמה אופסה בהצלחה עבור משתמש: ${user.email}`);
    res.status(200).json({ message: 'הסיסמה אופסה בהצלחה.' });
}));
