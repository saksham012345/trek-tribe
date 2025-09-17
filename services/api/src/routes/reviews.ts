import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Types } from 'mongoose';
import { Review, ReviewType } from '../models/Review';
import { Trip } from '../models/Trip';
import { User } from '../models/User';
import { authenticateJwt } from '../middleware/auth';

// Node.js Concept: Express Router for modular route handling
const router = Router();

// Node.js Concept: Input validation using Zod schemas
const createReviewSchema = z.object({
  targetId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ObjectId'),
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

// Node.js Concept: Custom middleware for validation and permissions
const validateReviewPermission = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { targetId, reviewType } = req.body;
    const userId = (req as any).auth.userId;

    if (reviewType === 'trip') {
      // Check if user participated in the trip
      const trip = await Trip.findById(targetId);
      if (!trip) {
        return res.status(404).json({ error: 'Trip not found' });
      }

      const participated = trip.participants.includes(new Types.ObjectId(userId));
      if (!participated) {
        return res.status(403).json({ 
          error: 'You can only review trips you have participated in' 
        });
      }

      // Check if trip has ended
      if (trip.endDate > new Date()) {
        return res.status(400).json({ 
          error: 'You can only review trips after they have ended' 
        });
      }
    } else if (reviewType === 'organizer') {
      // Check if user has booked trips with this organizer
      const organizer = await User.findById(targetId);
      if (!organizer || organizer.role !== 'organizer') {
        return res.status(404).json({ error: 'Organizer not found' });
      }

      const hasBookedTrips = await Trip.findOne({
        organizerId: targetId,
        participants: userId,
        endDate: { $lt: new Date() } // Only completed trips
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

// Node.js Concept: Async error handling wrapper
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// GET /reviews - Get reviews with advanced filtering and pagination
// Node.js Concept: Query parameter handling and database aggregation
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const {
    targetId,
    reviewType,
    rating,
    sortBy = 'createdAt',
    sortOrder = 'desc',
    page = '1',
    limit = '10',
    search,
    tags,
    verified
  } = req.query;

  // Build filter object
  const filter: any = {};
  
  if (targetId) filter.targetId = new Types.ObjectId(targetId as string);
  if (reviewType) filter.reviewType = reviewType;
  if (rating) filter.rating = parseInt(rating as string);
  if (verified === 'true') filter.isVerified = true;
  if (tags) filter.tags = { $in: (tags as string).split(',') };
  
  // Text search
  if (search) {
    filter.$text = { $search: search as string };
  }

  // Pagination
  const pageNum = parseInt(page as string);
  const limitNum = parseInt(limit as string);
  const skip = (pageNum - 1) * limitNum;

  // Sorting
  const sort: any = {};
  sort[sortBy as string] = sortOrder === 'desc' ? -1 : 1;

  // Node.js Concept: Promise.all for parallel operations
  const [reviews, totalCount] = await Promise.all([
    Review.find(filter)
      .populate('reviewerId', 'name email')
      .sort(sort)
      .skip(skip)
      .limit(limitNum)
      .lean(),
    Review.countDocuments(filter)
  ]);

  res.json({
    reviews,
    pagination: {
      currentPage: pageNum,
      totalPages: Math.ceil(totalCount / limitNum),
      totalReviews: totalCount,
      hasNextPage: pageNum * limitNum < totalCount,
      hasPrevPage: pageNum > 1
    }
  });
}));

// GET /reviews/stats/:targetId/:reviewType - Get rating statistics
router.get('/stats/:targetId/:reviewType', asyncHandler(async (req: Request, res: Response) => {
  const { targetId, reviewType } = req.params;

  if (!Types.ObjectId.isValid(targetId)) {
    return res.status(400).json({ error: 'Invalid target ID' });
  }

  if (!['trip', 'organizer'].includes(reviewType)) {
    return res.status(400).json({ error: 'Invalid review type' });
  }

  const stats = await Review.calculateAverageRating(
    new Types.ObjectId(targetId),
    reviewType as ReviewType
  );

  res.json(stats);
}));

// POST /reviews - Create a new review
// Node.js Concept: Middleware chaining and request validation
router.post('/', 
  authenticateJwt, 
  asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    // Validate input
    const parsed = createReviewSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: parsed.error.flatten() 
      });
    }
    
    req.body = parsed.data;
    next();
  }),
  validateReviewPermission,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).auth.userId;
    const reviewData = {
      ...req.body,
      reviewerId: userId,
      targetId: new Types.ObjectId(req.body.targetId),
      tripDate: req.body.tripDate ? new Date(req.body.tripDate) : undefined,
      isVerified: true // Auto-verify since we checked permissions
    };

    // Node.js Concept: Error handling in async operations
    try {
      const review = new Review(reviewData);
      await review.save();
      
      // Populate reviewer info before sending response
      await review.populate('reviewerId', 'name email');
      
      res.status(201).json({ 
        message: 'Review created successfully',
        review 
      });
    } catch (error: any) {
      if (error.code === 11000) {
        return res.status(409).json({ 
          error: 'You have already reviewed this ' + req.body.reviewType 
        });
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
      
      throw error; // Re-throw for global error handler
    }
  })
);

