// project-backend/src/api/billing/billing.controller.ts
import { RequestHandler } from 'express';
import asyncHandler from 'express-async-handler';
import prisma from '../../db';
import logger from '../../logger';
import Stripe from 'stripe';
import { UserRole } from '@prisma/client';
import { z } from 'zod';

// Initialize Stripe only if the secret key is available
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-06-30.basil',
}) : null;

const createCheckoutSessionSchema = z.object({
  planId: z.string().min(1, 'Plan ID is required'),
  successUrl: z.string().url('Success URL must be a valid URL'),
  cancelUrl: z.string().url('Cancel URL must be a valid URL'),
});

const portalSessionSchema = z.object({
  returnUrl: z.string().url('Return URL must be a valid URL'),
});

// @desc    Create Stripe checkout session
// @route   POST /api/billing/create-checkout-session
// @access  Private
export const createCheckoutSession: RequestHandler = asyncHandler(async (req, res) => {
  if (!stripe) {
    res.status(503);
    throw new Error('Billing service is not configured');
  }

  const parsed = createCheckoutSessionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.errors });
    return;
  }
  const { planId, successUrl, cancelUrl } = parsed.data;

  const user = req.user;

  if (!user || !user.activeOrganizationId) {
    res.status(401);
    throw new Error('Not authorized');
  }

  const organization = await prisma.organization.findUnique({
    where: { id: user.activeOrganizationId }
  });

  if (!organization) {
    res.status(404);
    throw new Error('Organization not found');
  }

  // Find the plan
  const plans = {
    business: { priceId: process.env.STRIPE_BUSINESS_PRICE_ID, amount: 3000 }, // 30 NIS in agorot
    enterprise: { priceId: process.env.STRIPE_ENTERPRISE_PRICE_ID, amount: 10000 } // 100 NIS in agorot
  };

  const plan = plans[planId as keyof typeof plans];
  if (!plan) {
    res.status(400);
    throw new Error('Invalid plan selected');
  }

  try {
    // Create or get Stripe customer
    let customerId = organization.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: organization.name,
        metadata: {
          organizationId: organization.id,
          userId: user.id
        }
      });
      customerId = customer.id;
      
      // Update organization with customer ID
      await prisma.organization.update({
        where: { id: organization.id },
        data: { stripeCustomerId: customerId }
      });
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: plan.priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: successUrl || `${process.env.FRONTEND_URL}/settings?success=true`,
      cancel_url: cancelUrl || `${process.env.FRONTEND_URL}/settings?canceled=true`,
      metadata: {
        organizationId: organization.id,
        planId: planId,
        userId: user.id
      }
    });

    logger.info({ message: 'Checkout session created', sessionId: session.id, organizationId: organization.id });
    res.status(200).json({ sessionId: session.id, url: session.url });
  } catch (error) {
    logger.error({ message: 'Failed to create checkout session', error, organizationId: organization.id });
    res.status(500);
    throw new Error('Failed to create checkout session');
  }
});

// @desc    Create Stripe customer portal session
// @route   POST /api/billing/create-portal-session
// @access  Private
export const createPortalSession: RequestHandler = asyncHandler(async (req, res) => {
  if (!stripe) {
    res.status(503);
    throw new Error('Billing service is not configured');
  }

  const parsedPortal = portalSessionSchema.safeParse(req.body);
  if (!parsedPortal.success) {
    res.status(400).json({ error: 'Invalid input', details: parsedPortal.error.errors });
    return;
  }
  const { returnUrl } = parsedPortal.data;

  const user = req.user;

  if (!user || !user.activeOrganizationId) {
    res.status(401);
    throw new Error('Not authorized');
  }

  const organization = await prisma.organization.findUnique({
    where: { id: user.activeOrganizationId }
  });

  if (!organization || !organization.stripeCustomerId) {
    res.status(404);
    throw new Error('No active subscription found');
  }

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: organization.stripeCustomerId,
      return_url: returnUrl || `${process.env.FRONTEND_URL}/settings`,
    });

    res.status(200).json({ url: session.url });
  } catch (error) {
    logger.error({ message: 'Failed to create portal session', error, organizationId: organization.id });
    res.status(500);
    throw new Error('Failed to create portal session');
  }
});

