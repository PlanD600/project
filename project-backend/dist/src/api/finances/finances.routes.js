"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const finances_controller_1 = require("./finances.controller");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const client_1 = require("@prisma/client");
const router = express_1.default.Router();
router.use(auth_middleware_1.protect);
router.post('/entries', (0, auth_middleware_1.authorize)(client_1.UserRole.ORG_ADMIN, client_1.UserRole.TEAM_LEADER), finances_controller_1.addFinancialEntry);
router.get('/summary', (0, auth_middleware_1.authorize)(client_1.UserRole.ORG_ADMIN, client_1.UserRole.TEAM_LEADER), finances_controller_1.getFinancialSummary);
exports.default = router;
