/**
 * Bookings Service
 *
 * All business logic extracted from routes/bookings.ts.
 * No req/res objects — pure data in, data out.
 */

import mongoose from 'mongoose';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { shapeTrip, tripInclude } from '../../services/tripShapeService';
import {
  bookingInclude,
  shapeBooking,
  shapeBookings,
  computeBookingAmounts
} from '../../services/bookingShapeService';
import {
  joinTrip as joinTripRow,
  leaveTrip as leaveTripRow,
  isParticipant,
  addPaidParticipant,
  TripFullError
} from '../../services/tripParticipationService';
import { User } from '../../models/User';
import { whatsappService } from '../../services/whatsappService';
import { logger } from '../../utils/logger';
import { emailService } from '../../services/emailService';
import { trackPartialBooking } from '../../services/bookingAbandonmentService';
import { fileHandler } from '../../utils/fileHandler';
import { sendBookingConfirmationNotifications } from '../../services/bookingNotificationService';

// ─── Schema ───────────────────────────────────────────────────────────────────

export const createBookingSchema = z.object({
  tripId: z.string(),
  numberOfTravelers: z.number().optional(),
  selectedPackage: z.any().optional(),
  travelerDetails: z.array(z.any()).optional(),
  specialRequests: z.string().optional(),
  contactPhone: z.string().optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  experienceLevel: z.string().optional()
});

export type CreateBookingInput = z.infer<typeof createBookingSchema>;

// Every mongoose.isValidObjectId() guard in this file is gone.
//
// Trip and GroupBooking ids are generated uuid strings now, so that check
// would have rejected every real id and turned each of these routes into a
// blanket 400. The id is still required; what it looks like is the database's
// business, and a value of the wrong shape simply matches no row.

// ─── Create booking ───────────────────────────────────────────────────────────

