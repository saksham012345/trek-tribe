import express from 'express';
import { User } from '../models/User';
import { Trip } from '../models/Trip';
import { Review } from '../models/Review';
import { Wishlist } from '../models/Wishlist';
import CRMSubscription from '../models/CRMSubscription';
import { OrganizerSubscription } from '../models/OrganizerSubscription';
import { SupportTicket } from '../models/SupportTicket';
import { VerificationRequest } from '../models/VerificationRequest';
import { authenticateJwt, requireRole } from '../middleware/auth';
import { logger } from '../utils/logger';
import { emailService } from '../services/emailService';
import { retryQueueService } from '../services/retryQueueService';
import RetryJob from '../models/RetryJob';
import TrustScoreService from '../services/trustScoreService';

const router = express.Router();

// All admin routes require admin role
router.use(authenticateJwt);
router.use(requireRole(['admin']));

// Get dashboard statistics
router.get('/stats', async (req, res) => {
  try {
    // Get basic counts
    const [totalUsers, totalTrips, totalReviews, totalWishlists, totalTickets, activeSubscriptions] = await Promise.all([
      User.countDocuments(),
      Trip.countDocuments(),
      Review.countDocuments(),
      Wishlist.countDocuments(),
      SupportTicket.countDocuments(),
      CRMSubscription.countDocuments({ status: 'active' })
    ]);

    // Get users by role
    const usersByRole = await User.aggregate([
      { $group: { _id: '$role', count: { $sum: 1 } } },
      { $project: { role: '$_id', count: 1, _id: 0 } }
    ]);

    // Get trips by status
    const tripsByStatus = await Trip.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $project: { status: '$_id', count: 1, _id: 0 } }
    ]);

    // Calculate total bookings and revenue from trips
    const tripsWithParticipants = await Trip.find({}, 'participants price');
    let totalBookings = 0;
    let totalTripRevenue = 0;

    tripsWithParticipants.forEach(trip => {
      totalBookings += trip.participants.length;
      totalTripRevenue += trip.participants.length * trip.price;
    });

    // Calculate subscription revenue
    const subscriptions = await CRMSubscription.find({});
    let totalSubscriptionRevenue = 0;
    let thisMonthSubscriptionRevenue = 0;
    const currentDate = new Date();
    const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);

    subscriptions.forEach(sub => {
      const revenue = sub.totalPaid || 0;
      totalSubscriptionRevenue += revenue;

      if (sub.createdAt >= firstDayOfMonth) {
        thisMonthSubscriptionRevenue += revenue;
      }
    });

    // Get subscription stats by plan
    const subscriptionsByPlan = await CRMSubscription.aggregate([
      { $group: { _id: '$planType', count: { $sum: 1 }, revenue: { $sum: '$totalPaid' } } },
      { $project: { plan: '$_id', count: 1, revenue: 1, _id: 0 } }
    ]);

    // Get ticket stats
    const ticketsByStatus = await SupportTicket.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $project: { status: '$_id', count: 1, _id: 0 } }
    ]);

    // Get recent data
    const recentUsers = await User.find({}, 'name email role createdAt')
      .sort({ createdAt: -1 })
      .limit(5)
      .select('-passwordHash');

    const recentTrips = await Trip.find({}, 'title destination price status createdAt')
      .populate('organizerId', 'name')
      .sort({ createdAt: -1 })
      .limit(5);

    const totalRevenue = totalTripRevenue + totalSubscriptionRevenue;

    res.json({
      overview: {
        totalUsers,
        totalTrips,
        totalBookings,
        totalRevenue,
        totalReviews,
        totalWishlists,
        totalTickets,
        activeSubscriptions
      },
      users: {
        total: totalUsers,
        byRole: usersByRole,
        organizers: usersByRole.find(role => role.role === 'organizer')?.count || 0,
        agents: usersByRole.find(role => role.role === 'agent')?.count || 0,
        recentUsers
      },
      trips: {
        total: totalTrips,
        byStatus: tripsByStatus,
        recentTrips,
        totalBookings,
        totalRevenue: totalTripRevenue
      },
      subscriptions: {
        total: subscriptions.length,
        active: activeSubscriptions,
        byPlan: subscriptionsByPlan,
        revenue: {
          total: totalSubscriptionRevenue,
          thisMonth: thisMonthSubscriptionRevenue
        }
      },
      tickets: {
        total: totalTickets,
        byStatus: ticketsByStatus,
        open: ticketsByStatus.find(t => t.status === 'open')?.count || 0,
        inProgress: ticketsByStatus.find(t => t.status === 'in-progress')?.count || 0,
        resolved: ticketsByStatus.find(t => t.status === 'resolved')?.count || 0
      }
    });
  } catch (error: any) {
    logger.error('Error fetching admin stats', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch dashboard statistics' });
  }
});

// Get user statistics
router.get('/users/stats', async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const usersByRole = await User.aggregate([
      { $group: { _id: '$role', count: { $sum: 1 } } },
      { $project: { role: '$_id', count: 1, _id: 0 } }
    ]);

    const recentUsers = await User.find({}, 'name email role createdAt')
      .sort({ createdAt: -1 })
      .limit(10)
      .select('-passwordHash');

    res.json({
      total: totalUsers,
      byRole: usersByRole,
      recentUsers
    });
  } catch (error: any) {
    logger.error('Error fetching user stats', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch user statistics' });
  }
});

// Get trip statistics
router.get('/trips/stats', async (req, res) => {
  try {
    const totalTrips = await Trip.countDocuments();
    const tripsByStatus = await Trip.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $project: { status: '$_id', count: 1, _id: 0 } }
    ]);

    const recentTrips = await Trip.find({}, 'title destination price status participants createdAt')
      .populate('organizerId', 'name email')
      .sort({ createdAt: -1 })
      .limit(10);

    // Calculate booking statistics
    const tripsWithParticipants = await Trip.find({}, 'participants price');
    let totalBookings = 0;
    let totalRevenue = 0;

    tripsWithParticipants.forEach(trip => {
      totalBookings += trip.participants.length;
      totalRevenue += trip.participants.length * trip.price;
    });

    res.json({
      total: totalTrips,
      byStatus: tripsByStatus,
      recentTrips,
      totalBookings,
      totalRevenue
    });
  } catch (error: any) {
    logger.error('Error fetching trip stats', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch trip statistics' });
  }
});