// @desc    Get subscription information
// @route   GET /api/billing/subscription
// @access  Private
export const getSubscriptionInfo: RequestHandler = asyncHandler(async (req, res) => {
  const user = req.user;

  if (!user || !user.activeOrganizationId) {
    res.status(401);
    throw new Error('Not authorized');
  }

  const organization = await prisma.organization.findUnique({
    where: { id: user.activeOrganizationId },
    include: {
      _count: {
        select: {
          projects: true
        }
      }
    }
  });

  if (!organization) {
    res.status(404);
    throw new Error('Organization not found');
  }

  // Get company count for admin users
  const membership = user.memberships.find(m => m.organizationId === user.activeOrganizationId);
  const role = membership?.role;
  let companyCount = 1;
  if (role === UserRole.ORG_ADMIN) {
    companyCount = await prisma.organization.count();
  }

  // Get plan limits
  const planLimits = {
    FREE: { projects: 10, companies: 1 },
    BUSINESS: { projects: 40, companies: 3 },
    ENTERPRISE: { projects: 400, companies: 15 }
  };

  const currentPlan = organization.planType;
  const limits = planLimits[currentPlan];

  // Check if can downgrade
  const canDowngrade = organization._count.projects <= limits.projects && companyCount <= limits.companies;

  // Get next billing date if subscription exists
  let nextBillingDate;
  if (organization.stripeSubscriptionId && stripe) {
    try {
      const subscription = await stripe.subscriptions.retrieve(organization.stripeSubscriptionId);
      nextBillingDate = new Date((subscription as any).current_period_end * 1000).toISOString();
    } catch (error) {
      logger.error({ message: 'Failed to retrieve subscription', error });
    }
  }

  const subscriptionInfo = {
    currentPlan: organization.planType,
    status: organization.subscriptionStatus,
    nextBillingDate,
    projectCount: organization._count.projects,
    projectLimit: limits.projects,
    companyCount,
    companyLimit: limits.companies,
    canDowngrade,
    stripeCustomerId: organization.stripeCustomerId
  };

  res.status(200).json(subscriptionInfo);
});

// @desc    Handle Stripe webhooks
// @route   POST /api/webhooks/stripe
// @access  Public
export const handleStripeWebhook: RequestHandler = asyncHandler(async (req, res) => {
  if (!stripe) {
    res.status(503);
    throw new Error('Billing service is not configured');
  }

  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !endpointSecret) {
    res.status(400);
    throw new Error('Missing signature or webhook secret');
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    logger.error({ message: 'Webhook signature verification failed', error: err });
    res.status(400);
    throw new Error('Webhook signature verification failed');
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;
      default:
        logger.info({ message: 'Unhandled webhook event', type: event.type });
    }

    res.status(200).json({ received: true });
  } catch (error) {
    logger.error({ message: 'Webhook handler error', error, eventType: event.type });
    res.status(500);
    throw new Error('Webhook handler error');
  }
});

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  const organizationId = session.metadata?.organizationId;
  const planId = session.metadata?.planId;

  if (!organizationId || !planId) {
    throw new Error('Missing metadata in checkout session');
  }

  const planTypeMap = {
    business: 'BUSINESS',
    enterprise: 'ENTERPRISE'
  };

  await prisma.organization.update({
    where: { id: organizationId },
    data: {
      planType: planTypeMap[planId as keyof typeof planTypeMap] as any,
      subscriptionStatus: 'ACTIVE',
      stripeSubscriptionId: session.subscription as string
    }
  });

  logger.info({ message: 'Subscription activated', organizationId, planId });
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const organization = await prisma.organization.findFirst({
    where: { stripeSubscriptionId: subscription.id }
  });

  if (!organization) {
    throw new Error('Organization not found for subscription');
  }

  await prisma.organization.update({
    where: { id: organization.id },
    data: {
      subscriptionStatus: subscription.status === 'active' ? 'ACTIVE' : 'PAST_DUE'
    }
  });

  logger.info({ message: 'Subscription updated', organizationId: organization.id, status: subscription.status });
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const organization = await prisma.organization.findFirst({
    where: { stripeSubscriptionId: subscription.id }
  });

  if (!organization) {
    throw new Error('Organization not found for subscription');
  }

  await prisma.organization.update({
    where: { id: organization.id },
    data: {
      planType: 'FREE',
      subscriptionStatus: 'CANCELED',
      stripeSubscriptionId: null
    }
  });

  logger.info({ message: 'Subscription canceled', organizationId: organization.id });
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const organization = await prisma.organization.findFirst({
    where: { stripeCustomerId: invoice.customer as string }
  });

  if (!organization) {
    throw new Error('Organization not found for invoice');
  }

  await prisma.organization.update({
    where: { id: organization.id },
    data: {
      subscriptionStatus: 'PAST_DUE'
    }
  });

  logger.info({ message: 'Payment failed', organizationId: organization.id });
} 