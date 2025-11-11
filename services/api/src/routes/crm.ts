import express from 'express';
import leadController from '../controllers/leadController';
import ticketController from '../controllers/ticketController';
import verificationController from '../controllers/verificationController';
import subscriptionController from '../controllers/subscriptionController';
import analyticsService from '../services/analyticsService';
import notificationService from '../services/notificationService';
import {
  requireAdmin,
  requireOrganizerOrAdmin,
  requireRole,
  AuthRequest,
} from '../middleware/roleCheck';
import { requireCRMAccess, requireTripSlots } from '../middleware/crmAccess';
import {
  requireTripVerification,
  canModifyVerification,
} from '../middleware/tripVerifier';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// Apply authentication to all CRM routes
router.use(authenticateToken);

// ============================================
// LEAD MANAGEMENT ROUTES
// ============================================

router.post('/leads', requireOrganizerOrAdmin, leadController.createLead);
router.get('/leads', requireOrganizerOrAdmin, leadController.getLeads);
router.get('/leads/:id', requireOrganizerOrAdmin, leadController.getLeadById);
router.put('/leads/:id', requireOrganizerOrAdmin, leadController.updateLead);
router.post('/leads/:id/interactions', requireOrganizerOrAdmin, leadController.addInteraction);
router.post('/leads/:id/convert', requireOrganizerOrAdmin, leadController.convertLead);

// ============================================
// SUPPORT TICKET ROUTES
// ============================================

router.post('/tickets', ticketController.createTicket);
router.get('/tickets', ticketController.getTickets);
router.get('/tickets/:id', ticketController.getTicketById);
router.put('/tickets/:id/status', requireAdmin, ticketController.updateTicketStatus);
router.post('/tickets/:id/messages', ticketController.addMessage);
router.put('/tickets/:id/assign', requireAdmin, ticketController.assignTicket);
router.post('/tickets/:id/resolve', requireAdmin, ticketController.resolveTicket);

// ============================================
// TRIP VERIFICATION ROUTES
// ============================================

router.post(
  '/verifications',
  requireOrganizerOrAdmin,
  verificationController.submitForVerification
);
router.get('/verifications', requireOrganizerOrAdmin, verificationController.getVerifications);
router.get('/verifications/trip/:tripId', verificationController.getVerificationByTripId);
router.put(
  '/verifications/trip/:tripId/status',
  requireAdmin,
  verificationController.updateVerificationStatus
);
router.put(
  '/verifications/trip/:tripId/checklist',
  requireAdmin,
  verificationController.updateChecklistItem
);

// ============================================
// SUBSCRIPTION & PAYMENT ROUTES
// ============================================

router.post(
  '/subscriptions/trial',
  requireOrganizerOrAdmin,
  subscriptionController.createTrialSubscription
);
router.post(
  '/subscriptions/purchase/trip-package',
  requireOrganizerOrAdmin,
  subscriptionController.purchaseTripPackage
);
router.post(
  '/subscriptions/purchase/crm-bundle',
  requireOrganizerOrAdmin,
  subscriptionController.purchaseCRMBundle
);
router.get('/subscriptions/my', requireOrganizerOrAdmin, subscriptionController.getSubscription);
router.get('/subscriptions/:organizerId', requireAdmin, subscriptionController.getSubscription);
router.get('/subscriptions', requireAdmin, subscriptionController.getAllSubscriptions);
router.post('/subscriptions/use-trip-slot', requireAdmin, subscriptionController.useTripSlot);

// ============================================
// ANALYTICS ROUTES
// ============================================

// Organizer analytics
router.get('/analytics/organizer', requireOrganizerOrAdmin, async (req: AuthRequest, res) => {
  try {
    const organizerId = req.user?.role === 'admin' 
      ? req.query.organizerId as string 
      : req.user?.id;
    
    if (!organizerId) {
      return res.status(400).json({
        success: false,
        message: 'Organizer ID required',
      });
    }

    let dateRange;
    if (req.query.startDate && req.query.endDate) {
      dateRange = {
        start: new Date(req.query.startDate as string),
        end: new Date(req.query.endDate as string),
      };
    }

    const analytics = await analyticsService.getOrganizerAnalytics(organizerId, dateRange);

    res.json({
      success: true,
      data: analytics,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch analytics',
      error: error.message,
    });
  }
});

// User analytics
router.get('/analytics/user', async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.role === 'admin' 
      ? req.query.userId as string 
      : req.user?.id;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID required',
      });
    }

    const analytics = await analyticsService.getUserAnalytics(userId);

    res.json({
      success: true,
      data: analytics,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user analytics',
      error: error.message,
    });
  }
});

// Admin analytics
router.get('/analytics/admin', requireAdmin, async (req: AuthRequest, res) => {
  try {
    let dateRange;
    if (req.query.startDate && req.query.endDate) {
      dateRange = {
        start: new Date(req.query.startDate as string),
        end: new Date(req.query.endDate as string),
      };
    }

    const analytics = await analyticsService.getAdminAnalytics(dateRange);

    res.json({
      success: true,
      data: analytics,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch admin analytics',
      error: error.message,
    });
  }
});

// Lead sources breakdown
router.get('/analytics/lead-sources', requireAdmin, async (req: AuthRequest, res) => {
  try {
    const sources = await analyticsService.getLeadSourcesBreakdown();
    res.json({
      success: true,
      data: sources,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch lead sources',
      error: error.message,
    });
  }
});

// Ticket categories breakdown
router.get('/analytics/ticket-categories', requireAdmin, async (req: AuthRequest, res) => {
  try {
    const categories = await analyticsService.getTicketCategoryBreakdown();
    res.json({
      success: true,
      data: categories,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch ticket categories',
      error: error.message,
    });
  }
});

// ============================================
// NOTIFICATION ROUTES
// ============================================

router.get('/notifications', async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const { limit, skip, unreadOnly } = req.query;
    
    const result = await notificationService.getUserNotifications(req.user.id, {
      limit: limit ? Number(limit) : undefined,
      skip: skip ? Number(skip) : undefined,
      unreadOnly: unreadOnly === 'true',
    });

    res.json({
      success: true,
      data: result.notifications,
      unreadCount: result.unreadCount,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notifications',
      error: error.message,
    });
  }
});

router.put('/notifications/:id/read', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const notification = await notificationService.markAsRead(id);

    res.json({
      success: true,
      data: notification,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to mark notification as read',
      error: error.message,
    });
  }
});

router.put('/notifications/read-all', async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    await notificationService.markAllAsRead(req.user.id);

    res.json({
      success: true,
      message: 'All notifications marked as read',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to mark all as read',
      error: error.message,
    });
  }
});

export default router;