// Get all users with pagination
router.get('/users', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = req.query.search as string || '';
    const role = req.query.role as string;

    const query: any = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    if (role && role !== 'all') {
      query.role = role;
    }

    const total = await User.countDocuments(query);
    const users = await User.find(query)
      .select('-passwordHash')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.json({
      users,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error: any) {
    logger.error('Error fetching users', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get user contact information (Admin only - sensitive data)
router.get('/users/contacts', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const search = req.query.search as string || '';
    const role = req.query.role as string;

    const query: any = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }
    if (role && role !== 'all') {
      query.role = role;
    }

    const total = await User.countDocuments(query);
    const users = await User.find(query, {
      name: 1,
      email: 1,
      phone: 1,
      role: 1,
      isVerified: 1,
      location: 1,
      dateOfBirth: 1,
      emergencyContact: 1,
      createdAt: 1,
      lastActive: 1
    })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    // Log access to sensitive data
    logger.info('Admin accessed user contact information', {
      adminId: (req as any).auth.userId,
      userCount: users.length,
      searchQuery: search,
      timestamp: new Date()
    });

    res.json({
      users,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total
      },
      warning: 'This endpoint contains sensitive user data. Access is logged and monitored.'
    });
  } catch (error: any) {
    logger.error('Error fetching user contacts', {
      error: error.message,
      adminId: (req as any).auth.userId
    });
    res.status(500).json({ error: 'Failed to fetch user contacts' });
  }
});

// Get specific user's detailed contact information
router.get('/users/:id/contact', async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id, {
      name: 1,
      email: 1,
      phone: 1,
      role: 1,
      location: 1,
      dateOfBirth: 1,
      emergencyContact: 1,
      privacySettings: 1,
      createdAt: 1,
      lastActive: 1,
      isVerified: 1
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Log access to individual user's sensitive data
    logger.info('Admin accessed individual user contact information', {
      adminId: (req as any).auth.userId,
      targetUserId: id,
      targetUserEmail: user.email,
      timestamp: new Date()
    });

    res.json({
      user,
      warning: 'This data contains sensitive user information. Access is logged and monitored.'
    });
  } catch (error: any) {
    logger.error('Error fetching user contact details', {
      error: error.message,
      adminId: (req as any).auth.userId,
      targetUserId: req.params.id
    });
    res.status(500).json({ error: 'Failed to fetch user contact details' });
  }
});

// Export user contact data (CSV format)
router.get('/users/export-contacts', async (req, res) => {
  try {
    const role = req.query.role as string;
    const query: any = {};

    if (role && role !== 'all') {
      query.role = role;
    }

    const users = await User.find(query, {
      name: 1,
      email: 1,
      phone: 1,
      role: 1,
      location: 1,
      createdAt: 1,
      lastActive: 1,
      isVerified: 1
    }).sort({ createdAt: -1 });

    // Generate CSV content
    const csvHeader = 'Name,Email,Phone,Role,Location,Verified,Created At,Last Active\n';
    const csvRows = users.map(user => {
      return [
        `"${user.name || ''}",`,
        `"${user.email || ''}",`,
        `"${user.phone || ''}",`,
        `"${user.role || ''}",`,
        `"${user.location || ''}",`,
        `"${user.isVerified ? 'Yes' : 'No'}",`,
        `"${user.createdAt ? new Date(user.createdAt).toISOString() : ''}",`,
        `"${user.lastActive ? new Date(user.lastActive).toISOString() : ''}"`
      ].join('');
    }).join('\n');

    const csv = csvHeader + csvRows;

    // Log sensitive data export
    logger.warn('Admin exported user contact data', {
      adminId: (req as any).auth.userId,
      userCount: users.length,
      roleFilter: role,
      timestamp: new Date()
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="trek-tribe-users-${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csv);
  } catch (error: any) {
    logger.error('Error exporting user contacts', {
      error: error.message,
      adminId: (req as any).auth.userId
    });
    res.status(500).json({ error: 'Failed to export user contacts' });
  }
});

// ===== Retry Jobs Management (Admin) =====
router.get('/retries', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const skip = (page - 1) * limit;
    const jobs = await RetryJob.find({}).sort({ createdAt: -1 }).limit(limit).skip(skip).lean();
    const total = await RetryJob.countDocuments({});
    res.json({ data: jobs, pagination: { page, limit, total } });
  } catch (err: any) {
    logger.error('Error listing retry jobs', { error: err.message });
    res.status(500).json({ error: 'Failed to list retry jobs' });
  }
});

router.post('/retries/:id/retry', async (req, res) => {
  try {
    const { id } = req.params;
    const job = await RetryJob.findById(id);
    if (!job) return res.status(404).json({ error: 'Retry job not found' });
    job.status = 'pending';
    job.nextRetryAt = new Date();
    job.retryCount = 0;
    await job.save();
    res.json({ success: true, job });
  } catch (err: any) {
    logger.error('Error retrying job', { error: err.message });
    res.status(500).json({ error: 'Failed to retry job' });
  }
});

router.post('/retries/:id/cancel', async (req, res) => {
  try {
    const { id } = req.params;
    const job = await RetryJob.findById(id);
    if (!job) return res.status(404).json({ error: 'Retry job not found' });
    job.status = 'cancelled';
    await job.save();
    res.json({ success: true, job });
  } catch (err: any) {
    logger.error('Error cancelling job', { error: err.message });
    res.status(500).json({ error: 'Failed to cancel job' });
  }
});

