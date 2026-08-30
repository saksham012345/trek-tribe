import { Response } from 'express';
import { AuthRequest } from '../middleware/roleCheck';
import { withMongoId, withMongoIds, asPopulated } from '../lib/apiShape';
import { UserPrisma as User } from '../models/userPrismaAdapter';

/** Load the Mongo users behind a set of ids; populate() cannot cross databases. */
async function loadTicketUsers(ids: (string | null | undefined)[]) {
  const unique = Array.from(new Set(ids.filter(Boolean) as string[]));
  if (unique.length === 0) return new Map<string, any>();
  const users = await User.find({ _id: { $in: unique } })
    .select('name email phone')
    .lean();
  return new Map<string, any>(users.map((u: any) => [u._id.toString(), u]));
}
import notificationService from '../services/notificationService';
import { prisma } from '../lib/prisma';

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

      // ticketNumber comes from ticket_number_seq via the column default, which
      // replaced a pre-save hook building it from countDocuments() + 1.
      const ticket = await prisma.ticket.create({
        data: {
          subject,
          description,
          category,
          priority: priority || 'medium',
          requesterId: req.user.id,
          requesterType: req.user.role === 'organizer' ? 'organizer' : 'user',
          tripId: tripId || null,
          bookingId: bookingId || null,
          attachments: (attachments || []) as any,
          status: 'pending',
        }
      });

      // Track activity
      await prisma.userActivity.create({
        data: {
          userId: String(req.user.id),
          userType: req.user.role === 'organizer' ? 'organizer' : 'user',
          activityType: 'ticket_created',
          description: `Created support ticket: ${subject}`,
          metadata: { ticketId: ticket.id },
        },
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
      const { status, category, priority, page = 1, limit = 20, q } = req.query as any;
      const query: any = {};

      // Filter by role
      if (req.user?.role === 'traveler' || req.user?.role === 'organizer') {
        query.requesterId = req.user.id;
      }

      if (status) query.status = status;
      if (category) query.category = category;
      if (priority) query.priority = priority;

      // Text search across subject/description and conversation messages
      if (q) {
        const re = new RegExp(String(q), 'i');
        query.$or = [
          { subject: { $regex: re } },
          { description: { $regex: re } },
          { 'conversation.message': { $regex: re } },
        ];
      }

      const [ticketRows, total] = await Promise.all([
        prisma.ticket.findMany({
          where: query,
          orderBy: { createdAt: 'desc' },
          take: Number(limit),
          skip: (Number(page) - 1) * Number(limit)
        }),
        prisma.ticket.count({ where: query })
      ]);

      const listPeople = await loadTicketUsers(
        ticketRows.flatMap(t => [t.requesterId, t.assignedTo])
      );
      const tickets = ticketRows.map(t => ({
        ...withMongoId(t),
        requesterId: asPopulated(listPeople.get(t.requesterId)),
        assignedTo: t.assignedTo ? asPopulated(listPeople.get(t.assignedTo)) : null
      }));

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

      const row = await prisma.ticket.findUnique({
        where: { id },
        include: {
          conversation: { orderBy: { timestamp: 'asc' } },
          internalNotes: { orderBy: { timestamp: 'asc' } }
        }
      });

      const detailPeople = row
        ? await loadTicketUsers([row.requesterId, row.assignedTo])
        : new Map();
      const ticket = row && {
        ...withMongoId(row),
        requesterId: asPopulated(detailPeople.get(row.requesterId)),
        assignedTo: row.assignedTo ? asPopulated(detailPeople.get(row.assignedTo)) : null,
        conversation: withMongoIds(row.conversation),
        internalNotes: withMongoIds(row.internalNotes)
      };

      if (!ticket) {
        return res.status(404).json({
          success: false,
          message: 'Ticket not found',
        });
      }

      // Check permissions
      if (
        req.user?.role !== 'admin' &&
        ticket.requesterId !== req.user?.id
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

      const existing = await prisma.ticket.findUnique({ where: { id } });

      if (!existing) {
        return res.status(404).json({
          success: false,
          message: 'Ticket not found',
        });
      }

      const ticket = await prisma.ticket.update({
        where: { id },
        data: { status }
      });

      // Notify requester
      await notificationService.createNotification({
        userId: ticket.requesterId,
        type: 'ticket',
        title: 'Ticket Status Updated',
        message: `Your ticket #${ticket.ticketNumber} status has been updated to ${status}`,
        actionUrl: `/tickets/${ticket.id}`,
        actionType: 'view_ticket',
        relatedTo: { type: 'ticket', id: ticket.id },
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

      const existing = await prisma.ticket.findUnique({
        where: { id },
        include: { conversation: { select: { id: true }, take: 1 } }
      });

      if (!existing) {
        return res.status(404).json({
          success: false,
          message: 'Ticket not found',
        });
      }

      // Calculate response time if this is the first response from support.
      // conversation is a relation now, so "is it empty" is a one-row include
      // rather than loading every message to check the length.
      const isFirstReply =
        existing.conversation.length === 0 &&
        req.user.role === 'admin' &&
        !existing.responseTime;

      // The message is an insert, not a push that rewrites the ticket.
      const ticket = await prisma.ticket.update({
        where: { id },
        data: {
          ...(isFirstReply
            ? { responseTime: Math.floor((Date.now() - existing.createdAt.getTime()) / 60000) }
            : {}),
          conversation: {
            create: [{
              senderId: req.user.id,
              senderType: req.user.role as any,
              message
            }]
          }
        }
      });

      // Notify relevant party
      const notifyUserId =
        req.user.id === ticket.requesterId
          ? ticket.assignedTo
          : ticket.requesterId;

      if (notifyUserId) {
        await notificationService.createNotification({
          userId: notifyUserId,
          type: 'ticket',
          title: 'New Ticket Message',
          message: `New message on ticket #${ticket.ticketNumber}`,
          actionUrl: `/tickets/${ticket.id}`,
          actionType: 'view_ticket',
          relatedTo: { type: 'ticket', id: ticket.id },
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

      const assignable = await prisma.ticket.count({ where: { id } });
      const ticket = assignable
        ? await prisma.ticket.update({
            where: { id },
            data: { assignedTo, status: 'in_progress' }
          })
        : null;

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
        actionUrl: `/tickets/${ticket.id}`,
        actionType: 'view_ticket',
        relatedTo: { type: 'ticket', id: ticket.id },
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

      const existing = await prisma.ticket.findUnique({ where: { id } });

      if (!existing) {
        return res.status(404).json({
          success: false,
          message: 'Ticket not found',
        });
      }

      // Calculate resolution time
      const resolutionTime = Math.floor(
        (Date.now() - existing.createdAt.getTime()) / 60000
      ); // minutes

      // resolution was a nested { resolvedBy, resolvedAt, resolutionNote }; it is
      // three columns, so each part can be read without unpacking the others.
      const ticket = await prisma.ticket.update({
        where: { id },
        data: {
          status: 'resolved',
          resolvedBy: req.user.id,
          resolvedAt: new Date(),
          resolutionNote,
          resolutionTime
        }
      });

      // Notify requester
      await notificationService.createNotification({
        userId: ticket.requesterId,
        type: 'ticket',
        title: 'Ticket Resolved',
        message: `Your ticket #${ticket.ticketNumber} has been resolved`,
        actionUrl: `/tickets/${ticket.id}`,
        actionType: 'view_ticket',
        relatedTo: { type: 'ticket', id: ticket.id },
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
