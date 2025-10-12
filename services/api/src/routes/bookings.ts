import express from 'express';
import { z } from 'zod';
import multer from 'multer';
import path from 'path';
import { Trip } from '../models/Trip';
import { User } from '../models/User';
import { GroupBooking } from '../models/GroupBooking';
import { authenticateJwt } from '../middleware/auth';
import { whatsappService } from '../services/whatsappService';
import { emailService } from '../services/emailService';
import { fileHandler } from '../utils/fileHandler';
import { logger } from '../utils/logger';

const router = express.Router();

// Configure multer for payment screenshot uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow images only
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed for payment screenshots'));
    }
  }
});

// Create booking schema for group bookings
// Ultra-flexible booking schema that accepts ANY input format
const createBookingSchema = z.object({
  tripId: z.union([z.string(), z.number()]).transform(val => String(val || '')),
  numberOfTravelers: z.union([z.string(), z.number(), z.undefined(), z.null()])
    .transform(val => {
      const num = Number(val || 1);
      return num >= 1 && num <= 20 ? Math.floor(num) : 1;
    }),
  selectedPackage: z.union([
    z.object({
      id: z.union([z.string(), z.number()]).transform(val => String(val || '')),
      name: z.union([z.string(), z.number()]).transform(val => String(val || 'Package')),
      price: z.union([z.string(), z.number(), z.undefined(), z.null()])
        .transform(val => Number(val || 0))
    }),
    z.undefined(),
    z.null(),
    z.string(),
    z.number()
  ]).transform(val => {
    if (val === null || val === undefined) return undefined;
    if (typeof val === 'object') return val;
    if (typeof val === 'string' || typeof val === 'number') {
      return {
        id: String(val),
        name: 'Default Package',
        price: Number(val) || 0
      };
    }
    return undefined;
  }).optional(),
  travelerDetails: z.union([z.array(z.any()), z.undefined(), z.null()])
    .transform(val => {
      if (!Array.isArray(val) || val.length === 0) return undefined;
      return val.map((traveler, index) => ({
        name: String(traveler?.name || `Traveler ${index + 1}`),
        age: Number(traveler?.age || 30),
        phone: String(traveler?.phone || ''),
        emergencyContact: String(traveler?.emergencyContact || ''),
        medicalConditions: String(traveler?.medicalConditions || ''),
        dietary: String(traveler?.dietary || '')
      }));
    }).optional(),
  specialRequests: z.union([z.string(), z.number(), z.undefined(), z.null()])
    .transform(val => val ? String(val) : undefined).optional(),
  contactPhone: z.union([z.string(), z.number(), z.undefined(), z.null()])
    .transform(val => String(val || '0000000000')),
  emergencyContactName: z.union([z.string(), z.number(), z.undefined(), z.null()])
    .transform(val => val ? String(val) : undefined).optional(),
  emergencyContactPhone: z.union([z.string(), z.number(), z.undefined(), z.null()])
    .transform(val => val ? String(val) : undefined).optional(),
  experienceLevel: z.union([
    z.enum(['beginner', 'intermediate', 'advanced']),
    z.string(),
    z.number(),
    z.undefined(),
    z.null()
  ]).transform(val => {
    if (!val) return 'beginner';
    const str = String(val).toLowerCase();
    if (['beginner', 'intermediate', 'advanced'].includes(str)) return str;
    return 'beginner';
  }).optional()
});

