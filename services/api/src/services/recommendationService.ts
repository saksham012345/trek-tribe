import { User } from '../models/User';
import { Trip } from '../models/Trip';
import { logger } from '../utils/logger';

interface RecommendationParams {
  userId: string;
  limit?: number;
}

interface UserPreferences {
  viewedCategories: Map<string, number>;
  likedCategories: Map<string, number>;
  bookedCategories: Map<string, number>;
  priceRange: { min: number; max: number };
  preferredDurations: number[];
}

/**
 * Recommendation Service - Provides personalized trip recommendations
 * based on user behavior and preferences
 */
export class RecommendationService {
  
  /**
   * Analyze user activity log to extract preferences
   */
  private async analyzeUserBehavior(userId: string): Promise<UserPreferences> {
    const user = await User.findById(userId).select('activityLog');
    
    if (!user || !user.activityLog) {
      return {
        viewedCategories: new Map(),
        likedCategories: new Map(),
        bookedCategories: new Map(),
        priceRange: { min: 0, max: Infinity },
        preferredDurations: []
      };
    }

    const viewedCategories = new Map<string, number>();
    const likedCategories = new Map<string, number>();
    const bookedCategories = new Map<string, number>();
    const durations: number[] = [];
    const prices: number[] = [];

    // Analyze activity log
    for (const activity of user.activityLog) {
      const metadata = activity.metadata || {};
      
      switch (activity.action) {
        case 'view_trip':
          if (metadata.categories) {
            for (const cat of metadata.categories) {
              viewedCategories.set(cat, (viewedCategories.get(cat) || 0) + 1);
            }
          }
          if (metadata.duration) durations.push(metadata.duration);
          if (metadata.price) prices.push(metadata.price);
          break;
          
        case 'like_trip':
        case 'like_post':
          if (metadata.categories) {
            for (const cat of metadata.categories) {
              likedCategories.set(cat, (likedCategories.get(cat) || 0) + 2); // Higher weight
            }
          }
          break;
          
        case 'book_trip':
        case 'join_trip':
          if (metadata.categories) {
            for (const cat of metadata.categories) {
              bookedCategories.set(cat, (bookedCategories.get(cat) || 0) + 5); // Highest weight
            }
          }
          if (metadata.duration) durations.push(metadata.duration);
          if (metadata.price) prices.push(metadata.price);
          break;
      }
    }

    // Calculate price range
    const priceRange = prices.length > 0
      ? { 
          min: Math.min(...prices) * 0.7,
          max: Math.max(...prices) * 1.3
        }
      : { min: 0, max: Infinity };

    return {
      viewedCategories,
      likedCategories,
      bookedCategories,
      priceRange,
      preferredDurations: durations
    };
  }

  /**
   * Calculate preference score for a trip based on user behavior
   */
  private calculateTripScore(trip: any, preferences: UserPreferences): number {
    let score = 0;

    // Category matching (weighted)
    if (trip.categories && Array.isArray(trip.categories)) {
      for (const category of trip.categories) {
        score += (preferences.bookedCategories.get(category) || 0) * 3;
        score += (preferences.likedCategories.get(category) || 0) * 2;
        score += (preferences.viewedCategories.get(category) || 0) * 1;
      }
    }

    // Price matching
    if (trip.price >= preferences.priceRange.min && trip.price <= preferences.priceRange.max) {
      score += 10;
    }

    // Duration matching
    if (preferences.preferredDurations.length > 0 && trip.duration) {
      const avgDuration = preferences.preferredDurations.reduce((a, b) => a + b, 0) / preferences.preferredDurations.length;
      const durationDiff = Math.abs(trip.duration - avgDuration);
      if (durationDiff <= 2) score += 15; // Within 2 days
      else if (durationDiff <= 5) score += 5; // Within 5 days
    }

    // Boost for high ratings
    if (trip.rating >= 4.5) score += 8;
    else if (trip.rating >= 4.0) score += 5;

    // Boost for popular trips
    if (trip.joinedTravelersCount >= 10) score += 5;

    // Recency boost (newer trips get slight boost)
    const daysSinceCreated = (Date.now() - new Date(trip.createdAt).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceCreated <= 7) score += 3;

    return score;
  }

  /**
   * Get personalized trip recommendations for a user
   */
  async getTripRecommendations({ userId, limit = 10 }: RecommendationParams) {
    try {
      // Analyze user behavior
      const preferences = await this.analyzeUserBehavior(userId);

      // Get active trips (exclude user's own trips)
      const trips = await Trip.find({
        status: 'active',
        organizerId: { $ne: userId }
      })
        .populate('organizerId', 'name profilePhoto organizerProfile')
        .limit(100); // Get larger pool for scoring

      // Score each trip
      const scoredTrips = trips.map(trip => ({
        trip,
        score: this.calculateTripScore(trip, preferences)
      }));

      // Sort by score and return top recommendations
      const recommendations = scoredTrips
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map(item => item.trip);

      logger.info('Generated trip recommendations', { userId, count: recommendations.length });

      return recommendations;
    } catch (error: any) {
      logger.error('Error generating recommendations', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Get recommended users to follow based on shared interests
   */
  async getUserRecommendations({ userId, limit = 10 }: RecommendationParams) {
    try {
      const user = await User.findById(userId).select('following activityLog');
      if (!user) return [];

      const preferences = await this.analyzeUserBehavior(userId);
      
      // Get user's current following list
      const followingIds = user.following || [];

      // Find users with similar interests
      const potentialUsers = await User.find({
        _id: { $ne: userId, $nin: followingIds },
        role: { $in: ['organizer', 'traveler'] }
      })
        .select('name profilePhoto role organizerProfile activityLog')
        .limit(50);

      // Score users based on shared interests
      const scoredUsers = potentialUsers.map(potentialUser => {
        let score = 0;

        // Boost for organizers
        if (potentialUser.role === 'organizer') score += 5;

        // Analyze their activity for shared interests
        if (potentialUser.activityLog) {
          for (const activity of potentialUser.activityLog) {
            const metadata = activity.metadata || {};
            if (metadata.categories && Array.isArray(metadata.categories)) {
              for (const category of metadata.categories) {
                if (preferences.viewedCategories.has(category)) score += 2;
                if (preferences.likedCategories.has(category)) score += 3;
                if (preferences.bookedCategories.has(category)) score += 5;
              }
            }
          }
        }

        return { user: potentialUser, score };
      });

      const recommendations = scoredUsers
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map(item => item.user);

      logger.info('Generated user recommendations', { userId, count: recommendations.length });

      return recommendations;
    } catch (error: any) {
      logger.error('Error generating user recommendations', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Track user activity for recommendations
   */
  async trackActivity(userId: string, action: string, targetType: string, targetId: string, metadata?: any) {
    try {
      await User.findByIdAndUpdate(userId, {
        $push: {
          activityLog: {
            action,
            targetType,
            targetId,
            timestamp: new Date(),
            metadata
          }
        }
      });

      logger.info('Activity tracked', { userId, action, targetType });
    } catch (error: any) {
      logger.error('Error tracking activity', { error: error.message, userId });
    }
  }
}

export const recommendationService = new RecommendationService();
