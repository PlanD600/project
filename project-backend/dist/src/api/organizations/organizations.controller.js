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
exports.removeUserFromOrganization = exports.inviteUserToOrganization = exports.getUserMemberships = exports.switchOrganization = exports.updateOrganization = exports.createOrganization = exports.getAllOrganizations = void 0;
const express_async_handler_1 = __importDefault(require("express-async-handler"));
const db_1 = __importDefault(require("../../db"));
const logger_1 = __importDefault(require("../../logger"));
const client_1 = require("@prisma/client");
const zod_1 = require("zod");
const createOrganizationSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Organization name is required'),
});
const updateOrganizationSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Organization name is required'),
});
const switchOrganizationSchema = zod_1.z.object({
    organizationId: zod_1.z.string().min(1, 'Organization ID is required'),
});
// @desc    Get all organizations for super admin users
// @route   GET /api/organizations
// @access  Private (Super Admin only)
exports.getAllOrganizations = (0, express_async_handler_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    if (!user) {
        res.status(401);
        throw new Error('Not authorized');
    }
    // Check if user has SUPER_ADMIN role in any organization
    const hasSuperAdminRole = user.memberships.some(membership => membership.role === client_1.UserRole.SUPER_ADMIN);
    if (!hasSuperAdminRole) {
        res.status(403);
        throw new Error('Only super administrators can access all organizations');
    }
    const organizations = yield db_1.default.organization.findMany({
        include: {
            _count: {
                select: {
                    projects: true,
                    teams: true
                }
            }
        },
        orderBy: {
            createdAt: 'desc'
        }
    });
    logger_1.default.info({ message: 'Super admin retrieved all organizations.', userId: user.id, count: organizations.length });
    res.status(200).json(organizations);
}));
// @desc    Create a new organization
// @route   POST /api/organizations
// @access  Private (Super Admin only)
exports.createOrganization = (0, express_async_handler_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    if (!user) {
        res.status(401);
        throw new Error('Not authorized');
    }
    // Check if user has SUPER_ADMIN role in any organization
    const hasSuperAdminRole = user.memberships.some(membership => membership.role === client_1.UserRole.SUPER_ADMIN);
    if (!hasSuperAdminRole) {
        res.status(403);
        throw new Error('Only super administrators can create organizations');
    }
    const parsed = createOrganizationSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: 'Invalid input', details: parsed.error.errors });
        return;
    }
    const { name } = parsed.data;
    if (!name) {
        res.status(400);
        throw new Error('Organization name is required');
    }
    // Create organization (temporary - will be updated after schema migration)
    const newOrganization = yield db_1.default.organization.create({
        data: {
            name,
        },
    });
    logger_1.default.info({ message: 'Organization created successfully.', orgId: newOrganization.id, createdBy: user.id });
    res.status(201).json(newOrganization);
}));
// @desc    Update the current user's organization details
// @route   PUT /api/organizations/me
// @access  Private (Org Admin or Super Admin)
exports.updateOrganization = (0, express_async_handler_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    if (!user || !user.activeOrganizationId) {
        res.status(401);
        throw new Error('Not authorized');
    }
    // Check if user can manage the active organization
    const membership = user.memberships.find(m => m.organizationId === user.activeOrganizationId);
    const canManageOrg = membership && (membership.role === client_1.UserRole.ORG_ADMIN || membership.role === client_1.UserRole.TEAM_LEADER);
    if (!canManageOrg) {
        res.status(403);
        throw new Error('User is not authorized to change organization settings');
    }
    const parsedUpdate = updateOrganizationSchema.safeParse(req.body);
    if (!parsedUpdate.success) {
        res.status(400).json({ error: 'Invalid input', details: parsedUpdate.error.errors });
        return;
    }
    const { name: updateName } = parsedUpdate.data;
    if (!updateName) {
        res.status(400);
        throw new Error('Organization name is required');
    }
    logger_1.default.info({ message: 'Attempting to update organization name.', orgId: user.activeOrganizationId, newName: updateName, userId: user.id });
    const updatedOrganization = yield db_1.default.organization.update({
        where: {
            id: user.activeOrganizationId,
        },
        data: {
            name: updateName,
        },
    });
    logger_1.default.info({ message: 'Organization updated successfully.', orgId: updatedOrganization.id });
    res.status(200).json(updatedOrganization);
}));
// @desc    Switch to a different organization
// @route   POST /api/organizations/switch
// @access  Private (User must be member of target organization)
exports.switchOrganization = (0, express_async_handler_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    if (!user) {
        res.status(401);
        throw new Error('Not authorized');
    }
    const parsedSwitch = switchOrganizationSchema.safeParse(req.body);
    if (!parsedSwitch.success) {
        res.status(400).json({ error: 'Invalid input', details: parsedSwitch.error.errors });
        return;
    }
    const { organizationId } = parsedSwitch.data;
    if (!organizationId) {
        res.status(400);
        throw new Error('Organization ID is required');
    }
    // Check if user is a member of the target organization
    const membership = user.memberships.find(m => m.organizationId === organizationId);
    if (!membership) {
        res.status(403);
        throw new Error('User is not a member of this organization');
    }
    // Verify the organization exists
    const organization = yield db_1.default.organization.findUnique({
        where: { id: organizationId }
    });
    if (!organization) {
        res.status(404);
        throw new Error('Organization not found');
    }
    logger_1.default.info({ message: 'User switched organization.', userId: user.id, newOrgId: organizationId, role: membership.role });
    res.status(200).json(organization);
}));
// @desc    Get user's memberships
// @route   GET /api/organizations/memberships
// @access  Private
exports.getUserMemberships = (0, express_async_handler_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    if (!user) {
        res.status(401);
        throw new Error('Not authorized');
    }
    // Temporary implementation until schema migration
    // For now, return the user's current organization as a membership
    const membership = user.memberships.find(m => m.organizationId === user.activeOrganizationId);
    const memberships = [{
            id: 'temp-membership-id',
            userId: user.id,
            organizationId: user.activeOrganizationId,
            role: membership === null || membership === void 0 ? void 0 : membership.role,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            organization: {
                id: user.activeOrganizationId,
                name: 'Current Organization', // This will be fetched from the actual organization
                createdAt: new Date().toISOString(),
            }
        }];
    logger_1.default.info({ message: 'User memberships retrieved.', userId: user.id, count: memberships.length });
    res.status(200).json(memberships);
}));
// @desc    Invite user to organization
// @route   POST /api/organizations/:organizationId/invite
// @access  Private (Org Admin or Super Admin)
exports.inviteUserToOrganization = (0, express_async_handler_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { organizationId } = req.params;
    const { email, role } = req.body;
    const user = req.user;
    if (!user || !user.activeOrganizationId) {
        res.status(401);
        throw new Error('Not authorized');
    }
    // Check if user can manage the organization
    const membership = user.memberships.find(m => m.organizationId === organizationId);
    const canManageOrg = membership && (membership.role === client_1.UserRole.ORG_ADMIN || membership.role === client_1.UserRole.TEAM_LEADER);
    if (!canManageOrg) {
        res.status(403);
        throw new Error('User is not authorized to invite users to this organization');
    }
    if (!email || !role) {
        res.status(400);
        throw new Error('Email and role are required');
    }
    // Validate role
    const validRoles = ['TEAM_MANAGER', 'EMPLOYEE']; // Temporary until schema migration
    if (!validRoles.includes(role)) {
        res.status(400);
        throw new Error('Invalid role specified');
    }
    // Find or create user
    let targetUser = yield db_1.default.user.findUnique({
        where: { email }
    });
    if (!targetUser) {
        // Create new user with temporary password
        const tempPassword = Math.random().toString(36).slice(-8);
        targetUser = yield db_1.default.user.create({
            data: {
                email,
                name: email.split('@')[0], // Use email prefix as name
                password: tempPassword, // In production, hash this password
                // role: role as any, // Temporary until schema migration - REMOVED
                // organizationId: organizationId, // Temporary until schema migration - REMOVED
            }
        });
    }
    // After creating a user with prisma.user.create, create a Membership record linking the user to the organization with the correct role.
    // Remove any role or organizationId from the user creation input.
    // For user updates, if org/role changes, update the Membership record, not the user.
    const newMembership = yield db_1.default.membership.create({
        data: {
            userId: targetUser.id,
            organizationId: organizationId,
            role: role, // Temporary until schema migration
        }
    });
    logger_1.default.info({ message: 'User invited to organization.', invitedUserId: targetUser.id, orgId: organizationId, role, invitedBy: user.id });
    res.status(201).json({
        id: newMembership.id,
        userId: targetUser.id,
        organizationId: organizationId,
        role: role,
        user: {
            id: targetUser.id,
            name: targetUser.name,
            email: targetUser.email,
        },
        organization: {
            id: organizationId,
            name: 'Organization Name', // This will be fetched from the actual organization
        }
    });
}));
// @desc    Remove user from organization
// @route   DELETE /api/organizations/:organizationId/members/:userId
// @access  Private (Org Admin or Super Admin)
exports.removeUserFromOrganization = (0, express_async_handler_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { organizationId, userId } = req.params;
    const user = req.user;
    if (!user || !user.activeOrganizationId) {
        res.status(401);
        throw new Error('Not authorized');
    }
    // Check if user can manage the organization
    const membership = user.memberships.find(m => m.organizationId === organizationId);
    const canManageOrg = membership && (membership.role === client_1.UserRole.ORG_ADMIN || membership.role === client_1.UserRole.TEAM_LEADER);
    if (!canManageOrg) {
        res.status(403);
        throw new Error('User is not authorized to remove users from this organization');
    }
    // Prevent removing yourself
    if (userId === user.id) {
        res.status(400);
        throw new Error('Cannot remove yourself from the organization');
    }
    // Find the membership to update
    const membershipToRemove = yield db_1.default.membership.findFirst({
        where: {
            userId: userId,
            organizationId: organizationId,
        }
    });
    if (!membershipToRemove) {
        res.status(404);
        throw new Error('Membership not found');
    }
    // Update the membership record
    const updatedMembership = yield db_1.default.membership.update({
        where: { id: membershipToRemove.id },
        data: {
            organizationId: '', // Set organizationId to empty string to remove it
            role: 'EMPLOYEE', // Default role for removed users
        }
    });
    logger_1.default.info({ message: 'User removed from organization.', removedUserId: userId, orgId: organizationId, removedBy: user.id });
    res.status(200).json({ message: 'User removed from organization successfully' });
}));
