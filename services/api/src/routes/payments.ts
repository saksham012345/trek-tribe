import express from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { authenticateJwt } from '../middleware/auth';
import { razorpayService, SUBSCRIPTION_PLANS } from '../services/razorpayService';
import { Payment } from '../models/Payment';
import { OrganizerSubscription } from '../models/OrganizerSubscription';
import { Trip } from '../models/Trip';
import { GroupBooking } from '../models/GroupBooking';
import { User } from '../models/User';
import { logger } from '../utils/logger';
import { emailService } from '../services/emailService';

const router = express.Router();

// -------------------------------------------------------------------------
// 1. Subscription Checkout
// -------------------------------------------------------------------------
const subscriptionCheckoutSchema = z.object({
    planId: z.string()
});

router.post('/checkout/subscription', authenticateJwt, async (req, res) => {
    try {
        const userId = (req as any).auth.userId;
        const { planId } = subscriptionCheckoutSchema.parse(req.body);

        const plan = SUBSCRIPTION_PLANS[planId as keyof typeof SUBSCRIPTION_PLANS];
        if (!plan) {
            return res.status(400).json({ error: 'Invalid plan selected' });
        }

        // Check if user is an organizer
        const user = await User.findById(userId);
        if (user?.role !== 'organizer') {
            return res.status(403).json({ error: 'Only organizers can purchase subscriptions' });
        }

        // Get or create subscription record
        let subscription = await OrganizerSubscription.findOne({ organizerId: userId });
        if (!subscription) {
            subscription = await OrganizerSubscription.create({ organizerId: userId });
        }

        // Idempotency: Check if there's already a created payment for this plan
        // (Optional optimization: if pending order exists, reuse it? For now, create new)

        // Create Razorpay Order
        const amountInPaise = plan.price;
        const currency = 'INR';
        const receipt = `sub_${userId.slice(-6)}_${Date.now()}`;

        const order = await razorpayService.createOrder({
            amount: amountInPaise,
            currency,
            receipt,
            notes: {
                type: 'subscription',
                userId: userId,
                planId: planId
            }
        });

        // Create Payment Record
        const payment = await Payment.create({
            amount: amountInPaise,
            currency,
            razorpayOrderId: order.id,
            status: 'created',
            type: 'subscription',
            metadata: {
                userId: userId,
                subscriptionId: subscription._id
            }
        });

        res.json({
            orderId: order.id,
            amount: amountInPaise,
            currency,
            keyId: razorpayService.getKeyId(),
            paymentId: payment._id, // Internal ID
            planName: plan.name,
            description: plan.description
        });

    } catch (error: any) {
        logger.error('Subscription checkout failed', { error: error.message, userId: (req as any).auth.userId });
        res.status(500).json({ error: 'Checkout failed', details: error.message });
    }
});

// -------------------------------------------------------------------------
// 2. Trip Booking Checkout
// -------------------------------------------------------------------------
const bookingCheckoutSchema = z.object({
    tripId: z.string(),
    numberOfTravelers: z.number().min(1),
    bookingId: z.string().optional() // If retrying payment for existing booking
});

router.post('/checkout/booking', authenticateJwt, async (req, res) => {
    try {
        const userId = (req as any).auth.userId;
        const { tripId, numberOfTravelers, bookingId } = bookingCheckoutSchema.parse(req.body);

        const trip = await Trip.findById(tripId);
        if (!trip) return res.status(404).json({ error: 'Trip not found' });

        // Validate availability
        const currentParticipants = trip.participants.length; // Rough check, real aggregation better
        if (trip.capacity - currentParticipants < numberOfTravelers) {
            return res.status(400).json({ error: 'Not enough spots available' });
        }

        // Calculate Amount
        // 4% Platform Fee is INCLUDED in the price, not added on top.
        // Total Amount = Price * Travelers.
        // TrekTribe collects Total Amount.
        const totalAmount = trip.price * numberOfTravelers;
        const amountInPaise = totalAmount * 100;

        let booking;
        if (bookingId) {
            booking = await GroupBooking.findOne({ _id: bookingId, mainBookerId: userId });
            if (!booking) return res.status(404).json({ error: 'Booking not found' });
        } else {
            // We do NOT create the booking here to avoid "ghost bookings".
            // Booking is created AFTER successful payment in the /verify step?
            // OR: We create a "pending_payment" booking now?
            // Better: Create 'pending_payment' booking now so we have a reference.

            // Note: Full booking creation logic (validation, traveler details) is complex.
            // Ideally, the frontend calls /bookings first to create a pending booking, 
            // then calls /checkout/booking with bookingId.
            // For this MVP, let's assume the user MUST pass a bookingId (created via normal booking flow).
            return res.status(400).json({ error: 'Please create a booking first' });
        }

        const receipt = `bk_${userId.slice(-6)}_${Date.now()}`;
        const order = await razorpayService.createOrder({
            amount: amountInPaise,
            currency: 'INR',
            receipt,
            notes: {
                type: 'trip_booking',
                userId,
                tripId,
                bookingId: booking._id.toString()
            }
        });

        const payment = await Payment.create({
            amount: amountInPaise,
            currency: 'INR',
            razorpayOrderId: order.id,
            status: 'created',
            type: 'trip_booking',
            metadata: {
                userId,
                tripId: trip._id,
                bookingId: booking._id
            }
        });

        res.json({
            orderId: order.id,
            amount: amountInPaise,
            currency: 'INR',
            keyId: razorpayService.getKeyId(),
            paymentId: payment._id
        });

    } catch (error: any) {
        logger.error('Booking checkout failed', { error: error.message });
        res.status(500).json({ error: 'Checkout failed' });
    }
});

