/**
 * Bookings Service
 *
 * All business logic extracted from routes/bookings.ts.
 * No req/res objects — pure data in, data out.
 */

import mongoose from 'mongoose';
import { z } from 'zod';
import { Trip } from '../../models/Trip';
import { User } from '../../models/User';
import { GroupBooking } from '../../models/GroupBooking';
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

  if (!tripId || !mongoose.isValidObjectId(tripId)) {
    throw Object.assign(new Error('Invalid trip id'), { status: 400 });
  }

  const trip = await Trip.findById(tripId).populate('organizerId', 'name phone email');
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

  // Check availability
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
    const existingBooking = await GroupBooking.findOne({
      tripId,
      mainBookerId: userId,
      bookingStatus: { $in: ['pending', 'confirmed'] }
    });
    if (existingBooking) {
      throw Object.assign(new Error('You already have a booking for this trip'), {
        status: 400,
        body: {
          error: 'You already have a booking for this trip',
          details: { existingBookingId: existingBooking._id, existingStatus: existingBooking.bookingStatus }
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

  const totalAmount = pricePerPerson * numberOfTravelers;
  const finalAmount = totalAmount;

  const groupBooking = new GroupBooking({
    tripId,
    mainBookerId: userId,
    participants,
    numberOfGuests: numberOfTravelers,
    totalParticipants: numberOfTravelers,
    selectedPackageId: selectedPackage?.id,
    packageName: selectedPackage?.name,
    pricePerPerson,
    totalAmount,
    finalAmount,
    paymentMethod: 'bank_transfer',
    bookingStatus: 'pending',
    paymentVerificationStatus: 'pending',
    specialRequests
  });

  await groupBooking.save();

  logger.info('New booking created with pending status', { bookingId: groupBooking._id, tripId, userId, numberOfTravelers });

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
      bookingId: groupBooking._id.toString()
    }).catch((error: any) => {
      logger.error('❌ Failed to send booking confirmation email', { error: error.message, bookingId: groupBooking._id });
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
      logger.error('Failed to track partial booking', { error: err.message, bookingId: groupBooking._id });
    });
  }

  return { groupBooking, pricePerPerson };
}

// ─── Get user bookings ────────────────────────────────────────────────────────

export async function getUserBookings(userId: string): Promise<any[]> {
  const groupBookings = await GroupBooking.find({ mainBookerId: userId })
    .populate({
      path: 'tripId',
      select: 'title destination startDate endDate coverImage organizerId status',
      populate: { path: 'organizerId', select: 'name phone email' }
    })
    .sort({ createdAt: -1 });

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
  const groupBookings = await GroupBooking.find({ mainBookerId: userId })
    .populate({
      path: 'tripId',
      select: 'title destination startDate endDate coverImage organizerId status',
      populate: { path: 'organizerId', select: 'name phone email' }
    })
    .sort({ createdAt: -1 });

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
  if (!tripId || !mongoose.isValidObjectId(tripId)) {
    throw Object.assign(new Error('Invalid trip id'), { status: 400 });
  }

  const trip = await Trip.findById(tripId);
  if (!trip) throw Object.assign(new Error('Trip not found'), { status: 404 });

  if (!(trip.participants as any[]).includes(userId)) {
    throw Object.assign(new Error('You are not booked for this trip'), { status: 400 });
  }

  const hoursUntilTrip = (new Date(trip.startDate).getTime() - Date.now()) / (1000 * 60 * 60);
  if (hoursUntilTrip < 48) {
    throw Object.assign(new Error('Cannot cancel booking within 48 hours of trip start time'), { status: 400 });
  }

  trip.participants = (trip.participants as any[]).filter((id: any) => id.toString() !== userId) as any;
  await trip.save();
}

// ─── Get booking details by trip ID ──────────────────────────────────────────

