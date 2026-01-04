import { Router, Request, Response } from 'express';
import { authenticateJwt, requireRole } from '../middleware/auth';
import { SupportTicket } from '../models/SupportTicket';
import { Trip } from '../models/Trip';
import { User } from '../models/User';
import { OrganizerSubscription } from '../models/OrganizerSubscription';
import Lead from '../models/Lead';
import Ticket from '../models/Ticket';
import TripVerification from '../models/TripVerification';

const router = Router();

/**
 * GET /api/analytics/dashboard
 * Get comprehensive dashboard analytics
 */
router.get('/dashboard', authenticateJwt, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const userRole = (req as any).user?.role;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Date range (default: last 30 days)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    const dateFilter = {
      createdAt: { $gte: startDate, $lte: endDate }
    };

    if (userRole === 'admin') {
      // Admin sees all platform metrics
      const [
        totalTrips,
        verifiedTrips,
        activeTrips,
        totalUsers,
        totalOrganizers,
        totalRevenue,
        pendingVerifications,
        totalLeads,
        convertedLeads,
        openTickets,
        topDestinations,
        recentTrips
      ] = await Promise.all([
        Trip.countDocuments(),
        Trip.countDocuments({ isVerified: true }),
        Trip.countDocuments({ isActive: true, startDate: { $gte: new Date() } }),
        User.countDocuments({ role: 'traveler' }),
        User.countDocuments({ role: 'organizer' }),
        OrganizerSubscription.aggregate([
          { $match: { paymentStatus: 'completed' } },
          { $group: { _id: null, total: { $sum: '$amount' } } }
        ]),
        TripVerification.countDocuments({ status: 'pending' }),
        Lead.countDocuments(),
        Lead.countDocuments({ status: 'converted' }),
        Ticket.countDocuments({ status: { $in: ['open', 'in_progress'] } }),
        Trip.aggregate([
          { $group: { _id: '$destination', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 10 }
        ]),
        Trip.find(dateFilter).sort({ createdAt: -1 }).limit(5).populate('organizer', 'name email')
      ]);

      // Calculate conversion rate
      const conversionRate = totalLeads > 0 ? (convertedLeads / totalLeads) * 100 : 0;

      // Calculate average booking value
      const avgBookingValue = totalRevenue.length > 0 ? totalRevenue[0].total / totalOrganizers : 0;

      // Monthly growth
      const lastMonthStart = new Date();
      lastMonthStart.setDate(lastMonthStart.getDate() - 60);
      lastMonthStart.setDate(1);

      const lastMonthEnd = new Date(lastMonthStart);
      lastMonthEnd.setMonth(lastMonthEnd.getMonth() + 1);
      lastMonthEnd.setDate(0);

      const [currentMonthTrips, lastMonthTrips] = await Promise.all([
        Trip.countDocuments({ createdAt: { $gte: startDate } }),
        Trip.countDocuments({
          createdAt: { $gte: lastMonthStart, $lte: lastMonthEnd }
        })
      ]);

      const monthlyGrowth = lastMonthTrips > 0
        ? ((currentMonthTrips - lastMonthTrips) / lastMonthTrips) * 100
        : 0;

      return res.json({
        overview: {
          totalTrips,
          verifiedTrips,
          activeTrips,
          pendingVerifications,
          totalUsers,
          totalOrganizers,
          revenueThisMonth: totalRevenue.length > 0 ? totalRevenue[0].total : 0,
          conversionRate: Math.round(conversionRate * 100) / 100,
          averageBookingValue: Math.round(avgBookingValue),
          monthlyGrowth: Math.round(monthlyGrowth * 100) / 100,
        },
        leads: {
          total: totalLeads,
          converted: convertedLeads,
          conversionRate: Math.round(conversionRate * 100) / 100,
        },
        support: {
          openTickets,
          responseTime: '2.5 hours', // Mock data - implement actual calculation
        },
        topDestinations: topDestinations.map(dest => ({
          name: dest._id,
          count: dest.count
        })),
        recentActivity: recentTrips.map(trip => ({
          id: trip._id,
          name: (trip as any).name || (trip as any).title || 'Untitled Trip',
          organizer: (trip as any).organizerId?.name || 'Unknown',
          createdAt: trip.createdAt
        })),
      });

    } else if (userRole === 'organizer') {
      // Organizer sees only their metrics
      const [
        myTrips,
        myActiveTrips,
        myLeads,
        myConvertedLeads,
        myTickets,
        myRevenue,
        mySubscription,
        tripViews,
        bookings
      ] = await Promise.all([
        Trip.countDocuments({ organizer: userId }),
        Trip.countDocuments({ organizer: userId, isActive: true }),
        Lead.countDocuments({ assignedTo: userId }),
        Lead.countDocuments({ assignedTo: userId, status: 'converted' }),
        Ticket.countDocuments({ userId }),
        OrganizerSubscription.aggregate([
          { $match: { organizerId: userId, 'payments.status': 'completed' } },
          { $group: { _id: null, total: { $sum: '$totalPaid' } } }
        ]),
        OrganizerSubscription.findOne({ organizerId: userId, status: { $in: ['active', 'trial'] } }),
        // Mock data - implement actual view tracking
        Promise.resolve(0),
        // Mock data - implement actual booking tracking
        Promise.resolve(0)
      ]);

      const conversionRate = myLeads > 0 ? (myConvertedLeads / myLeads) * 100 : 0;

      return res.json({
        overview: {
          totalTrips: myTrips,
          activeTrips: myActiveTrips,
          totalRevenue: myRevenue.length > 0 ? myRevenue[0].total : 0,
          conversionRate: Math.round(conversionRate * 100) / 100,
        },
        subscription: mySubscription ? {
          plan: mySubscription.plan,
          tripsRemaining: mySubscription.tripsRemaining,
          expiryDate: mySubscription.subscriptionEndDate || mySubscription.trialEndDate,
          daysLeft: Math.ceil(((mySubscription.subscriptionEndDate || mySubscription.trialEndDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        } : null,
        leads: {
          total: myLeads,
          converted: myConvertedLeads,
          conversionRate: Math.round(conversionRate * 100) / 100,
        },
        engagement: {
          views: tripViews,
          bookings,
          inquiries: myLeads,
        },
        support: {
          tickets: myTickets,
        },
      });
    } else {
      // For regular users (travelers), return a safe, personal analytics view
      const [
        tripsJoined,
        upcomingTrips,
        myTickets,
      ] = await Promise.all([
        Trip.countDocuments({ participants: userId }),
        Trip.countDocuments({ participants: userId, startDate: { $gte: new Date() } }),
        SupportTicket.countDocuments({ userId })
      ]);

      const recentTrips = await Trip.find({ participants: userId }).sort({ startDate: -1 }).limit(5).select('title startDate destination');

      return res.json({
        overview: {
          tripsJoined,
          upcomingTrips,
          openTickets: myTickets,
        },
        recentTrips: recentTrips.map(t => ({ id: t._id, title: (t as any).title, startDate: (t as any).startDate, destination: (t as any).destination })),
      });
    }

  } catch (error: any) {
    console.error('❌ Error fetching analytics:', error);
    return res.status(500).json({
      error: 'Failed to fetch analytics',
      message: error.message
    });
  }
});

/**
 * GET /api/analytics/revenue
 * Get revenue analytics
 */
router.get('/revenue', authenticateJwt, requireRole(['admin', 'organizer']), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const userRole = (req as any).user?.role;

    // Get last 12 months data
    const monthlyRevenue = [];
    const currentDate = new Date();

    for (let i = 11; i >= 0; i--) {
      const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() - i + 1, 0);

      const matchFilter = userRole === 'admin'
        ? { 'payments.status': 'completed', createdAt: { $gte: monthStart, $lte: monthEnd } }
        : { organizerId: userId, 'payments.status': 'completed', createdAt: { $gte: monthStart, $lte: monthEnd } };

      const revenue = await OrganizerSubscription.aggregate([
        { $match: matchFilter },
        { $group: { _id: null, total: { $sum: '$totalPaid' } } }
      ]);

      monthlyRevenue.push({
        month: monthStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        revenue: revenue.length > 0 ? revenue[0].total : 0,
      });
    }

    return res.json({
      monthlyRevenue,
      totalRevenue: monthlyRevenue.reduce((sum, month) => sum + month.revenue, 0),
    });

  } catch (error: any) {
    console.error('❌ Error fetching revenue analytics:', error);
    return res.status(500).json({ error: 'Failed to fetch revenue analytics' });
  }
});

