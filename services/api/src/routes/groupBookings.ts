import express, { Request, Response } from 'express';
import { z } from 'zod';
import { auth, AuthPayload } from '../middleware/auth';
import { Trip } from '../models/Trip';
import { User } from '../models/User';
import { GroupBooking, GroupParticipant, GroupBookingDocumentWithMethods } from '../models/GroupBooking';
import { logger } from '../utils/logger';
import mongoose from 'mongoose';

// Extend Request interface
interface AuthenticatedRequest extends Request {
  user: AuthPayload;
}

const router = express.Router();

// Validation schemas
const createGroupBookingSchema = z.object({
  tripId: z.string(),
  numberOfGuests: z.number().int().min(1).max(20).optional(), // Optional - will default to participants length
  selectedPackageId: z.string().optional(),
  participants: z.array(z.object({
    name: z.string().min(2),
    email: z.string().email(),
    phone: z.string().min(10),
    dateOfBirth: z.string().optional(),
    gender: z.enum(['male', 'female', 'other', 'prefer-not-to-say']).optional(),
    emergencyContactName: z.string().min(2),
    emergencyContactPhone: z.string().min(10),
    medicalConditions: z.string().optional(),
    dietaryRestrictions: z.string().optional(),
    experienceLevel: z.enum(['beginner', 'intermediate', 'advanced']),
    specialRequests: z.string().optional()
  })).min(1).max(20),
  paymentMethod: z.string().default('UPI'),
  specialRequests: z.string().optional(),
  notes: z.string().optional()
});

const addParticipantSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(10),
  dateOfBirth: z.string().optional(),
  gender: z.enum(['male', 'female', 'other', 'prefer-not-to-say']).optional(),
  emergencyContactName: z.string().min(2),
  emergencyContactPhone: z.string().min(10),
  medicalConditions: z.string().optional(),
  dietaryRestrictions: z.string().optional(),
  experienceLevel: z.enum(['beginner', 'intermediate', 'advanced']),
  specialRequests: z.string().optional()
});

/**
 * @route POST /api/group-bookings
 * @description Create a new group booking
 * @access Private
 */
// @ts-ignore
router.post('/', auth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const validation = createGroupBookingSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: 'Invalid booking data',
        errors: validation.error.flatten()
      });
    }

    const { tripId, numberOfGuests, selectedPackageId, participants, paymentMethod, specialRequests, notes } = validation.data;

    // Find the trip
    const trip = await Trip.findById(tripId).populate('organizerId', 'name email phone');
    if (!trip) {
      return res.status(404).json({
        success: false,
        message: 'Trip not found'
      });
    }

    // Determine actual number of guests
    const actualNumberOfGuests = numberOfGuests || participants.length;

    // Determine price and package details
    let pricePerPerson = trip.price;
    let packageName = 'Standard';
    let selectedPackage = null;

    if (selectedPackageId && trip.packages && trip.packages.length > 0) {
      selectedPackage = trip.packages.find((pkg: any) => pkg.id === selectedPackageId && pkg.isActive);
      if (!selectedPackage) {
        return res.status(400).json({
          success: false,
          message: 'Selected package not found or inactive'
        });
      }
      pricePerPerson = selectedPackage.price;
      packageName = selectedPackage.name;

      // Check package availability
      if (selectedPackage.capacity < actualNumberOfGuests) {
        return res.status(400).json({
          success: false,
          message: `Selected package has only ${selectedPackage.capacity} spots available`
        });
      }
    } else {
      // Check trip availability for standard booking
      const availableSpots = trip.capacity - trip.participants.length;
      if (availableSpots < actualNumberOfGuests) {
        return res.status(400).json({
          success: false,
          message: `Not enough spots available. Only ${availableSpots} spots remaining`
        });
      }
    }

    // Calculate group discount based on actual number of guests
    const groupDiscount = (GroupBooking as any).calculateGroupDiscount(actualNumberOfGuests);
    
    // Mark the first participant as main booker
    const processedParticipants = participants.map((participant, index) => ({
      ...participant,
      dateOfBirth: participant.dateOfBirth ? new Date(participant.dateOfBirth) : undefined,
      isMainBooker: index === 0
    }));

    // Get payment configuration from trip
    const paymentConfig = trip.paymentConfig || { paymentType: 'full', paymentMethods: ['upi'] };
    const paymentType = paymentConfig.paymentType;
    let advanceAmount = 0;

    if (paymentType === 'advance') {
      if (paymentConfig.advanceAmount) {
        advanceAmount = paymentConfig.advanceAmount * actualNumberOfGuests;
      }
    }

    // Create group booking
    const groupBooking = new GroupBooking({
      tripId: new mongoose.Types.ObjectId(tripId),
      mainBookerId: new mongoose.Types.ObjectId(req.user.id),
      numberOfGuests: actualNumberOfGuests,
      selectedPackageId,
      packageName,
      participants: processedParticipants,
      pricePerPerson,
      groupDiscount,
      paymentType,
      advanceAmount,
      paymentMethod,
      specialRequests,
      notes
    });

    await groupBooking.save();

    // Add participants to trip
    const participantIds = Array(participants.length).fill(new mongoose.Types.ObjectId(req.user.id));
    trip.participants.push(...participantIds);
    await trip.save();

    // Populate the booking for response
    const populatedBooking = await GroupBooking.findById(groupBooking._id)
      .populate('tripId', 'title destination startDate endDate')
      .populate('mainBookerId', 'name email phone');

    res.status(201).json({
      success: true,
      message: 'Group booking created successfully',
      data: {
        booking: populatedBooking,
        discountApplied: groupDiscount,
        totalSaved: groupBooking.discountAmount
      }
    });

  } catch (error: any) {
    logger.error('Error creating group booking', { error: error.message, userId: req.user.id });
    res.status(500).json({
      success: false,
      message: 'Failed to create group booking'
    });
  }
});

