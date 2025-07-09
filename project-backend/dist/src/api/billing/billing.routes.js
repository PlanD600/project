"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// project-backend/src/api/billing/billing.routes.ts
const express_1 = __importDefault(require("express"));
const auth_middleware_1 = require("../../middleware/auth.middleware");
const billing_controller_1 = require("./billing.controller");
const router = express_1.default.Router();
// Protected routes
router.post('/create-checkout-session', auth_middleware_1.protect, billing_controller_1.createCheckoutSession);
router.post('/create-portal-session', auth_middleware_1.protect, billing_controller_1.createPortalSession);
router.get('/subscription', auth_middleware_1.protect, billing_controller_1.getSubscriptionInfo);
// Webhook route (no auth required)
router.post('/webhooks/stripe', express_1.default.raw({ type: 'application/json' }), billing_controller_1.handleStripeWebhook);
exports.default = router;
