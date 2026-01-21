import { Response, NextFunction } from 'express';
import { AuthRequest } from './roleCheck';
import CRMSubscription from '../models/CRMSubscription';
import { User } from '../models/User';

/**
 * Middleware to check if organizer has active CRM subscription
 */
export const requireCRMAccess = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    // Admin always has access
    if (req.user.role === 'admin') {
      return next();
    }

    // Only organizers need CRM subscription
    if (req.user.role !== 'organizer') {
      return res.status(403).json({
        success: false,
        message: 'CRM access is only available for organizers',
      });
    }

    // Check AutoPay (The primary guard)
    const user = await User.findById(req.user.id);
    const autoPayEnabled = user?.organizerProfile?.autoPay?.autoPayEnabled === true;

    if (!autoPayEnabled) {
      return res.status(403).json({
        success: false,
        message: 'AutoPay is not enabled. Please subscribe to access CRM features.',
        requiresAutoPay: true,
        upgradeUrl: '/organizer/subscription',
      });
    }

    // Check specific CRM subscription
    const subscription = await CRMSubscription.findOne({
      organizerId: req.user.id,
      status: 'active',
    });

    // Check if subscription has CRM bundle access
    if (!subscription.crmBundle?.hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'CRM access bundle required. Please upgrade your subscription.',
        currentPlan: subscription.planType,
        upgradeUrl: '/crm/subscribe',
      });
    }

    // Check if subscription is valid
    if (subscription.endDate && subscription.endDate < new Date()) {
      return res.status(403).json({
        success: false,
        message: 'Your CRM subscription has expired',
        expiryDate: subscription.endDate,
        renewUrl: '/crm/renew',
      });
    }

    // Attach subscription to request for use in controllers
    (req as any).crmSubscription = subscription;

    next();
  } catch (error) {
    console.error('CRM access check error:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking CRM access',
    });
  }
};

/**
 * Middleware to check if organizer has remaining trip slots
 */
export const requireTripSlots = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    // Admin can create unlimited trips
    if (req.user.role === 'admin') {
      return next();
    }

    if (req.user.role !== 'organizer') {
      return res.status(403).json({
        success: false,
        message: 'Only organizers can create trips',
      });
    }

    const subscription = await CRMSubscription.findOne({
      organizerId: req.user.id,
      status: 'active',
    });

    if (!subscription) {
      return res.status(403).json({
        success: false,
        message: 'Active subscription required to create trips',
        subscribeUrl: '/crm/subscribe',
      });
    }

    // Check trial period
    if (subscription.trial?.isActive && subscription.trial.endDate > new Date()) {
      return next();
    }

    // Check trip package
    if (!subscription.tripPackage || subscription.tripPackage.remainingTrips <= 0) {
      return res.status(403).json({
        success: false,
        message: 'No remaining trip slots. Please purchase a trip package.',
        usedTrips: subscription.tripPackage?.usedTrips || 0,
        totalTrips: subscription.tripPackage?.totalTrips || 0,
        upgradeUrl: '/crm/purchase-trips',
      });
    }

    // Attach subscription to request
    (req as any).crmSubscription = subscription;

    next();
  } catch (error) {
    console.error('Trip slots check error:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking trip slots',
    });
  }
};
