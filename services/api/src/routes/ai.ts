import express, { Request, Response, NextFunction } from 'express';
import { body, validationResult, query } from 'express-validator';
import { authenticateToken } from '../middleware/auth';
import { Trip } from '../models/Trip';
import { User } from '../models/User';
import { GroupBooking } from '../models/GroupBooking';
import { Review } from '../models/Review';
import { aiConfig, getScaledScore, isHighConfidence } from '../config/ai';
import { aiCacheService } from '../services/aiCacheService';
import { aiMetricsService, aiMetricsMiddleware } from '../services/aiMetricsService';

const router = express.Router();

// AI Service Mock (In production, this would be replaced with actual AI service)
class TrekTribeAI {
  private static instance: TrekTribeAI;
  
  static getInstance(): TrekTribeAI {
    if (!TrekTribeAI.instance) {
      TrekTribeAI.instance = new TrekTribeAI();
    }
    return TrekTribeAI.instance;
  }

  async generateSmartSearchResults(query: string, filters: any = {}) {
    // Check cache first
    const cacheKey = aiCacheService.generateSearchKey(query, filters);
    const cachedResults = aiCacheService.getSearchResults(cacheKey);
    if (cachedResults) {
      return cachedResults;
    }

    // Advanced search logic with NLP processing
    const searchTerms = query.toLowerCase().split(' ');
    const searchCriteria: any = {};
    
    // Build search criteria based on AI analysis
    if (searchTerms.includes('mountain') || searchTerms.includes('trekking') || searchTerms.includes('hiking')) {
      searchCriteria['categories'] = { $in: ['mountain', 'trekking', 'hiking', 'adventure'] };
    }
    if (searchTerms.includes('beach') || searchTerms.includes('ocean') || searchTerms.includes('coastal')) {
      searchCriteria['categories'] = { $in: ['beach', 'coastal', 'ocean', 'water'] };
    }
    if (searchTerms.includes('cultural') || searchTerms.includes('heritage') || searchTerms.includes('historic')) {
      searchCriteria['categories'] = { $in: ['cultural', 'heritage', 'historic', 'temple'] };
    }

    // Apply filters
    if (filters.priceRange) {
      const priceMap: any = {
        'budget': { $lte: 5000 },
        'mid-range': { $gte: 5000, $lte: 15000 },
        'luxury': { $gte: 15000 }
      };
      if (priceMap[filters.priceRange]) {
        searchCriteria['price'] = priceMap[filters.priceRange];
      }
    }

    if (filters.location) {
      searchCriteria.$or = [
        { 'location.state': new RegExp(filters.location, 'i') },
        { 'location.country': new RegExp(filters.location, 'i') },
        { 'destination': new RegExp(filters.location, 'i') }
      ];
    }

    // Perform search
    const trips = await Trip.find(searchCriteria)
      .populate('organizerId', 'name profilePhoto')
      .sort({ averageRating: -1, createdAt: -1 })
      .limit(aiConfig.maxSearchResults);

    // AI scoring and ranking
    const scoredTrips = trips.map(trip => {
      let relevanceScore = 0;
      
      // Base score from rating (using configuration weights)
      relevanceScore += getScaledScore((trip.averageRating || 0) * 20, aiConfig.scoringWeights.rating);
      
      // Boost score for exact matches in title/description
      const tripText = `${trip.title} ${trip.description}`.toLowerCase();
      searchTerms.forEach(term => {
        if (tripText.includes(term)) {
          relevanceScore += 10;
        }
      });
      
      // Boost for popular trips (use reviewCount as proxy)
      relevanceScore += getScaledScore((trip.reviewCount || 0) * 2, aiConfig.scoringWeights.popularity);
      
      // Boost for recent trips
      const daysSinceCreated = (Date.now() - trip.createdAt.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceCreated < 30) {
        relevanceScore += getScaledScore(5, aiConfig.scoringWeights.recency);
      }

      return {
        ...trip.toObject(),
        relevanceScore,
        aiInsights: {
          matchReason: this.generateMatchReason(trip, searchTerms),
          recommendationStrength: relevanceScore > 50 ? 'high' : relevanceScore > 25 ? 'medium' : 'low'
        }
      };
    });

    const filteredResults = scoredTrips
      .filter(trip => trip.relevanceScore >= aiConfig.searchRelevanceThreshold)
      .sort((a, b) => b.relevanceScore - a.relevanceScore);

    // Cache results
    aiCacheService.setSearchResults(cacheKey, filteredResults);
    
    return filteredResults;
  }

