/**
 * Analytics Service
 *
 * All business logic extracted from routes/analytics.ts.
 * No req/res objects — pure data in, data out.
 */


import { shapeTrips } from '../../services/tripShapeService';
import { User } from '../../models/User';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { toNumber } from '../../lib/money';


// ─── Dashboard ────────────────────────────────────────────────────────────────

export async function getAdminDashboard() {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30);

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
    prisma.trip.count(),
    // `isVerified` and `isActive` are not fields on Trip. Verification is
    // `verificationStatus` and liveness is `status`, so both of these counts
    // have always been zero - the admin dashboard has reported no verified
    // trips and no active upcoming trips since the day it was written.
    prisma.trip.count({ where: { verificationStatus: 'approved' } }),
    prisma.trip.count({ where: { status: 'active', startDate: { gte: new Date() } } }),
    User.countDocuments({ role: 'traveler' }),
    User.countDocuments({ role: 'organizer' }),
    // This has always returned nothing. OrganizerSubscription has no
    // `paymentStatus` field and no `amount` field - the payment values live
    // inside the payments array as payments[].status and payments[].amount, and
    // the total was kept in totalPaid. Mongo answers a match on a field that
    // does not exist with an empty result, so the admin dashboard has been
    // showing total platform revenue as zero for as long as this code existed.
    //
    // Payments are rows now, so this is the sum it was always meant to be.
    prisma.subscriptionPayment.aggregate({
      where: { status: 'completed' },
      _sum: { amount: true },
    }),
    prisma.tripVerification.count({ where: { status: 'pending' } }),
    prisma.lead.count(),
    prisma.lead.count({ where: { status: 'converted' } }),
    // Was { $in: ['open', 'in_progress'] }. Ticket has never had an 'open'
    // status - that value belongs to SupportTicket, a different model with a
    // different lifecycle - so half of this count silently matched nothing.
    // Postgres refuses the value outright, which is how it came to light.
    prisma.ticket.count({ where: { status: { in: ['pending', 'in_progress'] } } }),
    prisma.trip.groupBy({
      by: ['destination'],
      _count: { destination: true },
      orderBy: { _count: { destination: 'desc' } },
      take: 10,
    }),
    // `.populate('organizer')` names a path that does not exist - the field is
    // organizerId - so the populate was a no-op and these trips have never
    // carried an organizer. Nothing in the response read one, which is why it
    // went unnoticed; it is dropped rather than fixed, because adding data
    // nobody asked for is not this wave's job.
    prisma.trip.findMany({
      where: { createdAt: { gte: startDate, lte: endDate } },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
    prisma.trip.count({ where: { createdAt: { gte: startDate } } }),
  ]);

  const lastMonthStart = new Date();
  lastMonthStart.setDate(lastMonthStart.getDate() - 60);
  lastMonthStart.setDate(1);
  const lastMonthEnd = new Date(lastMonthStart);
  lastMonthEnd.setMonth(lastMonthEnd.getMonth() + 1);
  lastMonthEnd.setDate(0);

  const lastMonthTrips = await prisma.trip.count({
    where: { createdAt: { gte: lastMonthStart, lte: lastMonthEnd } },
  });

  const conversionRate = totalLeads > 0 ? (convertedLeads / totalLeads) * 100 : 0;
  const platformRevenue = toNumber(totalRevenue._sum.amount);
  const avgBookingValue = totalOrganizers > 0 ? platformRevenue / totalOrganizers : 0;
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
      revenueThisMonth: platformRevenue,
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
    // `organizer` is not a field either; it is organizerId. Two more counts
    // that have always been zero, on the organizer's own analytics page.
    prisma.trip.count({ where: { organizerId: userId } }),
    prisma.trip.count({ where: { organizerId: userId, status: 'active' } }),
    prisma.lead.count({ where: { assignedTo: userId } }),
    prisma.lead.count({ where: { assignedTo: userId, status: 'converted' } }),
    prisma.ticket.count({ where: { requesterId: userId } }),
    // Also always zero, for a second reason: organizerId is an ObjectId and
    // userId is a string. A find() would have cast it using the schema; an
    // aggregate $match does not cast, so it compared a string to an ObjectId
    // and matched nothing. Both columns are strings here.
    prisma.subscriptionPayment.aggregate({
      where: { status: 'completed', subscription: { organizerId: userId } },
      _sum: { amount: true },
    }),
    prisma.organizerSubscription.findFirst({
      where: { organizerId: userId, status: { in: ['active', 'trial'] } },
    }),
  ]);

  const conversionRate = myLeads > 0 ? (myConvertedLeads / myLeads) * 100 : 0;

  return {
    overview: {
      totalTrips: myTrips,
      activeTrips: myActiveTrips,
      totalRevenue: toNumber(myRevenue._sum.amount),
      conversionRate: Math.round(conversionRate * 100) / 100,
    },
    subscription: mySubscription
      ? {
          plan: mySubscription.plan,
          tripsRemaining: Math.max(0, mySubscription.tripsPerCycle - mySubscription.tripsUsed),
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
    prisma.trip.count({ where: { participants: { some: { userId } } } }),
    prisma.trip.count({
      where: { participants: { some: { userId } }, startDate: { gte: new Date() } },
    }),
    prisma.supportTicket.count({ where: { userId } }),
  ]);

  const recentTrips = await prisma.trip.findMany({
    where: { participants: { some: { userId } } },
    orderBy: { startDate: 'desc' },
    take: 5,
    select: { id: true, title: true, startDate: true, destination: true },
  });

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

    // The month is the month the payment was made, not the month the
    // subscription happened to be created. The Mongoose version matched
    // subscription.createdAt and summed totalPaid, which would have credited
    // every renewal to the month the organizer first signed up - but it also
    // matched 'payments.status' against a nested path while grouping a
    // top-level field, and returned nothing at all, so there is no established
    // behaviour here to preserve.
    const where: any = {
      status: 'completed' as const,
      paymentDate: { gte: monthStart, lte: monthEnd },
    };
    if (userRole !== 'admin') {
      where.subscription = { organizerId: userId };
    }

    const revenue = await prisma.subscriptionPayment.aggregate({
      where,
      _sum: { amount: true },
    });

    monthlyRevenue.push({
      month: monthStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      revenue: toNumber(revenue._sum.amount),
    });
  }

  return {
    monthlyRevenue,
    totalRevenue: monthlyRevenue.reduce((sum, month) => sum + month.revenue, 0),
  };
}

