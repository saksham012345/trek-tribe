import express, { Request, Response } from 'express';
import { z } from 'zod';
import { auth, AuthPayload } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { shapeTrip, tripInclude } from '../services/tripShapeService';
import {
  bookingInclude,
  shapeBooking,
  calculateGroupDiscount,
  computeBookingAmounts
} from '../services/bookingShapeService';
import { addPaidParticipant, leaveTrip } from '../services/tripParticipationService';
import { toNumber } from '../lib/money';
import { User } from '../models/User';
import { logger } from '../utils/logger';
import mongoose from 'mongoose';

import { AuthenticatedRequest } from '../types/app-types';

// Extend Request interface
// interface AuthenticatedRequest extends Request {
//   user: AuthPayload;
// }


const router = express.Router();

/**
 * Recompute the group discount and the amounts that depend on it.
 *
 * The Mongoose version set groupDiscount and saved, and a pre-save hook
 * recomputed the money from numberOfGuests. The hook is gone, so the recompute
 * is explicit - and it has to be, because the CHECK constraints on
 * group_bookings refuse a row whose discountAmount and finalAmount do not
 * follow from its total and its discount rate.
 *
 * numberOfGuests is deliberately not touched. It is what the traveller is being
 * charged for; the participant list is who is coming. The old code let those
 * two drift, and changing that is a pricing decision rather than a migration
 * one.
 */
