import express, { Request, Response } from 'express';
import { auth, requireRole, AuthPayload } from '../middleware/auth';
import { Prisma, ReviewType } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { Trip } from '../models/Trip';
import { User } from '../models/User';
import { logger } from '../utils/logger';
import mongoose from 'mongoose';

import { AuthenticatedRequest } from '../types/app-types';

/**
 * Review moderation against Postgres (D10/D11, wave 2).
 *
 * Flags were an array of objects on the review document, and this file already
 * checked "has this user flagged already" in application code - so the
 * uniqueness was intended, it just was not enforced. Flags are rows in
 * review_flags now with one-per-user as a constraint, and the auto-flag
 * threshold counts those rows.
 *
 * Reviewer and target details still come from Mongo, so the populate() calls
 * became explicit lookups. targetId points at either a Trip or a User depending
 * on reviewType, which populate() could never express correctly anyway - it was
 * given a single ref and quietly returned nothing for half the rows.
 */

const router = express.Router();

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Attach reviewer, target and flag count from wherever each actually lives.
 * targetId is a Trip for reviewType 'trip' and a User for 'organizer'.
 */
async function decorate(rows: any[]) {
  if (rows.length === 0) return [];

  const reviewerIds = rows.map(r => r.reviewerId);
  const adminIds = rows.flatMap(r => [r.verifiedBy, r.rejectedBy, r.moderatedBy].filter(Boolean));
  const tripTargets = rows.filter(r => r.reviewType === 'trip').map(r => r.targetId);
  const userTargets = rows.filter(r => r.reviewType === 'organizer').map(r => r.targetId);

  const [people, trips] = await Promise.all([
    User.find({ _id: { $in: [...reviewerIds, ...adminIds, ...userTargets] } })
      .select('name email profilePhoto')
      .lean(),
    tripTargets.length
      ? Trip.find({ _id: { $in: tripTargets } }).select('title').lean()
      : Promise.resolve([])
  ]);

  const personById = new Map(people.map((u: any) => [u._id.toString(), u]));
  const tripById = new Map(trips.map((t: any) => [t._id.toString(), t]));

  return rows.map(r => {
    const { _count, ...rest } = r;
    return {
      ...rest,
      reviewer: personById.get(r.reviewerId) ?? null,
      target: r.reviewType === 'trip'
        ? tripById.get(r.targetId) ?? null
        : personById.get(r.targetId) ?? null,
      verifiedByUser: r.verifiedBy ? personById.get(r.verifiedBy) ?? null : null,
      rejectedByUser: r.rejectedBy ? personById.get(r.rejectedBy) ?? null : null,
      totalFlags: _count?.flags ?? 0
    };
  });
}

/**
 * @route GET /api/review-verification/pending
 * @description Get pending reviews for verification
 * @access Private (Admin only)
 */
router.get('/pending', auth, requireRole(['admin']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { page = 1, limit = 20, reviewType } = req.query;

    const where: Prisma.ReviewWhereInput = { isVerified: false, isRejected: false };
    if (reviewType && typeof reviewType === 'string') {
      where.reviewType = reviewType as ReviewType;
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [rows, total] = await Promise.all([
      prisma.review.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: Number(limit),
        include: { _count: { select: { flags: true } } }
      }),
      prisma.review.count({ where })
    ]);

    const reviews = await decorate(rows);

    res.json({
      success: true,
      data: {
        reviews,
        pagination: {
          current: Number(page),
          total: Math.ceil(total / Number(limit)),
          count: reviews.length,
          totalReviews: total
        }
      }
    });

  } catch (error: any) {
    logger.error('Error fetching pending reviews', { error: error.message, userId: req.user.id });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pending reviews'
    });
  }
});

/**
 * @route GET /api/review-verification/flagged
 * @description Get flagged reviews for moderation
 * @access Private (Admin only)
 */
router.get('/flagged', auth, requireRole(['admin']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    const where: Prisma.ReviewWhereInput = { isFlagged: true };
    const skip = (Number(page) - 1) * Number(limit);

    const [rows, total] = await Promise.all([
      prisma.review.findMany({
        where,
        orderBy: { flaggedAt: 'desc' },
        skip,
        take: Number(limit),
        include: { _count: { select: { flags: true } } }
      }),
      prisma.review.count({ where })
    ]);

    const reviews = await decorate(rows);

    res.json({
      success: true,
      data: {
        reviews,
        pagination: {
          current: Number(page),
          total: Math.ceil(total / Number(limit)),
          count: reviews.length,
          totalReviews: total
        }
      }
    });

  } catch (error: any) {
    logger.error('Error fetching flagged reviews', { error: error.message, userId: req.user.id });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch flagged reviews'
    });
  }
});