// ─── Trips ────────────────────────────────────────────────────────────────────

export async function getTripAnalytics(userId: string, userRole: string) {
  // Three things were wrong with this and each of them returned something that
  // looked like an answer:
  //
  //   - `{ organizer: userId }` names a field that does not exist (organizerId),
  //     so an organizer's own analytics were computed over every trip on the
  //     platform rather than theirs.
  //   - `$group: { _id: '$category' }` - the field is `categories`, and it is an
  //     array - so every trip grouped under null and byCategory was one bucket.
  //   - `$group: { _id: '$isActive' }` - no such field either, so byStatus was
  //     also a single null bucket.
  const organizerFilter = userRole === 'organizer' ? { organizerId: userId } : {};

  const [categoryRows, byDifficultyRows, byStatusRows, participantAgg] = await Promise.all([
    // categories is an array, so the grouping needs unnest - one row per
    // category per trip, which is what $unwind would have done had the field
    // name been right.
    prisma.$queryRaw<Array<{ category: string; count: bigint }>>`
      SELECT unnest(categories) AS category, count(*) AS count
        FROM trips
       WHERE ${userRole === 'organizer' ? Prisma.sql`organizer_id = ${userId}` : Prisma.sql`true`}
       GROUP BY 1
       ORDER BY count DESC
    `,
    prisma.trip.groupBy({
      by: ['difficulty'],
      where: organizerFilter,
      _count: { difficulty: true },
      orderBy: { _count: { difficulty: 'desc' } },
    }),
    prisma.trip.groupBy({
      by: ['status'],
      where: organizerFilter,
      _count: { status: true },
    }),
    prisma.tripParticipant.count({ where: { trip: organizerFilter } }),
  ]);

  const tripCount = await prisma.trip.count({ where: organizerFilter });

  const byCategory = categoryRows.map(r => ({ _id: r.category, count: Number(r.count) }));
  const byDifficulty = byDifficultyRows.map(r => ({ _id: r.difficulty, count: r._count.difficulty }));
  const byStatus = byStatusRows.map(r => ({ _id: r.status, count: r._count.status }));
  const averageParticipants = [
    { avgParticipants: tripCount > 0 ? participantAgg / tripCount : 0 },
  ];

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
  // Was { organizerId: userId }. Lead has no organizerId - the column is
  // assignedTo - so this matched nothing and an organizer saw empty analytics.
  const organizerFilter: Prisma.LeadWhereInput =
    userRole === 'organizer' ? { assignedTo: userId } : {};

  const [totalLeads, byStatus, bySource, conversionFunnel] = await Promise.all([
    prisma.lead.count({ where: organizerFilter }),
    prisma.lead.groupBy({ by: ['status'], where: organizerFilter, _count: { status: true } }),
    prisma.lead.groupBy({ by: ['source'], where: organizerFilter, _count: { source: true } }),
    // Was grouped by '$score'. Lead has no such field - it is leadScore - so this
    // put every lead in one null bucket and the funnel rendered a single bar.
    prisma.lead.groupBy({ by: ['leadScore'], where: organizerFilter, _count: { leadScore: true } }),
  ]);

  return {
    totalLeads,
    byStatus: byStatus
      .map((s: any) => ({ name: s.status, count: s._count.status }))
      .sort((a: any, b: any) => b.count - a.count),
    bySource: bySource
      .map((s: any) => ({ name: s.source || 'Direct', count: s._count.source }))
      .sort((a: any, b: any) => b.count - a.count),
    conversionFunnel: conversionFunnel
      .map((stage: any) => ({ score: stage.leadScore, count: stage._count.leadScore }))
      .sort((a: any, b: any) => a.score - b.score),
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

        // GroupBooking has no `userId` - the booker is `mainBookerId` - so this
        // matched nothing and every retention percentage was zero.
        const activeUsers = await prisma.groupBooking.findMany({
          where: {
            mainBookerId: { in: userIds },
            createdAt: { gte: activityStart, lte: activityEnd },
          },
          distinct: ['mainBookerId'],
          select: { mainBookerId: true },
        });
        const activeUsersCount = activeUsers.length;

        retentionData.retention.push(Math.round((activeUsersCount / cohortSize) * 100));
      }
    }

    cohorts.push(retentionData);
  }

  return cohorts;
}

