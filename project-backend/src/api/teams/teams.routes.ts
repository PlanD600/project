import express from 'express';
import { createTeam, addMembersToTeam, updateTeam, deleteTeam, removeUserFromTeam } from './teams.controller';
import { protect, authorize } from '../../middleware/auth.middleware';
import { UserRole } from '@prisma/client';

const router = express.Router();

router.use(protect);

// הנתיב הזה דורש הרשאות אדמין בלבד
router.route('/')
    .post(authorize(UserRole.ORG_ADMIN), createTeam);

// הנתיבים האלה דורשים הרשאות אדמין בלבד
router.route('/:teamId')
    .put(authorize(UserRole.ORG_ADMIN), updateTeam)
    .delete(authorize(UserRole.ORG_ADMIN), deleteTeam);

// הנתיבים האלה דורשים הרשאות אדמין או מנהל צוות
router.post('/:teamId/members', authorize(UserRole.ORG_ADMIN, UserRole.TEAM_LEADER), addMembersToTeam);

router.delete('/:teamId/members/:userId', authorize(UserRole.ORG_ADMIN, UserRole.TEAM_LEADER), removeUserFromTeam);

export default router;