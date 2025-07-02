import express from 'express';
import { createUser, getAllUsers, getUnassignedUsers, updateUser, deleteUser } from './users.controller';
import { protect, authorize } from '../../middleware/auth.middleware';
import { UserRole } from '@prisma/client';

const router = express.Router();

// All user routes are protected
router.use(protect);

// Routes for Super Admins
router.get('/', authorize('UserRole.ADMIN'), getAllUsers);
router.post('/', authorize('UserRole.ADMIN'), createUser);

// Routes for Admins and Team Leaders
router.get('/unassigned', authorize('UserRole.ADMIN', 'UserRole.TEAM_MANAGER'), getUnassignedUsers);

// Route for updating/deleting specific user
router.route('/:userId')
    .put(authorize('UserRole.ADMIN'), updateUser) // Can be extended to allow users to update themselves
    .delete(authorize('UserRole.ADMIN'), deleteUser); // Soft delete / disable user

export default router;