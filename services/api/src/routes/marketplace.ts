import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticateJwt, requireRole } from '../middleware/auth';
import { razorpayRouteService } from '../services/razorpayRouteService';
import { OrganizerPayoutConfig } from '../models/OrganizerPayoutConfig';
import { MarketplaceOrder } from '../models/MarketplaceOrder';
import { MarketplaceTransfer } from '../models/MarketplaceTransfer';
import { MarketplaceRefund } from '../models/MarketplaceRefund';
import { PayoutLedger } from '../models/PayoutLedger';
import { OrganizerSubscription } from '../models/OrganizerSubscription';
import { logger } from '../utils/logger';

const router = Router();

// POST /api/marketplace/organizer/onboard
router.post('/organizer/onboard', authenticateJwt, requireRole(['organizer', 'admin']), async (req: Request, res: Response) => {
  const schema = z.object({
    legalBusinessName: z.string().min(2),
    businessType: z.enum(['proprietorship', 'partnership', 'llp', 'pvt_ltd']),
    bankAccount: z.object({
      accountNumber: z.string().min(6),
      ifscCode: z.string().min(5),
      accountHolderName: z.string().min(2),
      bankName: z.string().optional(),
    }).strict(),
    commissionRate: z.number().min(0).max(50).optional(),
  });

  try {
    const body = schema.parse(req.body);
    const organizerId = req.user?.id as string;

    // Block onboarding unless subscription active
    const activeSub = await OrganizerSubscription.findOne({ organizerId, status: 'active' }).sort({ createdAt: -1 });
    if (!activeSub) {
      return res.status(402).json({ error: 'Subscription required before onboarding' });
    }

    const result = await razorpayRouteService.onboardOrganizer({
      organizerId,
      email: (req as any).user?.email || 'organizer@trektribe.in',
      phone: undefined,
      legalBusinessName: body.legalBusinessName,
      businessType: body.businessType,
      bankAccount: {
        accountNumber: body.bankAccount.accountNumber,
        ifscCode: body.bankAccount.ifscCode,
        accountHolderName: body.bankAccount.accountHolderName,
        bankName: body.bankAccount.bankName,
      },
      commissionRate: body.commissionRate,
    });

    res.json({ success: true, accountId: result.accountId, status: result.onboardingStatus });
  } catch (error: any) {
    logger.error('Organizer onboarding failed', { error: error.message });
    res.status(400).json({ error: error.message });
  }
});

// GET /api/marketplace/organizer/status/:id?
router.get('/organizer/status/:id?', authenticateJwt, requireRole(['organizer', 'admin']), async (req: Request, res: Response) => {
  try {
    const organizerId = req.params.id || req.user?.id;
    const config = await OrganizerPayoutConfig.findOne({ organizerId });
    if (!config) {
      return res.json({ onboarded: false, status: 'pending' });
    }
    res.json({
      onboarded: !!config.razorpayAccountId,
      accountId: config.razorpayAccountId,
      status: config.onboardingStatus,
      commissionRate: config.commissionRate,
      kycStatus: config.kycStatus,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/marketplace/orders/create
router.post('/orders/create', authenticateJwt, requireRole(['traveler', 'organizer', 'admin']), async (req: Request, res: Response) => {
  const schema = z.object({
    amount: z.number().min(100),
    currency: z.string().optional(),
    organizerId: z.string(),
    tripId: z.string().optional(),
    notes: z.record(z.any()).optional(),
  });

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
  const schema = z.object({
    orderId: z.string(),
    paymentId: z.string(),
  });

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
  const schema = z.object({
    orderId: z.string(),
    amount: z.number().min(1),
    reason: z.string().optional(),
  });

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

export default router;
