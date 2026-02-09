import { Router, Request, Response } from 'express';
import { authenticateJwt, requireRole } from '../middleware/auth';
import { OrganizerSubscription } from '../models/OrganizerSubscription';
import { User } from '../models/User';
import { z } from 'zod';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import { auditLogService } from '../services/auditLogService';

const router = Router();

// Initialize Razorpay (optional - will be null if credentials not provided)
let razorpay: Razorpay | null = null;
try {
  if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
    razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
    console.log('✅ Razorpay initialized for subscriptions');
  } else {
    console.warn('⚠️  Razorpay credentials not configured - subscription payments will be unavailable');
  }
} catch (error: any) {
  console.error('❌ Failed to initialize Razorpay:', error.message);
}

// Import centralized subscription configuration
import { SUBSCRIPTION_PLANS } from '../config/subscription.config';

const createOrderSchema = z.object({
  planType: z.enum(['STARTER', 'BASIC', 'PROFESSIONAL', 'PREMIUM', 'ENTERPRISE']),
  skipTrial: z.boolean().optional().default(false),
});

const verifyPaymentSchema = z.object({
  razorpay_order_id: z.string(),
  razorpay_payment_id: z.string(),
  razorpay_signature: z.string(),
  planType: z.enum(['STARTER', 'BASIC', 'PROFESSIONAL', 'PREMIUM', 'ENTERPRISE']),
});

/**
 * GET /api/subscriptions/plans
 * Get available subscription plans with all features
 */
router.get('/plans', async (_req: Request, res: Response) => {
  try {
    const plans = [
      {
        id: 'STARTER',
        type: 'STARTER',
        ...SUBSCRIPTION_PLANS.STARTER,
      },
      {
        id: 'BASIC',
        type: 'BASIC',
        ...SUBSCRIPTION_PLANS.BASIC,
      },
      {
        id: 'PROFESSIONAL',
        type: 'PROFESSIONAL',
        ...SUBSCRIPTION_PLANS.PROFESSIONAL,
        popular: true, // Mark as popular plan
      },
      {
        id: 'PREMIUM',
        type: 'PREMIUM',
        ...SUBSCRIPTION_PLANS.PREMIUM,
      },
      {
        id: 'ENTERPRISE',
        type: 'ENTERPRISE',
        ...SUBSCRIPTION_PLANS.ENTERPRISE,
      },
    ];

    return res.json({
      success: true,
      plans,
      message: 'Subscription plans fetched successfully',
    });
  } catch (error: any) {
    console.error('❌ Error fetching plans:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch plans',
      message: error.message
    });
  }
});

/**
 * GET /api/subscriptions/my
 * Get current user's subscription
 */
router.get('/my', authenticateJwt, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).auth?.userId || (req as any).user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const subscription = await OrganizerSubscription.findOne({ organizerId: userId })
      .sort({ createdAt: -1 })
      .lean();

    if (!subscription) {
      // Check if user is eligible for free trial
      const user = await User.findById(userId);
      const hasHadTrial = await OrganizerSubscription.exists({
        organizerId: userId,
        isTrialActive: false,
      });

      return res.json({
        hasSubscription: false,
        eligibleForTrial: user?.role === 'organizer' && !hasHadTrial,
        trialDays: SUBSCRIPTION_PLANS.BASIC.trialDays,
      });
    }

    // Validate subscription status
    // Trial subscriptions must have status='trial' and isTrialActive=true
    if (subscription.status === 'trial' && !subscription.isTrialActive) {
      return res.json({
        hasSubscription: false,
        message: 'Trial subscription is inactive',
        reason: 'Your trial has expired or been cancelled',
      });
    }

    // Check if payment was completed for active subscriptions
    if (subscription.status === 'active' && subscription.payments && subscription.payments.length > 0) {
      const lastPayment = subscription.payments[subscription.payments.length - 1];
      if (lastPayment.status !== 'completed') {
        return res.json({
          hasSubscription: false,
          message: 'Subscription not active',
          reason: `Payment status is ${lastPayment.status}. Please complete payment.`,
          subscriptionId: subscription._id,
          paymentStatus: lastPayment.status,
        });
      }
    }

    // Calculate remaining trips
    const tripsUsed = subscription.tripsUsed || 0;
    const tripsRemaining = Math.max(0, (subscription.tripsPerCycle || 5) - tripsUsed);

    // Check if expired
    const expiryDate = subscription.subscriptionEndDate || subscription.trialEndDate;
    const isExpired = expiryDate < new Date();
    const daysUntilExpiry = Math.ceil(
      (expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );

    return res.json({
      hasSubscription: !isExpired && ['active', 'trial'].includes(subscription.status),
      subscription: {
        ...subscription,
        tripsRemaining,
        isExpired,
        daysUntilExpiry: isExpired ? 0 : daysUntilExpiry,
        isActive: subscription.status === 'active' && !isExpired,
      },
    });
  } catch (error: any) {
    console.error('❌ Error fetching subscription:', error);
    return res.status(500).json({ error: 'Failed to fetch subscription' });
  }
});

