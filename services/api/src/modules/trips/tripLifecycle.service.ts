/**
 * Trip lifecycle — Sprint 4
 *
 * Publication state, derived selling state, templates, series and duplication.
 * Kept beside trips.service.ts rather than inside it: that file is already 568
 * lines of creation and booking logic, and none of this touches it.
 *
 * No req/res objects — pure data in, data out.
 */

import { prisma } from '../../lib/prisma';
import { toNumber } from '../../lib/money';

export type EffectiveStatus =
  | 'draft'
  | 'scheduled'
  | 'published'
  | 'archived'
  | 'cancelled'
  | 'completed'
  | 'running';

export type SellState = 'not_for_sale' | 'on_sale' | 'sold_out' | 'closed';

export interface DerivedTripState {
  effectiveStatus: EffectiveStatus;
  sellState: SellState;
  confirmedSeats: number;
  fillPct: number;
}

/**
 * Seats are counted from bookings, never read from a column.
 *
 * The sprint gate says "seats derived from bookings, never stored", and this is
 * the only place that count is produced. A stored counter is a second source of
 * truth that drifts the first time a booking is cancelled by a path that
 * forgets to decrement it.
 *
 * numberOfGuests is summed, not rows counted: a group booking holds several
 * seats, so counting rows under-reports by the group size minus one.
 */
export async function getConfirmedSeats(tripIds: string[]): Promise<Map<string, number>> {
  if (tripIds.length === 0) return new Map();

  const rows = await prisma.groupBooking.groupBy({
    by: ['tripId'],
    where: {
      tripId: { in: tripIds },
      bookingStatus: { in: ['confirmed', 'completed'] },
    },
    _sum: { numberOfGuests: true },
  });

  return new Map(rows.map((r) => [r.tripId, r._sum.numberOfGuests ?? 0]));
}

/**
 * effectiveStatus is what the trip actually is right now, which is not always
 * what publicationStatus says on its own.
 *
 * Lifecycle wins over publication: a cancelled trip is cancelled whatever its
 * publication row says. Below that, a published trip whose publishAt is still
 * in the future is really scheduled — the row says published, but nobody can
 * see it yet, and reporting it as published is how a trip goes missing from a
 * listing with no explanation.
 */
export function deriveTripState(
  trip: {
    publicationStatus: string;
    publishAt: Date | null;
    status: string;
    capacity: number;
    startDate: Date;
    endDate: Date;
  },
  confirmedSeats: number,
  now: Date = new Date()
): DerivedTripState {
  const fillPct =
    trip.capacity > 0 ? Math.round((confirmedSeats / trip.capacity) * 10000) / 100 : 0;

  let effectiveStatus: EffectiveStatus;

  if (trip.status === 'cancelled') {
    effectiveStatus = 'cancelled';
  } else if (trip.status === 'completed' || trip.endDate < now) {
    effectiveStatus = 'completed';
  } else if (trip.publicationStatus === 'archived') {
    effectiveStatus = 'archived';
  } else if (trip.publicationStatus === 'draft') {
    effectiveStatus = 'draft';
  } else if (
    trip.publicationStatus === 'scheduled' ||
    (trip.publishAt !== null && trip.publishAt > now)
  ) {
    effectiveStatus = 'scheduled';
  } else if (trip.startDate <= now && trip.endDate >= now) {
    effectiveStatus = 'running';
  } else {
    effectiveStatus = 'published';
  }

  let sellState: SellState;
  if (effectiveStatus !== 'published') {
    // Only a published, not-yet-departed trip can be bought.
    sellState = 'not_for_sale';
  } else if (confirmedSeats >= trip.capacity) {
    sellState = 'sold_out';
  } else if (trip.startDate <= now) {
    sellState = 'closed';
  } else {
    sellState = 'on_sale';
  }

  return { effectiveStatus, sellState, confirmedSeats, fillPct };
}

interface DerivableTrip {
  id: string;
  publicationStatus: string;
  publishAt: Date | null;
  status: string;
  capacity: number;
  startDate: Date;
  endDate: Date;
}

/** Attach derived state to a list of trips in one query, not N. */
export async function withDerivedState<T extends DerivableTrip>(
  trips: T[]
): Promise<(T & DerivedTripState)[]> {
  const seats = await getConfirmedSeats(trips.map((t) => t.id));
  return trips.map((t) => ({ ...t, ...deriveTripState(t, seats.get(t.id) ?? 0) }));
}

// ─── Duplication ─────────────────────────────────────────────────────────────

/**
 * Duplicate a trip.
 *
 * The gate: the copy is draft, at 0% fill, and inherits no live state. That
 * means bookings, participants, ratings, verification, payment routing and QR
 * state and the slug are all left behind — copying any of them would produce a
 * trip that claims sales it never made.
 *
 * Dates are copied as-is. Shifting them would be a guess about what the
 * organizer meant; leaving them lets the duplicate fail its own validation
 * loudly if they are in the past, which is the visible failure.
 */