/**
 * @route GET /api/review-verification/stats
 * @description Get review verification statistics
 * @access Private (Admin only)
 *
 * Declared before /:reviewId routes only for grouping - the paths differ in
 * shape, so there was no collision to avoid.
 */
router.get('/stats', auth, requireRole(['admin']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const [
      totalReviews,
      pendingReviews,
      verifiedReviews,
      rejectedReviews,
      flaggedReviews
    ] = await Promise.all([
      prisma.review.count({}),
      prisma.review.count({ where: { isVerified: false, isRejected: false } }),
      prisma.review.count({ where: { isVerified: true } }),
      prisma.review.count({ where: { isRejected: true } }),
      prisma.review.count({ where: { isFlagged: true } })
    ]);

    const stats = {
      totalReviews,
      pendingReviews,
      verifiedReviews,
      rejectedReviews,
      flaggedReviews,
      verificationRate: totalReviews > 0 ? ((verifiedReviews / totalReviews) * 100).toFixed(1) : '0.0',
      rejectionRate: totalReviews > 0 ? ((rejectedReviews / totalReviews) * 100).toFixed(1) : '0.0'
    };

    res.json({
      success: true,
      data: { stats }
    });

  } catch (error: any) {
    logger.error('Error fetching review stats', { error: error.message, userId: req.user.id });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch review statistics'
    });
  }
});

/**
 * @route PUT /api/review-verification/bulk-action
 * @description Perform bulk actions on reviews
 * @access Private (Admin only)
 */
router.put('/bulk-action', auth, requireRole(['admin']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { reviewIds, action, reason, notes } = req.body;

    if (!reviewIds || !Array.isArray(reviewIds) || reviewIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Review IDs array is required'
      });
    }

    if (!['verify', 'reject', 'unflag'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid action. Use verify, reject, or unflag'
      });
    }

    const ids: string[] = reviewIds.filter((id: any) => typeof id === 'string' && UUID.test(id));

    const found = await prisma.review.count({ where: { id: { in: ids } } });
    if (found === 0) {
      return res.status(404).json({
        success: false,
        message: 'No reviews found'
      });
    }

    const adminId = req.user.id;
    const data: Prisma.ReviewUpdateManyMutationInput = {};

    switch (action) {
      case 'verify':
        data.isVerified = true;
        data.verifiedAt = new Date();
        data.verifiedBy = adminId;
        data.verificationNotes = notes || '';
        data.isFlagged = false;
        data.isRejected = false;
        break;

      case 'reject':
        if (!reason) {
          return res.status(400).json({
            success: false,
            message: 'Rejection reason is required for bulk reject'
          });
        }
        data.isVerified = false;
        data.isRejected = true;
        data.rejectedAt = new Date();
        data.rejectedBy = adminId;
        data.rejectionReason = reason;
        data.isFlagged = false;
        break;

      case 'unflag':
        data.isFlagged = false;
        data.moderatedAt = new Date();
        data.moderatedBy = adminId;
        data.moderationNotes = notes || '';
        break;
    }

    // Flags are rows now, so clearing them is a delete rather than setting the
    // field to []. Done first, so a failure leaves the reviews still flagged
    // rather than unflagged with their evidence gone.
    if (action === 'unflag') {
      await prisma.reviewFlag.deleteMany({ where: { reviewId: { in: ids } } });
    }

    const result = await prisma.review.updateMany({ where: { id: { in: ids } }, data });

    res.json({
      success: true,
      message: `Bulk ${action} completed successfully`,
      data: {
        processed: result.count,
        total: reviewIds.length
      }
    });

  } catch (error: any) {
    logger.error('Error performing bulk action', { error: error.message, userId: req.user.id });
    res.status(500).json({
      success: false,
      message: 'Failed to perform bulk action'
    });
  }
});

/**
 * @route GET /api/review-verification/user-activity/:userId
 * @description Get user's review activity for verification
 * @access Private (Admin only)
 */