/**
 * POST /api/subscriptions/create-order
 * Create Razorpay order for subscription
 * Auto-upgrades user to organizer role if not already an organizer
 */
router.post('/create-order', authenticateJwt, requireRole(['organizer', 'admin']), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Auto-upgrade user to organizer role if not already an organizer
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // If user is not an organizer, upgrade them to organizer role
    if (user.role !== 'organizer' && user.role !== 'admin') {
      user.role = 'organizer';
      await user.save();
      console.log(`✅ Auto-upgraded user ${userId} to organizer role`);
    }

    const parsed = createOrderSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Validation error',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { planType, skipTrial } = parsed.data;
    const plan = SUBSCRIPTION_PLANS[planType];

    // Check if user has active subscription
    const existingSubscription = await OrganizerSubscription.findOne({
      organizerId: userId,
      status: { $in: ['active', 'trial'] },
    });

    if (existingSubscription) {
      return res.status(400).json({
        error: 'You already have an active subscription',
      });
    }

    // Check trial eligibility
    const hasUsedTrial = await OrganizerSubscription.exists({
      organizerId: userId,
      isTrialActive: false,
    });

    const isTrial = !skipTrial && !hasUsedTrial;
    const amount = isTrial ? 0 : plan.price * 100; // Razorpay expects amount in paise

    // If trial, create subscription directly without payment
    if (isTrial) {
      const trialEndDate = new Date();
      trialEndDate.setDate(trialEndDate.getDate() + plan.trialDays);

      const subscription = await OrganizerSubscription.create({
        organizerId: userId,
        plan: 'free-trial',
        status: 'trial',
        isTrialActive: true,
        trialStartDate: new Date(),
        trialEndDate,
        tripsPerCycle: plan.trips,
        tripsUsed: 0,
        tripsRemaining: plan.trips,
        pricePerCycle: plan.price,
      });

      // Log audit
      await auditLogService.log({
        userId,
        action: 'CREATE',
        resource: 'Subscription',
        resourceId: subscription._id.toString(),
        metadata: { planType, isTrial: true },
        req,
      });

      return res.json({
        success: true,
        isTrial: true,
        subscription,
        message: `${plan.trialDays}-day free trial activated!`,
      });
    }

    // Check if Razorpay is configured
    if (!razorpay) {
      return res.status(503).json({
        error: 'Payment service unavailable',
        message: 'Razorpay is not configured. Please contact support.'
      });
    }

    // Create Razorpay order for paid subscription
    const order = await razorpay.orders.create({
      amount,
      currency: 'INR',
      receipt: `sub_${userId}_${Date.now()}`,
      notes: {
        userId: userId.toString(),
        planType,
        planName: plan.name,
      },
    });

    console.log(`📦 Razorpay order created: ${order.id} for user ${userId}`);

    // Return response in format expected by frontend
    return res.json({
      success: true,
      isTrial: false,
      order: {
        id: order.id,
        amount: order.amount,
        currency: order.currency,
        receipt: order.receipt,
      },
      orderId: order.id, // For backward compatibility
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
      plan: {
        name: plan.name,
        price: plan.price,
        trips: plan.trips,
        features: plan.features,
      },
    });
  } catch (error: any) {
    console.error('❌ Error creating order:', error);
    return res.status(500).json({
      error: 'Failed to create order',
      message: error.message,
    });
  }
});

/**
 * POST /api/subscriptions/verify-payment
 * Verify Razorpay payment and activate subscription
 * Auto-upgrades user to organizer role if not already an organizer
 */