// ─── Activity heatmap ─────────────────────────────────────────────────────────

export async function getActivityHeatmap() {
  // Was $project with $dayOfWeek and $hour, then a $group on the pair. Postgres
  // has extract(), and Prisma cannot group by a computed expression, so this is
  // one raw statement. dow is 0-6 with Sunday at 0; Mongo's $dayOfWeek is 1-7
  // with Sunday at 1, and the mapping below subtracts one - so the +1 keeps
  // that mapping unchanged rather than adjusting two places at once.
  const heatmapRows = await prisma.$queryRaw<Array<{ day: number; hour: number; count: bigint }>>`
    SELECT extract(dow  FROM created_at)::int + 1 AS day,
           extract(hour FROM created_at)::int     AS hour,
           count(*)                               AS count
      FROM group_bookings
     GROUP BY 1, 2
  `;

  const activityMap = heatmapRows.map(r => ({
    _id: { day: r.day, hour: r.hour },
    count: Number(r.count),
  }));

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

/**
 * Was one pipeline: match confirmed bookings, $lookup the trip, group by its
 * organizer, $lookup the user, project.
 *
 * The match was `{ status: 'confirmed' }` and GroupBooking has no `status`
 * field - it has bookingStatus - so this list has always been empty. The
 * $addToSet on `$userId` had the same problem: the booker is mainBookerId, so
 * customerCount would have been zero even if the match had worked.
 *
 * The trip join is a real join now. The user join is not, because users are
 * still Mongo documents, so the names are fetched after the ranking.
 */
export async function getTopOrganizers() {
  const bookings = await prisma.groupBooking.findMany({
    where: { bookingStatus: 'confirmed' },
    select: { totalAmount: true, mainBookerId: true, trip: { select: { organizerId: true } } },
  });

  const perOrganizer = new Map<
    string,
    { totalRevenue: number; totalBookings: number; customers: Set<string> }
  >();

  for (const booking of bookings) {
    const organizerId = booking.trip?.organizerId;
    if (!organizerId) continue;

    const entry =
      perOrganizer.get(organizerId) ??
      { totalRevenue: 0, totalBookings: 0, customers: new Set<string>() };

    entry.totalRevenue += toNumber(booking.totalAmount);
    entry.totalBookings += 1;
    entry.customers.add(booking.mainBookerId);
    perOrganizer.set(organizerId, entry);
  }

  const ranked = Array.from(perOrganizer.entries())
    .sort((a, b) => b[1].totalRevenue - a[1].totalRevenue)
    .slice(0, 10);

  const organizerDocs = await User.find(
    { _id: { $in: ranked.map(([id]) => id) } },
    'name email'
  ).lean();
  const organizerById = new Map(organizerDocs.map((u: any) => [u._id.toString(), u]));

  return ranked.map(([organizerId, totals]) => ({
    _id: organizerId,
    name: organizerById.get(organizerId)?.name,
    email: organizerById.get(organizerId)?.email,
    totalRevenue: totals.totalRevenue,
    totalBookings: totals.totalBookings,
    customerCount: totals.customers.size,
  }));
}