export async function createBooking(input: CreateBookingInput, userId: string): Promise<any> {
  const {
    tripId,
    numberOfTravelers = 1,
    selectedPackage,
    travelerDetails,
    specialRequests,
    contactPhone,
    emergencyContactName,
    emergencyContactPhone,
    experienceLevel
  } = input;

  if (!tripId) {
    throw Object.assign(new Error('Invalid trip id'), { status: 400 });
  }

  const tripRow = await prisma.trip.findUnique({ where: { id: tripId }, include: tripInclude });
  const trip: any = tripRow ? shapeTrip(tripRow) : null;
  if (trip) {
    // populate('organizerId') is gone; User is still a Mongo document.
    trip.organizerId = (await User.findById(trip.organizerId).select('name phone email').lean()) ?? trip.organizerId;
  }
  if (!trip) throw Object.assign(new Error('Trip not found'), { status: 404 });

  const user = await User.findById(userId);
  if (!user) throw Object.assign(new Error('User not found'), { status: 404 });

  // ID verification check (skip in tests)
  if (process.env.NODE_ENV !== 'test') {
    const { idVerificationService } = require('../../services/idVerificationService');
    const verificationCheck = await idVerificationService.canJoinTrip(userId, tripId);
    if (!verificationCheck.canJoin) {
      throw Object.assign(new Error(verificationCheck.reason || 'ID verification required'), {
        status: 403,
        body: {
          error: verificationCheck.reason || 'ID verification required',
          requiresVerification: verificationCheck.requiresVerification,
          idVerificationStatus: user.idVerificationStatus || 'not_verified'
        }
      });
    }
  }

  // Check availability.
  //
  // This is the friendly error, computed from a count that another booking can
  // change a millisecond later. It is not what enforces capacity - joinTrip
  // does that under a row lock - but it is what gives the traveller a useful
  // message instead of a constraint violation.
  const currentParticipants = trip.participants.length;
  const availableSpots = trip.capacity - currentParticipants;
  if (availableSpots < numberOfTravelers) {
    throw Object.assign(new Error(`Not enough spots available. Only ${availableSpots} spots remaining`), {
      status: 400,
      body: {
        error: `Not enough spots available. Only ${availableSpots} spots remaining`,
        details: { requested: numberOfTravelers, available: availableSpots, tripCapacity: trip.capacity, currentParticipants }
      }
    });
  }

  // Minimum age check
  if (trip.minimumAge && travelerDetails) {
    for (let i = 0; i < travelerDetails.length; i++) {
      const traveler = travelerDetails[i];
      if (traveler.age && traveler.age < trip.minimumAge) {
        throw Object.assign(
          new Error(`Traveler ${i + 1} (${traveler.name || 'Unknown'}) must be at least ${trip.minimumAge} years old to join this trip`),
          { status: 400 }
        );
      }
    }
  }

  // Duplicate booking check (skip in tests)
  if (process.env.NODE_ENV !== 'test') {
    const existingBooking = await prisma.groupBooking.findFirst({
      where: { tripId, mainBookerId: userId, bookingStatus: { in: ['pending', 'confirmed'] } }
    });
    if (existingBooking) {
      throw Object.assign(new Error('You already have a booking for this trip'), {
        status: 400,
        body: {
          error: 'You already have a booking for this trip',
          details: { existingBookingId: existingBooking.id, existingStatus: existingBooking.bookingStatus }
        }
      });
    }
  }

  const pricePerPerson = selectedPackage ? selectedPackage.price : trip.price;

  const participants: any[] = [{
    name: user.name,
    email: user.email,
    phone: user.phone || contactPhone,
    emergencyContactName: emergencyContactName || travelerDetails?.[0]?.emergencyContact || user.name || 'Emergency Contact',
    emergencyContactPhone: emergencyContactPhone || travelerDetails?.[0]?.emergencyContactPhone || contactPhone || user.phone || '0000000000',
    medicalConditions: travelerDetails?.[0]?.medicalConditions || '',
    dietaryRestrictions: travelerDetails?.[0]?.dietary || '',
    experienceLevel: experienceLevel || 'beginner',
    specialRequests: specialRequests || '',
    isMainBooker: true
  }];

  if (travelerDetails && travelerDetails.length > 1) {
    for (let i = 1; i < Math.min(travelerDetails.length, numberOfTravelers); i++) {
      const traveler = travelerDetails[i];
      participants.push({
        name: traveler.name,
        email: `guest${i}@${user.email}`,
        phone: traveler.phone,
        emergencyContactName: traveler.emergencyContactName || traveler.emergencyContact || emergencyContactName || user.name || 'Emergency Contact',
        emergencyContactPhone: traveler.emergencyContactPhone || traveler.emergencyContact || emergencyContactPhone || contactPhone || user.phone || '0000000000',
        medicalConditions: traveler.medicalConditions || '',
        dietaryRestrictions: traveler.dietary || '',
        experienceLevel: experienceLevel || 'beginner',
        specialRequests: '',
        isMainBooker: false
      });
    }
  }

  // The amounts are computed in one place so they satisfy the CHECK constraints
  // that say total = price x guests and final = total - discount. The pre-save
  // hook that used to do this ran only on save.
  const amounts = computeBookingAmounts({ pricePerPerson, numberOfGuests: numberOfTravelers });

  // totalParticipants is gone - it was a second name for numberOfGuests, and
  // the hook set each from the other.
  //
  // The booking and its participants are written together: a booking with no
  // participants would have no main booker, and the partial unique index that
  // guarantees exactly one would be satisfied vacuously.
  let groupBooking: any;
  try {
    groupBooking = shapeBooking(await prisma.groupBooking.create({
      data: {
        tripId,
        mainBookerId: userId,
        numberOfGuests: numberOfTravelers,
        selectedPackageId: selectedPackage?.id,
        packageName: selectedPackage?.name,
        pricePerPerson,
        totalAmount: amounts.totalAmount,
        discountAmount: amounts.discountAmount,
        groupDiscount: amounts.groupDiscount,
        finalAmount: amounts.finalAmount,
        paymentMethod: 'bank_transfer',
        bookingStatus: 'pending',
        paymentVerificationStatus: 'pending',
        specialRequests,
        participants: { create: participants }
      },
      include: bookingInclude
    }));
  } catch (error: any) {
    // (mainBookerId, tripId) is unique. The check above catches the ordinary
    // case; this catches two submissions arriving together, which the check
    // could not.
    if (error?.code === 'P2002') {
      throw Object.assign(new Error('You already have a booking for this trip'), { status: 400 });
    }
    throw error;
  }

  logger.info('New booking created with pending status', { bookingId: groupBooking.id, tripId, userId, numberOfTravelers });

  // Send confirmation email (non-blocking)
  if (emailService.isServiceReady()) {
    emailService.sendBookingConfirmation({
      userName: user.name,
      userEmail: user.email,
      tripTitle: trip.title,
      tripDestination: trip.destination,
      startDate: new Date(trip.startDate).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }),
      endDate: new Date(trip.endDate).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }),
      totalTravelers: numberOfTravelers,
      totalAmount: groupBooking.finalAmount,
      organizerName: (trip.organizerId as any).name,
      organizerEmail: (trip.organizerId as any).email,
      organizerPhone: (trip.organizerId as any).phone,
      bookingId: groupBooking.id
    }).catch((error: any) => {
      logger.error('❌ Failed to send booking confirmation email', { error: error.message, bookingId: groupBooking.id });
    });
  }

  // Track partial booking for abandonment detection
  if (user.email) {
    trackPartialBooking(user.email, user.name, trip.title, tripId, {
      step: 'booking_created',
      formProgress: 100,
      travelerDetails: !!travelerDetails,
      contactInfo: !!contactPhone,
      paymentInfo: false
    }).catch((err: any) => {
      logger.error('Failed to track partial booking', { error: err.message, bookingId: groupBooking.id });
    });
  }

  return { groupBooking, pricePerPerson };
}