router.post('/verify-payment', authenticateJwt, requireRole(['organizer', 'admin']), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).auth?.userId || (req as any).user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Auto-upgrade user to organizer role if not already an organizer
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // If user is not an organizer, upgrade them to organizer role
    if (user.role !== 'organizer' && user.role !== 'admin') {
      user.role = 'organizer';
      await user.save();
      console.log(`✅ Auto-upgraded user ${userId} to organizer role`);
    }

    const parsed = verifyPaymentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Validation error',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, planType } = parsed.data;

    // Verify signature
    const secret = process.env.RAZORPAY_KEY_SECRET || '';
    const generatedSignature = crypto
      .createHmac('sha256', secret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (generatedSignature !== razorpay_signature) {
      console.error('❌ Payment signature verification failed');
      return res.status(400).json({ error: 'Invalid payment signature' });
    }

    // Check if Razorpay is configured
    if (!razorpay) {
      return res.status(503).json({
        error: 'Payment service unavailable',
        message: 'Razorpay is not configured. Please contact support.'
      });
    }

    // Fetch payment details from Razorpay
    const payment = await razorpay.payments.fetch(razorpay_payment_id);

    if (payment.status !== 'captured') {
      return res.status(400).json({ error: 'Payment not captured' });
    }

    const plan = SUBSCRIPTION_PLANS[planType];
    const startDate = new Date();
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + plan.duration);

    // Create subscription
    // Create subscription
    const crmAccessPlans = ['PROFESSIONAL', 'PREMIUM', 'ENTERPRISE'];
    const planMapping: Record<string, string> = {
      'STARTER': 'starter',
      'BASIC': 'basic',
      'PROFESSIONAL': 'professional',
      'PREMIUM': 'premium',
      'ENTERPRISE': 'enterprise'
    };

    const subscription = await OrganizerSubscription.create({
      organizerId: userId,
      plan: planMapping[planType] || 'basic',
      status: 'active',
      isTrialActive: false,
      crmAccess: crmAccessPlans.includes(planType),
      subscriptionStartDate: startDate,
      subscriptionEndDate: expiryDate,
      currentPeriodStart: startDate,
      currentPeriodEnd: expiryDate,
      tripsPerCycle: plan.trips,
      tripsUsed: 0,
      tripsRemaining: plan.trips,
      pricePerCycle: plan.price,
      payments: [{
        amount: plan.price,
        currency: 'INR',
        paymentMethod: 'razorpay',
        transactionId: razorpay_payment_id,
        paymentDate: new Date(),
        status: 'completed',
      }],
      totalPaid: plan.price,
      lastPaymentDate: new Date(),
    });

    // Log payment audit
    await auditLogService.logPayment(
      userId,
      razorpay_payment_id,
      'VERIFY',
      plan.price,
      req
    );

    console.log(`✅ Subscription activated for user ${userId}: ${planType}`);

    return res.json({
      success: true,
      subscription,
      message: `${plan.name} activated successfully!`,
    });
  } catch (error: any) {
    console.error('❌ Error verifying payment:', error);
    return res.status(500).json({
      error: 'Failed to verify payment',
      message: error.message,
    });
  }
});

/**
 * POST /api/subscriptions/cancel
 * Cancel active subscription
 */
router.post('/cancel', authenticateJwt, requireRole(['organizer']), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const subscription = await OrganizerSubscription.findOne({
      organizerId: userId,
      status: { $in: ['active', 'trial'] },
    });

    if (!subscription) {
      return res.status(404).json({ error: 'No active subscription found' });
    }

    subscription.status = 'cancelled';
    await subscription.save();

    // Log audit
    await auditLogService.log({
      userId,
      action: 'UPDATE',
      resource: 'Subscription',
      resourceId: subscription._id.toString(),
      metadata: { action: 'cancelled' },
      req,
    });

    console.log(`🚫 Subscription cancelled for user ${userId}`);

    return res.json({
      success: true,
      message: 'Subscription cancelled successfully',
    });
  } catch (error: any) {
    console.error('❌ Error cancelling subscription:', error);
    return res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

/**
 * GET /api/subscriptions/payment-history
 * Get user's payment history
 */
router.get('/payment-history', authenticateJwt, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const subscriptions = await OrganizerSubscription.find({ organizerId: userId })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    return res.json({
      payments: subscriptions.map((sub) => ({
        id: sub._id,
        plan: sub.plan,
        amount: sub.totalPaid || 0,
        status: sub.status,
        startDate: sub.subscriptionStartDate || sub.trialStartDate,
        expiryDate: sub.subscriptionEndDate || sub.trialEndDate,
        isTrial: sub.isTrialActive,
        createdAt: sub.createdAt,
      })),
      total: subscriptions.length,
    });
  } catch (error: any) {
    console.error('❌ Error fetching payment history:', error);
    return res.status(500).json({ error: 'Failed to fetch payment history' });
  }
});

/**
 * POST /api/subscriptions/increment-trip
 * Increment trip posted count (internal use)
 */
router.post('/increment-trip', authenticateJwt, requireRole(['organizer']), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const subscription = await OrganizerSubscription.findOne({
      organizerId: userId,
      status: { $in: ['active', 'trial'] },
    });

    if (!subscription) {
      return res.status(403).json({
        error: 'No active subscription',
        message: 'Please subscribe to post trips',
      });
    }

    if (subscription.tripsUsed >= subscription.tripsPerCycle) {
      return res.status(403).json({
        error: 'Trip limit reached',
        message: 'Upgrade your plan to post more trips',
      });
    }

    subscription.tripsUsed += 1;
    subscription.tripsRemaining = subscription.tripsPerCycle - subscription.tripsUsed;
    await subscription.save();

    return res.json({
      success: true,
      tripsRemaining: subscription.tripsRemaining,
    });
  } catch (error: any) {
    console.error('❌ Error incrementing trip count:', error);
    return res.status(500).json({ error: 'Failed to update trip count' });
  }
});

