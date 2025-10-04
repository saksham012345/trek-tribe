import { Router } from 'express';
import { z } from 'zod';
import { trekTribeChatbot } from '../utils/chatbotAI';
import { Chat } from '../models/Chat';
import { User } from '../models/User';

const router = Router();

// Store chat sessions in memory (in production, use Redis or database)
const chatSessions = new Map<string, any>();

// Async error wrapper
const asyncHandler = (fn: Function) => (req: any, res: any, next: any) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Schema for chat message
const chatMessageSchema = z.object({
  message: z.string().min(1).max(1000),
  sessionId: z.string().optional(),
  userId: z.string().optional()
});

// Chat endpoint
router.post('/chat', asyncHandler(async (req: any, res: any) => {
  try {
    const parsed = chatMessageSchema.safeParse(req.body);
    
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid message format',
        details: parsed.error.flatten().fieldErrors
      });
    }
    
    const { message, sessionId, userId } = parsed.data;
    
    // Generate session ID if not provided
    const currentSessionId = sessionId || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Get or create chat context
    let chatContext = chatSessions.get(currentSessionId);
    if (!chatContext) {
      chatContext = {
        userId,
        sessionId: currentSessionId,
        previousMessages: [],
        startTime: new Date(),
        messageCount: 0
      };
    }
    
    // Add user message to context
    chatContext.previousMessages.push({
      role: 'user',
      content: message,
      timestamp: new Date()
    });
    chatContext.messageCount += 1;
    
    // Process message with AI
    const response = await trekTribeChatbot.processMessage(message, chatContext);
    
    // Add bot response to context
    chatContext.previousMessages.push({
      role: 'assistant',
      content: response.message,
      timestamp: new Date(),
      intent: response.intent,
      confidence: response.confidence
    });
    
    // Keep only last 10 messages to manage memory
    if (chatContext.previousMessages.length > 10) {
      chatContext.previousMessages = chatContext.previousMessages.slice(-10);
    }
    
    // Update session
    chatSessions.set(currentSessionId, chatContext);
    
    // Clean up old sessions (older than 1 hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    for (const [id, session] of chatSessions.entries()) {
      if (session.startTime < oneHourAgo) {
        chatSessions.delete(id);
      }
    }
    
    res.json({
      success: true,
      sessionId: currentSessionId,
      message: response.message,
      intent: response.intent,
      confidence: response.confidence,
      suggestions: response.suggestions || [],
      data: response.data,
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error('Error processing chat message:', error);
    res.status(500).json({
      success: false,
      error: 'Sorry, I encountered an error processing your message. Please try again.',
      fallback: "I'm here to help with any questions about Trek Tribe trips, bookings, or policies!"
    });
  }
}));

// Get chat history
router.get('/history/:sessionId', asyncHandler(async (req: any, res: any) => {
  try {
    const { sessionId } = req.params;
    const chatContext = chatSessions.get(sessionId);
    
    if (!chatContext) {
      return res.status(404).json({
        success: false,
        error: 'Chat session not found'
      });
    }
    
    res.json({
      success: true,
      sessionId,
      messages: chatContext.previousMessages,
      messageCount: chatContext.messageCount,
      startTime: chatContext.startTime
    });
    
  } catch (error: any) {
    console.error('Error getting chat history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get chat history'
    });
  }
}));

// Clear chat session
router.delete('/session/:sessionId', asyncHandler(async (req: any, res: any) => {
  try {
    const { sessionId } = req.params;
    
    if (chatSessions.has(sessionId)) {
      chatSessions.delete(sessionId);
      res.json({
        success: true,
        message: 'Chat session cleared'
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }
    
  } catch (error: any) {
    console.error('Error clearing chat session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear chat session'
    });
  }
}));

// Get suggested questions/quick replies
router.get('/suggestions', asyncHandler(async (req: any, res: any) => {
  try {
    const suggestions = [
      {
        category: "Trip Search",
        questions: [
          "Show me Himalayan treks",
          "Find beginner-friendly trips",
          "What desert adventures do you have?",
          "Trips for solo travelers"
        ]
      },
      {
        category: "Booking Help",
        questions: [
          "How do I book a trip?",
          "What payment options do you have?",
          "Can I pay in advance?",
          "How does group booking work?"
        ]
      },
      {
        category: "Policies",
        questions: [
          "What's your cancellation policy?",
          "How do refunds work?",
          "What's included in the trip price?",
          "Age requirements for trips"
        ]
      },
      {
        category: "Safety & Preparation",
        questions: [
          "How safe are your trips?",
          "What equipment do you provide?",
          "Fitness requirements for treks",
          "Emergency procedures"
        ]
      },
      {
        category: "General Info",
        questions: [
          "Where do you organize trips?",
          "How experienced are your guides?",
          "What makes Trek Tribe different?",
          "How to contact support?"
        ]
      }
    ];
    
    res.json({
      success: true,
      suggestions,
      welcomeMessage: "Hello! 🏔️ I'm your Trek Tribe assistant. I can help you find adventures, answer questions about bookings, policies, and anything else related to trekking with us!"
    });
    
  } catch (error: any) {
    console.error('Error getting suggestions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get suggestions'
    });
  }
}));

