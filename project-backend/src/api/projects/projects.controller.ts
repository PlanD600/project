// project-backend/src/api/projects/projects.controller.ts
import { RequestHandler } from 'express';
import db from '../../db'; // שימוש ב-Prisma client
import { Prisma, UserRole } from '@prisma/client';
import logger from '../../logger'; // ייבוא הלוגר

export const getProjects: RequestHandler = async (req, res, next) => {
    const user = req.user;
    if (!user) {
        logger.warn({ message: 'Unauthorized attempt to get projects: No user in request.' });
        return res.status(401).json({ message: 'Not authorized' });
    }

    try {
        logger.info({ message: 'Attempting to fetch projects for user.', userId: user.id, role: user.role });

        const where: Prisma.ProjectWhereInput = {
            deletedAt: null // מסננים החוצה פרויקטים שנמחקו (מחיקה רכה), השדה קיים ב-schema
        };

        if (user.role === 'TEAM_MANAGER') {
            where.teamId = user.teamId;
            logger.info({ message: 'Filtering projects by team for team manager.', userId: user.id, teamId: user.teamId });
        } else if (user.role === 'Employee') {
            const tasks = await db.task.findMany({
                where: { 
                    assignees: { 
                        some: { 
                            id: user.id 
                        } 
                    } 
                },
                select: { projectId: true }
            });
            const projectIds = [...new Set(tasks.map(t => t.projectId))];
            where.id = { in: projectIds };
            logger.info({ message: 'Filtering projects by assigned tasks for employee.', userId: user.id, projectIdsCount: projectIds.length });
        } else if (user.role === 'GUEST' && user.projectId) {
            where.id = user.projectId;
            logger.info({ message: 'Filtering projects by assigned project for guest.', userId: user.id, projectId: user.projectId });
        }
        // ADMIN יכול לראות הכל, לכן לא מוסיפים לו סינון נוסף

        const projects = await db.project.findMany({
            where,
            orderBy: { startDate: 'desc' }
        });

        logger.info({ message: 'Projects fetched successfully.', userId: user.id, projectsCount: projects.length });
        res.json(projects);
    } catch (error) {
        logger.error({ message: 'Failed to get projects.', context: { userId: user.id, role: user.role }, error });
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
                ownerId: user!.id // המשתמש שיצר הוא הבעלים
            }
        });
        logger.info({ message: 'Project created successfully.', projectId: newProject.id, ownerId: user!.id });
        res.status(201).json(newProject);
    } catch (error) {
        logger.error({ message: 'Failed to create project.', context: { userId: user?.id, body: req.body }, error });
        next(error);
    }
};

export const updateProject: RequestHandler = async (req, res, next) => {
    const { projectId } = req.params;
    const { name, description, startDate, endDate, budget, teamId, status } = req.body;
    const user = req.user;

    try {
        const updatedProject = await db.project.update({
            where: { id: projectId },
            data: {
                name,
                description,
                startDate: startDate ? new Date(startDate) : undefined,
                endDate: endDate ? new Date(endDate) : undefined,
                budget: budget ? parseFloat(budget) : undefined,
                teamId,
                status,
            }
        });
        logger.info({ message: 'Project updated successfully.', projectId: updatedProject.id, userId: user?.id });
        res.json(updatedProject);
    } catch (error) {
        if ((error as any).code === 'P2025') {
            logger.warn({ message: 'Project update failed: Project not found.', projectId, userId: user?.id });
            return res.status(404).json({ message: 'Project not found.' });
        }
        logger.error({ message: 'Failed to update project.', context: { projectId, body: req.body, userId: user?.id }, error });
        next(error);
    }
};

export const deleteProject: RequestHandler = async (req, res, next) => {
    const { projectId } = req.params;
    const user = req.user;

    try {
        logger.info({ message: 'Attempting to delete project (soft delete).', projectId, userId: user?.id });
        // ביצוע "מחיקה רכה" ופעולות נוספות בטרנזקציה
        await db.$transaction(async (t) => {
            // 1. עדכון הפרויקט לסטטוס "archived" ותאריך מחיקה
            await t.project.update({
                where: { id: projectId },
                data: {
                    deletedAt: new Date(),
                    status: 'archived'
                }
            });

            // 2. מחיקת המשימות והרשומות הפיננסיות המשויכות
            await t.task.deleteMany({ where: { projectId } });
            await t.financialTransaction.deleteMany({ where: { projectId } });
        });
        
        logger.info({ message: 'Project and associated data archived/deleted successfully.', projectId, userId: user?.id });
        res.status(204).send();
    } catch (error) {
        if ((error as any).code === 'P2025') {
            logger.warn({ message: 'Project deletion failed: Project not found.', projectId, userId: user?.id });
            return res.status(404).json({ message: 'Project not found.' });
        }
        logger.error({ message: 'Failed to delete project.', context: { projectId, userId: user?.id }, error });
        next(error);
    }
};

export const getProjectDetails: RequestHandler = async (req, res, next) => {
    const { projectId } = req.params;
    const user = req.user;

    try {
        logger.info({ message: 'Attempting to fetch project details.', projectId, userId: user?.id });
        const project = await db.project.findUnique({
            where: { 
                id: projectId,
                deletedAt: null // לוודא שהפרויקט לא נמחק
            },
            include: { // טוענים מידע נוסף אם צריך, למשל משימות
                tasks: true, 
                team: true
            }
        });

        if (!project) {
            logger.warn({ message: 'Project details fetch failed: Project not found or deleted.', projectId, userId: user?.id });
            return res.status(404).json({ message: 'Project not found' });
        }

        logger.info({ message: 'Project details fetched successfully.', projectId, userId: user?.id });
        res.json(project);
    } catch (error) {
        logger.error({ message: 'Failed to get project details.', context: { projectId, userId: user?.id }, error });
        next(error);
    }
};

export const createTaskInProject: RequestHandler = async (req, res, next) => {
    const { projectId } = req.params;
    const { title, description, startDate, endDate, assigneeIds } = req.body;
    const user = req.user;
    
    if (!title || !startDate || !endDate) {
        logger.warn({ message: 'Task creation failed: Missing required fields.', context: { projectId, userId: user?.id, body: req.body } });
        return res.status(400).json({ message: 'Missing required fields for task creation.' });
    }

    try {
        logger.info({ message: 'Attempting to create task in project.', projectId, userId: user?.id });
        // וודא שהפרויקט קיים ופעיל
        const project = await db.project.findFirst({
            where: { id: projectId, status: 'active', deletedAt: null }
        });

        if (!project) {
            logger.warn({ message: 'Task creation failed: Project not found or is archived.', projectId, userId: user?.id });
            return res.status(404).json({ message: "Project not found or is archived." });
        }

        const newTask = await db.task.create({
            data: {
                title,
                description,
                startDate: new Date(startDate),
                endDate: new Date(endDate),
                projectId,
                // תיקון: חיבור המשתמשים באמצעות 'connect'
                assignees: {
                    connect: assigneeIds ? assigneeIds.map((id: string) => ({ id })) : [],
                },
                // ערכי ברירת מחדל נוספים
                columnId: 'col-not-started',
                plannedCost: 0,
                actualCost: 0
            }
        });
        logger.info({ message: 'Task created successfully in project.', taskId: newTask.id, projectId, userId: user?.id });
        res.status(201).json(newTask);
    } catch (error) {
        logger.error({ message: 'Failed to create task in project.', context: { projectId, body: req.body, userId: user?.id }, error });
        next(error);
    }
};