/**
 * GET /api/subscriptions/check-eligibility
 * Check if user can post a trip
 */
router.get('/check-eligibility', authenticateJwt, requireRole(['organizer']), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).auth?.userId || (req as any).user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const subscription = await OrganizerSubscription.findOne({
      organizerId: userId,
      status: { $in: ['active', 'trial'] },
    });

    if (!subscription) {
      return res.json({
        eligible: false,
        reason: 'no_subscription',
        message: 'Please subscribe to post trips',
        canPost: false,
        remaining: 0
      });
    }

    if (subscription.tripsUsed >= subscription.tripsPerCycle) {
      return res.json({
        eligible: false,
        reason: 'limit_reached',
        message: 'Trip limit reached. Upgrade your plan to post more trips.',
        tripsUsed: subscription.tripsUsed,
        tripsAllowed: subscription.tripsPerCycle,
        canPost: false,
        remaining: 0
      });
    }

    return res.json({
      eligible: true,
      tripsRemaining: subscription.tripsRemaining,
      planName: subscription.plan,
      canPost: true,
      remaining: subscription.tripsRemaining ?? (subscription.tripsPerCycle - subscription.tripsUsed)
    });
  } catch (error: any) {
    console.error('❌ Error checking eligibility:', error);
    return res.status(500).json({ error: 'Failed to check eligibility' });
  }
});

/**
 * POST /api/subscriptions/webhook
 * Handle Razorpay webhook events (payment.authorized, payment.failed, order.paid, etc.)
 * Webhook secret must be verified for security
 */
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    const razorpaySignature = req.headers['x-razorpay-signature'] as string;
    const body = JSON.stringify(req.body);

    // Verify webhook signature
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || '';

    if (!webhookSecret) {
      console.warn('⚠️ RAZORPAY_WEBHOOK_SECRET not configured. Webhook verification skipped.');
      // Continue processing for dev environments, but log warning
    } else {
      const generatedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(body)
        .digest('hex');

      if (generatedSignature !== razorpaySignature) {
        console.error('❌ Webhook signature verification failed');
        return res.status(401).json({ error: 'Unauthorized webhook' });
      }
    }

    const event = req.body.event;
    const eventData = req.body.payload;

    console.log(`📩 Received webhook event: ${event}`);

    // Handle different webhook events
    switch (event) {
      case 'payment.authorized':
      case 'payment.captured':
        await handlePaymentCaptured(eventData);
        break;

      case 'payment.failed':
        await handlePaymentFailed(eventData);
        break;

      case 'subscription.activated':
        await handleSubscriptionActivated(eventData);
        break;

      case 'subscription.charged':
        await handleSubscriptionCharged(eventData);
        break;

      case 'subscription.cancelled':
        await handleSubscriptionCancelled(eventData);
        break;

      case 'subscription.paused':
        await handleSubscriptionPaused(eventData);
        break;

      case 'order.paid':
        await handleOrderPaid(eventData);
        break;

      default:
        console.log(`⚠️ Unhandled event type: ${event}`);
    }

    // Always return 200 to acknowledge receipt
    return res.status(200).json({ status: 'ok' });
  } catch (error: any) {
    console.error('❌ Webhook processing error:', error);
    // Return 200 even on error to prevent Razorpay retry storms
    return res.status(200).json({ status: 'error', message: error.message });
  }
});

/**
 * Handle payment.captured event
 */
async function handlePaymentCaptured(eventData: any) {
  try {
    const payment = eventData.payment;
    const paymentId = payment?.id;
    const orderId = payment?.order_id;

    console.log(`✅ Payment captured: ${paymentId} for order ${orderId}`);

    // Log audit event
    if (paymentId && orderId) {
      await auditLogService.log({
        userId: 'system',
        action: 'payment_captured',
        resource: 'Payment',
        resourceId: paymentId,
        metadata: {
          orderId,
          amount: payment?.amount,
          currency: payment?.currency,
        },
      });
    }
  } catch (error: any) {
    console.error('❌ Error handling payment captured:', error);
  }
}

/**
 * Handle payment.failed event
 */
async function handlePaymentFailed(eventData: any) {
  try {
    const payment = eventData.payment;
    const paymentId = payment?.id;
    const orderId = payment?.order_id;
    const errorReason = payment?.vpa || payment?.description || 'Unknown error';

    console.error(`❌ Payment failed: ${paymentId} for order ${orderId}. Reason: ${errorReason}`);

    // Log audit event
    await auditLogService.log({
      userId: 'system',
      action: 'payment_failed',
      resource: 'Payment',
      resourceId: paymentId,
      metadata: {
        orderId,
        reason: errorReason,
        amount: payment?.amount,
      },
    });

    // Note: Frontend should handle retry logic based on payment status
  } catch (error: any) {
    console.error('❌ Error handling payment failed:', error);
  }
}

