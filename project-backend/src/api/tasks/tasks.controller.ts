// project-backend/src/api/tasks/tasks.controller.ts
import { RequestHandler } from 'express';
import prisma from '../../db';
import logger from '../../logger';

// Helper function to get a fully populated task view
const getFullTaskViewModel = async (taskId: string) => {
    logger.info({ message: 'Fetching full task view model.', taskId });
    const task = await prisma.task.findUnique({
        where: { id: taskId },
        include: {
            comments: {
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            avatarUrl: true,
                        }
                    }
                },
                orderBy: {
                    timestamp: 'asc'
                }
            },
            assignees: {
                select: {
                    id: true,
                    name: true,
                    avatarUrl: true
                }
            }
        }
    });
    if (task) {
        logger.info({ message: 'Full task view model fetched successfully.', taskId });
    } else {
        logger.warn({ message: 'Full task view model not found.', taskId });
    }
    return task;
}

export const getTask: RequestHandler = async (req, res, next) => {
    const user = req.user;
    try {
        logger.info({ message: 'Attempting to get single task.', taskId: req.params.taskId, userId: user?.id });
        const task = await getFullTaskViewModel(req.params.taskId);
        if (!task) {
            logger.warn({ message: 'Single task not found.', taskId: req.params.taskId, userId: user?.id });
            return res.status(404).json({ message: 'Task not found' });
        }
        logger.info({ message: 'Single task fetched successfully.', taskId: task.id, userId: user?.id });
        res.json(task);
    } catch (error) {
        logger.error({ message: 'Failed to get single task.', context: { taskId: req.params.taskId, userId: user?.id }, error });
        next(error);
    }
};

export const updateTask: RequestHandler = async (req, res, next) => {
    const { taskId } = req.params;
    const { title, description, startDate, endDate, columnId, assignees, baselineStartDate, baselineEndDate } = req.body;
    const user = req.user;
    
    try {
        logger.info({ message: 'Attempting to update task.', taskId, userId: user?.id, updateData: { title, columnId } });
        await prisma.task.update({
            where: { id: taskId },
            data: {
                title,
                description,
                startDate: startDate ? new Date(startDate) : undefined,
                endDate: endDate ? new Date(endDate) : undefined,
                columnId,
                baselineStartDate: baselineStartDate ? new Date(baselineStartDate) : undefined,
                baselineEndDate: baselineEndDate ? new Date(baselineEndDate) : undefined,
                assignees: assignees ? { set: assignees.map((user: { id: string }) => ({ id: user.id })) } : undefined
            }
        });
        
        const updatedTask = await getFullTaskViewModel(taskId);
        logger.info({ message: 'Task updated successfully.', taskId: updatedTask?.id, userId: user?.id });
        res.json(updatedTask);
    } catch (error) {
        if ((error as any).code === 'P2025') {
            logger.warn({ message: 'Task update failed: Task not found.', taskId, userId: user?.id });
            return res.status(404).json({ message: 'Task not found' });
        }
        logger.error({ message: 'Failed to update task.', context: { taskId, body: req.body, userId: user?.id }, error });
        next(error);
    }
};

export const bulkUpdateTasks: RequestHandler = async (req, res, next) => {
    const { tasks } = req.body;
    const user = req.user;
    
    try {
        logger.info({ message: 'Attempting to bulk update tasks.', taskIds: tasks.map((t:any) => t.id), userId: user?.id });
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

        const updatedTasks = await Promise.all(tasks.map((t: any) => getFullTaskViewModel(t.id)));
        logger.info({ message: 'Bulk update tasks completed successfully.', updatedTaskCount: updatedTasks.length, userId: user?.id });
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

    if (!status) {
        logger.warn({ message: 'Task status update failed: Missing status.', taskId, userId: user?.id });
        return res.status(400).json({ message: 'Status is required.' });
    }

    try {
        logger.info({ message: 'Attempting to update task status.', taskId, newStatus: status, userId: user?.id });
        const result = await prisma.task.update({
            where: { id: taskId },
            data: { columnId: status }
        });
        logger.info({ message: 'Task status updated successfully.', taskId: result.id, newStatus: result.columnId, userId: user?.id });
        res.status(200).json(result);
    } catch (error) {
        if ((error as any).code === 'P2025') {
            logger.warn({ message: 'Task status update failed: Task not found.', taskId, userId: user?.id });
            return res.status(404).json({ message: 'Task not found' });
        }
        logger.error({ message: 'Failed to update task status.', context: { taskId, status, userId: user?.id }, error });
        next(error);
    }
};

export const addCommentToTask: RequestHandler = async (req, res, next) => {
    const { taskId } = req.params;
    const { content, parentId } = req.body;
    const user = req.user;
    
    if (!content || !user) {
        logger.warn({ message: 'Add comment failed: Missing content or user.', taskId, userId: user?.id });
        return res.status(400).json({ message: 'Content and user are required.' });
    }

    try {
        logger.info({ message: 'Attempting to add comment to task.', taskId, userId: user.id, parentCommentId: parentId });
        await prisma.comment.create({
            data: {
                text: content,
                parentId: parentId || null,
                task: {
                    connect: { id: taskId }
                },
                user: {
                    connect: { id: user.id }
                }
            }
        });
        
        const updatedTask = await getFullTaskViewModel(taskId);
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