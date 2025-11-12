import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { razorpayService } from '../services/razorpayService';
import { OrganizerSubscription } from '../models/OrganizerSubscription';
import { GroupBooking } from '../models/GroupBooking';
import { User } from '../models/User';
import { emailService } from '../services/emailService';
import { emailTemplates } from '../templates/emailTemplates';
import { logger } from '../utils/logger';
import { auditLogService } from '../services/auditLogService';

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
  try {
    const webhookSignature = req.headers['x-razorpay-signature'] as string;
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!webhookSecret) {
      logger.error('Razorpay webhook secret not configured');
      return res.status(500).json({ error: 'Webhook not configured' });
    }

    // Verify webhook signature
    const webhookBody = JSON.stringify(req.body);
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

    const { event, payload } = req.body;
    const paymentEntity = payload.payment?.entity || payload.order?.entity;

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

      case 'payment.authorized':
        await handlePaymentAuthorized(paymentEntity);
        break;

      default:
        logger.info('Unhandled webhook event', { event });
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

    // Check if this is a subscription payment
    if (notes?.type === 'subscription') {
      const subscription = await OrganizerSubscription.findOne({
        razorpayOrderId: orderId
      }).populate('organizerId', 'name email');

      if (subscription) {
        subscription.status = 'active';
        subscription.razorpayPaymentId = paymentId;
        await subscription.save();

        logger.info('Subscription activated via webhook', {
          subscriptionId: subscription._id,
          paymentId
        });

        // Send subscription activated email
        if (emailService.isServiceReady()) {
          const user = subscription.organizerId as any;
          const emailHtml = emailTemplates.subscriptionActivated({
            userName: user.name,
            planName: subscription.plan,
            planTrips: subscription.tripsPerCycle,
            expiryDate: (subscription.subscriptionEndDate || subscription.trialEndDate || new Date()).toLocaleDateString('en-IN'),
            amount: amount / 100, // Convert paise to rupees
            features: [
              `Post ${subscription.tripsPerCycle} trips`,
              'Payment integration',
              'Booking management',
              'Analytics dashboard'
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
          userId: subscription.organizerId._id.toString(),
          action: 'subscription.payment_captured',
          resource: 'subscription',
          resourceId: subscription._id.toString(),
          details: { paymentId, orderId, amount: amount / 100 }
        });
      }
    }

    // Check if this is a booking payment
    if (notes?.type === 'booking') {
      const booking = await GroupBooking.findOne({
        razorpayOrderId: orderId
      }).populate('mainBookerId', 'name email')
        .populate('tripId', 'title destination startDate endDate organizerId');

      if (booking) {
        booking.paymentStatus = 'completed';
        booking.bookingStatus = 'confirmed';
        booking.razorpayPaymentId = paymentId;
        booking.paymentVerificationStatus = 'verified';
        booking.verifiedAt = new Date();
        await booking.save();

        logger.info('Booking payment confirmed via webhook', {
          bookingId: booking._id,
          paymentId
        });

        // Send booking confirmation email
        if (emailService.isServiceReady()) {
          const user = booking.mainBookerId as any;
          const trip = booking.tripId as any;
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
            bookingId: booking._id.toString()
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
          action: 'booking.payment_captured',
          resource: 'booking',
          resourceId: booking._id.toString(),
          details: { paymentId, orderId, amount: amount / 100 }
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
      const subscription = await OrganizerSubscription.findOne({
        razorpayOrderId: orderId
      });

      if (subscription) {
        subscription.status = 'payment_failed';
        await subscription.save();

        logger.info('Subscription payment failed', { subscriptionId: subscription._id });

        // Audit log
        await auditLogService.log({
          userId: subscription.organizerId.toString(),
          action: 'subscription.payment_failed',
          resource: 'subscription',
          resourceId: subscription._id.toString(),
          details: { paymentId, orderId, error: error_description }
        });
      }
    }

    // Update booking if applicable
    if (notes?.type === 'booking') {
      const booking = await GroupBooking.findOne({
        razorpayOrderId: orderId
      });

      if (booking) {
        booking.paymentStatus = 'failed';
        booking.bookingStatus = 'cancelled';
        await booking.save();

        logger.info('Booking payment failed', { bookingId: booking._id });

        // Audit log
        await auditLogService.log({
          userId: booking.mainBookerId.toString(),
          action: 'booking.payment_failed',
          resource: 'booking',
          resourceId: booking._id.toString(),
          details: { paymentId, orderId, error: error_description }
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

/**
 * Handle refund.processed event
 * Triggered when refund is processed
 */
async function handleRefundProcessed(refund: any) {
  try {
    const { id: refundId, payment_id: paymentId, amount } = refund;

    logger.info('Refund processed', { refundId, paymentId, amount });

    // Find and update booking
    const booking = await GroupBooking.findOne({
      razorpayPaymentId: paymentId
    }).populate('mainBookerId', 'name email');

    if (booking) {
      booking.paymentStatus = 'refunded';
      booking.bookingStatus = 'cancelled';
      await booking.save();

      logger.info('Booking refunded', { bookingId: booking._id, refundId });

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
        action: 'booking.refund_processed',
        resource: 'booking',
        resourceId: booking._id.toString(),
        details: { refundId, paymentId, amount: amount / 100 }
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
