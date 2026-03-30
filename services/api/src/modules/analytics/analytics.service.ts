/**
 * Analytics Service
 *
 * All business logic extracted from routes/analytics.ts.
 * No req/res objects — pure data in, data out.
 */

import { SupportTicket } from '../../models/SupportTicket';
import { Trip } from '../../models/Trip';
import { User } from '../../models/User';
import { OrganizerSubscription } from '../../models/OrganizerSubscription';
import Lead from '../../models/Lead';
import Ticket from '../../models/Ticket';
import TripVerification from '../../models/TripVerification';
import { GroupBooking } from '../../models/GroupBooking';

// ─── Dashboard ────────────────────────────────────────────────────────────────

export async function getAdminDashboard() {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30);
  const dateFilter = { createdAt: { $gte: startDate, $lte: endDate } };

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
    recentTrips,
    currentMonthTrips,
  ] = await Promise.all([
    Trip.countDocuments(),
    Trip.countDocuments({ isVerified: true }),
    Trip.countDocuments({ isActive: true, startDate: { $gte: new Date() } }),
    User.countDocuments({ role: 'traveler' }),
    User.countDocuments({ role: 'organizer' }),
    OrganizerSubscription.aggregate([
      { $match: { paymentStatus: 'completed' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
    TripVerification.countDocuments({ status: 'pending' }),
    Lead.countDocuments(),
    Lead.countDocuments({ status: 'converted' }),
    Ticket.countDocuments({ status: { $in: ['open', 'in_progress'] } }),
    Trip.aggregate([
      { $group: { _id: '$destination', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]),
    Trip.find(dateFilter).sort({ createdAt: -1 }).limit(5).populate('organizer', 'name email'),
    Trip.countDocuments({ createdAt: { $gte: startDate } }),
  ]);

  const lastMonthStart = new Date();
  lastMonthStart.setDate(lastMonthStart.getDate() - 60);
  lastMonthStart.setDate(1);
  const lastMonthEnd = new Date(lastMonthStart);
  lastMonthEnd.setMonth(lastMonthEnd.getMonth() + 1);
  lastMonthEnd.setDate(0);

  const lastMonthTrips = await Trip.countDocuments({
    createdAt: { $gte: lastMonthStart, $lte: lastMonthEnd },
  });

  const conversionRate = totalLeads > 0 ? (convertedLeads / totalLeads) * 100 : 0;
  const avgBookingValue = totalRevenue.length > 0 ? totalRevenue[0].total / totalOrganizers : 0;
  const monthlyGrowth =
    lastMonthTrips > 0 ? ((currentMonthTrips - lastMonthTrips) / lastMonthTrips) * 100 : 0;

  return {
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
      responseTime: '2.5 hours',
    },
    topDestinations: topDestinations.map((dest: any) => ({ name: dest._id, count: dest.count })),
    recentActivity: recentTrips.map((trip: any) => ({
      id: trip._id,
      name: trip.name || trip.title || 'Untitled Trip',
      organizer: trip.organizerId?.name || 'Unknown',
      createdAt: trip.createdAt,
    })),
  };
}

export async function getOrganizerDashboard(userId: string) {
  const [
    myTrips,
    myActiveTrips,
    myLeads,
    myConvertedLeads,
    myTickets,
    myRevenue,
    mySubscription,
  ] = await Promise.all([
    Trip.countDocuments({ organizer: userId }),
    Trip.countDocuments({ organizer: userId, isActive: true }),
    Lead.countDocuments({ assignedTo: userId }),
    Lead.countDocuments({ assignedTo: userId, status: 'converted' }),
    Ticket.countDocuments({ userId }),
    OrganizerSubscription.aggregate([
      { $match: { organizerId: userId, 'payments.status': 'completed' } },
      { $group: { _id: null, total: { $sum: '$totalPaid' } } },
    ]),
    OrganizerSubscription.findOne({ organizerId: userId, status: { $in: ['active', 'trial'] } }),
  ]);

  const conversionRate = myLeads > 0 ? (myConvertedLeads / myLeads) * 100 : 0;

  return {
    overview: {
      totalTrips: myTrips,
      activeTrips: myActiveTrips,
      totalRevenue: myRevenue.length > 0 ? myRevenue[0].total : 0,
      conversionRate: Math.round(conversionRate * 100) / 100,
    },
    subscription: mySubscription
      ? {
          plan: mySubscription.plan,
          tripsRemaining: mySubscription.tripsRemaining,
          expiryDate: mySubscription.subscriptionEndDate || mySubscription.trialEndDate,
          daysLeft: Math.ceil(
            (((mySubscription.subscriptionEndDate || mySubscription.trialEndDate) as Date).getTime() -
              Date.now()) /
              (1000 * 60 * 60 * 24)
          ),
        }
      : null,
    leads: {
      total: myLeads,
      converted: myConvertedLeads,
      conversionRate: Math.round(conversionRate * 100) / 100,
    },
    engagement: {
      views: 0,
      bookings: 0,
      inquiries: myLeads,
    },
    support: {
      tickets: myTickets,
    },
  };
}

export async function getTravelerDashboard(userId: string) {
  const [tripsJoined, upcomingTrips, myTickets] = await Promise.all([
    Trip.countDocuments({ participants: userId }),
    Trip.countDocuments({ participants: userId, startDate: { $gte: new Date() } }),
    SupportTicket.countDocuments({ userId }),
  ]);

  const recentTrips = await Trip.find({ participants: userId })
    .sort({ startDate: -1 })
    .limit(5)
    .select('title startDate destination');

  return {
    overview: {
      tripsJoined,
      upcomingTrips,
      openTickets: myTickets,
    },
    recentTrips: recentTrips.map((t: any) => ({
      id: t._id,
      title: t.title,
      startDate: t.startDate,
      destination: t.destination,
    })),
  };
}

// ─── Revenue ──────────────────────────────────────────────────────────────────

export async function getRevenueAnalytics(userId: string, userRole: string) {
  const monthlyRevenue = [];
  const currentDate = new Date();

  for (let i = 11; i >= 0; i--) {
    const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
    const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() - i + 1, 0);

    const matchFilter =
      userRole === 'admin'
        ? { 'payments.status': 'completed', createdAt: { $gte: monthStart, $lte: monthEnd } }
        : { organizerId: userId, 'payments.status': 'completed', createdAt: { $gte: monthStart, $lte: monthEnd } };

    const revenue = await OrganizerSubscription.aggregate([
      { $match: matchFilter },
      { $group: { _id: null, total: { $sum: '$totalPaid' } } },
    ]);

    monthlyRevenue.push({
      month: monthStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      revenue: revenue.length > 0 ? revenue[0].total : 0,
    });
  }

  return {
    monthlyRevenue,
    totalRevenue: monthlyRevenue.reduce((sum, month) => sum + month.revenue, 0),
  };
}

// ─── Trips ────────────────────────────────────────────────────────────────────

export async function getTripAnalytics(userId: string, userRole: string) {
  const organizerFilter = userRole === 'organizer' ? { organizer: userId } : {};

  const [byCategory, byDifficulty, byStatus, averageParticipants] = await Promise.all([
    Trip.aggregate([
      { $match: organizerFilter },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    Trip.aggregate([
      { $match: organizerFilter },
      { $group: { _id: '$difficulty', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    Trip.aggregate([
      { $match: organizerFilter },
      { $group: { _id: '$isActive', count: { $sum: 1 } } },
    ]),
    Trip.aggregate([
      { $match: organizerFilter },
      { $group: { _id: null, avgParticipants: { $avg: { $size: '$participants' } } } },
    ]),
  ]);

  return {
    byCategory: byCategory.map((cat: any) => ({ name: cat._id, count: cat.count })),
    byDifficulty: byDifficulty.map((diff: any) => ({ name: diff._id, count: diff.count })),
    byStatus: byStatus.map((status: any) => ({
      name: status._id ? 'Active' : 'Inactive',
      count: status.count,
    })),
    averageParticipants:
      averageParticipants.length > 0 ? Math.round(averageParticipants[0].avgParticipants) : 0,
  };
}

// ─── Users ────────────────────────────────────────────────────────────────────

export async function getUserGrowthAnalytics() {
  const monthlyUsers = [];
  const currentDate = new Date();

  for (let i = 11; i >= 0; i--) {
    const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
    const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() - i + 1, 0);

    const [travelers, organizers] = await Promise.all([
      User.countDocuments({ role: 'traveler', createdAt: { $gte: monthStart, $lte: monthEnd } }),
      User.countDocuments({ role: 'organizer', createdAt: { $gte: monthStart, $lte: monthEnd } }),
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
      { $sort: { count: -1 } },
    ]),
  ]);

  return {
    totalUsers,
    activeUsers,
    usersByRole: usersByRole.map((role: any) => ({ name: role._id, count: role.count })),
    monthlyGrowth: monthlyUsers,
  };
}

// ─── Leads ────────────────────────────────────────────────────────────────────

export async function getLeadAnalytics(userId: string, userRole: string) {
  const organizerFilter = userRole === 'organizer' ? { organizerId: userId } : {};

  const [totalLeads, byStatus, bySource, conversionFunnel] = await Promise.all([
    Lead.countDocuments(organizerFilter),
    Lead.aggregate([
      { $match: organizerFilter },
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    Lead.aggregate([
      { $match: organizerFilter },
      { $group: { _id: '$source', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    Lead.aggregate([
      { $match: organizerFilter },
      { $group: { _id: '$score', count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
  ]);

  return {
    totalLeads,
    byStatus: byStatus.map((s: any) => ({ name: s._id, count: s.count })),
    bySource: bySource.map((s: any) => ({ name: s._id || 'Direct', count: s.count })),
    conversionFunnel: conversionFunnel.map((stage: any) => ({ score: stage._id, count: stage.count })),
  };
}

// ─── Performance ──────────────────────────────────────────────────────────────

export async function getPlatformPerformance() {
  return {
    responseTime: { avg: 250, unit: 'ms' },
    systemHealth: { status: 'healthy', uptime: '99.9%' },
    activeConnections: 156,
    lastUpdated: new Date(),
  };
}

// ─── Retention ────────────────────────────────────────────────────────────────

export async function getRetentionCohorts() {
  const cohorts: any[] = [];
  const today = new Date();

  for (let i = 5; i >= 0; i--) {
    const monthStart = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() - i + 1, 0);

    const cohortUsers = await User.find({
      role: 'traveler',
      createdAt: { $gte: monthStart, $lte: monthEnd },
    }).select('_id');

    const cohortSize = cohortUsers.length;
    const userIds = cohortUsers.map((u: any) => u._id);

    const retentionData: any = {
      month: monthStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      cohortSize,
      retention: [] as number[],
    };

    if (cohortSize > 0) {
      for (let j = 0; j < 4; j++) {
        if (i - j < 0) break;
        const activityStart = new Date(today.getFullYear(), today.getMonth() - i + j, 1);
        const activityEnd = new Date(today.getFullYear(), today.getMonth() - i + j + 1, 0);
        if (activityStart > today) break;

        const activeUsersCount = (
          await GroupBooking.distinct('userId', {
            userId: { $in: userIds },
            createdAt: { $gte: activityStart, $lte: activityEnd },
          })
        ).length;

        retentionData.retention.push(Math.round((activeUsersCount / cohortSize) * 100));
      }
    }

    cohorts.push(retentionData);
  }

  return cohorts;
}

// ─── Activity heatmap ─────────────────────────────────────────────────────────

export async function getActivityHeatmap() {
  const activityMap = await GroupBooking.aggregate([
    {
      $project: {
        dayOfWeek: { $dayOfWeek: '$createdAt' },
        hour: { $hour: '$createdAt' },
      },
    },
    {
      $group: {
        _id: { day: '$dayOfWeek', hour: '$hour' },
        count: { $sum: 1 },
      },
    },
  ]);

  const heatmap: any = {
    sunday: new Array(24).fill(0),
    monday: new Array(24).fill(0),
    tuesday: new Array(24).fill(0),
    wednesday: new Array(24).fill(0),
    thursday: new Array(24).fill(0),
    friday: new Array(24).fill(0),
    saturday: new Array(24).fill(0),
  };

  const dayMap = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

  activityMap.forEach((item: any) => {
    const dayIndex = item._id.day - 1;
    if (dayIndex >= 0 && dayIndex < 7) {
      heatmap[dayMap[dayIndex]][item._id.hour] = item.count;
    }
  });

  return heatmap;
}

// ─── Top organizers ───────────────────────────────────────────────────────────

export async function getTopOrganizers() {
  return GroupBooking.aggregate([
    { $match: { status: 'confirmed' } },
    {
      $lookup: {
        from: 'trips',
        localField: 'tripId',
        foreignField: '_id',
        as: 'trip',
      },
    },
    { $unwind: '$trip' },
    {
      $group: {
        _id: '$trip.organizerId',
        totalRevenue: { $sum: '$totalAmount' },
        totalBookings: { $sum: 1 },
        uniqueCustomers: { $addToSet: '$userId' },
      },
    },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'organizer',
      },
    },
    { $unwind: '$organizer' },
    {
      $project: {
        _id: 1,
        name: '$organizer.name',
        email: '$organizer.email',
        totalRevenue: 1,
        totalBookings: 1,
        customerCount: { $size: '$uniqueCustomers' },
      },
    },
    { $sort: { totalRevenue: -1 } },
    { $limit: 10 },
  ]);
}