// Get all trips with pagination
router.get('/trips', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = req.query.search as string || '';
    const status = req.query.status as string;

    const query: any = {};
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { destination: { $regex: search, $options: 'i' } }
      ];
    }
    if (status && status !== 'all') {
      query.status = status;
    }

    const total = await Trip.countDocuments(query);
    const trips = await Trip.find(query)
      .populate('organizerId', 'name email')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.json({
      trips,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error: any) {
    logger.error('Error fetching trips', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch trips' });
  }
});

// List trips pending verification (admin review queue)
router.get('/trips/pending-verifications', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const query: any = { verificationStatus: 'pending' };

    const total = await Trip.countDocuments(query);
    const trips = await Trip.find(query)
      .populate('organizerId', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    res.json({
      trips,
      pagination: { current: page, pages: Math.ceil(total / limit), total }
    });
  } catch (error: any) {
    logger.error('Error fetching pending verification trips', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch pending verification trips' });
  }
});

// Approve (verify) a trip
router.post('/trips/:id/verify', async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = (req as any).auth.userId;
    const { adminNotes } = req.body;

    const trip = await Trip.findById(id).populate('organizerId', 'name email');
    if (!trip) return res.status(404).json({ error: 'Trip not found' });

    if (trip.verificationStatus === 'approved') {
      return res.status(400).json({ error: 'Trip already approved' });
    }

    trip.verificationStatus = 'approved';
    trip.verifiedBy = adminId;
    trip.verifiedAt = new Date();
    if (adminNotes) trip.adminNotes = adminNotes;
    // Make the trip active once verified
    trip.status = 'active';

    await trip.save();

    // Notify organizer via email (best-effort)
    try {
      const organizer: any = trip.organizerId;
      if (organizer && organizer.email) {
        const subject = `Your trip "${trip.title}" has been approved`;
        const html = `<p>Hi ${organizer.name || ''},</p><p>Your trip <strong>${trip.title}</strong> has been approved by the Trek Tribe team and is now live.</p><p>Notes from admin: ${adminNotes || 'No notes provided.'}</p>`;
        await emailService.sendEmail({ to: organizer.email, subject, html });
      }
    } catch (err) {
      logger.warn('Failed to send trip approval email', { error: (err as any)?.message });
    }

    logger.info('Trip verified by admin', { adminId, tripId: id });
    res.json({ message: 'Trip approved successfully', trip });
  } catch (error: any) {
    logger.error('Error approving trip', { error: error.message });
    res.status(500).json({ error: 'Failed to approve trip' });
  }
});

// Reject a trip (provide reason)
router.post('/trips/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = (req as any).auth.userId;
    const { rejectionReason, adminNotes } = req.body;

    const trip = await Trip.findById(id).populate('organizerId', 'name email');
    if (!trip) return res.status(404).json({ error: 'Trip not found' });

    if (trip.verificationStatus === 'rejected') {
      return res.status(400).json({ error: 'Trip already rejected' });
    }

    trip.verificationStatus = 'rejected';
    trip.rejectionReason = rejectionReason || 'No reason provided';
    trip.adminNotes = adminNotes || trip.adminNotes;
    trip.verifiedBy = adminId;
    trip.verifiedAt = new Date();
    // Mark as cancelled to prevent it from being shown as active
    trip.status = 'cancelled';

    await trip.save();

    // Notify organizer via email (best-effort)
    try {
      const organizer: any = trip.organizerId;
      if (organizer && organizer.email) {
        const subject = `Your trip "${trip.title}" has been rejected`;
        const html = `<p>Hi ${organizer.name || ''},</p><p>Your trip <strong>${trip.title}</strong> was not approved.</p><p>Reason: ${trip.rejectionReason}</p><p>Admin notes: ${trip.adminNotes || 'No notes provided.'}</p>`;
        await emailService.sendEmail({ to: organizer.email, subject, html });
      }
    } catch (err) {
      logger.warn('Failed to send trip rejection email', { error: (err as any)?.message });
    }

    logger.info('Trip rejected by admin', { adminId, tripId: id });
    res.json({ message: 'Trip rejected', trip });
  } catch (error: any) {
    logger.error('Error rejecting trip', { error: error.message });
    res.status(500).json({ error: 'Failed to reject trip' });
  }
});

// Update user role
router.patch('/users/:id/role', async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!['traveler', 'organizer', 'admin', 'agent'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const user = await User.findByIdAndUpdate(
      id,
      { role },
      { new: true }
    ).select('-passwordHash');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    logger.info('User role updated', {
      adminId: (req as any).auth.userId,
      userId: id,
      newRole: role
    });

    res.json({ message: 'User role updated successfully', user });
  } catch (error: any) {
    logger.error('Error updating user role', { error: error.message });
    res.status(500).json({ error: 'Failed to update user role' });
  }
});

// Delete user
router.delete('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = (req as any).auth.userId;

    // Prevent self-deletion
    if (id === adminId) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Clean up related data
    await Promise.all([
      Review.deleteMany({ reviewerId: id }),
      Wishlist.deleteMany({ userId: id }),
      Trip.updateMany(
        { participants: id },
        { $pull: { participants: id } }
      )
    ]);

    await User.findByIdAndDelete(id);

    logger.info('User deleted', {
      adminId,
      deletedUserId: id,
      deletedUserEmail: user.email
    });

    res.json({ message: 'User deleted successfully' });
  } catch (error: any) {
    logger.error('Error deleting user', { error: error.message });
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// Update trip status
router.patch('/trips/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['active', 'cancelled', 'completed'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const trip = await Trip.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    ).populate('organizerId', 'name email');

    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    logger.info('Trip status updated', {
      adminId: (req as any).auth.userId,
      tripId: id,
      newStatus: status
    });

    res.json({ message: 'Trip status updated successfully', trip });
  } catch (error: any) {
    logger.error('Error updating trip status', { error: error.message });
    res.status(500).json({ error: 'Failed to update trip status' });
  }
});

