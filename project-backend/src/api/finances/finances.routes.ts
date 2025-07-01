
import express from 'express';
import { addFinancialEntry, getFinancialSummary } from './finances.controller';
import { protect, authorize } from '../../middleware/auth.middleware';

const router = express.Router();
router.use(protect);

router.post('/entries', authorize('Super Admin', 'Team Leader'), addFinancialEntry);
router.get('/summary', authorize('Super Admin', 'Team Leader'), getFinancialSummary);

export default router;