import { Request, Response, NextFunction, RequestHandler } from 'express';
import asyncHandler from 'express-async-handler';
import db from '../../db'; // שימוש ב-Prisma client
import { Prisma, UserRole } from '@prisma/client';
import logger from '../../logger'; // ייבוא הלוגר

/**
 * @desc    Fetch all projects based on user role and permissions
 * @route   GET /api/projects
 * @access  Private
 */
export const getProjects = asyncHandler(async (req, res) => {
    const user = req.user;
    if (!user || !user.organizationId) {
        res.status(401);
        throw new Error('Not authorized');
    }

    // Base query: always filter by organization and non-deleted projects
    const where: Prisma.ProjectWhereInput = {
        organizationId: user.organizationId,
        deletedAt: null
    };

    // Role-based filtering
    if (user.role === UserRole.TEAM_MANAGER) {
        // Team managers see projects they are leading
        where.teamLeaders = { some: { id: user.id } };
        logger.info({ message: 'Filtering projects by team leadership for manager.', userId: user.id });
    } else if (user.role === UserRole.EMPLOYEE) {
        // Employees see projects where they have assigned tasks
        const tasks = await db.task.findMany({
            where: {
                organizationId: user.organizationId,
                assignees: { some: { id: user.id } }
            },
            select: { projectId: true }
        });
        const projectIds = [...new Set(tasks.map(t => t.projectId))];
        where.id = { in: projectIds.length > 0 ? projectIds : [] }; // Return empty if no projects
        logger.info({ message: 'Filtering projects by assigned tasks for EMPLOYEE.', userId: user.id, projectIdsCount: projectIds.length });
    }
    // Admins see all projects in the organization (default behavior)

    const projects = await db.project.findMany({
        where,
        include: {
            teamLeaders: { select: { id: true, name: true, avatarUrl: true } }
        },
        orderBy: { startDate: 'desc' }
    });

    logger.info({ message: 'Projects fetched successfully.', userId: user.id, projectsCount: projects.length });
    res.json(projects);
});

/**
 * @desc    Create a new project with multiple team leaders
 * @route   POST /api/projects
 * @access  Private (Admin)
 */
export const createProject = asyncHandler(async (req, res) => {
    const { name, description, client, startDate, endDate, budget, teamLeaderIds = [] } = req.body;
    const creatorId = req.user?.id;
    const organizationId = req.user?.organizationId;

    if (!creatorId || !organizationId) {
        res.status(403);
        throw new Error('User is not authorized or not part of an organization.');
    }

    if (!name) {
        res.status(400);
        throw new Error('Project name is required.');
    }

    // Ensure the creator is always a team leader and handle duplicates
    const finalTeamLeaderIds = [...new Set([creatorId, ...teamLeaderIds])];

    const newProject = await db.project.create({
        data: {
            name,
            description,
            startDate: startDate ? new Date(startDate) : new Date(),
            endDate: endDate ? new Date(endDate) : new Date(),
            budget: budget ? parseFloat(budget) : 0,
            organization: {
                connect: { id: organizationId },
            },
            teamLeaders: {
                connect: finalTeamLeaderIds.map(id => ({ id })),
            },
        },
        include: {
            teamLeaders: { select: { id: true, name: true, email: true } }
        }
    });

    logger.info(`New project created: "${newProject.name}" by user ${creatorId}`);
    res.status(201).json(newProject);
});

/**
 * @desc    Get a single project's details
 * @route   GET /api/projects/:projectId
 * @access  Private
 */
export const getProjectDetails = asyncHandler(async (req, res) => {
    const { projectId } = req.params;
    const user = req.user;

    if (!user || !user.organizationId) {
        res.status(401);
        throw new Error('Not authorized');
    }

    const project = await db.project.findFirst({
        where: {
            id: projectId,
            organizationId: user.organizationId,
            deletedAt: null
        },
        include: {
            tasks: true,
            teamLeaders: { select: { id: true, name: true, email: true, avatarUrl: true } }
        }
    });

    if (!project) {
        logger.warn({ message: 'Project details fetch failed: Project not found or deleted.', projectId, userId: user.id });
        res.status(404);
        throw new Error('Project not found');
    }

    res.json(project);
});


/**
 * @desc    Update a project
 * @route   PUT /api/projects/:projectId
 * @access  Private (Admin or Team Leader of the project)
 */
export const updateProject = asyncHandler(async (req, res) => {
    const { projectId } = req.params;
    const user = req.user;

    if (!user || !user.organizationId) {
        res.status(401);
        throw new Error('Not authorized');
    }

    const project = await db.project.findFirst({
        where: { id: projectId, organizationId: user.organizationId },
        include: { teamLeaders: { select: { id: true } } }
    });

    if (!project) {
        res.status(404);
        throw new Error('Project not found.');
    }

    const isTeamLeader = project.teamLeaders.some(leader => leader.id === user.id);
    if (user.role !== 'ADMIN' && !isTeamLeader) {
        res.status(403);
        throw new Error('User is not authorized to update this project.');
    }

    const updatedProject = await db.project.update({
        where: { id: projectId },
        data: req.body
    });

    logger.info({ message: 'Project updated successfully.', projectId: updatedProject.id, userId: user.id });
    res.json(updatedProject);
});

/**
 * @desc    Delete (soft delete) a project
 * @route   DELETE /api/projects/:projectId
 * @access  Private (Admin or Team Leader of the project)
 */
export const deleteProject = asyncHandler(async (req, res) => {
    const { projectId } = req.params;
    const user = req.user;

    if (!user || !user.organizationId) {
        res.status(401);
        throw new Error('Not authorized');
    }

    const project = await db.project.findFirst({
        where: { id: projectId, organizationId: user.organizationId },
        include: { teamLeaders: { select: { id: true } } }
    });

    if (!project) {
        res.status(404);
        throw new Error('Project not found.');
    }

    const isTeamLeader = project.teamLeaders.some(leader => leader.id === user.id);
    if (user.role !== 'ADMIN' && !isTeamLeader) {
        res.status(403);
        throw new Error('User is not authorized to delete this project.');
    }

    await db.project.update({
        where: { id: projectId },
        data: { deletedAt: new Date(), status: 'archived' }
    });

    logger.info({ message: 'Project archived successfully.', projectId, userId: user.id });
    res.status(204).send();
});

/**
 * @desc    Create a task within a project
 * @route   POST /api/projects/:projectId/tasks
 * @access  Private
 */
export const createTaskInProject = asyncHandler(async (req, res) => {
    const { projectId } = req.params;
    const { title, description, startDate, endDate, assigneeIds, columnId } = req.body;
    const user = req.user;

    if (!user || !user.organizationId) {
        res.status(401);
        throw new Error('Not authorized');
    }

    if (!title || !startDate || !endDate || !columnId) {
        res.status(400);
        throw new Error('Missing required fields for task creation.');
    }

    const project = await db.project.findFirst({
        where: { id: projectId, organizationId: user.organizationId, deletedAt: null }
    });

    if (!project) {
        res.status(404);
        throw new Error("Project not found or is archived.");
    }

    const newTask = await db.task.create({
        data: {
            title,
            description,
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            projectId,
            organizationId: user.organizationId,
            columnId,
            assignees: {
                connect: assigneeIds ? assigneeIds.map((id: string) => ({ id })) : [],
            },
        }
    });
    logger.info({ message: 'Task created successfully in project.', taskId: newTask.id, projectId, userId: user.id });
    res.status(201).json(newTask);
});
