/**
 * Marketing, growth and CRM — Sprint 7
 *
 * No req/res objects — pure data in, data out.
 *
 * The discount arithmetic lives in ./discount.ts, deliberately without a
 * database, so the rule deciding how much money leaves the business can be
 * tested directly. This file is the part that reads and writes.
 */

import { prisma } from '../../lib/prisma';
import { toNumber } from '../../lib/money';
import { applyCoupons, DiscountFloor, CouponInput, DiscountResult } from './discount';

export class MarketingError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

// ─── Banners ─────────────────────────────────────────────────────────────────

/** Read through v_banner_state so "live" is produced in one place. */
export async function listBanners(organizerId: string) {
  return prisma.$queryRaw<any[]>`
    SELECT id, title, body_text, image_url, link_url, placement,
           starts_at, ends_at, is_paused, state
    FROM v_banner_state
    WHERE organizer_id = ${organizerId}
    ORDER BY starts_at DESC
  `;
}

export async function createBanner(organizerId: string, data: any) {
  return prisma.banner.create({ data: { ...data, organizerId } });
}

export async function setBannerPaused(id: string, organizerId: string, isPaused: boolean) {
  const b = await prisma.banner.findUnique({ where: { id } });
  if (!b || b.organizerId !== organizerId) throw new MarketingError('Banner not found', 404);
  // Paused is the only banner state anyone may set. live, scheduled and expired
  // are arithmetic on the window, and offering a control for them would mean
  // storing a second opinion about the same thing.
  return prisma.banner.update({ where: { id }, data: { isPaused } });
}

// ─── Campaigns ───────────────────────────────────────────────────────────────

export async function listCampaigns(organizerId: string) {
  return prisma.campaign.findMany({ where: { organizerId }, orderBy: { createdAt: 'desc' } });
}

export async function createCampaign(organizerId: string, data: any) {
  return prisma.campaign.create({ data: { ...data, organizerId } });
}

// ─── Referrals ───────────────────────────────────────────────────────────────

export async function listReferrals(organizerId: string) {
  return prisma.referral.findMany({ where: { organizerId }, orderBy: { createdAt: 'desc' } });
}

export async function createReferral(organizerId: string, referrerId: string, code: string) {
  return prisma.referral.create({ data: { organizerId, referrerId, code } });
}

// ─── Review requests ─────────────────────────────────────────────────────────

/**
 * Ask for a review, or record that we asked again.
 *
 * Idempotent on the booking: the unique index decides, so asking three times
 * leaves one row and nobody gets three emails. The gate wants exactly this.
 */
export async function requestReview(organizerId: string, bookingId: string) {
  const booking = await prisma.groupBooking.findUnique({
    where: { id: bookingId },
    select: { tripId: true, trip: { select: { organizerId: true } } },
  });
  if (!booking) throw new MarketingError('Booking not found', 404);
  if (booking.trip.organizerId !== organizerId) throw new MarketingError('Not your booking', 403);

  return prisma.reviewRequest.upsert({
    where: { bookingId },
    create: { organizerId, bookingId, tripId: booking.tripId },
    update: { remindedAt: new Date(), reminderCount: { increment: 1 } },
  });
}

/**
 * Match a review back to the request that asked for it.
 *
 * Both halves of the response land together — the CHECK on the table refuses a
 * half-recorded one, so there is no state where a request looks answered but
 * cannot say by what.
 */
export async function matchReviewBack(bookingId: string, reviewId: string) {
  const req = await prisma.reviewRequest.findUnique({ where: { bookingId } });
  if (!req) throw new MarketingError('No review was requested for this booking', 404);
  if (req.reviewId) {
    // Already matched. Returning the existing row rather than throwing keeps
    // this safe to call from a webhook that retries.
    return req;
  }
  return prisma.reviewRequest.update({
    where: { bookingId },
    data: { reviewId, respondedAt: new Date() },
  });
}

export async function listReviewRequests(organizerId: string) {
  const rows = await prisma.reviewRequest.findMany({
    where: { organizerId },
    orderBy: { sentAt: 'desc' },
  });
  // Waiting versus answered is the presence of a review id, not a stored
  // status that could disagree with it.
  return rows.map((r) => ({ ...r, state: r.reviewId ? 'answered' : 'waiting' }));
}

// ─── Notes ───────────────────────────────────────────────────────────────────

/**
 * Add a note. There is no update and no delete, here or anywhere.
 *
 * The table refuses both with a trigger, so this is not a promise the service
 * is keeping — it is a promise the database keeps on the service's behalf, and
 * on behalf of every caller written later by someone who never read this file.
 */
export async function addNote(
  organizerId: string,
  authorId: string,
  subject: { leadId?: string; bookingId?: string; customerId?: string },
  body: string
) {
  const count = [subject.leadId, subject.bookingId, subject.customerId].filter(Boolean).length;
  if (count !== 1) {
    throw new MarketingError(
      'A note must be about exactly one of a lead, a booking or a customer',
      400
    );
  }
  if (!body.trim()) throw new MarketingError('A note cannot be empty', 400);

  return prisma.customerNote.create({
    data: { organizerId, authorId, body: body.trim(), ...subject },
  });
}

