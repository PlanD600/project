
import { RequestHandler } from 'express';
import { getDb } from '../../db';
import { ObjectId } from 'mongodb';
import logger from '../../logger';

const getFullTaskViewModel = (task: any, userMap: Map<string, any>) => {
    const commentsWithUsers = (task.comments || []).map((c: any) => ({
        ...c,
        user: userMap.get(c.userId) || { id: c.userId, name: 'Unknown User', avatarUrl: '', role: 'Guest' }
    }));
    return { ...task, id: task._id.toHexString(), comments: commentsWithUsers };
};

export const getInitialData: RequestHandler = async (req, res, next) => {
    const user = req.user;
    if (!user) return res.status(401).json({ message: 'Not authorized' });

    try {
        const db = getDb();

        const allUsers = await db.collection('users').find({}, { projection: { passwordHash: 0 } }).sort({ name: 1 }).toArray();
        const userMap = new Map(allUsers.map(u => [u._id.toHexString(), u]));
        
        const teams = await db.collection('teams').find({}).toArray();
        
        let projectsQuery = {};
        if (user.role === 'Team Leader') {
            projectsQuery = { teamId: user.teamId };
        } else if (user.role === 'Employee' || user.role === 'Guest') {
            const userDoc = await db.collection('users').findOne({ _id: new ObjectId(user.id) });
            const tasksForUser = await db.collection('tasks').find({ assigneeIds: user.id }).project({ projectId: 1 }).toArray();
            const projectIdsFromTasks = tasksForUser.map(t => t.projectId);
            const allProjectIds = [...new Set([...projectIdsFromTasks, userDoc?.projectId].filter(Boolean))];
            projectsQuery = { _id: { $in: allProjectIds.map(id => new ObjectId(id)) } };
        }
        
        const projects = await db.collection('projects').find(projectsQuery).sort({ startDate: -1 }).toArray();
        const projectIds = projects.map(p => p._id.toHexString());
        
        const tasks = projectIds.length > 0 ? await db.collection('tasks').find({ projectId: { $in: projectIds } }).toArray() : [];
        const financials = projectIds.length > 0 ? await db.collection('financials').find({ projectId: { $in: projectIds } }).toArray() : [];
        
        const organizationSettings = { name: 'מנהל פרויקטים חכם', logoUrl: '' };

        res.json({
            users: allUsers.map(u => ({ ...u, id: u._id.toHexString() })),
            teams: teams.map(t => ({ ...t, id: t._id.toHexString() })),
            projects: projects.map(p => ({ ...p, id: p._id.toHexString() })),
            tasks: tasks.map(t => getFullTaskViewModel(t, userMap)),
            financials: financials.map(f => ({ ...f, id: f._id.toHexString() })),
            organizationSettings,
        });

    } catch (error) {
        logger.error({ message: 'Failed to bootstrap initial data', context: { userId: user.id, role: user.role }, error });
        next(error);
    }
};
