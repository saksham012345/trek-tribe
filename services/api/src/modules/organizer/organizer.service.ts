/**
 * Organizer Service
 *
 * All business logic extracted from routes/organizer.ts.
 * No req/res objects — pure data in, data out.
 */

import { Trip } from '../../models/Trip';
import { GroupBooking } from '../../models/GroupBooking';
import { socketService } from '../../services/socketService';
import { logger } from '../../utils/logger';

// ─── Trips ────────────────────────────────────────────────────────────────────

export async function getOrganizerTrips(organizerId: string) {
  const trips = await Trip.find({ organizerId }).lean();

  const tripsWithCounts = await Promise.all(
    trips.map(async (trip) => {
      const pendingVerifications = await GroupBooking.countDocuments({
        tripId: trip._id,
        paymentVerificationStatus: 'pending',
      });
      return { ...trip, pendingVerifications };
    })
  );

  return { trips: tripsWithCounts };
}

// ─── Pending verifications ────────────────────────────────────────────────────

export async function getPendingVerifications(organizerId: string) {
  const pendingBookings = await GroupBooking.find({ paymentVerificationStatus: 'pending' })
    .populate({
      path: 'tripId',
      match: { organizerId },
      select: 'title destination organizerId',
    })
    .populate('mainBookerId', 'name email phone')
    .sort({ createdAt: -1 });

  const validBookings = pendingBookings
    .filter((booking) => booking.tripId !== null)
    .map((booking) => {
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
          age: p.age,
        })),
      };
    });

  return { bookings: validBookings };
}

// ─── Verify payment ───────────────────────────────────────────────────────────

export async function verifyPayment(
  organizerId: string,
  bookingId: string,
  action: 'verify' | 'reject',
  notes?: string
) {
  if (!['verify', 'reject'].includes(action)) {
    throw Object.assign(new Error('Invalid action. Must be "verify" or "reject"'), { status: 400 });
  }

  const booking = await GroupBooking.findById(bookingId)
    .populate('tripId', 'organizerId title')
    .populate('mainBookerId', 'name email');

  if (!booking) {
    throw Object.assign(new Error('Booking not found'), { status: 404 });
  }

  const trip = booking.tripId as any;
  if (trip.organizerId.toString() !== organizerId) {
    throw Object.assign(new Error('You can only verify payments for your own trips'), { status: 403 });
  }

  if (booking.paymentVerificationStatus !== 'pending') {
    throw Object.assign(new Error('Payment verification already processed'), { status: 400 });
  }

  if (action === 'verify') {
    booking.paymentVerificationStatus = 'verified';
    booking.bookingStatus = 'confirmed';
    booking.paymentStatus = 'completed';

    const tripDoc = await Trip.findById(booking.tripId);
    if (tripDoc && !tripDoc.participants.includes(booking.mainBookerId as any)) {
      tripDoc.participants.push(booking.mainBookerId as any);
      await tripDoc.save();
    }
  } else {
    booking.paymentVerificationStatus = 'rejected';
    booking.bookingStatus = 'cancelled';
    booking.rejectionReason = notes || 'Payment verification failed';
  }

  booking.verifiedBy = organizerId as any;
  booking.verifiedAt = new Date();
  booking.verificationNotes = notes;

  await booking.save();

  const bookingData = {
    ...booking.toObject(),
    tripTitle: trip.title,
    organizerId: trip.organizerId,
  };

  socketService.broadcastBookingUpdate(
    bookingData,
    action === 'verify' ? 'payment_verified' : 'cancelled'
  );

  logger.info('Payment verification processed', {
    bookingId,
    action,
    organizerId,
    tripTitle: trip.title,
  });

  return {
    message: `Payment ${action === 'verify' ? 'verified' : 'rejected'} successfully`,
    booking: {
      id: booking._id,
      status: booking.bookingStatus,
      paymentVerificationStatus: booking.paymentVerificationStatus,
    },
  };
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export async function getOrganizerStats(organizerId: string) {
  const totalTrips = await Trip.countDocuments({ organizerId });
  const activeTrips = await Trip.countDocuments({ organizerId, status: 'active' });
  const completedTrips = await Trip.countDocuments({ organizerId, status: 'completed' });

  const tripIds = await Trip.find({ organizerId }).distinct('_id');

  const totalBookings = await GroupBooking.countDocuments({ tripId: { $in: tripIds } });
  const pendingVerifications = await GroupBooking.countDocuments({
    tripId: { $in: tripIds },
    paymentVerificationStatus: 'pending',
  });
  const confirmedBookings = await GroupBooking.countDocuments({
    tripId: { $in: tripIds },
    bookingStatus: 'confirmed',
  });

  const revenueData = await GroupBooking.aggregate([
    { $match: { tripId: { $in: tripIds }, bookingStatus: 'confirmed' } },
    { $group: { _id: null, totalRevenue: { $sum: '$finalAmount' } } },
  ]);

  const totalRevenue = revenueData.length > 0 ? revenueData[0].totalRevenue : 0;

  const recentBookings = await GroupBooking.find({ tripId: { $in: tripIds } })
    .populate('tripId', 'title destination')
    .populate('mainBookerId', 'name')
    .sort({ createdAt: -1 })
    .limit(5)
    .lean();

  return {
    stats: {
      trips: { total: totalTrips, active: activeTrips, completed: completedTrips },
      bookings: { total: totalBookings, confirmed: confirmedBookings, pendingVerifications },
      revenue: { total: totalRevenue },
      recentBookings: recentBookings.map((booking) => ({
        id: booking._id,
        tripTitle: (booking.tripId as any).title,
        travelerName: (booking.mainBookerId as any).name,
        amount: booking.finalAmount,
        status: booking.bookingStatus,
        createdAt: booking.createdAt,
      })),
    },
  };
}

// ─── Trip participants ────────────────────────────────────────────────────────

export async function getTripParticipants(organizerId: string, tripId: string) {
  const trip = await Trip.findOne({ _id: tripId, organizerId });
  if (!trip) {
    throw Object.assign(new Error('Trip not found or access denied'), { status: 404 });
  }

  const bookings = await GroupBooking.find({ tripId, bookingStatus: 'confirmed' })
    .populate('mainBookerId', 'name email phone')
    .sort({ createdAt: 1 });

  const participants = bookings.map((booking) => ({
    bookingId: booking._id,
    mainBooker: {
      name: (booking.mainBookerId as any).name,
      email: (booking.mainBookerId as any).email,
      phone: (booking.mainBookerId as any).phone,
    },
    participants: booking.participants,
    numberOfGuests: booking.numberOfGuests,
    totalAmount: booking.finalAmount,
    specialRequests: booking.specialRequests,
    bookedAt: booking.createdAt,
  }));

  return {
    trip: {
      id: trip._id,
      title: trip.title,
      destination: trip.destination,
      startDate: trip.startDate,
      endDate: trip.endDate,
      capacity: trip.capacity,
      currentParticipants: participants.reduce((sum, p) => sum + p.numberOfGuests, 0),
    },
    participants,
  };
}
