import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import crypto from 'crypto';
import { razorpayService } from '../services/razorpayService';
import { User } from '../models/User';
import { emailService } from '../services/emailService';
import { emailTemplates } from '../templates/emailTemplates';
import { logger } from '../utils/logger';
import { auditLogService } from '../services/auditLogService';
import { prisma } from '../lib/prisma';
import { upsertRacingSafely } from '../lib/upsert';
import { toNumber } from '../lib/money';
import { shapeBooking } from '../services/bookingShapeService';
import { recordLedgerEntry } from '../services/payoutLedgerService';
import { razorpayRouteService } from '../services/razorpayRouteService';

const router = Router();

/**
 * POST /api/webhooks/razorpay
 * Handle Razorpay payment webhooks
 * 
 * Webhook Events:
 * - payment.captured - Payment successful
 * - payment.failed - Payment failed
 * - order.paid - Order fully paid
 * - refund.processed - Refund completed
 */
router.post('/razorpay', async (req: Request, res: Response) => {
  // Ensure Razorpay webhook payload has expected shape before signature verification
  await Promise.all([
    body('payload').optional().isObject().run(req),
    body('event').optional().isString().isLength({ min: 2, max: 64 }).run(req),
  ]);
  const vErrors = validationResult(req);
  if (!vErrors.isEmpty()) {
    return res.status(400).json({ errors: vErrors.array() });
  }
  try {
    const webhookSignature = req.headers['x-razorpay-signature'] as string;
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!webhookSecret) {
      logger.error('Razorpay webhook secret not configured');
      return res.status(500).json({ error: 'Webhook not configured' });
    }

    // Use rawBody when available so the signature matches exact bytes sent by Razorpay
    const webhookBody = (req as any).rawBody || JSON.stringify(req.body);
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(webhookBody)
      .digest('hex');

    if (webhookSignature !== expectedSignature) {
      logger.warn('Invalid Razorpay webhook signature', {
        received: webhookSignature?.slice(0, 10),
        expected: expectedSignature?.slice(0, 10)
      });
      return res.status(400).json({ error: 'Invalid signature' });
    }

    // Webhook replay protection: check timestamp (optional but recommended)
    const webhookTimestamp = req.body?.created_at;
    if (webhookTimestamp) {
      const now = Math.floor(Date.now() / 1000);
      const timeDiff = now - webhookTimestamp;
      // Reject webhooks older than 5 minutes (300 seconds)
      if (timeDiff > 300 || timeDiff < -60) {
        logger.warn('Webhook timestamp out of acceptable range (possible replay attack)', {
          timeDiff,
          webhookTimestamp,
          currentTime: now
        });
        return res.status(400).json({ error: 'Webhook timestamp invalid or expired' });
      }
    }

    const { event, payload } = req.body;
    const paymentEntity = payload.payment?.entity || payload.order?.entity;

    // Deduplicate: determine an eventId to ensure idempotency
    const eventId = req.body?.id || paymentEntity?.id || payload?.payment?.entity?.id || payload?.order?.entity?.id;
    if (!eventId) {
      logger.warn('Webhook missing identifiable event id', { event });
      return res.status(400).json({ error: 'Missing event id' });
    }

    // If this event was already processed, acknowledge quickly
    const existingEvent = await prisma.webhookEvent.findUnique({ where: { eventId } });
    if (existingEvent) {
      logger.info('Duplicate webhook ignored (already processed)', { eventId, event });
      return res.status(200).json({ status: 'already_processed' });
    }

    if (!paymentEntity) {
      logger.warn('Webhook received without payment entity', { event });
      return res.status(400).json({ error: 'Invalid payload' });
    }

    logger.info('Razorpay webhook received', {
      event,
      paymentId: paymentEntity.id,
      amount: paymentEntity.amount,
      status: paymentEntity.status
    });

    // Handle different webhook events
    switch (event) {
      case 'payment.captured':
        await handlePaymentCaptured(paymentEntity);
        break;

      case 'payment.failed':
        await handlePaymentFailed(paymentEntity);
        break;

      case 'order.paid':
        await handleOrderPaid(paymentEntity);
        break;

      case 'refund.processed':
        await handleRefundProcessed(paymentEntity);
        break;

      case 'transfer.processed':
        await handleTransferProcessed(payload);
        break;

      case 'payment.authorized':
        await handlePaymentAuthorized(paymentEntity);
        break;

      default:
        logger.info('Unhandled webhook event', { event });
    }

    // Mark event processed for idempotency
    try {
      // eventId is unique, so a webhook the provider replays while the first
      // call is still in flight collides here instead of being processed twice.
      try {
        await prisma.webhookEvent.create({
          data: { eventId, source: 'razorpay', processedAt: new Date(), rawPayload: req.body }
        });
      } catch (err: any) {
        if (err?.code !== 'P2002') throw err;
      }
    } catch (dbErr: any) {
      logger.warn('Failed to persist webhook event for idempotency', { error: dbErr.message, eventId });
    }

    // Acknowledge webhook
    res.status(200).json({ status: 'ok' });
  } catch (error: any) {
    logger.error('Error processing Razorpay webhook', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

/**
 * Handle payment.captured event
 * Triggered when payment is successfully captured
 */
async function handlePaymentCaptured(payment: any) {
  try {
    const { id: paymentId, order_id: orderId, amount, method, notes } = payment;

    logger.info('Processing payment.captured', { paymentId, orderId });

    if (notes?.type === 'marketplace') {
      await handleMarketplacePaymentCaptured(payment);
    }

    // Check if this is a subscription payment
    if (notes?.type === 'subscription') {
      // populate('organizerId') is gone - User is still a Mongo document, so the
      // organizer is fetched explicitly further down where the email needs it.
      const subscription = await prisma.organizerSubscription.findFirst({
        where: { razorpayOrderId: orderId }
      });

      if (subscription) {
        // Extract Plan ID from notes or fallback
        const planId = notes?.planId || notes?.plan_id;

        // Import config
        const { SUBSCRIPTION_PLANS, DEFAULT_AUTOPAY_PLAN } = require('../config/subscription.config');

        // Determine Plan Config
        let planConfig = DEFAULT_AUTOPAY_PLAN;
        if (planId && SUBSCRIPTION_PLANS[planId]) {
          planConfig = SUBSCRIPTION_PLANS[planId];
        } else if (subscription.planType && SUBSCRIPTION_PLANS[subscription.planType]) {
          // Fallback to Plan Type stored in DB if not in notes
          planConfig = SUBSCRIPTION_PLANS[subscription.planType];
        }

        // crmBundle was a nested object that could be absent, which is why the
        // branch above it existed. The three fields are columns with defaults
        // now, so there is nothing to create before writing to.
        //
        // tripsPerCycle is raised to the plan's allowance. It can only go up
        // here, never below trips already used - the CHECK on
        // (trips_used <= trips_per_cycle) would refuse that, and refusing is
        // right: silently lowering the cap below what an organizer has already
        // spent would make their remaining count negative.
        await prisma.organizerSubscription.update({
          where: { id: subscription.id },
          data: {
            status: 'active',
            razorpayPaymentId: paymentId,
            planType: planConfig.id,
            tripsPerCycle: Math.max(planConfig.trips, subscription.tripsUsed),
            crmBundleHasAccess: planConfig.crmAccess,
            crmBundleFeatures: planConfig.features
          }
        });

        // Reset usage for new cycle if needed (optional logic depending on exact business rule)
        // For now, we just activate. Cycle reset handled by scheduled jobs usually.

        logger.info('Subscription activated via webhook', {
          subscriptionId: subscription.id,
          paymentId,
          planId: planConfig.id,
          trips: planConfig.trips,
          crm: planConfig.crmAccess
        });

        // Send subscription activated email
        const organizer = await User.findById(subscription.organizerId);

        if (emailService.isServiceReady() && organizer) {
          const user = organizer as any;
          const emailHtml = emailTemplates.subscriptionActivated({
            userName: user.name,
            planName: planConfig.name, // Use actual plan name
            planTrips: planConfig.trips, // Use actual trip limit
            expiryDate: (subscription.subscriptionEndDate || subscription.trialEndDate || new Date()).toLocaleDateString('en-IN'),
            amount: amount / 100, // Convert paise to rupees
            features: [
              `Post ${planConfig.trips} trips`,
              planConfig.crmAccess ? 'Full CRM Access' : 'Basic Dashboard',
              planConfig.phoneNumbers ? 'Traveler Phone Numbers' : 'Email Support Only',
              ...planConfig.features.slice(0, 2) // Add top 2 features
            ]
          });

          await emailService.sendEmail({
            to: user.email,
            subject: '🎊 Your Trek-Tribe Subscription is Active!',
            html: emailHtml
          });
        }

        // Audit log
        await auditLogService.log({
          userId: subscription.organizerId,
          action: 'PAYMENT',
          resource: 'Subscription',
          resourceId: subscription.id,
          metadata: { type: 'subscription.payment_captured', paymentId, orderId, amount: amount / 100, plan: planConfig.id }
        });
      }
    }

    // Check if this is a booking payment
    if (notes?.type === 'booking') {
      const bookingRow = await prisma.groupBooking.findFirst({
        where: { razorpayOrderId: orderId },
        include: { trip: true }
      });

      if (bookingRow) {
        // Razorpay retries webhooks, so this must be idempotent: the update is
        // conditional on the booking not already being confirmed, and the email
        // below only goes out to the delivery that actually made the change.
        const confirmed = await prisma.groupBooking.updateMany({
          where: { id: bookingRow.id, bookingStatus: { not: 'confirmed' } },
          data: {
            paymentStatus: 'completed',
            bookingStatus: 'confirmed',
            razorpayPaymentId: paymentId,
            paymentVerificationStatus: 'verified',
            verifiedAt: new Date()
          }
        });

        const booking: any = shapeBooking(bookingRow);

        logger.info('Booking payment confirmed via webhook', {
          bookingId: bookingRow.id,
          paymentId,
          alreadyConfirmed: confirmed.count === 0
        });

        // Send booking confirmation email
        if (emailService.isServiceReady() && confirmed.count > 0) {
          const user: any = await User.findById(bookingRow.mainBookerId).select('name email').lean();
          const trip: any = bookingRow.trip;
          const organizer = await User.findById(trip.organizerId);

          const emailHtml = emailTemplates.bookingConfirmation({
            userName: user.name,
            tripTitle: trip.title,
            tripDestination: trip.destination,
            startDate: new Date(trip.startDate).toLocaleDateString('en-IN'),
            endDate: new Date(trip.endDate).toLocaleDateString('en-IN'),
            totalTravelers: booking.numberOfGuests,
            totalAmount: amount / 100,
            organizerName: organizer?.name || 'Trek-Tribe',
            organizerEmail: organizer?.email || 'support@trek-tribe.com',
            organizerPhone: organizer?.phone || 'N/A',
            bookingId: booking.id.toString()
          });

          await emailService.sendEmail({
            to: user.email,
            subject: '🎉 Booking Confirmed - Trek-Tribe',
            html: emailHtml
          });
        }

        // Audit log
        await auditLogService.log({
          userId: (booking.mainBookerId as any)._id.toString(),
          action: 'PAYMENT',
          resource: 'Booking',
          resourceId: booking.id.toString(),
          metadata: { type: 'booking.payment_captured', paymentId, orderId, amount: amount / 100 }
        });
      }
    }
  } catch (error: any) {
    logger.error('Error handling payment.captured', {
      error: error.message,
      paymentId: payment.id
    });
    throw error;
  }
}

async function handleMarketplacePaymentCaptured(payment: any) {
  const { order_id: orderId, id: paymentId, amount } = payment;

  const order = await prisma.marketplaceOrder.findUnique({ where: { orderId } });
  if (!order) {
    logger.warn('Marketplace order not found for payment', { orderId, paymentId });
    return;
  }

  await prisma.marketplaceOrder.update({
    where: { id: order.id },
    data: { status: 'paid', paymentId }
  });

  try {
    await razorpayRouteService.createTransfer({ orderId, paymentId });
  } catch (err: any) {
    logger.error('Auto-split failed after capture', { error: err.message, orderId, paymentId });
  }

  await auditLogService.log({
    userId: order.userId,
    action: 'PAYMENT',
    resource: 'MarketplaceOrder',
    resourceId: order.id,
    metadata: { type: 'marketplace.payment_captured', paymentId, amount: amount / 100 }
  });
}

/**
 * Handle payment.failed event
 * Triggered when payment fails
 */
async function handlePaymentFailed(payment: any) {
  try {
    const { id: paymentId, order_id: orderId, error_description, notes } = payment;

    logger.warn('Payment failed', { paymentId, orderId, error: error_description });

    // Update subscription if applicable
    if (notes?.type === 'subscription') {
      const subscription = await prisma.organizerSubscription.findFirst({
        where: { razorpayOrderId: orderId }
      });

      if (subscription) {
        // 'expired' rather than 'payment_failed', which was never one of the
        // five allowed values - the comment says so, and the enum now enforces it.
        await prisma.organizerSubscription.update({
          where: { id: subscription.id },
          data: { status: 'expired' }
        });

        logger.info('Subscription payment failed', { subscriptionId: subscription.id });

        // Audit log
        await auditLogService.log({
          userId: subscription.organizerId,
          action: 'PAYMENT',
          resource: 'Subscription',
          resourceId: subscription.id,
          metadata: { type: 'subscription.payment_failed', paymentId, orderId, error: error_description },
          status: 'FAILURE',
          errorMessage: error_description
        });
      }
    }

    // Update booking if applicable
    if (notes?.type === 'booking') {
      const booking = await prisma.groupBooking.findFirst({
        where: { razorpayOrderId: orderId }
      });

      if (booking) {
        await prisma.groupBooking.update({
          where: { id: booking.id },
          data: { paymentStatus: 'failed', bookingStatus: 'cancelled' }
        });

        logger.info('Booking payment failed', { bookingId: booking.id });

        // Audit log
        await auditLogService.log({
          userId: booking.mainBookerId.toString(),
          action: 'PAYMENT',
          resource: 'Booking',
          resourceId: booking.id.toString(),
          metadata: { type: 'booking.payment_failed', paymentId, orderId, error: error_description },
          status: 'FAILURE',
          errorMessage: error_description
        });
      }
    }
  } catch (error: any) {
    logger.error('Error handling payment.failed', {
      error: error.message,
      paymentId: payment.id
    });
    throw error;
  }
}

/**
 * Handle order.paid event
 * Triggered when order is fully paid
 */
async function handleOrderPaid(order: any) {
  try {
    const { id: orderId, amount_paid, notes } = order;

    logger.info('Order paid', { orderId, amountPaid: amount_paid });

    // Additional processing if needed
    // This event is typically followed by payment.captured
  } catch (error: any) {
    logger.error('Error handling order.paid', {
      error: error.message,
      orderId: order.id
    });
    throw error;
  }
}

async function handleTransferProcessed(payload: any) {
  const transferEntity = payload?.transfer?.entity;
  if (!transferEntity) return;

  const transferId = transferEntity.id;
  const paymentId = transferEntity.source;

  const transferDoc = await prisma.marketplaceTransfer.findUnique({ where: { transferId } });
  if (!transferDoc) {
    logger.warn('Transfer webhook received but transfer not found in DB', { transferId, paymentId });
    return;
  }

  await prisma.marketplaceTransfer.update({
    where: { id: transferDoc.id },
    data: { status: 'processed', processedAt: new Date() }
  });

  // This is the second half of the double credit. createTransfer() already
  // wrote a credit for this same transfer id when it created the transfer;
  // recordLedgerEntry finds the unique constraint, logs it and moves on, so the
  // payout is counted once whichever of the two runs first.
  await recordLedgerEntry({
    organizerId: transferDoc.organizerId,
    type: 'credit',
    source: 'transfer',
    referenceId: transferId,
    amount: toNumber(transferDoc.payoutAmount),
    currency: 'INR',
    description: 'Transfer processed',
  });

  await auditLogService.log({
    userId: transferDoc.organizerId,
    action: 'PAYMENT',
    resource: 'MarketplaceTransfer',
    resourceId: transferDoc.id,
    metadata: { type: 'transfer.processed', transferId, paymentId }
  });
}

/**
 * Handle refund.processed event
 * Triggered when refund is processed
 */
async function handleRefundProcessed(refund: any) {
  try {
    const { id: refundId, payment_id: paymentId, amount } = refund;

    logger.info('Refund processed', { refundId, paymentId, amount });

    // Find and update booking
    // razorpayPaymentId is unique on this table, so there is at most one.
    const bookingRow = await prisma.groupBooking.findUnique({
      where: { razorpayPaymentId: paymentId }
    });

    if (bookingRow) {
      await prisma.groupBooking.update({
        where: { id: bookingRow.id },
        data: { paymentStatus: 'refunded', bookingStatus: 'cancelled' }
      });

      const booking: any = shapeBooking(bookingRow);
      booking.mainBookerId =
        (await User.findById(bookingRow.mainBookerId).select('name email').lean()) ?? bookingRow.mainBookerId;

      logger.info('Booking refunded', { bookingId: booking.id, refundId });

      // Send refund notification email
      if (emailService.isServiceReady()) {
        const user = booking.mainBookerId as any;
        await emailService.sendEmail({
          to: user.email,
          subject: '💰 Refund Processed - Trek-Tribe',
          html: `
            <h2>Refund Confirmation</h2>
            <p>Hi ${user.name},</p>
            <p>Your refund of ₹${(amount / 100).toLocaleString('en-IN')} has been processed successfully.</p>
            <p>Refund ID: ${refundId}</p>
            <p>The amount will be credited to your original payment method within 5-7 business days.</p>
            <p>For any questions, contact support@trek-tribe.com</p>
          `
        });
      }

      // Audit log
      await auditLogService.log({
        userId: (booking.mainBookerId as any)._id.toString(),
        action: 'PAYMENT',
        resource: 'Booking',
        resourceId: booking.id.toString(),
        metadata: { type: 'booking.refund_processed', refundId, paymentId, amount: amount / 100 }
      });
    }

    // Marketplace refunds
    const marketplaceOrder = await prisma.marketplaceOrder.findUnique({ where: { paymentId } });
    if (marketplaceOrder) {
      const refundFields = {
        orderId: marketplaceOrder.id,
        paymentId,
        amount,
        currency: marketplaceOrder.currency,
        reversedTransfer: false,
        status: 'processed' as const,
        processedAt: new Date(),
      };

      const refundDoc = await upsertRacingSafely(() => prisma.marketplaceRefund.upsert({
        where: { refundId },
        create: { refundId, ...refundFields },
        update: refundFields,
      }));

      // amount arrives from Razorpay as a number and the column is Decimal.
      // `amount === marketplaceOrder.amount` would have been false for every
      // full refund, so a fully refunded order would have been left reading
      // 'partial_refund' forever.
      const isFullRefund = amount === toNumber(marketplaceOrder.amount);

      await prisma.marketplaceOrder.update({
        where: { id: marketplaceOrder.id },
        data: {
          status: isFullRefund ? 'refunded' : 'partial_refund',
          refundStatus: isFullRefund ? 'processed' : 'partial',
        }
      });

      await recordLedgerEntry({
        organizerId: marketplaceOrder.organizerId,
        type: 'debit',
        source: 'refund',
        referenceId: refundId,
        amount,
        currency: marketplaceOrder.currency,
        description: 'Marketplace refund processed',
      });

      await auditLogService.log({
        userId: marketplaceOrder.userId,
        action: 'PAYMENT',
        resource: 'MarketplaceRefund',
        resourceId: refundDoc.id,
        metadata: { type: 'marketplace.refund_processed', refundId, paymentId, amount: amount / 100 }
      });
    }
  } catch (error: any) {
    logger.error('Error handling refund.processed', {
      error: error.message,
      refundId: refund.id
    });
    throw error;
  }
}

/**
 * Handle payment.authorized event
 * Triggered when payment is authorized (before capture)
 */
async function handlePaymentAuthorized(payment: any) {
  try {
    const { id: paymentId, order_id: orderId, amount } = payment;

    logger.info('Payment authorized', { paymentId, orderId, amount });

    // Update status to pending capture if needed
    // Razorpay will auto-capture by default, so this is informational
  } catch (error: any) {
    logger.error('Error handling payment.authorized', {
      error: error.message,
      paymentId: payment.id
    });
    throw error;
  }
}

/**
 * GET /api/webhooks/test
 * Test endpoint to verify webhook setup (development only)
 */
if (process.env.NODE_ENV !== 'production') {
  router.get('/test', (_req: Request, res: Response) => {
    res.json({
      message: 'Webhook endpoint is active',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV
    });
  });
}

export default router;