/**
 * GET /api/analytics/trips
 * Get trip analytics
 */
router.get('/trips', authenticateJwt, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const userRole = (req as any).user?.role;

    const organizerFilter = userRole === 'organizer' ? { organizer: userId } : {};

    const [
      byCategory,
      byDifficulty,
      byStatus,
      averageParticipants
    ] = await Promise.all([
      Trip.aggregate([
        { $match: organizerFilter },
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      Trip.aggregate([
        { $match: organizerFilter },
        { $group: { _id: '$difficulty', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      Trip.aggregate([
        { $match: organizerFilter },
        {
          $group: {
            _id: '$isActive',
            count: { $sum: 1 }
          }
        }
      ]),
      Trip.aggregate([
        { $match: organizerFilter },
        {
          $group: {
            _id: null,
            avgParticipants: { $avg: { $size: '$participants' } }
          }
        }
      ])
    ]);

    return res.json({
      byCategory: byCategory.map(cat => ({ name: cat._id, count: cat.count })),
      byDifficulty: byDifficulty.map(diff => ({ name: diff._id, count: diff.count })),
      byStatus: byStatus.map(status => ({
        name: status._id ? 'Active' : 'Inactive',
        count: status.count
      })),
      averageParticipants: averageParticipants.length > 0
        ? Math.round(averageParticipants[0].avgParticipants)
        : 0,
    });

  } catch (error: any) {
    console.error('❌ Error fetching trip analytics:', error);
    return res.status(500).json({ error: 'Failed to fetch trip analytics' });
  }
});

/**
 * GET /api/analytics/users
 * Get user analytics (Admin only)
 */
router.get('/users', authenticateJwt, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    // Get last 12 months user growth
    const monthlyUsers = [];
    const currentDate = new Date();

    for (let i = 11; i >= 0; i--) {
      const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() - i + 1, 0);

      const [travelers, organizers] = await Promise.all([
        User.countDocuments({
          role: 'traveler',
          createdAt: { $gte: monthStart, $lte: monthEnd }
        }),
        User.countDocuments({
          role: 'organizer',
          createdAt: { $gte: monthStart, $lte: monthEnd }
        })
      ]);

      monthlyUsers.push({
        month: monthStart.toLocaleDateString('en-US', { month: 'short' }),
        travelers,
        organizers,
        total: travelers + organizers,
      });
    }

    const [totalUsers, activeUsers, usersByRole] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ lastActive: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } }),
      User.aggregate([
        { $group: { _id: '$role', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ])
    ]);

    return res.json({
      totalUsers,
      activeUsers,
      usersByRole: usersByRole.map(role => ({ name: role._id, count: role.count })),
      monthlyGrowth: monthlyUsers,
    });

  } catch (error: any) {
    console.error('❌ Error fetching user analytics:', error);
    return res.status(500).json({ error: 'Failed to fetch user analytics' });
  }
});

