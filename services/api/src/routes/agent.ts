import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { User } from '../models/User';
import { Trip } from '../models/Trip';
import { Query } from '../models/Query';
import { SosAlert } from '../models/SosAlert';
import { Dispute } from '../models/Dispute';
import { FraudReport } from '../models/FraudReport';
import { authenticateJwt } from '../middleware/auth';
import { AuthenticatedRequest, requireAgent } from '../middleware/roleMiddleware';

const router = Router();

// All agent routes require authentication and agent role
router.use(authenticateJwt);
router.use(requireAgent);

// ==============================================
// AGENT DASHBOARD
// ==============================================

router.get('/dashboard', async (req: any, res: any) => {
  try {
    const agentId = req.auth.userId;
    
    const [
      pendingQueries,
      myAssignedQueries,
      sosAlerts,
      pendingDisputes,
      myAssignedDisputes,
      fraudReports,
      tripsAwaitingApproval,
      recentActivity
    ] = await Promise.all([
      Query.countDocuments({ status: 'pending' }),
      Query.countDocuments({ assignedAgentId: agentId, status: { $in: ['assigned', 'in_progress'] } }),
      SosAlert.countDocuments({ status: { $in: ['active', 'acknowledged'] } }),
      Dispute.countDocuments({ status: { $in: ['pending', 'under_review'] } }),
      Dispute.countDocuments({ assignedAgentId: agentId, status: { $in: ['under_review', 'investigating'] } }),
      FraudReport.countDocuments({ status: { $in: ['reported', 'under_investigation'] } }),
      Trip.countDocuments({ status: 'draft' }), // Trips waiting for approval
      
      // Recent activity for this agent
      Promise.all([
        Query.find({ assignedAgentId: agentId })
          .sort({ updatedAt: -1 })
          .limit(5)
          .populate('userId', 'name email')
          .select('subject category status priority updatedAt'),
        SosAlert.find({ assignedAgentId: agentId })
          .sort({ updatedAt: -1 })
          .limit(3)
          .populate('userId', 'name email')
          .select('type priority status message updatedAt')
      ])
    ]);

    const [recentQueries, recentSosAlerts] = recentActivity;

    res.json({
      success: true,
      data: {
        overview: {
          pendingQueries,
          myAssignedQueries,
          activeSosAlerts: sosAlerts,
          pendingDisputes,
          myAssignedDisputes,
          activeFraudReports: fraudReports,
          tripsAwaitingApproval
        },
        recentActivity: {
          queries: recentQueries,
          sosAlerts: recentSosAlerts
        },
        workload: {
          totalAssigned: myAssignedQueries + myAssignedDisputes,
          urgentItems: await Query.countDocuments({ 
            assignedAgentId: agentId, 
            priority: 'urgent', 
            status: { $in: ['assigned', 'in_progress'] } 
          }) + await SosAlert.countDocuments({
            assignedAgentId: agentId,
            priority: 'critical',
            status: { $in: ['active', 'acknowledged'] }
          })
        }
      }
    });
  } catch (error: any) {
    console.error('Error fetching agent dashboard:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

// ==============================================
// QUERY HANDLING
// ==============================================

// Get queries for agent (pending + assigned to them)
router.get('/queries', async (req: any, res: any) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = req.query.status as string;
    const priority = req.query.priority as string;
    const category = req.query.category as string;
    const assigned = req.query.assigned as string; // 'me' | 'unassigned' | 'all'

    let filter: any = {};
    
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (category) filter.category = category;
    
    // Filter by assignment
    if (assigned === 'me') {
      filter.assignedAgentId = req.auth.userId;
    } else if (assigned === 'unassigned') {
      filter.assignedAgentId = { $exists: false };
    }
    // 'all' shows everything the agent can see

    const [queries, totalQueries] = await Promise.all([
      Query.find(filter)
        .populate('userId', 'name email phone')
        .populate('assignedAgentId', 'name email')
        .populate('relatedTripId', 'title destination')
        .sort({ priority: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Query.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: {
        queries,
        pagination: {
          page,
          limit,
          totalQueries,
          totalPages: Math.ceil(totalQueries / limit)
        }
      }
    });
  } catch (error: any) {
    console.error('Error fetching queries:', error);
    res.status(500).json({ error: 'Failed to fetch queries' });
  }
});

// Assign query to self
router.put('/queries/:queryId/assign', async (req: any, res: any) => {
  try {
    const { queryId } = req.params;
    const agentId = req.auth.userId;

    const query = await Query.findByIdAndUpdate(
      queryId,
      {
        assignedAgentId: agentId,
        assignedAt: new Date(),
        status: 'assigned'
      },
      { new: true }
    ).populate('userId', 'name email phone');

    if (!query) {
      return res.status(404).json({ error: 'Query not found' });
    }

    res.json({
      success: true,
      message: 'Query assigned successfully',
      data: { query }
    });
  } catch (error: any) {
    console.error('Error assigning query:', error);
    res.status(500).json({ error: 'Failed to assign query' });
  }
});

// Respond to query
const respondToQuerySchema = z.object({
  message: z.string().min(1),
  status: z.enum(['in_progress', 'resolved']).optional(),
  isInternal: z.boolean().optional()
});

router.post('/queries/:queryId/respond', async (req: any, res: any) => {
  try {
    const { queryId } = req.params;
    const parsed = respondToQuerySchema.safeParse(req.body);
    
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    const agentId = req.auth.userId;
    const { message, status, isInternal } = parsed.data;

    const updateData: any = {
      $push: {
        responses: {
          from: 'agent',
          message,
          createdAt: new Date()
        }
      }
    };

    if (status) {
      updateData.status = status;
      if (status === 'resolved') {
        updateData.resolvedAt = new Date();
      }
    }

    // Set first response time if this is the first response
    const existingQuery = await Query.findById(queryId);
    if (existingQuery && !existingQuery.firstResponseAt) {
      updateData.firstResponseAt = new Date();
    }

    const query = await Query.findByIdAndUpdate(queryId, updateData, { new: true })
      .populate('userId', 'name email phone');

    if (!query) {
      return res.status(404).json({ error: 'Query not found' });
    }

    res.json({
      success: true,
      message: 'Response sent successfully',
      data: { query }
    });
  } catch (error: any) {
    console.error('Error responding to query:', error);
    res.status(500).json({ error: 'Failed to respond to query' });
  }
});

// ==============================================
// TRIP MODERATION
// ==============================================

// Get trips pending approval
router.get('/trips/pending', async (req: any, res: any) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const [trips, totalTrips] = await Promise.all([
      Trip.find({ status: 'draft' })
        .populate('organizerId', 'name email phone averageRating totalTripsOrganized')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Trip.countDocuments({ status: 'draft' })
    ]);

    res.json({
      success: true,
      data: {
        trips,
        pagination: {
          page,
          limit,
          totalTrips,
          totalPages: Math.ceil(totalTrips / limit)
        }
      }
    });
  } catch (error: any) {
    console.error('Error fetching pending trips:', error);
    res.status(500).json({ error: 'Failed to fetch pending trips' });
  }
});

// Approve/Reject trip
const moderateTripSchema = z.object({
  action: z.enum(['approve', 'reject']),
  reason: z.string().optional(),
  feedback: z.string().optional()
});

router.put('/trips/:tripId/moderate', async (req: any, res: any) => {
  try {
    const { tripId } = req.params;
    const parsed = moderateTripSchema.safeParse(req.body);
    
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    const { action, reason, feedback } = parsed.data;
    const agentId = req.auth.userId;

    const updateData: any = {
      status: action === 'approve' ? 'published' : 'cancelled',
      moderatedBy: agentId,
      moderatedAt: new Date()
    };

    if (reason) updateData.moderationReason = reason;
    if (feedback) updateData.moderationFeedback = feedback;

    const trip = await Trip.findByIdAndUpdate(tripId, updateData, { new: true })
      .populate('organizerId', 'name email');

    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    res.json({
      success: true,
      message: `Trip ${action === 'approve' ? 'approved' : 'rejected'} successfully`,
      data: { trip }
    });
  } catch (error: any) {
    console.error('Error moderating trip:', error);
    res.status(500).json({ error: 'Failed to moderate trip' });
  }
});

// ==============================================
// SOS ALERTS / EMERGENCY SUPPORT
// ==============================================

// Get SOS alerts
router.get('/sos-alerts', async (req: any, res: any) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = req.query.status as string;
    const priority = req.query.priority as string;
    const assigned = req.query.assigned as string;

    let filter: any = {};
    
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    
    if (assigned === 'me') {
      filter.assignedAgentId = req.auth.userId;
    } else if (assigned === 'unassigned') {
      filter.assignedAgentId = { $exists: false };
    }

    const [alerts, totalAlerts] = await Promise.all([
      SosAlert.find(filter)
        .populate('userId', 'name email phone emergencyContacts')
        .populate('tripId', 'title destination organizerId')
        .populate('assignedAgentId', 'name email')
        .sort({ priority: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      SosAlert.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: {
        alerts,
        pagination: {
          page,
          limit,
          totalAlerts,
          totalPages: Math.ceil(totalAlerts / limit)
        }
      }
    });
  } catch (error: any) {
    console.error('Error fetching SOS alerts:', error);
    res.status(500).json({ error: 'Failed to fetch SOS alerts' });
  }
});

// Acknowledge SOS alert
router.put('/sos-alerts/:alertId/acknowledge', async (req: any, res: any) => {
  try {
    const { alertId } = req.params;
    const agentId = req.auth.userId;

    const alert = await SosAlert.findByIdAndUpdate(
      alertId,
      {
        status: 'acknowledged',
        assignedAgentId: agentId,
        acknowledgedAt: new Date(),
        acknowledgedBy: agentId
      },
      { new: true }
    ).populate('userId', 'name email phone emergencyContacts');

    if (!alert) {
      return res.status(404).json({ error: 'SOS alert not found' });
    }

    res.json({
      success: true,
      message: 'SOS alert acknowledged',
      data: { alert }
    });
  } catch (error: any) {
    console.error('Error acknowledging SOS alert:', error);
    res.status(500).json({ error: 'Failed to acknowledge SOS alert' });
  }
});

// Add action to SOS alert
const addSosActionSchema = z.object({
  action: z.string().min(1),
  isInternal: z.boolean().optional()
});

router.post('/sos-alerts/:alertId/actions', async (req: any, res: any) => {
  try {
    const { alertId } = req.params;
    const parsed = addSosActionSchema.safeParse(req.body);
    
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    const agentId = req.auth.userId;
    const { action } = parsed.data;

    const alert = await SosAlert.findByIdAndUpdate(
      alertId,
      {
        $push: {
          actionsTaken: {
            agentId,
            action,
            timestamp: new Date()
          }
        }
      },
      { new: true }
    );

    if (!alert) {
      return res.status(404).json({ error: 'SOS alert not found' });
    }

    res.json({
      success: true,
      message: 'Action recorded successfully',
      data: { alert }
    });
  } catch (error: any) {
    console.error('Error adding SOS action:', error);
    res.status(500).json({ error: 'Failed to add action' });
  }
});

// ==============================================
// DISPUTE RESOLUTION
// ==============================================

// Get disputes
router.get('/disputes', async (req: any, res: any) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = req.query.status as string;
    const type = req.query.type as string;
    const assigned = req.query.assigned as string;

    let filter: any = {};
    
    if (status) filter.status = status;
    if (type) filter.type = type;
    
    if (assigned === 'me') {
      filter.assignedAgentId = req.auth.userId;
    } else if (assigned === 'unassigned') {
      filter.assignedAgentId = { $exists: false };
    }

    const [disputes, totalDisputes] = await Promise.all([
      Dispute.find(filter)
        .populate('userId', 'name email phone')
        .populate('tripId', 'title destination price')
        .populate('organizerId', 'name email')
        .populate('assignedAgentId', 'name email')
        .sort({ priority: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Dispute.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: {
        disputes,
        pagination: {
          page,
          limit,
          totalDisputes,
          totalPages: Math.ceil(totalDisputes / limit)
        }
      }
    });
  } catch (error: any) {
    console.error('Error fetching disputes:', error);
    res.status(500).json({ error: 'Failed to fetch disputes' });
  }
});

// ==============================================
// FRAUD MONITORING
// ==============================================

// Get fraud reports
router.get('/fraud-reports', async (req: any, res: any) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = req.query.status as string;
    const type = req.query.type as string;
    const severity = req.query.severity as string;

    let filter: any = {};
    
    if (status) filter.status = status;
    if (type) filter.type = type;
    if (severity) filter.severity = severity;

    const [reports, totalReports] = await Promise.all([
      FraudReport.find(filter)
        .populate('reportedBy', 'name email')
        .populate('assignedAgentId', 'name email')
        .sort({ severity: -1, riskScore: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      FraudReport.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: {
        reports,
        pagination: {
          page,
          limit,
          totalReports,
          totalPages: Math.ceil(totalReports / limit)
        }
      }
    });
  } catch (error: any) {
    console.error('Error fetching fraud reports:', error);
    res.status(500).json({ error: 'Failed to fetch fraud reports' });
  }
});

// ==============================================
// USER VERIFICATION
// ==============================================

// Get users pending verification
router.get('/users/pending-verification', async (req: any, res: any) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const verificationType = req.query.type as string; // 'email' | 'phone' | 'organizer'

    let filter: any = {};
    
    if (verificationType === 'email') {
      filter.emailVerified = false;
    } else if (verificationType === 'phone') {
      filter.phoneVerified = false;
    } else if (verificationType === 'organizer') {
      filter.role = 'organizer';
      filter.isActive = false; // Organizers pending approval
    }

    const [users, totalUsers] = await Promise.all([
      User.find(filter)
        .select('-passwordHash -googleId')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      User.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          page,
          limit,
          totalUsers,
          totalPages: Math.ceil(totalUsers / limit)
        }
      }
    });
  } catch (error: any) {
    console.error('Error fetching users for verification:', error);
    res.status(500).json({ error: 'Failed to fetch users for verification' });
  }
});

export default router;