// Get trip-specific information (when user asks about a specific trip)
router.get('/trip/:tripId', asyncHandler(async (req: any, res: any) => {
  try {
    const { tripId } = req.params;
    const tripInfo = await trekTribeChatbot.getTripInfo(tripId);
    
    if (!tripInfo) {
      return res.status(404).json({
        success: false,
        error: 'Trip not found'
      });
    }
    
    // Generate a conversational response about the trip
    const trip = tripInfo.trip;
    const message = `🏔️ **${trip.title}**

📍 **Destination:** ${trip.destination}
💰 **Price:** ₹${trip.price} per person
👥 **Capacity:** ${trip.capacity} people (${tripInfo.availability} spots available)
📅 **Duration:** ${Math.ceil((new Date(trip.endDate).getTime() - new Date(trip.startDate).getTime()) / (1000 * 60 * 60 * 24))} days
⭐ **Difficulty:** ${trip.difficultyLevel}
${trip.averageRating ? `🌟 **Rating:** ${trip.averageRating.toFixed(1)}/5` : ''}

**Description:** ${trip.description}

**What's Included:**
${trip.includedItems?.map((item: string) => `• ${item}`).join('\n') || '• All essentials covered'}

${trip.paymentOptions?.allowAdvancePayment ? '💳 **Payment:** Advance payment option available' : '💳 **Payment:** Full payment required'}

Would you like to book this adventure or need more details?`;

    res.json({
      success: true,
      message,
      tripData: tripInfo,
      suggestions: [
        "Book this trip",
        "See reviews for this trip",
        "What's the cancellation policy?",
        "Show similar trips"
      ]
    });
    
  } catch (error: any) {
    console.error('Error getting trip info:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get trip information'
    });
  }
}));

// Analytics endpoint (for admin to see popular queries)
router.get('/analytics', asyncHandler(async (req: any, res: any) => {
  try {
    const analytics = {
      activeSessions: chatSessions.size,
      totalMessages: Array.from(chatSessions.values()).reduce((sum, session) => sum + session.messageCount, 0),
      popularIntents: {},
      averageSessionDuration: 0
    };
    
    // Calculate popular intents
    const intents: any = {};
    for (const session of chatSessions.values()) {
      for (const message of session.previousMessages) {
        if (message.intent && message.role === 'assistant') {
          intents[message.intent] = (intents[message.intent] || 0) + 1;
        }
      }
    }
    analytics.popularIntents = intents;
    
    res.json({
      success: true,
      analytics
    });
    
  } catch (error: any) {
    console.error('Error getting analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get analytics'
    });
  }
}));