/**
 * Handle subscription.activated event
 */
async function handleSubscriptionActivated(eventData: any) {
  try {
    const subscription = eventData.subscription;
    const subscriptionId = subscription?.id;

    console.log(`✅ Subscription activated: ${subscriptionId}`);

    await auditLogService.log({
      userId: 'system',
      action: 'subscription_activated',
      resource: 'Subscription',
      resourceId: subscriptionId,
    });
  } catch (error: any) {
    console.error('❌ Error handling subscription activated:', error);
  }
}

/**
 * Handle subscription.charged event (automatic recurring payment)
 */
async function handleSubscriptionCharged(eventData: any) {
  try {
    const subscription = eventData.subscription;
    const payment = eventData.payment;
    const subscriptionId = subscription?.id;
    const paymentId = payment?.id;

    console.log(`✅ Subscription charged: ${subscriptionId}, Payment: ${paymentId}`);

    await auditLogService.log({
      userId: 'system',
      action: 'subscription_charged',
      resource: 'Subscription',
      resourceId: subscriptionId,
      metadata: {
        paymentId,
        amount: payment?.amount,
      },
    });
  } catch (error: any) {
    console.error('❌ Error handling subscription charged:', error);
  }
}

/**
 * Handle subscription.cancelled event
 */
async function handleSubscriptionCancelled(eventData: any) {
  try {
    const subscription = eventData.subscription;
    const subscriptionId = subscription?.id;

    console.log(`✅ Subscription cancelled: ${subscriptionId}`);

    await auditLogService.log({
      userId: 'system',
      action: 'subscription_cancelled',
      resource: 'Subscription',
      resourceId: subscriptionId,
    });
  } catch (error: any) {
    console.error('❌ Error handling subscription cancelled:', error);
  }
}

/**
 * Handle subscription.paused event
 */
async function handleSubscriptionPaused(eventData: any) {
  try {
    const subscription = eventData.subscription;
    const subscriptionId = subscription?.id;

    console.log(`⏸️ Subscription paused: ${subscriptionId}`);

    await auditLogService.log({
      userId: 'system',
      action: 'subscription_paused',
      resource: 'Subscription',
      resourceId: subscriptionId,
    });
  } catch (error: any) {
    console.error('❌ Error handling subscription paused:', error);
  }
}

/**
 * Handle order.paid event
 */
async function handleOrderPaid(eventData: any) {
  try {
    const order = eventData.order;
    const orderId = order?.id;

    console.log(`✅ Order marked as paid: ${orderId}`);

    await auditLogService.log({
      userId: 'system',
      action: 'order_paid',
      resource: 'Payment',
      resourceId: orderId,
    });
  } catch (error: any) {
    console.error('❌ Error handling order paid:', error);
  }
}

/**
 * GET /api/subscriptions/verify-crm-access
 * Verify if user has CRM access based on their subscription plan
 * Returns CRM access status, lead verification, and phone number visibility
 */
