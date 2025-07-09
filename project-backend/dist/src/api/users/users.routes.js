"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const users_controller_1 = require("./users.controller");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const client_1 = require("@prisma/client");
const router = express_1.default.Router();
// All user routes are protected
router.use(auth_middleware_1.protect);
// Routes for ADMIN
router.get('/', (0, auth_middleware_1.authorize)(client_1.UserRole.ORG_ADMIN), users_controller_1.getAllUsers);
router.post('/', (0, auth_middleware_1.authorize)(client_1.UserRole.ORG_ADMIN), users_controller_1.createUser);
// Routes for Admins and TEAM_MANAGER
router.get('/unassigned', (0, auth_middleware_1.authorize)(client_1.UserRole.ORG_ADMIN, client_1.UserRole.TEAM_LEADER), users_controller_1.getUnassignedUsers);
// Route for updating/deleting specific user
router.route('/:userId')
    .put((0, auth_middleware_1.authorize)(client_1.UserRole.ORG_ADMIN), users_controller_1.updateUser) // Can be extended to allow users to update themselves
    .delete((0, auth_middleware_1.authorize)(client_1.UserRole.ORG_ADMIN), users_controller_1.deleteUser); // Soft delete / disable user
exports.default = router;
