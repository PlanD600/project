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
exports.getProjectGuests = exports.revokeGuest = exports.inviteGuest = void 0;
const express_async_handler_1 = __importDefault(require("express-async-handler"));
const db_1 = __importDefault(require("../../db"));
const logger_1 = __importDefault(require("../../logger"));
const client_1 = require("@prisma/client");
const zod_1 = require("zod");
const inviteGuestSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email'),
    projectId: zod_1.z.string().min(1, 'Project ID is required'),
});
// @desc    Invite guest to specific project
// @route   POST /api/guests/invite
// @access  Private (Org Admin, Super Admin, or Team Leader of the project)
exports.inviteGuest = (0, express_async_handler_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const parsed = inviteGuestSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: 'Invalid input', details: parsed.error.errors });
        return;
    }
    const { email, projectId } = parsed.data;
    const user = req.user;
    if (!user || !user.activeOrganizationId) {
        res.status(401);
        throw new Error('Not authorized');
    }
    if (!email || !projectId) {
        res.status(400);
        throw new Error('Email and project ID are required');
    }
    // Check if user can invite guests (Org Admin, Super Admin, or Team Leader of the project)
    const membership = user.memberships.find(m => m.organizationId === user.activeOrganizationId);
    const role = membership === null || membership === void 0 ? void 0 : membership.role;
    const canInviteGuests = role && [client_1.UserRole.ORG_ADMIN, client_1.UserRole.SUPER_ADMIN, client_1.UserRole.TEAM_LEADER].includes(role);
    if (!canInviteGuests) {
        res.status(403);
        throw new Error('User is not authorized to invite guests');
    }
    // Verify the project exists and belongs to the active organization
    const project = yield db_1.default.project.findFirst({
        where: {
            id: projectId,
            organizationId: user.activeOrganizationId
        },
        include: {
            teamLeaders: true
        }
    });
    if (!project) {
        res.status(404);
        throw new Error('Project not found');
    }
    // Additional check for Team Leaders - they can only invite to their own projects
    if (role === client_1.UserRole.TEAM_LEADER && !project.teamLeaders.some(leader => leader.id === user.id)) {
        res.status(403);
        throw new Error('Team leaders can only invite guests to their own projects');
    }
    // Find or create guest user
    let guestUser = yield db_1.default.user.findUnique({
        where: { email }
    });
    if (!guestUser) {
        // Create new guest user
        const tempPassword = Math.random().toString(36).slice(-8);
        guestUser = yield db_1.default.user.create({
            data: {
                email,
                name: email.split('@')[0], // Use email prefix as name
                password: tempPassword, // In production, hash this password
            }
        });
    }
    else {
        // Check if user is already a guest for this project
        const existingGuestTask = yield db_1.default.task.findFirst({
            where: {
                projectId: projectId,
                assignees: {
                    some: {
                        id: guestUser.id
                    }
                }
            }
        });
        if (existingGuestTask) {
            res.status(400);
            throw new Error('User is already a guest for this project');
        }
    }
    // Create a special task for the guest to access the project
    const guestTask = yield db_1.default.task.create({
        data: {
            title: `Guest Access - ${project.name}`,
            description: `Guest access task for ${email}`,
            startDate: new Date(),
            endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
            columnId: 'guest-access',
            projectId: projectId,
            organizationId: user.activeOrganizationId,
            assignees: {
                connect: [{ id: guestUser.id }]
            }
        },
        include: {
            assignees: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                    avatarUrl: true
                }
            }
        }
    });
    logger_1.default.info({
        message: 'Guest invited to project.',
        guestEmail: email,
        projectId: projectId,
        invitedBy: user.id,
        guestUserId: guestUser.id
    });
    // In production, send SMS invitation here
    // For now, just return the guest user info
    res.status(201).json({
        id: guestUser.id,
        name: guestUser.name,
        email: guestUser.email,
        avatarUrl: guestUser.avatarUrl,
        projectId: projectId,
        message: 'Guest invitation created successfully. SMS invitation will be sent.'
    });
}));
// @desc    Revoke guest access from project
// @route   DELETE /api/guests/:guestId/project/:projectId
// @access  Private (Org Admin, Super Admin, or Team Leader of the project)
exports.revokeGuest = (0, express_async_handler_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { guestId, projectId } = req.params;
    const user = req.user;
    if (!user || !user.activeOrganizationId) {
        res.status(401);
        throw new Error('Not authorized');
    }
    // Check if user can revoke guest access
    const membership = user.memberships.find(m => m.organizationId === user.activeOrganizationId);
    const role = membership === null || membership === void 0 ? void 0 : membership.role;
    const canRevokeGuests = role && [client_1.UserRole.ORG_ADMIN, client_1.UserRole.SUPER_ADMIN, client_1.UserRole.TEAM_LEADER].includes(role);
    if (!canRevokeGuests) {
        res.status(403);
        throw new Error('User is not authorized to revoke guest access');
    }
    // Verify the project exists and belongs to the active organization
    const project = yield db_1.default.project.findFirst({
        where: {
            id: projectId,
            organizationId: user.activeOrganizationId
        },
        include: {
            teamLeaders: true
        }
    });
    if (!project) {
        res.status(404);
        throw new Error('Project not found');
    }
    // Additional check for Team Leaders - they can only revoke from their own projects
    if (role === client_1.UserRole.TEAM_LEADER && !project.teamLeaders.some(leader => leader.id === user.id)) {
        res.status(403);
        throw new Error('Team leaders can only revoke guests from their own projects');
    }
    // Find and delete the guest task
    const guestTask = yield db_1.default.task.findFirst({
        where: {
            projectId: projectId,
            assignees: {
                some: {
                    id: guestId
                }
            },
            title: {
                startsWith: 'Guest Access -'
            }
        }
    });
    if (!guestTask) {
        res.status(404);
        throw new Error('Guest access not found for this project');
    }
    // Delete the guest task
    yield db_1.default.task.delete({
        where: {
            id: guestTask.id
        }
    });
    logger_1.default.info({
        message: 'Guest access revoked from project.',
        guestId: guestId,
        projectId: projectId,
        revokedBy: user.id
    });
    res.status(200).json({ message: 'Guest access revoked successfully' });
}));
// @desc    Get all guests for a project
// @route   GET /api/guests/project/:projectId
// @access  Private (Org Admin, Super Admin, or Team Leader of the project)
exports.getProjectGuests = (0, express_async_handler_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { projectId } = req.params;
    const user = req.user;
    if (!user || !user.activeOrganizationId) {
        res.status(401);
        throw new Error('Not authorized');
    }
    // Check if user can view project guests
    const membership = user.memberships.find(m => m.organizationId === user.activeOrganizationId);
    const role = membership === null || membership === void 0 ? void 0 : membership.role;
    const canViewGuests = role && [client_1.UserRole.ORG_ADMIN, client_1.UserRole.SUPER_ADMIN, client_1.UserRole.TEAM_LEADER].includes(role);
    if (!canViewGuests) {
        res.status(403);
        throw new Error('User is not authorized to view project guests');
    }
    // Verify the project exists and belongs to the active organization
    const project = yield db_1.default.project.findFirst({
        where: {
            id: projectId,
            organizationId: user.activeOrganizationId
        },
        include: {
            teamLeaders: true
        }
    });
    if (!project) {
        res.status(404);
        throw new Error('Project not found');
    }
    // Additional check for Team Leaders - they can only view guests of their own projects
    if (role === client_1.UserRole.TEAM_LEADER && !project.teamLeaders.some(leader => leader.id === user.id)) {
        res.status(403);
        throw new Error('Team leaders can only view guests of their own projects');
    }
    // Find all guest tasks for this project
    const guestTasks = yield db_1.default.task.findMany({
        where: {
            projectId: projectId,
            title: {
                startsWith: 'Guest Access -'
            }
        },
        include: {
            assignees: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                    avatarUrl: true
                }
            }
        }
    });
    // Extract guest users from the tasks
    const guests = guestTasks.map(task => task.assignees[0]).filter(Boolean);
    logger_1.default.info({
        message: 'Project guests retrieved.',
        projectId: projectId,
        guestCount: guests.length,
        retrievedBy: user.id
    });
    res.status(200).json(guests);
}));
