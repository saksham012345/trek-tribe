import express from 'express';
import { z } from 'zod';
import { SupportTicket } from '../models/SupportTicket';
import { User } from '../models/User';
import { Trip } from '../models/Trip';
import { authenticateJwt } from '../middleware/auth';
import { whatsappService } from '../services/whatsappService';
import { emailService } from '../services/emailService';
import { socketService } from '../services/socketService';
import { logger } from '../utils/logger';
import { analyzeChatForLead } from '../services/chatLeadService';

const router = express.Router();

// Middleware to check if user is an agent
const requireAgent = (req: any, res: any, next: any) => {
  const userRole = req.auth?.role;
  if (userRole !== 'agent' && userRole !== 'admin') {
    return res.status(403).json({ error: 'Agent access required' });
  }
  next();
};

// Apply auth and agent check to all routes
router.use(authenticateJwt);
router.use(requireAgent);

// Get agent dashboard statistics
router.get('/stats', async (req, res) => {
  try {
    const agentId = (req as any).auth.userId;
    
    // Get ticket statistics
    const [totalTickets, openTickets, inProgressTickets, resolvedTickets] = await Promise.all([
      SupportTicket.countDocuments({ assignedAgentId: agentId }),
      SupportTicket.countDocuments({ assignedAgentId: agentId, status: 'open' }),
      SupportTicket.countDocuments({ assignedAgentId: agentId, status: 'in-progress' }),
      SupportTicket.countDocuments({ assignedAgentId: agentId, status: 'resolved' })
    ]);

    // Get unassigned tickets (for all agents to see)
    const unassignedTickets = await SupportTicket.countDocuments({ assignedAgentId: null, status: { $ne: 'closed' } });

    // Get recent activity
    const recentTickets = await SupportTicket.find({ assignedAgentId: agentId })
      .populate('userId', 'name email')
      .sort({ updatedAt: -1 })
      .limit(5)
      .select('ticketId subject status priority updatedAt customerName');

    // Get performance metrics (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const resolvedInPeriod = await SupportTicket.find({
      assignedAgentId: agentId,
      status: 'resolved',
      resolvedAt: { $gte: thirtyDaysAgo }
    });

    const avgResolutionTime = resolvedInPeriod.length > 0 
      ? resolvedInPeriod.reduce((acc, ticket) => {
          if (ticket.resolutionTime && ticket.createdAt) {
            return acc + (ticket.resolutionTime.getTime() - ticket.createdAt.getTime());
          }
          return acc;
        }, 0) / resolvedInPeriod.length / (1000 * 60 * 60) // Convert to hours
      : 0;

    const avgSatisfactionRating = resolvedInPeriod.length > 0 
      ? resolvedInPeriod
          .filter(ticket => ticket.customerSatisfactionRating)
          .reduce((acc, ticket) => acc + (ticket.customerSatisfactionRating || 0), 0) / 
        resolvedInPeriod.filter(ticket => ticket.customerSatisfactionRating).length
      : 0;

    res.json({
      tickets: {
        total: totalTickets,
        open: openTickets,
        inProgress: inProgressTickets,
        resolved: resolvedTickets,
        unassigned: unassignedTickets
      },
      performance: {
        avgResolutionTimeHours: Math.round(avgResolutionTime * 100) / 100,
        avgSatisfactionRating: Math.round(avgSatisfactionRating * 100) / 100,
        resolvedLast30Days: resolvedInPeriod.length
      },
      recentActivity: recentTickets
    });

  } catch (error: any) {
    logger.error('Error fetching agent stats', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch agent statistics' });
  }
});

