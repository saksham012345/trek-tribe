import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Types } from 'mongoose';
import { Wishlist, WishlistDocument } from '../models/Wishlist';
import { authenticateJwt } from '../middleware/auth';

// Node.js Concept: Express Router modularization
const router = Router();

// Node.js Concept: Input validation schemas
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

// Node.js Concept: Async error handling wrapper
const asyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// GET /wishlist - Get user's wishlist with filtering and pagination
// Node.js Concept: Query parameter processing and database aggregation
router.get('/', 
  authenticateJwt,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = new Types.ObjectId((req as any).auth.userId);
    
    const {
      priority,
      tags,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      page = '1',
      limit = '10'
    } = req.query;

    // Process tags parameter
    const tagsArray = tags ? (tags as string).split(',').map(t => t.trim()) : undefined;

    const options = {
      priority: priority as string,
      tags: tagsArray,
      sortBy: sortBy as string,
      sortOrder: sortOrder as 'asc' | 'desc',
      page: parseInt(page as string),
      limit: parseInt(limit as string)
    };

    // Node.js Concept: Static method calls on Mongoose models
    const result = await Wishlist.getUserWishlistWithTrips(userId, options);
    
    res.json(result);
  })
);

// GET /wishlist/stats - Get wishlist statistics
router.get('/stats',
  authenticateJwt,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = new Types.ObjectId((req as any).auth.userId);

    // Node.js Concept: MongoDB aggregation for statistics
    const stats = await Wishlist.aggregate([
      { $match: { userId } },
      {
        $group: {
          _id: null,
          totalItems: { $sum: 1 },
          priorityBreakdown: {
            $push: '$priority'
          },
          allTags: {
            $push: '$tags'
          }
        }
      },
      {
        $project: {
          _id: 0,
          totalItems: 1,
          priorityBreakdown: {
            low: {
              $size: {
                $filter: {
                  input: '$priorityBreakdown',
                  cond: { $eq: ['$$this', 'low'] }
                }
              }
            },
            medium: {
              $size: {
                $filter: {
                  input: '$priorityBreakdown',
                  cond: { $eq: ['$$this', 'medium'] }
                }
              }
            },
            high: {
              $size: {
                $filter: {
                  input: '$priorityBreakdown',
                  cond: { $eq: ['$$this', 'high'] }
                }
              }
            }
          },
          allTags: {
            $reduce: {
              input: '$allTags',
              initialValue: [],
              in: { $concatArrays: ['$$value', '$$this'] }
            }
          }
        }
      }
    ]);

    // Process tag frequency
    const result = stats[0] || { 
      totalItems: 0, 
      priorityBreakdown: { low: 0, medium: 0, high: 0 },
      allTags: [] 
    };

    // Calculate tag frequency
    const tagFrequency: { [key: string]: number } = {};
    result.allTags.forEach((tag: string) => {
      tagFrequency[tag] = (tagFrequency[tag] || 0) + 1;
    });

    // Get most popular tags
    const popularTags = Object.entries(tagFrequency)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([tag, count]) => ({ tag, count }));

    res.json({
      totalItems: result.totalItems,
      priorityBreakdown: result.priorityBreakdown,
      popularTags
    });
  })
);

// POST /wishlist - Add trip to wishlist
// Node.js Concept: Request validation and error handling
router.post('/',
  authenticateJwt,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).auth.userId;
    
    // Validate input
    const parsed = addToWishlistSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: parsed.error.flatten()
      });
    }

    const { tripId, notes, priority = 'medium', tags = [] } = parsed.data;

    try {
      const wishlistItem = new Wishlist({
        userId: new Types.ObjectId(userId),
        tripId: new Types.ObjectId(tripId),
        notes: notes?.trim(),
        priority,
        tags: tags.map(tag => tag.toLowerCase().trim())
      });

      await wishlistItem.save();
      
      // Populate trip and organizer info
      await wishlistItem.populate([
        {
          path: 'tripId',
          select: 'title description destination price startDate endDate capacity images coverImage categories'
        }
      ]);

      res.status(201).json({
        message: 'Trip added to wishlist successfully',
        wishlistItem
      });

    } catch (error: any) {
      // Node.js Concept: Specific error handling for duplicate entries
      if (error.code === 11000) {
        return res.status(409).json({
          error: 'Trip is already in your wishlist'
        });
      }
      
      if (error.statusCode === 404) {
        return res.status(404).json({
          error: error.message
        });
      }
      
      throw error;
    }
  })
);

// PUT /wishlist/:id - Update wishlist item
router.put('/:id',
  authenticateJwt,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = (req as any).auth.userId;

    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid wishlist item ID' });
    }

    // Validate input
    const parsed = updateWishlistSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: parsed.error.flatten()
      });
    }

    const wishlistItem = await Wishlist.findById(id);
    if (!wishlistItem) {
      return res.status(404).json({ error: 'Wishlist item not found' });
    }

    // Check ownership
    if (!wishlistItem.userId.equals(userId)) {
      return res.status(403).json({ 
        error: 'You can only update your own wishlist items' 
      });
    }

    // Update fields
    const { notes, priority, tags } = parsed.data;
    if (notes !== undefined) wishlistItem.notes = notes.trim();
    if (priority) wishlistItem.priority = priority;
    if (tags) wishlistItem.tags = tags.map(tag => tag.toLowerCase().trim());

    await wishlistItem.save();
    await wishlistItem.populate([
      {
        path: 'tripId',
        select: 'title description destination price startDate endDate capacity images coverImage categories'
      }
    ]);

    res.json({
      message: 'Wishlist item updated successfully',
      wishlistItem
    });
  })
);