/**
 * A user's bookings with their trips, replacing a populate of tripId that also
 * populated the trip's organizer.
 *
 * Trip is in the same database now, so the trip is a join. The organizer is
 * still a Mongo document, so it is one extra query for the whole page rather
 * than one per booking.
 */
async function loadUserBookings(userId: string): Promise<any[]> {
  const rows = await prisma.groupBooking.findMany({
    where: { mainBookerId: userId },
    include: bookingInclude,
    orderBy: { createdAt: 'desc' }
  });

  const organizerIds = Array.from(new Set(rows.map(r => r.trip?.organizerId).filter(Boolean)));
  const organizers = organizerIds.length
    ? await User.find({ _id: { $in: organizerIds } }, 'name phone email').lean()
    : [];
  const organizerById = new Map(organizers.map((u: any) => [u._id.toString(), u]));

  return rows.map(row => {
    const booking = shapeBooking(row);
    const trip: any = row.trip ? shapeTrip(row.trip as any) : null;
    if (trip) {
      trip.organizerId = organizerById.get(row.trip!.organizerId) ?? row.trip!.organizerId;
    }
    booking.tripId = trip;
    return booking;
  });
}

/**
 * One booking, with whichever of its references the caller needs.
 *
 * The populate chains this replaces overwrote the id fields with objects, so
 * `booking.mainBookerId._id.toString()` was how you got the id back. The raw
 * ids are kept alongside as `mainBookerRef`, `tripRef` and `organizerRef`, so
 * a permission check compares two strings rather than reaching through an
 * object that may or may not have been populated.
 */
async function loadBookingWithRefs(
  bookingId: string,
  want: { trip?: boolean; mainBooker?: boolean; organizer?: boolean; verifier?: boolean }
): Promise<any> {
  const row = await prisma.groupBooking.findUnique({
    where: { id: bookingId },
    include: bookingInclude
  });
  if (!row) return null;

  const booking = shapeBooking(row);
  booking.mainBookerRef = row.mainBookerId;
  booking.tripRef = row.tripId;

  if (want.trip && row.trip) {
    const trip: any = shapeTrip(row.trip as any);
    trip.organizerRef = row.trip.organizerId;
    if (want.organizer) {
      trip.organizerId = (await User.findById(row.trip.organizerId).select('name phone email').lean()) ?? row.trip.organizerId;
    }
    booking.tripId = trip;
  }

  if (want.mainBooker) {
    booking.mainBookerId = (await User.findById(row.mainBookerId).select('name email phone').lean()) ?? row.mainBookerId;
  }

  if (want.verifier && row.verifiedBy) {
    booking.verifiedBy = (await User.findById(row.verifiedBy).select('name email').lean()) ?? row.verifiedBy;
  }

  return booking;
}