// Delete trip
router.delete('/trips/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const trip = await Trip.findById(id);
    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    // Clean up related data
    await Promise.all([
      Review.deleteMany({ targetId: id, reviewType: 'trip' }),
      Wishlist.deleteMany({ tripId: id })
    ]);

    await Trip.findByIdAndDelete(id);

    logger.info('Trip deleted', {
      adminId: (req as any).auth.userId,
      deletedTripId: id,
      deletedTripTitle: trip.title
    });

    res.json({ message: 'Trip deleted successfully' });
  } catch (error: any) {
    logger.error('Error deleting trip', { error: error.message });
    res.status(500).json({ error: 'Failed to delete trip' });
  }
});

// Get email service status
router.get('/email-status', async (req, res) => {
  try {
    const status = await emailService.getServiceStatus();
    res.json(status);
  } catch (error: any) {
    logger.error('Error getting email service status', { error: error.message });
    res.status(500).json({ error: 'Failed to get email service status' });
  }
});

// System cleanup endpoint
router.post('/cleanup', async (req, res) => {
  try {
    // Cleanup orphaned reviews
    const orphanedReviewsResult = await Review.deleteMany({
      $or: [
        { reviewerId: { $exists: false } },
        { targetId: { $exists: false } }
      ]
    });

    // Cleanup orphaned wishlist items
    const orphanedWishlistsResult = await Wishlist.deleteMany({
      $or: [
        { userId: { $exists: false } },
        { tripId: { $exists: false } }
      ]
    });

    // Update expired trips
    const expiredTripsResult = await Trip.updateMany(
      {
        endDate: { $lt: new Date() },
        status: 'active'
      },
      { status: 'completed' }
    );

    logger.info('System cleanup performed', {
      adminId: (req as any).auth.userId,
      orphanedReviews: orphanedReviewsResult.deletedCount,
      orphanedWishlists: orphanedWishlistsResult.deletedCount,
      expiredTrips: expiredTripsResult.modifiedCount
    });

    res.json({
      message: 'System cleanup completed successfully',
      results: {
        orphanedReviews: orphanedReviewsResult.deletedCount,
        orphanedWishlists: orphanedWishlistsResult.deletedCount,
        expiredTrips: expiredTripsResult.modifiedCount
      }
    });
  } catch (error: any) {
    logger.error('Error during system cleanup', { error: error.message });
    res.status(500).json({ error: 'Failed to perform system cleanup' });
  }
});

// ============================================
// ORGANIZER VERIFICATION SYSTEM
// ============================================

/**
 * GET /api/admin/organizer-verifications/pending
 * Get all pending organizer verification requests
 */
router.get('/organizer-verifications/pending', async (req, res) => {
  try {
    const pendingVerifications = await User.find({
      role: 'organizer',
      organizerVerificationStatus: 'pending'
    })
      .select('name email phone organizerProfile.bio organizerProfile.experience organizerProfile.specialties organizerVerificationSubmittedAt')
      .sort({ organizerVerificationSubmittedAt: -1 });

    res.json({
      success: true,
      count: pendingVerifications.length,
      verifications: pendingVerifications
    });
  } catch (error: any) {
    logger.error('Error fetching pending verifications', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch pending verifications' });
  }
});

/**
 * POST /api/admin/organizer-verifications/:userId/approve
 * Approve an organizer verification request
 */
router.post('/organizer-verifications/:userId/approve', async (req, res) => {
  try {
    const { userId } = req.params;
    const adminId = (req as any).auth.userId;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.role !== 'organizer') {
      return res.status(400).json({ error: 'User is not an organizer' });
    }

    if (user.organizerVerificationStatus !== 'pending') {
      return res.status(400).json({ error: 'Verification is not pending' });
    }

    user.organizerVerificationStatus = 'approved';
    user.organizerVerificationApprovedAt = new Date();
    user.organizerVerificationReviewedBy = adminId;
    user.isVerified = true;

    // Award reputation points for becoming verified
    if (!user.reputation) {
      user.reputation = {
        points: 0,
        level: 1,
        levelName: 'Explorer',
        badges: [],
        achievements: []
      };
    }
    user.reputation.points += 500; // Bonus for verification
    user.reputation.badges.push('verified_organizer');
    user.reputation.achievements.push({
      type: 'verification_approved',
      earnedAt: new Date(),
      description: 'Successfully verified as an organizer'
    });

    await user.save();

    // Send email notification
    try {
      await emailService.sendEmail({
        to: user.email,
        subject: 'Congratulations! Your Organizer Account is Verified',
        html: `
          <h1>Welcome to Trek Tribe Verified Organizers!</h1>
          <p>Dear ${user.name},</p>
          <p>Great news! Your organizer account has been approved and verified by our admin team.</p>
          <p>You can now:</p>
          <ul>
            <li>Create and manage trips</li>
            <li>Build your organizer profile</li>
            <li>Access premium organizer features</li>
            <li>Gain credibility with the verified badge</li>
          </ul>
          <p>You've earned <strong>500 reputation points</strong> for becoming verified!</p>
          <p>Start your journey by creating your first trip!</p>
          <p>Best regards,<br>Trek Tribe Team</p>
        `
      });
    } catch (emailError) {
      logger.error('Failed to send verification approval email', { error: emailError });
    }

    logger.info('Organizer verification approved', { userId, adminId });

    res.json({
      success: true,
      message: 'Organizer verified successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        verificationStatus: user.organizerVerificationStatus
      }
    });
  } catch (error: any) {
    logger.error('Error approving organizer verification', { error: error.message });
    res.status(500).json({ error: 'Failed to approve verification' });
  }
});

/**
 * POST /api/admin/organizer-verifications/:userId/reject
 * Reject an organizer verification request
 */
