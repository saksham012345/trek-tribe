import { Response } from 'express';
import { AuthRequest } from '../middleware/roleCheck';
import Lead from '../models/Lead';
import UserActivity from '../models/UserActivity';
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

      // Check if lead already exists
      let lead = await Lead.findOne({ email, tripId });

      if (lead) {
        // Update existing lead
        lead.metadata = { ...lead.metadata, ...metadata };
        if (lead.metadata.tripViewCount !== undefined) {
          lead.metadata.tripViewCount += 1;
        }
        lead.metadata.lastVisitedAt = new Date();
        await lead.save();
      } else {
        // Create new lead
        lead = new Lead({
          userId,
          tripId,
          email,
          phone,
          name,
          source,
          metadata,
          status: 'new',
          leadScore: this.calculateLeadScore(source, metadata),
        });
        await lead.save();
      }

      // Track activity
      if (userId) {
        await UserActivity.create({
          userId,
          userType: 'user',
          activityType: 'trip_view',
          description: `Viewed trip and created lead`,
          metadata: { tripId, leadId: lead._id },
        });
      }

      res.status(201).json({
        success: true,
        message: 'Lead created successfully',
        data: lead,
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
        const re = new RegExp(String(q), 'i');
        query.$or = [
          { name: { $regex: re } },
          { email: { $regex: re } },
          { phone: { $regex: re } },
        ];
      }

      const leads = await Lead.find(query)
        .populate('userId', 'name email')
        .populate('tripId', 'title destination')
        .populate('assignedTo', 'name email')
        .sort({ createdAt: -1 })
        .limit(Number(limit))
        .skip((Number(page) - 1) * Number(limit));

      const total = await Lead.countDocuments(query);

      res.json({
        success: true,
        data: leads,
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

      const lead = await Lead.findById(id)
        .populate('userId', 'name email phone')
        .populate('tripId')
        .populate('assignedTo', 'name email');

      if (!lead) {
        return res.status(404).json({
          success: false,
          message: 'Lead not found',
        });
      }

      res.json({
        success: true,
        data: lead,
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

      const lead = await Lead.findByIdAndUpdate(id, updates, { new: true });

      if (!lead) {
        return res.status(404).json({
          success: false,
          message: 'Lead not found',
        });
      }

      res.json({
        success: true,
        message: 'Lead updated successfully',
        data: lead,
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

      const lead = await Lead.findById(id);

      if (!lead) {
        return res.status(404).json({
          success: false,
          message: 'Lead not found',
        });
      }

      lead.interactions.push({
        type,
        description,
        timestamp: new Date(),
        performedBy: req.user?.id as any,
      });

      await lead.save();

      res.json({
        success: true,
        message: 'Interaction added successfully',
        data: lead,
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

      const lead = await Lead.findByIdAndUpdate(
        id,
        {
          status: 'converted',
          convertedAt: new Date(),
        },
        { new: true }
      );

      if (!lead) {
        return res.status(404).json({
          success: false,
          message: 'Lead not found',
        });
      }

      // Send notification to assigned organizer
      if (lead.assignedTo) {
        await notificationService.createNotification({
          userId: lead.assignedTo,
          type: 'lead',
          title: 'Lead Converted!',
          message: `Lead ${lead.email} has been converted to a booking`,
          actionUrl: `/crm/leads/${lead._id}`,
          actionType: 'view_lead',
          relatedTo: { type: 'lead', id: lead._id.toString() },
        });
      }

      res.json({
        success: true,
        message: 'Lead converted successfully',
        data: lead,
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
