/**
 * Trips Service
 *
 * All business logic extracted from routes/trips.ts.
 * No req/res objects — pure data in, data out.
 */

import mongoose from 'mongoose';
import { z } from 'zod';
import { Trip } from '../../models/Trip';
import { User } from '../../models/User';
import { OrganizerSubscription } from '../../models/OrganizerSubscription';
import { OrganizerPayoutConfig } from '../../models/OrganizerPayoutConfig';
import { paymentConfig, shouldEnableRoutingForOrganizer } from '../../config/payment.config';
import { razorpayRouteService as razorpaySubmerchantService } from '../../services/razorpayRouteService';
import { socketService } from '../../services/socketService';
import { invalidateCache } from '../../utils/cache';
import { logger } from '../../utils/logger';
import { slugify } from '../../utils/slugify';

// ─── Schemas ──────────────────────────────────────────────────────────────────

export const createTripSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  destination: z.string().min(1),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  price: z.number().positive(),
  capacity: z.number().int().positive(),
  categories: z.array(z.string()).min(1),
  images: z.array(z.string()).optional(),
  schedule: z.array(z.object({ day: z.number(), title: z.string(), activities: z.array(z.string()) })).optional(),
  location: z.object({ coordinates: z.tuple([z.number(), z.number()]) }).optional(),
  paymentConfig: z.object({
    paymentType: z.string().optional(),
    paymentMethods: z.array(z.string()).optional(),
    advanceAmount: z.number().optional(),
    collectionMode: z.string().optional(),
    verificationMode: z.string().optional(),
    manualProofRequired: z.boolean().optional(),
    trustLevel: z.string().optional()
  }).optional(),
  itinerary: z.union([z.string(), z.array(z.any())]).optional(),
  coverImage: z.string().optional(),
  itineraryPdf: z.string().optional(),
  minimumAge: z.number().optional()
});

export const updateTripSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  categories: z.array(z.string()).optional(),
  destination: z.string().min(1).optional(),
  location: z.object({ coordinates: z.tuple([z.number(), z.number()]) }).optional(),
  schedule: z.array(z.object({ day: z.number(), title: z.string(), activities: z.array(z.string()).default([]) })).optional(),
  images: z.array(z.string()).optional(),
  capacity: z.number().int().positive().optional(),
  price: z.number().positive().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  itinerary: z.string().optional(),
  coverImage: z.string().optional(),
  itineraryPdf: z.string().optional(),
  status: z.enum(['active', 'cancelled', 'completed']).optional()
});

// ─── Types ────────────────────────────────────────────────────────────────────

export type CreateTripInput = z.infer<typeof createTripSchema>;
export type UpdateTripInput = z.infer<typeof updateTripSchema>;

export interface TripListQuery {
  q?: string;
  category?: string;
  difficulty?: string;
  minPrice?: string;
  maxPrice?: string;
  dest?: string;
  from?: string;
  to?: string;
  limit?: string;
  page?: string;
  status?: string;
}

// ─── Subscription check ───────────────────────────────────────────────────────

export async function checkOrganizerSubscription(organizerId: string): Promise<void> {
  const organizer = await User.findById(organizerId);
  if (!organizer) {
    throw Object.assign(new Error('Organizer not found'), { status: 404 });
  }

  const autoPayEnabled = organizer.organizerProfile?.autoPay?.autoPayEnabled === true;
  if (!autoPayEnabled) {
    throw Object.assign(new Error('AutoPay required'), {
      status: 402,
      body: {
        success: false,
        error: 'AutoPay required',
        message: 'You need to enable AutoPay (Subscription) to create trips and access premium features.',
        requiresAutoPay: true,
        actionUrl: '/organizer/subscription'
      }
    });
  }

  const subscription = await OrganizerSubscription.findOne({
    organizerId: new mongoose.Types.ObjectId(organizerId),
    status: { $in: ['active', 'trial'] }
  }).sort({ createdAt: -1 });

  if (!subscription) {
    throw Object.assign(new Error('Subscription record missing'), {
      status: 402,
      body: {
        success: false,
        error: 'Subscription record missing',
        message: 'Your AutoPay is enabled, but your subscription record is missing. Please contact support.',
        actionUrl: '/organizer/subscription'
      }
    });
  }

  const expiryDate = subscription.subscriptionEndDate || subscription.trialEndDate;
  if (expiryDate && expiryDate < new Date()) {
    throw Object.assign(new Error('Subscription expired'), {
      status: 402,
      body: {
        success: false,
        error: 'Subscription expired',
        message: 'Your subscription has expired. Please renew to continue creating trips.',
        expiredDate: expiryDate,
        requiresRenewal: true,
        actionUrl: '/organizer/subscription'
      }
    });
  }

  const tripsUsed = subscription.tripsUsed || 0;
  const tripsPerCycle = subscription.tripsPerCycle || 5;
  if (tripsUsed >= tripsPerCycle) {
    throw Object.assign(new Error('Trip limit reached'), {
      status: 403,
      body: {
        success: false,
        error: 'Trip limit reached',
        message: `You have reached your plan limit of ${tripsPerCycle} trips. Please upgrade your subscription.`,
        tripsUsed,
        tripsPerCycle,
        requiresUpgrade: true,
        actionUrl: '/organizer/subscription'
      }
    });
  }
}