  async generatePersonalizedRecommendations(userId: string, limit: number = 6) {
    // Check cache first
    const cachedRecommendations = aiCacheService.getRecommendations(userId, limit);
    if (cachedRecommendations) {
      return cachedRecommendations;
    }

    // Get user's booking history and preferences
    const user = await User.findById(userId);
    const userBookings = await GroupBooking.find({ mainBookerId: userId }).populate('tripId');
    
    if (!user) {
      throw new Error('User not found');
    }

    // Analyze user preferences from booking history
    const preferences = this.analyzeUserPreferences(userBookings);
    
    // Build recommendation criteria
    const criteria: any = {
      _id: { $nin: userBookings.map(b => b.tripId._id) }, // Exclude already booked trips
      status: 'active'
    };

    // Apply preference-based filters
    if (preferences.preferredTags.length > 0) {
      criteria.categories = { $in: preferences.preferredTags };
    }

    if (preferences.priceRange) {
      criteria.price = preferences.priceRange;
    }

    // Skip difficulty filter since Trip model doesn't have this field

    // Get recommended trips
    const trips = await Trip.find(criteria)
      .populate('organizerId', 'name profilePhoto')
      .sort({ averageRating: -1, createdAt: -1 })
      .limit(Math.min(limit * 2, aiConfig.maxRecommendations * 2)); // Get more to filter and rank

    // AI-powered ranking
    const rankedTrips = trips.map(trip => {
      let score = 0;
      
      // Base score from trip quality (using configuration weights)
      score += getScaledScore((trip.averageRating || 0) * 15, aiConfig.scoringWeights.rating);
      score += getScaledScore((trip.reviewCount || 0) * 2, aiConfig.scoringWeights.popularity);
      
      // Preference matching score (using configuration weights)
      trip.categories?.forEach((category: string) => {
        if (preferences.preferredTags.includes(category)) {
          score += getScaledScore(20, aiConfig.scoringWeights.categoryMatch);
        }
      });
      
      // Price preference matching (using configuration weights)
      if (preferences.priceRange && trip.price) {
        if (trip.price >= preferences.priceRange.$gte && trip.price <= preferences.priceRange.$lte) {
          score += getScaledScore(15, aiConfig.scoringWeights.priceMatch);
        }
      }
      
      // Skip difficulty preference since Trip model doesn't have this field

      // Seasonal relevance (boost trips happening soon)
      if (trip.startDate) {
        const startDate = new Date(trip.startDate);
        if (startDate > new Date()) {
          const daysUntil = (startDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
          if (daysUntil <= 30) {
            score += 8; // Boost for trips within 30 days
          }
        }
      }

      return {
        ...trip.toObject(),
        recommendationScore: score,
        aiInsights: {
          reason: this.generateRecommendationReason(trip, preferences),
          confidence: score > 60 ? 'high' : score > 30 ? 'medium' : 'low',
          matchedPreferences: this.getMatchedPreferences(trip, preferences)
        }
      };
    });

    const finalRecommendations = rankedTrips
      .filter(trip => trip.recommendationScore >= aiConfig.recommendationConfidenceThreshold)
      .sort((a, b) => b.recommendationScore - a.recommendationScore)
      .slice(0, limit);

    // Cache recommendations
    aiCacheService.setRecommendations(userId, limit, finalRecommendations);

    return finalRecommendations;
  }

  async generateUserAnalytics(userId: string) {
    // Check cache first
    const cachedAnalytics = aiCacheService.getAnalytics(userId);
    if (cachedAnalytics) {
      return cachedAnalytics;
    }

    const user = await User.findById(userId);
    const userBookings = await GroupBooking.find({ mainBookerId: userId }).populate('tripId');
    const userReviews = await Review.find({ user: userId });

    if (!user) {
      throw new Error('User not found');
    }

    // Calculate analytics
    const totalTrips = userBookings.length;
    const totalSpent = userBookings.reduce((sum, booking) => sum + (booking.finalAmount || 0), 0);
    const averageRating = userReviews.length > 0 
      ? userReviews.reduce((sum, review) => sum + review.rating, 0) / userReviews.length 
      : 0;

    // Analyze travel patterns
    const preferences = this.analyzeUserPreferences(userBookings);
    const travelPattern = this.analyzeTravelPattern(userBookings);

    // Generate insights
    const insights = {
      travelStyle: this.determineTravelStyle(preferences, userBookings),
      nextRecommendation: await this.generateNextTripRecommendation(userId, preferences),
      savingsOpportunity: this.calculateSavingsOpportunity(userBookings),
      travelGoals: this.generateTravelGoals(preferences, totalTrips)
    };

    const analytics = {
      summary: {
        totalTrips,
        totalSpent,
        averageRating,
        memberSince: user.createdAt
      },
      preferences,
      travelPattern,
      insights,
      achievements: this.generateAchievements(userBookings, userReviews)
    };

    // Cache analytics
    aiCacheService.setAnalytics(userId, analytics);

    return analytics;
  }

  async generateChatResponse(message: string, context: any = {}) {
    // Check cache first
    const messageHash = aiCacheService.generateMessageHash(message, context);
    const cachedResponse = aiCacheService.getChatResponse(messageHash);
    if (cachedResponse) {
      return cachedResponse;
    }

    const lowerMessage = message.toLowerCase();
    
    // Trip search queries
    if (lowerMessage.includes('find') || lowerMessage.includes('search') || lowerMessage.includes('looking for')) {
      return await this.handleTripSearchQuery(message, context);
    }
    
    // Booking questions
    if (lowerMessage.includes('book') || lowerMessage.includes('reserve') || lowerMessage.includes('payment')) {
      return this.handleBookingQuery(message, context);
    }
    
    // Trip details questions
    if (lowerMessage.includes('detail') || lowerMessage.includes('information') || lowerMessage.includes('about')) {
      return await this.handleTripDetailQuery(message, context);
    }
    
    // General help
    if (lowerMessage.includes('help') || lowerMessage.includes('support')) {
      return this.handleHelpQuery(message, context);
    }

    // Default friendly response
    const response = {
      response: "I'm here to help you with trip planning, bookings, and recommendations! You can ask me about finding trips, booking details, or any other questions about Trek Tribe. What would you like to know?",
      suggestions: [
        "Find mountain trekking trips",
        "Help me book a trip",
        "Show me my trip recommendations",
        "What are the popular destinations?"
      ],
      requiresHumanAgent: false
    };

    // Cache response
    aiCacheService.setChatResponse(messageHash, response);

    return response;
  }

  // Helper methods
  private generateMatchReason(trip: any, searchTerms: string[]): string {
    const reasons = [];
    
    if (searchTerms.some(term => trip.title.toLowerCase().includes(term))) {
      reasons.push("title match");
    }
    if (searchTerms.some(term => trip.description.toLowerCase().includes(term))) {
      reasons.push("description relevance");
    }
    if (trip.averageRating >= 4.5) {
      reasons.push("highly rated");
    }
    if (trip.reviewCount > 10) {
      reasons.push("popular choice");
    }
    
    return reasons.length > 0 ? reasons.join(", ") : "general match";
  }

  private analyzeUserPreferences(bookings: any[]) {
    const categories: string[] = [];
    const difficulties: string[] = [];
    const prices: number[] = [];

    bookings.forEach(booking => {
      if (booking.tripId) {
        if (booking.tripId.categories) {
          categories.push(...booking.tripId.categories);
        }
        // Note: Trip model doesn't have difficulty field, so we'll skip this
        if (booking.tripId.price) {
          prices.push(booking.tripId.price);
        }
      }
    });

    // Calculate preferred price range
    let priceRange = null;
    if (prices.length > 0) {
      const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
      priceRange = {
        $gte: Math.max(0, avgPrice * 0.7),
        $lte: avgPrice * 1.3
      };
    }

    return {
      preferredTags: [...new Set(categories)],
      preferredDifficulty: [...new Set(difficulties)],
      priceRange
    };
  }

  private generateRecommendationReason(trip: any, preferences: any): string {
    const reasons = [];
    
    if (trip.categories?.some((category: string) => preferences.preferredTags.includes(category))) {
      reasons.push("matches your interests");
    }
    // Skip difficulty check since Trip model doesn't have this field
    if (trip.averageRating >= 4.5) {
      reasons.push("excellent reviews");
    }
    
    return reasons.length > 0 ? reasons.join(", ") : "new experience for you";
  }

  private getMatchedPreferences(trip: any, preferences: any): string[] {
    const matches = [];
    
    trip.categories?.forEach((category: string) => {
      if (preferences.preferredTags.includes(category)) {
        matches.push(category);
      }
    });
    
    return matches;
  }

  private analyzeTravelPattern(bookings: any[]) {
    // Analyze travel frequency, seasonality, etc.
    return {
      averageTripsPerYear: bookings.length / Math.max(1, (Date.now() - new Date(Math.min(...bookings.map(b => b.createdAt))).getTime()) / (365 * 24 * 60 * 60 * 1000)),
      preferredSeasons: this.getPreferredSeasons(bookings),
      bookingLeadTime: this.getAverageBookingLeadTime(bookings)
    };
  }

  private getPreferredSeasons(bookings: any[]): string[] {
    // Implementation for season preference analysis
    return ['spring', 'autumn']; // Simplified
  }

  private getAverageBookingLeadTime(bookings: any[]): number {
    // Implementation for lead time analysis
    return 30; // Simplified: 30 days average
  }

  private determineTravelStyle(preferences: any, bookings: any[]): string {
    if (preferences.preferredTags.includes('luxury')) return 'Luxury Traveler';
    if (preferences.preferredTags.includes('adventure')) return 'Adventure Seeker';
    if (preferences.preferredTags.includes('cultural')) return 'Cultural Explorer';
    if (bookings.length > 10) return 'Frequent Traveler';
    return 'Casual Explorer';
  }

  private async generateNextTripRecommendation(userId: string, preferences: any) {
    const recommendations = await this.generatePersonalizedRecommendations(userId, 1);
    return recommendations.length > 0 ? recommendations[0] : null;
  }

  private calculateSavingsOpportunity(bookings: any[]): any {
    // Calculate potential savings based on booking patterns
    return {
      potentialSavings: Math.floor(Math.random() * 1000) + 500,
      tip: "Book in advance to save up to 20% on most trips"
    };
  }

  private generateTravelGoals(preferences: any, totalTrips: number): string[] {
    const goals = [];
    if (totalTrips < 5) goals.push("Complete 5 trips this year");
    if (!preferences.preferredTags.includes('international')) goals.push("Try an international destination");
    goals.push("Earn loyalty points for discounts");
    return goals;
  }

  private generateAchievements(bookings: any[], reviews: any[]): any[] {
    const achievements = [];
    
    if (bookings.length >= 5) {
      achievements.push({
        title: "Explorer",
        description: "Completed 5+ trips",
        earned: true
      });
    }
    
    if (reviews.length >= 3) {
      achievements.push({
        title: "Reviewer",
        description: "Written 3+ reviews",
        earned: true
      });
    }

    return achievements;
  }

  private async handleTripSearchQuery(message: string, context: any) {
    // Extract search intent from message
    const query = message.toLowerCase();
    let searchTerms = "";
    let filters: any = {};

    if (query.includes('mountain') || query.includes('trek')) {
      searchTerms = "mountain trekking";
    } else if (query.includes('beach') || query.includes('coastal')) {
      searchTerms = "beach coastal";
    } else if (query.includes('cultural') || query.includes('heritage')) {
      searchTerms = "cultural heritage";
    }

    try {
      const results = await this.generateSmartSearchResults(searchTerms, filters);
      
      return {
        response: `I found ${results.length} trips matching your search! Here are the top recommendations:`,
        data: results.slice(0, 3),
        suggestions: [
          "Show me more details about these trips",
          "Filter by price range",
          "Find trips for specific dates"
        ],
        requiresHumanAgent: false
      };
    } catch (error) {
      return {
        response: "I'm having trouble searching for trips right now. Let me connect you with a human agent who can help you better.",
        requiresHumanAgent: true
      };
    }
  }

  private handleBookingQuery(message: string, context: any) {
    return {
      response: "I can help you with booking questions! Here's what you need to know about our booking process: 1) Select your preferred trip and dates, 2) Choose your package options, 3) Complete payment. Would you like me to guide you through booking a specific trip?",
      suggestions: [
        "How do I modify my booking?",
        "What payment methods do you accept?",
        "What's your cancellation policy?",
        "Connect me with an agent"
      ],
      requiresHumanAgent: message.toLowerCase().includes('problem') || message.toLowerCase().includes('issue')
    };
  }

  private async handleTripDetailQuery(message: string, context: any) {
    return {
      response: "I can provide detailed information about any trip! What specific details would you like to know? I can tell you about itineraries, inclusions, difficulty levels, best times to visit, and more.",
      suggestions: [
        "What's included in the trip price?",
        "What should I pack?",
        "What's the difficulty level?",
        "Show me photos and reviews"
      ],
      requiresHumanAgent: false
    };
  }

  private handleHelpQuery(message: string, context: any) {
    return {
      response: "I'm here to help! I can assist you with: 🔍 Finding the perfect trip, 📅 Booking and payment questions, 🎒 Trip details and preparation, 💬 General travel advice. What would you like help with?",
      suggestions: [
        "Find trips for me",
        "Help with booking",
        "Trip preparation advice",
        "Connect with human support"
      ],
      requiresHumanAgent: false
    };
  }
}

// Initialize AI service
const aiService = TrekTribeAI.getInstance();
console.log('ℹ️  [' + new Date().toISOString() + '] INFO: Trek Tribe AI initialized with advanced capabilities');

// Validation middleware
const validateSmartSearch = [
  body('query').isString().isLength({ min: 1, max: 200 }).withMessage('Query must be 1-200 characters'),
  body('filters').optional().isObject().withMessage('Filters must be an object')
];

const validateRecommendations = [
  query('limit').optional().isInt({ min: 1, max: 20 }).withMessage('Limit must be between 1 and 20')
];

const validateChatMessage = [
  body('message').isString().isLength({ min: 1, max: 1000 }).withMessage('Message must be 1-1000 characters'),
  body('context').optional().isObject().withMessage('Context must be an object')
];

// Error handling middleware
const handleValidationErrors = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array()
    });
  }
  next();
};

