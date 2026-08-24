import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';
import notificationService from './notificationService';
import { emailQueue } from './emailQueueService';

interface PartialBookingData {
  userId: string;
  tripId: string;
  email?: string;
  phone?: string;
  name?: string;
  formData: any;
  timestamp: Date;
}

/**
 * Service to detect and handle booking abandonment
 */
class BookingAbandonmentService {
  /**
   * Track partial booking submission
   */
  async trackPartialBooking(data: PartialBookingData): Promise<void> {
    try {
      const { userId, tripId, email, phone, name, formData } = data;

      // Check if lead already exists
      let lead = await prisma.lead.findFirst({
        where: { userId, tripId, source: 'partial_booking' }
      });

      if (lead) {
        lead = await prisma.lead.update({
          where: { id: lead.id },
          data: {
            partialFormData: formData,
            lastVisitedAt: new Date(),
            leadScore: Math.min(lead.leadScore + 10, 100),
            // Reactivate if it had been written off
            status: lead.status === 'lost' ? 'new' : lead.status
          }
        });

        logger.info('Updated lead from partial booking', {
          leadId: lead.id,
          userId,
          tripId
        });
      } else {
        // Create high-priority lead. The email column is lowercase-only, so it
        // is normalised here rather than being refused by the CHECK.
        lead = await prisma.lead.create({
          data: {
            userId,
            tripId,
            email: String(email || formData.email).toLowerCase(),
            phone: phone || formData.phone,
            name: name || formData.name,
            source: 'partial_booking',
            status: 'new',
            leadScore: 80, // High score for abandoned bookings
            partialFormData: formData,
            lastVisitedAt: new Date(),
            tags: ['auto-generated', 'high-priority', 'abandoned-booking'],
            notes: `User started booking but didn't complete. Form progress: ${this.calculateFormProgress(formData)}%`
          }
        });

        logger.info('Auto-created lead from partial booking', {
          leadId: lead.id,
          userId,
          tripId,
          score: lead.leadScore
        });

        // Notify organizer immediately (high priority)
        await this.notifyOrganizerOfAbandonedBooking(lead, tripId);
      }

      // Schedule follow-up email after 24 hours using queue
      this.scheduleAbandonmentFollowUp(lead.id, 24 * 60 * 60 * 1000);
      
    } catch (error: any) {
      logger.error('Error tracking partial booking', { error: error.message });
    }
  }

  /**
   * Calculate form completion percentage
   */
  private calculateFormProgress(formData: any): number {
    const requiredFields = ['name', 'email', 'phone', 'participants', 'startDate'];
    const completedFields = requiredFields.filter(field => 
      formData[field] && String(formData[field]).trim().length > 0
    ).length;
    
    return Math.round((completedFields / requiredFields.length) * 100);
  }

  /**
   * Notify organizer of abandoned booking
   */
  private async notifyOrganizerOfAbandonedBooking(lead: any, tripId: string): Promise<void> {
    try {
      const { Trip } = require('../models/Trip');
      const trip = await Trip.findById(tripId);
      
      if (!trip || !trip.organizerId) return;

      await notificationService.createNotification({
        userId: trip.organizerId,
        type: 'lead',
        title: '🚨 High-Priority Lead: Abandoned Booking',
        message: `${lead.name || lead.email} started booking for "${trip.title}" but didn't complete. Act fast!`,
        priority: 'high',
        actionUrl: `/crm/leads/${lead.id}`,
        actionType: 'view_lead',
        relatedTo: { type: 'lead', id: lead.id },
      });

      logger.info('Notified organizer of abandoned booking', { 
        organizerId: trip.organizerId,
        leadId: lead.id 
      });
    } catch (error: any) {
      logger.error('Error notifying organizer', { error: error.message });
    }
  }

