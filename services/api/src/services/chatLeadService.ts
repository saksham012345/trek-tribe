import Lead from '../models/Lead';
import { logger } from '../utils/logger';
import notificationService from './notificationService';
import { emailQueue } from './emailQueue';

interface ChatSession {
  userId: string;
  tripId?: string;
  messages: Array<{
    sender: 'user' | 'ai' | 'agent';
    message: string;
    timestamp: Date;
  }>;
  intents: string[];
  sentiment: 'positive' | 'neutral' | 'negative';
}

/**
 * Service to convert chat sessions into leads
 */
class ChatLeadService {
  // Keywords indicating booking intent
  private bookingIntentKeywords = [
    'book', 'booking', 'reserve', 'reservation', 'price', 'cost', 'available',
    'slots', 'join', 'interested', 'when', 'dates', 'payment', 'pay',
  ];

  // Keywords indicating high interest
  private highInterestKeywords = [
    'definitely', 'absolutely', 'confirm', 'yes', 'interested', 'want to',
    'would like', 'planning', 'ready to book',
  ];

  /**
   * Analyze chat session and create lead if intent detected
   */
  async analyzeChatForLead(chatSession: ChatSession): Promise<void> {
    try {
      const { userId, tripId, messages, intents } = chatSession;

      if (!userId) return;

      // Calculate intent score
      const intentScore = this.calculateIntentScore(messages, intents);

      // Only create lead if intent score is high enough
      if (intentScore < 30) {
        logger.debug('Intent score too low for lead creation', { userId, score: intentScore });
        return;
      }

      // Get user details
      const { User } = require('../models/User');
      const user = await User.findById(userId);
      
      if (!user) return;

      // Check if lead already exists
      let lead = await Lead.findOne({ 
        userId, 
        tripId: tripId || undefined,
        source: 'chat' 
      });

      if (lead) {
        // Update existing lead
        lead.leadScore = Math.min(lead.leadScore + intentScore, 100);
        lead.metadata.lastVisitedAt = new Date();
        lead.metadata.notes = (lead.metadata.notes || '') + 
          `\n[${new Date().toISOString()}] Chat interaction - Intent score: ${intentScore}`;
        
        lead.interactions.push({
          type: 'chat',
          description: this.summarizeChatIntent(messages),
          timestamp: new Date(),
          performedBy: undefined,
        } as any);

        await lead.save();
        
        logger.info('Updated lead from chat interaction', { 
          leadId: lead._id,
          userId,
          intentScore 
        });
      } else {
        // Create new lead
        lead = new Lead({
          userId,
          tripId,
          email: user.email,
          phone: user.phone,
          name: user.name,
          source: 'chat',
          status: 'new',
          leadScore: 50 + Math.min(intentScore, 30), // Base 50 + intent bonus
          metadata: {
            lastVisitedAt: new Date(),
            inquiryMessage: this.summarizeChatIntent(messages),
            tags: ['auto-generated', 'chat-lead', `intent-score-${intentScore}`],
            notes: `Lead generated from chat conversation. User showed ${intentScore >= 50 ? 'high' : 'moderate'} interest.`,
          },
          interactions: [{
            type: 'chat',
            description: this.summarizeChatIntent(messages),
            timestamp: new Date(),
            performedBy: undefined,
          }] as any,
        });

        await lead.save();
        
        logger.info('Auto-created lead from chat', { 
          leadId: lead._id,
          userId,
          intentScore,
          score: lead.leadScore 
        });

        // Notify organizer if trip-specific
        if (tripId) {
          await this.notifyOrganizerOfChatLead(lead, tripId);
        }
      }

      // If high intent, trigger immediate follow-up using queue
      if (intentScore >= 60) {
        this.scheduleChatFollowUp(lead._id.toString(), 2 * 60 * 60 * 1000); // 2 hours
      }

    } catch (error: any) {
      logger.error('Error analyzing chat for lead', { error: error.message });
    }
  }

  /**
   * Calculate intent score from chat messages
   */
  private calculateIntentScore(messages: any[], intents: string[]): number {
    let score = 0;

    // Analyze user messages
    const userMessages = messages.filter(m => m.sender === 'user');
    const allText = userMessages.map(m => m.message.toLowerCase()).join(' ');

    // Check booking intent keywords
    const bookingIntentMatches = this.bookingIntentKeywords.filter(keyword => 
      allText.includes(keyword)
    ).length;
    score += bookingIntentMatches * 5;

    // Check high interest keywords
    const highInterestMatches = this.highInterestKeywords.filter(keyword => 
      allText.includes(keyword)
    ).length;
    score += highInterestMatches * 10;

    // Bonus for multiple messages (engagement)
    score += Math.min(userMessages.length * 2, 20);

    // Bonus for detected intents
    score += intents.length * 5;

    return Math.min(score, 100);
  }

