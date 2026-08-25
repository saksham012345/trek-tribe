

import TripVerification from '../models/TripVerification';
import { prisma } from '../lib/prisma';
import { toNumber } from '../lib/money';
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
      const leadRange = dateRange
        ? { createdAt: { gte: dateRange.start, lte: dateRange.end } }
        : {};
      const totalLeads = await prisma.lead.count({
        where: { assignedTo: organizerId, ...leadRange }
      });
      const convertedLeads = await prisma.lead.count({
        where: { assignedTo: organizerId, status: 'converted', ...leadRange }
      });
      const conversionRate = totalLeads > 0 ? (convertedLeads / totalLeads) * 100 : 0;

      // Get tickets
      const ticketRange = dateRange
        ? { createdAt: { gte: dateRange.start, lte: dateRange.end } }
        : {};
      const totalTickets = await prisma.ticket.count({
        where: { requesterId: organizerId, requesterType: 'organizer', ...ticketRange }
      });
      const resolvedTickets = await prisma.ticket.count({
        where: {
          requesterId: organizerId,
          requesterType: 'organizer',
          status: 'resolved',
          ...ticketRange
        }
      });

      // Get user activity
      // dateFilter stays Mongo-shaped for the Mongo queries around this one,
      // so the Prisma range is built separately rather than reusing it.
      const activities = await prisma.userActivity.findMany({
        where: {
          userId: organizerId,
          ...(dateRange ? { createdAt: { gte: dateRange.start, lte: dateRange.end } } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });

      // Get subscription info
      const subscription = await prisma.cRMSubscription.findFirst({
        where: { organizerId, status: 'active' },
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
              // remainingTrips was a third stored number beside totalTrips and
              // usedTrips, which already determine it.
              remainingTrips: Math.max(0, subscription.totalTrips - subscription.usedTrips),
              hasCRMAccess: subscription.crmBundleHasAccess,
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
      const totalTickets = await prisma.ticket.count({
        where: { requesterId: userId, requesterType: 'user' }
      });
      const pendingTickets = await prisma.ticket.count({
        where: {
          requesterId: userId,
          requesterType: 'user',
          status: { in: ['pending', 'in_progress'] }
        }
      });

      // Get recent activities
      const activities = await prisma.userActivity.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });

      // Get leads (if user showed interest in trips)
      const leads = await prisma.lead.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 5
      });

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
      const adminLeadRange = dateRange
        ? { createdAt: { gte: dateRange.start, lte: dateRange.end } }
        : {};
      const totalLeads = await prisma.lead.count({ where: adminLeadRange });
      const newLeads = await prisma.lead.count({ where: { status: 'new', ...adminLeadRange } });

      // Tickets
      const adminTicketRange = dateRange
        ? { createdAt: { gte: dateRange.start, lte: dateRange.end } }
        : {};
      const totalTickets = await prisma.ticket.count({ where: adminTicketRange });
      const pendingTickets = await prisma.ticket.count({
        where: { status: 'pending', ...adminTicketRange }
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
      const activeSubscriptions = await prisma.cRMSubscription.count({
        where: { status: 'active' },
      });
      const trialSubscriptions = await prisma.cRMSubscription.count({
        where: { trialIsActive: true },
      });

      // Revenue (sum of all completed payments).
      //
      // Was $unwind over the embedded payments array followed by a $match and a
      // $sum. Payments are rows, so it is the sum of a column - and unlike the
      // OrganizerSubscription version of this same query, this one was actually
      // correct, because $unwind put each payment at the top level before the
      // $match looked at it.
      const revenueData = await prisma.cRMSubscriptionPayment.aggregate({
        where: { status: 'completed' },
        _sum: { amount: true },
      });

      const totalRevenue = toNumber(revenueData._sum.amount);

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
      // $exists: true becomes 'not null' - a Postgres column either has a
      // value or does not, so the two questions Mongo needed collapse into one.
      const tickets = await prisma.ticket.findMany({
        where: { responseTime: { not: null } },
        select: { responseTime: true }
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
      const grouped = await prisma.lead.groupBy({ by: ['source'], _count: { source: true } });
      const sources = grouped
        .map(g => ({ _id: g.source, count: g._count.source }))
        .sort((a, b) => b.count - a.count);
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
      const grouped = await prisma.ticket.groupBy({
        by: ['category'],
        _count: { category: true }
      });

      return grouped
        .map(g => ({ _id: g.category, count: g._count.category }))
        .sort((a, b) => b.count - a.count);
    } catch (error) {
      console.error('Error getting ticket categories:', error);
      throw error;
    }
  }
}

export default new AnalyticsService();
