import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Types } from 'mongoose';
import { Prisma, ReviewType, ReviewTag } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { isParticipant } from '../services/tripParticipationService';
import { UserPrisma as User } from '../models/userPrismaAdapter';
import { authenticateJwt } from '../middleware/auth';
import { withMongoId, asPopulated } from '../lib/apiShape';

/**
 * Reviews live in Postgres (D10/D11, wave 2). Trip and User are still in Mongo,
 * so reviewer_id / target_id / trip_id hold ObjectId strings with no FK.
 *
 * What changed:
 *
 *  1. "One review per reviewer per target per type" was a pre-save hook doing
 *     findOne-then-throw. Two concurrent requests both passed it, and any write
 *     that skipped .save() ignored it entirely. It is a unique constraint now,
 *     and the 409 comes from catching P2002.
 *
 *  2. helpfulVotes was a number kept in step by hand with a helpfulVoters array.
 *     Both are gone: votes are rows in review_helpful_votes with one-per-user
 *     enforced, and the number is counted from them.
 *
 *  3. Review ids are UUIDs, so the ObjectId guards on :id became UUID guards.
 *     The guards on targetId stay ObjectId checks - trips and users are still
 *     Mongo documents.
 *
 *  4. tags are an enum. The Mongoose schema listed the same closed set, but a
 *     value outside it was stored happily and then silently matched no filter.
 */

const router = Router();

const REVIEW_TAGS: ReviewTag[] = [
  'safety', 'value_for_money', 'organization', 'communication',
  'accommodation', 'food', 'activities', 'guide_quality',
  'group_size', 'timing', 'location', 'equipment'
];

/** The API speaks 'value-for-money'; a Postgres enum label cannot hold a hyphen. */
const toTag = (s: string): ReviewTag | null => {
  const candidate = s.toLowerCase().trim().replace(/-/g, '_') as ReviewTag;
  return REVIEW_TAGS.includes(candidate) ? candidate : null;
};
const fromTag = (t: ReviewTag): string => t.replace(/_/g, '-');

const createReviewSchema = z.object({
  // Was an ObjectId regex, which rejected every real target once ids became
  // uuids — no review could be created at all. Ids are text columns, so a
  // wrong one simply finds nothing rather than erroring.
  targetId: z.string().min(1, 'targetId is required'),
  reviewType: z.enum(['trip', 'organizer']),
  rating: z.number().int().min(1).max(5),
  title: z.string().min(5).max(100).trim(),
  comment: z.string().min(10).max(1000).trim(),
  images: z.array(z.string().url()).optional(),
  tags: z.array(z.string()).optional(),
  tripDate: z.string().datetime().optional()
});

const updateReviewSchema = createReviewSchema.partial().omit({
  targetId: true,
  reviewType: true
});

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

const validateReviewPermission = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { targetId, reviewType } = req.body;
    const userId = (req as any).auth.userId;

    if (reviewType === 'trip') {
      const trip = await prisma.trip.findUnique({
        where: { id: targetId },
        select: { endDate: true }
      });
      if (!trip) {
        return res.status(404).json({ error: 'Trip not found' });
      }

      // `trip.participants.includes(new Types.ObjectId(userId))` was false for
      // every caller: two ObjectId instances holding the same value are not
      // equal under SameValueZero, so a freshly constructed one never matches
      // anything in the array. This is the fourth place that idiom appears, and
      // the consequence here is that nobody has ever been able to review a trip
      // they went on - the route answered 403 to everyone.
      const participated = await isParticipant(targetId, userId);
      if (!participated) {
        return res.status(403).json({ error: 'You can only review trips you have participated in' });
      }

      if (trip.endDate > new Date()) {
        return res.status(400).json({ error: 'You can only review trips after they have ended' });
      }
    } else if (reviewType === 'organizer') {
      const organizer = await User.findById(targetId);
      if (!organizer || organizer.role !== 'organizer') {
        return res.status(404).json({ error: 'Organizer not found' });
      }

      // This one worked: a find() on an ObjectId array casts the string, unlike
      // the in-memory includes() above.
      const hasBookedTrips = await prisma.trip.findFirst({
        where: {
          organizerId: targetId,
          participants: { some: { userId } },
          endDate: { lt: new Date() }
        }
      });

      if (!hasBookedTrips) {
        return res.status(403).json({
          error: 'You can only review organizers whose trips you have completed'
        });
      }
    }

    next();
  } catch (error) {
    next(error);
  }
};

