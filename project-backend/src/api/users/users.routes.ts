import express from 'express';
import { createUser, getAllUsers, getUnassignedUsers, updateUser, deleteUser } from './users.controller';
import { protect, authorize } from '../../middleware/auth.middleware';
import { UserRole } from '@prisma/client';

const router = express.Router();

// All user routes are protected
router.use(protect);

// Routes for ADMIN
router.get('/', authorize(UserRole.ORG_ADMIN), getAllUsers);
router.post('/', authorize(UserRole.ORG_ADMIN), createUser);

// Routes for Admins and TEAM_MANAGER
router.get('/unassigned', authorize(UserRole.ORG_ADMIN, UserRole.TEAM_LEADER), getUnassignedUsers);

// Route for updating/deleting specific user
router.route('/:userId')
    .put(authorize(UserRole.ORG_ADMIN), updateUser) // Can be extended to allow users to update themselves
    .delete(authorize(UserRole.ORG_ADMIN), deleteUser); // Soft delete / disable user

export default router;