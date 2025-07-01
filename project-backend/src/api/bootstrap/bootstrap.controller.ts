import { RequestHandler } from 'express';
import prisma from '../../db';
import logger from '../../logger';

export const getInitialData: RequestHandler = async (req, res, next) => {
    const user = req.user;
    if (!user) return res.status(401).json({ message: 'Not authorized' });

    try {
        const allUsersQuery = prisma.user.findMany({
            select: { id: true, name: true, email: true, role: true, teamId: true, avatarUrl: true }
        });
        const allTeamsQuery = prisma.team.findMany();

        let projectsQuery;
        if (user.role === 'Super Admin') {
            projectsQuery = prisma.project.findMany({
                where: { status: 'active' },
                orderBy: { startDate: 'desc' }
            });
        } else if (user.role === 'Team Leader' && user.teamId) {
            projectsQuery = prisma.project.findMany({
                where: { teamId: user.teamId, status: 'active' },
                orderBy: { startDate: 'desc' }
            });
        } else { // Employee or Guest
            const tasksForUser = await prisma.task.findMany({
                where: { 
                    assignees: { some: { id: user.id } } // Correct way to query many-to-many
                },
                select: { projectId: true }
            });
            const projectIdsFromTasks = tasksForUser.map(t => t.projectId);
            const projectIds = [...new Set(projectIdsFromTasks)];
            
            projectsQuery = prisma.project.findMany({
                where: { id: { in: projectIds }, status: 'active' },
                orderBy: { startDate: 'desc' }
            });
        }

        const [allUsers, allTeams, projects] = await Promise.all([allUsersQuery, projectsQuery, allTeamsQuery]);
        const projectIds = projects.map((p: { id: string }) => p.id);

        let tasksQuery, financialsQuery;
        if (projectIds.length > 0) {
            tasksQuery = prisma.task.findMany({
                where: { projectId: { in: projectIds } },
                include: {
                    assignees: { select: { id: true, name: true, avatarUrl: true } },
                    comments: {
                        include: {
                            user: { select: { id: true, name: true, avatarUrl: true } }
                        },
                        orderBy: { timestamp: 'asc' }
                    }
                }
            });
            financialsQuery = prisma.financialTransaction.findMany({
                where: { projectId: { in: projectIds } }
            });
        } else {
            tasksQuery = Promise.resolve([]);
            financialsQuery = Promise.resolve([]);
        }

        const [tasks, financials] = await Promise.all([tasksQuery, financialsQuery]);
        const organizationSettings = { name: 'מנהל פרויקטים חכם', logoUrl: '' };

        res.json({
            users: allUsers,
            teams: allTeams,
            projects: projects,
            tasks: tasks,
            financials: financials,
            organizationSettings,
        });

    } catch (error) {
        logger.error({ message: 'Failed to bootstrap initial data', context: { userId: user.id, role: user.role }, error });
        next(error);
    }
};