// Get all tickets (with pagination and filtering)
router.get('/tickets', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = req.query.status as string;
    const priority = req.query.priority as string;
    const category = req.query.category as string;
    const assigned = req.query.assigned as string; // 'me', 'unassigned', 'all'
    const search = req.query.search as string || '';

    const agentId = (req as any).auth.userId;
    const query: any = {};

    // Filter by assignment
    if (assigned === 'me') {
      query.assignedAgentId = agentId;
    } else if (assigned === 'unassigned') {
      query.assignedAgentId = null;
    }
    // 'all' shows all tickets

    // Filter by status, priority, category
    if (status && status !== 'all') query.status = status;
    if (priority && priority !== 'all') query.priority = priority;
    if (category && category !== 'all') query.category = category;

    // Search functionality
    if (search) {
      query.$or = [
        { ticketId: { $regex: search, $options: 'i' } },
        { subject: { $regex: search, $options: 'i' } },
        { customerName: { $regex: search, $options: 'i' } },
        { customerEmail: { $regex: search, $options: 'i' } }
      ];
    }

    const total = await SupportTicket.countDocuments(query);
    const tickets = await SupportTicket.find(query)
      .populate('userId', 'name email phone')
      .populate('assignedAgentId', 'name email')
      .populate('relatedTripId', 'title destination')
      .sort({ priority: 1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.json({
      tickets,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total
      }
    });

  } catch (error: any) {
    logger.error('Error fetching tickets', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch tickets' });
  }
});

// Get specific ticket details
router.get('/tickets/:ticketId', async (req, res) => {
  try {
    const { ticketId } = req.params;
    
    const ticket = await SupportTicket.findOne({ ticketId })
      .populate('userId', 'name email phone profilePhoto')
      .populate('assignedAgentId', 'name email')
      .populate('relatedTripId', 'title destination startDate endDate price');

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    res.json({ ticket });

  } catch (error: any) {
    logger.error('Error fetching ticket details', { error: error.message, ticketId: req.params.ticketId });
    res.status(500).json({ error: 'Failed to fetch ticket details' });
  }
});

// Assign ticket to agent
router.post('/tickets/:ticketId/assign', async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { assignedAgentId } = req.body;
    const currentAgentId = (req as any).auth.userId;

    const ticket = await SupportTicket.findOneAndUpdate(
      { ticketId },
      { 
        assignedAgentId: assignedAgentId || currentAgentId,
        status: 'in-progress'
      },
      { new: true }
    ).populate('assignedAgentId', 'name email');

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    logger.info('Ticket assigned', { 
      ticketId, 
      assignedTo: assignedAgentId || currentAgentId,
      assignedBy: currentAgentId 
    });

    res.json({ ticket, message: 'Ticket assigned successfully' });

  } catch (error: any) {
    logger.error('Error assigning ticket', { error: error.message });
    res.status(500).json({ error: 'Failed to assign ticket' });
  }
});

// Ask AI to suggest a resolution for the ticket
router.post('/tickets/:ticketId/ai-resolve', async (req, res) => {
  try {
    const { ticketId } = req.params;
    const ticket = await SupportTicket.findOne({ ticketId }).populate('userId', 'name email');
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

    // Build a concise prompt from the ticket details and recent messages
    const recentMessages = (ticket.messages || []).slice(-10).map((m: any) => `${m.senderName || m.sender}: ${m.message}`).join('\n');
    const prompt = `You are a helpful customer support agent. A customer raised the following support ticket:\n\nSubject: ${ticket.subject}\nCustomer: ${ticket.customerName} (${ticket.customerEmail})\n\nConversation:\n${recentMessages}\n\nProvide a concise, professional resolution note and a one-paragraph reply the agent can send to the customer. Keep it under 300 words.`;

    // Forward to AI service (use server-side AI key)
    const axios = require('axios');
    const AI_SERVICE_URL = (process.env.AI_SERVICE_URL || 'http://localhost:8000').replace(/\/$/, '');
    const AI_SERVICE_KEY = process.env.AI_SERVICE_KEY || process.env.AI_KEY || '';

    const resp = await axios.post(
      `${AI_SERVICE_URL}/generate`,
      { prompt, max_tokens: 800 },
      { headers: { 'Content-Type': 'application/json', 'x-api-key': AI_SERVICE_KEY }, timeout: parseInt(process.env.AI_PROXY_TIMEOUT_MS || '120000', 10) }
    );

    const data: any = resp.data || {};
    const suggestion = typeof data.text === 'string' ? data.text : JSON.stringify(data);

    res.json({ success: true, suggestion });
  } catch (error: any) {
    console.error('AI suggestion error:', error?.message || error);
    res.status(502).json({ error: 'ai_service_unavailable', message: 'Failed to get AI suggestion' });
  }
});