// ─── QR code check ────────────────────────────────────────────────────────────

export async function checkManualCollectionQR(organizerId: string, collectionMode?: string): Promise<void> {
  if (collectionMode !== 'manual') return;
  const organizer = await User.findById(organizerId);
  if (!organizer) throw Object.assign(new Error('Organizer not found'), { status: 404 });

  const qrCodes = organizer.organizerProfile?.qrCodes || [];
  const activeQRCodes = qrCodes.filter((qr: any) => qr.isActive !== false);
  if (activeQRCodes.length === 0) {
    throw Object.assign(new Error('Payment QR code required'), {
      status: 400,
      body: {
        success: false,
        error: 'Payment QR code required',
        message: 'Manual collection selected. Please upload at least one payment QR code or switch to automated Razorpay collection.',
        actionRequired: 'upload_qr_code'
      }
    });
  }
}

// ─── Create trip ──────────────────────────────────────────────────────────────

export async function createTrip(body: CreateTripInput, organizerId: string): Promise<any> {
  // Generate unique slug
  let baseSlug = slugify(body.title);
  if (!baseSlug) baseSlug = `trip-${Date.now()}`;
  let dbSlug = baseSlug;
  let counter = 1;
  while (true) {
    const existing = await Trip.findOne({ slug: dbSlug });
    if (!existing) break;
    dbSlug = `${baseSlug}-${counter}`;
    counter++;
  }

  const createPromise = Trip.create({
    ...body,
    organizerId,
    slug: dbSlug,
    itinerary: Array.isArray(body.itinerary) ? JSON.stringify(body.itinerary) : body.itinerary,
    location: body.location ? { type: 'Point', coordinates: body.location.coordinates } : undefined,
    participants: [],
    createdAt: new Date(),
    updatedAt: new Date()
  });

  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Database operation timeout')), 10000)
  );

  const trip = await Promise.race([createPromise, timeoutPromise]) as any;
  return trip;
}

// ─── Post-create: payment routing ────────────────────────────────────────────

