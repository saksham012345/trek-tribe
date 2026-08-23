import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Types } from 'mongoose';
import { prisma } from '../lib/prisma';
import { Trip } from '../models/Trip';
import { User } from '../models/User';
import { authenticateJwt } from '../middleware/auth';
import { withMongoId, asPopulated } from '../lib/apiShape';

/**
 * Wishlist rows live in Postgres (D10/D11, wave 2). Trip and User are still in
 * Mongo, so user_id / trip_id are ObjectId strings with no FK behind them.
 *
 * Three things changed shape and are worth knowing before editing this file:
 *
 *  1. Item ids are UUIDs now, not ObjectIds. Every `Types.ObjectId.isValid(id)`
 *     guard on a *wishlist item id* would reject every real id, so those became
 *     UUID checks. The guards on tripId stay ObjectId checks - trips are still
 *     Mongo documents.
 *
 *  2. The old list was one aggregation: $lookup into trips, $match on
 *     trip.status = 'active', then sort and paginate. That filter and that
 *     pagination happened *after* the join, which a single query can no longer
 *     do across two databases. The list now reads the rows from Postgres, loads
 *     their trips from Mongo, drops the inactive ones, and only then paginates -
 *     so totalItems still counts what the user can actually see. A wishlist is
 *     tens of rows, so this is cheap; it would not be for a large collection.
 *
 *  3. "Trip exists and is active" was a Mongoose pre-save hook. Postgres cannot
 *     check a Mongo document, so it lives here now, before the insert.
 */

const router = Router();

const addToWishlistSchema = z.object({
  tripId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid trip ID'),
  notes: z.string().max(500).optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  tags: z.array(z.string().max(50)).optional()
});

const updateWishlistSchema = z.object({
  notes: z.string().max(500).optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  tags: z.array(z.string().max(50)).optional()
});

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isItemId = (id: string) => UUID.test(id);

const normaliseTags = (tags: string[]) =>
  Array.from(new Set(tags.map(t => t.toLowerCase().trim()).filter(t => t.length > 0)));

const TRIP_FIELDS =
  'title description destination price startDate endDate capacity images coverImage categories status organizerId';

/** Load one wishlist row and check it belongs to the caller. */
async function ownedItem(id: string, userId: string, res: Response) {
  if (!isItemId(id)) {
    res.status(400).json({ error: 'Invalid wishlist item ID' });
    return null;
  }
  const item = await prisma.wishlist.findUnique({ where: { id } });
  if (!item) {
    res.status(404).json({ error: 'Wishlist item not found' });
    return null;
  }
  if (item.userId !== userId) {
    res.status(403).json({ error: 'You can only update your own wishlist items' });
    return null;
  }
  return item;
}

/** Attach the Mongo trip to each row, dropping rows whose trip is gone or inactive. */
async function withActiveTrips(rows: any[]) {
  if (rows.length === 0) return [];
  const trips = await Trip.find({ _id: { $in: rows.map(r => r.tripId) }, status: 'active' })
    .select(TRIP_FIELDS)
    .lean();
  const byId = new Map(trips.map((t: any) => [t._id.toString(), t]));
  return rows
    .map(row => ({ row, trip: byId.get(row.tripId) }))
    .filter(x => x.trip !== undefined);
}