router.get('/verify-crm-access', authenticateJwt, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId || (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // First check if user has organizerProfile with CRM access flag
    const user = await User.findById(userId).lean();
    if (user && user.organizerProfile) {
      const profile = user.organizerProfile as any;
      if (profile.crmEnabled || profile.crmAccess) {
        return res.json({
          hasCRMAccess: true,
          hasLeadCapture: true,
          canViewPhoneNumbers: true,
          planType: 'PREMIUM',
          planName: 'Premium Plan',
          message: 'CRM access granted via organizer profile',
          accessGranted: true,
          accessReason: 'Organizer profile has CRM access enabled',
          features: {
            crm: {
              enabled: true,
              description: 'Full CRM access for managing leads and participants'
            },
            leadCapture: {
              enabled: true,
              description: 'Automatically capture and organize leads from your trips'
            },
            phoneNumbers: {
              enabled: true,
              description: 'View phone numbers of leads and participants'
            },
            leadVerification: {
              enabled: true,
              description: 'Verify leads before adding to your trips'
            }
          }
        });
      }
    }

    const subscription = await OrganizerSubscription.findOne({ organizerId: userId })
      .sort({ createdAt: -1 })
      .lean();

    // Check if subscription exists
    if (!subscription) {
      return res.json({
        hasCRMAccess: false,
        hasLeadCapture: false,
        canViewPhoneNumbers: false,
        planType: 'NONE',
        message: 'No active subscription',
        accessDeniedReason: 'No subscription found',
      });
    }

    // Check if subscription status is valid (must be 'active' or 'trial')
    if (!['active', 'trial'].includes(subscription.status)) {
      return res.json({
        hasCRMAccess: false,
        hasLeadCapture: false,
        canViewPhoneNumbers: false,
        planType: subscription.plan,
        subscriptionStatus: subscription.status,
        message: 'Subscription is not active',
        accessDeniedReason: `Subscription status is ${subscription.status}. Please renew your subscription.`,
      });
    }

    // Check if subscription has expired
    const now = new Date();
    const endDate = subscription.subscriptionEndDate || subscription.currentPeriodEnd;

    if (endDate && endDate < now && subscription.status !== 'trial') {
      return res.json({
        hasCRMAccess: false,
        hasLeadCapture: false,
        canViewPhoneNumbers: false,
        planType: subscription.plan,
        subscriptionStatus: 'expired',
        subscriptionEndDate: endDate,
        message: 'Subscription has expired',
        accessDeniedReason: `Your subscription expired on ${endDate.toLocaleDateString()}. Please renew.`,
      });
    }

    // Verify payment was actually captured (for paid subscriptions)
    if (subscription.status === 'active' && subscription.payments) {
      const lastPayment = subscription.payments[subscription.payments.length - 1];
      if (lastPayment && lastPayment.status !== 'completed') {
        return res.json({
          hasCRMAccess: false,
          hasLeadCapture: false,
          canViewPhoneNumbers: false,
          planType: subscription.plan,
          subscriptionStatus: subscription.status,
          message: 'Payment not completed',
          accessDeniedReason: `Your payment status is ${lastPayment.status}. Please complete payment to activate CRM access.`,
        });
      }
    }

    // Normalize plan name to match SUBSCRIPTION_PLANS keys
    const planKey = subscription.plan.toUpperCase();
    // Handle 'pro' -> 'PROFESSIONAL' mapping and other variations
    let normalizedPlanKey: keyof typeof SUBSCRIPTION_PLANS;
    if (planKey === 'PRO' || planKey === 'PROFESSIONAL') {
      normalizedPlanKey = 'PROFESSIONAL';
    } else if (planKey === 'PREMIUM') {
      normalizedPlanKey = 'PREMIUM';
    } else if (planKey === 'STARTER') {
      normalizedPlanKey = 'STARTER';
    } else if (planKey === 'BASIC') {
      normalizedPlanKey = 'BASIC';
    } else if (planKey === 'ENTERPRISE') {
      normalizedPlanKey = 'ENTERPRISE';
    } else {
      // Unknown plan type, will check by price instead
      // Use a valid key for type safety, but plan will be undefined
      normalizedPlanKey = 'STARTER';
    }

    const plan = SUBSCRIPTION_PLANS[normalizedPlanKey];

    // Get subscription price from plan or from payment history
    let subscriptionPrice = plan?.price || 0;
    if (!plan && subscription.payments && subscription.payments.length > 0) {
      // If plan not found, try to get price from last payment
      const lastPayment = subscription.payments[subscription.payments.length - 1];
      // Convert from paise to rupees if needed (if amount > 10000, likely in paise)
      subscriptionPrice = lastPayment.amount || 0;
      if (subscriptionPrice > 10000) {
        subscriptionPrice = subscriptionPrice / 100; // Convert paise to rupees
      }
    } else if (subscription.pricePerCycle) {
      // Use pricePerCycle if available (convert from paise if needed)
      subscriptionPrice = subscription.pricePerCycle;
      if (subscriptionPrice > 10000) {
        subscriptionPrice = subscriptionPrice / 100; // Convert paise to rupees
      }
    }

    // Check if subscription price is >= ₹2299 for CRM access
    // This ensures any subscription at ₹2299 or above gets CRM access
    // Also check if plan is PREMIUM or PROFESSIONAL (which have CRM access)
    const hasAccessByPrice = subscriptionPrice >= 2299;
    const isPremiumOrProfessional = normalizedPlanKey === 'PREMIUM' || normalizedPlanKey === 'PROFESSIONAL';

    // Determine CRM access: either plan has crmAccess flag OR price >= ₹2299 OR is premium/professional OR manual override
    const hasCRMAccessByPlan = plan?.crmAccess === true;
    const hasManualOverride = (subscription as any).crmAccess === true;
    const finalCRMAccess = hasCRMAccessByPlan || hasAccessByPrice || isPremiumOrProfessional || hasManualOverride;

    // Lead capture and phone numbers also require CRM-level access
    const hasLeadCapture = (plan?.leadCapture === true) || hasAccessByPrice || isPremiumOrProfessional;
    const canViewPhoneNumbers = (plan?.phoneNumbers === true) || hasAccessByPrice || isPremiumOrProfessional;

    if (!plan && !hasAccessByPrice) {
      return res.json({
        hasCRMAccess: false,
        hasLeadCapture: false,
        canViewPhoneNumbers: false,
        planType: subscription.plan,
        planPrice: subscriptionPrice,
        message: 'Invalid plan type or insufficient subscription level',
        accessDeniedReason: `Plan "${subscription.plan}" is not recognized and subscription price (₹${subscriptionPrice}) is below ₹2299. CRM access requires subscription of ₹2299 or above.`,
      });
    }

    return res.json({
      hasCRMAccess: finalCRMAccess,
      hasLeadCapture: hasLeadCapture,
      canViewPhoneNumbers: canViewPhoneNumbers,
      planType: subscription.plan,
      planName: plan?.name || normalizedPlanKey || 'Custom Plan',
      planPrice: subscriptionPrice,
      subscriptionStatus: subscription.status,
      subscriptionEndDate: subscription.subscriptionEndDate || subscription.currentPeriodEnd,
      isTrialActive: subscription.isTrialActive,
      message: 'CRM access verified',
      accessGranted: true,
      accessReason: hasAccessByPrice ? 'Subscription price >= ₹2299' : 'Plan includes CRM access',
      features: {
        crm: {
          enabled: finalCRMAccess,
          description: 'Full CRM access for managing leads and participants'
        },
        leadCapture: {
          enabled: hasLeadCapture,
          description: 'Automatically capture and organize leads from your trips'
        },
        phoneNumbers: {
          enabled: canViewPhoneNumbers,
          description: 'View phone numbers of leads and participants'
        },
        leadVerification: {
          enabled: hasLeadCapture,
          description: 'Verify leads before adding to your trips'
        }
      }
    });
  } catch (error: any) {
    console.error('❌ Error verifying CRM access:', error);
    return res.status(500).json({ error: 'Failed to verify CRM access' });
  }
});

