/**
 * Payments Controller
 *
 * Thin HTTP layer — extracts params, calls service, returns response.
 * No business logic lives here.
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import * as paymentsService from './payments.service';
import { logger } from '../../utils/logger';

const subscriptionCheckoutSchema = z.object({
  planId: z.string(),
});

const bookingCheckoutSchema = z.object({
  tripId: z.string(),
  numberOfTravelers: z.number().min(1),
  bookingId: z.string().optional(),
});

const verifySchema = z.object({
  razorpayOrderId: z.string(),
  razorpayPaymentId: z.string(),
  razorpaySignature: z.string(),
});

export async function checkoutSubscription(req: Request, res: Response) {
  try {
    const userId = (req as any).auth.userId;
    const { planId } = subscriptionCheckoutSchema.parse(req.body);
    const result = await paymentsService.createSubscriptionCheckout(userId, planId);
    return res.json(result);
  } catch (error: any) {
    logger.error('Subscription checkout failed', {
      error: error.message,
      userId: (req as any).auth?.userId,
    });
    return res.status(error.status || 500).json({
      error: error.status ? error.message : 'Checkout failed',
      details: error.status ? undefined : error.message,
    });
  }
}

export async function checkoutBooking(req: Request, res: Response) {
  try {
    const userId = (req as any).auth.userId;
    const { tripId, numberOfTravelers, bookingId } = bookingCheckoutSchema.parse(req.body);
    const result = await paymentsService.createBookingCheckout(
      userId,
      tripId,
      numberOfTravelers,
      bookingId
    );
    return res.json(result);
  } catch (error: any) {
    logger.error('Booking checkout failed', { error: error.message });
    return res.status(error.status || 500).json({
      error: error.status ? error.message : 'Checkout failed',
    });
  }
}

export async function verifyPayment(req: Request, res: Response) {
  try {
    const userId = (req as any).auth.userId;
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = verifySchema.parse(req.body);
    const result = await paymentsService.verifyAndFulfillPayment(
      userId,
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature
    );
    return res.json(result);
  } catch (error: any) {
    logger.error('Payment verification failed', { error: error.message });
    return res.status(error.status || 500).json({
      error: error.status ? error.message : 'Verification failed',
    });
  }
}
