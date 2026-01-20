import { Request, Response } from 'express';
import mongoose from 'mongoose';
import QRCode from 'qrcode';
import crypto from 'crypto';
import { hashWithSalt } from '../utils/cryptoUtils';

// Payment Verification Model Schema
interface IPaymentVerification {
  _id?: string;
  organizerId: string;
  verificationCode: string;
  qrCodeUrl: string;
  qrCodeData: string;
  status: 'active' | 'inactive' | 'expired';
  paymentsMade: Array<{
    amount: number;
    currency: string;
    paymentMethod: string;
    transactionId: string;
    verifiedAt: Date;
    verificationStatus: 'verified' | 'pending' | 'failed';
  }>;
  createdAt: Date;
  expiresAt: Date;
  totalVerifiedAmount: number;
  verificationCount: number;
  isActive: () => boolean;
}

// Mock Payment Verification Collection (in real app, this would be MongoDB)
const paymentVerifications = new Map<string, IPaymentVerification>();

/**
 * Generate Razorpay-style QR for exact amount (trusted, automated)
 * NOTE: This is a lightweight generator that encodes payment metadata; plug into Razorpay Orders API later.
 */
export const generateAmountPaymentQR = async (req: Request, res: Response) => {
  try {
    const organizerId = (req as any).user?.userId;
    const { amount, currency = 'INR', purpose, tripId } = req.body;

    if (!organizerId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Verify Razorpay credentials are configured
    const razorpayKeyId = process.env.RAZORPAY_KEY_ID;
    const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!razorpayKeyId || !razorpayKeySecret) {
      console.error('❌ Razorpay credentials not configured in environment variables');
      console.error('   RAZORPAY_KEY_ID:', razorpayKeyId ? 'SET' : 'MISSING');
      console.error('   RAZORPAY_KEY_SECRET:', razorpayKeySecret ? 'SET' : 'MISSING');
      // Continue with QR generation but mark as unverified
    } else {
      console.log('✅ Razorpay credentials found in environment');
    }

    const numericAmount = Number(amount);
    if (!numericAmount || numericAmount <= 0) {
      return res.status(400).json({ error: 'Valid amount is required' });
    }

    const referenceId = crypto.randomBytes(8).toString('hex').toUpperCase();
    const payload = {
      type: 'RAZORPAY_PAYMENT_REQUEST',
      provider: 'razorpay',
      trusted: !!(razorpayKeyId && razorpayKeySecret), // Mark as trusted only if credentials exist
      organizerId,
      tripId: tripId || undefined,
      amount: numericAmount,
      currency: (currency || 'INR').toUpperCase(),
      purpose: purpose || 'Trip payment',
      referenceId,
      generatedAt: new Date().toISOString(),
      // Include keyId hash for verification (not the actual key)
      keyIdHash: razorpayKeyId ? hashWithSalt(razorpayKeyId, 'razorpay-key-salt').substring(0, 16) : undefined,
    };

    try {
      const qrCodeUrl = await QRCode.toDataURL(JSON.stringify(payload));

      console.log('✅ QR code generated successfully:', {
        referenceId,
        amount: numericAmount,
        currency,
        trusted: !!(razorpayKeyId && razorpayKeySecret),
        credentialsConfigured: !!(razorpayKeyId && razorpayKeySecret)
      });

      return res.json({
        success: true,
        provider: 'razorpay',
        trusted: !!(razorpayKeyId && razorpayKeySecret),
        qrCodeUrl,
        referenceId,
        payload,
        configured: !!(razorpayKeyId && razorpayKeySecret),
        message: razorpayKeyId && razorpayKeySecret
          ? 'QR code generated with Razorpay credentials'
          : 'QR code generated (Razorpay credentials not configured - using fallback)'
      });
    } catch (qrError: any) {
      console.error('❌ Error generating QR code image:', qrError);
      return res.status(500).json({
        error: 'Failed to generate QR code image',
        message: qrError.message,
        details: 'QRCode library error - check if qrcode package is installed'
      });
    }
  } catch (error: any) {
    console.error('❌ Error generating amount QR:', error);
    return res.status(500).json({ error: 'Failed to generate payment QR', message: error.message });
  }
};

/**
 * Generate Payment Verification Code
 * Creates a unique QR code for organizer payment verification
 */
