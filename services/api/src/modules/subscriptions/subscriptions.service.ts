/**
 * Subscriptions Service
 *
 * All business logic extracted from routes/subscriptions.ts.
 * No req/res objects — pure data in, data out.
 */

import Razorpay from 'razorpay';
import crypto from 'crypto';
import { OrganizerSubscription } from '../../models/OrganizerSubscription';
import { User } from '../../models/User';
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
  const subscription = await OrganizerSubscription.findOne({ organizerId: userId })
    .sort({ createdAt: -1 })
    .lean();

  if (!subscription) {
    const user = await User.findById(userId);
    const hasHadTrial = await OrganizerSubscription.exists({
      organizerId: userId,
      isTrialActive: false,
    });
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
        subscriptionId: subscription._id,
        paymentStatus: lastPayment.status,
      };
    }
  }

  const tripsUsed = subscription.tripsUsed || 0;
  const tripsRemaining = Math.max(0, (subscription.tripsPerCycle || 5) - tripsUsed);
  const expiryDate = subscription.subscriptionEndDate || subscription.trialEndDate;
  const isExpired = expiryDate < new Date();
  const daysUntilExpiry = Math.ceil((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  return {
    hasSubscription: !isExpired && ['active', 'trial'].includes(subscription.status),
    subscription: {
      ...subscription,
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

  const existingSubscription = await OrganizerSubscription.findOne({
    organizerId: userId,
    status: { $in: ['active', 'trial'] },
  });
  if (existingSubscription) {
    throw Object.assign(new Error('You already have an active subscription'), { status: 400 });
  }

  const hasUsedTrial = await OrganizerSubscription.exists({
    organizerId: userId,
    isTrialActive: false,
  });

  const isTrial = !skipTrial && !hasUsedTrial;
  const amount = isTrial ? 0 : plan.price * 100;

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

    await auditLogService.log({
      userId,
      action: 'CREATE',
      resource: 'Subscription',
      resourceId: subscription._id.toString(),
      metadata: { planType, isTrial: true },
      req,
    });

    return {
      success: true,
      isTrial: true,
      subscription,
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

  await auditLogService.logPayment(userId, razorpay_payment_id, 'VERIFY', plan.price, req);

  return {
    success: true,
    subscription,
    message: `${plan.name} activated successfully!`,
  };
}

// ─── Cancel ───────────────────────────────────────────────────────────────────

export async function cancelSubscription(userId: string, req: any) {
  const subscription = await OrganizerSubscription.findOne({
    organizerId: userId,
    status: { $in: ['active', 'trial'] },
  });

  if (!subscription) {
    throw Object.assign(new Error('No active subscription found'), { status: 404 });
  }

  subscription.status = 'cancelled';
  await subscription.save();

  await auditLogService.log({
    userId,
    action: 'UPDATE',
    resource: 'Subscription',
    resourceId: subscription._id.toString(),
    metadata: { action: 'cancelled' },
    req,
  });

  return { success: true, message: 'Subscription cancelled successfully' };
}

// ─── Payment History ──────────────────────────────────────────────────────────

export async function getPaymentHistory(userId: string) {
  const subscriptions = await OrganizerSubscription.find({ organizerId: userId })
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();

  return {
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
  };
}

// ─── Increment Trip ───────────────────────────────────────────────────────────

export async function incrementTrip(userId: string) {
  const subscription = await OrganizerSubscription.findOne({
    organizerId: userId,
    status: { $in: ['active', 'trial'] },
  });

  if (!subscription) {
    throw Object.assign(
      new Error('Please subscribe to post trips'),
      { status: 403, errorKey: 'No active subscription' }
    );
  }

  if (subscription.tripsUsed >= subscription.tripsPerCycle) {
    throw Object.assign(
      new Error('Upgrade your plan to post more trips'),
      { status: 403, errorKey: 'Trip limit reached' }
    );
  }

  subscription.tripsUsed += 1;
  subscription.tripsRemaining = subscription.tripsPerCycle - subscription.tripsUsed;
  await subscription.save();

  return { success: true, tripsRemaining: subscription.tripsRemaining };
}

// ─── Check Eligibility ────────────────────────────────────────────────────────

export async function checkEligibility(userId: string) {
  const subscription = await OrganizerSubscription.findOne({
    organizerId: userId,
    status: { $in: ['active', 'trial'] },
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

  return {
    eligible: true,
    tripsRemaining: subscription.tripsRemaining,
    planName: subscription.plan,
    canPost: true,
    remaining: subscription.tripsRemaining ?? (subscription.tripsPerCycle - subscription.tripsUsed),
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

  const subscription = await OrganizerSubscription.findOne({ organizerId: userId })
    .sort({ createdAt: -1 })
    .lean();

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

  let subscriptionPrice = plan?.price || 0;
  if (!plan && subscription.payments && subscription.payments.length > 0) {
    const lastPayment = subscription.payments[subscription.payments.length - 1];
    subscriptionPrice = lastPayment.amount || 0;
    if (subscriptionPrice > 10000) subscriptionPrice = subscriptionPrice / 100;
  } else if (subscription.pricePerCycle) {
    subscriptionPrice = subscription.pricePerCycle;
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
  const subscription = await OrganizerSubscription.findOne({ organizerId: userId })
    .sort({ createdAt: -1 })
    .lean();

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
  let subscription = await OrganizerSubscription.findOne({ organizerId });

  if (!subscription) {
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

  if (updates.plan) subscription.plan = updates.plan;
  if (updates.status) subscription.status = updates.status;
  if (updates.crmAccess !== undefined) subscription.crmAccess = updates.crmAccess;
  if (updates.tripsRemaining !== undefined) {
    subscription.tripsPerCycle = Number(updates.tripsRemaining) + subscription.tripsUsed;
    subscription.tripsRemaining = Number(updates.tripsRemaining);
  }
  if (updates.validUntil) {
    subscription.subscriptionEndDate = new Date(updates.validUntil);
    subscription.currentPeriodEnd = new Date(updates.validUntil);
  }

  await subscription.save();

  await auditLogService.log({
    userId: adminUserId,
    action: 'UPDATE',
    resource: 'Subscription',
    resourceId: subscription._id.toString(),
    metadata: { updates, targetUser: organizerId },
    req,
  });

  return { success: true, message: 'Subscription updated by admin', subscription };
}

// ─── Get Subscription by Organizer ID ────────────────────────────────────────

export async function getSubscriptionByOrganizerId(organizerId: string) {
  const subscription = await OrganizerSubscription.findOne({ organizerId });
  return subscription;
}
