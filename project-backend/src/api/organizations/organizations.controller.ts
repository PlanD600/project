// project-backend/src/api/organizations/organizations.controller.ts
import { RequestHandler } from 'express';
import asyncHandler from 'express-async-handler';
import prisma from '../../db';
import logger from '../../logger';

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