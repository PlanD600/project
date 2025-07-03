// project-backend/src/api/tasks/tasks.controller.ts
import { Request, Response, NextFunction, RequestHandler } from 'express';
import prisma from '../../db';
import logger from '../../logger';

// Helper function to get a fully populated task view, NOW SECURED BY ORGANIZATION
const getFullTaskViewModel = async (taskId: string, organizationId: string) => {
    logger.info({ message: 'Fetching full task view model.', taskId, orgId: organizationId });
    // "כלל הזהב": משתמשים ב-findFirst עם ID ו-organizationId כדי לוודא שייכות
    const task = await prisma.task.findFirst({
        where: { id: taskId, organizationId: organizationId },
        include: {
            comments: {
                include: {
                    user: { select: { id: true, name: true, avatarUrl: true, } }
                },
                orderBy: { timestamp: 'asc' }
            },
            assignees: {
                select: { id: true, name: true, avatarUrl: true }
            }
        }
    });
    if (task) {
        logger.info({ message: 'Full task view model fetched successfully.', taskId });
    } else {
        logger.warn({ message: 'Full task view model not found for this org.', taskId, orgId: organizationId });
    }
    return task;
}

export const getTask: RequestHandler = async (req, res, next) => {
    const user = req.user;
    if (!user || !user.organizationId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    try {
        logger.info({ message: 'Attempting to get single task.', taskId: req.params.taskId, userId: user.id });
        // מעבירים את מזהה הארגון לפונקציית העזר
        const task = await getFullTaskViewModel(req.params.taskId, user.organizationId);
        if (!task) {
            logger.warn({ message: 'Single task not found.', taskId: req.params.taskId, userId: user.id });
            return res.status(404).json({ message: 'Task not found' });
        }
        logger.info({ message: 'Single task fetched successfully.', taskId: task.id, userId: user.id });
        res.json(task);
    } catch (error) {
        logger.error({ message: 'Failed to get single task.', context: { taskId: req.params.taskId, userId: user?.id }, error });
        next(error);
    }
};

export const updateTask: RequestHandler = async (req, res, next) => {
    const { taskId } = req.params;
    const user = req.user;
    if (!user || !user.organizationId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    
    try {
        logger.info({ message: 'Attempting to update task.', taskId, userId: user.id });
        // "כלל הזהב": ודא שהמשימה שייכת לארגון לפני העדכון
        const taskExists = await prisma.task.findFirst({
            where: { id: taskId, organizationId: user.organizationId }
        });
        if (!taskExists) {
            logger.warn({ message: 'Task update failed: Task not found in organization.', taskId, userId: user.id });
            return res.status(404).json({ message: 'Task not found' });
        }

        await prisma.task.update({
            where: { id: taskId },
            data: req.body
        });
        
        const updatedTask = await getFullTaskViewModel(taskId, user.organizationId);
        logger.info({ message: 'Task updated successfully.', taskId: updatedTask?.id, userId: user.id });
        res.json(updatedTask);
    } catch (error) {
        logger.error({ message: 'Failed to update task.', context: { taskId, body: req.body, userId: user?.id }, error });
        next(error);
    }
};

export const bulkUpdateTasks: RequestHandler = async (req, res, next) => {
    const { tasks } = req.body as { tasks: any[] };
    const user = req.user;
    if (!user || !user.organizationId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    
    try {
        const taskIds = tasks.map((t:any) => t.id);
        logger.info({ message: 'Attempting to bulk update tasks.', taskIds, userId: user.id });

        // "כלל הזהב": ודא שכל המשימות שאתה מנסה לעדכן שייכות לארגון שלך
        const tasksInOrgCount = await prisma.task.count({
            where: {
                id: { in: taskIds },
                organizationId: user.organizationId,
            }
        });

        if (tasksInOrgCount !== tasks.length) {
            logger.warn({ message: 'Bulk update failed: Not all tasks belong to the organization.', userId: user.id });
            return res.status(403).json({ message: "Error: Attempted to update tasks from a different organization." });
        }

        const updatePromises = tasks.map((task: any) =>
            prisma.task.update({
                where: { id: task.id },
                data: {
                    startDate: new Date(task.startDate),
                    endDate: new Date(task.endDate),
                    dependencies: task.dependencies || []
                }
            })
        );
        
        await prisma.$transaction(updatePromises);

        const updatedTasks = await Promise.all(tasks.map((t: any) => getFullTaskViewModel(t.id, user.organizationId!)));
        logger.info({ message: 'Bulk update tasks completed successfully.', updatedTaskCount: updatedTasks.length, userId: user.id });
        res.json(updatedTasks);
    } catch (error) {
        logger.error({ message: 'Failed to bulk update tasks.', context: { taskIds: tasks.map((t:any) => t.id), userId: user?.id }, error });
        next(error);
    }
};

export const updateTaskStatus: RequestHandler = async (req, res, next) => {
    const { taskId } = req.params;
    const { status } = req.body;
    const user = req.user;
    if (!user || !user.organizationId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    if (!status) {
        logger.warn({ message: 'Task status update failed: Missing status.', taskId, userId: user.id });
        return res.status(400).json({ message: 'Status is required.' });
    }

    try {
        logger.info({ message: 'Attempting to update task status.', taskId, newStatus: status, userId: user.id });
        // "כלל הזהב": ודא בעלות לפני עדכון
        const taskExists = await prisma.task.findFirst({
            where: { id: taskId, organizationId: user.organizationId }
        });
        if (!taskExists) {
            logger.warn({ message: 'Task status update failed: Task not found in organization.', taskId, userId: user.id });
            return res.status(404).json({ message: 'Task not found' });
        }

        const result = await prisma.task.update({
            where: { id: taskId },
            data: { columnId: status }
        });
        logger.info({ message: 'Task status updated successfully.', taskId: result.id, newStatus: result.columnId, userId: user.id });
        res.status(200).json(result);
    } catch (error) {
        logger.error({ message: 'Failed to update task status.', context: { taskId, status, userId: user?.id }, error });
        next(error);
    }
};

export const addCommentToTask: RequestHandler = async (req, res, next) => {
    const { taskId } = req.params;
    const { content, parentId } = req.body;
    const user = req.user;
    
    if (!content || !user || !user.organizationId) {
        logger.warn({ message: 'Add comment failed: Missing content or user/org.', taskId, userId: user?.id });
        return res.status(400).json({ message: 'Content and user are required.' });
    }

    try {
        logger.info({ message: 'Attempting to add comment to task.', taskId, userId: user.id, parentCommentId: parentId });
        // "כלל הזהב": ודא שהמשימה שאתה מגיב עליה שייכת לארגון שלך
        const taskExists = await prisma.task.findFirst({
            where: { id: taskId, organizationId: user.organizationId }
        });
        if (!taskExists) {
            logger.warn({ message: 'Add comment failed: Task not found in organization.', taskId, userId: user.id });
            return res.status(404).json({ message: 'Task not found' });
        }

        await prisma.comment.create({
            data: {
                text: content,
                parentId: parentId || null,
                organizationId: user.organizationId, // שייך את התגובה לארגון
                taskId: taskId, // Providing the foreign key directly
                userId: user.id // <-- הוספנו את השורה החסרה הזו
            }
        });
        
        const updatedTask = await getFullTaskViewModel(taskId, user.organizationId);
        if (!updatedTask) {
            logger.error({ message: 'Task not found after adding comment.', taskId, userId: user.id });
            return res.status(404).json({ message: "Task not found after adding comment." });
        }
        logger.info({ message: 'Comment added to task successfully.', taskId, userId: user.id });
        res.status(201).json(updatedTask);
    } catch (error) {
        logger.error({ message: 'Failed to add comment to task.', context: { taskId, body: req.body, userId: user.id }, error });
        next(error);
    }
};