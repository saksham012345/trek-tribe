/**
 * Marketing controller — Sprint 7
 *
 * Handles req/res, delegates all logic to marketing.service.ts.
 * No business logic lives here.
 */

import { Request, Response } from 'express';
import * as marketing from './marketing.service';
import { MarketingError } from './marketing.service';

function actor(req: Request): { id: string; role: string } | null {
  const id = (req as any).user?.userId;
  return id ? { id, role: (req as any).user?.role } : null;
}

function organizerScope(req: Request): string | null {
  const a = actor(req);
  if (!a) return null;
  if (a.role === 'admin' && typeof req.query.organizerId === 'string') return req.query.organizerId;
  return a.id;
}

function fail(res: Response, error: any, whileDoing: string) {
  if (error instanceof MarketingError) {
    return res.status(error.status).json({ error: error.message });
  }
  console.error(`❌ Error ${whileDoing}:`, error);
  return res.status(500).json({ error: `Failed ${whileDoing}`, message: error?.message });
}

function run(
  whileDoing: string,
  handler: (req: Request, organizerId: string, actorId: string) => Promise<unknown>,
  status = 200
) {
  return async (req: Request, res: Response) => {
    const a = actor(req);
    const organizerId = organizerScope(req);
    if (!a || !organizerId) return res.status(401).json({ error: 'Unauthorized' });
    try {
      return res.status(status).json(await handler(req, organizerId, a.id));
    } catch (error) {
      return fail(res, error, whileDoing);
    }
  };
}

// ─── Banners ─────────────────────────────────────────────────────────────────

export const listBanners = run('listing banners', (_r, org) => marketing.listBanners(org));

export const createBanner = run(
  'creating banner',
  (req, org) => {
    if (!req.body?.title) throw new MarketingError('title is required', 400);
    if (!req.body?.startsAt) throw new MarketingError('startsAt is required', 400);
    return marketing.createBanner(org, {
      ...req.body,
      startsAt: new Date(req.body.startsAt),
      endsAt: req.body.endsAt ? new Date(req.body.endsAt) : null,
    });
  },
  201
);

export const setBannerPaused = run('pausing banner', (req, org) => {
  if (typeof req.body?.isPaused !== 'boolean') {
    throw new MarketingError('isPaused must be a boolean', 400);
  }
  return marketing.setBannerPaused(req.params.id, org, req.body.isPaused);
});

// ─── Campaigns ───────────────────────────────────────────────────────────────

export const listCampaigns = run('listing campaigns', (_r, org) => marketing.listCampaigns(org));

export const createCampaign = run(
  'creating campaign',
  (req, org) => {
    if (!req.body?.name || !req.body?.channel) {
      throw new MarketingError('name and channel are required', 400);
    }
    return marketing.createCampaign(org, {
      ...req.body,
      scheduledFor: req.body.scheduledFor ? new Date(req.body.scheduledFor) : null,
    });
  },
  201
);

// ─── Referrals ───────────────────────────────────────────────────────────────

export const listReferrals = run('listing referrals', (_r, org) => marketing.listReferrals(org));

export const createReferral = run(
  'creating referral',
  (req, org) => {
    if (!req.body?.code || !req.body?.referrerId) {
      throw new MarketingError('code and referrerId are required', 400);
    }
    return marketing.createReferral(org, req.body.referrerId, req.body.code);
  },
  201
);

// ─── Review requests ─────────────────────────────────────────────────────────

export const listReviewRequests = run('listing review requests', (_r, org) =>
  marketing.listReviewRequests(org)
);

export const requestReview = run(
  'requesting a review',
  (req, org) => {
    if (!req.body?.bookingId) throw new MarketingError('bookingId is required', 400);
    return marketing.requestReview(org, req.body.bookingId);
  },
  201
);

export const matchReviewBack = run('matching a review back', (req) => {
  if (!req.body?.reviewId) throw new MarketingError('reviewId is required', 400);
  return marketing.matchReviewBack(req.params.bookingId, req.body.reviewId);
});

