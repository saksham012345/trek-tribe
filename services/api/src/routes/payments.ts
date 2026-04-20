import express from 'express';
import { authenticateJwt, requireEmailVerified } from '../middleware/auth';
import * as paymentsController from '../modules/payments/payments.controller';
import { getSiteSettings } from '../services/siteSettingsService';

const router = express.Router();

// -------------------------------------------------------------------------
// 0. Runtime payment config (used by admin/frontend to show active provider)
// -------------------------------------------------------------------------
router.get('/config', async (_req, res) => {
  try {
    const settings = await getSiteSettings();
    res.json({
      provider: settings.integrations?.paymentProvider || 'razorpay',
      allowManualFallback: (settings.integrations?.paymentProvider || 'razorpay') === 'manual'
    });
  } catch {
    res.json({ provider: 'razorpay', allowManualFallback: false });
  }
});

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