// ─── Get user bookings ────────────────────────────────────────────────────────

export async function getUserBookings(userId: string): Promise<any[]> {
  // tripId was a populate; Trip is a row in the same database now, so it is a
  // join. The organizer inside it is still a Mongo document.
  const groupBookings = await loadUserBookings(userId);

  return groupBookings.map(booking => {
    const trip = booking.tripId as any;
    return {
      _id: booking._id,
      tripId: trip?._id || booking.tripId,
      tripTitle: trip?.title || 'Unknown',
      destination: trip?.destination || 'Unknown',
      startDate: trip?.startDate,
      endDate: trip?.endDate,
      coverImage: trip?.coverImage,
      numberOfGuests: booking.numberOfGuests,
      totalAmount: booking.finalAmount,
      pricePerPerson: booking.pricePerPerson,
      selectedPackage: booking.packageName,
      bookingStatus: booking.bookingStatus,
      paymentStatus: booking.paymentStatus,
      paymentVerificationStatus: booking.paymentVerificationStatus,
      createdAt: booking.createdAt,
      organizer: {
        id: trip?.organizerId?._id?.toString() || '',
        name: trip?.organizerId?.name || 'N/A',
        phone: trip?.organizerId?.phone || 'N/A',
        email: trip?.organizerId?.email || 'N/A'
      }
    };
  });
}

// ─── Get user bookings (alias with extra fields) ──────────────────────────────

export async function getUserBookingsAlias(userId: string): Promise<any[]> {
  const groupBookings = await loadUserBookings(userId);

  return groupBookings.map(booking => {
    const trip = booking.tripId as any;
    return {
      bookingId: booking._id,
      tripId: trip?._id || booking.tripId,
      tripTitle: trip?.title || 'Unknown',
      destination: trip?.destination || 'Unknown',
      startDate: trip?.startDate,
      endDate: trip?.endDate,
      coverImage: trip?.coverImage,
      numberOfGuests: booking.numberOfGuests,
      totalAmount: booking.finalAmount,
      pricePerPerson: booking.pricePerPerson,
      selectedPackage: booking.packageName,
      bookingStatus: booking.bookingStatus,
      paymentStatus: booking.paymentStatus,
      paymentVerificationStatus: booking.paymentVerificationStatus,
      paymentScreenshotUploaded: !!(booking as any).paymentScreenshot,
      tripStatus: trip?.status,
      createdAt: booking.createdAt,
      organizer: {
        id: trip?.organizerId?._id?.toString() || '',
        name: trip?.organizerId?.name || 'N/A',
        phone: trip?.organizerId?.phone || 'N/A',
        email: trip?.organizerId?.email || 'N/A'
      }
    };
  });
}

// ─── Cancel booking by trip ID ────────────────────────────────────────────────

export async function cancelBookingByTripId(tripId: string, userId: string): Promise<void> {
  if (!tripId) {
    throw Object.assign(new Error('Invalid trip id'), { status: 400 });
  }

  const trip = await prisma.trip.findUnique({ where: { id: tripId }, select: { startDate: true } });
  if (!trip) throw Object.assign(new Error('Trip not found'), { status: 404 });

  // `trip.participants.includes(userId)` compared ObjectIds to a string, so it
  // was false for everyone and this route refused every cancellation it was
  // ever asked for.
  if (!(await isParticipant(tripId, userId))) {
    throw Object.assign(new Error('You are not booked for this trip'), { status: 400 });
  }

  const hoursUntilTrip = (new Date(trip.startDate).getTime() - Date.now()) / (1000 * 60 * 60);
  if (hoursUntilTrip < 48) {
    throw Object.assign(new Error('Cannot cancel booking within 48 hours of trip start time'), { status: 400 });
  }

  await leaveTripRow(tripId, userId);
}

