import express from 'express';
import { updateTaskStatus, addCommentToTask, updateTask, bulkUpdateTasks, getTask, deleteTask } from './tasks.controller';
import { protect, authorize } from '../../middleware/auth.middleware';

const router = express.Router();
router.use(protect);

router.patch('/', bulkUpdateTasks); // For gantt drag/drop

router.route('/:taskId')
    .get(getTask)
    .put(updateTask)
    .delete(deleteTask);

router.put('/:taskId/status', updateTaskStatus);
router.post('/:taskId/comments', addCommentToTask);

export default router;