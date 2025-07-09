"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// project-backend/src/api/guests/guests.routes.ts
const express_1 = __importDefault(require("express"));
const guests_controller_1 = require("./guests.controller");
const router = express_1.default.Router();
// A POST request to /api/guests/invite will trigger the inviteGuest function
router.post('/invite', guests_controller_1.inviteGuest);
// A DELETE request to /api/guests/:guestId/project/:projectId will trigger the revokeGuest function
router.delete('/:guestId/project/:projectId', guests_controller_1.revokeGuest);
// A GET request to /api/guests/project/:projectId will trigger the getProjectGuests function
router.get('/project/:projectId', guests_controller_1.getProjectGuests);
exports.default = router;
