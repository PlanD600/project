// project-backend/src/api/finances/finances.controller.ts
import { RequestHandler } from 'express';
import prisma from '../../db';
import logger from '../../logger';
import { UserRole } from '@prisma/client';

export const addFinancialEntry: RequestHandler = async (req, res, next) => {
    const { type, amount, description, date, projectId, source } = req.body;
    const user = req.user;

    if (!type || !amount || !date || !projectId || !source) {
        logger.warn({ message: 'Attempt to add financial entry failed: Missing required data.', context: { userId: user?.id, body: req.body } });
        return res.status(400).json({ message: 'Missing required financial data.' });
    }
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || !isFinite(parsedAmount)) {
        logger.warn({ message: 'Attempt to add financial entry failed: Invalid amount.', context: { userId: user?.id, amount } });
        return res.status(400).json({ message: 'Amount must be a valid number.' });
    }

    if (type === 'Income' && user?.role !== 'ADMIN') {
        logger.warn({ message: 'Unauthorized attempt to add income entry.', context: { userId: user?.id, role: user?.role } });
        return res.status(403).json({ message: 'Not authorized to add income entries.' });
    }

    try {
        const newEntry = await prisma.financialTransaction.create({
            data: {
                type,
                amount: parsedAmount,
                description,
                date: new Date(date),
                source,
                project: {
                    connect: { id: projectId }
                }
            }
        });
        
        logger.info({ message: 'Financial entry added successfully.', entryId: newEntry.id, userId: user?.id, projectId });
        res.status(201).json(newEntry);
    } catch (error) {
        logger.error({ message: 'Failed to add financial entry.', context: { body: req.body, userId: user?.id }, error });
        next(error);
    }
};

export const getFinancialSummary: RequestHandler = async (req, res, next) => {
    const user = req.user;
    const { team_id } = req.query as { team_id?: string };

    if (!user) {
        logger.warn({ message: 'Unauthorized attempt to get financial summary: No user in request.' });
        return res.status(401).json({ message: 'Not authorized' });
    }

    try {
        logger.info({ message: 'Attempting to get financial summary.', userId: user.id, role: user.role, team_id_filter: team_id });

        if (user.role === 'ADMIN') {
            let whereClause: any = {};
            // If filtering by a specific team, find that team's projects first
            if (team_id) {
                const projectsInTeam = await prisma.project.findMany({
                    where: { teamId: team_id },
                    select: { id: true }
                });
                const projectIds = projectsInTeam.map((p: any) => p.id);
                whereClause.projectId = { in: projectIds };
                logger.info({ message: 'Admin filtering financial summary by team projects.', teamId: team_id, projectIdsCount: projectIds.length });
            }

            // Run two separate aggregations for income and expense
            const totalIncomeResult = await prisma.financialTransaction.aggregate({
                _sum: { amount: true },
                where: { ...whereClause, type: 'Income' }
            });
            const totalExpenseResult = await prisma.financialTransaction.aggregate({
                _sum: { amount: true },
                where: { ...whereClause, type: 'Expense' }
            });

            logger.info({ message: 'Admin financial summary fetched successfully.', totalIncome: totalIncomeResult._sum.amount, totalExpense: totalExpenseResult._sum.amount });
            res.json({
                totalIncome: totalIncomeResult._sum.amount || 0,
                totalExpense: totalExpenseResult._sum.amount || 0,
            });

        } else if (user.role === 'TEAM_MANAGER' && user.teamId) {
            // Find all projects for the TEAM_MANAGER's team
            const projectsInTeam = await prisma.project.findMany({
                where: { teamId: user.teamId },
                select: { id: true }
            });
            const projectIds = projectsInTeam.map((p: any) => p.id);
            logger.info({ message: 'Team manager getting financial summary for team projects.', userId: user.id, teamId: user.teamId, projectIdsCount: projectIds.length });

            // Aggregate expenses ONLY for those projects
            const result = await prisma.financialTransaction.aggregate({
                _sum: { amount: true },
                where: {
                    projectId: { in: projectIds },
                    type: 'Expense'
                }
            });
            
            logger.info({ message: 'Team manager financial summary fetched successfully.', totalTeamExpenses: result._sum.amount });
            res.json({ totalTeamExpenses: result._sum.amount || 0 });
        } else {
            logger.warn({ message: 'User not authorized or team manager without team to view financial summary.', userId: user.id, role: user.role, teamId: user.teamId });
            // No data for other roles, or TEAM_MANAGER without a team
            res.status(403).json({ message: 'Not authorized to view financial summary' });
        }
    } catch (error) {
        logger.error({ message: 'Failed to get financial summary.', context: { query: req.query, userId: user?.id }, error });
        next(error);
    }
};