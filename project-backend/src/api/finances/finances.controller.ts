


import { RequestHandler } from 'express';
import { getDb } from '../../db';
import { ObjectId } from 'mongodb';
import logger from '../../logger';

export const addFinancialEntry: RequestHandler = async (req, res, next) => {
    const { type, amount, description, date, projectId, source } = req.body;
    const user = req.user;

    if (!type || !amount || !date || !projectId || !source) {
        return res.status(400).json({ message: 'Missing required financial data.' });
    }
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || !isFinite(parsedAmount)) {
        return res.status(400).json({ message: 'Amount must be a valid number.' });
    }

    if (type === 'Income' && user?.role !== 'Super Admin') {
        return res.status(403).json({ message: 'Not authorized to add income entries.' });
    }

    try {
        const db = getDb();
        const newEntry = {
            type,
            amount: parsedAmount,
            description,
            date,
            projectId,
            source,
            createdAt: new Date()
        };
        const result = await db.collection('financials').insertOne(newEntry);
        
        logger.info({ message: 'Financial entry added', entryId: result.insertedId, userId: user?.id });
        res.status(201).json({ id: result.insertedId, ...newEntry });
    } catch (error) {
        logger.error({ message: 'Failed to add financial entry', context: { body: req.body, userId: user?.id }, error });
        next(error);
    }
};

export const getFinancialSummary: RequestHandler = async (req, res, next) => {
    const user = req.user;
    const { team_id } = req.query;

    try {
        const db = getDb();
        if (user?.role === 'Super Admin') {
            const projectMatch = team_id ? 
                { $lookup: { from: 'projects', localField: 'projectId', foreignField: '_id', as: 'project' } } : 
                { $addFields: {} };
            const teamMatch = team_id ? { $match: { 'project.teamId': team_id } } : { $match: {} };

            const result = await db.collection('financials').aggregate([
                projectMatch as any, // Cast because lookup type is complex
                teamMatch,
                {
                    $group: {
                        _id: null,
                        totalIncome: { $sum: { $cond: [{ $eq: ['$type', 'Income'] }, '$amount', 0] } },
                        totalExpense: { $sum: { $cond: [{ $eq: ['$type', 'Expense'] }, '$amount', 0] } }
                    }
                }
            ]).toArray();

            res.json(result[0] || { totalIncome: 0, totalExpense: 0 });

        } else if (user?.role === 'Team Leader') {
            const projectsInTeam = await db.collection('projects').find({ teamId: user.teamId }).project({ _id: 1 }).toArray();
            const projectIds = projectsInTeam.map(p => p._id.toHexString());

            const result = await db.collection('financials').aggregate([
                { $match: { projectId: { $in: projectIds }, type: 'Expense' } },
                { $group: { _id: null, totalTeamExpenses: { $sum: '$amount' } } }
            ]).toArray();
            
            res.json(result[0] || { totalTeamExpenses: 0 });
        }
    } catch (error) {
        logger.error({ message: 'Failed to get financial summary', context: { query: req.query, userId: user?.id }, error });
        next(error);
    }
};