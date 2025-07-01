
import express from 'express';
import { getProjects, createProject, getProjectDetails, createTaskInProject } from './projects.controller';
import { protect, authorize } from '../../middleware/auth.middleware';

const router = express.Router();

// All project routes are protected
router.use(protect);

router.route('/')
    .get(getProjects)
    .post(authorize('Super Admin'), createProject);

router.route('/:projectId')
    .get(getProjectDetails);

router.route('/:projectId/tasks')
    .post(authorize('Super Admin', 'Team Leader'), createTaskInProject);


export default router;