/** Attach reviewer details from Mongo and the derived helpful-vote count. */
async function shapeReviews(rows: any[]) {
  if (rows.length === 0) return [];

  const reviewers = await User.find({ _id: { $in: rows.map(r => r.reviewerId) } })
    .select('name email')
    .lean();
  const byId = new Map<string, any>(reviewers.map((u: any) => [u._id.toString(), u]));

  // ReviewsList.tsx reads review._id and review.reviewerId.name, so the
  // response keeps both: _id beside id, and the reviewer populated under the
  // key it used to arrive on.
  return rows.map(r => {
    const { _count, ...rest } = r;
    const reviewer = byId.get(r.reviewerId) ?? null;
    return {
      ...withMongoId(rest),
      tags: (r.tags ?? []).map(fromTag),
      reviewerId: asPopulated(reviewer),
      reviewer,
      helpfulVotes: _count?.helpfulVotes ?? 0,
      organizerResponse: r.organizerResponseMessage
        ? { message: r.organizerResponseMessage, respondedAt: r.organizerResponseRespondedAt }
        : undefined
    };
  });
}

// GET /reviews
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const {
    targetId, reviewType, rating,
    sortBy = 'createdAt', sortOrder = 'desc',
    page = '1', limit = '10',
    search, tags, verified
  } = req.query;

  const where: Prisma.ReviewWhereInput = {};

  if (targetId) where.targetId = targetId as string;
  if (reviewType) where.reviewType = reviewType as ReviewType;
  if (rating) where.rating = parseInt(rating as string);
  if (verified === 'true') where.isVerified = true;

  if (tags) {
    const wanted = (tags as string).split(',').map(toTag).filter(Boolean) as ReviewTag[];
    // An unknown tag matched nothing before rather than being ignored, so an
    // all-unknown list still returns nothing rather than dropping the filter.
    where.tags = { hasSome: wanted };
  }

  if (search) {
    // Was a Mongo $text search over title, comment and tags. Postgres carries
    // the GIN index on title + comment; this is the query that reaches it.
    where.OR = [
      { title: { contains: search as string, mode: 'insensitive' } },
      { comment: { contains: search as string, mode: 'insensitive' } }
    ];
  }

  const pageNum = parseInt(page as string) || 1;
  const limitNum = parseInt(limit as string) || 10;
  const skip = (pageNum - 1) * limitNum;

  const sortable = ['createdAt', 'updatedAt', 'rating'];
  const sortField = sortable.includes(sortBy as string) ? (sortBy as string) : 'createdAt';
  const direction = sortOrder === 'asc' ? 'asc' : 'desc';

  const [rows, totalCount] = await Promise.all([
    prisma.review.findMany({
      where,
      orderBy: { [sortField]: direction },
      skip,
      take: limitNum,
      include: { _count: { select: { helpfulVotes: true } } }
    }),
    prisma.review.count({ where })
  ]);

  res.json({
    reviews: await shapeReviews(rows),
    pagination: {
      currentPage: pageNum,
      totalPages: Math.ceil(totalCount / limitNum),
      totalReviews: totalCount,
      hasNextPage: pageNum * limitNum < totalCount,
      hasPrevPage: pageNum > 1
    }
  });
}));

