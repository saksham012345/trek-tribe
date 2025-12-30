/**
 * Lead Generation Service (ADD-ONLY Enhancement)
 * 
 * This service extends existing lead functionality by:
 * - Listening to user events (trip views, profile views, etc.)
 * - Creating/enhancing leads based on user actions
 * - Scoring leads based on engagement
 * - NEVER interfering with existing lead creation logic
 */

import Lead from '../models/Lead';
import { User } from '../models/User';
import { Trip } from '../models/Trip';
import mongoose from 'mongoose';

interface LeadEvent {
  type: 'trip_view' | 'profile_view' | 'wishlist_add' | 'enquiry' | 'abandoned_booking';
  userId?: string;
  email?: string;
  phone?: string;
  tripId?: string;
  organizerId?: string;
  metadata?: any;
}

class LeadGenerationService {
  /**
   * Handle user event and create/enhance lead (NON-BREAKING)
   * This is an OPTIONAL enhancement - existing lead creation still works
   */
  async handleUserEvent(event: LeadEvent): Promise<void> {
    try {
      // Only proceed if we have required data
      if (!event.organizerId || (!event.userId && !event.email)) {
        return; // Fail silently - don't break existing flows
      }

      // Find or create lead
      const leadQuery: any = { assignedTo: event.organizerId };
      if (event.userId) {
        leadQuery.userId = new mongoose.Types.ObjectId(event.userId);
      }
      if (event.email) {
        leadQuery.email = event.email.toLowerCase();
      }

      let lead = await Lead.findOne(leadQuery);

      if (!lead) {
        // Create new lead only if none exists (safe mode)
        lead = new Lead({
          userId: event.userId ? new mongoose.Types.ObjectId(event.userId) : undefined,
          tripId: event.tripId ? new mongoose.Types.ObjectId(event.tripId) : undefined,
          email: event.email?.toLowerCase() || '',
          phone: event.phone || '',
          name: event.metadata?.name || '',
          source: this.mapEventToSource(event.type),
          status: 'new',
          leadScore: this.calculateInitialScore(event.type),
          assignedTo: new mongoose.Types.ObjectId(event.organizerId),
          metadata: {
            tripViewCount: event.type === 'trip_view' ? 1 : 0,
            lastVisitedAt: new Date(),
            ...event.metadata,
          },
        });
      } else {
        // Enhance existing lead (append activity, don't overwrite)
        const newScore = this.calculateScoreIncrement(event.type);
        lead.leadScore = Math.min(100, (lead.leadScore || 0) + newScore);
        
        // Update metadata
        if (event.type === 'trip_view') {
          lead.metadata.tripViewCount = (lead.metadata.tripViewCount || 0) + 1;
        }
        lead.metadata.lastVisitedAt = new Date();
        
        // Add interaction
        lead.interactions.push({
          type: this.mapEventToInteractionType(event.type),
          description: this.getEventDescription(event.type),
          timestamp: new Date(),
        });
      }

      await lead.save();
    } catch (error: any) {
      // Fail gracefully - don't break existing flows
      console.error('Lead generation service error (non-critical):', error.message);
    }
  }

  /**
   * Map event type to lead source
   */
  private mapEventToSource(eventType: string): 'trip_view' | 'inquiry' | 'partial_booking' | 'chat' | 'form' | 'other' {
    switch (eventType) {
      case 'trip_view':
        return 'trip_view';
      case 'enquiry':
        return 'inquiry';
      case 'abandoned_booking':
        return 'partial_booking';
      default:
        return 'other';
    }
  }

  /**
   * Map event type to interaction type
   */
  private mapEventToInteractionType(eventType: string): 'email' | 'call' | 'chat' | 'message' | 'visit' {
    switch (eventType) {
      case 'trip_view':
      case 'profile_view':
        return 'visit';
      case 'enquiry':
        return 'message';
      default:
        return 'visit';
    }
  }

  /**
   * Get event description
   */
  private getEventDescription(eventType: string): string {
    switch (eventType) {
      case 'trip_view':
        return 'Viewed trip';
      case 'profile_view':
        return 'Viewed organizer profile';
      case 'wishlist_add':
        return 'Added trip to wishlist';
      case 'enquiry':
        return 'Submitted enquiry';
      case 'abandoned_booking':
        return 'Started booking but did not complete';
      default:
        return 'User activity';
    }
  }

  /**
   * Calculate initial lead score based on event type
   */
  private calculateInitialScore(eventType: string): number {
    switch (eventType) {
      case 'trip_view':
        return 5;
      case 'profile_view':
        return 7;
      case 'wishlist_add':
        return 10;
      case 'enquiry':
        return 20;
      case 'abandoned_booking':
        return 15;
      default:
        return 0;
    }
  }

  /**
   * Calculate score increment for existing leads
   */
  private calculateScoreIncrement(eventType: string): number {
    switch (eventType) {
      case 'trip_view':
        return 5;
      case 'profile_view':
        return 7;
      case 'wishlist_add':
        return 10;
      case 'enquiry':
        return 20;
      case 'abandoned_booking':
        return 15;
      default:
        return 0;
    }
  }

  /**
   * Deduplicate leads by checking existing leads
   */
  async findExistingLead(email?: string, phone?: string, userId?: string): Promise<any> {
    try {
      const query: any = {};
      if (email) query.email = email.toLowerCase();
      if (phone) query.phone = phone;
      if (userId) query.userId = new mongoose.Types.ObjectId(userId);

      return await Lead.findOne(query);
    } catch (error) {
      return null; // Fail gracefully
    }
  }
}

// Export singleton instance
export default new LeadGenerationService();