// -------------------------------------------------------------------------
// 3. Verify Payment & Fulfill
// -------------------------------------------------------------------------
const verifySchema = z.object({
    razorpayOrderId: z.string(),
    razorpayPaymentId: z.string(),
    razorpaySignature: z.string()
});

router.post('/verify', authenticateJwt, async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const userId = (req as any).auth.userId;
        const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = verifySchema.parse(req.body);

        // 1. Verify Signature
        const isValid = razorpayService.verifyPaymentSignature({
            razorpayOrderId,
            razorpayPaymentId,
            razorpaySignature
        });

        if (!isValid) {
            await session.abortTransaction();
            return res.status(400).json({ error: 'Invalid payment signature' });
        }

        // 2. Find Payment Record
        const payment = await Payment.findOne({ razorpayOrderId }).session(session);
        if (!payment) {
            await session.abortTransaction();
            return res.status(404).json({ error: 'Payment record not found' });
        }

        if (payment.status === 'paid') {
            await session.commitTransaction();
            return res.json({ status: 'success', message: 'Payment already processed' });
        }

        // 3. Update Payment Status
        payment.status = 'paid';
        payment.razorpayPaymentId = razorpayPaymentId;
        payment.razorpaySignature = razorpaySignature;
        await payment.save({ session });

        // 4. Fulfill Order based on Type
        if (payment.type === 'subscription') {
            const subscription = await OrganizerSubscription.findById(payment.metadata.subscriptionId).session(session);
            if (!subscription) throw new Error('Subscription not found');

            // Logic: Pay 1 Month -> Get 2 Months (First Time Only?)
            // Check if this is their first successful payment?
            // Or just apply the rule? The user said "whoever joins first needs to clear thier payment scene... then provide access for 2 months"
            // Let's implement: If NO previous payments, give 2 months. Else, standard 1 month.

            const previousPayments = await Payment.countDocuments({
                'metadata.subscriptionId': subscription._id,
                status: 'paid',
                _id: { $ne: payment._id } // Exclude current
            }).session(session);

            const isFirstPayment = previousPayments === 0;
            const monthsToAdd = isFirstPayment ? 2 : 1;

            // Activate Subscription
            subscription.status = 'active';
            subscription.subscriptionStartDate = new Date(); // Or today if expired

            // Calculate End Date
            let endDate = subscription.subscriptionEndDate && subscription.subscriptionEndDate > new Date()
                ? new Date(subscription.subscriptionEndDate)
                : new Date();

            endDate.setMonth(endDate.getMonth() + monthsToAdd);
            subscription.subscriptionEndDate = endDate;

            // Update trips limit (refresh to 5 or add?) -> "5 trips available for 2 months"
            // Reset to 5 for the new cycle
            subscription.tripsRemaining = 5;
            subscription.tripsPerCycle = 5;

            await subscription.save({ session });

            // Log Success
            logger.info('Subscription activated', { userId, monthsAdded: monthsToAdd });

        } else if (payment.type === 'trip_booking') {
            const booking = await GroupBooking.findById(payment.metadata.bookingId).session(session);
            const trip = await Trip.findById(payment.metadata.tripId).session(session);

            if (!booking || !trip) throw new Error('Booking or Trip not found');

            booking.paymentStatus = 'completed';
            booking.bookingStatus = 'confirmed'; // Auto-confirm on payment
            booking.paymentMethod = 'razorpay';
            booking.paidAmount = payment.amount / 100; // Convert back to rupees

            // Add user to trip participants if not already there
            if (!trip.participants.includes(booking.mainBookerId)) {
                trip.participants.push(booking.mainBookerId);
            }
            // Note: managing `availableSpots` is implicit via `participants.length`

            await booking.save({ session });
            await trip.save({ session });

            logger.info('Booking confirmed', { bookingId: booking._id, tripId: trip._id });

            // Send Email (Non-blocking, outside transaction)
            // We'll execute this after commit
        }

        await session.commitTransaction();
        res.json({ status: 'success', type: payment.type });

    } catch (error: any) {
        if (session.inTransaction()) {
            await session.abortTransaction();
        }
        logger.error('Payment verification failed', { error: error.message });
        res.status(500).json({ error: 'Verification failed' });
    } finally {
        session.endSession();
    }
});

export default router;
