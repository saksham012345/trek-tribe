import { Router } from 'express';
import { authenticateJwt, requireRole } from '../middleware/auth';
import { User } from '../models/User';
import { shapeTrip, shapeTrips } from '../services/tripShapeService';
import { shapeBooking } from '../services/bookingShapeService';
import { toNumber } from '../lib/money';
import { prisma } from '../lib/prisma';
import { remainingTrips } from '../services/crmSubscriptionService';
import { logger } from '../utils/logger';

const router = Router();

/**
 * Attach the organizer that .populate('organizerId') used to supply.
 *
 * Trips are Postgres rows and users are still Mongo documents, so this is a
 * second query rather than a join - one for the whole page, not one per trip.
 */
async function withOrganizers(rows: any[], select: string): Promise<any[]> {
  if (rows.length === 0) return [];
  const ids = Array.from(new Set(rows.map(r => r.organizerId)));
  const users = await User.find({ _id: { $in: ids } }, select).lean();
  const byId = new Map(users.map((u: any) => [u._id.toString(), u]));
  return rows.map(row => {
    const trip = shapeTrip(row);
    trip.organizerId = byId.get(row.organizerId) ?? row.organizerId;
    return trip;
  });
}

/** The same, for the main booker on a list of bookings. */
async function withBookers(rows: any[], select: string): Promise<any[]> {
  if (rows.length === 0) return [];
  const ids = Array.from(new Set(rows.map(r => r.mainBookerId)));
  const users = await User.find({ _id: { $in: ids } }, select).lean();
  const byId = new Map(users.map((u: any) => [u._id.toString(), u]));
  return rows.map(row => {
    const booking: any = shapeBooking(row);
    booking.tripId = row.trip ? shapeTrip(row.trip) : row.tripId;
    booking.mainBookerId = byId.get(row.mainBookerId) ?? row.mainBookerId;
    return booking;
  });
}

/**
 * Get comprehensive organizer dashboard
 */
