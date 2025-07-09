"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteTask = exports.addCommentToTask = exports.updateTaskStatus = exports.bulkUpdateTasks = exports.updateTask = exports.createTask = exports.getTask = void 0;
const express_async_handler_1 = __importDefault(require("express-async-handler"));
const db_1 = __importDefault(require("../../db")); // תיקון 1: ייבוא נכון
const logger_1 = __importDefault(require("../../logger")); // תיקון 2: ייבוא נכון
const client_1 = require("@prisma/client"); // תיקון 3: ייבוא נכון
const zod_1 = require("zod");
// פונקציית עזר חדשה שמבטיחה שהמידע החוזר יהיה תמיד מלא ועקבי
const getFullTaskViewModel = (taskId, organizationId) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    logger_1.default.info({ message: 'Fetching full task view model.', taskId, orgId: organizationId });
    const task = yield db_1.default.task.findFirst({
        where: { id: taskId, organizationId: organizationId },
        include: {
            assignees: {
                select: { id: true, name: true, avatarUrl: true }
            },
            comments: {
                include: {
                    user: { select: { id: true, name: true, avatarUrl: true } }
                },
                orderBy: { timestamp: 'asc' }
            }
        }
    });
    if (!task) {
        logger_1.default.warn({ message: 'Full task view model not found for this org.', taskId, orgId: organizationId });
        return null;
    }
    // בנייה ידנית של אובייקט התגובה כדי להבטיח עקביות
    const taskViewModel = Object.assign(Object.assign({}, task), { description: (_a = task.description) !== null && _a !== void 0 ? _a : '', assigneeIds: task.assignees.map((a) => a.id) });
    delete taskViewModel.assignees;
    logger_1.default.info({ message: 'Full task view model fetched successfully.', taskId });
    return taskViewModel;
});
const createTaskSchema = zod_1.z.object({
    title: zod_1.z.string().min(1, 'Title is required'),
    description: zod_1.z.string().optional(),
    startDate: zod_1.z.string().min(1, 'Start date is required'),
    endDate: zod_1.z.string().min(1, 'End date is required'),
    assigneeIds: zod_1.z.array(zod_1.z.string()).optional(),
    columnId: zod_1.z.string().min(1, 'Column ID is required'),
    projectId: zod_1.z.string().min(1, 'Project ID is required').optional(),
});
const updateTaskSchema = zod_1.z.object({
    title: zod_1.z.string().optional(),
    description: zod_1.z.string().optional(),
    startDate: zod_1.z.string().optional(),
    endDate: zod_1.z.string().optional(),
    assigneeIds: zod_1.z.array(zod_1.z.string()).optional(),
    columnId: zod_1.z.string().optional(),
});
exports.getTask = (0, express_async_handler_1.default)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    if (!user || !user.activeOrganizationId) {
        res.status(401).json({ message: 'Unauthorized' });
        return; // תיקון 4: החזרת void במקום Response
    }
    const task = yield getFullTaskViewModel(req.params.taskId, user.activeOrganizationId);
    if (!task) {
        logger_1.default.warn({ message: 'Single task not found.', taskId: req.params.taskId, userId: user.id });
        res.status(404).json({ message: 'Task not found' });
        return;
    }
    logger_1.default.info({ message: 'Single task fetched successfully.', taskId: task.id, userId: user.id });
    res.json(task);
}));
exports.createTask = (0, express_async_handler_1.default)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    if (!user || !user.activeOrganizationId) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
    }
    const parsed = createTaskSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: 'Invalid input', details: parsed.error.errors });
        return;
    }
    const { title, description, startDate, endDate, assigneeIds, columnId, projectId } = parsed.data;
    const task = yield db_1.default.task.create({
        data: {
            title,
            description,
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            columnId,
            projectId: projectId || null,
            organizationId: user.activeOrganizationId,
            assignees: {
                connect: (assigneeIds === null || assigneeIds === void 0 ? void 0 : assigneeIds.map((id) => ({ id: id }))) || []
            }
        },
        include: {
            assignees: {
                select: { id: true, name: true, avatarUrl: true }
            }
        }
    });
    const createdTask = yield getFullTaskViewModel(task.id, user.activeOrganizationId);
    logger_1.default.info({ message: 'Task created successfully.', taskId: createdTask === null || createdTask === void 0 ? void 0 : createdTask.id, userId: user.id });
    res.status(201).json(createdTask);
}));
exports.updateTask = (0, express_async_handler_1.default)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { taskId } = req.params;
    const user = req.user;
    const taskData = req.body;
    if (!user || !user.activeOrganizationId) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
    }
    const taskExists = yield db_1.default.task.findFirst({
        where: { id: taskId, organizationId: user.activeOrganizationId }
    });
    if (!taskExists) {
        logger_1.default.warn({ message: 'Task update failed: Task not found in organization.', taskId, userId: user.id });
        res.status(404).json({ message: 'Task not found' });
        return;
    }
    const parsedUpdate = updateTaskSchema.safeParse(req.body);
    if (!parsedUpdate.success) {
        res.status(400).json({ error: 'Invalid input', details: parsedUpdate.error.errors });
        return;
    }
    const { title: updateTitle, description: updateDescription, startDate: updateStartDate, endDate: updateEndDate, assigneeIds: updateAssigneeIds, columnId: updateColumnId } = parsedUpdate.data;
    // Extract assigneeIds and exclude relation fields that shouldn't be updated directly
    const { assigneeIds, comments, assignees, startDate, endDate, baselineStartDate, baselineEndDate } = taskData, updateData = __rest(taskData, ["assigneeIds", "comments", "assignees", "startDate", "endDate", "baselineStartDate", "baselineEndDate"]);
    yield db_1.default.task.update({
        where: { id: taskId },
        data: Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({}, updateData), (startDate && { startDate: new Date(startDate) })), (endDate && { endDate: new Date(endDate) })), (baselineStartDate && { baselineStartDate: new Date(baselineStartDate) })), (baselineEndDate && { baselineEndDate: new Date(baselineEndDate) })), (assigneeIds !== undefined && {
            assignees: {
                set: assigneeIds.map((id) => ({ id: id }))
            }
        }))
    });
    const updatedTask = yield getFullTaskViewModel(taskId, user.activeOrganizationId);
    logger_1.default.info({ message: 'Task updated successfully.', taskId: updatedTask === null || updatedTask === void 0 ? void 0 : updatedTask.id, userId: user.id });
    res.json(updatedTask);
}));
exports.bulkUpdateTasks = (0, express_async_handler_1.default)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { tasks } = req.body;
    const user = req.user;
    if (!user || !user.activeOrganizationId) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
    }
    const taskIds = tasks.map((t) => t.id);
    logger_1.default.info({ message: 'Attempting to bulk update tasks.', taskIds, userId: user.id });
    const tasksInOrgCount = yield db_1.default.task.count({
        where: {
            id: { in: taskIds },
            organizationId: user.activeOrganizationId,
        }
    });
    if (tasksInOrgCount !== tasks.length) {
        logger_1.default.warn({ message: 'Bulk update failed: Not all tasks belong to the organization.', userId: user.id });
        res.status(403).json({ message: "Error: Attempted to update tasks from a different organization." });
        return;
    }
    const updatePromises = tasks.map((task) => {
        // Extract only the fields that should be updated, excluding relations and date fields
        const { id, comments, assignees, assigneeIds, startDate, endDate } = task, updateData = __rest(task, ["id", "comments", "assignees", "assigneeIds", "startDate", "endDate"]);
        return db_1.default.task.update({
            where: { id: task.id },
            data: Object.assign({ startDate: new Date(task.startDate), endDate: new Date(task.endDate), dependencies: task.dependencies || [] }, updateData)
        });
    });
    yield db_1.default.$transaction(updatePromises);
    const updatedTasks = yield Promise.all(tasks.map((t) => getFullTaskViewModel(t.id, user.activeOrganizationId)));
    logger_1.default.info({ message: 'Bulk update tasks completed successfully.', updatedTaskCount: updatedTasks.length, userId: user.id });
    res.json(updatedTasks.filter(Boolean));
}));
exports.updateTaskStatus = (0, express_async_handler_1.default)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { taskId } = req.params;
    const { status } = req.body;
    const user = req.user;
    if (!user || !user.activeOrganizationId) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
    }
    if (!status) {
        logger_1.default.warn({ message: 'Task status update failed: Missing status.', taskId, userId: user.id });
        res.status(400).json({ message: 'Status is required.' });
        return;
    }
    const taskExists = yield db_1.default.task.findFirst({
        where: { id: taskId, organizationId: user.activeOrganizationId }
    });
    if (!taskExists) {
        logger_1.default.warn({ message: 'Task status update failed: Task not found in organization.', taskId, userId: user.id });
        res.status(404).json({ message: 'Task not found' });
        return;
    }
    yield db_1.default.task.update({
        where: { id: taskId },
        data: { columnId: status }
    });
    const result = yield getFullTaskViewModel(taskId, user.activeOrganizationId);
    logger_1.default.info({ message: 'Task status updated successfully.', taskId: result === null || result === void 0 ? void 0 : result.id, newStatus: result === null || result === void 0 ? void 0 : result.columnId, userId: user.id });
    res.status(200).json(result);
}));
exports.addCommentToTask = (0, express_async_handler_1.default)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { taskId } = req.params;
    const { content, parentId } = req.body;
    const user = req.user;
    if (!content || !user || !user.activeOrganizationId) {
        logger_1.default.warn({ message: 'Add comment failed: Missing content or user/org.', taskId, userId: user === null || user === void 0 ? void 0 : user.id });
        res.status(400).json({ message: 'Content and user are required.' });
        return;
    }
    const taskExists = yield db_1.default.task.findFirst({
        where: { id: taskId, organizationId: user.activeOrganizationId }
    });
    if (!taskExists) {
        logger_1.default.warn({ message: 'Add comment failed: Task not found in organization.', taskId, userId: user.id });
        res.status(404).json({ message: 'Task not found' });
        return;
    }
    yield db_1.default.comment.create({
        data: {
            text: content,
            taskId,
            userId: user.id,
            parentId: parentId || null,
            organizationId: user.activeOrganizationId
        }
    });
    const result = yield getFullTaskViewModel(taskId, user.activeOrganizationId);
    logger_1.default.info({ message: 'Comment added successfully.', taskId: result === null || result === void 0 ? void 0 : result.id, userId: user.id });
    res.status(201).json(result);
}));
exports.deleteTask = (0, express_async_handler_1.default)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { taskId } = req.params;
    const user = req.user;
    if (!user || !user.activeOrganizationId) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
    }
    const taskExists = yield db_1.default.task.findFirst({
        where: { id: taskId, organizationId: user.activeOrganizationId }
    });
    if (!taskExists) {
        logger_1.default.warn({ message: 'Delete task failed: Task not found in organization.', taskId, userId: user.id });
        res.status(404).json({ message: 'Task not found' });
        return;
    }
    // Check if user has permission to delete the task (temporary until schema migration)
    const membership = user.memberships.find(m => m.organizationId === user.activeOrganizationId);
    const role = membership === null || membership === void 0 ? void 0 : membership.role;
    const canDeleteTask = role && [client_1.UserRole.ORG_ADMIN, client_1.UserRole.TEAM_LEADER].includes(role);
    if (!canDeleteTask) {
        logger_1.default.warn({ message: 'Delete task failed: Insufficient permissions.', taskId, userId: user.id, userRole: role });
        res.status(403).json({ message: 'Insufficient permissions to delete task' });
        return;
    }
    // Delete the task (this will cascade delete comments due to foreign key constraints)
    yield db_1.default.task.delete({
        where: { id: taskId }
    });
    logger_1.default.info({ message: 'Task deleted successfully.', taskId, userId: user.id });
    res.status(204).send();
}));
