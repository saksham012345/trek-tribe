import { Router } from 'express';
import { z } from 'zod';
import { Payment } from '../models/Payment';
import { Trip } from '../models/Trip';
import { User } from '../models/User';
import { authenticateJwt } from '../middleware/auth';

const router = Router();

// Async error wrapper
const asyncHandler = (fn: Function) => (req: any, res: any, next: any) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Schema for creating a booking/payment
const createBookingSchema = z.object({
  tripId: z.string().min(1),
  paymentType: z.enum(['full', 'advance']),
  paymentMethod: z.enum(['upi', 'card', 'netbanking', 'wallet', 'qr_code']),
  participants: z.array(z.object({
    userId: z.string().optional(),
    name: z.string().min(1),
    email: z.string().email(),
    phone: z.string().optional(),
    emergencyContact: z.object({
      name: z.string().min(1),
      phone: z.string().min(1),
      relationship: z.string().min(1)
    })
  })).min(1).max(10) // Allow booking for multiple people
});

// Create a new booking with payment
router.post('/book', authenticateJwt, asyncHandler(async (req: any, res: any) => {
  try {
    const userId = req.auth.userId;
    const parsed = createBookingSchema.safeParse(req.body);
    
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: parsed.error.flatten().fieldErrors
      });
    }
    
    const { tripId, paymentType, paymentMethod, participants } = parsed.data;
    
    // Get trip details
    const trip = await Trip.findById(tripId).populate('organizerId');
    if (!trip) {
      return res.status(404).json({
        success: false,
        error: 'Trip not found'
      });
    }
    
    // Calculate payment amount
    let amount = trip.price * participants.length;
    let advanceAmount = 0;
    let balanceAmount = 0;
    
    if (paymentType === 'advance') {
      if (trip.paymentOptions?.allowAdvancePayment) {
        if (trip.paymentOptions.advanceAmount) {
          advanceAmount = trip.paymentOptions.advanceAmount * participants.length;
        } else if (trip.paymentOptions.advancePercentage) {
          advanceAmount = (amount * trip.paymentOptions.advancePercentage) / 100;
        } else {
          advanceAmount = amount * 0.3; // Default 30%
        }
        amount = advanceAmount;
        balanceAmount = (trip.price * participants.length) - advanceAmount;
      } else {
        return res.status(400).json({
          success: false,
          error: 'Advance payment not allowed for this trip'
        });
      }
    }
    
    // Create payment record
    const payment = await Payment.create({
      userId,
      tripId,
      organizerId: trip.organizerId,
      amount,
      paymentMethod,
      paymentGateway: 'razorpay',
      paymentType,
      advanceAmount: paymentType === 'advance' ? advanceAmount : undefined,
      balanceAmount: paymentType === 'advance' ? balanceAmount : undefined,
      participants,
      status: 'pending'
    });
    
    // Generate QR code data for QR payments
    let qrCodeData = '';
    if (paymentMethod === 'qr_code') {
      qrCodeData = await generateQRPaymentData(payment, amount);
      payment.qrCodeData = qrCodeData;
      await payment.save();
    }
    
    res.json({
      success: true,
      message: 'Booking created successfully',
      payment: {
        bookingId: payment.bookingId,
        paymentId: payment._id,
        amount,
        paymentType,
        paymentMethod,
        participants: participants.length,
        qrCodeData,
        status: payment.status,
        termsAndConditions: {
          cancellationPolicy: trip.cancellationPolicy,
          refundPolicy: trip.paymentOptions?.refundPolicy || 'Standard refund policy applies',
          advancePaymentNote: paymentType === 'advance' ? 
            `₹${advanceAmount} must be paid now. Balance ₹${balanceAmount} due before trip starts.` : null
        }
      }
    });
    
  } catch (error: any) {
    console.error('Error creating booking:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create booking'
    });
  }
}));

// Get user's bookings
router.get('/my-bookings', authenticateJwt, asyncHandler(async (req: any, res: any) => {
  try {
    const userId = req.auth.userId;
    const { status, page = 1, limit = 10 } = req.query;
    
    const filter: any = { userId };
    if (status) filter.status = status;
    
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    
    const bookings = await Payment.find(filter)
      .populate('tripId', 'title destination startDate endDate price status images')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit as string))
      .lean();
    
    const totalCount = await Payment.countDocuments(filter);
    
    res.json({
      success: true,
      bookings,
      pagination: {
        currentPage: parseInt(page as string),
        totalPages: Math.ceil(totalCount / parseInt(limit as string)),
        totalCount
      }
    });
    
  } catch (error: any) {
    console.error('Error fetching bookings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch bookings'
    });
  }
}));

// Generate QR payment data (placeholder - integrate with actual payment gateway)
async function generateQRPaymentData(payment: any, amount: number): Promise<string> {
  // This is a placeholder for UPI QR code generation
  // In production, integrate with payment gateways like Razorpay, Paytm, etc.
  const upiId = process.env.UPI_ID || 'merchant@upi';
  const merchantName = 'Trek Tribe';
  
  const qrData = `upi://pay?pa=${upiId}&pn=${merchantName}&am=${amount}&cu=INR&tn=TrekTribe%20Booking%20${payment.bookingId}`;
  
  return qrData;
}

export default router;
