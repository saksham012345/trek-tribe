import express from 'express';
import { prisma } from '../lib/prisma';
import { withMongoId, withMongoIds, asPopulated } from '../lib/apiShape';
import { UserPrisma as User } from '../models/userPrismaAdapter';

import { authenticateJwt } from '../middleware/auth';
import { socketService } from '../services/socketService';
import notificationService from '../services/notificationService';
import { logger } from '../utils/logger';
import { sanitizeText } from '../utils/sanitize';
import { ticketCreateValidators, messageValidators, handleValidationErrors } from '../validators/ticketValidator';
import axios from 'axios';

/**
 * Load the Mongo users behind a set of ids. Tickets are in Postgres and users
 * are not, so populate() cannot reach across.
 */
async function loadSupportUsers(ids: (string | null | undefined)[]) {
  const unique = Array.from(new Set(ids.filter(Boolean) as string[]));
  if (unique.length === 0) return new Map<string, any>();
  const users = await User.find({ _id: { $in: unique } })
    .select('name email')
    .lean();
  return new Map<string, any>(users.map((u: any) => [u._id.toString(), u]));
}

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateJwt);

// Get chat history for a specific ticket
router.get('/:ticketId/chats', async (req, res) => {
  try {
    const { ticketId } = req.params;
    const userId = (req as any).auth.userId;
    const userRole = (req as any).auth.role;

    const row = await prisma.supportTicket.findUnique({
      where: { ticketId },
      include: { messages: { orderBy: { timestamp: 'asc' } } }
    });

    if (!row) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // populate() is gone - users are still Mongo documents - so the permission
    // check reads the plain column, and the people are fetched afterwards.
    const supportUsers = await loadSupportUsers([row.userId, row.assignedAgentId]);
    const ticket = {
      ...withMongoId(row),
      userId: asPopulated(supportUsers.get(row.userId)),
      assignedAgentId: row.assignedAgentId ? asPopulated(supportUsers.get(row.assignedAgentId)) : null,
      messages: withMongoIds(row.messages)
    };

    // Check if user has permission to view this ticket
    const canView =
      row.userId === userId || // User owns the ticket
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

    // ticketId comes from support_ticket_number_seq via the column default.
    const ticket = await prisma.supportTicket.create({
      data: {
        userId,
        subject: safeSubject,
        description: safeDescription,
        category: category as any,
        priority: priority as any,
        relatedTripId: relatedTripId || null,
        customerEmail: user.email,
        customerName: user.name,
        customerPhone: user.phone,
        status: 'open',
        messages: {
          create: [{
            sender: 'customer',
            senderName: user.name,
            senderId: userId,
            message: safeDescription
          }]
        }
      }
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

    const [total, ticketRows] = await Promise.all([
      prisma.supportTicket.count({ where: query }),
      prisma.supportTicket.findMany({
        where: query,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { messages: { orderBy: { timestamp: 'desc' }, take: 1 } }
      })
    ]);

    const listAgents = await loadSupportUsers(ticketRows.map(t => t.assignedAgentId));
    const tickets = ticketRows.map(t => ({
      ...withMongoId(t),
      assignedAgentId: t.assignedAgentId ? asPopulated(listAgents.get(t.assignedAgentId)) : null
    }));

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
      // relatedTripId used to arrive populated. Trips are still Mongo documents
      // and nothing on this list rendered more than the id, so it stays an id.
      relatedTripId: ticket.relatedTripId ?? null,
      // The include above fetched only the newest message, so it is [0] rather
      // than the last element of the whole array.
      lastMessage: ticket.messages.length > 0
        ? ticket.messages[0].message
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

    // Scoped on userId as well as ticketId, so one customer cannot post into
    // another's ticket - the same guarantee the old filter gave.
    const owned = await prisma.supportTicket.findFirst({ where: { ticketId, userId } });
    const ticket = owned
      ? await prisma.supportTicket.update({
          where: { ticketId },
          data: {
            status: 'open', // Reopen ticket if it was closed
            messages: {
              create: [{
                sender: 'customer',
                senderName: user.name,
                senderId: userId,
                message: safeMessage
              }]
            }
          }
        })
      : null;

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

    // The last ten messages are a query now, not a slice of an embedded array.
    const ticket = await prisma.supportTicket.findUnique({
      where: { ticketId },
      include: { messages: { orderBy: { timestamp: 'desc' }, take: 10 } }
    });
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

    // Permission: owner, agent or admin can request AI suggestion
    const canView = ticket.userId === userId || userRole === 'agent' || userRole === 'admin';
    if (!canView) return res.status(403).json({ error: 'Access denied' });

    const lastMessages = [...ticket.messages].reverse().map((m: any) => `${m.senderName || m.sender}: ${m.message}`).join('\n');
    const prompt = `Ticket: ${ticket.ticketId}\nSubject: ${ticket.subject}\nCategory: ${ticket.category}\nPriority: ${ticket.priority}\n\nConversation:\n${lastMessages}\n\nPlease suggest a concise resolution for this ticket and an action summary. Provide a short resolution note.`;

    const aiUrl = `${req.protocol}://${req.get('host')}/api/ai/chat`;
    const aiResp = await axios.post<any>(aiUrl, { message: prompt, context: { ticketId: ticket.ticketId } }, { timeout: 120000 });
    const aiData = (aiResp.data as any)?.aiResponse || (aiResp.data as any) || {};

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

    const ticket = await prisma.supportTicket.findUnique({ where: { ticketId } });
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

    const canResolve = ticket.userId === userId || userRole === 'agent' || userRole === 'admin';
    if (!canResolve) return res.status(403).json({ error: 'Access denied' });

    const sender = userRole === 'agent' || userRole === 'admin' ? 'agent' : 'customer';

    const safeNote = typeof resolutionNote === 'string' && resolutionNote.trim().length > 0 ? resolutionNote.trim() : 'Resolved via assistant';

    // NOTIFY first, then DELETE to save space
    const resolutionMessage = {
      sender,
      senderName: user.name,
      senderId: userId,
      message: safeNote,
      timestamp: new Date()
    };

    // Notify user via socket so they see the resolution
    if (ticket.userId) {
      socketService.sendAgentReply(userId.toString(), { // Use generic ID or specific logic if needed
        ticketId: ticket.ticketId,
        customerName: ticket.customerName,
        message: safeNote, // The resolution note
        timestamp: new Date()
      });
    }

    // Broadcast status change
    socketService.updateTicketStatus({
      ...ticket,
      status: 'resolved',
      updatedAt: new Date()
    }, 'resolved');

    // Delete the ticket from database
    // Its messages go with it by cascade.
    await prisma.supportTicket.delete({ where: { ticketId } });

    logger.info('Ticket deleted after resolution', { ticketId: ticket.ticketId, resolvedBy: userId });

    logger.info('Ticket resolved via AI/chat', { ticketId: ticket.ticketId, resolvedBy: userId });

    res.json({ message: 'Ticket resolved', ticketId: ticket.ticketId });
  } catch (error: any) {
    logger.error('Error resolving ticket', { error: error.message, ticketId: req.params.ticketId });
    return next(error);
  }
});

// Create a human agent ticket from AI chat
// For human-agent requests, validate only the 'message' field (subject/description are generated)
router.post('/human-agent/request', messageValidators, handleValidationErrors, async (req, res) => {
  try {
    const { message, category, priority, subject, description } = req.body;
    const userId = (req as any).auth?.userId || (req as any).user?.id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(401).json({ success: false, error: 'User not found' });
    }

    // Use provided subject/description or generate from message
    const ticketSubject = subject || `Human Agent Requested - ${category || 'General Support'}`;
    const ticketDescription = description || message || 'User requested to speak with a human agent';

    // Create a new support ticket
    // The hand-rolled id - a timestamp plus nine random characters - is gone.
    // support_ticket_number_seq supplies it, in the same format every other
    // ticket gets, and without the chance of two collisions this one carried.
    const ticket = await prisma.supportTicket.create({
      data: {
        userId: userId,
        customerName: user.name,
        customerEmail: user.email,
        customerPhone: user.phone || undefined,
        subject: ticketSubject,
        description: ticketDescription,
        category: (category || 'general') as any,
        priority: (priority || 'medium') as any,
        status: 'open',
        assignedAgentId: null,
        messages: {
          create: [{
            sender: 'customer',
            senderName: user.name,
            senderId: userId,
            message: ticketDescription
          }]
        }
      }
    });

    logger.info('Human agent ticket created', {
      ticketId: ticket.ticketId,
      userId,
      category: ticket.category,
      priority: ticket.priority
    });

    // Notify agents that a new ticket is waiting via Socket.IO
    try {
      socketService.notifyNewTicket({
        ticketId: ticket.ticketId,
        userId: userId,
        customerName: user.name,
        customerEmail: user.email,
        subject: ticketSubject,
        priority: ticket.priority,
        category: ticket.category,
        createdAt: ticket.createdAt
      });
    } catch (socketError) {
      logger.warn('Failed to notify agents via socket', { error: socketError });
    }

    // Send notification to user
    try {
      await notificationService.createNotification({
        userId: userId,
        type: 'ticket',
        title: 'Support Ticket Created',
        message: `Your support ticket ${ticket.ticketId} has been created. A human agent will assist you shortly.`,
        relatedTo: { type: 'ticket', id: ticket.id }
      });
    } catch (notifyError) {
      logger.warn('Failed to send notification', { error: notifyError });
    }

    res.json({
      success: true,
      message: 'Human agent ticket created successfully',
      ticket: {
        ticketId: ticket.ticketId,
        status: ticket.status,
        priority: ticket.priority,
        category: ticket.category,
        createdAt: ticket.createdAt
      }
    });

  } catch (error: any) {
    logger.error('Error creating human agent ticket', {
      error: error.message,
      stack: error.stack,
      body: req.body
    });
    res.status(500).json({
      success: false,
      error: 'Failed to create support ticket',
      message: error.message
    });
  }
});

// Get available agents for chat
router.get('/agents/available', async (req, res) => {
  try {
    const agents = await User.find({
      role: 'agent',
      isActive: true
    })
      .select('name email profilePhoto status')
      .limit(10);

    const availableAgents = agents.map((agent: any) => ({
      id: agent._id,
      name: agent.name,
      email: agent.email,
      avatar: agent.profilePhoto,
      status: agent.status || 'online',
      isAvailable: agent.status !== 'offline'
    }));

    res.json({
      success: true,
      agents: availableAgents,
      agentCount: availableAgents.filter((a: any) => a.isAvailable).length
    });

  } catch (error: any) {
    logger.error('Error fetching available agents', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch available agents'
    });
  }
});