export async function getBookingDetailsByTripId(tripId: string, userId: string): Promise<any> {
  if (!tripId || !mongoose.isValidObjectId(tripId)) {
    throw Object.assign(new Error('Invalid trip id'), { status: 400 });
  }

  const trip = await Trip.findById(tripId).populate('organizerId', 'name phone email');
  if (!trip) throw Object.assign(new Error('Trip not found'), { status: 404 });

  if (!(trip.participants as any[]).includes(userId)) {
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

  const booking = await GroupBooking.findById(bookingId);
  if (!booking) throw Object.assign(new Error('Booking not found'), { status: 404 });

  if (booking.mainBookerId.toString() !== userId) {
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

  (booking as any).paymentScreenshot = {
    filename: screenshotData.filename,
    originalName: screenshotData.originalName,
    url: screenshotData.url,
    uploadedAt: new Date()
  };
  booking.paymentStatus = 'partial';
  await booking.save();

  // Notify organizer via email
  const trip = await Trip.findById(booking.tripId);
  const traveler = await User.findById(userId);
  const organizer = trip ? await User.findById(trip.organizerId) : null;

  if (trip && traveler && organizer && organizer.email) {
    emailService.sendPaymentScreenshotNotification({
      travelerName: traveler.name,
      travelerEmail: traveler.email,
      tripTitle: trip.title,
      bookingId: booking._id.toString(),
      totalAmount: booking.totalAmount,
      organizerName: organizer.name,
      organizerEmail: organizer.email,
      screenshotUrl: (booking as any).paymentScreenshot.url
    }).catch((emailError: any) => {
      logger.error('Failed to send payment screenshot notification email', { error: emailError.message, organizerEmail: organizer.email, bookingId });
    });
  }

  return booking;
}

// ─── Get booking details ──────────────────────────────────────────────────────

export async function getBookingDetails(bookingId: string, userId: string): Promise<any> {
  const booking = await GroupBooking.findById(bookingId)
    .populate({
      path: 'tripId',
      select: 'title description destination startDate endDate price status coverImage images itinerary itineraryPdf schedule organizerId capacity participants',
      populate: { path: 'organizerId', select: 'name phone email' }
    })
    .populate('mainBookerId', 'name email phone');

  if (!booking) throw Object.assign(new Error('Booking not found'), { status: 404 });

  const user = await User.findById(userId);
  const trip = booking.tripId as any;

  const isBookingOwner = (booking.mainBookerId as any)._id.toString() === userId;
  const isOrganizer = trip.organizerId._id.toString() === userId;
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
  if (!bookingId || !mongoose.isValidObjectId(bookingId)) {
    throw Object.assign(new Error('Invalid booking id'), { status: 400 });
  }

  const booking = await GroupBooking.findById(bookingId)
    .populate('tripId', 'title destination organizerId')
    .populate('mainBookerId', 'name email phone')
    .populate('verifiedBy', 'name email');

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
  if (!['verified', 'rejected'].includes(status)) {
    throw Object.assign(new Error('Invalid verification status'), { status: 400 });
  }

  if (!bookingId || !mongoose.isValidObjectId(bookingId)) {
    throw Object.assign(new Error('Invalid booking id'), { status: 400 });
  }

  const booking = await GroupBooking.findById(bookingId)
    .populate('tripId', 'title organizerId participants capacity');

  if (!booking) throw Object.assign(new Error('Booking not found'), { status: 404 });

  const user = await User.findById(userId);
  const trip = booking.tripId as any;

  const isOrganizer = trip.organizerId.toString() === userId;
  const isAdmin = user?.role === 'admin';

  if (!isOrganizer && !isAdmin) {
    throw Object.assign(new Error('You do not have permission to verify payments'), { status: 403 });
  }

  (booking as any).paymentVerificationStatus = status;
  (booking as any).paymentVerificationNotes = notes || '';
  (booking as any).verifiedBy = userId;
  (booking as any).verifiedAt = new Date();

  if (status === 'verified') {
    booking.paymentStatus = 'completed';
    booking.bookingStatus = 'confirmed';

    if (!(trip.participants as any[]).includes(booking.mainBookerId)) {
      (trip.participants as any[]).push(booking.mainBookerId);
      await trip.save();
    }

    const [mainBooker, organizer] = await Promise.all([
      User.findById(booking.mainBookerId).select('name email phone').lean(),
      User.findById(trip.organizerId).select('name email phone').lean()
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
        bookingId: booking._id.toString()
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
  }

  await booking.save();
  return booking;
}

// ─── Get booking by ID ────────────────────────────────────────────────────────

export async function getBookingById(bookingId: string, userId: string): Promise<any> {
  if (!bookingId || !mongoose.isValidObjectId(bookingId)) {
    throw Object.assign(new Error('Invalid booking id'), { status: 400 });
  }

  const booking = await GroupBooking.findById(bookingId).lean();
  if (!booking) throw Object.assign(new Error('Booking not found'), { status: 404 });

  if ((booking as any).mainBookerId.toString() !== userId) {
    throw Object.assign(new Error('You do not have permission to view this booking'), { status: 403 });
  }

  return booking;
}

// ─── Update booking ───────────────────────────────────────────────────────────

export async function updateBooking(bookingId: string, userId: string, specialRequests?: string): Promise<any> {
  if (!bookingId || !mongoose.isValidObjectId(bookingId)) {
    throw Object.assign(new Error('Invalid booking id'), { status: 400 });
  }

  const booking = await GroupBooking.findById(bookingId);
  if (!booking) throw Object.assign(new Error('Booking not found'), { status: 404 });

  if (!booking.mainBookerId || booking.mainBookerId.toString() !== userId) {
    throw Object.assign(new Error('You do not have permission to update this booking'), { status: 403 });
  }

  if (specialRequests) {
    booking.specialRequests = String(specialRequests);
  }

  await booking.save();
  return booking.toObject();
}

// ─── Cancel booking ───────────────────────────────────────────────────────────

export async function cancelBooking(bookingId: string, userId: string): Promise<any> {
  if (!bookingId || !mongoose.isValidObjectId(bookingId)) {
    throw Object.assign(new Error('Invalid booking id'), { status: 400 });
  }

  const booking = await GroupBooking.findById(bookingId);
  if (!booking) throw Object.assign(new Error('Booking not found'), { status: 404 });

  if (!booking.mainBookerId || booking.mainBookerId.toString() !== userId) {
    throw Object.assign(new Error('You do not have permission to cancel this booking'), { status: 403 });
  }

  booking.bookingStatus = 'cancelled';
  await booking.save();
  return booking.toObject();
}