router.post('/organizer-verifications/:userId/reject', async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;
    const adminId = (req as any).auth.userId;

    if (!reason) {
      return res.status(400).json({ error: 'Rejection reason is required' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.role !== 'organizer') {
      return res.status(400).json({ error: 'User is not an organizer' });
    }

    if (user.organizerVerificationStatus !== 'pending') {
      return res.status(400).json({ error: 'Verification is not pending' });
    }

    user.organizerVerificationStatus = 'rejected';
    user.organizerVerificationRejectedAt = new Date();
    user.organizerVerificationRejectionReason = reason;
    user.organizerVerificationReviewedBy = adminId;

    await user.save();

    // Send email notification with rejection reason
    try {
      await emailService.sendEmail({
        to: user.email,
        subject: 'Trek Tribe Organizer Verification Update',
        html: `
          <h1>Organizer Verification Status Update</h1>
          <p>Dear ${user.name},</p>
          <p>Thank you for your interest in becoming a verified organizer on Trek Tribe.</p>
          <p>Unfortunately, we are unable to approve your verification request at this time.</p>
          <p><strong>Reason:</strong> ${reason}</p>
          <p>If you believe this was an error or would like to resubmit with additional information, please contact our support team.</p>
          <p>Best regards,<br>Trek Tribe Admin Team</p>
        `
      });
    } catch (emailError) {
      logger.error('Failed to send verification rejection email', { error: emailError });
    }

    logger.info('Organizer verification rejected', { userId, adminId, reason });

    res.json({
      success: true,
      message: 'Organizer verification rejected',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        verificationStatus: user.organizerVerificationStatus,
        rejectionReason: reason
      }
    });
  } catch (error: any) {
    logger.error('Error rejecting organizer verification', { error: error.message });
    res.status(500).json({ error: 'Failed to reject verification' });
  }
});

/**
 * GET /api/admin/organizer-verifications/all
 * Get all organizer verification requests (pending, approved, rejected)
 */
router.get('/organizer-verifications/all', async (req, res) => {
  try {
    const { status } = req.query;

    const filter: any = { role: 'organizer' };
    if (status && ['pending', 'approved', 'rejected'].includes(status as string)) {
      filter.organizerVerificationStatus = status;
    }

    const verifications = await User.find(filter)
      .select('name email phone organizerProfile organizerVerificationStatus organizerVerificationSubmittedAt organizerVerificationApprovedAt organizerVerificationRejectedAt organizerVerificationRejectionReason')
      .sort({ organizerVerificationSubmittedAt: -1 });

    res.json({
      success: true,
      count: verifications.length,
      verifications
    });
  } catch (error: any) {
    logger.error('Error fetching organizer verifications', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch verifications' });
  }
});

// ============================================================================
// ORGANIZER VERIFICATION REQUEST ENDPOINTS
// ============================================================================

/**
 * GET /admin/verification-requests
 * List all verification requests with filtering
 */
router.get('/verification-requests', async (req, res) => {
  try {
    const {
      status,
      requestType,
      priority,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const query: any = {};
    if (status) query.status = status;
    if (requestType) query.requestType = requestType;
    if (priority) query.priority = priority;

    const skip = (Number(page) - 1) * Number(limit);
    const sort: any = { [sortBy as string]: sortOrder === 'desc' ? -1 : 1 };

    const [requests, total] = await Promise.all([
      VerificationRequest.find(query)
        .populate('organizerId', 'name email phone createdAt')
        .populate('reviewedBy', 'name email')
        .sort(sort)
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      VerificationRequest.countDocuments(query)
    ]);

    // Get counts by status for summary
    const statusCounts = await VerificationRequest.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    const summary = {
      pending: statusCounts.find(s => s._id === 'pending')?.count || 0,
      under_review: statusCounts.find(s => s._id === 'under_review')?.count || 0,
      approved: statusCounts.find(s => s._id === 'approved')?.count || 0,
      rejected: statusCounts.find(s => s._id === 'rejected')?.count || 0,
      total
    };

    res.json({
      success: true,
      data: requests,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit))
      },
      summary
    });

    logger.info('Admin fetched verification requests', {
      adminId: (req as any).auth.userId,
      filters: { status, requestType, priority },
      count: requests.length
    });
  } catch (error: any) {
    logger.error('Error fetching verification requests', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch verification requests'
    });
  }
});

/**
 * GET /admin/verification-requests/:id
 * Get detailed information about a specific verification request
 */
router.get('/verification-requests/:id', async (req, res) => {
  try {
    const request = await VerificationRequest.findById(req.params.id)
      .populate('organizerId', 'name email phone createdAt organizerProfile')
      .populate('reviewedBy', 'name email')
      .lean();

    if (!request) {
      return res.status(404).json({
        success: false,
        error: 'Verification request not found'
      });
    }

    // Get organizer's trip history if exists
    const organizer = request.organizerId as any;
    let tripHistory = [];
    if (organizer && organizer._id) {
      tripHistory = await Trip.find({ organizerId: organizer._id })
        .select('title destination price status startDate participants createdAt')
        .sort({ createdAt: -1 })
        .limit(10)
        .lean();
    }

    res.json({
      success: true,
      data: {
        ...request,
        tripHistory
      }
    });

    logger.info('Admin viewed verification request details', {
      adminId: (req as any).auth.userId,
      requestId: req.params.id
    });
  } catch (error: any) {
    logger.error('Error fetching verification request details', {
      error: error.message,
      requestId: req.params.id
    });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch verification request details'
    });
  }
});

/**
 * POST /admin/verification-requests/:id/approve
 * Approve an organizer verification request
 */
