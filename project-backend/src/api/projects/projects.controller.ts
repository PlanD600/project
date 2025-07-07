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
    if (!user || !user.activeOrganizationId) {
        res.status(401);
        throw new Error('Not authorized');
    }

    // Base query: always filter by organization and non-deleted projects
    const where: Prisma.ProjectWhereInput = {
        organizationId: user.activeOrganizationId,
        deletedAt: null
    };

    // Role-based filtering (temporary until schema migration)
    if (user.activeRole === 'TEAM_LEADER') {
        // Team leaders see projects they are leading
        where.teamLeaders = { some: { id: user.id } };
        logger.info({ message: 'Filtering projects by team leadership for leader.', userId: user.id });
    } else if (user.activeRole === 'EMPLOYEE') {
        // Employees see projects where they have assigned tasks
        const tasks = await db.task.findMany({
            where: {
                organizationId: user.activeOrganizationId,
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
 * @access  Private (Admin or Org Admin)
 */
export const createProject: RequestHandler = asyncHandler(async (req, res) => {
  const { name, description, startDate, endDate, budget, teamId, teamLeaderIds } = req.body;
  const user = req.user;

  if (!user || !user.activeOrganizationId) {
    res.status(401);
    throw new Error('Not authorized');
  }

  // Check if user can create projects (Org Admin or Team Leader)
  const canCreateProjects = ['ORG_ADMIN', 'TEAM_LEADER'].includes(user.activeRole);

  if (!canCreateProjects) {
    res.status(403);
    throw new Error('User is not authorized to create projects');
  }

  // Check subscription limits
  const organization = await db.organization.findUnique({
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

  const currentLimit = planLimits[(organization as any).planType as keyof typeof planLimits];
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
  const teamLeaders = teamLeaderIds ? await db.user.findMany({
    where: { id: { in: teamLeaderIds } }
  }) : [];

  logger.info({ message: 'Creating new project', projectName: name, organizationId: user.activeOrganizationId, userId: user.id });

  const project = await db.project.create({
    data: {
      name,
      description,
      startDate: start,
      endDate: end,
      budget: parseFloat(budget),
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

  logger.info({ message: 'Project created successfully', projectId: project.id });
  res.status(201).json(project);
});

/**
 * @desc    Get a single project's details
 * @route   GET /api/projects/:projectId
 * @access  Private
 */
export const getProjectDetails = asyncHandler(async (req, res) => {
    const { projectId } = req.params;
    const user = req.user;

    if (!user || !user.activeOrganizationId) {
        res.status(401);
        throw new Error('Not authorized');
    }

    const project = await db.project.findFirst({
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

    if (!user || !user.activeOrganizationId) {
        res.status(401);
        throw new Error('Not authorized');
    }

    const project = await db.project.findFirst({
        where: { id: projectId, organizationId: user.activeOrganizationId },
        include: { teamLeaders: { select: { id: true } } }
    });

    if (!project) {
        res.status(404);
        throw new Error('Project not found.');
    }

    const isTeamLeader = project.teamLeaders.some(leader => leader.id === user.id);
    const canUpdateProject = ['ORG_ADMIN', 'TEAM_LEADER'].includes(user.activeRole) || isTeamLeader;

    if (!canUpdateProject) {
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

    if (!user || !user.activeOrganizationId) {
        res.status(401);
        throw new Error('Not authorized');
    }

    const project = await db.project.findFirst({
        where: { id: projectId, organizationId: user.activeOrganizationId },
        include: { teamLeaders: { select: { id: true } } }
    });

    if (!project) {
        res.status(404);
        throw new Error('Project not found.');
    }

    const isTeamLeader = project.teamLeaders.some(leader => leader.id === user.id);
    const canDeleteProject = ['ORG_ADMIN', 'TEAM_LEADER'].includes(user.activeRole) || isTeamLeader;

    if (!canDeleteProject) {
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

    if (!user || !user.activeOrganizationId) {
        res.status(401);
        throw new Error('Not authorized');
    }

    if (!title || !startDate || !endDate || !columnId) {
        res.status(400);
        throw new Error('Missing required fields for task creation.');
    }

    const project = await db.project.findFirst({
        where: { id: projectId, organizationId: user.activeOrganizationId, deletedAt: null }
    });

    if (!project) {
        res.status(404);
        throw new Error("Project not found or is archived.");
    }

    // *** התיקון מתחיל כאן ***

    // 1. יוצרים את המשימה ומבקשים מפורשות לקבל בחזרה את רשימת המשויכים
    const createdTask = await db.task.create({
        data: {
            title,
            description: description || '', // מוודאים שהתיאור הוא תמיד מחרוזת
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            projectId,
            organizationId: user.activeOrganizationId,
            columnId,
            assignees: {
                connect: assigneeIds ? assigneeIds.map((id: string) => ({ id })) : [],
            },
        },
        include: { // הוספנו את זה כדי לקבל את רשימת המשויכים המלאה
            assignees: true,
        },
    });

    // 2. בונים אובייקט תגובה עקבי שדומה לאובייקטים שהאפליקציה כבר מכירה
    const newTask = {
        ...createdTask,
        assigneeIds: createdTask.assignees.map(a => a.id),
        comments: [] // משימה חדשה תמיד מתחילה ללא תגובות
    };

    // מסירים את השדה 'assignees' המלא כי האפליקציה משתמשת רק ב-assigneeIds
    delete (newTask as any).assignees;

    logger.info({ message: 'Task created successfully in project.', taskId: newTask.id, projectId, userId: user.id });
    res.status(201).json(newTask);
});