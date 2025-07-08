import { Request, Response, NextFunction, RequestHandler } from 'express';
import asyncHandler from 'express-async-handler';
import prisma from '../../db'; // תיקון 1: ייבוא נכון
import logger from '../../logger'; // תיקון 2: ייבוא נכון
import { UserRole } from '@prisma/client'; // תיקון 3: ייבוא נכון
import { z } from 'zod';

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

const createTaskSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().min(1, 'End date is required'),
  assigneeIds: z.array(z.string()).optional(),
  columnId: z.string().min(1, 'Column ID is required'),
  projectId: z.string().min(1, 'Project ID is required').optional(),
});

const updateTaskSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  assigneeIds: z.array(z.string()).optional(),
  columnId: z.string().optional(),
});

export const getTask: RequestHandler = asyncHandler(async (req, res, next) => {
    const user = req.user;
    if (!user || !user.activeOrganizationId) {
        res.status(401).json({ message: 'Unauthorized' });
        return; // תיקון 4: החזרת void במקום Response
    }

    const task = await getFullTaskViewModel(req.params.taskId, user.activeOrganizationId);
    
    if (!task) {
        logger.warn({ message: 'Single task not found.', taskId: req.params.taskId, userId: user.id });
        res.status(404).json({ message: 'Task not found' });
        return;
    }
    
    logger.info({ message: 'Single task fetched successfully.', taskId: task.id, userId: user.id });
    res.json(task);
});

export const createTask: RequestHandler = asyncHandler(async (req, res, next) => {
    const user = req.user;
    if (!user || !user.activeOrganizationId) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
    }

    const parsed = createTaskSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: 'Invalid input', details: parsed.error.errors });
        return;
    }
    const { title, description, startDate, endDate, assigneeIds, columnId, projectId } = parsed.data;

    const task = await prisma.task.create({
        data: {
            title,
            description,
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            columnId,
            projectId: projectId || null,
            organizationId: user.activeOrganizationId,
            assignees: {
                connect: assigneeIds?.map((id: string) => ({ id: id })) || []
            }
        },
        include: {
            assignees: {
                select: { id: true, name: true, avatarUrl: true }
            }
        }
    });

    const createdTask = await getFullTaskViewModel(task.id, user.activeOrganizationId);
    logger.info({ message: 'Task created successfully.', taskId: createdTask?.id, userId: user.id });
    res.status(201).json(createdTask);
});

export const updateTask: RequestHandler = asyncHandler(async (req, res, next) => {
    const { taskId } = req.params;
    const user = req.user;
    const taskData = req.body;

    if (!user || !user.activeOrganizationId) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
    }
    
    const taskExists = await prisma.task.findFirst({
        where: { id: taskId, organizationId: user.activeOrganizationId }
    });
    if (!taskExists) {
        logger.warn({ message: 'Task update failed: Task not found in organization.', taskId, userId: user.id });
        res.status(404).json({ message: 'Task not found' });
        return;
    }

    const parsedUpdate = updateTaskSchema.safeParse(req.body);
    if (!parsedUpdate.success) {
        res.status(400).json({ error: 'Invalid input', details: parsedUpdate.error.errors });
        return;
    }
    const { title: updateTitle, description: updateDescription, startDate: updateStartDate, endDate: updateEndDate, assigneeIds: updateAssigneeIds, columnId: updateColumnId } = parsedUpdate.data;

    // Extract assigneeIds and exclude relation fields that shouldn't be updated directly
    const { assigneeIds, comments, assignees, startDate, endDate, baselineStartDate, baselineEndDate, ...updateData } = taskData;

    await prisma.task.update({
        where: { id: taskId },
        data: {
            ...updateData,
            // Convert date strings to Date objects for Prisma
            ...(startDate && { startDate: new Date(startDate) }),
            ...(endDate && { endDate: new Date(endDate) }),
            ...(baselineStartDate && { baselineStartDate: new Date(baselineStartDate) }),
            ...(baselineEndDate && { baselineEndDate: new Date(baselineEndDate) }),
            ...(assigneeIds !== undefined && {
                assignees: {
                    set: assigneeIds.map((id: string) => ({ id: id }))
                }
            })
        }
    });
    
    const updatedTask = await getFullTaskViewModel(taskId, user.activeOrganizationId);
    logger.info({ message: 'Task updated successfully.', taskId: updatedTask?.id, userId: user.id });
    res.json(updatedTask);
});

