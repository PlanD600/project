// project-backend/src/api/projects/projects.routes.ts

import { Router } from 'express';
import { protect } from '../../middleware/auth.middleware';
import { getProjectsByOwner, createProject, updateProject, deleteProject } from './projects.controller';

const router = Router();

router.route('/')
    .get(protect, getProjectsByOwner) // Assuming this needs a filter, adjust if it's for all projects
    .post(protect, createProject);

router.route('/:id')
    .put(protect, updateProject) // Changed from 'put' to match common practice
    .patch(protect, updateProject)
    .delete(protect, deleteProject);

export default router;