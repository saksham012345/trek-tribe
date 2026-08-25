/**
 * Trips Service
 *
 * All business logic extracted from routes/trips.ts.
 * No req/res objects — pure data in, data out.
 */

import mongoose from 'mongoose';
import { z } from 'zod';
import {
  shapeTrip,
  shapeTrips,
  tripInclude,
  createTripWithChildren,
  updateTripWithChildren
} from '../../services/tripShapeService';
import {
  joinTrip as joinTripRow,
  leaveTrip as leaveTripRow,
  TripFullError
} from '../../services/tripParticipationService';
import { User } from '../../models/User';
import { prisma } from '../../lib/prisma';
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

  // organizerId is unique on this table, so the sort had a single row to order.
  const subscription = await prisma.organizerSubscription.findFirst({
    where: { organizerId, status: { in: ['active', 'trial'] } }
  });

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
  // Generate a unique slug.
  //
  // The loop this replaces asked "does this slug exist?" and then inserted,
  // which two organizers publishing similarly titled trips at the same moment
  // both pass. slug is unique in the database, so the second insert is refused
  // and the retry picks the next suffix - the check is still there to get the
  // common case right on the first try, and the constraint is what makes it
  // correct.
  let baseSlug = slugify(body.title);
  if (!baseSlug) baseSlug = `trip-${Date.now()}`;

  let counter = 0;
  for (;;) {
    const dbSlug = counter === 0 ? baseSlug : `${baseSlug}-${counter}`;
    const taken = await prisma.trip.findUnique({ where: { slug: dbSlug }, select: { id: true } });

    if (!taken) {
      try {
        const trip = await createTripWithChildren(organizerId, {
          ...body,
          slug: dbSlug,
          itinerary: Array.isArray(body.itinerary) ? JSON.stringify(body.itinerary) : body.itinerary
        });
        return shapeTrip(trip as any);
      } catch (error: any) {
        // Someone else took the slug between the check and the insert.
        if (error?.code !== 'P2002') throw error;
      }
    }

    counter++;
    if (counter > 50) {
      throw Object.assign(new Error('Could not generate a unique slug for this trip'), { status: 409 });
    }
  }

  // The 10-second Promise.race timeout is gone. It did not cancel the insert -
  // nothing about losing a race stops the query - so a slow create still
  // completed, after the caller had been told it had failed. A trip could
  // therefore exist that the organizer had been told was not created.
}

// ─── Post-create: payment routing ────────────────────────────────────────────

/**
 * Record the routing outcome on the trip.
 *
 * Every assignment this replaces - paymentRoutingStatus, paymentQR,
 * paymentRouteId, useMainRazorpayAccount - set a field that is not in the
 * Mongoose schema, and Mongoose in strict mode drops unknown paths on save. The
 * routing state machine has been writing into nothing since it was written.
 * Nothing reads these, which is why it was never noticed. They are columns now.
 */
async function setRoutingStatus(tripId: string, data: any): Promise<void> {
  await prisma.trip.update({ where: { id: tripId }, data });
}

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
      let payoutConfig = await prisma.organizerPayoutConfig.findUnique({ where: { organizerId } });

      if (!payoutConfig || !payoutConfig.razorpayAccountId) {
        await setRoutingStatus(trip.id, { paymentRoutingStatus: 'pending_onboarding' });
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
            filename: `qr-${trip.id}.png`,
            originalName: `trip-${trip.id}-qr.png`,
            path: qrResult.imageUrl,
            paymentMethod: 'upi',
            description: `Razorpay QR for trip: ${tripTitle}`,
            uploadedAt: new Date(),
            isActive: true
          });

          await setRoutingStatus(trip.id, {
            paymentQrUrl: qrResult.imageUrl,
            paymentRoutingStatus: 'active',
            paymentRouteId: qrResult.qrCodeId
          });
          await organizer.save();
        } catch (qrError: any) {
          logger.error('Failed to generate Razorpay QR code', { tripId: trip.id, error: qrError.message });
          await setRoutingStatus(trip.id, { paymentRoutingStatus: 'main_account_fallback' });
        }
      }
    } else {
      await setRoutingStatus(trip.id, {
        paymentRoutingStatus: 'main_account',
        useMainRazorpayAccount: true
      });
    }
  } catch (routeError: any) {
    logger.error('Failed to process payment routing', { tripId: trip.id, organizerId, error: routeError.message });
    await setRoutingStatus(trip.id, { paymentRoutingStatus: 'error' });
  }
}

// ─── Increment subscription trip count ───────────────────────────────────────