// Resolve ticket (agent resolving after AI suggestion or manual)
router.post('/tickets/:ticketId/resolve', async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { resolutionNote } = req.body;
    const agentId = (req as any).auth.userId;

    const ticket = await SupportTicket.findOne({ ticketId });
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

    // Only assigned agent or admin can resolve
    if (ticket.assignedAgentId && ticket.assignedAgentId.toString() !== agentId && (req as any).auth.role !== 'admin') {
      return res.status(403).json({ error: 'Only assigned agent or admin can resolve this ticket' });
    }

    // Mark resolved and record timestamps. Keep notes in internalNotes for audit.
    ticket.status = 'resolved';
    ticket.resolvedAt = new Date();
    ticket.resolutionTime = new Date();
    ticket.updatedAt = new Date();
    if (resolutionNote) {
      ticket.internalNotes = ticket.internalNotes || [];
      ticket.internalNotes.push(`Resolved by ${agentId}: ${resolutionNote}`);
    }

    await ticket.save();

    // Optionally notify customer (async)
    setTimeout(async () => {
      try {
        if (emailService.isServiceReady()) {
          await emailService.sendTicketResolvedNotification({
            userName: ticket.customerName,
            userEmail: ticket.customerEmail,
            ticketId: ticket.ticketId,
            resolutionNote: resolutionNote || 'Resolved by agent'
          });
        }
      } catch (err: any) {
        logger.error('Failed to send ticket resolved email', { error: err?.message || err, ticketId });
      }
    }, 1000);

    res.json({ success: true, message: 'Ticket resolved successfully', ticket });
  } catch (error: any) {
    console.error('Resolve ticket error:', error?.message || error);
    res.status(500).json({ error: 'Failed to resolve ticket' });
  }
});

// Update ticket status
router.patch('/tickets/:ticketId/status', async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { status } = req.body;

    if (!['open', 'in-progress', 'waiting-customer', 'resolved', 'closed'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const ticket = await SupportTicket.findOneAndUpdate(
      { ticketId },
      { status },
      { new: true }
    );

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    logger.info('Ticket status updated', { ticketId, status, agentId: (req as any).auth.userId });

    res.json({ ticket, message: 'Ticket status updated successfully' });

  } catch (error: any) {
    logger.error('Error updating ticket status', { error: error.message });
    res.status(500).json({ error: 'Failed to update ticket status' });
  }
});

// Add message to ticket
const addMessageSchema = z.object({
  message: z.string().min(1).max(2000),
  attachments: z.array(z.string()).optional()
});

router.post('/tickets/:ticketId/messages', async (req, res) => {
  try {
    const { ticketId } = req.params;
    const agentId = (req as any).auth.userId;
    
    const parsed = addMessageSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid message data', details: parsed.error.flatten() });
    }

    const { message, attachments } = parsed.data;

    // Get agent info
    const agent = await User.findById(agentId);
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    const ticket = await SupportTicket.findOneAndUpdate(
      { ticketId },
      {
        $push: {
          messages: {
            sender: 'agent',
            senderName: agent.name,
            senderId: agentId,
            message,
            attachments: attachments || [],
            timestamp: new Date()
          }
        },
        status: 'waiting-customer'
      },
      { new: true }
    ).populate('userId', 'name email phone');

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // Send email notification to customer (async)
    setTimeout(async () => {
      try {
        if (emailService.isServiceReady()) {
          const frontendUrl = process.env.FRONTEND_URL || 'https://www.trektribe.in';
          const replyUrl = `${frontendUrl}/support/tickets/${ticketId}`;
          
          await emailService.sendAgentReplyNotification({
            userName: ticket.customerName,
            userEmail: ticket.customerEmail,
            ticketId: ticket.ticketId,
            ticketSubject: ticket.subject,
            agentName: agent.name,
            agentMessage: message,
            replyUrl
          });
          
          logger.info('Agent reply email notification sent', {
            ticketId,
            userEmail: ticket.customerEmail,
            agentName: agent.name
          });
        }
      } catch (error: any) {
        logger.error('Failed to send agent reply email notification', { 
          error: error.message,
          ticketId,
          userEmail: ticket.customerEmail
        });
      }
    }, 1000);

    logger.info('Message added to ticket', { ticketId, agentId, messageLength: message.length });

    // Analyze chat for lead generation (async, non-blocking)
    if (ticket.userId && ticket.messages && ticket.messages.length > 2) {
      analyzeChatForLead(ticket.userId.toString(), ticket.messages.map(m => ({
        role: m.sender === 'agent' ? 'assistant' : 'user',
        content: m.message,
        timestamp: m.timestamp
      }))).catch(err => {
        logger.error('Failed to analyze chat for lead', { error: err.message, ticketId });
      });
    }

    res.json({ ticket, message: 'Message added successfully' });

  } catch (error: any) {
    logger.error('Error adding message to ticket', { error: error.message });
    res.status(500).json({ error: 'Failed to add message' });
  }
});