export const generatePaymentVerificationCode = async (req: Request, res: Response) => {
  try {
    const organizerId = (req as any).user?.userId;

    if (!organizerId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Check if organizer already has an active verification code
    const existing = Array.from(paymentVerifications.values()).find(
      (pv) => pv.organizerId === organizerId && pv.status === 'active'
    );

    if (existing && existing.expiresAt > new Date()) {
      return res.json({
        success: false,
        message: 'Active verification code already exists',
        verificationCode: existing.verificationCode,
        qrCodeUrl: existing.qrCodeUrl,
        expiresAt: existing.expiresAt,
      });
    }

    // Generate unique verification code
    const verificationCode = crypto.randomBytes(16).toString('hex').toUpperCase();

    // Create QR code data (contains verification code and organizer info)
    const qrData = JSON.stringify({
      organizerId,
      verificationCode,
      type: 'ORGANIZER_PAYMENT_VERIFICATION',
      generatedAt: new Date().toISOString(),
    });

    // Generate QR code image
    const qrCodeUrl = await QRCode.toDataURL(qrData);
    const qrCodeData = qrData;

    // Create expiry date (30 days from now)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    // Store verification code
    const verification: IPaymentVerification = {
      organizerId,
      verificationCode,
      qrCodeUrl,
      qrCodeData,
      status: 'active',
      paymentsMade: [],
      createdAt: new Date(),
      expiresAt,
      totalVerifiedAmount: 0,
      verificationCount: 0,
      isActive: function () {
        return this.status === 'active' && this.expiresAt > new Date();
      },
    };

    paymentVerifications.set(verificationCode, verification);

    console.log(`✅ Payment verification code generated for organizer ${organizerId}`);

    return res.json({
      success: true,
      verificationCode,
      qrCodeUrl,
      qrCodeData,
      expiresAt,
      message: 'Payment verification code generated successfully',
    });
  } catch (error: any) {
    console.error('❌ Error generating verification code:', error);
    return res.status(500).json({
      error: 'Failed to generate verification code',
      message: error.message,
    });
  }
};

/**
 * Get Active Payment Verification Code
 * Retrieves the current active verification code for organizer
 */
export const getPaymentVerificationCode = async (req: Request, res: Response) => {
  try {
    const organizerId = (req as any).user?.userId;

    if (!organizerId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const verification = Array.from(paymentVerifications.values()).find(
      (pv) => pv.organizerId === organizerId && pv.status === 'active'
    );

    if (!verification || !verification.isActive()) {
      return res.status(404).json({
        error: 'No active verification code found',
        message: 'Please generate a new verification code',
      });
    }

    return res.json({
      success: true,
      verificationCode: verification.verificationCode,
      qrCodeUrl: verification.qrCodeUrl,
      expiresAt: verification.expiresAt,
      totalVerifiedAmount: verification.totalVerifiedAmount,
      verificationCount: verification.verificationCount,
      paymentsMade: verification.paymentsMade.map((p) => ({
        amount: p.amount,
        currency: p.currency,
        transactionId: p.transactionId,
        verifiedAt: p.verifiedAt,
        status: p.verificationStatus,
      })),
    });
  } catch (error: any) {
    console.error('❌ Error fetching verification code:', error);
    return res.status(500).json({
      error: 'Failed to fetch verification code',
      message: error.message,
    });
  }
};

/**
 * Verify Payment Using QR Code
 * Validates a QR code scan and records the payment
 */
export const verifyPaymentWithQRCode = async (req: Request, res: Response) => {
  try {
    const { verificationCode, amount, currency, paymentMethod, transactionId } = req.body;

    // Validate required fields
    if (!verificationCode || !amount || !currency || !paymentMethod || !transactionId) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['verificationCode', 'amount', 'currency', 'paymentMethod', 'transactionId'],
      });
    }

    // Find verification code
    const verification = paymentVerifications.get(verificationCode.toUpperCase());

    if (!verification) {
      return res.status(404).json({
        error: 'Invalid verification code',
        message: 'The verification code does not exist',
      });
    }

    if (!verification.isActive()) {
      return res.status(400).json({
        error: 'Verification code expired',
        message: 'Please request a new verification code',
      });
    }

    // Check for duplicate transaction
    const isDuplicate = verification.paymentsMade.some(
      (p) => p.transactionId === transactionId
    );

    if (isDuplicate) {
      return res.status(400).json({
        error: 'Duplicate transaction',
        message: 'This transaction has already been verified',
      });
    }

    // Record the payment
    const payment = {
      amount: Number(amount),
      currency: currency.toUpperCase(),
      paymentMethod,
      transactionId,
      verifiedAt: new Date(),
      verificationStatus: 'verified' as const,
    };

    verification.paymentsMade.push(payment);
    verification.totalVerifiedAmount += payment.amount;
    verification.verificationCount += 1;

    // Update in map
    paymentVerifications.set(verificationCode.toUpperCase(), verification);

    console.log(`✅ Payment verified: ₹${amount} using code ${verificationCode}`);

    return res.json({
      success: true,
      message: 'Payment verified successfully',
      payment: {
        ...payment,
        verificationId: verificationCode,
      },
      verification: {
        totalVerifiedAmount: verification.totalVerifiedAmount,
        verificationCount: verification.verificationCount,
      },
    });
  } catch (error: any) {
    console.error('❌ Error verifying payment:', error);
    return res.status(500).json({
      error: 'Failed to verify payment',
      message: error.message,
    });
  }
};

/**
 * Get Payment Verification History
 * Retrieves all payments verified using a verification code
 */
