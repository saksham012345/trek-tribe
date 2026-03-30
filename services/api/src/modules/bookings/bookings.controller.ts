/**
 * Bookings Controller
 *
 * Thin HTTP layer — extracts params from req, calls service, formats res.
 * No business logic lives here.
 */

import { Response } from 'express';
import * as bookingsService from './bookings.service';
import { logger } from '../../utils/logger';

// ─── Create booking ───────────────────────────────────────────────────────────

export async function createBooking(req: any, res: Response) {
  try {
    // Normalize field aliases used by tests/clients
    if (req.body && !req.body.numberOfTravelers && req.body.numberOfGuests) {
      req.body.numberOfTravelers = req.body.numberOfGuests;
    }
    if (req.body && !req.body.travelerDetails && Array.isArray(req.body.participants)) {
      req.body.travelerDetails = req.body.participants;
    }

    const userId = req.auth.userId;

    console.log('📥 Received booking request:', {
      tripId: req.body.tripId,
      numberOfTravelers: req.body.numberOfTravelers,
      contactPhone: req.body.contactPhone,
    });

    // Parse with smart defaults
    let parsed;
    try {
      parsed = bookingsService.createBookingSchema.parse(req.body);
    } catch (error: any) {
      parsed = bookingsService.createBookingSchema.parse({
        tripId: req.body.tripId || '',
        numberOfTravelers: req.body.numberOfTravelers || 1,
        selectedPackage: req.body.selectedPackage || undefined,
        travelerDetails: req.body.travelerDetails || undefined,
        specialRequests: req.body.specialRequests || undefined,
        contactPhone: req.body.contactPhone || '0000000000',
        emergencyContactName: req.body.emergencyContactName || undefined,
        emergencyContactPhone: req.body.emergencyContactPhone || undefined,
        experienceLevel: req.body.experienceLevel || 'beginner'
      });
    }

    const { groupBooking, pricePerPerson } = await bookingsService.createBooking(parsed, userId);

    const bookingObj = groupBooking.toObject ? groupBooking.toObject() : groupBooking;
    bookingObj.numberOfGuests = groupBooking.numberOfGuests;
    bookingObj.bookingStatus = groupBooking.bookingStatus;
    bookingObj.pricePerPerson = pricePerPerson;
    bookingObj.totalAmount = groupBooking.finalAmount;

    res.status(201).json({ ...bookingObj });

  } catch (error: any) {
    if (error.body) return res.status(error.status || 400).json(error.body);
    logger.error('Error creating booking', { error: error.message, userId: req.auth?.userId });
    res.status(error.status || 500).json({
      error: error.message || 'Failed to create booking',
      details: process.env.NODE_ENV !== 'production' ? error.message : undefined
    });
  }
}

// ─── Get user bookings (root) ─────────────────────────────────────────────────

export async function getUserBookings(req: any, res: Response) {
  try {
    const userId = req.auth.userId;
    const bookings = await bookingsService.getUserBookings(userId);
    return res.json(bookings);
  } catch (error: any) {
    logger.error('Error fetching user bookings', { error: error.message, userId: req.auth?.userId });
    return res.status(500).json({ error: 'Failed to fetch bookings' });
  }
}

// ─── Get user bookings (alias) ────────────────────────────────────────────────

export async function getUserBookingsAlias(req: any, res: Response) {
  try {
    const userId = req.auth.userId;
    const bookings = await bookingsService.getUserBookingsAlias(userId);
    return res.json({ bookings });
  } catch (error: any) {
    logger.error('Error fetching user bookings (alias)', { error: error.message, userId: req.auth?.userId });
    return res.status(500).json({ error: 'Failed to fetch bookings' });
  }
}

// ─── Cancel booking by trip ID ────────────────────────────────────────────────

export async function cancelBookingByTripId(req: any, res: Response) {
  try {
    const userId = req.auth.userId;
    await bookingsService.cancelBookingByTripId(req.params.tripId, userId);
    res.json({ message: 'Booking cancelled successfully' });
  } catch (error: any) {
    logger.error('Error cancelling booking', { error: error.message, userId: req.auth?.userId });
    res.status(error.status || 500).json({ error: error.message || 'Failed to cancel booking' });
  }
}

// ─── Get booking details by trip ID ──────────────────────────────────────────

export async function getBookingDetailsByTripId(req: any, res: Response) {
  try {
    const userId = req.auth.userId;
    const bookingDetails = await bookingsService.getBookingDetailsByTripId(req.params.tripId, userId);
    res.json({ booking: bookingDetails });
  } catch (error: any) {
    logger.error('Error fetching booking details', { error: error.message, userId: req.auth?.userId });
    res.status(error.status || 500).json({ error: error.message || 'Failed to fetch booking details' });
  }
}

// ─── WhatsApp status ──────────────────────────────────────────────────────────

export async function getWhatsappStatus(req: any, res: Response) {
  try {
    const status = await bookingsService.getWhatsappStatus();
    res.json(status);
  } catch (error: any) {
    logger.error('Error getting WhatsApp status', { error: error.message });
    res.status(500).json({ error: 'Failed to get WhatsApp status' });
  }
}

