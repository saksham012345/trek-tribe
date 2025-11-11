import { Response } from 'express';
import { AuthRequest } from '../middleware/roleCheck';
import Ticket from '../models/Ticket';
import notificationService from '../services/notificationService';
import UserActivity from '../models/UserActivity';

class TicketController {
  /**
   * Create a new support ticket
   */
  async createTicket(req: AuthRequest, res: Response) {
    try {
      const {
        subject,
        description,
        category,
        priority,
        tripId,
        bookingId,
        attachments,
      } = req.body;

      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
      }

      const ticket = new Ticket({
        subject,
        description,
        category,
        priority: priority || 'medium',
        requesterId: req.user.id,
        requesterType: req.user.role === 'organizer' ? 'organizer' : 'user',
        tripId,
        bookingId,
        attachments: attachments || [],
        status: 'pending',
      });

      await ticket.save();

      // Track activity
      await UserActivity.create({
        userId: req.user.id,
        userType: req.user.role === 'organizer' ? 'organizer' : 'user',
        activityType: 'ticket_created',
        description: `Created support ticket: ${subject}`,
        metadata: { ticketId: ticket._id },
      });

      // Notify admins about new ticket
      // TODO: Get admin user IDs and send notifications

      res.status(201).json({
        success: true,
        message: 'Ticket created successfully',
        data: ticket,
      });
    } catch (error: any) {
      console.error('Create ticket error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create ticket',
        error: error.message,
      });
    }
  }

  /**
   * Get all tickets
   */
  async getTickets(req: AuthRequest, res: Response) {
    try {
      const { status, category, priority, page = 1, limit = 20 } = req.query;
      const query: any = {};

      // Filter by role
      if (req.user?.role === 'traveler' || req.user?.role === 'organizer') {
        query.requesterId = req.user.id;
      }

      if (status) query.status = status;
      if (category) query.category = category;
      if (priority) query.priority = priority;

      const tickets = await Ticket.find(query)
        .populate('requesterId', 'name email')
        .populate('assignedTo', 'name email')
        .populate('tripId', 'title')
        .sort({ createdAt: -1 })
        .limit(Number(limit))
        .skip((Number(page) - 1) * Number(limit));

      const total = await Ticket.countDocuments(query);

      res.json({
        success: true,
        data: tickets,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit)),
        },
      });
    } catch (error: any) {
      console.error('Get tickets error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch tickets',
        error: error.message,
      });
    }
  }

  /**
   * Get ticket by ID
   */
  async getTicketById(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      const ticket = await Ticket.findById(id)
        .populate('requesterId', 'name email phone')
        .populate('assignedTo', 'name email')
        .populate('tripId')
        .populate('bookingId');

      if (!ticket) {
        return res.status(404).json({
          success: false,
          message: 'Ticket not found',
        });
      }

      // Check permissions
      if (
        req.user?.role !== 'admin' &&
        ticket.requesterId.toString() !== req.user?.id
      ) {
        return res.status(403).json({
          success: false,
          message: 'Access denied',
        });
      }

      res.json({
        success: true,
        data: ticket,
      });
    } catch (error: any) {
      console.error('Get ticket error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch ticket',
        error: error.message,
      });
    }
  }

  /**
   * Update ticket status
   */
  async updateTicketStatus(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { status } = req.body;

      const ticket = await Ticket.findById(id);

      if (!ticket) {
        return res.status(404).json({
          success: false,
          message: 'Ticket not found',
        });
      }

      ticket.status = status;
      await ticket.save();

      // Notify requester
      await notificationService.createNotification({
        userId: ticket.requesterId,
        type: 'ticket',
        title: 'Ticket Status Updated',
        message: `Your ticket #${ticket.ticketNumber} status has been updated to ${status}`,
        actionUrl: `/tickets/${ticket._id}`,
        actionType: 'view_ticket',
        relatedTo: { type: 'ticket', id: ticket._id.toString() },
        sendEmail: true,
      });

      res.json({
        success: true,
        message: 'Ticket status updated successfully',
        data: ticket,
      });
    } catch (error: any) {
      console.error('Update ticket status error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update ticket status',
        error: error.message,
      });
    }
  }

  /**
   * Add message to ticket
   */
  async addMessage(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { message, attachments } = req.body;

      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
      }

      const ticket = await Ticket.findById(id);

      if (!ticket) {
        return res.status(404).json({
          success: false,
          message: 'Ticket not found',
        });
      }

      // Calculate response time if this is the first response from support
      if (
        ticket.conversation.length === 0 &&
        req.user.role === 'admin' &&
        !ticket.responseTime
      ) {
        const responseTime = Math.floor(
          (Date.now() - ticket.createdAt.getTime()) / 60000
        ); // minutes
        ticket.responseTime = responseTime;
      }

      ticket.conversation.push({
        senderId: req.user.id as any,
        senderType: req.user.role as any,
        message,
        timestamp: new Date(),
        attachments: attachments || [],
      });

      await ticket.save();

      // Notify relevant party
      const notifyUserId =
        req.user.id === ticket.requesterId.toString()
          ? ticket.assignedTo
          : ticket.requesterId;

      if (notifyUserId) {
        await notificationService.createNotification({
          userId: notifyUserId,
          type: 'ticket',
          title: 'New Ticket Message',
          message: `New message on ticket #${ticket.ticketNumber}`,
          actionUrl: `/tickets/${ticket._id}`,
          actionType: 'view_ticket',
          relatedTo: { type: 'ticket', id: ticket._id.toString() },
          sendEmail: true,
        });
      }

      res.json({
        success: true,
        message: 'Message added successfully',
        data: ticket,
      });
    } catch (error: any) {
      console.error('Add message error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to add message',
        error: error.message,
      });
    }
  }

  /**
   * Assign ticket to support agent (Admin only)
   */
  async assignTicket(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { assignedTo } = req.body;

      const ticket = await Ticket.findByIdAndUpdate(
        id,
        { assignedTo, status: 'in_progress' },
        { new: true }
      );

      if (!ticket) {
        return res.status(404).json({
          success: false,
          message: 'Ticket not found',
        });
      }

      // Notify assigned agent
      await notificationService.createNotification({
        userId: assignedTo,
        type: 'ticket',
        title: 'Ticket Assigned',
        message: `You have been assigned ticket #${ticket.ticketNumber}`,
        actionUrl: `/tickets/${ticket._id}`,
        actionType: 'view_ticket',
        relatedTo: { type: 'ticket', id: ticket._id.toString() },
      });

      res.json({
        success: true,
        message: 'Ticket assigned successfully',
        data: ticket,
      });
    } catch (error: any) {
      console.error('Assign ticket error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to assign ticket',
        error: error.message,
      });
    }
  }

  /**
   * Resolve ticket
   */
  async resolveTicket(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { resolutionNote } = req.body;

      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
      }

      const ticket = await Ticket.findById(id);

      if (!ticket) {
        return res.status(404).json({
          success: false,
          message: 'Ticket not found',
        });
      }

      // Calculate resolution time
      const resolutionTime = Math.floor(
        (Date.now() - ticket.createdAt.getTime()) / 60000
      ); // minutes

      ticket.status = 'resolved';
      ticket.resolution = {
        resolvedBy: req.user.id as any,
        resolvedAt: new Date(),
        resolutionNote,
      };
      ticket.resolutionTime = resolutionTime;

      await ticket.save();

      // Notify requester
      await notificationService.createNotification({
        userId: ticket.requesterId,
        type: 'ticket',
        title: 'Ticket Resolved',
        message: `Your ticket #${ticket.ticketNumber} has been resolved`,
        actionUrl: `/tickets/${ticket._id}`,
        actionType: 'view_ticket',
        relatedTo: { type: 'ticket', id: ticket._id.toString() },
        sendEmail: true,
      });

      res.json({
        success: true,
        message: 'Ticket resolved successfully',
        data: ticket,
      });
    } catch (error: any) {
      console.error('Resolve ticket error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to resolve ticket',
        error: error.message,
      });
    }
  }
}

export default new TicketController();
