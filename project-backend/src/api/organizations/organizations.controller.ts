// project-backend/src/api/organizations/organizations.controller.ts
import { RequestHandler } from 'express';
import asyncHandler from 'express-async-handler';
import prisma from '../../db';
import logger from '../../logger';

// @desc    Get all organizations for admin users
// @route   GET /api/organizations
// @access  Private (Admin only)
export const getAllOrganizations: RequestHandler = asyncHandler(async (req, res) => {
  const user = req.user;

  if (!user || user.role !== 'ADMIN') {
    res.status(403);
    throw new Error('Only administrators can access all organizations');
  }

  const organizations = await prisma.organization.findMany({
    include: {
      _count: {
        select: {
          users: true,
          projects: true,
          teams: true
        }
      }
    },
    orderBy: {
      createdAt: 'desc'
    }
  });

  logger.info({ message: 'Admin retrieved all organizations.', userId: user.id, count: organizations.length });
  res.status(200).json(organizations);
});

// @desc    Create a new organization
// @route   POST /api/organizations
// @access  Private (Admin only)
export const createOrganization: RequestHandler = asyncHandler(async (req, res) => {
  const { name } = req.body;
  const user = req.user;

  if (!user || user.role !== 'ADMIN') {
    res.status(403);
    throw new Error('Only administrators can create organizations');
  }

  if (!name) {
    res.status(400);
    throw new Error('Organization name is required');
  }

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
// @access  Private (Admin)
export const updateOrganization: RequestHandler = asyncHandler(async (req, res) => {
  const { name } = req.body;
  const user = req.user;

  if (!user || !user.organizationId) {
    res.status(401);
    throw new Error('Not authorized');
  }

  // Optional: Add a check to ensure only Admins can change the org name
  // if (user.role !== 'ADMIN') {
  //   res.status(403);
  //   throw new Error('User is not authorized to change organization settings');
  // }

  if (!name) {
    res.status(400);
    throw new Error('Organization name is required');
  }

  logger.info({ message: 'Attempting to update organization name.', orgId: user.organizationId, newName: name, userId: user.id });

  const updatedOrganization = await prisma.organization.update({
    where: {
      id: user.organizationId,
    },
    data: {
      name,
    },
  });

  logger.info({ message: 'Organization updated successfully.', orgId: updatedOrganization.id });
  res.status(200).json(updatedOrganization);
});

// @desc    Switch to a different organization (Admin only)
// @route   POST /api/organizations/switch
// @access  Private (Admin only)
export const switchOrganization: RequestHandler = asyncHandler(async (req, res) => {
  const { organizationId } = req.body;
  const user = req.user;

  if (!user || user.role !== 'ADMIN') {
    res.status(403);
    throw new Error('Only administrators can switch organizations');
  }

  if (!organizationId) {
    res.status(400);
    throw new Error('Organization ID is required');
  }

  // Verify the organization exists
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId }
  });

  if (!organization) {
    res.status(404);
    throw new Error('Organization not found');
  }

  // Update user's organization
  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: { organizationId },
    include: {
      organization: true
    }
  });

  logger.info({ message: 'User switched organization.', userId: user.id, newOrgId: organizationId });
  res.status(200).json(updatedUser.organization);
});