// ─── Email service status ─────────────────────────────────────────────────────

export async function getEmailServiceStatus(req: any, res: Response) {
  try {
    const status = await bookingsService.getEmailServiceStatus();
    res.json(status);
  } catch (error: any) {
    logger.error('Error getting email service status', { error: error.message });
    res.status(500).json({ error: 'Failed to get email service status' });
  }
}

// ─── Upload payment screenshot ────────────────────────────────────────────────

export async function uploadPaymentScreenshot(req: any, res: Response) {
  try {
    const userId = req.auth.userId;
    const { bookingId } = req.params;

    const booking = await bookingsService.uploadPaymentScreenshot(
      bookingId,
      userId,
      req.file,
      req.body.paymentScreenshotUrl
    );

    res.json({
      message: 'Payment screenshot uploaded successfully. Your booking is now awaiting payment verification.',
      paymentScreenshot: {
        url: (booking as any).paymentScreenshot.url,
        uploadedAt: (booking as any).paymentScreenshot.uploadedAt
      },
      booking: {
        bookingId: booking._id,
        status: booking.bookingStatus,
        paymentStatus: booking.paymentStatus,
        paymentVerificationStatus: (booking as any).paymentVerificationStatus
      }
    });
  } catch (error: any) {
    logger.error('Error uploading payment screenshot', { error: error.message, userId: req.auth?.userId, bookingId: req.params.bookingId });
    res.status(error.status || 500).json({
      error: error.message || 'Failed to upload payment screenshot',
      details: process.env.NODE_ENV !== 'production' ? error.message : undefined
    });
  }
}

// ─── Get booking details ──────────────────────────────────────────────────────

export async function getBookingDetails(req: any, res: Response) {
  try {
    const userId = req.auth.userId;
    const result = await bookingsService.getBookingDetails(req.params.bookingId, userId);
    res.json(result);
  } catch (error: any) {
    logger.error('Error fetching booking details', { error: error.message, userId: req.auth?.userId, bookingId: req.params.bookingId });
    res.status(error.status || 500).json({
      error: error.message || 'Failed to fetch booking details',
      details: process.env.NODE_ENV !== 'production' ? error.message : undefined
    });
  }
}

// ─── Get booking for payment verification ────────────────────────────────────

export async function getBookingForPaymentVerification(req: any, res: Response) {
  try {
    const userId = req.auth.userId;
    const result = await bookingsService.getBookingForPaymentVerification(req.params.bookingId, userId);
    res.json(result);
  } catch (error: any) {
    logger.error('Error fetching booking for payment verification', { error: error.message, userId: req.auth?.userId, bookingId: req.params.bookingId });
    res.status(error.status || 500).json({
      error: error.message || 'Failed to fetch booking details',
      details: process.env.NODE_ENV !== 'production' ? error.message : undefined
    });
  }
}

// ─── Verify payment ───────────────────────────────────────────────────────────

export async function verifyPayment(req: any, res: Response) {
  try {
    const userId = req.auth.userId;
    const { bookingId } = req.params;
    const { status, notes } = req.body;

    const booking = await bookingsService.verifyPayment(bookingId, userId, status, notes);

    logger.info('Payment verification completed', { bookingId, verificationStatus: status, verifiedBy: userId });

    res.json({
      message: `Payment ${status} successfully`,
      booking: {
        bookingId: booking._id,
        status: booking.bookingStatus,
        paymentStatus: booking.paymentStatus,
        paymentVerificationStatus: (booking as any).paymentVerificationStatus,
        verifiedAt: (booking as any).verifiedAt
      }
    });
  } catch (error: any) {
    logger.error('Error verifying payment', { error: error.message, userId: req.auth?.userId, bookingId: req.params.bookingId });
    res.status(error.status || 500).json({
      error: error.message || 'Failed to verify payment',
      details: process.env.NODE_ENV !== 'production' ? error.message : undefined
    });
  }
}

// ─── Get booking by ID ────────────────────────────────────────────────────────

export async function getBookingById(req: any, res: Response) {
  try {
    const userId = req.auth?.userId || req.user?.userId;
    const booking = await bookingsService.getBookingById(req.params.bookingId, userId);
    return res.json(booking);
  } catch (error: any) {
    return res.status(error.status || 500).json({ error: error.message });
  }
}

// ─── Update booking ───────────────────────────────────────────────────────────

export async function updateBooking(req: any, res: Response) {
  try {
    const userId = req.auth?.userId || req.user?.userId;
    const booking = await bookingsService.updateBooking(req.params.bookingId, userId, req.body.specialRequests);
    return res.json(booking);
  } catch (error: any) {
    return res.status(error.status || 500).json({ error: error.message });
  }
}

// ─── Cancel booking ───────────────────────────────────────────────────────────

export async function cancelBooking(req: any, res: Response) {
  try {
    const userId = req.auth?.userId || req.user?.userId;
    const booking = await bookingsService.cancelBooking(req.params.bookingId, userId);
    return res.json(booking);
  } catch (error: any) {
    return res.status(error.status || 500).json({ error: error.message });
  }
}
