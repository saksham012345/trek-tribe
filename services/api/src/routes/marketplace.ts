import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { z } from 'zod';
import { authenticateJwt, requireRole } from '../middleware/auth';
import { razorpayRouteService } from '../services/razorpayRouteService';
import { OrganizerPayoutConfig } from '../models/OrganizerPayoutConfig';
import { MarketplaceOrder } from '../models/MarketplaceOrder';
import { MarketplaceTransfer } from '../models/MarketplaceTransfer';
import { MarketplaceRefund } from '../models/MarketplaceRefund';
import { PayoutLedger } from '../models/PayoutLedger';
import { OrganizerSubscription } from '../models/OrganizerSubscription';
import { User } from '../models/User';
import { logger } from '../utils/logger';
import { DEFAULT_AUTOPAY_PLAN } from '../config/subscription.config';

// Optional import with fallback
let razorpaySubmerchantService: any = null;
try {
  razorpaySubmerchantService = require('../services/razorpaySubmerchantService').razorpaySubmerchantService;
} catch (e) {
  logger.warn('Submerchant service not available, using route service fallback');
}

// Import validators
let organizerOnboardingSchema: any = null;
let validatePaymentInput: any = null;
try {
  const validators = require('../validators/paymentValidators');
  organizerOnboardingSchema = validators.organizerOnboardingSchema;
  validatePaymentInput = validators.validatePaymentInput;
} catch (e) {
  logger.warn('Validators not available');
}

const router = Router();

