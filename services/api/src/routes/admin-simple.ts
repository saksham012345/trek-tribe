import { Router } from 'express';
import { authenticateJwt } from '../middleware/auth';
import { User } from '../models/User';
import { Trip } from '../models/Trip';
import mongoose from 'mongoose';

const router = Router();

// Simple middleware to check if user is admin or agent
const isAdminOrAgent = (req: any, res: any, next: any) => {
  if (!req.auth) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  if (req.auth.role !== 'admin' && req.auth.role !== 'agent') {
    return res.status(403).json({ error: 'Admin or agent access required' });
  }
  
  next();
};

// Apply authentication to all admin routes
router.use(authenticateJwt);
router.use(isAdminOrAgent);

// Dashboard overview with real database data
router.get('/dashboard', async (req: any, res: any) => {
  try {
    // Get current date ranges
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    // Parallel database queries for better performance
    const [
      totalUsers,
      totalTrips,
      newUsersLast30,
      newUsersLast60,
      newTripsLast30,
      newTripsLast60,
      usersByRole,
      tripsByStatus,
      recentUsers,
      recentTrips
    ] = await Promise.all([
      User.countDocuments({ isActive: true }),
      Trip.countDocuments(),
      User.countDocuments({ createdAt: { $gte: thirtyDaysAgo }, isActive: true }),
      User.countDocuments({ createdAt: { $gte: sixtyDaysAgo }, isActive: true }),
      Trip.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
      Trip.countDocuments({ createdAt: { $gte: sixtyDaysAgo } }),
      User.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: '$role', count: { $sum: 1 } } }
      ]),
      Trip.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      User.find({ isActive: true })
        .select('name email role createdAt emailVerified phoneVerified')
        .sort({ createdAt: -1 })
        .limit(5),
      Trip.find()
        .select('title destination status createdAt organizerId')
        .populate('organizerId', 'name email')
        .sort({ createdAt: -1 })
        .limit(5)
    ]);

    // Calculate growth rates
    const oldUsersLast30 = newUsersLast60 - newUsersLast30;
    const userGrowthRate = oldUsersLast30 > 0 
      ? ((newUsersLast30 - oldUsersLast30) / oldUsersLast30) * 100 
      : newUsersLast30 > 0 ? 100 : 0;

    const oldTripsLast30 = newTripsLast60 - newTripsLast30;
    const tripGrowthRate = oldTripsLast30 > 0 
      ? ((newTripsLast30 - oldTripsLast30) / oldTripsLast30) * 100 
      : newTripsLast30 > 0 ? 100 : 0;

    // Format user role distribution
    const roleDistribution = usersByRole.reduce((acc: any, item: any) => {
      acc[item._id] = item.count;
      return acc;
    }, { traveler: 0, organizer: 0, admin: 0, agent: 0 });

    // Format trip status distribution
    const statusDistribution = tripsByStatus.reduce((acc: any, item: any) => {
      acc[item._id] = item.count;
      return acc;
    }, { active: 0, cancelled: 0, completed: 0 });

    const dashboardData = {
      success: true,
      data: {
        overview: {
          totalUsers,
          totalTrips,
          activeChats: 0, // TODO: Implement when chat system is ready
          pendingChats: 0
        },
        growth: {
          userGrowthRate: Math.round(userGrowthRate * 10) / 10,
          tripGrowthRate: Math.round(tripGrowthRate * 10) / 10,
          newUsersLast30,
          newTripsLast30
        },
        recent: {
          users: recentUsers,
          trips: recentTrips
        },
        distribution: {
          usersByRole: roleDistribution,
          tripsByStatus: statusDistribution
        }
      }
    };
    
    res.json(dashboardData);
  } catch (error: any) {
    console.error('Error fetching admin dashboard:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

// System health check with real data
router.get('/system', async (req: any, res: any) => {
  try {
    const [
      totalUsers,
      totalTrips,
      activeAgents,
      dbStats
    ] = await Promise.all([
      User.countDocuments({ isActive: true }),
      Trip.countDocuments(),
      User.countDocuments({ role: 'agent', isActive: true }),
mongoose.connection.db ? mongoose.connection.db.stats() : { collections: 0, dataSize: 0, indexSize: 0, storageSize: 0 }
    ]);

    const systemInfo = {
      success: true,
      data: {
        database: {
          users: totalUsers,
          trips: totalTrips,
          chats: 0, // TODO: Implement when chat system is ready
          collections: dbStats.collections,
          dataSize: Math.round(dbStats.dataSize / 1024 / 1024 * 100) / 100, // MB
          indexSize: Math.round(dbStats.indexSize / 1024 / 1024 * 100) / 100, // MB
          storageSize: Math.round(dbStats.storageSize / 1024 / 1024 * 100) / 100 // MB
        },
        agents: {
          active: activeAgents
        },
        system: {
          status: 'healthy',
          uptime: Math.round(process.uptime()),
          memory: {
            used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024 * 100) / 100, // MB
            total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024 * 100) / 100 // MB
          },
          nodeVersion: process.version
        }
      }
    };
    
    res.json(systemInfo);
  } catch (error: any) {
    console.error('Error fetching system stats:', error);
    res.status(500).json({ error: 'Failed to fetch system stats' });
  }
});