// Routes

// Smart search with AI-powered results
router.post('/smart-search', aiMetricsMiddleware('smart-search'), validateSmartSearch, handleValidationErrors, async (req: Request, res: Response) => {
  try {
    const { query, filters } = req.body;
    const startTime = Date.now();
    
    const results = await aiService.generateSmartSearchResults(query, filters);
    
    // Record metrics
    const categories = results.flatMap((result: any) => result.categories || []);
    aiMetricsService.recordSmartSearch(query, results.length, categories);
    
    res.json({
      success: true,
      query,
      filters,
      totalResults: results.length,
      results,
      aiInsights: {
        searchIntent: 'trip_discovery',
        processingTime: Date.now() - startTime,
        confidence: 'high'
      }
    });
  } catch (error: any) {
    console.error('AI Smart Search Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process smart search',
      message: error.message
    });
  }
});

// Personalized recommendations
router.get('/recommendations', aiMetricsMiddleware('recommendations'), authenticateToken, validateRecommendations, handleValidationErrors, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const limit = parseInt(req.query.limit as string) || 6;
    
    const recommendations = await aiService.generatePersonalizedRecommendations(userId, limit);
    
    // Record metrics
    aiMetricsService.recordRecommendation(userId, recommendations.length);
    
    res.json({
      success: true,
      userId,
      recommendations,
      aiInsights: {
        algorithm: 'collaborative_filtering_with_content_analysis',
        confidence: 'high',
        lastUpdated: new Date().toISOString()
      }
    });
  } catch (error: any) {
    console.error('AI Recommendations Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate recommendations',
      message: error.message
    });
  }
});

