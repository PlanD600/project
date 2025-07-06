// project-backend/src/api/organizations/organizations.routes.ts
import express from 'express';
import { updateOrganization, getAllOrganizations, createOrganization, switchOrganization } from './organizations.controller';

const router = express.Router();

// A PUT request to /api/organizations/me will trigger the updateOrganization function
router.put('/me', updateOrganization);

// A GET request to /api/organizations will trigger the getAllOrganizations function
router.get('/', getAllOrganizations);

// A POST request to /api/organizations will trigger the createOrganization function
router.post('/', createOrganization);

// A POST request to /api/organizations/switch will trigger the switchOrganization function
router.post('/switch', switchOrganization);

export default router;