/**
 * POST /api/subscriptions/check-feature-access
 * Check if user has access to specific features
 * Useful for frontend to conditionally show/hide features
 */
router.post('/check-feature-access', authenticateJwt, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const { features } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!Array.isArray(features)) {
      return res.status(400).json({ error: 'Features must be an array' });
    }

    const subscription = await OrganizerSubscription.findOne({ organizerId: userId })
      .sort({ createdAt: -1 })
      .lean();

    if (!subscription) {
      return res.json({
        accessMap: features.reduce((acc, feature) => {
          acc[feature] = false;
          return acc;
        }, {} as Record<string, boolean>),
        planType: 'NONE',
      });
    }

    const plan = SUBSCRIPTION_PLANS[subscription.plan.toUpperCase() as keyof typeof SUBSCRIPTION_PLANS];

    const accessMap: Record<string, boolean> = {};
    features.forEach(feature => {
      switch (feature.toLowerCase()) {
        case 'crm':
        case 'crm_access':
          accessMap[feature] = plan.crmAccess === true;
          break;
        case 'lead_capture':
        case 'leadcapture':
          accessMap[feature] = plan.leadCapture === true;
          break;
        case 'phone_numbers':
        case 'phonenumbers':
          accessMap[feature] = plan.phoneNumbers === true;
          break;
        case 'lead_verification':
        case 'leadverification':
          accessMap[feature] = plan.leadCapture === true;
          break;
        default:
          accessMap[feature] = false;
      }
    });

    return res.json({
      accessMap,
      planType: subscription.plan,
      planName: plan.name,
    });
  } catch (error: any) {
    console.error('❌ Error checking feature access:', error);
    return res.status(500).json({ error: 'Failed to check feature access' });
  }
});

/**
 * GET /api/subscriptions/verify-organizer-info
 * Verify that organizer information is properly loaded and complete
 * Returns organizer profile completeness status
 */
router.get('/verify-organizer-info', authenticateJwt, requireRole(['organizer']), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await User.findById(userId).lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        profileComplete: false,
        message: 'User profile not found',
        verification: {
          namePresent: false,
          emailVerified: false,
          phonePresent: false,
          profilePhotoPresent: false,
          organizerProfileComplete: false,
        },
      });
    }

    // Check for required organizer information
    const verification = {
      namePresent: !!user.name && user.name.trim().length > 0,
      emailVerified: !!user.email && user.emailVerified === true,
      phonePresent: !!user.phone && user.phone.trim().length > 0,
      profilePhotoPresent: !!user.profilePhoto && user.profilePhoto.trim().length > 0,
      organizerProfileComplete: !!(
        user.organizerProfile &&
        Object.keys(user.organizerProfile).length > 0
      ),
      bioPresent: !!user.bio && user.bio.trim().length > 0,
      bankDetailsPresent: !!(
        user.organizerProfile?.bankDetails &&
        Object.keys(user.organizerProfile.bankDetails).length > 0
      ),
    };

    // Calculate profile completion percentage
    const requiredFields = [
      'namePresent',
      'emailVerified',
      'phonePresent',
      'profilePhotoPresent',
      'organizerProfileComplete'
    ];

    const completedFields = requiredFields.filter(field => verification[field as keyof typeof verification]).length;
    const completionPercentage = Math.round((completedFields / requiredFields.length) * 100);

    const profileComplete = completionPercentage >= 80; // 80% threshold for complete profile

    return res.json({
      success: true,
      profileComplete,
      completionPercentage,
      message: profileComplete ? 'Organizer profile is complete' : 'Organizer profile is incomplete',
      verification,
      profile: {
        name: user.name || null,
        email: user.email || null,
        phone: user.phone || null,
        profilePhoto: user.profilePhoto || null,
        bio: user.bio || null,
        role: user.role,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
      },
      missingFields: requiredFields.filter(field => !verification[field as keyof typeof verification]),
      recommendations: getOrganizerProfileRecommendations(verification),
    });
  } catch (error: any) {
    console.error('❌ Error verifying organizer info:', error);
    return res.status(500).json({
      error: 'Failed to verify organizer information',
      message: error.message,
    });
  }
});

