import { RequestHandler } from 'express';
import prisma from '../../db';
import logger from '../../logger';

// Helper function to get a fully populated task view
const getFullTaskViewModel = async (taskId: string) => {
    // With Prisma, we can fetch the task and its related data (comments with users) in one go.
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
            // Also include assignees for the task
            assignees: {
                select: {
                    id: true,
                    name: true,
                    avatarUrl: true
                }
            }
        }
    });
    return task;
}

export const getTask: RequestHandler = async (req, res, next) => {
    try {
        const task = await getFullTaskViewModel(req.params.taskId);
        if (!task) {
            return res.status(404).json({ message: 'Task not found' });
        }
        res.json(task);
    } catch (error) {
        logger.error({ message: 'Failed to get task', context: { taskId: req.params.taskId, userId: req.user?.id }, error });
        next(error);
    }
};

export const updateTask: RequestHandler = async (req, res, next) => {
    const { taskId } = req.params;
    const { title, description, startDate, endDate, columnId, assigneeIds, baselineStartDate, baselineEndDate } = req.body;
    
    try {
        // Prisma's update is slightly different, especially for many-to-many relations like assignees
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
                // To update assignees, we use 'set' to replace the list of connected users
                assignees: assigneeIds ? { set: assigneeIds.map((id: string) => ({ id })) } : undefined
            }
        });
        
        const updatedTask = await getFullTaskViewModel(taskId);
        res.json(updatedTask);
    } catch (error) {
        logger.error({ message: 'Failed to update task', context: { taskId, body: req.body, userId: req.user?.id }, error });
        next(error);
    }
};

export const bulkUpdateTasks: RequestHandler = async (req, res, next) => {
    const { tasks } = req.body; // Expects an array of tasks with { id, startDate, endDate, dependencies }
    
    try {
        // Use Prisma's transaction feature to run multiple updates together
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
        res.json(updatedTasks);
    } catch (error) {
        logger.error({ message: 'Failed to bulk update tasks', context: { taskIds: tasks.map((t:any) => t.id), userId: req.user?.id }, error });
        next(error);
    }
};

export const updateTaskStatus: RequestHandler = async (req, res, next) => {
    const { taskId } = req.params;
    const { status } = req.body;

    if (!status) {
        return res.status(400).json({ message: 'Status is required.' });
    }

    try {
        const result = await prisma.task.update({
            where: { id: taskId },
            data: { columnId: status }
        });
        res.status(200).json(result);
    } catch (error) {
        logger.error({ message: 'Failed to update task status', context: { taskId, status, userId: req.user?.id }, error });
        next(error);
    }
};

export const addCommentToTask: RequestHandler = async (req, res, next) => {
    const { taskId } = req.params;
    const { content, parentId } = req.body;
    const user = req.user;
    
    if (!content || !user) {
        return res.status(400).json({ message: 'Content and user are required.' });
    }

    try {
        // In Prisma, we create a new 'Comment' record that's related to the task
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
        
        // After adding the comment, fetch the entire updated task to get the new comment list
        const updatedTask = await getFullTaskViewModel(taskId);
        if (!updatedTask) {
            return res.status(404).json({ message: "Task not found after adding comment." });
        }

        res.status(201).json(updatedTask);
    } catch (error) {
        logger.error({ message: 'Failed to add comment to task', context: { taskId, body: req.body, userId: user.id }, error });
        next(error);
    }
};