export async function listNotes(
  organizerId: string,
  subject: { leadId?: string; bookingId?: string; customerId?: string }
) {
  return prisma.customerNote.findMany({
    where: { organizerId, ...subject },
    orderBy: { createdAt: 'desc' },
  });
}

// ─── CRM ─────────────────────────────────────────────────────────────────────

/**
 * The customer list, built from bookings.
 *
 * The gate: a customer with no profile row still appears. Anyone who has booked
 * is a customer whether or not somebody created a record for them, so the
 * profile is a left join that may find nothing and profileMissing says so.
 */
export async function listCrmCustomers(organizerId: string) {
  const rows = await prisma.$queryRaw<any[]>`
    SELECT customer_id, name, email, phone, profile_missing,
           bookings, seats, lifetime_spend, first_booked_at, last_booked_at
    FROM v_crm_customers
    WHERE organizer_id = ${organizerId}
    ORDER BY lifetime_spend DESC
  `;
  return rows.map((r) => ({
    customerId: r.customer_id,
    name: r.name,
    email: r.email,
    phone: r.phone,
    profileMissing: Boolean(r.profile_missing),
    bookings: Number(r.bookings),
    seats: Number(r.seats),
    lifetimeSpend: toNumber(r.lifetime_spend),
    firstBookedAt: r.first_booked_at,
    lastBookedAt: r.last_booked_at,
  }));
}

// ─── Discount floor and coupons ──────────────────────────────────────────────

export async function getFloor(organizerId: string): Promise<DiscountFloor | null> {
  const row = await prisma.discountFloor.findUnique({ where: { organizerId } });
  if (!row) return null;
  return {
    kind: row.kind,
    maxTotalPercent: row.maxTotalPercent === null ? undefined : toNumber(row.maxTotalPercent),
    minNetPaise: row.minNetPaise ?? undefined,
  };
}

export async function setFloor(
  organizerId: string,
  setBy: string,
  kind: 'max_total_percent' | 'min_net_amount',
  value: number
) {
  if (!Number.isFinite(value) || value < 0) {
    throw new MarketingError('The floor value must be a non-negative number', 400);
  }
  if (kind === 'max_total_percent' && value > 100) {
    throw new MarketingError('A percentage floor cannot exceed 100', 400);
  }
  if (kind === 'min_net_amount' && !Number.isInteger(value)) {
    throw new MarketingError('A minimum net amount must be an integer number of paise', 400);
  }

  const data =
    kind === 'max_total_percent'
      ? { kind, maxTotalPercent: value, minNetPaise: null, setBy, setAt: new Date() }
      : { kind, minNetPaise: value, maxTotalPercent: null, setBy, setAt: new Date() };

  return prisma.discountFloor.upsert({
    where: { organizerId },
    create: { organizerId, ...data },
    update: data,
  });
}

export async function listCoupons(organizerId: string) {
  return prisma.$queryRaw<any[]>`
    SELECT id, code, kind, percent_off, amount_off_paise, starts_at, ends_at,
           max_redemptions, times_redeemed, is_paused, state
    FROM v_coupon_state
    WHERE organizer_id = ${organizerId}
    ORDER BY starts_at DESC
  `;
}

export async function createCoupon(organizerId: string, data: any) {
  return prisma.coupon.create({ data: { ...data, organizerId } });
}

/**
 * Work out what a stack of codes would take off a booking.
 *
 * Read-only: it quotes, it does not redeem. The floor is fetched here and
 * handed to the pure calculation, so a missing floor produces a refusal with a
 * reason rather than an uncapped discount.
 */
export async function quoteDiscount(
  organizerId: string,
  basePaise: number,
  codes: string[]
): Promise<DiscountResult & { unknownCodes: string[] }> {
  const floor = await getFloor(organizerId);

  const found = await prisma.$queryRaw<any[]>`
    SELECT id, code, kind, percent_off, amount_off_paise, state
    FROM v_coupon_state
    WHERE organizer_id = ${organizerId} AND code = ANY(${codes})
  `;

  // Only live coupons count. A paused, scheduled, expired or exhausted code is
  // reported as unknown rather than silently applied — the state comes from the
  // view, so this cannot disagree with what the coupons screen shows.
  const live = found.filter((c) => c.state === 'live');
  const usable: CouponInput[] = live.map((c) => ({
    id: c.id,
    code: c.code,
    kind: c.kind,
    percentOff: c.percent_off === null ? undefined : Number(c.percent_off),
    amountOffPaise: c.amount_off_paise ?? undefined,
  }));

  const liveCodes = new Set(live.map((c) => c.code));
  const unknownCodes = codes.filter((c) => !liveCodes.has(c));

  return { ...applyCoupons(basePaise, usable, floor), unknownCodes };
}