// GET /wishlist - the user's wishlist, filtered and paginated
router.get('/',
  authenticateJwt,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).auth.userId;

    const {
      priority,
      tags,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      page = '1',
      limit = '10'
    } = req.query;

    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 10;
    const tagsArray = tags
      ? (tags as string).split(',').map(t => t.trim().toLowerCase())
      : undefined;

    const where: any = { userId };
    if (priority) where.priority = priority;
    if (tagsArray && tagsArray.length > 0) where.tags = { hasSome: tagsArray };

    const sortField = ['createdAt', 'updatedAt', 'priority'].includes(sortBy as string)
      ? (sortBy as string)
      : 'createdAt';

    // Read every candidate row, then filter by the Mongo trip, then paginate.
    // Paginating first would return short pages whenever an inactive trip fell
    // inside the window, and would make totalItems count rows the user cannot see.
    const rows = await prisma.wishlist.findMany({
      where,
      orderBy: { [sortField]: sortOrder === 'asc' ? 'asc' : 'desc' }
    });

    const visible = await withActiveTrips(rows);
    const totalItems = visible.length;
    const start = (pageNum - 1) * limitNum;
    const pageRows = visible.slice(start, start + limitNum);

    const organizerIds = Array.from(
      new Set(pageRows.map(x => String((x.trip as any).organizerId)))
    );
    const organizers = await User.find({ _id: { $in: organizerIds } })
      .select('name profilePhoto')
      .lean();
    const organizerById = new Map(organizers.map((o: any) => [o._id.toString(), o]));

    res.json({
      // Shaped the way Mongoose used to answer: _id present, and the trip under
      // tripId as a populated object - Wishlist.tsx reads item.tripId.title and
      // keys its list on item._id.
      items: pageRows.map(({ row, trip }) => ({
        ...withMongoId(row),
        tripId: asPopulated(trip),
        trip,
        organizer: organizerById.get(String((trip as any).organizerId)) ?? null
      })),
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(totalItems / limitNum),
        totalItems,
        hasNext: pageNum < Math.ceil(totalItems / limitNum),
        hasPrev: pageNum > 1
      }
    });
  })
);

// GET /wishlist/stats
router.get('/stats',
  authenticateJwt,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).auth.userId;

    const rows = await prisma.wishlist.findMany({
      where: { userId },
      select: { priority: true, tags: true }
    });

    const priorityBreakdown = { low: 0, medium: 0, high: 0 };
    const tagFrequency: Record<string, number> = {};

    for (const row of rows) {
      priorityBreakdown[row.priority] += 1;
      for (const tag of row.tags) {
        tagFrequency[tag] = (tagFrequency[tag] || 0) + 1;
      }
    }

    // Ties break alphabetically so the response is stable between calls.
    const popularTags = Object.entries(tagFrequency)
      .sort(([aTag, aCount], [bTag, bCount]) => bCount - aCount || aTag.localeCompare(bTag))
      .slice(0, 10)
      .map(([tag, count]) => ({ tag, count }));

    res.json({ totalItems: rows.length, priorityBreakdown, popularTags });
  })
);

// POST /wishlist
router.post('/',
  authenticateJwt,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).auth.userId;

    const parsed = addToWishlistSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    }

    const { tripId, notes, priority = 'medium', tags = [] } = parsed.data;

    // Was a Mongoose pre-save hook. Postgres cannot check a Mongo document.
    const trip: any = await Trip.findById(tripId).select(TRIP_FIELDS).lean();
    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }
    if (trip.status !== 'active') {
      return res.status(400).json({ error: 'Cannot bookmark inactive trips' });
    }

    try {
      const wishlistItem = await prisma.wishlist.create({
        data: { userId, tripId, notes: notes?.trim(), priority, tags: normaliseTags(tags) }
      });

      res.status(201).json({
        message: 'Trip added to wishlist successfully',
        wishlistItem: { ...withMongoId(wishlistItem), tripId: asPopulated(trip), trip }
      });
    } catch (error: any) {
      if (error?.code === 'P2002') {
        return res.status(409).json({ error: 'Trip is already in your wishlist' });
      }
      throw error;
    }
  })
);

// PUT /wishlist/:id
router.put('/:id',
  authenticateJwt,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).auth.userId;

    const parsed = updateWishlistSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    }

    const existing = await ownedItem(req.params.id, userId, res);
    if (!existing) return;

    const { notes, priority, tags } = parsed.data;
    const data: any = {};
    if (notes !== undefined) data.notes = notes.trim();
    if (priority) data.priority = priority;
    if (tags) data.tags = normaliseTags(tags);

    const wishlistItem = await prisma.wishlist.update({ where: { id: existing.id }, data });
    const trip = await Trip.findById(wishlistItem.tripId).select(TRIP_FIELDS).lean();

    res.json({
      message: 'Wishlist item updated successfully',
      wishlistItem: { ...withMongoId(wishlistItem), tripId: asPopulated(trip), trip }
    });
  })
);