  /**
   * Schedule abandonment follow-up email using queue
   */
  private async scheduleAbandonmentFollowUp(leadId: string, delayMs: number): Promise<void> {
    try {
      // tripId used to arrive populated; it is a foreign-key string now, so
      // the trip is fetched from Mongo where it still lives.
      const lead = await prisma.lead.findUnique({ where: { id: leadId } });
      const { Trip } = require('../models/Trip');
      const tripDoc = lead?.tripId ? await Trip.findById(lead.tripId).lean() : null;
      if (!lead || lead.status === 'converted') return;

      const trip = tripDoc as any;
      if (!trip || !lead.email) return;

      const { emailTemplates } = require('../templates/emailTemplates');
      const emailHtml = emailTemplates.bookingAbandonment({
        userName: lead.name || 'Traveler',
        tripTitle: trip.title,
        tripUrl: `${process.env.FRONTEND_URL}/trips/${trip._id}`,
        bookingUrl: `${process.env.FRONTEND_URL}/book/${trip._id}`,
        discount: '10% OFF',
        expiryHours: 48,
      });

      await emailQueue.scheduleEmail({
        type: 'booking_abandonment',
        to: lead.email,
        subject: `Complete Your Booking for ${trip.title} - Special Offer Inside! 🎁`,
        html: emailHtml,
        leadId: lead.id,
        tripId: trip._id.toString(),
      }, delayMs);

      logger.info('Scheduled abandonment follow-up', { leadId, delayHours: delayMs / (1000 * 60 * 60) });
    } catch (error: any) {
      logger.error('Error scheduling abandonment follow-up', { error: error.message, leadId });
    }
  }

  /**
   * Send follow-up email after booking abandonment
   */
  private async sendAbandonmentFollowUp(leadId: string): Promise<void> {
    try {
      // tripId used to arrive populated; it is a foreign-key string now, so
      // the trip is fetched from Mongo where it still lives.
      const lead = await prisma.lead.findUnique({ where: { id: leadId } });
      const { Trip } = require('../models/Trip');
      const tripDoc = lead?.tripId ? await Trip.findById(lead.tripId).lean() : null;
      
      if (!lead || lead.status === 'converted') return; // Skip if already converted

      const trip = tripDoc as any;
      if (!trip) return;

      // Send email via email service
      const { emailService } = require('./emailService');
      const { emailTemplates } = require('../templates/emailTemplates');

      if (emailService.isServiceReady() && lead.email) {
        const emailHtml = emailTemplates.bookingAbandonment({
          userName: lead.name || 'Traveler',
          tripTitle: trip.title,
          tripUrl: `${process.env.FRONTEND_URL}/trips/${trip._id}`,
          bookingUrl: `${process.env.FRONTEND_URL}/book/${trip._id}`,
          discount: '10% OFF', // Offer incentive
          expiryHours: 48,
        });

        await emailService.sendEmail({
          to: lead.email,
          subject: `Complete Your Booking for ${trip.title} - Special Offer Inside! 🎁`,
          html: emailHtml,
        });

        logger.info('Sent abandonment follow-up email', { leadId, email: lead.email });

        // An insert rather than a push-and-save, so recording the email cannot
        // overwrite an interaction added between the read and the write.
        await prisma.leadInteraction.create({
          data: {
            leadId: lead.id,
            type: 'email',
            description: 'Sent booking abandonment follow-up email with 10% discount'
          }
        });
      }
    } catch (error: any) {
      logger.error('Error sending abandonment follow-up', { error: error.message });
    }
  }
}

export const bookingAbandonmentService = new BookingAbandonmentService();

/**
 * Helper function to track partial booking (wrapper for route usage)
 */
export const trackPartialBooking = (
  email: string,
  name: string,
  tripTitle: string,
  tripId: string,
  bookingData: {
    step: string;
    formProgress: number;
    travelerDetails?: boolean;
    contactInfo?: boolean;
    paymentInfo?: boolean;
  }
) => {
  // Get userId from email lookup (async operation)
  const { User } = require('../models/User');
  
  return User.findOne({ email }).then((user: any) => {
    if (!user) {
      logger.warn('Cannot track partial booking - user not found', { email });
      return Promise.resolve();
    }

    const data: PartialBookingData = {
      userId: user._id.toString(),
      tripId,
      email,
      name,
      formData: bookingData,
      timestamp: new Date(),
    };

    return bookingAbandonmentService.trackPartialBooking(data);
  });
};
