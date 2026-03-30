/**
 * Bookings Routes
 *
 * Thin router — delegates to modules/bookings/bookings.controller.ts.
 * Business logic lives in modules/bookings/bookings.service.ts
 */

import express from 'express';
import multer from 'multer';
import { authenticateJwt, requireEmailVerified } from '../middleware/auth';
import * as bookingsController from '../modules/bookings/bookings.controller';

const upload = multer({ storage: multer.memoryStorage() });
const router = express.Router();

// ─── Routes ───────────────────────────────────────────────────────────────────

// Create a new booking
router.post('/', authenticateJwt, requireEmailVerified, bookingsController.createBooking);

// Get user bookings (root)
router.get('/', authenticateJwt, bookingsController.getUserBookings);

// Backwards-compatible alias
router.get('/my-bookings', authenticateJwt, bookingsController.getUserBookingsAlias);

// Cancel booking by trip ID (Legacy/Convenience)
router.delete('/by-trip/:tripId', authenticateJwt, bookingsController.cancelBookingByTripId);

// Get booking details by trip ID
router.get('/trip/:tripId', authenticateJwt, bookingsController.getBookingDetailsByTripId);

// WhatsApp service status
router.get('/whatsapp-status', authenticateJwt, bookingsController.getWhatsappStatus);

// Email service status
router.get('/email-status', authenticateJwt, bookingsController.getEmailServiceStatus);

// Upload payment screenshot
router.post('/:bookingId/payment-screenshot', authenticateJwt, upload.single('paymentScreenshot') as any, bookingsController.uploadPaymentScreenshot);

// Get specific booking details with trip information
router.get('/:bookingId/details', authenticateJwt, bookingsController.getBookingDetails);

// Get booking with payment details (for organizers and admins)
router.get('/:bookingId/payment-verification', authenticateJwt, bookingsController.getBookingForPaymentVerification);

// Verify payment (for organizers and admins)
router.post('/:bookingId/verify-payment', authenticateJwt, bookingsController.verifyPayment);

// Lightweight booking fetch
router.get('/:bookingId', authenticateJwt, bookingsController.getBookingById);

// Lightweight booking update
router.put('/:bookingId', authenticateJwt, bookingsController.updateBooking);

// Cancel booking (soft delete)
router.delete('/:bookingId', authenticateJwt, bookingsController.cancelBooking);

export default router;
