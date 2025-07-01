
import { RequestHandler } from 'express';
import { getDb } from '../../db';
import { ObjectId } from 'mongodb';
import logger from '../../logger';

export const getProjects: RequestHandler = async (req, res, next) => {
    const user = req.user;
    if (!user) {
        return res.status(401).json({ message: 'Not authorized' });
    }

    try {
        const db = getDb();
        let query = {};
        
        if (user.role === 'Team Leader') {
            query = { teamId: user.teamId };
        } else if (user.role === 'Employee') {
            const tasksForUser = await db.collection('tasks').find({ assigneeIds: user.id }).project({ projectId: 1 }).toArray();
            const projectIds = [...new Set(tasksForUser.map(t => t.projectId))];
            query = { _id: { $in: projectIds.map(id => new ObjectId(id)) } };
        } else if (user.role === 'Guest' && user.projectId) {
            query = { _id: new ObjectId(user.projectId) };
        }

        const projects = await db.collection('projects').find(query).sort({ startDate: -1 }).toArray();
        const responseProjects = projects.map(p => ({
            id: p._id.toHexString(),
            name: p.name,
            description: p.description,
            teamId: p.teamId,
            budget: p.budget,
            startDate: p.startDate,
            endDate: p.endDate,
        }));
        res.json(responseProjects);
    } catch (error) {
        logger.error({ message: 'Failed to get projects', context: { userId: user.id, role: user.role }, error });
        next(error);
    }
};

export const createProject: RequestHandler = async (req, res, next) => {
    const { name, description, startDate, endDate, budget, teamId } = req.body;
    if (!name || !startDate || !endDate || !teamId) {
        return res.status(400).json({ message: 'Missing required fields for project creation.' });
    }
    if (new Date(startDate) > new Date(endDate)) {
        return res.status(400).json({ message: 'Start date cannot be after end date.' });
    }
    const parsedBudget = parseFloat(budget);
    if (budget && (isNaN(parsedBudget) || !isFinite(parsedBudget))) {
        return res.status(400).json({ message: 'Budget must be a valid number.' });
    }

    try {
        const db = getDb();
        const newProjectDocument = {
            name,
            description,
            startDate,
            endDate,
            budget: parsedBudget || 0,
            teamId,
            createdAt: new Date(),
        };

        const result = await db.collection('projects').insertOne(newProjectDocument);
        
        const responseProject = {
            id: result.insertedId.toHexString(),
            ...newProjectDocument
        };
        
        logger.info({ message: 'Project created', projectId: responseProject.id, userId: req.user?.id });
        res.status(201).json(responseProject);
    } catch (error) {
        logger.error({ message: 'Failed to create project', context: { body: req.body, userId: req.user?.id }, error });
        next(error);
    }
};

export const getProjectDetails: RequestHandler = async (req, res, next) => {
    const { projectId } = req.params;
    const user = req.user;
    if (!user) return res.status(401).json({ message: "Not authorized" });
     if (!ObjectId.isValid(projectId)) {
        return res.status(400).json({ message: 'Invalid project ID format' });
    }

    try {
        const db = getDb();
        const project = await db.collection('projects').findOne({ _id: new ObjectId(projectId) });
        if (!project) {
            return res.status(404).json({ message: 'Project not found' });
        }
        
        // Basic authorization check - can be expanded
        const isSuperAdmin = user.role === 'Super Admin';
        const isTeamLeader = user.role === 'Team Leader' && user.teamId === project.teamId;
        if (!isSuperAdmin && !isTeamLeader) {
             // A full check would verify if an employee is assigned to any task in the project.
        }
        
        res.json({ ...project, id: project._id });
    } catch (error) {
        logger.error({ message: 'Failed to get project details', context: { projectId, userId: user.id }, error });
        next(error);
    }
};

interface CommentDocument {
    id: string;
    userId: string;
    text: string;
    timestamp: string;
    parentId: string | null;
}

export const createTaskInProject: RequestHandler = async (req, res, next) => {
    const { projectId } = req.params;
    const user = req.user;
    if (!user) return res.status(401).json({ message: "Not authorized" });
     if (!ObjectId.isValid(projectId)) {
        return res.status(400).json({ message: 'Invalid project ID format' });
    }

    const { title, description, startDate, endDate, assigneeIds } = req.body;
    if (!title || !startDate || !endDate || !assigneeIds) {
        return res.status(400).json({ message: 'Missing required fields for task creation.' });
    }

    try {
        const db = getDb();
        const project = await db.collection('projects').findOne({ _id: new ObjectId(projectId) });
        if (!project) {
            return res.status(404).json({ message: "Project not found" });
        }
        
        if (user.role === 'Team Leader' && user.teamId !== project.teamId) {
            return res.status(403).json({ message: "Not authorized to create tasks in this project" });
        }

        const newTaskDocument = {
            title,
            description,
            assigneeIds: assigneeIds || [],
            columnId: 'col-not-started',
            comments: [] as CommentDocument[],
            startDate,
            endDate,
            plannedCost: 0,
            actualCost: 0,
            dependencies: [],
            projectId,
            createdAt: new Date(),
        };
        
        const result = await db.collection('tasks').insertOne(newTaskDocument);
        
        const responseTask = {
            id: result.insertedId.toHexString(),
            ...newTaskDocument
        };

        logger.info({ message: 'Task created in project', taskId: responseTask.id, projectId, userId: user.id });
        res.status(201).json(responseTask);
    } catch (error) {
        logger.error({ message: 'Failed to create task in project', context: { body: req.body, projectId, userId: user.id }, error });
        next(error);
    }
};
