// project-backend/src/api/billing/billing.routes.ts
import express from 'express';
import { protect } from '../../middleware/auth.middleware';
import { 
  createCheckoutSession, 
  createPortalSession, 
  getSubscriptionInfo,
  handleStripeWebhook
} from './billing.controller';

const router = express.Router();

// Protected routes
router.post('/create-checkout-session', protect, createCheckoutSession);
router.post('/create-portal-session', protect, createPortalSession);
router.get('/subscription', protect, getSubscriptionInfo);

// Webhook route (no auth required)
router.post('/webhooks/stripe', express.raw({ type: 'application/json' }), handleStripeWebhook);

export default router; 