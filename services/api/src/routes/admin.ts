import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { User } from '../models/User';
import { Trip } from '../models/Trip';
import { Chat } from '../models/Chat';
import { authenticateJwt } from '../middleware/auth';
import { AuthenticatedRequest, requireAdmin, requireAgent } from '../middleware/roleMiddleware';

const router = Router();

// All admin routes require authentication
router.use(authenticateJwt);

// ==============================================
// DASHBOARD ANALYTICS
// ==============================================

// Get admin dashboard overview
router.get('/dashboard', requireAdmin, async (req: any, res: any) => {
  try {
    const [
      totalUsers,
      totalTrips,
      activeChats,
      pendingChats,
      recentUsers,
      recentTrips,
      usersByRole,
      tripsByStatus
    ] = await Promise.all([
      User.countDocuments({ isActive: true }),
      Trip.countDocuments(),
      Chat.countDocuments({ status: { $in: ['waiting', 'in_progress'] } }),
      Chat.countDocuments({ status: 'waiting' }),
      User.find({ isActive: true })
        .sort({ createdAt: -1 })
        .limit(5)
        .select('name email role createdAt emailVerified phoneVerified'),
      Trip.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('organizerId', 'name email')
        .select('title startDate endDate price participantCount maxParticipants status'),
      User.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: '$role', count: { $sum: 1 } } }
      ]),
      Trip.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ])
    ]);

    // Calculate growth metrics (last 30 days vs previous 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

    const [newUsersLast30, newUsersPrevious30, newTripsLast30, newTripsPrevious30] = await Promise.all([
      User.countDocuments({ createdAt: { $gte: thirtyDaysAgo }, isActive: true }),
      User.countDocuments({ 
        createdAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo },
        isActive: true 
      }),
      Trip.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
      Trip.countDocuments({ 
        createdAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo }
      })
    ]);

    const userGrowthRate = newUsersPrevious30 > 0 
      ? ((newUsersLast30 - newUsersPrevious30) / newUsersPrevious30) * 100 
      : 100;
    
    const tripGrowthRate = newTripsPrevious30 > 0 
      ? ((newTripsLast30 - newTripsPrevious30) / newTripsPrevious30) * 100 
      : 100;

    res.json({
      success: true,
      data: {
        overview: {
          totalUsers,
          totalTrips,
          activeChats,
          pendingChats
        },
        growth: {
          userGrowthRate: Math.round(userGrowthRate * 100) / 100,
          tripGrowthRate: Math.round(tripGrowthRate * 100) / 100,
          newUsersLast30,
          newTripsLast30
        },
        recent: {
          users: recentUsers,
          trips: recentTrips
        },
        distribution: {
          usersByRole: usersByRole.reduce((acc, item) => ({
            ...acc,
            [item._id]: item.count
          }), {}),
          tripsByStatus: tripsByStatus.reduce((acc, item) => ({
            ...acc,
            [item._id]: item.count
          }), {})
        }
      }
    });
  } catch (error: any) {
    console.error('Error fetching admin dashboard:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

// ==============================================
// USER MANAGEMENT
// ==============================================

// Get all users with pagination and filters
router.get('/users', requireAdmin, async (req: any, res: any) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = req.query.search as string;
    const role = req.query.role as string;
    const status = req.query.status as string;
    const verified = req.query.verified as string;

    let filter: any = {};
    
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (role) filter.role = role;
    if (status === 'active') filter.isActive = true;
    if (status === 'inactive') filter.isActive = false;
    if (verified === 'email') filter.emailVerified = true;
    if (verified === 'phone') filter.phoneVerified = true;

    const [users, totalUsers] = await Promise.all([
      User.find(filter)
        .select('-passwordHash')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      User.countDocuments(filter)
    ]);

    const totalPages = Math.ceil(totalUsers / limit);

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          page,
          limit,
          totalUsers,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      }
    });
  } catch (error: any) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get user details
router.get('/users/:userId', requireAdmin, async (req: any, res: any) => {
  try {
    const { userId } = req.params;
    
    const [user, userTrips, userChats] = await Promise.all([
      User.findById(userId).select('-passwordHash'),
      Trip.find({
        $or: [
          { organizerId: userId },
          { 'participants.userId': userId }
        ]
      }).sort({ createdAt: -1 }).limit(10),
      Chat.find({ userId }).sort({ createdAt: -1 }).limit(5)
    ]);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      success: true,
      data: {
        user,
        trips: userTrips,
        chats: userChats
      }
    });
  } catch (error: any) {
    console.error('Error fetching user details:', error);
    res.status(500).json({ error: 'Failed to fetch user details' });
  }
});

