import { Router } from 'express';
import { Trip } from '../models/Trip';
import { GroupBooking } from '../models/GroupBooking';
import { User } from '../models/User';
import { authenticateJwt, requireRole } from '../middleware/auth';
import { socketService } from '../services/socketService';
import { logger } from '../utils/logger';

const router = Router();

// Get organizer's trips with pending verification counts
router.get('/trips', authenticateJwt, requireRole(['organizer', 'admin']), async (req, res) => {
  try {
    const organizerId = (req as any).auth.userId;
    
    // Get all trips created by this organizer
    const trips = await Trip.find({ organizerId }).lean();
    
    // For each trip, get pending verification count
    const tripsWithCounts = await Promise.all(
      trips.map(async (trip) => {
        const pendingVerifications = await GroupBooking.countDocuments({
          tripId: trip._id,
          paymentVerificationStatus: 'pending'
        });
        
        return {
          ...trip,
          pendingVerifications
        };
      })
    );
    
    res.json({ trips: tripsWithCounts });
    
  } catch (error: any) {
    logger.error('Error fetching organizer trips', { error: error.message, organizerId: (req as any).auth.userId });
    res.status(500).json({ error: 'Failed to fetch trips' });
  }
});

// Get pending payment verifications for organizer's trips
router.get('/pending-verifications', authenticateJwt, requireRole(['organizer', 'admin']), async (req, res) => {
  try {
    const organizerId = (req as any).auth.userId;
    
    // Find all bookings for this organizer's trips that need verification
    const pendingBookings = await GroupBooking.find({
      paymentVerificationStatus: 'pending'
    })
    .populate({
      path: 'tripId',
      match: { organizerId },
      select: 'title destination organizerId'
    })
    .populate('mainBookerId', 'name email phone')
    .sort({ createdAt: -1 });
    
    // Filter out bookings where trip population failed (not organizer's trips)
    const validBookings = pendingBookings
      .filter(booking => booking.tripId !== null)
      .map(booking => {
        const trip = booking.tripId as any;
        const mainBooker = booking.mainBookerId as any;
        
        return {
          _id: booking._id,
          tripId: trip._id,
          tripTitle: trip.title,
          travelerName: mainBooker.name,
          travelerEmail: mainBooker.email,
          numberOfGuests: booking.numberOfGuests,
          totalAmount: booking.finalAmount,
          paymentScreenshot: booking.paymentScreenshot,
          bookingStatus: booking.bookingStatus,
          paymentVerificationStatus: booking.paymentVerificationStatus,
          createdAt: booking.createdAt,
          participants: booking.participants.map((p: any) => ({
            name: p.name,
            phone: p.phone,
            age: p.age
          }))
        };
      });
    
    res.json({ bookings: validBookings });
    
  } catch (error: any) {
    logger.error('Error fetching pending verifications', { error: error.message, organizerId: (req as any).auth.userId });
    res.status(500).json({ error: 'Failed to fetch pending verifications' });
  }
});

