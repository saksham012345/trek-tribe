import express from 'express';
import { authenticateToken, requireRole } from '../middleware/auth';
import { aiSupportService } from '../services/aiSupportService';
import { socketService } from '../services/socketService';
import { logger } from '../utils/logger';

const router = express.Router();

/**
 * @route POST /api/chat/query
 * @description Send a query to AI support (for non-real-time requests)
 * @access Public (guests allowed)
 */
router.post('/query', async (req, res) => {
  try {
    const { message, context } = req.body;

    if (!message || message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Message is required'
      });
    }

    // Build context from request
    const chatContext = {
      userId: req.user?.id,
      userRole: req.user?.role,
      tripId: context?.tripId,
      previousMessages: context?.previousMessages || []
    };

    const aiResponse = await aiSupportService.handleUserQuery(message, chatContext);

    res.json({
      success: true,
      data: {
        message: aiResponse.message,
        requiresHumanSupport: aiResponse.requiresHumanSupport,
        suggestedActions: aiResponse.suggestedActions,
        confidence: aiResponse.confidence
      }
    });

  } catch (error: any) {
    logger.error('Error in chat query endpoint', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @route POST /api/chat/create-ticket
 * @description Create a support ticket from chat
 * @access Private
 */
router.post('/create-ticket', authenticateToken, async (req, res) => {
  try {
    const { subject, description, category, urgency } = req.body;
    
    console.log('🔍 Create ticket request:', {
      userId: req.user?.id,
      authUserId: (req as any).auth?.userId,
      body: req.body
    });

    if (!subject || !description) {
      return res.status(400).json({
        success: false,
        message: 'Subject and description are required'
      });
    }

    // Use either req.user.id or req.auth.userId
    const userId = req.user?.id || (req as any).auth?.userId;
    if (!userId) {
      console.log('❌ No user ID found in request');
      return res.status(401).json({
        success: false,
        message: 'User authentication required'
      });
    }

    console.log('✅ Creating support ticket for user:', userId);
    const ticketId = await aiSupportService.createSupportTicket(
      userId,
      subject,
      description,
      category || 'general'
    );

    res.json({
      success: true,
      data: {
        ticketId,
        message: 'Support ticket created successfully'
      }
    });

  } catch (error: any) {
    logger.error('Error creating support ticket', { 
      error: error.message, 
      stack: error.stack,
      userId: req.user?.id,
      requestBody: req.body
    });
    
    // Provide more specific error messages
    let errorMessage = 'Failed to create support ticket';
    if (error.message === 'User not found') {
      errorMessage = 'User authentication failed. Please log in again.';
    } else if (error.message.includes('validation')) {
      errorMessage = 'Invalid ticket data provided.';
    }
    
    res.status(500).json({
      success: false,
      message: errorMessage,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route GET /api/chat/service-status
 * @description Get the status of chat services
 * @access Private (agents and admins)
 */
router.get('/service-status', authenticateToken, requireRole(['agent', 'admin']), (req, res) => {
  try {
    const aiStatus = aiSupportService.getServiceStatus();
    const socketStatus = socketService.getServiceStatus();

    res.json({
      success: true,
      data: {
        aiSupport: aiStatus,
        socketService: socketStatus,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error: any) {
    logger.error('Error getting service status', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to get service status'
    });
  }
});

/**
 * @route GET /api/chat/active-sessions
 * @description Get active chat sessions (for agents)
 * @access Private (agents and admins)
 */
router.get('/active-sessions', authenticateToken, requireRole(['agent', 'admin']), (req, res) => {
  try {
    const stats = {
      activeSessions: socketService.getActiveSessionsCount(),
      connectedUsers: socketService.getConnectedUsersCount(),
      connectedAgents: socketService.getConnectedAgentsCount(),
      timestamp: new Date().toISOString()
    };

    res.json({
      success: true,
      data: stats
    });

  } catch (error: any) {
    logger.error('Error getting active sessions', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to get active sessions'
    });
  }
});

/**
 * @route POST /api/chat/test-ai
 * @description Test AI response (for development/testing)
 * @access Private (admin only)
 */
router.post('/test-ai', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        message: 'Message is required'
      });
    }

    const testContext = {
      userId: req.user!.id,
      userRole: req.user!.role,
      previousMessages: []
    };

    const aiResponse = await aiSupportService.handleUserQuery(message, testContext);

    res.json({
      success: true,
      data: {
        query: message,
        response: aiResponse,
        serviceStatus: aiSupportService.getServiceStatus()
      }
    });

  } catch (error: any) {
    logger.error('Error testing AI service', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to test AI service'
    });
  }
});

/**
 * @route GET /api/chat/health
 * @description Health check for chat services
 * @access Public
 */
router.get('/health', (req, res) => {
  try {
    const health = {
      chat: {
        aiService: aiSupportService.isServiceReady(),
        socketService: socketService.getServiceStatus().isInitialized
      },
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    };

    const isHealthy = health.chat.aiService && health.chat.socketService;

    res.status(isHealthy ? 200 : 503).json({
      success: isHealthy,
      data: health
    });

  } catch (error: any) {
    logger.error('Error in chat health check', { error: error.message });
    res.status(503).json({
      success: false,
      message: 'Health check failed'
    });
  }
});

/**
 * @route POST /api/chat/test-ticket
 * @description Test support ticket creation (for debugging)
 * @access Private
 */
router.post('/test-ticket', authenticateToken, async (req, res) => {
  try {
    const { subject, description, category } = req.body;
    
    logger.info('Testing support ticket creation', { 
      userId: req.user?.id, 
      subject, 
      category 
    });

    const ticketId = await aiSupportService.createSupportTicket(
      req.user!.id,
      subject || 'Test Support Ticket',
      description || 'This is a test support ticket created for debugging purposes.',
      category || 'general'
    );

    res.json({
      success: true,
      data: {
        ticketId,
        message: 'Test support ticket created successfully',
        userId: req.user?.id,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error: any) {
    logger.error('Error creating test support ticket', { 
      error: error.message, 
      userId: req.user?.id 
    });
    res.status(500).json({
      success: false,
      message: 'Failed to create test support ticket',
      error: error.message
    });
  }
});

/**
 * @route POST /api/chat/recommendations
 * @description Get AI-powered trip recommendations
 * @access Private (optional)
 */
router.post('/recommendations', async (req, res) => {
  try {
    const { preferences, context } = req.body;

    // Use real AI service for recommendations
    const chatContext = {
      userId: req.user?.id,
      userRole: req.user?.role,
      userPreferences: preferences || {},
      previousMessages: context?.previousMessages || []
    };

    const aiResponse = await aiSupportService.handleUserQuery(
      'recommend trips based on preferences',
      chatContext
    );

    // Extract recommendations from AI response
    const recommendations = aiResponse.additionalData?.recommendations || [];

    res.json({
      success: true,
      data: {
        recommendations,
        message: aiResponse.message,
        confidence: aiResponse.confidence
      }
    });
  } catch (error: any) {
    logger.error('Error getting AI recommendations', { error: error.message });
    
    // Fallback to real trip data if AI fails
    try {
      const { Trip } = require('../models/Trip');
      const trips = await Trip.find({ status: 'active' })
        .populate('organizerId', 'name')
        .select('title destination price categories difficultyLevel organizerId')
        .limit(5)
        .sort({ createdAt: -1 });

      const fallbackRecommendations = trips.map((trip: any, index: number) => ({
        trip: {
          _id: trip._id,
          title: trip.title,
          destination: trip.destination,
          price: trip.price,
          categories: trip.categories || ['Adventure'],
          difficultyLevel: trip.difficultyLevel || 'intermediate',
          organizerId: trip.organizerId?._id
        },
        score: 85 - (index * 5),
        reason: 'Popular adventure with great reviews',
        matchingFactors: ['Highly rated', 'Active trip']
      }));

      res.json({
        success: true,
        data: {
          recommendations: fallbackRecommendations,
          message: 'Here are some popular adventures for you!',
          confidence: 0.8
        }
      });
    } catch (fallbackError: any) {
      logger.error('Fallback recommendations failed', { error: fallbackError.message });
      res.status(500).json({
        success: false,
        message: 'Failed to get recommendations'
      });
    }
  }
});

/**
 * @route GET /api/chat/trip-availability/:tripId
 * @description Get real-time trip availability through AI
 * @access Public
 */
router.get('/trip-availability/:tripId', async (req, res) => {
  try {
    const { tripId } = req.params;

    if (!tripId) {
      return res.status(400).json({
        success: false,
        message: 'Trip ID is required'
      });
    }

    const chatContext = {
      userId: req.user?.id,
      userRole: req.user?.role,
      tripId,
      previousMessages: []
    };

    const aiResponse = await aiSupportService.handleUserQuery(
      'check availability for this trip',
      chatContext
    );

    res.json({
      success: true,
      data: {
        message: aiResponse.message,
        confidence: aiResponse.confidence
      }
    });
  } catch (error: any) {
    logger.error('Error checking trip availability', { error: error.message, tripId: req.params.tripId });
    res.status(500).json({
      success: false,
      message: 'Failed to check trip availability'
    });
  }
});

/**
 * @route GET /api/chat/organizer-profile/:tripId
 * @description Get organizer profile information through AI
 * @access Public
 */
router.get('/organizer-profile/:tripId', async (req, res) => {
  try {
    const { tripId } = req.params;

    if (!tripId) {
      return res.status(400).json({
        success: false,
        message: 'Trip ID is required'
      });
    }

    const chatContext = {
      userId: req.user?.id,
      userRole: req.user?.role,
      tripId,
      previousMessages: []
    };

    const aiResponse = await aiSupportService.handleUserQuery(
      'tell me about the organizer',
      chatContext
    );

    res.json({
      success: true,
      data: {
        message: aiResponse.message,
        confidence: aiResponse.confidence
      }
    });
  } catch (error: any) {
    logger.error('Error getting organizer profile', { error: error.message, tripId: req.params.tripId });
    res.status(500).json({
      success: false,
      message: 'Failed to get organizer profile'
    });
  }
});

/**
 * @route GET /api/chat/user-analytics
 * @description Get user travel analytics and preferences
 * @access Private
 */
router.get('/user-analytics', authenticateToken, async (req, res) => {
  try {
    const chatContext = {
      userId: req.user!.id,
      userRole: req.user!.role,
      previousMessages: []
    };

    const aiResponse = await aiSupportService.handleUserQuery(
      'show my trip analytics and history',
      chatContext
    );

    res.json({
      success: true,
      data: {
        message: aiResponse.message,
        confidence: aiResponse.confidence
      }
    });
  } catch (error: any) {
    logger.error('Error getting user analytics', { error: error.message, userId: req.user?.id });
    res.status(500).json({
      success: false,
      message: 'Failed to get user analytics'
    });
  }
});

/**
 * @route POST /api/chat/booking-assistance
 * @description Get AI-powered booking assistance
 * @access Public
 */
router.post('/booking-assistance', async (req, res) => {
  try {
    const { tripId, step } = req.body;

    const chatContext = {
      userId: req.user?.id,
      userRole: req.user?.role,
      tripId,
      previousMessages: []
    };

    let query = 'help me book this trip';
    if (step) {
      query += ` - I'm at step ${step}`;
    }

    const aiResponse = await aiSupportService.handleUserQuery(query, chatContext);

    res.json({
      success: true,
      data: {
        message: aiResponse.message,
        suggestedActions: aiResponse.suggestedActions,
        confidence: aiResponse.confidence
      }
    });
  } catch (error: any) {
    logger.error('Error providing booking assistance', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to provide booking assistance'
    });
  }
});

/**
 * @route POST /api/chat/smart-search
 * @description AI-powered natural language search for trips
 * @access Public
 */
router.post('/smart-search', async (req, res) => {
  try {
    const { query, context } = req.body;

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required and must be a non-empty string'
      });
    }

    const chatContext = {
      userId: req.user?.id,
      userRole: req.user?.role,
      searchQuery: query.trim(),
      userPreferences: context?.userPreferences || {},
      currentFilters: context?.currentFilters || {},
      previousMessages: context?.previousMessages || []
    };

    // Process natural language query through AI
    const aiResponse = await aiSupportService.handleUserQuery(
      `search: ${query.trim()}`,
      chatContext
    );

    // Extract search insights and suggestions from AI response
    const searchResult = {
      query: query.trim(),
      interpretedIntent: aiResponse.additionalData?.interpretedIntent || 
        `Looking for trips based on: ${query.trim()}`,
      suggestions: aiResponse.additionalData?.suggestions || [
        { text: 'adventure', type: 'activity', confidence: 0.8 },
        { text: 'trekking', type: 'activity', confidence: 0.7 },
        { text: 'beginner friendly', type: 'difficulty', confidence: 0.6 }
      ],
      filters: aiResponse.additionalData?.extractedFilters || {
        destination: extractDestination(query),
        category: extractCategory(query),
        difficultyLevel: extractDifficulty(query),
        priceRange: extractPriceRange(query)
      },
      naturalLanguageResponse: aiResponse.message
    };

    res.json({
      success: true,
      data: searchResult
    });

  } catch (error: any) {
    logger.error('Error processing smart search', { 
      error: error.message, 
      query: req.body?.query 
    });
    res.status(500).json({
      success: false,
      message: 'Failed to process search query'
    });
  }
});

// Helper functions for extracting search parameters
function extractDestination(query: string): string | undefined {
  const destinations = ['himachal', 'kerala', 'rajasthan', 'goa', 'ladakh', 'uttarakhand', 'kashmir'];
  const lowerQuery = query.toLowerCase();
  return destinations.find(dest => lowerQuery.includes(dest));
}

function extractCategory(query: string): string | undefined {
  const categories = ['adventure', 'trekking', 'cultural', 'wildlife', 'beach', 'mountain', 'spiritual'];
  const lowerQuery = query.toLowerCase();
  return categories.find(cat => lowerQuery.includes(cat));
}

function extractDifficulty(query: string): string | undefined {
  const lowerQuery = query.toLowerCase();
  if (lowerQuery.includes('beginner') || lowerQuery.includes('easy')) return 'beginner';
  if (lowerQuery.includes('intermediate') || lowerQuery.includes('moderate')) return 'intermediate';
  if (lowerQuery.includes('advanced') || lowerQuery.includes('challenging') || lowerQuery.includes('difficult')) return 'advanced';
  return undefined;
}

function extractPriceRange(query: string): { min: number; max: number } | undefined {
  const priceMatches = query.match(/₹?(\d+(?:,\d+)*)/g);
  if (priceMatches && priceMatches.length > 0) {
    const price = parseInt(priceMatches[0].replace(/₹|,/g, ''));
    if (query.toLowerCase().includes('under') || query.toLowerCase().includes('below')) {
      return { min: 0, max: price };
    }
    if (query.toLowerCase().includes('above') || query.toLowerCase().includes('over')) {
      return { min: price, max: 100000 };
    }
    // Default range around the mentioned price
    return { min: Math.max(0, price - 2000), max: price + 2000 };
  }
  return undefined;
}

export default router;
