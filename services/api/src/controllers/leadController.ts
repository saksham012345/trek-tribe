import { Response } from 'express';
import { AuthRequest } from '../middleware/roleCheck';

import { prisma } from '../lib/prisma';
import { withMongoId, withMongoIds } from '../lib/apiShape';
import notificationService from '../services/notificationService';

class LeadController {
  // Bind methods in constructor to preserve 'this' context
  constructor() {
    this.createLead = this.createLead.bind(this);
    this.getLeads = this.getLeads.bind(this);
    this.getLeadById = this.getLeadById.bind(this);
    this.updateLead = this.updateLead.bind(this);
    this.addInteraction = this.addInteraction.bind(this);
    this.convertLead = this.convertLead.bind(this);
  }

  /**
   * Create a new lead
   */
  async createLead(req: AuthRequest, res: Response) {
    try {
      const { userId, tripId, email, phone, name, source, metadata } = req.body;

      // The email column is lowercase-only (a CHECK), so normalise before the
      // lookup as well as the insert - otherwise a capitalised address would
      // miss its own duplicate and then be refused by the constraint.
      const normalisedEmail = String(email).toLowerCase().trim();

      // metadata is no longer one blob: the parts that get filtered are columns.
      const m = metadata ?? {};

      let lead = await prisma.lead.findFirst({ where: { email: normalisedEmail, tripId } });

      if (lead) {
        lead = await prisma.lead.update({
          where: { id: lead.id },
          data: {
            tripViewCount: lead.tripViewCount + 1,
            lastVisitedAt: new Date(),
            ...(m.inquiryMessage !== undefined ? { inquiryMessage: m.inquiryMessage } : {}),
            ...(m.notes !== undefined ? { notes: m.notes } : {}),
            ...(m.tags !== undefined ? { tags: m.tags } : {}),
            ...(m.partialFormData !== undefined ? { partialFormData: m.partialFormData } : {}),
            ...(m.travelerDetails !== undefined ? { travelerDetails: m.travelerDetails } : {}),
          },
        });
      } else {
        lead = await prisma.lead.create({
          data: {
            userId,
            tripId,
            email: normalisedEmail,
            phone,
            name,
            source,
            status: 'new',
            leadScore: this.calculateLeadScore(source, m),
            tripViewCount: m.tripViewCount ?? 0,
            lastVisitedAt: m.lastVisitedAt ?? null,
            inquiryMessage: m.inquiryMessage ?? null,
            notes: m.notes ?? null,
            tags: m.tags ?? [],
            partialFormData: m.partialFormData ?? undefined,
            travelerDetails: m.travelerDetails ?? undefined,
          },
        });
      }

      // Track activity
      if (userId) {
        await prisma.userActivity.create({
          data: {
            userId: String(userId),
            userType: 'user',
            activityType: 'trip_view',
            description: 'Viewed trip and created lead',
            // ObjectIds have to be strings to survive a JSON column.
            metadata: { tripId: String(tripId), leadId: lead.id },
          },
        });
      }

      res.status(201).json({
        success: true,
        message: 'Lead created successfully',
        data: withMongoId(lead),
      });
    } catch (error: any) {
      console.error('Create lead error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create lead',
        error: error.message,
      });
    }
  }

  /**
   * Get all leads (Admin/Organizer)
   */
  async getLeads(req: AuthRequest, res: Response) {
    try {
      const { status, source, tripId, page = 1, limit = 20, q } = req.query as any;
      const query: any = {};

      // Filter by role
      if (req.user?.role === 'organizer') {
        query.assignedTo = req.user.id;
      }

      if (status) query.status = status;
      if (source) query.source = source;
      if (tripId) query.tripId = tripId;

      // Text search across common lead fields
      if (q) {
        const term = String(q);
        query.OR = [
          { name: { contains: term, mode: 'insensitive' } },
          { email: { contains: term, mode: 'insensitive' } },
          { phone: { contains: term, mode: 'insensitive' } },
        ];
      }

      // The three populate() calls are gone - User and Trip are still Mongo
      // documents. Nothing in this response body read the populated fields.
      const [leads, total] = await Promise.all([
        prisma.lead.findMany({
          where: query,
          orderBy: { createdAt: 'desc' },
          take: Number(limit),
          skip: (Number(page) - 1) * Number(limit),
        }),
        prisma.lead.count({ where: query }),
      ]);

      res.json({
        success: true,
        data: withMongoIds(leads),
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit)),
        },
      });
    } catch (error: any) {
      console.error('Get leads error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch leads',
        error: error.message,
      });
    }
  }

  /**
   * Get lead by ID
   */
  async getLeadById(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      const lead = await prisma.lead.findUnique({
        where: { id },
        include: { interactions: { orderBy: { timestamp: 'desc' } } },
      });

      if (!lead) {
        return res.status(404).json({
          success: false,
          message: 'Lead not found',
        });
      }

      res.json({
        success: true,
        data: lead ? withMongoId(lead) : lead,
      });
    } catch (error: any) {
      console.error('Get lead error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch lead',
        error: error.message,
      });
    }
  }

  /**
   * Update lead
   */
  async updateLead(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const updates = req.body;

      const existing = await prisma.lead.findUnique({ where: { id } });
      if (!existing) {
        return res.status(404).json({
          success: false,
          message: 'Lead not found',
        });
      }

      const lead = await prisma.lead.update({ where: { id }, data: updates });

      if (!lead) {
        return res.status(404).json({
          success: false,
          message: 'Lead not found',
        });
      }

      res.json({
        success: true,
        message: 'Lead updated successfully',
        data: lead ? withMongoId(lead) : lead,
      });
    } catch (error: any) {
      console.error('Update lead error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update lead',
        error: error.message,
      });
    }
  }

  /**
   * Add interaction to lead
   */
  async addInteraction(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { type, description } = req.body;

      const existing = await prisma.lead.findUnique({ where: { id } });

      if (!existing) {
        return res.status(404).json({
          success: false,
          message: 'Lead not found',
        });
      }

      // interactions are rows now, so adding one is an insert rather than a
      // rewrite of the whole lead document.
      await prisma.leadInteraction.create({
        data: { leadId: id, type, description, performedBy: req.user?.id ?? null },
      });

      const lead = await prisma.lead.findUnique({
        where: { id },
        include: { interactions: { orderBy: { timestamp: 'desc' } } },
      });

      res.json({
        success: true,
        message: 'Interaction added successfully',
        data: lead ? withMongoId(lead) : lead,
      });
    } catch (error: any) {
      console.error('Add interaction error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to add interaction',
        error: error.message,
      });
    }
  }

  /**
   * Convert lead
   */
  async convertLead(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      const existing = await prisma.lead.findUnique({ where: { id } });
      if (!existing) {
        return res.status(404).json({
          success: false,
          message: 'Lead not found',
        });
      }

      const lead = await prisma.lead.update({
        where: { id },
        data: { status: 'converted', convertedAt: new Date() },
      });

      // Send notification to assigned organizer
      if (lead.assignedTo) {
        await notificationService.createNotification({
          userId: lead.assignedTo,
          type: 'lead',
          title: 'Lead Converted!',
          message: `Lead ${lead.email} has been converted to a booking`,
          actionUrl: `/crm/leads/${lead.id}`,
          actionType: 'view_lead',
          relatedTo: { type: 'lead', id: lead.id },
        });
      }

      res.json({
        success: true,
        message: 'Lead converted successfully',
        data: lead ? withMongoId(lead) : lead,
      });
    } catch (error: any) {
      console.error('Convert lead error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to convert lead',
        error: error.message,
      });
    }
  }

  /**
   * Calculate lead score based on source and metadata
   */
  private calculateLeadScore(source: string, metadata: any): number {
    let score = 0;

    // Base score by source
    const sourceScores: Record<string, number> = {
      partial_booking: 80,
      inquiry: 60,
      chat: 50,
      form: 40,
      trip_view: 20,
      other: 10,
    };

    score += sourceScores[source] || 0;

    // Additional scoring logic
    if (metadata?.tripViewCount > 1) score += 10;
    if (metadata?.inquiryMessage) score += 15;

    return Math.min(score, 100);
  }
}

export default new LeadController();
