import { Response } from 'express';
import { AuthRequest } from '../middleware/roleCheck';
import { prisma } from '../lib/prisma';
import {
  decorateWithTotal,
  useTripSlot as spendTripSlot,
  remainingTrips,
  NoTripSlotsError
} from '../services/crmSubscriptionService';
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
      const existing = await prisma.cRMSubscription.findFirst({
        where: { organizerId: req.user.id },
      });

      if (existing) {
        return res.status(400).json({
          success: false,
          message: 'Subscription already exists',
          data: await decorateWithTotal(existing),
        });
      }

      // Create 2-month trial
      const trialEndDate = new Date();
      trialEndDate.setMonth(trialEndDate.getMonth() + 2);

      // The four nested objects are columns; the notifications block was all
      // defaults and is left to them.
      const subscription = await prisma.cRMSubscription.create({
        data: {
          organizerId: req.user.id,
          planType: 'trial',
          status: 'active',
          trialIsActive: true,
          trialStartDate: new Date(),
          trialEndDate,
          trialMonthsRemaining: 2,
          packageType: 'trips_5',
          totalTrips: 5,
          usedTrips: 0,
          pricePerPackage: 1499,
        },
      });

      res.status(201).json({
        success: true,
        message: 'Trial subscription created successfully',
        data: await decorateWithTotal(subscription),
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

      // The package top-up, the payment and the billing line go together or not
      // at all: a purchase that grants five trips without recording the payment
      // is five free trips, and one that records the payment without the trips
      // is money taken for nothing.
      let subscription;
      try {
        subscription = await prisma.$transaction(async (tx) => {
          const existing = await tx.cRMSubscription.findFirst({
            where: { organizerId: req.user!.id },
          });

          const row = existing
            ? await tx.cRMSubscription.update({
                where: { id: existing.id },
                data: { totalTrips: { increment: 5 } },
              })
            : await tx.cRMSubscription.create({
                data: {
                  organizerId: req.user!.id,
                  planType: 'trip_package_5',
                  status: 'active',
                  packageType: 'trips_5',
                  totalTrips: 5,
                  usedTrips: 0,
                  pricePerPackage: 1499,
                },
              });

          await tx.cRMSubscriptionPayment.create({
            data: {
              subscriptionId: row.id,
              transactionId,
              amount: 1499,
              currency: 'INR',
              paymentMethod,
              status: 'completed',
              paidAt: new Date(),
            },
          });

          await tx.cRMBillingEntry.create({
            data: {
              subscriptionId: row.id,
              date: new Date(),
              amount: 1499,
              description: 'Trip Package Purchase - 5 Trips',
            },
          });

          return row;
        });
      } catch (error: any) {
        // transactionId is unique, so a resubmitted purchase form does not buy
        // the package twice. Nothing stopped that before.
        if (error?.code === 'P2002') {
          return res.status(409).json({
            success: false,
            message: 'This payment has already been recorded',
          });
        }
        throw error;
      }

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
        data: await decorateWithTotal(subscription),
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

      const bundleFields = {
        crmBundleHasAccess: true,
        crmBundlePrice: 2100,
        crmBundleFeatures: [
          'Lead Management',
          'Support Ticketing',
          'Chat Support',
          'Analytics Dashboard',
          'Trip Verification',
          'Customer Insights',
        ],
      };

      let subscription;
      try {
        subscription = await prisma.$transaction(async (tx) => {
          const existing = await tx.cRMSubscription.findFirst({
            where: { organizerId: req.user!.id },
          });

          const row = existing
            ? await tx.cRMSubscription.update({ where: { id: existing.id }, data: bundleFields })
            : await tx.cRMSubscription.create({
                data: {
                  organizerId: req.user!.id,
                  planType: 'crm_bundle',
                  status: 'active',
                  ...bundleFields,
                },
              });

          await tx.cRMSubscriptionPayment.create({
            data: {
              subscriptionId: row.id,
              transactionId,
              amount: 2100,
              currency: 'INR',
              paymentMethod,
              status: 'completed',
              paidAt: new Date(),
            },
          });

          await tx.cRMBillingEntry.create({
            data: {
              subscriptionId: row.id,
              date: new Date(),
              amount: 2100,
              description: 'CRM Access Bundle Purchase',
            },
          });

          return row;
        });
      } catch (error: any) {
        if (error?.code === 'P2002') {
          return res.status(409).json({
            success: false,
            message: 'This payment has already been recorded',
          });
        }
        throw error;
      }

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
        data: await decorateWithTotal(subscription),
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

      const subscription = await prisma.cRMSubscription.findFirst({
        where: { organizerId },
        include: {
          payments: { orderBy: { paidAt: 'desc' } },
          billingHistory: { orderBy: { date: 'desc' } },
        },
      });

      if (!subscription) {
        return res.status(404).json({
          success: false,
          message: 'No subscription found',
        });
      }

      res.json({
        success: true,
        data: await decorateWithTotal(subscription),
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

      const subscription = await prisma.cRMSubscription.findFirst({
        where: { organizerId, status: 'active' },
      });

      // tripPackage was an optional nested object, hence the second half of
      // this test. Its fields are columns with defaults, so a row existing is
      // the whole question.
      if (!subscription) {
        return res.status(400).json({
          success: false,
          message: 'No active trip package found',
        });
      }

      let left: number;
      try {
        // The check and the decrement are one statement now, so two trips
        // started together cannot both take the last slot.
        left = await spendTripSlot(subscription.id);
      } catch (error: any) {
        if (error instanceof NoTripSlotsError) {
          return res.status(400).json({
            success: false,
            message: 'No remaining trip slots',
          });
        }
        throw error;
      }

      // Send warning if running low
      if (left <= 1) {
        await notificationService.createNotification({
          userId: organizerId,
          type: 'reminder',
          title: 'Low Trip Credits',
          message: `You have only ${left} trip slot(s) remaining`,
          priority: 'high',
          actionUrl: '/crm/purchase-trips',
          sendEmail: true,
        });
      }

      res.json({
        success: true,
        message: 'Trip slot used successfully',
        remainingTrips: left,
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

      // populate('organizerId') is gone - User is still a Mongo document, and
      // nothing in this response body read the populated name or email.
      const [subscriptions, total] = await Promise.all([
        prisma.cRMSubscription.findMany({
          where: query,
          orderBy: { createdAt: 'desc' },
          take: Number(limit),
          skip: (Number(page) - 1) * Number(limit),
        }),
        prisma.cRMSubscription.count({ where: query }),
      ]);

      res.json({
        success: true,
        data: await Promise.all(subscriptions.map(decorateWithTotal)),
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

      let subscription = await prisma.cRMSubscription.findFirst({ where: { organizerId } });

      if (!subscription) {
        // Create new if not exists.
        //
        // The fallback plan was 'basic', which is not one of the six values
        // this model allows - it belongs to OrganizerSubscription, a different
        // model. Mongoose validates enums on save, so an admin updating an
        // organizer who had no CRM subscription, without naming a plan, got a
        // ValidationError and a 500. 'trial' is the sensible default among the
        // values that actually exist.
        subscription = await prisma.cRMSubscription.create({
          data: {
            organizerId,
            planType: (planType || 'trial') as any,
            status: (status || 'active') as any,
          },
        });
      }

      const data: any = {};
      if (planType) data.planType = planType;
      if (status) data.status = status;
      if (crmAccess !== undefined) data.crmBundleHasAccess = crmAccess;
      
      // Handle custom validity
      if (validUntil) {
        // The trailing comments here were someone reasoning aloud about where a
        // generic expiry belongs when the schema splits trial and package
        // dates. It still belongs on the trial dates, but `if (subscription.trial)`
        // was a test for a nested object Mongoose always materialised, so it was
        // always true - and the columns are always there now. Dropped rather
        // than kept as a condition that cannot fail.
        data.trialEndDate = new Date(validUntil);
        data.trialIsActive = new Date(validUntil) > new Date();
      }

      try {
        subscription = await prisma.cRMSubscription.update({
          where: { id: subscription.id },
          data,
        });
      } catch (error: any) {
        if (/invalid input value for enum/i.test(error?.message || '')) {
          return res.status(400).json({
            success: false,
            message: 'Unknown plan type or status value',
          });
        }
        throw error;
      }

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
        data: await decorateWithTotal(subscription),
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