// DELETE /wishlist/:id
router.delete('/:id',
  authenticateJwt,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).auth.userId;

    const existing = await ownedItem(req.params.id, userId, res);
    if (!existing) return;

    await prisma.wishlist.delete({ where: { id: existing.id } });
    res.json({ message: 'Trip removed from wishlist successfully' });
  })
);

// DELETE /wishlist/trip/:tripId
router.delete('/trip/:tripId',
  authenticateJwt,
  asyncHandler(async (req: Request, res: Response) => {
    const { tripId } = req.params;
    const userId = (req as any).auth.userId;

    // Still an ObjectId check - trips remain Mongo documents.
    if (!Types.ObjectId.isValid(tripId)) {
      return res.status(400).json({ error: 'Invalid trip ID' });
    }

    const deleted = await prisma.wishlist.deleteMany({ where: { userId, tripId } });
    if (deleted.count === 0) {
      return res.status(404).json({ error: 'Trip not found in your wishlist' });
    }

    res.json({ message: 'Trip removed from wishlist successfully' });
  })
);

// POST /wishlist/:id/priority
router.post('/:id/priority',
  authenticateJwt,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).auth.userId;
    const { priority } = req.body;

    if (!['low', 'medium', 'high'].includes(priority)) {
      return res.status(400).json({ error: 'Priority must be one of: low, medium, high' });
    }

    const existing = await ownedItem(req.params.id, userId, res);
    if (!existing) return;

    const updated = await prisma.wishlist.update({
      where: { id: existing.id },
      data: { priority }
    });
    res.json({ message: 'Priority updated successfully', priority: updated.priority });
  })
);

// POST /wishlist/:id/tags
router.post('/:id/tags',
  authenticateJwt,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).auth.userId;
    const { tags } = req.body;

    if (!Array.isArray(tags) || tags.length === 0) {
      return res.status(400).json({ error: 'Tags must be a non-empty array of strings' });
    }

    const validTags = tags.filter(
      t => typeof t === 'string' && t.trim().length > 0 && t.length <= 50
    );
    if (validTags.length === 0) {
      return res.status(400).json({ error: 'No valid tags provided' });
    }

    const existing = await ownedItem(req.params.id, userId, res);
    if (!existing) return;

    const updated = await prisma.wishlist.update({
      where: { id: existing.id },
      data: { tags: normaliseTags([...existing.tags, ...validTags]) }
    });

    res.json({ message: 'Tags added successfully', tags: updated.tags });
  })
);

// DELETE /wishlist/:id/tags
router.delete('/:id/tags',
  authenticateJwt,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).auth.userId;
    const { tags } = req.body;

    if (!Array.isArray(tags) || tags.length === 0) {
      return res.status(400).json({ error: 'Tags must be a non-empty array of strings' });
    }

    const existing = await ownedItem(req.params.id, userId, res);
    if (!existing) return;

    const removing = new Set(tags.map((t: string) => String(t).toLowerCase().trim()));
    const updated = await prisma.wishlist.update({
      where: { id: existing.id },
      data: { tags: existing.tags.filter(t => !removing.has(t)) }
    });

    res.json({ message: 'Tags removed successfully', tags: updated.tags });
  })
);

// GET /wishlist/check/:tripId
router.get('/check/:tripId',
  authenticateJwt,
  asyncHandler(async (req: Request, res: Response) => {
    const { tripId } = req.params;
    const userId = (req as any).auth.userId;

    if (!Types.ObjectId.isValid(tripId)) {
      return res.status(400).json({ error: 'Invalid trip ID' });
    }

    const item = await prisma.wishlist.findUnique({
      where: { userId_tripId: { userId, tripId } }
    });

    res.json({ isInWishlist: !!item, wishlistItemId: item?.id ?? null, _id: item?.id ?? null });
  })
);

router.use((error: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Wishlist route error:', error);

  if (error.name === 'CastError') {
    return res.status(400).json({ error: 'Invalid ID format' });
  }

  if (error.name === 'ValidationError') {
    const errorMessages = Object.values(error.errors)
      .map((err: any) => err.message)
      .join(', ');
    return res.status(400).json({
      error: 'Validation failed',
      details: errorMessages
    });
  }

  // Pass to global error handler
  next(error);
});

export default router;