/**
 * @route GET /api/group-bookings/my-bookings
 * @description Get user's group bookings
 * @access Private
 */
router.get('/my-bookings', auth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;

    const filter: any = { mainBookerId: new mongoose.Types.ObjectId(req.user.id) };
    if (status && typeof status === 'string') {
      filter.bookingStatus = status;
    }

    const skip = (Number(page) - 1) * Number(limit);

    const bookings = await GroupBooking.find(filter)
      .populate('tripId', 'title destination startDate endDate coverImage')
      .populate('mainBookerId', 'name email phone')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await GroupBooking.countDocuments(filter);

    res.json({
      success: true,
      data: {
        bookings,
        pagination: {
          current: Number(page),
          total: Math.ceil(total / Number(limit)),
          count: bookings.length,
          totalBookings: total
        }
      }
    });

  } catch (error: any) {
    logger.error('Error fetching group bookings', { error: error.message, userId: req.user.id });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch group bookings'
    });
  }
});

/**
 * @route GET /api/group-bookings/:bookingId
 * @description Get specific group booking details
 * @access Private
 */
router.get('/:bookingId', auth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const booking = await GroupBooking.findById(req.params.bookingId)
      .populate('tripId', 'title destination startDate endDate coverImage organizerId')
      .populate('mainBookerId', 'name email phone');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Group booking not found'
      });
    }

    // Check if user has access to this booking
    const tripData = booking.tripId as any;
    if (booking.mainBookerId._id.toString() !== req.user.id &&
        tripData.organizerId._id.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.json({
      success: true,
      data: { booking }
    });

  } catch (error: any) {
    logger.error('Error fetching group booking', { error: error.message, bookingId: req.params.bookingId });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch group booking'
    });
  }
});

/**
 * @route PUT /api/group-bookings/:bookingId/participants
 * @description Add or remove participants
 * @access Private
 */
