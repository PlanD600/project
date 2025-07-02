import { RequestHandler } from 'express';
import db from '../../db'; // שימוש ב-Prisma client
import { Prisma } from '@prisma/client'; // ייבוא טיפוסים של Prisma

// כל הפונקציות מתורגמות לעבודה עם Prisma

export const getProjects: RequestHandler = async (req, res, next) => {
    const user = req.user;
    if (!user) {
        return res.status(401).json({ message: 'Not authorized' });
    }

    try {
        const where: Prisma.ProjectWhereInput = {
            deletedAt: null // מסננים החוצה פרויקטים שנמחקו (מחיקה רכה), השדה קיים ב-schema
        };

        if (user.role === 'UserRole.TEAM_MANAGER) {
            where.teamId = user.teamId;
        } else if (user.role === 'Employee') {
            // תיקון: שימוש בקשר 'assignees' במקום בשדה 'assigneeIds'
            // בהתאם ל-schema.prisma שלך, 'assignees' הוא מערך של Userים
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
        } else if (user.role === 'Guest' && user.projectId) { // user.projectId מוכר כעת
            where.id = user.projectId;
        }
        // 2Super Admin יכול לראות הכל, לכן לא מוסיפים לו סינון נוסף

        const projects = await db.project.findMany({
            where,
            orderBy: { startDate: 'desc' }
        });

        res.json(projects);
    } catch (error) {
        next(error);
    }
};

export const createProject: RequestHandler = async (req, res, next) => {
    const { name, description, startDate, endDate, budget, teamId } = req.body;
    if (!name || !startDate || !endDate || !teamId) {
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
                ownerId: req.user!.id // המשתמש שיצר הוא הבעלים
            }
        });
        res.status(201).json(newProject);
    } catch (error) {
        next(error);
    }
};

export const updateProject: RequestHandler = async (req, res, next) => {
    const { projectId } = req.params;
    const { name, description, startDate, endDate, budget, teamId, status } = req.body;

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
        res.json(updatedProject);
    } catch (error) {
        next(error);
    }
};

export const deleteProject: RequestHandler = async (req, res, next) => {
    const { projectId } = req.params;

    try {
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
            // נניח שיש מודל financial, נמחק גם אותו
            // await t.financial.deleteMany({ where: { projectId } });
        });

        res.status(204).send();
    } catch (error) {
        next(error);
    }
};

export const getProjectDetails: RequestHandler = async (req, res, next) => {
    const { projectId } = req.params;
    
    try {
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
            return res.status(404).json({ message: 'Project not found' });
        }

        res.json(project);
    } catch (error) {
        next(error);
    }
};

export const createTaskInProject: RequestHandler = async (req, res, next) => {
    const { projectId } = req.params;
    const { title, description, startDate, endDate, assigneeIds } = req.body; // assigneeIds will be an array of user IDs
    
    if (!title || !startDate || !endDate) {
        return res.status(400).json({ message: 'Missing required fields for task creation.' });
    }

    try {
        // וודא שהפרויקט קיים ופעיל
        const project = await db.project.findFirst({
            where: { id: projectId, status: 'active', deletedAt: null }
        });

        if (!project) {
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

        res.status(201).json(newTask);
    } catch (error) {
        next(error);
    }
};