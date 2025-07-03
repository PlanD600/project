// project-backend/src/api/organizations/organizations.routes.ts
import express from 'express';
import { protect } from '../../middleware/auth.middleware';
import { updateOrganization } from './organizations.controller';

const router = express.Router();

// A PUT request to /api/organizations/me will trigger the updateOrganization function
router.route('/me').put(protect, updateOrganization);

export default router;