


import { RequestHandler } from 'express';
import { getDb } from '../../db';
import { ObjectId } from 'mongodb';
import logger from '../../logger';

interface CommentDocument {
    id: string;
    userId: string;
    text: string;
    timestamp: string;
    parentId: string | null;
}

const getFullTaskViewModel = async (taskId: string | ObjectId) => {
    const db = getDb();
    const task = await db.collection('tasks').findOne({ _id: new ObjectId(taskId) });
    if (!task) return null;

    if (task.comments && task.comments.length > 0) {
        const userIds = task.comments.map((c: any) => new ObjectId(c.userId));
        const users = await db.collection('users').find({ _id: { $in: userIds } }).project({ name: 1, avatarUrl: 1, role: 1, email: 1 }).toArray();
        const userMap = new Map(users.map(u => [u._id.toHexString(), u]));
        task.comments = task.comments.map((c: any) => ({
            ...c,
            user: userMap.get(c.userId) || { name: 'Unknown User' }
        }));
    }

    return { ...task, id: task._id.toHexString() };
}

export const getTask: RequestHandler = async (req, res, next) => {
    const { taskId } = req.params;
    if (!ObjectId.isValid(taskId)) return res.status(400).json({ message: 'Invalid Task ID format' });
    try {
        const task = await getFullTaskViewModel(req.params.taskId);
        if (!task) {
            return res.status(404).json({ message: 'Task not found' });
        }
        res.json(task);
    } catch (error) {
        logger.error({ message: 'Failed to get task', context: { taskId, userId: req.user?.id }, error });
        next(error);
    }
};

export const updateTask: RequestHandler = async (req, res, next) => {
    const { taskId } = req.params;
    const { title, description, startDate, endDate, columnId, assigneeIds, baselineStartDate, baselineEndDate } = req.body;
    if (!ObjectId.isValid(taskId)) return res.status(400).json({ message: 'Invalid Task ID format' });
    
    try {
        const db = getDb();
        const updateData = {
            title, description, startDate, endDate, columnId, assigneeIds, baselineStartDate, baselineEndDate
        };
        await db.collection('tasks').updateOne({ _id: new ObjectId(taskId) }, { $set: updateData });
        
        const updatedTask = await getFullTaskViewModel(taskId);
        res.json(updatedTask);
    } catch (error) {
        logger.error({ message: 'Failed to update task', context: { taskId, body: req.body, userId: req.user?.id }, error });
        next(error);
    }
};

export const bulkUpdateTasks: RequestHandler = async (req, res, next) => {
    const { tasks } = req.body;
    
    try {
        const db = getDb();
        const bulkOps = tasks.map((task: any) => ({
            updateOne: {
                filter: { _id: new ObjectId(task.id) },
                update: { $set: { 
                    startDate: task.startDate, 
                    endDate: task.endDate,
                    dependencies: task.dependencies || []
                }}
            }
        }));

        if (bulkOps.length > 0) {
            await db.collection('tasks').bulkWrite(bulkOps);
        }

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
    if (!ObjectId.isValid(taskId)) return res.status(400).json({ message: 'Invalid Task ID format' });

    if (!status) {
        return res.status(400).json({ message: 'Status is required.' });
    }

    try {
        const db = getDb();
        const result = await db.collection('tasks').findOneAndUpdate(
            { _id: new ObjectId(taskId) },
            { $set: { columnId: status } },
            { returnDocument: 'after' }
        );
        if (!result) {
            return res.status(404).json({ message: 'Task not found.' });
        }
        res.status(200).json({ ...result, id: result._id });
    } catch (error) {
        logger.error({ message: 'Failed to update task status', context: { taskId, status, userId: req.user?.id }, error });
        next(error);
    }
};

export const addCommentToTask: RequestHandler = async (req, res, next) => {
    const { taskId } = req.params;
    const { content, parentId } = req.body;
    const user = req.user;
    if (!ObjectId.isValid(taskId)) return res.status(400).json({ message: 'Invalid Task ID format' });
    
    if (!content || !user) {
        return res.status(400).json({ message: 'Content and user are required.' });
    }

    try {
        const db = getDb();
        const newComment: CommentDocument = {
            id: new ObjectId().toHexString(),
            userId: user.id,
            text: content,
            timestamp: new Date().toISOString(),
            parentId: parentId || null,
        };

        await db.collection('tasks').updateOne(
            { _id: new ObjectId(taskId) },
            { $push: { comments: newComment as never } }
        );
        
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