/**
 * Helper function to get recommendations for profile completion
 */
function getOrganizerProfileRecommendations(verification: any): string[] {
  const recommendations: string[] = [];

  if (!verification.namePresent) {
    recommendations.push('Add your full name to your profile');
  }
  if (!verification.emailVerified) {
    recommendations.push('Verify your email address');
  }
  if (!verification.phonePresent) {
    recommendations.push('Add a verified phone number');
  }
  if (!verification.profilePhotoPresent) {
    recommendations.push('Upload a profile photo to build trust with customers');
  }
  if (!verification.organizerProfileComplete) {
    recommendations.push('Complete your organizer profile information');
  }
  if (!verification.bioPresent) {
    recommendations.push('Add a bio to describe your experience and expertise');
  }
  if (!verification.bankDetailsPresent) {
    recommendations.push('Add bank details for receiving payments');
  }

  return recommendations;
}


/**
 * PATCH /api/subscriptions/:organizerId
 * Admin only: Update subscription details manually
 */
router.patch('/:organizerId', authenticateJwt, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const { organizerId } = req.params;
    const updates = req.body;

    // Find subscription
    let subscription = await OrganizerSubscription.findOne({ organizerId });

    if (!subscription) {
      // Create if strictly requested or return 404? 
      // Let's create a partial one if admin wants to force a sub
      const startDate = new Date();
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + 30);

      subscription = await OrganizerSubscription.create({
        organizerId,
        plan: updates.plan || 'basic',
        status: updates.status || 'active',
        isTrialActive: false,
        crmAccess: updates.crmAccess || false,
        subscriptionStartDate: startDate,
        subscriptionEndDate: expiryDate,
        currentPeriodStart: startDate,
        currentPeriodEnd: expiryDate,
        tripsPerCycle: 5,
        tripsUsed: 0,
        tripsRemaining: 5,
        pricePerCycle: 0,
        totalPaid: 0,
        lastPaymentDate: new Date(),
      });
    }

    // Apply updates
    if (updates.plan) subscription.plan = updates.plan;
    if (updates.status) subscription.status = updates.status;
    if (updates.crmAccess !== undefined) subscription.crmAccess = updates.crmAccess;
    if (updates.tripsRemaining !== undefined) {
      // Fix: Update tripsPerCycle so the pre-save hook calculates the correct remaining amount
      // tripsRemaining = tripsPerCycle - tripsUsed  =>  tripsPerCycle = tripsRemaining + tripsUsed
      subscription.tripsPerCycle = Number(updates.tripsRemaining) + subscription.tripsUsed;
      subscription.tripsRemaining = Number(updates.tripsRemaining);
    }
    if (updates.validUntil) {
      subscription.subscriptionEndDate = new Date(updates.validUntil);
      subscription.currentPeriodEnd = new Date(updates.validUntil);
    }

    await subscription.save();

    // Audit
    await auditLogService.log({
      userId: (req as any).user.userId,
      action: 'UPDATE',
      resource: 'Subscription',
      resourceId: subscription._id.toString(),
      metadata: { updates, targetUser: organizerId },
      req
    });

    return res.json({
      success: true,
      message: 'Subscription updated by admin',
      subscription
    });
  } catch (error: any) {
    console.error('❌ Error updating subscription:', error);
    return res.status(500).json({ error: 'Failed to update subscription' });
  }
});


/**
 * GET /api/subscriptions/:organizerId
 * Admin/Organizer: Get specific subscription details
 */
router.get('/:organizerId', authenticateJwt, async (req: Request, res: Response) => {
  try {
    const { organizerId } = req.params;
    const requesterId = (req as any).user.userId;
    const role = (req as any).user.role;

    // Access control: Admin or the user themselves
    if (role !== 'admin' && requesterId !== organizerId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const subscription = await OrganizerSubscription.findOne({ organizerId });

    if (!subscription) {
      return res.json({
        success: false,
        message: 'No subscription found',
      });
    }

    return res.json({
      success: true,
      data: subscription
    });
  } catch (error: any) {
    console.error('❌ Error fetching subscription:', error);
    return res.status(500).json({ error: 'Failed to fetch subscription' });
  }
});

export default router;