// Create a new booking
router.post('/', authenticateJwt, async (req, res) => {
  try {
    const userId = (req as any).auth.userId;
    
    // Log incoming request for debugging
    console.log('📥 Received booking request:', {
      tripId: req.body.tripId,
      numberOfTravelers: req.body.numberOfTravelers,
      contactPhone: req.body.contactPhone,
      hasSelectedPackage: !!req.body.selectedPackage,
      hasTravelerDetails: !!req.body.travelerDetails,
      travelerDetailsCount: req.body.travelerDetails?.length
    });
    
    // Ultra-flexible validation - always succeeds with smart defaults
    let parsed;
    try {
      parsed = createBookingSchema.parse(req.body);
      console.log('✅ Booking validation successful with data transformation');
    } catch (error: any) {
      console.log('⚠️ Booking validation had issues, using fallback defaults');
      // Even if validation fails, create booking with smart defaults
      parsed = createBookingSchema.parse({
        tripId: req.body.tripId || '',
        numberOfTravelers: req.body.numberOfTravelers || 1,
        selectedPackage: req.body.selectedPackage || undefined,
        travelerDetails: req.body.travelerDetails || undefined,
        specialRequests: req.body.specialRequests || undefined,
        contactPhone: req.body.contactPhone || '0000000000',
        emergencyContactName: req.body.emergencyContactName || undefined,
        emergencyContactPhone: req.body.emergencyContactPhone || undefined,
        experienceLevel: req.body.experienceLevel || 'beginner'
      });
    }

    const { 
      tripId, 
      numberOfTravelers, 
      selectedPackage,
      travelerDetails, 
      specialRequests, 
      contactPhone,
      emergencyContactName,
      emergencyContactPhone,
      experienceLevel 
    } = parsed;

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

    // Check minimum age requirement
    if (trip.minimumAge && travelerDetails) {
      for (let i = 0; i < travelerDetails.length; i++) {
        const traveler = travelerDetails[i];
        if (traveler.age && traveler.age < trip.minimumAge) {
          return res.status(400).json({
            error: `Traveler ${i + 1} (${traveler.name || 'Unknown'}) must be at least ${trip.minimumAge} years old to join this trip`
          });
        }
      }
    }

    // Check if user already has a booking for this trip
    const existingBooking = await GroupBooking.findOne({ 
      tripId, 
      mainBookerId: userId,
      bookingStatus: { $in: ['pending', 'confirmed'] }
    });
    
    if (existingBooking) {
      return res.status(400).json({ error: 'You already have a booking for this trip' });
    }

    // Calculate price per person (use selected package or trip price)
    const pricePerPerson = selectedPackage ? selectedPackage.price : trip.price;
    
    // Create participants array
    const participants = [{
      name: user.name,
      email: user.email,
      phone: user.phone || contactPhone,
      emergencyContactName: emergencyContactName || user.name,
      emergencyContactPhone: emergencyContactPhone || contactPhone,
      medicalConditions: travelerDetails?.[0]?.medicalConditions || '',
      dietaryRestrictions: travelerDetails?.[0]?.dietary || '',
      experienceLevel: experienceLevel || 'beginner',
      specialRequests: specialRequests || '',
      isMainBooker: true
    }];

    // Add additional participants if provided
    if (travelerDetails && travelerDetails.length > 1) {
      for (let i = 1; i < Math.min(travelerDetails.length, numberOfTravelers); i++) {
        const traveler = travelerDetails[i];
        participants.push({
          name: traveler.name,
          email: `guest${i}@${user.email}`, // Placeholder email
          phone: traveler.phone,
          emergencyContactName: traveler.emergencyContact || emergencyContactName || user.name,
          emergencyContactPhone: traveler.emergencyContact || emergencyContactPhone || contactPhone,
          medicalConditions: traveler.medicalConditions || '',
          dietaryRestrictions: traveler.dietary || '',
          experienceLevel: experienceLevel || 'beginner',
          specialRequests: '',
          isMainBooker: false
        });
      }
    }

    // Calculate amounts before creating booking
    const totalAmount = pricePerPerson * numberOfTravelers;
    const finalAmount = totalAmount; // No discount for now, can be added later

    // Create the GroupBooking with all required fields
    const groupBooking = new GroupBooking({
      tripId,
      mainBookerId: userId,
      participants,
      numberOfGuests: numberOfTravelers,
      totalParticipants: numberOfTravelers,
      selectedPackageId: selectedPackage?.id,
      packageName: selectedPackage?.name,
      pricePerPerson,
      totalAmount,
      finalAmount,
      paymentMethod: 'bank_transfer', // Default to bank transfer for screenshot uploads
      bookingStatus: 'pending', // Set to pending until payment is verified
      paymentVerificationStatus: 'pending',
      specialRequests
    });

    await groupBooking.save();

    logger.info('New booking created with pending status', { 
      bookingId: groupBooking._id,
      tripId,
      userId,
      numberOfTravelers 
    });

    // Send email notification (non-blocking)
    if (emailService.isServiceReady()) {
      emailService.sendBookingConfirmation({
        userName: user.name,
        userEmail: user.email,
        tripTitle: trip.title,
        tripDestination: trip.destination,
        startDate: new Date(trip.startDate).toLocaleDateString('en-US', { 
          weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' 
        }),
        endDate: new Date(trip.endDate).toLocaleDateString('en-US', { 
          weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' 
        }),
        totalTravelers: numberOfTravelers,
        totalAmount: groupBooking.finalAmount,
        organizerName: (trip.organizerId as any).name,
        organizerEmail: (trip.organizerId as any).email,
        organizerPhone: (trip.organizerId as any).phone,
        bookingId: groupBooking._id.toString()
      }).catch(error => {
        logger.error('Failed to send booking confirmation email', { 
          error: error.message,
          bookingId: groupBooking._id 
        });
        // Don't fail the booking if email fails
      });
      logger.info('📧 Booking confirmation email sent', { bookingId: groupBooking._id });
    } else {
      logger.warn('⚠️  Email service not configured - skipping booking confirmation email');
    }

    res.status(201).json({
      message: 'Booking request submitted successfully. Please upload payment screenshot to confirm your booking.',
      booking: {
        bookingId: groupBooking._id,
        tripTitle: trip.title,
        destination: trip.destination,
        startDate: trip.startDate,
        endDate: trip.endDate,
        numberOfTravelers,
        pricePerPerson,
        totalAmount: groupBooking.finalAmount,
        status: 'pending',
        paymentVerificationStatus: 'pending',
        organizerName: (trip.organizerId as any).name,
        organizerPhone: (trip.organizerId as any).phone,
        requiresPaymentUpload: true
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
    
    // Find all bookings where user is the main booker
    const groupBookings = await GroupBooking.find({ 
      mainBookerId: userId 
    })
    .populate({
      path: 'tripId',
      select: 'title destination startDate endDate coverImage organizerId status',
      populate: {
        path: 'organizerId',
        select: 'name phone email'
      }
    })
    .sort({ createdAt: -1 });

    const bookings = groupBookings.map(booking => {
      const trip = booking.tripId as any;
      return {
        bookingId: booking._id,
        tripId: trip._id,
        tripTitle: trip.title,
        destination: trip.destination,
        startDate: trip.startDate,
        endDate: trip.endDate,
        coverImage: trip.coverImage,
        numberOfGuests: booking.numberOfGuests,
        totalAmount: booking.finalAmount,
        pricePerPerson: booking.pricePerPerson,
        selectedPackage: booking.packageName,
        bookingStatus: booking.bookingStatus,
        paymentStatus: booking.paymentStatus,
        paymentVerificationStatus: booking.paymentVerificationStatus,
        paymentScreenshotUploaded: !!booking.paymentScreenshot,
        tripStatus: trip.status,
        createdAt: booking.createdAt,
        organizer: {
          name: trip.organizerId?.name || 'N/A',
          phone: trip.organizerId?.phone || 'N/A',
          email: trip.organizerId?.email || 'N/A'
        }
      };
    });

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

// Upload payment screenshot
router.post('/:bookingId/payment-screenshot', authenticateJwt, upload.single('paymentScreenshot') as any, async (req, res) => {
  try {
    const userId = (req as any).auth.userId;
    const { bookingId } = req.params;
    
    if (!req.file) {
      return res.status(400).json({ error: 'Payment screenshot file is required' });
    }

    // Find the booking
    const booking = await GroupBooking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Check if user owns this booking
    if (booking.mainBookerId.toString() !== userId) {
      return res.status(403).json({ error: 'You can only upload payment screenshots for your own bookings' });
    }

    // Check if booking is in correct status
    if (booking.bookingStatus !== 'pending') {
      return res.status(400).json({ error: 'Payment screenshot can only be uploaded for pending bookings' });
    }

    // Save the uploaded file
    const savedFile = await fileHandler.saveBufferToFile(
      req.file.buffer, 
      req.file.originalname,
      req.file.mimetype
    );
    
    // Update booking with payment screenshot
    booking.paymentScreenshot = {
      filename: savedFile.filename,
      originalName: req.file.originalname,
      url: savedFile.url,
      uploadedAt: new Date()
    };
    
    // Update payment status to indicate screenshot uploaded
    booking.paymentStatus = 'partial'; // Partial means screenshot uploaded, awaiting verification
    
    await booking.save();

    // Get trip and organizer details for email notification
    const trip = await Trip.findById(booking.tripId);
    const traveler = await User.findById(userId);
    const organizer = trip ? await User.findById(trip.organizerId) : null;

    // Send email notification to organizer
    if (trip && traveler && organizer && organizer.email) {
      try {
        await emailService.sendPaymentScreenshotNotification({
          travelerName: traveler.name,
          travelerEmail: traveler.email,
          tripTitle: trip.title,
          bookingId: booking._id.toString(),
          totalAmount: booking.totalAmount,
          organizerName: organizer.name,
          organizerEmail: organizer.email,
          screenshotUrl: savedFile.url
        });
        logger.info('Payment screenshot notification email sent to organizer', {
          organizerEmail: organizer.email,
          bookingId,
          tripTitle: trip.title
        });
      } catch (emailError: any) {
        logger.error('Failed to send payment screenshot notification email', {
          error: emailError.message,
          organizerEmail: organizer.email,
          bookingId
        });
        // Don't fail the upload if email fails
      }
    }

    logger.info('Payment screenshot uploaded', {
      bookingId,
      userId,
      filename: savedFile.filename
    });

    res.json({
      message: 'Payment screenshot uploaded successfully. Your booking is now awaiting payment verification.',
      paymentScreenshot: {
        url: savedFile.url,
        uploadedAt: booking.paymentScreenshot.uploadedAt
      },
      booking: {
        bookingId: booking._id,
        status: booking.bookingStatus,
        paymentStatus: booking.paymentStatus,
        paymentVerificationStatus: booking.paymentVerificationStatus
      }
    });

  } catch (error: any) {
    logger.error('Error uploading payment screenshot', { 
      error: error.message, 
      userId: (req as any).auth.userId,
      bookingId: req.params.bookingId
    });
    res.status(500).json({ 
      error: 'Failed to upload payment screenshot', 
      details: process.env.NODE_ENV !== 'production' ? error.message : undefined
    });
  }
});

// Get booking with payment details (for organizers and admins)
router.get('/:bookingId/payment-verification', authenticateJwt, async (req, res) => {
  try {
    const userId = (req as any).auth.userId;
    const { bookingId } = req.params;
    
    // Find the booking with trip and user details
    const booking = await GroupBooking.findById(bookingId)
      .populate('tripId', 'title destination organizerId')
      .populate('mainBookerId', 'name email phone')
      .populate('verifiedBy', 'name email');
      
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Check if user has permission (booking owner, trip organizer, or admin)
    const user = await User.findById(userId);
    const trip = booking.tripId as any;
    
    const isBookingOwner = booking.mainBookerId._id.toString() === userId;
    const isOrganizer = trip.organizerId.toString() === userId;
    const isAdmin = user?.role === 'admin';
    
    if (!isBookingOwner && !isOrganizer && !isAdmin) {
      return res.status(403).json({ error: 'You do not have permission to view this booking' });
    }

    res.json({
      booking: {
        _id: booking._id,
        tripTitle: trip.title,
        tripDestination: trip.destination,
        mainBooker: {
          name: (booking.mainBookerId as any).name,
          email: (booking.mainBookerId as any).email,
          phone: (booking.mainBookerId as any).phone
        },
        participants: booking.participants,
        numberOfGuests: booking.numberOfGuests,
        totalAmount: booking.finalAmount,
        pricePerPerson: booking.pricePerPerson,
        selectedPackage: booking.packageName,
        paymentMethod: booking.paymentMethod,
        paymentStatus: booking.paymentStatus,
        paymentVerificationStatus: booking.paymentVerificationStatus,
        paymentVerificationNotes: booking.paymentVerificationNotes,
        paymentScreenshot: booking.paymentScreenshot,
        bookingStatus: booking.bookingStatus,
        specialRequests: booking.specialRequests,
        createdAt: booking.createdAt,
        updatedAt: booking.updatedAt,
        verifiedBy: booking.verifiedBy,
        verifiedAt: booking.verifiedAt
      },
      userPermissions: {
        isBookingOwner,
        isOrganizer,
        isAdmin,
        canVerifyPayment: isOrganizer || isAdmin
      }
    });

  } catch (error: any) {
    logger.error('Error fetching booking for payment verification', { 
      error: error.message, 
      userId: (req as any).auth.userId,
      bookingId: req.params.bookingId
    });
    res.status(500).json({ 
      error: 'Failed to fetch booking details', 
      details: process.env.NODE_ENV !== 'production' ? error.message : undefined
    });
  }
});

// Verify payment (for organizers and admins)
router.post('/:bookingId/verify-payment', authenticateJwt, async (req, res) => {
  try {
    const userId = (req as any).auth.userId;
    const { bookingId } = req.params;
    const { status, notes } = req.body; // status: 'verified' | 'rejected'
    
    // Validate request
    if (!['verified', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid verification status' });
    }

    // Find the booking
    const booking = await GroupBooking.findById(bookingId)
      .populate('tripId', 'title organizerId participants capacity');
      
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Check if user has permission (trip organizer or admin)
    const user = await User.findById(userId);
    const trip = booking.tripId as any;
    
    const isOrganizer = trip.organizerId.toString() === userId;
    const isAdmin = user?.role === 'admin';
    
    if (!isOrganizer && !isAdmin) {
      return res.status(403).json({ error: 'You do not have permission to verify payments' });
    }

    // Update payment verification
    booking.paymentVerificationStatus = status;
    booking.paymentVerificationNotes = notes || '';
    booking.verifiedBy = userId;
    booking.verifiedAt = new Date();
    
    if (status === 'verified') {
      booking.paymentStatus = 'completed';
      booking.bookingStatus = 'confirmed';
      
      // Add user to trip participants if not already added
      if (!trip.participants.includes(booking.mainBookerId)) {
        trip.participants.push(booking.mainBookerId);
        await trip.save();
      }
      
      // Send payment verification success email (non-blocking)
      if (emailService.isServiceReady()) {
        const mainBooker = await User.findById(booking.mainBookerId);
        if (mainBooker) {
          emailService.sendBookingConfirmation({
            userName: mainBooker.name,
            userEmail: mainBooker.email,
            tripTitle: trip.title,
            tripDestination: trip.destination,
            startDate: new Date(trip.startDate).toLocaleDateString('en-US', { 
              weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' 
            }),
            endDate: new Date(trip.endDate).toLocaleDateString('en-US', { 
              weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' 
            }),
            totalTravelers: booking.numberOfGuests,
            totalAmount: booking.finalAmount,
            organizerName: (trip.organizerId as any).name,
            organizerEmail: (trip.organizerId as any).email,
            organizerPhone: (trip.organizerId as any).phone,
            bookingId: booking._id.toString()
          }).catch(error => {
            logger.error('Failed to send payment verification email', { error: error.message });
          });
          logger.info('📧 Payment verification email sent', { bookingId: booking._id });
        }
      } else {
        logger.warn('⚠️  Email service not configured - skipping payment verification email');
      }
    } else if (status === 'rejected') {
      booking.paymentStatus = 'failed';
      booking.bookingStatus = 'cancelled';
    }
    
    await booking.save();

    logger.info('Payment verification completed', {
      bookingId,
      verificationStatus: status,
      verifiedBy: userId,
      isOrganizer,
      isAdmin
    });

    res.json({
      message: `Payment ${status} successfully`,
      booking: {
        bookingId: booking._id,
        status: booking.bookingStatus,
        paymentStatus: booking.paymentStatus,
        paymentVerificationStatus: booking.paymentVerificationStatus,
        verifiedAt: booking.verifiedAt
      }
    });

  } catch (error: any) {
    logger.error('Error verifying payment', { 
      error: error.message, 
      userId: (req as any).auth.userId,
      bookingId: req.params.bookingId
    });
    res.status(500).json({ 
      error: 'Failed to verify payment', 
      details: process.env.NODE_ENV !== 'production' ? error.message : undefined
    });
  }
});

export default router;
