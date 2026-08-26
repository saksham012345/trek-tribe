import express from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { withMongoId, withMongoIds, asPopulated } from '../lib/apiShape';
import { User } from '../models/User';
import { shapeTrip, shapeTrips } from '../services/tripShapeService';
import { authenticateJwt } from '../middleware/auth';
import { whatsappService } from '../services/whatsappService';
import { emailService } from '../services/emailService';
import { socketService } from '../services/socketService';
import { logger } from '../utils/logger';
import { analyzeChatForLead } from '../services/chatLeadService';

/**
 * Load the Mongo users behind a set of ids. The populate() calls this replaces
 * cannot work now that tickets are in Postgres and users are not.
 */
async function loadUsers(ids: (string | null | undefined)[]) {
  const unique = Array.from(new Set(ids.filter(Boolean) as string[]));
  if (unique.length === 0) return new Map<string, any>();
  const users = await User.find({ _id: { $in: unique } })
    .select('name email phone profilePhoto')
    .lean();
  return new Map(users.map((u: any) => [u._id.toString(), u]));
}

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
/**
 * Attach the organizer that .populate('organizerId') supplied. Trips are
 * Postgres rows; users are still Mongo documents.
 */
async function withOrganizers(rows: any[], select: string): Promise<any[]> {
  const present = rows.filter(Boolean);
  if (present.length === 0) return [];
  const ids = Array.from(new Set(present.map(r => r.organizerId)));
  const users = await User.find({ _id: { $in: ids } }, select).lean();
  const byId = new Map(users.map((u: any) => [u._id.toString(), u]));
  return present.map(row => {
    const trip = shapeTrip(row);
    trip.organizerId = byId.get(row.organizerId) ?? row.organizerId;
    return trip;
  });
}

router.use(authenticateJwt);
router.use(requireAgent);

