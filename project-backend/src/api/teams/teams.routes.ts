import express from 'express';
import { createTeam, addMembersToTeam, updateTeam, deleteTeam, removeUserFromTeam } from './teams.controller';
import { protect, authorize } from '../../middleware/auth.middleware';
import { UserRole } from '@prisma/client';

const router = express.Router();

router.use(protect);

// הנתיב הזה דורש הרשאות אדמין בלבד
router.route('/')
    .post(authorize(UserRole.ADMIN), createTeam);

// הנתיבים האלה דורשים הרשאות אדמין בלבד
router.route('/:teamId')
    .put(authorize(UserRole.ADMIN), updateTeam)
    .delete(authorize(UserRole.ADMIN), deleteTeam);

// הנתיבים האלה דורשים הרשאות אדמין או מנהל צוות
router.post('/:teamId/members', authorize(UserRole.ADMIN, UserRole.TEAM_MANAGER), addMembersToTeam);

router.delete('/:teamId/members/:userId', authorize(UserRole.ADMIN, UserRole.TEAM_MANAGER), removeUserFromTeam);

export default router;