router.post('/verification-requests/:id/approve', async (req, res) => {
  try {
    const {
      trustScore,
      verificationBadge,
      enableRouting = false,
      adminNotes
    } = req.body;

    // Validate trust score
    if (typeof trustScore !== 'number' || trustScore < 0 || trustScore > 100) {
      return res.status(400).json({
        success: false,
        error: 'Trust score must be a number between 0 and 100'
      });
    }

    // Validate verification badge
    const validBadges = ['none', 'bronze', 'silver', 'gold', 'platinum'];
    if (verificationBadge && !validBadges.includes(verificationBadge)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid verification badge'
      });
    }

    const request = await VerificationRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({
        success: false,
        error: 'Verification request not found'
      });
    }

    if (request.status === 'approved') {
      return res.status(400).json({
        success: false,
        error: 'Verification request already approved'
      });
    }

    const organizer = await User.findById(request.organizerId);
    if (!organizer) {
      return res.status(404).json({
        success: false,
        error: 'Organizer not found'
      });
    }

    // Calculate badge based on trust score if not provided
    let badge = verificationBadge;
    if (!badge) {
      if (trustScore >= 95) badge = 'platinum';
      else if (trustScore >= 85) badge = 'gold';
      else if (trustScore >= 70) badge = 'silver';
      else if (trustScore >= 50) badge = 'bronze';
      else badge = 'none';
    }

    // Update organizer profile with trust score
    if (!organizer.organizerProfile) {
      organizer.organizerProfile = {} as any;
    }

    organizer.organizerProfile.trustScore = {
      overall: trustScore,
      breakdown: {
        documentVerified: Math.min(trustScore * 0.2, 20),
        bankVerified: Math.min(trustScore * 0.2, 20),
        experienceYears: Math.min(trustScore * 0.15, 15),
        completedTrips: 0, // Will be updated as they complete trips
        userReviews: 0,    // Will be updated based on reviews
        responseTime: Math.min(trustScore * 0.1, 10),
        refundRate: Math.min(trustScore * 0.05, 5)
      },
      lastCalculated: new Date()
    };

    organizer.organizerProfile.verificationBadge = badge as any;
    organizer.organizerProfile.routingEnabled = enableRouting;

    // Update verification status
    organizer.organizerVerificationStatus = 'approved';
    organizer.organizerVerificationApprovedAt = new Date();
    organizer.organizerVerificationApprovedBy = (req as any).auth.userId;

    await organizer.save();

    // Update verification request
    request.status = 'approved';
    request.reviewedBy = (req as any).auth.userId;
    request.reviewedAt = new Date();
    request.adminNotes = adminNotes || '';
    request.initialTrustScore = trustScore;

    await request.save();

    // Send approval email to organizer
    try {
      await emailService.sendEmail({
        to: organizer.email,
        subject: '🎉 Your TrekTribe Organizer Account is Approved!',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #10b981;">Congratulations! Your Account is Approved</h2>
            <p>Dear ${organizer.name},</p>
            <p>Great news! Your TrekTribe organizer account has been approved by our admin team.</p>
            
            <div style="background-color: #f0fdf4; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #059669;">Your Verification Details:</h3>
              <p><strong>Trust Score:</strong> ${trustScore}/100</p>
              <p><strong>Verification Badge:</strong> ${badge.charAt(0).toUpperCase() + badge.slice(1)}</p>
              <p><strong>Payment Routing:</strong> ${enableRouting ? 'Enabled ✅' : 'Disabled (Main Platform Account)'}</p>
            </div>

            <p>You can now:</p>
            <ul>
              <li>✅ Create and publish trips</li>
              <li>✅ Manage bookings and participants</li>
              <li>✅ Receive payments ${enableRouting ? 'directly to your account' : 'through platform payouts'}</li>
              <li>✅ Access organizer dashboard</li>
            </ul>

            ${adminNotes ? `
              <div style="background-color: #f9fafb; padding: 15px; margin: 20px 0; border-radius: 8px;">
                <p><strong>Admin Notes:</strong></p>
                <p style="margin: 5px 0;">${adminNotes}</p>
              </div>
            ` : ''}

            <p>Start creating amazing travel experiences for our community!</p>
            
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/organizer/dashboard" 
               style="display: inline-block; background-color: #10b981; color: white; padding: 12px 24px; 
                      text-decoration: none; border-radius: 6px; margin-top: 20px;">
              Go to Dashboard
            </a>

            <p style="margin-top: 30px; color: #6b7280; font-size: 14px;">
              Need help? Contact us at support@trektribe.com
            </p>
          </div>
        `
      });
    } catch (emailError: any) {
      logger.error('Failed to send approval email', {
        organizerId: organizer._id,
        error: emailError.message
      });
      // Don't fail the approval if email fails
    }

    res.json({
      success: true,
      message: 'Organizer approved successfully',
      data: {
        organizerId: organizer._id,
        trustScore,
        verificationBadge: badge,
        routingEnabled: enableRouting,
        approvedAt: new Date()
      }
    });

    logger.info('Admin approved organizer verification', {
      adminId: (req as any).auth.userId,
      organizerId: organizer._id,
      requestId: req.params.id,
      trustScore,
      badge,
      routingEnabled: enableRouting
    });
  } catch (error: any) {
    logger.error('Error approving verification request', {
      error: error.message,
      requestId: req.params.id
    });
    res.status(500).json({
      success: false,
      error: 'Failed to approve verification request'
    });
  }
});

/**
 * POST /admin/verification-requests/:id/reject
 * Reject an organizer verification request
 */
router.post('/verification-requests/:id/reject', async (req, res) => {
  try {
    const { rejectionReason, adminNotes } = req.body;

    if (!rejectionReason || rejectionReason.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Rejection reason is required'
      });
    }

    const request = await VerificationRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({
        success: false,
        error: 'Verification request not found'
      });
    }

    if (request.status === 'rejected') {
      return res.status(400).json({
        success: false,
        error: 'Verification request already rejected'
      });
    }

    const organizer = await User.findById(request.organizerId);
    if (!organizer) {
      return res.status(404).json({
        success: false,
        error: 'Organizer not found'
      });
    }

    // Update organizer verification status
    organizer.organizerVerificationStatus = 'rejected';
    organizer.organizerVerificationRejectedAt = new Date();
    organizer.organizerVerificationRejectionReason = rejectionReason;

    await organizer.save();

    // Update verification request
    request.status = 'rejected';
    request.reviewedBy = (req as any).auth.userId;
    request.reviewedAt = new Date();
    request.adminNotes = adminNotes || rejectionReason;

    await request.save();

    // Send rejection email to organizer
    try {
      await emailService.sendEmail({
        to: organizer.email,
        subject: 'TrekTribe Organizer Account - Verification Update',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #dc2626;">Organizer Verification Update</h2>
            <p>Dear ${organizer.name},</p>
            <p>Thank you for your interest in becoming a TrekTribe organizer.</p>
            
            <p>After careful review, we are unable to approve your organizer account at this time.</p>

            <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 15px; margin: 20px 0;">
              <p><strong>Reason:</strong></p>
              <p style="margin: 5px 0;">${rejectionReason}</p>
            </div>

            <p>You may reapply for organizer verification after addressing the issues mentioned above.</p>
            
            <p>If you have questions or would like more information, please contact our support team.</p>

            <p style="margin-top: 30px; color: #6b7280; font-size: 14px;">
              Contact us at support@trektribe.com
            </p>
          </div>
        `
      });
    } catch (emailError: any) {
      logger.error('Failed to send rejection email', {
        organizerId: organizer._id,
        error: emailError.message
      });
      // Don't fail the rejection if email fails
    }

    res.json({
      success: true,
      message: 'Organizer verification rejected',
      data: {
        organizerId: organizer._id,
        rejectionReason,
        rejectedAt: new Date()
      }
    });

    logger.info('Admin rejected organizer verification', {
      adminId: (req as any).auth.userId,
      organizerId: organizer._id,
      requestId: req.params.id,
      reason: rejectionReason
    });
  } catch (error: any) {
    logger.error('Error rejecting verification request', {
      error: error.message,
      requestId: req.params.id
    });
    res.status(500).json({
      success: false,
      error: 'Failed to reject verification request'
    });
  }
});