// Create new ticket (for agents creating tickets on behalf of customers)
const createTicketSchema = z.object({
  userId: z.string(),
  subject: z.string().min(1).max(200),
  description: z.string().min(1).max(1000),
  category: z.enum(['booking', 'payment', 'technical', 'general', 'complaint', 'refund']),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  relatedTripId: z.string().optional(),
  relatedBookingId: z.string().optional()
});

router.post('/tickets', async (req, res) => {
  try {
    const agentId = (req as any).auth.userId;
    
    const parsed = createTicketSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid ticket data', details: parsed.error.flatten() });
    }

    const { userId, subject, description, category, priority, relatedTripId, relatedBookingId } = parsed.data;

    // Get customer info
    const customer = await User.findById(userId);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const ticket = await SupportTicket.create({
      userId,
      assignedAgentId: agentId,
      subject,
      description,
      category,
      priority,
      relatedTripId,
      relatedBookingId,
      customerEmail: customer.email,
      customerName: customer.name,
      customerPhone: customer.phone || undefined,
      status: 'in-progress',
      messages: [{
        sender: 'customer',
        senderName: customer.name,
        senderId: userId,
        message: description,
        timestamp: new Date()
      }]
    });

    logger.info('Ticket created by agent', { ticketId: ticket.ticketId, agentId, customerId: userId });

    res.status(201).json({ ticket, message: 'Ticket created successfully' });

  } catch (error: any) {
    logger.error('Error creating ticket', { error: error.message });
    res.status(500).json({ error: 'Failed to create ticket' });
  }
});

// Search customers
router.get('/customers/search', async (req, res) => {
  try {
    const search = req.query.q as string || '';
    
    if (search.length < 2) {
      return res.json({ customers: [] });
    }

    const customers = await User.find({
      $or: [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ]
    })
    .select('name email phone role createdAt')
    .limit(20);

    res.json({ customers });

  } catch (error: any) {
    logger.error('Error searching customers', { error: error.message });
    res.status(500).json({ error: 'Failed to search customers' });
  }
});

// Get customer details and booking history
router.get('/customers/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const customer = await User.findById(userId).select('-passwordHash -resetPasswordToken');
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    // Get customer's trips
    const trips = await Trip.find({ participants: userId })
      .populate('organizerId', 'name email phone')
      .sort({ createdAt: -1 })
      .limit(10);

    // Get customer's support tickets
    const tickets = await SupportTicket.find({ userId })
      .populate('assignedAgentId', 'name email')
      .sort({ createdAt: -1 })
      .limit(10);

    res.json({
      customer,
      bookingHistory: trips,
      supportHistory: tickets
    });

  } catch (error: any) {
    logger.error('Error fetching customer details', { error: error.message, userId: req.params.userId });
    res.status(500).json({ error: 'Failed to fetch customer details' });
  }
});

// Send WhatsApp message to customer - DISABLED
// Reason: WhatsApp Web.js credentials were exposed in git history
// Alternative: Use WhatsApp Business API instead
const whatsappMessageSchema = z.object({
  phone: z.string(),
  message: z.string().min(1).max(1000)
});

router.post('/whatsapp/send', async (req, res) => {
  // WhatsApp service disabled for security reasons
  return res.status(503).json({
    error: 'WhatsApp service disabled',
    message: 'WhatsApp Web.js credentials were exposed. Please use WhatsApp Business API instead.',
    recommendation: 'https://www.whatsapp.com/business/api'
  });

  } catch (error: any) {
    logger.error('Error sending WhatsApp message', { error: error.message });
    res.status(500).json({ error: 'Failed to send WhatsApp message' });
  }
});

