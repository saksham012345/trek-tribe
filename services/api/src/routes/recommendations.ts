import { Router, Request, Response } from 'express';
import { authenticateJwt } from '../middleware/auth';
import { User } from '../models/User';
import { Trip } from '../models/Trip';
import { z } from 'zod';

const router = Router();

// Schema for recommendation request
const recommendationSchema = z.object({
  preferences: z.object({
    budget: z.number().optional(),
    duration: z.number().optional(), // in days
    destination: z.string().optional(),
    category: z.string().optional(),
    difficulty: z.enum(['easy', 'moderate', 'challenging']).optional(),
  }).optional(),
  limit: z.number().min(1).max(20).optional().default(5),
});

/**
 * GET /api/recommendations
 * Get personalized trip recommendations based on user preferences and AI
 */
router.get('/', authenticateJwt, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get user profile and preferences
    const user = await User.findById(userId).select('preferences travelStats');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Build recommendation query based on user preferences
    const query: any = { 
      isActive: true,
      startDate: { $gte: new Date() } // Only future trips
    };

    // Apply user preferences if available
    if (user.preferences) {
      if (user.preferences.categories && user.preferences.categories.length > 0) {
        query.category = { $in: user.preferences.categories };
      }

      if (user.preferences.budgetRange && user.preferences.budgetRange.length === 2) {
        query.price = { 
          $gte: user.preferences.budgetRange[0], 
          $lte: user.preferences.budgetRange[1] 
        };
      }

      if (user.preferences.locations && user.preferences.locations.length > 0) {
        query.location = { $in: user.preferences.locations };
      }

      if (user.preferences.difficultyLevels && user.preferences.difficultyLevels.length > 0) {
        query.difficulty = { $in: user.preferences.difficultyLevels };
      }
    }

    // Get recommended trips
    const trips = await Trip.find(query)
      .populate('organizer', 'name profilePhoto organizerProfile')
      .sort({ rating: -1, createdAt: -1 })
      .limit(10)
      .lean();

    // AI-enhanced scoring (simple algorithm - can be replaced with actual AI model)
    const scoredTrips = trips.map(trip => {
      let score = 0;

      // Base score from rating (Trip model may not have rating directly, use averageRating)
      score += ((trip as any).averageRating || 0) * 10;

      // Bonus for matching user's travel stats
      const locationName = typeof (trip as any).location === 'string' 
        ? (trip as any).location 
        : (trip as any).destination || '';
      if (user.travelStats?.favoriteDestinations?.includes(locationName)) {
        score += 15;
      }

      // Bonus for popular trips
      score += Math.min(trip.participants.length * 2, 20);

      // Bonus for verified organizers
      if (((trip as any).organizer || (trip as any).organizerId)?.isVerified) {
        score += 10;
      }

      return {
        ...trip,
        recommendationScore: score,
      };
    });

    // Sort by recommendation score
    scoredTrips.sort((a, b) => b.recommendationScore - a.recommendationScore);

    // Take top 5
    const recommendations = scoredTrips.slice(0, 5);

    return res.json({
      recommendations,
      count: recommendations.length,
      basedOn: {
        userPreferences: !!user.preferences,
        travelHistory: !!user.travelStats,
        categories: user.preferences?.categories || [],
        budget: user.preferences?.budgetRange || null,
      },
    });

  } catch (error: any) {
    console.error('❌ Error generating recommendations:', error);
    return res.status(500).json({ 
      error: 'Failed to generate recommendations',
      message: error.message 
    });
  }
});

/**
 * POST /api/recommendations/custom
 * Get recommendations based on custom preferences (no auth required)
 */
router.post('/custom', async (req: Request, res: Response) => {
  try {
    const parsed = recommendationSchema.safeParse(req.body);
    
    if (!parsed.success) {
      return res.status(400).json({ 
        error: 'Validation error',
        details: parsed.error.flatten().fieldErrors 
      });
    }

    const { preferences, limit } = parsed.data;

    // Build query based on provided preferences
    const query: any = { 
      isActive: true,
      startDate: { $gte: new Date() }
    };

    if (preferences) {
      if (preferences.budget) {
        query.price = { $lte: preferences.budget };
      }

      if (preferences.duration) {
        query.duration = preferences.duration;
      }

      if (preferences.destination) {
        query.$or = [
          { location: new RegExp(preferences.destination, 'i') },
          { destination: new RegExp(preferences.destination, 'i') },
        ];
      }

      if (preferences.category) {
        query.category = preferences.category;
      }

      if (preferences.difficulty) {
        query.difficulty = preferences.difficulty;
      }
    }

    // Get matching trips
    const trips = await Trip.find(query)
      .populate('organizer', 'name profilePhoto organizerProfile')
      .sort({ rating: -1, participants: -1 })
      .limit(limit || 5)
      .lean();

    return res.json({
      recommendations: trips,
      count: trips.length,
      filters: preferences || {},
    });

  } catch (error: any) {
    console.error('❌ Error generating custom recommendations:', error);
    return res.status(500).json({ 
      error: 'Failed to generate recommendations',
      message: error.message 
    });
  }
});

/**
 * GET /api/recommendations/popular
 * Get popular trips (trending)
 */
router.get('/popular', async (_req: Request, res: Response) => {
  try {
    const trips = await Trip.find({ 
      isActive: true,
      startDate: { $gte: new Date() }
    })
      .populate('organizer', 'name profilePhoto isVerified')
      .sort({ participants: -1, rating: -1 })
      .limit(10)
      .lean();

    return res.json({
      popular: trips,
      count: trips.length,
    });

  } catch (error: any) {
    console.error('❌ Error fetching popular trips:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch popular trips',
      message: error.message 
    });
  }
});

export default router;
