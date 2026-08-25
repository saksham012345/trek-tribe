import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import {
  canCreateTrip,
  useTripSlot,
  isValid,
  decorate,
  NoTripSlotsError
} from '../services/organizerSubscriptionService';

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

    // organizerId is a string column holding the Mongo ObjectId of the user;
    // User is still a Mongo document, so it stays a string until wave 9 makes
    // it a foreign key.
    const userId = req.user.id;
    
    // Check if organizer can create trip
    const check = await canCreateTrip(userId);
    
    if (!check.allowed) {
      return res.status(403).json({
        error: 'Subscription limit reached',
        message: check.message,
        action: 'upgrade_subscription',
        upgradeUrl: '/api/subscriptions/renew'
      });
    }

    // Attach subscription info to request for later use
    const subscription = await prisma.organizerSubscription.findUnique({
      where: { organizerId: userId }
    });
    req.subscription = subscription ? decorate(subscription) : null;

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

    const userId = req.user.id;
    const subscription = await prisma.organizerSubscription.findUnique({
      where: { organizerId: userId }
    });

    if (!subscription) {
      throw new Error('Subscription not found');
    }

    // Use a trip slot
    const tripId = res.locals.createdTripId; // Set this in the trip creation route
    const tripTitle = res.locals.createdTripTitle;

    if (tripId && tripTitle) {
      const result = await useTripSlot(subscription.id, tripId, tripTitle);
      if (result.alreadyRecorded) {
        console.log(`Trip ${tripId} had already spent a slot; not spending another.`);
      } else {
        console.log(`✅ Used trip slot for organizer ${userId}. ${result.remaining} slots remaining.`);
      }
    }

    next();
  } catch (error: any) {
    if (error instanceof NoTripSlotsError) {
      // The trip is already created by the time this middleware runs, so this
      // stays non-fatal exactly as before - but it is now a distinguishable
      // condition rather than a generic failure.
      console.error('Trip created but no subscription slot was available:', error.message);
      return next();
    }
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

    const userId = req.user.id;
    const subscription = await prisma.organizerSubscription.findUnique({
      where: { organizerId: userId }
    });

    if (!subscription) {
      // DO NOT auto-create subscription here
      // Subscriptions should only be created through explicit endpoints:
      // - Trial: /api/subscriptions/start-trial
      // - Paid: /api/subscriptions/verify-payment
      req.subscription = null;
    } else {
      req.subscription = decorate(subscription);
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

    const userId = req.user.id;
    const subscription = await prisma.organizerSubscription.findUnique({
      where: { organizerId: userId }
    });

    // isValid was a Mongoose virtual, so `subscription.isValid` was a boolean
    // here - but only because the schema set toJSON/toObject virtuals. It is a
    // function of the dates now, computed every time rather than at save time,
    // which is what makes an expired subscription actually read as expired.
    if (!subscription || !isValid(subscription)) {
      return res.status(403).json({
        error: 'Active subscription required',
        message: 'Your subscription has expired. Please renew to access this feature.',
        action: 'upgrade_subscription'
      });
    }

    req.subscription = decorate(subscription);
    next();
  } catch (error: any) {
    console.error('Subscription validation error:', error);
    return res.status(500).json({
      error: 'Subscription validation failed',
      message: error.message
    });
  }
};
