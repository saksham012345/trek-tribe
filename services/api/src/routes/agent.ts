import express from 'express';
import { z } from 'zod';
import { SupportTicket } from '../models/SupportTicket';
import { User } from '../models/User';
import { Trip } from '../models/Trip';
import { authenticateJwt } from '../middleware/auth';
import { whatsappService } from '../services/whatsappService';
import { emailService } from '../services/emailService';
import { logger } from '../utils/logger';

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
          await emailService.sendTripUpdateEmail({
            userName: ticket.customerName,
            userEmail: ticket.customerEmail,
            tripTitle: `Support Ticket ${ticket.ticketId}`,
            updateMessage: `New message from ${agent.name}:\n\n${message}`,
            organizerName: agent.name
          });
        }
      } catch (error) {
        logger.error('Failed to send ticket update email', { error, ticketId });
      }
    }, 1000);

    logger.info('Message added to ticket', { ticketId, agentId, messageLength: message.length });

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

// Send WhatsApp message to customer
const whatsappMessageSchema = z.object({
  phone: z.string(),
  message: z.string().min(1).max(1000)
});

router.post('/whatsapp/send', async (req, res) => {
  try {
    const parsed = whatsappMessageSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid message data', details: parsed.error.flatten() });
    }

    const { phone, message } = parsed.data;

    if (!whatsappService.isServiceReady()) {
      return res.status(503).json({ error: 'WhatsApp service not available' });
    }

    const sent = await whatsappService.sendMessage(phone, message);
    
    if (sent) {
      logger.info('WhatsApp message sent by agent', { agentId: (req as any).auth.userId, phone, messageLength: message.length });
      res.json({ message: 'WhatsApp message sent successfully' });
    } else {
      res.status(500).json({ error: 'Failed to send WhatsApp message' });
    }

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

export default router;
