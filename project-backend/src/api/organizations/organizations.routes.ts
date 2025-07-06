// project-backend/src/api/organizations/organizations.routes.ts
import express from 'express';
import { 
  updateOrganization, 
  getAllOrganizations, 
  createOrganization, 
  switchOrganization,
  getUserMemberships,
  inviteUserToOrganization,
  removeUserFromOrganization
} from './organizations.controller';

const router = express.Router();

// A PUT request to /api/organizations/me will trigger the updateOrganization function
router.put('/me', updateOrganization);

// A GET request to /api/organizations will trigger the getAllOrganizations function
router.get('/', getAllOrganizations);

// A POST request to /api/organizations will trigger the createOrganization function
router.post('/', createOrganization);

// A POST request to /api/organizations/switch will trigger the switchOrganization function
router.post('/switch', switchOrganization);

// A GET request to /api/organizations/memberships will trigger the getUserMemberships function
router.get('/memberships', getUserMemberships);

// A POST request to /api/organizations/:organizationId/invite will trigger the inviteUserToOrganization function
router.post('/:organizationId/invite', inviteUserToOrganization);

// A DELETE request to /api/organizations/:organizationId/members/:userId will trigger the removeUserFromOrganization function
router.delete('/:organizationId/members/:userId', removeUserFromOrganization);

export default router;