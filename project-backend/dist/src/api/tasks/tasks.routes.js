"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const tasks_controller_1 = require("./tasks.controller");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const router = express_1.default.Router();
router.use(auth_middleware_1.protect);
router.patch('/', tasks_controller_1.bulkUpdateTasks); // For gantt drag/drop
router.route('/:taskId')
    .get(tasks_controller_1.getTask)
    .put(tasks_controller_1.updateTask)
    .delete(tasks_controller_1.deleteTask);
router.put('/:taskId/status', tasks_controller_1.updateTaskStatus);
router.post('/:taskId/comments', tasks_controller_1.addCommentToTask);
exports.default = router;
