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

    if (!subject || !description) {
      return res.status(400).json({
        success: false,
        message: 'Subject and description are required'
      });
    }

    const ticketId = await aiSupportService.createSupportTicket(
      req.user!.id,
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
    logger.error('Error creating support ticket', { error: error.message, userId: req.user?.id });
    res.status(500).json({
      success: false,
      message: 'Failed to create support ticket'
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

export default router;