// Send message to agent
router.post('/:ticketId/message', messageValidators, handleValidationErrors, async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { message } = req.body;
    const userId = (req as any).auth.userId;
    const userRole = (req as any).auth.role;

    const ticketRow = await prisma.supportTicket.findUnique({ where: { ticketId } });

    if (!ticketRow) {
      return res.status(404).json({ success: false, error: 'Ticket not found' });
    }

    const replyAgents = await loadSupportUsers([ticketRow.assignedAgentId]);
    const ticket = {
      ...withMongoId(ticketRow),
      assignedAgentId: ticketRow.assignedAgentId
        ? asPopulated(replyAgents.get(ticketRow.assignedAgentId))
        : null
    };

    const user = await User.findById(userId);

    // An insert rather than a push onto an embedded array, so two people
    // replying at the same moment do not overwrite each other.
    const newMessage = await prisma.supportTicketMessage.create({
      data: {
        ticketId: ticketRow.id,
        sender: userRole === 'agent' ? 'agent' : 'customer',
        senderName: user?.name || 'User',
        senderId: userId,
        message: sanitizeText(message)
      }
    });

    await prisma.supportTicket.update({
      where: { id: ticketRow.id },
      data: { updatedAt: new Date() }
    });

    // Notify via socket if agent is assigned (use existing notifyNewTicket method)
    if (ticket.assignedAgentId) {
      socketService.notifyNewTicket({
        ticketId,
        userId: ticket.userId,
        customerName: ticket.customerName,
        customerEmail: ticket.customerEmail,
        subject: ticket.subject,
        priority: ticket.priority,
        category: ticket.category,
        createdAt: ticket.createdAt
      });
    }

    res.json({
      success: true,
      message: 'Message sent',
      ticketId,
      // The insert returned the row, so the id is known without re-reading
      // the ticket and taking the last element of an array.
      messageId: newMessage.id,
      timestamp: newMessage.timestamp
    });

  } catch (error: any) {
    logger.error('Error sending message', { error: error.message, ticketId: req.params.ticketId });
    res.status(500).json({
      success: false,
      error: 'Failed to send message',
      message: error.message
    });
  }
});

export default router;