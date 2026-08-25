/**
 * Organizer Service
 *
 * All business logic extracted from routes/organizer.ts.
 * No req/res objects — pure data in, data out.
 */

import { prisma } from '../../lib/prisma';
import { shapeTrip } from '../../services/tripShapeService';
import { shapeBooking } from '../../services/bookingShapeService';
import { addPaidParticipant } from '../../services/tripParticipationService';
import { toNumber } from '../../lib/money';
import { User } from '../../models/User';
import { socketService } from '../../services/socketService';
import { logger } from '../../utils/logger';

// ─── Trips ────────────────────────────────────────────────────────────────────

export async function getOrganizerTrips(organizerId: string) {
  // Was a query per trip to count its pending verifications - an N+1 that the
  // relation removes: the count comes back with the trips in one statement.
  const trips = await prisma.trip.findMany({
    where: { organizerId },
    include: {
      _count: { select: { bookings: { where: { paymentVerificationStatus: 'pending' } } } },
    },
  });

  const tripsWithCounts = trips.map(trip => ({
    ...shapeTrip(trip as any),
    pendingVerifications: trip._count.bookings,
  }));

  return { trips: tripsWithCounts };
}

// ─── Pending verifications ────────────────────────────────────────────────────

export async function getPendingVerifications(organizerId: string) {
  // `.populate({ match })` fetched every pending booking in the system and then
  // discarded the ones whose trip belonged to someone else - the match filtered
  // the populate, not the query, which is why the filter below existed at all.
  // The organizer is part of the query now, so only their bookings are read.
  const pendingRows = await prisma.groupBooking.findMany({
    where: { paymentVerificationStatus: 'pending', trip: { organizerId } },
    include: { trip: true, participants: true },
    orderBy: { createdAt: 'desc' },
  });

  const bookerIds = Array.from(new Set(pendingRows.map(b => b.mainBookerId)));
  const bookers = bookerIds.length
    ? await User.find({ _id: { $in: bookerIds } }, 'name email phone').lean()
    : [];
  const bookerById = new Map(bookers.map((u: any) => [u._id.toString(), u]));

  const pendingBookings = pendingRows.map(row => {
    const booking: any = shapeBooking(row);
    booking.tripId = row.trip ? shapeTrip(row.trip as any) : null;
    booking.mainBookerId = bookerById.get(row.mainBookerId) ?? row.mainBookerId;
    return booking;
  });

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

  const row = await prisma.groupBooking.findUnique({
    where: { id: bookingId },
    include: { trip: true, participants: true },
  });

  if (!row || !row.trip) {
    throw Object.assign(new Error('Booking not found'), { status: 404 });
  }

  const trip = row.trip;
  if (trip.organizerId !== organizerId) {
    throw Object.assign(new Error('You can only verify payments for your own trips'), { status: 403 });
  }

  // Read the status, decide, then write it - two organizers on the same booking
  // both passed that check and both ran the whole verification, sending two
  // emails and broadcasting twice. The claim and the check are one statement.
  const verifying = action === 'verify';

  const claimed = await prisma.groupBooking.updateMany({
    where: { id: bookingId, paymentVerificationStatus: 'pending' },
    data: verifying
      ? {
          paymentVerificationStatus: 'verified',
          bookingStatus: 'confirmed',
          paymentStatus: 'completed',
          verifiedBy: organizerId,
          verifiedAt: new Date(),
          verificationNotes: notes,
        }
      : {
          paymentVerificationStatus: 'rejected',
          bookingStatus: 'cancelled',
          rejectionReason: notes || 'Payment verification failed',
          verifiedBy: organizerId,
          verifiedAt: new Date(),
          verificationNotes: notes,
        },
  });

  if (claimed.count === 0) {
    throw Object.assign(new Error('Payment verification already processed'), { status: 400 });
  }

  if (verifying) {
    // `tripDoc.participants.includes(booking.mainBookerId)` compared two
    // ObjectId instances, which are never equal even when they hold the same
    // value, so the guard never fired and every verification appended the same
    // traveller again. This is the second of the three places that idiom
    // appeared; the unique constraint refuses the duplicate instead.
    await addPaidParticipant(row.tripId, row.mainBookerId);
  }

  const booking: any = shapeBooking(
    await prisma.groupBooking.findUnique({ where: { id: bookingId }, include: { participants: true } })
  );
  booking.mainBookerId = (await User.findById(row.mainBookerId).select('name email').lean()) ?? row.mainBookerId;

  const bookingData = {
    ...booking,
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
  // Was eight sequential round trips, one of them fetching every trip id so the
  // next seven could filter on it. `trip: { organizerId }` is the same filter
  // as a join, so the id list is not needed and the seven counts can run at
  // once.
  const byOrganizer = { trip: { organizerId } };

  const [
    totalTrips,
    activeTrips,
    completedTrips,
    totalBookings,
    pendingVerifications,
    confirmedBookings,
    revenueData,
    recentRows,
  ] = await Promise.all([
    prisma.trip.count({ where: { organizerId } }),
    prisma.trip.count({ where: { organizerId, status: 'active' } }),
    prisma.trip.count({ where: { organizerId, status: 'completed' } }),
    prisma.groupBooking.count({ where: byOrganizer }),
    prisma.groupBooking.count({ where: { ...byOrganizer, paymentVerificationStatus: 'pending' } }),
    prisma.groupBooking.count({ where: { ...byOrganizer, bookingStatus: 'confirmed' } }),
    prisma.groupBooking.aggregate({
      where: { ...byOrganizer, bookingStatus: 'confirmed' },
      _sum: { finalAmount: true },
    }),
    prisma.groupBooking.findMany({
      where: byOrganizer,
      include: { trip: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
  ]);

  const totalRevenue = toNumber(revenueData._sum.finalAmount);

  const recentBookerIds = Array.from(new Set(recentRows.map(b => b.mainBookerId)));
  const recentBookers = recentBookerIds.length
    ? await User.find({ _id: { $in: recentBookerIds } }, 'name').lean()
    : [];
  const recentBookerById = new Map(recentBookers.map((u: any) => [u._id.toString(), u]));

  const recentBookings = recentRows.map(row => ({
    ...shapeBooking(row),
    tripId: row.trip,
    mainBookerId: recentBookerById.get(row.mainBookerId) ?? { name: 'Unknown' },
  }));

  return {
    stats: {
      trips: { total: totalTrips, active: activeTrips, completed: completedTrips },
      bookings: { total: totalBookings, confirmed: confirmedBookings, pendingVerifications },
      revenue: { total: totalRevenue },
      recentBookings: recentBookings.map((booking: any) => ({
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
  const trip = await prisma.trip.findFirst({ where: { id: tripId, organizerId } });
  if (!trip) {
    throw Object.assign(new Error('Trip not found or access denied'), { status: 404 });
  }

  const bookingRows = await prisma.groupBooking.findMany({
    where: { tripId, bookingStatus: 'confirmed' },
    include: { participants: true },
    orderBy: { createdAt: 'asc' },
  });

  const participantBookerIds = Array.from(new Set(bookingRows.map(b => b.mainBookerId)));
  const participantBookers = participantBookerIds.length
    ? await User.find({ _id: { $in: participantBookerIds } }, 'name email phone').lean()
    : [];
  const participantBookerById = new Map(participantBookers.map((u: any) => [u._id.toString(), u]));

  const bookings = bookingRows.map(row => {
    const booking: any = shapeBooking(row);
    booking.mainBookerId = participantBookerById.get(row.mainBookerId) ?? { name: 'Unknown' };
    return booking;
  });

  const participants = bookings.map((booking: any) => ({
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
      id: trip.id,
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