// POST /api/marketplace/organizer/onboard
router.post('/organizer/onboard', authenticateJwt, requireRole(['organizer', 'admin']), async (req: Request, res: Response) => {
  try {
    const organizerId = req.user?.id as string;
    const userEmail = (req as any).user?.email || 'organizer@trektribe.in';
    const userPhone = (req as any).user?.phone || '';

    // Validate input if validators available
    let validatedData = req.body;
    if (organizerOnboardingSchema && validatePaymentInput) {
      const validation = validatePaymentInput(req.body, organizerOnboardingSchema);
      if (!validation.valid) {
        return res.status(400).json({
          error: 'Validation failed',
          details: validation.errors
        });
      }
      validatedData = validation.data;
    }

    // Check subscription requirement
    const activeSub = await OrganizerSubscription.findOne({
      organizerId,
      $or: [
        { status: 'active' },
        { status: 'trial', isTrialActive: true }
      ]
    }).sort({ createdAt: -1 });

    if (!activeSub) {
      return res.status(402).json({
        error: 'Subscription required before onboarding',
        message: 'Please activate a subscription plan first to enable marketplace features.'
      });
    }

    logger.info(`Starting organizer onboarding for ${organizerId}`);

    // Create submerchant account using the service if available, otherwise use route service
    let accountResult: any;

    if (razorpaySubmerchantService && razorpaySubmerchantService.createSubmerchantAccount) {
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
      // Fallback to razorpayRouteService
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

    // Initialize 60-day trial after route creation (not on first login)
    const User = require('../models/User').default;
    const organizer = await User.findById(organizerId);

    if (organizer && organizer.role === 'organizer') {
      // Initialize auto-pay setup for organizer on route creation
      if (!organizer.organizerProfile) {
        organizer.organizerProfile = {};
      }

      // Only initialize if not already set
      if (!organizer.organizerProfile.autoPay || !organizer.organizerProfile.autoPay.isSetupRequired) {
        const scheduledPaymentDate = new Date();
        scheduledPaymentDate.setDate(scheduledPaymentDate.getDate() + 60); // 60 days from route creation

        organizer.organizerProfile.autoPay = {
          isSetupRequired: true,
          isSetupCompleted: false,
          firstLoginDate: organizer.firstOrganizerLogin || new Date(),
          routeCreationDate: new Date(),
          scheduledPaymentDate: scheduledPaymentDate,
          paymentAmount: DEFAULT_AUTOPAY_PLAN.amount, // Default from config
          autoPayEnabled: false
        };

        await organizer.save();

        logger.info('60-day trial started on route creation, auto-pay scheduled', {
          userId: organizerId,
          scheduledDate: scheduledPaymentDate
        });
      }
    }

    // Return account details
    res.json({
      success: true,
      accountId: accountResult.accountId,
      status: accountResult.status || accountResult.onboardingStatus,
      kycStatus: accountResult.kycStatus,
      message: 'Organizer account created successfully. Please complete KYC verification.',
      nextSteps: [
        'Complete KYC verification via email',
        'Verify bank account details',
        'Activate account',
        'Start receiving payments'
      ]
    });

  } catch (error: any) {
    logger.error('Organizer onboarding failed', {
      error: error.message,
      userId: req.user?.id
    });
    res.status(400).json({
      error: 'Onboarding failed',
      message: error.message
    });
  }
});

// GET /api/marketplace/organizer/status/:id?
router.get('/organizer/status/:id?', authenticateJwt, requireRole(['organizer', 'admin']), async (req: Request, res: Response) => {
  try {
    const organizerId = req.params.id || req.user?.id;

    // Use new submerchant service to get account status
    const accountStatus = await razorpaySubmerchantService.getAccountStatus(organizerId);

    if (!accountStatus) {
      return res.json({
        onboarded: false,
        status: 'pending',
        message: 'No account found. Start onboarding to create an account.'
      });
    }

    // Get settlement ledger
    const settlementLedger = await razorpaySubmerchantService.getSettlementLedger(organizerId, 5);

    res.json({
      success: true,
      onboarded: !!accountStatus.accountId,
      accountId: accountStatus.accountId,
      status: accountStatus.status,
      kycStatus: accountStatus.kycStatus,
      routeId: accountStatus.routeId,
      createdAt: accountStatus.createdAt,
      recentSettlements: settlementLedger,
      nextSettlementDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Weekly
    });
  } catch (error: any) {
    logger.error('Failed to get organizer status', {
      error: error.message,
      organizerId: req.params.id || req.user?.id
    });
    res.status(500).json({
      error: 'Failed to retrieve organizer status',
      message: error.message
    });
  }
});

// POST /api/marketplace/orders/create
router.post('/orders/create', authenticateJwt, requireRole(['traveler', 'organizer', 'admin']), async (req: Request, res: Response) => {
  await Promise.all([
    body('amount').isInt({ min: 100, max: 10000000 }).run(req),
    body('currency').optional().isString().isIn(['INR']).run(req),
    body('organizerId').isString().isLength({ min: 12, max: 48 }).run(req),
    body('tripId').optional().isString().isLength({ min: 8, max: 64 }).run(req),
  ]);
  const vErrors = validationResult(req);
  if (!vErrors.isEmpty()) {
    return res.status(400).json({ errors: vErrors.array() });
  }
  const schema = {
    parse: (data: any) => {
      const errs: string[] = [];
      if (typeof data.amount !== 'number' || data.amount < 100) errs.push('amount');
      if (data.currency !== undefined && data.currency !== 'INR') errs.push('currency');
      if (typeof data.organizerId !== 'string' || data.organizerId.length < 12) errs.push('organizerId');
      if (data.tripId !== undefined && (typeof data.tripId !== 'string' || data.tripId.length < 8)) errs.push('tripId');
      if (errs.length) throw new Error(`Invalid fields: ${errs.join(', ')}`);
      return data;
    }
  };

  try {
    const body = schema.parse(req.body);
    const order = await razorpayRouteService.createPlatformOrder({
      amount: body.amount,
      currency: body.currency,
      userId: req.user!.id,
      organizerId: body.organizerId,
      tripId: body.tripId,
      notes: body.notes,
    });

    res.json({ success: true, order });
  } catch (error: any) {
    logger.error('Order creation failed', { error: error.message });
    res.status(400).json({ error: error.message });
  }
});

// POST /api/marketplace/payments/split
router.post('/payments/split', authenticateJwt, requireRole(['admin']), async (req: Request, res: Response) => {
  await Promise.all([
    body('orderId').isString().isLength({ min: 10, max: 64 }).run(req),
    body('paymentId').isString().isLength({ min: 10, max: 64 }).run(req),
  ]);
  const vErrors = validationResult(req);
  if (!vErrors.isEmpty()) {
    return res.status(400).json({ errors: vErrors.array() });
  }
  const schema = {
    parse: (data: any) => {
      const errs: string[] = [];
      if (typeof data.orderId !== 'string' || data.orderId.length < 10) errs.push('orderId');
      if (typeof data.paymentId !== 'string' || data.paymentId.length < 10) errs.push('paymentId');
      if (errs.length) throw new Error(`Invalid fields: ${errs.join(', ')}`);
      return data;
    }
  };

  try {
    const body = schema.parse(req.body);
    const transfer = await razorpayRouteService.createTransfer({
      orderId: body.orderId,
      paymentId: body.paymentId,
    });

    res.json({ success: true, transfer });
  } catch (error: any) {
    logger.error('Split payment failed', { error: error.message });
    res.status(400).json({ error: error.message });
  }
});

// POST /api/marketplace/refunds/initiate
router.post('/refunds/initiate', authenticateJwt, requireRole(['admin']), async (req: Request, res: Response) => {
  await Promise.all([
    body('orderId').isString().isLength({ min: 10, max: 64 }).run(req),
    body('amount').isInt({ min: 1 }).run(req),
    body('reason').optional().isString().isLength({ max: 256 }).run(req),
  ]);
  const vErrors = validationResult(req);
  if (!vErrors.isEmpty()) {
    return res.status(400).json({ errors: vErrors.array() });
  }
  const schema = {
    parse: (data: any) => {
      const errs: string[] = [];
      if (typeof data.orderId !== 'string' || data.orderId.length < 10) errs.push('orderId');
      if (typeof data.amount !== 'number' || data.amount < 1) errs.push('amount');
      if (data.reason !== undefined && (typeof data.reason !== 'string' || data.reason.length > 256)) errs.push('reason');
      if (errs.length) throw new Error(`Invalid fields: ${errs.join(', ')}`);
      return data;
    }
  };

  try {
    const body = schema.parse(req.body);
    const order = await MarketplaceOrder.findOne({ orderId: body.orderId });
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // If payout already processed, reverse it first
    const transfer = await MarketplaceTransfer.findOne({ orderId: order._id, status: 'processed' });
    if (transfer?.transferId) {
      await razorpayRouteService.reverseTransfer(transfer.transferId, body.amount);
    }

    const refund = await razorpayRouteService.initiateRefund({
      orderId: body.orderId,
      amount: body.amount,
      reason: body.reason,
      initiatedBy: req.user?.id,
    });

    res.json({ success: true, refund });
  } catch (error: any) {
    logger.error('Refund initiation failed', { error: error.message });
    res.status(400).json({ error: error.message });
  }
});

// GET /api/marketplace/organizer/settlements
router.get('/organizer/settlements', authenticateJwt, requireRole(['organizer', 'admin']), async (req: Request, res: Response) => {
  try {
    const organizerId = req.user?.id;
    const transfers = await MarketplaceTransfer.find({ organizerId }).sort({ createdAt: -1 }).limit(50);
    const ledger = await PayoutLedger.find({ organizerId }).sort({ createdAt: -1 }).limit(50);

    res.json({ transfers, ledger });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/marketplace/orders/:id
router.get('/orders/:id', authenticateJwt, requireRole(['organizer', 'admin']), async (req: Request, res: Response) => {
  try {
    const order = await MarketplaceOrder.findOne({ orderId: req.params.id });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json(order);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/marketplace/config
// Get Razorpay configuration (public key and status)
router.get('/config', authenticateJwt, requireRole(['organizer', 'admin']), async (req: Request, res: Response) => {
  try {
    const organizerId = req.user?.id as string;

    // Get organizer's payout configuration
    const payoutConfig = await OrganizerPayoutConfig.findOne({ organizerId });

    // Get organizer user to check routingEnabled
    const organizer = await User.findById(organizerId);

    // Check subscription status
    const subscription = await OrganizerSubscription.findOne({
      organizerId,
      $or: [
        { status: 'active' },
        { status: 'trial', isTrialActive: true }
      ]
    }).sort({ createdAt: -1 });

    // Get account status
    let accountStatus = null;
    try {
      if (razorpaySubmerchantService && razorpaySubmerchantService.getAccountStatus) {
        accountStatus = await razorpaySubmerchantService.getAccountStatus(organizerId);
      }
    } catch (error: any) {
      logger.warn('Could not fetch account status', { error: error.message });
    }

    const config = {
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
      }
    };

    res.json({ success: true, config });
  } catch (error: any) {
    logger.error('Failed to get marketplace config', {
      error: error.message,
      organizerId: req.user?.id
    });
    res.status(500).json({
      error: 'Failed to retrieve configuration',
      message: error.message
    });
  }
});

export default router;