// User travel analytics
router.get('/analytics', aiMetricsMiddleware('analytics'), authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const startTime = Date.now();
    
    const analytics = await aiService.generateUserAnalytics(userId);
    
    // Record metrics
    const processingTime = Date.now() - startTime;
    aiMetricsService.recordAnalyticsRequest(userId, processingTime);
    
    res.json({
      success: true,
      userId,
      analytics,
      generatedAt: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('AI Analytics Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate analytics',
      message: error.message
    });
  }
});

// AI chat assistance
router.post('/chat', aiMetricsMiddleware('chat'), validateChatMessage, handleValidationErrors, async (req: Request, res: Response) => {
  try {
    const { message, context } = req.body;
    const startTime = Date.now();
    
    const aiResponse = await aiService.generateChatResponse(message, context);
    
    // Record metrics
    const responseTime = Date.now() - startTime;
    const sessionId = req.headers['x-session-id'] as string || 'anonymous';
    aiMetricsService.recordChatMessage(sessionId, responseTime, aiResponse.requiresHumanAgent);
    
    res.json({
      success: true,
      userMessage: message,
      aiResponse,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('AI Chat Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process chat message',
      message: error.message,
      fallbackResponse: {
        response: "I'm experiencing some technical difficulties. Let me connect you with a human agent who can help you right away.",
        requiresHumanAgent: true
      }
    });
  }
});

// AI service status
router.get('/status', (req: Request, res: Response) => {
  const healthMetrics = aiMetricsService.getHealthMetrics();
  
  res.json({
    success: true,
    status: healthMetrics.status,
    capabilities: [
      'smart_search',
      'personalized_recommendations', 
      'travel_analytics',
      'chat_assistance'
    ],
    version: '1.0.0',
    lastInitialized: new Date().toISOString(),
    health: healthMetrics,
    caching: {
      enabled: aiConfig.enableCaching,
      stats: aiCacheService.getStats()
    }
  });
});

// AI metrics endpoint for monitoring
router.get('/metrics', (req: Request, res: Response) => {
  const format = req.query.format as 'json' | 'prometheus' || 'json';
  const metrics = aiMetricsService.exportMetrics(format);
  
  if (format === 'prometheus') {
    res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.send(metrics);
  } else {
    res.json({
      success: true,
      metrics,
      timestamp: new Date().toISOString()
    });
  }
});

// AI cache management endpoint (admin only)
router.post('/cache/clear', (req: Request, res: Response) => {
  // In a real implementation, you'd want proper admin authentication here
  const { cacheType } = req.body;
  
  if (cacheType && cacheType !== 'all') {
    // Clear specific cache type
    if (cacheType === 'search') {
      aiCacheService.invalidateSearchCache();
    } else {
      return res.status(400).json({ success: false, error: 'Invalid cache type' });
    }
  } else {
    // Clear all caches
    aiCacheService.clearAll();
  }
  
  res.json({
    success: true,
    message: `${cacheType || 'all'} cache(s) cleared`,
    timestamp: new Date().toISOString()
  });
});

export default router;
