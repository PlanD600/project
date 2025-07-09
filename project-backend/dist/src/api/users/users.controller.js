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
exports.deleteUser = exports.updateUser = exports.getUnassignedUsers = exports.getAllUsers = exports.createUser = void 0;
const db_1 = __importDefault(require("../../db"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const logger_1 = __importDefault(require("../../logger"));
const client_1 = require("@prisma/client");
const zod_1 = require("zod");
const createUserSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Name is required'),
    email: zod_1.z.string().email('Invalid email'),
    role: zod_1.z.string().min(1, 'Role is required'),
    teamId: zod_1.z.string().optional(),
    projectId: zod_1.z.string().optional(),
});
const updateUserSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Name is required').optional(),
    email: zod_1.z.string().email('Invalid email').optional(),
    role: zod_1.z.string().min(1, 'Role is required').optional(),
    teamId: zod_1.z.string().optional(),
});
const createUser = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { name, email, role, teamId, projectId } = req.body;
    const adminUser = req.user;
    if (!adminUser || !adminUser.activeOrganizationId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    const parsed = createUserSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: 'Invalid input', details: parsed.error.errors });
        return;
    }
    const { name: parsedName, email: parsedEmail, role: parsedRole, teamId: parsedTeamId, projectId: parsedProjectId } = parsed.data;
    if (!parsedName || !parsedEmail || !parsedRole) {
        logger_1.default.warn({ message: 'User creation failed: Missing required fields.', context: { adminUserId: adminUser.id, body: req.body } });
        return res.status(400).json({ message: 'Please provide name, email, and role' });
    }
    // כלל #2: שימוש ב-enum
    if (parsedRole === client_1.UserRole.GUEST && !parsedProjectId) {
        logger_1.default.warn({ message: 'Guest user creation failed: Missing projectId for guest.', context: { adminUserId: adminUser.id, email } });
        return res.status(400).json({ message: 'Guests must be associated with a project.' });
    }
    try {
        logger_1.default.info({ message: 'Attempting to create user by admin.', email, role, teamId, adminUserId: adminUser.id, orgId: adminUser.activeOrganizationId });
        const userExists = yield db_1.default.user.findFirst({
            where: {
                email,
                memberships: { some: { organizationId: adminUser.activeOrganizationId } }
            }
        });
        if (userExists) {
            logger_1.default.warn({ message: 'User creation failed: User with this email already exists in this organization.', email, adminUserId: adminUser.id });
            return res.status(400).json({ message: 'User with this email already exists' });
        }
        // כלל #1: אם משייכים לצוות, ודא שהצוות שייך לארגון
        if (parsedTeamId) {
            const teamExists = yield db_1.default.team.findFirst({
                where: { id: parsedTeamId, organizationId: adminUser.activeOrganizationId }
            });
            if (!teamExists) {
                logger_1.default.warn({ message: 'User creation failed: Team not found in organization.', teamId, adminUserId: adminUser.id });
                return res.status(400).json({ message: 'Team not found.' });
            }
        }
        const tempPassword = Math.random().toString(36).slice(-8);
        const salt = yield bcrypt_1.default.genSalt(10);
        const hashedPassword = yield bcrypt_1.default.hash(tempPassword, salt);
        const newUser = yield db_1.default.user.create({
            data: {
                name,
                email,
                password: hashedPassword,
                teamId: teamId || null,
                avatarUrl: '',
                memberships: {
                    create: {
                        organizationId: adminUser.activeOrganizationId,
                        role: role,
                    },
                },
            },
            select: { id: true, name: true, email: true, teamId: true, avatarUrl: true }
        });
        logger_1.default.info({ message: 'User created by admin successfully.', newUserId: newUser.id, email: newUser.email, orgId: adminUser.activeOrganizationId, adminUserId: adminUser.id });
        res.status(201).json(newUser);
    }
    catch (error) {
        logger_1.default.error({ message: 'Failed to create user by admin.', context: { body: req.body, adminUserId: adminUser.id }, error });
        next(error);
    }
});
exports.createUser = createUser;
const getAllUsers = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    if (!user || !user.activeOrganizationId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    try {
        logger_1.default.info({ message: 'Attempting to get all users.', userId: user.id, orgId: user.activeOrganizationId });
        const users = yield db_1.default.user.findMany({
            // כלל #1: הצג רק משתמשים מהארגון של המשתמש המחובר
            where: {
                memberships: { some: { organizationId: user.activeOrganizationId } }
            },
            select: { id: true, name: true, email: true, teamId: true, avatarUrl: true },
            orderBy: { name: 'asc' }
        });
        logger_1.default.info({ message: 'All users fetched successfully.', usersCount: users.length, userId: user.id });
        res.json(users);
    }
    catch (error) {
        logger_1.default.error({ message: 'Failed to get all users.', context: { userId: user.id }, error });
        next(error);
    }
});
exports.getAllUsers = getAllUsers;
const getUnassignedUsers = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    if (!user || !user.activeOrganizationId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    try {
        logger_1.default.info({ message: 'Attempting to get unassigned users.', userId: user.id, orgId: user.activeOrganizationId });
        const users = yield db_1.default.user.findMany({
            where: {
                memberships: { some: { organizationId: user.activeOrganizationId, role: client_1.UserRole.EMPLOYEE } }
            },
            select: { id: true, name: true, email: true },
            orderBy: { name: 'asc' }
        });
        logger_1.default.info({ message: 'Unassigned users fetched successfully.', unassignedUsersCount: users.length, userId: user.id });
        res.json(users);
    }
    catch (error) {
        logger_1.default.error({ message: 'Failed to get unassigned users.', context: { userId: user.id }, error });
        next(error);
    }
});
exports.getUnassignedUsers = getUnassignedUsers;
const updateUser = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { userId } = req.params;
    const { name, email, role, teamId } = req.body;
    const adminUser = req.user;
    if (!adminUser || !adminUser.activeOrganizationId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    const parsedUpdate = updateUserSchema.safeParse(req.body);
    if (!parsedUpdate.success) {
        res.status(400).json({ error: 'Invalid input', details: parsedUpdate.error.errors });
        return;
    }
    const { name: updateName, email: updateEmail, role: updateRole, teamId: updateTeamId } = parsedUpdate.data;
    if (!updateName || !updateEmail || !updateRole) {
        logger_1.default.warn({ message: 'User update failed: Missing required fields.', context: { userId, adminUserId: adminUser.id, body: req.body } });
        return res.status(400).json({ message: 'Name, email, and role are required' });
    }
    try {
        logger_1.default.info({ message: 'Attempting to update user.', userId, adminUserId: adminUser.id });
        // "כלל הזהב": שימוש ב-updateMany עם where כפול מבטיח שאתה מעדכן רק משתמש בארגון שלך
        const updateResult = yield db_1.default.user.updateMany({
            where: { id: userId, memberships: { some: { organizationId: adminUser.activeOrganizationId } } },
            data: { name, email, teamId: teamId || null },
        });
        if (updateResult.count === 0) {
            logger_1.default.warn({ message: 'User update failed: User not found in organization.', userId, adminUserId: adminUser.id });
            return res.status(404).json({ message: 'User not found' });
        }
        const updatedUser = yield db_1.default.user.findUnique({
            where: { id: userId },
            select: { id: true, name: true, email: true, teamId: true, avatarUrl: true }
        });
        logger_1.default.info({ message: 'User updated successfully.', updatedUserId: userId, adminUserId: adminUser.id });
        res.json(updatedUser);
    }
    catch (error) {
        logger_1.default.error({ message: 'Failed to update user.', context: { userId, body: req.body, adminUserId: adminUser.id }, error });
        next(error);
    }
});
exports.updateUser = updateUser;
const deleteUser = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { userId } = req.params;
    const adminUser = req.user;
    if (!adminUser || !adminUser.activeOrganizationId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    if (userId === adminUser.id) {
        logger_1.default.warn({ message: 'User deletion failed: Admin tried to delete self.', userId, adminUserId: adminUser.id });
        return res.status(400).json({ message: 'Admins cannot delete their own account.' });
    }
    try {
        logger_1.default.info({ message: 'Attempting to delete user.', userId, adminUserId: adminUser.id });
        // "כלל הזהב": שימוש ב-deleteMany עם where כפול מבטיח מחיקה רק בתוך הארגון
        const deleteResult = yield db_1.default.user.deleteMany({
            where: { id: userId, memberships: { some: { organizationId: adminUser.activeOrganizationId } } }
        });
        if (deleteResult.count === 0) {
            logger_1.default.warn({ message: 'User deletion failed: User not found in organization.', userId, adminUserId: adminUser.id });
            return res.status(404).json({ message: 'User not found' });
        }
        logger_1.default.info({ message: 'User permanently deleted successfully.', deletedUserId: userId, adminUserId: adminUser.id });
        res.status(204).send();
    }
    catch (error) {
        if (error.code === 'P2003') {
            logger_1.default.error({ message: 'Cannot delete user: User is linked to other records.', context: { userId, adminUserId: adminUser.id }, error });
            return res.status(400).json({ message: 'Cannot delete user. This user is associated with existing projects or tasks.' });
        }
        logger_1.default.error({ message: 'Failed to delete user.', context: { userId, adminUserId: adminUser.id }, error });
        next(error);
    }
});
exports.deleteUser = deleteUser;
