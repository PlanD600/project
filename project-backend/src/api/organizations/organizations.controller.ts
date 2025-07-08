// project-backend/src/api/organizations/organizations.controller.ts
import { RequestHandler } from 'express';
import asyncHandler from 'express-async-handler';
import prisma from '../../db';
import logger from '../../logger';
import { UserRole } from '@prisma/client';

// @desc    Get all organizations for super admin users
// @route   GET /api/organizations
// @access  Private (Super Admin only)
export const getAllOrganizations: RequestHandler = asyncHandler(async (req, res) => {
  const user = req.user;

  if (!user) {
    res.status(401);
    throw new Error('Not authorized');
  }

  // Check if user has SUPER_ADMIN role in any organization
  const hasSuperAdminRole = user.memberships.some(
    membership => membership.role === UserRole.SUPER_ADMIN
  );

  if (!hasSuperAdminRole) {
    res.status(403);
    throw new Error('Only super administrators can access all organizations');
  }

  const organizations = await prisma.organization.findMany({
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

  logger.info({ message: 'Super admin retrieved all organizations.', userId: user.id, count: organizations.length });
  res.status(200).json(organizations);
});

// @desc    Create a new organization
// @route   POST /api/organizations
// @access  Private (Super Admin only)
export const createOrganization: RequestHandler = asyncHandler(async (req, res) => {
  const { name } = req.body;
  const user = req.user;

  if (!user) {
    res.status(401);
    throw new Error('Not authorized');
  }

  // Check if user has SUPER_ADMIN role in any organization
  const hasSuperAdminRole = user.memberships.some(
    membership => membership.role === UserRole.SUPER_ADMIN
  );

  if (!hasSuperAdminRole) {
    res.status(403);
    throw new Error('Only super administrators can create organizations');
  }

  if (!name) {
    res.status(400);
    throw new Error('Organization name is required');
  }

  // Create organization (temporary - will be updated after schema migration)
  const newOrganization = await prisma.organization.create({
    data: {
      name,
    },
  });

  logger.info({ message: 'Organization created successfully.', orgId: newOrganization.id, createdBy: user.id });
  res.status(201).json(newOrganization);
});

// @desc    Update the current user's organization details
// @route   PUT /api/organizations/me
// @access  Private (Org Admin or Super Admin)
export const updateOrganization: RequestHandler = asyncHandler(async (req, res) => {
  const { name } = req.body;
  const user = req.user;

  if (!user || !user.activeOrganizationId) {
    res.status(401);
    throw new Error('Not authorized');
  }

  // Check if user can manage the active organization
  const membership = user.memberships.find(m => m.organizationId === user.activeOrganizationId);
  const canManageOrg = membership && (membership.role === UserRole.ORG_ADMIN || membership.role === UserRole.TEAM_LEADER);

  if (!canManageOrg) {
    res.status(403);
    throw new Error('User is not authorized to change organization settings');
  }

  if (!name) {
    res.status(400);
    throw new Error('Organization name is required');
  }

  logger.info({ message: 'Attempting to update organization name.', orgId: user.activeOrganizationId, newName: name, userId: user.id });

  const updatedOrganization = await prisma.organization.update({
    where: {
      id: user.activeOrganizationId,
    },
    data: {
      name,
    },
  });

  logger.info({ message: 'Organization updated successfully.', orgId: updatedOrganization.id });
  res.status(200).json(updatedOrganization);
});

// @desc    Switch to a different organization
// @route   POST /api/organizations/switch
// @access  Private (User must be member of target organization)
export const switchOrganization: RequestHandler = asyncHandler(async (req, res) => {
  const { organizationId } = req.body;
  const user = req.user;

  if (!user) {
    res.status(401);
    throw new Error('Not authorized');
  }

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
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId }
  });

  if (!organization) {
    res.status(404);
    throw new Error('Organization not found');
  }

  logger.info({ message: 'User switched organization.', userId: user.id, newOrgId: organizationId, role: membership.role });
  res.status(200).json(organization);
});

// @desc    Get user's memberships
// @route   GET /api/organizations/memberships
// @access  Private
export const getUserMemberships: RequestHandler = asyncHandler(async (req, res) => {
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
    role: membership?.role,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    organization: {
      id: user.activeOrganizationId,
      name: 'Current Organization', // This will be fetched from the actual organization
      createdAt: new Date().toISOString(),
    }
  }];

  logger.info({ message: 'User memberships retrieved.', userId: user.id, count: memberships.length });
  res.status(200).json(memberships);
});

// @desc    Invite user to organization
// @route   POST /api/organizations/:organizationId/invite
// @access  Private (Org Admin or Super Admin)
export const inviteUserToOrganization: RequestHandler = asyncHandler(async (req, res) => {
  const { organizationId } = req.params;
  const { email, role } = req.body;
  const user = req.user;

  if (!user || !user.activeOrganizationId) {
    res.status(401);
    throw new Error('Not authorized');
  }

  // Check if user can manage the organization
  const membership = user.memberships.find(m => m.organizationId === organizationId);
  const canManageOrg = membership && (membership.role === UserRole.ORG_ADMIN || membership.role === UserRole.TEAM_LEADER);

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
  let targetUser = await prisma.user.findUnique({
    where: { email }
  });

  if (!targetUser) {
    // Create new user with temporary password
    const tempPassword = Math.random().toString(36).slice(-8);
    targetUser = await prisma.user.create({
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
  const newMembership = await prisma.membership.create({
    data: {
      userId: targetUser.id,
      organizationId: organizationId,
      role: role as any, // Temporary until schema migration
    }
  });

  logger.info({ message: 'User invited to organization.', invitedUserId: targetUser.id, orgId: organizationId, role, invitedBy: user.id });
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
});

// @desc    Remove user from organization
// @route   DELETE /api/organizations/:organizationId/members/:userId
// @access  Private (Org Admin or Super Admin)
export const removeUserFromOrganization: RequestHandler = asyncHandler(async (req, res) => {
  const { organizationId, userId } = req.params;
  const user = req.user;

  if (!user || !user.activeOrganizationId) {
    res.status(401);
    throw new Error('Not authorized');
  }

  // Check if user can manage the organization
  const membership = user.memberships.find(m => m.organizationId === organizationId);
  const canManageOrg = membership && (membership.role === UserRole.ORG_ADMIN || membership.role === UserRole.TEAM_LEADER);

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
  const membershipToRemove = await prisma.membership.findFirst({
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
  const updatedMembership = await prisma.membership.update({
    where: { id: membershipToRemove.id },
    data: {
      organizationId: '', // Set organizationId to empty string to remove it
      role: 'EMPLOYEE', // Default role for removed users
    }
  });

  logger.info({ message: 'User removed from organization.', removedUserId: userId, orgId: organizationId, removedBy: user.id });
  res.status(200).json({ message: 'User removed from organization successfully' });
});