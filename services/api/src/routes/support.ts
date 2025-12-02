import express from 'express';
import { SupportTicket } from '../models/SupportTicket';
import { User } from '../models/User';
import { ChatSession } from '../models/ChatSession';
import { authenticateJwt } from '../middleware/auth';
import { socketService } from '../services/socketService';
import { logger } from '../utils/logger';
import { sanitizeText } from '../utils/sanitize';
import { ticketCreateValidators, messageValidators, handleValidationErrors } from '../validators/ticketValidator';
import axios from 'axios';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateJwt);

// Get chat history for a specific ticket
router.get('/:ticketId/chats', async (req, res) => {
  try {
    const { ticketId } = req.params;
    const userId = (req as any).auth.userId;
    const userRole = (req as any).auth.role;

    const ticket = await SupportTicket.findOne({ ticketId })
      .populate('userId', 'name email')
      .populate('assignedAgentId', 'name email');

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // Check if user has permission to view this ticket
    const canView = 
      ticket.userId.toString() === userId || // User owns the ticket
      userRole === 'agent' || // Agent can view any ticket
      userRole === 'admin'; // Admin can view any ticket

    if (!canView) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Return chat messages from the ticket
    const chatHistory = ticket.messages.map((msg: any) => ({
      id: msg._id || msg.id || Date.now().toString(),
      senderId: msg.senderId || msg.sender,
      senderName: msg.senderName,
      senderRole: msg.sender === 'customer' ? 'user' : 'agent',
      message: msg.message,
      timestamp: msg.timestamp,
      attachments: msg.attachments || []
    }));

    res.json({
      ticketId: ticket.ticketId,
      status: ticket.status,
      priority: ticket.priority,
      category: ticket.category,
      subject: ticket.subject,
      customer: {
        id: ticket.userId._id,
        name: ticket.customerName,
        email: ticket.customerEmail
      },
      assignedAgent: ticket.assignedAgentId ? {
        id: ticket.assignedAgentId._id,
        name: ticket.assignedAgentId.name,
        email: ticket.assignedAgentId.email
      } : null,
      messages: chatHistory,
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt
    });

  } catch (error: any) {
    logger.error('Error fetching ticket chat history', { 
      error: error.message, 
      ticketId: req.params.ticketId 
    });
    res.status(500).json({ error: 'Failed to fetch chat history' });
  }
});

// Create a new ticket (for contact support button)
router.post('/tickets', ticketCreateValidators, handleValidationErrors, async (req, res, next) => {
  try {
    const userId = (req as any).auth.userId;
    const { subject, description, category = 'general', priority = 'medium', relatedTripId } = req.body;

    // Sanitize and truncate to safe lengths
    const safeSubject = sanitizeText(subject, 200);
    const safeDescription = sanitizeText(description, 1000);

    // Get user info for ticket
    const user = await User.findById(userId);
    if (!user) {
      const err: any = new Error('User not found');
      err.statusCode = 404;
      return next(err);
    }

    const ticket = await SupportTicket.create({
      userId,
      subject: safeSubject,
      description: safeDescription,
      category,
      priority,
      relatedTripId,
      customerEmail: user.email,
      customerName: user.name,
      customerPhone: user.phone,
      status: 'open',
      messages: [{
        sender: 'customer',
        senderName: user.name,
        senderId: userId,
        message: safeDescription,
        timestamp: new Date()
      }]
    });

    // Notify agents about the new ticket
    socketService.notifyNewTicket({
      ticketId: ticket.ticketId,
      userId,
      customerName: user.name,
      customerEmail: user.email,
      subject: safeSubject,
      priority,
      category,
      createdAt: ticket.createdAt
    });

    logger.info('Support ticket created', { 
      ticketId: ticket.ticketId, 
      userId, 
      subject: safeSubject 
    });

    res.status(201).json({
      ticket: {
        ticketId: ticket.ticketId,
        subject: ticket.subject,
        status: ticket.status,
        priority: ticket.priority,
        category: ticket.category,
        createdAt: ticket.createdAt
      }
    });
  } catch (error: any) {
    logger.error('Error creating support ticket', { 
      error: error.message, 
      stack: error.stack,
      userId: (req as any).auth?.userId,
      ticketData: { 
        subject: req.body.subject, 
        category: req.body.category, 
        priority: req.body.priority 
      }
    });
    return next(error);
  }
});

// Get user's tickets
router.get('/tickets/my-tickets', async (req, res) => {
  try {
    const userId = (req as any).auth.userId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const status = req.query.status as string;

    const query: any = { userId };
    if (status && status !== 'all') {
      query.status = status;
    }

    const total = await SupportTicket.countDocuments(query);
    const tickets = await SupportTicket.find(query)
      .populate('assignedAgentId', 'name email')
      .populate('relatedTripId', 'title destination')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const ticketsWithLastMessage = tickets.map(ticket => ({
      ticketId: ticket.ticketId,
      subject: ticket.subject,
      status: ticket.status,
      priority: ticket.priority,
      category: ticket.category,
      assignedAgent: ticket.assignedAgentId ? {
        name: ticket.assignedAgentId.name,
        email: ticket.assignedAgentId.email
      } : null,
      relatedTrip: ticket.relatedTripId ? {
        title: ticket.relatedTripId.title,
        destination: ticket.relatedTripId.destination
      } : null,
      lastMessage: ticket.messages && ticket.messages.length > 0 
        ? ticket.messages[ticket.messages.length - 1].message 
        : ticket.description,
      lastActivity: ticket.updatedAt,
      createdAt: ticket.createdAt,
      messageCount: ticket.messages ? ticket.messages.length : 0
    }));

    res.json({
      tickets: ticketsWithLastMessage,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total
      }
    });

  } catch (error: any) {
    logger.error('Error fetching user tickets', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch tickets' });
  }
});

