import { Router } from 'express';
import { z } from 'zod';
import { TripTracking } from '../models/TripTracking';
import { Trip } from '../models/Trip';
import { User } from '../models/User';
import { authenticateJwt, requireRole } from '../middleware/auth';

const router = Router();

// Initialize trip tracking when a trip is created
router.post('/trips/:tripId/initialize', authenticateJwt, requireRole(['organizer', 'admin']), async (req, res) => {
  try {
    const userId = (req as any).auth.userId;
    const { tripId } = req.params;

    // Check if trip exists and user is the organizer
    const trip = await Trip.findById(tripId);
    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    if (trip.organizerId.toString() !== userId) {
      return res.status(403).json({ error: 'Not authorized to initialize tracking for this trip' });
    }

    // Check if tracking already exists
    const existingTracking = await TripTracking.findOne({ tripId });
    if (existingTracking) {
      return res.json({ tracking: existingTracking });
    }

    // Get all participants with their details
    const participants = await User.find({ 
      _id: { $in: trip.participants } 
    }).select('name');

    const trackingData = {
      tripId,
      organizerId: userId,
      status: 'not_started' as const,
      participants: participants.map(p => ({
        userId: (p._id as any).toString(),
        userName: p.name,
        status: 'joined' as const
      })),
      emergencyAlerts: []
    };

    const tracking = await TripTracking.create(trackingData);
    res.status(201).json({ tracking });

  } catch (error: any) {
    console.error('Error initializing trip tracking:', error);
    res.status(500).json({ error: 'Failed to initialize trip tracking' });
  }
});

// Start trip tracking
router.post('/trips/:tripId/start', authenticateJwt, requireRole(['organizer', 'admin']), async (req, res) => {
  try {
    const userId = (req as any).auth.userId;
    const { tripId } = req.params;

    const tracking = await TripTracking.findOne({ tripId });
    if (!tracking) {
      return res.status(404).json({ error: 'Trip tracking not found. Initialize tracking first.' });
    }

    if (tracking.organizerId.toString() !== userId) {
      return res.status(403).json({ error: 'Not authorized to start tracking for this trip' });
    }

    tracking.status = 'active';
    tracking.startedAt = new Date();
    await tracking.save();

    // TODO: Send notifications to emergency contacts about trip start
    
    res.json({ tracking, message: 'Trip tracking started' });

  } catch (error: any) {
    console.error('Error starting trip tracking:', error);
    res.status(500).json({ error: 'Failed to start trip tracking' });
  }
});

// Update participant location
const locationUpdateSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  altitude: z.number().optional(),
  accuracy: z.number().optional()
});

router.post('/trips/:tripId/location', authenticateJwt, async (req, res) => {
  try {
    const userId = (req as any).auth.userId;
    const { tripId } = req.params;
    
    const parsed = locationUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    const { latitude, longitude, altitude, accuracy } = parsed.data;
    
    const tracking = await TripTracking.findOne({ tripId });
    if (!tracking) {
      return res.status(404).json({ error: 'Trip tracking not found' });
    }

    // Find participant
    const participantIndex = tracking.participants.findIndex(
      p => p.userId.toString() === userId
    );

    if (participantIndex === -1) {
      return res.status(403).json({ error: 'You are not a participant in this trip' });
    }

    const locationPoint = {
      latitude,
      longitude,
      altitude,
      accuracy,
      timestamp: new Date()
    };

    // Update participant location
    const participant = tracking.participants[participantIndex];
    participant.lastLocation = locationPoint;
    participant.lastCheckIn = new Date();
    
    // Update status if first location update
    if (participant.status === 'joined') {
      participant.status = 'active';
      participant.startLocation = locationPoint;
    }

    // Add to location history (keep last 100 locations)
    if (!participant.locationHistory) {
      participant.locationHistory = [];
    }
    participant.locationHistory.push(locationPoint);
    if (participant.locationHistory.length > 100) {
      participant.locationHistory = participant.locationHistory.slice(-100);
    }

    await tracking.save();
    res.json({ message: 'Location updated successfully', location: locationPoint });

  } catch (error: any) {
    console.error('Error updating location:', error);
    res.status(500).json({ error: 'Failed to update location' });
  }
});

