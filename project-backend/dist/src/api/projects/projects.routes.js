"use strict";
// project-backend/src/api/projects/projects.routes.ts
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const projects_controller_1 = require("./projects.controller");
const router = (0, express_1.Router)();
router.route('/')
    .get(auth_middleware_1.protect, projects_controller_1.getProjects) // שימוש ב-getProjects
    .post(auth_middleware_1.protect, projects_controller_1.createProject);
// שינוי הפרמטר ל-:projectId כדי להתאים לקונטרולר
router.route('/:projectId')
    .get(auth_middleware_1.protect, projects_controller_1.getProjectDetails) // הוספת Route לפרטי פרויקט ספציפי
    .put(auth_middleware_1.protect, projects_controller_1.updateProject)
    .patch(auth_middleware_1.protect, projects_controller_1.updateProject)
    .delete(auth_middleware_1.protect, projects_controller_1.deleteProject);
// Route ליצירת משימה בפרויקט ספציפי
router.route('/:projectId/tasks')
    .post(auth_middleware_1.protect, projects_controller_1.createTaskInProject);
exports.default = router;