router.put('/:bookingId/participants', auth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { action, participant } = req.body;

    if (!['add', 'remove'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid action. Use "add" or "remove"'
      });
    }

    const booking = await GroupBooking.findById(req.params.bookingId) as GroupBookingDocumentWithMethods;
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Group booking not found'
      });
    }

    // Check if user is the main booker
    if (booking.mainBookerId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Only the main booker can manage participants'
      });
    }

    if (action === 'add') {
      const validation = addParticipantSchema.safeParse(participant);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          message: 'Invalid participant data',
          errors: validation.error.flatten()
        });
      }

      // Use the instance method to add participant
      const participantData = {
        ...validation.data,
        dateOfBirth: validation.data.dateOfBirth ? new Date(validation.data.dateOfBirth) : undefined
      };
      
      // Manually add participant since TypeScript has issues with the instance method
      if (booking.participants.length >= 20) {
        return res.status(400).json({
          success: false,
          message: 'Maximum 20 participants allowed per group booking'
        });
      }
      
      booking.participants.push({
        ...participantData,
        isMainBooker: false
      } as GroupParticipant);
      
      // Recalculate discount
      booking.groupDiscount = (GroupBooking as any).calculateGroupDiscount(booking.participants.length);
      await booking.save();

    } else if (action === 'remove') {
      if (!participant.email) {
        return res.status(400).json({
          success: false,
          message: 'Participant email is required for removal'
        });
      }

      // Manually remove participant
      const participantIndex = booking.participants.findIndex(
        (p: GroupParticipant) => p.email.toLowerCase() === participant.email.toLowerCase()
      );
      
      if (participantIndex === -1) {
        return res.status(404).json({
          success: false,
          message: 'Participant not found'
        });
      }
      
      const participantToRemove = booking.participants[participantIndex];
      if (participantToRemove.isMainBooker && booking.participants.length > 1) {
        return res.status(400).json({
          success: false,
          message: 'Cannot remove main booker. Transfer main booker role first.'
        });
      }
      
      booking.participants.splice(participantIndex, 1);
      
      if (booking.participants.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Cannot remove all participants'
        });
      }
      
      // Recalculate discount
      booking.groupDiscount = (GroupBooking as any).calculateGroupDiscount(booking.participants.length);
      await booking.save();
    }

    const updatedBooking = await GroupBooking.findById(booking._id)
      .populate('tripId', 'title destination')
      .populate('mainBookerId', 'name email');

    res.json({
      success: true,
      message: `Participant ${action}ed successfully`,
      data: { booking: updatedBooking }
    });

  } catch (error: any) {
    logger.error('Error managing participants', { error: error.message, bookingId: req.params.bookingId });
    res.status(500).json({
      success: false,
      message: 'Failed to manage participants'
    });
  }
});

/**
 * @route PUT /api/group-bookings/:bookingId/transfer-main-booker
 * @description Transfer main booker role
 * @access Private
 */
router.put('/:bookingId/transfer-main-booker', auth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { newMainBookerEmail } = req.body;

    if (!newMainBookerEmail) {
      return res.status(400).json({
        success: false,
        message: 'New main booker email is required'
      });
    }

    const booking = await GroupBooking.findById(req.params.bookingId) as GroupBookingDocumentWithMethods;
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Group booking not found'
      });
    }

    // Check if user is the main booker
    if (booking.mainBookerId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Only the current main booker can transfer the role'
      });
    }

    // Manually transfer main booker role
    const currentMainBooker = booking.participants.find((p: GroupParticipant) => p.isMainBooker);
    const newMainBooker = booking.participants.find(
      (p: GroupParticipant) => p.email.toLowerCase() === newMainBookerEmail.toLowerCase()
    );
    
    if (!newMainBooker) {
      return res.status(404).json({
        success: false,
        message: 'New main booker not found in participants'
      });
    }
    
    if (currentMainBooker) {
      currentMainBooker.isMainBooker = false;
    }
    
    newMainBooker.isMainBooker = true;
    await booking.save();

    res.json({
      success: true,
      message: 'Main booker role transferred successfully',
      data: { booking }
    });

  } catch (error: any) {
    logger.error('Error transferring main booker', { error: error.message, bookingId: req.params.bookingId });
    res.status(500).json({
      success: false,
      message: 'Failed to transfer main booker role'
    });
  }
});

/**
 * @route PUT /api/group-bookings/:bookingId/payment-status
 * @description Update payment status (Organizer only)
 * @access Private
 */
