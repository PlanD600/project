
import express from 'express';
import { addFinancialEntry, getFinancialSummary } from './finances.controller';
import { protect, authorize } from '../../middleware/auth.middleware';
import { UserRole } from '@prisma/client';

const router = express.Router();
router.use(protect);

router.post('/entries', authorize('ADMIN', 'TEAM_MANAGER'), addFinancialEntry);
router.get('/summary', authorize('ADMIN', 'TEAM_MANAGER'), getFinancialSummary);

export default router;