import Lead from '../models/Lead';
import { logger } from '../utils/logger';
import { emailService } from './emailService';
import { emailTemplates } from '../templates/emailTemplates';
import { emailQueue } from './emailQueueService';

interface EmailCampaign {
  name: string;
  targetAudience: 'new_leads' | 'contacted' | 'interested' | 'lost' | 'all';
  subject: string;
  template: string;
  sendAt?: Date;
  status: 'draft' | 'scheduled' | 'sent' | 'cancelled';
}

interface DripCampaign {
  name: string;
  trigger: 'lead_created' | 'no_response' | 'interested';
  sequence: Array<{
    delay: number; // hours
    subject: string;
    template: string;
  }>;
}

/**
 * Marketing Automation Service
 * Handles email campaigns, drip sequences, and follow-ups
 */
class MarketingAutomationService {
  
  /**
   * Send email campaign to targeted leads
   */
  async sendEmailCampaign(campaign: EmailCampaign): Promise<{ sent: number; failed: number }> {
    try {
      if (!emailService.isServiceReady()) {
        logger.warn('Email service not ready for campaign');
        return { sent: 0, failed: 0 };
      }

      // Get target leads
      const query: any = {};
      
      if (campaign.targetAudience !== 'all') {
        query.status = campaign.targetAudience;
      }

      const leads = await Lead.find(query).limit(1000); // Batch limit
      
      let sent = 0;
      let failed = 0;

      for (const lead of leads) {
        try {
          if (!lead.email) continue;

          const trip = lead.tripId ? await this.getTripDetails(lead.tripId.toString()) : null;

          const emailHtml = this.generateEmailContent(campaign.template, {
            userName: lead.name || 'Traveler',
            email: lead.email,
            tripTitle: trip?.title,
            leadScore: lead.leadScore,
          });

          await emailService.sendEmail({
            to: lead.email,
            subject: campaign.subject,
            html: emailHtml,
          });

          // Log interaction
          lead.interactions.push({
            type: 'email',
            description: `Campaign: ${campaign.name}`,
            timestamp: new Date(),
            performedBy: undefined,
          } as any);
          await lead.save();

          sent++;
          
          // Rate limiting - wait 100ms between emails
          await new Promise(resolve => setTimeout(resolve, 100));
          
        } catch (error: any) {
          logger.error('Error sending campaign email to lead', { 
            leadId: lead._id,
            error: error.message 
          });
          failed++;
        }
      }

      logger.info('Email campaign completed', { 
        campaign: campaign.name,
        sent,
        failed,
        total: leads.length 
      });

      return { sent, failed };
      
    } catch (error: any) {
      logger.error('Error in email campaign', { error: error.message });
      return { sent: 0, failed: 0 };
    }
  }

  /**
   * Start drip campaign for a lead
   */
  async startDripCampaign(leadId: string, campaign: DripCampaign): Promise<void> {
    try {
      const lead = await Lead.findById(leadId);
      if (!lead || !lead.email) return;

      logger.info('Starting drip campaign', { 
        leadId,
        campaign: campaign.name,
        sequences: campaign.sequence.length 
      });

      // Schedule each email in the sequence using queue
      for (const step of campaign.sequence) {
        const delayMs = step.delay * 60 * 60 * 1000;
        this.scheduleDripEmail(leadId, campaign.name, step, delayMs, campaign.sequence.indexOf(step) + 1);
      }
      
    } catch (error: any) {
      logger.error('Error starting drip campaign', { error: error.message });
    }
  }

  /**
   * Schedule drip email using queue
   */
  private async scheduleDripEmail(
    leadId: string,
    campaignName: string,
    step: { subject: string; template: string },
    delayMs: number,
    stepNumber: number
  ): Promise<void> {
    try {
      const lead = await Lead.findById(leadId).populate('tripId');
      if (!lead || !lead.email) return;

      const trip = lead.tripId ? await this.getTripDetails(lead.tripId.toString()) : null;
      const emailHtml = this.generateEmailContent(step.template, {
        userName: lead.name || 'Traveler',
        email: lead.email,
        tripTitle: trip?.title,
        leadScore: lead.leadScore,
      });

      await emailQueue.scheduleEmail({
        type: 'marketing_drip',
        to: lead.email,
        subject: step.subject,
        html: emailHtml,
        leadId: lead._id.toString(),
        metadata: { campaignName, stepNumber },
      }, delayMs);

      logger.info('Scheduled drip email', {
        leadId,
        campaign: campaignName,
        step: stepNumber,
        delayHours: delayMs / (1000 * 60 * 60),
      });
    } catch (error: any) {
      logger.error('Error scheduling drip email', { error: error.message, leadId });
    }
  }

