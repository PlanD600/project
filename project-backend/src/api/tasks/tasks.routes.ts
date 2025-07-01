import express from 'express';
import { updateTaskStatus, addCommentToTask, updateTask, bulkUpdateTasks, getTask } from './tasks.controller';

const router = express.Router();
router.use(protect);

router.patch('/', bulkUpdateTasks); // For gantt drag/drop

router.route('/:taskId')
    .get(getTask)
    .put(updateTask);

router.put('/:taskId/status', updateTaskStatus);
router.post('/:taskId/comments', addCommentToTask);

export default router;