async function recalculateDiscount(bookingId: string): Promise<void> {
  const booking = await prisma.groupBooking.findUnique({
    where: { id: bookingId },
    include: { participants: true }
  });
  if (!booking) return;

  const groupDiscount = calculateGroupDiscount(booking.participants.length);
  const amounts = computeBookingAmounts({
    pricePerPerson: toNumber(booking.pricePerPerson),
    numberOfGuests: booking.numberOfGuests,
    groupDiscount,
    advanceAmount: booking.advanceAmount != null ? toNumber(booking.advanceAmount) : undefined
  });

  await prisma.groupBooking.update({
    where: { id: bookingId },
    data: {
      groupDiscount: amounts.groupDiscount,
      totalAmount: amounts.totalAmount,
      discountAmount: amounts.discountAmount,
      finalAmount: amounts.finalAmount,
      remainingAmount: amounts.remainingAmount
    }
  });
}

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
    const tripRow = await prisma.trip.findUnique({ where: { id: tripId }, include: tripInclude });
    const trip: any = tripRow ? shapeTrip(tripRow) : null;
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
    // Was a Mongoose static; Prisma has nowhere to hang one, and it was a pure
    // function of the party size all along.
    const groupDiscount = calculateGroupDiscount(actualNumberOfGuests);

    // Mark the first participant as main booker.
    //
    // The stored gender value keeps its hyphen ('prefer-not-to-say'), which a
    // Prisma enum member cannot contain, so the member is prefer_not_to_say and
    // the request value is translated here. Casting instead would have compiled
    // and then been refused by the database at runtime.
    const processedParticipants = participants.map((participant, index) => ({
      name: participant.name,
      email: participant.email,
      phone: participant.phone,
      dateOfBirth: participant.dateOfBirth ? new Date(participant.dateOfBirth) : undefined,
      gender: participant.gender === 'prefer-not-to-say'
        ? ('prefer_not_to_say' as const)
        : participant.gender,
      emergencyContactName: participant.emergencyContactName,
      emergencyContactPhone: participant.emergencyContactPhone,
      medicalConditions: participant.medicalConditions,
      dietaryRestrictions: participant.dietaryRestrictions,
      experienceLevel: participant.experienceLevel,
      specialRequests: participant.specialRequests,
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

    // The pre-save hook that computed the amounts is gone; they are computed
    // here so they satisfy the CHECK constraints that say the parts add up.
    const amounts = computeBookingAmounts({
      pricePerPerson,
      numberOfGuests: actualNumberOfGuests,
      groupDiscount,
      advanceAmount: paymentType === 'advance' ? advanceAmount : undefined
    });

    let groupBooking: any;
    try {
      groupBooking = await prisma.groupBooking.create({
        data: {
          tripId,
          mainBookerId: req.user.id,
          numberOfGuests: actualNumberOfGuests,
          selectedPackageId,
          packageName,
          pricePerPerson,
          groupDiscount: amounts.groupDiscount,
          totalAmount: amounts.totalAmount,
          discountAmount: amounts.discountAmount,
          finalAmount: amounts.finalAmount,
          remainingAmount: amounts.remainingAmount,
          paymentType,
          advanceAmount,
          paymentMethod,
          specialRequests,
          notes,
          participants: { create: processedParticipants }
        },
        include: bookingInclude
      });
    } catch (error: any) {
      // (main_booker_id, trip_id) is unique.
      if (error?.code === 'P2002') {
        return res.status(400).json({
          success: false,
          message: 'You already have a booking for this trip'
        });
      }
      throw error;
    }

    // Add the booker to the trip.
    //
    // This was:
    //
    //     const participantIds = Array(participants.length)
    //       .fill(new mongoose.Types.ObjectId(req.user.id));
    //     trip.participants.push(...participantIds);
    //
    // which pushed the *same* user once per person in the party - a group of
    // five added the booker five times. The participant list is what capacity
    // is measured against, so a five-person booking consumed five seats held by
    // one person, and the same person could not be removed cleanly afterwards.
    //
    // One traveller is one row; the unique constraint refuses the other four.
    await addPaidParticipant(tripId, req.user.id);

    const populatedBooking: any = shapeBooking(groupBooking);
    populatedBooking.tripId = trip;
    populatedBooking.mainBookerId =
      (await User.findById(req.user.id).select('name email phone').lean()) ?? req.user.id;

    res.status(201).json({
      success: true,
      message: 'Group booking created successfully',
      data: {
        booking: populatedBooking,
        discountApplied: groupDiscount,
        totalSaved: toNumber(groupBooking.discountAmount)
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

    const filter: any = { mainBookerId: req.user.id };
    if (status && typeof status === 'string') {
      filter.bookingStatus = status;
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [rows, total] = await Promise.all([
      prisma.groupBooking.findMany({
        where: filter,
        include: bookingInclude,
        orderBy: { createdAt: 'desc' },
        skip,
        take: Number(limit)
      }),
      prisma.groupBooking.count({ where: filter })
    ]);

    const booker = await User.findById(req.user.id).select('name email phone').lean();
    const bookings = rows.map(row => {
      const booking: any = shapeBooking(row);
      booking.tripId = row.trip ? shapeTrip(row.trip as any) : null;
      booking.mainBookerId = booker ?? row.mainBookerId;
      return booking;
    });

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
    const row = await prisma.groupBooking.findUnique({
      where: { id: req.params.bookingId },
      include: bookingInclude
    });

    if (!row) {
      return res.status(404).json({
        success: false,
        message: 'Group booking not found'
      });
    }

    const booking: any = shapeBooking(row);
    booking.tripId = row.trip ? shapeTrip(row.trip as any) : null;
    booking.mainBookerId =
      (await User.findById(row.mainBookerId).select('name email phone').lean()) ?? row.mainBookerId;

    // Check if user has access to this booking. The ids are compared directly
    // rather than reached through whatever populate happened to attach.
    if (row.mainBookerId !== req.user.id && row.trip?.organizerId !== req.user.id) {
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

    const booking = await prisma.groupBooking.findUnique({
      where: { id: req.params.bookingId },
      include: { participants: true }
    });
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Group booking not found'
      });
    }

    // Check if user is the main booker
    if (booking.mainBookerId !== req.user.id) {
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

      // Was an instance method that pushed onto the array and threw at twenty.
      // The cap is checked here; the email being unique within the booking is
      // the database's job.
      if (booking.participants.length >= 20) {
        return res.status(400).json({
          success: false,
          message: 'Maximum 20 participants allowed per group booking'
        });
      }

      try {
        // Fields listed rather than spread, for the same reason as the create
        // path: the gender value has to be translated, and casting to `any`
        // would only move the mismatch from the compiler to the database.
        await prisma.bookingParticipant.create({
          data: {
            bookingId: booking.id,
            name: validation.data.name,
            email: validation.data.email,
            phone: validation.data.phone,
            dateOfBirth: validation.data.dateOfBirth ? new Date(validation.data.dateOfBirth) : undefined,
            gender: validation.data.gender === 'prefer-not-to-say'
              ? ('prefer_not_to_say' as const)
              : validation.data.gender,
            emergencyContactName: validation.data.emergencyContactName,
            emergencyContactPhone: validation.data.emergencyContactPhone,
            medicalConditions: validation.data.medicalConditions,
            dietaryRestrictions: validation.data.dietaryRestrictions,
            experienceLevel: validation.data.experienceLevel,
            specialRequests: validation.data.specialRequests,
            isMainBooker: false
          }
        });
      } catch (error: any) {
        if (error?.code === 'P2002') {
          return res.status(409).json({
            success: false,
            message: 'That participant is already on this booking'
          });
        }
        throw error;
      }

      await recalculateDiscount(booking.id);
    } else if (action === 'remove') {
      if (!participant.email) {
        return res.status(400).json({
          success: false,
          message: 'Participant email is required for removal'
        });
      }

      const participantToRemove = booking.participants.find(
        (pp) => pp.email.toLowerCase() === participant.email.toLowerCase()
      );

      if (!participantToRemove) {
        return res.status(404).json({
          success: false,
          message: 'Participant not found'
        });
      }

      if (participantToRemove.isMainBooker && booking.participants.length > 1) {
        return res.status(400).json({
          success: false,
          message: 'Cannot remove main booker. Transfer main booker role first.'
        });
      }

      // The splice-then-check this replaces removed the participant first and
      // only then noticed the booking was left empty - it returned the error
      // without saving, so the removal was discarded by accident rather than on
      // purpose. Checked before the delete now.
      if (booking.participants.length === 1) {
        return res.status(400).json({
          success: false,
          message: 'Cannot remove all participants'
        });
      }

      await prisma.bookingParticipant.delete({ where: { id: participantToRemove.id } });
      await recalculateDiscount(booking.id);
    }

    const updatedRow = await prisma.groupBooking.findUnique({
      where: { id: booking.id },
      include: bookingInclude
    });
    const updatedBooking: any = shapeBooking(updatedRow);
    updatedBooking.tripId = updatedRow?.trip ? shapeTrip(updatedRow.trip as any) : null;
    updatedBooking.mainBookerId =
      (await User.findById(booking.mainBookerId).select('name email').lean()) ?? booking.mainBookerId;

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

    const booking = await prisma.groupBooking.findUnique({
      where: { id: req.params.bookingId },
      include: { participants: true }
    });
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Group booking not found'
      });
    }

    // Check if user is the main booker
    if (booking.mainBookerId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Only the current main booker can transfer the role'
      });
    }

    const currentMainBooker = booking.participants.find((pp) => pp.isMainBooker);
    const newMainBooker = booking.participants.find(
      (pp) => pp.email.toLowerCase() === newMainBookerEmail.toLowerCase()
    );

    if (!newMainBooker) {
      return res.status(404).json({
        success: false,
        message: 'New main booker not found in participants'
      });
    }

    // Clear the old flag before setting the new one, in one transaction. A
    // partial unique index allows exactly one main booker per booking, so
    // setting the new flag first would be refused - and doing it as two
    // separate saves, which is what this used to be, could leave a booking with
    // two main bookers or none if the second write never happened.
    await prisma.$transaction(async (tx) => {
      if (currentMainBooker) {
        await tx.bookingParticipant.update({
          where: { id: currentMainBooker.id },
          data: { isMainBooker: false }
        });
      }
      await tx.bookingParticipant.update({
        where: { id: newMainBooker.id },
        data: { isMainBooker: true }
      });
    });

    const transferred = await prisma.groupBooking.findUnique({
      where: { id: booking.id },
      include: bookingInclude
    });

    res.json({
      success: true,
      message: 'Main booker role transferred successfully',
      data: { booking: shapeBooking(transferred) }
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

    const existing = await prisma.groupBooking.findUnique({
      where: { id: req.params.bookingId },
      include: { trip: true }
    });
    if (!existing || !existing.trip) {
      return res.status(404).json({
        success: false,
        message: 'Group booking not found'
      });
    }

    // Check if user is the trip organizer
    if (existing.trip.organizerId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Only the trip organizer can update payment status'
      });
    }

    const data: any = { paymentStatus };
    if (paymentTransactionId) {
      data.paymentTransactionId = paymentTransactionId;
    }
    if (paymentDetails) {
      // paymentDetails was a nested object merged over the existing one. Its
      // four fields are columns, so only the ones supplied are written and the
      // rest keep their values - which is what the spread was for.
      if (paymentDetails.paymentGateway !== undefined) data.paymentGateway = paymentDetails.paymentGateway;
      if (paymentDetails.gatewayTransactionId !== undefined) data.gatewayTransactionId = paymentDetails.gatewayTransactionId;
      if (paymentDetails.paymentReference !== undefined) data.paymentReference = paymentDetails.paymentReference;
      data.transactionDate = new Date();
    }

    // Update booking status based on payment
    if (paymentStatus === 'completed') {
      data.bookingStatus = 'confirmed';
    } else if (paymentStatus === 'failed' || paymentStatus === 'refunded') {
      data.bookingStatus = 'cancelled';
    }

    const booking = await prisma.groupBooking.update({
      where: { id: existing.id },
      data,
      include: bookingInclude
    });

    res.json({
      success: true,
      message: 'Payment status updated successfully',
      data: { booking: shapeBooking(booking) }
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

    const existing = await prisma.groupBooking.findUnique({
      where: { id: req.params.bookingId }
    });
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Group booking not found'
      });
    }

    // Check if user is the main booker
    if (existing.mainBookerId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Only the main booker can cancel the booking'
      });
    }

    // Read the status, check it, then write it - two clicks on Cancel both
    // passed. The claim and the check are one statement.
    const cancelled = await prisma.groupBooking.updateMany({
      where: { id: existing.id, bookingStatus: { not: 'cancelled' } },
      data: {
        bookingStatus: 'cancelled',
        cancellationReason,
        cancellationDate: new Date()
      }
    });

    if (cancelled.count === 0) {
      return res.status(400).json({
        success: false,
        message: 'Booking is already cancelled'
      });
    }

    // Remove the booker from the trip.
    //
    // This was:
    //
    //     const participantCount = booking.participants.length;
    //     trip.participants = trip.participants.slice(0, -participantCount);
    //
    // which drops that many entries from the *end* of the participant list,
    // whoever they happen to be. Cancelling a booking removed other people's
    // places - as many of them as there were people on the cancelled booking.
    // Removing the booker removes the booker.
    await leaveTrip(existing.tripId, existing.mainBookerId);

    const booking = await prisma.groupBooking.findUnique({
      where: { id: existing.id },
      include: bookingInclude
    });

    res.json({
      success: true,
      message: 'Group booking cancelled successfully',
      data: { booking: shapeBooking(booking) }
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
    const organizerTrips = await prisma.trip.findMany({
      where: { organizerId: req.user.id },
      select: { id: true }
    });
    const tripIds = organizerTrips.map(trip => trip.id);

    if (tripIds.length === 0) {
      return res.json({
        success: true,
        data: {
          bookings: [],
          pagination: { current: 1, total: 0, count: 0, totalBookings: 0 }
        }
      });
    }

    // `trip: { organizerId }` is the same filter as the id list, so the id list
    // above is only kept for the early return when the organizer has no trips.
    const filter: any = { trip: { organizerId: req.user.id } };
    if (status && typeof status === 'string') {
      filter.bookingStatus = status;
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [rows, total] = await Promise.all([
      prisma.groupBooking.findMany({
        where: filter,
        include: bookingInclude,
        orderBy: { createdAt: 'desc' },
        skip,
        take: Number(limit)
      }),
      prisma.groupBooking.count({ where: filter })
    ]);

    const bookerIds = Array.from(new Set(rows.map(r => r.mainBookerId)));
    const bookers = bookerIds.length
      ? await User.find({ _id: { $in: bookerIds } }, 'name email phone').lean()
      : [];
    const bookerById = new Map(bookers.map((u: any) => [u._id.toString(), u]));

    const bookings = rows.map(row => {
      const booking: any = shapeBooking(row);
      booking.tripId = row.trip ? shapeTrip(row.trip as any) : null;
      booking.mainBookerId = bookerById.get(row.mainBookerId) ?? row.mainBookerId;
      return booking;
    });

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

    const tripRow = await prisma.trip.findUnique({ where: { id: tripId }, include: tripInclude });
    if (!tripRow) {
      return res.status(404).json({
        success: false,
        message: 'Trip not found'
      });
    }

    const trip: any = shapeTrip(tripRow);
    // The packages come back ordered by sortOrder from the database, so the
    // in-memory sort is gone; only the active filter remains.
    const packages = trip.packages.filter((pkg: any) => pkg.isActive);

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
