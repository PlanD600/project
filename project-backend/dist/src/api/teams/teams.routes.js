"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const teams_controller_1 = require("./teams.controller");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const client_1 = require("@prisma/client");
const router = express_1.default.Router();
router.use(auth_middleware_1.protect);
// הנתיב הזה דורש הרשאות אדמין בלבד
router.route('/')
    .post((0, auth_middleware_1.authorize)(client_1.UserRole.ORG_ADMIN), teams_controller_1.createTeam);
// הנתיבים האלה דורשים הרשאות אדמין בלבד
router.route('/:teamId')
    .put((0, auth_middleware_1.authorize)(client_1.UserRole.ORG_ADMIN), teams_controller_1.updateTeam)
    .delete((0, auth_middleware_1.authorize)(client_1.UserRole.ORG_ADMIN), teams_controller_1.deleteTeam);
// הנתיבים האלה דורשים הרשאות אדמין או מנהל צוות
router.post('/:teamId/members', (0, auth_middleware_1.authorize)(client_1.UserRole.ORG_ADMIN, client_1.UserRole.TEAM_LEADER), teams_controller_1.addMembersToTeam);
router.delete('/:teamId/members/:userId', (0, auth_middleware_1.authorize)(client_1.UserRole.ORG_ADMIN, client_1.UserRole.TEAM_LEADER), teams_controller_1.removeUserFromTeam);
exports.default = router;
