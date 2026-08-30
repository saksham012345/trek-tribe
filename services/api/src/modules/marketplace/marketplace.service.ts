/**
 * Marketplace Service
 *
 * All business logic extracted from routes/marketplace.ts.
 * No req/res objects — pure data in, data out.
 */

import { UserPrisma as User } from '../../models/userPrismaAdapter';
import { prisma } from '../../lib/prisma';
import { withMongoIds } from '../../lib/apiShape';
import { razorpayRouteService } from '../../services/razorpayRouteService';
import { logger } from '../../utils/logger';
import { DEFAULT_AUTOPAY_PLAN } from '../../config/subscription.config';

// Optional services with fallback
let razorpaySubmerchantService: any = null;
try {
  razorpaySubmerchantService = require('../../services/razorpaySubmerchantService').razorpaySubmerchantService;
} catch (e) {
  logger.warn('Submerchant service not available, using route service fallback');
}

let organizerOnboardingSchema: any = null;
let validatePaymentInput: any = null;
try {
  const validators = require('../../validators/paymentValidators');
  organizerOnboardingSchema = validators.organizerOnboardingSchema;
  validatePaymentInput = validators.validatePaymentInput;
} catch (e) {
  logger.warn('Validators not available');
}

// ─── Onboard organizer ────────────────────────────────────────────────────────

export async function onboardOrganizer(organizerId: string, userEmail: string, userPhone: string, body: any) {
  let validatedData = body;
  if (organizerOnboardingSchema && validatePaymentInput) {
    const validation = validatePaymentInput(body, organizerOnboardingSchema);
    if (!validation.valid) {
      throw Object.assign(new Error('Validation failed'), { status: 400, details: validation.errors });
    }
    validatedData = validation.data;
  }

  const activeSub = await prisma.organizerSubscription.findFirst({
    where: {
      organizerId,
      OR: [{ status: 'active' }, { status: 'trial', isTrialActive: true }],
    },
  });

  if (!activeSub) {
    throw Object.assign(
      new Error('Please activate a subscription plan first to enable marketplace features.'),
      { status: 402, code: 'SUBSCRIPTION_REQUIRED' }
    );
  }

  logger.info(`Starting organizer onboarding for ${organizerId}`);

  let accountResult: any;
  if (razorpaySubmerchantService?.createSubmerchantAccount) {
    accountResult = await razorpaySubmerchantService.createSubmerchantAccount({
      organizerId,
      email: userEmail,
      phone: userPhone || '+919876177839',
      legalBusinessName: validatedData.legalBusinessName,
      businessType: validatedData.businessType,
      pan: validatedData.personalDetails?.panNumber || 'PENDING',
      bankAccount: validatedData.bankAccount,
      addressDetails: validatedData.addressDetails,
      businessRegistrationNumber: validatedData.businessRegistration?.number,
      settlementCycle: validatedData.settlementCycle,
    });
  } else {
    accountResult = await razorpayRouteService.onboardOrganizer({
      organizerId,
      email: userEmail,
      phone: userPhone,
      legalBusinessName: validatedData.legalBusinessName,
      businessType: validatedData.businessType,
      bankAccount: validatedData.bankAccount,
      commissionRate: validatedData.commissionRate,
    });
  }

  logger.info(`Submerchant account created: ${accountResult.accountId}`);

  const organizer = await User.findById(organizerId);
  if (organizer?.role === 'organizer') {
    if (!organizer.organizerProfile) organizer.organizerProfile = {};
    if (!organizer.organizerProfile.autoPay?.isSetupRequired) {
      const scheduledPaymentDate = new Date();
      scheduledPaymentDate.setDate(scheduledPaymentDate.getDate() + 60);
      organizer.organizerProfile.autoPay = {
        isSetupRequired: true,
        isSetupCompleted: false,
        firstLoginDate: organizer.firstOrganizerLogin || new Date(),
        routeCreationDate: new Date(),
        scheduledPaymentDate,
        paymentAmount: DEFAULT_AUTOPAY_PLAN.amount,
        autoPayEnabled: false,
      } as any;
      await organizer.save();
      logger.info('60-day trial started on route creation', { userId: organizerId, scheduledDate: scheduledPaymentDate });
    }
  }

  return {
    success: true,
    accountId: accountResult.accountId,
    status: accountResult.status || accountResult.onboardingStatus,
    kycStatus: accountResult.kycStatus,
    message: 'Organizer account created successfully. Please complete KYC verification.',
    nextSteps: ['Complete KYC verification via email', 'Verify bank account details', 'Activate account', 'Start receiving payments'],
  };
}

