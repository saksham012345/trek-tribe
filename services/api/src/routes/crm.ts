import express from 'express';
import leadController from '../controllers/leadController';
import ticketController from '../controllers/ticketController';
import verificationController from '../controllers/verificationController';
import subscriptionController from '../controllers/subscriptionController';
import analyticsService from '../services/analyticsService';
import notificationService from '../services/notificationService';
import Lead from '../models/Lead';
<<<<<<< HEAD
import { Trip } from '../models/Trip';
import { GroupBooking } from '../models/GroupBooking';
=======
>>>>>>> 5e975eafaa4913f756a179ddd9316010718039be
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

// CRM Stats endpoint for dashboard
router.get('/stats', requireOrganizerOrAdmin, async (req: AuthRequest, res) => {
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

    // Get lead statistics
    const totalLeads = await Lead.countDocuments({ assignedTo: organizerId });
    const newLeads = await Lead.countDocuments({ assignedTo: organizerId, status: 'new' });
    const convertedLeads = await Lead.countDocuments({ assignedTo: organizerId, status: 'converted' });
    const lostLeads = await Lead.countDocuments({ assignedTo: organizerId, status: 'lost' });
    const conversionRate = totalLeads > 0 ? (convertedLeads / totalLeads) * 100 : 0;

    // Get recent leads
    const recentLeads = await Lead.find({ assignedTo: organizerId })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('tripId', 'title destination')
      .populate('userId', 'name email');

    res.json({
      success: true,
      totalLeads,
      newLeads,
      convertedLeads,
      lostLeads,
      conversionRate: Math.round(conversionRate * 100) / 100,
      leads: recentLeads,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch CRM stats',
      error: error.message,
    });
  }
});

// ============================================
// CRM STATS ROUTE
// ============================================

router.get('/stats', requireOrganizerOrAdmin, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    const isAdmin = req.user?.role === 'admin';
    
    // Build query filters based on role
    const leadQuery: any = {};
    const tripQuery: any = {};
    const bookingQuery: any = {};
    
    if (!isAdmin && userId) {
      leadQuery.assignedTo = userId;
      tripQuery.organizerId = userId;
      // For bookings, we need to filter by trips owned by the organizer
      const organizerTripIds = await Trip.find({ organizerId: userId }).distinct('_id');
      bookingQuery.tripId = { $in: organizerTripIds };
    }
    
    // Get all leads for this organizer/admin
    const leads = await Lead.find(leadQuery).lean();
    
    // Get trips for revenue calculation
    const trips = await Trip.find(tripQuery).select('_id price participants').lean();
    
    // Get bookings for accurate revenue calculation
    bookingQuery.paymentStatus = { $in: ['completed', 'partial'] };
    bookingQuery.bookingStatus = { $in: ['confirmed', 'completed'] };
    const bookings = await GroupBooking.find(bookingQuery)
      .select('finalAmount paymentStatus bookingStatus createdAt')
      .lean();
    
    // Calculate revenue metrics
    const totalRevenue = bookings.reduce((sum, booking) => {
      if (booking.paymentStatus === 'completed') {
        return sum + (booking.finalAmount || 0);
      } else if (booking.paymentStatus === 'partial') {
        // For partial payments, count the advance amount
        return sum + ((booking as any).advanceAmount || 0);
      }
      return sum;
    }, 0);
    
    // Calculate this month's revenue
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonthRevenue = bookings
      .filter(booking => new Date(booking.createdAt) >= startOfMonth)
      .reduce((sum, booking) => {
        if (booking.paymentStatus === 'completed') {
          return sum + (booking.finalAmount || 0);
        } else if (booking.paymentStatus === 'partial') {
          return sum + ((booking as any).advanceAmount || 0);
        }
        return sum;
      }, 0);
    
    // Calculate last month's revenue
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    const lastMonthRevenue = bookings
      .filter(booking => {
        const bookingDate = new Date(booking.createdAt);
        return bookingDate >= startOfLastMonth && bookingDate <= endOfLastMonth;
      })
      .reduce((sum, booking) => {
        if (booking.paymentStatus === 'completed') {
          return sum + (booking.finalAmount || 0);
        } else if (booking.paymentStatus === 'partial') {
          return sum + ((booking as any).advanceAmount || 0);
        }
        return sum;
      }, 0);
    
    // Calculate revenue growth
    const revenueGrowth = lastMonthRevenue > 0 
      ? ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100 
      : (thisMonthRevenue > 0 ? 100 : 0);
    
    // Calculate total bookings
    const totalBookings = bookings.length;
    const confirmedBookings = bookings.filter(b => b.bookingStatus === 'confirmed' || b.bookingStatus === 'completed').length;
    
    // Calculate average booking value
    const averageBookingValue = totalBookings > 0 ? totalRevenue / totalBookings : 0;
    
    // Calculate stats
    const stats = {
      totalLeads: leads.length,
      newLeads: leads.filter((l: any) => l.status === 'new').length,
      contactedLeads: leads.filter((l: any) => l.status === 'contacted').length,
      interestedLeads: leads.filter((l: any) => l.status === 'interested').length,
      qualifiedLeads: leads.filter((l: any) => l.status === 'qualified').length,
      lostLeads: leads.filter((l: any) => l.status === 'lost').length,
      conversionRate: leads.length > 0 
        ? (leads.filter((l: any) => l.status === 'qualified').length / leads.length) * 100 
        : 0,
      revenue: {
        total: totalRevenue,
        thisMonth: thisMonthRevenue,
        lastMonth: lastMonthRevenue,
        growth: revenueGrowth,
        averageBookingValue: averageBookingValue,
      },
      bookings: {
        total: totalBookings,
        confirmed: confirmedBookings,
        pending: totalBookings - confirmedBookings,
      },
      trips: {
        total: trips.length,
        active: trips.filter((t: any) => t.status === 'active').length,
      },
    };
    
    res.json(stats);
  } catch (error: any) {
    console.error('Get CRM stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch CRM stats',
      error: error.message,
    });
  }
});

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
