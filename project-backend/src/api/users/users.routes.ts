import express from 'express';
import { createUser, getAllUsers, getUnassignedUsers, updateUser, deleteUser } from './users.controller';
import { protect, authorize } from '../../middleware/auth.middleware';

const router = express.Router();

// All user routes are protected
router.use(protect);

// Routes for Super Admins
router.get('/', authorize('Super Admin'), getAllUsers);
router.post('/', authorize('Super Admin'), createUser);

// Routes for Admins and Team Leaders
router.get('/unassigned', authorize('Super Admin', 'Team Leader'), getUnassignedUsers);

// Route for updating/deleting specific user
router.route('/:userId')
    .put(authorize('Super Admin'), updateUser) // Can be extended to allow users to update themselves
    .delete(authorize('Super Admin'), deleteUser); // Soft delete / disable user

export default router;