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
exports.handleStripeWebhook = exports.getSubscriptionInfo = exports.createPortalSession = exports.createCheckoutSession = void 0;
const express_async_handler_1 = __importDefault(require("express-async-handler"));
const db_1 = __importDefault(require("../../db"));
const logger_1 = __importDefault(require("../../logger"));
const stripe_1 = __importDefault(require("stripe"));
const client_1 = require("@prisma/client");
const zod_1 = require("zod");
// Initialize Stripe only if the secret key is available
const stripe = process.env.STRIPE_SECRET_KEY ? new stripe_1.default(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2025-06-30.basil',
}) : null;
const createCheckoutSessionSchema = zod_1.z.object({
    planId: zod_1.z.string().min(1, 'Plan ID is required'),
    successUrl: zod_1.z.string().url('Success URL must be a valid URL'),
    cancelUrl: zod_1.z.string().url('Cancel URL must be a valid URL'),
});
const portalSessionSchema = zod_1.z.object({
    returnUrl: zod_1.z.string().url('Return URL must be a valid URL'),
});
// @desc    Create Stripe checkout session
// @route   POST /api/billing/create-checkout-session
// @access  Private
exports.createCheckoutSession = (0, express_async_handler_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
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
    const organization = yield db_1.default.organization.findUnique({
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
    const plan = plans[planId];
    if (!plan) {
        res.status(400);
        throw new Error('Invalid plan selected');
    }
    try {
        // Create or get Stripe customer
        let customerId = organization.stripeCustomerId;
        if (!customerId) {
            const customer = yield stripe.customers.create({
                email: user.email,
                name: organization.name,
                metadata: {
                    organizationId: organization.id,
                    userId: user.id
                }
            });
            customerId = customer.id;
            // Update organization with customer ID
            yield db_1.default.organization.update({
                where: { id: organization.id },
                data: { stripeCustomerId: customerId }
            });
        }
        // Create checkout session
        const session = yield stripe.checkout.sessions.create({
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
        logger_1.default.info({ message: 'Checkout session created', sessionId: session.id, organizationId: organization.id });
        res.status(200).json({ sessionId: session.id, url: session.url });
    }
    catch (error) {
        logger_1.default.error({ message: 'Failed to create checkout session', error, organizationId: organization.id });
        res.status(500);
        throw new Error('Failed to create checkout session');
    }
}));
// @desc    Create Stripe customer portal session
// @route   POST /api/billing/create-portal-session
// @access  Private
exports.createPortalSession = (0, express_async_handler_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
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
    const organization = yield db_1.default.organization.findUnique({
        where: { id: user.activeOrganizationId }
    });
    if (!organization || !organization.stripeCustomerId) {
        res.status(404);
        throw new Error('No active subscription found');
    }
    try {
        const session = yield stripe.billingPortal.sessions.create({
            customer: organization.stripeCustomerId,
            return_url: returnUrl || `${process.env.FRONTEND_URL}/settings`,
        });
        res.status(200).json({ url: session.url });
    }
    catch (error) {
        logger_1.default.error({ message: 'Failed to create portal session', error, organizationId: organization.id });
        res.status(500);
        throw new Error('Failed to create portal session');
    }
}));
// @desc    Get subscription information
// @route   GET /api/billing/subscription
// @access  Private
exports.getSubscriptionInfo = (0, express_async_handler_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    if (!user || !user.activeOrganizationId) {
        res.status(401);
        throw new Error('Not authorized');
    }
    const organization = yield db_1.default.organization.findUnique({
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
    const role = membership === null || membership === void 0 ? void 0 : membership.role;
    let companyCount = 1;
    if (role === client_1.UserRole.ORG_ADMIN) {
        companyCount = yield db_1.default.organization.count();
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
            const subscription = yield stripe.subscriptions.retrieve(organization.stripeSubscriptionId);
            nextBillingDate = new Date(subscription.current_period_end * 1000).toISOString();
        }
        catch (error) {
            logger_1.default.error({ message: 'Failed to retrieve subscription', error });
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
}));
// @desc    Handle Stripe webhooks
// @route   POST /api/webhooks/stripe
// @access  Public
exports.handleStripeWebhook = (0, express_async_handler_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
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
    let event;
    try {
        event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    }
    catch (err) {
        logger_1.default.error({ message: 'Webhook signature verification failed', error: err });
        res.status(400);
        throw new Error('Webhook signature verification failed');
    }
    try {
        switch (event.type) {
            case 'checkout.session.completed':
                yield handleCheckoutSessionCompleted(event.data.object);
                break;
            case 'customer.subscription.updated':
                yield handleSubscriptionUpdated(event.data.object);
                break;
            case 'customer.subscription.deleted':
                yield handleSubscriptionDeleted(event.data.object);
                break;
            case 'invoice.payment_failed':
                yield handlePaymentFailed(event.data.object);
                break;
            default:
                logger_1.default.info({ message: 'Unhandled webhook event', type: event.type });
        }
        res.status(200).json({ received: true });
    }
    catch (error) {
        logger_1.default.error({ message: 'Webhook handler error', error, eventType: event.type });
        res.status(500);
        throw new Error('Webhook handler error');
    }
}));
function handleCheckoutSessionCompleted(session) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        const organizationId = (_a = session.metadata) === null || _a === void 0 ? void 0 : _a.organizationId;
        const planId = (_b = session.metadata) === null || _b === void 0 ? void 0 : _b.planId;
        if (!organizationId || !planId) {
            throw new Error('Missing metadata in checkout session');
        }
        const planTypeMap = {
            business: 'BUSINESS',
            enterprise: 'ENTERPRISE'
        };
        yield db_1.default.organization.update({
            where: { id: organizationId },
            data: {
                planType: planTypeMap[planId],
                subscriptionStatus: 'ACTIVE',
                stripeSubscriptionId: session.subscription
            }
        });
        logger_1.default.info({ message: 'Subscription activated', organizationId, planId });
    });
}
function handleSubscriptionUpdated(subscription) {
    return __awaiter(this, void 0, void 0, function* () {
        const organization = yield db_1.default.organization.findFirst({
            where: { stripeSubscriptionId: subscription.id }
        });
        if (!organization) {
            throw new Error('Organization not found for subscription');
        }
        yield db_1.default.organization.update({
            where: { id: organization.id },
            data: {
                subscriptionStatus: subscription.status === 'active' ? 'ACTIVE' : 'PAST_DUE'
            }
        });
        logger_1.default.info({ message: 'Subscription updated', organizationId: organization.id, status: subscription.status });
    });
}
function handleSubscriptionDeleted(subscription) {
    return __awaiter(this, void 0, void 0, function* () {
        const organization = yield db_1.default.organization.findFirst({
            where: { stripeSubscriptionId: subscription.id }
        });
        if (!organization) {
            throw new Error('Organization not found for subscription');
        }
        yield db_1.default.organization.update({
            where: { id: organization.id },
            data: {
                planType: 'FREE',
                subscriptionStatus: 'CANCELED',
                stripeSubscriptionId: null
            }
        });
        logger_1.default.info({ message: 'Subscription canceled', organizationId: organization.id });
    });
}
function handlePaymentFailed(invoice) {
    return __awaiter(this, void 0, void 0, function* () {
        const organization = yield db_1.default.organization.findFirst({
            where: { stripeCustomerId: invoice.customer }
        });
        if (!organization) {
            throw new Error('Organization not found for invoice');
        }
        yield db_1.default.organization.update({
            where: { id: organization.id },
            data: {
                subscriptionStatus: 'PAST_DUE'
            }
        });
        logger_1.default.info({ message: 'Payment failed', organizationId: organization.id });
    });
}
