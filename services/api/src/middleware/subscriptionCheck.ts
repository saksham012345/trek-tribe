import { Request, Response, NextFunction } from 'express';
import { OrganizerSubscription } from '../models/OrganizerSubscription';
import { Types } from 'mongoose';

declare global {
  namespace Express {
    interface Request {
      subscription?: any;
    }
  }
}

/**
 * Middleware to check if organizer has valid subscription before creating a trip
 */
export const checkSubscription = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Only check for organizers
    if (req.user?.role !== 'organizer') {
      return next();
    }

    const userId = new Types.ObjectId(req.user.id);
    
    // Check if organizer can create trip
    const check = await (OrganizerSubscription as any).canCreateTrip(userId);
    
    if (!check.allowed) {
      return res.status(403).json({
        error: 'Subscription limit reached',
        message: check.message,
        action: 'upgrade_subscription',
        upgradeUrl: '/api/subscriptions/renew'
      });
    }

    // Attach subscription info to request for later use
    const subscription = await OrganizerSubscription.findOne({ organizerId: userId });
    req.subscription = subscription;

    next();
  } catch (error: any) {
    console.error('Subscription check error:', error);
    return res.status(500).json({
      error: 'Subscription verification failed',
      message: error.message
    });
  }
};

/**
 * Middleware to mark trip slot as used after trip creation
 */
export const useSubscriptionSlot = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (req.user?.role !== 'organizer') {
      return next();
    }

    const userId = new Types.ObjectId(req.user.id);
    const subscription = await OrganizerSubscription.findOne({ organizerId: userId });

    if (!subscription) {
      throw new Error('Subscription not found');
    }

    // Use a trip slot
    const tripId = res.locals.createdTripId; // Set this in the trip creation route
    const tripTitle = res.locals.createdTripTitle;

    if (tripId && tripTitle) {
      await (subscription as any).useTripSlot(tripId, tripTitle);
      console.log(`✅ Used trip slot for organizer ${userId}. ${subscription.tripsRemaining} slots remaining.`);
    }

    next();
  } catch (error: any) {
    console.error('Error using subscription slot:', error);
    // Don't fail the request, just log the error
    next();
  }
};

/**
 * Middleware to check subscription status (for dashboard display)
 */
export const getSubscriptionStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (req.user?.role !== 'organizer') {
      return next();
    }

    const userId = new Types.ObjectId(req.user.id);
    const subscription = await OrganizerSubscription.findOne({ organizerId: userId });

    if (!subscription) {
      // DO NOT auto-create subscription here
      // Subscriptions should only be created through explicit endpoints:
      // - Trial: /api/subscriptions/start-trial
      // - Paid: /api/subscriptions/verify-payment
      req.subscription = null;
    } else {
      req.subscription = subscription;
    }

    next();
  } catch (error: any) {
    console.error('Get subscription status error:', error);
    next();
  }
};

/**
 * Middleware to validate subscription for premium features
 */
export const requireActiveSubscription = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (req.user?.role !== 'organizer') {
      return next();
    }

    const userId = new Types.ObjectId(req.user.id);
    const subscription = await OrganizerSubscription.findOne({ organizerId: userId });

    if (!subscription || !(subscription as any).isValid) {
      return res.status(403).json({
        error: 'Active subscription required',
        message: 'Your subscription has expired. Please renew to access this feature.',
        action: 'upgrade_subscription'
      });
    }

    req.subscription = subscription;
    next();
  } catch (error: any) {
    console.error('Subscription validation error:', error);
    return res.status(500).json({
      error: 'Subscription validation failed',
      message: error.message
    });
  }
};
