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
exports.createTaskInProject = exports.deleteProject = exports.updateProject = exports.getProjectDetails = exports.createProject = exports.getProjects = void 0;
const express_async_handler_1 = __importDefault(require("express-async-handler"));
const db_1 = __importDefault(require("../../db")); // שימוש ב-Prisma client
const client_1 = require("@prisma/client");
const logger_1 = __importDefault(require("../../logger")); // ייבוא הלוגר
const zod_1 = require("zod");
/**
 * @desc    Fetch all projects based on user role and permissions
 * @route   GET /api/projects
 * @access  Private
 */
exports.getProjects = (0, express_async_handler_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    if (!user || !user.activeOrganizationId) {
        res.status(401);
        throw new Error('Not authorized');
    }
    // Base query: always filter by organization and non-deleted projects
    const where = {
        organizationId: user.activeOrganizationId,
        deletedAt: null
    };
    // Role-based filtering (temporary until schema migration)
    const membership = user.memberships.find(m => m.organizationId === user.activeOrganizationId);
    const role = membership === null || membership === void 0 ? void 0 : membership.role;
    if (role === client_1.UserRole.TEAM_LEADER) {
        // Team leaders see projects they are leading
        where.teamLeaders = { some: { id: user.id } };
        logger_1.default.info({ message: 'Filtering projects by team leadership for leader.', userId: user.id });
    }
    else if (role === client_1.UserRole.EMPLOYEE) {
        // Employees see projects where they have assigned tasks
        const tasks = yield db_1.default.task.findMany({
            where: {
                organizationId: user.activeOrganizationId,
                assignees: { some: { id: user.id } }
            },
            select: { projectId: true }
        });
        const projectIds = [...new Set(tasks.map(t => t.projectId))];
        where.id = { in: projectIds.length > 0 ? projectIds : [] };
        logger_1.default.info({ message: 'Filtering projects by assigned tasks for EMPLOYEE.', userId: user.id, projectIdsCount: projectIds.length });
    }
    // Admins see all projects in the organization (default behavior)
    const projects = yield db_1.default.project.findMany({
        where,
        include: {
            teamLeaders: { select: { id: true, name: true, avatarUrl: true } }
        },
        orderBy: { startDate: 'desc' }
    });
    logger_1.default.info({ message: 'Projects fetched successfully.', userId: user.id, projectsCount: projects.length });
    res.json(projects);
}));
const createProjectSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Project name is required'),
    description: zod_1.z.string().min(1, 'Description is required'),
    startDate: zod_1.z.string().min(1, 'Start date is required'),
    endDate: zod_1.z.string().min(1, 'End date is required'),
    budget: zod_1.z.preprocess(val => typeof val === 'string' ? parseFloat(val) : val, zod_1.z.number().min(0, 'Budget must be non-negative')),
    teamId: zod_1.z.string().optional(),
    teamLeaderIds: zod_1.z.array(zod_1.z.string()).optional(),
});
/**
 * @desc    Create a new project with multiple team leaders
 * @route   POST /api/projects
 * @access  Private (Admin or Org Admin)
 */
exports.createProject = (0, express_async_handler_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const parsed = createProjectSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: 'Invalid input', details: parsed.error.errors });
        return;
    }
    const { name, description, startDate, endDate, budget, teamId, teamLeaderIds } = parsed.data;
    const user = req.user;
    if (!user || !user.activeOrganizationId) {
        res.status(401);
        throw new Error('Not authorized');
    }
    // Check if user can create projects (Org Admin or Team Leader)
    const membership = user.memberships.find(m => m.organizationId === user.activeOrganizationId);
    const canCreateProjects = membership && (membership.role === client_1.UserRole.ORG_ADMIN || membership.role === client_1.UserRole.TEAM_LEADER);
    if (!canCreateProjects) {
        res.status(403);
        throw new Error('User is not authorized to create projects');
    }
    // Check subscription limits
    const organization = yield db_1.default.organization.findUnique({
        where: { id: user.activeOrganizationId },
        include: {
            _count: {
                select: {
                    projects: true
                }
            }
        }
    });
    if (!organization) {
        res.status(404);
        throw new Error('Organization not found');
    }
    // Get plan limits
    const planLimits = {
        FREE: 10,
        BUSINESS: 40,
        ENTERPRISE: 400
    };
    const currentLimit = planLimits[organization.planType];
    const currentCount = organization._count.projects;
    if (currentCount >= currentLimit) {
        res.status(402);
        throw new Error(`You have reached the project limit (${currentLimit}) for your current plan. Please upgrade to create more projects.`);
    }
    // Validate required fields
    if (!name || !startDate || !endDate || budget === undefined || budget === null) {
        res.status(400);
        throw new Error('Name, start date, end date, and budget are required');
    }
    // Validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (start >= end) {
        res.status(400);
        throw new Error('End date must be after start date');
    }
    // Validate budget
    if (budget <= 0) {
        res.status(400);
        throw new Error('Budget must be greater than 0');
    }
    // Get team leaders
    const teamLeaders = teamLeaderIds ? yield db_1.default.user.findMany({
        where: { id: { in: teamLeaderIds } }
    }) : [];
    logger_1.default.info({ message: 'Creating new project', projectName: name, organizationId: user.activeOrganizationId, userId: user.id });
    const project = yield db_1.default.project.create({
        data: {
            name,
            description,
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            budget, // already a number from zod
            organizationId: user.activeOrganizationId,
            teamId: teamId || null,
            teamLeaders: {
                connect: teamLeaders.map(leader => ({ id: leader.id }))
            }
        },
        include: {
            teamLeaders: true,
            team: true
        }
    });
    logger_1.default.info({ message: 'Project created successfully', projectId: project.id });
    res.status(201).json(project);
}));
/**
 * @desc    Get a single project's details
 * @route   GET /api/projects/:projectId
 * @access  Private
 */
