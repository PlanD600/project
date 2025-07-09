"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// project-backend/src/api/organizations/organizations.routes.ts
const express_1 = __importDefault(require("express"));
const organizations_controller_1 = require("./organizations.controller");
const router = express_1.default.Router();
// A PUT request to /api/organizations/me will trigger the updateOrganization function
router.put('/me', organizations_controller_1.updateOrganization);
// A GET request to /api/organizations will trigger the getAllOrganizations function
router.get('/', organizations_controller_1.getAllOrganizations);
// A POST request to /api/organizations will trigger the createOrganization function
router.post('/', organizations_controller_1.createOrganization);
// A POST request to /api/organizations/switch will trigger the switchOrganization function
router.post('/switch', organizations_controller_1.switchOrganization);
// A GET request to /api/organizations/memberships will trigger the getUserMemberships function
router.get('/memberships', organizations_controller_1.getUserMemberships);
// A POST request to /api/organizations/:organizationId/invite will trigger the inviteUserToOrganization function
router.post('/:organizationId/invite', organizations_controller_1.inviteUserToOrganization);
// A DELETE request to /api/organizations/:organizationId/members/:userId will trigger the removeUserFromOrganization function
router.delete('/:organizationId/members/:userId', organizations_controller_1.removeUserFromOrganization);
exports.default = router;