router.get('/user-activity/:userId', auth, requireRole(['admin']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const user = await User.findById(req.params.userId).select('name email');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const reviewerId = req.params.userId;

    const [rows, total, verifiedCount, flaggedCount] = await Promise.all([
      prisma.review.findMany({
        where: { reviewerId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: Number(limit),
        include: { _count: { select: { flags: true } } }
      }),
      prisma.review.count({ where: { reviewerId } }),
      prisma.review.count({ where: { reviewerId, isVerified: true } }),
      prisma.review.count({ where: { reviewerId, isFlagged: true } })
    ]);

    const reviews = await decorate(rows);

    res.json({
      success: true,
      data: {
        user: {
          _id: user._id,
          name: user.name,
          email: user.email
        },
        reviews,
        stats: {
          totalReviews: total,
          verifiedReviews: verifiedCount,
          flaggedReviews: flaggedCount,
          verificationRate: total > 0 ? ((verifiedCount / total) * 100).toFixed(1) : '0.0'
        },
        pagination: {
          current: Number(page),
          total: Math.ceil(total / Number(limit)),
          count: reviews.length,
          totalReviews: total
        }
      }
    });

  } catch (error: any) {
    logger.error('Error fetching user activity', { error: error.message, userId: req.params.userId });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user activity'
    });
  }
});

/**
 * @route PUT /api/review-verification/:reviewId/verify
 * @description Verify a review
 * @access Private (Admin only)
 */
router.put('/:reviewId/verify', auth, requireRole(['admin']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { verificationNotes } = req.body;
    const reviewId = req.params.reviewId;

    if (!UUID.test(reviewId)) {
      return res.status(404).json({ success: false, message: 'Review not found' });
    }

    const review = await prisma.review.findUnique({ where: { id: reviewId } });
    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    if (review.isVerified) {
      return res.status(400).json({
        success: false,
        message: 'Review is already verified'
      });
    }

    const updated = await prisma.review.update({
      where: { id: reviewId },
      data: {
        isVerified: true,
        verifiedAt: new Date(),
        verifiedBy: req.user.id,
        verificationNotes: verificationNotes || '',
        isFlagged: false,
        isRejected: false
      },
      include: { _count: { select: { flags: true } } }
    });

    // Roll the trip and organizer averages forward. Both still live in Mongo,
    // so the ratings are aggregated in Postgres and written across.
    const trip = await Trip.findById(review.targetId || review.tripId);
    if (trip && review.reviewType === 'trip') {
      const tripAgg = await prisma.review.aggregate({
        where: { targetId: String(trip._id), reviewType: 'trip', isVerified: true },
        _avg: { rating: true },
        _count: { rating: true }
      });

      if (tripAgg._count.rating > 0) {
        trip.averageRating = tripAgg._avg.rating ?? 0;
        trip.reviewCount = tripAgg._count.rating;
        await trip.save();

        const organizer = await User.findById(trip.organizerId);
        if (organizer) {
          const organizerTripIds = (await Trip.find({ organizerId: trip.organizerId }).distinct('_id'))
            .map((id: any) => String(id));

          const orgAgg = await prisma.review.aggregate({
            where: { targetId: { in: organizerTripIds }, reviewType: 'trip', isVerified: true },
            _avg: { rating: true },
            _count: { rating: true }
          });

          if (!organizer.travelStats) {
            organizer.travelStats = {
              tripsCompleted: 0,
              totalDistance: 0,
              favoriteDestinations: [],
              badges: [],
              reviewCount: 0,
              averageRating: 0
            };
          }

          if (orgAgg._count.rating > 0) {
            organizer.travelStats.averageRating = orgAgg._avg.rating ?? 0;
            organizer.travelStats.reviewCount = orgAgg._count.rating;
            await organizer.save();
          }
        }
      }
    }

    const [decorated] = await decorate([updated]);

    res.json({
      success: true,
      message: 'Review verified successfully',
      data: {
        review: decorated,
        userId: updated.reviewerId,
        verifiedBy: decorated?.verifiedByUser?.name ?? null
      }
    });

  } catch (error: any) {
    logger.error('Error verifying review', { error: error.message, reviewId: req.params.reviewId });
    res.status(500).json({
      success: false,
      message: 'Failed to verify review'
    });
  }
});

/**
 * @route PUT /api/review-verification/:reviewId/reject
 * @description Reject a review
 * @access Private (Admin only)
 */