router.put('/:bookingId/payment-status', auth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { paymentStatus, paymentTransactionId, paymentDetails } = req.body;

    const validStatuses = ['pending', 'partial', 'completed', 'failed', 'refunded'];
    if (!validStatuses.includes(paymentStatus)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment status'
      });
    }

    const booking = await GroupBooking.findById(req.params.bookingId).populate('tripId');
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Group booking not found'
      });
    }

    // Check if user is the trip organizer
    const trip = booking.tripId as any;
    if (trip.organizerId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Only the trip organizer can update payment status'
      });
    }

    booking.paymentStatus = paymentStatus;
    if (paymentTransactionId) {
      booking.paymentTransactionId = paymentTransactionId;
    }
    if (paymentDetails) {
      booking.paymentDetails = {
        ...booking.paymentDetails,
        ...paymentDetails,
        transactionDate: new Date()
      };
    }

    // Update booking status based on payment
    if (paymentStatus === 'completed') {
      booking.bookingStatus = 'confirmed';
    } else if (paymentStatus === 'failed' || paymentStatus === 'refunded') {
      booking.bookingStatus = 'cancelled';
    }

    await booking.save();

    res.json({
      success: true,
      message: 'Payment status updated successfully',
      data: { booking }
    });

  } catch (error: any) {
    logger.error('Error updating payment status', { error: error.message, bookingId: req.params.bookingId });
    res.status(500).json({
      success: false,
      message: 'Failed to update payment status'
    });
  }
});

/**
 * @route DELETE /api/group-bookings/:bookingId
 * @description Cancel group booking
 * @access Private
 */
router.delete('/:bookingId', auth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { cancellationReason } = req.body;

    const booking = await GroupBooking.findById(req.params.bookingId);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Group booking not found'
      });
    }

    // Check if user is the main booker
    if (booking.mainBookerId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Only the main booker can cancel the booking'
      });
    }

    if (booking.bookingStatus === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Booking is already cancelled'
      });
    }

    // Update booking status
    booking.bookingStatus = 'cancelled';
    booking.cancellationReason = cancellationReason;
    booking.cancellationDate = new Date();

    await booking.save();

    // Remove participants from trip
    const trip = await Trip.findById(booking.tripId);
    if (trip) {
      // Remove the number of participants from trip
      const participantCount = booking.participants.length;
      trip.participants = trip.participants.slice(0, -participantCount);
      await trip.save();
    }

    res.json({
      success: true,
      message: 'Group booking cancelled successfully',
      data: { booking }
    });

  } catch (error: any) {
    logger.error('Error cancelling group booking', { error: error.message, bookingId: req.params.bookingId });
    res.status(500).json({
      success: false,
      message: 'Failed to cancel group booking'
    });
  }
});

/**
 * @route GET /api/group-bookings/organizer/bookings
 * @description Get bookings for organizer's trips
 * @access Private (Organizer only)
 */
router.get('/organizer/bookings', auth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;

    // Find all trips organized by the user
    const organizerTrips = await Trip.find({ organizerId: new mongoose.Types.ObjectId(req.user.id) }).select('_id');
    const tripIds = organizerTrips.map(trip => trip._id);

    if (tripIds.length === 0) {
      return res.json({
        success: true,
        data: {
          bookings: [],
          pagination: { current: 1, total: 0, count: 0, totalBookings: 0 }
        }
      });
    }

    const filter: any = { tripId: { $in: tripIds } };
    if (status && typeof status === 'string') {
      filter.bookingStatus = status;
    }

    const skip = (Number(page) - 1) * Number(limit);

    const bookings = await GroupBooking.find(filter)
      .populate('tripId', 'title destination startDate endDate coverImage')
      .populate('mainBookerId', 'name email phone')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await GroupBooking.countDocuments(filter);

    res.json({
      success: true,
      data: {
        bookings,
        pagination: {
          current: Number(page),
          total: Math.ceil(total / Number(limit)),
          count: bookings.length,
          totalBookings: total
        }
      }
    });

  } catch (error: any) {
    logger.error('Error fetching organizer bookings', { error: error.message, userId: req.user.id });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch organizer bookings'
    });
  }
});

/**
 * @route GET /api/group-bookings/trip/:tripId/packages
 * @description Get trip packages for booking
 * @access Public
 */
router.get('/trip/:tripId/packages', async (req: Request, res: Response) => {
  try {
    const { tripId } = req.params;

    const trip = await Trip.findById(tripId);
    if (!trip) {
      return res.status(404).json({
        success: false,
        message: 'Trip not found'
      });
    }

    const packages = trip.packages
      .filter((pkg: any) => pkg.isActive)
      .sort((a: any, b: any) => (a.sortOrder || 0) - (b.sortOrder || 0));

    res.json({
      success: true,
      data: {
        packages,
        defaultPrice: trip.price,
        paymentConfig: trip.paymentConfig
      }
    });

  } catch (error: any) {
    logger.error('Error fetching trip packages', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch packages'
    });
  }
});

export default router;
