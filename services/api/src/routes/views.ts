import { Router } from 'express';
import { User } from '../models/User';
import { prisma } from '../lib/prisma';

const router = Router();

// Basic view routes for the application
router.get('/', (req, res) => {
  res.json({
    message: 'Trek Tribe API Server',
    status: 'running',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

router.get('/404', (req, res) => {
  res.status(404).json({
    error: 'Page not found',
    path: req.originalUrl
  });
});

router.get('/error', (req, res) => {
  res.status(500).json({
    error: 'Internal server error',
    message: 'Something went wrong'
  });
});

// Public stats endpoint for homepage
router.get('/stats', async (req, res) => {
  try {
    // Get basic counts
    const [totalUsers, totalTrips, totalReviews] = await Promise.all([
      User.countDocuments(),
      prisma.trip.count(),
      prisma.review.count()
    ]);

    // Get users by role
    const usersByRole = await User.aggregate([
      { $group: { _id: '$role', count: { $sum: 1 } } },
      { $project: { role: '$_id', count: 1, _id: 0 } }
    ]);

    // Calculate total bookings from trip participants. Was every trip loaded so
    // the participant arrays could be summed in JavaScript; it is a count.
    const totalBookings = await prisma.tripParticipant.count();

    // Get organizer count
    const organizerCount = usersByRole.find(role => role.role === 'organizer')?.count || 0;

    res.json({
      totalTrips: totalTrips,
      totalBookings: totalBookings,
      totalUsers: totalUsers,
      totalOrganizers: organizerCount,
      totalReviews: totalReviews
    });
  } catch (error: any) {
    console.error('Error fetching public stats:', error);
    res.status(500).json({
      error: 'Failed to fetch statistics',
      message: error.message
    });
  }
});

export default router;