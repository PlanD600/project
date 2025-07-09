"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getInitialData = void 0;
const db_1 = __importDefault(require("../../db"));
const logger_1 = __importDefault(require("../../logger"));
const getInitialData = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    if (!user || !user.activeOrganizationId) {
        logger_1.default.warn({ message: 'Unauthorized attempt to get initial data: No user or active organization in request.' });
        return res.status(401).json({ message: 'Not authorized' });
    }
    try {
        const membership = user.memberships.find(m => m.organizationId === user.activeOrganizationId);
        logger_1.default.info({ message: 'Attempting to fetch initial data for user.', userId: user.id, orgId: user.activeOrganizationId, role: membership === null || membership === void 0 ? void 0 : membership.role });
        const orgId = user.activeOrganizationId;
        // "כלל הזהב": כל השאילתות מסוננות לפי הארגון
        // Temporary implementation until schema migration
        const allUsersQuery = db_1.default.user.findMany({
            where: { memberships: { some: { organizationId: orgId } } }, // Temporary until schema migration
            select: {
                id: true,
                name: true,
                email: true,
                teamId: true,
                avatarUrl: true
            }
        });
        const allTeamsQuery = db_1.default.team.findMany({
            where: { organizationId: orgId }
        });
        const organizationQuery = db_1.default.organization.findUnique({
            where: { id: orgId }
        });
        let projectsQuery;
        // כלל #2: שימוש ב-enum - updated for multi-tenant roles (temporary)
        if ((membership === null || membership === void 0 ? void 0 : membership.role) === 'ORG_ADMIN' || (membership === null || membership === void 0 ? void 0 : membership.role) === 'TEAM_LEADER') {
            projectsQuery = db_1.default.project.findMany({
                where: { organizationId: orgId, status: 'active' }, // כלל #1
                orderBy: { startDate: 'desc' }
            });
        }
        else { // Employee or GUEST
            const tasksForUser = yield db_1.default.task.findMany({
                where: {
                    organizationId: orgId, // כלל #1
                    assignees: { some: { id: user.id } }
                },
                select: { projectId: true }
            });
            const projectIdsFromTasks = tasksForUser.map(t => t.projectId);
            const projectIds = [...new Set(projectIdsFromTasks)];
            projectsQuery = db_1.default.project.findMany({
                where: { organizationId: orgId, id: { in: projectIds }, status: 'active' }, // כלל #1
                orderBy: { startDate: 'desc' }
            });
        }
        const [allUsers, teams, projects, organization] = yield Promise.all([allUsersQuery, allTeamsQuery, projectsQuery, organizationQuery]);
        const projectIds = projects.map((p) => p.id);
        let tasksQuery, financialsQuery;
        if (projectIds.length > 0) {
            tasksQuery = db_1.default.task.findMany({
                where: { organizationId: orgId, projectId: { in: projectIds } }, // כלל #1
                include: {
                    assignees: { select: { id: true, name: true, avatarUrl: true } },
                    comments: {
                        include: { user: { select: { id: true, name: true, avatarUrl: true } } },
                        orderBy: { timestamp: 'asc' }
                    }
                }
            });
            financialsQuery = db_1.default.financialTransaction.findMany({
                where: { organizationId: orgId, projectId: { in: projectIds } } // כלל #1
            });
        }
        else {
            tasksQuery = Promise.resolve([]);
            financialsQuery = Promise.resolve([]);
        }
        const [tasks, financials] = yield Promise.all([tasksQuery, financialsQuery]);
        // Transform tasks to include assigneeIds instead of assignees
        const transformedTasks = tasks.map(task => {
            var _a;
            return (Object.assign(Object.assign({}, task), { assigneeIds: task.assignees.map((a) => a.id), description: (_a = task.description) !== null && _a !== void 0 ? _a : '' }));
        });
        // Remove the assignees property from the response
        const tasksWithoutAssignees = transformedTasks.map((_a) => {
            var { assignees } = _a, task = __rest(_a, ["assignees"]);
            return task;
        });
        // שולפים את שם הארגון האמיתי
        const organizationSettings = { name: (organization === null || organization === void 0 ? void 0 : organization.name) || 'My Company', logoUrl: '' };
        logger_1.default.info({ message: 'Initial data fetched successfully.', userId: user.id, dataCounts: { users: allUsers.length, teams: teams.length, projects: projects.length, tasks: tasksWithoutAssignees.length, financials: financials.length } });
        res.json({
            users: allUsers,
            teams: teams,
            projects: projects,
            tasks: tasksWithoutAssignees,
            financials: financials,
            organizationSettings,
        });
    }
    catch (error) {
        const membership = user.memberships.find(m => m.organizationId === user.activeOrganizationId);
        logger_1.default.error({ message: 'Failed to bootstrap initial data.', context: { userId: user.id, role: membership === null || membership === void 0 ? void 0 : membership.role }, error });
        next(error);
    }
});
exports.getInitialData = getInitialData;
