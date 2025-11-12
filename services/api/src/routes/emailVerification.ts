import { Router } from 'express';
import { z } from 'zod';
import { emailOtpService } from '../services/emailOtpService';
import { User } from '../models/User';
import jwt from 'jsonwebtoken';

const router = Router();

// Schema for sending OTP
const sendOtpSchema = z.object({
  email: z.string().email('Invalid email address'),
  purpose: z.enum(['registration', 'login', 'reset']).optional().default('registration')
});

// Schema for verifying OTP
const verifyOtpSchema = z.object({
  email: z.string().email('Invalid email address'),
  otp: z.string().length(6, 'OTP must be 6 digits')
});

// Schema for resending OTP
const resendOtpSchema = z.object({
  email: z.string().email('Invalid email address'),
  purpose: z.enum(['registration', 'login', 'reset']).optional().default('registration')
});

/**
 * POST /api/verify-email/send-otp
 * Send OTP to user's email
 */
router.post('/send-otp', async (req, res) => {
  try {
    const parsed = sendOtpSchema.safeParse(req.body);
    
    if (!parsed.success) {
      return res.status(400).json({ 
        error: 'Validation error',
        details: parsed.error.flatten().fieldErrors 
      });
    }

    const { email, purpose } = parsed.data;

    // Send OTP
    const result = await emailOtpService.sendOTP(email, purpose);

    if (!result.success) {
      return res.status(400).json({ 
        error: result.message,
        code: result.error 
      });
    }

    return res.status(200).json({ 
      message: result.message,
      email,
      expiresIn: 300, // 5 minutes in seconds
      // Include OTP in development mode for testing
      ...(process.env.NODE_ENV === 'development' && result as any).otp && { otp: (result as any).otp }
    });

  } catch (error: any) {
    console.error('❌ Error sending OTP:', error);
    return res.status(500).json({ 
      error: 'Failed to send OTP',
      message: error.message 
    });
  }
});

/**
 * POST /api/verify-email/verify-otp
 * Verify OTP entered by user
 */
router.post('/verify-otp', async (req, res) => {
  try {
    const parsed = verifyOtpSchema.safeParse(req.body);
    
    if (!parsed.success) {
      return res.status(400).json({ 
        error: 'Validation error',
        details: parsed.error.flatten().fieldErrors 
      });
    }

    const { email, otp } = parsed.data;

    // Verify OTP
    const result = await emailOtpService.verifyOTP(email, otp);

    if (!result.success) {
      return res.status(400).json({ 
        error: result.message 
      });
    }

    // Generate JWT token for verified user
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT_SECRET environment variable is required');
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const token = jwt.sign(
      { userId: String(user._id), role: user.role }, 
      jwtSecret, 
      { expiresIn: '7d' }
    );

    return res.status(200).json({ 
      message: result.message,
      verified: true,
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        emailVerified: true
      }
    });

  } catch (error: any) {
    console.error('❌ Error verifying OTP:', error);
    return res.status(500).json({ 
      error: 'Failed to verify OTP',
      message: error.message 
    });
  }
});

/**
 * POST /api/verify-email/resend-otp
 * Resend OTP to user's email (with rate limiting)
 */
router.post('/resend-otp', async (req, res) => {
  try {
    const parsed = resendOtpSchema.safeParse(req.body);
    
    if (!parsed.success) {
      return res.status(400).json({ 
        error: 'Validation error',
        details: parsed.error.flatten().fieldErrors 
      });
    }

    const { email, purpose } = parsed.data;

    // Resend OTP
    const result = await emailOtpService.resendOTP(email, purpose);

    if (!result.success) {
      // Check if it's a rate limit error
      if (result.error === 'RATE_LIMIT') {
        return res.status(429).json({ 
          error: result.message,
          code: 'RATE_LIMIT',
          retryAfter: 60 
        });
      }

      return res.status(400).json({ 
        error: result.message,
        code: result.error 
      });
    }

    return res.status(200).json({ 
      message: result.message,
      email,
      expiresIn: 300, // 5 minutes in seconds
      // Include OTP in development mode for testing
      ...(process.env.NODE_ENV === 'development' && (result as any).otp && { otp: (result as any).otp })
    });

  } catch (error: any) {
    console.error('❌ Error resending OTP:', error);
    return res.status(500).json({ 
      error: 'Failed to resend OTP',
      message: error.message 
    });
  }
});

/**
 * GET /api/verify-email/status/:email
 * Check email verification status
 */
router.get('/status/:email', async (req, res) => {
  try {
    const email = req.params.email;

    if (!email || !z.string().email().safeParse(email).success) {
      return res.status(400).json({ error: 'Invalid email address' });
    }

    const user = await User.findOne({ email }).select('emailVerified emailVerificationExpiry');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const hasActiveOtp = user.emailVerificationExpiry && user.emailVerificationExpiry > new Date();

    return res.status(200).json({
      email,
      verified: user.emailVerified || false,
      hasActiveOtp,
      expiresAt: hasActiveOtp ? user.emailVerificationExpiry : null
    });

  } catch (error: any) {
    console.error('❌ Error checking verification status:', error);
    return res.status(500).json({ 
      error: 'Failed to check verification status',
      message: error.message 
    });
  }
});

export default router;
