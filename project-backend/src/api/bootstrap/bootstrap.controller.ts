// project-backend/src/api/bootstrap/bootstrap.controller.ts
import { Request, Response, NextFunction, RequestHandler } from 'express';
import prisma from '../../db';
import logger from '../../logger';
import { UserRole } from '@prisma/client';

export const getInitialData: RequestHandler = async (req, res, next) => {
    const user = req.user;
    if (!user || !user.activeOrganizationId) {
        logger.warn({ message: 'Unauthorized attempt to get initial data: No user or active organization in request.' });
        return res.status(401).json({ message: 'Not authorized' });
    }

    try {
        const membership = user.memberships.find(m => m.organizationId === user.activeOrganizationId);
        logger.info({ message: 'Attempting to fetch initial data for user.', userId: user.id, orgId: user.activeOrganizationId, role: membership?.role });
        
        const orgId = user.activeOrganizationId;

        // "כלל הזהב": כל השאילתות מסוננות לפי הארגון
        // Temporary implementation until schema migration
        const allUsersQuery = prisma.user.findMany({
            where: { memberships: { some: { organizationId: orgId } } }, // Temporary until schema migration
            select: { 
                id: true, 
                name: true, 
                email: true, 
                teamId: true, 
                avatarUrl: true
            }
        });
        
        const allTeamsQuery = prisma.team.findMany({
            where: { organizationId: orgId }
        });
        
        const organizationQuery = prisma.organization.findUnique({
            where: { id: orgId }
        });

        let projectsQuery;
        // כלל #2: שימוש ב-enum - updated for multi-tenant roles (temporary)
        if (membership?.role === 'ORG_ADMIN' || membership?.role === 'TEAM_LEADER') {
            projectsQuery = prisma.project.findMany({
                where: { organizationId: orgId, status: 'active' }, // כלל #1
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
        
        // Transform tasks to include assigneeIds instead of assignees
        const transformedTasks = tasks.map(task => ({
            ...task,
            assigneeIds: task.assignees.map((a: { id: string }) => a.id),
            description: task.description ?? ''
        }));
        
        // Remove the assignees property from the response
        const tasksWithoutAssignees = transformedTasks.map(({ assignees, ...task }) => task);
        
        // שולפים את שם הארגון האמיתי
        const organizationSettings = { name: organization?.name || 'My Company', logoUrl: '' };

        logger.info({ message: 'Initial data fetched successfully.', userId: user.id, dataCounts: { users: allUsers.length, teams: teams.length, projects: projects.length, tasks: tasksWithoutAssignees.length, financials: financials.length } });

        res.json({
            users: allUsers,
            teams: teams,
            projects: projects,
            tasks: tasksWithoutAssignees,
            financials: financials,
            organizationSettings,
        });

    } catch (error) {
        const membership = user.memberships.find(m => m.organizationId === user.activeOrganizationId);
        logger.error({ message: 'Failed to bootstrap initial data.', context: { userId: user.id, role: membership?.role }, error });
        next(error);
    }
};