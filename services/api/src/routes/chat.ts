import express from 'express';
import { Request, Response } from 'express';
import { RealTimeChat } from '../models/RealTimeChat';
import { Query } from '../models/Query';
import { authenticateJwt } from '../middleware/auth';
import { AuthenticatedRequest } from '../middleware/roleMiddleware';
import { emailService } from '../services/emailService';
import { smsService } from '../services/smsService';
import mongoose from 'mongoose';

const router = express.Router();

// Create a new chat session
router.post('/start', authenticateJwt, async (req: any, res: any) => {
  try {
    const { queryId, priority = 'medium', subject } = req.body;
    
    if (!req.auth) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Generate unique room ID
    const roomId = `chat_${req.auth.userId}_${Date.now()}`;
    
    // Validate queryId if provided
    let relatedQuery = null;
    if (queryId) {
      relatedQuery = await Query.findById(queryId);
      if (!relatedQuery || relatedQuery.userId.toString() !== req.auth.userId) {
        return res.status(404).json({ error: 'Query not found or access denied' });
      }
    }

    // Create new chat
    const chat = new RealTimeChat({
      roomId,
      userId: new mongoose.Types.ObjectId(req.auth.userId),
      relatedQueryId: queryId ? new mongoose.Types.ObjectId(queryId) : undefined,
      subject: subject || (relatedQuery ? `Support for: ${relatedQuery.subject}` : 'General Inquiry'),
      priority,
      status: 'pending',
      participants: [{
        userId: new mongoose.Types.ObjectId(req.auth.userId),
        role: 'user',
        joinedAt: new Date(),
        isOnline: true
      }],
      messages: [{
        messageId: new mongoose.Types.ObjectId().toString(),
        senderId: new mongoose.Types.ObjectId(req.auth.userId),
        senderRole: 'user',
        type: 'system',
        content: 'Chat session started. An agent will be with you shortly.',
        timestamp: new Date(),
        readBy: []
      }]
    });

    await chat.save();

    // Send email notification to user
    try {
      await emailService.sendChatStartedNotification(req.auth.userId, {
        roomId: chat.roomId,
        subject: chat.subject,
        priority: chat.priority
      });
    } catch (emailError) {
      console.error('Failed to send chat started email:', emailError);
      // Don't fail the request if email fails
    }

    // Send SMS notification for urgent/high priority chats
    if (priority === 'urgent' || priority === 'high') {
      try {
        await smsService.sendUrgentChatNotification(req.auth.userId, {
          roomId: chat.roomId,
          priority: chat.priority
        });
      } catch (smsError) {
        console.error('Failed to send urgent chat SMS:', smsError);
      }
    }

    res.status(201).json({
      success: true,
      chat: {
        roomId: chat.roomId,
        subject: chat.subject,
        status: chat.status,
        priority: chat.priority,
        createdAt: chat.chatStartedAt
      }
    });

  } catch (error: any) {
    console.error('Error starting chat:', error);
    res.status(500).json({ error: 'Failed to start chat session' });
  }
});