  /**
   * Send automated follow-up based on lead status
   */
  async sendAutomatedFollowUp(leadId: string): Promise<void> {
    try {
      const lead = await Lead.findById(leadId);
      if (!lead || !lead.email) return;

      const daysSinceLastContact = this.getDaysSinceLastInteraction(lead);

      // Determine follow-up strategy based on status and time
      let followUpTemplate = '';
      let subject = '';

      switch (lead.status) {
        case 'new':
          if (daysSinceLastContact >= 2) {
            subject = `Still interested in your adventure trip?`;
            followUpTemplate = 'new_lead_followup';
          }
          break;
          
        case 'contacted':
          if (daysSinceLastContact >= 3) {
            subject = `Did you have any questions about the trip?`;
            followUpTemplate = 'contacted_followup';
          }
          break;
          
        case 'interested':
          if (daysSinceLastContact >= 5) {
            subject = `Ready to book your adventure? Special offer inside!`;
            followUpTemplate = 'interested_followup';
          }
          break;
          
        case 'not_interested':
          if (daysSinceLastContact >= 30) {
            subject = `We have new trips you might love!`;
            followUpTemplate = 'reengagement';
          }
          break;
      }

      if (!followUpTemplate) return;

      const trip = lead.tripId ? await this.getTripDetails(lead.tripId.toString()) : null;

      const emailHtml = this.generateEmailContent(followUpTemplate, {
        userName: lead.name || 'Traveler',
        email: lead.email,
        tripTitle: trip?.title,
        leadScore: lead.leadScore,
        daysSinceContact: daysSinceLastContact,
      });

      await emailService.sendEmail({
        to: lead.email,
        subject,
        html: emailHtml,
      });

      lead.interactions.push({
        type: 'email',
        description: `Automated follow-up: ${lead.status} status`,
        timestamp: new Date(),
        performedBy: undefined,
      } as any);
      await lead.save();

      logger.info('Automated follow-up sent', { 
        leadId,
        status: lead.status,
        daysSinceLastContact 
      });
      
    } catch (error: any) {
      logger.error('Error sending automated follow-up', { error: error.message });
    }
  }

  /**
   * Run daily automated follow-up check for all leads
   */
  async runDailyFollowUpCheck(): Promise<void> {
    try {
      const leads = await Lead.find({
        status: { $in: ['new', 'contacted', 'interested', 'not_interested'] },
      });

      logger.info(`Running daily follow-up check for ${leads.length} leads`);

      for (const lead of leads) {
        const daysSinceLastContact = this.getDaysSinceLastInteraction(lead);
        
        // Send follow-up based on criteria
        const shouldFollowUp = 
          (lead.status === 'new' && daysSinceLastContact >= 2) ||
          (lead.status === 'contacted' && daysSinceLastContact >= 3) ||
          (lead.status === 'interested' && daysSinceLastContact >= 5) ||
          (lead.status === 'not_interested' && daysSinceLastContact >= 30);

        if (shouldFollowUp) {
          await this.sendAutomatedFollowUp(lead._id.toString());
          
          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      logger.info('Daily follow-up check completed');
      
    } catch (error: any) {
      logger.error('Error in daily follow-up check', { error: error.message });
    }
  }

  /**
   * Calculate days since last interaction
   */
  private getDaysSinceLastInteraction(lead: any): number {
    if (lead.interactions.length === 0) {
      const createdAt = new Date(lead.createdAt);
      return Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
    }

    const lastInteraction = lead.interactions[lead.interactions.length - 1];
    const lastInteractionDate = new Date(lastInteraction.timestamp);
    return Math.floor((Date.now() - lastInteractionDate.getTime()) / (1000 * 60 * 60 * 24));
  }

  /**
   * Get trip details
   */
  private async getTripDetails(tripId: string): Promise<any> {
    try {
      const { Trip } = require('../models/Trip');
      return await Trip.findById(tripId);
    } catch (error) {
      return null;
    }
  }

  /**
   * Generate email content from template
   */
  private generateEmailContent(template: string, data: any): string {
    // Use existing email templates or create dynamic content
    const templates: any = {
      new_lead_followup: emailTemplates.leadFollowUp,
      contacted_followup: emailTemplates.leadFollowUp,
      interested_followup: emailTemplates.leadFollowUp,
      reengagement: emailTemplates.reengageDrip1,
    };

    const templateFn = templates[template];
    if (templateFn) {
      return templateFn(data);
    }

    // Fallback to simple template
    return `
      <h2>Hi ${data.userName}!</h2>
      <p>We wanted to follow up with you about ${data.tripTitle || 'our amazing trips'}.</p>
      <p>If you have any questions, we're here to help!</p>
      <p>Best regards,<br>Trek-Tribe Team</p>
    `;
  }

  /**
   * Get predefined drip campaigns
   */
  getPredefinedDripCampaigns(): DripCampaign[] {
    return [
      {
        name: 'New Lead Nurture',
        trigger: 'lead_created',
        sequence: [
          {
            delay: 24, // 24 hours
            subject: "Welcome! Here's everything you need to know",
            template: 'welcome_drip_1',
          },
          {
            delay: 72, // 3 days
            subject: "Have questions? We're here to help!",
            template: 'welcome_drip_2',
          },
          {
            delay: 168, // 7 days
            subject: 'Special offer just for you! 🎁',
            template: 'welcome_drip_3',
          },
        ],
      },
      {
        name: 'Interested Lead Push',
        trigger: 'interested',
        sequence: [
          {
            delay: 24,
            subject: "Ready to book? Here's what to expect",
            template: 'interested_drip_1',
          },
          {
            delay: 48,
            subject: 'Limited slots remaining! Book now',
            template: 'interested_drip_2',
          },
        ],
      },
      {
        name: 'Re-engagement Campaign',
        trigger: 'no_response',
        sequence: [
          {
            delay: 168, // 7 days
            subject: "We miss you! Check out what's new",
            template: 'reengage_drip_1',
          },
          {
            delay: 336, // 14 days
            subject: 'Last chance: Exclusive offer inside',
            template: 'reengage_drip_2',
          },
        ],
      },
    ];
  }
}

export const marketingAutomationService = new MarketingAutomationService();

/**
 * Helper function to run daily follow-up check (wrapper for cron usage)
 */
export const runDailyFollowUpCheck = () => {
  return marketingAutomationService.runDailyFollowUpCheck();
};
