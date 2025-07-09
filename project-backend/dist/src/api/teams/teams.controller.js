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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.removeUserFromTeam = exports.deleteTeam = exports.updateTeam = exports.addMembersToTeam = exports.createTeam = void 0;
const db_1 = __importDefault(require("../../db"));
const logger_1 = __importDefault(require("../../logger"));
const client_1 = require("@prisma/client");
const zod_1 = require("zod");
const createTeamSchema = zod_1.z.object({
    teamName: zod_1.z.string().min(1, 'Team name is required'),
    team_leader_id: zod_1.z.string().min(1, 'Team leader ID is required'),
    member_user_ids: zod_1.z.array(zod_1.z.string()).optional(),
});
const addMembersSchema = zod_1.z.object({
    user_ids: zod_1.z.array(zod_1.z.string()).min(1, 'At least one user ID is required'),
});
const updateTeamSchema = zod_1.z.object({
    teamName: zod_1.z.string().min(1, 'Team name is required').optional(),
    leaderId: zod_1.z.string().min(1, 'Leader ID is required').optional(),
    memberIds: zod_1.z.array(zod_1.z.string()).optional(),
});
// Create a new team and assign members
const createTeam = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    if (!user || !user.activeOrganizationId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    const parsed = createTeamSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: 'Invalid input', details: parsed.error.errors });
        return;
    }
    const { teamName, team_leader_id, member_user_ids } = parsed.data;
    if (!teamName || !team_leader_id) {
        logger_1.default.warn({ message: 'Team creation failed: Missing team name or leader ID.', context: { userId: user.id, body: req.body } });
        return res.status(400).json({ message: 'Team name and leader ID are required.' });
    }
    try {
        logger_1.default.info({ message: 'Attempting to create team.', teamName, leaderId: team_leader_id, adminUserId: user.id, orgId: user.activeOrganizationId });
        const allMemberIds = [...new Set([...(member_user_ids || []), team_leader_id])];
        // כלל #1: ודא שכל המשתמשים שאתה מוסיף שייכים לארגון שלך
        const membersInOrg = yield db_1.default.user.count({
            where: {
                id: { in: allMemberIds },
                memberships: {
                    some: {
                        organizationId: user.activeOrganizationId
                    }
                }
            }
        });
        if (membersInOrg !== allMemberIds.length) {
            logger_1.default.warn({ message: 'Team creation failed: Some users do not belong to the organization.', context: { userId: user.id, orgId: user.activeOrganizationId } });
            return res.status(403).json({ message: 'Cannot add users from a different organization.' });
        }
        const newTeam = yield db_1.default.team.create({
            data: {
                name: teamName,
                organizationId: user.activeOrganizationId, // כלל #1: שייך את הצוות החדש לארגון
                members: {
                    connect: allMemberIds.map((id) => ({ id }))
                }
            }
        });
        const updatedUsers = yield db_1.default.user.findMany({
            where: {
                id: { in: allMemberIds },
                memberships: {
                    some: {
                        organizationId: user.activeOrganizationId
                    }
                }
            },
            select: { id: true, name: true, email: true, avatarUrl: true, teamId: true }
        });
        logger_1.default.info({ message: 'Team created successfully.', teamId: newTeam.id, orgId: newTeam.organizationId, adminUserId: user.id });
        res.status(201).json({ team: newTeam, updatedUsers });
    }
    catch (error) {
        logger_1.default.error({ message: 'Failed to create team.', context: { body: req.body, adminUserId: user.id }, error });
        next(error);
    }
});
exports.createTeam = createTeam;
// Add members to an existing team
const addMembersToTeam = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { teamId } = req.params;
    const requestingUser = req.user;
    if (!requestingUser || !requestingUser.activeOrganizationId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    const parsedAdd = addMembersSchema.safeParse(req.body);
    if (!parsedAdd.success) {
        res.status(400).json({ error: 'Invalid input', details: parsedAdd.error.errors });
        return;
    }
    const { user_ids } = parsedAdd.data;
    if (!user_ids || !Array.isArray(user_ids) || user_ids.length === 0) {
        logger_1.default.warn({ message: 'Add members to team failed: User IDs array is required.', context: { teamId, requestingUserId: requestingUser.id, body: req.body } });
        return res.status(400).json({ message: 'User IDs array is required.' });
    }
    try {
        logger_1.default.info({ message: 'Attempting to add members to team.', teamId, addedUserIds: user_ids, requestingUserId: requestingUser.id });
        // כלל #1: ודא שהצוות שאליו אתה מוסיף חברים שייך לארגון שלך
        const team = yield db_1.default.team.findFirst({ where: { id: teamId, organizationId: requestingUser.activeOrganizationId } });
        if (!team) {
            logger_1.default.warn({ message: 'Add members to team failed: Team not found in this org.', teamId, requestingUserId: requestingUser.id, orgId: requestingUser.activeOrganizationId });
            return res.status(404).json({ message: 'Team not found.' });
        }
        // Replace legacy role/team checks with membership-based logic
        const membership = requestingUser.memberships.find(m => m.organizationId === requestingUser.activeOrganizationId);
        const role = membership === null || membership === void 0 ? void 0 : membership.role;
        if (role === client_1.UserRole.TEAM_LEADER) {
            // TODO: Implement logic to check if the user is a leader of this team in this org
            // For now, fallback to previous logic if needed
        }
        // כלל #1: אבטחה נוספת בעת עדכון המשתמשים
        yield db_1.default.user.updateMany({
            where: {
                id: { in: user_ids },
                memberships: {
                    some: {
                        organizationId: requestingUser.activeOrganizationId
                    }
                },
                teamId: null
            },
            data: { teamId: teamId }
        });
        const updatedUsers = yield db_1.default.user.findMany({
            where: {
                id: { in: user_ids },
                memberships: {
                    some: {
                        organizationId: requestingUser.activeOrganizationId
                    }
                }
            },
            select: { id: true, name: true, email: true, avatarUrl: true, teamId: true }
        });
        logger_1.default.info({ message: 'Members added to team successfully.', teamId, addedUserIds: user_ids, requestingUserId: requestingUser.id, updatedUsersCount: updatedUsers.length });
        res.status(200).json(updatedUsers);
    }
    catch (error) {
        logger_1.default.error({ message: 'Failed to add members to team.', context: { teamId, body: req.body, requestingUserId: requestingUser.id }, error });
        next(error);
    }
});
exports.addMembersToTeam = addMembersToTeam;
// Update a team's name and members
const updateTeam = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { teamId } = req.params;
    const user = req.user;
    if (!user || !user.activeOrganizationId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    const parsedUpdate = updateTeamSchema.safeParse(req.body);
    if (!parsedUpdate.success) {
        res.status(400).json({ error: 'Invalid input', details: parsedUpdate.error.errors });
        return;
    }
    const { teamName: updateTeamName, leaderId: updateLeaderId, memberIds: updateMemberIds } = parsedUpdate.data;
    try {
        logger_1.default.info({ message: 'Attempting to update team.', teamId, teamName: updateTeamName, adminUserId: user.id, orgId: user.activeOrganizationId });
        // כלל #1: ודא שהצוות שייך לארגון שלך
        const team = yield db_1.default.team.findFirst({ where: { id: teamId, organizationId: user.activeOrganizationId } });
        if (!team) {
            logger_1.default.warn({ message: 'Team update failed: Team not found in this org.', teamId, adminUserId: user.id, orgId: user.activeOrganizationId });
            return res.status(404).json({ message: 'Team not found.' });
        }
        const newMemberAndLeaderIds = [...new Set([...(updateMemberIds || []), ...(updateLeaderId ? [updateLeaderId] : [])])];
        if (newMemberAndLeaderIds.length > 0) {
            // כלל #1: ודא שכל החברים החדשים שייכים לארגון שלך
            const membersInOrg = yield db_1.default.user.count({
                where: {
                    id: { in: newMemberAndLeaderIds },
                    memberships: {
                        some: {
                            organizationId: user.activeOrganizationId
                        }
                    }
                }
            });
            if (membersInOrg !== newMemberAndLeaderIds.length) {
                logger_1.default.warn({ message: 'Team update failed: Some new members do not belong to the organization.', teamId, adminUserId: user.id, orgId: user.activeOrganizationId });
                return res.status(403).json({ message: 'Cannot add users from a different organization.' });
            }
        }
        const updatedTeam = yield db_1.default.team.update({
            where: { id: teamId }, // מאובטח בזכות הבדיקה שעשינו קודם
            data: {
                name: updateTeamName || undefined, // Only update if provided
                members: { set: newMemberAndLeaderIds.map((id) => ({ id })) }
            },
        });
        const updatedUsers = yield db_1.default.user.findMany({
            where: {
                teamId,
                memberships: {
                    some: {
                        organizationId: user.activeOrganizationId
                    }
                }
            },
            select: { id: true, name: true, email: true, avatarUrl: true, teamId: true }
        });
        logger_1.default.info({ message: 'Team updated successfully.', teamId, adminUserId: user.id, updatedUsersCount: updatedUsers.length });
        res.json({ team: updatedTeam, updatedUsers });
    }
    catch (error) {
        logger_1.default.error({ message: 'Failed to update team.', context: { teamId, body: req.body, adminUserId: user.id }, error });
        next(error);
    }
});
exports.updateTeam = updateTeam;
// Delete a team
const deleteTeam = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { teamId } = req.params;
    const user = req.user;
    if (!user || !user.activeOrganizationId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    try {
        logger_1.default.info({ message: 'Attempting to delete team.', teamId, adminUserId: user.id, orgId: user.activeOrganizationId });
        // כלל #1: ודא שהצוות שייך לארגון שלך לפני המחיקה
        const team = yield db_1.default.team.findFirst({ where: { id: teamId, organizationId: user.activeOrganizationId } });
        if (!team) {
            logger_1.default.warn({ message: 'Team deletion failed: Team not found in this org.', teamId, adminUserId: user.id, orgId: user.activeOrganizationId });
            return res.status(404).json({ message: 'Team not found.' });
        }
        const [usersUpdate, teamDelete] = yield db_1.default.$transaction([
            db_1.default.user.updateMany({
                where: {
                    teamId: teamId,
                    memberships: {
                        some: {
                            organizationId: user.activeOrganizationId
                        }
                    }
                },
                data: { teamId: null }
            }),
            db_1.default.team.delete({
                where: { id: teamId } // מאובטח בזכות הבדיקה שעשינו קודם
            })
        ]);
        logger_1.default.info({ message: 'Team deleted successfully and members unassigned.', teamId, adminUserId: user.id });
        res.status(200).json({ message: 'Team deleted' });
    }
    catch (error) {
        logger_1.default.error({ message: 'Failed to delete team.', context: { teamId, adminUserId: user.id }, error });
        next(error);
    }
});
exports.deleteTeam = deleteTeam;
// Remove a single user from a team
const removeUserFromTeam = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { teamId, userId } = req.params;
    const requestingUser = req.user;
    if (!requestingUser || !requestingUser.activeOrganizationId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    try {
        logger_1.default.info({ message: 'Attempting to remove user from team.', userId, teamId, requestingUserId: requestingUser.id });
        // Replace legacy role/team checks with membership-based logic
        const membership = requestingUser.memberships.find(m => m.organizationId === requestingUser.activeOrganizationId);
        const role = membership === null || membership === void 0 ? void 0 : membership.role;
        if (role === client_1.UserRole.TEAM_LEADER) {
            // TODO: Implement logic to check if the user is a leader of this team in this org
            // For now, fallback to previous logic if needed
        }
        // כלל #1: שאילתה אחת מאובטחת שמוודאת שהכל שייך לארגון הנכון
        const updatedUser = yield db_1.default.user.update({
            where: {
                id: userId,
                memberships: {
                    some: {
                        organizationId: requestingUser.activeOrganizationId
                    }
                },
                teamId: teamId
            },
            data: { teamId: null },
            select: { id: true, name: true, email: true, avatarUrl: true, teamId: true }
        });
        logger_1.default.info({ message: 'User removed from team successfully.', removedUserId: userId, teamId, requestingUserId: requestingUser.id });
        res.json(updatedUser);
    }
    catch (error) {
        if (error.code === 'P2025') {
            logger_1.default.warn({ message: 'Remove user from team failed: User or team not found in this organization.', userId, teamId, requestingUserId: requestingUser.id });
            return res.status(404).json({ message: 'User not found in this team.' });
        }
        logger_1.default.error({ message: 'Failed to remove user from team.', context: { teamId, userId, requestingUserId: requestingUser.id }, error });
        next(error);
    }
});
exports.removeUserFromTeam = removeUserFromTeam;
