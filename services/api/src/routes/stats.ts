import express from 'express';
import { User } from '../models/User';
import { Trip } from '../models/Trip';
import { GroupBooking } from '../models/GroupBooking';
import { Review } from '../models/Review';
import { logger } from '../utils/logger';

const router = express.Router();

// Get platform statistics
router.get('/', async (req, res) => {
  try {
    const [
      totalUsers,
      totalOrganizers,
      totalTrips,
      totalBookings,
      totalReviews
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: 'organizer' }),
      Trip.countDocuments({ status: 'active' }),
      GroupBooking.countDocuments({ status: 'confirmed' }),
      Review.countDocuments()
    ]);

    // Get recent activity (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const [
      recentUsers,
      recentTrips,
      recentBookings
    ] = await Promise.all([
      User.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
      Trip.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
      GroupBooking.countDocuments({ createdAt: { $gte: thirtyDaysAgo } })
    ]);

    // Get popular destinations from active trips
    const popularDestinations = await Trip.aggregate([
      { $match: { status: 'active' } },
      { $group: { _id: '$destination', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);

    // Get trip categories distribution from active trips
    const categoryStats = await Trip.aggregate([
      { $match: { status: 'active' } },
      { $unwind: '$categories' },
      { $group: { _id: '$categories', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Get unique countries count from active trips
    const countries = await Trip.distinct('destination', { status: 'active' });
    const uniqueCountries = new Set(
      countries.map(dest => dest?.split(',')[0]?.trim()).filter(Boolean)
    ).size;

    res.json({
      success: true,
      data: {
        users: {
          total: totalUsers,
          organizers: totalOrganizers,
          travelers: totalUsers - totalOrganizers,
          recent: recentUsers
        },
        trips: {
          total: totalTrips,
          recent: recentTrips,
          totalBookings: totalBookings,
          countries: uniqueCountries
        },
        bookings: {
          total: totalBookings,
          recent: recentBookings
        },
        reviews: {
          total: totalReviews
        },
        analytics: {
          popularDestinations: popularDestinations.map(d => ({
            destination: d._id,
            tripCount: d.count
          })),
          categoryDistribution: categoryStats.map(c => ({
            category: c._id,
            count: c.count
          }))
        }
      }
    });

  } catch (error: any) {
    logger.error('Error fetching platform statistics', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch statistics'
    });
  }
});

// Get real-time dashboard stats for agents/admins
router.get('/dashboard', async (req, res) => {
  try {
    const [
      activeTickets,
      pendingBookings,
      todayBookings,
      weeklyRevenue
    ] = await Promise.all([
      // Count active support tickets
      require('../models/SupportTicket').SupportTicket.countDocuments({ 
        status: { $in: ['open', 'in-progress'] } 
      }),
      // Count pending bookings
      GroupBooking.countDocuments({ status: 'pending' }),
      // Count today's bookings
      GroupBooking.countDocuments({
        createdAt: {
          $gte: new Date(new Date().setHours(0, 0, 0, 0)),
          $lt: new Date(new Date().setHours(23, 59, 59, 999))
        }
      }),
      // Calculate weekly revenue
      GroupBooking.aggregate([
        {
          $match: {
            createdAt: {
              $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
            },
            status: 'confirmed'
          }
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$totalAmount' }
          }
        }
      ])
    ]);

    const revenue = weeklyRevenue.length > 0 ? weeklyRevenue[0].totalRevenue : 0;

    res.json({
      success: true,
      data: {
        activeTickets,
        pendingBookings,
        todayBookings,
        weeklyRevenue: revenue,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error: any) {
    logger.error('Error fetching dashboard statistics', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard statistics'
    });
  }
});

export default router;