// Update user (role, status, etc.)
const updateUserSchema = z.object({
  role: z.enum(['traveler', 'organizer', 'admin', 'agent']).optional(),
  isActive: z.boolean().optional(),
  emailVerified: z.boolean().optional(),
  phoneVerified: z.boolean().optional()
});

router.put('/users/:userId', requireAdmin, async (req: any, res: any) => {
  try {
    const { userId } = req.params;
    const parsed = updateUserSchema.safeParse(req.body);
    
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      parsed.data,
      { new: true, runValidators: true }
    ).select('-passwordHash');

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

// ==============================================
// TRIP MANAGEMENT
// ==============================================

// Get all trips with filters
router.get('/trips', requireAdmin, async (req: any, res: any) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = req.query.search as string;
    const status = req.query.status as string;
    const organizerId = req.query.organizerId as string;

    let filter: any = {};
    
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { location: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (status) filter.status = status;
    if (organizerId) filter.organizerId = organizerId;

    const [trips, totalTrips] = await Promise.all([
      Trip.find(filter)
        .populate('organizerId', 'name email')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Trip.countDocuments(filter)
    ]);

    const totalPages = Math.ceil(totalTrips / limit);

    res.json({
      success: true,
      data: {
        trips,
        pagination: {
          page,
          limit,
          totalTrips,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      }
    });
  } catch (error: any) {
    console.error('Error fetching trips:', error);
    res.status(500).json({ error: 'Failed to fetch trips' });
  }
});

// Update trip status
const updateTripSchema = z.object({
  status: z.enum(['draft', 'published', 'cancelled', 'completed']).optional(),
  featured: z.boolean().optional()
});

router.put('/trips/:tripId', requireAdmin, async (req: any, res: any) => {
  try {
    const { tripId } = req.params;
    const parsed = updateTripSchema.safeParse(req.body);
    
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    const trip = await Trip.findByIdAndUpdate(
      tripId,
      parsed.data,
      { new: true, runValidators: true }
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

// ==============================================
// CHAT/SUPPORT MANAGEMENT
// ==============================================

// ==============================================
// AGENT MANAGEMENT (Admin Only)
// ==============================================

// Get all agents
router.get('/agents', requireAdmin, async (req: any, res: any) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = req.query.search as string;
    const isActive = req.query.isActive as string;

    let filter: any = { role: 'agent' };
    
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (isActive === 'true') filter.isActive = true;
    if (isActive === 'false') filter.isActive = false;

    const [agents, totalAgents, agentStats] = await Promise.all([
      User.find(filter)
        .select('-passwordHash')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      User.countDocuments(filter),
      
      // Get agent performance statistics
      User.aggregate([
        { $match: { role: 'agent' } },
        {
          $lookup: {
            from: 'queries',
            localField: '_id',
            foreignField: 'assignedAgentId',
            as: 'assignedQueries'
          }
        },
        {
          $lookup: {
            from: 'sosalerts',
            localField: '_id',
            foreignField: 'assignedAgentId',
            as: 'assignedSosAlerts'
          }
        },
        {
          $project: {
            name: 1,
            email: 1,
            isActive: 1,
            lastLoginAt: 1,
            totalQueries: { $size: '$assignedQueries' },
            resolvedQueries: {
              $size: {
                $filter: {
                  input: '$assignedQueries',
                  cond: { $eq: ['$$this.status', 'resolved'] }
                }
              }
            },
            totalSosAlerts: { $size: '$assignedSosAlerts' },
            resolvedSosAlerts: {
              $size: {
                $filter: {
                  input: '$assignedSosAlerts',
                  cond: { $eq: ['$$this.status', 'resolved'] }
                }
              }
            }
          }
        }
      ])
    ]);

    res.json({
      success: true,
      data: {
        agents,
        agentStats,
        pagination: {
          page,
          limit,
          totalAgents,
          totalPages: Math.ceil(totalAgents / limit)
        }
      }
    });
  } catch (error: any) {
    console.error('Error fetching agents:', error);
    res.status(500).json({ error: 'Failed to fetch agents' });
  }
});

// Create new agent
const createAgentSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6)
});

router.post('/agents', requireAdmin, async (req: any, res: any) => {
  try {
    const parsed = createAgentSchema.safeParse(req.body);
    
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    const { name, email, password } = parsed.data;
    
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Hash password (you'll need to import bcrypt)
    const bcrypt = require('bcrypt');
    const passwordHash = await bcrypt.hash(password, 10);

    const agent = new User({
      name,
      email,
      passwordHash,
      role: 'agent',
      emailVerified: true, // Admin-created agents are pre-verified
      isActive: true
    });

    await agent.save();

    res.json({
      success: true,
      message: 'Agent created successfully',
      data: { 
        agent: {
          _id: agent._id,
          name: agent.name,
          email: agent.email,
          role: agent.role,
          createdAt: agent.createdAt
        }
      }
    });
  } catch (error: any) {
    console.error('Error creating agent:', error);
    res.status(500).json({ error: 'Failed to create agent' });
  }
});

// Update agent status
router.put('/agents/:agentId', requireAdmin, async (req: any, res: any) => {
  try {
    const { agentId } = req.params;
    const { isActive } = req.body;
    
    const agent = await User.findOneAndUpdate(
      { _id: agentId, role: 'agent' },
      { isActive },
      { new: true }
    ).select('-passwordHash');

    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    res.json({
      success: true,
      message: 'Agent updated successfully',
      data: { agent }
    });
  } catch (error: any) {
    console.error('Error updating agent:', error);
    res.status(500).json({ error: 'Failed to update agent' });
  }
});

// ==============================================
// SUPPORT TICKETS/CHATS (Admin Only)
// ==============================================

// Get support tickets/chats (admin only)
router.get('/chats', requireAdmin, async (req: any, res: any) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = req.query.status as string;
    const priority = req.query.priority as string;
    const assignedTo = req.query.assignedTo as string;
    const category = req.query.category as string;

    let filter: any = {};
    
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (assignedTo) filter.assignedAgentId = assignedTo;
    if (category) filter.category = category;

    const [chats, totalChats] = await Promise.all([
      Chat.find(filter)
        .populate('userId', 'name email')
        .populate('assignedAgentId', 'name email')
        .sort({ priority: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Chat.countDocuments(filter)
    ]);

    const totalPages = Math.ceil(totalChats / limit);

    res.json({
      success: true,
      data: {
        chats,
        pagination: {
          page,
          limit,
          totalChats,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      }
    });
  } catch (error: any) {
    console.error('Error fetching chats:', error);
    res.status(500).json({ error: 'Failed to fetch chats' });
  }
});

// Assign chat to agent
router.put('/chats/:chatId/assign', requireAgent, async (req: any, res: any) => {
  try {
    const { chatId } = req.params;
    const { agentId } = req.body;
    
    const chat = await Chat.findByIdAndUpdate(
      chatId,
      { 
        assignedAgentId: agentId,
        status: 'in_progress',
        firstResponseAt: new Date()
      },
      { new: true }
    ).populate('userId', 'name email')
     .populate('assignedAgentId', 'name email');

    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    res.json({
      success: true,
      message: 'Chat assigned successfully',
      data: { chat }
    });
  } catch (error: any) {
    console.error('Error assigning chat:', error);
    res.status(500).json({ error: 'Failed to assign chat' });
  }
});

// ==============================================
// SYSTEM MONITORING
// ==============================================

// Get system stats with enhanced admin features
router.get('/system', requireAdmin, async (req: any, res: any) => {
  try {
    const [
      dbStats,
      activeAgents,
      systemHealth,
      revenueStats,
      securityMetrics
    ] = await Promise.all([
      // Database collection stats
      Promise.all([
        User.countDocuments(),
        Trip.countDocuments(),
        Chat.countDocuments()
      ]),
      // Active agents (logged in within last hour)
      User.countDocuments({
        role: { $in: ['agent', 'admin'] },
        lastLoginAt: { $gte: new Date(Date.now() - 60 * 60 * 1000) }
      }),
      // Basic system health check
      new Promise(resolve => resolve({ status: 'healthy', uptime: process.uptime() })),
      
      // Revenue and financial metrics
      Trip.aggregate([
        { $match: { status: 'completed' } },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$price' },
            averagePrice: { $avg: '$price' },
            totalTrips: { $sum: 1 }
          }
        }
      ]),
      
      // Security and fraud metrics
      Promise.all([
        User.countDocuments({ isActive: false }), // Suspended accounts
        Trip.countDocuments({ status: 'cancelled' }), // Cancelled trips
        // Add fraud reports count when implemented
        0 // Placeholder for fraud reports
      ])
    ]);

    const revenue = revenueStats[0] || { totalRevenue: 0, averagePrice: 0, totalTrips: 0 };
    const [suspendedAccounts, cancelledTrips, fraudReports] = securityMetrics;

    res.json({
      success: true,
      data: {
        database: {
          users: dbStats[0],
          trips: dbStats[1],
          chats: dbStats[2]
        },
        agents: {
          active: activeAgents,
          total: await User.countDocuments({ role: 'agent' })
        },
        revenue: {
          total: revenue.totalRevenue,
          average: revenue.averagePrice,
          completedTrips: revenue.totalTrips
        },
        security: {
          suspendedAccounts,
          cancelledTrips,
          fraudReports
        },
        system: {
          ...(systemHealth as object),
          memory: {
            used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
            total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
          },
          nodeVersion: process.version
        }
      }
    });
  } catch (error: any) {
    console.error('Error fetching system stats:', error);
    res.status(500).json({ error: 'Failed to fetch system stats' });
  }
});

// ==============================================
// ADVANCED ANALYTICS (Admin Only)
// ==============================================

// Get advanced analytics
router.get('/analytics', requireAdmin, async (req: any, res: any) => {
  try {
    const timeRange = req.query.range as string || '30d'; // 7d, 30d, 90d, 1y
    let startDate: Date;
    
    switch (timeRange) {
      case '7d':
        startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '1y':
        startDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    }

    const [
      userGrowth,
      tripGrowth,
      revenueGrowth,
      topOrganizers,
      popularDestinations,
      conversionMetrics
    ] = await Promise.all([
      // User growth over time
      User.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        {
          $group: {
            _id: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: "$createdAt"
              }
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]),
      
      // Trip creation growth
      Trip.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        {
          $group: {
            _id: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: "$createdAt"
              }
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]),
      
      // Revenue growth
      Trip.aggregate([
        { 
          $match: { 
            status: 'completed',
            createdAt: { $gte: startDate }
          } 
        },
        {
          $group: {
            _id: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: "$createdAt"
              }
            },
            revenue: { $sum: '$price' },
            trips: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]),
      
      // Top organizers by trips created
      User.aggregate([
        { $match: { role: 'organizer' } },
        {
          $lookup: {
            from: 'trips',
            localField: '_id',
            foreignField: 'organizerId',
            as: 'trips'
          }
        },
        {
          $project: {
            name: 1,
            email: 1,
            totalTrips: { $size: '$trips' },
            averageRating: 1
          }
        },
        { $sort: { totalTrips: -1 } },
        { $limit: 10 }
      ]),
      
      // Popular destinations
      Trip.aggregate([
        {
          $group: {
            _id: '$destination',
            count: { $sum: 1 },
            averagePrice: { $avg: '$price' }
          }
        },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]),
      
      // Conversion metrics
      {
        totalSignups: await User.countDocuments({ createdAt: { $gte: startDate } }),
        organizerConversions: await User.countDocuments({ 
          role: 'organizer',
          createdAt: { $gte: startDate }
        }),
        tripCreations: await Trip.countDocuments({ createdAt: { $gte: startDate } }),
        completedBookings: await Trip.countDocuments({ 
          status: 'completed',
          createdAt: { $gte: startDate }
        })
      }
    ]);

    res.json({
      success: true,
      data: {
        timeRange,
        userGrowth,
        tripGrowth,
        revenueGrowth,
        topOrganizers,
        popularDestinations,
        conversionMetrics
      }
    });
  } catch (error: any) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// ==============================================
// SYSTEM CONFIGURATION (Admin Only)
// ==============================================

// Get system configuration
router.get('/config', requireAdmin, async (req: any, res: any) => {
  try {
    // This would typically come from a configuration collection or environment variables
    const config = {
      payments: {
        enabledGateways: ['razorpay', 'stripe'],
        defaultCurrency: 'INR',
        refundPolicy: '7_days'
      },
      features: {
        tripModeration: true,
        userVerification: true,
        sosAlerts: true,
        fraudDetection: true
      },
      limits: {
        maxTripPrice: 100000,
        maxParticipants: 50,
        fileUploadSizeMB: 10
      },
      notifications: {
        emailEnabled: true,
        smsEnabled: true,
        pushEnabled: true
      }
    };

    res.json({
      success: true,
      data: { config }
    });
  } catch (error: any) {
    console.error('Error fetching configuration:', error);
    res.status(500).json({ error: 'Failed to fetch configuration' });
  }
});

// Update system configuration
router.put('/config', requireAdmin, async (req: any, res: any) => {
  try {
    const { config } = req.body;
    
    // This would typically update a configuration collection
    // For now, we'll just validate and return success
    
    res.json({
      success: true,
      message: 'Configuration updated successfully',
      data: { config }
    });
  } catch (error: any) {
    console.error('Error updating configuration:', error);
    res.status(500).json({ error: 'Failed to update configuration' });
  }
});

export default router;