// PUT /reviews/:id - Update a review
router.put('/:id', 
  authenticateJwt,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = (req as any).auth.userId;

    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid review ID' });
    }

    // Validate input
    const parsed = updateReviewSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: parsed.error.flatten() 
      });
    }

    const review = await Review.findById(id);
    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }

    // Check ownership
    if (!review.reviewerId.equals(userId)) {
      return res.status(403).json({ error: 'You can only update your own reviews' });
    }

    // Update review
    Object.assign(review, parsed.data);
    if (parsed.data.tripDate) {
      review.tripDate = new Date(parsed.data.tripDate);
    }

    await review.save();
    await review.populate('reviewerId', 'name email');

    res.json({ 
      message: 'Review updated successfully',
      review 
    });
  })
);

// DELETE /reviews/:id - Delete a review
router.delete('/:id', 
  authenticateJwt,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = (req as any).auth.userId;
    const userRole = (req as any).auth.role;

    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid review ID' });
    }

    const review = await Review.findById(id);
    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }

    // Check permissions (owner or admin)
    if (!review.reviewerId.equals(userId) && userRole !== 'admin') {
      return res.status(403).json({ 
        error: 'You can only delete your own reviews' 
      });
    }

    await Review.findByIdAndDelete(id);

    res.json({ message: 'Review deleted successfully' });
  })
);

// POST /reviews/:id/helpful - Mark review as helpful
router.post('/:id/helpful', 
  authenticateJwt,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = new Types.ObjectId((req as any).auth.userId);

    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid review ID' });
    }

    const review = await Review.findById(id);
    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }

    // Can't vote on your own review
    if (review.reviewerId.equals(userId)) {
      return res.status(400).json({ 
        error: 'You cannot vote on your own review' 
      });
    }

    // Node.js Concept: Instance methods on model documents
    await review.markAsHelpful(userId);

    res.json({ 
      message: 'Vote recorded successfully',
      helpfulVotes: review.helpfulVotes 
    });
  })
);

// POST /reviews/:id/respond - Organizer response to review
router.post('/:id/respond', 
  authenticateJwt,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = (req as any).auth.userId;
    const userRole = (req as any).auth.role;
    const { message } = req.body;

    if (userRole !== 'organizer') {
      return res.status(403).json({ 
        error: 'Only organizers can respond to reviews' 
      });
    }

    if (!message || message.trim().length < 5) {
      return res.status(400).json({ 
        error: 'Response message is required (minimum 5 characters)' 
      });
    }

    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid review ID' });
    }

    const review = await Review.findById(id);
    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }

    // Verify organizer can respond to this review
    if (review.reviewType === 'organizer') {
      // For organizer reviews, check if the review is about this organizer
      if (!review.targetId.equals(userId)) {
        return res.status(403).json({ 
          error: 'You can only respond to reviews about yourself' 
        });
      }
    } else if (review.reviewType === 'trip') {
      // For trip reviews, check if this organizer owns the trip
      const trip = await Trip.findById(review.targetId);
      if (!trip || !trip.organizerId.equals(userId)) {
        return res.status(403).json({ 
          error: 'You can only respond to reviews of your trips' 
        });
      }
    }

    review.organizerResponse = {
      message: message.trim(),
      respondedAt: new Date()
    };

    await review.save();

    res.json({ 
      message: 'Response added successfully',
      response: review.organizerResponse 
    });
  })
);

// Node.js Concept: Error handling middleware specific to this router
router.use((error: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Review route error:', error);

  // Handle specific MongoDB errors
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