/**
 * GET /api/analytics/leads
 * Get lead analytics
 */
router.get('/leads', authenticateJwt, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const userRole = (req as any).user?.role;

    const organizerFilter = userRole === 'organizer' ? { organizerId: userId } : {};

    const [
      totalLeads,
      byStatus,
      bySource,
      conversionFunnel
    ] = await Promise.all([
      Lead.countDocuments(organizerFilter),
      Lead.aggregate([
        { $match: organizerFilter },
        { $group: { _id: '$status', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      Lead.aggregate([
        { $match: organizerFilter },
        { $group: { _id: '$source', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      Lead.aggregate([
        { $match: organizerFilter },
        {
          $group: {
            _id: '$score',
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ])
    ]);

    return res.json({
      totalLeads,
      byStatus: byStatus.map(status => ({ name: status._id, count: status.count })),
      bySource: bySource.map(source => ({ name: source._id || 'Direct', count: source.count })),
      conversionFunnel: conversionFunnel.map(stage => ({
        score: stage._id,
        count: stage.count
      })),
    });

  } catch (error: any) {
    console.error('❌ Error fetching lead analytics:', error);
    return res.status(500).json({ error: 'Failed to fetch lead analytics' });
  }
});

/**
 * GET /api/analytics/performance
 * Get platform performance metrics (Admin only)
 */
router.get('/performance', authenticateJwt, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const [
      avgResponseTime,
      systemHealth,
      activeConnections
    ] = await Promise.all([
      // Mock data - implement actual metrics tracking
      Promise.resolve({ avg: 250, unit: 'ms' }),
      Promise.resolve({ status: 'healthy', uptime: '99.9%' }),
      Promise.resolve(156)
    ]);

    return res.json({
      responseTime: avgResponseTime,
      systemHealth,
      activeConnections,
      lastUpdated: new Date(),
    });

  } catch (error: any) {
    console.error('❌ Error fetching performance metrics:', error);
    return res.status(500).json({ error: 'Failed to fetch performance metrics' });
  }
});

/**
 * GET /api/analytics/retention
 * Get user retention cohorts (Admin only)
 */
router.get('/retention', authenticateJwt, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    // 1. Define cohorts by registration month (last 6 months)
    const cohorts: any[] = [];
    const today = new Date();

    for (let i = 5; i >= 0; i--) {
      const monthStart = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const monthEnd = new Date(today.getFullYear(), today.getMonth() - i + 1, 0);

      // Find users registered in this month
      const cohortUsers = await User.find({
        role: 'traveler',
        createdAt: { $gte: monthStart, $lte: monthEnd }
      }).select('_id');

      const cohortSize = cohortUsers.length;
      const userIds = cohortUsers.map(u => u._id);

      const retentionData = {
        month: monthStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        cohortSize,
        retention: [] as number[]
      };

      // 2. For this cohort, calculate participation in subsequent months
      if (cohortSize > 0) {
        // We track up to 3 months of retention for simplicity and performance
        for (let j = 0; j < 4; j++) {
          if (i - j < 0) break; // Don't look into the future

          const activityStart = new Date(today.getFullYear(), today.getMonth() - i + j, 1);
          const activityEnd = new Date(today.getFullYear(), today.getMonth() - i + j + 1, 0);

          // Check if activityStart is in the future
          if (activityStart > today) break;

          // Count distinct users from this cohort who made a booking in this month
          const activeUsersCount = (await GroupBooking.distinct('userId', {
            userId: { $in: userIds },
            createdAt: { $gte: activityStart, $lte: activityEnd }
          })).length;

          const percentage = Math.round((activeUsersCount / cohortSize) * 100);
          retentionData.retention.push(percentage);
        }
      }

      cohorts.push(retentionData);
    }

    res.json(cohorts);
  } catch (error: any) {
    console.error('❌ Error fetching retention analytics:', error);
    res.status(500).json({ error: 'Failed to fetch retention analytics' });
  }
});

/**
 * GET /api/analytics/activity
 * Get activity heatmap data (Admin only)
 */
router.get('/activity', authenticateJwt, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    // Aggregate bookings by day of week and hour of day
    // Using GroupBooking createdAt
    const activityMap = await GroupBooking.aggregate([
      {
        $project: {
          dayOfWeek: { $dayOfWeek: '$createdAt' }, // 1 (Sun) - 7 (Sat)
          hour: { $hour: '$createdAt' } // 0 - 23
        }
      },
      {
        $group: {
          _id: { day: '$dayOfWeek', hour: '$hour' },
          count: { $sum: 1 }
        }
      }
    ]);

    // Transform into consumption-friendly format: 7 days x 24 hours
    const heatmap: any = {
      sunday: new Array(24).fill(0),
      monday: new Array(24).fill(0),
      tuesday: new Array(24).fill(0),
      wednesday: new Array(24).fill(0),
      thursday: new Array(24).fill(0),
      friday: new Array(24).fill(0),
      saturday: new Array(24).fill(0)
    };

    const dayMap = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']; // offset by -1 from mongo result

    activityMap.forEach(item => {
      const dayIndex = item._id.day - 1; // Mongo is 1-indexed (1=Sun)
      if (dayIndex >= 0 && dayIndex < 7) {
        const dayName = dayMap[dayIndex];
        heatmap[dayName][item._id.hour] = item.count;
      }
    });

    res.json(heatmap);
  } catch (error: any) {
    console.error('❌ Error fetching activity analytics:', error);
    res.status(500).json({ error: 'Failed to fetch activity analytics' });
  }
});

/**
 * GET /api/analytics/top-organizers
 * Get top performing organizers (Admin only)
 */
router.get('/top-organizers', authenticateJwt, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    // Aggregate total revenue and bookings per organizer
    const topOrganizers = await GroupBooking.aggregate([
      { $match: { status: 'confirmed' } },
      {
        $lookup: {
          from: 'trips',
          localField: 'tripId',
          foreignField: '_id',
          as: 'trip'
        }
      },
      { $unwind: '$trip' },
      {
        $group: {
          _id: '$trip.organizerId',
          totalRevenue: { $sum: '$totalAmount' },
          totalBookings: { $sum: 1 },
          uniqueCustomers: { $addToSet: '$userId' }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'organizer'
        }
      },
      { $unwind: '$organizer' },
      {
        $project: {
          _id: 1,
          name: '$organizer.name',
          email: '$organizer.email',
          totalRevenue: 1,
          totalBookings: 1,
          customerCount: { $size: '$uniqueCustomers' }
        }
      },
      { $sort: { totalRevenue: -1 } },
      { $limit: 10 }
    ]);

    res.json(topOrganizers);
  } catch (error: any) {
    console.error('❌ Error fetching top organizers:', error);
    res.status(500).json({ error: 'Failed to fetch top organizers' });
  }
});

export default router;
