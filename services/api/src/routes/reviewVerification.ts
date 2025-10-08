import express, { Request, Response } from 'express';
import { auth, requireRole, AuthPayload } from '../middleware/auth';
import { Review } from '../models/Review';
import { Trip } from '../models/Trip';
import { User } from '../models/User';
import { logger } from '../utils/logger';
import mongoose from 'mongoose';

// Extend Request interface
interface AuthenticatedRequest extends Request {
  user: AuthPayload;
}

const router = express.Router();

/**
 * @route GET /api/review-verification/pending
 * @description Get pending reviews for verification
 * @access Private (Admin only)
 */
router.get('/pending', auth, requireRole(['admin']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { page = 1, limit = 20, reviewType } = req.query;
    
    const filter: any = { 
      isVerified: false,
      isRejected: { $ne: true }
    };
    
    if (reviewType && typeof reviewType === 'string') {
      filter.reviewType = reviewType;
    }

    const skip = (Number(page) - 1) * Number(limit);

    const reviews = await Review.find(filter)
      .populate('reviewerId', 'name email profilePhoto')
      .populate('targetId', 'title name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await Review.countDocuments(filter);

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

    const filter = { isFlagged: true };
    const skip = (Number(page) - 1) * Number(limit);

    const reviews = await Review.find(filter)
      .populate('reviewerId', 'name email profilePhoto')
      .populate('targetId', 'title name')
      .sort({ flaggedAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await Review.countDocuments(filter);

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
 * @route PUT /api/review-verification/:reviewId/verify
 * @description Verify a review
 * @access Private (Admin only)
 */
router.put('/:reviewId/verify', auth, requireRole(['admin']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { verificationNotes } = req.body;

    const review = await Review.findById(req.params.reviewId);
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

    // Update review verification status
    review.isVerified = true;
    review.verifiedAt = new Date();
    review.verifiedBy = new mongoose.Types.ObjectId(req.user.id);
    review.verificationNotes = verificationNotes || '';
    review.isFlagged = false; // Clear flag if it was flagged
    review.isRejected = false; // Clear rejection if it was rejected

    await review.save();

    // Update trip/organizer average rating
    const trip = await Trip.findById(review.targetId || review.tripId);
    if (trip && review.reviewType === 'trip') {
      const verifiedReviews = await Review.find({
        targetId: trip._id,
        reviewType: 'trip',
        isVerified: true
      });

      if (verifiedReviews.length > 0) {
        const totalRating = verifiedReviews.reduce((sum, r) => sum + r.rating, 0);
        trip.averageRating = totalRating / verifiedReviews.length;
        trip.reviewCount = verifiedReviews.length;
        await trip.save();

        // Update organizer's stats
        const organizer = await User.findById(trip.organizerId);
        if (organizer) {
          const allVerifiedReviews = await Review.find({
            targetId: { $in: await Trip.find({ organizerId: trip.organizerId }).distinct('_id') },
            reviewType: 'trip',
            isVerified: true
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

          if (allVerifiedReviews.length > 0) {
            const totalRating = allVerifiedReviews.reduce((sum, r) => sum + r.rating, 0);
            organizer.travelStats.averageRating = totalRating / allVerifiedReviews.length;
            organizer.travelStats.reviewCount = allVerifiedReviews.length;
            await organizer.save();
          }
        }
      }
    }

    // Populate review for response
    const populatedReview = await Review.findById(review._id)
      .populate('reviewerId', 'name email')
      .populate('verifiedBy', 'name email');

    res.json({
      success: true,
      message: 'Review verified successfully',
      data: {
        review: populatedReview,
        userId: populatedReview?.reviewerId ? (populatedReview.reviewerId as any)._id : null,
        verifiedBy: populatedReview?.verifiedBy ? (populatedReview.verifiedBy as any).name : null
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

    if (!rejectionReason) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is required'
      });
    }

    const review = await Review.findById(req.params.reviewId);
    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    // Update review rejection status
    review.isVerified = false;
    review.isRejected = true;
    review.rejectedAt = new Date();
    review.rejectedBy = new mongoose.Types.ObjectId(req.user.id);
    review.rejectionReason = rejectionReason;
    review.isFlagged = false; // Clear flag if it was flagged

    await review.save();

    // Populate review for response
    const populatedReview = await Review.findById(review._id)
      .populate('reviewerId', 'name email')
      .populate('rejectedBy', 'name email');

    res.json({
      success: true,
      message: 'Review rejected successfully',
      data: {
        review: populatedReview,
        userId: populatedReview?.reviewerId ? (populatedReview.reviewerId as any)._id : null,
        rejectedBy: populatedReview?.rejectedBy ? (populatedReview.rejectedBy as any).name : null
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

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: 'Flag reason is required'
      });
    }

    const review = await Review.findById(req.params.reviewId);
    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    // Check if user already flagged this review
    const existingFlag = review.flags?.find((flag: any) =>
      flag.userId.toString() === req.user.id
    );

    if (existingFlag) {
      return res.status(400).json({
        success: false,
        message: 'You have already flagged this review'
      });
    }

    // Initialize flags array if not exists
    if (!review.flags) {
      review.flags = [];
    }

    // Add flag
    review.flags.push({
      userId: new mongoose.Types.ObjectId(req.user.id),
      reason: reason,
      flaggedAt: new Date()
    });

    // Auto-flag if 3 or more users flag it
    if (review.flags.length >= 3) {
      review.isFlagged = true;
      review.flaggedAt = new Date();
    }

    await review.save();

    res.json({
      success: true,
      message: review.isFlagged 
        ? 'Review flagged and sent for moderation' 
        : 'Review flag submitted',
      data: {
        review: {
          _id: review._id,
          flagged: review.isFlagged,
          totalFlags: review.flags.length
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

    const review = await Review.findById(req.params.reviewId);
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

    // Unflag the review
    review.isFlagged = false;
    review.flags = []; // Clear all flags
    review.moderatedAt = new Date();
    review.moderatedBy = new mongoose.Types.ObjectId(req.user.id);
    review.moderationNotes = moderationNotes || '';

    await review.save();

    res.json({
      success: true,
      message: 'Review unflagged successfully',
      data: { review }
    });

  } catch (error: any) {
    logger.error('Error unflagging review', { error: error.message, reviewId: req.params.reviewId });
    res.status(500).json({
      success: false,
      message: 'Failed to unflag review'
    });
  }
});

/**
 * @route GET /api/review-verification/stats
 * @description Get review verification statistics
 * @access Private (Admin only)
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
      Review.countDocuments({}),
      Review.countDocuments({ isVerified: false, isRejected: { $ne: true } }),
      Review.countDocuments({ isVerified: true }),
      Review.countDocuments({ isRejected: true }),
      Review.countDocuments({ isFlagged: true })
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

    const reviews = await Review.find({ _id: { $in: reviewIds } });
    if (reviews.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No reviews found'
      });
    }

    const updateData: any = {};
    const adminId = new mongoose.Types.ObjectId(req.user.id);

    switch (action) {
      case 'verify':
        updateData.isVerified = true;
        updateData.verifiedAt = new Date();
        updateData.verifiedBy = adminId;
        updateData.verificationNotes = notes || '';
        updateData.isFlagged = false;
        updateData.isRejected = false;
        break;

      case 'reject':
        if (!reason) {
          return res.status(400).json({
            success: false,
            message: 'Rejection reason is required for bulk reject'
          });
        }
        updateData.isVerified = false;
        updateData.isRejected = true;
        updateData.rejectedAt = new Date();
        updateData.rejectedBy = adminId;
        updateData.rejectionReason = reason;
        updateData.isFlagged = false;
        break;

      case 'unflag':
        updateData.isFlagged = false;
        updateData.flags = [];
        updateData.moderatedAt = new Date();
        updateData.moderatedBy = adminId;
        updateData.moderationNotes = notes || '';
        break;
    }

    const result = await Review.updateMany(
      { _id: { $in: reviewIds } },
      { $set: updateData }
    );

    res.json({
      success: true,
      message: `Bulk ${action} completed successfully`,
      data: {
        processed: result.modifiedCount,
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

    const reviews = await Review.find({ reviewerId: req.params.userId })
      .populate('targetId', 'title name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await Review.countDocuments({ reviewerId: req.params.userId });
    const verifiedCount = await Review.countDocuments({ 
      reviewerId: req.params.userId, 
      isVerified: true 
    });
    const flaggedCount = await Review.countDocuments({ 
      reviewerId: req.params.userId, 
      isFlagged: true 
    });

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

export default router;