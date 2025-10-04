import { Router } from 'express';
import { z } from 'zod';
import { Rating } from '../models/Rating';
import { Trip } from '../models/Trip';
import { User } from '../models/User';
import { authenticateJwt, requireRole } from '../middleware/auth';

const router = Router();

// Schema for creating/updating ratings
const createRatingSchema = z.object({
  tripId: z.string().min(1),
  tripRating: z.number().min(1).max(5),
  organizerRating: z.number().min(1).max(5),
  comment: z.string().max(1000).optional(),
  tags: z.array(z.string()).optional(),
  images: z.array(z.string()).optional()
});

// Async error wrapper
const asyncHandler = (fn: Function) => (req: any, res: any, next: any) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Create or update a rating
router.post('/', authenticateJwt, asyncHandler(async (req: any, res: any) => {
  try {
    const userId = req.auth.userId;
    const parsed = createRatingSchema.safeParse(req.body);
    
    if (!parsed.success) {
      return res.status(400).json({ 
        success: false,
        error: 'Validation failed',
        details: parsed.error.flatten().fieldErrors
      });
    }
    
    const { tripId, tripRating, organizerRating, comment, tags, images } = parsed.data;
    
    // Check if trip exists and user participated
    const trip = await Trip.findById(tripId);
    if (!trip) {
      return res.status(404).json({ 
        success: false, 
        error: 'Trip not found' 
      });
    }
    
    // Check if user participated in the trip
    if (!trip.participants.includes(userId)) {
      return res.status(403).json({ 
        success: false, 
        error: 'You can only rate trips you have participated in' 
      });
    }
    
    // Check if trip is completed
    if (trip.status !== 'completed') {
      return res.status(400).json({ 
        success: false, 
        error: 'You can only rate completed trips' 
      });
    }
    
    // Check for existing rating and update or create new
    let rating = await Rating.findOne({ userId, tripId });
    
    if (rating) {
      // Update existing rating
      rating.tripRating = tripRating;
      rating.organizerRating = organizerRating;
      rating.comment = comment;
      rating.tags = tags || [];
      rating.images = images || [];
      rating.moderationStatus = 'pending'; // Reset moderation on update
      await rating.save();
    } else {
      // Create new rating
      rating = await Rating.create({
        userId,
        tripId,
        organizerId: trip.organizerId,
        tripRating,
        organizerRating,
        comment,
        tags: tags || [],
        images: images || [],
        moderationStatus: 'pending'
      });
    }
    
    // Update trip rating statistics
    await updateTripRatings(tripId);
    
    // Update organizer rating statistics
    await updateOrganizerRatings(trip.organizerId.toString());
    
    res.json({
      success: true,
      message: 'Rating submitted successfully',
      rating: {
        id: rating._id,
        tripRating: rating.tripRating,
        organizerRating: rating.organizerRating,
        comment: rating.comment,
        moderationStatus: rating.moderationStatus
      }
    });
    
  } catch (error: any) {
    console.error('Error creating rating:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to submit rating' 
    });
  }
}));

// Get ratings for a trip
router.get('/trip/:tripId', asyncHandler(async (req: any, res: any) => {
  try {
    const { tripId } = req.params;
    const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const ratings = await Rating.find({ 
      tripId, 
      moderationStatus: 'approved' 
    })
    .populate('userId', 'name profilePicture')
    .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
    .skip(skip)
    .limit(parseInt(limit))
    .lean();
    
    const totalCount = await Rating.countDocuments({ 
      tripId, 
      moderationStatus: 'approved' 
    });
    
    res.json({
      success: true,
      ratings,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / parseInt(limit)),
        totalCount,
        hasMore: skip + ratings.length < totalCount
      }
    });
    
  } catch (error: any) {
    console.error('Error fetching trip ratings:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch ratings' 
    });
  }
}));

// Get ratings by an organizer
router.get('/organizer/:organizerId', asyncHandler(async (req: any, res: any) => {
  try {
    const { organizerId } = req.params;
    const { page = 1, limit = 10 } = req.query;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const ratings = await Rating.find({ 
      organizerId, 
      moderationStatus: 'approved' 
    })
    .populate('userId', 'name profilePicture')
    .populate('tripId', 'title destination')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit))
    .lean();
    
    const totalCount = await Rating.countDocuments({ 
      organizerId, 
      moderationStatus: 'approved' 
    });
    
    res.json({
      success: true,
      ratings,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / parseInt(limit)),
        totalCount
      }
    });
    
  } catch (error: any) {
    console.error('Error fetching organizer ratings:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch organizer ratings' 
    });
  }
}));