// ─── Get booking details by trip ID ──────────────────────────────────────────

export async function getBookingDetailsByTripId(tripId: string, userId: string): Promise<any> {
  // isValidObjectId would reject every real trip id now that they are uuids.
  if (!tripId) {
    throw Object.assign(new Error('Invalid trip id'), { status: 400 });
  }

  const tripRow = await prisma.trip.findUnique({ where: { id: tripId }, include: tripInclude });
  if (!tripRow) throw Object.assign(new Error('Trip not found'), { status: 404 });

  const trip: any = shapeTrip(tripRow);
  // populate('organizerId') is gone; User is still a Mongo document.
  trip.organizerId = (await User.findById(tripRow.organizerId).select('name phone email').lean()) ?? tripRow.organizerId;

  // `trip.participants.includes(userId)` compared ObjectIds against a string
  // and was false for everyone, so this route answered "Booking not found" to
  // every traveller who asked about a trip they were actually booked on.
  if (!(await isParticipant(tripId, userId))) {
    throw Object.assign(new Error('Booking not found'), { status: 404 });
  }

  return {
    tripId: trip._id,
    tripTitle: trip.title,
    description: trip.description,
    destination: trip.destination,
    startDate: trip.startDate,
    endDate: trip.endDate,
    price: trip.price,
    status: trip.status,
    coverImage: trip.coverImage,
    images: trip.images,
    itinerary: trip.itinerary,
    itineraryPdf: (trip as any).itineraryPdf,
    schedule: trip.schedule,
    organizer: {
      name: (trip.organizerId as any).name,
      phone: (trip.organizerId as any).phone,
      email: (trip.organizerId as any).email
    },
    participantCount: trip.participants.length,
    capacity: trip.capacity
  };
}

// ─── WhatsApp status ──────────────────────────────────────────────────────────

export async function getWhatsappStatus(): Promise<any> {
  return whatsappService.getStatus();
}

// ─── Email service status ─────────────────────────────────────────────────────

export async function getEmailServiceStatus(): Promise<any> {
  return emailService.getServiceStatus();
}

// ─── Upload payment screenshot ────────────────────────────────────────────────

export async function uploadPaymentScreenshot(
  bookingId: string,
  userId: string,
  file: Express.Multer.File | undefined,
  paymentScreenshotUrl: string | undefined
): Promise<any> {
  if (!file && !paymentScreenshotUrl) {
    throw Object.assign(new Error('Payment screenshot file is required'), { status: 400 });
  }

  const booking = await prisma.groupBooking.findUnique({ where: { id: bookingId } });
  if (!booking) throw Object.assign(new Error('Booking not found'), { status: 404 });

  if (booking.mainBookerId !== userId) {
    throw Object.assign(new Error('You can only upload payment screenshots for your own bookings'), { status: 403 });
  }

  if (booking.bookingStatus !== 'pending') {
    throw Object.assign(new Error('Payment screenshot can only be uploaded for pending bookings'), { status: 400 });
  }

  let screenshotData: { url: string; filename: string; originalName: string };

  if (paymentScreenshotUrl) {
    screenshotData = {
      url: paymentScreenshotUrl,
      filename: `payment-screenshot-${Date.now()}.jpg`,
      originalName: 'payment-screenshot.jpg'
    };
  } else if (file) {
    const savedFile = await fileHandler.saveBufferToFile(file.buffer, file.originalname, file.mimetype);
    screenshotData = { url: savedFile.url, filename: savedFile.filename, originalName: file.originalname };
  } else {
    throw Object.assign(new Error('Payment screenshot file or URL is required'), { status: 400 });
  }

  // paymentScreenshot was a nested object; four columns say the same thing and
  // each of them can be queried.
  const updated = shapeBooking(await prisma.groupBooking.update({
    where: { id: bookingId },
    data: {
      screenshotFilename: screenshotData.filename,
      screenshotOriginalName: screenshotData.originalName,
      screenshotUrl: screenshotData.url,
      screenshotUploadedAt: new Date(),
      paymentStatus: 'partial'
    },
    include: bookingInclude
  }));

  // Notify organizer via email
  const trip = await prisma.trip.findUnique({ where: { id: booking.tripId } });
  const traveler = await User.findById(userId);
  const organizer = trip ? await User.findById(trip.organizerId) : null;

  if (trip && traveler && organizer && organizer.email) {
    emailService.sendPaymentScreenshotNotification({
      travelerName: traveler.name,
      travelerEmail: traveler.email,
      tripTitle: trip.title,
      bookingId: bookingId,
      totalAmount: updated.totalAmount,
      organizerName: organizer.name,
      organizerEmail: organizer.email,
      screenshotUrl: updated.paymentScreenshot.url
    }).catch((emailError: any) => {
      logger.error('Failed to send payment screenshot notification email', { error: emailError.message, organizerEmail: organizer.email, bookingId });
    });
  }

  return updated;
}