// GET /reviews/stats/:targetId/:reviewType
router.get('/stats/:targetId/:reviewType', asyncHandler(async (req: Request, res: Response) => {
  const { targetId, reviewType } = req.params;

  // Same removal as above: this answered 400 for every real trip and organizer,
  // on the live site, for as long as ids have been uuids.

  if (!['trip', 'organizer'].includes(reviewType)) {
    return res.status(400).json({ error: 'Invalid review type' });
  }

  // Was Review.calculateAverageRating, a $group aggregation. Same shape, and
  // still counted over verified reviews only.
  const where = { targetId, reviewType: reviewType as ReviewType, isVerified: true };

  const grouped = await prisma.review.groupBy({
    by: ['rating'],
    where,
    _count: { rating: true }
  });

  const ratingDistribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let totalReviews = 0;
  let ratingSum = 0;

  for (const g of grouped) {
    ratingDistribution[g.rating] = g._count.rating;
    totalReviews += g._count.rating;
    ratingSum += g.rating * g._count.rating;
  }

  res.json({
    averageRating: totalReviews > 0 ? Math.round((ratingSum / totalReviews) * 10) / 10 : 0,
    totalReviews,
    ratingDistribution
  });
}));

// POST /reviews
router.post('/',
  authenticateJwt,
  asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const parsed = createReviewSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    }
    req.body = parsed.data;
    next();
  }),
  validateReviewPermission,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).auth.userId;
    const { targetId, reviewType, rating, title, comment, images, tags, tripDate } = req.body;

    const mappedTags: (ReviewTag | null)[] = (tags ?? []).map(toTag);
    if (mappedTags.some(t => t === null)) {
      return res.status(400).json({
        error: 'Unknown review tag',
        details: 'Allowed tags: ' + REVIEW_TAGS.map(fromTag).join(', ')
      });
    }

    try {
      const review = await prisma.review.create({
        data: {
          reviewerId: userId,
          targetId,
          reviewType,
          rating,
          title,
          comment,
          images: images ?? [],
          tags: mappedTags as ReviewTag[],
          tripDate: tripDate ? new Date(tripDate) : null,
          isVerified: true // permissions were checked above
        },
        include: { _count: { select: { helpfulVotes: true } } }
      });

      const [shaped] = await shapeReviews([review]);
      res.status(201).json({ message: 'Review created successfully', review: shaped });
    } catch (error: any) {
      if (error?.code === 'P2002') {
        return res.status(409).json({ error: 'You have already reviewed this ' + reviewType });
      }
      throw error;
    }
  })
);

// PUT /reviews/:id
router.put('/:id',
  authenticateJwt,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = (req as any).auth.userId;

    if (!UUID.test(id)) {
      return res.status(400).json({ error: 'Invalid review ID' });
    }

    const parsed = updateReviewSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    }

    const review = await prisma.review.findUnique({ where: { id } });
    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }

    if (review.reviewerId !== userId) {
      return res.status(403).json({ error: 'You can only update your own reviews' });
    }

    const data: Prisma.ReviewUpdateInput = {};
    if (parsed.data.rating !== undefined) data.rating = parsed.data.rating;
    if (parsed.data.title !== undefined) data.title = parsed.data.title;
    if (parsed.data.comment !== undefined) data.comment = parsed.data.comment;
    if (parsed.data.images !== undefined) data.images = parsed.data.images;
    if (parsed.data.tripDate !== undefined) data.tripDate = new Date(parsed.data.tripDate);

    if (parsed.data.tags !== undefined) {
      const mapped = parsed.data.tags.map(toTag);
      if (mapped.some(t => t === null)) {
        return res.status(400).json({
          error: 'Unknown review tag',
          details: 'Allowed tags: ' + REVIEW_TAGS.map(fromTag).join(', ')
        });
      }
      data.tags = mapped as ReviewTag[];
    }

    const updated = await prisma.review.update({
      where: { id },
      data,
      include: { _count: { select: { helpfulVotes: true } } }
    });

    const [shaped] = await shapeReviews([updated]);
    res.json({ message: 'Review updated successfully', review: shaped });
  })
);

