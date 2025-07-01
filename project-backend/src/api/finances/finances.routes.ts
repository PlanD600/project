
import express from 'express';
import { addFinancialEntry, getFinancialSummary } from './finances.controller';

const router = express.Router();
router.use(protect);

router.post('/entries', authorize('Super Admin', 'Team Leader'), addFinancialEntry);
router.get('/summary', authorize('Super Admin', 'Team Leader'), getFinancialSummary);

export default router;