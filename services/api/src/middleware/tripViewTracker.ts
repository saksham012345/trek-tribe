import { Request, Response, NextFunction } from 'express';
import Lead from '../models/Lead';
import UserActivity from '../models/UserActivity';
import { Trip } from '../models/Trip';
import { logger } from '../utils/logger';

interface TripViewData {
  userId: string;
  tripId: string;
  viewCount: number;
  firstView: Date;
  lastView: Date;
}

// In-memory cache for trip views (in production, use Redis)
const tripViewCache = new Map<string, TripViewData>();

// Threshold for creating a lead from trip views
const TRIP_VIEW_THRESHOLD = 2;
const VIEW_WINDOW_DAYS = 7;

/**
 * Middleware to track trip views and automatically create leads
 * when a user views the same trip multiple times
 */
export const trackTripView = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).auth?.userId;
    const tripId = req.params.id || req.params.tripId;

    if (!userId || !tripId) {
      return next();
    }

    const cacheKey = `${userId}-${tripId}`;
    const now = new Date();

    // Get or create view data
    let viewData = tripViewCache.get(cacheKey);
    
    if (!viewData) {
      viewData = {
        userId,
        tripId,
        viewCount: 1,
        firstView: now,
        lastView: now,
      };
      tripViewCache.set(cacheKey, viewData);
    } else {
      // Check if views are within the time window
      const daysSinceFirstView = (now.getTime() - viewData.firstView.getTime()) / (1000 * 60 * 60 * 24);
      
      if (daysSinceFirstView > VIEW_WINDOW_DAYS) {
        // Reset view tracking if outside window
        viewData = {
          userId,
          tripId,
          viewCount: 1,
          firstView: now,
          lastView: now,
        };
        tripViewCache.set(cacheKey, viewData);
      } else {
        // Increment view count
        viewData.viewCount++;
        viewData.lastView = now;
        tripViewCache.set(cacheKey, viewData);
      }
    }

    // Log activity
    await UserActivity.create({
      userId,
      userType: 'user',
      activityType: 'trip_view',
      description: `Viewed trip (${viewData.viewCount} times)`,
      metadata: {
        tripId,
        viewCount: viewData.viewCount,
      },
    });

    // Auto-create lead if threshold reached
    if (viewData.viewCount >= TRIP_VIEW_THRESHOLD) {
      await autoCreateLeadFromViews(userId, tripId, viewData.viewCount);
      
      // Reset counter after lead creation
      tripViewCache.delete(cacheKey);
    }

    next();
  } catch (error: any) {
    logger.error('Error tracking trip view', { error: error.message });
    next(); // Don't block request on error
  }
};

/**
 * Automatically create a lead from trip views
 */
async function autoCreateLeadFromViews(userId: string, tripId: string, viewCount: number) {
  try {
    // Get user details
    const { User } = require('../models/User');
    const user = await User.findById(userId);
    
    if (!user) return;

    // Check if lead already exists
    const existingLead = await Lead.findOne({ 
      userId, 
      tripId,
      source: 'trip_view' 
    });

    if (existingLead) {
      // Update existing lead
      existingLead.metadata.tripViewCount = viewCount;
      existingLead.metadata.lastVisitedAt = new Date();
      existingLead.leadScore = Math.min(existingLead.leadScore + 10, 100);
      await existingLead.save();
      
      logger.info('Updated existing lead from trip views', { 
        leadId: existingLead._id,
        userId,
        tripId,
        viewCount 
      });
    } else {
      // Get trip details
      const trip = await Trip.findById(tripId).lean();
      
      // Create new lead with traveler information
      const lead = new Lead({
        userId,
        tripId,
        email: user.email,
        phone: user.phone,
        name: user.name,
        source: 'trip_view',
        status: 'new',
        leadScore: 20 + (viewCount > 2 ? 10 : 0), // Bonus for more views
        metadata: {
          tripViewCount: viewCount,
          lastVisitedAt: new Date(),
          tags: ['auto-generated', 'high-interest'],
          travelerInfo: {
            name: user.name,
            email: user.email,
            phone: user.phone,
            profileComplete: !!(user.bio && user.location),
            kycStatus: user.kycStatus || 'not_started',
            idVerificationStatus: user.idVerificationStatus || 'not_verified'
          },
          tripDetails: trip ? {
            title: trip.title,
            destination: trip.destination,
            startDate: trip.startDate,
            price: trip.price
          } : null
        },
      });

      await lead.save();
      
      logger.info('Auto-created lead from trip views', { 
        leadId: lead._id,
        userId,
        tripId,
        viewCount 
      });

      // Send notification to organizer
      const tripForNotification = await Trip.findById(tripId);
      
      if (tripForNotification && tripForNotification.organizerId) {
        const notificationService = require('../services/notificationService').default;
        await notificationService.createNotification({
          userId: tripForNotification.organizerId,
          type: 'lead',
          title: 'New Lead Generated',
          message: `${user.name || user.email} has viewed your trip "${tripForNotification.title}" ${viewCount} times`,
          actionUrl: `/crm/leads/${lead._id}`,
          actionType: 'view_lead',
          relatedTo: { type: 'lead', id: lead._id.toString() },
        });
      }
    }
  } catch (error: any) {
    logger.error('Error auto-creating lead from views', { error: error.message });
  }
}

/**
 * Clean up old entries from cache
 */
export function cleanupViewCache() {
  const now = new Date();
  const maxAge = VIEW_WINDOW_DAYS * 24 * 60 * 60 * 1000;

  for (const [key, data] of tripViewCache.entries()) {
    if (now.getTime() - data.lastView.getTime() > maxAge) {
      tripViewCache.delete(key);
    }
  }
  
  logger.debug('Trip view cache cleanup completed', { entriesRemaining: tripViewCache.size });
}

/**
 * Export cleanup function for cron scheduler
 */
export function cleanupExpiredViews() {
  cleanupViewCache();
}

// Run cleanup every hour
setInterval(cleanupViewCache, 60 * 60 * 1000);