// Complete trip for a participant
router.post('/trips/:tripId/complete', authenticateJwt, async (req, res) => {
  try {
    const userId = (req as any).auth.userId;
    const { tripId } = req.params;
    
    const locationData = locationUpdateSchema.safeParse(req.body);
    
    const tracking = await TripTracking.findOne({ tripId });
    if (!tracking) {
      return res.status(404).json({ error: 'Trip tracking not found' });
    }

    // Find participant
    const participantIndex = tracking.participants.findIndex(
      p => p.userId.toString() === userId
    );

    if (participantIndex === -1) {
      return res.status(403).json({ error: 'You are not a participant in this trip' });
    }

    const participant = tracking.participants[participantIndex];
    participant.status = 'completed';
    
    if (locationData.success) {
      const { latitude, longitude, altitude, accuracy } = locationData.data;
      participant.endLocation = {
        latitude,
        longitude,
        altitude,
        accuracy,
        timestamp: new Date()
      };
    }

    // Check if all participants completed
    const allCompleted = tracking.participants.every(p => p.status === 'completed');
    if (allCompleted) {
      tracking.status = 'completed';
      tracking.completedAt = new Date();
    }

    await tracking.save();
    
    // TODO: Send completion notifications to emergency contacts
    
    res.json({ message: 'Trip marked as completed', tracking });

  } catch (error: any) {
    console.error('Error completing trip:', error);
    res.status(500).json({ error: 'Failed to complete trip' });
  }
});

// Get trip tracking data
router.get('/trips/:tripId', authenticateJwt, async (req, res) => {
  try {
    const userId = (req as any).auth.userId;
    const { tripId } = req.params;

    const tracking = await TripTracking.findOne({ tripId });
    if (!tracking) {
      return res.status(404).json({ error: 'Trip tracking not found' });
    }

    // Check if user is organizer or participant
    const isOrganizer = tracking.organizerId.toString() === userId;
    const isParticipant = tracking.participants.some(p => p.userId.toString() === userId);

    if (!isOrganizer && !isParticipant) {
      return res.status(403).json({ error: 'Not authorized to view this trip tracking' });
    }

    // If participant, only return their own detailed location data
    if (!isOrganizer) {
      const userParticipant = tracking.participants.find(p => p.userId.toString() === userId);
      const sanitizedTracking = {
        ...tracking.toObject(),
        participants: tracking.participants.map(p => ({
          userId: p.userId,
          userName: p.userName,
          status: p.status,
          lastCheckIn: p.lastCheckIn,
          // Only include detailed location for the requesting user
          ...(p.userId.toString() === userId ? {
            lastLocation: p.lastLocation,
            startLocation: p.startLocation,
            endLocation: p.endLocation,
            locationHistory: p.locationHistory
          } : {})
        }))
      };
      return res.json({ tracking: sanitizedTracking });
    }

    // Organizer gets full access
    res.json({ tracking });

  } catch (error: any) {
    console.error('Error fetching trip tracking:', error);
    res.status(500).json({ error: 'Failed to fetch trip tracking' });
  }
});

// Get all active trackings for organizer
router.get('/my-active-trips', authenticateJwt, requireRole(['organizer', 'admin']), async (req, res) => {
  try {
    const userId = (req as any).auth.userId;

    const activeTrackings = await TripTracking.find({
      organizerId: userId,
      status: { $in: ['active', 'emergency'] }
    }).populate('tripId', 'title destination startDate endDate');

    res.json({ trackings: activeTrackings });

  } catch (error: any) {
    console.error('Error fetching active trips:', error);
    res.status(500).json({ error: 'Failed to fetch active trips' });
  }
});

// Emergency SOS endpoint
router.post('/trips/:tripId/sos', authenticateJwt, async (req, res) => {
  try {
    const userId = (req as any).auth.userId;
    const { tripId } = req.params;
    
    const locationData = locationUpdateSchema.optional().safeParse(req.body);
    
    const tracking = await TripTracking.findOne({ tripId });
    if (!tracking) {
      return res.status(404).json({ error: 'Trip tracking not found' });
    }

    // Find participant
    const participantIndex = tracking.participants.findIndex(
      p => p.userId.toString() === userId
    );

    if (participantIndex === -1) {
      return res.status(403).json({ error: 'You are not a participant in this trip' });
    }

    // Update participant status to emergency
    tracking.participants[participantIndex].status = 'emergency';
    tracking.status = 'emergency';

    // Create emergency alert
    const emergencyAlert: any = {
      userId,
      type: 'sos' as const,
      timestamp: new Date(),
      resolved: false
    };
    
    if (locationData.success && locationData.data) {
      emergencyAlert.location = {
        latitude: locationData.data.latitude,
        longitude: locationData.data.longitude,
        altitude: locationData.data.altitude,
        accuracy: locationData.data.accuracy,
        timestamp: new Date()
      };
    }

    tracking.emergencyAlerts.push(emergencyAlert);
    await tracking.save();

    // TODO: Send immediate emergency notifications
    console.log(`SOS ALERT: User ${userId} in trip ${tripId}`);
    
    res.json({ message: 'Emergency alert sent', alert: emergencyAlert });

  } catch (error: any) {
    console.error('Error sending SOS:', error);
    res.status(500).json({ error: 'Failed to send emergency alert' });
  }
});

export default router;