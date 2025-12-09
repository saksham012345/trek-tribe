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
import OpenAI from 'openai';
import { answerGeneralQuery } from '../services/generalKnowledge';
import { knowledgeBaseService } from '../services/knowledgeBase';

const router = express.Router();

// Feature toggle: allow public fallbacks for recommendations/analytics when unauthenticated.
const AI_PUBLIC_FALLBACK = (process.env.AI_PUBLIC_FALLBACK || 'true').toLowerCase() !== 'false';

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

    // Handle weather queries with disclaimer
    const weatherKeywords = ['weather', 'temperature', 'rain', 'snow', 'wind', 'forecast', 'climate', 'monsoon', 'condition'];
    const isWeatherQuery = weatherKeywords.some(k => lowerMessage.includes(k));
    
    if (isWeatherQuery) {
      const weatherResponse = {
        response: "I appreciate your question about weather conditions, but I'm unable to provide real-time weather forecasts or current conditions. Weather in the Himalayas changes rapidly and unpredictably. For accurate weather information, I recommend:\n\n1. **Weather Apps**: Windy.com or Mountain-Forecast.com for altitude-specific forecasts\n2. **Local Sources**: Contact your trek organizer 2-3 days before departure\n3. **Government Data**: Check IMD (Indian Meteorological Department) forecasts\n\nI can, however, help you prepare for seasonal weather patterns and what to pack based on the time of year. Would you like packing tips for your trek?",
        suggestions: [
          "What to pack for this season",
          "Best time to trek",
          "Seasonal weather patterns",
          "Prepare for monsoon/winter"
        ],
        requiresHumanAgent: false,
        source: 'weather_disclaimer'
      };
      aiCacheService.setChatResponse(messageHash, weatherResponse);
      return weatherResponse;
    }

    // Simple keyword-based routing: TrekTribe-specific queries use RAG; general queries go to OpenAI chat model
    const trekKeywords = ['trek', 'trip', 'booking', 'book', 'itinerary', 'organizer', 'refund', 'upi', 'ticket', 'camping', 'trekking', 'himalaya', 'himachal', 'spiti', 'manali', 'booking id', 'reserve'];
    const isTrekRelated = trekKeywords.some(k => lowerMessage.includes(k));

    try {
      if (isTrekRelated) {
        // RAG-style response: retrieve top trips / local data and ask the model to answer using that context
        const ragResponse = await this.generateRagResponse(message, context);
        aiCacheService.setChatResponse(messageHash, ragResponse);
        return ragResponse;
      } else {
        // General queries -> external chat model
        const generalResponse = await this.generateGeneralChatResponse(message);
        aiCacheService.setChatResponse(messageHash, generalResponse);
        return generalResponse;
      }
    } catch (err: any) {
      // Fallback to friendly response on any error
      const fallback = {
        response: "I'm here to help you with trip planning, bookings, and recommendations! You can ask me about finding trips, booking details, or any other questions about Trek Tribe. What would you like to know?",
        suggestions: [
          "Find mountain trekking trips",
          "Help me book a trip",
          "Show me my trip recommendations",
          "What are the popular destinations?"
        ],
        requiresHumanAgent: false
      };
      aiCacheService.setChatResponse(messageHash, fallback);
      return fallback;
    }
  }

  // Call OpenAI chat model for general queries
  private async generateGeneralChatResponse(message: string) {
    const model = process.env.GENERAL_AI_MODEL || 'gpt-3.5-turbo';
    try {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        // Use knowledge base search as primary fallback
        try {
          const results = await knowledgeBaseService.search(message, 3);
          if (results.length > 0 && results[0].similarity > 0.15) {
            const topDoc = results[0].document;
            return { 
              response: topDoc.content, 
              suggestions: ['Tell me more', 'Show related trips', 'Contact support'],
              requiresHumanAgent: false,
              source: 'knowledge_base',
              confidence: results[0].similarity
            };
          }
          
          // Fallback to legacy general knowledge if KB doesn't have good match
          const local = await answerGeneralQuery(message);
          if (local && local.response) {
            return { response: local.response, suggestions: [], requiresHumanAgent: false, source: local.source };
          }
        } catch (e) {
          console.error('Knowledge base search error:', e);
        }
        return { response: "Sorry, general AI service is not configured.", suggestions: [], requiresHumanAgent: false };
      }
      
      // Use OpenAI with knowledge base context
      const kbResults = await knowledgeBaseService.search(message, 3);
      let contextStr = '';
      if (kbResults.length > 0) {
        contextStr = '\n\nRelevant TrekTribe information:\n' + 
          kbResults.map(r => r.document.content).join('\n\n');
      }
      
      const client = new OpenAI({ apiKey });
      const systemPrompt = `You are a helpful travel assistant for TrekTribe. Answer succinctly and helpfully. Use the provided context when relevant.`;
      const resp = await client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message + contextStr }
        ],
        max_tokens: 400
      });

      const text = resp.choices?.[0]?.message?.content || '';
      return { response: text.trim(), suggestions: [], requiresHumanAgent: false };
    } catch (error: any) {
      console.error('OpenAI general chat error:', error?.message || error);
      // Try knowledge base as fallback if OpenAI fails
      try {
        const results = await knowledgeBaseService.search(message, 3);
        if (results.length > 0 && results[0].similarity > 0.15) {
          const topDoc = results[0].document;
          return { 
            response: topDoc.content, 
            suggestions: ['Tell me more', 'Show related trips'],
            requiresHumanAgent: false,
            source: 'knowledge_base_fallback'
          };
        }
        
        const local = await answerGeneralQuery(message);
        if (local && local.response) {
          return { response: local.response, suggestions: [], requiresHumanAgent: false, source: local.source };
        }
      } catch (e) {
        // ignore and return default message
      }
      return { response: "I'm having trouble reaching the general AI service right now.", suggestions: [], requiresHumanAgent: false };
    }
  }

  // RAG-style response for TrekTribe-specific queries
  private async generateRagResponse(message: string, context: any) {
    // Use knowledge base for comprehensive context retrieval
    const kbResults = await knowledgeBaseService.search(message, 5, 'trip');
    
    // Safety-sensitive queries: provide immediate local guidance and offer agent handoff
    const safetyKeywords = ['safety', 'safe', 'solo female', 'solo', 'female', 'safety concerns', 'emergency'];
    if (safetyKeywords.some(k => message.toLowerCase().includes(k))) {
      // Search knowledge base for safety info
      const safetyResults = await knowledgeBaseService.search(message, 3);
      const safetyDocs = safetyResults.filter(r => 
        r.document.metadata.category === 'safety' || 
        r.document.type === 'general'
      );
      
      if (safetyDocs.length > 0 && safetyDocs[0].similarity > 0.2) {
        return { 
          response: safetyDocs[0].document.content, 
          suggestions: ['Connect me with an agent', 'Show emergency contacts', 'Safety tips for treks'],
          requiresHumanAgent: false,
          source: 'knowledge_base_safety'
        };
      }
      
      const safetyResponse = `Safety tips for solo female travelers:\n- Prefer guided groups or trusted local guides; avoid isolated areas at night.\n- Share itinerary with family and maintain regular check-ins; carry a charged power bank.\n- Respect local customs and dress modestly where appropriate.\n- Keep copies of ID and emergency contacts; note nearest hospitals and police stations.\n- For high-altitude treks, acclimatize properly and check weather/road conditions before travel.\nIf you'd like, I can connect you with a human agent for detailed local safety planning.`;
      return { response: safetyResponse, suggestions: ['Connect me with an agent', 'Show local emergency contacts'], requiresHumanAgent: false };
    }
    
    // Compose context from knowledge base results
    let docsContext = '';
    if (kbResults.length > 0) {
      docsContext = kbResults
        .slice(0, 3)
        .map((r, idx) => `${idx + 1}. ${r.document.title}\n${r.document.content}`)
        .join('\n\n');
    } else {
      // Fallback to legacy trip search if KB has no results
      const searchResults = await this.generateSmartSearchResults(message, {});
      const top = (searchResults || []).slice(0, 3);
      
      if (top.length === 0) {
        // Seed a small curated fallback list
        const curated = [
          { title: 'Parvati Valley Budget Trek', destination: 'Parvati Valley, Himachal', price: '₹6,500', description: 'A 4-5 day beginner-friendly trek with homestays and local guides.' },
          { title: 'Kheerganga Short Trek', destination: 'Kheerganga, Himachal', price: '₹4,000', description: 'Popular 2-day trek with hot springs, suitable for monsoon window closures.' },
          { title: 'Spiti Valley Explorer', destination: 'Spiti Valley, Himachal', price: '₹14,000', description: 'A longer 6-day itinerary for high-altitude exploration and cultural visits.' }
        ];
        docsContext = curated.map((t, idx) => `Trip ${idx + 1}: ${t.title} - ${t.destination}. Price: ${t.price}. Short: ${t.description}`).join('\n\n');
      } else {
        docsContext = top.map((t: any, idx: number) => `Trip ${idx + 1}: ${t.title} - ${t.destination || ''}. Price: ${t.price || 'N/A'}. Short: ${t.description?.slice(0, 200) || ''}`).join('\n\n');
      }
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      // If no external model, return knowledge base results directly
      if (kbResults.length > 0 && kbResults[0].similarity > 0.2) {
        const topResult = kbResults[0];
        const relatedTrips = kbResults.slice(1, 4).filter(r => r.document.type === 'trip');
        
        let response = topResult.document.content;
        if (relatedTrips.length > 0) {
          response += '\n\nRelated trips:\n' + relatedTrips
            .map(r => `• ${r.document.title}`)
            .join('\n');
        }
        
        return { 
          response, 
          suggestions: ['Help me book', 'Tell me more', 'Show similar trips'],
          requiresHumanAgent: false,
          source: 'knowledge_base_direct',
          matchedTrips: kbResults.filter(r => r.document.type === 'trip').map(r => r.document.metadata.tripId)
        };
      }
      
      // Fallback to context display
      return { response: `Based on your query, here's what I found:\n\n${docsContext}\n\nWould you like to know more about any of these trips?`, suggestions: ['Help me book a trip', 'Show trip details', 'Compare prices'], requiresHumanAgent: false };
    }

    try {
      const client = new OpenAI({ apiKey });
      const systemPrompt = `You are TrekTribe assistant. Use only the provided TrekTribe context when answering questions about trips, bookings, policies. If the user asks general non-TrekTribe questions, briefly answer then offer to help with trip planning.`;
      const userPrompt = `Context:\n${docsContext}\n\nUser question:\n${message}\n\nAnswer concisely and include actionable next steps (e.g., 'Book', 'Modify booking', 'Contact agent') if relevant.`;

      const resp = await client.chat.completions.create({
        model: process.env.RAG_MODEL || (process.env.GENERAL_AI_MODEL || 'gpt-3.5-turbo'),
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 600
      });

      const text = resp.choices?.[0]?.message?.content || '';
      return { response: text.trim(), suggestions: [], requiresHumanAgent: false, aiContextDocs: top };
    } catch (error: any) {
      console.error('RAG OpenAI error:', error?.message || error);
      return { response: 'I encountered an error while fetching trek-specific info. Please try again or connect with an agent.', suggestions: ['Connect me with an agent'], requiresHumanAgent: true };
    }
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
    // Extract search intent from message with enhanced keyword detection
    const query = message.toLowerCase();
    let searchTerms = "";
    let filters: any = {};
    let searchCategory = [];

    // Enhanced nature/outdoor detection
    if (query.includes('nature') || query.includes('natural') || query.includes('wilderness') || 
        query.includes('outdoor') || query.includes('forest') || query.includes('wildlife')) {
      searchCategory.push('Nature', 'Wildlife', 'Adventure', 'Mountain');
      searchTerms = "nature outdoor wilderness";
    }
    // Mountain/trekking detection
    else if (query.includes('mountain') || query.includes('trek') || query.includes('hiking') || 
             query.includes('peak') || query.includes('altitude')) {
      searchCategory.push('Mountain', 'Adventure', 'Trekking');
      searchTerms = "mountain trekking hiking";
    }
    // Beach/coastal detection
    else if (query.includes('beach') || query.includes('coastal') || query.includes('ocean') || 
             query.includes('sea') || query.includes('island')) {
      searchCategory.push('Beach', 'Coastal', 'Water');
      searchTerms = "beach coastal ocean";
    }
    // Cultural/heritage detection
    else if (query.includes('cultural') || query.includes('heritage') || query.includes('temple') ||
             query.includes('historic') || query.includes('traditional')) {
      searchCategory.push('Cultural', 'Heritage', 'Historical');
      searchTerms = "cultural heritage historic";
    }
    // Adventure/sports detection
    else if (query.includes('adventure') || query.includes('extreme') || query.includes('sport') ||
             query.includes('adrenaline') || query.includes('thrill')) {
      searchCategory.push('Adventure', 'Sports', 'Extreme');
      searchTerms = "adventure sports extreme";
    }
    // Default broad search for any trip-related query
    else {
      searchTerms = query; // Use the full query for broader search
    }

    try {
      // First try specific category search
      let results = [];
      if (searchCategory.length > 0) {
        const categoryResults = await Trip.find({
          categories: { $in: searchCategory },
          status: 'active'
        })
        .populate('organizerId', 'name profilePhoto')
        .sort({ averageRating: -1, createdAt: -1 })
        .limit(10);
        
        results = categoryResults.map(trip => ({
          ...trip.toObject(),
          relevanceScore: 85, // High relevance for category matches
          aiInsights: {
            matchReason: `Perfect match for ${searchCategory.join(', ').toLowerCase()} trips`,
            recommendationStrength: 'high'
          }
        }));
      }

      // If no category matches, try general search
      if (results.length === 0) {
        results = await this.generateSmartSearchResults(searchTerms, filters);
      }

      if (results.length > 0) {
        return {
          response: `Great news! I found ${results.length} amazing trips for you. Here are my top recommendations:`,
          data: results.slice(0, 5), // Show more results
          suggestions: [
            "Tell me more about these trips",
            "Show trips in a specific price range",
            "Find trips for particular dates",
            "See all available nature trips"
          ],
          requiresHumanAgent: false,
          searchInsights: {
            searchType: searchCategory.length > 0 ? 'category_based' : 'keyword_based',
            categories: searchCategory,
            totalFound: results.length
          }
        };
      } else {
        return {
          response: "I don't see any trips matching your specific criteria right now, but we have many amazing adventures available! Let me show you some popular options that might interest you.",
          data: await this.getPopularTrips(),
          suggestions: [
            "Show me all available trips",
            "Find trips by destination",
            "See budget-friendly options",
            "Connect with support for custom trips"
          ],
          requiresHumanAgent: false
        };
      }
    } catch (error) {
      console.error('Trip search error:', error);
      return {
        response: "I'm having a small technical hiccup while searching. Let me show you some of our most popular trips instead!",
        data: await this.getPopularTrips().catch(() => []),
        suggestions: [
          "Try searching again",
          "Browse all trips",
          "Connect with support agent"
        ],
        requiresHumanAgent: false
      };
    }
  }

  public async getPopularTrips(limit: number = 3) {
    try {
      const popularTrips = await Trip.find({ status: 'active' })
        .populate('organizerId', 'name profilePhoto')
        .sort({ averageRating: -1, reviewCount: -1 })
        .limit(limit);
      
      return popularTrips.map(trip => ({
        ...trip.toObject(),
        relevanceScore: 75,
        aiInsights: {
          matchReason: 'Popular choice among travelers',
          recommendationStrength: 'medium'
        }
      }));
    } catch (error) {
      console.error('Error fetching popular trips:', error);
      return [];
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

// Initialize knowledge base in background
knowledgeBaseService.initialize().catch(err => {
  console.error('❌ Failed to initialize knowledge base:', err);
});

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

// Recommendations (public-friendly): returns personalized recommendations when authenticated,
// otherwise returns a set of popular recommendations so AI features are visible to everyone.
router.get('/recommendations', aiMetricsMiddleware('recommendations'), validateRecommendations, handleValidationErrors, async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 6;

    // If user is authenticated, return personalized recommendations
    const user = (req as any).user;
    if (user && user.id) {
      const userId = user.id;
      const recommendations = await aiService.generatePersonalizedRecommendations(userId, limit);
      aiMetricsService.recordRecommendation(userId, recommendations.length);
      return res.json({
        success: true,
        userId,
        recommendations,
        aiInsights: {
          algorithm: 'collaborative_filtering_with_content_analysis',
          confidence: 'high',
          lastUpdated: new Date().toISOString()
        }
      });
    }

    // Public fallback: return popular trips so the feature is useful without auth
    const publicRecs = await aiService.getPopularTrips(limit).catch(() => []);
    aiMetricsService.recordRecommendation('public', publicRecs.length);
    return res.json({
      success: true,
      userId: null,
      recommendations: publicRecs,
      aiInsights: {
        algorithm: 'popularity_fallback',
        confidence: 'medium',
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
router.get('/analytics', aiMetricsMiddleware('analytics'), async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const startTime = Date.now();

    if (user && user.id) {
      const userId = user.id;
      const analytics = await aiService.generateUserAnalytics(userId);
      const processingTime = Date.now() - startTime;
      aiMetricsService.recordAnalyticsRequest(userId, processingTime);
      return res.json({
        success: true,
        userId,
        analytics,
        generatedAt: new Date().toISOString()
      });
    }

    // Public fallback: return lightweight demo analytics so the dashboard and AI are usable without login
    const demoAnalytics = {
      summary: {
        totalTrips: 0,
        totalSpent: 0,
        averageRating: 0,
        memberSince: null
      },
      preferences: {},
      travelPattern: {},
      insights: {},
      achievements: []
    };
    aiMetricsService.recordAnalyticsRequest('public', 0);
    return res.json({
      success: true,
      userId: null,
      analytics: demoAnalytics,
      generatedAt: new Date().toISOString(),
      note: 'Demo analytics for unauthenticated users. Log in as an organizer for personalized analytics.'
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
    
    // Return both names for backward compatibility with older clients/tests that expect
    // a top-level `response` string and a flattened shape.
    const flattened: any = { ...(aiResponse || {}) };
    if (aiResponse && (aiResponse as any).response) {
      flattened.response = (aiResponse as any).response;
    }

    res.json({
      success: true,
      userMessage: message,
      // original structured response
      aiResponse,
      // flattened top-level fields (backwards compatibility)
      ...flattened,
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
  const kbStats = knowledgeBaseService.getStats();
  
  res.json({
    success: true,
    status: healthMetrics.status,
    capabilities: [
      'smart_search',
      'personalized_recommendations', 
      'travel_analytics',
      'chat_assistance',
      'knowledge_base_retrieval'
    ],
    version: '2.0.0',
    lastInitialized: new Date().toISOString(),
    health: healthMetrics,
    caching: {
      enabled: aiConfig.enableCaching,
      stats: aiCacheService.getStats()
    },
    knowledgeBase: kbStats
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

// Knowledge base search endpoint
router.post('/knowledge-search', aiMetricsMiddleware('knowledge-search'), async (req: Request, res: Response) => {
  try {
    const { query, topK = 5, type } = req.body;
    
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Query is required'
      });
    }

    const results = await knowledgeBaseService.search(query.trim(), topK, type);
    
    res.json({
      success: true,
      query: query.trim(),
      results: results.map(r => ({
        id: r.document.id,
        type: r.document.type,
        title: r.document.title,
        content: r.document.content,
        similarity: r.similarity,
        metadata: r.document.metadata
      })),
      totalResults: results.length,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Knowledge search error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search knowledge base',
      message: error.message
    });
  }
});

// Refresh knowledge base endpoint (admin/cron)
router.post('/knowledge-refresh', async (req: Request, res: Response) => {
  try {
    await knowledgeBaseService.refreshKnowledgeBase();
    const stats = knowledgeBaseService.getStats();
    
    res.json({
      success: true,
      message: 'Knowledge base refreshed successfully',
      stats,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Knowledge refresh error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to refresh knowledge base',
      message: error.message
    });
  }
});

export default router;