export async function duplicateTrip(tripId: string, organizerId: string) {
  const source = await prisma.trip.findUnique({ where: { id: tripId } });
  if (!source) throw new Error('Trip not found');
  if (source.organizerId !== organizerId) throw new Error('Not your trip');

  const {
    id: _id,
    slug: _slug,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    // live state, deliberately dropped
    averageRating: _averageRating,
    reviewCount: _reviewCount,
    verificationStatus: _verificationStatus,
    verifiedBy: _verifiedBy,
    verifiedAt: _verifiedAt,
    rejectionReason: _rejectionReason,
    adminNotes: _adminNotes,
    gatewayQrAmount: _qrAmount,
    gatewayQrCurrency: _qrCurrency,
    gatewayQrReferenceId: _qrRef,
    gatewayQrUrl: _qrUrl,
    gatewayQrGeneratedAt: _qrAt,
    contentHash: _contentHash,
    isDuplicate: _isDuplicate,
    originalTripId: _originalTripId,
    publishAt: _publishAt,
    seriesId: _seriesId,
    duplicatedFromTripId: _duplicatedFrom,
    ...copyable
  } = source as any;

  return prisma.trip.create({
    data: {
      ...copyable,
      title: `${source.title} (copy)`,
      publicationStatus: 'draft',
      status: 'pending',
      publishAt: null,
      slug: null,
      duplicatedFromTripId: source.id,
    },
  });
}

// ─── Templates ───────────────────────────────────────────────────────────────

export async function listTemplates(organizerId: string) {
  return prisma.tripTemplate.findMany({
    where: { organizerId },
    orderBy: { updatedAt: 'desc' },
  });
}

export async function createTemplate(organizerId: string, data: any) {
  return prisma.tripTemplate.create({ data: { ...data, organizerId } });
}

export async function deleteTemplate(id: string, organizerId: string) {
  const tpl = await prisma.tripTemplate.findUnique({ where: { id } });
  if (!tpl || tpl.organizerId !== organizerId) throw new Error('Template not found');
  // Trips keep standing; the FK is SetNull.
  return prisma.tripTemplate.delete({ where: { id } });
}

/**
 * Create a trip from a template. The result is a draft, like a duplicate:
 * a template is a starting point, not a publish button.
 */
export async function createTripFromTemplate(
  templateId: string,
  organizerId: string,
  overrides: { startDate: Date; endDate: Date; title?: string; price?: number; capacity?: number }
) {
  const tpl = await prisma.tripTemplate.findUnique({ where: { id: templateId } });
  if (!tpl || tpl.organizerId !== organizerId) throw new Error('Template not found');

  const trip = await prisma.trip.create({
    data: {
      organizerId,
      title: overrides.title ?? tpl.title,
      description: tpl.description ?? '',
      destination: tpl.destination ?? '',
      difficulty: tpl.difficulty,
      categories: tpl.categories,
      capacity: overrides.capacity ?? tpl.capacity ?? 1,
      price: overrides.price ?? toNumber(tpl.price),
      itinerary: tpl.itinerary,
      safetyEquipment: tpl.safetyEquipment,
      startDate: overrides.startDate,
      endDate: overrides.endDate,
      publicationStatus: 'draft',
      templateId: tpl.id,
    },
  });

  await prisma.tripTemplate.update({
    where: { id: tpl.id },
    data: { timesUsed: { increment: 1 }, lastUsedAt: new Date() },
  });

  return trip;
}

// ─── Series ──────────────────────────────────────────────────────────────────

export async function listSeries(organizerId: string) {
  return prisma.tripSeries.findMany({
    where: { organizerId },
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { trips: true } } },
  });
}

export async function createSeries(organizerId: string, data: any) {
  return prisma.tripSeries.create({ data: { ...data, organizerId } });
}

// ─── Publication ─────────────────────────────────────────────────────────────

export async function setPublication(
  tripId: string,
  organizerId: string,
  publicationStatus: 'draft' | 'scheduled' | 'published' | 'archived',
  publishAt?: Date | null
) {
  const trip = await prisma.trip.findUnique({ where: { id: tripId } });
  if (!trip) throw new Error('Trip not found');
  if (trip.organizerId !== organizerId) throw new Error('Not your trip');

  // A scheduled trip without a time is a draft wearing a different label, and
  // would sit invisible forever with nothing to explain why.
  if (publicationStatus === 'scheduled' && !publishAt) {
    throw new Error('A scheduled trip needs a publish time');
  }

  return prisma.trip.update({
    where: { id: tripId },
    data: {
      publicationStatus,
      publishAt: publicationStatus === 'scheduled' ? publishAt : null,
    },
  });
}