// Get user's chat history
router.get('/history', authenticateJwt, async (req: any, res: any) => {
  try {
    if (!req.auth) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { page = 1, limit = 20, status } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const filter: any = { userId: new mongoose.Types.ObjectId(req.auth.userId) };
    if (status && typeof status === 'string') {
      filter.status = status;
    }

    const chats = await RealTimeChat.find(filter)
      .populate('assignedAgentId', 'name email')
      .populate('relatedQueryId', 'subject category status')
      .select('-messages') // Exclude messages for list view
      .sort({ chatStartedAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await RealTimeChat.countDocuments(filter);

    res.json({
      success: true,
      chats: chats.map(chat => ({
        roomId: chat.roomId,
        subject: chat.subject,
        status: chat.status,
        priority: chat.priority,
        assignedAgent: chat.assignedAgentId,
        relatedQuery: chat.relatedQueryId,
        startedAt: chat.chatStartedAt,
        lastMessageAt: chat.lastMessageAt,
        satisfaction: chat.satisfaction,
        messageCount: chat.messages.length
      })),
      pagination: {
        total,
        pages: Math.ceil(total / Number(limit)),
        current: Number(page),
        hasNext: skip + Number(limit) < total,
        hasPrev: Number(page) > 1
      }
    });

  } catch (error: any) {
    console.error('Error fetching chat history:', error);
    res.status(500).json({ error: 'Failed to fetch chat history' });
  }
});

// Get specific chat details
router.get('/:roomId', authenticateJwt, async (req: any, res: any) => {
  try {
    const { roomId } = req.params;
    
    if (!req.auth) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const chat = await RealTimeChat.findOne({ roomId })
      .populate('assignedAgentId', 'name email')
      .populate('relatedQueryId', 'subject category status')
      .populate('messages.senderId', 'name role');

    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    // Check access permissions
    const hasAccess = chat.userId.toString() === req.auth.userId ||
                     req.auth.role === 'agent' ||
                     req.auth.role === 'admin' ||
                     chat.assignedAgentId?.toString() === req.auth.userId;

    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({
      success: true,
      chat: {
        roomId: chat.roomId,
        subject: chat.subject,
        status: chat.status,
        priority: chat.priority,
        assignedAgent: chat.assignedAgentId,
        relatedQuery: chat.relatedQueryId,
        participants: chat.participants,
        messages: chat.messages,
        startedAt: chat.chatStartedAt,
        firstResponseAt: chat.firstResponseAt,
        closedAt: chat.chatClosedAt,
        duration: chat.chatDuration,
        satisfaction: chat.satisfaction,
        transferReason: chat.transferReason,
        isTransferredFromBot: chat.isTransferredFromBot
      }
    });

  } catch (error: any) {
    console.error('Error fetching chat details:', error);
    res.status(500).json({ error: 'Failed to fetch chat details' });
  }
});

// Agent routes - Get unassigned chats
router.get('/agent/unassigned', authenticateJwt, async (req: any, res: any) => {
  try {
    if (!req.auth || (req.auth.role !== 'agent' && req.auth.role !== 'admin')) {
      return res.status(403).json({ error: 'Agent access required' });
    }

    const { page = 1, limit = 20, priority } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const filter: any = { 
      status: 'pending',
      assignedAgentId: { $exists: false }
    };

    if (priority && typeof priority === 'string') {
      filter.priority = priority;
    }

    const chats = await RealTimeChat.find(filter)
      .populate('userId', 'name email')
      .populate('relatedQueryId', 'subject category status')
      .select('-messages')
      .sort({ priority: -1, chatStartedAt: 1 }) // High priority first, then oldest first
      .skip(skip)
      .limit(Number(limit));

    const total = await RealTimeChat.countDocuments(filter);

    // Get priority counts
    const priorityCounts = await RealTimeChat.aggregate([
      { $match: { status: 'pending', assignedAgentId: { $exists: false } } },
      { $group: { _id: '$priority', count: { $sum: 1 } } }
    ]);

    res.json({
      success: true,
      chats: chats.map(chat => ({
        roomId: chat.roomId,
        subject: chat.subject,
        priority: chat.priority,
        user: chat.userId,
        relatedQuery: chat.relatedQueryId,
        startedAt: chat.chatStartedAt,
        waitingTime: Math.floor((Date.now() - chat.chatStartedAt.getTime()) / 1000),
        isTransferredFromBot: chat.isTransferredFromBot,
        transferReason: chat.transferReason,
        lastMessagePreview: chat.messages.length > 0 
          ? chat.messages[chat.messages.length - 1].content.substring(0, 100)
          : null
      })),
      pagination: {
        total,
        pages: Math.ceil(total / Number(limit)),
        current: Number(page),
        hasNext: skip + Number(limit) < total,
        hasPrev: Number(page) > 1
      },
      priorityCounts: priorityCounts.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {} as Record<string, number>)
    });

  } catch (error: any) {
    console.error('Error fetching unassigned chats:', error);
    res.status(500).json({ error: 'Failed to fetch unassigned chats' });
  }
});

// Agent routes - Get assigned chats
router.get('/agent/assigned', authenticateJwt, async (req: any, res: any) => {
  try {
    if (!req.auth || (req.auth.role !== 'agent' && req.auth.role !== 'admin')) {
      return res.status(403).json({ error: 'Agent access required' });
    }

    const { page = 1, limit = 20, status = 'active' } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const filter: any = { 
      assignedAgentId: new mongoose.Types.ObjectId(req.auth.userId)
    };

    if (status && typeof status === 'string') {
      filter.status = status;
    }

    const chats = await RealTimeChat.find(filter)
      .populate('userId', 'name email')
      .populate('relatedQueryId', 'subject category status')
      .select('-messages')
      .sort({ lastMessageAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await RealTimeChat.countDocuments(filter);

    res.json({
      success: true,
      chats: chats.map(chat => ({
        roomId: chat.roomId,
        subject: chat.subject,
        status: chat.status,
        priority: chat.priority,
        user: chat.userId,
        relatedQuery: chat.relatedQueryId,
        startedAt: chat.chatStartedAt,
        lastMessageAt: chat.lastMessageAt,
        duration: chat.chatDuration,
        satisfaction: chat.satisfaction,
        lastMessagePreview: chat.messages.length > 0 
          ? chat.messages[chat.messages.length - 1].content.substring(0, 100)
          : null
      })),
      pagination: {
        total,
        pages: Math.ceil(total / Number(limit)),
        current: Number(page),
        hasNext: skip + Number(limit) < total,
        hasPrev: Number(page) > 1
      }
    });

  } catch (error: any) {
    console.error('Error fetching assigned chats:', error);
    res.status(500).json({ error: 'Failed to fetch assigned chats' });
  }
});

// Update chat priority
router.patch('/:roomId/priority', authenticateJwt, async (req: any, res: any) => {
  try {
    const { roomId } = req.params;
    const { priority } = req.body;

    if (!req.auth || (req.auth.role !== 'agent' && req.auth.role !== 'admin')) {
      return res.status(403).json({ error: 'Agent access required' });
    }

    if (!['low', 'medium', 'high', 'urgent'].includes(priority)) {
      return res.status(400).json({ error: 'Invalid priority value' });
    }

    const chat = await RealTimeChat.findOneAndUpdate(
      { roomId },
      { priority },
      { new: true }
    );

    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    res.json({
      success: true,
      message: 'Chat priority updated',
      roomId: chat.roomId,
      priority: chat.priority
    });

  } catch (error: any) {
    console.error('Error updating chat priority:', error);
    res.status(500).json({ error: 'Failed to update chat priority' });
  }
});

// Transfer chat to another agent
router.post('/:roomId/transfer', authenticateJwt, async (req: any, res: any) => {
  try {
    const { roomId } = req.params;
    const { targetAgentId, reason } = req.body;

    if (!req.auth || (req.auth.role !== 'agent' && req.auth.role !== 'admin')) {
      return res.status(403).json({ error: 'Agent access required' });
    }

    const chat = await RealTimeChat.findOne({ roomId });
    
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    // Check if current user is assigned to this chat or is admin
    if (req.auth.role !== 'admin' && chat.assignedAgentId?.toString() !== req.auth.userId) {
      return res.status(403).json({ error: 'You can only transfer chats assigned to you' });
    }

    // Update chat assignment
    chat.assignedAgentId = targetAgentId ? new mongoose.Types.ObjectId(targetAgentId) : undefined;
    
    // Add transfer message
    chat.messages.push({
      messageId: new mongoose.Types.ObjectId().toString(),
      senderId: new mongoose.Types.ObjectId(req.auth.userId),
      senderRole: req.auth.role as any,
      type: 'system',
      content: targetAgentId 
        ? `Chat transferred by agent. Reason: ${reason || 'No reason provided'}`
        : `Chat unassigned by agent. Reason: ${reason || 'No reason provided'}`,
      timestamp: new Date(),
      readBy: []
    });

    await chat.save();

    res.json({
      success: true,
      message: targetAgentId ? 'Chat transferred successfully' : 'Chat unassigned successfully',
      roomId: chat.roomId
    });

  } catch (error: any) {
    console.error('Error transferring chat:', error);
    res.status(500).json({ error: 'Failed to transfer chat' });
  }
});

// Get chat analytics (for admin/agent dashboard)
router.get('/analytics/overview', authenticateJwt, async (req: any, res: any) => {
  try {
    if (!req.auth || (req.auth.role !== 'agent' && req.auth.role !== 'admin')) {
      return res.status(403).json({ error: 'Agent access required' });
    }

    const { period = '7d' } = req.query;
    const periodDays = period === '24h' ? 1 : period === '7d' ? 7 : period === '30d' ? 30 : 7;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - periodDays);

    const [
      totalChats,
      activeChats,
      pendingChats,
      closedChats,
      avgResponseTime,
      avgSatisfaction,
      chatsByPriority,
      chatsByHour
    ] = await Promise.all([
      // Total chats in period
      RealTimeChat.countDocuments({
        chatStartedAt: { $gte: startDate }
      }),
      
      // Active chats
      RealTimeChat.countDocuments({
        status: 'active'
      }),
      
      // Pending chats
      RealTimeChat.countDocuments({
        status: 'pending'
      }),
      
      // Closed chats in period
      RealTimeChat.countDocuments({
        status: 'closed',
        chatClosedAt: { $gte: startDate }
      }),
      
      // Average first response time
      RealTimeChat.aggregate([
        {
          $match: {
            firstResponseAt: { $exists: true },
            chatStartedAt: { $gte: startDate }
          }
        },
        {
          $project: {
            responseTime: {
              $divide: [
                { $subtract: ['$firstResponseAt', '$chatStartedAt'] },
                1000 // Convert to seconds
              ]
            }
          }
        },
        {
          $group: {
            _id: null,
            avgResponseTime: { $avg: '$responseTime' }
          }
        }
      ]),
      
      // Average satisfaction rating
      RealTimeChat.aggregate([
        {
          $match: {
            'satisfaction.rating': { $exists: true },
            chatClosedAt: { $gte: startDate }
          }
        },
        {
          $group: {
            _id: null,
            avgSatisfaction: { $avg: '$satisfaction.rating' }
          }
        }
      ]),
      
      // Chats by priority
      RealTimeChat.aggregate([
        {
          $match: {
            chatStartedAt: { $gte: startDate }
          }
        },
        {
          $group: {
            _id: '$priority',
            count: { $sum: 1 }
          }
        }
      ]),
      
      // Chats by hour (for the last 24h)
      RealTimeChat.aggregate([
        {
          $match: {
            chatStartedAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
          }
        },
        {
          $group: {
            _id: { $hour: '$chatStartedAt' },
            count: { $sum: 1 }
          }
        },
        { $sort: { '_id': 1 } }
      ])
    ]);

    res.json({
      success: true,
      analytics: {
        totalChats,
        activeChats,
        pendingChats,
        closedChats,
        avgResponseTime: avgResponseTime[0]?.avgResponseTime || 0,
        avgSatisfaction: avgSatisfaction[0]?.avgSatisfaction || 0,
        chatsByPriority: chatsByPriority.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {} as Record<string, number>),
        chatsByHour: Array.from({ length: 24 }, (_, hour) => ({
          hour,
          count: chatsByHour.find(item => item._id === hour)?.count || 0
        }))
      },
      period,
      generatedAt: new Date()
    });

  } catch (error: any) {
    console.error('Error fetching chat analytics:', error);
    res.status(500).json({ error: 'Failed to fetch chat analytics' });
  }
});

export default router;
