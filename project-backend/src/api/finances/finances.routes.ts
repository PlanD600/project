
import express from 'express';
import { addFinancialEntry, getFinancialSummary } from './finances.controller';
import { protect, authorize } from '../../middleware/auth.middleware';
import { UserRole } from '@prisma/client';

const router = express.Router();
router.use(protect);

router.post('/entries', authorize(UserRole.ORG_ADMIN, UserRole.TEAM_LEADER), addFinancialEntry);
router.get('/summary', authorize(UserRole.ORG_ADMIN, UserRole.TEAM_LEADER), getFinancialSummary);

export default router;