/**
 * PUT /admin/verification-requests/:id/status
 * Update verification request status (e.g., mark as under review)
 */
router.put('/verification-requests/:id/status', async (req, res) => {
  try {
    const { status, priority, adminNotes } = req.body;

    const validStatuses = ['pending', 'under_review', 'approved', 'rejected'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status. Must be: pending, under_review, approved, or rejected'
      });
    }

    const request = await VerificationRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({
        success: false,
        error: 'Verification request not found'
      });
    }

    request.status = status;
    if (priority) request.priority = priority;
    if (adminNotes) request.adminNotes = adminNotes;

    // Set reviewed fields when status changes to approved/rejected
    if (['approved', 'rejected'].includes(status)) {
      request.reviewedBy = (req as any).auth.userId;
      request.reviewedAt = new Date();
    }

    await request.save();

    res.json({
      success: true,
      message: 'Verification request status updated',
      data: request
    });

    logger.info('Admin updated verification request status', {
      adminId: (req as any).auth.userId,
      requestId: req.params.id,
      newStatus: status
    });
  } catch (error: any) {
    logger.error('Error updating verification request status', {
      error: error.message,
      requestId: req.params.id
    });
    res.status(500).json({
      success: false,
      error: 'Failed to update verification request status'
    });
  }
});

/**
 * POST /admin/verification-requests/:id/recalculate-score
 * Recalculate trust score for an organizer
 */
router.post('/verification-requests/:id/recalculate-score', async (req, res) => {
  try {
    const request = await VerificationRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({
        success: false,
        error: 'Verification request not found'
      });
    }

    const organizer = await User.findById(request.organizerId);
    if (!organizer) {
      return res.status(404).json({
        success: false,
        error: 'Organizer not found'
      });
    }

    // Calculate new trust score
    const trustScore = await TrustScoreService.calculateTrustScore(request.organizerId.toString());

    // Update organizer profile
    if (!organizer.organizerProfile) {
      organizer.organizerProfile = {} as any;
    }

    organizer.organizerProfile.trustScore = trustScore;
    organizer.organizerProfile.verificationBadge = TrustScoreService.getBadgeForScore(trustScore.overall);

    await organizer.save();

    // Get improvement recommendations
    const recommendations = TrustScoreService.getImprovementRecommendations(trustScore.breakdown);

    res.json({
      success: true,
      message: 'Trust score recalculated successfully',
      data: {
        trustScore,
        verificationBadge: organizer.organizerProfile.verificationBadge,
        isEligibleForRouting: TrustScoreService.isEligibleForRouting(trustScore.overall),
        recommendations
      }
    });

    logger.info('Admin recalculated organizer trust score', {
      adminId: (req as any).auth.userId,
      organizerId: organizer._id,
      oldScore: organizer.organizerProfile.trustScore?.overall || 0,
      newScore: trustScore.overall
    });
  } catch (error: any) {
    logger.error('Error recalculating trust score', {
      error: error.message,
      requestId: req.params.id
    });
    res.status(500).json({
      success: false,
      error: 'Failed to recalculate trust score'
    });
  }
});