  /**
   * Summarize chat intent for lead description
   */
  private summarizeChatIntent(messages: any[]): string {
    const userMessages = messages.filter(m => m.sender === 'user');
    
    if (userMessages.length === 0) return 'User engaged in chat';

    const allText = userMessages.map(m => m.message).join('. ');
    
    // Truncate if too long
    if (allText.length > 200) {
      return allText.substring(0, 197) + '...';
    }

    return allText;
  }

  /**
   * Notify organizer of chat-generated lead
   */
  private async notifyOrganizerOfChatLead(lead: any, tripId: string): Promise<void> {
    try {
      const { Trip } = require('../models/Trip');
      const trip = await Trip.findById(tripId);
      
      if (!trip || !trip.organizerId) return;

      await notificationService.createNotification({
        userId: trip.organizerId,
        type: 'lead',
        title: 'New Lead from Chat',
        message: `${lead.name || lead.email} showed interest in "${trip.title}" during chat conversation`,
        actionUrl: `/crm/leads/${lead._id}`,
        actionType: 'view_lead',
        relatedTo: { type: 'lead', id: lead._id.toString() },
      });

      logger.info('Notified organizer of chat lead', { 
        organizerId: trip.organizerId,
        leadId: lead._id 
      });
    } catch (error: any) {
      logger.error('Error notifying organizer', { error: error.message });
    }
  }

  /**
   * Schedule chat follow-up email using queue
   */
  private async scheduleChatFollowUp(leadId: string, delayMs: number): Promise<void> {
    try {
      const lead = await Lead.findById(leadId).populate('tripId');
      if (!lead || lead.status === 'converted' || !lead.email) return;

      const trip = (lead.tripId as any);
      const { emailTemplates } = require('../templates/emailTemplates');
      
      const emailHtml = emailTemplates.chatFollowUp({
        userName: lead.name || 'Traveler',
        tripTitle: trip?.title || 'our adventure trips',
        tripUrl: trip ? `${process.env.FRONTEND_URL}/trips/${trip._id}` : `${process.env.FRONTEND_URL}/trips`,
        chatSummary: lead.metadata.inquiryMessage || 'You recently chatted with us',
      });

      await emailQueue.scheduleEmail({
        type: 'chat_followup',
        to: lead.email,
        subject: `Following up on your interest in ${trip?.title || 'Trek-Tribe'}`,
        html: emailHtml,
        leadId: lead._id.toString(),
        tripId: trip?._id?.toString(),
      }, delayMs);

      logger.info('Scheduled chat follow-up', { leadId, delayHours: delayMs / (1000 * 60 * 60) });
    } catch (error: any) {
      logger.error('Error scheduling chat follow-up', { error: error.message, leadId });
    }
  }

  /**
   * Send follow-up email after chat interaction
   */
  private async sendChatFollowUp(leadId: string): Promise<void> {
    try {
      const lead = await Lead.findById(leadId).populate('tripId');
      
      if (!lead || lead.status === 'converted') return;

      const trip = (lead.tripId as any);

      const { emailService } = require('./emailService');
      const { emailTemplates } = require('../templates/emailTemplates');

      if (emailService.isServiceReady() && lead.email) {
        const emailHtml = emailTemplates.chatFollowUp({
          userName: lead.name || 'Traveler',
          tripTitle: trip?.title || 'our adventure trips',
          tripUrl: trip ? `${process.env.FRONTEND_URL}/trips/${trip._id}` : `${process.env.FRONTEND_URL}/trips`,
          chatSummary: lead.metadata.inquiryMessage || 'You recently chatted with us',
        });

        await emailService.sendEmail({
          to: lead.email,
          subject: `Following up on your interest in ${trip?.title || 'Trek-Tribe'}`,
          html: emailHtml,
        });

        logger.info('Sent chat follow-up email', { leadId, email: lead.email });

        lead.interactions.push({
          type: 'email',
          description: 'Sent follow-up email after chat interaction',
          timestamp: new Date(),
          performedBy: undefined,
        } as any);
        await lead.save();
      }
    } catch (error: any) {
      logger.error('Error sending chat follow-up', { error: error.message });
    }
  }
}

export const chatLeadService = new ChatLeadService();

/**
 * Helper function to analyze chat for lead (wrapper for route usage)
 */
export const analyzeChatForLead = async (
  userId: string,
  messages: Array<{ role: string; content: string; timestamp: Date }>
) => {
  const chatSession: ChatSession = {
    userId,
    messages: messages.map(m => ({
      sender: m.role === 'assistant' ? 'ai' : m.role === 'agent' ? 'agent' : 'user',
      message: m.content,
      timestamp: m.timestamp,
    })),
    intents: [],
    sentiment: 'neutral',
  };
  
  return chatLeadService.analyzeChatForLead(chatSession);
};