// ─── Organizer status ─────────────────────────────────────────────────────────

export async function getOrganizerStatus(organizerId: string) {
  const accountStatus = await razorpaySubmerchantService.getAccountStatus(organizerId);

  if (!accountStatus) {
    return { onboarded: false, status: 'pending', message: 'No account found. Start onboarding to create an account.' };
  }

  const settlementLedger = await razorpaySubmerchantService.getSettlementLedger(organizerId, 5);

  return {
    success: true,
    onboarded: !!accountStatus.accountId,
    accountId: accountStatus.accountId,
    status: accountStatus.status,
    kycStatus: accountStatus.kycStatus,
    routeId: accountStatus.routeId,
    createdAt: accountStatus.createdAt,
    recentSettlements: settlementLedger,
    nextSettlementDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  };
}

// ─── Create order ─────────────────────────────────────────────────────────────

export async function createOrder(userId: string, amount: number, currency: string, organizerId: string, tripId?: string, notes?: any) {
  return razorpayRouteService.createPlatformOrder({ amount, currency, userId, organizerId, tripId, notes });
}

// ─── Split payment ────────────────────────────────────────────────────────────

export async function splitPayment(orderId: string, paymentId: string) {
  return razorpayRouteService.createTransfer({ orderId, paymentId });
}

// ─── Initiate refund ──────────────────────────────────────────────────────────

export async function initiateRefund(orderId: string, amount: number, reason?: string, initiatedBy?: string) {
  const order = await prisma.marketplaceOrder.findUnique({ where: { orderId } });
  if (!order) throw Object.assign(new Error('Order not found'), { status: 404 });

  const transfer = await prisma.marketplaceTransfer.findFirst({
    where: { orderId: order.id, status: 'processed' }
  });
  if (transfer?.transferId) {
    await razorpayRouteService.reverseTransfer(transfer.transferId, amount);
  }

  return razorpayRouteService.initiateRefund({ orderId, amount, reason, initiatedBy });
}

// ─── Settlements ──────────────────────────────────────────────────────────────

export async function getSettlements(organizerId: string) {
  const [transfers, ledger] = await Promise.all([
    prisma.marketplaceTransfer.findMany({
      where: { organizerId },
      orderBy: { createdAt: 'desc' },
      take: 50
    }),
    prisma.payoutLedger.findMany({
      where: { organizerId },
      orderBy: { createdAt: 'desc' },
      take: 50
    })
  ]);

  // Until now every completed payout appeared here twice - once credited by
  // createTransfer and once by the transfer.processed webhook. The unique
  // constraint on (source, referenceId, type) means each is a single row, so
  // this list finally shows what actually moved.
  return { transfers: withMongoIds(transfers), ledger: withMongoIds(ledger) };
}

// ─── Order by ID ──────────────────────────────────────────────────────────────

export async function getOrderById(orderId: string) {
  const order = await prisma.marketplaceOrder.findUnique({ where: { orderId } });
  if (!order) throw Object.assign(new Error('Order not found'), { status: 404 });
  return { ...order, _id: order.id };
}

// ─── Config ───────────────────────────────────────────────────────────────────

export async function getMarketplaceConfig(organizerId: string) {
  const [payoutConfig, organizer, subscription] = await Promise.all([
    prisma.organizerPayoutConfig.findUnique({ where: { organizerId } }),
    User.findById(organizerId),
    // organizerId is unique on this table, so the $or is a test on the single
    // row rather than a choice between rows, and the sort had nothing to sort.
    prisma.organizerSubscription.findFirst({
      where: {
        organizerId,
        OR: [{ status: 'active' }, { status: 'trial', isTrialActive: true }],
      },
    }),
  ]);

  let accountStatus = null;
  try {
    if (razorpaySubmerchantService?.getAccountStatus) {
      accountStatus = await razorpaySubmerchantService.getAccountStatus(organizerId);
    }
  } catch (error: any) {
    logger.warn('Could not fetch account status', { error: error.message });
  }

  return {
    success: true,
    config: {
      razorpay: {
        keyId: process.env.RAZORPAY_KEY_ID || '',
        mode: process.env.RAZORPAY_MODE || 'test',
      },
      organizer: {
        hasActiveSubscription: !!subscription,
        subscriptionStatus: subscription?.status || 'none',
        isOnboarded: !!accountStatus?.accountId,
        accountStatus: accountStatus?.status || 'pending',
        routingEnabled: organizer?.organizerProfile?.routingEnabled || false,
      },
    },
  };
}