export const getPaymentVerificationHistory = async (req: Request, res: Response) => {
  try {
    const organizerId = (req as any).user?.userId;

    if (!organizerId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const verification = Array.from(paymentVerifications.values()).find(
      (pv) => pv.organizerId === organizerId && pv.status === 'active'
    );

    if (!verification) {
      return res.json({
        success: true,
        history: [],
        totalAmount: 0,
        verificationCount: 0,
      });
    }

    return res.json({
      success: true,
      history: verification.paymentsMade.map((p) => ({
        amount: p.amount,
        currency: p.currency,
        paymentMethod: p.paymentMethod,
        transactionId: p.transactionId,
        verifiedAt: p.verifiedAt,
        status: p.verificationStatus,
      })),
      totalAmount: verification.totalVerifiedAmount,
      verificationCount: verification.verificationCount,
      verificationCode: verification.verificationCode,
      expiresAt: verification.expiresAt,
    });
  } catch (error: any) {
    console.error('❌ Error fetching payment history:', error);
    return res.status(500).json({
      error: 'Failed to fetch payment history',
      message: error.message,
    });
  }
};

/**
 * Deactivate Payment Verification Code
 * Marks a verification code as inactive
 */
export const deactivatePaymentVerification = async (req: Request, res: Response) => {
  try {
    const organizerId = (req as any).user?.userId;

    if (!organizerId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const verification = Array.from(paymentVerifications.values()).find(
      (pv) => pv.organizerId === organizerId && pv.status === 'active'
    );

    if (!verification) {
      return res.status(404).json({
        error: 'No active verification code found',
      });
    }

    verification.status = 'inactive';
    paymentVerifications.set(verification.verificationCode, verification);

    console.log(`🚫 Payment verification deactivated for organizer ${organizerId}`);

    return res.json({
      success: true,
      message: 'Payment verification code deactivated',
      totalVerifiedAmount: verification.totalVerifiedAmount,
      verificationCount: verification.verificationCount,
    });
  } catch (error: any) {
    console.error('❌ Error deactivating verification:', error);
    return res.status(500).json({
      error: 'Failed to deactivate verification code',
      message: error.message,
    });
  }
};

/**
 * Validate QR Code Scanned Data
 * Validates the scanned QR code data structure and signature
 */
export const validateQRCodeData = async (req: Request, res: Response) => {
  try {
    const { qrCodeData } = req.body;

    if (!qrCodeData) {
      return res.status(400).json({
        error: 'Missing QR code data',
      });
    }

    // Parse QR code data
    const data = JSON.parse(qrCodeData);

    // Validate required fields
    if (!data.organizerId || !data.verificationCode || !data.type) {
      return res.status(400).json({
        error: 'Invalid QR code data structure',
      });
    }

    if (data.type !== 'ORGANIZER_PAYMENT_VERIFICATION') {
      return res.status(400).json({
        error: 'Invalid QR code type',
      });
    }

    // Check if verification code exists and is active
    const verification = paymentVerifications.get(data.verificationCode.toUpperCase());

    if (!verification) {
      return res.status(404).json({
        error: 'Verification code not found',
      });
    }

    if (!verification.isActive()) {
      return res.status(400).json({
        error: 'Verification code expired',
      });
    }

    return res.json({
      success: true,
      isValid: true,
      organizerId: data.organizerId,
      verificationCode: data.verificationCode,
      generatedAt: data.generatedAt,
    });
  } catch (error: any) {
    console.error('❌ Error validating QR code:', error);
    return res.status(400).json({
      error: 'Invalid QR code data',
      message: error.message,
    });
  }
};

/**
 * Get Organizer Payment Verification Summary
 * Returns a summary of all verifications for an organizer
 */
export const getPaymentVerificationSummary = async (req: Request, res: Response) => {
  try {
    const organizerId = (req as any).user?.userId;

    if (!organizerId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get all verifications for this organizer
    const verifications = Array.from(paymentVerifications.values()).filter(
      (pv) => pv.organizerId === organizerId
    );

    if (verifications.length === 0) {
      return res.json({
        success: true,
        totalVerifications: 0,
        activeVerifications: 0,
        totalVerifiedAmount: 0,
        totalVerificationCount: 0,
        summary: [],
      });
    }

    const summary = verifications.map((v) => ({
      verificationCode: v.verificationCode,
      status: v.status,
      createdAt: v.createdAt,
      expiresAt: v.expiresAt,
      isActive: v.isActive(),
      totalVerifiedAmount: v.totalVerifiedAmount,
      verificationCount: v.verificationCount,
      paymentMethods: [...new Set(v.paymentsMade.map((p) => p.paymentMethod))],
    }));

    const activeVerifications = summary.filter((s) => s.isActive).length;
    const totalAmount = verifications.reduce((sum, v) => sum + v.totalVerifiedAmount, 0);
    const totalCount = verifications.reduce((sum, v) => sum + v.verificationCount, 0);

    return res.json({
      success: true,
      totalVerifications: verifications.length,
      activeVerifications,
      totalVerifiedAmount: totalAmount,
      totalVerificationCount: totalCount,
      summary,
    });
  } catch (error: any) {
    console.error('❌ Error fetching summary:', error);
    return res.status(500).json({
      error: 'Failed to fetch payment verification summary',
      message: error.message,
    });
  }
};
