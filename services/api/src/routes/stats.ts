import express from 'express';
import { User } from '../models/User';
import { prisma } from '../lib/prisma';
import { toNumber } from '../lib/money';
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
      prisma.trip.count({ where: { status: 'active' } }),
      // Was `{ status: 'confirmed' }`. GroupBooking has no `status` field - it
      // has bookingStatus and paymentStatus - so this matched nothing and the
      // public stats page has always reported zero bookings. Postgres refuses
      // the unknown column outright, which is how it came to light.
      prisma.groupBooking.count({ where: { bookingStatus: 'confirmed' } }),
      prisma.review.count()
    ]);

    // Get recent activity (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const [
      recentUsers,
      recentTrips,
      recentBookings
    ] = await Promise.all([
      User.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
      prisma.trip.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      prisma.groupBooking.count({ where: { createdAt: { gte: thirtyDaysAgo } } })
    ]);

    // Get popular destinations from active trips
    const destinationGroups = await prisma.trip.groupBy({
      by: ['destination'],
      where: { status: 'active' },
      _count: { destination: true },
      orderBy: { _count: { destination: 'desc' } },
      take: 5
    });
    const popularDestinations = destinationGroups.map(g => ({
      _id: g.destination,
      count: g._count.destination
    }));

    // Get trip categories distribution from active trips
    // categories is a text array. $unwind flattened it before grouping;
    // unnest() is the same operation, and Prisma's groupBy cannot express it.
    const categoryRows = await prisma.$queryRaw<Array<{ category: string; count: bigint }>>`
      SELECT unnest(categories) AS category, count(*) AS count
        FROM trips
       WHERE status = 'active'
       GROUP BY 1
       ORDER BY count DESC
    `;
    const categoryStats = categoryRows.map(r => ({ _id: r.category, count: Number(r.count) }));

    // Get unique countries count from active trips
    const distinctDestinations = await prisma.trip.findMany({
      where: { status: 'active' },
      distinct: ['destination'],
      select: { destination: true }
    });
    const uniqueCountries = new Set(
      distinctDestinations.map(d => d.destination?.split(',')[0]?.trim()).filter(Boolean)
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
      // The stored labels keep their hyphens, but the Prisma member is spelled
      // in_progress - see the @map on SupportStatus.
      prisma.supportTicket.count({
        where: { status: { in: ['open', 'in_progress'] } }
      }),
      // Count pending bookings. Same wrong field as above: `status` does not
      // exist on this model, so the admin dashboard has shown zero pending
      // bookings and zero weekly revenue for as long as this endpoint existed.
      prisma.groupBooking.count({ where: { bookingStatus: 'pending' } }),
      // Count today's bookings
      prisma.groupBooking.count({
        where: {
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
            lt: new Date(new Date().setHours(23, 59, 59, 999))
          }
        }
      }),
      // Calculate weekly revenue
      prisma.groupBooking.aggregate({
        where: {
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
          bookingStatus: 'confirmed'
        },
        _sum: { totalAmount: true }
      })
    ]);

    const revenue = toNumber(weeklyRevenue._sum.totalAmount);

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
