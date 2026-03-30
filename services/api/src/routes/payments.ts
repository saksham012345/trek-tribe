import express from 'express';
import { authenticateJwt, requireEmailVerified } from '../middleware/auth';
import * as paymentsController from '../modules/payments/payments.controller';

const router = express.Router();

// -------------------------------------------------------------------------
// 1. Subscription Checkout
// -------------------------------------------------------------------------
router.post('/checkout/subscription', authenticateJwt, requireEmailVerified, paymentsController.checkoutSubscription);

// -------------------------------------------------------------------------
// 2. Trip Booking Checkout
// -------------------------------------------------------------------------
router.post('/checkout/booking', authenticateJwt, paymentsController.checkoutBooking);

// -------------------------------------------------------------------------
// 3. Verify Payment & Fulfill
// -------------------------------------------------------------------------
router.post('/verify', authenticateJwt, paymentsController.verifyPayment);

export default router;