export async function setupPaymentRouting(trip: any, organizerId: string, tripTitle: string): Promise<void> {
  try {
    const organizer = await User.findById(organizerId);
    if (!organizer) {
      logger.warn('Organizer not found for route creation', { organizerId });
      return;
    }

    const trustScore = organizer.organizerProfile?.trustScore?.overall || 0;
    const routingEnabledForOrganizer = organizer.organizerProfile?.routingEnabled || false;
    const shouldEnableRouting = shouldEnableRoutingForOrganizer(trustScore, routingEnabledForOrganizer);

    if (shouldEnableRouting && razorpaySubmerchantService && razorpaySubmerchantService.generateQRCode) {
      let payoutConfig = await OrganizerPayoutConfig.findOne({ organizerId });

      if (!payoutConfig || !payoutConfig.razorpayAccountId) {
        trip.paymentRoutingStatus = 'pending_onboarding';
        await trip.save();
      } else {
        try {
          const qrResult = await razorpaySubmerchantService.generateQRCode(
            payoutConfig.razorpayAccountId,
            `${organizer.name} - ${tripTitle}`,
            `Payment for ${tripTitle} trip by ${organizer.name}`
          );

          if (!organizer.organizerProfile) organizer.organizerProfile = {};
          if (!organizer.organizerProfile.qrCodes) organizer.organizerProfile.qrCodes = [];

          organizer.organizerProfile.qrCodes.push({
            filename: `qr-${trip._id}.png`,
            originalName: `trip-${trip._id}-qr.png`,
            path: qrResult.imageUrl,
            paymentMethod: 'upi',
            description: `Razorpay QR for trip: ${tripTitle}`,
            uploadedAt: new Date(),
            isActive: true
          });

          trip.paymentQR = qrResult.imageUrl;
          trip.paymentRoutingStatus = 'active';
          trip.paymentRouteId = qrResult.qrCodeId;
          await trip.save();
          await organizer.save();
        } catch (qrError: any) {
          logger.error('Failed to generate Razorpay QR code', { tripId: trip._id, error: qrError.message });
          trip.paymentRoutingStatus = 'main_account_fallback';
          await trip.save();
        }
      }
    } else {
      trip.paymentRoutingStatus = 'main_account';
      trip.useMainRazorpayAccount = true;
      await trip.save();
    }
  } catch (routeError: any) {
    logger.error('Failed to process payment routing', { tripId: trip._id, organizerId, error: routeError.message });
    trip.paymentRoutingStatus = 'error';
    await trip.save();
  }
}

// ─── Increment subscription trip count ───────────────────────────────────────

export async function incrementSubscriptionTripCount(organizerId: string): Promise<void> {
  try {
    const subscription = await OrganizerSubscription.findOne({
      organizerId: new mongoose.Types.ObjectId(organizerId),
      status: { $in: ['active', 'trial'] }
    }).sort({ createdAt: -1 });

    if (subscription) {
      subscription.tripsUsed = (subscription.tripsUsed || 0) + 1;
      subscription.updatedAt = new Date();
      await subscription.save();
    }
  } catch (error: any) {
    logger.error('Failed to increment trip count', { organizerId, error: error.message });
  }
}

// ─── List trips ───────────────────────────────────────────────────────────────

export async function listTrips(query: TripListQuery) {
  const { q, category, difficulty, minPrice, maxPrice, dest, from, to, limit = '20', page = '1', status } = query;

  const filter: any = {};
  const statusQuery = status?.toLowerCase();

  if (statusQuery === 'completed') {
    filter.status = 'completed';
  } else if (statusQuery === 'all') {
    filter.status = { $in: ['pending', 'active', 'completed', 'cancelled'] };
  } else {
    filter.status = 'active';
  }

  if (q) filter.$text = { $search: q };
  if (category) filter.categories = category;
  if (difficulty) filter.difficulty = difficulty;
  if (dest) filter.destination = dest;
  if (minPrice || maxPrice) filter.price = { ...(minPrice ? { $gte: Number(minPrice) } : {}), ...(maxPrice ? { $lte: Number(maxPrice) } : {}) };
  if (from || to) filter.startDate = { ...(from ? { $gte: new Date(from) } : {}), ...(to ? { $lte: new Date(to) } : {}) };

  const pageNum = parseInt(page) || 1;
  const limitNum = Math.min(parseInt(limit) || 20, 50);
  const skip = (pageNum - 1) * limitNum;

  const [trips, total] = await Promise.all([
    Trip.find(filter)
      .select('title destination price startDate endDate coverImage difficulty categories capacity participants status averageRating reviewCount')
      .populate({ path: 'organizerId', select: 'name profilePhoto', options: { lean: true } })
      .lean()
      .skip(skip)
      .limit(limitNum)
      .sort({ createdAt: -1 }),
    Trip.countDocuments(filter)
  ]);

  const tripsWithCategory = trips.map((t: any) => {
    if (!t.category) {
      t.category = Array.isArray(t.categories) && t.categories.length > 0 ? t.categories[0] : 'Adventure';
    }
    return t;
  });

  return { trips: tripsWithCategory, total, pageNum, limitNum };
}

// ─── Get trip by ID ───────────────────────────────────────────────────────────