router.put('/:reviewId/reject', auth, requireRole(['admin']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { rejectionReason } = req.body;
    const reviewId = req.params.reviewId;

    if (!rejectionReason) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is required'
      });
    }

    if (!UUID.test(reviewId)) {
      return res.status(404).json({ success: false, message: 'Review not found' });
    }

    const review = await prisma.review.findUnique({ where: { id: reviewId } });
    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    const updated = await prisma.review.update({
      where: { id: reviewId },
      data: {
        isVerified: false,
        isRejected: true,
        rejectedAt: new Date(),
        rejectedBy: req.user.id,
        rejectionReason,
        isFlagged: false
      },
      include: { _count: { select: { flags: true } } }
    });

    const [decorated] = await decorate([updated]);

    res.json({
      success: true,
      message: 'Review rejected successfully',
      data: {
        review: decorated,
        userId: updated.reviewerId,
        rejectedBy: decorated?.rejectedByUser?.name ?? null
      }
    });

  } catch (error: any) {
    logger.error('Error rejecting review', { error: error.message, reviewId: req.params.reviewId });
    res.status(500).json({
      success: false,
      message: 'Failed to reject review'
    });
  }
});

/**
 * @route POST /api/review-verification/:reviewId/flag
 * @description Flag a review for inappropriate content
 * @access Private
 */
router.post('/:reviewId/flag', auth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { reason } = req.body;
    const reviewId = req.params.reviewId;

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: 'Flag reason is required'
      });
    }

    if (!UUID.test(reviewId)) {
      return res.status(404).json({ success: false, message: 'Review not found' });
    }

    const review = await prisma.review.findUnique({ where: { id: reviewId } });
    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    // One flag per user is a constraint now, so the insert decides rather than
    // a find-then-check that two concurrent requests could both pass.
    try {
      await prisma.reviewFlag.create({
        data: { reviewId, userId: req.user.id, reason }
      });
    } catch (err: any) {
      if (err?.code === 'P2002') {
        return res.status(400).json({
          success: false,
          message: 'You have already flagged this review'
        });
      }
      throw err;
    }

    const totalFlags = await prisma.reviewFlag.count({ where: { reviewId } });

    let isFlagged = review.isFlagged;
    if (totalFlags >= 3 && !isFlagged) {
      await prisma.review.update({
        where: { id: reviewId },
        data: { isFlagged: true, flaggedAt: new Date() }
      });
      isFlagged = true;
    }

    res.json({
      success: true,
      message: isFlagged
        ? 'Review flagged and sent for moderation'
        : 'Review flag submitted',
      data: {
        review: {
          _id: reviewId,
          flagged: isFlagged,
          totalFlags
        }
      }
    });

  } catch (error: any) {
    logger.error('Error flagging review', { error: error.message, reviewId: req.params.reviewId });
    res.status(500).json({
      success: false,
      message: 'Failed to flag review'
    });
  }
});

/**
 * @route PUT /api/review-verification/:reviewId/unflag
 * @description Unflag a review (Admin only)
 * @access Private (Admin only)
 */
router.put('/:reviewId/unflag', auth, requireRole(['admin']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { moderationNotes } = req.body;
    const reviewId = req.params.reviewId;

    if (!UUID.test(reviewId)) {
      return res.status(404).json({ success: false, message: 'Review not found' });
    }

    const review = await prisma.review.findUnique({ where: { id: reviewId } });
    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    if (!review.isFlagged) {
      return res.status(400).json({
        success: false,
        message: 'Review is not flagged'
      });
    }

    // Delete the flag rows first: if this fails, the review stays flagged with
    // its evidence intact, rather than unflagged with the reasons already gone.
    await prisma.reviewFlag.deleteMany({ where: { reviewId } });

    const updated = await prisma.review.update({
      where: { id: reviewId },
      data: {
        isFlagged: false,
        moderatedAt: new Date(),
        moderatedBy: req.user.id,
        moderationNotes: moderationNotes || ''
      },
      include: { _count: { select: { flags: true } } }
    });

    const [decorated] = await decorate([updated]);

    res.json({
      success: true,
      message: 'Review unflagged successfully',
      data: { review: decorated }
    });

  } catch (error: any) {
    logger.error('Error unflagging review', { error: error.message, reviewId: req.params.reviewId });
    res.status(500).json({
      success: false,
      message: 'Failed to unflag review'
    });
  }
});

export default router;