// DELETE /reviews/:id
router.delete('/:id',
  authenticateJwt,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = (req as any).auth.userId;
    const userRole = (req as any).auth.role;

    if (!UUID.test(id)) {
      return res.status(400).json({ error: 'Invalid review ID' });
    }

    const review = await prisma.review.findUnique({ where: { id } });
    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }

    if (review.reviewerId !== userId && userRole !== 'admin') {
      return res.status(403).json({ error: 'You can only delete your own reviews' });
    }

    // Helpful votes and flags go with it - the foreign keys cascade.
    await prisma.review.delete({ where: { id } });

    res.json({ message: 'Review deleted successfully' });
  })
);

// POST /reviews/:id/helpful
router.post('/:id/helpful',
  authenticateJwt,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = (req as any).auth.userId;

    if (!UUID.test(id)) {
      return res.status(400).json({ error: 'Invalid review ID' });
    }

    const review = await prisma.review.findUnique({ where: { id } });
    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }

    if (review.reviewerId === userId) {
      return res.status(400).json({ error: 'You cannot vote on your own review' });
    }

    // Was markAsHelpful, which pushed to an array and adjusted a counter beside
    // it. One vote per user is the constraint now, and the count is derived.
    const existing = await prisma.reviewHelpfulVote.findUnique({
      where: { reviewId_userId: { reviewId: id, userId } }
    });

    if (existing) {
      await prisma.reviewHelpfulVote.delete({ where: { id: existing.id } });
    } else {
      try {
        await prisma.reviewHelpfulVote.create({ data: { reviewId: id, userId } });
      } catch (err: any) {
        if (err?.code !== 'P2002') throw err;
      }
    }

    const helpfulVotes = await prisma.reviewHelpfulVote.count({ where: { reviewId: id } });

    res.json({ message: 'Vote recorded successfully', helpfulVotes });
  })
);

// POST /reviews/:id/respond
router.post('/:id/respond',
  authenticateJwt,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = (req as any).auth.userId;
    const userRole = (req as any).auth.role;
    const { message } = req.body;

    if (userRole !== 'organizer') {
      return res.status(403).json({ error: 'Only organizers can respond to reviews' });
    }

    if (!message || message.trim().length < 5) {
      return res.status(400).json({ error: 'Response message is required (minimum 5 characters)' });
    }

    if (!UUID.test(id)) {
      return res.status(400).json({ error: 'Invalid review ID' });
    }

    const review = await prisma.review.findUnique({ where: { id } });
    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }

    if (review.reviewType === 'organizer') {
      if (review.targetId !== userId) {
        return res.status(403).json({ error: 'You can only respond to reviews about yourself' });
      }
    } else if (review.reviewType === 'trip') {
      const trip = await prisma.trip.findUnique({
        where: { id: review.targetId },
        select: { organizerId: true }
      });
      if (!trip || trip.organizerId !== userId) {
        return res.status(403).json({ error: 'You can only respond to reviews of your trips' });
      }
    }

    const respondedAt = new Date();
    await prisma.review.update({
      where: { id },
      data: {
        organizerResponseMessage: message.trim(),
        organizerResponseRespondedAt: respondedAt
      }
    });

    res.json({
      message: 'Response added successfully',
      response: { message: message.trim(), respondedAt }
    });
  })
);

router.use((error: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Review route error:', error);

  if (error.name === 'CastError') {
    return res.status(400).json({ error: 'Invalid ID format' });
  }

  if (error.name === 'ValidationError') {
    const errorMessages = Object.values(error.errors)
      .map((err: any) => err.message)
      .join(', ');
    return res.status(400).json({ error: 'Validation failed', details: errorMessages });
  }

  // Pass to global error handler
  next(error);
});

export default router;
