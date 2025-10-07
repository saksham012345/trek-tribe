import express from 'express';
import { User } from '../models/User';
import { Trip } from '../models/Trip';
import { Review } from '../models/Review';
import { Wishlist } from '../models/Wishlist';
import { authenticateJwt, requireRole } from '../middleware/auth';
import { logger } from '../utils/logger';
import { emailService } from '../services/emailService';

const router = express.Router();

// All admin routes require admin role
router.use(authenticateJwt);
router.use(requireRole(['admin']));

// Get dashboard statistics
router.get('/stats', async (req, res) => {
  try {
    // Get basic counts
    const [totalUsers, totalTrips, totalReviews, totalWishlists] = await Promise.all([
      User.countDocuments(),
      Trip.countDocuments(),
      Review.countDocuments(),
      Wishlist.countDocuments()
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

    // Calculate total bookings and revenue
    const tripsWithParticipants = await Trip.find({}, 'participants price');
    let totalBookings = 0;
    let totalRevenue = 0;
    
    tripsWithParticipants.forEach(trip => {
      totalBookings += trip.participants.length;
      totalRevenue += trip.participants.length * trip.price;
    });

    // Get recent data
    const recentUsers = await User.find({}, 'name email role createdAt')
      .sort({ createdAt: -1 })
      .limit(5)
      .select('-passwordHash');

    const recentTrips = await Trip.find({}, 'title destination price status createdAt')
      .populate('organizerId', 'name')
      .sort({ createdAt: -1 })
      .limit(5);

    res.json({
      overview: {
        totalUsers,
        totalTrips,
        totalBookings,
        totalRevenue,
        totalReviews,
        totalWishlists
      },
      users: {
        total: totalUsers,
        byRole: usersByRole,
        recentUsers
      },
      trips: {
        total: totalTrips,
        byStatus: tripsByStatus,
        recentTrips,
        totalBookings,
        totalRevenue
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

// Update user role
router.patch('/users/:id/role', async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!['user', 'organizer', 'admin', 'agent'].includes(role)) {
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

export default router;