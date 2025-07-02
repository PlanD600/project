import express from 'express';
import { createTeam, addMembersToTeam, updateTeam, deleteTeam, removeUserFromTeam } from './teams.controller';
import { protect, authorize } from '../../middleware/auth.middleware';
import { UserRole } from '@prisma/client';

const router = express.Router();

router.use(protect);

// הנתיב הזה דורש הרשאות אדמין בלבד
router.route('/')
    .post(authorize(ADMIN), createTeam);

// הנתיבים האלה דורשים הרשאות אדמין בלבד
router.route('/:teamId')
    .put(authorize(ADMIN), updateTeam)
    .delete(authorize(ADMIN), deleteTeam);

// הנתיבים האלה דורשים הרשאות אדמין או מנהל צוות
router.post('/:teamId/members', authorize(ADMIN, TEAM_MANAGER), addMembersToTeam);

router.delete('/:teamId/members/:userId', authorize(ADMIN, TEAM_MANAGER), removeUserFromTeam);

export default router;