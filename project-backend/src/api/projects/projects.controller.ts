// project-backend/src/api/projects/projects.controller.ts
import { Request, Response, NextFunction, RequestHandler } from 'express';
import db from '../../db'; // שימוש ב-Prisma client
import { Prisma, UserRole } from '@prisma/client';
import logger from '../../logger'; // ייבוא הלוגר

export const getProjects: RequestHandler = async (req, res, next) => {
    const user = req.user;
    if (!user || !user.organizationId) {
        logger.warn({ message: 'Unauthorized attempt to get projects: No user or organizationId in request.' });
        return res.status(401).json({ message: 'Not authorized' });
    }

    try {
        logger.info({ message: 'Attempting to fetch projects for user.', userId: user.id, orgId: user.organizationId, role: user.role });

        // "כלל הזהב": כל שאילתה מתחילה עם סינון לפי ארגון
        const where: Prisma.ProjectWhereInput = {
            organizationId: user.organizationId,
            deletedAt: null 
        };

        if (user.role === UserRole.TEAM_MANAGER && user.teamId) {
            where.teamId = user.teamId;
            logger.info({ message: 'Filtering projects by team for team manager.', userId: user.id, teamId: user.teamId });
        } else if (user.role === UserRole.EMPLOYEE) {
            // גם השאילתה הפנימית הזו חייבת להיות מסוננת לפי ארגון
            const tasks = await db.task.findMany({
                where: {
                    organizationId: user.organizationId, 
                    assignees: { some: { id: user.id } } 
                },
                select: { projectId: true }
            });
            const projectIds = [...new Set(tasks.map(t => t.projectId))];
            where.id = { in: projectIds.length > 0 ? projectIds : undefined };
            logger.info({ message: 'Filtering projects by assigned tasks for EMPLOYEE.', userId: user.id, projectIdsCount: projectIds.length });
        } 
        // שיניתי את הלוגיקה של אורח כך שתהיה יותר מאובטחת בהמשך
        // ADMIN יראה את כל הפרויקטים בארגון שלו, כפי שמוגדר ב-where הראשי

        const projects = await db.project.findMany({ where, orderBy: { startDate: 'desc' } });

        logger.info({ message: 'Projects fetched successfully.', userId: user.id, projectsCount: projects.length });
        res.json(projects);
    } catch (error) {
        logger.error({ message: 'Failed to get projects.', context: { userId: user?.id, role: user?.role }, error });
        next(error);
    }
};

export const createProject: RequestHandler = async (req, res, next) => {
    const { name, description, startDate, endDate, budget, teamId } = req.body;
    const user = req.user;

    if (!name || !startDate || !endDate || !teamId) {
        logger.warn({ message: 'Project creation failed: Missing required fields.', context: { userId: user?.id, body: req.body } });
        return res.status(400).json({ message: 'Missing required fields for project creation.' });
    }

    if (!user || !user.organizationId) {
        logger.warn({ message: 'Project creation failed: User or organization not identified.', context: { userId: user?.id } });
        return res.status(401).json({ message: 'Unauthorized' });
    }
    
    try {
        const newProject = await db.project.create({
            data: {
                name,
                description,
                startDate: new Date(startDate),
                endDate: new Date(endDate),
                budget: parseFloat(budget) || 0,
                teamId,
                status: 'active',
                ownerId: user.id,
                organizationId: user.organizationId // "כלל הזהב": משייכים את הפרויקט החדש לארגון
            }
        });
        logger.info({ message: 'Project created successfully.', projectId: newProject.id, orgId: newProject.organizationId, ownerId: user.id });
        res.status(201).json(newProject);
    } catch (error) {
        logger.error({ message: 'Failed to create project.', context: { userId: user?.id, body: req.body }, error });
        next(error);
    }
};

export const updateProject: RequestHandler = async (req, res, next) => {
    const { projectId } = req.params;
    const user = req.user;

    if (!user || !user.organizationId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
        // "כלל הזהב": לפני כל עדכון, נוודא שהרשומה קיימת ושייכת לארגון הנכון
        const project = await db.project.findFirst({
            where: { id: projectId, organizationId: user.organizationId }
        });

        if (!project) {
            logger.warn({ message: 'Project update failed: Project not found in organization.', projectId, userId: user.id, orgId: user.organizationId });
            return res.status(404).json({ message: 'Project not found.' });
        }

        const updatedProject = await db.project.update({
            where: { id: projectId }, // עכשיו כשאנחנו בטוחים שהוא שייך לנו, אפשר לעדכן לפי ID
            data: req.body
        });
        logger.info({ message: 'Project updated successfully.', projectId: updatedProject.id, userId: user.id });
        res.json(updatedProject);
    } catch (error) {
        logger.error({ message: 'Failed to update project.', context: { projectId, body: req.body, userId: user?.id }, error });
        next(error);
    }
};