// Get service status for agent dashboard
router.get('/services/status', async (req, res) => {
  try {
    const [emailStatus, whatsappStatus] = await Promise.all([
      emailService.getServiceStatus(),
      whatsappService.getStatus()
    ]);

    res.json({
      email: emailStatus,
      whatsapp: whatsappStatus
    });

  } catch (error: any) {
    logger.error('Error getting service status', { error: error.message });
    res.status(500).json({ error: 'Failed to get service status' });
  }
});

// Get customer queries for agent dashboard
router.get('/queries', async (req, res) => {
  try {
    // For now, return support tickets as customer queries
    const queries = await SupportTicket.find({
      status: { $in: ['open', 'in-progress'] }
    })
    .populate('userId', 'name email')
    .sort({ priority: 1, createdAt: -1 })
    .limit(20);

    const formattedQueries = queries.map(ticket => ({
      _id: ticket._id,
      customerName: ticket.customerName || (ticket.userId as any)?.name || 'Unknown',
      customerEmail: ticket.customerEmail || (ticket.userId as any)?.email || 'unknown@email.com',
      query: ticket.subject || 'No subject',
      status: ticket.status === 'in-progress' ? 'in_progress' : ticket.status,
      priority: ticket.priority || 'medium',
      createdAt: ticket.createdAt,
      lastResponse: ticket.messages && ticket.messages.length > 0 
        ? ticket.messages[ticket.messages.length - 1].message 
        : undefined
    }));

    res.json({ queries: formattedQueries });
  } catch (error: any) {
    logger.error('Error fetching customer queries', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch customer queries' });
  }
});

// Get AI recommendations for agent dashboard
router.get('/ai-recommendations', async (req, res) => {
  try {
    // Get recent active trips and create mock AI recommendations
    const trips = await Trip.find({ status: 'active' })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    const recommendations = trips.map(trip => ({
      tripId: trip._id,
      title: trip.title,
      destination: trip.destination,
      price: trip.price,
      startDate: trip.startDate,
      endDate: trip.endDate,
      matchScore: Math.random() * 0.3 + 0.7, // Random score between 0.7-1.0
      reasons: [
        'High customer demand',
        'Good price point',
        'Positive reviews',
        'Available spots'
      ].slice(0, Math.floor(Math.random() * 3) + 2), // 2-4 reasons
      categories: trip.categories || ['Adventure']
    }));

    res.json({ recommendations });
  } catch (error: any) {
    logger.error('Error fetching AI recommendations', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch AI recommendations' });
  }
});

// Generate AI recommendations based on preferences
router.post('/generate-recommendations', async (req, res) => {
  try {
    const { preferences } = req.body;
    const { categories, priceRange, searchQuery } = preferences || {};

    // Build query based on preferences
    const query: any = { status: 'active' };
    
    if (categories && categories.length > 0) {
      query.categories = { $in: categories };
    }
    
    if (priceRange && priceRange.max > 0) {
      query.price = { $lte: priceRange.max };
      if (priceRange.min > 0) {
        query.price.$gte = priceRange.min;
      }
    }
    
    if (searchQuery) {
      query.$or = [
        { title: { $regex: searchQuery, $options: 'i' } },
        { destination: { $regex: searchQuery, $options: 'i' } },
        { description: { $regex: searchQuery, $options: 'i' } }
      ];
    }

    const trips = await Trip.find(query)
      .sort({ createdAt: -1 })
      .limit(12)
      .lean();

    const recommendations = trips.map(trip => ({
      tripId: trip._id,
      title: trip.title,
      destination: trip.destination,
      price: trip.price,
      startDate: trip.startDate,
      endDate: trip.endDate,
      matchScore: Math.random() * 0.4 + 0.6, // Random score between 0.6-1.0
      reasons: [
        `Matches ${categories?.join(', ') || 'your'} preferences`,
        'Within price range',
        'Available for booking',
        'High organizer rating'
      ].filter(Boolean).slice(0, Math.floor(Math.random() * 3) + 2),
      categories: trip.categories || ['Adventure']
    }));

    res.json({ recommendations });
  } catch (error: any) {
    logger.error('Error generating AI recommendations', { error: error.message });
    res.status(500).json({ error: 'Failed to generate AI recommendations' });
  }
});

// Check agent availability
router.get('/availability', async (req, res) => {
  try {
    const availability = socketService.getAgentAvailability();
    
    res.json({
      success: true,
      data: {
        availableAgents: availability.availableAgents,
        connectedAgents: availability.connectedAgents,
        status: availability.availableAgents > 0 ? 'agents_available' : 'no_agents'
      }
    });
  } catch (error: any) {
    logger.error('Error checking agent availability', { error: error.message });
    res.status(500).json({ error: 'Failed to check agent availability' });
  }
});

// Get pending/unassigned tickets for agents to claim
router.get('/pending-tickets', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    
    // Get unassigned or waiting-agent tickets
    const pendingTickets = await SupportTicket.find({
      $or: [
        { assignedAgentId: null },
        { status: 'waiting-agent' }
      ],
      status: { $nin: ['closed', 'resolved'] }
    })
      .populate('userId', 'name email phone')
      .populate('relatedTripId', 'title destination')
      .sort({ priority: 1, createdAt: 1 }) // High priority and oldest first
      .limit(limit)
      .select('ticketId subject description status priority category customerName customerEmail customerPhone messages createdAt updatedAt');

    const formattedTickets = pendingTickets.map(ticket => ({
      ticketId: ticket.ticketId,
      _id: ticket._id,
      subject: ticket.subject,
      description: ticket.description,
      status: ticket.status,
      priority: ticket.priority,
      category: ticket.category,
      customerName: ticket.customerName || (ticket.userId as any)?.name || 'Unknown',
      customerEmail: ticket.customerEmail || (ticket.userId as any)?.email,
      customerPhone: ticket.customerPhone || (ticket.userId as any)?.phone,
      messageCount: ticket.messages?.length || 0,
      lastMessage: ticket.messages && ticket.messages.length > 0 
        ? ticket.messages[ticket.messages.length - 1].message 
        : ticket.description,
      relatedTrip: ticket.relatedTripId ? {
        title: (ticket.relatedTripId as any).title,
        destination: (ticket.relatedTripId as any).destination
      } : null,
      waitingTime: Math.floor((new Date().getTime() - new Date(ticket.createdAt).getTime()) / 60000), // minutes
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt
    }));

    res.json({
      success: true,
      tickets: formattedTickets,
      count: formattedTickets.length
    });

  } catch (error: any) {
    logger.error('Error fetching pending tickets', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch pending tickets' });
  }
});

// Assign ticket to agent (claim ticket)
router.post('/tickets/:ticketId/assign', async (req, res) => {
  try {
    const agentId = (req as any).auth.userId;
    const { ticketId } = req.params;

    const ticket = await SupportTicket.findOne({ ticketId });
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // Check if already assigned
    if (ticket.assignedAgentId) {
      return res.status(400).json({ 
        error: 'Ticket already assigned',
        assignedTo: ticket.assignedAgentId 
      });
    }

    // Assign to agent
    ticket.assignedAgentId = agentId as any;
    ticket.status = 'in-progress';
    ticket.updatedAt = new Date();
    
    // Add system message
    const agent = await User.findById(agentId);
    if (agent) {
      ticket.messages.push({
        sender: 'agent',
        senderName: agent.name,
        senderId: agentId,
        message: `Agent ${agent.name} has joined to assist you.`,
        timestamp: new Date(),
        isSystem: true
      } as any);
    }

    await ticket.save();

    logger.info('Ticket assigned to agent', { ticketId, agentId });

    res.json({
      success: true,
      message: 'Ticket assigned successfully',
      ticket: {
        ticketId: ticket.ticketId,
        status: ticket.status,
        assignedAgentId: ticket.assignedAgentId
      }
    });

  } catch (error: any) {
    logger.error('Error assigning ticket', { error: error.message });
    res.status(500).json({ error: 'Failed to assign ticket' });
  }
});

export default router;