// ─── Notes ───────────────────────────────────────────────────────────────────

function noteSubject(src: any) {
  return {
    leadId: typeof src.leadId === 'string' ? src.leadId : undefined,
    bookingId: typeof src.bookingId === 'string' ? src.bookingId : undefined,
    customerId: typeof src.customerId === 'string' ? src.customerId : undefined,
  };
}

export const listNotes = run('listing notes', (req, org) =>
  marketing.listNotes(org, noteSubject(req.query))
);

export const addNote = run(
  'adding a note',
  (req, org, actorId) => {
    if (typeof req.body?.body !== 'string') throw new MarketingError('body is required', 400);
    return marketing.addNote(org, actorId, noteSubject(req.body), req.body.body);
  },
  201
);

// There is deliberately no updateNote and no deleteNote. Notes are append-only,
// and the database refuses both, so an endpoint offering them could only ever
// return an error.

// ─── CRM ─────────────────────────────────────────────────────────────────────

export const listCrmCustomers = run('listing customers', (_r, org) =>
  marketing.listCrmCustomers(org)
);

// ─── Discount floor and coupons ──────────────────────────────────────────────

export const getFloor = run('reading the discount floor', async (_r, org) => {
  const floor = await marketing.getFloor(org);
  return {
    floor,
    // Said plainly, because the consequence is not obvious from a null.
    couponsUsable: floor !== null,
    note:
      floor === null
        ? 'No floor is set, so no coupon will apply. Set one before running any offer.'
        : null,
  };
});

export const setFloor = run('setting the discount floor', (req, org, actorId) => {
  const { kind, value } = req.body ?? {};
  if (kind !== 'max_total_percent' && kind !== 'min_net_amount') {
    throw new MarketingError('kind must be max_total_percent or min_net_amount', 400);
  }
  if (typeof value !== 'number') throw new MarketingError('value must be a number', 400);
  return marketing.setFloor(org, actorId, kind, value);
});

export const listCoupons = run('listing coupons', (_r, org) => marketing.listCoupons(org));

export const createCoupon = run(
  'creating coupon',
  (req, org) => {
    const { code, kind, percentOff, amountOffPaise, startsAt } = req.body ?? {};
    if (!code) throw new MarketingError('code is required', 400);
    if (kind !== 'percent' && kind !== 'fixed_amount') {
      throw new MarketingError('kind must be percent or fixed_amount', 400);
    }
    if (kind === 'percent' && typeof percentOff !== 'number') {
      throw new MarketingError('percentOff is required for a percent coupon', 400);
    }
    if (kind === 'fixed_amount' && !Number.isInteger(amountOffPaise)) {
      throw new MarketingError('amountOffPaise must be an integer for a fixed coupon', 400);
    }
    if (!startsAt) throw new MarketingError('startsAt is required', 400);

    return marketing.createCoupon(org, {
      code: String(code).trim().toUpperCase(),
      kind,
      percentOff: kind === 'percent' ? percentOff : null,
      amountOffPaise: kind === 'fixed_amount' ? amountOffPaise : null,
      startsAt: new Date(startsAt),
      endsAt: req.body.endsAt ? new Date(req.body.endsAt) : null,
      maxRedemptions: req.body.maxRedemptions ?? null,
    });
  },
  201
);

/** Quote only — this never redeems anything. */
export const quoteDiscount = run('quoting a discount', (req, org) => {
  const { basePaise, codes } = req.body ?? {};
  if (!Number.isInteger(basePaise)) {
    throw new MarketingError('basePaise must be an integer number of paise', 400);
  }
  if (!Array.isArray(codes)) throw new MarketingError('codes must be an array', 400);
  return marketing.quoteDiscount(
    org,
    basePaise,
    codes.map((c: unknown) => String(c).trim().toUpperCase())
  );
});
