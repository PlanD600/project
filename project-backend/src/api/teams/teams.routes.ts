import express from 'express';
import { createTeam, addMembersToTeam, updateTeam, deleteTeam, removeUserFromTeam } from './teams.controller';

const router = express.Router();

router.use(protect);

router.route('/')
    .post(authorize('Super Admin'), createTeam);

router.route('/:teamId')
    .put(authorize('Super Admin'), updateTeam)
    .delete(authorize('Super Admin'), deleteTeam);

router.post('/:teamId/members', authorize('Super Admin', 'Team Leader'), addMembersToTeam);

router.delete('/:teamId/members/:userId', authorize('Super Admin', 'Team Leader'), removeUserFromTeam);

export default router;