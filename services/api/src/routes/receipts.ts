import { Router, Request, Response } from 'express';
import { authenticateJwt } from '../middleware/auth';
import { pdfService } from '../services/pdfService';
import { GroupBooking } from '../models/GroupBooking';
import { OrganizerSubscription } from '../models/OrganizerSubscription';
import { User } from '../models/User';
import { Trip } from '../models/Trip';
import { logger } from '../utils/logger';
import mongoose from 'mongoose';

const router = Router();

/**
 * GET /api/receipts/booking/:bookingId
 * Generate and download booking payment receipt PDF
 */
router.get('/booking/:bookingId', authenticateJwt, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).auth.userId;
    const { bookingId } = req.params;

    if (!mongoose.isValidObjectId(bookingId)) {
      return res.status(400).json({ error: 'Invalid booking id' });
    }

    // Find the booking
    const booking = await GroupBooking.findById(bookingId)
      .populate('mainBookerId', 'name email phone')
      .populate('tripId', 'title destination startDate endDate organizerId');

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Validate populated fields
    if (!booking.mainBookerId || !booking.tripId) {
      return res.status(404).json({ error: 'Booking data incomplete' });
    }

    // Check authorization - user must be the booker, organizer, or admin
    const user = await User.findById(userId);
    const trip = booking.tripId as any;
    const mainBooker = booking.mainBookerId as any;

    console.log('🔍 Previewing receipt for booking:', {
      bookingId,
      userId,
      mainBookerId: mainBooker?._id,
      tripOrganizerId: trip?.organizerId
    });

    const isBookingOwner = mainBooker._id?.toString() === userId;
    const isOrganizer = trip.organizerId?.toString() === userId;
    const isAdmin = user?.role === 'admin';

    if (!isBookingOwner && !isOrganizer && !isAdmin) {
      return res.status(403).json({ error: 'Unauthorized to access this receipt' });
    }

    // Check if payment is completed
    if (booking.paymentStatus !== 'completed') {
      return res.status(400).json({ error: 'Payment is not completed for this booking' });
    }

    // Get organizer details
    const organizer = await User.findById(trip.organizerId);

    // Generate PDF
    const pdfBuffer = await pdfService.generatePaymentReceipt({
      receiptId: `BKG-${booking._id.toString().slice(-8).toUpperCase()}`,
      userName: (booking.mainBookerId as any).name,
      userEmail: (booking.mainBookerId as any).email,
      userPhone: (booking.mainBookerId as any).phone,
      paymentDate: booking.verifiedAt || booking.createdAt,
      amount: booking.finalAmount,
      paymentMethod: booking.paymentMethod || 'Online Payment',
      transactionId: booking.razorpayPaymentId || `TRK-${booking._id.toString().slice(-8)}`,
      description: `Trip booking for ${trip.title}`,
      items: [
        {
          name: `${trip.title} - ${booking.numberOfGuests} traveler(s)`,
          quantity: booking.numberOfGuests,
          price: booking.pricePerPerson,
          total: booking.finalAmount,
        }
      ],
      organizerName: organizer?.name,
      organizerEmail: organizer?.email,
      tripDetails: {
        title: trip.title,
        destination: trip.destination,
        startDate: new Date(trip.startDate).toLocaleDateString('en-IN'),
        endDate: new Date(trip.endDate).toLocaleDateString('en-IN'),
      }
    });

    // Set headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="receipt-${bookingId}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);

    logger.info('Booking receipt generated', { bookingId, userId });

    res.send(pdfBuffer);
  } catch (error: any) {
    logger.error('Error generating booking receipt', {
      error: error.message,
      bookingId: req.params.bookingId
    });
    res.status(500).json({
      error: 'Failed to generate receipt',
      details: process.env.NODE_ENV !== 'production' ? error.message : undefined
    });
  }
});

/**
 * GET /api/receipts/subscription/:subscriptionId
 * Generate and download subscription payment receipt PDF
 */
