import express, { Router } from 'express';
import { authenticateJwt, requireRole } from '../middleware/auth';
import {
  generatePaymentVerificationCode,
  getPaymentVerificationCode,
  verifyPaymentWithQRCode,
  getPaymentVerificationHistory,
  deactivatePaymentVerification,
  validateQRCodeData,
  getPaymentVerificationSummary,
  generateAmountPaymentQR,
} from '../controllers/paymentVerificationController';

const router: Router = express.Router();

/**
 * Payment Verification Routes
 * Routes for organizers to verify payments using QR codes
 */

/**
 * POST /api/payment-verification/generate-code
 * Generate a new payment verification code with QR code
 * Access: Organizer only
 */
router.post(
  '/generate-code',
  authenticateJwt,
  requireRole(['organizer']),
  generatePaymentVerificationCode
);

/**
 * POST /api/payment-verification/generate-amount-qr
 * Generate a Razorpay-style trusted QR for an exact amount
 * Access: Organizer only
 */
router.post(
  '/generate-amount-qr',
  authenticateJwt,
  requireRole(['organizer']),
  generateAmountPaymentQR
);

/**
 * GET /api/payment-verification/active-code
 * Get the current active verification code
 * Access: Organizer only
 */
router.get(
  '/active-code',
  authenticateJwt,
  requireRole(['organizer']),
  getPaymentVerificationCode
);

/**
 * POST /api/payment-verification/verify-payment
 * Verify a payment using QR code data
 * Access: Public (to allow payment verification from customers/admins)
 * Body: {
 *   verificationCode: string,
 *   amount: number,
 *   currency: string,
 *   paymentMethod: string,
 *   transactionId: string
 * }
 */
router.post('/verify-payment', verifyPaymentWithQRCode);

/**
 * GET /api/payment-verification/history
 * Get payment verification history for organizer
 * Access: Organizer only
 */
router.get(
  '/history',
  authenticateJwt,
  requireRole(['organizer']),
  getPaymentVerificationHistory
);

/**
 * POST /api/payment-verification/deactivate
 * Deactivate current payment verification code
 * Access: Organizer only
 */
router.post(
  '/deactivate',
  authenticateJwt,
  requireRole(['organizer']),
  deactivatePaymentVerification
);

/**
 * POST /api/payment-verification/validate-qrcode
 * Validate QR code data structure and signature
 * Body: { qrCodeData: string }
 */
router.post('/validate-qrcode', validateQRCodeData);

/**
 * GET /api/payment-verification/summary
 * Get payment verification summary for organizer
 * Access: Organizer only
 */
router.get(
  '/summary',
  authenticateJwt,
  requireRole(['organizer']),
  getPaymentVerificationSummary
);

export default router;