// Flag a rating as fake (for users to report)
router.post('/:ratingId/flag', authenticateJwt, asyncHandler(async (req: any, res: any) => {
  try {
    const userId = req.auth.userId;
    const { ratingId } = req.params;
    
    const rating = await Rating.findById(ratingId);
    if (!rating) {
      return res.status(404).json({ 
        success: false, 
        error: 'Rating not found' 
      });
    }
    
    // Check if user already flagged this rating
    if (rating.flaggedBy && rating.flaggedBy.includes(userId)) {
      return res.status(400).json({ 
        success: false, 
        error: 'You have already flagged this rating' 
      });
    }
    
    // Add user to flagged by list
    rating.flaggedBy = rating.flaggedBy || [];
    rating.flaggedBy.push(userId);
    
    // If multiple users flag, mark as potentially fake
    if (rating.flaggedBy.length >= 3) {
      rating.flaggedAsFake = true;
      rating.moderationStatus = 'pending';
    }
    
    await rating.save();
    
    res.json({
      success: true,
      message: 'Rating flagged for review'
    });
    
  } catch (error: any) {
    console.error('Error flagging rating:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to flag rating' 
    });
  }
}));

// Admin/Moderator routes
router.put('/:ratingId/moderate', authenticateJwt, requireRole(['admin']), asyncHandler(async (req: any, res: any) => {
  try {
    const { ratingId } = req.params;
    const { status, reason } = req.body;
    
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid moderation status' 
      });
    }
    
    const rating = await Rating.findByIdAndUpdate(
      ratingId,
      { 
        moderationStatus: status,
        ...(status === 'rejected' && reason && { rejectionReason: reason })
      },
      { new: true }
    );
    
    if (!rating) {
      return res.status(404).json({ 
        success: false, 
        error: 'Rating not found' 
      });
    }
    
    // If approved, update trip and organizer ratings
    if (status === 'approved') {
      await updateTripRatings(rating.tripId.toString());
      await updateOrganizerRatings(rating.organizerId.toString());
    }
    
    res.json({
      success: true,
      message: `Rating ${status} successfully`,
      rating
    });
    
  } catch (error: any) {
    console.error('Error moderating rating:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to moderate rating' 
    });
  }
}));

// Get pending ratings for moderation (admin only)
router.get('/moderation/pending', authenticateJwt, requireRole(['admin']), asyncHandler(async (req: any, res: any) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const ratings = await Rating.find({ 
      moderationStatus: 'pending' 
    })
    .populate('userId', 'name email')
    .populate('tripId', 'title destination')
    .populate('organizerId', 'name email')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit))
    .lean();
    
    const totalCount = await Rating.countDocuments({ 
      moderationStatus: 'pending' 
    });
    
    res.json({
      success: true,
      ratings,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / parseInt(limit)),
        totalCount
      }
    });
    
  } catch (error: any) {
    console.error('Error fetching pending ratings:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch pending ratings' 
    });
  }
}));

// Helper function to update trip ratings
async function updateTripRatings(tripId: string) {
  const ratings = await Rating.find({ 
    tripId, 
    moderationStatus: 'approved' 
  }).lean();
  
  if (ratings.length === 0) return;
  
  const totalRating = ratings.reduce((sum, r) => sum + r.tripRating, 0);
  const averageRating = totalRating / ratings.length;
  
  const ratingBreakdown = {
    5: ratings.filter(r => r.tripRating === 5).length,
    4: ratings.filter(r => r.tripRating === 4).length,
    3: ratings.filter(r => r.tripRating === 3).length,
    2: ratings.filter(r => r.tripRating === 2).length,
    1: ratings.filter(r => r.tripRating === 1).length
  };
  
  await Trip.findByIdAndUpdate(tripId, {
    averageRating,
    totalRatings: ratings.length,
    ratingBreakdown
  });
}

// Helper function to update organizer ratings
async function updateOrganizerRatings(organizerId: string) {
  const ratings = await Rating.find({ 
    organizerId, 
    moderationStatus: 'approved' 
  }).lean();
  
  if (ratings.length === 0) return;
  
  const totalRating = ratings.reduce((sum, r) => sum + r.organizerRating, 0);
  const averageRating = totalRating / ratings.length;
  
  await User.findByIdAndUpdate(organizerId, {
    averageRating,
    totalRatings: ratings.length
  });
}

export default router;