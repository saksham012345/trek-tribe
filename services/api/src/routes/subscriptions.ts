import { Router, Request, Response } from 'express';
import { authenticateJwt, requireRole } from '../middleware/auth';
import { OrganizerSubscription } from '../models/OrganizerSubscription';
import { User } from '../models/User';
import { z } from 'zod';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import { auditLogService } from '../services/auditLogService';

const router = Router();

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || '',
  key_secret: process.env.RAZORPAY_KEY_SECRET || '',
});

// Subscription plans
const SUBSCRIPTION_PLANS = {
  BASIC: {
    name: 'Basic Plan',
    price: 1499,
    trips: 5,
    duration: 30, // days
    features: ['Post 5 trips', 'Basic support', 'Payment integration'],
    trialDays: 60, // 2 months free trial
  },
  PREMIUM: {
    name: 'Premium Plan',
    price: 2100,
    trips: 10,
    duration: 30, // days
    features: [
      'Post 10 trips',
      'CRM access',
      'AI tools',
      'Priority verification',
      'Analytics dashboard',
      '24/7 support',
    ],
    trialDays: 60,
  },
};

const createOrderSchema = z.object({
  planType: z.enum(['BASIC', 'PREMIUM']),
  skipTrial: z.boolean().optional().default(false),
});

const verifyPaymentSchema = z.object({
  razorpay_order_id: z.string(),
  razorpay_payment_id: z.string(),
  razorpay_signature: z.string(),
  planType: z.enum(['BASIC', 'PREMIUM']),
});

/**
 * GET /api/subscriptions/plans
 * Get available subscription plans
 */
router.get('/plans', async (_req: Request, res: Response) => {
  try {
    return res.json({
      plans: [
        {
          id: 'BASIC',
          ...SUBSCRIPTION_PLANS.BASIC,
        },
        {
          id: 'PREMIUM',
          ...SUBSCRIPTION_PLANS.PREMIUM,
        },
      ],
    });
  } catch (error: any) {
    console.error('❌ Error fetching plans:', error);
    return res.status(500).json({ error: 'Failed to fetch plans' });
  }
});

/**
 * GET /api/subscriptions/my
 * Get current user's subscription
 */
router.get('/my', authenticateJwt, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;

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
      hasSubscription: true,
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
 */
router.post('/create-order', authenticateJwt, requireRole(['organizer']), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
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
        isTrial: true,
        subscription,
        message: `${plan.trialDays}-day free trial activated!`,
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

    return res.json({
      isTrial: false,
      orderId: order.id,
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
 */
router.post('/verify-payment', authenticateJwt, requireRole(['organizer']), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
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
    const subscription = await OrganizerSubscription.create({
      organizerId: userId,
      plan: planType === 'BASIC' ? 'basic' : 'pro',
      status: 'active',
      isTrialActive: false,
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
    const userId = (req as any).user?.userId;

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
      });
    }

    if (subscription.tripsUsed >= subscription.tripsPerCycle) {
      return res.json({
        eligible: false,
        reason: 'limit_reached',
        message: 'Trip limit reached. Upgrade your plan to post more trips.',
        tripsUsed: subscription.tripsUsed,
        tripsAllowed: subscription.tripsPerCycle,
      });
    }

    return res.json({
      eligible: true,
      tripsRemaining: subscription.tripsRemaining,
      planName: subscription.plan,
    });
  } catch (error: any) {
    console.error('❌ Error checking eligibility:', error);
    return res.status(500).json({ error: 'Failed to check eligibility' });
  }
});

export default router;