// ─── Get booking details ──────────────────────────────────────────────────────

export async function getBookingDetails(bookingId: string, userId: string): Promise<any> {
  // tripId is a real join now; mainBookerId and the trip's organizer are still
  // Mongo documents, so they are fetched and attached under the same keys.
  const booking = await loadBookingWithRefs(bookingId, { trip: true, mainBooker: true, organizer: true });

  if (!booking) throw Object.assign(new Error('Booking not found'), { status: 404 });

  const user = await User.findById(userId);
  const trip = booking.tripId as any;

  const isBookingOwner = booking.mainBookerRef === userId;
  const isOrganizer = trip.organizerRef === userId;
  const isAdmin = user?.role === 'admin';

  if (!isBookingOwner && !isOrganizer && !isAdmin) {
    throw Object.assign(new Error('You do not have permission to view this booking'), { status: 403 });
  }

  return {
    booking: {
      _id: booking._id,
      tripTitle: trip.title,
      tripDescription: trip.description,
      tripDestination: trip.destination,
      tripStartDate: trip.startDate,
      tripEndDate: trip.endDate,
      tripPrice: trip.price,
      tripStatus: trip.status,
      tripCoverImage: trip.coverImage,
      tripImages: trip.images,
      tripItinerary: trip.itinerary,
      tripItineraryPdf: trip.itineraryPdf,
      tripSchedule: trip.schedule,
      tripCapacity: trip.capacity,
      tripParticipantCount: trip.participants.length,
      organizer: { name: trip.organizerId.name, phone: trip.organizerId.phone, email: trip.organizerId.email },
      mainBooker: { name: (booking.mainBookerId as any).name, email: (booking.mainBookerId as any).email, phone: (booking.mainBookerId as any).phone },
      participants: booking.participants,
      numberOfGuests: booking.numberOfGuests,
      totalAmount: booking.finalAmount,
      pricePerPerson: booking.pricePerPerson,
      selectedPackage: booking.packageName,
      paymentMethod: booking.paymentMethod,
      paymentStatus: booking.paymentStatus,
      paymentVerificationStatus: booking.paymentVerificationStatus,
      paymentVerificationNotes: (booking as any).paymentVerificationNotes,
      paymentScreenshot: (booking as any).paymentScreenshot,
      bookingStatus: booking.bookingStatus,
      specialRequests: booking.specialRequests,
      createdAt: booking.createdAt,
      updatedAt: booking.updatedAt
    },
    userPermissions: { isBookingOwner, isOrganizer, isAdmin }
  };
}

// ─── Get booking for payment verification ────────────────────────────────────

