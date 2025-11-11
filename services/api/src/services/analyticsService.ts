import Lead from '../models/Lead';
import Ticket from '../models/Ticket';
import UserActivity from '../models/UserActivity';
import TripVerification from '../models/TripVerification';
import CRMSubscription from '../models/CRMSubscription';
import mongoose from 'mongoose';

class AnalyticsService {
  /**
   * Get organizer dashboard analytics
   */
  async getOrganizerAnalytics(organizerId: string, dateRange?: { start: Date; end: Date }) {
    try {
      const dateFilter = dateRange
        ? { createdAt: { $gte: dateRange.start, $lte: dateRange.end } }
        : {};

      // Get trips count (you'll need to import Trip model)
      // const tripsCreated = await Trip.countDocuments({ organizerId, ...dateFilter });
      // const verifiedTrips = await TripVerification.countDocuments({ organizerId, status: 'verified', ...dateFilter });

      // Get leads
      const totalLeads = await Lead.countDocuments({ assignedTo: organizerId, ...dateFilter });
      const convertedLeads = await Lead.countDocuments({
        assignedTo: organizerId,
        status: 'converted',
        ...dateFilter,
      });
      const conversionRate = totalLeads > 0 ? (convertedLeads / totalLeads) * 100 : 0;

      // Get tickets
      const totalTickets = await Ticket.countDocuments({
        requesterId: organizerId,
        requesterType: 'organizer',
        ...dateFilter,
      });
      const resolvedTickets = await Ticket.countDocuments({
        requesterId: organizerId,
        requesterType: 'organizer',
        status: 'resolved',
        ...dateFilter,
      });

      // Get user activity
      const activities = await UserActivity.find({
        userId: organizerId,
        ...dateFilter,
      })
        .sort({ createdAt: -1 })
        .limit(10);

      // Get subscription info
      const subscription = await CRMSubscription.findOne({
        organizerId,
        status: 'active',
      });

      return {
        // trips: {
        //   total: tripsCreated,
        //   verified: verifiedTrips,
        //   pending: tripsCreated - verifiedTrips,
        // },
        leads: {
          total: totalLeads,
          converted: convertedLeads,
          conversionRate: conversionRate.toFixed(2),
        },
        support: {
          totalTickets,
          resolvedTickets,
          pendingTickets: totalTickets - resolvedTickets,
        },
        recentActivity: activities,
        subscription: subscription
          ? {
              planType: subscription.planType,
              status: subscription.status,
              remainingTrips: subscription.tripPackage?.remainingTrips || 0,
              hasCRMAccess: subscription.crmBundle?.hasAccess || false,
              expiryDate: subscription.endDate,
            }
          : null,
      };
    } catch (error) {
      console.error('Error getting organizer analytics:', error);
      throw error;
    }
  }

  /**
   * Get user dashboard analytics
   */
  async getUserAnalytics(userId: string) {
    try {
      // Get bookings count (you'll need to import Booking model)
      // const totalBookings = await Booking.countDocuments({ userId });

      // Get tickets
      const totalTickets = await Ticket.countDocuments({
        requesterId: userId,
        requesterType: 'user',
      });
      const pendingTickets = await Ticket.countDocuments({
        requesterId: userId,
        requesterType: 'user',
        status: { $in: ['pending', 'in_progress'] },
      });

      // Get recent activities
      const activities = await UserActivity.find({ userId })
        .sort({ createdAt: -1 })
        .limit(10);

      // Get leads (if user showed interest in trips)
      const leads = await Lead.find({ userId }).sort({ createdAt: -1 }).limit(5);

      return {
        // bookings: {
        //   total: totalBookings,
        // },
        support: {
          totalTickets,
          pendingTickets,
        },
        recentActivity: activities,
        interests: leads,
      };
    } catch (error) {
      console.error('Error getting user analytics:', error);
      throw error;
    }
  }

  /**
   * Get admin dashboard analytics
   */
  async getAdminAnalytics(dateRange?: { start: Date; end: Date }) {
    try {
      const dateFilter = dateRange
        ? { createdAt: { $gte: dateRange.start, $lte: dateRange.end } }
        : {};

      // Total leads
      const totalLeads = await Lead.countDocuments(dateFilter);
      const newLeads = await Lead.countDocuments({ status: 'new', ...dateFilter });

      // Tickets
      const totalTickets = await Ticket.countDocuments(dateFilter);
      const pendingTickets = await Ticket.countDocuments({
        status: 'pending',
        ...dateFilter,
      });
      const avgResponseTime = await this.getAverageResponseTime(dateFilter);

      // Trip verifications
      const pendingVerifications = await TripVerification.countDocuments({
        status: 'pending',
        ...dateFilter,
      });
      const verifiedTrips = await TripVerification.countDocuments({
        status: 'verified',
        ...dateFilter,
      });

      // Subscriptions
      const activeSubscriptions = await CRMSubscription.countDocuments({
        status: 'active',
      });
      const trialSubscriptions = await CRMSubscription.countDocuments({
        'trial.isActive': true,
      });

      // Revenue (sum of all completed payments)
      const revenueData = await CRMSubscription.aggregate([
        {
          $unwind: '$payments',
        },
        {
          $match: {
            'payments.status': 'completed',
          },
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$payments.amount' },
          },
        },
      ]);

      const totalRevenue = revenueData.length > 0 ? revenueData[0].totalRevenue : 0;

      return {
        leads: {
          total: totalLeads,
          new: newLeads,
        },
        tickets: {
          total: totalTickets,
          pending: pendingTickets,
          avgResponseTime: avgResponseTime.toFixed(2),
        },
        verifications: {
          pending: pendingVerifications,
          verified: verifiedTrips,
        },
        subscriptions: {
          active: activeSubscriptions,
          trial: trialSubscriptions,
        },
        revenue: {
          total: totalRevenue,
          currency: 'INR',
        },
      };
    } catch (error) {
      console.error('Error getting admin analytics:', error);
      throw error;
    }
  }

  /**
   * Get average ticket response time in minutes
   */
  private async getAverageResponseTime(dateFilter: any): Promise<number> {
    try {
      const tickets = await Ticket.find({
        ...dateFilter,
        responseTime: { $exists: true },
      });

      if (tickets.length === 0) return 0;

      const totalTime = tickets.reduce((sum, ticket) => sum + (ticket.responseTime || 0), 0);
      return totalTime / tickets.length;
    } catch (error) {
      console.error('Error calculating average response time:', error);
      return 0;
    }
  }

  /**
   * Get lead sources breakdown
   */
  async getLeadSourcesBreakdown() {
    try {
      const sources = await Lead.aggregate([
        {
          $group: {
            _id: '$source',
            count: { $sum: 1 },
          },
        },
        {
          $sort: { count: -1 },
        },
      ]);

      return sources;
    } catch (error) {
      console.error('Error getting lead sources:', error);
      throw error;
    }
  }

  /**
   * Get ticket category breakdown
   */
  async getTicketCategoryBreakdown() {
    try {
      const categories = await Ticket.aggregate([
        {
          $group: {
            _id: '$category',
            count: { $sum: 1 },
          },
        },
        {
          $sort: { count: -1 },
        },
      ]);

      return categories;
    } catch (error) {
      console.error('Error getting ticket categories:', error);
      throw error;
    }
  }
}

export default new AnalyticsService();
