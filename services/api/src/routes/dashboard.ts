import { Router } from 'express';
import { authenticateJwt, requireRole } from '../middleware/auth';
import { User } from '../models/User';
import { Trip } from '../models/Trip';
import { GroupBooking } from '../models/GroupBooking';
import CRMSubscription from '../models/CRMSubscription';
import { logger } from '../utils/logger';

const router = Router();

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
    const subscription = await CRMSubscription.findOne({ organizerId });

    // Get trip statistics
    const [
      totalTrips,
      activeTrips,
      draftTrips,
      completedTrips,
      upcomingTrips
    ] = await Promise.all([
      Trip.countDocuments({ organizerId }),
      Trip.countDocuments({ organizerId, status: 'active' }),
      Trip.countDocuments({ organizerId, status: 'draft' }),
      Trip.countDocuments({ organizerId, status: 'completed' }),
      Trip.countDocuments({ 
        organizerId, 
        status: 'active',
        startDate: { $gte: new Date() }
      })
    ]);

    // Get recent trips
    const recentTrips = await Trip.find({ organizerId })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('title destination status startDate endDate capacity participants images')
      .lean();

    // Get booking statistics
    const tripIds = await Trip.find({ organizerId }).distinct('_id');
    
    const [
      totalBookings,
      pendingVerifications,
      confirmedBookings,
      cancelledBookings,
      todayBookings
    ] = await Promise.all([
      GroupBooking.countDocuments({ tripId: { $in: tripIds } }),
      GroupBooking.countDocuments({ 
        tripId: { $in: tripIds }, 
        paymentVerificationStatus: 'pending' 
      }),
      GroupBooking.countDocuments({ 
        tripId: { $in: tripIds }, 
        bookingStatus: 'confirmed' 
      }),
      GroupBooking.countDocuments({ 
        tripId: { $in: tripIds }, 
        bookingStatus: 'cancelled' 
      }),
      GroupBooking.countDocuments({
        tripId: { $in: tripIds },
        createdAt: {
          $gte: new Date(new Date().setHours(0, 0, 0, 0)),
          $lt: new Date(new Date().setHours(23, 59, 59, 999))
        }
      })
    ]);

    // Get recent bookings
    const recentBookings = await GroupBooking.find({ tripId: { $in: tripIds } })
      .populate('tripId', 'title destination')
      .populate('mainBookerId', 'name email')
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    // Calculate total revenue
    const revenueData = await GroupBooking.aggregate([
      { $match: { tripId: { $in: tripIds }, bookingStatus: 'confirmed' } },
      { $group: { 
        _id: null, 
        totalRevenue: { $sum: '$finalAmount' },
        monthlyRevenue: {
          $sum: {
            $cond: [
              { 
                $gte: ['$createdAt', new Date(new Date().setDate(1))] 
              },
              '$finalAmount',
              0
            ]
          }
        }
      }}
    ]);

    const revenue = {
      total: revenueData[0]?.totalRevenue || 0,
      monthly: revenueData[0]?.monthlyRevenue || 0
    };

    // Get participants count
    const participantsData = await Trip.aggregate([
      { $match: { organizerId: user._id } },
      { $project: { participantCount: { $size: '$participants' } } },
      { $group: { _id: null, totalParticipants: { $sum: '$participantCount' } } }
    ]);

    const totalParticipants = participantsData[0]?.totalParticipants || 0;

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
    const subscriptionInfo = subscription ? {
      planType: subscription.planType,
      status: subscription.status,
      tripPackage: subscription.tripPackage,
      crmBundle: subscription.crmBundle,
      trial: subscription.trial
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

    if (subscription && subscription.tripPackage && subscription.tripPackage.remainingTrips <= 2) {
      alerts.push({
        type: 'info',
        message: `Only ${subscription.tripPackage.remainingTrips} trip listing${subscription.tripPackage.remainingTrips > 1 ? 's' : ''} remaining`,
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
      Trip.countDocuments(),
      Trip.countDocuments({ status: 'active' }),
      Trip.countDocuments({ status: 'pending' }),
      Trip.countDocuments({ status: 'completed' }),
      Trip.countDocuments({ createdAt: { $gte: today, $lt: tomorrow } })
    ]);

    // Get all bookings statistics
    const [
      totalBookings,
      pendingBookings,
      confirmedBookings,
      bookingsToday
    ] = await Promise.all([
      GroupBooking.countDocuments(),
      GroupBooking.countDocuments({ bookingStatus: 'pending' }),
      GroupBooking.countDocuments({ bookingStatus: 'confirmed' }),
      GroupBooking.countDocuments({ createdAt: { $gte: today, $lt: tomorrow } })
    ]);

    // Get recent users
    const recentUsers = await User.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .select('name email role createdAt isVerified phoneVerified')
      .lean();

    // Get recent trips
    const recentTrips = await Trip.find()
      .populate('organizerId', 'name email')
      .sort({ createdAt: -1 })
      .limit(10)
      .select('title destination status organizerId createdAt')
      .lean();

    // Get pending verifications
    const pendingVerifications = await GroupBooking.find({
      paymentVerificationStatus: 'pending'
    })
      .populate('tripId', 'title destination')
      .populate('mainBookerId', 'name email')
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    // Get subscriptions requiring attention
    const subscriptions = await CRMSubscription.find({
      $or: [
        { status: 'expired' },
        { 'tripPackage.remainingTrips': { $lte: 1 } }
      ]
    })
      .populate('organizerId', 'name email')
      .limit(10)
      .lean();

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
        id: sub._id,
        organizerName: (sub.organizerId as any)?.name || 'Unknown',
        planType: sub.planType,
        status: sub.status,
        remainingTrips: sub.tripPackage?.remainingTrips || 0
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
      Trip.countDocuments(),
      Trip.countDocuments({ status: 'active' }),
      Trip.countDocuments({ status: 'completed' }),
      Trip.countDocuments({ createdAt: { $gte: thisMonth } })
    ]);

    // Booking statistics
    const [
      totalBookings,
      confirmedBookings,
      bookingsThisMonth
    ] = await Promise.all([
      GroupBooking.countDocuments(),
      GroupBooking.countDocuments({ bookingStatus: 'confirmed' }),
      GroupBooking.countDocuments({ createdAt: { $gte: thisMonth } })
    ]);

    // Revenue statistics
    const revenueData = await GroupBooking.aggregate([
      { $match: { bookingStatus: 'confirmed' } },
      { 
        $facet: {
          total: [
            { $group: { _id: null, amount: { $sum: '$finalAmount' } } }
          ],
          monthly: [
            { $match: { createdAt: { $gte: thisMonth } } },
            { $group: { _id: null, amount: { $sum: '$finalAmount' } } }
          ],
          lastMonth: [
            { $match: { createdAt: { $gte: lastMonth, $lt: thisMonth } } },
            { $group: { _id: null, amount: { $sum: '$finalAmount' } } }
          ]
        }
      }
    ]);

    const revenue = {
      total: revenueData[0]?.total[0]?.amount || 0,
      thisMonth: revenueData[0]?.monthly[0]?.amount || 0,
      lastMonth: revenueData[0]?.lastMonth[0]?.amount || 0,
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
      CRMSubscription.countDocuments(),
      CRMSubscription.countDocuments({ status: 'active' }),
      CRMSubscription.countDocuments({ status: 'expired' })
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
    const topOrganizers = await Trip.aggregate([
      { $group: { 
        _id: '$organizerId', 
        tripCount: { $sum: 1 },
        participants: { $sum: { $size: '$participants' } }
      }},
      { $sort: { tripCount: -1 } },
      { $limit: 5 },
      { $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'organizer'
      }},
      { $unwind: '$organizer' },
      { $project: {
        name: '$organizer.name',
        email: '$organizer.email',
        tripCount: 1,
        participants: 1
      }}
    ]);

    // Recent activities
    const recentUsers = await User.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('name email role createdAt')
      .lean();

    const recentTrips = await Trip.find()
      .populate('organizerId', 'name')
      .sort({ createdAt: -1 })
      .limit(5)
      .select('title destination status createdAt')
      .lean();

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
    const joinedTrips = await Trip.find({ participants: travelerId })
      .populate('organizerId', 'name profilePhoto')
      .sort({ startDate: 1 })
      .lean();

    // Get traveler's bookings
    const bookings = await GroupBooking.find({ mainBookerId: travelerId })
      .populate('tripId', 'title destination startDate endDate images')
      .sort({ createdAt: -1 })
      .lean();

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