export async function getBookingForPaymentVerification(bookingId: string, userId: string): Promise<any> {
  if (!bookingId) {
    throw Object.assign(new Error('Invalid booking id'), { status: 400 });
  }

  const booking = await loadBookingWithRefs(bookingId, {
    trip: true, mainBooker: true, organizer: true, verifier: true
  });

  if (!booking) throw Object.assign(new Error('Booking not found'), { status: 404 });

  const user = await User.findById(userId);
  const trip = booking.tripId as any;

  const isBookingOwner = (booking.mainBookerId as any)._id.toString() === userId;
  const isOrganizer = trip.organizerId.toString() === userId;
  const isAdmin = user?.role === 'admin';

  if (!isBookingOwner && !isOrganizer && !isAdmin) {
    throw Object.assign(new Error('You do not have permission to view this booking'), { status: 403 });
  }

  return {
    booking: {
      _id: booking._id,
      tripTitle: trip.title,
      tripDestination: trip.destination,
      mainBooker: { name: (booking.mainBookerId as any).name, email: (booking.mainBookerId as any).email, phone: (booking.mainBookerId as any).phone },
      participants: booking.participants,
      numberOfGuests: booking.numberOfGuests,
      totalAmount: booking.finalAmount,
      pricePerPerson: booking.pricePerPerson,
      selectedPackage: booking.packageName,
      paymentMethod: booking.paymentMethod,
      paymentStatus: booking.paymentStatus,
      paymentVerificationStatus: booking.paymentVerificationStatus,
      paymentVerificationNotes: (booking as any).paymentVerificationNotes,
      paymentScreenshot: (booking as any).paymentScreenshot,
      bookingStatus: booking.bookingStatus,
      specialRequests: booking.specialRequests,
      createdAt: booking.createdAt,
      updatedAt: booking.updatedAt,
      verifiedBy: (booking as any).verifiedBy,
      verifiedAt: (booking as any).verifiedAt
    },
    userPermissions: { isBookingOwner, isOrganizer, isAdmin, canVerifyPayment: isOrganizer || isAdmin }
  };
}

// ─── Verify payment ───────────────────────────────────────────────────────────

export async function verifyPayment(bookingId: string, userId: string, status: string, notes: string): Promise<any> {
  // Written as two comparisons rather than an array includes so TypeScript
  // narrows `status` to the two values the column accepts. `includes` on a
  // string[] proves nothing to the compiler, which is how a value outside the
  // enum could have reached the database in the first place.
  if (status !== 'verified' && status !== 'rejected') {
    throw Object.assign(new Error('Invalid verification status'), { status: 400 });
  }

  if (!bookingId) {
    throw Object.assign(new Error('Invalid booking id'), { status: 400 });
  }

  const booking = await loadBookingWithRefs(bookingId, { trip: true });

  if (!booking) throw Object.assign(new Error('Booking not found'), { status: 404 });

  const user = await User.findById(userId);
  const trip = booking.tripId as any;

  const isOrganizer = trip.organizerRef === userId;
  const isAdmin = user?.role === 'admin';

  if (!isOrganizer && !isAdmin) {
    throw Object.assign(new Error('You do not have permission to verify payments'), { status: 403 });
  }

  const verifiedNow = status === 'verified';

  await prisma.groupBooking.update({
    where: { id: bookingId },
    data: {
      paymentVerificationStatus: status,
      paymentVerificationNotes: notes || '',
      verifiedBy: userId,
      verifiedAt: new Date(),
      ...(verifiedNow ? { paymentStatus: 'completed' as const, bookingStatus: 'confirmed' as const } : {})
    }
  });

  if (verifiedNow) {
    booking.paymentStatus = 'completed';
    booking.bookingStatus = 'confirmed';

    // `trip.participants.includes(booking.mainBookerId)` compared two ObjectId
    // instances, which are never equal to each other even when they hold the
    // same value - so this guard never fired and every verification appended
    // the same traveller again. Capacity is measured against that list, so a
    // trip sold out early. addPaidParticipant is refused by the unique
    // constraint instead of guarded by a comparison that could not work.
    await addPaidParticipant(booking.tripId?.id ?? booking.tripRef, booking.mainBookerRef);

    const [mainBooker, organizer] = await Promise.all([
      User.findById(booking.mainBookerRef).select('name email phone').lean(),
      User.findById(trip.organizerRef).select('name email phone').lean()
    ]);

    if (emailService.isServiceReady() && mainBooker && organizer) {
      emailService.sendBookingConfirmation({
        userName: mainBooker.name,
        userEmail: mainBooker.email,
        tripTitle: trip.title,
        tripDestination: trip.destination,
        startDate: new Date(trip.startDate).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }),
        endDate: new Date(trip.endDate).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }),
        totalTravelers: booking.numberOfGuests,
        totalAmount: booking.finalAmount,
        organizerName: organizer.name,
        organizerEmail: organizer.email,
        organizerPhone: organizer.phone || '',
        bookingId: bookingId
      }).catch((error: any) => {
        logger.error('Failed to send payment verification email', { error: error.message });
      });
    }

    if (mainBooker) {
      sendBookingConfirmationNotifications({
        bookingId: String(booking._id),
        userName: mainBooker.name,
        userEmail: mainBooker.email,
        userPhone: mainBooker.phone,
        tripTitle: trip.title,
        tripDestination: trip.destination,
        tripStartDate: trip.startDate,
        totalAmount: booking.finalAmount
      }).catch((notifyError: any) => {
        logger.error('Failed to send booking confirmation notifications', {
          bookingId: String(booking._id),
          error: notifyError?.message
        });
      });
    }
  } else if (status === 'rejected') {
    booking.paymentStatus = 'failed';
    booking.bookingStatus = 'cancelled';
    await prisma.groupBooking.update({
      where: { id: bookingId },
      data: { paymentStatus: 'failed', bookingStatus: 'cancelled' }
    });
  }

  return booking;
}

