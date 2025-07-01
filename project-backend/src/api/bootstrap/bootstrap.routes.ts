import express from 'express';
import { getInitialData } from './bootstrap.controller';
import { protect } from '../../middleware/auth.middleware';

const router = express.Router();

router.get('/', protect, getInitialData);

export default router;