// Verify or reject payment
router.post('/verify-payment/:bookingId', authenticateJwt, requireRole(['organizer', 'admin']), async (req, res) => {
  try {
    const organizerId = (req as any).auth.userId;
    const { bookingId } = req.params;
    const { action, notes } = req.body; // action: 'verify' | 'reject'
    
    if (!['verify', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action. Must be "verify" or "reject"' });
    }
    
    // Find the booking and ensure it belongs to organizer's trip
    const booking = await GroupBooking.findById(bookingId)
      .populate('tripId', 'organizerId title')
      .populate('mainBookerId', 'name email');
    
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    
    const trip = booking.tripId as any;
    if (trip.organizerId.toString() !== organizerId) {
      return res.status(403).json({ error: 'You can only verify payments for your own trips' });
    }
    
    if (booking.paymentVerificationStatus !== 'pending') {
      return res.status(400).json({ error: 'Payment verification already processed' });
    }
    
    // Update booking status
    if (action === 'verify') {
      booking.paymentVerificationStatus = 'verified';
      booking.bookingStatus = 'confirmed';
      booking.paymentStatus = 'completed';
      
      // Add participants to trip if not already added
      const trip = await Trip.findById(booking.tripId);
      if (trip && !trip.participants.includes(booking.mainBookerId as any)) {
        trip.participants.push(booking.mainBookerId as any);
        await trip.save();
      }
    } else {
      booking.paymentVerificationStatus = 'rejected';
      booking.bookingStatus = 'cancelled';
      booking.rejectionReason = notes || 'Payment verification failed';
    }
    
    booking.verifiedBy = organizerId;
    booking.verifiedAt = new Date();
    booking.verificationNotes = notes;
    
    await booking.save();
    
    // Broadcast real-time update
    const bookingData = {
      ...booking.toObject(),
      tripTitle: trip.title,
      organizerId: trip.organizerId
    };
    
    socketService.broadcastBookingUpdate(bookingData, action === 'verify' ? 'payment_verified' : 'cancelled');
    
    logger.info('Payment verification processed', {
      bookingId,
      action,
      organizerId,
      tripTitle: trip.title
    });
    
    res.json({
      message: `Payment ${action === 'verify' ? 'verified' : 'rejected'} successfully`,
      booking: {
        id: booking._id,
        status: booking.bookingStatus,
        paymentVerificationStatus: booking.paymentVerificationStatus
      }
    });
    
  } catch (error: any) {
    logger.error('Error processing payment verification', {
      error: error.message,
      bookingId: req.params.bookingId,
      organizerId: (req as any).auth.userId
    });
    res.status(500).json({ error: 'Failed to process payment verification' });
  }
});

// Get organizer statistics
router.get('/stats', authenticateJwt, requireRole(['organizer', 'admin']), async (req, res) => {
  try {
    const organizerId = (req as any).auth.userId;
    
    // Get trip statistics
    const totalTrips = await Trip.countDocuments({ organizerId });
    const activeTrips = await Trip.countDocuments({ organizerId, status: 'active' });
    const completedTrips = await Trip.countDocuments({ organizerId, status: 'completed' });
    
    // Get booking statistics from organizer's trips
    const tripIds = await Trip.find({ organizerId }).distinct('_id');
    
    const totalBookings = await GroupBooking.countDocuments({ tripId: { $in: tripIds } });
    const pendingVerifications = await GroupBooking.countDocuments({ 
      tripId: { $in: tripIds }, 
      paymentVerificationStatus: 'pending' 
    });
    const confirmedBookings = await GroupBooking.countDocuments({ 
      tripId: { $in: tripIds }, 
      bookingStatus: 'confirmed' 
    });
    
    // Calculate total revenue from confirmed bookings
    const revenueData = await GroupBooking.aggregate([
      { $match: { tripId: { $in: tripIds }, bookingStatus: 'confirmed' } },
      { $group: { _id: null, totalRevenue: { $sum: '$finalAmount' } } }
    ]);
    
    const totalRevenue = revenueData.length > 0 ? revenueData[0].totalRevenue : 0;
    
    // Get recent bookings
    const recentBookings = await GroupBooking.find({ 
      tripId: { $in: tripIds } 
    })
    .populate('tripId', 'title destination')
    .populate('mainBookerId', 'name')
    .sort({ createdAt: -1 })
    .limit(5)
    .lean();
    
    const stats = {
      trips: {
        total: totalTrips,
        active: activeTrips,
        completed: completedTrips
      },
      bookings: {
        total: totalBookings,
        confirmed: confirmedBookings,
        pendingVerifications
      },
      revenue: {
        total: totalRevenue
      },
      recentBookings: recentBookings.map(booking => ({
        id: booking._id,
        tripTitle: (booking.tripId as any).title,
        travelerName: (booking.mainBookerId as any).name,
        amount: booking.finalAmount,
        status: booking.bookingStatus,
        createdAt: booking.createdAt
      }))
    };
    
    res.json({ stats });
    
  } catch (error: any) {
    logger.error('Error fetching organizer stats', { error: error.message, organizerId: (req as any).auth.userId });
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// Get trip participants for a specific trip
router.get('/trip/:tripId/participants', authenticateJwt, requireRole(['organizer', 'admin']), async (req, res) => {
  try {
    const organizerId = (req as any).auth.userId;
    const { tripId } = req.params;
    
    // Verify trip belongs to organizer
    const trip = await Trip.findOne({ _id: tripId, organizerId });
    if (!trip) {
      return res.status(404).json({ error: 'Trip not found or access denied' });
    }
    
    // Get all confirmed bookings for this trip
    const bookings = await GroupBooking.find({ 
      tripId, 
      bookingStatus: 'confirmed' 
    })
    .populate('mainBookerId', 'name email phone')
    .sort({ createdAt: 1 });
    
    const participants = bookings.map(booking => ({
      bookingId: booking._id,
      mainBooker: {
        name: (booking.mainBookerId as any).name,
        email: (booking.mainBookerId as any).email,
        phone: (booking.mainBookerId as any).phone
      },
      participants: booking.participants,
      numberOfGuests: booking.numberOfGuests,
      totalAmount: booking.finalAmount,
      specialRequests: booking.specialRequests,
      bookedAt: booking.createdAt
    }));
    
    res.json({
      trip: {
        id: trip._id,
        title: trip.title,
        destination: trip.destination,
        startDate: trip.startDate,
        endDate: trip.endDate,
        capacity: trip.capacity,
        currentParticipants: participants.reduce((sum, p) => sum + p.numberOfGuests, 0)
      },
      participants
    });
    
  } catch (error: any) {
    logger.error('Error fetching trip participants', { error: error.message, tripId: req.params.tripId });
    res.status(500).json({ error: 'Failed to fetch trip participants' });
  }
});

export default router;