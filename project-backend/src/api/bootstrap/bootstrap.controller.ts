// project-backend/src/api/bootstrap/bootstrap.controller.ts
import { Request, Response, NextFunction, RequestHandler } from 'express';
import prisma from '../../db';
import logger from '../../logger';
import { UserRole } from '@prisma/client';

export const getInitialData: RequestHandler = async (req, res, next) => {
    const user = req.user;
    if (!user || !user.organizationId) {
        logger.warn({ message: 'Unauthorized attempt to get initial data: No user or org in request.' });
        return res.status(401).json({ message: 'Not authorized' });
    }

    try {
        logger.info({ message: 'Attempting to fetch initial data for user.', userId: user.id, orgId: user.organizationId, role: user.role });
        
        const orgId = user.organizationId;

        // "כלל הזהב": כל השאילתות מסוננות לפי הארגון
        const allUsersQuery = prisma.user.findMany({
            where: { organizationId: orgId },
            select: { id: true, name: true, email: true, role: true, teamId: true, avatarUrl: true }
        });
        const allTeamsQuery = prisma.team.findMany({
            where: { organizationId: orgId }
        });
        const organizationQuery = prisma.organization.findUnique({
            where: { id: orgId }
        });

        let projectsQuery;
        // כלל #2: שימוש ב-enum
        if (user.role === UserRole.ADMIN) {
            projectsQuery = prisma.project.findMany({
                where: { organizationId: orgId, status: 'active' }, // כלל #1
                orderBy: { startDate: 'desc' }
            });
        } else if (user.role === UserRole.TEAM_MANAGER && user.teamId) {
            projectsQuery = prisma.project.findMany({
                where: { organizationId: orgId, teamId: user.teamId, status: 'active' }, // כלל #1
                orderBy: { startDate: 'desc' }
            });
        } else { // Employee or GUEST
            const tasksForUser = await prisma.task.findMany({
                where: { 
                organizationId: orgId, // כלל #1
                    assignees: { some: { id: user.id } } 
                },
                select: { projectId: true }
            });
            const projectIdsFromTasks = tasksForUser.map(t => t.projectId);
            const projectIds = [...new Set(projectIdsFromTasks)];
            
            projectsQuery = prisma.project.findMany({
                where: { organizationId: orgId, id: { in: projectIds }, status: 'active' }, // כלל #1
                orderBy: { startDate: 'desc' }
            });
        }

        const [allUsers, teams, projects, organization] = await Promise.all([allUsersQuery, allTeamsQuery, projectsQuery, organizationQuery]);
        const projectIds = projects.map((p: { id: string }) => p.id);

        let tasksQuery, financialsQuery;
        if (projectIds.length > 0) {
            tasksQuery = prisma.task.findMany({
                where: { organizationId: orgId, projectId: { in: projectIds } }, // כלל #1
                include: {
                    assignees: { select: { id: true, name: true, avatarUrl: true } },
                    comments: {
                        include: { user: { select: { id: true, name: true, avatarUrl: true } } },
                        orderBy: { timestamp: 'asc' }
                    }
                }
            });
            financialsQuery = prisma.financialTransaction.findMany({
                where: { organizationId: orgId, projectId: { in: projectIds } } // כלל #1
            });
        } else {
            tasksQuery = Promise.resolve([]);
            financialsQuery = Promise.resolve([]);
        }

        const [tasks, financials] = await Promise.all([tasksQuery, financialsQuery]);
        // שולפים את שם הארגון האמיתי
        const organizationSettings = { name: organization?.name || 'My Company', logoUrl: '' };

        logger.info({ message: 'Initial data fetched successfully.', userId: user.id, dataCounts: { users: allUsers.length, teams: teams.length, projects: projects.length, tasks: tasks.length, financials: financials.length } });

        res.json({
            users: allUsers,
            teams: teams,
            projects: projects,
            tasks: tasks,
            financials: financials,
            organizationSettings,
        });

    } catch (error) {
        logger.error({ message: 'Failed to bootstrap initial data.', context: { userId: user.id, role: user.role }, error });
        next(error);
    }
};