// Get agent dashboard statistics
router.get('/stats', async (req, res) => {
  try {
    const agentId = (req as any).auth.userId;

    // Get ticket statistics
    // Get ticket statistics
    const [myTotalTickets, openTickets, inProgressTickets, resolvedTickets, unassignedTickets] = await Promise.all([
      // The stored labels still read 'in-progress'; the Prisma member is spelled
      // in_progress. See the @map on SupportStatus.
      prisma.supportTicket.count({ where: { assignedAgentId: agentId } }),
      prisma.supportTicket.count({ where: { assignedAgentId: agentId, status: 'open' } }),
      prisma.supportTicket.count({ where: { assignedAgentId: agentId, status: 'in_progress' } }),
      prisma.supportTicket.count({ where: { assignedAgentId: agentId, status: 'resolved' } }),
      prisma.supportTicket.count({ where: { assignedAgentId: null, status: { not: 'closed' } } })
    ]);

    // Total should reflect "My Workload" + "Potential Workload" (Unassigned) to avoid "0 Total, 3 Unassigned" confusion
    const totalTickets = myTotalTickets + unassignedTickets;



    // Get recent activity
    const recentTickets = await prisma.supportTicket.findMany({
      where: { assignedAgentId: agentId },
      orderBy: { updatedAt: 'desc' },
      take: 5,
      select: {
        id: true, ticketId: true, subject: true, status: true,
        priority: true, updatedAt: true, customerName: true
      }
    });

    // Get performance metrics (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const resolvedInPeriod = await prisma.supportTicket.findMany({
      where: {
        assignedAgentId: agentId,
        status: 'resolved',
        resolvedAt: { gte: thirtyDaysAgo }
      }
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
      query.OR = [
        { ticketId: { contains: search, mode: 'insensitive' } },
        { subject: { contains: search, mode: 'insensitive' } },
        { customerName: { contains: search, mode: 'insensitive' } },
        { customerEmail: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [total, ticketRows] = await Promise.all([
      prisma.supportTicket.count({ where: query }),
      prisma.supportTicket.findMany({
        where: query,
        orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit
      })
    ]);

    // populate() is gone - users are still Mongo documents - so the two the UI
    // reads are fetched in one lookup and put back under their original keys.
    const listUsers = await loadUsers(
      ticketRows.flatMap(t => [t.userId, t.assignedAgentId])
    );
    const tickets = ticketRows.map(t => ({
      ...withMongoId(t),
      userId: asPopulated(listUsers.get(t.userId)),
      assignedAgentId: t.assignedAgentId ? asPopulated(listUsers.get(t.assignedAgentId)) : null
    }));

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

    const row = await prisma.supportTicket.findUnique({
      where: { ticketId },
      include: { messages: { orderBy: { timestamp: 'asc' } } }
    });

    if (!row) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const people = await loadUsers([row.userId, row.assignedAgentId]);

    res.json({
      ticket: {
        ...withMongoId(row),
        userId: asPopulated(people.get(row.userId)),
        assignedAgentId: row.assignedAgentId ? asPopulated(people.get(row.assignedAgentId)) : null,
        messages: withMongoIds(row.messages)
      }
    });

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

    const existing = await prisma.supportTicket.findUnique({ where: { ticketId } });
    if (!existing) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const updated = await prisma.supportTicket.update({
      where: { ticketId },
      data: {
        assignedAgentId: assignedAgentId || currentAgentId,
        status: 'in_progress'
      }
    });

    const assignees = await loadUsers([updated.assignedAgentId]);
    const ticket = {
      ...withMongoId(updated),
      assignedAgentId: updated.assignedAgentId
        ? asPopulated(assignees.get(updated.assignedAgentId))
        : null
    };

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
    // messages are rows now, so the last ten are a query rather than a slice of
    // an embedded array - the whole ticket does not have to be loaded to read them.
    const ticket = await prisma.supportTicket.findUnique({
      where: { ticketId },
      include: { messages: { orderBy: { timestamp: 'desc' }, take: 10 } }
    });
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

    const recentMessages = [...ticket.messages].reverse().map((m: any) => `${m.senderName || m.sender}: ${m.message}`).join('\n');
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

    const existing = await prisma.supportTicket.findUnique({ where: { ticketId } });
    if (!existing) return res.status(404).json({ error: 'Ticket not found' });

    // Only assigned agent or admin can resolve
    if (existing.assignedAgentId && existing.assignedAgentId !== agentId && (req as any).auth.role !== 'admin') {
      return res.status(403).json({ error: 'Only assigned agent or admin can resolve this ticket' });
    }

    // Mark resolved and record timestamps. Keep notes in internalNotes for audit.
    const now = new Date();
    const ticket = await prisma.supportTicket.update({
      where: { ticketId },
      data: {
        status: 'resolved',
        resolvedAt: now,
        resolutionTime: now,
        ...(resolutionNote
          ? { internalNotes: { push: `Resolved by ${agentId}: ${resolutionNote}` } }
          : {})
      }
    });

    // Notify customer immediately (properly awaited)
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

    const exists = await prisma.supportTicket.count({ where: { ticketId } });
    if (exists === 0) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const ticket = await prisma.supportTicket.update({
      where: { ticketId },
      data: { status }
    });

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

    const target = await prisma.supportTicket.findUnique({ where: { ticketId } });
    if (!target) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // The reply is an insert, not a $push that rewrites the ticket, so two
    // agents answering at the same moment both get recorded.
    const updated = await prisma.supportTicket.update({
      where: { ticketId },
      data: {
        status: 'waiting_customer',
        messages: {
          create: [{
            sender: 'agent',
            senderName: agent.name,
            senderId: agentId,
            message,
            attachments: attachments || []
          }]
        }
      }
    });

    const replyUsers = await loadUsers([updated.userId]);
    const ticket = {
      ...withMongoId(updated),
      userId: asPopulated(replyUsers.get(updated.userId))
    };

    // Send email notification to customer (properly awaited)
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
      logger.error('Failed to send agent reply notification', { error: error.message, ticketId });
    }

    logger.info('Message added to ticket', { ticketId, agentId, messageLength: message.length });

    // Analyze chat for lead generation (async, non-blocking)
    const replyMessages = await prisma.supportTicketMessage.findMany({
      where: { ticketId: updated.id },
      orderBy: { timestamp: 'asc' }
    });

    if (updated.userId && replyMessages.length > 2) {
      analyzeChatForLead(updated.userId, replyMessages.map(m => ({
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

    // ticketId is not passed: the column defaults to a value from
    // support_ticket_number_seq, which replaced the countDocuments() + 1 that
    // could hand two tickets the same id.
    const ticket = await prisma.supportTicket.create({
      data: {
        userId,
        assignedAgentId: agentId,
        subject,
        description,
        category: category as any,
        priority: priority as any,
        relatedTripId: relatedTripId || null,
        relatedBookingId: relatedBookingId || null,
        customerEmail: customer.email,
        customerName: customer.name,
        customerPhone: customer.phone || undefined,
        status: 'in_progress',
        messages: {
          create: [{
            sender: 'customer',
            senderName: customer.name,
            senderId: userId,
            message: description
          }]
        }
      }
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
    const trips = await withOrganizers(
      await prisma.trip.findMany({
        where: { participants: { some: { userId } } },
        include: { participants: { select: { userId: true } } },
        orderBy: { createdAt: 'desc' },
        take: 10
      }),
      'name email phone'
    );

    // Get customer's support tickets
    const ticketRows = await prisma.supportTicket.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 10
    });
    const agents = await loadUsers(ticketRows.map(t => t.assignedAgentId));
    const tickets = ticketRows.map(t => ({
      ...withMongoId(t),
      assignedAgentId: t.assignedAgentId ? asPopulated(agents.get(t.assignedAgentId)) : null
    }));

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
    const queryRows = await prisma.supportTicket.findMany({
      where: { status: { in: ['open', 'in_progress'] } },
      orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
      take: 20,
      include: { messages: { orderBy: { timestamp: 'asc' } } }
    });
    const queryUsers = await loadUsers(queryRows.map(t => t.userId));
    const queries = queryRows.map(t => ({
      ...withMongoId(t),
      userId: asPopulated(queryUsers.get(t.userId))
    }));

    const formattedQueries = queries.map(ticket => ({
      _id: ticket._id,
      customerName: ticket.customerName || (ticket.userId as any)?.name || 'Unknown',
      customerEmail: ticket.customerEmail || (ticket.userId as any)?.email || 'unknown@email.com',
      query: ticket.subject || 'No subject',
      // The Prisma member is already in_progress; the stored label keeps its
      // hyphen but never reaches here.
      status: ticket.status,
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
    const trips = shapeTrips(await prisma.trip.findMany({
      where: { status: 'active' },
      orderBy: { createdAt: 'desc' },
      take: 10
    }) as any);

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
      query.OR = [
        { title: { contains: searchQuery, mode: 'insensitive' } },
        { destination: { contains: searchQuery, mode: 'insensitive' } },
        { description: { contains: searchQuery, mode: 'insensitive' } }
      ];
    }

    const trips = shapeTrips(await prisma.trip.findMany({
      where: query,
      orderBy: { createdAt: 'desc' },
      take: 12
    }) as any);

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
    // The second branch of the old $or asked for status 'waiting-agent', which
    // SupportTicket has never had - that value belongs to ChatSession. It matched
    // nothing, so this queue was only ever "unassigned and still open". Postgres
    // rejects the value outright, so the query says what it actually does.
    const pendingRows = await prisma.supportTicket.findMany({
      where: {
        assignedAgentId: null,
        status: { notIn: ['closed', 'resolved'] }
      },
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }], // High priority and oldest first
      take: limit,
      include: { messages: { orderBy: { timestamp: 'asc' } } }
    });

    const pendingUsers = await loadUsers(pendingRows.map(t => t.userId));
    const pendingTickets = pendingRows.map(t => ({
      ...withMongoId(t),
      userId: asPopulated(pendingUsers.get(t.userId))
    }));

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


// ==========================================
// TRIP MANAGEMENT ROUTES (New Role: Agents)
// ==========================================

// Get trips for agent review/management
router.get('/trips', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = req.query.status as string; // pending, active, cancelled, completed
    const search = req.query.search as string || '';

    const query: any = {};

    if (status && status !== 'all') {
      query.status = status;
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { destination: { $regex: search, $options: 'i' } }
      ];
    }

    // Special filter for Pending Verification
    if (status === 'pending') {
      // Trips that are pending verification
      query.verificationStatus = 'pending';
    }

    const [total, rows] = await Promise.all([
      prisma.trip.count({ where: query }),
      prisma.trip.findMany({
        where: query,
        include: { participants: { select: { userId: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      })
    ]);
    const trips = await withOrganizers(rows, 'name email phone organizerProfile');

    res.json({
      trips,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total
      }
    });

  } catch (error: any) {
    logger.error('Error fetching trips for agent', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch trips' });
  }
});

// Verify (Approve) a trip
router.post('/trips/:id/verify', async (req, res) => {
  try {
    const { id } = req.params;
    const agentId = (req as any).auth.userId;
    const { notes } = req.body;

    // The status check and the write are one statement: two agents approving
    // the same trip both passed the check and both sent the organizer an email.
    const claimed = await prisma.trip.updateMany({
      where: { id, verificationStatus: { not: 'approved' } },
      data: {
        verificationStatus: 'approved',
        verifiedBy: agentId,
        verifiedAt: new Date(),
        ...(notes ? { adminNotes: notes } : {}), // Reusing adminNotes for agent notes
        status: 'active' // Trip goes live
      }
    });

    const row = await prisma.trip.findUnique({ where: { id } });
    if (!row) return res.status(404).json({ error: 'Trip not found' });
    if (claimed.count === 0) {
      return res.status(400).json({ error: 'Trip already approved' });
    }

    const [trip] = await withOrganizers([row], 'name email');

    // Notify organizer
    try {
      const organizer: any = trip.organizerId;
      if (organizer && organizer.email) {
        await emailService.sendEmail({
          to: organizer.email,
          subject: `Your trip "${trip.title}" has been approved!`,
          html: `<p>Hi ${organizer.name},</p><p>Good news! Your trip <strong>${trip.title}</strong> has been verified by our team and is now live.</p><p>Agent Notes: ${notes || 'None'}</p>`
        });
      }
    } catch (e: any) {
      logger.warn('Failed to send trip approval email', { error: e.message });
    }

    logger.info('Trip verified by agent', { tripId: id, agentId });
    res.json({ message: 'Trip approved successfully', trip });

  } catch (error: any) {
    logger.error('Error verifying trip', { error: error.message });
    res.status(500).json({ error: 'Failed to verify trip' });
  }
});

// Reject a trip
router.post('/trips/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;
    const agentId = (req as any).auth.userId;
    const { reason } = req.body;

    if (!reason) return res.status(400).json({ error: 'Rejection reason is required' });

    const rejected = await prisma.trip.updateMany({
      where: { id },
      data: {
        verificationStatus: 'rejected',
        rejectionReason: reason,
        verifiedBy: agentId,
        verifiedAt: new Date(),
        status: 'cancelled'
      }
    });

    if (rejected.count === 0) return res.status(404).json({ error: 'Trip not found' });

    const [trip] = await withOrganizers(
      [await prisma.trip.findUnique({ where: { id } })],
      'name email'
    );

    // Notify organizer
    try {
      const organizer: any = trip.organizerId;
      if (organizer && organizer.email) {
        await emailService.sendEmail({
          to: organizer.email,
          subject: `Urgent: Issue with your trip "${trip.title}"`,
          html: `<p>Hi ${organizer.name},</p><p>Your trip <strong>${trip.title}</strong> was not approved.</p><p><strong>Reason:</strong> ${reason}</p><p>Please update your trip details and submit again.</p>`
        });
      }
    } catch (e: any) {
      logger.warn('Failed to send trip rejection email', { error: e.message });
    }

    logger.info('Trip rejected by agent', { tripId: id, agentId });
    res.json({ message: 'Trip rejected', trip });

  } catch (error: any) {
    logger.error('Error rejecting trip', { error: error.message });
    res.status(500).json({ error: 'Failed to reject trip' });
  }
});

// Complete a trip (e.g. after it finishes)
router.post('/trips/:id/complete', async (req, res) => {
  try {
    const { id } = req.params;
    const agentId = (req as any).auth.userId;

    // Same claim-and-check: only an active trip can be completed, and only once.
    const completed = await prisma.trip.updateMany({
      where: { id, status: 'active' },
      data: { status: 'completed' }
    });

    const trip = shapeTrip(await prisma.trip.findUnique({ where: { id } }) as any);
    if (!trip) return res.status(404).json({ error: 'Trip not found' });
    if (completed.count === 0) {
      return res.status(400).json({ error: 'Only active trips can be marked as completed' });
    }

    logger.info('Trip marked as completed by agent', { tripId: id, agentId });
    res.json({ message: 'Trip marked as completed', trip });

  } catch (error: any) {
    logger.error('Error completing trip', { error: error.message });
    res.status(500).json({ error: 'Failed to complete trip' });
  }
});

// Trip Verification Routes (Agent)
// -----------------------------------------------------------------------------





export default router;