export const deleteProject: RequestHandler = async (req, res, next) => {
    const { projectId } = req.params;
    const user = req.user;

    if (!user || !user.organizationId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
        // "כלל הזהב": נוודא שהפרויקט שאנחנו מנסים למחוק שייך לארגון שלנו
        const project = await db.project.findFirst({
            where: { id: projectId, organizationId: user.organizationId }
        });

        if (!project) {
            logger.warn({ message: 'Project deletion failed: Project not found in organization.', projectId, userId: user.id, orgId: user.organizationId });
            return res.status(404).json({ message: 'Project not found.' });
        }

        logger.info({ message: 'Attempting to delete project (soft delete).', projectId, userId: user.id });
        await db.$transaction(async (t) => {
            await t.project.update({
                where: { id: projectId },
                data: { deletedAt: new Date(), status: 'archived' }
            });
            await t.task.deleteMany({ where: { projectId } });
            await t.financialTransaction.deleteMany({ where: { projectId } });
        });
        
        logger.info({ message: 'Project and associated data archived/deleted successfully.', projectId, userId: user.id });
        res.status(204).send();
    } catch (error) {
        logger.error({ message: 'Failed to delete project.', context: { projectId, userId: user?.id }, error });
        next(error);
    }
};

export const getProjectDetails: RequestHandler = async (req, res, next) => {
    const { projectId } = req.params;
    const user = req.user;

    if (!user || !user.organizationId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
        logger.info({ message: 'Attempting to fetch project details.', projectId, userId: user.id });
        const project = await db.project.findFirst({
            where: { 
                id: projectId,
                organizationId: user.organizationId, // "כלל הזהב": סינון לפי ארגון
                deletedAt: null
            },
            include: { tasks: true, team: true }
        });

        if (!project) {
            logger.warn({ message: 'Project details fetch failed: Project not found or deleted.', projectId, userId: user.id });
            return res.status(404).json({ message: 'Project not found' });
        }

        logger.info({ message: 'Project details fetched successfully.', projectId, userId: user.id });
        res.json(project);
    } catch (error) {
        logger.error({ message: 'Failed to get project details.', context: { projectId, userId: user?.id }, error });
        next(error);
    }
};

export const createTaskInProject: RequestHandler = async (req, res, next) => {
    const { projectId } = req.params;
    const { title, description, startDate, endDate, assigneeIds, columnId } = req.body;
    const user = req.user;
    
    if (!user || !user.organizationId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    if (!title || !startDate || !endDate || !columnId) {
        logger.warn({ message: 'Task creation failed: Missing required fields.', context: { projectId, userId: user.id, body: req.body } });
        return res.status(400).json({ message: 'Missing required fields for task creation.' });
    }

    try {
        logger.info({ message: 'Attempting to create task in project.', projectId, userId: user.id });
        const project = await db.project.findFirst({
            // "כלל הזהב": ודא שהפרויקט שאליו אתה מוסיף משימה שייך לארגון שלך
            where: { id: projectId, organizationId: user.organizationId, status: 'active', deletedAt: null }
        });

        if (!project) {
            logger.warn({ message: 'Task creation failed: Project not found or is archived in this org.', projectId, userId: user.id });
            return res.status(404).json({ message: "Project not found or is archived." });
        }

        const newTask = await db.task.create({
            data: {
                title,
                description,
                startDate: new Date(startDate),
                endDate: new Date(endDate),
                projectId,
                organizationId: user.organizationId, // "כלל הזהב": כל משימה חדשה משויכת לארגון
                columnId,
                assignees: {
                    connect: assigneeIds ? assigneeIds.map((id: string) => ({ id })) : [],
                },
                plannedCost: 0,
                actualCost: 0
            }
        });
        logger.info({ message: 'Task created successfully in project.', taskId: newTask.id, projectId, userId: user.id });
        res.status(201).json(newTask);
    } catch (error) {
        logger.error({ message: 'Failed to create task in project.', context: { projectId, body: req.body, userId: user?.id }, error });
        next(error);
    }
};