export const bulkUpdateTasks: RequestHandler = asyncHandler(async (req, res, next) => {
    const { tasks } = req.body as { tasks: any[] };
    const user = req.user;
    if (!user || !user.activeOrganizationId) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
    }
    
    const taskIds = tasks.map((t:any) => t.id);
    logger.info({ message: 'Attempting to bulk update tasks.', taskIds, userId: user.id });

    const tasksInOrgCount = await prisma.task.count({
        where: {
            id: { in: taskIds },
            organizationId: user.activeOrganizationId,
        }
    });

    if (tasksInOrgCount !== tasks.length) {
        logger.warn({ message: 'Bulk update failed: Not all tasks belong to the organization.', userId: user.id });
        res.status(403).json({ message: "Error: Attempted to update tasks from a different organization." });
        return;
    }

    const updatePromises = tasks.map((task: any) => {
        // Extract only the fields that should be updated, excluding relations and date fields
        const { id, comments, assignees, assigneeIds, startDate, endDate, ...updateData } = task;
        return prisma.task.update({
            where: { id: task.id },
            data: {
                startDate: new Date(task.startDate),
                endDate: new Date(task.endDate),
                dependencies: task.dependencies || [],
                ...updateData
            }
        });
    });
    
    await prisma.$transaction(updatePromises);

    const updatedTasks = await Promise.all(tasks.map((t: any) => getFullTaskViewModel(t.id, user.activeOrganizationId!)));
    logger.info({ message: 'Bulk update tasks completed successfully.', updatedTaskCount: updatedTasks.length, userId: user.id });
    res.json(updatedTasks.filter(Boolean));
});

export const updateTaskStatus: RequestHandler = asyncHandler(async (req, res, next) => {
    const { taskId } = req.params;
    const { status } = req.body;
    const user = req.user;
    if (!user || !user.activeOrganizationId) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
    }

    if (!status) {
        logger.warn({ message: 'Task status update failed: Missing status.', taskId, userId: user.id });
        res.status(400).json({ message: 'Status is required.' });
        return;
    }

    const taskExists = await prisma.task.findFirst({
        where: { id: taskId, organizationId: user.activeOrganizationId }
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

    const result = await getFullTaskViewModel(taskId, user.activeOrganizationId);
    logger.info({ message: 'Task status updated successfully.', taskId: result?.id, newStatus: result?.columnId, userId: user.id });
    res.status(200).json(result);
});

export const addCommentToTask: RequestHandler = asyncHandler(async (req, res, next) => {
    const { taskId } = req.params;
    const { content, parentId } = req.body;
    const user = req.user;
    
    if (!content || !user || !user.activeOrganizationId) {
        logger.warn({ message: 'Add comment failed: Missing content or user/org.', taskId, userId: user?.id });
        res.status(400).json({ message: 'Content and user are required.' });
        return;
    }

    const taskExists = await prisma.task.findFirst({
        where: { id: taskId, organizationId: user.activeOrganizationId }
    });
    if (!taskExists) {
        logger.warn({ message: 'Add comment failed: Task not found in organization.', taskId, userId: user.id });
        res.status(404).json({ message: 'Task not found' });
        return;
    }

    await prisma.comment.create({
        data: {
            text: content,
            taskId,
            userId: user.id,
            parentId: parentId || null,
            organizationId: user.activeOrganizationId
        }
    });

    const result = await getFullTaskViewModel(taskId, user.activeOrganizationId);
    logger.info({ message: 'Comment added successfully.', taskId: result?.id, userId: user.id });
    res.status(201).json(result);
});

export const deleteTask: RequestHandler = asyncHandler(async (req, res, next) => {
    const { taskId } = req.params;
    const user = req.user;
    
    if (!user || !user.activeOrganizationId) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
    }

    const taskExists = await prisma.task.findFirst({
        where: { id: taskId, organizationId: user.activeOrganizationId }
    });
    
    if (!taskExists) {
        logger.warn({ message: 'Delete task failed: Task not found in organization.', taskId, userId: user.id });
        res.status(404).json({ message: 'Task not found' });
        return;
    }

    // Check if user has permission to delete the task (temporary until schema migration)
    const membership = user.memberships.find(m => m.organizationId === user.activeOrganizationId);
    const role = membership?.role;
    const canDeleteTask = role && ([UserRole.ORG_ADMIN, UserRole.TEAM_LEADER] as UserRole[]).includes(role);
    if (!canDeleteTask) {
        logger.warn({ message: 'Delete task failed: Insufficient permissions.', taskId, userId: user.id, userRole: role });
        res.status(403).json({ message: 'Insufficient permissions to delete task' });
        return;
    }

    // Delete the task (this will cascade delete comments due to foreign key constraints)
    await prisma.task.delete({
        where: { id: taskId }
    });

    logger.info({ message: 'Task deleted successfully.', taskId, userId: user.id });
    res.status(204).send();
});