// Users list with real database data and pagination
router.get('/users', async (req: any, res: any) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;
    const search = req.query.search as string;
    const role = req.query.role as string;
    const status = req.query.status as string;

    // Build query filter
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
    
    if (status === 'active') {
      query.isActive = true;
    } else if (status === 'inactive') {
      query.isActive = false;
    }

    // Execute queries in parallel
    const [
      users,
      totalUsers
    ] = await Promise.all([
      User.find(query)
        .select('-passwordHash -googleId') // Exclude sensitive fields
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      User.countDocuments(query)
    ]);

    const totalPages = Math.ceil(totalUsers / limit);
    const hasNext = page < totalPages;
    const hasPrev = page > 1;

    const usersData = {
      success: true,
      data: {
        users,
        pagination: {
          page,
          limit,
          totalUsers,
          totalPages,
          hasNext,
          hasPrev
        }
      }
    };
    
    res.json(usersData);
  } catch (error: any) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Support tickets/chats - placeholder implementation
router.get('/chats', async (req: any, res: any) => {
  try {
    // TODO: Implement when chat/support system is built
    // For now, return empty data structure
    const chatsData = {
      success: true,
      data: {
        chats: [], // No chat system implemented yet
        pagination: {
          page: 1,
          limit: 20,
          totalChats: 0,
          totalPages: 0,
          hasNext: false,
          hasPrev: false
        },
        message: 'Chat system is under development. No support tickets available.'
      }
    };
    
    res.json(chatsData);
  } catch (error: any) {
    console.error('Error fetching chats:', error);
    res.status(500).json({ error: 'Failed to fetch chats' });
  }
});

// Get specific user details
router.get('/users/:userId', async (req: any, res: any) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findById(userId).select('-passwordHash -googleId');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({
      success: true,
      data: { user }
    });
  } catch (error: any) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Update user role and status (admin only)
router.put('/users/:userId', async (req: any, res: any) => {
  try {
    const { userId } = req.params;
    const { role, isActive } = req.body;
    
    // Only admin can modify user roles
    if (req.auth.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required for user modifications' });
    }
    
    // Validate role
    if (role && !['traveler', 'organizer', 'admin', 'agent'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role specified' });
    }
    
    const updateData: any = {};
    if (role !== undefined) updateData.role = role;
    if (isActive !== undefined) updateData.isActive = isActive;
    
    const user = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, select: '-passwordHash -googleId' }
    );
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({
      success: true,
      message: 'User updated successfully',
      data: { user }
    });
  } catch (error: any) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Get trips with real database data
router.get('/trips', async (req: any, res: any) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;
    const search = req.query.search as string;
    const status = req.query.status as string;
    const organizerId = req.query.organizerId as string;

    // Build query filter
    const query: any = {};
    
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { destination: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (status && status !== 'all') {
      query.status = status;
    }
    
    if (organizerId) {
      query.organizerId = organizerId;
    }

    // Execute queries in parallel
    const [
      trips,
      totalTrips
    ] = await Promise.all([
      Trip.find(query)
        .populate('organizerId', 'name email role')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Trip.countDocuments(query)
    ]);

    const totalPages = Math.ceil(totalTrips / limit);
    const hasNext = page < totalPages;
    const hasPrev = page > 1;

    const tripsData = {
      success: true,
      data: {
        trips,
        pagination: {
          page,
          limit,
          totalTrips,
          totalPages,
          hasNext,
          hasPrev
        }
      }
    };
    
    res.json(tripsData);
  } catch (error: any) {
    console.error('Error fetching trips:', error);
    res.status(500).json({ error: 'Failed to fetch trips' });
  }
});

// Update trip status (admin only)
router.put('/trips/:tripId', async (req: any, res: any) => {
  try {
    const { tripId } = req.params;
    const { status } = req.body;
    
    // Validate status
    if (!['active', 'cancelled', 'completed'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status specified' });
    }
    
    const trip = await Trip.findByIdAndUpdate(
      tripId,
      { status },
      { new: true }
    ).populate('organizerId', 'name email');
    
    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }
    
    res.json({
      success: true,
      message: 'Trip updated successfully',
      data: { trip }
    });
  } catch (error: any) {
    console.error('Error updating trip:', error);
    res.status(500).json({ error: 'Failed to update trip' });
  }
});

export default router;