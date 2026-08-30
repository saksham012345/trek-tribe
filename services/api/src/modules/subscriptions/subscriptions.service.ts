/**
 * Subscriptions Service
 *
 * All business logic extracted from routes/subscriptions.ts.
 * No req/res objects — pure data in, data out.
 */

import Razorpay from 'razorpay';
import crypto from 'crypto';
import { prisma } from '../../lib/prisma';
import { upsertRacingSafely } from '../../lib/upsert';
import { toNumber } from '../../lib/money';
import { decorate, tripsRemaining as slotsLeft } from '../../services/organizerSubscriptionService';
import { UserPrisma as User } from '../../models/userPrismaAdapter';
import { auditLogService } from '../../services/auditLogService';
import { SUBSCRIPTION_PLANS } from '../../config/subscription.config';

// Initialize Razorpay (optional)
let razorpay: Razorpay | null = null;
try {
  if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
    razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  }
} catch (error: any) {
  console.error('❌ Failed to initialize Razorpay in subscriptions service:', error.message);
}

// ─── Plans ────────────────────────────────────────────────────────────────────

export function getPlans() {
  return [
    { id: 'STARTER', type: 'STARTER', ...SUBSCRIPTION_PLANS.STARTER },
    { id: 'BASIC', type: 'BASIC', ...SUBSCRIPTION_PLANS.BASIC },
    { id: 'PROFESSIONAL', type: 'PROFESSIONAL', ...SUBSCRIPTION_PLANS.PROFESSIONAL, popular: true },
    { id: 'PREMIUM', type: 'PREMIUM', ...SUBSCRIPTION_PLANS.PREMIUM },
    { id: 'ENTERPRISE', type: 'ENTERPRISE', ...SUBSCRIPTION_PLANS.ENTERPRISE },
  ];
}

// ─── My Subscription ──────────────────────────────────────────────────────────