// Escalate to human agent
router.post('/escalate', asyncHandler(async (req: any, res: any) => {
  try {
    const escalateSchema = z.object({
      sessionId: z.string(),
      userId: z.string().optional(),
      reason: z.string().optional(),
      category: z.string().default('general'),
      priority: z.enum(['low', 'medium', 'high']).default('medium'),
      userMessage: z.string().optional()
    });
    
    const parsed = escalateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid escalation request',
        details: parsed.error.flatten().fieldErrors
      });
    }
    
    const { sessionId, userId, reason, category, priority, userMessage } = parsed.data;
    
    // Get chat context
    const chatContext = chatSessions.get(sessionId);
    if (!chatContext) {
      return res.status(404).json({
        success: false,
        error: 'Chat session not found'
      });
    }
    
    // Prepare messages for chat record
    const messages = [...chatContext.previousMessages];
    
    // Add escalation message if provided
    if (userMessage) {
      messages.push({
        senderId: userId || 'anonymous',
        senderType: 'user',
        content: userMessage,
        timestamp: new Date()
      });
    }
    
    // Create chat record in database
    const chat = new Chat({
      sessionId,
      userId: userId || null,
      status: 'waiting',
      priority,
      category,
      subject: reason || 'Customer requested human assistance',
      messages: messages.map(msg => ({
        senderId: msg.role === 'user' ? (userId || 'anonymous') : 'bot',
        senderType: msg.role === 'user' ? 'user' : 'bot',
        content: msg.content,
        timestamp: msg.timestamp || new Date()
      })),
      escalatedAt: new Date(),
      metadata: {
        originalChatbotQuery: messages[messages.length - 1]?.content
      }
    });
    
    await chat.save();
    
    // Update chat context to indicate escalation
    chatContext.escalated = true;
    chatContext.chatId = chat._id;
    chatSessions.set(sessionId, chatContext);
    
    // Find available agents
    const availableAgents = await User.find({
      role: { $in: ['agent', 'admin'] },
      isActive: true,
      lastLoginAt: { $gte: new Date(Date.now() - 60 * 60 * 1000) } // Active within last hour
    }).select('name email role');
    
    res.json({
      success: true,
      message: 'Your request has been escalated to our support team! A human agent will be with you shortly.',
      chatId: (chat._id as any).toString(),
      estimatedWaitTime: availableAgents.length > 0 ? '2-5 minutes' : '10-15 minutes',
      availableAgents: availableAgents.length,
      ticketNumber: (chat._id as any).toString().slice(-8).toUpperCase(),
      suggestions: [
        'What is my ticket number?',
        'How long is the wait time?',
        'Can I get a callback instead?'
      ]
    });
    
  } catch (error: any) {
    console.error('Error escalating to agent:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to escalate to human agent'
    });
  }
}));

// Check escalation status
router.get('/escalation/:sessionId', asyncHandler(async (req: any, res: any) => {
  try {
    const { sessionId } = req.params;
    
    const chat = await Chat.findOne({ sessionId })
      .populate('assignedAgentId', 'name email')
      .populate('userId', 'name email');
    
    if (!chat) {
      return res.status(404).json({
        success: false,
        error: 'No escalation found for this session'
      });
    }
    
    let statusMessage = '';
    let estimatedTime = null;
    
    switch (chat.status) {
      case 'waiting':
        statusMessage = 'Your request is in queue. An agent will be with you soon!';
        estimatedTime = '5-10 minutes';
        break;
      case 'in_progress':
        statusMessage = `You're now connected with ${(chat.assignedAgentId as any)?.name || 'an agent'}`;
        break;
      case 'resolved':
        statusMessage = 'Your issue has been resolved. Hope we could help!';
        break;
      case 'closed':
        statusMessage = 'This chat session has been closed.';
        break;
    }
    
    res.json({
      success: true,
      status: chat.status,
      statusMessage,
      estimatedTime,
      assignedAgent: chat.assignedAgentId ? {
        name: (chat.assignedAgentId as any).name,
        email: (chat.assignedAgentId as any).email
      } : null,
      ticketNumber: (chat._id as any).toString().slice(-8).toUpperCase(),
      escalatedAt: chat.escalatedAt,
      firstResponseAt: chat.firstResponseAt
    });
    
  } catch (error: any) {
    console.error('Error checking escalation status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check escalation status'
    });
  }
}));

// Continue chat with agent (after escalation)
router.post('/agent-chat/:chatId', asyncHandler(async (req: any, res: any) => {
  try {
    const { chatId } = req.params;
    const messageSchema = z.object({
      message: z.string().min(1).max(1000),
      senderId: z.string()
    });
    
    const parsed = messageSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid message format'
      });
    }
    
    const { message, senderId } = parsed.data;
    
    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({
        success: false,
        error: 'Chat not found'
      });
    }
    
    // Add message to chat
    chat.messages.push({
      senderId,
      senderType: 'user',
      content: message,
      timestamp: new Date()
    });
    
    await chat.save();
    
    res.json({
      success: true,
      message: 'Message sent to agent',
      status: chat.status,
      ticketNumber: (chat._id as any).toString().slice(-8).toUpperCase()
    });
    
  } catch (error: any) {
    console.error('Error sending message to agent:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send message'
    });
  }
}));

export default router;