exports.getProjectDetails = (0, express_async_handler_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { projectId } = req.params;
    const user = req.user;
    if (!user || !user.activeOrganizationId) {
        res.status(401);
        throw new Error('Not authorized');
    }
    const project = yield db_1.default.project.findFirst({
        where: {
            id: projectId,
            organizationId: user.activeOrganizationId,
            deletedAt: null
        },
        include: {
            tasks: true,
            teamLeaders: { select: { id: true, name: true, email: true, avatarUrl: true } }
        }
    });
    if (!project) {
        logger_1.default.warn({ message: 'Project details fetch failed: Project not found or deleted.', projectId, userId: user.id });
        res.status(404);
        throw new Error('Project not found');
    }
    res.json(project);
}));
/**
 * @desc    Update a project
 * @route   PUT /api/projects/:projectId
 * @access  Private (Admin or Team Leader of the project)
 */
exports.updateProject = (0, express_async_handler_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { projectId } = req.params;
    const user = req.user;
    if (!user || !user.activeOrganizationId) {
        res.status(401);
        throw new Error('Not authorized');
    }
    const project = yield db_1.default.project.findFirst({
        where: { id: projectId, organizationId: user.activeOrganizationId },
        include: { teamLeaders: { select: { id: true } } }
    });
    if (!project) {
        res.status(404);
        throw new Error('Project not found.');
    }
    const isTeamLeader = project.teamLeaders.some(leader => leader.id === user.id);
    const membership = user.memberships.find(m => m.organizationId === user.activeOrganizationId);
    const canUpdateProject = (membership && (membership.role === client_1.UserRole.ORG_ADMIN || membership.role === client_1.UserRole.TEAM_LEADER)) || isTeamLeader;
    if (!canUpdateProject) {
        res.status(403);
        throw new Error('User is not authorized to update this project.');
    }
    const updatedProject = yield db_1.default.project.update({
        where: { id: projectId },
        data: req.body
    });
    logger_1.default.info({ message: 'Project updated successfully.', projectId: updatedProject.id, userId: user.id });
    res.json(updatedProject);
}));
/**
 * @desc    Delete (soft delete) a project
 * @route   DELETE /api/projects/:projectId
 * @access  Private (Admin or Team Leader of the project)
 */
exports.deleteProject = (0, express_async_handler_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { projectId } = req.params;
    const user = req.user;
    if (!user || !user.activeOrganizationId) {
        res.status(401);
        throw new Error('Not authorized');
    }
    const project = yield db_1.default.project.findFirst({
        where: { id: projectId, organizationId: user.activeOrganizationId },
        include: { teamLeaders: { select: { id: true } } }
    });
    if (!project) {
        res.status(404);
        throw new Error('Project not found.');
    }
    const isTeamLeader = project.teamLeaders.some(leader => leader.id === user.id);
    const membership = user.memberships.find(m => m.organizationId === user.activeOrganizationId);
    const canDeleteProject = (membership && (membership.role === client_1.UserRole.ORG_ADMIN || membership.role === client_1.UserRole.TEAM_LEADER)) || isTeamLeader;
    if (!canDeleteProject) {
        res.status(403);
        throw new Error('User is not authorized to delete this project.');
    }
    yield db_1.default.project.update({
        where: { id: projectId },
        data: { deletedAt: new Date(), status: 'archived' }
    });
    logger_1.default.info({ message: 'Project archived successfully.', projectId, userId: user.id });
    res.status(204).send();
}));
/**
 * @desc    Create a task within a project
 * @route   POST /api/projects/:projectId/tasks
 * @access  Private
 */
exports.createTaskInProject = (0, express_async_handler_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { projectId } = req.params;
    const { title, description, startDate, endDate, assigneeIds, columnId } = req.body;
    const user = req.user;
    if (!user || !user.activeOrganizationId) {
        res.status(401);
        throw new Error('Not authorized');
    }
    if (!title || !startDate || !endDate || !columnId) {
        res.status(400);
        throw new Error('Missing required fields for task creation.');
    }
    const project = yield db_1.default.project.findFirst({
        where: { id: projectId, organizationId: user.activeOrganizationId, deletedAt: null }
    });
    if (!project) {
        res.status(404);
        throw new Error("Project not found or is archived.");
    }
    // *** התיקון מתחיל כאן ***
    // 1. יוצרים את המשימה ומבקשים מפורשות לקבל בחזרה את רשימת המשויכים
    const createdTask = yield db_1.default.task.create({
        data: {
            title,
            description: description || '', // מוודאים שהתיאור הוא תמיד מחרוזת
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            projectId,
            organizationId: user.activeOrganizationId,
            columnId,
            assignees: {
                connect: assigneeIds ? assigneeIds.map((id) => ({ id })) : [],
            },
        },
        include: {
            assignees: true,
        },
    });
    // 2. בונים אובייקט תגובה עקבי שדומה לאובייקטים שהאפליקציה כבר מכירה
    const newTask = Object.assign(Object.assign({}, createdTask), { assigneeIds: createdTask.assignees.map(a => a.id), comments: [] // משימה חדשה תמיד מתחילה ללא תגובות
     });
    // מסירים את השדה 'assignees' המלא כי האפליקציה משתמשת רק ב-assigneeIds
    delete newTask.assignees;
    logger_1.default.info({ message: 'Task created successfully in project.', taskId: newTask.id, projectId, userId: user.id });
    res.status(201).json(newTask);
}));
