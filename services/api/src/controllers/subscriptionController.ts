import { Response } from 'express';
import { AuthRequest } from '../middleware/roleCheck';
import CRMSubscription from '../models/CRMSubscription';
import notificationService from '../services/notificationService';

class SubscriptionController {
  /**
   * Create trial subscription for new organizer
   */
  async createTrialSubscription(req: AuthRequest, res: Response) {
    try {
      if (!req.user || req.user.role !== 'organizer') {
        return res.status(403).json({
          success: false,
          message: 'Only organizers can create subscriptions',
        });
      }

      // Check if subscription already exists
      const existing = await CRMSubscription.findOne({
        organizerId: req.user.id,
      });

      if (existing) {
        return res.status(400).json({
          success: false,
          message: 'Subscription already exists',
          data: existing,
        });
      }

      // Create 2-month trial
      const trialEndDate = new Date();
      trialEndDate.setMonth(trialEndDate.getMonth() + 2);

      const subscription = new CRMSubscription({
        organizerId: req.user.id,
        planType: 'trial',
        status: 'active',
        trial: {
          isActive: true,
          startDate: new Date(),
          endDate: trialEndDate,
          monthsRemaining: 2,
        },
        tripPackage: {
          packageType: '5_trips',
          totalTrips: 5,
          usedTrips: 0,
          remainingTrips: 5,
          pricePerPackage: 1499,
        },
        notifications: {
          trialEndingIn7Days: false,
          trialEndingIn1Day: false,
          trialExpired: false,
          paymentReminder: false,
        },
      });

      await subscription.save();

      res.status(201).json({
        success: true,
        message: 'Trial subscription created successfully',
        data: subscription,
      });
    } catch (error: any) {
      console.error('Create trial subscription error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create trial subscription',
        error: error.message,
      });
    }
  }

  /**
   * Purchase trip package (₹1499 for 5 trips)
   */
  async purchaseTripPackage(req: AuthRequest, res: Response) {
    try {
      const { transactionId, paymentMethod } = req.body;

      if (!req.user || req.user.role !== 'organizer') {
        return res.status(403).json({
          success: false,
          message: 'Only organizers can purchase trip packages',
        });
      }

      let subscription = await CRMSubscription.findOne({
        organizerId: req.user.id,
      });

      if (!subscription) {
        subscription = new CRMSubscription({
          organizerId: req.user.id,
          planType: 'trip_package_5',
          status: 'active',
          tripPackage: {
            packageType: '5_trips',
            totalTrips: 5,
            usedTrips: 0,
            remainingTrips: 5,
            pricePerPackage: 1499,
          },
          notifications: {
            trialEndingIn7Days: false,
            trialEndingIn1Day: false,
            trialExpired: false,
            paymentReminder: false,
          },
        });
      } else {
        // Add more trips to existing package
        if (!subscription.tripPackage) {
          subscription.tripPackage = {
            packageType: '5_trips',
            totalTrips: 5,
            usedTrips: 0,
            remainingTrips: 5,
            pricePerPackage: 1499,
          };
        } else {
          subscription.tripPackage.totalTrips += 5;
          subscription.tripPackage.remainingTrips += 5;
        }
      }

      // Add payment record
      subscription.payments.push({
        transactionId,
        amount: 1499,
        currency: 'INR',
        paymentMethod,
        status: 'completed',
        paidAt: new Date(),
      });

      // Add billing history
      subscription.billingHistory.push({
        date: new Date(),
        amount: 1499,
        description: 'Trip Package Purchase - 5 Trips',
      });

      await subscription.save();

      // Send notification
      await notificationService.createNotification({
        userId: req.user.id,
        type: 'payment',
        title: 'Trip Package Purchased',
        message: 'You have successfully purchased 5 trip credits',
        priority: 'high',
        sendEmail: true,
      });

      res.json({
        success: true,
        message: 'Trip package purchased successfully',
        data: subscription,
      });
    } catch (error: any) {
      console.error('Purchase trip package error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to purchase trip package',
        error: error.message,
      });
    }
  }

  /**
   * Purchase CRM bundle (₹2100)
   */
  async purchaseCRMBundle(req: AuthRequest, res: Response) {
    try {
      const { transactionId, paymentMethod } = req.body;

      if (!req.user || req.user.role !== 'organizer') {
        return res.status(403).json({
          success: false,
          message: 'Only organizers can purchase CRM bundle',
        });
      }

      let subscription = await CRMSubscription.findOne({
        organizerId: req.user.id,
      });

      if (!subscription) {
        subscription = new CRMSubscription({
          organizerId: req.user.id,
          planType: 'crm_bundle',
          status: 'active',
        });
      }

      subscription.crmBundle = {
        hasAccess: true,
        price: 2100,
        features: [
          'Lead Management',
          'Support Ticketing',
          'Chat Support',
          'Analytics Dashboard',
          'Trip Verification',
          'Customer Insights',
        ],
      };

      // Add payment record
      subscription.payments.push({
        transactionId,
        amount: 2100,
        currency: 'INR',
        paymentMethod,
        status: 'completed',
        paidAt: new Date(),
      });

      // Add billing history
      subscription.billingHistory.push({
        date: new Date(),
        amount: 2100,
        description: 'CRM Access Bundle Purchase',
      });

      await subscription.save();

      // Send notification
      await notificationService.createNotification({
        userId: req.user.id,
        type: 'payment',
        title: 'CRM Bundle Activated',
        message: 'You now have full access to CRM features',
        priority: 'high',
        sendEmail: true,
      });

      res.json({
        success: true,
        message: 'CRM bundle purchased successfully',
        data: subscription,
      });
    } catch (error: any) {
      console.error('Purchase CRM bundle error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to purchase CRM bundle',
        error: error.message,
      });
    }
  }

  /**
   * Get subscription details
   */
  async getSubscription(req: AuthRequest, res: Response) {
    try {
      const organizerId = req.params.organizerId || req.user?.id;

      if (!organizerId) {
        return res.status(400).json({
          success: false,
          message: 'Organizer ID required',
        });
      }

      const subscription = await CRMSubscription.findOne({ organizerId });

      if (!subscription) {
        return res.status(404).json({
          success: false,
          message: 'No subscription found',
        });
      }

      res.json({
        success: true,
        data: subscription,
      });
    } catch (error: any) {
      console.error('Get subscription error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch subscription',
        error: error.message,
      });
    }
  }

  /**
   * Use a trip slot
   */
  async useTripSlot(req: AuthRequest, res: Response) {
    try {
      const { organizerId } = req.body;

      const subscription = await CRMSubscription.findOne({
        organizerId,
        status: 'active',
      });

      if (!subscription || !subscription.tripPackage) {
        return res.status(400).json({
          success: false,
          message: 'No active trip package found',
        });
      }

      if (subscription.tripPackage.remainingTrips <= 0) {
        return res.status(400).json({
          success: false,
          message: 'No remaining trip slots',
        });
      }

      subscription.tripPackage.usedTrips += 1;
      subscription.tripPackage.remainingTrips -= 1;

      await subscription.save();

      // Send warning if running low
      if (subscription.tripPackage.remainingTrips <= 1) {
        await notificationService.createNotification({
          userId: organizerId,
          type: 'reminder',
          title: 'Low Trip Credits',
          message: `You have only ${subscription.tripPackage.remainingTrips} trip slot(s) remaining`,
          priority: 'high',
          actionUrl: '/crm/purchase-trips',
          sendEmail: true,
        });
      }

      res.json({
        success: true,
        message: 'Trip slot used successfully',
        remainingTrips: subscription.tripPackage.remainingTrips,
      });
    } catch (error: any) {
      console.error('Use trip slot error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to use trip slot',
        error: error.message,
      });
    }
  }

  /**
   * Get all subscriptions (Admin only)
   */
  async getAllSubscriptions(req: AuthRequest, res: Response) {
    try {
      const { status, planType, page = 1, limit = 20 } = req.query;
      const query: any = {};

      if (status) query.status = status;
      if (planType) query.planType = planType;

      const subscriptions = await CRMSubscription.find(query)
        .populate('organizerId', 'name email')
        .sort({ createdAt: -1 })
        .limit(Number(limit))
        .skip((Number(page) - 1) * Number(limit));

      const total = await CRMSubscription.countDocuments(query);

      res.json({
        success: true,
        data: subscriptions,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit)),
        },
      });
    } catch (error: any) {
      console.error('Get all subscriptions error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch subscriptions',
        error: error.message,
      });
    }
  }
  /**
   * Admin: Update subscription manually
   */
  async updateSubscription(req: AuthRequest, res: Response) {
    try {
      // Role check handled by route middleware
      const { organizerId } = req.params;
      const { planType, status, validUntil, crmAccess, overrideOverride } = req.body;

      let subscription = await CRMSubscription.findOne({ organizerId });

      if (!subscription) {
        // Create new if not exists
        subscription = new CRMSubscription({
          organizerId,
          planType: planType || 'basic',
          status: status || 'active',
        });
      }

      if (planType) subscription.planType = planType;
      if (status) subscription.status = status;
      if (crmAccess !== undefined) {
        if (!subscription.crmBundle) {
            subscription.crmBundle = { hasAccess: crmAccess, price: 0, features: [] };
        } else {
            subscription.crmBundle.hasAccess = crmAccess;
        }
      }
      
      // Handle custom validity
      if (validUntil) {
        // We might need to adjust specific trial or package dates depending on schema
        // For now, let's assume we can set a generic expiry if the schema supports it
        // The current schema seems to split trial and tripPackage. 
        // We will infer "active until" logic by updating trialEndDate or adding a custom field if needed.
        // Or simply update the trial end date if it's a trial, or just log it for now as the schema is specific.
        // Let's check the schema again. 
        // The schema has `trial.endDate`.
        if (subscription.trial) {
            subscription.trial.endDate = new Date(validUntil);
            subscription.trial.isActive = new Date(validUntil) > new Date();
        }
      }

      await subscription.save();

      // Log admin action
      await notificationService.createNotification({
        userId: organizerId,
        type: 'system',
        title: 'Subscription Updated',
        message: 'An administrator has updated your subscription details.',
        priority: 'high',
        sendEmail: true,
      });

      res.json({
        success: true,
        message: 'Subscription updated successfully',
        data: subscription,
      });
    } catch (error: any) {
      console.error('Update subscription error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update subscription',
        error: error.message,
      });
    }
  }
}

export default new SubscriptionController();
