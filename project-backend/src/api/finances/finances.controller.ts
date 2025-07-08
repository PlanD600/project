// project-backend/src/api/finances/finances.controller.ts
import { Request, Response, NextFunction, RequestHandler } from 'express';
import prisma from '../../db';
import logger from '../../logger';
import { UserRole } from '@prisma/client';
import { z } from 'zod';

const createFinanceSchema = z.object({
  type: z.enum(['Income', 'Expense']),
  amount: z.preprocess(val => typeof val === 'string' ? parseFloat(val) : val, z.number().min(0, 'Amount must be non-negative')),
  description: z.string().optional(),
  date: z.string().min(1, 'Date is required'),
  projectId: z.string().min(1, 'Project ID is required'),
  source: z.string().min(1, 'Source is required'),
});

export const addFinancialEntry: RequestHandler = async (req, res, next) => {
    const parsed = createFinanceSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input', details: parsed.error.errors });
      return;
    }
    const { type, amount, description, date, projectId, source } = parsed.data;
    const user = req.user;

    if (!user || !user.activeOrganizationId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    if (!type || !amount || !date || !projectId || !source) {
        logger.warn({ message: 'Attempt to add financial entry failed: Missing required data.', context: { userId: user.id, body: req.body } });
        return res.status(400).json({ message: 'Missing required financial data.' });
    }

    // כלל #2: שימוש ב-enum במקום טקסט
    // Find membership for active org
    const membership = user.memberships.find(m => m.organizationId === user.activeOrganizationId);
    const role = membership?.role;
    if (type === 'Income' && role !== UserRole.ORG_ADMIN) {
        logger.warn({ message: 'Unauthorized attempt to add income entry.', context: { userId: user.id, role } });
        return res.status(403).json({ message: 'Not authorized to add income entries.' });
    }

    try {
        // כלל #1: ודא שהפרויקט שאליו אתה מוסיף רשומה שייך לארגון שלך
        const project = await prisma.project.findFirst({
            where: { id: projectId, organizationId: user.activeOrganizationId }
        });

        if (!project) {
            logger.warn({ message: 'Add financial entry failed: Project not found in organization.', projectId, userId: user.id, orgId: user.activeOrganizationId });
            return res.status(404).json({ message: 'Project not found.' });
        }

        const newEntry = await prisma.financialTransaction.create({
            data: {
                type,
                amount, // already a number from zod
                description,
                date: new Date(date),
                source,
                projectId,
                organizationId: user.activeOrganizationId // כלל #1: שייך את הרשומה החדשה לארגון
            }
        });
        
        logger.info({ message: 'Financial entry added successfully.', entryId: newEntry.id, userId: user.id, projectId });
        res.status(201).json(newEntry);
    } catch (error) {
        logger.error({ message: 'Failed to add financial entry.', context: { body: req.body, userId: user.id }, error });
        next(error);
    }
};

export const getFinancialSummary: RequestHandler = async (req, res, next) => {
    const user = req.user;
    const { team_id } = req.query as { team_id?: string };

    if (!user || !user.activeOrganizationId) {
        logger.warn({ message: 'Unauthorized attempt to get financial summary: No user or org in request.' });
        return res.status(401).json({ message: 'Not authorized' });
    }

    try {
        // Find membership for active org
        const membership = user.memberships.find(m => m.organizationId === user.activeOrganizationId);
        const role = membership?.role;
        logger.info({ message: 'Attempting to get financial summary.', userId: user.id, role, orgId: user.activeOrganizationId, team_id_filter: team_id });
        
        // כלל #2: שימוש ב-enum
        if (role === UserRole.ORG_ADMIN) {
            // כלל #1: כל השאילתות מתייחסות רק לארגון של המשתמש
            let whereClause: any = { memberships: { some: { organizationId: user.activeOrganizationId } } };

            if (team_id) {
                // כלל #1: ודא שהצוות שייך לארגון שלך
                const projectsInTeam = await prisma.project.findMany({
                    where: { teamId: team_id, organizationId: user.activeOrganizationId },
                    select: { id: true }
                });
                const projectIds = projectsInTeam.map((p: any) => p.id);
                whereClause.projectId = { in: projectIds };
                logger.info({ message: 'Admin filtering financial summary by team projects.', teamId: team_id, projectIdsCount: projectIds.length });
            }

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

        } else if (role === UserRole.TEAM_LEADER) {
            // TODO: Implement logic to fetch projects for teams this user leads in this org
            // Currently, user.teamId is not available. Implement team lookup via memberships or another method if needed.
            res.status(403).json({ message: 'Not authorized to view financial summary (team context not implemented)' });
        } else {
            logger.warn({ message: 'User not authorized to view financial summary.', userId: user.id, role });
            res.status(403).json({ message: 'Not authorized to view financial summary' });
        }
    } catch (error) {
        logger.error({ message: 'Failed to get financial summary.', context: { query: req.query, userId: user?.id }, error });
        next(error);
    }
};