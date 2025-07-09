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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireOrgManagement = exports.requireSuperAdmin = exports.authorize = exports.protect = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const express_async_handler_1 = __importDefault(require("express-async-handler"));
const db_1 = __importDefault(require("../db"));
const logger_1 = __importDefault(require("../logger"));
/**
 * Middleware to protect routes.
 * It checks for a valid JWT in the Authorization header and validates organization membership.
 */
exports.protect = (0, express_async_handler_1.default)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    let token;
    // 1. Check if token is sent in Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            // 2. Extract token from header (format: 'Bearer <token>')
            token = req.headers.authorization.split(' ')[1];
            if (!process.env.JWT_SECRET) {
                logger_1.default.error('FATAL: JWT_SECRET is not defined in protect middleware.');
                throw new Error('Server configuration error');
            }
            // 3. Verify the token
            const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
            // 4. Get active organization ID from header (optional for now)
            const activeOrganizationId = req.headers['x-active-organization-id'];
            // 5. Find user (temporary - using current schema)
            const user = yield db_1.default.user.findUnique({
                where: { id: decoded.id },
                select: {
                    id: true,
                    email: true,
                    name: true,
                    avatarUrl: true,
                    memberships: true, // Select memberships to get role for the current org
                }
            });
            if (!user) {
                res.status(401);
                throw new Error('Not authorized, user not found');
            }
            // 6. For now, use the user's organizationId as active organization
            const currentActiveOrgId = activeOrganizationId || ((_b = (_a = user.memberships[0]) === null || _a === void 0 ? void 0 : _a.organizationId) !== null && _b !== void 0 ? _b : null);
            // 7. Attach user with active organization context to request
            // Find membership for active org
            const membership = user.memberships.find(m => m.organizationId === currentActiveOrgId);
            req.user = {
                id: user.id,
                email: user.email,
                name: user.name,
                avatarUrl: user.avatarUrl,
                activeOrganizationId: currentActiveOrgId || null,
                memberships: Array.isArray(user.memberships) ? user.memberships.map(m => ({
                    organizationId: m.organizationId,
                    role: m.role
                })) : []
            };
            next();
            return;
        }
        catch (error) {
            logger_1.default.error('Token verification failed:', { error });
            res.status(401);
            throw new Error('Not authorized, token failed');
        }
    }
    if (!token) {
        logger_1.default.warn('Unauthorized access attempt: No token provided in headers.');
        res.status(401);
        throw new Error('Not authorized, no token');
    }
}));
/**
 * Middleware to authorize routes based on user roles within the active organization.
 * Example: authorize('SUPER_ADMIN', 'ORG_ADMIN')
 * @param {...string} roles - A list of roles that are allowed to access the route.
 */
const authorize = (...roles) => {
    return (req, res, next) => {
        var _a, _b, _c, _d, _e, _f, _g;
        if (!req.user || !roles.includes((_a = req.user.memberships.find(m => m.organizationId === req.user.activeOrganizationId)) === null || _a === void 0 ? void 0 : _a.role)) {
            logger_1.default.warn({
                message: 'Forbidden: User does not have the right role for this resource.',
                userId: (_b = req.user) === null || _b === void 0 ? void 0 : _b.id,
                userRole: (_d = (_c = req.user) === null || _c === void 0 ? void 0 : _c.memberships.find(m => m.organizationId === req.user.activeOrganizationId)) === null || _d === void 0 ? void 0 : _d.role,
                activeOrganizationId: (_e = req.user) === null || _e === void 0 ? void 0 : _e.activeOrganizationId,
                requiredRoles: roles,
                path: req.originalUrl
            });
            res.status(403);
            throw new Error(`User role '${(_g = (_f = req.user) === null || _f === void 0 ? void 0 : _f.memberships.find(m => m.organizationId === req.user.activeOrganizationId)) === null || _g === void 0 ? void 0 : _g.role}' is not authorized to access this route`);
        }
        next();
    };
};
exports.authorize = authorize;
/**
 * Middleware to check if user is a Super Admin (can manage multiple organizations)
 * TEMPORARY: This will be updated after schema migration
 */
const requireSuperAdmin = (req, res, next) => {
    if (!req.user) {
        res.status(401);
        throw new Error('Not authorized');
    }
    // For now, check if user has ADMIN role (will be updated to SUPER_ADMIN after migration)
    const hasSuperAdminRole = req.user.memberships.some(membership => membership.role === 'ADMIN');
    if (!hasSuperAdminRole) {
        logger_1.default.warn({
            message: 'Forbidden: User is not a Super Admin.',
            userId: req.user.id,
            path: req.originalUrl
        });
        res.status(403);
        throw new Error('Super Admin privileges required');
    }
    next();
};
exports.requireSuperAdmin = requireSuperAdmin;
/**
 * Middleware to check if user can manage the current organization
 * TEMPORARY: This will be updated after schema migration
 */
const requireOrgManagement = (req, res, next) => {
    var _a, _b;
    if (!req.user) {
        res.status(401);
        throw new Error('Not authorized');
    }
    // Check if user has admin role in the active organization
    const canManageOrg = ['ADMIN', 'TEAM_MANAGER'].includes((_a = req.user.memberships.find(m => m.organizationId === req.user.activeOrganizationId)) === null || _a === void 0 ? void 0 : _a.role);
    if (!canManageOrg) {
        logger_1.default.warn({
            message: 'Forbidden: User cannot manage this organization.',
            userId: req.user.id,
            userRole: (_b = req.user.memberships.find(m => m.organizationId === req.user.activeOrganizationId)) === null || _b === void 0 ? void 0 : _b.role,
            activeOrganizationId: req.user.activeOrganizationId,
            path: req.originalUrl
        });
        res.status(403);
        throw new Error('Organization management privileges required');
    }
    next();
};
exports.requireOrgManagement = requireOrgManagement;