router.get('/subscription/:subscriptionId', authenticateJwt, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).auth.userId;
    const { subscriptionId } = req.params;

    if (!mongoose.isValidObjectId(subscriptionId)) {
      return res.status(400).json({ error: 'Invalid subscription id' });
    }

    // Find the subscription
    const subscription = await OrganizerSubscription.findById(subscriptionId)
      .populate('organizerId', 'name email');

    if (!subscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    // Check authorization - user must be the subscription owner or admin
    const user = await User.findById(userId);
    const isOwner = subscription.organizerId._id.toString() === userId;
    const isAdmin = user?.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'Unauthorized to access this receipt' });
    }

    // Check if subscription is paid
    if (subscription.status === 'trial' || !subscription.razorpayPaymentId) {
      return res.status(400).json({ error: 'No payment found for this subscription' });
    }

    // Generate PDF
    const pdfBuffer = await pdfService.generateSubscriptionReceipt({
      receiptId: `SUB-${subscription._id.toString().slice(-8).toUpperCase()}`,
      userName: (subscription.organizerId as any).name,
      userEmail: (subscription.organizerId as any).email,
      paymentDate: subscription.createdAt,
      amount: subscription.pricePerCycle,
      transactionId: subscription.razorpayPaymentId || `TRK-${subscription._id.toString().slice(-8)}`,
      planName: subscription.plan,
      planTrips: subscription.tripsPerCycle,
      validFrom: subscription.subscriptionStartDate || subscription.createdAt,
      validUntil: subscription.subscriptionEndDate || subscription.trialEndDate || new Date(),
    });

    // Set headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="subscription-receipt-${subscriptionId}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);

    logger.info('Subscription receipt generated', { subscriptionId, userId });

    res.send(pdfBuffer);
  } catch (error: any) {
    logger.error('Error generating subscription receipt', {
      error: error.message,
      subscriptionId: req.params.subscriptionId
    });
    res.status(500).json({
      error: 'Failed to generate receipt',
      details: process.env.NODE_ENV !== 'production' ? error.message : undefined
    });
  }
});

/**
 * GET /api/receipts/booking/:bookingId/preview
 * Preview booking receipt (returns JSON with receipt data)
 */
router.get('/booking/:bookingId/preview', authenticateJwt, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).auth.userId;
    const { bookingId } = req.params;

    if (!mongoose.isValidObjectId(bookingId)) {
      return res.status(400).json({ error: 'Invalid booking id' });
    }

    const booking = await GroupBooking.findById(bookingId)
      .populate('mainBookerId', 'name email phone')
      .populate('tripId', 'title destination startDate endDate organizerId');

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Validate populated fields
    if (!booking.mainBookerId || !booking.tripId) {
      return res.status(404).json({ error: 'Booking data incomplete' });
    }

    // Check authorization
    const user = await User.findById(userId);
    const trip = booking.tripId as any;
    const mainBooker = booking.mainBookerId as any;

    console.log('🔍 Generating receipt for booking:', {
      bookingId,
      userId,
      mainBookerId: mainBooker?._id,
      tripOrganizerId: trip?.organizerId
    });

    const isBookingOwner = mainBooker._id?.toString() === userId;
    const isOrganizer = trip.organizerId?.toString() === userId;
    const isAdmin = user?.role === 'admin';

    if (!isBookingOwner && !isOrganizer && !isAdmin) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    if (booking.paymentStatus !== 'completed') {
      return res.status(400).json({ error: 'Payment not completed for this booking' });
    }

    const organizer = await User.findById(trip.organizerId);

    res.json({
      receiptId: `BKG-${booking._id.toString().slice(-8).toUpperCase()}`,
      userName: (booking.mainBookerId as any).name,
      userEmail: (booking.mainBookerId as any).email,
      paymentDate: booking.verifiedAt || booking.createdAt,
      amount: booking.finalAmount,
      paymentMethod: booking.paymentMethod || 'Online Payment',
      paymentStatus: booking.paymentStatus,
      tripDetails: {
        title: trip.title,
        destination: trip.destination,
        startDate: trip.startDate,
        endDate: trip.endDate,
        travelers: booking.numberOfGuests,
      },
      organizer: {
        name: organizer?.name,
        email: organizer?.email,
      },
      downloadUrl: `/api/receipts/booking/${bookingId}`
    });
  } catch (error: any) {
    logger.error('Error previewing booking receipt', { error: error.message });
    res.status(500).json({ error: 'Failed to preview receipt' });
  }
});

export default router;
