// project-backend/src/api/guests/guests.routes.ts
import express from 'express';
import { inviteGuest, revokeGuest, getProjectGuests } from './guests.controller';

const router = express.Router();

// A POST request to /api/guests/invite will trigger the inviteGuest function
router.post('/invite', inviteGuest);

// A DELETE request to /api/guests/:guestId/project/:projectId will trigger the revokeGuest function
router.delete('/:guestId/project/:projectId', revokeGuest);

// A GET request to /api/guests/project/:projectId will trigger the getProjectGuests function
router.get('/project/:projectId', getProjectGuests);

export default router; 