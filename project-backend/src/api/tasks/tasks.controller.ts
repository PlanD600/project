import { Request, Response, NextFunction, RequestHandler } from 'express';
import asyncHandler from 'express-async-handler';
import prisma from '../../db'; // תיקון 1: ייבוא נכון
import logger from '../../logger'; // תיקון 2: ייבוא נכון

// פונקציית עזר חדשה שמבטיחה שהמידע החוזר יהיה תמיד מלא ועקבי
const getFullTaskViewModel = async (taskId: string, organizationId: string) => {
    logger.info({ message: 'Fetching full task view model.', taskId, orgId: organizationId });
    const task = await prisma.task.findFirst({
        where: { id: taskId, organizationId: organizationId },
        include: {
            assignees: {
                select: { id: true, name: true, avatarUrl: true }
            },
            comments: {
                include: {
                    user: { select: { id: true, name: true, avatarUrl: true } }
                },
                orderBy: { timestamp: 'asc' }
            }
        }
    });

    if (!task) {
        logger.warn({ message: 'Full task view model not found for this org.', taskId, orgId: organizationId });
        return null;
    }

    // בנייה ידנית של אובייקט התגובה כדי להבטיח עקביות
    const taskViewModel = {
        ...task,
        description: task.description ?? '',
        assigneeIds: task.assignees.map((a: { id: string }) => a.id), // תיקון 3: הוספת טיפוס
    };
    
    delete (taskViewModel as any).assignees;

    logger.info({ message: 'Full task view model fetched successfully.', taskId });
    return taskViewModel;
};

export const getTask: RequestHandler = asyncHandler(async (req, res, next) => {
    const user = req.user;
    if (!user || !user.organizationId) {
        res.status(401).json({ message: 'Unauthorized' });
        return; // תיקון 4: החזרת void במקום Response
    }

    const task = await getFullTaskViewModel(req.params.taskId, user.organizationId);
    
    if (!task) {
        logger.warn({ message: 'Single task not found.', taskId: req.params.taskId, userId: user.id });
        res.status(404).json({ message: 'Task not found' });
        return;
    }
    
    logger.info({ message: 'Single task fetched successfully.', taskId: task.id, userId: user.id });
    res.json(task);
});

export const updateTask: RequestHandler = asyncHandler(async (req, res, next) => {
    const { taskId } = req.params;
    const user = req.user;
    const taskData = req.body;

    if (!user || !user.organizationId) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
    }
    
    const taskExists = await prisma.task.findFirst({
        where: { id: taskId, organizationId: user.organizationId }
    });
    if (!taskExists) {
        logger.warn({ message: 'Task update failed: Task not found in organization.', taskId, userId: user.id });
        res.status(404).json({ message: 'Task not found' });
        return;
    }

    const { assigneeIds, ...otherData } = taskData;

    await prisma.task.update({
        where: { id: taskId },
        data: {
            ...otherData,
            ...(assigneeIds !== undefined && {
                assignees: {
                    set: assigneeIds.map((id: string) => ({ id: id }))
                }
            })
        }
    });
    
    const updatedTask = await getFullTaskViewModel(taskId, user.organizationId);
    logger.info({ message: 'Task updated successfully.', taskId: updatedTask?.id, userId: user.id });
    res.json(updatedTask);
});

export const bulkUpdateTasks: RequestHandler = asyncHandler(async (req, res, next) => {
    const { tasks } = req.body as { tasks: any[] };
    const user = req.user;
    if (!user || !user.organizationId) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
    }
    
    const taskIds = tasks.map((t:any) => t.id);
    logger.info({ message: 'Attempting to bulk update tasks.', taskIds, userId: user.id });

    const tasksInOrgCount = await prisma.task.count({
        where: {
            id: { in: taskIds },
            organizationId: user.organizationId,
        }
    });

    if (tasksInOrgCount !== tasks.length) {
        logger.warn({ message: 'Bulk update failed: Not all tasks belong to the organization.', userId: user.id });
        res.status(403).json({ message: "Error: Attempted to update tasks from a different organization." });
        return;
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
    res.json(updatedTasks.filter(Boolean));
});

export const updateTaskStatus: RequestHandler = asyncHandler(async (req, res, next) => {
    const { taskId } = req.params;
    const { status } = req.body;
    const user = req.user;
    if (!user || !user.organizationId) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
    }

    if (!status) {
        logger.warn({ message: 'Task status update failed: Missing status.', taskId, userId: user.id });
        res.status(400).json({ message: 'Status is required.' });
        return;
    }

    const taskExists = await prisma.task.findFirst({
        where: { id: taskId, organizationId: user.organizationId }
    });
    if (!taskExists) {
        logger.warn({ message: 'Task status update failed: Task not found in organization.', taskId, userId: user.id });
        res.status(404).json({ message: 'Task not found' });
        return;
    }

    await prisma.task.update({
        where: { id: taskId },
        data: { columnId: status }
    });

    const result = await getFullTaskViewModel(taskId, user.organizationId);
    logger.info({ message: 'Task status updated successfully.', taskId: result?.id, newStatus: result?.columnId, userId: user.id });
    res.status(200).json(result);
});

export const addCommentToTask: RequestHandler = asyncHandler(async (req, res, next) => {
    const { taskId } = req.params;
    const { content, parentId } = req.body;
    const user = req.user;
    
    if (!content || !user || !user.organizationId) {
        logger.warn({ message: 'Add comment failed: Missing content or user/org.', taskId, userId: user?.id });
        res.status(400).json({ message: 'Content and user are required.' });
        return;
    }

    const taskExists = await prisma.task.findFirst({
        where: { id: taskId, organizationId: user.organizationId }
    });
    if (!taskExists) {
        logger.warn({ message: 'Add comment failed: Task not found in organization.', taskId, userId: user.id });
        res.status(404).json({ message: 'Task not found' });
        return;
    }

    await prisma.comment.create({
        data: {
            text: content,
            parentId: parentId || null,
            organizationId: user.organizationId,
            taskId: taskId,
            userId: user.id
        }
    });
    
    const updatedTask = await getFullTaskViewModel(taskId, user.organizationId);
    if (!updatedTask) {
        logger.error({ message: 'Task not found after adding comment.', taskId, userId: user.id });
        res.status(404).json({ message: "Task not found after adding comment." });
        return;
    }
    logger.info({ message: 'Comment added to task successfully.', taskId, userId: user.id });
    res.status(201).json(updatedTask);
});