// Add message to existing ticket (reopen chat)
router.post('/:ticketId/messages', messageValidators, handleValidationErrors, async (req, res, next) => {
  try {
    const { ticketId } = req.params;
    const { message } = req.body;
    const userId = (req as any).auth.userId;

    const User = require('../models/User').User;
    const user = await User.findById(userId);
    if (!user) {
      const err: any = new Error('User not found');
      err.statusCode = 404;
      return next(err);
    }

    const safeMessage = sanitizeText(message, 2000);

    const ticket = await SupportTicket.findOneAndUpdate(
      { ticketId, userId }, // Ensure user owns the ticket
      {
        $push: {
          messages: {
            sender: 'customer',
            senderName: user.name,
            senderId: userId,
            message: safeMessage,
            timestamp: new Date()
          }
        },
        $set: {
          status: 'open', // Reopen ticket if it was closed
          updatedAt: new Date()
        }
      },
      { new: true }
    );

    if (!ticket) {
      const err: any = new Error('Ticket not found or access denied');
      err.statusCode = 404;
      return next(err);
    }

    // Notify agents about the ticket update
    socketService.updateTicketStatus(ticket, 'message_added');

    // If ticket has assigned agent, notify them directly
    if (ticket.assignedAgentId) {
      socketService.sendAgentReply(ticket.assignedAgentId.toString(), {
        ticketId: ticket.ticketId,
        customerName: user.name,
        message: safeMessage,
        timestamp: new Date()
      });
    }

    logger.info('Message added to ticket by user', { 
      ticketId, 
      userId, 
      messageLength: safeMessage.length 
    });

    res.json({ 
      message: 'Message sent successfully',
      ticketStatus: ticket.status 
    });

  } catch (error: any) {
    logger.error('Error adding message to ticket', { error: error.message });
    return next(error);
  }
});

// AI-assisted resolution suggestion for a ticket (customer/agent can request)
router.post('/tickets/:ticketId/ai-resolve', async (req, res) => {
  try {
    const { ticketId } = req.params;
    const userId = (req as any).auth.userId;
    const userRole = (req as any).auth.role;

    const ticket = await SupportTicket.findOne({ ticketId }).populate('userId', 'name email');
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

    // Permission: owner, agent or admin can request AI suggestion
    const canView = ticket.userId.toString() === userId || userRole === 'agent' || userRole === 'admin';
    if (!canView) return res.status(403).json({ error: 'Access denied' });

    // Build simple context from last messages + subject
    const lastMessages = (ticket.messages || []).slice(-10).map((m: any) => `${m.senderName || m.sender}: ${m.message}`).join('\n');
    const prompt = `Ticket: ${ticket.ticketId}\nSubject: ${ticket.subject}\nCategory: ${ticket.category}\nPriority: ${ticket.priority}\n\nConversation:\n${lastMessages}\n\nPlease suggest a concise resolution for this ticket and an action summary. Provide a short resolution note.`;

    const aiUrl = `${req.protocol}://${req.get('host')}/api/ai/chat`;
    const aiResp = await axios.post(aiUrl, { message: prompt, context: { ticketId: ticket.ticketId } }, { timeout: 120000 });
    const aiData = aiResp.data?.aiResponse || aiResp.data || {};

    // Normalize suggestion text
    const suggestion = (aiData && (aiData.response || aiData.suggestion || aiData.text)) || 'No suggestion available';

    res.json({ suggestion, aiRaw: aiData });
  } catch (error: any) {
    logger.error('AI resolve error', { error: error.message, ticketId: req.params.ticketId });
    res.status(500).json({ error: 'Failed to generate AI suggestion' });
  }
});

// Apply a resolution to a ticket (customer, agent or admin)
router.post('/tickets/:ticketId/resolve', async (req, res, next) => {
  try {
    const { ticketId } = req.params;
    const { resolutionNote } = req.body;
    const userId = (req as any).auth.userId;
    const userRole = (req as any).auth.role;

    const UserModel = require('../models/User').User;
    const user = await UserModel.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const ticket = await SupportTicket.findOne({ ticketId });
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

    const canResolve = ticket.userId.toString() === userId || userRole === 'agent' || userRole === 'admin';
    if (!canResolve) return res.status(403).json({ error: 'Access denied' });

    const sender = userRole === 'agent' || userRole === 'admin' ? 'agent' : 'customer';

    const safeNote = typeof resolutionNote === 'string' && resolutionNote.trim().length > 0 ? resolutionNote.trim() : 'Resolved via assistant';

    const updated = await SupportTicket.findOneAndUpdate(
      { ticketId },
      {
        $set: { status: 'resolved', updatedAt: new Date() },
        $push: {
          messages: {
            sender,
            senderName: user.name,
            senderId: userId,
            message: safeNote,
            timestamp: new Date()
          },
          internalNotes: safeNote
        }
      },
      { new: true }
    );

    if (!updated) return res.status(500).json({ error: 'Failed to update ticket' });

    // Notify sockets/agents
    socketService.updateTicketStatus(updated, 'resolved');
    if (updated.assignedAgentId) {
      socketService.sendAgentReply(updated.assignedAgentId.toString(), {
        ticketId: updated.ticketId,
        message: `Ticket ${updated.ticketId} has been resolved`,
        timestamp: new Date()
      });
    }

    logger.info('Ticket resolved via AI/chat', { ticketId: updated.ticketId, resolvedBy: userId });

    res.json({ message: 'Ticket resolved', ticketId: updated.ticketId });
  } catch (error: any) {
    logger.error('Error resolving ticket', { error: error.message, ticketId: req.params.ticketId });
    return next(error);
  }
});

export default router;