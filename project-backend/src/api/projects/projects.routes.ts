// project-backend/src/api/projects/projects.routes.ts

import { Router } from 'express';
import { protect } from '../../middleware/auth.middleware';
import { 
    getProjects, // שינוי מ-getProjectsByOwner ל-getProjects
    createProject, 
    updateProject, 
    deleteProject,
    getProjectDetails, // הוספת ייצוא עבור getProjectDetails
    createTaskInProject // הוספת ייצוא עבור createTaskInProject
} from './projects.controller';

const router = Router();

router.route('/')
    .get(protect, getProjects) // שימוש ב-getProjects
    .post(protect, createProject);

// שינוי הפרמטר ל-:projectId כדי להתאים לקונטרולר
router.route('/:projectId') 
    .get(protect, getProjectDetails) // הוספת Route לפרטי פרויקט ספציפי
    .put(protect, updateProject) 
    .patch(protect, updateProject)
    .delete(protect, deleteProject);

// Route ליצירת משימה בפרויקט ספציפי
router.route('/:projectId/tasks')
    .post(protect, createTaskInProject);

export default router;