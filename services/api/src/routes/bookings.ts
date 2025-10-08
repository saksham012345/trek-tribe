import express from 'express';
import { z } from 'zod';
import { Trip } from '../models/Trip';
import { User } from '../models/User';
import { authenticateJwt } from '../middleware/auth';
import { whatsappService } from '../services/whatsappService';
import { emailService } from '../services/emailService';
import { logger } from '../utils/logger';

const router = express.Router();

// Create booking schema for group bookings
const createBookingSchema = z.object({
  tripId: z.string(),
  numberOfTravelers: z.number().int().min(1).max(10).default(1),
  travelerDetails: z.array(z.object({
    name: z.string().min(1),
    age: z.number().int().min(1).max(100),
    phone: z.string().min(10),
    emergencyContact: z.string().min(10).optional(),
    medicalConditions: z.string().optional(),
    dietary: z.string().optional()
  })).optional(),
  specialRequests: z.string().optional(),
  contactPhone: z.string().min(10) // Main contact for booking
});

// Create a new booking
router.post('/', authenticateJwt, async (req, res) => {
  try {
    const userId = (req as any).auth.userId;
    
    // Validate request body
    const parsed = createBookingSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ 
        error: 'Invalid booking data', 
        details: parsed.error.flatten() 
      });
    }

    const { tripId, numberOfTravelers, travelerDetails, specialRequests, contactPhone } = parsed.data;

    // Find the trip
    const trip = await Trip.findById(tripId).populate('organizerId', 'name phone email');
    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    // Get user details
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check trip availability
    const currentParticipants = trip.participants.length;
    const availableSpots = trip.capacity - currentParticipants;
    
    if (availableSpots < numberOfTravelers) {
      return res.status(400).json({ 
        error: `Not enough spots available. Only ${availableSpots} spots remaining` 
      });
    }

    // Check if user already joined
    if (trip.participants.includes(userId)) {
      return res.status(400).json({ error: 'Already booked for this trip' });
    }

    // Calculate total amount
    const totalAmount = trip.price * numberOfTravelers;

    // Add user to participants (for now, just add the booking user ID)
    // In a real system, you might want to create separate participant records
    trip.participants.push(userId);
    await trip.save();

    // Generate booking ID
    const bookingId = `TT-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

    // Create booking record (you might want to create a separate Booking model)
    const bookingData = {
      bookingId,
      userId,
      tripId,
      numberOfTravelers,
      travelerDetails: travelerDetails || [{
        name: user.name,
        phone: contactPhone
      }],
      specialRequests,
      totalAmount,
      status: 'confirmed',
      createdAt: new Date()
    };

    // For now, we'll store this in a simple format
    // In production, you'd want a proper Booking model
    logger.info('New booking created', { bookingData });

    // Send notifications (async, don't block response)
    setTimeout(async () => {
      const organizer = trip.organizerId as any;
      
      // Send WhatsApp confirmation
      try {
        if (whatsappService.isServiceReady()) {
          await whatsappService.sendBookingConfirmation(contactPhone, {
            userName: user.name,
            tripTitle: trip.title,
            tripDestination: trip.destination,
            startDate: trip.startDate.toDateString(),
            endDate: trip.endDate.toDateString(),
            totalTravelers: numberOfTravelers,
            totalAmount,
            organizerName: organizer.name,
            organizerPhone: organizer.phone || 'N/A',
            bookingId
          });
        }
      } catch (error) {
        logger.error('Failed to send WhatsApp confirmation', { error, bookingId });
      }
      
      // Send email confirmation
      try {
        if (emailService.isServiceReady()) {
          await emailService.sendBookingConfirmation({
            userName: user.name,
            userEmail: user.email,
            tripTitle: trip.title,
            tripDestination: trip.destination,
            startDate: trip.startDate.toDateString(),
            endDate: trip.endDate.toDateString(),
            totalTravelers: numberOfTravelers,
            totalAmount,
            organizerName: organizer.name,
            organizerEmail: organizer.email || 'N/A',
            organizerPhone: organizer.phone || 'N/A',
            bookingId
          });
        }
      } catch (error) {
        logger.error('Failed to send email confirmation', { error, bookingId });
      }
    }, 1000);

    res.status(201).json({
      message: 'Booking confirmed successfully',
      booking: {
        bookingId,
        tripTitle: trip.title,
        destination: trip.destination,
        startDate: trip.startDate,
        endDate: trip.endDate,
        numberOfTravelers,
        totalAmount,
        status: 'confirmed',
        organizerName: (trip.organizerId as any).name,
        organizerPhone: (trip.organizerId as any).phone
      }
    });

  } catch (error: any) {
    logger.error('Error creating booking', { error: error.message, userId: (req as any).auth.userId });
    res.status(500).json({ 
      error: 'Failed to create booking', 
      details: process.env.NODE_ENV !== 'production' ? error.message : undefined
    });
  }
});

// Get user bookings
router.get('/my-bookings', authenticateJwt, async (req, res) => {
  try {
    const userId = (req as any).auth.userId;
    
    // Find all trips where user is a participant
    const trips = await Trip.find({ 
      participants: userId 
    })
    .populate('organizerId', 'name phone email')
    .sort({ createdAt: -1 });

    const bookings = trips.map(trip => ({
      tripId: trip._id,
      tripTitle: trip.title,
      destination: trip.destination,
      startDate: trip.startDate,
      endDate: trip.endDate,
      price: trip.price,
      status: trip.status,
      coverImage: trip.coverImage,
      organizer: {
        name: (trip.organizerId as any).name,
        phone: (trip.organizerId as any).phone,
        email: (trip.organizerId as any).email
      }
    }));

    res.json({ bookings });

  } catch (error: any) {
    logger.error('Error fetching user bookings', { error: error.message, userId: (req as any).auth.userId });
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// Cancel booking
router.delete('/:tripId', authenticateJwt, async (req, res) => {
  try {
    const userId = (req as any).auth.userId;
    const { tripId } = req.params;

    const trip = await Trip.findById(tripId);
    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    if (!trip.participants.includes(userId)) {
      return res.status(400).json({ error: 'You are not booked for this trip' });
    }

    // Check if trip is starting within 48 hours
    const hoursUntilTrip = (new Date(trip.startDate).getTime() - Date.now()) / (1000 * 60 * 60);
    if (hoursUntilTrip < 48) {
      return res.status(400).json({ 
        error: 'Cannot cancel booking within 48 hours of trip start time' 
      });
    }

    // Remove user from participants
    trip.participants = trip.participants.filter((id: any) => id.toString() !== userId);
    await trip.save();

    logger.info('Booking cancelled', { userId, tripId, tripTitle: trip.title });

    res.json({ message: 'Booking cancelled successfully' });

  } catch (error: any) {
    logger.error('Error cancelling booking', { error: error.message, userId: (req as any).auth.userId });
    res.status(500).json({ error: 'Failed to cancel booking' });
  }
});

// Get booking details
router.get('/trip/:tripId', authenticateJwt, async (req, res) => {
  try {
    const userId = (req as any).auth.userId;
    const { tripId } = req.params;

    const trip = await Trip.findById(tripId).populate('organizerId', 'name phone email');
    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    if (!trip.participants.includes(userId)) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const bookingDetails = {
      tripId: trip._id,
      tripTitle: trip.title,
      description: trip.description,
      destination: trip.destination,
      startDate: trip.startDate,
      endDate: trip.endDate,
      price: trip.price,
      status: trip.status,
      coverImage: trip.coverImage,
      images: trip.images,
      itinerary: trip.itinerary,
      organizer: {
        name: (trip.organizerId as any).name,
        phone: (trip.organizerId as any).phone,
        email: (trip.organizerId as any).email
      },
      participantCount: trip.participants.length,
      capacity: trip.capacity
    };

    res.json({ booking: bookingDetails });

  } catch (error: any) {
    logger.error('Error fetching booking details', { error: error.message, userId: (req as any).auth.userId });
    res.status(500).json({ error: 'Failed to fetch booking details' });
  }
});

// WhatsApp service status endpoint
router.get('/whatsapp-status', authenticateJwt, async (req, res) => {
  try {
    const status = await whatsappService.getStatus();
    res.json(status);
  } catch (error: any) {
    logger.error('Error getting WhatsApp status', { error: error.message });
    res.status(500).json({ error: 'Failed to get WhatsApp status' });
  }
});

// Email service status endpoint
router.get('/email-status', authenticateJwt, async (req, res) => {
  try {
    const status = await emailService.getServiceStatus();
    res.json(status);
  } catch (error: any) {
    logger.error('Error getting email service status', { error: error.message });
    res.status(500).json({ error: 'Failed to get email service status' });
  }
});

export default router;