router.get('/organizer', authenticateJwt, requireRole(['organizer']), async (req, res) => {
  try {
    const organizerId = (req as any).auth.userId;

    // Get user profile with auto-pay status
    const user = await User.findById(organizerId).select('-passwordHash');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get subscription status
    const subscription = await prisma.cRMSubscription.findFirst({ where: { organizerId } });

    // Get trip statistics
    const [
      totalTrips,
      activeTrips,
      draftTrips,
      completedTrips,
      upcomingTrips
    ] = await Promise.all([
      prisma.trip.count({ where: { organizerId } }),
      prisma.trip.count({ where: { organizerId, status: 'active' } }),
      // 'draft' is not one of the four statuses a trip can have - they are
      // pending, active, cancelled and completed - so this count has always
      // been zero and the organizer's dashboard has always shown no drafts.
      // Postgres will not accept the value at all, so it is answered with the
      // zero it was already returning rather than a query that cannot run.
      Promise.resolve(0),
      prisma.trip.count({ where: { organizerId, status: 'completed' } }),
      prisma.trip.count({
        where: { organizerId, status: 'active', startDate: { gte: new Date() } }
      })
    ]);

    // Get recent trips
    const recentTripRows = await prisma.trip.findMany({
      where: { organizerId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { participants: { select: { userId: true } } }
    });
    const recentTrips = shapeTrips(recentTripRows as any);

    // Booking statistics. `trip: { organizerId }` is the same filter as the
    // list of trip ids the counts used to be given, so the extra query that
    // fetched every id is gone.
    const byOrganizer = { trip: { organizerId } };

    const [
      totalBookings,
      pendingVerifications,
      confirmedBookings,
      cancelledBookings,
      todayBookings
    ] = await Promise.all([
      prisma.groupBooking.count({ where: byOrganizer }),
      prisma.groupBooking.count({
        where: { ...byOrganizer, paymentVerificationStatus: 'pending' }
      }),
      prisma.groupBooking.count({ where: { ...byOrganizer, bookingStatus: 'confirmed' } }),
      prisma.groupBooking.count({ where: { ...byOrganizer, bookingStatus: 'cancelled' } }),
      prisma.groupBooking.count({
        where: {
          ...byOrganizer,
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
            lt: new Date(new Date().setHours(23, 59, 59, 999))
          }
        }
      })
    ]);

    // Get recent bookings
    const recentBookingRows = await prisma.groupBooking.findMany({
      where: byOrganizer,
      include: { trip: true },
      orderBy: { createdAt: 'desc' },
      take: 5
    });

    const recentBookerIds = Array.from(new Set(recentBookingRows.map(b => b.mainBookerId)));
    const recentBookers = recentBookerIds.length
      ? await User.find({ _id: { $in: recentBookerIds } }, 'name email').lean()
      : [];
    const recentBookerById = new Map(recentBookers.map((u: any) => [u._id.toString(), u]));

    const recentBookings = recentBookingRows.map(row => {
      const booking: any = shapeBooking(row);
      booking.tripId = row.trip;
      booking.mainBookerId = recentBookerById.get(row.mainBookerId) ?? row.mainBookerId;
      return booking;
    });

    // Total and month-to-date revenue. The $cond inside the $sum was summing
    // finalAmount conditionally in one pass; two aggregates say the same thing
    // and neither needs the condition spelled out as an expression tree.
    const startOfMonth = new Date(new Date().setDate(1));
    const [totalRevenueAgg, monthlyRevenueAgg] = await Promise.all([
      prisma.groupBooking.aggregate({
        where: { ...byOrganizer, bookingStatus: 'confirmed' },
        _sum: { finalAmount: true }
      }),
      prisma.groupBooking.aggregate({
        where: { ...byOrganizer, bookingStatus: 'confirmed', createdAt: { gte: startOfMonth } },
        _sum: { finalAmount: true }
      })
    ]);

    const revenue = {
      total: toNumber(totalRevenueAgg._sum.finalAmount),
      monthly: toNumber(monthlyRevenueAgg._sum.finalAmount)
    };

    // Was $size over the participants array; it is a count of rows.
    const totalParticipants = await prisma.tripParticipant.count({
      where: { trip: { organizerId } }
    });

    // Auto-pay status
    const autoPayStatus = user.organizerProfile?.autoPay ? {
      isSetupRequired: user.organizerProfile.autoPay.isSetupRequired,
      isSetupCompleted: user.organizerProfile.autoPay.isSetupCompleted,
      autoPayEnabled: user.organizerProfile.autoPay.autoPayEnabled,
      scheduledPaymentDate: user.organizerProfile.autoPay.scheduledPaymentDate,
      nextPaymentDate: user.organizerProfile.autoPay.nextPaymentDate,
      paymentAmount: user.organizerProfile.autoPay.paymentAmount
    } : null;

    // Subscription info
    // The three nested objects are columns now; the response keeps the shape
    // the dashboard reads.
    const subscriptionInfo = subscription ? {
      planType: subscription.planType,
      status: subscription.status,
      tripPackage: {
        packageType: subscription.packageType.replace(/^trips_(\d+)$/, '$1_trips'),
        totalTrips: subscription.totalTrips,
        usedTrips: subscription.usedTrips,
        remainingTrips: remainingTrips(subscription),
        pricePerPackage: Number(subscription.pricePerPackage)
      },
      crmBundle: {
        hasAccess: subscription.crmBundleHasAccess,
        price: Number(subscription.crmBundlePrice),
        features: subscription.crmBundleFeatures
      },
      trial: {
        isActive: subscription.trialIsActive,
        startDate: subscription.trialStartDate,
        endDate: subscription.trialEndDate,
        monthsRemaining: subscription.trialMonthsRemaining
      }
    } : null;

    // Profile completeness
    let profileCompleteness = 0;
    const profileFields = ['name', 'email', 'phone', 'profilePhoto', 'bio'];
    profileFields.forEach(field => {
      if ((user as any)[field]) profileCompleteness += 20;
    });

    // Alerts & notifications
    const alerts = [];

    if (pendingVerifications > 0) {
      alerts.push({
        type: 'warning',
        message: `${pendingVerifications} booking${pendingVerifications > 1 ? 's' : ''} awaiting payment verification`,
        action: '/organizer/pending-verifications',
        priority: 'high'
      });
    }

    if (autoPayStatus && !autoPayStatus.isSetupCompleted) {
      alerts.push({
        type: 'error',
        message: 'Auto-pay setup required to continue creating trips',
        action: '/auto-pay/setup',
        priority: 'critical'
      });
    }

    if (!user.phoneVerified) {
      alerts.push({
        type: 'warning',
        message: 'Please verify your phone number',
        action: '/verify-phone',
        priority: 'high'
      });
    }

    const slotsLeft = subscription ? remainingTrips(subscription) : 0;
    if (subscription && slotsLeft <= 2) {
      alerts.push({
        type: 'info',
        message: `Only ${slotsLeft} trip listing${slotsLeft > 1 ? 's' : ''} remaining`,
        action: '/subscription/purchase',
        priority: 'medium'
      });
    }

    // Quick actions
    const quickActions = [
      { label: 'Create New Trip', icon: 'plus', action: '/trips/create', color: 'primary' },
      { label: 'View Pending Verifications', icon: 'clock', action: '/organizer/pending-verifications', badge: pendingVerifications, color: 'warning' },
      { label: 'Manage Bookings', icon: 'calendar', action: '/organizer/bookings', color: 'info' },
      { label: 'View Analytics', icon: 'chart', action: '/analytics', color: 'success' }
    ];

    const dashboard = {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        phoneVerified: user.phoneVerified,
        profilePhoto: user.profilePhoto,
        role: user.role,
        profileCompleteness
      },
      summary: {
        trips: {
          total: totalTrips,
          active: activeTrips,
          draft: draftTrips,
          completed: completedTrips,
          upcoming: upcomingTrips
        },
        bookings: {
          total: totalBookings,
          pendingVerifications,
          confirmed: confirmedBookings,
          cancelled: cancelledBookings,
          today: todayBookings
        },
        participants: {
          total: totalParticipants
        },
        revenue
      },
      recentTrips: recentTrips.map(trip => ({
        id: trip._id,
        title: trip.title,
        destination: trip.destination,
        status: trip.status,
        startDate: trip.startDate,
        endDate: trip.endDate,
        capacity: trip.capacity,
        currentParticipants: trip.participants.length,
        image: trip.images?.[0] || null
      })),
      recentBookings: recentBookings.map(booking => ({
        id: booking._id,
        tripTitle: (booking.tripId as any)?.title || 'Unknown Trip',
        travelerName: (booking.mainBookerId as any)?.name || 'Unknown',
        travelerEmail: (booking.mainBookerId as any)?.email,
        numberOfGuests: booking.numberOfGuests,
        amount: booking.finalAmount,
        status: booking.bookingStatus,
        paymentStatus: booking.paymentVerificationStatus,
        createdAt: booking.createdAt
      })),
      subscription: subscriptionInfo,
      autoPay: autoPayStatus,
      alerts,
      quickActions
    };

    res.json(dashboard);
  } catch (error: any) {
    logger.error('Error fetching organizer dashboard', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

/**
 * Get comprehensive agent dashboard
 */
router.get('/agent', authenticateJwt, requireRole(['agent', 'admin']), async (req, res) => {
  try {
    const agentId = (req as any).auth.userId;

    const user = await User.findById(agentId).select('-passwordHash');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get today's statistics
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get all users statistics
    const [
      totalUsers,
      totalOrganizers,
      totalTravelers,
      newUsersToday,
      verifiedOrganizers,
      unverifiedOrganizers
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: 'organizer' }),
      User.countDocuments({ role: 'traveler' }),
      User.countDocuments({ createdAt: { $gte: today, $lt: tomorrow } }),
      User.countDocuments({ role: 'organizer', isVerified: true }),
      User.countDocuments({ role: 'organizer', isVerified: false })
    ]);

    // Get all trips statistics
    const [
      totalTrips,
      activeTrips,
      pendingTrips,
      completedTrips,
      tripsToday
    ] = await Promise.all([
      prisma.trip.count(),
      prisma.trip.count({ where: { status: 'active' } }),
      prisma.trip.count({ where: { status: 'pending' } }),
      prisma.trip.count({ where: { status: 'completed' } }),
      prisma.trip.count({ where: { createdAt: { gte: today, lt: tomorrow } } })
    ]);

    // Get all bookings statistics
    const [
      totalBookings,
      pendingBookings,
      confirmedBookings,
      bookingsToday
    ] = await Promise.all([
      prisma.groupBooking.count(),
      prisma.groupBooking.count({ where: { bookingStatus: 'pending' } }),
      prisma.groupBooking.count({ where: { bookingStatus: 'confirmed' } }),
      prisma.groupBooking.count({ where: { createdAt: { gte: today, lt: tomorrow } } })
    ]);

    // Get recent users
    const recentUsers = await User.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .select('name email role createdAt isVerified phoneVerified')
      .lean();

    // Get recent trips
    const recentTripRows = await prisma.trip.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10
    });
    const recentTrips = await withOrganizers(recentTripRows, 'name email');

    // Get pending verifications. tripId was a populate and is a join now; the
    // booker is still a Mongo document.
    const pendingRows = await prisma.groupBooking.findMany({
      where: { paymentVerificationStatus: 'pending' },
      include: { trip: true },
      orderBy: { createdAt: 'desc' },
      take: 10
    });
    const pendingVerifications = await withBookers(pendingRows, 'name email');

    // Get subscriptions requiring attention
    // "One trip or fewer left" compares two columns, which Prisma's where cannot
    // express, so it is written as SQL. It was a dotted path into a nested
    // object holding a third number that the other two already determined -
    // and that number was only correct while the application kept it so.
    //
    // populate('organizerId') is gone; the organizer names are fetched below,
    // because User is still a Mongo document.
    const subscriptions = await prisma.$queryRaw<Array<{
      id: string; organizer_id: string; plan_type: string; status: string;
      total_trips: number; used_trips: number;
    }>>`
      SELECT id, organizer_id, plan_type, status::text AS status, total_trips, used_trips
        FROM crm_subscriptions
       WHERE status = 'expired'
          OR (total_trips - used_trips) <= 1
       LIMIT 10
    `;

    const alertOrganizers = await User.find(
      { _id: { $in: subscriptions.map(s => s.organizer_id) } },
      'name email'
    ).lean();
    const organizerNames = new Map(
      alertOrganizers.map((u: any) => [u._id.toString(), u.name])
    );

    // Alerts for agents
    const alerts = [];

    if (unverifiedOrganizers > 0) {
      alerts.push({
        type: 'info',
        message: `${unverifiedOrganizers} organizer${unverifiedOrganizers > 1 ? 's' : ''} awaiting verification`,
        action: '/agent/verify-organizers',
        priority: 'medium'
      });
    }

    if (pendingVerifications.length > 0) {
      alerts.push({
        type: 'warning',
        message: `${pendingVerifications.length} payment verifications pending`,
        action: '/agent/pending-payments',
        priority: 'high'
      });
    }

    if (pendingTrips > 0) {
      alerts.push({
        type: 'info',
        message: `${pendingTrips} trip${pendingTrips > 1 ? 's' : ''} pending approval`,
        action: '/agent/pending-trips',
        priority: 'medium'
      });
    }

    // Quick actions for agents
    const quickActions = [
      { label: 'Verify Organizers', icon: 'check', action: '/agent/verify-organizers', badge: unverifiedOrganizers, color: 'primary' },
      { label: 'Review Trips', icon: 'eye', action: '/agent/review-trips', badge: pendingTrips, color: 'info' },
      { label: 'Manage Users', icon: 'users', action: '/agent/users', color: 'success' },
      { label: 'View Reports', icon: 'chart', action: '/agent/reports', color: 'secondary' }
    ];

    const dashboard = {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      },
      summary: {
        users: {
          total: totalUsers,
          organizers: totalOrganizers,
          travelers: totalTravelers,
          newToday: newUsersToday,
          verifiedOrganizers,
          unverifiedOrganizers
        },
        trips: {
          total: totalTrips,
          active: activeTrips,
          pending: pendingTrips,
          completed: completedTrips,
          today: tripsToday
        },
        bookings: {
          total: totalBookings,
          pending: pendingBookings,
          confirmed: confirmedBookings,
          today: bookingsToday
        }
      },
      recentUsers: recentUsers.map(u => ({
        id: u._id,
        name: u.name,
        email: u.email,
        role: u.role,
        createdAt: u.createdAt,
        isVerified: u.isVerified,
        phoneVerified: u.phoneVerified
      })),
      recentTrips: recentTrips.map(trip => ({
        id: trip._id,
        title: trip.title,
        destination: trip.destination,
        status: trip.status,
        organizerName: (trip.organizerId as any)?.name || 'Unknown',
        organizerEmail: (trip.organizerId as any)?.email,
        createdAt: trip.createdAt
      })),
      pendingVerifications: pendingVerifications.map(booking => ({
        id: booking._id,
        tripTitle: (booking.tripId as any)?.title || 'Unknown',
        travelerName: (booking.mainBookerId as any)?.name || 'Unknown',
        amount: booking.finalAmount,
        createdAt: booking.createdAt
      })),
      subscriptionsAlert: subscriptions.map(sub => ({
        id: sub.id,
        organizerName: organizerNames.get(sub.organizer_id) || 'Unknown',
        planType: sub.plan_type,
        status: sub.status,
        remainingTrips: Math.max(0, sub.total_trips - sub.used_trips)
      })),
      alerts,
      quickActions
    };

    res.json(dashboard);
  } catch (error: any) {
    logger.error('Error fetching agent dashboard', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

/**
 * Get comprehensive admin dashboard
 */
router.get('/admin', authenticateJwt, requireRole(['admin']), async (req, res) => {
  try {
    const adminId = (req as any).auth.userId;

    const user = await User.findById(adminId).select('-passwordHash');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get comprehensive statistics
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);

    // Platform statistics
    const [
      totalUsers,
      totalOrganizers,
      totalTravelers,
      totalAgents,
      usersThisMonth,
      usersLastMonth
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: 'organizer' }),
      User.countDocuments({ role: 'traveler' }),
      User.countDocuments({ role: 'agent' }),
      User.countDocuments({ createdAt: { $gte: thisMonth } }),
      User.countDocuments({ createdAt: { $gte: lastMonth, $lt: thisMonth } })
    ]);

    // Trip statistics
    const [
      totalTrips,
      activeTrips,
      completedTrips,
      tripsThisMonth
    ] = await Promise.all([
      prisma.trip.count(),
      prisma.trip.count({ where: { status: 'active' } }),
      prisma.trip.count({ where: { status: 'completed' } }),
      prisma.trip.count({ where: { createdAt: { gte: thisMonth } } })
    ]);

    // Booking statistics
    const [
      totalBookings,
      confirmedBookings,
      bookingsThisMonth
    ] = await Promise.all([
      prisma.groupBooking.count(),
      prisma.groupBooking.count({ where: { bookingStatus: 'confirmed' } }),
      prisma.groupBooking.count({ where: { createdAt: { gte: thisMonth } } })
    ]);

    // Revenue statistics
    // Was a $facet running three grouped sums over the same match in one pass.
    // Three aggregates say it plainly, and they run together.
    const [totalRev, monthRev, lastMonthRev] = await Promise.all([
      prisma.groupBooking.aggregate({
        where: { bookingStatus: 'confirmed' },
        _sum: { finalAmount: true }
      }),
      prisma.groupBooking.aggregate({
        where: { bookingStatus: 'confirmed', createdAt: { gte: thisMonth } },
        _sum: { finalAmount: true }
      }),
      prisma.groupBooking.aggregate({
        where: { bookingStatus: 'confirmed', createdAt: { gte: lastMonth, lt: thisMonth } },
        _sum: { finalAmount: true }
      })
    ]);

    const revenue = {
      total: toNumber(totalRev._sum.finalAmount),
      thisMonth: toNumber(monthRev._sum.finalAmount),
      lastMonth: toNumber(lastMonthRev._sum.finalAmount),
      growth: 0
    };

    if (revenue.lastMonth > 0) {
      revenue.growth = ((revenue.thisMonth - revenue.lastMonth) / revenue.lastMonth) * 100;
    }

    // Subscription statistics
    const [
      totalSubscriptions,
      activeSubscriptions,
      expiredSubscriptions
    ] = await Promise.all([
      prisma.cRMSubscription.count(),
      prisma.cRMSubscription.count({ where: { status: 'active' } }),
      prisma.cRMSubscription.count({ where: { status: 'expired' } })
    ]);

    // Growth metrics
    const userGrowth = usersLastMonth > 0
      ? ((usersThisMonth - usersLastMonth) / usersLastMonth) * 100
      : 0;

    // System health
    const systemHealth = {
      database: 'healthy',
      api: 'healthy',
      cronJobs: 'running',
      emailService: 'operational'
    };

    // Top organizers
    // Was a group, a sort, a $lookup into users and an $unwind. The grouping
    // and the participant count are SQL; the $lookup is not, because users are
    // still Mongo documents - so the organizer names are fetched afterwards
    // rather than joined.
    const organizerTotals = await prisma.$queryRaw<Array<{
      organizer_id: string; trip_count: bigint; participants: bigint;
    }>>`
      SELECT t.organizer_id,
             count(*) AS trip_count,
             count(p.id) AS participants
        FROM trips t
        LEFT JOIN trip_participants p ON p.trip_id = t.id
       GROUP BY t.organizer_id
       ORDER BY trip_count DESC
       LIMIT 5
    `;

    const topOrganizerUsers = await User.find(
      { _id: { $in: organizerTotals.map(o => o.organizer_id) } },
      'name email'
    ).lean();
    const topOrganizerById = new Map(topOrganizerUsers.map((u: any) => [u._id.toString(), u]));

    const topOrganizers = organizerTotals.map(o => ({
      _id: o.organizer_id,
      name: topOrganizerById.get(o.organizer_id)?.name,
      email: topOrganizerById.get(o.organizer_id)?.email,
      tripCount: Number(o.trip_count),
      participants: Number(o.participants)
    }));

    // Recent activities
    const recentUsers = await User.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('name email role createdAt')
      .lean();

    const adminRecentTripRows = await prisma.trip.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5
    });
    const recentTrips = await withOrganizers(adminRecentTripRows, 'name');

    // Alerts for admin
    const alerts = [];

    if (expiredSubscriptions > 5) {
      alerts.push({
        type: 'warning',
        message: `${expiredSubscriptions} expired subscriptions need attention`,
        action: '/admin/subscriptions',
        priority: 'medium'
      });
    }

    // Quick actions for admin
    const quickActions = [
      { label: 'User Management', icon: 'users', action: '/admin/users', color: 'primary' },
      { label: 'Trip Moderation', icon: 'eye', action: '/admin/trips', color: 'info' },
      { label: 'System Settings', icon: 'settings', action: '/admin/settings', color: 'secondary' },
      { label: 'Analytics', icon: 'chart', action: '/admin/analytics', color: 'success' },
      { label: 'Subscriptions', icon: 'credit-card', action: '/admin/subscriptions', badge: expiredSubscriptions, color: 'warning' }
    ];

    const dashboard = {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      },
      summary: {
        users: {
          total: totalUsers,
          organizers: totalOrganizers,
          travelers: totalTravelers,
          agents: totalAgents,
          thisMonth: usersThisMonth,
          growth: userGrowth
        },
        trips: {
          total: totalTrips,
          active: activeTrips,
          completed: completedTrips,
          thisMonth: tripsThisMonth
        },
        bookings: {
          total: totalBookings,
          confirmed: confirmedBookings,
          thisMonth: bookingsThisMonth
        },
        revenue,
        subscriptions: {
          total: totalSubscriptions,
          active: activeSubscriptions,
          expired: expiredSubscriptions
        }
      },
      topOrganizers,
      recentUsers: recentUsers.map(u => ({
        id: u._id,
        name: u.name,
        email: u.email,
        role: u.role,
        createdAt: u.createdAt
      })),
      recentTrips: recentTrips.map(trip => ({
        id: trip._id,
        title: trip.title,
        destination: trip.destination,
        status: trip.status,
        organizerName: (trip.organizerId as any)?.name || 'Unknown',
        createdAt: trip.createdAt
      })),
      systemHealth,
      alerts,
      quickActions
    };

    res.json(dashboard);
  } catch (error: any) {
    logger.error('Error fetching admin dashboard', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

/**
 * Get comprehensive traveler dashboard
 */
router.get('/traveler', authenticateJwt, async (req, res) => {
  try {
    const travelerId = (req as any).auth.userId;

    const user = await User.findById(travelerId).select('-passwordHash');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get trips the traveler has joined
    // `{ participants: travelerId }` matched an ObjectId inside an array; it is
    // a row in trip_participants now, so it is a relation filter.
    const joinedTripRows = await prisma.trip.findMany({
      where: { participants: { some: { userId: travelerId } } },
      include: { participants: { select: { userId: true } } },
      orderBy: { startDate: 'asc' }
    });
    const joinedTrips = await withOrganizers(joinedTripRows, 'name profilePhoto');

    // Get traveler's bookings
    const bookingRows = await prisma.groupBooking.findMany({
      where: { mainBookerId: travelerId },
      include: { trip: true },
      orderBy: { createdAt: 'desc' }
    });
    const bookings = bookingRows.map(row => {
      const booking: any = shapeBooking(row);
      booking.tripId = row.trip ? shapeTrip(row.trip as any) : null;
      return booking;
    });

    // Categorize trips
    const upcomingTrips = joinedTrips.filter(trip =>
      new Date(trip.startDate) > new Date() && trip.status === 'active'
    );

    const pastTrips = joinedTrips.filter(trip =>
      new Date(trip.endDate) < new Date() || trip.status === 'completed'
    );

    // Statistics
    const stats = {
      tripsJoined: joinedTrips.length,
      upcomingTrips: upcomingTrips.length,
      completedTrips: pastTrips.length,
      totalBookings: bookings.length,
      pendingBookings: bookings.filter(b => b.bookingStatus === 'pending').length,
      confirmedBookings: bookings.filter(b => b.bookingStatus === 'confirmed').length
    };

    // Profile completeness
    let profileCompleteness = 0;
    const profileFields = ['name', 'email', 'phone', 'profilePhoto', 'bio'];
    profileFields.forEach(field => {
      if ((user as any)[field]) profileCompleteness += 20;
    });

    // Alerts
    const alerts = [];

    if (!user.phoneVerified) {
      alerts.push({
        type: 'warning',
        message: 'Please verify your phone number to complete bookings',
        action: '/verify-phone',
        priority: 'high'
      });
    }

    if (profileCompleteness < 100) {
      alerts.push({
        type: 'info',
        message: 'Complete your profile to get personalized trip recommendations',
        action: '/profile/edit',
        priority: 'low'
      });
    }

    // Quick actions
    const quickActions = [
      { label: 'Explore Trips', icon: 'compass', action: '/trips/explore', color: 'primary' },
      { label: 'My Bookings', icon: 'calendar', action: '/bookings', badge: stats.pendingBookings, color: 'info' },
      { label: 'My Profile', icon: 'user', action: '/profile', color: 'secondary' },
      { label: 'Saved Trips', icon: 'heart', action: '/wishlist', color: 'danger' }
    ];

    const dashboard = {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        phoneVerified: user.phoneVerified,
        profilePhoto: user.profilePhoto,
        role: user.role,
        profileCompleteness
      },
      stats,
      upcomingTrips: upcomingTrips.map(trip => ({
        id: trip._id,
        title: trip.title,
        destination: trip.destination,
        startDate: trip.startDate,
        endDate: trip.endDate,
        organizerName: (trip.organizerId as any)?.name || 'Unknown',
        organizerPhoto: (trip.organizerId as any)?.profilePhoto,
        image: trip.images?.[0] || null
      })),
      recentBookings: bookings.slice(0, 5).map(booking => ({
        id: booking._id,
        tripTitle: (booking.tripId as any)?.title || 'Unknown',
        tripImage: (booking.tripId as any)?.images?.[0] || null,
        startDate: (booking.tripId as any)?.startDate,
        numberOfGuests: booking.numberOfGuests,
        amount: booking.finalAmount,
        status: booking.bookingStatus,
        paymentStatus: booking.paymentVerificationStatus,
        createdAt: booking.createdAt
      })),
      alerts,
      quickActions
    };

    res.json(dashboard);
  } catch (error: any) {
    logger.error('Error fetching traveler dashboard', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

export default router;