export async function getMySubscription(userId: string) {
  // organizerId is unique, so there is at most one row and the sort had nothing
  // to order. The payments are loaded with it because the check below reads the
  // most recent one.
  const subscription = await prisma.organizerSubscription.findUnique({
    where: { organizerId: userId },
    include: { payments: { orderBy: { paymentDate: 'asc' } } }
  });

  if (!subscription) {
    const user = await User.findById(userId);
    // hasHadTrial is always false here and always was: this branch is only
    // reached when the organizer has no subscription row at all, and the query
    // asks whether one of their rows has isTrialActive false. Kept as it stands
    // rather than quietly changed - whether a returning organizer gets a second
    // free trial is a product decision, not a migration one.
    const hasHadTrial = false;
    return {
      hasSubscription: false,
      eligibleForTrial: user?.role === 'organizer' && !hasHadTrial,
      trialDays: SUBSCRIPTION_PLANS.BASIC.trialDays,
    };
  }

  if (subscription.status === 'trial' && !subscription.isTrialActive) {
    return {
      hasSubscription: false,
      message: 'Trial subscription is inactive',
      reason: 'Your trial has expired or been cancelled',
    };
  }

  if (subscription.status === 'active' && subscription.payments && subscription.payments.length > 0) {
    const lastPayment = subscription.payments[subscription.payments.length - 1];
    if (lastPayment.status !== 'completed') {
      return {
        hasSubscription: false,
        message: 'Subscription not active',
        reason: `Payment status is ${lastPayment.status}. Please complete payment.`,
        subscriptionId: subscription.id,
        paymentStatus: lastPayment.status,
      };
    }
  }

  const tripsUsed = subscription.tripsUsed || 0;
  const tripsRemaining = Math.max(0, (subscription.tripsPerCycle || 5) - tripsUsed);

  // Both dates are optional, and a subscription created by canCreateTrip has
  // neither. `expiryDate < new Date()` on undefined is false and
  // `expiryDate.getTime()` on undefined throws, so this route returned a 500
  // for exactly those organizers - the ones with a pending subscription and
  // nothing else, who are the most likely to be looking at this page.
  const expiryDate = subscription.subscriptionEndDate || subscription.trialEndDate;
  const isExpired = expiryDate ? expiryDate < new Date() : false;
  const daysUntilExpiry = expiryDate
    ? Math.ceil((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : 0;

  return {
    hasSubscription: !isExpired && ['active', 'trial'].includes(subscription.status),
    subscription: {
      ...decorate(subscription),
      tripsRemaining,
      isExpired,
      daysUntilExpiry: isExpired ? 0 : daysUntilExpiry,
      isActive: subscription.status === 'active' && !isExpired,
    },
  };
}

// ─── Create Order ─────────────────────────────────────────────────────────────

export async function createOrder(userId: string, planType: string, skipTrial: boolean, req: any) {
  const user = await User.findById(userId);
  if (!user) throw Object.assign(new Error('User not found'), { status: 404 });

  if (user.role !== 'organizer' && user.role !== 'admin') {
    user.role = 'organizer';
    await user.save();
  }

  const plan = SUBSCRIPTION_PLANS[planType as keyof typeof SUBSCRIPTION_PLANS];

  const existingSubscription = await prisma.organizerSubscription.findFirst({
    where: { organizerId: userId, status: { in: ['active', 'trial'] } },
  });
  if (existingSubscription) {
    throw Object.assign(new Error('You already have an active subscription'), { status: 400 });
  }

  // Unlike the same-looking check in getMySubscription, this one can be true:
  // an organizer whose subscription expired still has a row, with
  // isTrialActive false.
  const hasUsedTrial = !!(await prisma.organizerSubscription.findFirst({
    where: { organizerId: userId, isTrialActive: false },
    select: { id: true },
  }));

  const isTrial = !skipTrial && !hasUsedTrial;
  const amount = isTrial ? 0 : plan.price * 100;

  if (isTrial) {
    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + plan.trialDays);

    // upsert, not create. organizerId is unique: an organizer with a cancelled
    // or expired row passes the checks above and then collided on insert, so
    // starting a trial after a lapsed subscription failed with a duplicate key
    // error rather than starting a trial.
    const subscription = await upsertRacingSafely(() => prisma.organizerSubscription.upsert({
      where: { organizerId: userId },
      create: {
        organizerId: userId,
        plan: 'free_trial',
        status: 'trial',
        isTrialActive: true,
        trialStartDate: new Date(),
        trialEndDate,
        tripsPerCycle: plan.trips,
        tripsUsed: 0,
        pricePerCycle: plan.price,
      },
      update: {
        plan: 'free_trial',
        status: 'trial',
        isTrialActive: true,
        trialStartDate: new Date(),
        trialEndDate,
        tripsPerCycle: plan.trips,
        tripsUsed: 0,
        pricePerCycle: plan.price,
      },
    }));

    await auditLogService.log({
      userId,
      action: 'CREATE',
      resource: 'Subscription',
      resourceId: subscription.id,
      metadata: { planType, isTrial: true },
      req,
    });

    return {
      success: true,
      isTrial: true,
      subscription: decorate(subscription),
      message: `${plan.trialDays}-day free trial activated!`,
    };
  }

  if (!razorpay) {
    throw Object.assign(
      new Error('Razorpay is not configured. Please contact support.'),
      { status: 503, errorKey: 'Payment service unavailable' }
    );
  }

  const order = await razorpay.orders.create({
    amount,
    currency: 'INR',
    receipt: `sub_${userId}_${Date.now()}`,
    notes: { userId: userId.toString(), planType, planName: plan.name },
  });

  return {
    success: true,
    isTrial: false,
    order: { id: order.id, amount: order.amount, currency: order.currency, receipt: order.receipt },
    orderId: order.id,
    amount: order.amount,
    currency: order.currency,
    keyId: process.env.RAZORPAY_KEY_ID,
    plan: { name: plan.name, price: plan.price, trips: plan.trips, features: plan.features },
  };
}

// ─── Verify Payment ───────────────────────────────────────────────────────────

export async function verifyPayment(
  userId: string,
  razorpay_order_id: string,
  razorpay_payment_id: string,
  razorpay_signature: string,
  planType: string,
  req: any
) {
  const user = await User.findById(userId);
  if (!user) throw Object.assign(new Error('User not found'), { status: 404 });

  if (user.role !== 'organizer' && user.role !== 'admin') {
    user.role = 'organizer';
    await user.save();
  }

  const secret = process.env.RAZORPAY_KEY_SECRET || '';
  const generatedSignature = crypto
    .createHmac('sha256', secret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');

  if (generatedSignature !== razorpay_signature) {
    throw Object.assign(new Error('Invalid payment signature'), { status: 400 });
  }

  if (!razorpay) {
    throw Object.assign(
      new Error('Razorpay is not configured. Please contact support.'),
      { status: 503, errorKey: 'Payment service unavailable' }
    );
  }

  const payment = await razorpay.payments.fetch(razorpay_payment_id);
  if (payment.status !== 'captured') {
    throw Object.assign(new Error('Payment not captured'), { status: 400 });
  }

  const plan = SUBSCRIPTION_PLANS[planType as keyof typeof SUBSCRIPTION_PLANS];
  const startDate = new Date();
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + plan.duration);

  const crmAccessPlans = ['PROFESSIONAL', 'PREMIUM', 'ENTERPRISE'];
  const planMapping: Record<string, string> = {
    STARTER: 'starter',
    BASIC: 'basic',
    PROFESSIONAL: 'professional',
    PREMIUM: 'premium',
    ENTERPRISE: 'enterprise',
  };

  // This is the path a paying organizer takes, and it was the worst place for
  // the create/unique collision: an organizer who had ever had a subscription -
  // a lapsed trial is enough - paid Razorpay, and then this insert failed with
  // a duplicate key error. The money was taken and no subscription appeared.
  //
  // upsert makes renewal the ordinary case it always was. The payment itself is
  // a row, keyed on the Razorpay payment id, so a retried verification records
  // one payment rather than two.
  const planFields = {
    plan: (planMapping[planType] || 'basic') as any,
    status: 'active' as const,
    isTrialActive: false,
    crmAccess: crmAccessPlans.includes(planType),
    subscriptionStartDate: startDate,
    subscriptionEndDate: expiryDate,
    currentPeriodStart: startDate,
    currentPeriodEnd: expiryDate,
    tripsPerCycle: plan.trips,
    tripsUsed: 0,
    pricePerCycle: plan.price,
    lastPaymentDate: new Date(),
  };

  const subscription = await upsertRacingSafely(() => prisma.organizerSubscription.upsert({
    where: { organizerId: userId },
    create: { organizerId: userId, ...planFields },
    update: planFields,
  }));

  try {
    await prisma.subscriptionPayment.create({
      data: {
        subscriptionId: subscription.id,
        amount: plan.price,
        currency: 'INR',
        paymentMethod: 'razorpay',
        transactionId: razorpay_payment_id,
        paymentDate: new Date(),
        status: 'completed',
      }
    });
  } catch (error: any) {
    // transactionId is unique. A second verification of the same Razorpay
    // payment is the client retrying, not a second payment.
    if (error?.code !== 'P2002') throw error;
  }

  await auditLogService.logPayment(userId, razorpay_payment_id, 'VERIFY', plan.price, req);

  return {
    success: true,
    subscription: decorate(subscription),
    message: `${plan.name} activated successfully!`,
  };
}

// ─── Cancel ───────────────────────────────────────────────────────────────────

export async function cancelSubscription(userId: string, req: any) {
  const subscription = await prisma.organizerSubscription.findFirst({
    where: { organizerId: userId, status: { in: ['active', 'trial'] } },
  });

  if (!subscription) {
    throw Object.assign(new Error('No active subscription found'), { status: 404 });
  }

  await prisma.organizerSubscription.update({
    where: { id: subscription.id },
    data: { status: 'cancelled' },
  });

  await auditLogService.log({
    userId,
    action: 'UPDATE',
    resource: 'Subscription',
    resourceId: subscription.id,
    metadata: { action: 'cancelled' },
    req,
  });

  return { success: true, message: 'Subscription cancelled successfully' };
}

// ─── Payment History ──────────────────────────────────────────────────────────

export async function getPaymentHistory(userId: string) {
  // This returned one entry per subscription, and organizerId is unique - so
  // "payment history" was a list of at most one item, whose amount was the
  // totalPaid running sum rather than any individual payment. Payments are rows
  // now, so the history is the payments, which is what the page asks for and
  // what its heading claims to show.
  const subscription = await prisma.organizerSubscription.findUnique({
    where: { organizerId: userId },
  });

  if (!subscription) {
    return { payments: [], total: 0 };
  }

  const payments = await prisma.subscriptionPayment.findMany({
    where: { subscriptionId: subscription.id },
    orderBy: { paymentDate: 'desc' },
    take: 20,
  });

  return {
    payments: payments.map((payment) => ({
      id: payment.id,
      plan: subscription.plan,
      amount: toNumber(payment.amount),
      status: payment.status,
      startDate: subscription.subscriptionStartDate || subscription.trialStartDate,
      expiryDate: subscription.subscriptionEndDate || subscription.trialEndDate,
      isTrial: subscription.isTrialActive,
      createdAt: payment.paymentDate,
      transactionId: payment.transactionId,
      receiptUrl: payment.receiptUrl,
    })),
    total: payments.length,
  };
}

// ─── Increment Trip ───────────────────────────────────────────────────────────

export async function incrementTrip(userId: string) {
  const subscription = await prisma.organizerSubscription.findFirst({
    where: { organizerId: userId, status: { in: ['active', 'trial'] } },
  });

  if (!subscription) {
    throw Object.assign(
      new Error('Please subscribe to post trips'),
      { status: 403, errorKey: 'No active subscription' }
    );
  }

  // The check and the increment are one statement, so two trips posted at the
  // same instant cannot both find the last slot free. The read-then-save
  // version could, and did not even hold the two together in a transaction.
  const updated = await prisma.$queryRaw<Array<{ trips_used: number; trips_per_cycle: number }>>`
    UPDATE organizer_subscriptions
       SET trips_used = trips_used + 1, updated_at = now()
     WHERE id = ${subscription.id}
       AND trips_used < trips_per_cycle
    RETURNING trips_used, trips_per_cycle
  `;

  if (updated.length === 0) {
    throw Object.assign(
      new Error('Upgrade your plan to post more trips'),
      { status: 403, errorKey: 'Trip limit reached' }
    );
  }

  return {
    success: true,
    tripsRemaining: Math.max(0, updated[0].trips_per_cycle - updated[0].trips_used)
  };
}

// ─── Check Eligibility ────────────────────────────────────────────────────────

export async function checkEligibility(userId: string) {
  const subscription = await prisma.organizerSubscription.findFirst({
    where: { organizerId: userId, status: { in: ['active', 'trial'] } },
  });

  if (!subscription) {
    return {
      eligible: false,
      reason: 'no_subscription',
      message: 'Please subscribe to post trips',
      canPost: false,
      remaining: 0,
    };
  }

  if (subscription.tripsUsed >= subscription.tripsPerCycle) {
    return {
      eligible: false,
      reason: 'limit_reached',
      message: 'Trip limit reached. Upgrade your plan to post more trips.',
      tripsUsed: subscription.tripsUsed,
      tripsAllowed: subscription.tripsPerCycle,
      canPost: false,
      remaining: 0,
    };
  }

  // tripsRemaining was a column that a pre-save hook kept in step with the other
  // two, which is why this line had a `??` fallback recomputing it - the author
  // did not trust the column either.
  const remaining = slotsLeft(subscription);
  return {
    eligible: true,
    tripsRemaining: remaining,
    planName: subscription.plan,
    canPost: true,
    remaining,
  };
}

// ─── Webhook ──────────────────────────────────────────────────────────────────

export async function processWebhook(
  razorpaySignature: string,
  body: string,
  event: string,
  eventData: any
) {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || '';

  if (webhookSecret) {
    const generatedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(body)
      .digest('hex');

    if (generatedSignature !== razorpaySignature) {
      throw Object.assign(new Error('Unauthorized webhook'), { status: 401 });
    }
  } else {
    console.warn('⚠️ RAZORPAY_WEBHOOK_SECRET not configured. Webhook verification skipped.');
  }

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
}

async function handlePaymentCaptured(eventData: any) {
  try {
    const payment = eventData.payment;
    const paymentId = payment?.id;
    const orderId = payment?.order_id;
    if (paymentId && orderId) {
      await auditLogService.log({
        userId: 'system',
        action: 'payment_captured',
        resource: 'Payment',
        resourceId: paymentId,
        metadata: { orderId, amount: payment?.amount, currency: payment?.currency },
      });
    }
  } catch (error: any) {
    console.error('❌ Error handling payment captured:', error);
  }
}

async function handlePaymentFailed(eventData: any) {
  try {
    const payment = eventData.payment;
    const paymentId = payment?.id;
    const orderId = payment?.order_id;
    const errorReason = payment?.vpa || payment?.description || 'Unknown error';
    await auditLogService.log({
      userId: 'system',
      action: 'payment_failed',
      resource: 'Payment',
      resourceId: paymentId,
      metadata: { orderId, reason: errorReason, amount: payment?.amount },
    });
  } catch (error: any) {
    console.error('❌ Error handling payment failed:', error);
  }
}

async function handleSubscriptionActivated(eventData: any) {
  try {
    const subscriptionId = eventData.subscription?.id;
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

async function handleSubscriptionCharged(eventData: any) {
  try {
    const subscriptionId = eventData.subscription?.id;
    const paymentId = eventData.payment?.id;
    await auditLogService.log({
      userId: 'system',
      action: 'subscription_charged',
      resource: 'Subscription',
      resourceId: subscriptionId,
      metadata: { paymentId, amount: eventData.payment?.amount },
    });
  } catch (error: any) {
    console.error('❌ Error handling subscription charged:', error);
  }
}

async function handleSubscriptionCancelled(eventData: any) {
  try {
    const subscriptionId = eventData.subscription?.id;
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

async function handleSubscriptionPaused(eventData: any) {
  try {
    const subscriptionId = eventData.subscription?.id;
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

async function handleOrderPaid(eventData: any) {
  try {
    const orderId = eventData.order?.id;
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

// ─── Verify CRM Access ────────────────────────────────────────────────────────

export async function verifyCrmAccess(userId: string) {
  const user = await User.findById(userId).lean();
  if (user && user.organizerProfile) {
    const profile = user.organizerProfile as any;
    if (profile.crmEnabled || profile.crmAccess) {
      return {
        hasCRMAccess: true,
        hasLeadCapture: true,
        canViewPhoneNumbers: true,
        planType: 'PREMIUM',
        planName: 'Premium Plan',
        message: 'CRM access granted via organizer profile',
        accessGranted: true,
        accessReason: 'Organizer profile has CRM access enabled',
        features: {
          crm: { enabled: true, description: 'Full CRM access for managing leads and participants' },
          leadCapture: { enabled: true, description: 'Automatically capture and organize leads from your trips' },
          phoneNumbers: { enabled: true, description: 'View phone numbers of leads and participants' },
          leadVerification: { enabled: true, description: 'Verify leads before adding to your trips' },
        },
      };
    }
  }

  // The payments are loaded because the checks below read the most recent one.
  const subscription = await prisma.organizerSubscription.findUnique({
    where: { organizerId: userId },
    include: { payments: { orderBy: { paymentDate: 'asc' } } },
  });

  if (!subscription) {
    return {
      hasCRMAccess: false,
      hasLeadCapture: false,
      canViewPhoneNumbers: false,
      planType: 'NONE',
      message: 'No active subscription',
      accessDeniedReason: 'No subscription found',
    };
  }

  if (!['active', 'trial'].includes(subscription.status)) {
    return {
      hasCRMAccess: false,
      hasLeadCapture: false,
      canViewPhoneNumbers: false,
      planType: subscription.plan,
      subscriptionStatus: subscription.status,
      message: 'Subscription is not active',
      accessDeniedReason: `Subscription status is ${subscription.status}. Please renew your subscription.`,
    };
  }

  const now = new Date();
  const endDate = subscription.subscriptionEndDate || subscription.currentPeriodEnd;
  if (endDate && endDate < now && subscription.status !== 'trial') {
    return {
      hasCRMAccess: false,
      hasLeadCapture: false,
      canViewPhoneNumbers: false,
      planType: subscription.plan,
      subscriptionStatus: 'expired',
      subscriptionEndDate: endDate,
      message: 'Subscription has expired',
      accessDeniedReason: `Your subscription expired on ${endDate.toLocaleDateString()}. Please renew.`,
    };
  }

  if (subscription.status === 'active' && subscription.payments) {
    const lastPayment = subscription.payments[subscription.payments.length - 1];
    if (lastPayment && lastPayment.status !== 'completed') {
      return {
        hasCRMAccess: false,
        hasLeadCapture: false,
        canViewPhoneNumbers: false,
        planType: subscription.plan,
        subscriptionStatus: subscription.status,
        message: 'Payment not completed',
        accessDeniedReason: `Your payment status is ${lastPayment.status}. Please complete payment to activate CRM access.`,
      };
    }
  }

  const planKey = subscription.plan.toUpperCase();
  let normalizedPlanKey: keyof typeof SUBSCRIPTION_PLANS;
  if (planKey === 'PRO' || planKey === 'PROFESSIONAL') normalizedPlanKey = 'PROFESSIONAL';
  else if (planKey === 'PREMIUM') normalizedPlanKey = 'PREMIUM';
  else if (planKey === 'STARTER') normalizedPlanKey = 'STARTER';
  else if (planKey === 'BASIC') normalizedPlanKey = 'BASIC';
  else if (planKey === 'ENTERPRISE') normalizedPlanKey = 'ENTERPRISE';
  else normalizedPlanKey = 'STARTER';

  const plan = SUBSCRIPTION_PLANS[normalizedPlanKey];

  // Both amounts are Decimal columns and every comparison and division below is
  // numeric, so they convert once here. A Decimal coerces well enough for the
  // `> 10000` test, but `subscriptionPrice / 100` on a Decimal returns another
  // Decimal - so the `>= 2299` test further down would be comparing a value that
  // no longer holds what its name says, and CRM access would be granted or
  // refused on the wrong number.
  let subscriptionPrice = plan?.price || 0;
  if (!plan && subscription.payments.length > 0) {
    const lastPayment = subscription.payments[subscription.payments.length - 1];
    subscriptionPrice = toNumber(lastPayment.amount);
    if (subscriptionPrice > 10000) subscriptionPrice = subscriptionPrice / 100;
  } else if (subscription.pricePerCycle) {
    subscriptionPrice = toNumber(subscription.pricePerCycle);
    if (subscriptionPrice > 10000) subscriptionPrice = subscriptionPrice / 100;
  }

  const hasAccessByPrice = subscriptionPrice >= 2299;
  const isPremiumOrProfessional = normalizedPlanKey === 'PREMIUM' || normalizedPlanKey === 'PROFESSIONAL';
  const hasCRMAccessByPlan = plan?.crmAccess === true;
  const hasManualOverride = (subscription as any).crmAccess === true;
  const finalCRMAccess = hasCRMAccessByPlan || hasAccessByPrice || isPremiumOrProfessional || hasManualOverride;
  const hasLeadCapture = (plan?.leadCapture === true) || hasAccessByPrice || isPremiumOrProfessional;
  const canViewPhoneNumbers = (plan?.phoneNumbers === true) || hasAccessByPrice || isPremiumOrProfessional;

  if (!plan && !hasAccessByPrice) {
    return {
      hasCRMAccess: false,
      hasLeadCapture: false,
      canViewPhoneNumbers: false,
      planType: subscription.plan,
      planPrice: subscriptionPrice,
      message: 'Invalid plan type or insufficient subscription level',
      accessDeniedReason: `Plan "${subscription.plan}" is not recognized and subscription price (₹${subscriptionPrice}) is below ₹2299. CRM access requires subscription of ₹2299 or above.`,
    };
  }

  return {
    hasCRMAccess: finalCRMAccess,
    hasLeadCapture,
    canViewPhoneNumbers,
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
      crm: { enabled: finalCRMAccess, description: 'Full CRM access for managing leads and participants' },
      leadCapture: { enabled: hasLeadCapture, description: 'Automatically capture and organize leads from your trips' },
      phoneNumbers: { enabled: canViewPhoneNumbers, description: 'View phone numbers of leads and participants' },
      leadVerification: { enabled: hasLeadCapture, description: 'Verify leads before adding to your trips' },
    },
  };
}

// ─── Check Feature Access ─────────────────────────────────────────────────────

export async function checkFeatureAccess(userId: string, features: string[]) {
  const subscription = await prisma.organizerSubscription.findUnique({
    where: { organizerId: userId },
  });

  if (!subscription) {
    return {
      accessMap: features.reduce((acc, feature) => { acc[feature] = false; return acc; }, {} as Record<string, boolean>),
      planType: 'NONE',
    };
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

  return { accessMap, planType: subscription.plan, planName: plan.name };
}

// ─── Verify Organizer Info ────────────────────────────────────────────────────

export async function verifyOrganizerInfo(userId: string) {
  const user = await User.findById(userId).lean();

  if (!user) {
    return {
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
    };
  }

  const verification = {
    namePresent: !!user.name && user.name.trim().length > 0,
    emailVerified: !!user.email && user.emailVerified === true,
    phonePresent: !!user.phone && user.phone.trim().length > 0,
    profilePhotoPresent: !!user.profilePhoto && user.profilePhoto.trim().length > 0,
    organizerProfileComplete: !!(user.organizerProfile && Object.keys(user.organizerProfile).length > 0),
    bioPresent: !!user.bio && user.bio.trim().length > 0,
    bankDetailsPresent: !!(
      user.organizerProfile?.bankDetails &&
      Object.keys(user.organizerProfile.bankDetails).length > 0
    ),
  };

  const requiredFields = ['namePresent', 'emailVerified', 'phonePresent', 'profilePhotoPresent', 'organizerProfileComplete'];
  const completedFields = requiredFields.filter(field => verification[field as keyof typeof verification]).length;
  const completionPercentage = Math.round((completedFields / requiredFields.length) * 100);
  const profileComplete = completionPercentage >= 80;

  const recommendations: string[] = [];
  if (!verification.namePresent) recommendations.push('Add your full name to your profile');
  if (!verification.emailVerified) recommendations.push('Verify your email address');
  if (!verification.phonePresent) recommendations.push('Add a verified phone number');
  if (!verification.profilePhotoPresent) recommendations.push('Upload a profile photo to build trust with customers');
  if (!verification.organizerProfileComplete) recommendations.push('Complete your organizer profile information');
  if (!verification.bioPresent) recommendations.push('Add a bio to describe your experience and expertise');
  if (!verification.bankDetailsPresent) recommendations.push('Add bank details for receiving payments');

  return {
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
    recommendations,
  };
}

// ─── Admin Update Subscription ────────────────────────────────────────────────

export async function adminUpdateSubscription(organizerId: string, updates: any, adminUserId: string, req: any) {
  const startDate = new Date();
  const defaultExpiry = new Date();
  defaultExpiry.setDate(defaultExpiry.getDate() + 30);

  let subscription = await upsertRacingSafely(() => prisma.organizerSubscription.upsert({
    where: { organizerId },
    create: {
      organizerId,
      plan: (updates.plan || 'basic') as any,
      status: (updates.status || 'active') as any,
      isTrialActive: false,
      crmAccess: updates.crmAccess || false,
      subscriptionStartDate: startDate,
      subscriptionEndDate: defaultExpiry,
      currentPeriodStart: startDate,
      currentPeriodEnd: defaultExpiry,
      tripsPerCycle: 5,
      tripsUsed: 0,
      pricePerCycle: 0,
      lastPaymentDate: new Date(),
    },
    update: {},
  }));

  const data: any = {};
  if (updates.plan) data.plan = updates.plan;
  if (updates.status) data.status = updates.status;
  if (updates.crmAccess !== undefined) data.crmAccess = updates.crmAccess;
  if (updates.tripsRemaining !== undefined) {
    // tripsRemaining is not a column any more, so setting it means setting the
    // cycle allowance to what has been used plus what the admin wants left.
    // The Mongoose version wrote both numbers and could leave them disagreeing.
    data.tripsPerCycle = Number(updates.tripsRemaining) + subscription.tripsUsed;
  }
  if (updates.validUntil) {
    data.subscriptionEndDate = new Date(updates.validUntil);
    data.currentPeriodEnd = new Date(updates.validUntil);
  }

  try {
    subscription = await prisma.organizerSubscription.update({
      where: { id: subscription.id },
      data,
    });
  } catch (error: any) {
    // plan and status come from an admin request body and are both enums.
    if (/invalid input value for enum/i.test(error?.message || '')) {
      throw Object.assign(new Error('Unknown plan or status value'), { status: 400 });
    }
    throw error;
  }

  await auditLogService.log({
    userId: adminUserId,
    action: 'UPDATE',
    resource: 'Subscription',
    resourceId: subscription.id,
    metadata: { updates, targetUser: organizerId },
    req,
  });

  return { success: true, message: 'Subscription updated by admin', subscription: decorate(subscription) };
}

// ─── Get Subscription by Organizer ID ────────────────────────────────────────

export async function getSubscriptionByOrganizerId(organizerId: string) {
  const subscription = await prisma.organizerSubscription.findUnique({ where: { organizerId } });
  return subscription ? decorate(subscription) : null;
}