// This is the second path that spends a trip slot - the first is the
// useSubscriptionSlot middleware. Neither knew about the other, and this one
// incremented without checking the cycle limit at all, so an organizer on a
// 5-trip plan could reach tripsUsed of 7 and nobody would hear about it.
//
// The increment is guarded here the same way, by the database, and a refusal is
// logged as the real condition rather than swallowed as a generic error.
export async function incrementSubscriptionTripCount(organizerId: string): Promise<void> {
  try {
    const subscription = await prisma.organizerSubscription.findFirst({
      where: { organizerId, status: { in: ['active', 'trial'] } }
    });

    if (!subscription) return;

    const updated = await prisma.$queryRaw<Array<{ trips_used: number }>>`
      UPDATE organizer_subscriptions
         SET trips_used = trips_used + 1, updated_at = now()
       WHERE id = ${subscription.id}
         AND trips_used < trips_per_cycle
      RETURNING trips_used
    `;

    if (updated.length === 0) {
      logger.warn('Trip created but the subscription cycle has no slots left', {
        organizerId,
        subscriptionId: subscription.id,
        tripsUsed: subscription.tripsUsed,
        tripsPerCycle: subscription.tripsPerCycle
      });
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
    filter.status = { in: ['pending', 'active', 'completed', 'cancelled'] };
  } else {
    filter.status = 'active';
  }

  // categories is a string array; `filter.categories = category` was Mongo's
  // "array contains" and `has` is the same thing.
  if (category) filter.categories = { has: category };
  if (difficulty) filter.difficulty = difficulty;
  if (dest) filter.destination = dest;
  if (minPrice || maxPrice) {
    filter.price = {
      ...(minPrice ? { gte: Number(minPrice) } : {}),
      ...(maxPrice ? { lte: Number(maxPrice) } : {})
    };
  }
  if (from || to) {
    filter.startDate = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {})
    };
  }

  // $text became a GIN index over title, description and destination, the same
  // three fields Mongo's text index covered. Prisma cannot express a tsquery,
  // so the matching ids come from raw SQL and then join the rest of the filter.
  //
  // The id list is capped, so a search matching more than the cap loses the
  // tail. That is a real limit and it is here because the alternative - writing
  // the whole query, filters, pagination and count in SQL - trades a bounded
  // problem for an unbounded one. Production holds one trip; when it holds
  // enough for the cap to bite, this should become a single SQL query.
  if (q) {
    const matches = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM trips
       WHERE to_tsvector(
               'english'::regconfig,
               coalesce(title,'') || ' ' || coalesce(description,'') || ' ' || coalesce(destination,'')
             ) @@ plainto_tsquery('english', ${q})
       LIMIT 1000
    `;
    filter.id = { in: matches.map(m => m.id) };
  }

  const pageNum = parseInt(page) || 1;
  const limitNum = Math.min(parseInt(limit) || 20, 50);
  const skip = (pageNum - 1) * limitNum;

  const [rows, total] = await Promise.all([
    prisma.trip.findMany({
      where: filter,
      // participants is a count for this view, not the list - the select this
      // replaces pulled the whole array so the client could read .length.
      include: { participants: { select: { userId: true } } },
      skip,
      take: limitNum,
      orderBy: { createdAt: 'desc' }
    }),
    prisma.trip.count({ where: filter })
  ]);

  const organizers = await organizerMap(rows.map(r => r.organizerId), 'name profilePhoto');

  const tripsWithCategory = rows.map((row: any) => {
    const trip = shapeTrip(row);
    trip.organizerId = organizers.get(row.organizerId) ?? row.organizerId;
    if (!trip.category) {
      trip.category = Array.isArray(trip.categories) && trip.categories.length > 0 ? trip.categories[0] : 'Adventure';
    }
    return trip;
  });

  return { trips: tripsWithCategory, total, pageNum, limitNum };
}

// ─── Get trip by ID ───────────────────────────────────────────────────────────

export async function getTripById(id: string): Promise<any> {
  // isValidObjectId is gone: trip ids are generated uuid strings now, and that
  // check would reject every real one.
  if (!id) {
    throw Object.assign(new Error('Invalid trip id'), { status: 400 });
  }

  const row = await prisma.trip.findUnique({ where: { id }, include: tripInclude });

  if (!row) throw Object.assign(new Error('Not found'), { status: 404 });

  const organizers = await organizerMap(
    [row.organizerId],
    'name profilePhoto organizerProfile.bio organizerProfile.yearsOfExperience organizerProfile.totalTripsOrganized'
  );

  const tripObj = shapeTrip(row);
  tripObj.organizerId = organizers.get(row.organizerId) ?? row.organizerId;
  if (!tripObj.category) {
    tripObj.category = Array.isArray(tripObj.categories) && tripObj.categories.length > 0 ? tripObj.categories[0] : 'Adventure';
  }
  return tripObj;
}

// ─── Get trip by slug ─────────────────────────────────────────────────────────

export async function getTripBySlug(slug: string): Promise<any> {
  if (!slug) throw Object.assign(new Error('Slug required'), { status: 400 });

  const row = await prisma.trip.findUnique({ where: { slug }, include: tripInclude });
  if (!row) throw Object.assign(new Error('Trip not found'), { status: 404 });

  const organizers = await organizerMap([row.organizerId], 'name organizerProfile');
  const tripObj = shapeTrip(row);
  tripObj.organizerId = organizers.get(row.organizerId) ?? row.organizerId;
  if (!tripObj.category) {
    tripObj.category = Array.isArray(tripObj.categories) && tripObj.categories.length > 0 ? tripObj.categories[0] : 'Adventure';
  }
  return tripObj;
}

// ─── Join trip ────────────────────────────────────────────────────────────────

export async function joinTrip(tripId: string, userId: string): Promise<any> {
  if (!tripId) throw Object.assign(new Error('Invalid trip id'), { status: 400 });

  // This was the fourth copy of read-count-compare-push. The capacity check and
  // the insert happen under a row lock now, and "already joined" is answered by
  // a unique constraint rather than by `includes` on an ObjectId array, which
  // was false for every caller.
  try {
    const result = await joinTripRow(tripId, userId);
    if (result.alreadyJoined) {
      throw Object.assign(new Error('Already joined this trip'), { status: 400 });
    }
  } catch (error: any) {
    if (error instanceof TripFullError) {
      throw Object.assign(new Error('Trip is full'), { status: 400 });
    }
    throw error;
  }

  await invalidateCache('/trips');
  return getTripById(tripId);
}

// ─── Leave trip ───────────────────────────────────────────────────────────────

export async function leaveTrip(tripId: string, userId: string): Promise<any> {
  if (!tripId) throw Object.assign(new Error('Invalid trip id'), { status: 400 });

  const removed = await leaveTripRow(tripId, userId);
  if (!removed) throw Object.assign(new Error('Not part of this trip'), { status: 400 });

  await invalidateCache('/trips');
  return getTripById(tripId);
}

// ─── Update trip ──────────────────────────────────────────────────────────────

export async function updateTrip(tripId: string, userId: string, userRole: string, updateData: UpdateTripInput): Promise<any> {
  if (!tripId) throw Object.assign(new Error('Invalid trip id'), { status: 400 });

  const trip = await prisma.trip.findUnique({ where: { id: tripId }, select: { organizerId: true } });
  if (!trip) throw Object.assign(new Error('Trip not found'), { status: 404 });

  if (trip.organizerId !== userId && userRole !== 'admin') {
    throw Object.assign(new Error('Not authorized to update this trip'), { status: 403 });
  }

  // runValidators: true was asking Mongoose to apply schema validation on an
  // update, which it does not do by default. The constraints are in the
  // database now, so they apply to every write whether anyone asks or not.
  const updatedTrip = await updateTripWithChildren(tripId, updateData);
  await invalidateCache('/trips');
  return shapeTrip(updatedTrip as any);
}

// ─── Delete trip ──────────────────────────────────────────────────────────────

export async function deleteTrip(tripId: string, userId: string, userRole: string): Promise<void> {
  if (!tripId) throw Object.assign(new Error('Invalid trip id'), { status: 400 });

  const trip = await prisma.trip.findUnique({ where: { id: tripId }, select: { organizerId: true } });
  if (!trip) throw Object.assign(new Error('Trip not found'), { status: 404 });

  if (trip.organizerId !== userId && userRole !== 'admin') {
    throw Object.assign(new Error('Not authorized to delete this trip'), { status: 403 });
  }

  // The schedule, packages, stops, photos, participants and bookings go with
  // it - ON DELETE CASCADE, where deleting the document used to leave the
  // bookings that referenced it pointing at nothing.
  await prisma.trip.delete({ where: { id: tripId } });
  await invalidateCache('/trips');
}

/**
 * The organizer objects .populate() used to attach.
 *
 * User is still a Mongo document, so this is a second query rather than a join.
 * It returns a map keyed by id string; callers put the result back under
 * `organizerId`, which is where the frontend reads the organizer's name.
 */
async function organizerMap(ids: string[], select: string): Promise<Map<string, any>> {
  const unique = Array.from(new Set(ids));
  if (unique.length === 0) return new Map();

  const users = await User.find({ _id: { $in: unique } }, select).lean();
  return new Map(users.map((u: any) => [u._id.toString(), u]));
}