export async function getTripById(id: string): Promise<any> {
  if (!id || !mongoose.isValidObjectId(id)) {
    throw Object.assign(new Error('Invalid trip id'), { status: 400 });
  }

  const trip = await Trip.findById(id)
    .populate({
      path: 'organizerId',
      select: 'name profilePhoto organizerProfile.bio organizerProfile.yearsOfExperience organizerProfile.totalTripsOrganized',
      options: { lean: true }
    })
    .lean();

  if (!trip) throw Object.assign(new Error('Not found'), { status: 404 });

  const tripObj = trip as any;
  if (!tripObj.category) {
    tripObj.category = Array.isArray(tripObj.categories) && tripObj.categories.length > 0 ? tripObj.categories[0] : 'Adventure';
  }
  return tripObj;
}

// ─── Get trip by slug ─────────────────────────────────────────────────────────

export async function getTripBySlug(slug: string): Promise<any> {
  if (!slug) throw Object.assign(new Error('Slug required'), { status: 400 });

  const trip = await Trip.findOne({ slug }).populate('organizerId', 'name organizerProfile').lean();
  if (!trip) throw Object.assign(new Error('Trip not found'), { status: 404 });

  const tripObj = trip as any;
  if (!tripObj.category) {
    tripObj.category = Array.isArray(tripObj.categories) && tripObj.categories.length > 0 ? tripObj.categories[0] : 'Adventure';
  }
  return tripObj;
}

// ─── Join trip ────────────────────────────────────────────────────────────────

export async function joinTrip(tripId: string, userId: string): Promise<any> {
  if (!tripId || !mongoose.isValidObjectId(tripId)) {
    throw Object.assign(new Error('Invalid trip id'), { status: 400 });
  }

  const trip = await Trip.findById(tripId);
  if (!trip) throw Object.assign(new Error('Trip not found'), { status: 404 });
  if (trip.participants.length >= trip.capacity) throw Object.assign(new Error('Trip is full'), { status: 400 });
  if ((trip.participants as any[]).includes(userId)) throw Object.assign(new Error('Already joined this trip'), { status: 400 });

  (trip.participants as any[]).push(userId);
  await trip.save();
  await invalidateCache('/trips');
  return trip;
}

// ─── Leave trip ───────────────────────────────────────────────────────────────

export async function leaveTrip(tripId: string, userId: string): Promise<any> {
  if (!tripId || !mongoose.isValidObjectId(tripId)) {
    throw Object.assign(new Error('Invalid trip id'), { status: 400 });
  }

  const trip = await Trip.findById(tripId);
  if (!trip) throw Object.assign(new Error('Trip not found'), { status: 404 });
  if (!(trip.participants as any[]).includes(userId)) throw Object.assign(new Error('Not part of this trip'), { status: 400 });

  trip.participants = (trip.participants as any[]).filter((id: any) => id.toString() !== userId) as any;
  await trip.save();
  await invalidateCache('/trips');
  return trip;
}

// ─── Update trip ──────────────────────────────────────────────────────────────

export async function updateTrip(tripId: string, userId: string, userRole: string, updateData: UpdateTripInput): Promise<any> {
  if (!tripId || !mongoose.isValidObjectId(tripId)) {
    throw Object.assign(new Error('Invalid trip id'), { status: 400 });
  }

  const trip = await Trip.findById(tripId);
  if (!trip) throw Object.assign(new Error('Trip not found'), { status: 404 });

  if (trip.organizerId.toString() !== userId && userRole !== 'admin') {
    throw Object.assign(new Error('Not authorized to update this trip'), { status: 403 });
  }

  const data: any = { ...updateData };
  if (data.location) {
    data.location = { type: 'Point', coordinates: data.location.coordinates };
  }

  const updatedTrip = await Trip.findByIdAndUpdate(tripId, data, { new: true, runValidators: true });
  await invalidateCache('/trips');
  return updatedTrip;
}

// ─── Delete trip ──────────────────────────────────────────────────────────────

export async function deleteTrip(tripId: string, userId: string, userRole: string): Promise<void> {
  if (!tripId || !mongoose.isValidObjectId(tripId)) {
    throw Object.assign(new Error('Invalid trip id'), { status: 400 });
  }

  const trip = await Trip.findById(tripId);
  if (!trip) throw Object.assign(new Error('Trip not found'), { status: 404 });

  if (trip.organizerId.toString() !== userId && userRole !== 'admin') {
    throw Object.assign(new Error('Not authorized to delete this trip'), { status: 403 });
  }

  await Trip.findByIdAndDelete(tripId);
  await invalidateCache('/trips');
}