// DELETE /wishlist/:id - Remove from wishlist
router.delete('/:id',
  authenticateJwt,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = (req as any).auth.userId;

    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid wishlist item ID' });
    }

    const wishlistItem = await Wishlist.findById(id);
    if (!wishlistItem) {
      return res.status(404).json({ error: 'Wishlist item not found' });
    }

    // Check ownership
    if (!wishlistItem.userId.equals(userId)) {
      return res.status(403).json({ 
        error: 'You can only remove your own wishlist items' 
      });
    }

    await Wishlist.findByIdAndDelete(id);

    res.json({ message: 'Trip removed from wishlist successfully' });
  })
);

// DELETE /wishlist/trip/:tripId - Remove trip from wishlist by trip ID
router.delete('/trip/:tripId',
  authenticateJwt,
  asyncHandler(async (req: Request, res: Response) => {
    const { tripId } = req.params;
    const userId = (req as any).auth.userId;

    if (!Types.ObjectId.isValid(tripId)) {
      return res.status(400).json({ error: 'Invalid trip ID' });
    }

    const result = await Wishlist.findOneAndDelete({
      userId: new Types.ObjectId(userId),
      tripId: new Types.ObjectId(tripId)
    });

    if (!result) {
      return res.status(404).json({ 
        error: 'Trip not found in your wishlist' 
      });
    }

    res.json({ message: 'Trip removed from wishlist successfully' });
  })
);

// POST /wishlist/:id/priority - Update priority of wishlist item
router.post('/:id/priority',
  authenticateJwt,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = (req as any).auth.userId;
    const { priority } = req.body;

    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid wishlist item ID' });
    }

    if (!['low', 'medium', 'high'].includes(priority)) {
      return res.status(400).json({ 
        error: 'Priority must be one of: low, medium, high' 
      });
    }

    const wishlistItem = await Wishlist.findById(id);
    if (!wishlistItem) {
      return res.status(404).json({ error: 'Wishlist item not found' });
    }

    // Check ownership
    if (!wishlistItem.userId.equals(userId)) {
      return res.status(403).json({ 
        error: 'You can only update your own wishlist items' 
      });
    }

    // Node.js Concept: Using instance methods on documents
    await wishlistItem.updatePriority(priority);

    res.json({
      message: 'Priority updated successfully',
      priority: wishlistItem.priority
    });
  })
);

// POST /wishlist/:id/tags - Add tags to wishlist item
router.post('/:id/tags',
  authenticateJwt,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = (req as any).auth.userId;
    const { tags } = req.body;

    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid wishlist item ID' });
    }

    if (!Array.isArray(tags) || tags.length === 0) {
      return res.status(400).json({ 
        error: 'Tags must be a non-empty array of strings' 
      });
    }

    // Validate tag format
    const validTags = tags.filter(tag => 
      typeof tag === 'string' && tag.trim().length > 0 && tag.length <= 50
    );

    if (validTags.length === 0) {
      return res.status(400).json({ 
        error: 'No valid tags provided' 
      });
    }

    const wishlistItem = await Wishlist.findById(id);
    if (!wishlistItem) {
      return res.status(404).json({ error: 'Wishlist item not found' });
    }

    // Check ownership
    if (!wishlistItem.userId.equals(userId)) {
      return res.status(403).json({ 
        error: 'You can only update your own wishlist items' 
      });
    }

    // Node.js Concept: Using instance methods
    await wishlistItem.addTags(validTags);

    res.json({
      message: 'Tags added successfully',
      tags: wishlistItem.tags
    });
  })
);

// DELETE /wishlist/:id/tags - Remove tags from wishlist item
router.delete('/:id/tags',
  authenticateJwt,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = (req as any).auth.userId;
    const { tags } = req.body;

    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid wishlist item ID' });
    }

    if (!Array.isArray(tags) || tags.length === 0) {
      return res.status(400).json({ 
        error: 'Tags must be a non-empty array of strings' 
      });
    }

    const wishlistItem = await Wishlist.findById(id);
    if (!wishlistItem) {
      return res.status(404).json({ error: 'Wishlist item not found' });
    }

    // Check ownership
    if (!wishlistItem.userId.equals(userId)) {
      return res.status(403).json({ 
        error: 'You can only update your own wishlist items' 
      });
    }

    await wishlistItem.removeTags(tags);

    res.json({
      message: 'Tags removed successfully',
      tags: wishlistItem.tags
    });
  })
);

// GET /wishlist/check/:tripId - Check if trip is in user's wishlist
router.get('/check/:tripId',
  authenticateJwt,
  asyncHandler(async (req: Request, res: Response) => {
    const { tripId } = req.params;
    const userId = (req as any).auth.userId;

    if (!Types.ObjectId.isValid(tripId)) {
      return res.status(400).json({ error: 'Invalid trip ID' });
    }

    const wishlistItem = await Wishlist.findOne({
      userId: new Types.ObjectId(userId),
      tripId: new Types.ObjectId(tripId)
    });

    res.json({
      isInWishlist: !!wishlistItem,
      wishlistItemId: wishlistItem?._id || null
    });
  })
);

// Node.js Concept: Router-specific error handling
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