// Get User Subscription (Admin)
router.get('/users/:id/subscription', async (req, res) => {
  try {
    const { id } = req.params;
    const subscription = await OrganizerSubscription.findOne({ organizerId: id });

    if (!subscription) {
      return res.json({ hasSubscription: false });
    }

    res.json({
      hasSubscription: true,
      subscription: {
        ...subscription.toObject(),
        crmAccess: subscription.crmAccess || false // Ensure it returns explicit false if undefined
      }
    });
  } catch (error: any) {
    logger.error('Error fetching user subscription', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch subscription' });
  }
});

// Manage User Subscription (Admin Manual Override)
router.post('/users/:id/subscription-override', async (req, res) => {
  try {
    const { id } = req.params;
    const { crmAccess, addTrips, setPlan } = req.body;
    const adminId = (req as any).auth.userId;

    let subscription = await OrganizerSubscription.findOne({ organizerId: id });

    if (!subscription) {
      // If user is organizer but has no subscription, create one
      const user = await User.findById(id);
      if (user && (user.role === 'organizer' || user.role === 'admin')) {
        subscription = await OrganizerSubscription.create({
          organizerId: id,
          plan: 'free-trial', // Default
          status: 'trial',
          isTrialActive: true
        });
      } else {
        return res.status(404).json({ error: 'No subscription found and user is not an organizer' });
      }
    }

    const updates: any = {};

    if (crmAccess !== undefined) {
      subscription.crmAccess = crmAccess;
      updates.crmAccess = crmAccess;
    }

    if (addTrips && typeof addTrips === 'number') {
      subscription.tripsRemaining = (subscription.tripsRemaining || 0) + addTrips;
      subscription.tripsPerCycle = Math.max(subscription.tripsPerCycle, subscription.tripsRemaining);
      updates.tripsAdded = addTrips;
    }

    if (setPlan) {
      subscription.plan = setPlan;
      updates.plan = setPlan;
    }

    await subscription.save();

    logger.info('Admin updated user subscription manually', {
      adminId,
      targetUserId: id,
      updates
    });

    res.json({ success: true, subscription });
  } catch (error: any) {
    logger.error('Error updating subscription override', { error: error.message });
    res.status(500).json({ error: 'Failed to update subscription' });
  }
});

// ==========================================
// TRUST SCORE & VERIFICATION ROUTES
// ==========================================

// Calculate and update organizer trust score
router.post('/users/:id/trust-score', async (req, res) => {
  try {
    const { id } = req.params;
    const { manualScore } = req.body; // Optional: manual trust score assignment
    const adminId = (req as any).auth.userId;

    // Check if user exists and is an organizer
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.role !== 'organizer') {
      return res.status(400).json({ error: 'Trust score is only applicable for organizers' });
    }

    let trustScore;

    // If manual score provided, use it (admin override)
    if (typeof manualScore === 'number') {
      if (manualScore < 0 || manualScore > 100) {
        return res.status(400).json({ error: 'Trust score must be between 0 and 100' });
      }

      // Create a manual trust score breakdown
      trustScore = {
        overall: manualScore,
        breakdown: {
          documentVerified: Math.min(manualScore * 0.2, 20),
          bankVerified: Math.min(manualScore * 0.2, 20),
          experienceYears: Math.min(manualScore * 0.15, 15),
          completedTrips: 0,
          userReviews: 0,
          responseTime: Math.min(manualScore * 0.1, 10),
          refundRate: Math.min(manualScore * 0.05, 5)
        },
        lastCalculated: new Date()
      };

      // Update user with manual score
      if (!user.organizerProfile) {
        user.organizerProfile = {} as any;
      }

      user.organizerProfile.trustScore = trustScore;
      user.organizerProfile.verificationBadge = TrustScoreService.getBadgeForScore(manualScore) as any;
      await user.save();

      logger.info('Admin manually assigned trust score', {
        adminId,
        organizerId: id,
        score: manualScore
      });
    } else {
      // Recalculate using service
      trustScore = await TrustScoreService.updateOrganizerTrustScore(id);

      logger.info('Trust score recalculated by admin', {
        adminId,
        organizerId: id,
        newScore: trustScore.overall
      });
    }

    res.json({
      success: true,
      message: manualScore !== undefined ? 'Trust score assigned successfully' : 'Trust score recalculated successfully',
      trustScore,
      badge: TrustScoreService.getBadgeForScore(trustScore.overall)
    });

  } catch (error: any) {
    logger.error('Error calculating trust score', { error: error.message });
    res.status(500).json({ error: 'Failed to calculate trust score' });
  }
});

// Verify organizer (Manual or based on score)
router.post('/users/:id/verify-organizer', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body; // status: 'approved' | 'rejected'
    const adminId = (req as any).auth.userId;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid verification status' });
    }

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.organizerVerificationStatus = status;
    // We also update the generic isVerified flag for compatibility
    user.isVerified = status === 'approved';

    // Store verification details in organizerProfile if needed, or we might need to add fields to User model
    // For now, assuming isVerified is the main gate.

    await user.save();

    // Notify organizer
    try {
      if (user.email) {
        const subject = status === 'approved'
          ? 'Your Organizer Account is Verified! 🎉'
          : 'Update on your Organizer Account Application';

        const html = status === 'approved'
          ? `<p>Hi ${user.name},</p><p>Congratulations! Your account has been verified. You can now publish trips and accept bookings.</p>`
          : `<p>Hi ${user.name},</p><p>Thank you for your application. Unfortunately, we could not verify your account at this time.</p><p>Reason: ${notes || 'Does not meet criteria'}</p>`;

        await emailService.sendEmail({ to: user.email, subject, html });
      }
    } catch (e) {
      logger.warn('Failed to send verification email', { error: (e as any).message });
    }

    logger.info('Organizer verification updated', {
      adminId,
      organizerId: id,
      status
    });

    res.json({ message: `Organizer ${status} successfully`, user });

  } catch (error: any) {
    logger.error('Error verifying organizer', { error: error.message });
    res.status(500).json({ error: 'Failed to verify organizer' });
  }
});

// Email Service Health Check
router.get('/email/health', async (req, res) => {
  try {
    const emailStatus = await emailService.getServiceStatus();
    const { emailQueue } = await import('../services/emailQueue');
    const queueStats = await emailQueue.getQueueStats();

    res.json({
      email: emailStatus,
      queue: {
        ...queueStats,
        healthy: queueStats.failed < 10,
      },
      timestamp: new Date(),
    });
  } catch (error: any) {
    logger.error('Error checking email health', { error: error.message });
    res.status(500).json({ error: 'Failed to check email health' });
  }
});

export default router;