// ─── Get booking by ID ────────────────────────────────────────────────────────

export async function getBookingById(bookingId: string, userId: string): Promise<any> {
  if (!bookingId) {
    throw Object.assign(new Error('Invalid booking id'), { status: 400 });
  }

  const booking = await loadBookingWithRefs(bookingId, { trip: true });
  if (!booking) throw Object.assign(new Error('Booking not found'), { status: 404 });

  if (booking.mainBookerRef !== userId) {
    throw Object.assign(new Error('You do not have permission to view this booking'), { status: 403 });
  }

  return booking;
}

// ─── Update booking ───────────────────────────────────────────────────────────

export async function updateBooking(bookingId: string, userId: string, specialRequests?: string): Promise<any> {
  if (!bookingId) {
    throw Object.assign(new Error('Invalid booking id'), { status: 400 });
  }

  const booking = await loadBookingWithRefs(bookingId, {});
  if (!booking) throw Object.assign(new Error('Booking not found'), { status: 404 });

  if (booking.mainBookerRef !== userId) {
    throw Object.assign(new Error('You do not have permission to update this booking'), { status: 403 });
  }

  if (!specialRequests) return booking;

  return shapeBooking(await prisma.groupBooking.update({
    where: { id: bookingId },
    data: { specialRequests: String(specialRequests) },
    include: bookingInclude
  }));
}

// ─── Cancel booking ───────────────────────────────────────────────────────────

export async function cancelBooking(bookingId: string, userId: string): Promise<any> {
  if (!bookingId) {
    throw Object.assign(new Error('Invalid booking id'), { status: 400 });
  }

  const booking = await loadBookingWithRefs(bookingId, {});
  if (!booking) throw Object.assign(new Error('Booking not found'), { status: 404 });

  if (booking.mainBookerRef !== userId) {
    throw Object.assign(new Error('You do not have permission to cancel this booking'), { status: 403 });
  }

  // .save() on a plain object was the 500 here: loadBookingWithRefs returns the
  // shaped row, not a Mongoose document, so there was nothing to save.
  return shapeBooking(await prisma.groupBooking.update({
    where: { id: bookingId },
    data: { bookingStatus: 'cancelled' },
    include: bookingInclude
  }));
}
